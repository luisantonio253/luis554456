#!/usr/bin/env python3
"""Word timings for a voiceover -> words.json + phrases.json.

Usage:
  python timing.py voice.mp3 [script.txt] [--out work/] [--lang pt|en|...]

1. If faster-whisper (or openai-whisper) is importable, transcribe with word timestamps (best). The audio is decoded
   with ffmpeg into a float32 array (avoids PyAV version issues). English uses base.en; other languages use the
   multilingual "small" model with the script as the initial prompt.
2. Otherwise needs the script text: detects speech segments by silence (ffmpeg silencedetect), splits the script into
   phrases at punctuation, and aligns phrases to segments with a DP that matches phrase length (syllables) to segment
   duration. Words inside a phrase are spread by syllables. Syllables ignore accents (works for Portuguese/Spanish).
Always eyeball phrases.json against the audio; hand-fix if a phrase landed in the wrong gap.
"""
import json, re, subprocess, sys, os, unicodedata

LANG = sys.argv[sys.argv.index("--lang") + 1] if "--lang" in sys.argv else "en"

def syll(w):
    w = "".join(c for c in unicodedata.normalize("NFD", w.lower()) if unicodedata.category(c) != "Mn")
    w = re.sub(r"[^a-z0-9]", "", w)
    if not w: return 1
    if w.isdigit(): return 2
    n = len(re.findall(r"[aeiouy]+", w))
    if LANG == "en" and w.endswith("e") and n > 1 and not w.endswith("le"): n -= 1
    return max(1, n)

def duration(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True).stdout)

def speech_segments(path, db=-35, mind=0.12):
    err = subprocess.run(["ffmpeg", "-i", path, "-af", f"silencedetect=n={db}dB:d={mind}", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    D = duration(path); segs = []; cur = 0.0
    for s, e in zip(starts, ends + [D] * (len(starts) - len(ends))):
        if s - cur > 0.08: segs.append([cur, s])
        cur = e
    if D - cur > 0.08: segs.append([cur, D])
    return segs, D

def decode16k(path):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def whisper_words(path, prompt=None):
    model = "base.en" if LANG == "en" else "small"
    try:
        from faster_whisper import WhisperModel
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
        m = WhisperModel(model, compute_type="int8")
        segs, _ = m.transcribe(decode16k(path), language=LANG, word_timestamps=True, initial_prompt=prompt)
        return [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
    except Exception as e:
        print("faster-whisper unavailable:", str(e)[:120])
    try:
        import whisper
        r = whisper.load_model(model).transcribe(decode16k(path), language=LANG, word_timestamps=True, initial_prompt=prompt)
        return [{"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3)} for s in r["segments"] for w in s["words"]]
    except Exception:
        return None

def align(script, segs):
    raw = re.findall(r"[^,.;:!?]+[,.;:!?\"”']*", script.replace("\n", " "))
    phrases = [p.strip() for p in raw if p.strip()]
    P, S = len(phrases), len(segs)
    syl = [sum(syll(w) for w in p.split()) for p in phrases]
    tot_syl = sum(syl); tot_dur = sum(e - s for s, e in segs); rate = tot_syl / tot_dur
    import functools
    INF = 1e9
    @functools.lru_cache(None)
    def best(i, j):
        if i == P and j == S: return (0.0, ())
        if i == P or j == S: return (INF, ())
        out = (INF, ())
        for k in range(i + 1, min(P, i + 4) + 1):
            for l in range(j + 1, min(S, j + 3) + 1):
                if k - i > 1 and l - j > 1: continue
                d = segs[l - 1][1] - segs[j][0]; s_ = sum(syl[i:k]) / rate
                cost = (d - s_) ** 2 / max(d, 0.3)
                cost += sum(0.35 for m in range(i, k - 1) if re.search(r"[.!?][\"”']?$", phrases[m]))
                cost += sum(1.5 * (segs[m + 1][0] - segs[m][1]) for m in range(j, l - 1))
                sub = best(k, l)
                if sub[0] + cost < out[0]: out = (sub[0] + cost, ((i, k, j, l),) + sub[1])
        return out
    cost, plan = best(0, 0)
    words, phr = [], []
    for i, k, j, l in plan:
        a, b = segs[j][0], segs[l - 1][1]
        text = " ".join(phrases[i:k]); ws = text.split(); sy = [syll(w) for w in ws]; T = sum(sy); t = a
        phr.append({"text": text, "s": round(a, 3), "e": round(b, 3)})
        for w, s_ in zip(ws, sy):
            d = (b - a) * s_ / T; words.append({"w": w, "s": round(t, 3), "e": round(t + d, 3)}); t += d
    return words, phr, cost

if __name__ == "__main__":
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass
    flags = {"--out", "--lang"}
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] not in flags]
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "."
    os.makedirs(out, exist_ok=True)
    audio = args[0]
    script = open(args[1], encoding="utf-8").read() if len(args) > 1 and os.path.exists(args[1]) else (args[1] if len(args) > 1 else None)
    words = None if "--no-asr" in sys.argv else whisper_words(audio, script)
    segs, D = speech_segments(audio)
    if words:
        phr = []; cur = []
        for w in words:
            cur.append(w)
            if re.search(r"[,.;:!?]$", w["w"]): phr.append({"text": " ".join(x["w"] for x in cur), "s": cur[0]["s"], "e": cur[-1]["e"]}); cur = []
        if cur: phr.append({"text": " ".join(x["w"] for x in cur), "s": cur[0]["s"], "e": cur[-1]["e"]})
        src = "whisper"
    elif script:
        words, phr, cost = align(script, segs); src = f"silence-align (cost {cost:.2f})"
    else:
        print("NO_ASR: no whisper available and no script given. Ask the user for the script text (or install faster-whisper)."); sys.exit(2)
    json.dump(words, open(os.path.join(out, "words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"duration": D, "frames30": int(round(D * 30)), "source": src, "segments": segs, "phrases": phr}, open(os.path.join(out, "phrases.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"source={src} duration={D:.2f}s frames={int(round(D*30))}")
    for p in phr: print(f"{p['s']:6.2f}-{p['e']:6.2f}  f{int(p['s']*30):4d}-{int(p['e']*30):4d}  {p['text']}")
    print("words: " + " ".join(f"{w['w']}@{int(w['s']*30)}" for w in words))

"""Level-locked mix: music at 50 % of the voice (gated RMS, -6 dB), SFX at 50 % with peaks capped at 0.7x the voice peak.
Usage: python mix.py voice.mp3 music.wav sfx.wav  -> mix_raw.wav (no ducking, no compression)."""
import sys, subprocess, numpy as np, wave
SR = 48000
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def gated_rms(x, gate_db=-40):
    w = int(0.4 * SR); n = len(x) // w
    if n == 0: return float(np.sqrt(np.mean(x ** 2)) + 1e-12)
    b = x[: n * w].reshape(n, w); r = np.sqrt(np.mean(b ** 2, axis=1) + 1e-12)
    top = r.max(); keep = r[20 * np.log10(r / top) > gate_db]
    return float(np.sqrt(np.mean(keep ** 2)))
db = lambda x: 20 * np.log10(max(x, 1e-12))
v, m, s = (load(p) for p in sys.argv[1:4])
N = int(round(len(v) / SR * 30)) * SR // 30
N = max(N, len(v)); v = np.pad(v, (0, max(0, N - len(v))))[:N]
m = np.pad(m, (0, max(0, N - len(m))))[:N]; s = np.pad(s, (0, max(0, N - len(s))))[:N]
rv = gated_rms(v)
m *= 0.5 * rv / gated_rms(m)
s *= 0.5 * rv / gated_rms(s)
cap = 0.7 * np.abs(v).max()
if np.abs(s).max() > cap: s *= cap / np.abs(s).max()
print(f"voice gated RMS {db(rv):6.1f} dBFS | music {db(gated_rms(m)) - db(rv):+5.1f} dB vs voice | sfx {db(gated_rms(s)) - db(rv):+5.1f} dB vs voice | sfx peak/voice peak {np.abs(s).max() / np.abs(v).max():.2f}")
mix = v + m + s
g = 0.98 / max(1.0, np.abs(mix).max()); mix *= g   # one linear gain only
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
with wave.open("mix_raw.wav", "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("mix_raw.wav", len(pcm) / SR, "s")

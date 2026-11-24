"""Synthesized music bed + SFX stems for "As cenas absurdas do trailer". Writes music.wav and sfx.wav (mono, 48 kHz).
Levels are set later by mix.py (music and SFX locked to 50 % of the voice)."""
import numpy as np, wave

SR = 48000
TOTAL = 1714
DUR = TOTAL / 30
N = int(DUR * SR)
rng = np.random.default_rng(7)

def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / r)
def lp_fast(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)
def hp_fast(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 - 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)
def place(buf, sig, t0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i < N and j > i: buf[i:j] += sig[: j - i] * gain
midi = lambda m: 440 * 2 ** ((m - 69) / 12)
def noise(d): return rng.standard_normal(int(d * SR)).astype(np.float32)
F = lambda f: f / 30

# ---------------- music: a light bossa-style loop ----------------
music = np.zeros(N, np.float32)
BPM = 112; beat = 60 / BPM
# Dmaj7 - G7 - Em7 - A7 (voicings)
prog = [(50, [62, 66, 69, 73]), (55, [59, 62, 65, 67]), (52, [62, 64, 67, 71]), (57, [61, 64, 67, 69])]
def pluck(f, dur=0.35, bright=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum((bright ** k) * np.sin(2 * np.pi * f * (k + 1) * t) / (k + 1) for k in range(6))
    return (s * env(n, 0.003, dur * 0.35)).astype(np.float32)
def chord(ms, dur, bright=0.45):
    s = sum(pluck(midi(m), dur, bright) for m in ms) / len(ms); return s
def surdo():
    n = int(0.4 * SR); t = np.arange(n) / SR; f = 55 + 40 * np.exp(-t * 25)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)).astype(np.float32)
def shaker():
    d = 0.07; n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(noise(d), 5000) * np.sin(np.pi * t / d) ** 2).astype(np.float32)
def rim():
    n = int(0.06 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 90) + hp_fast(noise(0.06), 2000) * np.exp(-t * 80) * 0.4).astype(np.float32)
def flute(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR; ph = 2 * np.pi * f * t + 0.004 * np.sin(2 * np.pi * 5.5 * t) * f / 100
    s = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.05 * lp_fast(noise(dur), 3000)
    a = np.minimum(1, t / 0.04) * np.minimum(1, (dur - t) / 0.08).clip(0)
    return (s * a).astype(np.float32)

# ---------------- music: a bouncy quiz-show loop (C - Am - F - G), staccato plucks, bass, shaker, rim ----------------
music = np.zeros(N, np.float32)
BPM = 120; beat = 60 / BPM
# ---------------- music: a retro "Miami" groove (Am - F - C - G), synth bass, claps, plucks, lead ----------------
music = np.zeros(N, np.float32)
BPM = 116; beat = 60 / BPM
prog = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]
melody = [76, 74, 72, 69, 72, 74, 76, 79]
MUSIC_END = F(1669)  # stops on the twist "É a versão resumida"
def sbass(f, d):
    n = int(d * SR); t = np.arange(n) / SR; ph = (f * t) % 1.0
    s = (2 * ph - 1) * 0.6 + np.sin(2 * np.pi * f * t) * 0.6
    return (lp_fast(s.astype(np.float32), 700) * np.minimum(1, t / 0.005) * np.exp(-t * 3.5)).astype(np.float32)
def clap():
    d = 0.12; n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(lp_fast(noise(d), 5000), 900) * (np.exp(-t * 40) + 0.5 * np.exp(-np.maximum(0, t - 0.012) * 35)) * 0.7).astype(np.float32)
def kick():
    n = int(0.25 * SR); t = np.arange(n) / SR; f = 50 + 90 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)).astype(np.float32)
bar = 0; tt = 0.0
while tt < MUSIC_END:
    root, ch = prog[bar % 4]
    for k in range(8):
        te = tt + k * beat / 2
        if te >= MUSIC_END: break
        place(music, shaker(), te, 0.08 if k % 2 else 0.05)
        place(music, sbass(midi(root - 12 + (12 if k % 4 == 3 else 0)), beat * 0.45), te, 0.45)
        if k % 2 == 1: place(music, chord(ch, 0.2, 0.6), te, 0.3)
    for k in range(4):
        if tt + k * beat < MUSIC_END:
            place(music, kick(), tt + k * beat, 0.5)
            if k % 2 == 1: place(music, clap(), tt + k * beat, 0.3)
    if bar % 2 == 1:
        seg = melody[(bar // 2) % 2 * 4:(bar // 2) % 2 * 4 + 4]
        for k, m in enumerate(seg):
            if tt + k * beat < MUSIC_END: place(music, flute(midi(m), beat * 0.5), tt + k * beat, 0.06)
    bar += 1; tt += beat * 4
i0 = int((MUSIC_END - 0.06) * SR); music[i0:] *= np.linspace(1, 0, N - i0) ** 10
dn = int((DUR - MUSIC_END) * SR); td = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 55 * td) + 0.5 * np.sin(2 * np.pi * 82.4 * td) + 0.25 * np.sin(2 * np.pi * 110 * td)) * np.minimum(1, td / 0.4) * np.minimum(1, (td[-1] - td) / 0.15 + 1e-3)
place(music, lp_fast(drone.astype(np.float32), 500), MUSIC_END, 0.35)

# ---------------- sfx ----------------
sfx = np.zeros(N, np.float32)
def whoosh(d=0.5):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 1500) * np.sin(np.pi * t / d) ** 2 * 0.6).astype(np.float32)
def waves(d):
    n = int(d * SR); t = np.arange(n) / SR
    sw = 0.55 + 0.45 * np.sin(2 * np.pi * t / 3.2) ** 2
    return (lp_fast(noise(d), 700) * 0.6 * sw * np.minimum(1, t / 0.5) * np.minimum(1, (d - t) / 0.4)).astype(np.float32)
def gull():
    d = 0.5; n = int(d * SR); t = np.arange(n) / SR; f = 1600 + 900 * np.sin(np.pi * t / d) - 600 * t
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2 * 0.35 * (1 + 0.3 * np.sin(2 * np.pi * 30 * t))).astype(np.float32)
def creak(d=0.6, f0=140):
    n = int(d * SR); t = np.arange(n) / SR
    rate = f0 * (1 + 0.35 * np.sin(2 * np.pi * 1.3 * t / d)); ph = np.cumsum(rate) / SR; pulses = (np.mod(ph, 1) < 0.08).astype(np.float32)
    return hp_fast(lp_fast(pulses * (0.6 + 0.4 * rng.random(n).astype(np.float32)), 2200) * np.sin(np.pi * t / d), 200) * 2.5
def thunk(f0=90, d=0.3):
    n = int(d * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f0 * t * (1 + 0.6 * np.exp(-t * 40))) * np.exp(-t * 14) + lp_fast(noise(d), 1200) * np.exp(-t * 30) * 0.5).astype(np.float32)
def ting():
    n = int(1.0 * SR); t = np.arange(n) / SR
    return (sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k in [(2093, 4), (3136, 6), (4186, 8)]) * 0.3).astype(np.float32)
def boing(d=0.5):
    n = int(d * SR); t = np.arange(n) / SR; f = 180 + 220 * np.exp(-t * 6) * (1 + 0.3 * np.sin(2 * np.pi * 18 * t))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5)).astype(np.float32)
def scratch(d):
    n = int(d * SR); t = np.arange(n) / SR
    s = hp_fast(noise(d), 2500) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * t))) * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.05)
    return (s * 0.5).astype(np.float32)
def splash(d=1.0):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 4000) * (np.exp(-t * 4) * np.minimum(1, t / 0.01)) + lp_fast(noise(d), 400) * np.exp(-t * 7) * 1.5).astype(np.float32)
def rush(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 1200) * np.minimum(1, t / 0.8) * np.minimum(1, (d - t) / 0.6) * 0.8).astype(np.float32)
def tick():
    n = int(0.05 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120)).astype(np.float32)
def whistle(notes, dur):
    out = []
    for m in notes:
        n = int(dur * SR); t = np.arange(n) / SR; f = midi(m) * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
        out.append(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.05).clip(0) * 0.5)
    return np.concatenate(out).astype(np.float32)
def scrape(d=0.8):
    n = int(d * SR); t = np.arange(n) / SR
    s = hp_fast(lp_fast(noise(d) * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t)) * np.sin(np.pi * t / d), 4000), 700)
    return (s * 0.8 + np.sin(2 * np.pi * 420 * t) * np.exp(-t * 4) * 0.15).astype(np.float32)
def sting():
    n = int(2.0 * SR); t = np.arange(n) / SR
    low = np.sin(2 * np.pi * 41 * t) * np.exp(-t * 1.5) * 1.2; hit = lp_fast(noise(2.0), 900) * np.exp(-t * 6) * 0.8
    stab = sum(np.sin(2 * np.pi * midi(m) * t) for m in (50, 53, 56)) / 3 * np.exp(-t * 2.2)
    return (low + hit + stab * 0.8).astype(np.float32)
def drip():
    n = int(0.25 * SR); t = np.arange(n) / SR; f = 900 + 1400 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * 0.6).astype(np.float32)
def stream(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(lp_fast(noise(d), 3500), 500) * 0.35 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.8 * t)) * np.minimum(1, t / 0.6)).astype(np.float32)
def city(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 500) * 0.35 * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.3)).astype(np.float32)

def swish(d=0.35):
    n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(noise(d), 1800) * np.exp(-t * 9) * np.minimum(1, t / 0.01) * 0.8).astype(np.float32)
def buzzer(d=0.45):
    n = int(d * SR); t = np.arange(n) / SR; sq = np.sign(np.sin(2 * np.pi * 110 * t)) + 0.5 * np.sign(np.sin(2 * np.pi * 116 * t))
    return (lp_fast(sq.astype(np.float32), 1500) * np.minimum(1, t / 0.01) * np.minimum(1, (d - t) / 0.04) * 0.35).astype(np.float32)
def crowd(d, peak=1.0):
    n = int(d * SR); t = np.arange(n) / SR
    s = lp_fast(noise(d), 1400) * 0.5 + hp_fast(lp_fast(noise(d), 3000), 600) * 0.3 * (0.7 + 0.3 * np.sin(2 * np.pi * 3.1 * t))
    return (s * np.minimum(1, t / 0.15) * np.minimum(1, (d - t) / 0.5) * peak).astype(np.float32)

def chomp():
    n = int(0.12 * SR); t = np.arange(n) / SR
    return (lp_fast(noise(0.12), 2500) * np.exp(-t * 45) * 0.9 + np.sin(2 * np.pi * 160 * t) * np.exp(-t * 35)).astype(np.float32)
def hiss(d=0.6):
    n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(noise(d), 3000) * np.minimum(1, t / 0.05) * np.exp(-t * 3) * 0.6).astype(np.float32)
def ding_dong():
    out = []
    for m in (76, 72):
        n = int(0.45 * SR); t = np.arange(n) / SR; out.append((np.sin(2 * np.pi * midi(m) * t) + 0.3 * np.sin(4 * np.pi * midi(m) * t)) * np.exp(-t * 5))
    return np.concatenate(out).astype(np.float32) * 0.5
def slide(d=0.45):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 900) * np.sin(np.pi * t / d) * 0.6).astype(np.float32)
def shutter():
    n = int(0.08 * SR); t = np.arange(n) / SR
    return (hp_fast(noise(0.08), 2000) * np.exp(-t * 60) + np.sin(2 * np.pi * 1200 * t) * np.exp(-t * 80) * 0.4).astype(np.float32)
def pop_(f0=600):
    n = int(0.12 * SR); t = np.arange(n) / SR; f = f0 + 500 * np.exp(-t * 40)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 25) * 0.6).astype(np.float32)
def neon_buzz(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast((np.sign(np.sin(2 * np.pi * 120 * t)) * 0.3).astype(np.float32), 2000) * (0.6 + 0.4 * (rng.random(n) > 0.3)) * np.minimum(1, (d - t) / 0.05)).astype(np.float32)

# hook: the gator in the pool, family laughing, crane up
place(sfx, waves(5.5) * 0.4, 0, 0.5)
place(sfx, splash(0.8), F(96), 0.7); place(sfx, chomp(), F(97), 0.8)
place(sfx, whoosh(0.8), F(112), 0.4); place(sfx, shutter(), F(130), 0.4); place(sfx, shutter(), F(140), 0.35)
# 2023 living room
place(sfx, whoosh(0.4), F(183), 0.6); place(sfx, ting(), F(205), 0.4)
place(sfx, crowd(1.2, 0.5), F(302), 0.3); place(sfx, boing(0.4), F(345), 0.35)
# back to the pool: sign, handler, the pull, tape, snaps, family
place(sfx, whoosh(0.4), F(386), 0.6); place(sfx, waves(4.0) * 0.4, F(390), 0.4)
place(sfx, thunk(150, 0.2), F(469), 0.6)
place(sfx, swish(0.3), F(516), 0.4); place(sfx, scrape(0.6), F(530), 0.4)
place(sfx, splash(1.0), F(534), 0.9); place(sfx, hiss(0.7), F(550), 0.4)
place(sfx, scratch(0.35), F(568), 0.35); place(sfx, ting(), F(572), 0.35)
place(sfx, chomp(), F(600), 0.8); place(sfx, chomp(), F(612), 0.8)
place(sfx, crowd(0.9, 0.7), F(615), 0.35)
# the store: doors, ding-dong, gator steps, clerk, CCTV
place(sfx, whoosh(0.4), F(632), 0.6); place(sfx, ding_dong(), F(678), 0.5); place(sfx, slide(0.5), F(676), 0.5)
for k in range(700, 830, 9): place(sfx, thunk(220, 0.08), F(k), 0.18)
place(sfx, chomp(), F(705), 0.5); place(sfx, boing(0.4), F(729), 0.4)
place(sfx, tick(), F(778), 0.5); place(sfx, buzzer(0.25) * 0.4, F(779), 0.4)
for k in range(780, 830, 10): place(sfx, tick(), F(k), 0.2)
# Miami night street: city hum, horns, neon, phones, likes
place(sfx, whoosh(0.4), F(827), 0.6); place(sfx, city(6.0), F(831), 0.5)
place(sfx, neon_buzz(0.5), F(945), 0.35); place(sfx, ting(), F(950), 0.35)
place(sfx, shutter(), F(970), 0.45); place(sfx, shutter(), F(976), 0.45)
for k, a in enumerate((990, 999, 1008)): place(sfx, pop_(700 + 120 * k), F(a), 0.5)
# phone + POV
place(sfx, whoosh(0.4), F(1010), 0.6); place(sfx, thunk(260, 0.1), F(1023), 0.5)
place(sfx, swish(0.25), F(1056), 0.4)
for k in range(1082, 1104, 6): place(sfx, swish(0.12), F(k), 0.25)
place(sfx, ting(), F(1131), 0.5)
# the map: title flip, sub, pin, label
place(sfx, whoosh(0.5), F(1157), 0.6); place(sfx, waves(6.0) * 0.4, F(1161), 0.35)
place(sfx, thunk(90, 0.35), F(1200), 0.7); place(sfx, ting(), F(1201), 0.4)
place(sfx, pop_(520), F(1251), 0.5)
place(sfx, whoosh(0.3), F(1296), 0.4); place(sfx, thunk(70, 0.35), F(1314), 0.8); place(sfx, pop_(640), F(1333), 0.5)
# proof: board flip, question marks, checks
place(sfx, swish(0.35), F(1350), 0.5)
for k in range(3): place(sfx, boing(0.3), F(1365 + k * 3), 0.25)
for k in range(3): place(sfx, ting(), F(1439 + k * 2), 0.3)
# exaggerated
place(sfx, whoosh(0.4), F(1465), 0.6); place(sfx, thunk(55, 0.45), F(1525), 1.0)
# payoff: tiles pop, then the sting on "resumida"
for k in range(1560, 1656, 3): place(sfx, pop_(500 + (k * 37) % 400), F(k), 0.18)
place(sfx, sting(), F(1686), 0.9); place(sfx, thunk(45, 0.5), F(1687), 0.8)

fade = int(0.04 * SR); music[-fade:] *= np.linspace(1, 0, fade); sfx[-fade:] *= np.linspace(1, 0, fade)
def wr(name, x):
    pcm = (np.clip(x / max(1e-6, np.abs(x).max()) * 0.9, -1, 1) * 32767).astype(np.int16)
    with wave.open(name, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
wr("music.wav", music); wr("sfx.wav", sfx)
print("stems ok", DUR)

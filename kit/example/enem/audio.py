"""Synthesized music bed + SFX stems for "O chute que vale menos". Writes music.wav and sfx.wav (mono, 48 kHz).
Levels are set later by mix.py (music and SFX locked to 50 % of the voice)."""
import numpy as np, wave

SR = 48000
TOTAL = 761
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
prog = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [59, 62, 67])]
melody = [72, 76, 79, 76, 77, 76, 74, 71]
MUSIC_END = F(613)  # stops on the twist line "Para a TRI..."
bar = 0; tt = 0.0
while tt < MUSIC_END:
    root, ch = prog[bar % 4]
    for k in range(8):
        te = tt + k * beat / 2
        if te >= MUSIC_END: break
        place(music, shaker(), te, 0.1 if k % 2 else 0.06)
        if k % 2 == 1: place(music, chord(ch, 0.18, 0.55), te, 0.38)
        if k in (2, 6): place(music, rim(), te, 0.14)
    for k in (0, 1, 2, 3):
        if tt + k * beat < MUSIC_END: place(music, pluck(midi(root - 12 + (7 if k % 2 else 0)), 0.32, 0.3), tt + k * beat, 0.5)
    if bar % 2 == 1:
        seg = melody[(bar // 2) % 2 * 4:(bar // 2) % 2 * 4 + 4]
        for k, m in enumerate(seg):
            if tt + k * beat < MUSIC_END: place(music, flute(midi(m), beat * 0.45), tt + k * beat, 0.07)
    bar += 1; tt += beat * 4
i0 = int((MUSIC_END - 0.06) * SR); music[i0:] *= np.linspace(1, 0, N - i0) ** 10
dn = int((F(703) - MUSIC_END) * SR); td = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 49 * td) + 0.5 * np.sin(2 * np.pi * 73.4 * td) + 0.25 * np.sin(2 * np.pi * 98 * td)) * np.minimum(1, td / 0.6) * np.minimum(1, (td[-1] - td) / 0.15 + 1e-3)
place(music, lp_fast(drone.astype(np.float32), 500), MUSIC_END, 0.35)
# "o gol conta": a short fanfare stab, then the sad deflating trombone on "vale menos"
place(music, chord([60, 64, 67, 72], 0.6, 0.6), F(703), 0.7)
def trombone(notes, durs):
    out = []
    for m, d in zip(notes, durs):
        n = int(d * SR); t = np.arange(n) / SR; f = midi(m) * (1 + 0.012 * np.sin(2 * np.pi * 5 * t) * (t / d))
        ph = 2 * np.pi * np.cumsum(f) / SR; s = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)
        out.append(s * np.minimum(1, t / 0.03) * np.minimum(1, (d - t) / 0.05).clip(0))
    return lp_fast(np.concatenate(out).astype(np.float32), 1800) * 0.5
place(music, trombone([55, 54, 53, 52], [0.2, 0.2, 0.2, 0.55]), F(733), 0.8)
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

# hook: pencil fills the bubble, the +1 coin, then it deflates
place(sfx, scratch(0.28), F(16), 0.5)
place(sfx, ting(), F(22), 0.45)
place(sfx, whistle([79, 76, 72, 67], 0.07), F(66), 0.4)
# the classroom
place(sfx, whoosh(0.6), F(97), 0.4)
place(sfx, ting(), F(135), 0.35); place(sfx, ting(), F(137), 0.25)
for k in range(0, 33, 3): place(sfx, tick(), F(182 + k), 0.35)
place(sfx, ting(), F(213), 0.45); place(sfx, boing(0.4), F(201), 0.3)
# the TRI staircase
place(sfx, whoosh(0.5), F(222), 0.7)
for k in range(3): place(sfx, thunk(120 - 15 * k, 0.3), F(248 + 3 * k), 0.8)
place(sfx, whoosh(0.4), F(273), 0.5)
place(sfx, whoosh(1.0), F(330), 0.35)
place(sfx, ting(), F(382), 0.4); place(sfx, thunk(70, 0.4), F(413), 0.7); place(sfx, ting(), F(414), 0.3)
# Bruno trips, then jumps to the top
place(sfx, thunk(65, 0.35), F(449), 0.9); place(sfx, boing(0.4), F(451), 0.35)
place(sfx, boing(0.6), F(466), 0.5); place(sfx, whoosh(0.5), F(468), 0.4)
place(sfx, thunk(80, 0.3), F(483), 0.7); place(sfx, ting(), F(501), 0.45)
# the pitch
place(sfx, whoosh(0.5), F(522), 0.6); place(sfx, crowd(F(613 - 525), 0.6), F(525), 0.45)
place(sfx, thunk(110, 0.2), F(532), 0.9); place(sfx, whoosh(0.7), F(533), 0.6)
place(sfx, boing(0.45), F(548), 0.35)
place(sfx, thunk(110, 0.2), F(576), 0.9); place(sfx, whoosh(0.4), F(577), 0.5)
place(sfx, swish(0.5), F(587), 0.9); place(sfx, crowd(1.0, 1.4), F(589), 0.6)
# the twist
place(sfx, sting(), F(613), 0.9)
place(sfx, buzzer(0.45), F(657), 0.7)
place(sfx, thunk(50, 0.5), F(679), 1.0)
# payoff
place(sfx, whoosh(0.4), F(700), 0.5); place(sfx, crowd(F(745 - 703), 1.3), F(703), 0.6); place(sfx, ting(), F(704), 0.4)
place(sfx, thunk(45, 0.5), F(744), 0.9)

fade = int(0.04 * SR); music[-fade:] *= np.linspace(1, 0, fade); sfx[-fade:] *= np.linspace(1, 0, fade)
def wr(name, x):
    pcm = (np.clip(x / max(1e-6, np.abs(x).max()) * 0.9, -1, 1) * 32767).astype(np.int16)
    with wave.open(name, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
wr("music.wav", music); wr("sfx.wav", sfx)
print("stems ok", DUR)

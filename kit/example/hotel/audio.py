"""Synthesized music bed + SFX stems for "O vazamento do Fire Stick". Writes music.wav and sfx.wav (mono, 48 kHz).
Levels are set later by mix.py (music and SFX locked to 50 % of the voice)."""
import numpy as np, wave

SR = 48000
TOTAL = 1661
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


# ---------------- music: a sneaky "heist" groove in D minor (Dm - Bb - Gm - A), synth bass, kick, hats, plucked arps ----------------
music = np.zeros(N, np.float32)
BPM = 104; beat = 60 / BPM
prog = [(38, [62, 65, 69]), (34, [62, 65, 70]), (43, [62, 67, 70]), (45, [61, 64, 69])]
MUSIC_END = F(1576)  # stops on "Mas ninguem pensou..."
def sbass(f, d):
    n = int(d * SR); t = np.arange(n) / SR; ph = (f * t) % 1.0
    s = (2 * ph - 1) * 0.6 + np.sin(2 * np.pi * f * t) * 0.6
    return (lp_fast(s.astype(np.float32), 600) * np.minimum(1, t / 0.005) * np.exp(-t * 4)).astype(np.float32)
def kick():
    n = int(0.25 * SR); t = np.arange(n) / SR; f = 50 + 90 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)).astype(np.float32)
def hat():
    d = 0.04; n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(noise(d), 7000) * np.exp(-t * 90)).astype(np.float32)
def snap():
    d = 0.1; n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(lp_fast(noise(d), 4000), 1200) * np.exp(-t * 45) * 0.8).astype(np.float32)
bar = 0; tt = 0.0
while tt < MUSIC_END:
    root, ch = prog[bar % 4]
    for k in range(8):
        te = tt + k * beat / 2
        if te >= MUSIC_END: break
        place(music, hat(), te, 0.06 if k % 2 else 0.035)
        if k in (0, 3, 4, 6): place(music, sbass(midi(root - 12 + (7 if k == 6 else 0)), beat * 0.42), te, 0.5)
        place(music, pluck(midi(ch[k % 3] + (12 if k >= 4 else 0)), 0.18, 0.55), te, 0.11)
    for k in range(4):
        if tt + k * beat < MUSIC_END:
            if k in (0, 2): place(music, kick(), tt + k * beat, 0.5)
            else: place(music, snap(), tt + k * beat, 0.25)
    bar += 1; tt += beat * 4
i0 = int((MUSIC_END - 0.06) * SR); music[i0:] *= np.linspace(1, 0, N - i0) ** 10
dn = int((DUR - MUSIC_END) * SR); td = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 73.4 * td) + 0.5 * np.sin(2 * np.pi * 110 * td) + 0.25 * np.sin(2 * np.pi * 146.8 * td)) * np.minimum(1, td / 0.4) * np.minimum(1, (td[-1] - td) / 0.15 + 1e-3)
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


def siren(d):
    n = int(d * SR); t = np.arange(n) / SR; f = np.where((t % 0.8) < 0.4, 960, 770)
    return (lp_fast(np.sin(2 * np.pi * np.cumsum(f) / SR).astype(np.float32), 2500) * np.minimum(1, t / 0.2) * np.minimum(1, (d - t) / 0.3) * 0.35).astype(np.float32)
def typing(d, seed=1):
    out = np.zeros(int(d * SR), np.float32); r = np.random.default_rng(seed); t = 0.0
    while t < d - 0.05:
        i = int(t * SR); s = tick() * (0.4 + 0.4 * r.random()); s = s[: len(out) - i]; out[i:i + len(s)] += s; t += 0.06 + 0.07 * r.random()
    return out
def beep(f=1800, d=0.09):
    n = int(d * SR); t = np.arange(n) / SR
    return (np.sign(np.sin(2 * np.pi * f * t)) * 0.25 * np.minimum(1, (d - t) / 0.01)).astype(np.float32)
def zap(d=0.35):
    n = int(d * SR); t = np.arange(n) / SR; f = 1800 * np.exp(-t * 6) + 200
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) * 0.5).astype(np.float32)
def rumble(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 160) * 1.4 * np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.5)).astype(np.float32)
def alarm(d):
    n = int(d * SR); t = np.arange(n) / SR; on = ((t % 0.5) < 0.3).astype(np.float32)
    return (lp_fast(np.sign(np.sin(2 * np.pi * 620 * t)).astype(np.float32), 2200) * on * 0.25 * np.minimum(1, (d - t) / 0.1)).astype(np.float32)

# hook: TV uploading, typing, beeps; the crossed laptop
place(sfx, typing(3.2, 1), 0.2, 0.35)
for k in range(10, 140, 24): place(sfx, beep(1500 + (k % 3) * 300), F(k), 0.35)
place(sfx, whoosh(0.6), F(100), 0.4); place(sfx, buzzer(0.3), F(122), 0.45); place(sfx, boing(0.35), F(124), 0.3)
# street: city hum, siren, billboard, stamps
place(sfx, whoosh(0.4), F(147), 0.6); place(sfx, city(8.2), F(151), 0.45); place(sfx, siren(2.2), F(151), 0.18)
place(sfx, thunk(150, 0.2), F(154), 0.6); place(sfx, thunk(110, 0.3), F(175), 0.7)
place(sfx, thunk(90, 0.3), F(279), 0.7)
for a in (289, 303, 313): place(sfx, thunk(70, 0.3), F(a), 0.8)
place(sfx, swish(0.35), F(350), 0.5); place(sfx, scratch(0.3), F(356), 0.25)
place(sfx, pop_(560), F(424), 0.5); place(sfx, buzzer(0.35), F(431), 0.45)
# hotel exterior: neon flicker on
place(sfx, whoosh(0.4), F(446), 0.6); place(sfx, city(1.4), F(450), 0.4); place(sfx, neon_buzz(0.45), F(481), 0.4)
# waiting: clock ticks; lying on the bed
place(sfx, whoosh(0.4), F(489), 0.5)
for k in range(495, 532, 8): place(sfx, tick(), F(k), 0.35)
place(sfx, boing(0.6) * 0.6, F(548), 0.3)
# the TV, the Fire Stick
place(sfx, boing(0.35), F(598), 0.35); place(sfx, swish(0.3), F(616), 0.6)
place(sfx, whoosh(0.4), F(660), 0.35); place(sfx, ting(), F(673), 0.45); place(sfx, ting(), F(683), 0.3)
# streaming menu clicks
place(sfx, swish(0.3), F(702), 0.4)
for a in (712, 734, 756): place(sfx, tick(), F(a), 0.45)
# buying: bag, phone, keyboard, mouse
place(sfx, scrape(0.4), F(780), 0.35)
for a, f0 in ((795, 620), (825, 700), (849, 780)): place(sfx, pop_(f0), F(a), 0.55)
# transform the TV
place(sfx, typing(1.6, 3), F(870), 0.4); place(sfx, zap(0.4), F(913), 0.4); place(sfx, thunk(60, 0.4), F(919), 0.8); place(sfx, ting(), F(920), 0.45)
# the fortress: rumble, access, gate, lasers off
place(sfx, whoosh(0.5), F(940), 0.6); place(sfx, rumble(6.8), F(944), 0.5)
place(sfx, beep(900, 0.15), F(986), 0.4); place(sfx, beep(1400, 0.2), F(991), 0.45)
place(sfx, zap(0.5), F(994), 0.5); place(sfx, slide(0.7), F(995), 0.6); place(sfx, thunk(50, 0.5), F(1010), 0.7)
# clips flying out, counter ticking to 90
for i in range(22): place(sfx, swish(0.22), F(1022 + i * 4.6), 0.22)
for k in range(1022, 1121, 4): place(sfx, tick(), F(k), 0.18)
place(sfx, thunk(70, 0.4), F(1128), 0.7); place(sfx, crowd(0.8, 0.6), F(1128), 0.3)
# millions watching: tiles pop
place(sfx, whoosh(0.4), F(1147), 0.6); place(sfx, crowd(4.0, 0.7), F(1151), 0.25)
for k in range(1153, 1245, 3): place(sfx, pop_(480 + (k * 37) % 420), F(k), 0.16)
# official statement + stamp
place(sfx, whoosh(0.4), F(1268), 0.6)
for k in range(1276, 1312, 9): place(sfx, tick(), F(k), 0.3)
place(sfx, thunk(55, 0.45), F(1340), 1.0)
# the code threat
place(sfx, whoosh(0.4), F(1360), 0.6); place(sfx, typing(1.0, 5), F(1366), 0.35); place(sfx, buzzer(0.3), F(1396), 0.45)
# billionaire security: alarm, lasers back on
place(sfx, whoosh(0.4), F(1441), 0.6); place(sfx, rumble(2.5), F(1445), 0.35); place(sfx, zap(0.4), F(1472), 0.45); place(sfx, alarm(1.5), F(1472), 0.5)
# empty desk
place(sfx, whoosh(0.4), F(1517), 0.6); place(sfx, thunk(120, 0.25), F(1556), 0.6)
# payoff: music stops, remote, sting on the last words
place(sfx, swish(0.35), F(1574), 0.45)
for k in range(1632, 1650, 6): place(sfx, beep(2200, 0.05), F(k), 0.3)
place(sfx, sting(), F(1642), 0.9); place(sfx, thunk(45, 0.5), F(1643), 0.7)

fade = int(0.04 * SR); music[-fade:] *= np.linspace(1, 0, fade); sfx[-fade:] *= np.linspace(1, 0, fade)
def wr(name, x):
    pcm = (np.clip(x / max(1e-6, np.abs(x).max()) * 0.9, -1, 1) * 32767).astype(np.int16)
    with wave.open(name, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
wr("music.wav", music); wr("sfx.wav", sfx)
print("stems ok", DUR)

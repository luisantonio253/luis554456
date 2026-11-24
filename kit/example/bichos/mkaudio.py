import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))).replace(os.sep, '/') + '/'  # project dir (script lives in work/)
ex = open(R + 'work/audio_trailer.py', encoding='utf-8').read().split('\n')  # the trailer example's audio.py = synth library
L = lambda a, b: ex[a - 1:b]
head = L(1, 50)
head[0] = '"""Synthesized music bed + SFX stems for "Mais de 100 animais e milhares de portas". Writes music.wav and sfx.wav (mono, 48 kHz).'
head = [('TOTAL = 1940' if l.startswith('TOTAL =') else l) for l in head]
synths = L(93, 189)
music = r'''
# ---------------- music: a sunny Leonida groove (C - Am - F - G), plucks, synth bass, shaker, claps, flute ----------------
music = np.zeros(N, np.float32)
BPM = 112; beat = 60 / BPM
prog = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])]
melody = [72, 74, 76, 79, 76, 74, 72, 67]
MUSIC_END = F(1659)  # stops on "Só que tem um detalhe"
def sbass(f, d):
    n = int(d * SR); t = np.arange(n) / SR; ph = (f * t) % 1.0
    s = (2 * ph - 1) * 0.5 + np.sin(2 * np.pi * f * t) * 0.7
    return (lp_fast(s.astype(np.float32), 600) * np.minimum(1, t / 0.005) * np.exp(-t * 3.5)).astype(np.float32)
def clap():
    d = 0.12; n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(lp_fast(noise(d), 5000), 900) * (np.exp(-t * 40) + 0.5 * np.exp(-np.maximum(0, t - 0.012) * 35)) * 0.7).astype(np.float32)
def kick():
    n = int(0.25 * SR); t = np.arange(n) / SR; f = 50 + 90 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)).astype(np.float32)
PAST = (F(1029), F(1339))  # GTA 5 town: softer, no kick
bar = 0; tt = 0.0
while tt < MUSIC_END:
    root, ch = prog[bar % 4]; past = PAST[0] <= tt < PAST[1]
    for k in range(8):
        te = tt + k * beat / 2
        if te >= MUSIC_END: break
        place(music, shaker(), te, 0.07 if k % 2 else 0.045)
        place(music, sbass(midi(root - 12 + (7 if k % 4 == 2 else 0)), beat * 0.42), te, 0.4)
        if k % 2 == 1: place(music, chord(ch, 0.22, 0.25 if past else 0.55), te, 0.3)
    for k in range(4):
        if tt + k * beat < MUSIC_END:
            if not past: place(music, kick(), tt + k * beat, 0.45)
            if k % 2 == 1: place(music, clap() if not past else rim(), tt + k * beat, 0.28)
    if bar % 2 == 1:
        seg = melody[(bar // 2) % 2 * 4:(bar // 2) % 2 * 4 + 4]
        for k, m in enumerate(seg):
            if tt + k * beat < MUSIC_END: place(music, flute(midi(m), beat * 0.5), tt + k * beat, 0.06)
    bar += 1; tt += beat * 4
i0 = int((MUSIC_END - 0.06) * SR); music[i0:] *= np.linspace(1, 0, N - i0) ** 10
dd = F(1798) - MUSIC_END; dn = int(dd * SR); td = np.arange(dn) / SR
drone = (np.sin(2 * np.pi * 55 * td) + 0.5 * np.sin(2 * np.pi * 82.4 * td) + 0.25 * np.sin(2 * np.pi * 110 * td)) * np.minimum(1, td / 0.4) * np.minimum(1, (td[-1] - td) / 0.3 + 1e-3)
place(music, lp_fast(drone.astype(np.float32), 500), MUSIC_END, 0.35)
# soft resolve: plucked C chord on "cachorro"
for k, m in enumerate([60, 64, 67, 72]): place(music, pluck(midi(m), 1.6, 0.4), F(1915) + k * 0.06, 0.35)
place(music, flute(midi(79), 1.2), F(1916), 0.05)
'''
cues = r'''
def bark():
    d = 0.18; n = int(d * SR); t = np.arange(n) / SR; f0 = 520 * np.exp(-t * 4)
    tone = np.sin(2 * np.pi * np.cumsum(f0) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f0 * 2.1) / SR)
    s = lp_fast((tone * 0.7 + 0.5 * noise(d)).astype(np.float32), 2200)
    return (s * np.minimum(1, t / 0.006) * np.exp(-t * 18)).astype(np.float32)
def alarm(d=2.0):
    n = int(d * SR); t = np.arange(n) / SR; f = 700 + 250 * np.sign(np.sin(2 * np.pi * 2.2 * t))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6 * np.minimum(1, t / 0.08) * np.minimum(1, (d - t) / 0.4)).astype(np.float32)
def birds(d):
    out = np.zeros(int(d * SR), np.float32)
    for k in range(int(d * 3)):
        t0 = rng.random() * (d - 0.3); n = int(0.12 * SR); t = np.arange(n) / SR; f = 2600 + 900 * np.sin(2 * np.pi * 14 * t) + rng.random() * 600
        ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 25); i = int(t0 * SR); out[i:i + n] += ch[: len(out) - i] * 0.3
    return out
def wind(d): return lp_fast(noise(d), 400) * 0.5
def type_(d):
    out = np.zeros(int(d * SR), np.float32)
    for k in range(int(d * 9)): place_sig = int((k / 9 + rng.random() * 0.04) * SR); s = hp_fast(noise(0.02), 2000) * np.exp(-np.arange(int(0.02 * SR)) / SR * 200); out[place_sig:place_sig + len(s)] += s[: max(0, len(out) - place_sig)] * 0.5
    return out
def door_creak(): return creak(0.55, 180)

# hook: suburb, alarm (short, quiet), cash, dog
place(sfx, birds(7.5), 0, 0.25)
place(sfx, alarm(1.8), F(46), 0.18); place(sfx, thunk(160, 0.15), F(46), 0.4)
place(sfx, pop_(420), F(96), 0.5); place(sfx, ting(), F(98), 0.35)
place(sfx, bark(), F(141), 0.45); place(sfx, bark(), F(150), 0.35)
for k, a in enumerate((152, 161, 170)): place(sfx, pop_(800 + 90 * k), F(a), 0.25)
place(sfx, boing(0.3), F(206), 0.3)
# lagoon: wind, water, birds, billboard
place(sfx, whoosh(0.4), F(232), 0.55); place(sfx, waves(12.8) * 0.4, F(236), 0.35); place(sfx, wind(12.8), F(236), 0.25)
for k in range(281, 302, 3): place(sfx, tick(), F(k), 0.3)
place(sfx, thunk(120, 0.25), F(302), 0.5); place(sfx, ting(), F(349), 0.4)
for k in range(7): place(sfx, pop_(560 + 40 * k), F(395 + k * 5), 0.2)
place(sfx, birds(2.5), F(420), 0.5); place(sfx, gull(), F(427), 0.35); place(sfx, gull(), F(440), 0.3)
place(sfx, whoosh(0.3), F(456), 0.4)
for k in range(3): place(sfx, pop_(480 + 70 * k), F(481 + k * 4), 0.35)
place(sfx, splash(0.6), F(517), 0.55); place(sfx, swish(0.25), F(540), 0.35); place(sfx, pop_(520), F(541), 0.3)
place(sfx, hiss(0.5), F(563), 0.35); place(sfx, chomp(), F(575), 0.6); place(sfx, chomp(), F(596), 0.4)
# street: footsteps, menu, choices
place(sfx, whoosh(0.4), F(611), 0.55); place(sfx, birds(6.8), F(615), 0.2)
for k in range(617, 672, 9): place(sfx, thunk(240, 0.06), F(k), 0.18)
place(sfx, pop_(700), F(683), 0.5); place(sfx, ting(), F(685), 0.3)
place(sfx, tick(), F(722), 0.5); place(sfx, bark(), F(726), 0.35)
place(sfx, tick(), F(758), 0.5); place(sfx, buzzer(0.2) * 0.5, F(759), 0.3)
place(sfx, tick(), F(793), 0.5); place(sfx, swish(0.25), F(794), 0.35)
# album
place(sfx, whoosh(0.5), F(815), 0.6); place(sfx, waves(7.0) * 0.4, F(819), 0.25)
place(sfx, swish(0.3), F(850), 0.35); place(sfx, pop_(600), F(863), 0.45)
place(sfx, swish(0.3), F(880), 0.35); place(sfx, pop_(420), F(891), 0.45)
place(sfx, swish(0.3), F(928), 0.35); place(sfx, sting() * 0.4, F(940), 0.45); place(sfx, ting(), F(941), 0.4)
for k in range(6): place(sfx, pop_(500 + 60 * k), F(986 + k * 3), 0.25)
# GTA 5 TV-set town
place(sfx, whoosh(0.5), F(1025), 0.6); place(sfx, wind(10.3), F(1029), 0.3)
place(sfx, thunk(140, 0.2), F(1062), 0.45)
place(sfx, creak(0.8, 120), F(1100), 0.35); place(sfx, whoosh(0.6), F(1105), 0.3)
for a in (1157, 1185, 1209): place(sfx, ting(), F(a), 0.35); place(sfx, swish(0.25), F(a - 6), 0.3)
place(sfx, scrape(0.4), F(1250), 0.45); place(sfx, thunk(200, 0.1), F(1252), 0.5); place(sfx, thunk(200, 0.1), F(1258), 0.5)
place(sfx, whoosh(0.5), F(1288), 0.35); place(sfx, boing(0.35), F(1318), 0.3)
# PC + mod
place(sfx, whoosh(0.4), F(1335), 0.55); place(sfx, type_(2.4), F(1345), 0.4)
for k in range(1360, 1425, 8): place(sfx, tick(), F(k), 0.18)
place(sfx, ting(), F(1429), 0.5); place(sfx, pop_(760), F(1430), 0.35)
# interiors: doors open one after another, comparison board
place(sfx, whoosh(0.4), F(1461), 0.55); place(sfx, birds(6.4), F(1465), 0.2)
for k in range(5): place(sfx, door_creak(), F(1469 + 24 * k), 0.3); place(sfx, ting(), F(1478 + 24 * k), 0.18)
place(sfx, thunk(120, 0.25), F(1628), 0.45)
for k in range(1634, 1664, 2): place(sfx, pop_(500 + (k * 37) % 400), F(k), 0.12)
# twist: crime, then the knock and the dog
place(sfx, alarm(1.5), F(1711), 0.16); place(sfx, thunk(55, 0.45), F(1768), 0.7)
place(sfx, whoosh(0.3), F(1795), 0.4)
place(sfx, thunk(260, 0.08), F(1854), 0.7); place(sfx, thunk(260, 0.08), F(1862), 0.7)
place(sfx, door_creak(), F(1866), 0.4); place(sfx, bark(), F(1884), 0.45); place(sfx, bark(), F(1894), 0.35)
for k, a in enumerate((1916, 1925, 1934)): place(sfx, pop_(800 + 90 * k), F(a), 0.25)
'''
tail = L(237, len(ex))
open(R + 'audio.py', 'w', encoding='utf-8').write('\n'.join(head) + '\n' + music + '\n' + '\n'.join(synths) + '\n' + cues + '\n' + '\n'.join(tail))
print('ok')


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
#@@SYNTH@@
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

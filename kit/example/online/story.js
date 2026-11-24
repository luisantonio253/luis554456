// "O GTA 6 tem online… e ele se chama GTA 5" — timed to voice.mp3 (64.84 s, 1945 frames @ 30 fps). See work/PLAN.md.
import { M, camFromKeys, idle, blinkAt, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 1945;
export const PZ = [0, 0, 0], LR = [300, 0, 0], ST = [-300, 0, 0], WD = [0, 0, -300], TB = [0, 0, 300];
export const SHOTS = [
  { id: 'hook', a: 0, b: 99, light: 'nightR' },
  { id: 'amigos', a: 100, b: 178, light: 'nightR' },
  { id: 'historia', a: 179, b: 263, light: 'nightR' },
  { id: 'semonline', a: 264, b: 352, light: 'nightR' },
  { id: 'treze', a: 353, b: 455, light: 'nightR' },
  { id: 'calma', a: 456, b: 522, light: 'nightR' },
  { id: 'y2013', a: 523, b: 631, light: 'storeN' },
  { id: 'semanas', a: 632, b: 708, light: 'storeN' },
  { id: 'quebra', a: 709, b: 820, light: 'storeN' },
  { id: 'rdr', a: 821, b: 926, light: 'west' },
  { id: 'cidade', a: 927, b: 1059, light: 'day' },
  { id: 'detalhe', a: 1060, b: 1130, light: 'day' },
  { id: 'festa', a: 1131, b: 1200, light: 'neon' },
  { id: 'ligado', a: 1201, b: 1341, light: 'neon' },
  { id: 'milhoes', a: 1342, b: 1428, light: 'neon' },
  { id: 'dona', a: 1429, b: 1542, light: 'neon' },
  { id: 'vazio', a: 1543, b: 1716, light: 'neon' },
  { id: 'lotado', a: 1717, b: 1805, light: 'neon' },
  { id: 'payoff', a: 1806, b: 1944, light: 'neon' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const FR = { P: PZ, L: LR, S: ST, W: WD, B: TB };
const P3 = (p) => add3(PZ, p), L3 = (p) => add3(LR, p), S3 = (p) => add3(ST, p), W3 = (p) => add3(WD, p), B3 = (p) => add3(TB, p);

// ---------- layout (set-local) ----------
export const TVX = 0.8, CALX = -2.7, CLX = 2.0;
export const RK = [4.6, 0, -8.2], RDP = [3.2, 0, 0.5], BRD = [1.4, 0, 3.5], FP = [6.5, 0, -8];
export const B6 = [-9, 0, -8], B5 = [9, 0, -6], PODP = [2.0, 0, 1.6];
const JT = [-0.35, 0, 0.6], JW = [-0.8, 0, 1.6], JC = [-0.9, 0, 4.4], JA = [-9, 0, -1.5];
const QUEUE = [[-0.5, 0, -7.3], [-1.5, 0, -7.45], [-2.4, 0, -7.3], [-3.3, 0, -7.5], [-4.2, 0, -7.35], [-5.1, 0, -7.5], [-6.0, 0, -7.35], [-7.2, 0, -6.9],
  [-7.6, 0, -5.8], [-7.5, 0, -4.8], [-7.7, 0, -3.8], [-7.55, 0, -2.8]];
const CROWD = [[5.6, 0, -1.2], [7.0, 0, -1.6], [8.4, 0, -1.2], [9.8, 0, -1.6], [11.2, 0, -1.2], [12.5, 0, -1.5], [6.2, 0, 0.3], [7.7, 0, 0.0], [9.1, 0, 0.4], [10.6, 0, 0.0], [12.0, 0, 0.3],
  [6.9, 0, 1.8], [8.4, 0, 1.6], [9.9, 0, 1.9], [11.4, 0, 1.6], [13.2, 0, 0.9]];
const CROWD2 = [[5.0, 0, 3.2], [6.5, 0, 3.4], [8.0, 0, 3.1], [9.4, 0, 3.4], [10.9, 0, 3.1], [12.4, 0, 3.3], [13.8, 0, 2.4], [4.6, 0, 1.4]];

// ---------- lights ----------
const hx = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixC = (a, b, t) => '#' + hx(a).map((v, i) => Math.round(lerp(v, hx(b)[i], t)).toString(16).padStart(2, '0')).join('');
export const LIGHTS = {
  day: { az: 115, el: 55, sky: '#c8e6ff', ground: '#9a8a62', hemi: 1.25, sun: '#fff3de', sunI: 2.6, fog: '#cfe8f7', fogNear: 120, fogFar: 1300,
    skyTop: '#2a8ae6', skyHor: '#bfe6ff', sat: 1.15, waterDeep: '#1b8ab8', waterShal: '#6fe0ee', glint: '#f2ffff', vig: 0.2, shadowExt: 30, lamp: 0 },
  nightR: { az: 60, el: 45, sky: '#6f7fc0', ground: '#3a3050', hemi: 1.0, sun: '#9fb0ff', sunI: 0.9, fog: '#2a3060', fogNear: 120, fogFar: 1300,
    skyTop: '#141a3e', skyHor: '#3a4a8a', sat: 1.08, gain: '#f0ecff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.42, shadowExt: 7, lamp: 6, lampAt: L3([0.6, 2.8, 1.8]), lampCol: '#ffd8b0', cloud: '#4a5280' },
  storeN: { az: 60, el: 40, sky: '#7f8fd0', ground: '#3a3050', hemi: 1.1, sun: '#9fb0ff', sunI: 0.9, fog: '#2a3060', fogNear: 120, fogFar: 1300,
    skyTop: '#141a3e', skyHor: '#3a4a8a', sat: 1.08, gain: '#fff0dc', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.4, shadowExt: 18, lamp: 9, lampAt: S3([-1.0, 4.2, -9.5]), lampCol: '#ffe2a8', cloud: '#4a5280' },
  west: { az: 250, el: 24, sky: '#ffe2b8', ground: '#a07a4a', hemi: 1.3, sun: '#ffd4a0', sunI: 2.2, fog: '#f2d0a0', fogNear: 150, fogFar: 1300,
    skyTop: '#d87a4a', skyHor: '#ffc890', sat: 1.12, gain: '#fff0dc', waterDeep: '#2a6a9a', waterShal: '#e8a87a', glint: '#fff0c0', vig: 0.3, shadowExt: 18, cloud: '#ffd8b8', lamp: 0 },
  neon: { az: 60, el: 40, sky: '#7a6fc8', ground: '#3a3050', hemi: 1.15, sun: '#a8a0ff', sunI: 1.0, fog: '#2a2050', fogNear: 140, fogFar: 1300,
    skyTop: '#140e30', skyHor: '#4a2a7a', sat: 1.12, gain: '#fff0f8', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.38, shadowExt: 30, lamp: 11, lampAt: B3([9, 6, 4]), lampCol: '#ffc8e8', cloud: '#4a3a70' },
};
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.light === 'neon') L.lampCol = Math.floor(f / 9) % 2 ? '#ffc8e8' : '#c8e8ff';
  return L;
};

// ---------- cameras ----------
const TVL = [TVX, 1.42, -2.77];
const CAMS = {
  hook: { fr: 'L', K: [
    { f: 0, pos: [0.25, 1.6, 5.6], look: [0.35, 1.3, -1.5], fov: 50 },
    { f: 99, pos: [0.2, 1.55, 4.8], look: [0.3, 1.3, -1.5], fov: 50 } ], kicks: [{ f: 79, a: 0.01 }] },
  amigos: { fr: 'L', K: [
    { f: 100, pos: [0.3, 1.6, 4.6], look: [0.4, 1.35, -1.5], fov: 50 },
    { f: 136, pos: [0.85, 1.52, 2.0], look: TVL, fov: 44 },
    { f: 178, pos: [0.85, 1.5, 1.75], look: TVL, fov: 44 } ], kicks: [{ f: 139, a: 0.012 }] },
  historia: { fr: 'L', K: [
    { f: 179, pos: [0.85, 1.5, 1.75], look: TVL, fov: 44 },
    { f: 263, pos: [0.85, 1.48, 1.45], look: TVL, fov: 44 } ], kicks: [{ f: 238, a: 0.006 }] },
  semonline: { fr: 'L', K: [
    { f: 264, pos: [0.85, 1.48, 1.45], look: TVL, fov: 44 },
    { f: 299, pos: [0.84, 1.47, 1.3], look: TVL, fov: 44 },
    { f: 300, pos: [-2.62, 3.0, -0.55], look: [-2.7, 3.0, -3], fov: 42 },
    { f: 352, pos: [-2.62, 3.0, -0.8], look: [-2.7, 3.0, -3], fov: 42, roll: 2 } ], kicks: [{ f: 271, a: 0.016 }, { f: 305, a: 0.01 }] },
  treze: { fr: 'L', K: [
    { f: 353, pos: [0.4, 2.0, 5.4], look: [0.5, 2.0, -1.5], fov: 50 },
    { f: 418, pos: [0.35, 1.95, 5.0], look: [0.5, 1.95, -1.5], fov: 50 },
    { f: 448, pos: [0.3, 3.0, 8.2], look: [0.2, 1.4, -1.5], fov: 52, ease: 'easeOut' },
    { f: 455, pos: [0.3, 3.05, 8.3], look: [0.2, 1.4, -1.5], fov: 52 } ] },
  calma: { fr: 'L', K: [
    { f: 456, pos: [-0.2, 1.55, 3.9], look: [-0.3, 1.3, 0.5], fov: 46 },
    { f: 522, pos: [-0.2, 1.53, 3.6], look: [-0.3, 1.3, 0.5], fov: 46 } ], kicks: [{ f: 496, a: 0.006 }] },
  y2013: { fr: 'S', K: [
    { f: 523, pos: [0.2, 2.0, -21], look: [0.6, 2.8, -6.5], fov: 50 },
    { f: 575, pos: [0.25, 2.1, -19.5], look: [0.8, 2.9, -6.5], fov: 50 },
    { f: 605, pos: [2.35, 3.45, -11.6], look: [2.6, 3.55, -6.5], fov: 44 },
    { f: 631, pos: [2.36, 3.47, -11.3], look: [2.6, 3.56, -6.5], fov: 44 } ], kicks: [{ f: 606, a: 0.01 }] },
  semanas: { fr: 'S', K: [
    { f: 632, pos: [2.36, 3.47, -11.3], look: [2.6, 3.56, -6.5], fov: 44 },
    { f: 660, pos: [0.1, 3.0, -23.5], look: [0.1, 3.3, -6.5], fov: 54 },
    { f: 708, pos: [0.1, 2.98, -22.9], look: [0.1, 3.3, -6.5], fov: 54 } ], kicks: [{ f: 690, a: 0.008 }] },
  quebra: { fr: 'S', K: [
    { f: 709, pos: [1.0, 3.0, -21.5], look: [0.4, 2.0, -6.5], fov: 52 },
    { f: 738, pos: [1.1, 2.9, -20.8], look: [0.6, 2.0, -6.5], fov: 52 },
    { f: 750, pos: [3.4, 1.8, -13.2], look: [4.5, 1.1, -8.0], fov: 48 },
    { f: 782, pos: [3.3, 1.75, -12.6], look: [4.5, 0.9, -8.6], fov: 48 },
    { f: 795, pos: [-2.4, 3.0, -16.5], look: [-3.6, 1.3, -7.0], fov: 50 },
    { f: 820, pos: [-2.45, 3.05, -16.0], look: [-3.6, 1.3, -7.0], fov: 50, roll: 2 } ], kicks: [{ f: 723, a: 0.014 }, { f: 766, a: 0.022 }] },
  rdr: { fr: 'W', K: [
    { f: 821, pos: [0.4, 2.2, 13.5], look: [0.8, 2.8, -4], fov: 50 },
    { f: 860, pos: [0.45, 2.25, 12.8], look: [0.9, 2.8, -4], fov: 50 },
    { f: 895, pos: [3.1, 2.6, 7.6], look: [3.2, 2.6, 0.4], fov: 46 },
    { f: 926, pos: [3.1, 2.62, 7.2], look: [3.2, 2.62, 0.4], fov: 46 } ], kicks: [{ f: 905, a: 0.014 }] },
  cidade: { fr: 'P', K: [
    { f: 927, pos: [0, 3.4, 16.5], look: [0, 4.5, -8], fov: 52 },
    { f: 1059, pos: [0.3, 4.0, 15.0], look: [0.6, 5.0, -10], fov: 52 } ], kicks: [{ f: 1038, a: 0.01 }] },
  detalhe: { fr: 'P', K: [
    { f: 1060, pos: [0.3, 4.0, 15.0], look: [0.6, 5.0, -10], fov: 52 },
    { f: 1092, pos: [0.7, 2.2, 13.8], look: [0.7, 2.1, 3.8], fov: 46 },
    { f: 1130, pos: [0.7, 2.2, 13.2], look: [0.7, 2.1, 3.8], fov: 46 } ], kicks: [{ f: 1103, a: 0.01 }] },
  festa: { fr: 'B', K: [
    { f: 1131, pos: [9.0, 3.0, 16.5], look: [9.0, 5.2, -3], fov: 50 },
    { f: 1200, pos: [9.0, 3.2, 15.0], look: [9.0, 5.6, -3], fov: 50 } ] },
  ligado: { fr: 'B', K: [
    { f: 1201, pos: [9.0, 3.2, 15.0], look: [9.0, 5.6, -3], fov: 50 },
    { f: 1240, pos: [9.0, 6.6, 13.0], look: [9.0, 8.2, -3], fov: 50 },
    { f: 1341, pos: [9.0, 6.4, 12.0], look: [9.0, 7.8, -3], fov: 50 } ], kicks: [{ f: 1277, a: 0.01 }, { f: 1312, a: 0.008 }] },
  milhoes: { fr: 'B', K: [
    { f: 1342, pos: [9.0, 6.4, 12.0], look: [9.0, 7.8, -3], fov: 50 },
    { f: 1362, pos: [9.0, 4.4, 19.0], look: [9.0, 8.8, -3], fov: 52 },
    { f: 1428, pos: [9.0, 4.3, 18.0], look: [9.0, 8.6, -3], fov: 52 } ], kicks: [{ f: 1347, a: 0.012 }] },
  dona: { fr: 'B', K: [
    { f: 1429, pos: [2.9, 1.9, 9.0], look: [2.6, 2.2, 1.6], fov: 48 },
    { f: 1542, pos: [2.85, 1.95, 8.2], look: [2.6, 2.25, 1.6], fov: 48 } ], kicks: [{ f: 1499, a: 0.01 }] },
  vazio: { fr: 'B', K: [
    { f: 1543, pos: [-9.0, 1.9, 8.5], look: [-9.0, 2.6, -4], fov: 50 },
    { f: 1640, pos: [-9.0, 1.95, 7.6], look: [-9.0, 2.7, -4], fov: 50 },
    { f: 1684, pos: [-9.0, 19.0, 15.0], look: [-9.0, 24.5, -4], fov: 50, path: [[-9.0, 9, 13]] },
    { f: 1690, pos: [-9.0, 19.3, 15.2], look: [-9.0, 24.5, -4], fov: 50 },
    { f: 1712, pos: [-8.5, 10.0, 40.0], look: [-8.5, 12.5, -4], fov: 50, ease: 'easeOut' },
    { f: 1716, pos: [-8.4, 10.0, 40.2], look: [-8.4, 12.5, -4], fov: 50 } ], kicks: [{ f: 1619, a: 0.008 }] },
  lotado: { fr: 'B', K: [
    { f: 1717, pos: [-8.4, 10.0, 40.2], look: [-8.4, 12.5, -4], fov: 50 },
    { f: 1765, pos: [9.0, 5.2, 24.0], look: [9.0, 6.4, -3], fov: 50 },
    { f: 1805, pos: [9.0, 5.1, 22.6], look: [9.0, 6.3, -3], fov: 50 } ], kicks: [{ f: 1773, a: 0.014 }] },
  payoff: { fr: 'B', K: [
    { f: 1806, pos: [9.0, 5.1, 22.6], look: [9.0, 6.3, -3], fov: 50 },
    { f: 1836, pos: [0.0, 8.0, 50.0], look: [0.0, 10.0, -4], fov: 50 },
    { f: 1868, pos: [0.0, 7.9, 48.5], look: [0.0, 9.9, -4], fov: 50 },
    { f: 1906, pos: [9.0, 10.4, 15.0], look: [9.0, 10.8, -3], fov: 46, ease: 'smooth' },
    { f: 1920, pos: [9.0, 10.5, 13.6], look: [9.0, 10.9, -3], fov: 46, roll: 3 },
    { f: 1944, pos: [9.0, 10.5, 13.2], look: [9.0, 10.9, -3], fov: 46, roll: 3 } ], kicks: [{ f: 1920, a: 0.022 }] },
};
const FLASH = [523, 821, 927, 1131];
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  const o = FR[D.fr]; c.pos = add3(o, c.pos); c.look = add3(o, c.look);
  for (const a of FLASH) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, 0.9 * (1 - (f - a) / 6));
  c.shadowAt = { y2013: S3([0, 0, -7]), semanas: S3([0, 0, -7]), quebra: S3([0, 0, -7]), rdr: W3([1, 0, -1]), cidade: P3([0, 0, -6]), detalhe: P3([0, 0, 3]),
    vazio: B3([-9, 0, -2]), dona: B3(PODP), payoff: B3([0, 0, -2]), lotado: B3([9, 0, -1]) }[S.id] || (D.fr === 'L' ? L3([0, 0, -0.8]) : D.fr === 'B' ? B3([9, 0, -1]) : add3(o, [0, 0, 0]));
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, L3([JT[0], 1.2, JT[2]])), cinf: 5 };
    case 'calma': return { focus: dist(C.pos, L3([JT[0], 1.2, JT[2]])), cinf: 5 };
    case 'semonline': return f >= 300 ? { focus: dist(C.pos, L3([CALX, 3, -2.96])), cinf: 4 } : { focus: 10, cinf: 0 };
    case 'dona': return { focus: dist(C.pos, B3([PODP[0], 1.3, PODP[2]])), cinf: 4 };
    case 'detalhe': return f >= 1092 ? { focus: dist(C.pos, P3([JC[0], 1.2, JC[2]])), cinf: 4 } : { focus: 10, cinf: 0 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
const pop = (f, a, d = 7, s = 2.4) => (f < a ? 0 : q(M.back(ramp(f, a, a + d), s), 2));
const DATES = ['17/09/2013', '20/09/2013', '23/09/2013', '26/09/2013', '29/09/2013', '01/10/2013'];
export const worldAt = (f) => {
  const W = {};
  if (f < 100) W.tv = { m: 'title', nv: f >= 79 ? pop(f, 79, 7, 2.6) : 0 };
  else if (f < 179) W.tv = { m: 'friends', lock: f >= 139 ? pop(f, 139, 6, 2.8) : 0 };
  else W.tv = { m: 'menu', ok: f >= 238 ? pop(f, 238, 6, 2.6) : 0, st: f >= 271 ? pop(f, 271, 6, 3) : 0 };
  W.calQ = f >= 305 ? pop(f, 305, 7, 2.8) : 0;
  W.clk = f < 360 ? 22.5 : f < 412 ? q(22.5 + 40 * M.easeIn(ramp(f, 360, 412)), 2) : 22.5 + 40;
  W.date = f < 664 ? DATES[0] : DATES[Math.min(5, Math.floor((f - 664) / 5))];
  if (f < 632) W.day = { m: 'solo', s: f >= 606 ? pop(f, 606, 6, 2.6) : (f < 590 ? 0 : 0) };
  else if (f < 715) W.day = { m: 'wait', d: f < 664 ? 14 : Math.max(0, 14 - Math.floor((f - 664) * 14 / 28)) };
  else if (f < 723) W.day = { m: 'open' };
  else W.day = { m: 'err', gl: Math.floor(f / 3) % 7 };
  if (W.day.m === 'wait' && W.day.d === 0) W.day = { m: 'open' };
  W.doors = q(smooth(ramp(f, 712, 726)), 2);
  W.rack = q(M.easeIn(ramp(f, 751, 766)), 3);
  W.rd = { d: f < 877 ? 0 : Math.min(30, 1 + Math.floor((f - 877) * 30 / 24)), mes: f >= 905 ? pop(f, 905, 7, 2.8) : 0 };
  W.bld = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = 988 + i * 3.2; return f < a ? 0 : q(M.back(ramp(f, a, a + 9), 1.6), 3); });
  W.festa = f >= 1036 ? pop(f, 1036, 9, 2.2) : 0;
  W.brd = { a: f >= 985 ? pop(f, 985, 6, 2.6) : 0, b: f >= 1021 ? pop(f, 1021, 6, 2.6) : 0, c: f >= 1103 ? pop(f, 1103, 6, 3) : 0 };
  W.neon = { on: f < 1201 || f >= 1277 || Math.floor(f / 4) % 2 === 0, five: f >= 1920 ? pop(f, 1920, 6, 3) : 0 };
  W.info = { since: f >= 1246 ? pop(f, 1246, 6, 2.6) : (f < 1201 ? 1 : 0), on: f >= 1277 ? pop(f, 1277, 6, 2.6) : (f < 1201 ? 1 : 0), up: f >= 1312 ? pop(f, 1312, 6, 2.6) : (f < 1201 ? 1 : 0) };
  if (f >= 1201 && f < 1246) W.info = { since: 0, on: 0, up: 0 };
  const cv = f < 1342 ? 2400000 : f < 1347 ? Math.round(2400000 + 1600000 * ramp(f, 1342, 1347)) : 0;
  W.cnt = f >= 1347 ? { big: pop(f, 1347, 7, 2.8), v: 0 } : { big: 0, v: Math.round(cv / 1000) * 1000 + (Math.floor(f / 2) % 10) * 37 };
  W.pod = f >= 1429 && f <= 1542;
  W.bub = f >= 1499 ? pop(f, 1499, 7, 2.6) : 0;
  return W;
};

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o) + (extra.s || '') + (extra.alpha ?? ''), draw: (p) => p && globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}, speed = 1) => { const i = idle(f * speed, seed); return { seed, blink: blinkAt(f, seed), tilt: q(i.tilt, 1), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };
const nod = (f, at, k = 0.025) => (f >= at && f < at + 8 ? -k * Math.sin(Math.PI * (f - at) / 8) : 0);
const hop = (f, a, k = 0.06) => (f >= a ? -k * Math.abs(Math.sin((f - a) * 0.45)) * Math.exp(-(f - a) / 30) : 0);
const dance = (f, i, k = 0.05) => -k * Math.abs(Math.sin(f * 0.32 + i * 1.3));
let outfitsSet = false;
const QO = ['gamer1', 'civA', 'civB', 'gamer2', 'civC', 'tourist', 'gamer1', 'workB', 'local', 'civA', 'gamer2', 'civB'];
const CO = ['fan1', 'civA', 'gamer2', 'fan2', 'tourist', 'civC', 'fan1', 'local', 'gamer1', 'civB', 'fan2', 'workB', 'gamer2', 'civA', 'tourist', 'fan1'];
const CO2 = ['civB', 'gamer1', 'fan2', 'local', 'civC', 'gamer2', 'fan1', 'tourist'];

export const actorsAt = (f, T) => {
  globalThis.__T = T;
  if (!outfitsSet) { Object.assign(T.OUTFITS, {
    junior: { tunic: '#3f7fd0', skin: '#e8b48a', hair: '#2b211c', cap: '#e2453c', vest: '#1d2a4a' },
    juniorB: { tunic: '#3f7fd0', skin: '#e8b48a', hair: '#2b211c', cap: '#e2453c', vest: '#1d2a4a', beard: '#3a2a20' },
    gamer1: { tunic: '#2a2a3a', skin: '#f5c9a0', hair: '#2b211c', cap: '#e2453c' },
    gamer2: { tunic: '#5ad0a0', skin: '#c99067', hair: '#1e1714', stripes: '#2fa77a' },
    fan1: { tunic: '#ff5fb0', skin: '#f0c49a', hair: '#6a4126', shades: true },
    fan2: { tunic: '#7a5ad0', skin: '#8a5a3a', hair: '#1e1714', flowers: '#ffd23f' },
    cowboy: { tunic: '#b8783a', skin: '#e8b48a', hair: '#4a3020', vest: '#5a3a20', moustache: '#4a3020' },
    exec: { tunic: '#2a2a3a', skin: '#f0c49a', hair: '#a8a8b0', vest: '#14141c', brows: '#a8a8b0' } }); outfitsSet = true; }
  const S = shotAt(f), out = [];
  const hero = f >= 390 ? 'juniorB' : 'junior';
  switch (S.id) {
    case 'hook': case 'amigos': case 'historia': case 'semonline': {
      const o = f < 79 ? { expr: 'grin', L: 'reach', R: 'reach', look: 0.3 } : f < 139 ? { expr: 'laugh', L: 'reach', R: 'reach', look: 0.2, bob: q(hop(f, 79, 0.05), 3) } : { expr: 'pained', L: 'reach', R: 'reach', look: 0.2 };
      out.push(R(hero, life(f, 7, o), L3(JT)));
      break;
    }
    case 'treze': {
      const o = f < 390 ? { expr: 'neutral', L: 'reach', R: 'reach', look: 0.3 } : f < 423 ? { expr: 'dazed', L: 'reach', R: 'reach', look: 0.2, headTilt: 5 } : { expr: 'nervous', L: 'shrug', R: 'shrug', look: 0, bob: q(nod(f, 425, 0.04), 3) };
      out.push(R(hero, life(f, 7, o, f < 412 && f > 360 ? 3 : 1), L3(JT)));
      break;
    }
    case 'calma': {
      out.push(R(hero, life(f, 7, { expr: f < 484 ? 'smile' : 'grin', R: 'up', L: 'hip', look: 0.1, bob: q(nod(f, 496, 0.04), 3) }), L3(JT)));
      break;
    }
    case 'y2013': case 'semanas': case 'quebra': {
      QUEUE.forEach((p, i) => {
        const cheer = f >= 715 + (i % 4) * 2 && f < 723;
        let o;
        if (f >= 723) o = { expr: i % 2 ? 'shock' : 'nervous', L: 'cheek', R: 'cheek', bob: q(hop(f, 723 + (i % 3), 0.05), 3) };
        else if (cheer) o = { expr: i % 2 ? 'laugh' : 'grin', L: 'up', R: i % 3 ? 'up' : 'wave', wv: q(f * 0.5, 1), bob: q(hop(f, 715 + (i % 4) * 2, 0.07), 3) };
        else o = { expr: ['whistle', 'neutral', 'squint', 'smile'][i % 4], L: i % 2 ? 'cross' : 'hang', R: i % 2 ? 'cross' : 'hip', look: i < 7 ? 0.5 : 0 };
        const a0 = 789 + ((i * 5) % 12) * 2.2, al = f < a0 ? 1 : q(1 - ramp(f, a0, a0 + 6), 2);
        if (al > 0) out.push(R(QO[i], life(f, 60 + i, o), S3(p), { alpha: al }));
      });
      break;
    }
    case 'rdr': {
      const o = f < 905 ? { expr: 'whistle', L: 'cross', R: 'cross', look: 0.4 } : { expr: 'stubborn', L: 'hip', R: 'point', look: 0.6, bob: q(nod(f, 905, 0.04), 3) };
      out.push(R('cowboy', life(f, 21, o), W3(JW)));
      break;
    }
    case 'cidade': case 'detalhe': {
      const o = f < 985 ? { expr: 'smile', R: 'point', look: 0.5 } : f < 1036 ? { expr: 'grin', R: 'point', L: 'hip', look: 0.4, bob: q(nod(f, 985) + nod(f, 1021), 3) }
        : f < 1092 ? { expr: 'laugh', L: 'up', R: 'up', bob: q(hop(f, 1038, 0.06), 3) } : { expr: 'squint', R: 'brow', look: 0.3 };
      out.push(R(hero, life(f, 7, o), P3(JC)));
      break;
    }
    case 'festa': case 'ligado': case 'milhoes': case 'dona': case 'vazio': case 'lotado': case 'payoff': {
      const jump = f >= 1773 && f < 1800;
      CROWD.forEach((p, i) => { const o = { expr: ['laugh', 'grin', 'whistle', 'smile'][i % 4], L: i % 2 ? 'up' : 'wave', R: i % 3 ? 'up' : 'wave', wv: q(f * 0.5 + i, 1), look: -0.3 + (i % 3) * 0.3,
        bob: q(jump ? hop(f, 1773 + (i % 3), 0.12) : dance(f, i), 3) }; out.push(R(CO[i], life(f, 120 + i, o), B3(p))); });
      CROWD2.forEach((p, k) => { const a = 1352 + k * 6; if (f < a) return; const o = { expr: k % 2 ? 'laugh' : 'grin', L: 'up', R: k % 2 ? 'wave' : 'up', wv: q(f * 0.5 + k, 1),
        bob: q(jump ? hop(f, 1773 + (k % 3), 0.12) : f < a + 20 ? hop(f, a, 0.08) : dance(f, k + 5), 3) }; out.push(R(CO2[k], life(f, 150 + k, o), B3(p), { alpha: q(ramp(f, a, a + 4), 2) })); });
      if (S.id === 'dona') { const o = f < 1499 ? { expr: 'smile', R: 'point', L: 'hang', look: 0.2, bob: q(nod(f, 1447) + nod(f, 1468), 3) } : { expr: 'grin', R: 'thumb', L: 'hip', look: 0.2, bob: q(nod(f, 1499, 0.04) + nod(f, 1518), 3) };
        out.push(R('exec', life(f, 31, o), B3(PODP))); }
      if (S.id === 'vazio' || S.id === 'lotado') { const o = f < 1690 ? { expr: 'dazed', L: 'hang', R: 'hang', look: 0.3 } : { expr: 'nervous', L: 'shrug', R: 'shrug', look: 0.2 };
        out.push(R('juniorB', life(f, 7, o), B3(JA))); }
      if (S.id === 'payoff') { const t = smooth(ramp(f, 1810, 1866)), x = lerp(JA[0], 4.2, t), z = lerp(JA[2], 2.6, t);
        const o = f < 1866 ? { expr: 'grin', L: 'hang', R: 'point', look: 0.6, bob: q(-0.05 * Math.abs(Math.sin(f * 0.5)), 3) } : { expr: 'laugh', L: 'up', R: 'up', bob: q(f >= 1920 ? hop(f, 1920, 0.1) : dance(f, 3), 3) };
        out.push(R('juniorB', life(f, 7, o), B3([x, 0, z]))); }
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1] - 1.125 * s, z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const INK = '#241726';
const drawPad = (p) => { const g = p.g; g.save(); g.translate(300, 500);
  g.fillStyle = '#2a2a3a'; g.beginPath(); g.moveTo(-190, -60); g.quadraticCurveTo(0, -110, 190, -60); g.quadraticCurveTo(260, 80, 170, 120); g.quadraticCurveTo(110, 120, 70, 40); g.lineTo(-70, 40); g.quadraticCurveTo(-110, 120, -170, 120); g.quadraticCurveTo(-260, 80, -190, -60); g.closePath(); g.fill(); g.lineWidth = 14; g.strokeStyle = INK; g.stroke();
  for (const [x, y, c] of [[110, -40, '#e2453c'], [150, -5, '#3f7fd0'], [70, -5, '#5ad0a0'], [110, 30, '#ffd23f']]) { g.beginPath(); g.arc(x, y, 18, 0, 7); g.fillStyle = c; g.fill(); }
  g.fillStyle = '#8a8a9a'; g.fillRect(-150, -20, 70, 20); g.fillRect(-125, -45, 20, 70); g.restore(); };
const drawSmoke = (t, seed) => (p) => { const g = p.g; g.save(); g.globalAlpha = Math.max(0, 1 - t); for (let i = 0; i < 6; i++) { const a = i * 1.1 + seed, r = 70 + 90 * t;
  p.ell(300 + Math.cos(a) * r * 0.8, 600 - 260 * t + Math.sin(a) * r * 0.5, 110 + 70 * t, 90 + 60 * t, i % 2 ? '#8a8a96' : '#b8b8c2', 10); } g.restore(); };
const drawWeed = (rot) => (p) => { const g = p.g; g.save(); g.translate(300, 760); g.rotate(rot); g.strokeStyle = '#8a6a3a'; g.lineWidth = 12; g.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); g.quadraticCurveTo(Math.cos(a + 0.8) * 170, Math.sin(a + 0.8) * 170, Math.cos(a + 1.6) * 130, Math.sin(a + 1.6) * 130); g.stroke(); }
  g.beginPath(); g.arc(0, 0, 150, 0, 7); g.lineWidth = 10; g.strokeStyle = '#a8844a'; g.stroke(); g.restore(); };
const drawConf = (t, seed) => (p) => { const g = p.g; const r = (k) => ((Math.sin(seed * 91 + k * 12.9898) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 40; i++) { const a = r(i) * 6.283, d = 60 + 380 * t * (0.5 + r(i + 50)), x = 300 + Math.cos(a) * d, y = 500 + Math.sin(a) * d * 0.8 + 300 * t * t;
    g.save(); g.translate(x, y); g.rotate(a + t * 8); g.fillStyle = ['#ff5fb0', '#ffd23f', '#5ad0ff', '#7dff6a', '#ffffff'][i % 5]; g.globalAlpha = Math.max(0, 1 - t * 0.8); g.fillRect(-14, -7, 28, 14); g.restore(); } };

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (['hook', 'amigos', 'historia', 'semonline', 'treze'].includes(S.id)) out.push(FX('pad', drawPad, L3([JT[0] + 0.02, 1.08, JT[2] + 0.3]), 0.26, { order: 6 }));
  if (S.id === 'hook' && f >= 79 && f < 99) { const t = q((f - 79) / 20, 2); out.push(FX('tb' + t, (p) => T.fxBurst(p, t, '#ffe066', 12), L3([TVX, 1.85, -2.6]), 0.8, { order: 1 })); }
  if (S.id === 'treze' && f >= 423) for (let k = 0; k < 2; k++) { const t = ((f - 423 + k * 15) % 30) / 30; out.push(FX('tq' + k + q(t, 2), (p) => T.fxNote(p, k, '#c8d4ff'), L3([1.6 + k * 0.8, 1.0 + t * 0.8, -0.5]), 0.25, { alpha: q(1 - t, 2) })); }
  if (S.id === 'quebra' && f >= 723 && f < 745) { const t = q((f - 723) / 22, 2); out.push(FX('eb' + t, (p) => T.fxBurst(p, t, '#ff5a4a', 12), S3([2.6, 3.6, -6.9]), 1.0, { order: 1 })); }
  if (S.id === 'quebra' && f >= 755 && f < 800) {
    for (let k = 0; k < 3; k++) { const t = q(((f - 755 + k * 9) % 27) / 27, 2); out.push(FX('sm' + k + t, drawSmoke(t, k), S3([RK[0] + (k - 1) * 0.5, 0.2, RK[2] - 2.0 + k * 0.3]), 0.9 + 0.3 * t, { order: 4 })); }
    if (f >= 766 && f < 784) { const t = q((f - 766) / 18, 2); out.push(FX('rs' + t, (p) => T.fxSpark(p, t), S3([RK[0] - 0.3, 0.5, RK[2] - 1.6]), 0.7)); out.push(FX('rb', (p) => T.fxBang(p), S3([RK[0] + 0.9, 1.6, RK[2] - 1.2]), q(0.35 * M.back(ramp(f, 766, 771), 2.5), 2))); }
  }
  if (S.id === 'rdr') { const t = ramp(f, 830, 926), x = lerp(-9, 9, t); out.push(FX('tw' + q(t, 2), drawWeed(q(-t * 14, 2)), W3([x, 0.55 + 0.25 * Math.abs(Math.sin(t * 18)), 4.0]), 0.5, { order: 3 }));
    if (f >= 905 && f < 925) { const tt = q((f - 905) / 20, 2); out.push(FX('rdb' + tt, (p) => T.fxBurst(p, tt, '#ffe0a0', 12), W3([RDP[0], 3.0, RDP[2] + 0.1]), 1.0, { order: 1 })); } }
  if ((S.id === 'cidade' || S.id === 'detalhe') && f >= 1038) for (let k = 0; k < 4; k++) { const t = ((f - 1038 + k * 8) % 32) / 32; out.push(FX('fn' + k + q(t, 2), (p) => T.fxNote(p, k % 2, ['#ff5fb0', '#ffd23f'][k % 2]), P3([FP[0] - 2 + k * 1.3, 5.0 + t * 2.0, FP[2] + 2.6]), 0.45, { alpha: q(1 - t, 2) })); }
  if ((S.id === 'cidade') && f >= 990 && f < 1020) { const t = q((f - 990) / 30, 2); out.push(FX('cd' + t, (p) => T.fxDust(p, t), P3([-2, 0.6, -15]), 3.0, { order: 3 })); }
  if (S.id === 'detalhe' && f >= 1103) { const s = q(0.45 * M.back(ramp(f, 1103, 1110), 2.4), 2); out.push(FX('dq' + s, (p) => T.fxQuestion(p), P3([JC[0] + 0.55, 2.9, JC[2] + 0.1]), s)); }
  if (['festa', 'ligado', 'milhoes', 'dona', 'lotado'].includes(S.id) || (S.id === 'payoff' && f < 1870)) for (let k = 0; k < 4; k++) { const t = ((f + k * 9) % 36) / 36; out.push(FX('bn' + k + q(t, 2), (p) => T.fxNote(p, k % 2, ['#ff9ac8', '#ffe066', '#8ae0ff', '#ffffff'][k]), B3([5.8 + k * 2.2, 2.8 + t * 2.4, 2.2]), 0.4, { alpha: q(1 - t, 2) })); }
  if (S.id === 'ligado' && f >= 1312 && f < 1332) { const t = q((f - 1312) / 20, 2); out.push(FX('us' + t, (p) => T.fxSpark(p, t), B3([B5[0] + 2.6, 6.4, B5[2] + 3.4]), 0.7)); }
  if (S.id === 'milhoes' && f >= 1347 && f < 1368) { const t = q((f - 1347) / 21, 2); out.push(FX('mb' + t, (p) => T.fxBurst(p, t, '#ffe28a', 14), B3([B5[0], 15.0, B5[2] + 0.6]), 2.4, { order: 1 })); }
  if (S.id === 'dona' && f >= 1499 && f < 1518) { const t = q((f - 1499) / 19, 2); out.push(FX('ds' + t, (p) => T.fxSpark(p, t), B3([PODP[0] + 2.3, 4.0, PODP[2] + 0.4]), 0.5)); }
  if (S.id === 'vazio' && f >= 1619 && f < 1640) { const t = q((f - 1619) / 21, 2); out.push(FX('vs' + t, (p) => T.fxSpark(p, t), B3([B6[0] + 2.4, 4.0, B6[2] + 4.4]), 0.6)); }
  if (S.id === 'vazio' && f >= 1690) { const t = ramp(f, 1690, 1716), x = lerp(-14, -4, t); out.push(FX('vw' + q(t, 2), drawWeed(q(-t * 10, 2)), B3([x, 0.5 + 0.2 * Math.abs(Math.sin(t * 14)), 1.5]), 0.6, { order: 3 })); }
  if (S.id === 'lotado' && f >= 1773 && f < 1800) { const t = q((f - 1773) / 27, 2); out.push(FX('cf' + t, drawConf(t, 3), B3([9, 1.0, 1.0]), 3.2, { order: 3 })); }
  if (S.id === 'payoff' && f >= 1920) { const t = q(Math.min(1, (f - 1920) / 22), 2); if (f < 1942) out.push(FX('pb' + t, (p) => T.fxBurst(p, t, '#ffe066', 16), B3([B5[0], 11.0, B5[2] + 3.3]), 3.0, { order: 1 }));
    out.push(FX('pbg', (p) => T.fxBang(p), B3([B5[0] + 3.9, 12.1, B5[2] + 3.4]), q(0.45 * M.back(ramp(f, 1920, 1925), 2.5), 2))); }
  return out;
};

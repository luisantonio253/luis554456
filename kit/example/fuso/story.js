// "Quem joga GTA 6 primeiro?" — timed to voice.mp3 (49.68 s, 1490 frames @ 30 fps). See work/PLAN.md.
import { M, camFromKeys, idle, blinkAt, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 1490;
export const NZ = [0, 0, 0], BU = [1500, 0, 0], WA = [3000, 0, 0], RO = [4500, 0, 0], MI = [6000, 0, 0];
export const SHOTS = [
  { id: 'hook', a: 0, b: 110, light: 'nz' },
  { id: 'island', a: 111, b: 184, light: 'nz' },
  { id: 'wall1', a: 185, b: 290, light: 'wall' },
  { id: 'nz2', a: 291, b: 460, light: 'nz' },
  { id: 'play', a: 461, b: 555, light: 'nz' },
  { id: 'bus', a: 556, b: 699, light: 'bus' },
  { id: 'phone', a: 700, b: 868, light: 'bus' },
  { id: 'wave', a: 869, b: 1065, light: 'wall' },
  { id: 'brasil', a: 1066, b: 1167, light: 'wall' },
  { id: 'spoil', a: 1168, b: 1250, light: 'night' },
  { id: 'twist', a: 1251, b: 1318, light: 'wall' },
  { id: 'flor', a: 1319, b: 1370, light: 'miami' },
  { id: 'play2', a: 1371, b: 1418, light: 'night' },
  { id: 'miami', a: 1419, b: 1489, light: 'miami' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const FR = { N: NZ, B: BU, A: WA, R: RO, I: MI };
const N3 = (p) => add3(NZ, p), B3 = (p) => add3(BU, p), A3 = (p) => add3(WA, p), R3 = (p) => add3(RO, p), I3 = (p) => add3(MI, p);

// ---------- layout (set-local) ----------
export const SH = [0.2, 0, 0.3], TVN = [1.5, 0, -0.6], CLK = [-2.2, 0, -2.5], USP = [-2.0, 0, 0.0], WS = [2.6, 0, -3.2];
export const FOUR = [[-1.05, 1.2, 0.5], [-1.85, 1.35, -0.4], [-2.65, 1.2, 0.6], [-3.45, 1.35, -0.5]];
export const SHEEP = (() => {
  const s = [[-0.9, -1.4, 0.7], [2.6, -1.9, -0.4], [3.05, 0.2, -1.0]];
  for (let i = 0; s.length < 30 && i < 200; i++) {
    const a = i * 2.39996, r = 5.5 + ((i * 7.3) % 13), x = r * Math.cos(a), z = r * Math.sin(a) - 3;
    if (Math.abs(x) < 4.8 && z > -4.2 && z < 4.5) continue;
    if (Math.hypot(x, z) > 19) continue;
    s.push([q(x, 2), q(z, 2), q(a * 1.7, 2)]);
  }
  return s;
})();
// bus
export const BRU = [0.32, 0, 0.3], BSHEEP = [-0.9, 0.45, 0.75];
// clock wall: [name, local hour when NZ hits midnight]
export const PANELS = [['NOVA ZELÂNDIA', 0], ['AUSTRÁLIA', 22], ['JAPÃO', 20], ['ÍNDIA', 16.5], ['EUROPA', 12], ['REINO UNIDO', 11], ['BRASIL', 8], ['EUA', 6], ['MÉXICO', 5]];
export const PX = (i) => -9.6 + i * 2.4;
// room + miami
export const TVP = [-1.5, 0, -1.5], CAL = [1.3, 2.05, -2.93], BSOFA = [0.6, 0, -1.75], BPLAY = [-0.35, 0, -0.55];
export const MG = [-0.3, 0.3, -2.8], TVM = [1.6, 0.3, -4.4], CNT = [1.3, 2.9, -6.03], FLS = [-3.0, 0.3, -3.2];

// hours after NZ midnight shown by the wall (pure in f)
const UK = [[0, -0.05], [185, -0.05], [262, -0.05], [274, 0], [869, 0], [897, 2], [925, 4], [949, 12], [1013, 13], [1150, 16], [1490, 16]];
export const uAt = (f) => { for (let i = 0; i < UK.length - 1; i++) { const [a, ua] = UK[i], [b, ub] = UK[i + 1]; if (f <= b) return lerp(ua, ub, b === a ? 1 : clamp((f - a) / (b - a))); } return 16; };
const UREL = [0, 2, 4, 7.5, 12, 13, 16, 18, 19];
export const midX = (u) => { if (u <= 0) return PX(0); for (let i = 0; i < 8; i++) if (u <= UREL[i + 1]) return lerp(PX(i), PX(i + 1), (u - UREL[i]) / (UREL[i + 1] - UREL[i])); return PX(8); };

// ---------- lights ----------
const hx = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixC = (a, b, t) => '#' + hx(a).map((v, i) => Math.round(lerp(v, hx(b)[i], t)).toString(16).padStart(2, '0')).join('');
const base = { fogNear: 140, fogFar: 1300, waterDeep: '#1f5a8a', waterShal: '#3f9ab8', glint: '#e8f4ff', shadowExt: 14 };
export const LIGHTS = {
  nz: { ...base, az: 40, el: 42, sky: '#9aa8e0', ground: '#2e3a40', hemi: 1.3, sun: '#c8d4ff', sunI: 1.55, fog: '#26306a',
    skyTop: '#070b26', skyHor: '#2a3678', sunDisc: '#f6f0c8', sunSize: 0.0016, sat: 1.12, gain: '#eef2ff', vig: 0.32, cloud: '#6a74a8', waterDeep: '#132a5a', waterShal: '#2a4a8a', glint: '#9ab0ff', lamp: 0 },
  bus: { ...base, az: 100, el: 18, sky: '#ffe8c8', ground: '#8a6a4a', hemi: 1.5, sun: '#ffcf8a', sunI: 1.5, fog: '#f2c9a0',
    skyTop: '#e8925a', skyHor: '#ffd8a0', sunDisc: '#fff0b0', sunSize: 0.004, sat: 1.1, gain: '#fff2e0', vig: 0.26, cloud: '#ffe2c8', lamp: 3.5, lampAt: [1500, 2.2, 1.2], lampCol: '#ffe7b0' },
  wall: { ...base, az: 70, el: 55, sky: '#dfe6ff', ground: '#6a6a7a', hemi: 1.3, sun: '#fff4e4', sunI: 1.5, fog: '#3a4680',
    skyTop: '#141a46', skyHor: '#4a5aa0', sat: 1.12, gain: '#ffffff', vig: 0.3, cloud: '#7a80b8', lamp: 5, lampAt: [3000, 4.5, 6], lampCol: '#fff0d8' },
  night: { ...base, az: 60, el: 40, sky: '#6f7fc0', ground: '#3a3050', hemi: 1.05, sun: '#9fb0ff', sunI: 0.9, fog: '#2a3060',
    skyTop: '#141a3e', skyHor: '#3a4a8a', sat: 1.05, gain: '#e4ecff', vig: 0.4, cloud: '#5a6090', shadowExt: 7, lamp: 6, lampAt: [4499.0, 1.5, 0.2], lampCol: '#bcd0ff' },
  miami: { ...base, az: 230, el: 35, sky: '#d0a0ff', ground: '#5a3a6a', hemi: 1.35, sun: '#ffb0e0', sunI: 1.3, fog: '#5a2a7a',
    skyTop: '#22104a', skyHor: '#ff6aa8', sunDisc: '#ffe0f0', sunSize: 0.002, sat: 1.15, gain: '#fff0ff', vig: 0.34, cloud: '#c070b0', lamp: 4.5, lampAt: [6001.2, 1.6, -2.6], lampCol: '#9ad8ff' },
};
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.id === 'island') L.shadowExt = 40;
  if (S.id === 'hook' || S.id === 'nz2' || S.id === 'play') { L.lamp = 3.5; L.lampAt = N3([1.1, 1.3, 0.4]); L.lampCol = '#bfe0ff'; }
  if (S.id === 'play' && f >= 514) { L.lamp = 6; L.lampCol = Math.floor((f - 514) / 5) % 2 ? '#ff3a3a' : '#3a6aff'; }
  if (S.id === 'wave' || S.id === 'brasil' || S.id === 'twist') L.lampAt = A3([camAt(f).pos[0] - WA[0], 4.5, 6]);
  return L;
};

// ---------- cameras ----------
const CAMS = {
  hook: { fr: 'N', K: [
    { f: 0, pos: [-2.0, 3.65, 2.3], look: [-2.2, 3.95, -2.5], fov: 40 },
    { f: 44, pos: [-2.05, 3.65, 1.95], look: [-2.2, 3.95, -2.5], fov: 40 },
    { f: 80, pos: [-0.9, 1.9, 6.8], look: [-0.9, 1.6, -0.3], fov: 52, path: [[-1.6, 3.0, 4.4]] },
    { f: 110, pos: [-0.9, 1.88, 6.5], look: [-0.9, 1.58, -0.3], fov: 52 } ], kicks: [{ f: 27, a: 0.012 }, { f: 84, a: 0.02 }] },
  island: { fr: 'N', K: [
    { f: 111, pos: [-0.9, 1.88, 6.5], look: [-0.9, 1.58, -0.3], fov: 52 },
    { f: 168, pos: [-16, 26, 46], look: [0, 0, -3], fov: 46, path: [[-3, 6, 14]], ease: 'smooth' },
    { f: 184, pos: [-16.4, 26.6, 47], look: [0, 0, -3], fov: 46 } ] },
  wall1: { fr: 'A', K: [
    { f: 185, pos: [-5.4, 3.0, 17.5], look: [-5.4, 2.8, -0.3], fov: 50 },
    { f: 290, pos: [-6.2, 2.95, 15.2], look: [-6.2, 2.75, -0.3], fov: 50 } ], kicks: [{ f: 274, a: 0.012 }] },
  nz2: { fr: 'N', K: [
    { f: 291, pos: [-1.3, 3.3, 3.3], look: [-2.2, 3.7, -2.5], fov: 44 },
    { f: 352, pos: [-1.45, 3.3, 3.0], look: [-2.2, 3.7, -2.5], fov: 44 },
    { f: 374, pos: [2.3, 1.75, 2.6], look: [2.6, 1.55, -3.2], fov: 44 },
    { f: 389, pos: [2.32, 1.74, 2.45], look: [2.6, 1.55, -3.2], fov: 44 },
    { f: 405, pos: [-1.5, 1.85, 9.4], look: [-1.5, 0.95, 0.3], fov: 50, ease: 'easeOut' },
    { f: 460, pos: [-1.45, 1.8, 8.8], look: [-1.45, 0.95, 0.3], fov: 50 } ], kicks: [{ f: 363, a: 0.01 }, { f: 414, a: 0.008 }] },
  play: { fr: 'N', K: [
    { f: 461, pos: [0.85, 1.6, 5.2], look: [0.85, 1.15, -0.2], fov: 52 },
    { f: 512, pos: [0.85, 1.58, 4.6], look: [0.85, 1.15, -0.2], fov: 52 },
    { f: 528, pos: [0.75, 1.5, 3.9], look: [0.8, 1.2, -0.2], fov: 50, roll: -3 },
    { f: 555, pos: [0.75, 1.5, 3.75], look: [0.8, 1.2, -0.2], fov: 50, roll: -3 } ], kicks: [{ f: 516, a: 0.015 }] },
  bus: { fr: 'B', K: [
    { f: 556, pos: [0.12, 1.55, 4.1], look: [0.0, 1.62, -3], fov: 48 },
    { f: 699, pos: [0.14, 1.55, 3.45], look: [0.02, 1.6, -3], fov: 48 } ], kicks: [{ f: 600, a: 0.006 }, { f: 662, a: 0.008 }, { f: 586, a: 0.006 }] },
  phone: { fr: 'B', K: [
    { f: 700, pos: [0.3, 1.52, 2.25], look: [0.3, 1.4, 0.3], fov: 42 },
    { f: 800, pos: [0.3, 1.5, 2.05], look: [0.3, 1.38, 0.3], fov: 42 },
    { f: 803, pos: [0.0, 1.5, 3.7], look: [-0.25, 1.2, 0.3], fov: 48 },
    { f: 868, pos: [0.0, 1.48, 3.4], look: [-0.25, 1.2, 0.3], fov: 48 } ], kicks: [{ f: 832, a: 0.012 }] },
  wave: { fr: 'A', K: [
    { f: 869, pos: [PX(0) + 1.0, 2.9, 11], look: [PX(0) + 1.0, 2.9, -0.3], fov: 46 },
    { f: 897, pos: [PX(1) + 0.6, 2.9, 11], look: [PX(1) + 0.6, 2.9, -0.3], fov: 46 },
    { f: 925, pos: [PX(2) + 0.6, 2.9, 11], look: [PX(2) + 0.6, 2.9, -0.3], fov: 46 },
    { f: 949, pos: [PX(4) + 0.4, 2.9, 11], look: [PX(4) + 0.4, 2.9, -0.3], fov: 46 },
    { f: 1013, pos: [PX(5) + 0.2, 2.9, 11], look: [PX(5) + 0.2, 2.9, -0.3], fov: 46 },
    { f: 1065, pos: [PX(6) - 0.4, 2.95, 10], look: [PX(6) - 0.4, 2.95, -0.3], fov: 46 } ] },
  brasil: { fr: 'A', K: [
    { f: 1066, pos: [PX(6) - 0.4, 2.95, 10], look: [PX(6) - 0.4, 2.95, -0.3], fov: 46 },
    { f: 1100, pos: [PX(6), 3.1, 7.0], look: [PX(6), 3.25, -0.3], fov: 46 },
    { f: 1167, pos: [PX(6), 3.1, 6.4], look: [PX(6), 3.25, -0.3], fov: 46 } ], kicks: [{ f: 1150, a: 0.02 }] },
  spoil: { fr: 'R', K: [
    { f: 1168, pos: [0.62, 1.6, 2.8], look: [0.6, 1.45, -1.75], fov: 48 },
    { f: 1250, pos: [0.62, 1.58, 2.4], look: [0.6, 1.45, -1.75], fov: 48 } ], kicks: [{ f: 1199, a: 0.012 }] },
  twist: { fr: 'A', K: [
    { f: 1251, pos: [6.0, 2.9, 8.8], look: [6.0, 2.75, -0.3], fov: 46 },
    { f: 1285, pos: [6.3, 2.85, 7.6], look: [6.4, 2.7, -0.3], fov: 46 },
    { f: 1300, pos: [7.2, 2.75, 5.0], look: [7.2, 2.6, -0.3], fov: 44, roll: 4, ease: 'easeOut' },
    { f: 1318, pos: [7.2, 2.75, 4.8], look: [7.2, 2.6, -0.3], fov: 44, roll: 4 } ], kicks: [{ f: 1297, a: 0.03 }] },
  flor: { fr: 'I', K: [
    { f: 1319, pos: [-0.7, 2.3, 9.4], look: [-1.1, 1.9, -4], fov: 50 },
    { f: 1370, pos: [-0.75, 2.25, 8.4], look: [-1.15, 1.85, -4], fov: 50 } ], kicks: [{ f: 1348, a: 0.012 }] },
  play2: { fr: 'R', K: [
    { f: 1371, pos: [0.0, 1.62, 3.1], look: [-0.95, 1.15, -1.1], fov: 52 },
    { f: 1418, pos: [-0.08, 1.6, 2.8], look: [-0.98, 1.15, -1.1], fov: 52 } ], kicks: [{ f: 1392, a: 0.015 }] },
  miami: { fr: 'I', K: [
    { f: 1419, pos: [0.6, 1.95, 2.8], look: [0.6, 1.85, -4], fov: 50 },
    { f: 1466, pos: [0.55, 1.92, 2.2], look: [0.55, 1.85, -4], fov: 50 },
    { f: 1478, pos: [0.35, 1.88, 1.3], look: [0.4, 1.75, -3.5], fov: 50, roll: 3, ease: 'easeOut' },
    { f: 1489, pos: [0.34, 1.88, 1.15], look: [0.4, 1.75, -3.5], fov: 50, roll: 3 } ], kicks: [{ f: 1472, a: 0.035 }] },
};
const FLASH = [185, 291, 556, 869, 1168, 1251, 1319, 1371];
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0005 });
  const o = FR[D.fr]; c.pos = add3(o, c.pos); c.look = add3(o, c.look);
  for (const a of FLASH) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, 0.85 * (1 - (f - a) / 6));
  if (S.id === 'bus' || S.id === 'phone') { const b = 0.006 * Math.sin(f * 0.9) + 0.004 * Math.sin(f * 2.3); c.pos[1] += b; c.look[1] += b; }
  c.shadowAt = S.id === 'island' ? N3([0, 0, -3]) : c.look;
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return f < 46 ? { focus: dist(C.pos, N3([CLK[0], 4.0, CLK[2]])), cinf: 6 } : { focus: dist(C.pos, N3([SH[0], 1.5, SH[2]])), cinf: lerp(6, 3, ramp(f, 46, 80)) };
    case 'nz2': return f < 352 ? { focus: dist(C.pos, N3([CLK[0], 3.9, CLK[2]])), cinf: 6 } : f < 392 ? { focus: dist(C.pos, N3([WS[0], 1.5, WS[2]])), cinf: 6 } : { focus: dist(C.pos, N3([-1.5, 1.0, 0.8])), cinf: 3 };
    case 'play': return { focus: dist(C.pos, N3([SH[0], 1.5, SH[2]])), cinf: 5 };
    case 'bus': return { focus: dist(C.pos, B3([BRU[0], 1.7, BRU[2]])), cinf: 5 };
    case 'phone': return { focus: dist(C.pos, B3([f < 803 ? BRU[0] : -0.3, 1.5, BRU[2]])), cinf: f < 803 ? 7 : 4 };
    case 'brasil': return { focus: dist(C.pos, A3([PX(6), 2.8, -0.3])), cinf: 3 };
    case 'twist': return { focus: dist(C.pos, A3([7.2, 2.6, -0.3])), cinf: 4 };
    case 'spoil': return { focus: dist(C.pos, R3([BSOFA[0], 1.6, BSOFA[2]])), cinf: 6 };
    case 'play2': return { focus: dist(C.pos, R3([BPLAY[0], 1.5, BPLAY[2]])), cinf: 5 };
    case 'miami': return { focus: dist(C.pos, I3([MG[0], 1.9, MG[2]])), cinf: f < 1470 ? 4 : 6 };
    case 'flor': return { focus: 11, cinf: 2 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
const pop = (f, a, d = 7, s = 2.4) => (f < a ? 0 : q(M.back(ramp(f, a, a + d), s), 2));
const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (h) => { h = ((h % 24) + 24) % 24; let H = Math.floor(h + 1e-6), m = Math.round((h - H) * 60); if (m === 60) { H = (H + 1) % 24; m = 0; } return pad2(H) + ':' + pad2(m); };
export const worldAt = (f) => {
  const W = {};
  // NZ clock: fast count 23:59:57 -> 00:00:00 at f27, then real seconds
  const sec = f < 27 ? -3 + Math.floor(f / 9) : Math.floor((f - 27) / 30);
  W.clock = sec < 0 ? '23:59:' + pad2(60 + sec) : '00:00:' + pad2(sec % 60);
  W.clockDay = sec < 0 ? 'QUA 18 NOV' : 'QUI 19 NOV';
  W.clockPop = f >= 27 ? q(1 + 0.22 * Math.exp(-(f - 27) / 5) * Math.cos((f - 27) * 0.8), 2) : 1;
  W.usX = f >= 84 ? pop(f, 84, 6, 3) : 0;
  W.wsPop = f >= 291 && f < 363 ? 1 : f >= 363 ? q(1 + 0.15 * Math.exp(-(f - 363) / 5) * Math.cos((f - 363) * 0.8), 2) : 1;
  W.sheep = SHEEP.map((s, i) => (i < 3 ? (f >= 158 ? pop(f, 158 + (i * 2) % 9, 7, 2) : 0) : pop(f, 158 + (i * 7) % 24, 7, 2)));
  W.four = FOUR.map((_, k) => pop(f, 414 + k * 4, 6, 2.6));
  W.graze = f; W.pad = f < 556;
  W.tvN = f < 461 ? 'menu' : 'chase'; W.chase = f >= 461 ? Math.floor((f - 461) / 5) % 2 : 0; W.chaseX = f >= 461 ? q(((f - 461) * 0.012) % 1, 2) : 0;
  // bus
  W.busT = f; W.busClk = f >= 586 ? pop(f, 586, 6, 2.6) : 0.0001;
  W.bSheep = f >= 832 ? pop(f, 832, 7, 2.4) : 0;
  // wall
  W.u = q(uAt(f), 3);
  const S = shotAt(f);
  W.headX = (S.id === 'wave' || S.id === 'brasil') ? q(camAt(f).pos[0] - WA[0], 2) : S.id === 'twist' ? 6.0 : -5.6;
  W.midX = q(midX(W.u), 2);
  W.panels = PANELS.map(([n, b], i) => { const h = b + W.u, rel = i === 0 ? W.u >= 0 : h >= 24; const relU = i === 0 ? 0 : 24 - b;
    const rem = i === 0 ? -h : 24 - h; return { n, t: hhmm(h), rel, left: rel ? '' : rem < 1 ? Math.ceil(rem * 60 - 1e-6) + ' min' : Math.ceil(rem - 1e-6) + ' h', pop: rel ? q(1 + 0.14 * Math.exp(-(f - uFrame(relU)) / 5) * Math.cos((f - uFrame(relU)) * 0.8), 2) : 1 }; });
  // room
  W.tvR = f < 1371 ? 'lock' : 'g6'; W.cal = { m: 'C', ring: 1 };
  // miami
  W.count = 7200 + Math.ceil((1419 - f) / 30);
  W.flSign = f >= 1348 ? pop(f, 1348, 7, 2.5) : (f >= 1319 ? 0.0001 : 0.0001);
  W.lockBang = f >= 1472 ? q(1 + 0.35 * Math.exp(-(f - 1472) / 4) * Math.cos((f - 1472) * 0.9), 2) : 1;
  return W;
};
// frame at which the wall's u reaches a value (for release pops)
const uFrame = (u) => { if (u <= 0) return 274; for (let i = 3; i < UK.length - 1; i++) { const [a, ua] = UK[i], [b, ub] = UK[i + 1]; if (u <= ub && ub > ua) return a + (b - a) * (u - ua) / (ub - ua); } return 99999; };

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o) + (extra.s || ''), draw: (p) => p && globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}, speed = 1) => { const i = idle(f * speed, seed); return { seed, blink: blinkAt(f, seed), tilt: q(i.tilt, 1), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };
const nod = (f, at, k = 0.025) => (f >= at && f < at + 8 ? -k * Math.sin(Math.PI * (f - at) / 8) : 0);
const hop = (f, a, k = 0.06) => (f >= a ? -k * Math.abs(Math.sin((f - a) * 0.45)) * Math.exp(-(f - a) / 30) : 0);
let outfitsSet = false;

export const actorsAt = (f, T) => {
  globalThis.__T = T;
  if (!outfitsSet) { Object.assign(T.OUTFITS, {
    pastor: { tunic: '#3d4a6a', skin: '#f3cfae', cap: '#2f3a2f', beard: '#a0703a', vest: '#6a8a3a' },
    bruno: { tunic: '#f2c230', stripes: '#2f9a4a', skin: '#c99067', hair: '#1e1714' },
    brunoP: { tunic: '#f2c230', stripes: '#2f9a4a', skin: '#c99067', cap: '#2f3a2f', vest: '#6a8a3a' },
    pas1: { tunic: '#8a5a9a', skin: '#f5c9a0', hair: '#5a3b2a' },
    pas2: { tunic: '#5a7aa0', skin: '#8a5a3a', hair: '#1e1714', stout: true },
    pas3: { tunic: '#c25a4a', skin: '#ecd0b6', hair: '#c9a060', dress: '#a04a5a' },
    miami: { tunic: '#2fa7a0', flowers: '#fff1f4', skin: '#ffd9bd', hair: '#c08a4a', shades: true, stout: true } }); outfitsSet = true; }
  const S = shotAt(f), out = [];
  switch (S.id) {
    case 'hook': case 'island': case 'nz2': {
      let o;
      if (f < 27) o = { expr: 'nervous', L: 'reach', R: 'reach', look: -0.4, headTilt: -4 };
      else if (f < 70) o = { expr: 'laugh', L: 'reach', R: 'reach', look: -0.3, bob: q(hop(f, 27), 3) };
      else if (f < 111) o = { expr: 'grin', L: 'reach', R: 'reach', look: -0.6, bob: nod(f, 86, 0.03) };
      else if (f < 405) o = { expr: 'smile', L: 'reach', R: 'reach', look: 0.2 };
      else if (f < 436) o = { expr: 'grin', L: 'reach', R: 'reach', look: -0.7, bob: q(nod(f, 414, 0.02) + nod(f, 422, 0.02), 3) };
      else o = { expr: 'laugh', L: 'reach', R: 'reach', look: -0.3, bob: q(hop(f, 436, 0.05), 3) };
      out.push(R('pastor', life(f, 5, o), N3(SH)));
      break;
    }
    case 'play': {
      const o = f < 514 ? { expr: 'grin', L: 'reach', R: 'reach', look: 0.6, bob: q(0.01 * Math.sin(f * 0.9), 3) }
        : f < 528 ? { expr: 'shock', L: 'reach', R: 'reach', look: 0.6, bob: q(-0.03 * M.back(ramp(f, 514, 520), 3), 3) }
        : { expr: 'laugh', L: 'reach', R: 'reach', look: 0.6, bob: q(0.02 * Math.abs(Math.sin(f * 0.7)), 3) };
      out.push(R('pastor', life(f, 5, o), N3(SH)));
      break;
    }
    case 'bus': {
      let o;
      if (f < 586) o = { expr: 'snore', R: 'up', look: 0, headTilt: 8 };
      else if (f < 637) o = { expr: 'dazed', R: 'up', look: -0.5, bob: nod(f, 600, 0.02) };
      else if (f < 675) o = { expr: 'neutral', R: 'up', look: 0.2, bob: nod(f, 662, 0.03) };
      else o = { expr: 'pained', R: 'up', L: 'temple', swirl: q(f * 0.2, 1), look: 0 };
      out.push(R('bruno', life(f, 9, o), B3(BRU)));
      out.push(R('pas1', life(f, 21, { expr: 'snore' }), B3([-0.92, -0.42, -1.3]), { blob: false }));
      out.push(R('pas2', life(f, 23, { expr: 'dazed', look: 0.3 }), B3([0.92, -0.42, -2.3]), { blob: false }));
      out.push(R('pas3', life(f, 25, { expr: 'neutral', look: -0.4 }), B3([-0.92, -0.42, -3.3]), { blob: false }));
      break;
    }
    case 'phone': {
      let o, who = 'bruno';
      if (f < 720) o = { expr: 'squint', L: 'reach', R: 'reach', look: 0, headTilt: 5 };
      else if (f < 765) o = { expr: 'grin', L: 'reach', R: 'reach', look: 0.1, headTilt: 5, bob: q(nod(f, 730, 0.02) + nod(f, 750, 0.02), 3) };
      else if (f < 803) o = { expr: 'laugh', L: 'reach', R: 'reach', look: 0.3, bob: q(hop(f, 777, 0.05), 3) };
      else { who = 'brunoP'; o = f < 832 ? { expr: 'smile', R: 'reach', L: 'hang', look: -0.6 } : { expr: 'grin', R: 'reach', L: 'hip', look: -0.7, bob: q(0.012 * Math.sin(f * 1.3), 3) }; }
      out.push(R(who, life(f, 9, o), B3(BRU)));
      if (f >= 803) out.push(R('pas2', life(f, 23, { expr: f < 836 ? 'neutral' : 'shock', look: -0.5 }), B3([0.92, -0.42, -2.3]), { blob: false }));
      break;
    }
    case 'spoil': {
      const o = f < 1185 ? { expr: 'smile', L: 'reach', R: 'reach', look: 0 }
        : f < 1215 ? { expr: 'nervous', L: 'reach', R: 'reach', look: -0.4, bob: nod(f, 1199, 0.03) }
        : { expr: 'shock', L: 'cheek', R: 'cheek', look: 0, bob: q(-0.03 * M.back(ramp(f, 1215, 1221), 3), 3) };
      out.push(R('bruno', life(f, 9, o), R3(BSOFA)));
      break;
    }
    case 'play2': {
      const o = { expr: 'laugh', L: 'up', R: 'up', look: -0.6, bob: q(hop(f, 1373, 0.08) + hop(f, 1395, 0.05), 3) };
      out.push(R('bruno', life(f, 9, o), R3(BPLAY)));
      break;
    }
    case 'flor': case 'miami': {
      let o;
      if (f < 1348) o = { expr: 'smile', L: 'hip', R: 'hip', look: 0.4 };
      else if (f < 1430) o = { expr: 'neutral', L: 'cross', R: 'cross', look: 0.6 };
      else if (f < 1472) o = { expr: 'stubborn', L: 'cross', R: 'cross', look: 0.7, bob: q(nod(f, 1440, 0.02) + nod(f, 1456, 0.02), 3) };
      else o = { expr: f < 1482 ? 'shock' : 'pained', L: 'temple', R: 'temple', swirl: q(f * 0.25, 1), look: 0.2, bob: q(-0.03 * M.back(ramp(f, 1472, 1478), 3), 3) };
      out.push(R('miami', life(f, 13, o), I3(MG)));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1] - 1.125 * s, z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const INK = '#241726';
const FNT = (px) => `bold ${px}px Arial, "DejaVu Sans", "Liberation Sans", sans-serif`;
const rrP = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const tx = (g, s, x, y, px, col) => { g.font = FNT(px); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, x, y); };
const drawPhone = (stage) => (p) => { const g = p.g; g.save(); g.translate(300, 500);
  g.fillStyle = '#1c1a24'; rrP(g, -120, -220, 240, 440, 34); g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#f4f6ff'; rrP(g, -104, -196, 208, 392, 20); g.fill();
  tx(g, 'CRIAR CONTA', 0, -150, 30, '#1d2a4a');
  g.fillStyle = '#dfe4f2'; rrP(g, -86, -110, 172, 50, 10); g.fill(); tx(g, 'PAÍS:', -44, -85, 24, '#5a6a8a');
  if (stage > 0) tx(g, 'N. ZELÂNDIA', 28, -40, 26, '#1d2a4a');
  if (stage > 1) { g.fillStyle = '#2fae55'; g.beginPath(); g.arc(0, 60, 54, 0, 7); g.fill(); g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.beginPath(); g.moveTo(-24, 60); g.lineTo(-6, 80); g.lineTo(28, 38); g.stroke(); }
  if (stage > 2) tx(g, 'JOGA 16 h ANTES!', 0, 150, 24, '#d0352f');
  g.restore(); };
const drawBubble = (s, col) => (p) => { const g = p.g; g.save(); g.translate(300, 500);
  g.fillStyle = col; rrP(g, -250, -90, 500, 170, 40); g.fill(); g.beginPath(); g.moveTo(-60, 78); g.lineTo(-110, 150); g.lineTo(10, 78); g.fill();
  g.lineWidth = 12; g.strokeStyle = INK; rrP(g, -250, -90, 500, 170, 40); g.stroke();
  tx(g, s, 0, -5, s.length > 11 ? 58 : 72, '#ffffff'); g.restore(); };
const drawMoon = (p) => { const g = p.g; g.save(); g.translate(300, 500);
  g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(0, 0, 200, 0, 7); g.fill(); g.lineWidth = 16; g.strokeStyle = INK; g.stroke();
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(95, -55, 175, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
  g.lineWidth = 16; g.strokeStyle = INK; g.beginPath(); g.arc(95, -55, 175, 2.25, 4.65); g.stroke(); g.restore(); };
const drawShears = (open) => (p) => { const g = p.g; g.save(); g.translate(300, 520); g.lineCap = 'round';
  for (const s of [-1, 1]) { g.save(); g.rotate(s * open); g.strokeStyle = INK; g.lineWidth = 34; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -260); g.stroke(); g.strokeStyle = '#d7e2ea'; g.lineWidth = 18; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -250); g.stroke();
    g.fillStyle = '#c0352f'; g.beginPath(); g.ellipse(s * 30, 90, 46, 70, 0, 0, 7); g.fill(); g.lineWidth = 12; g.strokeStyle = INK; g.stroke(); g.restore(); }
  g.restore(); };
const drawConfetti = (t) => (p) => { const g = p.g; const cols = ['#ffd23f', '#ff6a8a', '#5ad0ff', '#7dff6a', '#ffffff'];
  for (let i = 0; i < 46; i++) { const a = i * 2.39996, r = 60 + 380 * t * (0.5 + ((i * 0.37) % 1) * 0.5), x = 300 + Math.cos(a) * r, y = 520 + Math.sin(a) * r * 0.8 + 260 * t * t;
    g.save(); g.translate(x, y); g.rotate(a + t * 6); g.fillStyle = cols[i % 5]; g.globalAlpha = 1 - t * 0.6; g.fillRect(-12, -7, 24, 14); g.restore(); } };

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' && f >= 27 && f < 50) { const t = q((f - 27) / 23, 2); out.push(FX('cb' + t, (p) => T.fxBurst(p, t, '#fff3b0', 12), N3([CLK[0], 4.05, CLK[2] + 0.3]), 1.5, { order: 1 })); }
  if ((S.id === 'island') && f >= 160 && f < 184) for (const k of [0, 1, 2]) { const t = q(((f - 160 - k * 6) % 24) / 24, 2); if (f - 160 >= k * 6) out.push(FX('nt' + k + t, (p) => T.fxNote(p, k % 2 ? 'q' : 'e', '#f4f1ea'), N3([[-6, 4, 8][k], 1.6 + 1.2 * t, [-8, -10, -6][k]]), 1.2, { alpha: q(1 - t, 2) })); }
  if (S.id === 'nz2') {
    for (let k = 0; k < 4; k++) { const a = 414 + k * 4; if (f >= a && f < a + 10) { const t = q((f - a) / 10, 2); out.push(FX('fp' + k + t, (p) => T.fxPuff(p, t), N3([FOUR[k][0], 0.6, FOUR[k][1] + 0.3]), 0.5, { alpha: 0.9 })); } }
  }
  if (S.id === 'play' && f >= 514 && f < 528) out.push(FX('bg', (p) => T.fxBang(p), N3([SH[0] + 0.5, 2.15, SH[2] + 0.2]), q(0.3 * M.back(ramp(f, 514, 519), 2.5), 2)));
  if (S.id === 'bus' && f >= 586 && f < 606) { const t = q((f - 586) / 20, 2); out.push(FX('bc' + t, (p) => T.fxSpark(p, t), B3([-0.75, 2.12, -2.1]), 0.5)); }
  if (S.id === 'phone') {
    if (f < 803) { const st = f < 720 ? 0 : f < 745 ? 1 : f < 777 ? 2 : 3; out.push(FX('ph' + st, drawPhone(st), B3([BRU[0] + 0.02, 1.08, BRU[2] + 0.3]), 0.28, { order: 6 })); }
    if (f >= 745 && f < 762) { const t = q((f - 745) / 17, 2); out.push(FX('ps' + t, (p) => T.fxSpark(p, t), B3([BRU[0] + 0.02, 1.12, BRU[2] + 0.36]), 0.24, { order: 7 })); }
    if (f >= 803 && f < 812) { const t = q((f - 803) / 9, 2); out.push(FX('cp' + t, (p) => T.fxPuff(p, t), B3([BRU[0], 1.7, BRU[2] + 0.2]), 0.6, { alpha: 0.9 })); }
    if (f >= 803) { const op = q(f >= 832 ? 0.18 * (1 + Math.sin(f * 1.6)) : 0.25, 2); out.push(FX('sh' + op, drawShears(op), B3([BRU[0] - 0.42, 1.3, BRU[2] + 0.15]), 0.28, { order: 6, roll: 0.6 })); }
    if (f >= 832 && f < 846) { const t = q((f - 832) / 14, 2); out.push(FX('sp' + t, (p) => T.fxPuff(p, t), B3([BSHEEP[0], 0.95, BSHEEP[2] + 0.2]), 0.55, { alpha: 0.9 })); }
    if (f >= 838) for (let k = 0; k < 4; k++) { const ph = ((f - 838) / 22 + k * 0.25) % 1, t = q(ph, 2); out.push(FX('wl' + k + t, (p) => T.fxCloud(p, k + 2), B3([BSHEEP[0] + 0.25 + 0.5 * t * (k % 2 ? 1 : -0.4), 1.0 + 0.9 * t, BSHEEP[2] + 0.2]), 0.22, { alpha: q(1 - t * 0.8, 2), tint: '#ffffff' })); }
  }
  if (S.id === 'wave' || S.id === 'brasil' || S.id === 'twist' || S.id === 'wall1') {
    const u = uAt(f); if (u >= 0) out.push(FX('moon', drawMoon, A3([midX(u), 6.15 + 0.06 * Math.sin(f * 0.15), 0.1]), 0.55, { order: 4 }));
  }
  if (S.id === 'brasil' && f >= 1150) { const t = q(clamp((f - 1150) / 17), 2); out.push(FX('cf' + t, drawConfetti(t), A3([PX(6), 3.3, 0.3]), 1.6, { order: 6 })); out.push(FX('bb' + t, (p) => T.fxBurst(p, t, '#fff3b0', 14), A3([PX(6), 3.1, 0.05]), 1.8, { order: 1, alpha: q(1 - t, 2) })); }
  if (S.id === 'spoil') {
    for (const [a, s, col, x, y] of [[1182, 'SPOILER!', '#d0352f', -0.45, 2.25], [1199, 'O FINAL É...', '#5a3ad0', 0.5, 2.45], [1212, 'NÃO ACREDITO', '#c2402a', -0.5, 1.6], [1226, 'KKKKKK', '#2f9a4a', 0.55, 1.8]])
      if (f >= a) out.push(FX('sb' + a + q(M.back(ramp(f, a, a + 6), 2.5), 2), drawBubble(s, col), R3([BSOFA[0] + x, y, BSOFA[2] + 0.35]), q(0.34 * M.back(ramp(f, a, a + 6), 2.5), 2), { order: 6 }));
    if (f < 1215) out.push(FX('ph1', drawPhone(3), R3([BSOFA[0] + 0.02, 1.08, BSOFA[2] + 0.3]), 0.28, { order: 6 }));
  }
  if (S.id === 'play2' && f >= 1371 && f < 1395) { const t = q((f - 1371) / 24, 2); out.push(FX('pb' + t, (p) => T.fxBurst(p, t, '#ffe28a', 14), R3([TVP[0] + 0.1, 1.45, TVP[2] + 0.2]), 0.8, { order: 1 })); out.push(FX('ps' + t, (p) => T.fxStars(p, t), R3([BPLAY[0], 2.15, BPLAY[2] + 0.1]), 0.45)); }
  if (S.id === 'miami' && f >= 1472) { out.push(FX('mb', (p) => T.fxBang(p), I3([TVM[0] - 0.4, 2.0, TVM[2] + 0.5]), q(0.32 * M.back(ramp(f, 1472, 1477), 2.5), 2))); }
  return out;
};

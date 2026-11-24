// "As cenas absurdas do trailer" — timed to voice.mp3 (57.12 s, 1714 frames @ 30 fps). See work/PLAN.md.
import { M, camFromKeys, idle, blinkAt, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 1714;
export const PO = [0, 0, 0], RO = [300, 0, 0], ST = [-300, 0, 0], SR = [0, 0, -220], MP = [150, 0, 150];
export const SHOTS = [
  { id: 'hook', a: 0, b: 186, light: 'day' },
  { id: 'sofa', a: 187, b: 389, light: 'room' },
  { id: 'pool', a: 390, b: 635, light: 'day' },
  { id: 'store', a: 636, b: 777, light: 'store' },
  { id: 'cctv', a: 778, b: 830, light: 'cctv' },
  { id: 'street', a: 831, b: 1013, light: 'neon' },
  { id: 'phone', a: 1014, b: 1079, light: 'night' },
  { id: 'pov', a: 1080, b: 1160, light: 'night' },
  { id: 'map', a: 1161, b: 1352, light: 'gold' },
  { id: 'proof', a: 1353, b: 1468, light: 'gold' },
  { id: 'exag', a: 1469, b: 1554, light: 'night' },
  { id: 'payoff', a: 1555, b: 1713, light: 'night' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const FR = { P: PO, R: RO, S: ST, N: SR, B: MP };
const P3 = (p) => add3(PO, p), R3 = (p) => add3(RO, p), S3 = (p) => add3(ST, p), N3 = (p) => add3(SR, p), B3 = (p) => add3(MP, p);

// ---------- layout (set-local) ----------
export const TVP = [-1.5, 0, -1.5], TVY = 1.35, TVYAW = 0.5, CAL = [1.3, 2.05, -2.93];
export const MARC = [0.2, 0, -0.8], PPH = [0.3, 0, 0.6];
export const HND = [-2.0, 0, 2.5], SIGNP = [2.4, 0, 4.0];
export const FAM = { mom: [-1.1, 0, -8.1], kid: [-0.3, 0, -7.9], dad: [1.0, 0, -8.1] };
export const CLERK = [2.6, 0, -4.0], CNT = [1.8, 0, -3.9];
export const CAR = [0, 0, -3], DANCER = [0, 1.35, -3.2], BY = [[-2.0, 0, -4.6], [2.1, 0, -5.3]];
export const PEDB = [2.8, 0, 1.4];
const MPX = (px) => (px / 840 - 0.5) * 4.2, MPY = (py) => 3.4 + (0.5 - py / 1080) * 5.4;
export const MIAMI = [720, 930];
const TVC = [TVP[0], TVY, TVP[2]];
const EYE = [PPH[0], 1.6, PPH[2]];
const tvDir = (() => { const d = [TVC[0] - EYE[0], TVC[1] - EYE[1], TVC[2] - EYE[2]], l = Math.hypot(...d); return d.map((v) => v / l); })();
export const pedroAt = (f) => (f >= 1014 && f < 1161 ? PPH : MARC);

// ---------- gators ----------
const G0 = [0.2, -0.42, -2.0], G1 = [0.6, 0.0, 1.5];
const snapAt = (f, a, k = 0.55) => (f >= a && f < a + 10 ? k * Math.sin(Math.PI * (f - a) / 10) : 0);
export const poolGator = (f) => {
  const t = f < 533 ? 0 : smooth(ramp(f, 533, 585)), mid = t > 0 && t < 1;
  return {
    x: lerp(G0[0], G1[0], t), z: lerp(G0[2], G1[2], t),
    y: lerp(G0[1], G1[1], t) + 0.34 * Math.sin(Math.PI * t) + 0.025 * Math.sin(f * 0.09) * (1 - t),
    yaw: lerp(0.5 + 0.08 * Math.sin(f * 0.025), -Math.PI / 2, t), pitch: -0.32 * Math.sin(Math.PI * t),
    jaw: Math.max(snapAt(f, 96), snapAt(f, 600), snapAt(f, 612), mid ? 0.25 : 0.04),
    tail: (mid ? 0.5 : 0.22) * Math.sin(f * (mid ? 0.5 : 0.08)), walk: mid ? f * 0.4 : 0,
  };
};
export const gHead = (g) => [g.x + Math.sin(g.yaw) * 0.85, g.y + 0.22, g.z + Math.cos(g.yaw) * 0.85];
export const storeGator = (f) => {
  const ff = clamp(f, 640, 830), w = (ff - 640) * 0.32;
  return { x: 0.05 * Math.sin(w * 0.5), y: 0, z: -11 + 0.082 * (ff - 640), yaw: 0.06 * Math.sin(w * 0.5), pitch: 0, jaw: Math.max(snapAt(f, 705, 0.35), snapAt(f, 790, 0.45), 0.04), tail: 0.35 * Math.sin(w), walk: w };
};
export const handlerX = (f) => lerp(-3.8, HND[0], smooth(ramp(f, 512, 530)));

// ---------- lights ----------
const hx = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixC = (a, b, t) => '#' + hx(a).map((v, i) => Math.round(lerp(v, hx(b)[i], t)).toString(16).padStart(2, '0')).join('');
export const LIGHTS = {
  day: { az: 115, el: 55, sky: '#c8e6ff', ground: '#9a8a62', hemi: 1.25, sun: '#fff3de', sunI: 2.6, fog: '#cfe8f7', fogNear: 120, fogFar: 1300,
    skyTop: '#2a8ae6', skyHor: '#bfe6ff', sat: 1.15, waterDeep: '#1b8ab8', waterShal: '#6fe0ee', glint: '#f2ffff', vig: 0.2, shadowExt: 14 },
  room: { az: 70, el: 45, sky: '#dfe8ff', ground: '#7a6a5a', hemi: 1.25, sun: '#fff4e4', sunI: 1.6, fog: '#d6e4f2', fogNear: 120, fogFar: 1300,
    skyTop: '#4f8fd8', skyHor: '#cfe4ff', sat: 1.1, gain: '#ffffff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.26, shadowExt: 7, lamp: 3, lampAt: R3([0.5, 2.6, 1.2]) },
  night: { az: 60, el: 40, sky: '#6f7fc0', ground: '#3a3050', hemi: 1.0, sun: '#9fb0ff', sunI: 0.9, fog: '#2a3060', fogNear: 120, fogFar: 1300,
    skyTop: '#141a3e', skyHor: '#3a4a8a', sat: 1.05, gain: '#e4ecff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.4, shadowExt: 7, lamp: 6, lampAt: R3([-0.6, 1.6, -0.4]), lampCol: '#bfd4ff', cloud: '#4a5280' },
  store: { az: 100, el: 62, sky: '#e8f0ff', ground: '#8a8a7a', hemi: 1.35, sun: '#fff8ea', sunI: 1.5, fog: '#d6e8f2', fogNear: 120, fogFar: 1300,
    skyTop: '#3a90e0', skyHor: '#cfe8ff', sat: 1.12, waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.22, shadowExt: 16, lamp: 2.5, lampAt: S3([0, 4.5, 0]) },
  neon: { az: 80, el: 35, sky: '#a08aff', ground: '#40305a', hemi: 1.15, sun: '#8fa0ff', sunI: 0.8, fog: '#3a2050', fogNear: 60, fogFar: 700,
    skyTop: '#120a30', skyHor: '#6a2a7a', sat: 1.18, gain: '#f4ecff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.38, shadowExt: 14, lamp: 9, lampAt: N3([0, 4.2, 0.5]), cloud: '#5a3a7a' },
  gold: { az: 70, el: 24, sky: '#ffe2b8', ground: '#8a6a4a', hemi: 1.2, sun: '#ffd09a', sunI: 2.0, fog: '#f2c9a0', fogNear: 150, fogFar: 1300,
    skyTop: '#e8885a', skyHor: '#ffd8a0', sat: 1.12, gain: '#fff0dc', waterDeep: '#2a6a9a', waterShal: '#e8a87a', glint: '#fff0c0', vig: 0.28, shadowExt: 14, cloud: '#ffd8c0' },
};
LIGHTS.cctv = { ...LIGHTS.store, sat: 0.12, gain: '#d4f0d4', lift: '#0c140c', vig: 0.62 };
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.light === 'neon') L.lampCol = Math.floor(f / 8) % 2 ? '#ff4fb0' : '#4fd8ff';
  return L;
};

// ---------- cameras ----------
const PIN = [MPX(MIAMI[0]), MPY(MIAMI[1])];
const povLook = [EYE[0] + tvDir[0] * 2.5, EYE[1] - 2.5 * Math.tan(20 * Math.PI / 180), EYE[2] + tvDir[2] * 2.5];
const tvN = [Math.sin(TVYAW), 0, Math.cos(TVYAW)];
const CAMS = {
  hook: { fr: 'P', K: [
    { f: 0, pos: [1.9, 0.55, 1.4], look: [0.5, -0.05, -1.4], fov: 40 },
    { f: 110, pos: [1.65, 0.62, 1.8], look: [0.45, -0.02, -1.4], fov: 40 },
    { f: 152, pos: [2.4, 3.2, 9.6], look: [0, 1.2, -4.0], fov: 50, path: [[2.5, 1.4, 5.6]] },
    { f: 186, pos: [2.3, 3.3, 10.2], look: [0, 1.2, -4.0], fov: 50 } ], kicks: [{ f: 97, a: 0.012 }] },
  sofa: { fr: 'R', K: [
    { f: 187, pos: [CAL[0], CAL[1], CAL[2] + 1.5], look: CAL, fov: 40 },
    { f: 228, pos: [CAL[0] - 0.05, CAL[1], CAL[2] + 1.65], look: CAL, fov: 40 },
    { f: 262, pos: [0.0, 1.85, 4.8], look: [-0.55, 1.2, -1.0], fov: 52 },
    { f: 389, pos: [0.05, 1.8, 4.3], look: [-0.5, 1.2, -1.0], fov: 52 } ], kicks: [{ f: 205, a: 0.012 }, { f: 316, a: 0.012 }] },
  pool: { fr: 'P', K: [
    { f: 390, pos: [-1.5, 2.6, 8.5], look: [0, 0.2, -2], fov: 46 },
    { f: 455, pos: [-1.2, 2.5, 8.2], look: [0.2, 0.2, -1.8], fov: 46 },
    { f: 480, pos: [1.4, 2.3, 10.0], look: [1.2, 0.6, 0.5], fov: 52 },
    { f: 506, pos: [1.35, 2.3, 9.7], look: [1.2, 0.6, 0.5], fov: 52 },
    { f: 528, pos: [-0.5, 2.3, 12.5], look: [0.1, 1.35, 1.8], fov: 46 },
    { f: 604, pos: [-0.45, 2.2, 12.0], look: [0.1, 1.35, 1.8], fov: 46 },
    { f: 630, pos: [0.2, 3.6, 12.5], look: [0, 1.3, -3.5], fov: 50 },
    { f: 635, pos: [0.2, 3.62, 12.6], look: [0, 1.3, -3.5], fov: 50 } ], kicks: [{ f: 533, a: 0.015 }, { f: 600, a: 0.012 }, { f: 615, a: 0.012 }] },
  store: { fr: 'S', K: [
    { f: 636, pos: [0.9, 0.9, 4.2], look: [0.6, 0.8, -8], fov: 44 },
    { f: 700, pos: [0.95, 1.0, 5.6], look: [0.9, 0.75, -6], fov: 46 },
    { f: 777, pos: [1.0, 1.15, 8.2], look: [1.0, 0.6, -1.5], fov: 46 } ], kicks: [{ f: 729, a: 0.012 }] },
  cctv: { fr: 'S', K: [
    { f: 778, pos: [-2.0, 4.8, 8.5], look: [0.3, 0, -1.6], fov: 58 },
    { f: 830, pos: [-2.0, 4.8, 8.5], look: [0.3, 0, -0.6], fov: 56 } ] },
  street: { fr: 'N', K: [
    { f: 831, pos: [1.4, 0.7, 6.5], look: [0, 2.0, -3], fov: 46 },
    { f: 926, pos: [-1.2, 0.9, 6.8], look: [0, 2.0, -3], fov: 46 },
    { f: 952, pos: [-0.4, 1.1, 8.8], look: [0, 3.6, -14], fov: 50, ease: 'easeOut' },
    { f: 1013, pos: [-0.3, 1.15, 8.3], look: [0, 3.4, -14], fov: 50 } ], kicks: [{ f: 945, a: 0.015 }] },
  phone: { fr: 'R', K: [
    { f: 1014, pos: [-0.2, 1.75, 5.2], look: [-0.36, 1.3, -1.0], fov: 54 },
    { f: 1079, pos: [-0.15, 1.72, 4.6], look: [-0.33, 1.3, -1.0], fov: 54 } ], kicks: [{ f: 1023, a: 0.01 }] },
  pov: { fr: 'R', K: [
    { f: 1080, pos: EYE, look: povLook, fov: 52 },
    { f: 1160, pos: lerp3(EYE, povLook, 0.03), look: povLook, fov: 52 } ], kicks: [{ f: 1131, a: 0.01 }] },
  map: { fr: 'B', K: [
    { f: 1161, pos: [0.7, 2.4, 14.5], look: [0.7, 3.0, 0], fov: 46 },
    { f: 1196, pos: [0.65, 2.5, 13.8], look: [0.7, 3.0, 0], fov: 46 },
    { f: 1222, pos: [0.0, 5.2, 8.8], look: [0, 5.2, 0], fov: 44 },
    { f: 1294, pos: [0.0, 5.18, 8.3], look: [0, 5.18, 0], fov: 44 },
    { f: 1316, pos: [0.69, 1.42, 4.9], look: [0.69, 1.37, 0], fov: 44 },
    { f: 1352, pos: [0.69, 1.41, 4.6], look: [0.69, 1.37, 0], fov: 44 } ], kicks: [{ f: 1200, a: 0.012 }, { f: 1314, a: 0.015 }] },
  proof: { fr: 'B', K: [
    { f: 1353, pos: [0.69, 1.41, 4.6], look: [0.69, 1.37, 0], fov: 44 },
    { f: 1388, pos: [0.75, 3.1, 12.6], look: [0.65, 3.1, 0], fov: 46 },
    { f: 1468, pos: [0.7, 3.1, 11.6], look: [0.65, 3.1, 0], fov: 46 } ], kicks: [{ f: 1439, a: 0.015 }] },
  exag: { fr: 'R', K: [
    { f: 1469, pos: [0.4, 1.75, 4.6], look: [-0.6, 1.25, -1.0], fov: 52 },
    { f: 1518, pos: [0.0, 1.6, 3.3], look: [-1.2, 1.3, -1.3], fov: 48 },
    { f: 1554, pos: [-0.1, 1.58, 3.0], look: [-1.25, 1.32, -1.35], fov: 48 } ], kicks: [{ f: 1525, a: 0.03 }] },
  payoff: { fr: 'R', K: [
    { f: 1555, pos: [-0.1, 1.58, 3.0], look: [-1.25, 1.32, -1.35], fov: 48 },
    { f: 1640, pos: [0.0, 2.5, 7.6], look: [-0.2, 2.3, -2.9], fov: 52 },
    { f: 1668, pos: [0.0, 2.5, 7.4], look: [-0.2, 2.3, -2.9], fov: 52 },
    { f: 1688, pos: add3(TVC, [tvN[0] * 2.7, 0.15, tvN[2] * 2.7]), look: TVC, fov: 48, roll: 4, ease: 'easeIn' },
    { f: 1713, pos: add3(TVC, [tvN[0] * 2.5, 0.14, tvN[2] * 2.5]), look: TVC, fov: 48, roll: 4 } ], kicks: [{ f: 1688, a: 0.035 }] },
};
const FLASH = [187, 390, 636, 831, 1014, 1161, 1469];
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  const o = FR[D.fr]; c.pos = add3(o, c.pos); c.look = add3(o, c.look);
  for (const a of FLASH) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, 0.9 * (1 - (f - a) / 6));
  c.shadowAt = add3(o, S.id === 'street' ? [0, 0, -3] : S.id === 'map' || S.id === 'proof' ? [0.5, 0, 0] : S.id === 'store' || S.id === 'cctv' ? [0, 0, -2] : D.fr === 'P' ? [0, 0, -1] : [0, 0, -1]);
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return f < 112 ? { focus: dist(C.pos, P3(gHead(poolGator(f)))), cinf: 7 } : { focus: 12, cinf: lerp(7, 0, ramp(f, 112, 140)) };
    case 'sofa': return f < 240 ? { focus: dist(C.pos, R3(CAL)), cinf: 6 } : { focus: dist(C.pos, R3([MARC[0], 1.6, MARC[2]])), cinf: 4 };
    case 'store': { const g = storeGator(f); return { focus: dist(C.pos, S3([g.x, 0.4, g.z])), cinf: 4 }; }
    case 'street': return { focus: dist(C.pos, N3([DANCER[0], 2.6, DANCER[2]])), cinf: f < 945 ? 4 : 0 };
    case 'phone': return { focus: dist(C.pos, R3([PPH[0], 1.6, PPH[2]])), cinf: 4 };
    case 'pov': return { focus: 0.48, cinf: 3, near: 0.6 };
    case 'exag': return { focus: dist(C.pos, R3(TVC)), cinf: 5 };
    case 'payoff': return f < 1600 ? { focus: dist(C.pos, R3(TVC)), cinf: 5 } : f < 1670 ? { focus: 9, cinf: 0 } : { focus: dist(C.pos, R3(TVC)), cinf: 5 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
const pop = (f, a, d = 7, s = 2.4) => (f < a ? 0 : q(M.back(ramp(f, a, a + d), s), 2));
const THUMBS = ['pool', 'store', 'car'];
export const tileScale = (f, i) => { const a = 1560 + ((i * 37) % 99) * 0.95; return pop(f, a, 6, 2.2); };
export const worldAt = (f) => {
  const W = {};
  W.gp = poolGator(f); W.gs = storeGator(f);
  const hx_ = handlerX(f);
  W.pole = f >= 516 && f < 640 ? { a: [hx_ + 0.2, 1.08, HND[2] + 0.25], b: gHead(W.gp) } : null;
  W.sign = pop(f, 469);
  W.tape = f >= 568 ? q(M.back(ramp(f, 568, 580), 1.5), 2) : 0;
  W.doors = q(smooth(ramp(f, 676, 692)), 2);
  W.led = Math.floor(f / 10) % 2;
  W.neon = f < 945 ? 0.08 : f < 960 ? ([1, 0, 1, 1, 0, 1][Math.floor((f - 945) / 2.5)] ?? 1) : 1;
  W.haz = Math.floor(f / 8) % 2;
  // TV
  const play = { m: 'play', k: THUMBS[Math.floor(f / 22) % 3], p: q((f % 66) / 66, 2) };
  if (f < 1023) W.tv = play;
  else if (f < 1161) W.tv = { m: 'pause', k: 'pool', p: 0.3 };
  else if (f < 1555) W.tv = { m: 'cover', st: f >= 1525 ? pop(f, 1525, 6, 3) : 0 };
  else W.tv = { ...play, rs: f >= 1686 ? pop(f, 1686, 6, 3) : 0 };
  W.cal = { m: 'D', ring: f >= 205 ? pop(f, 205, 7, 2.5) : 0 };
  W.sky = f < 1000 ? 0.85 : 0;
  // phone
  if (f >= 1056 && f < 1080) W.phone = { pov: false, s: pop(f, 1056, 6), scr: { m: 'feed', sc: 0 } };
  else if (f >= 1080 && f < 1161) {
    const sc = f < 1104 ? q(ramp(f, 1080, 1104) * 2.0, 2) : 2;
    W.phone = { pov: true, s: 1, scr: { m: f < 1104 ? 'feed' : 'video', sc, ok: f >= 1131 ? pop(f, 1131, 6, 3) : 0 } };
  } else W.phone = null;
  // map board
  W.board = {
    mode: f < 1356 ? 'map' : 'proof', title: f >= 1200 ? 'LEONIDA' : 'FLÓRIDA', tp: f >= 1200 ? pop(f, 1200, 6, 3) : 1,
    sub: f >= 1251 ? pop(f, 1251, 6, 2.5) : 0, pin: f >= 1314 ? q(clamp((f - 1314) / 8), 2) : -1, lab: f >= 1333 ? pop(f, 1333, 6, 2.5) : 0,
    qm: f >= 1365 ? pop(f, 1365, 6, 2.5) : 0, ok: f >= 1439 ? pop(f, 1439, 6, 3) : 0,
  };
  W.flip = f >= 1350 && f < 1362 ? Math.max(0.02, q(Math.abs(Math.cos(Math.PI * ramp(f, 1350, 1362))), 2)) : 1;
  W.tilesF = f;
  return W;
};

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o) + (extra.s || ''), draw: (p) => p && globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}, speed = 1) => { const i = idle(f * speed, seed); return { seed, blink: blinkAt(f, seed), tilt: q(i.tilt, 1), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };
const nod = (f, at, k = 0.025) => (f >= at && f < at + 8 ? -k * Math.sin(Math.PI * (f - at) / 8) : 0);
const hop = (f, a, k = 0.06) => (f >= a ? -k * Math.abs(Math.sin((f - a) * 0.45)) * Math.exp(-(f - a) / 30) : 0);
let outfitsSet = false;

const family = (f, out) => {
  const shock = f >= 615;
  out.push(R('mom', life(f, 11, shock ? { expr: 'shock', L: 'reach', R: 'reach', bob: q(hop(f, 615), 3) } : { expr: 'grin', L: 'reach', R: 'reach', look: 0.2 }), P3(FAM.mom)));
  out.push(R('kid', life(f, 13, shock ? { expr: 'shock', L: 'cheek', R: 'cheek', bob: q(hop(f, 617), 3) } : { expr: 'laugh', L: 'point', look: 0.3 }), P3(FAM.kid), { s: 0.6 }));
  out.push(R('dad', life(f, 17, shock ? { expr: 'shock', L: 'reach', R: 'reach', bob: q(hop(f, 619), 3) } : { expr: 'whistle', L: 'reach', R: 'reach', look: -0.2 }), P3(FAM.dad)));
};

export const actorsAt = (f, T) => {
  globalThis.__T = T;
  if (!outfitsSet) { Object.assign(T.OUTFITS, {
    pedro: { tunic: '#3f7fd0', skin: '#f0c49a', hair: '#2b211c', stripes: '#2f62a8' },
    handler: { tunic: '#a8975a', skin: '#e8b890', cap: '#6a5a2a', vest: '#5f5228' },
    mom: { tunic: '#e2453c', skin: '#f5c9a0', hair: '#6a4126', dress: '#e07a9a' },
    dad: { tunic: '#f2a93a', skin: '#c99067', hair: '#1e1714', flowers: '#ffffff', stout: true },
    kid: { tunic: '#5ad0a0', skin: '#f5c9a0', hair: '#6a4126' },
    clerk: { tunic: '#2fa75a', skin: '#ecd0b6', hair: '#3a2418', apron: '#e8e0c8' },
    dancer: { tunic: '#ff5aa8', skin: '#c99067', hair: '#1e1714', tank: true, shades: true } }); outfitsSet = true; }
  const S = shotAt(f), out = [];
  switch (S.id) {
    case 'hook': family(f, out); break;
    case 'pool': {
      family(f, out);
      if (f >= 512) {
        const o = f < 533 ? { expr: 'stern', L: 'reach', R: 'reach', look: 0.3 } : f < 590 ? { expr: 'pained', L: 'reach', R: 'reach', look: 0.4, tilt: -4 } : { expr: 'grin', L: 'reach', R: 'chest', look: 0.2 };
        out.push(R('handler', life(f, 21, o), P3([handlerX(f), 0, HND[2]])));
      }
      break;
    }
    case 'sofa': {
      if (f >= 236) {
        const o = f < 302 ? { expr: 'grin', look: -0.5 } : f < 345 ? { expr: 'laugh', L: 'belly', R: 'belly', bob: q(hop(f, 302, 0.07), 3) }
          : { expr: 'grin', R: 'wave', wv: q(f * 0.5, 1), look: -0.2, headTilt: -5 };
        out.push(R('pedro', life(f, 7, o), R3(MARC)));
      }
      break;
    }
    case 'store': case 'cctv': {
      const o = f < 729 ? { expr: 'neutral', look: -0.3, L: 'reach' } : { expr: 'shock', L: 'up', R: 'up', bob: q(hop(f, 729, 0.08), 3) };
      out.push(R('clerk', life(f, 23, o), S3(CLERK)));
      break;
    }
    case 'street': {
      const pz = [{ L: 'up', R: 'up' }, { L: 'hip', R: 'up' }, { L: 'up', R: 'hip' }, { L: 'wave', R: 'wave' }][Math.floor(f / 8) % 4];
      out.push(R('dancer', life(f, 29, { expr: Math.floor(f / 16) % 2 ? 'laugh' : 'grin', ...pz, wv: q(f * 0.6, 1), step: q((f % 16) / 16, 2), bob: q(-0.03 * Math.abs(Math.sin(f * 0.39)), 3) }), N3(DANCER), { ground: DANCER[1] }));
      const film = f >= 969;
      out.push(R('tourist', life(f, 31, film ? { expr: 'grin', L: 'reach', R: 'reach' } : { expr: 'shock', L: 'cheek', R: 'cheek' }), N3(BY[0])));
      out.push(R('local', life(f, 33, film ? { expr: 'laugh', L: 'reach', R: 'reach' } : { expr: 'laugh', L: 'belly', R: 'point' }), N3(BY[1])));
      break;
    }
    case 'phone': {
      const o = f < 1023 ? { expr: 'neutral', look: -0.5 } : f < 1056 ? { expr: 'squint', look: -0.5, R: 'point' } : { expr: 'squint', L: 'reach', R: 'reach', look: 0, headTilt: 5 };
      out.push(R('pedro', life(f, 7, o), R3(PPH)));
      break;
    }
    case 'map': case 'proof': {
      let o;
      if (f < 1200) o = { expr: 'grin', R: 'point', look: -0.5 };
      else if (f < 1251) o = { expr: 'shock', L: 'cheek', R: 'cheek', look: -0.3, bob: q(hop(f, 1200), 3) };
      else if (f < 1353) o = { expr: 'smile', R: 'point', look: -0.5 };
      else if (f < 1439) o = { expr: 'nervous', L: 'shrug', R: 'shrug', look: -0.2 };
      else o = { expr: 'grin', R: 'thumb', look: 0, bob: q(nod(f, 1441, 0.04), 3) };
      out.push(R('pedro', life(f, 7, o), B3(PEDB)));
      break;
    }
    case 'exag': {
      const o = f < 1525 ? { expr: 'nervous', R: 'brow', look: -0.4 } : { expr: 'pained', L: 'temple', swirl: q(f * 0.2, 1), look: -0.3 };
      out.push(R('pedro', life(f, 7, o), R3(MARC)));
      break;
    }
    case 'payoff': {
      const o = f < 1600 ? { expr: 'dazed', look: -0.3 } : { expr: 'shock', L: 'up', R: 'up', bob: q(hop(f, 1600, 0.06), 3) };
      out.push(R('pedro', life(f, 7, o), R3(MARC)));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1] - 1.125 * s, z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const INK = '#241726';
const drawPhone = (p) => { const g = p.g; g.save(); g.translate(300, 500);
  g.fillStyle = INK; g.beginPath(); g.roundRect(-120, -220, 240, 440, 34); g.fill();
  g.fillStyle = '#5ad0ff'; g.fillRect(-98, -190, 196, 360); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-30, -50); g.lineTo(45, 0); g.lineTo(-30, 50); g.closePath(); g.fill();
  g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(70, -160, 16, 0, 7); g.fill(); g.restore(); };
const drawHeart = (p) => { const g = p.g; g.save(); g.translate(300, 520); g.scale(2.2, 2.2);
  g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-60, -10, -40, -60, 0, -30); g.bezierCurveTo(40, -60, 60, -10, 0, 30); g.closePath();
  g.fillStyle = '#ff3a6a'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.restore(); };
const drawHa = (p) => { const g = p.g; g.save(); g.translate(300, 500); g.rotate(-0.15); g.font = 'bold 190px Arial, "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = INK; g.strokeText('HA', 0, 0); g.fillStyle = '#ffd23f'; g.fillText('HA', 0, 0); g.restore(); };
const phoneAt =(pos, f, seed) => FX('ph', drawPhone, [pos[0], pos[1] + 1.62 + 0.01 * Math.sin(f * 0.2 + seed), pos[2] + 0.28], 0.2);

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || S.id === 'pool') {
    out.push(phoneAt(P3(FAM.mom), f, 1)); out.push(phoneAt(P3(FAM.dad), f, 2));
    if (f >= 96 && f < 118) { const t = q((f - 96) / 22, 2), h = gHead(poolGator(96)); out.push(FX('sp' + t, (p) => T.fxSplash(p, t), P3([h[0], 0.15, h[2] + 0.2]), 0.7, { alpha: 0.95 })); }
    if (f >= 534 && f < 560) { const t = q((f - 534) / 26, 2); out.push(FX('sp2' + t, (p) => T.fxSplash(p, t), P3([0.3, 0.2, 0.3]), 1.0, { alpha: 0.95 })); }
    if (f >= 600 && f < 616) { const h = gHead(poolGator(f)); out.push(FX('bg', (p) => T.fxBang(p), P3([h[0] - 0.1, 0.95, h[2] + 0.3]), q(0.22 * M.back(ramp(f, 600, 605), 2.5), 2))); }
  }
  if (S.id === 'sofa' && f >= 302 && f < 340) { const t = q(((f - 302) % 19) / 19, 2); out.push(FX('ha' + t, drawHa,R3([MARC[0] + 0.35, 2.15 + 0.3 * t, MARC[2] + 0.2]), 0.3, { alpha: q(1 - t * 0.6, 2) })); }
  if ((S.id === 'store' || S.id === 'cctv') && f >= 729 && f < 750) out.push(FX('cb', (p) => T.fxBang(p), S3([CLERK[0] - 0.2, 2.5, CLERK[2] + 0.2]), q(0.32 * M.back(ramp(f, 729, 734), 2.5), 2)));
  if (S.id === 'street' && f >= 969) {
    for (const [i, b] of BY.entries()) {
      out.push(phoneAt(N3(b), f, i));
      if (f >= 990) for (let k = 0; k < 3; k++) { const t = ((f - 990 + k * 9) % 27) / 27; out.push(FX('h' + i + k + q(t, 2), drawHeart, N3([b[0] + (k - 1) * 0.25, 2.3 + t * 1.2, b[2] + 0.3]), 0.16, { alpha: q(1 - t, 2) })); }
    }
  }
  if (S.id === 'map' && f >= 1314 && f < 1334) { const t = q((f - 1314) / 20, 2); out.push(FX('pb' + t, (p) => T.fxBurst(p, t, '#ffe28a', 12), B3([PIN[0], PIN[1] + 0.2, 0.25]), 0.45, { order: 1 })); }
  if (S.id === 'proof' && f >= 1439 && f < 1460) { const t = q((f - 1439) / 21, 2); for (const [i, [x, y]] of [[-1.1, 3.0], [0.1, 3.5], [1.15, 2.4]].entries()) out.push(FX('ok' + i + t, (p) => T.fxSpark(p, t), B3([x, y + 0.3, 0.3]), 0.5)); }
  if (S.id === 'pov' && f >= 1131 && f < 1150) { const t = q((f - 1131) / 19, 2); out.push(FX('ps' + t, (p) => T.fxSpark(p, t), R3([PPH[0] + tvDir[0] * 0.42 + 0.06, 1.3, PPH[2] + tvDir[2] * 0.42]), 0.1, { order: 6 })); }
  if (S.id === 'payoff' && f >= 1688 && f < 1706) out.push(FX('rb', (p) => T.fxBang(p), R3([TVP[0] + 0.7, 1.95, TVP[2] + 0.5]), q(0.3 * M.back(ramp(f, 1688, 1693), 2.5), 2)));
  return out;
};

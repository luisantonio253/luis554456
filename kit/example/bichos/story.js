// "Mais de 100 animais e milhares de portas" — timed to voice.mp3 (64.68 s, 1940 frames @ 30 fps). See work/PLAN.md.
import { M, camFromKeys, idle, blinkAt, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 1940;
// legacy sets still built by the kit (room + beach board are reused)
export const PO = [0, 0, 0], RO = [300, 0, 0], ST = [-300, 0, 0], SR = [0, 0, -220], MP = [150, 0, 150];
// new sets
export const LE = [1500, 0, 0], NA = [1500, 0, 900], CN = [1500, 0, -900];
export const SHOTS = [
  { id: 'hook', a: 0, b: 197, light: 'day' },
  { id: 'piada', a: 198, b: 235, light: 'day' },
  { id: 'especies', a: 236, b: 377, light: 'day' },
  { id: 'aves', a: 378, b: 453, light: 'day' },
  { id: 'mamif', a: 454, b: 516, light: 'day' },
  { id: 'beira', a: 517, b: 614, light: 'day' },
  { id: 'chega', a: 615, b: 718, light: 'day' },
  { id: 'opcoes', a: 719, b: 818, light: 'day' },
  { id: 'estudar', a: 819, b: 968, light: 'gold' },
  { id: 'album', a: 969, b: 1028, light: 'gold' },
  { id: 'portas', a: 1029, b: 1156, light: 'past' },
  { id: 'predios', a: 1157, b: 1249, light: 'past' },
  { id: 'trancada', a: 1250, b: 1338, light: 'past' },
  { id: 'mod', a: 1339, b: 1464, light: 'night' },
  { id: 'interior', a: 1465, b: 1658, light: 'day' },
  { id: 'detalhe', a: 1659, b: 1710, light: 'day' },
  { id: 'crime', a: 1711, b: 1797, light: 'day' },
  { id: 'final', a: 1798, b: 1939, light: 'day' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const FR = { L: LE, N: NA, C: CN, R: RO, B: MP };
const L3 = (p) => add3(LE, p), N3 = (p) => add3(NA, p), C3 = (p) => add3(CN, p), R3 = (p) => add3(RO, p), B3 = (p) => add3(MP, p);

// ---------- layout (set-local) ----------
export const TVP = [-1.5, 0, -1.5], TVY = 1.35, TVYAW = 0.5, CAL = [1.3, 2.05, -2.93], PPH = [0.3, 0, 0.6];
export const BH = [-1.5, 0, 0.4], DH = [-0.85, 0, 0.95], BAG = [-2.15, 0, 0.75], CARP = [-2.3, 0, -1.7];
export const MENU = [-0.32, 1.15, 1.2];
export const BF = [0.62, 0, -3.75], HOUSES = [-8, 0, 8, 16, 24, 32, 40], CMP = [47.5, 0, -0.5];
export const OPEN0 = 1469; // interior row: house k (1..5) opens at OPEN0 + (k-1)*24
export const BILL = [2.5, 0, 1.5], ROCK = [0.4, 0, 0.9], GATOR = [-2.1, 0, 3.0];
export const FLAM = [[-5.8, -4.2], [-4.6, -5.6], [-3.4, -4.4], [-2.2, -6.2], [-1.2, -4.8], [-6.8, -6.4], [-0.2, -6.9]];
export const PANELS = [-7.5, 0, 7.5]; // CN facade centres (x)
export const DESK = [2.7, 0, -2.3], BROOM = [1.85, 0, -1.5];
export const PEDB = [2.8, 0, 1.4];
const ALX = (px) => (px / 840 - 0.5) * 4.2, ALY = (py) => 3.4 + (0.5 - py / 1080) * 5.4;
export const SLOTS = [[160, 380], [420, 380], [680, 380], [160, 620], [420, 620], [680, 620], [160, 860], [420, 860], [680, 860]];

// ---------- dog ----------
const DOOR_DOG = [-0.05, 0, -5.4];
export const dogAt = (f) => {
  const wagFast = (k) => 0.7 * Math.sin(f * 0.9) * k;
  if (f >= 1798) { // final: dog walks out of the open door
    const t = smooth(ramp(f, 1872, 1898)), p = lerp3(DOOR_DOG, [-0.2, 0, -3.45], t), happy = f >= 1890;
    return { x: p[0], y: happy ? Math.abs(Math.sin(f * 0.35)) * 0.05 : 0, z: p[2], yaw: 0.35, tail: wagFast(happy ? 1.2 : 0.6), head: happy ? 0.25 : 0.05, ear: happy ? -0.2 : 0.1, tongue: happy ? 1 : 0, walk: t > 0 && t < 1 ? f * 0.6 : 0, sad: 0 };
  }
  let happy = 0, sad = 0, hopK = 0;
  if (f >= 139 && f < 236) { happy = 1; hopK = 0.06; }
  if (f >= 722 && f < 758) { happy = 1; hopK = 0.05; }
  if (f >= 758 && f < 793) sad = 1;
  if (f >= 793) { happy = 0.4; }
  const yaw = f >= 615 && f < 719 ? -0.5 : 0.55; // looks toward Beto
  return { x: DH[0], y: hopK ? hopK * Math.abs(Math.sin(f * 0.32)) : 0, z: DH[2], yaw, tail: sad ? 0.05 * Math.sin(f * 0.2) : wagFast(happy ? 1.1 : 0.45), head: sad ? -0.35 : happy ? 0.2 : 0.05 * Math.sin(f * 0.05),
    ear: sad ? 0.6 : happy ? -0.2 : 0, tongue: happy ? 1 : 0, walk: 0, sad };
};
export const gatorAt = (f) => {
  const snap = (a, k = 0.6) => (f >= a && f < a + 12 ? k * Math.sin(Math.PI * (f - a) / 12) : 0);
  return { x: GATOR[0], y: 0.02, z: GATOR[2], yaw: 0.75 + 0.05 * Math.sin(f * 0.04), pitch: 0, jaw: Math.max(snap(575), snap(596, 0.4), 0.04), tail: 0.25 * Math.sin(f * 0.07), walk: 0 };
};
export const betoWalkX = (f) => lerp(-3.5, BH[0], smooth(ramp(f, 617, 672)));

// ---------- lights ----------
export const LIGHTS = {
  day: { az: 115, el: 52, sky: '#c8e6ff', ground: '#9a8a62', hemi: 1.25, sun: '#fff3de', sunI: 2.5, fog: '#cfe8f7', fogNear: 120, fogFar: 900,
    skyTop: '#2a8ae6', skyHor: '#bfe6ff', sat: 1.15, waterDeep: '#1b8ab8', waterShal: '#6fe0ee', glint: '#f2ffff', vig: 0.2, shadowExt: 16 },
  night: { az: 60, el: 40, sky: '#6f7fc0', ground: '#3a3050', hemi: 1.0, sun: '#9fb0ff', sunI: 0.9, fog: '#2a3060', fogNear: 120, fogFar: 900,
    skyTop: '#141a3e', skyHor: '#3a4a8a', sat: 1.05, gain: '#e4ecff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.4, shadowExt: 7, lamp: 6, lampAt: R3([2.2, 1.9, -0.9]), lampCol: '#bfd4ff', cloud: '#4a5280' },
  gold: { az: 70, el: 24, sky: '#ffe2b8', ground: '#8a6a4a', hemi: 1.2, sun: '#ffd09a', sunI: 2.0, fog: '#f2c9a0', fogNear: 150, fogFar: 900,
    skyTop: '#e8885a', skyHor: '#ffd8a0', sat: 1.12, gain: '#fff0dc', waterDeep: '#2a6a9a', waterShal: '#e8a87a', glint: '#fff0c0', vig: 0.28, shadowExt: 14, cloud: '#ffd8c0' },
};
LIGHTS.past = { ...LIGHTS.gold, az: 100, el: 34, sat: 0.72, gain: '#ffe6c4', lift: '#140c04', vig: 0.42, shadowExt: 22, sunI: 1.9, hemi: 1.25 };
export const lightFor = (S) => ({ ...LIGHTS[S.light] });

// ---------- cameras ----------
const al = (k, d = 4.2, dy = 0) => { const [px, py] = SLOTS[k]; return { pos: [ALX(px), ALY(py) + dy, d], look: [ALX(px), ALY(py), 0] }; };
const CAMS = {
  hook: { fr: 'L', K: [
    { f: 0, pos: [-1.0, 1.45, 4.7], look: [-1.75, 1.05, 0], fov: 46 },
    { f: 120, pos: [-1.05, 1.4, 4.4], look: [-1.7, 1.0, 0], fov: 46 },
    { f: 160, pos: [-0.65, 1.05, 3.6], look: [-0.98, 0.72, 0.6], fov: 44 },
    { f: 197, pos: [-0.66, 1.03, 3.45], look: [-0.98, 0.72, 0.6], fov: 44 } ], kicks: [{ f: 47, a: 0.012 }, { f: 97, a: 0.01 }] },
  piada: { fr: 'L', K: [
    { f: 198, pos: [-0.95, 1.35, 3.6], look: [-1.35, 1.1, 0.6], fov: 46 },
    { f: 235, pos: [-0.97, 1.33, 3.35], look: [-1.37, 1.1, 0.6], fov: 46 } ] },
  especies: { fr: 'N', K: [
    { f: 236, pos: [2.6, 2.0, 12.5], look: [2.5, 2.6, 1.5], fov: 50 },
    { f: 377, pos: [2.55, 2.1, 10.6], look: [2.5, 2.6, 1.5], fov: 50 } ], kicks: [{ f: 282, a: 0.012 }, { f: 350, a: 0.01 }] },
  aves: { fr: 'N', K: [
    { f: 378, pos: [2.5, 2.1, 10.5], look: [2.5, 2.6, 1.5], fov: 50 },
    { f: 408, pos: [0.2, 2.3, 7.5], look: [-3.4, 1.4, -5.2], fov: 50 },
    { f: 453, pos: [0.0, 2.4, 7.0], look: [-3.4, 1.6, -5.2], fov: 50 } ] },
  mamif: { fr: 'N', K: [
    { f: 454, pos: [0.0, 2.4, 7.0], look: [-3.4, 1.6, -5.2], fov: 50 },
    { f: 474, pos: [4.6, 1.3, 5.6], look: [6.0, 0.8, 0.6], fov: 48 },
    { f: 516, pos: [4.7, 1.28, 5.2], look: [6.0, 0.8, 0.6], fov: 48 } ] },
  beira: { fr: 'N', K: [
    { f: 517, pos: [-1.2, 1.2, 8.6], look: [-2.2, 0.7, -1.8], fov: 50 },
    { f: 540, pos: [-0.6, 1.0, 8.2], look: [-0.6, 0.6, 0.0], fov: 50 },
    { f: 566, pos: [-0.9, 0.75, 6.4], look: [-2.0, 0.35, 3.0], fov: 46 },
    { f: 614, pos: [-0.95, 0.72, 6.0], look: [-2.0, 0.35, 3.0], fov: 46 } ], kicks: [{ f: 576, a: 0.014 }] },
  chega: { fr: 'L', K: [
    { f: 615, pos: [-2.4, 1.4, 4.6], look: [-2.8, 1.0, 0.5], fov: 46 },
    { f: 672, pos: [-1.1, 1.25, 4.0], look: [-1.1, 0.95, 0.7], fov: 46 },
    { f: 718, pos: [-0.4, 1.2, 4.6], look: [-0.42, 0.95, 0.9], fov: 46 } ], kicks: [{ f: 684, a: 0.01 }] },
  opcoes: { fr: 'L', K: [
    { f: 719, pos: [-0.4, 1.2, 4.6], look: [-0.42, 0.95, 0.9], fov: 46 },
    { f: 818, pos: [-0.4, 1.15, 4.25], look: [-0.42, 0.93, 0.95], fov: 46 } ], kicks: [{ f: 759, a: 0.012 }] },
  estudar: { fr: 'B', K: [
    { f: 819, pos: [0.8, 2.6, 13.5], look: [0.7, 3.0, 0], fov: 46 },
    { f: 846, pos: [0.75, 2.7, 12.8], look: [0.7, 3.0, 0], fov: 46 },
    { f: 862, ...al(0), fov: 44 }, { f: 880, ...al(0, 4.0), fov: 44 },
    { f: 892, ...al(4), fov: 44 }, { f: 924, ...al(4, 3.9), fov: 44 },
    { f: 938, ...al(8), fov: 44 }, { f: 968, ...al(8, 3.8), fov: 44 } ], kicks: [{ f: 864, a: 0.01 }, { f: 941, a: 0.014 }] },
  album: { fr: 'B', K: [
    { f: 969, ...al(8, 3.8), fov: 44 },
    { f: 996, pos: [0.8, 2.7, 13.2], look: [0.7, 3.1, 0], fov: 46 },
    { f: 1028, pos: [0.78, 2.7, 12.6], look: [0.7, 3.1, 0], fov: 46 } ] },
  portas: { fr: 'C', K: [
    { f: 1029, pos: [0.35, 1.3, 3.9], look: [0.1, 1.05, 0], fov: 44 },
    { f: 1090, pos: [0.6, 1.35, 4.7], look: [0.5, 1.2, 0], fov: 44 },
    { f: 1130, pos: [16.5, 4.2, -2.6], look: [0, 2.6, 0], fov: 50, path: [[7, 2.8, 8.5], [14.5, 3.6, 4]] },
    { f: 1156, pos: [16.8, 4.3, -2.9], look: [0, 2.6, 0], fov: 50 } ], kicks: [{ f: 1063, a: 0.01 }] },
  predios: { fr: 'C', K: [
    { f: 1157, pos: [-7.5, 1.9, 10.0], look: [-7.5, 2.9, 0], fov: 46 },
    { f: 1178, pos: [-7.3, 1.9, 9.8], look: [-7.3, 2.9, 0], fov: 46 },
    { f: 1190, pos: [0.0, 1.9, 9.8], look: [0.0, 2.9, 0], fov: 46 },
    { f: 1203, pos: [0.2, 1.9, 9.7], look: [0.2, 2.9, 0], fov: 46 },
    { f: 1215, pos: [7.5, 1.9, 9.8], look: [7.5, 2.9, 0], fov: 46 },
    { f: 1249, pos: [7.7, 1.75, 6.0], look: [7.5, 1.6, 0], fov: 46 } ] },
  trancada: { fr: 'C', K: [
    { f: 1250, pos: [8.3, 1.5, 3.6], look: [7.6, 1.2, 0], fov: 46 },
    { f: 1284, pos: [8.4, 1.5, 3.3], look: [7.6, 1.2, 0], fov: 46 },
    { f: 1312, pos: [12.6, 1.8, -4.6], look: [7.8, 1.2, -1.2], fov: 48, path: [[12.8, 1.7, 1.6]] },
    { f: 1338, pos: [12.3, 1.75, -4.4], look: [7.8, 1.2, -1.2], fov: 48 } ], kicks: [{ f: 1251, a: 0.014 }] },
  mod: { fr: 'R', K: [
    { f: 1339, pos: [2.0, 1.75, 2.6], look: [2.4, 1.15, -2.2], fov: 50 },
    { f: 1410, pos: [2.15, 1.6, 2.0], look: [2.4, 1.18, -2.2], fov: 48 },
    { f: 1464, pos: [2.15, 1.55, 1.7], look: [2.4, 1.18, -2.2], fov: 48 } ], kicks: [{ f: 1430, a: 0.012 }] },
  interior: { fr: 'L', K: [
    { f: 1468, pos: [7.6, 1.8, 6.6], look: [8.0, 1.5, -4.5], fov: 48 },
    { f: 1484, pos: [7.9, 1.8, 6.4], look: [8.1, 1.5, -4.5], fov: 48 },
    { f: 1492, pos: [15.6, 1.8, 6.6], look: [16.0, 1.5, -4.5], fov: 48 },
    { f: 1508, pos: [15.9, 1.8, 6.4], look: [16.1, 1.5, -4.5], fov: 48 },
    { f: 1516, pos: [23.6, 1.8, 6.6], look: [24.0, 1.5, -4.5], fov: 48 },
    { f: 1532, pos: [23.9, 1.8, 6.4], look: [24.1, 1.5, -4.5], fov: 48 },
    { f: 1540, pos: [31.6, 1.8, 6.6], look: [32.0, 1.5, -4.5], fov: 48 },
    { f: 1556, pos: [31.9, 1.8, 6.4], look: [32.1, 1.5, -4.5], fov: 48 },
    { f: 1564, pos: [39.6, 1.8, 6.6], look: [40.0, 1.5, -4.5], fov: 48 },
    { f: 1580, pos: [39.9, 1.8, 6.4], look: [40.1, 1.5, -4.5], fov: 48 },
    { f: 1612, pos: [46.5, 2.0, 7.4], look: [47.5, 2.1, -0.5], fov: 46 },
    { f: 1658, pos: [46.9, 2.0, 6.6], look: [47.5, 2.1, -0.5], fov: 46 } ], kicks: [{ f: 1629, a: 0.012 }] },
  detalhe: { fr: 'L', K: [
    { f: 1659, pos: [-1.0, 1.6, 6.2], look: [-1.8, 1.2, 0], fov: 46 },
    { f: 1710, pos: [-1.15, 1.5, 4.9], look: [-1.8, 1.15, 0], fov: 46 } ] },
  crime: { fr: 'L', K: [
    { f: 1711, pos: [-1.15, 1.5, 4.9], look: [-1.8, 1.15, 0], fov: 46 },
    { f: 1797, pos: [-1.3, 1.45, 4.0], look: [-1.75, 1.15, 0.2], fov: 46, roll: -2 } ], kicks: [{ f: 1770, a: 0.02 }] },
  final: { fr: 'L', K: [
    { f: 1798, pos: [1.9, 1.55, 0.4], look: [0.2, 1.2, -4.2], fov: 46 },
    { f: 1880, pos: [1.7, 1.45, -0.2], look: [0.15, 1.0, -4.0], fov: 46 },
    { f: 1915, pos: [1.55, 1.2, -0.9], look: [0.2, 0.85, -3.6], fov: 44, roll: 3, ease: 'easeIn' },
    { f: 1939, pos: [1.5, 1.18, -1.05], look: [0.2, 0.85, -3.6], fov: 44, roll: 3 } ], kicks: [{ f: 1855, a: 0.01 }, { f: 1862, a: 0.01 }, { f: 1916, a: 0.02 }] },
};
const FLASH = [236, 615, 819, 1029, 1339, 1465];
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  const o = FR[D.fr]; c.pos = add3(o, c.pos); c.look = add3(o, c.look);
  for (const a of FLASH) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, 0.9 * (1 - (f - a) / 6));
  const sh = { L: S.id === 'interior' ? [lerp(8, 44, ramp(f, 1465, 1640)), 0, -2] : S.id === 'final' ? [0, 0, -3] : [-1.5, 0, 0], N: [0, 0, 0], C: [2, 0, 0], R: [1.5, 0, -1.5], B: [0.5, 0, 0] };
  c.shadowAt = add3(o, sh[D.fr]);
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return f < 140 ? { focus: dist(C.pos, L3([BH[0], 1.3, BH[2]])), cinf: 5 } : { focus: dist(C.pos, L3([DH[0], 0.5, DH[2]])), cinf: 6 };
    case 'piada': return { focus: dist(C.pos, L3([BH[0], 1.3, BH[2]])), cinf: 5 };
    case 'chega': return { focus: dist(C.pos, L3([betoWalkX(f), 1.3, BH[2]])), cinf: 4 };
    case 'opcoes': return { focus: dist(C.pos, L3(MENU)), cinf: 5 };
    case 'beira': return f >= 560 ? { focus: dist(C.pos, N3([GATOR[0], 0.3, GATOR[2]])), cinf: 5 } : { focus: 10, cinf: 0 };
    case 'mod': return { focus: dist(C.pos, R3([DESK[0], 1.15, DESK[2]])), cinf: 4 };
    case 'trancada': return f < 1288 ? { focus: dist(C.pos, C3([7.8, 1.3, 0.4])), cinf: 4 } : { focus: 10, cinf: 0 };
    case 'detalhe': case 'crime': return { focus: dist(C.pos, L3([BH[0], 1.3, BH[2]])), cinf: 4 };
    case 'final': return { focus: dist(C.pos, L3([0.3, 0.9, -3.6])), cinf: 5 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
const pop = (f, a, d = 7, s = 2.4) => (f < a ? 0 : q(M.back(ramp(f, a, a + d), s), 2));
export const doorOpen = (f, k) => { // k = index into HOUSES
  if (HOUSES[k] === 0) return q(smooth(ramp(f, 1866, 1880)), 2);
  if (HOUSES[k] > 0) return q(smooth(ramp(f, OPEN0 + (HOUSES[k] / 8 - 1) * 24, OPEN0 + (HOUSES[k] / 8 - 1) * 24 + 14)), 2);
  return 0;
};
export const worldAt = (f) => {
  const W = {};
  W.dog = dogAt(f); W.gator = gatorAt(f);
  W.haz = (f < 236 || (f >= 1659 && f < 1798)) ? Math.floor(f / 7) % 2 : 0;
  W.bag = f < 96 ? 0 : pop(f, 96, 8, 2.6);
  W.doors = HOUSES.map((_, k) => doorOpen(f, k));
  W.menu = f >= 683 && f < 819 ? { s: pop(f, 683, 7, 2.4), sel: f < 722 ? -1 : f < 758 ? 0 : f < 793 ? 1 : 2, k: f >= 722 ? q(M.back(ramp(f, f < 758 ? 722 : f < 793 ? 758 : 793, (f < 758 ? 722 : f < 793 ? 758 : 793) + 6), 3), 2) : 0 } : null;
  W.bill = { n: f < 281 ? 0 : Math.round(170 * smooth(ramp(f, 281, 302)) / 10) * 10, lp: f >= 349 ? pop(f, 349, 6, 2.5) : 0, b: f >= 427 ? pop(f, 427, 6) : 0, m: f >= 481 ? pop(f, 481, 6) : 0 };
  W.flam = FLAM.map((_, i) => (f < 395 ? 0 : pop(f, 395 + i * 5, 8, 2.2)));
  W.mammals = f >= 481 ? 1 : 0;
  // album
  W.album = { s: [863, 0, 0, 0, 891, 0, 0, 0, 940].map((a, i) => (a ? (f >= a ? pop(f, a, 6, 2.8) : 0) : f >= 983 + i * 3 ? pop(f, 983 + i * 3, 6, 2.4) : 0)), glow: f >= 940 ? q(0.5 + 0.5 * Math.sin(f * 0.25), 1) : 0 };
  // CN past town
  W.gtav = f >= 1062 ? pop(f, 1062, 7, 2.4) : 0;
  W.on = [f >= 1157 ? 1 : 0, f >= 1185 ? 1 : 0, f >= 1209 ? 1 : 0];
  W.lock = f >= 1250 ? pop(f, 1250, 6, 2.6) : 0;
  // PC monitor
  W.mon = f < 1429 ? { m: 'mod', p: q(clamp((f - 1352) / 72), 2) } : { m: 'ok', s: pop(f, 1429, 6, 2.8) };
  // comparison board
  W.cmp = f >= 1628 ? { s: pop(f, 1628, 7, 2.2), n: Math.min(20, Math.max(0, Math.floor((f - 1634) / 1.5))) } : { s: 0, n: 0 };
  W.cmpShow = f >= 1465 && f < 1659;
  return W;
};

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o) + (extra.s || ''), draw: (p) => p && globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}, speed = 1) => { const i = idle(f * speed, seed); return { seed, blink: blinkAt(f, seed), tilt: q(i.tilt, 1), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };
const nod = (f, at, k = 0.025) => (f >= at && f < at + 8 ? -k * Math.sin(Math.PI * (f - at) / 8) : 0);
const hop = (f, a, k = 0.06) => (f >= a ? -k * Math.abs(Math.sin((f - a) * 0.45)) * Math.exp(-(f - a) / 30) : 0);
let outfitsSet = false;

export const actorsAt = (f, T) => {
  globalThis.__T = T;
  if (!outfitsSet) { Object.assign(T.OUTFITS, {
    beto: { tunic: '#f2a93a', skin: '#e8b890', hair: '#2b211c', flowers: '#ffffff', shades: false } }); outfitsSet = true; }
  const S = shotAt(f), out = [];
  const B = (o, pos) => out.push(R('beto', life(f, 7, o), pos));
  switch (S.id) {
    case 'hook': {
      const o = f < 46 ? { expr: 'grin', look: 0.3, L: 'hip' } : f < 96 ? { expr: 'whistle', look: -0.4, R: 'thumb' } : f < 139 ? { expr: 'grin', L: 'lift', look: -0.3 } : { expr: 'smile', L: 'reach', R: 'reach', look: 0.5, headTilt: 6, bob: q(nod(f, 150, 0.03), 3) };
      B(o, L3(BH)); break;
    }
    case 'piada': B({ expr: 'grin', R: 'thumb', look: 0, bob: q(nod(f, 206, 0.04), 3) }, L3(BH)); break;
    case 'chega': {
      const walking = f >= 617 && f < 672, ph = (f - 617) * 0.22;
      B({ expr: f < 683 ? 'smile' : 'shock', look: 0.5, L: f < 683 ? 'hang' : 'cheek', R: f < 683 ? 'hang' : 'cheek', step: walking ? q(Math.abs(Math.sin(ph)) * 0.25, 2) : 0, bob: walking ? q(-0.03 * Math.abs(Math.sin(ph)), 3) : q(hop(f, 684, 0.05), 3) }, L3([betoWalkX(f), 0, BH[2]]));
      break;
    }
    case 'opcoes': {
      const o = f < 758 ? { expr: 'smile', L: 'reach', R: 'reach', look: 0.5 } : f < 793 ? { expr: 'stern', R: 'point', look: 0.5 } : { expr: 'squint', R: 'scope', look: 0.4 };
      B(o, L3(BH)); break;
    }
    case 'estudar': case 'album': {
      const o = f < 863 ? { expr: 'squint', R: 'scope', look: -0.5 } : f < 940 ? { expr: 'grin', R: 'point', look: -0.5 } : f < 983 ? { expr: 'shock', L: 'cheek', R: 'cheek', bob: q(hop(f, 941), 3) } : { expr: 'laugh', L: 'up', R: 'up', bob: q(hop(f, 984, 0.05), 3) };
      B(o, B3(PEDB)); break;
    }
    case 'trancada': {
      if (f < 1296) { const shake = f >= 1250 && f < 1268 ? 0.04 * Math.sin((f - 1250) * 2.2) : 0;
        B(f < 1250 ? { expr: 'grin', L: 'reach', look: -0.4 } : { expr: 'pained', L: 'reach', R: 'reach', look: -0.4, tilt: -4 }, C3([7.95 + shake, 0, 0.5])); }
      else B(f < 1318 ? { expr: 'nervous', L: 'brow', look: 0.3 } : { expr: 'dazed', L: 'shrug', R: 'shrug', look: 0.2 }, C3([8.4, 0, -1.9]));
      break;
    }
    case 'mod': {
      const o = f < 1429 ? { expr: 'squint', L: 'reach', R: 'reach', look: 0.6 } : { expr: 'laugh', L: 'up', R: 'up', bob: q(hop(f, 1430, 0.06), 3) };
      B(o, R3(BROOM)); break;
    }
    case 'detalhe': B({ expr: 'nervous', look: 0.2, L: 'hip' }, L3(BH)); break;
    case 'crime': B(f < 1768 ? { expr: 'grin', R: 'chest', look: 0 } : { expr: 'stubborn', R: 'chest', L: 'hip', look: 0, bob: q(nod(f, 1768, 0.04), 3) }, L3(BH)); break;
    case 'final': {
      let o;
      if (f < 1854) o = { expr: 'neutral', look: -0.4 };
      else if (f < 1870) o = { expr: 'grin', R: ((f - 1854) % 8) < 4 ? 'up' : 'point', look: -0.4 };
      else if (f < 1890) o = { expr: 'shock', L: 'cheek', R: 'cheek', look: -0.3 };
      else o = { expr: 'smile', L: 'reach', R: 'reach', look: -0.4, headTilt: 7, bob: q(nod(f, 1912, 0.03), 3) };
      B(o, L3(BF)); break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1] - 1.125 * s, z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const INK = '#241726';
const drawHeart = (p) => { const g = p.g; g.save(); g.translate(300, 520); g.scale(2.2, 2.2);
  g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(-60, -10, -40, -60, 0, -30); g.bezierCurveTo(40, -60, 60, -10, 0, 30); g.closePath();
  g.fillStyle = '#ff3a6a'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); g.restore(); };
const word = (s, col, px = 170, rot = -0.12) => (p) => { const g = p.g; g.save(); g.translate(300, 500); g.rotate(rot); g.font = `bold ${px}px Arial, "DejaVu Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 24; g.strokeStyle = INK; g.strokeText(s, 0, 0); g.fillStyle = col; g.fillText(s, 0, 0); g.restore(); };
const OL = (g, w = 7) => { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); };
const drawDeer = (p) => { const g = p.g; g.save(); g.translate(300, 560);
  g.fillStyle = '#b87a44'; for (const x of [-70, -40, 50, 80]) { g.beginPath(); g.rect(x - 9, 30, 18, 150); g.fill(); OL(g, 5); }
  g.beginPath(); g.ellipse(0, 20, 120, 60, 0, 0, 7); g.fill(); OL(g); g.beginPath(); g.ellipse(-110, -40, 32, 70, -0.5, 0, 7); g.fill(); OL(g);
  g.beginPath(); g.ellipse(-150, -110, 52, 38, -0.2, 0, 7); g.fill(); OL(g);
  g.strokeStyle = '#7a4a24'; g.lineWidth = 9; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-150 + s * 18, -140); g.lineTo(-150 + s * 40, -220); g.moveTo(-150 + s * 32, -190); g.lineTo(-150 + s * 62, -205); g.stroke(); }
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-162, -118, 11, 0, 7); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(-164, -116, 6, 0, 7); g.fill(); g.beginPath(); g.arc(-198, -100, 9, 0, 7); g.fill();
  g.fillStyle = '#f4e2c8'; g.beginPath(); g.ellipse(115, 0, 22, 16, 0, 0, 7); g.fill(); g.restore(); };
const drawRaccoon = (p) => { const g = p.g; g.save(); g.translate(300, 640);
  g.fillStyle = '#8a8a92'; g.beginPath(); g.ellipse(0, 0, 110, 70, 0, 0, 7); g.fill(); OL(g);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#3a3a42' : '#b8b8c0'; g.beginPath(); g.ellipse(120 + i * 26, -20 - i * 12, 24, 18, -0.5, 0, 7); g.fill(); OL(g, 4); }
  g.fillStyle = '#9a9aa2'; g.beginPath(); g.ellipse(-100, -60, 64, 52, 0, 0, 7); g.fill(); OL(g);
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-100 + s * 40, -100); g.lineTo(-100 + s * 52, -150); g.lineTo(-100 + s * 14, -112); g.closePath(); g.fillStyle = '#7a7a82'; g.fill(); OL(g, 4); }
  g.fillStyle = '#2a2a32'; g.beginPath(); g.ellipse(-100, -66, 58, 18, 0, 0, 7); g.fill();
  for (const s of [-1, 1]) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-100 + s * 24, -66, 10, 0, 7); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(-100 + s * 24, -64, 5, 0, 7); g.fill(); }
  g.fillStyle = INK; g.beginPath(); g.arc(-100, -34, 9, 0, 7); g.fill(); g.restore(); };
const drawRabbit = (p) => { const g = p.g; g.save(); g.translate(300, 700); g.fillStyle = '#d8c8b0';
  g.beginPath(); g.ellipse(0, 0, 80, 60, 0, 0, 7); g.fill(); OL(g); g.beginPath(); g.ellipse(-70, -60, 46, 40, 0, 0, 7); g.fill(); OL(g);
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(-70 + s * 18, -150, 14, 52, s * 0.2, 0, 7); g.fill(); OL(g, 5); }
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(80, -10, 20, 0, 7); g.fill(); OL(g, 4); g.fillStyle = INK; g.beginPath(); g.arc(-84, -64, 7, 0, 7); g.fill(); g.restore(); };
const drawIguana = (p) => { const g = p.g; g.save(); g.translate(300, 760);
  g.strokeStyle = '#4fa04a'; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath(); g.moveTo(110, 0); g.quadraticCurveTo(200, 10, 250, -40); g.stroke();
  g.fillStyle = '#5ab84a'; g.beginPath(); g.ellipse(0, 0, 130, 44, 0, 0, 7); g.fill(); OL(g); g.beginPath(); g.ellipse(-150, -18, 56, 34, 0.1, 0, 7); g.fill(); OL(g);
  g.fillStyle = '#3a8a3a'; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(-120 + i * 30, -40); g.lineTo(-106 + i * 30, -70); g.lineTo(-92 + i * 30, -40); g.fill(); }
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-168, -28, 12, 0, 7); g.fill(); g.fillStyle = INK; g.beginPath(); g.arc(-170, -27, 6, 0, 7); g.fill(); g.restore(); };
const drawMag = (p) => { const g = p.g; g.save(); g.translate(300, 480); g.beginPath(); g.arc(-30, -30, 110, 0, 7); g.fillStyle = 'rgba(190,230,255,.55)'; g.fill(); g.lineWidth = 26; g.strokeStyle = INK; g.stroke();
  g.lineCap = 'round'; g.lineWidth = 46; g.beginPath(); g.moveTo(55, 55); g.lineTo(170, 170); g.stroke(); g.restore(); };

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const hearts = (pos, f0, n = 3) => { for (let k = 0; k < n; k++) { const t = ((f - f0 + k * 9) % 27) / 27; out.push(FX('h' + k + q(t, 2), drawHeart, [pos[0] + (k - 1) * 0.22, pos[1] + t * 0.7, pos[2] + 0.2], 0.12, { alpha: q(1 - t, 2) })); } };
  if (S.id === 'hook') {
    if (f >= 46 && f < 72) out.push(FX('al', (p) => T.fxBang(p), L3([CARP[0] + 0.3, 2.3, CARP[2] + 1.0]), q(0.3 * M.back(ramp(f, 46, 52), 2.5), 2)));
    if (f >= 150) hearts(L3([DH[0], 0.9, DH[2]]), 150);
  }
  if (S.id === 'piada') hearts(L3([DH[0], 0.9, DH[2]]), 150, 2);
  if (S.id === 'aves') for (let i = 0; i < 7; i++) { if (f < 418 + i * 3) continue; const t = (f - 418 - i * 3) / 60; out.push(FX('g' + i + (Math.floor(f / 5) % 2), (p) => T.fxGull(p, Math.floor(f / 5 + i) % 2), N3([-7 + i * 1.6 + t * 3, 3.2 + (i % 3) * 0.7 + t * 0.6, -6 - (i % 2) * 2]), 0.35)); }
  if (S.id === 'mamif' && f >= 481) {
    for (const [i, [d, x, z, s]] of [[drawDeer, 6.7, 0.5, 1.1], [drawRaccoon, 5.1, 1.7, 0.6], [drawRabbit, 6.1, 2.2, 0.45]].entries()) out.push(FX('m' + i + pop(f, 481 + i * 4), d, N3([x, s * 1.125 * pop(f, 481 + i * 4) + 0.02, z]), s * Math.max(0.001, pop(f, 481 + i * 4)), { blob: true, shadow: true, order: 2 }));
  }
  if (S.id === 'beira') {
    if (f >= 517 && f < 545) { const t = (f - 517) / 28; out.push(FX('fi' + q(t, 2), (p) => T.fxFish(p, Math.floor(f / 4) % 2), N3([-3.6 + t * 1.4, 0.2 + Math.sin(Math.PI * t) * 1.4, -2.6]), 0.45, { roll: q(-1.2 + t * 2.4, 2) })); }
    if (f >= 517 && f < 552) { const t = q((f - 517) / 35, 2); out.push(FX('sp' + t, (p) => T.fxSplash(p, t), N3([-3.0, 0.15, -2.4]), 0.6, { alpha: 0.9 })); }
    if (f >= 540) { const k = pop(f, 540, 6, 2.6); out.push(FX('ig' + k, drawIguana, N3([ROCK[0], 0.42 + 0.5 * 1.125 * k, ROCK[2]]), 0.5 * Math.max(0.001, k), { order: 2 })); }
  }
  if (S.id === 'opcoes') {
    if (f >= 722 && f < 758) hearts(L3([DH[0], 0.85, DH[2]]), 722);
    if (f >= 758 && f < 776) out.push(FX('br', (p) => T.fxBang(p), L3([DH[0] - 0.25, 1.05, DH[2] + 0.2]), q(0.16 * M.back(ramp(f, 758, 763), 2.5), 2)));
    if (f >= 793) { const k = pop(f, 793, 6, 2.5); out.push(FX('mg' + k, drawMag, L3([DH[0] + 0.05, 0.62 + 0.25 * 1.125 * k, DH[2] + 0.3]), 0.25 * Math.max(0.001, k))); }
  }
  if (S.id === 'album' && f >= 983 && f < 1006) { const t = q((f - 983) / 23, 2); out.push(FX('ab' + t, (p) => T.fxBurst(p, t, '#ffe28a', 12), B3([0, 3.0, 0.3]), 1.2, { order: 1 })); }
  if (S.id === 'estudar' && f >= 940 && f < 962) { const t = q((f - 940) / 22, 2); out.push(FX('lg' + t, (p) => T.fxSpark(p, t), B3([ALX(680), ALY(860) + 0.2, 0.3]), 0.7)); }
  if (S.id === 'trancada') {
    if (f >= 1250 && f < 1270) out.push(FX('lk', (p) => T.fxBang(p), C3([7.3, 2.25, 0.6]), q(0.22 * M.back(ramp(f, 1250, 1255), 2.5), 2)));
    if (f >= 1318) { const k = pop(f, 1318, 6, 2.6); out.push(FX('qm' + k, (p) => T.fxQuestion(p), C3([8.4, 2.6, -1.8]), 0.3 * Math.max(0.001, k))); }
  }
  if (S.id === 'mod' && f >= 1429 && f < 1452) { const t = q((f - 1429) / 23, 2); out.push(FX('ms' + t, (p) => T.fxSpark(p, t), R3([DESK[0], 1.45, DESK[2] + 0.2]), 0.4)); }
  if (S.id === 'crime' && f >= 1768 && f < 1786) out.push(FX('cb', (p) => T.fxBang(p), L3([CARP[0] + 0.3, 2.3, CARP[2] + 1.0]), q(0.3 * M.back(ramp(f, 1768, 1773), 2.5), 2)));
  if (S.id === 'final') {
    if (f >= 1854 && f < 1872) { const k = pop(f, 1854, 5, 2.6); out.push(FX('toc' + k, word('TOC TOC', '#ffd23f', 150), L3([0.2, 2.35, -4.0]), 0.5 * Math.max(0.001, k))); }
    if (f >= 1915) hearts(L3([-0.2, 0.9, -3.45]), 1915);
  }
  return out;
};

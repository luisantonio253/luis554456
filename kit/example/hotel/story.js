// "O vazamento do Fire Stick" — timed to voice.mp3 (55.36 s, 1661 frames @ 30 fps). See work/PLAN.md.
import { M, camFromKeys, idle, blinkAt, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 1661;
export const HO = [0, 0, 0], CI = [600, 0, 0], HX = [-600, 0, 0], RK = [0, 0, -600], PL = [0, 0, 600];
export const SHOTS = [
  { id: 'hook', a: 0, b: 150, light: 'room' },
  { id: 'date', a: 151, b: 212, light: 'street' },
  { id: 'caught', a: 213, b: 338, light: 'street' },
  { id: 'laptop', a: 339, b: 395, light: 'street' },
  { id: 'noint', a: 396, b: 449, light: 'street' },
  { id: 'hext', a: 450, b: 492, light: 'hext' },
  { id: 'wait', a: 493, b: 531, light: 'room' },
  { id: 'lie', a: 532, b: 576, light: 'room' },
  { id: 'tv', a: 577, b: 643, light: 'room' },
  { id: 'stick', a: 644, b: 701, light: 'room' },
  { id: 'serie', a: 702, b: 764, light: 'room' },
  { id: 'buy', a: 765, b: 867, light: 'room' },
  { id: 'make', a: 868, b: 943, light: 'room' },
  { id: 'enter', a: 944, b: 1016, light: 'fort' },
  { id: 'clips', a: 1017, b: 1150, light: 'fort' },
  { id: 'views', a: 1151, b: 1271, light: 'plaza' },
  { id: 'confirm', a: 1272, b: 1363, light: 'fort' },
  { id: 'code', a: 1364, b: 1444, light: 'room' },
  { id: 'secur', a: 1445, b: 1520, light: 'fort' },
  { id: 'desk', a: 1521, b: 1575, light: 'room' },
  { id: 'payoff', a: 1576, b: 1660, light: 'room' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const FR = { H: HO, C: CI, X: HX, K: RK, P: PL };
const H3 = (p) => add3(HO, p), C3 = (p) => add3(CI, p), X3 = (p) => add3(HX, p), K3 = (p) => add3(RK, p), P3 = (p) => add3(PL, p);

// ---------- layout (set-local) ----------
const TVC = [0.9, 1.5, -2.9], FS = [1.5, 1.0, -2.84], REM = [-1.75, 0.645, -1.15], KID = [-0.55, 0, -1.0];
const DESK = [2.6, 0, -2.55], CALW = [-0.6, 2.75, -3.0];
const ITEMS = { bag: [-2.95, 0.62, -2.45], ph: [-2.85, 0.65, -1.6], kb: [-2.25, 0.65, -1.8], ms: [-1.7, 0.65, -1.6] };
const KIDS = [0, 0, -4], COP1 = [1.3, 0, -4.3], COP2 = [-1.3, 0, -4.3], CAR = [-3.4, 0, -6.6];
const BILL = [4.6, 4.2, -1], NOINT = [-2.4, 1.9, -1.5], TOWX = [-6.5, 0, 6.5];
const WINX = [3.5, 10.29, 0];
const GATE = [0, 3.0, 0], CNTS = [-4.6, 3.0, 0], COMM = [8, 5, 0];
const G1 = [-4.2, 0, 2.6], G2 = [4.2, 0, 2.6];
const BYS = [[-1.7, 0, 5], [0.1, 0, 5.8], [1.8, 0, 5]];
export const LAY = { TVC, FS, REM, KID, DESK, CALW, ITEMS, CAR, BILL, NOINT, TOWX, WINX, GATE, CNTS, COMM };

// ---------- TV / room light ----------
export const tvMode = (f) => (f < 151 ? 'up' : f < 702 ? 'off' : f < 919 ? 'menu' : f < 1364 ? 'term' : f < 1445 ? 'code' : 'term');

// ---------- lights ----------
export const LIGHTS = {
  room: { az: 60, el: 40, sky: '#7f8fd0', ground: '#3a3050', hemi: 1.0, sun: '#9fb0ff', sunI: 0.85, fog: '#1a2048', fogNear: 120, fogFar: 500,
    skyTop: '#0c1030', skyHor: '#2a3470', sat: 1.08, gain: '#eef2ff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.42, shadowExt: 7, lamp: 6, lampAt: H3([0.9, 1.6, -1.6]), lampCol: '#bfd4ff', cloud: '#30385a' },
  street: { az: 80, el: 35, sky: '#8a90d0', ground: '#3a3050', hemi: 1.1, sun: '#9fb0ff', sunI: 0.8, fog: '#1c2050', fogNear: 60, fogFar: 450,
    skyTop: '#0a0e2a', skyHor: '#3a3a7a', sat: 1.12, gain: '#eef0ff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.38, shadowExt: 16, lamp: 9, lampAt: C3([-2.6, 2.6, -4.6]), cloud: '#3a3a6a' },
  hext: { az: 70, el: 30, sky: '#8a90d0', ground: '#3a3050', hemi: 1.15, sun: '#a8b4ff', sunI: 0.9, fog: '#1c2050', fogNear: 80, fogFar: 450,
    skyTop: '#0a0e2a', skyHor: '#3a3a7a', sat: 1.12, gain: '#eef0ff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.36, shadowExt: 24, lamp: 7, lampAt: X3([0, 4, 6]), lampCol: '#ffd6a0', cloud: '#3a3a6a' },
  fort: { az: 75, el: 32, sky: '#8a96d8', ground: '#3a3050', hemi: 1.15, sun: '#b0bcff', sunI: 1.0, fog: '#1a1e48', fogNear: 80, fogFar: 450,
    skyTop: '#080c26', skyHor: '#34386e', sat: 1.12, gain: '#eef0ff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.36, shadowExt: 26, lamp: 10, lampAt: K3([0, 7, 7]), lampCol: '#d8e4ff', cloud: '#30385a' },
  plaza: { az: 70, el: 35, sky: '#8a90d0', ground: '#3a3050', hemi: 1.2, sun: '#a8b4ff', sunI: 0.9, fog: '#1c2050', fogNear: 80, fogFar: 450,
    skyTop: '#0a0e2a', skyHor: '#3a3a7a', sat: 1.12, gain: '#eef0ff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.34, shadowExt: 16, lamp: 8, lampAt: P3([0, 5, 6]), lampCol: '#c8d8ff', cloud: '#3a3a6a' },
};
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.light === 'room') {
    const m = tvMode(f);
    if (m === 'up' || m === 'term' || m === 'code') { L.lampCol = '#7affa8'; L.lamp = 4.5; }
    else if (m === 'menu') { L.lampCol = '#a8c8ff'; L.lamp = 6.5; }
    else { L.lampCol = '#8a9ad8'; L.lamp = 2.5; L.hemi = 1.15; }
    if (f >= 919 && f < 925) L.lamp = 11;
  }
  if (S.light === 'street') L.lampCol = Math.floor(f / 5) % 2 ? '#ff3a3a' : '#3a6aff';
  if (S.light === 'fort' && f >= 1472 && f < 1521) L.lampCol = Math.floor(f / 6) % 2 ? '#ff6a6a' : '#d8e4ff';
  return L;
};

// ---------- cameras ----------
const tvFront = (d, dx = 0, dy = 0) => [TVC[0] + dx, TVC[1] + dy, TVC[2] + d];
const payDir = (() => { const d = [TVC[0] - REM[0], TVC[1] - REM[1], TVC[2] - REM[2]], l = Math.hypot(...d); return d.map((v) => v / l); })();
const behindRem = (k, up) => [REM[0] - payDir[0] * k, REM[1] - payDir[1] * k + up, REM[2] - payDir[2] * k];
const REML = [REM[0] + payDir[0] * 0.12, REM[1] + 0.04, REM[2] + payDir[2] * 0.12];
const CAMS = {
  hook: { fr: 'H', K: [
    { f: 0, pos: [1.05, 1.42, 0.75], look: [0.98, 1.36, -2.9], fov: 44 },
    { f: 98, pos: [1.0, 1.43, 0.5], look: [0.98, 1.36, -2.9], fov: 44 },
    { f: 138, pos: [-0.2, 2.0, 4.6], look: [-0.25, 1.3, -1.6], fov: 52 },
    { f: 150, pos: [-0.22, 2.0, 4.45], look: [-0.25, 1.3, -1.6], fov: 52 } ], kicks: [{ f: 122, a: 0.012 }] },
  date: { fr: 'C', K: [
    { f: 151, pos: [4.5, 3.7, 9.0], look: [4.6, 4.2, -1], fov: 46 },
    { f: 212, pos: [4.4, 3.65, 8.3], look: [4.6, 4.2, -1], fov: 46 } ], kicks: [{ f: 175, a: 0.012 }] },
  caught: { fr: 'C', K: [
    { f: 213, pos: [0.6, 1.75, 3.6], look: [0, 1.3, -4], fov: 48 },
    { f: 282, pos: [0.3, 1.7, 3.0], look: [0, 1.3, -4], fov: 48 },
    { f: 302, pos: [0, 1.6, 6.5], look: [0, 8, -30], fov: 46, ease: 'easeOut' },
    { f: 338, pos: [0, 1.62, 6.0], look: [0, 8.2, -30], fov: 46 } ], kicks: [{ f: 289, a: 0.01 }, { f: 303, a: 0.01 }, { f: 313, a: 0.012 }] },
  laptop: { fr: 'C', K: [
    { f: 339, pos: [0.7, 1.6, 1.2], look: [0.6, 1.3, -4.2], fov: 50 },
    { f: 395, pos: [1.4, 1.6, 1.0], look: [1.4, 1.3, -4.3], fov: 50 } ], kicks: [{ f: 353, a: 0.01 }] },
  noint: { fr: 'C', K: [
    { f: 396, pos: [-1.6, 1.95, 4.0], look: [-2.35, 1.85, -1.5], fov: 46 },
    { f: 449, pos: [-1.75, 1.92, 3.4], look: [-2.38, 1.86, -1.5], fov: 46 } ], kicks: [{ f: 426, a: 0.012 }, { f: 431, a: 0.012 }] },
  hext: { fr: 'X', K: [
    { f: 450, pos: [0, 1.6, 23], look: [0, 8.5, 0], fov: 50 },
    { f: 466, pos: [0.3, 2.0, 21], look: [0.3, 8.7, 0], fov: 50 },
    { f: 492, pos: [3.1, 9.7, 6.2], look: [3.5, 10.3, 0], fov: 44 } ], kicks: [{ f: 481, a: 0.01 }] },
  wait: { fr: 'H', K: [
    { f: 493, pos: [-0.5, 1.85, 2.2], look: [-0.58, 1.95, -3], fov: 46 },
    { f: 531, pos: [-0.52, 1.88, 1.8], look: [-0.58, 1.95, -3], fov: 46 } ] },
  lie: { fr: 'H', K: [
    { f: 532, pos: [-2.3, 4.0, -0.95], look: [-2.3, 0.6, -1.95], fov: 46 },
    { f: 576, pos: [-2.3, 3.6, -1.05], look: [-2.3, 0.6, -1.95], fov: 46 } ] },
  tv: { fr: 'H', K: [
    { f: 577, pos: [-0.3, 1.9, 4.4], look: [0.15, 1.35, -1.5], fov: 50 },
    { f: 618, pos: [-0.25, 1.88, 4.0], look: [0.15, 1.35, -1.5], fov: 50 },
    { f: 619, pos: tvFront(3.7, 0.15, -0.05), look: TVC, fov: 46 },
    { f: 643, pos: tvFront(3.35, 0.15, -0.05), look: TVC, fov: 46 } ], kicks: [{ f: 600, a: 0.01 }] },
  stick: { fr: 'H', K: [
    { f: 644, pos: tvFront(3.3, 0.15, -0.05), look: TVC, fov: 46 },
    { f: 662, pos: tvFront(3.0, 0.2, -0.08), look: [1.05, 1.4, -2.9], fov: 46 },
    { f: 678, pos: [1.42, 1.08, -1.85], look: [1.5, 1.0, -2.86], fov: 40, ease: 'easeOut' },
    { f: 701, pos: [1.41, 1.08, -1.95], look: [1.5, 1.0, -2.86], fov: 40 } ], kicks: [{ f: 682, a: 0.01 }] },
  serie: { fr: 'H', K: [
    { f: 702, pos: [1.41, 1.08, -1.95], look: [1.5, 1.0, -2.86], fov: 40 },
    { f: 730, pos: [-0.25, 1.85, 4.0], look: [0.15, 1.35, -1.6], fov: 50 },
    { f: 764, pos: [-0.2, 1.84, 3.7], look: [0.15, 1.35, -1.6], fov: 50 } ] },
  buy: { fr: 'H', K: [
    { f: 765, pos: [-2.25, 3.3, 0.2], look: [-2.28, 0.6, -1.75], fov: 46 },
    { f: 867, pos: [-2.25, 3.0, 0.0], look: [-2.28, 0.6, -1.8], fov: 46 } ], kicks: [{ f: 795, a: 0.008 }, { f: 825, a: 0.008 }, { f: 849, a: 0.008 }] },
  make: { fr: 'H', K: [
    { f: 868, pos: [-0.3, 1.8, 4.1], look: [0.15, 1.35, -1.6], fov: 50 },
    { f: 943, pos: [-0.12, 1.7, 3.3], look: [0.2, 1.38, -1.6], fov: 50 } ], kicks: [{ f: 919, a: 0.02 }] },
  enter: { fr: 'K', K: [
    { f: 944, pos: [0, 2.3, 32], look: [0, 5, 0], fov: 50 },
    { f: 994, pos: [0, 2.0, 18], look: [0, 4.2, 0], fov: 50 },
    { f: 1016, pos: [0, 1.95, 16.5], look: [-0.4, 4.6, 0], fov: 52 } ], kicks: [{ f: 994, a: 0.015 }] },
  clips: { fr: 'K', K: [
    { f: 1017, pos: [0, 1.95, 16.5], look: [-0.4, 4.6, 0], fov: 52 },
    { f: 1050, pos: [-1.2, 1.7, 16], look: [-1.5, 6.0, 0], fov: 58 },
    { f: 1150, pos: [-1.2, 1.6, 15], look: [-1.5, 6.8, 0], fov: 58 } ], kicks: [{ f: 1128, a: 0.02 }] },
  views: { fr: 'P', K: [
    { f: 1151, pos: [0, 4.25, 2.3], look: [0, 4.25, 0], fov: 44 },
    { f: 1180, pos: [0, 4.25, 2.0], look: [0, 4.25, 0], fov: 44 },
    { f: 1245, pos: [0, 3.4, 17.5], look: [0, 4.8, 0], fov: 50 },
    { f: 1271, pos: [0, 3.35, 16.8], look: [0, 4.8, 0], fov: 50 } ] },
  confirm: { fr: 'K', K: [
    { f: 1272, pos: [7.9, 4.8, 14.0], look: [8, 5, 0], fov: 46 },
    { f: 1363, pos: [7.85, 4.85, 12.6], look: [8, 5, 0], fov: 46 } ], kicks: [{ f: 1340, a: 0.025 }] },
  code: { fr: 'H', K: [
    { f: 1364, pos: [-0.3, 1.85, 4.3], look: [0.15, 1.38, -1.6], fov: 50 },
    { f: 1444, pos: [0.05, 1.62, 2.9], look: [0.3, 1.4, -1.6], fov: 50, roll: -3 } ], kicks: [{ f: 1396, a: 0.012 }] },
  secur: { fr: 'K', K: [
    { f: 1445, pos: [-3, 1.4, 22], look: [0, 5, 0], fov: 52 },
    { f: 1520, pos: [2, 7, 33], look: [0, 6, 0], fov: 60 } ], kicks: [{ f: 1472, a: 0.012 }] },
  desk: { fr: 'H', K: [
    { f: 1521, pos: [2.25, 1.85, -0.5], look: [2.6, 0.95, -2.55], fov: 46 },
    { f: 1575, pos: [2.2, 1.75, -0.75], look: [2.6, 0.92, -2.55], fov: 46 } ], kicks: [{ f: 1563, a: 0.012 }] },
  payoff: { fr: 'H', K: [
    { f: 1576, pos: behindRem(0.95, 0.62), look: REML, fov: 44 },
    { f: 1600, pos: behindRem(0.85, 0.56), look: REML, fov: 44 },
    { f: 1642, pos: behindRem(0.46, 0.32), look: REML, fov: 42, roll: 4, ease: 'easeIn' },
    { f: 1660, pos: behindRem(0.43, 0.3), look: REML, fov: 42, roll: 4 } ], kicks: [{ f: 1642, a: 0.03 }] },
};
const FLASH = [151, 450, 493, 944, 1151, 1272, 1364, 1445, 1521];
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  const o = FR[D.fr]; c.pos = add3(o, c.pos); c.look = add3(o, c.look);
  for (const a of FLASH) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, 0.9 * (1 - (f - a) / 6));
  const sa = { H: [0, 0, -1.5], C: [0, 0, -4], X: [0, 0, 0], K: [0, 0, 2], P: [0, 0, 3] }[D.fr];
  c.shadowAt = add3(o, sa);
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return f < 100 ? { focus: dist(C.pos, H3(TVC)), cinf: 4 } : { focus: dist(C.pos, H3([KID[0], 1.6, KID[2]])), cinf: lerp(4, 2, ramp(f, 100, 138)) };
    case 'caught': return f < 290 ? { focus: dist(C.pos, C3([0, 1.6, -4])), cinf: 4 } : { focus: 30, cinf: 0 };
    case 'laptop': return { focus: dist(C.pos, C3([1.5, 1.4, -4.4])), cinf: 4 };
    case 'wait': return { focus: dist(C.pos, H3([-0.55, 1.8, -1.6])), cinf: 4 };
    case 'tv': return f < 619 ? { focus: dist(C.pos, H3([KID[0], 1.6, KID[2]])), cinf: 4 } : { focus: dist(C.pos, H3(TVC)), cinf: 3 };
    case 'stick': return { focus: dist(C.pos, H3(FS)), cinf: f < 670 ? 3 : 7 };
    case 'serie': case 'make': case 'code': return { focus: dist(C.pos, H3([KID[0], 1.6, KID[2]])), cinf: 3 };
    case 'buy': return { focus: dist(C.pos, H3(ITEMS.kb)), cinf: 4 };
    case 'views': return f < 1190 ? { focus: dist(C.pos, P3([0, 4.25, 0])), cinf: 5 } : { focus: 15, cinf: 0 };
    case 'desk': return { focus: dist(C.pos, H3([2.6, 0.8, -2.55])), cinf: 5 };
    case 'payoff': return { focus: dist(C.pos, H3(REM)), cinf: 8, near: 0.6 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
const pop = (f, a, d = 7, s = 2.4) => (f < a ? 0 : q(M.back(ramp(f, a, a + d), s), 2));
export const tileScale = (f, i) => pop(f, 1153 + (((i + 46) * 37) % 78) * 1.15, 6, 2.2);
// leaked clips flying out of the vault gate
export const NCLIP = 22;
const CR = (() => { let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); return Array.from({ length: NCLIP }, (_, i) => ({ a: 1022 + i * 4.6, dx: (r() - 0.5) * 13, dy: 7 + r() * 9, dz: 2 + r() * 6, rot: (r() - 0.5) * 0.5 })); })();
export const clipAt = (f, i) => {
  const c = CR[i]; if (f < c.a) return null;
  let t = (f - c.a) / 55; if (f > 1128) t += (f - 1128) / 25;
  if (t > 1.6) return null;
  const e = 1 - Math.pow(1 - Math.min(t, 1), 2) + Math.max(0, t - 1);
  return { x: GATE[0] + c.dx * e, y: GATE[1] + c.dy * e - 0.6, z: 1.0 + c.dz * Math.min(e, 1) * 0.8, s: q(Math.min(1, t * 4), 2), rot: c.rot * e };
};
export const worldAt = (f) => {
  const W = {};
  const m = tvMode(f);
  W.tv = m === 'up' ? { m, p: q(clamp(0.18 + f / 175), 2), blink: Math.floor(f / 12) % 2 }
    : m === 'menu' ? { m, sel: Math.floor(clamp((f - 712) / 22, 0, 3)) }
    : m === 'term' ? { m, n: f < 1364 ? Math.min(7, Math.floor((f - 919) / 6)) : 7, blink: Math.floor(f / 12) % 2 }
    : m === 'code' ? { m, blink: Math.floor(f / 10) % 2, sc: Math.floor(f / 3) % 40 } : { m };
  W.flip = f >= 913 && f < 925 ? Math.max(0.03, q(Math.abs(Math.cos(Math.PI * ramp(f, 913, 925))), 2)) : 1;
  W.led = f < 151 || f >= 673 ? (f >= 1632 && f < 1650 ? Math.floor(f / 3) % 2 : 1) : 0;
  W.remHeld = (f >= 702 && f < 765) || (f >= 1364 && f < 1445);
  let it = { bag: pop(f, 780, 6), ph: pop(f, 795, 6), kb: pop(f, 825, 6), ms: pop(f, 849, 6), kbHeld: f >= 868 && f < 944 };
  if (f < 151 || f >= 944) it = { bag: 1, ph: 1, kb: 1, ms: 1, kbHeld: false };
  else if (f < 765) it = { bag: 0, ph: 0, kb: 0, ms: 0, kbHeld: false };
  W.items = it;
  W.cal = { xs: f < 493 ? 3 : Math.min(13, 3 + Math.floor((f - 493) / 3.5)) };
  W.tag = pop(f, 1556, 6, 2.5);
  // street
  W.bill = { a: pop(f, 154, 6), b: pop(f, 175, 6, 3) };
  W.inv = [pop(f, 289, 6, 3), pop(f, 303, 6, 3), pop(f, 313, 6, 3)];
  W.noint = pop(f, 424, 6, 2.5); W.nox = pop(f, 431, 5, 3);
  W.siren = Math.floor(f / 5) % 2;
  W.copX = q(lerp(COP1[0], 2.5, smooth(ramp(f, 362, 395))), 3);
  W.laptop = f >= 339 && f < 396 ? { up: q(smooth(ramp(f, 345, 356)), 2) } : null;
  // hotel exterior
  W.neon = f < 481 ? 0 : f < 492 ? ([1, 0, 1, 1, 0, 1][Math.floor((f - 481) / 2)] ?? 1) : 1;
  // fortress
  W.gate = f < 994 || f >= 1445 ? 0 : q(smooth(ramp(f, 994, 1012)), 2);
  W.gscr = f >= 990 && f < 1445 ? 'lib' : 'neg';
  W.lasers = !(f >= 994 && f < 1472);
  W.cnt = Math.round(90 * clamp((f - 1022) / (1120 - 1022)));
  W.clipsF = f;
  W.comm = { st: pop(f, 1340, 6, 3), lines: Math.min(4, Math.max(0, Math.floor((f - 1276) / 9))) };
  W.sweep = f;
  W.tilesF = f;
  return W;
};

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o) + (extra.s || '') + (extra.pitch || ''), draw: (p) => p && globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}, speed = 1) => { const i = idle(f * speed, seed); return { seed, blink: blinkAt(f, seed), tilt: q(i.tilt, 1), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };
const nod = (f, at, k = 0.025) => (f >= at && f < at + 8 ? -k * Math.sin(Math.PI * (f - at) / 8) : 0);
const hop = (f, a, k = 0.06) => (f >= a ? -k * Math.abs(Math.sin((f - a) * 0.45)) * Math.exp(-(f - a) / 30) : 0);
let outfitsSet = false;

export const actorsAt = (f, T) => {
  globalThis.__T = T;
  if (!outfitsSet) { Object.assign(T.OUTFITS, {
    kid: { tunic: '#5a6274', skin: '#f0c49a', hair: '#2b211c', stripes: '#454c5c' },
    cop: { tunic: '#22306a', skin: '#c99067', cap: '#141c40' },
    cop2: { tunic: '#22306a', skin: '#f0c8a0', cap: '#141c40', moustache: '#4a3020' },
    guard: { tunic: '#1a1a22', skin: '#ecd0b6', cap: '#101018', shades: true, stout: true },
    guard2: { tunic: '#1a1a22', skin: '#a8724e', hair: '#1e1714', shades: true },
    byA: { tunic: '#e2453c', skin: '#f5c9a0', hair: '#6a4126', dress: '#e07a9a' },
    byB: { tunic: '#2fd0c8', skin: '#c99067', hair: '#1e1714' },
    byC: { tunic: '#f2a93a', skin: '#ecd0b6', hair: '#3a2418', cap: '#3f7fd0' } }); outfitsSet = true; }
  const S = shotAt(f), out = [];
  const kidH = (o, p = KID) => out.push(R('kid', life(f, 7, o), H3(p)));
  switch (S.id) {
    case 'hook': kidH(f < 122 ? { expr: 'grin', L: 'cross', R: 'cross', look: 0.4 } : { expr: 'laugh', L: 'cross', R: 'cross', bob: q(hop(f, 122, 0.05), 3) }); break;
    case 'caught': case 'date': case 'laptop': {
      const sad = f >= 339;
      out.push(R('kid', life(f, 7, sad ? { expr: 'pained', L: 'reach', look: 0.5, headTilt: 6 } : { expr: 'nervous', L: 'hang', R: 'hang', look: 0.1 }), C3(KIDS)));
      const up = f >= 339 && f < 396;
      out.push(R('cop', life(f, 41, up ? { expr: 'stern', L: 'reach', R: 'reach', look: -0.2 } : { expr: 'stern', R: 'hip', L: 'hang' }), C3([up ? lerp(COP1[0], 2.5, smooth(ramp(f, 362, 395))) : COP1[0], 0, COP1[2]])));
      out.push(R('cop2', life(f, 43, { expr: 'stern', L: 'hip', R: 'cross' }), C3(COP2)));
      break;
    }
    case 'wait': kidH({ expr: 'dazed', L: 'hang', R: 'hang', look: -0.2, bob: q(-0.015 * Math.abs(Math.sin(f * 0.35)), 3) }, [-0.55, 0, -1.6]); break;
    case 'lie': out.push(R('kid', life(f, 7, { expr: 'dazed', L: 'hang', R: 'hang' }), H3([-2.3, 0.66, -0.78]), { pitch: -Math.PI / 2, yawAbs: 0, blob: false, s: 0.95 })); break;
    case 'tv': kidH(f < 598 ? { expr: 'neutral', look: 0.6 } : f < 618 ? { expr: 'shock', look: 0.7, bob: q(hop(f, 598), 3) } : { expr: 'grin', R: 'point', look: 0.7 }); break;
    case 'serie': kidH({ expr: f < 740 ? 'whistle' : 'grin', L: 'reach', R: 'reach', look: 0.5 }); break;
    case 'make': kidH(f < 919 ? { expr: 'squint', L: 'reach', R: 'reach', look: 0.4 } : { expr: 'grin', L: 'reach', R: 'reach', look: 0.2, bob: q(hop(f, 919, 0.06), 3) }); break;
    case 'code': kidH({ expr: f < 1396 ? 'grin' : 'stubborn', L: 'reach', R: 'reach', look: 0.3, headTilt: -4, bob: q(nod(f, 1396, 0.04), 3) }); break;
    case 'enter': case 'clips': case 'secur': case 'confirm': {
      const alarm = f >= 1472 && S.id === 'secur', wow = f >= 994 && f < 1130;
      out.push(R('guard', life(f, 51, alarm ? { expr: 'stern', L: 'hip', R: 'point' } : wow ? { expr: 'shock', L: 'cheek', R: 'cheek', bob: q(hop(f, 996), 3) } : { expr: 'stern', L: 'cross', R: 'cross' }), K3(G1)));
      out.push(R('guard2', life(f, 53, alarm ? { expr: 'stern', L: 'cross', R: 'cross' } : wow ? { expr: 'shock', L: 'up', R: 'up', bob: q(hop(f, 998), 3) } : { expr: 'stern', L: 'hip', R: 'hip' }), K3(G2)));
      break;
    }
    case 'views': ['byA', 'byB', 'byC'].forEach((w, i) => out.push(R(w, life(f, 61 + i, { expr: ['grin', 'shock', 'laugh'][i], L: 'reach', R: 'reach' }), P3(BYS[i])))); break;
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
const drawNoPC = (p) => { const g = p.g; g.save(); g.translate(300, 520); g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = '#d7e2ea'; g.strokeStyle = INK; g.lineWidth = 14;
  g.beginPath(); g.roundRect(-160, -170, 320, 210, 18); g.fill(); g.stroke(); g.fillStyle = '#3a4a6a'; g.fillRect(-130, -142, 260, 156);
  g.fillStyle = '#d7e2ea'; g.beginPath(); g.moveTo(-200, 40); g.lineTo(200, 40); g.lineTo(230, 90); g.lineTo(-230, 90); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = '#e0283a'; g.lineWidth = 34; g.beginPath(); g.moveTo(-230, -200); g.lineTo(230, 120); g.moveTo(230, -200); g.lineTo(-230, 120); g.stroke(); g.restore(); };
const phoneAt = (pos, f, seed) => FX('ph', drawPhone, [pos[0], pos[1] + 1.62 + 0.01 * Math.sin(f * 0.2 + seed), pos[2] + 0.28], 0.2);

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' && f >= 122) out.push(FX('npc', drawNoPC, H3([KID[0] + 0.85, 2.45, KID[2] + 0.3]), q(0.45 * M.back(ramp(f, 122, 129), 2.5), 2)));
  if (S.id === 'caught' && f >= 279 && f < 296) out.push(FX('cb', (p) => T.fxBang(p), C3([KIDS[0] + 0.4, 2.5, KIDS[2] + 0.3]), q(0.28 * M.back(ramp(f, 279, 284), 2.5), 2)));
  if (S.id === 'stick' && f >= 682 && f < 700) { const t = q((f - 682) / 18, 2); out.push(FX('sp' + t, (p) => T.fxSpark(p, t), H3([FS[0], FS[1] + 0.02, FS[2] + 0.08]), 0.09, { order: 6 })); }
  if (S.id === 'make' && f >= 919 && f < 940) { const t = q((f - 919) / 21, 2); out.push(FX('mk' + t, (p) => T.fxSpark(p, t), H3([TVC[0], TVC[1] - 0.1, TVC[2] + 0.15]), 0.55, { order: 6 })); }
  if (S.id === 'enter' && f >= 994 && f < 1012) { const t = q((f - 994) / 18, 2); out.push(FX('gb' + t, (p) => T.fxBurst(p, t, '#7dff9a', 12), K3([0, 3.2, 1.2]), 1.2, { order: 1 })); }
  if (S.id === 'clips' && f >= 1128 && f < 1148) { const t = q((f - 1128) / 20, 2); out.push(FX('cl' + t, (p) => T.fxBurst(p, t, '#ffe28a', 14), K3([-0.8, 9.5, 3]), 2.2, { order: 1 })); }
  if (S.id === 'views') BYS.forEach((b, i) => out.push(phoneAt(P3(b), f, i)));
  if (S.id === 'code' && f >= 1396 && f < 1412) out.push(FX('cd', (p) => T.fxBang(p), H3([KID[0] + 0.55, 2.3, KID[2] + 0.3]), q(0.24 * M.back(ramp(f, 1396, 1401), 2.5), 2)));
  if (S.id === 'secur' && f >= 1472 && f < 1490) out.push(FX('al', (p) => T.fxBang(p), K3([G1[0] + 0.5, 2.6, G1[2] + 0.3]), q(0.32 * M.back(ramp(f, 1472, 1477), 2.5), 2)));
  if (S.id === 'payoff' && f >= 1642 && f < 1660) { const t = q((f - 1642) / 18, 2); out.push(FX('rs' + t, (p) => T.fxSpark(p, t), H3([REM[0] + 0.07, REM[1] + 0.03, REM[2] - 0.02]), 0.03, { order: 6 })); }
  return out;
};

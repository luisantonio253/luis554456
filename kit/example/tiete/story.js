// Shot plan for "O rio que foge do mar" (Tietê) — timed to voice.mp3 (35.84 s, 1075 frames @ 30 fps).
// Word frames: praia 84 | E foge 102-131 | Lá 143 Serra 169 | água 201 cheiro 244 oceano 262 | Qualquer 294 desceria 311 Atlântico 361 |
// Tietê 394 meia-volta 414 atravessa 450 interior 510 | mais 535 mil 547 quilômetros 559-583 | Só que 597 muro 634 | mar 669 paredão 688 |
// dentro 726 rampa 748 suave 763 | Descendo 780 teimoso 821 canoa 845 | paulistas 871 ouro 914 Cuiabá 925 | O rio que 955 praia 983 levou 998 São Paulo 1008 meio 1040 Brasil 1055
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 1075;
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ---------- the terrain (shared by main.js) ----------
export const TOP = 34, SZ = 12;           // plateau height at the crest, z of the source
export const crestZ = (x) => 12 + 5 * Math.sin(x * 0.021) + 3 * Math.sin(x * 0.057 + 1);
export const xr = (z) => { const s = Math.max(0, SZ - z); return 0.12 * s + 14 * Math.sin(s * 0.011); }; // river centreline x(z), z <= SZ
export const rvW = (z) => 4.5 + Math.min(6, Math.max(0, SZ - z) * 0.01);
export const rvHalf = (z) => 0.35 + Math.min(2.6, Math.max(0, SZ - z) * 0.03);
const hills = (x, z) => 3 * Math.sin(x * 0.031 + z * 0.017) * Math.sin(z * 0.023 - x * 0.011) + 1.5 * Math.sin(x * 0.07 + 2) * Math.sin(z * 0.05);
export const H = (x, z) => {
  const zc = crestZ(x), ze = zc + 2, zs = zc + 26;
  if (z >= zs) return 0.6 - Math.min(3.6, (z - zs) * 0.6);
  if (z >= ze) { const t = (z - ze) / (zs - ze); return 0.6 + (TOP - 0.6) * Math.pow(1 - t, 1.25); }
  const s = ze - z;
  let h = TOP - 0.03 * s + hills(x, z) * clamp(s / 30);
  h += 7 * (0.5 - 0.5 * Math.cos(x * 0.09)) * Math.exp(-(((z - zc + 3) / 6) ** 2)); // crest peaks (gap at x = 0)
  const d = z > SZ ? Math.hypot(x, z - SZ) : Math.abs(x - xr(z));
  if (z < SZ) h -= 2.2 * clamp((SZ - z) / 14) * Math.exp(-((d / rvW(z)) ** 2));
  h -= 0.5 * Math.exp(-((Math.hypot(x, z - SZ) / 2.5) ** 2)); // source hollow
  return h;
};
export const RY = (z) => H(xr(z), z) + 0.55;  // river surface
export const zSea = (x) => crestZ(x) + 26;
export const SRCY = H(0, SZ) + 0.25;           // the spring's water level
export const DO = [0, 0, 5000];                 // cut-away diorama (local frame 'D')
export const dTop = (x) => (x >= 24 ? 0.6 : x >= 0 ? 0.6 + (TOP - 0.6) * Math.pow(1 - x / 24, 1.25) : TOP + 0.12 * x);

// ---------- shots ----------
export const SHOTS = [
  { id: 'hook', a: 0, b: 140, light: 'day' },
  { id: 'serra', a: 141, b: 288, light: 'day' },
  { id: 'normal', a: 289, b: 389, light: 'day' },
  { id: 'uturn', a: 390, b: 534, light: 'day' },
  { id: 'km', a: 535, b: 596, light: 'day' },
  { id: 'wall', a: 597, b: 779, light: 'night' },
  { id: 'canoe', a: 780, b: 954, light: 'morning' },
  { id: 'payoff', a: 955, b: 1074, light: 'day' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

// ---------- people & props positions ----------
const G0 = (x, z) => [x, H(x, z), z];
export const HIKER = G0(1.35, SZ + 0.9);
export const KMZ = -260, KMX = () => xr(KMZ) + 4.6;
export const SIGN = () => G0(KMX(), KMZ);
// canoe: travels downstream along the centreline
export const canoeZ = (f) => -118 - (f - 780) * 0.075;
export const canoeAt = (f) => {
  const z = canoeZ(f), x = xr(z), dx = xr(z - 1) - x, L = Math.hypot(dx, 1);
  return { pos: [x, RY(z) - 0.12 + 0.03 * Math.sin(f * 0.21), z], fwd: [dx / L, -1 / L], yaw: Math.atan2(-dx, 1), roll: 0.025 * Math.sin(f * 0.13) };
};
const K_ = (f, p) => { const c = canoeAt(f), [fx, fz] = c.fwd, rx_ = -fz, rz = fx; // local: x = right of travel, z = backwards
  return [c.pos[0] + p[0] * rx_ - p[2] * fx, c.pos[1] + p[1], c.pos[2] + p[0] * rz - p[2] * fz]; };
export const canoeLocal = K_;

// ---------- lights ----------
export const LIGHTS = {
  day: { az: 100, el: 48, sky: '#c8e2ff', ground: '#8a8a5a', hemi: 1.2, sun: '#fff3de', sunI: 2.5, fog: '#cfe4f4', fogNear: 160, fogFar: 1350,
    skyTop: '#2f86e0', skyHor: '#cde8fb', sat: 1.12, waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.2, shadowExt: 16 },
  morning: { az: 60, el: 20, sky: '#c9d4f2', ground: '#8a7458', hemi: 1.15, sun: '#ffd49a', sunI: 2.7, fog: '#f2d4b0', fogNear: 120, fogFar: 1100,
    skyTop: '#4f86d0', skyHor: '#ffd9a8', sunDisc: '#fff2d0', sunSize: 0.004, sat: 1.12, gain: '#fff6e8', waterDeep: '#2a6a7e', waterShal: '#6fb0a4', glint: '#fff0d0', vig: 0.24, shadowExt: 14 },
  night: { az: 80, el: 32, sky: '#8a9ad8', ground: '#3a3a5a', hemi: 1.45, sun: '#dfe6ff', sunI: 2.3, fog: '#1c2448', fogNear: 300, fogFar: 2000,
    skyTop: '#0b1230', skyHor: '#2c3a72', sat: 1.05, gain: '#e4eaff', waterDeep: '#1a3a70', waterShal: '#3a64a0', glint: '#b8c8ff', vig: 0.3, shadowExt: 60 },
};
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  const ext = { hook: 12, serra: 70, normal: 70, uturn: f < 440 ? 70 : 220, km: 12, wall: 60, canoe: 14, payoff: f < 1000 ? 12 : 220 };
  L.shadowExt = ext[S.id];
  return L;
};

// ---------- cameras ----------
// frames: 'W' world, 'D' diorama, 'K' canoe-local
const HX = HIKER;
const CAMS = {
  hook: { fr: 'W', K: [
    { f: 0, pos: [HX[0] - 0.7, HX[1] + 1.8, HX[2] - 4.3], look: [HX[0] + 0.15, HX[1] + 1.1, HX[2] + 8], fov: 36 },
    { f: 98, pos: [HX[0] - 0.6, HX[1] + 1.8, HX[2] - 3.7], look: [HX[0] + 0.15, HX[1] + 1.15, HX[2] + 8], fov: 34 },
    { f: 101, pos: [HX[0] - 0.55, HX[1] + 1.8, HX[2] - 3.6], look: [HX[0] + 0.15, HX[1] + 1.15, HX[2] + 8], fov: 34 },
    { f: 102, pos: [HX[0] + 0.3, HX[1] + 1.9, HX[2] + 3.6], look: [HX[0] + 0.6, HX[1] + 0.2, SZ - 10], fov: 44 },
    { f: 140, pos: [HX[0] + 0.4, HX[1] + 2.6, HX[2] + 4.6], look: [HX[0] + 1.2, HX[1] - 0.6, SZ - 14], fov: 46 } ], kicks: [{ f: 104, a: 0.02 }] },
  serra: { fr: 'W', K: [
    { f: 141, pos: [16, 6, 150], look: [0, 20, 14], fov: 46 },
    { f: 288, pos: [3.5, HX[1] + 9, SZ + 30], look: [0.8, HX[1] + 0.8, SZ], fov: 38, path: [[11, 20, 95], [6, HX[1] + 4, SZ + 52]] } ] },
  normal: { fr: 'W', K: [
    { f: 289, pos: [0, 26, 120], look: [0, 17, 22], fov: 44 },
    { f: 389, pos: [0, 23, 102], look: [0, 17, 22], fov: 44 } ], kicks: [{ f: 361, a: 0.025 }] },
  uturn: { fr: 'W', K: [
    { f: 390, pos: [0, 23, 102], look: [0, 17, 22], fov: 44 },
    { f: 436, pos: [0, 50, 92], look: [0, 30, 10], fov: 46 },
    { f: 534, pos: [-4, 150, 78], look: [30, 4, -330], fov: 50, path: [[0, 105, 96]] } ] },
  km: { fr: 'W', K: [
    { f: 535, pos: [KMX() + 7.0, H(KMX(), KMZ) + 1.75, KMZ + 5.6], look: [KMX() + 0.6, H(KMX(), KMZ) + 1.3, KMZ - 0.8], fov: 43 },
    { f: 596, pos: [KMX() + 6.4, H(KMX(), KMZ) + 1.65, KMZ + 5.0], look: [KMX() + 0.6, H(KMX(), KMZ) + 1.3, KMZ - 0.8], fov: 41 } ], kicks: [{ f: 583, a: 0.02 }] },
  wall: { fr: 'D', K: [
    { f: 597, pos: [6, 12, 118], look: [6, 14, 7], fov: 48 },
    { f: 648, pos: [9, 14, 96], look: [9, 15, 7], fov: 48 },
    { f: 668, pos: [32.5, 1.5, 22], look: [25.5, 4.2, 10], fov: 56 },
    { f: 704, pos: [32, 1.4, 20.5], look: [25.5, 4.8, 10], fov: 54 },
    { f: 732, pos: [-15, 40, 33], look: [-17, 29, 11], fov: 44, path: [[18, 28, 40]] },
    { f: 779, pos: [-54, 35.5, 33], look: [-56, 25, 11], fov: 44 } ], kicks: [{ f: 634, a: 0.02 }, { f: 688, a: 0.045 }] },
  canoe: { fr: 'K', K: [
    { f: 780, pos: [5.6, 1.9, 2.2], look: [0, 1.2, -0.4], fov: 40 },
    { f: 866, pos: [4.6, 1.8, 0.6], look: [0, 1.25, -0.6], fov: 38 },
    { f: 914, pos: [3.9, 1.85, -1.4], look: [0, 1.45, -2.3], fov: 36 },
    { f: 954, pos: [3.7, 1.85, -1.5], look: [0, 1.5, -2.3], fov: 34 } ], kicks: [{ f: 916, a: 0.015 }] },
  payoff: { fr: 'W', K: [
    { f: 955, pos: [HX[0] - 0.7, HX[1] + 1.8, HX[2] - 4.3], look: [HX[0] + 0.15, HX[1] + 1.1, HX[2] + 8], fov: 36 },
    { f: 986, pos: [HX[0] - 0.4, HX[1] + 1.75, HX[2] - 2.6], look: [HX[0] + 0.15, HX[1] + 1.35, HX[2] + 8], fov: 30, roll: 4, ease: 'easeOut' },
        { f: 997, pos: [HX[0] - 0.38, HX[1] + 1.75, HX[2] - 2.5], look: [HX[0] + 0.15, HX[1] + 1.35, HX[2] + 8], fov: 30, roll: 3 },
    { f: 998, pos: [HX[0] - 0.5, HX[1] + 2.6, HX[2] + 4.2], look: [HX[0] + 1.0, HX[1] - 0.8, HX[2] - 30], fov: 44 },
    { f: 1050, pos: [-5, HX[1] + 60, SZ + 44], look: [14, HX[1] - 12, SZ - 170], fov: 50, path: [[-3, HX[1] + 12, SZ + 16]] },
    { f: 1074, pos: [-6, HX[1] + 100, SZ + 60], look: [40, 0, -520], fov: 52 } ] },
};
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  if (D.fr === 'D') { c.pos = add3(DO, c.pos); c.look = add3(DO, c.look); }
  if (D.fr === 'K') { c.pos = K_(f, c.pos); c.look = K_(f, c.look); }
  for (const [a, k] of [[597, 0.9], [780, 0.9], [955, 0.85]]) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, k * (1 - (f - a) / 6));
  const sa = { hook: HX, serra: [0, 20, 20], normal: [0, 16, 24], uturn: f < 440 ? [0, 16, 24] : [20, 20, -120], km: SIGN(), wall: add3(DO, [0, 20, 7]), canoe: canoeAt(f).pos, payoff: f < 1000 ? HX : [20, 20, -120] };
  c.shadowAt = sa[S.id];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const eye = add3(HIKER, [0, 1.6, 0]);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, eye), cinf: lerp(10, 0, smooth(ramp(f, 100, 126))) };
    case 'km': return { focus: dist(C.pos, add3(SIGN(), [0, 1.3, 0])), cinf: 8 };
    case 'canoe': return { focus: dist(C.pos, K_(f, f < 900 ? [0, 1.5, 0] : [0, 1.7, -2.0])), cinf: 7 };
    case 'payoff': return { focus: dist(C.pos, eye), cinf: f < 998 ? 10 : lerp(5, 0, smooth(ramp(f, 998, 1015))) };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const W = { tiete: SZ, ghost: SZ, kmVal: 0, gold: 0 };
  // the Tietê reveal (z of the leading edge, going inland)
  if (f >= 100) W.tiete = lerp(SZ, SZ - 36, M.easeOut(ramp(f, 100, 140)));
  if (f >= 440) W.tiete = lerp(SZ - 36, -1400, M.easeIn(ramp(f, 440, 534)) * 0.35 + 0.65 * smooth(ramp(f, 440, 534)));
  if (f >= 535) W.tiete = -1400;
  // the "normal" river pouring to the sea, then rewinding on "meia-volta"
  const zs = zSea(0) + 4;
  if (f >= 311 && f < 404) W.ghost = lerp(SZ, zs, M.easeIn(ramp(f, 311, 361)));
  if (f >= 404) W.ghost = lerp(zs, SZ, M.easeOut(ramp(f, 404, 432)));
  W.kmVal = f >= 583 ? 1100 : Math.round(1100 * M.easeOut(ramp(f, 541, 583)) / 9) * 9;
  W.gold = f >= 912 && f <= 954 ? M.back(ramp(f, 912, 920), 2.2) : 0;
  return W;
};

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}) => { const i = idle(f, seed); return { seed, blink: blinkAt(f, seed), tilt: q(i.tilt, 1), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };
let cast = false;
export const actorsAt = (f, T) => {
  globalThis.__T = T;
  if (!cast) { cast = true; Object.assign(T.OUTFITS, {
    hiker: { tunic: '#e8743b', skin: '#f5c9a0', cap: '#3f6a3a', moustache: '#5a3b2a' },
    bandA: { tunic: '#8a6a3b', skin: '#e0b48a', cap: '#5a4030', beard: '#3a2a1a' },
    bandB: { tunic: '#c9b48a', skin: '#c99067', hair: '#1e1714', moustache: '#2a1a10', stout: true },
    bandC: { tunic: '#6a7a4a', skin: '#ecd0b6', cap: '#8a3a2a', apron: '#d8c9a6' },
  }); }
  const S = shotAt(f), out = [];
  switch (S.id) {
    case 'hook': {
      const pointing = f >= 82 && f < 102, shocked = f >= 104;
      const o = shocked ? { L: 'cheek', R: 'shrug', expr: 'shock', look: -0.6, facing: -1, bob: q(-0.02 * M.back(ramp(f, 104, 110), 3), 3) }
        : pointing ? { R: 'point', L: 'hip', expr: 'grin', look: 0.7, facing: 1 } : { R: 'brow', L: 'hang', expr: 'squint', look: -0.3 };
      out.push(R('hiker', life(f, 5, o), HIKER));
      break;
    }
    case 'serra': {
      const sniff = f >= 238;
      out.push(R('hiker', life(f, 5, sniff ? { expr: 'relief', L: 'hip', R: 'hip', headTilt: -9, bob: q(0.012 * Math.sin(f * 0.5), 3) } : { expr: 'smile', L: 'hang', R: 'wave', wv: q(f * 0.3, 1), look: 0.2 }), HIKER, { s: 1.2 }));
      break;
    }
    case 'normal': case 'uturn': {
      if (f > 470) break;
      const o = f < 404 ? { R: 'point', L: 'hip', expr: 'grin', look: 0.3 } : { L: 'shrug', R: 'shrug', expr: 'shock', look: -0.2 };
      out.push(R('hiker', life(f, 5, o), HIKER, { s: 1.6 }));
      break;
    }
    case 'km': {
      const w = walk(f, 535, 0.3, 0.4);
      out.push(R('hiker', life(f, 5, { step: q(w.phase, 2), expr: f > 586 ? 'dazed' : 'pained', look: -0.5, facing: -1, R: 'brow', L: 'hang' }), G0(KMX() + 1.75, KMZ - 0.25 - w.dist)));
      break;
    }
    case 'wall': {
      const P = (x, z) => add3(DO, [x, dTop(x), z]);
      if (f < 712) {
        const o = f < 660 ? { expr: 'neutral', look: -0.4, R: 'brow' } : { expr: 'shock', L: 'cheek', R: 'cheek', headTilt: -12, look: -0.5, bob: q(-0.02 * M.back(ramp(f, 686, 692), 3), 3) };
        out.push(R('hiker', life(f, 5, o), P(27.5, 11)));
      } else {
        const x = f < 732 ? lerp(-3, -17, M.easeIn(ramp(f, 714, 732))) : lerp(-17, -56, smooth(ramp(f, 732, 779)));
        out.push(R('hiker', life(f, 5, { expr: 'laugh', L: 'up', R: 'up' }), P(x, 12.4), { roll: 0.12, yawAbs: 0 }));
      }
      break;
    }
    case 'canoe': {
      const paddle = (seed) => q(Math.sin(f * 0.22 + seed), 1);
      const gold = f >= 912;
      out.push(R('bandA', life(f, 3, gold ? { R: 'lift', L: 'hip', expr: 'laugh', look: 0.2 } : { R: 'reach', lift: q(0.3 + 0.3 * paddle(0), 1), L: 'hang', expr: 'stern', look: -0.4, facing: -1 }), K_(f, [0, -0.15, -2.0])));
      out.push(R('bandB', life(f, 7, { R: 'reach', lift: q(0.3 + 0.3 * paddle(2), 1), expr: gold ? 'shock' : 'grin', look: gold ? -0.6 : 0.2 }), K_(f, [0, -0.15, 0.1])));
      out.push(R('bandC', life(f, 9, { L: 'reach', lift: q(0.3 + 0.3 * paddle(4), 1), expr: gold ? 'grin' : 'neutral', look: -0.6, facing: -1 }), K_(f, [0, -0.15, 2.2])));
      break;
    }
    case 'payoff': {
      if (f > 1040) break;
      const o = f < 966 ? { expr: 'smile', look: 0.2, R: 'hang' } : f < 996 ? { R: 'point', L: 'hip', expr: 'grin', look: 0.8, facing: 1 } : { R: 'thumb', L: 'hip', expr: 'laugh', look: 0 };
      out.push(R('hiker', life(f, 5, o), HIKER));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const gull = (i, base, sc) => { const w = q(Math.sin(f * 0.35 + i * 2), 1); const t = f + i * 7; out.push(FX('gull' + w, (p) => T.fxGull(p, w), [base[0] + Math.sin(t * 0.05) * 6, base[1] + Math.sin(t * 0.09) * 1.5, base[2] + Math.cos(t * 0.05) * 4], sc)); };
  // flow chevrons along the revealed Tietê (spaced by `gap` m, moving downstream)
  const chevrons = (W, z0, z1, n, sc, alphaK = 1) => {
    const gap = (z0 - z1) / n;
    for (let i = 0; i < n; i++) {
      const z = z0 - ((f * 0.12 * sc + i * gap) % (z0 - z1));
      if (z < W.tiete + 2) continue;
      const x = xr(z), dx = xr(z - 1) - x, a = q(Math.min(1, (z0 - z) / (gap * 0.8), (z - Math.max(z1, W.tiete)) / (gap * 0.8)) * alphaK, 1);
      if (a > 0.05) out.push(FX('chev' + a, (p) => T.fxChevron(p, a), [x, RY(z) + 0.06, z + sc * 0.6], sc, { pitch: -Math.PI / 2, yawAbs: Math.atan2(-dx, 1) }));
    }
  };
  const W = worldAt(f);
  if (S.id === 'hook') {
    if (f >= 84 && f < 102) { const k = M.back(ramp(f, 84, 90), 2.5); out.push(FX('bang', (p) => T.fxBang(p), add3(HIKER, [0.2, 2.35, 0]), q(0.32 * k, 2))); }
    if (f >= 100) chevrons(W, SZ - 1, SZ - 36, 6, 0.55);
    for (let i = 0; i < 2; i++) gull(i, [-8 + i * 12, HIKER[1] + 14 + i * 3, 60 + i * 20], 1.6);
  }
  if (S.id === 'serra') {
    for (let i = 0; i < 4; i++) gull(i, [-20 + i * 12, 12 + i * 3, 70 - i * 8], 2.2);
    if (f >= 214) for (let i = 0; i < 6; i++) { // sea breeze leaves blowing up the wall towards the spring
      const t = ((f - 214) / 60 + i / 6) % 1, z = lerp(zSea(0) - 2, SZ + 1, t), x = -4 + i * 1.6 + Math.sin(t * 6 + i) * 1.2;
      const y = Math.max(H(x, z), H(x, Math.min(z + 2, 60))) + 1.2 + Math.sin(t * 9 + i) * 0.6;
      out.push(FX('leaf' + (i % 2), (p) => T.fxLeaf(p, i % 2 ? '#7fc25a' : '#c9e07a'), [x, y, z], 0.7, { roll: q(t * 6 + i, 1) }));
    }
  }
  if (S.id === 'normal' || S.id === 'uturn') {
    if (f < 440) for (let i = 0; i < 3; i++) gull(i, [-18 + i * 14, 18 + i * 4, 70 - i * 10], 2.4);
    if (f >= 358 && f < 384) { const t = q((f - 358) / 26, 2); out.push(FX('spl' + t, (p) => { p.g.translate(0, 130); p.g.scale(0.75, 0.75); T.fxSplash(p, t); }, [0, 0, zSea(0) + 5], 12)); }
    if (f >= 404 && f < 432) { const k = M.back(ramp(f, 404, 410), 2.5); out.push(FX('q', (p) => T.fxQuestion(p), [0, TOP + 5 + Math.sin(f * 0.2) * 0.4, SZ + 6], q(3.2 * k, 2))); }
    if (f >= 440) chevrons(W, SZ - 30, -700, 12, 7);
  }
  if (S.id === 'km') {
    for (let i = 0; i < 2; i++) { const t = ((f - 535) / 16 + i / 2) % 1, hx = KMX() + 1.75; const w = walk(f, 535, 0.3, 0.4);
      out.push(FX('drop', (p) => T.fxDrip(p), [hx + 0.3 + i * 0.12, H(hx, KMZ) + 2.15 - t * 0.6, KMZ - 0.25 - w.dist], 0.08)); }
    chevrons(W, KMZ + 14, KMZ - 20, 4, 1.6);
    if (f >= 583 && f < 595) { const t = q((f - 583) / 12, 2); out.push(FX('spk' + t, (p) => T.fxSpark(p, t), [KMX() + 0.2, H(KMX(), KMZ) + 2.25, KMZ + 0.2], 0.35)); }
  }
  if (S.id === 'wall') {
    const P = (x, y, z) => add3(DO, [x, y, z]);
    if (f >= 634 && f < 652) { const k = M.back(ramp(f, 634, 640), 2.5); out.push(FX('bang', (p) => T.fxBang(p), P(12, TOP + 4, 8), q(2.6 * k, 2))); }
    if (f >= 688 && f < 708) { const k = M.back(ramp(f, 688, 694), 2.5); out.push(FX('bang2', (p) => T.fxBang(p), P(27.8, 3.2, 11), q(0.6 * k, 2))); }
    for (let i = 0; i < 6; i++) { // water creeping gently down the ramp, away from the sea
      const t = ((f - 597) / 150 + i / 6) % 1, x = lerp(-2, -70, t), a = q(Math.min(1, t * 6, (1 - t) * 6), 1);
      if (a > 0.05) out.push(FX('chev' + a, (p) => T.fxChevron(p, a), P(x + 0.9, dTop(x) + 0.12, 5.5), 1.4, { pitch: -Math.PI / 2, yawAbs: Math.PI / 2, roll: 0 }));
    }
  }
  if (S.id === 'canoe') {
    if (W.gold > 0) {
      const k = W.gold;
      out.push(FX('gold', (p) => { p.poly([[220, 560], [300, 470], [390, 500], [410, 600], [320, 650], [230, 630]], '#f2c230', 14); p.poly([[270, 540], [320, 500], [350, 540]], '#fff1a0', 0); }, K_(f, [0.05, 1.32, -1.82]), q(0.18 * k, 2), { order: 6 }));
      const t = q(((f - 912) / 20) % 1, 2); out.push(FX('spk' + t, (p) => T.fxSpark(p, t), K_(f, [0.1, 1.42, -1.82]), 0.24, { order: 7 }));
    }
  }
  if (S.id === 'payoff') {
    if (f >= 1050) { const t = q(clamp((f - 1050) / 24), 2), zE = -760, xE = xr(zE);
      out.push(FX('burst' + t, (p) => T.fxBurst(p, 0.25 + t * 0.6, '#ffd24a', 12, 60, 280), [xE, RY(zE) - 70, zE], 70, { order: 7 }));
      out.push(FX('glow' + t, (p) => T.fxSpark(p, 0.3 + t * 0.4), [xE, RY(zE) - 44, zE + 10], 45 * M.back(clamp((f - 1050) / 8), 2), { order: 8 })); }
    if (f >= 1000) chevrons(W, SZ - 30, -700, 10, 7);
    for (let i = 0; i < 2; i++) gull(i, [-8 + i * 12, HIKER[1] + 14 + i * 3, 60 + i * 20], 1.6);
  }
  return out;
};

// Shot plan for "O Rio de Janeiro que não tem rio" — timed to voice.mp3 (28.00 s, 840 frames @ 30 fps).
// Word times (whisper, s): existe 3.16 | Primeiro 3.84 | navegadores 6.06 | passam 7.20 montanhas 8.14 | encontram 8.86 água 10.36 |
// Só 10.78 gigante 12.08 | Batizaram 12.86 | Rio 13.80 Janeiro 14.08 | Só que 14.60 nenhum 15.66 | Era o mar 16.14 piscina 17.96 porta 18.44 aberta 18.66 |
// engano 19.48 pegou 19.74 | ninguém 20.42 corrigiu 20.66 | E o único 21.78 | Carioca 23.54 | quem nasce lá 24.82-25.4 | Hoje 25.72 | escondido 26.24 | debaixo 26.92 asfalto 27.36
import { M, camFromKeys, idle, blinkAt, walk, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 840, LAND = 3, SO = [0, 0, 3000], G = 1, MH = [0, 4];
export const DECKH = 3;
export const SHOTS = [
  { id: 'hook', a: 0, b: 113, light: 'day' },
  { id: 'date', a: 114, b: 178, light: 'morning' },
  { id: 'entry', a: 179, b: 320, light: 'morning' },
  { id: 'river', a: 321, b: 380, light: 'morning' },
  { id: 'name', a: 381, b: 437, light: 'morning' },
  { id: 'aerial', a: 438, b: 575, light: 'morning' },
  { id: 'stuck', a: 576, b: 650, light: 'morning' },
  { id: 'street', a: 651, b: 764, light: 'day' },
  { id: 'under', a: 765, b: 839, light: 'day' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const C3 = (p) => add3(SO, p); // city local -> world

// ---------- the ship's course ----------
const SHIPK = [[0, 95], [114, 92], [178, 74], [320, -60], [380, -72], [437, -80], [575, -112], [650, -120], [839, -120]];
export const shipAt = (f) => {
  let z = SHIPK[SHIPK.length - 1][1];
  for (let i = 0; i < SHIPK.length - 1; i++) if (f >= SHIPK[i][0] && f <= SHIPK[i + 1][0]) { const t = (f - SHIPK[i][0]) / (SHIPK[i + 1][0] - SHIPK[i][0]); z = lerp(SHIPK[i][1], SHIPK[i + 1][1], i === 3 ? 0.35 * t + 0.65 * smooth(t) : t); }
  return { pos: [0, 0.12 * Math.sin(f * 0.12), z], roll: 0.02 * Math.sin(f * 0.08), pitch: 0.012 * Math.sin(f * 0.1 + 1) };
};
const S_ = (f, p) => { const s = shipAt(f).pos; return add3(s, p); }; // ship local -> world

// ---------- lights ----------
export const LIGHTS = {
  day: { az: 120, el: 50, sky: '#c8e2ff', ground: '#9a8a62', hemi: 1.2, sun: '#fff3de', sunI: 2.5, fog: '#cfe6f7', fogNear: 120, fogFar: 1300,
    skyTop: '#2f86e0', skyHor: '#c7e8ff', sat: 1.12, waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.2, shadowExt: 16 },
  morning: { az: 60, el: 22, sky: '#c9d4f2', ground: '#8a7458', hemi: 1.15, sun: '#ffd8a0', sunI: 2.7, fog: '#f4d8b8', fogNear: 150, fogFar: 1400,
    skyTop: '#4f86d0', skyHor: '#ffdcae', sunDisc: '#fff2d0', sunSize: 0.004, sat: 1.12, gain: '#fff8ee', waterDeep: '#2a6a8e', waterShal: '#6fb8c4', glint: '#fff0d0', vig: 0.22, shadowExt: 20 },
  night: { az: 60, el: 30, sky: '#3a4a8a', ground: '#20203a', hemi: 0.8, sun: '#9fb4ff', sunI: 0.9, fog: '#1c2448', fogNear: 150, fogFar: 1400,
    skyTop: '#0e1430', skyHor: '#2c3a6a', sat: 1.0, gain: '#c8d4ff', waterDeep: '#122040', waterShal: '#2a4470', glint: '#9fb4ff', vig: 0.3, shadowExt: 20 },
  under: { az: 120, el: 50, sky: '#5a78a8', ground: '#2a2a34', hemi: 0.6, sun: '#fff3de', sunI: 0.1, fog: '#0d1820', fogNear: 6, fogFar: 46,
    skyTop: '#0d1820', skyHor: '#0d1820', sat: 1.1, waterDeep: '#1a5a6e', waterShal: '#3aa0b0', glint: '#dff8ff', vig: 0.34, shadowExt: 10, lamp: 7 },
};
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
const mixL = (A, B, t) => { const o = {}; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) { const a = A[k] ?? B[k], b = B[k] ?? A[k]; o[k] = typeof a === 'number' ? lerp(a, b, t) : typeof a === 'string' && a[0] === '#' ? mixHex(a, b, t) : t < 0.5 ? a : b; } return o; };
export const lightFor = (S, f) => {
  let L = { ...LIGHTS[S.light] };
  if (S.id === 'stuck') { const k = f < 612 ? 0.5 - 0.5 * Math.cos(clamp((f - 580) / 32) * Math.PI * 6) : 0; L = mixL(LIGHTS.morning, LIGHTS.night, k * 0.85); L.sunSize = 0; }
  if (S.id === 'under' && f >= 795) { L = { ...LIGHTS.under, lampAt: C3([9, G - 2.6, MH[1]]) }; }
  if (S.id === 'aerial' || S.id === 'entry') { L.shadowExt = 140; }
  if (S.id === 'hook' || S.id === 'street') L.shadowExt = 14;
  return L;
};

// ---------- cameras ----------
// keys in local frames: 'C' = city, 'S' = ship, 'W' = world
const CAMS = {
  hook: { fr: 'C', K: [
    { f: 0, pos: [0.25, G + 1.62, 2.0], look: [-0.8, G + 1.55, -1.0], fov: 34 },
    { f: 26, pos: [0.3, G + 1.64, 2.2], look: [-0.8, G + 1.55, -1.0], fov: 34 },
    { f: 104, pos: [1.6, G + 2.3, 8.2], look: [-0.6, G + 2.0, -3.0], fov: 44 },
    { f: 113, pos: [1.65, G + 2.32, 8.35], look: [-0.6, G + 2.0, -3.0], fov: 44 } ], kicks: [{ f: 92, a: 0.02 }] },
  date: { fr: 'S', K: [
    { f: 114, pos: [0.05, DECKH + 1.92, 0.3], look: [0, DECKH + 1.9, -0.72], fov: 40 },
    { f: 128, pos: [0.08, DECKH + 1.95, 0.45], look: [0, DECKH + 1.9, -0.72], fov: 40 },
    { f: 172, pos: [2.3, DECKH + 3.9, 9.6], look: [0, DECKH + 3.0, -12], fov: 50, path: [[0.9, DECKH + 2.6, 3.5]] },
    { f: 178, pos: [2.32, DECKH + 3.92, 9.7], look: [0, DECKH + 3.0, -12], fov: 50 } ] },
  entry: { fr: 'W', K: [
    { f: 179, pos: [12, 14, 112], look: [0, 12, 30], fov: 50 },
    { f: 250, pos: [10, 16, 44], look: [0, 12, -30], fov: 52 },
    { f: 316, pos: [4, 120, 30], look: [0, 0, -175], fov: 56, path: [[8, 50, 34]] },
    { f: 320, pos: [4, 122, 29], look: [0, 0, -176], fov: 56 } ], follow: true },
  river: { fr: 'S', K: [
    { f: 321, pos: [0.55, DECKH + 1.5, -1.85], look: [0.12, DECKH + 1.55, -5.4], fov: 44 },
    { f: 380, pos: [0.5, DECKH + 1.5, -2.25], look: [0.12, DECKH + 1.6, -5.4], fov: 42 } ], kicks: [{ f: 362, a: 0.03 }] },
  name: { fr: 'S', K: [
    { f: 381, pos: [1.9, DECKH + 4.0, 4.6], look: [1.9, DECKH + 1.0, 3.22], fov: 40 },
    { f: 437, pos: [1.9, DECKH + 3.5, 4.35], look: [1.9, DECKH + 1.0, 3.22], fov: 40 } ], kicks: [{ f: 431, a: 0.025 }] },
  aerial: { fr: 'W', K: [
    { f: 438, pos: [0, 420, 170], look: [0, 0, -165], fov: 50 },
    { f: 480, pos: [0, 380, 150], look: [0, 0, -160], fov: 50, roll: 2 },
    { f: 528, pos: [0, 78, 190], look: [0, 12, -30], fov: 48, path: [[0, 220, 210]] },
    { f: 575, pos: [0, 70, 172], look: [0, 14, -30], fov: 47 } ], kicks: [{ f: 541, a: 0.02 }, { f: 556, a: 0.04 }] },
  stuck: { fr: 'S', K: [
    { f: 576, pos: [1.9, DECKH + 1.75, 5.6], look: [1.9, DECKH + 1.25, 2.6], fov: 40 },
    { f: 650, pos: [1.9, DECKH + 1.7, 5.2], look: [1.9, DECKH + 1.3, 2.6], fov: 38 } ] },
  street: { fr: 'C', K: [
    { f: 651, pos: [1.2, G + 1.7, 5.4], look: [0.1, G + 1.35, -0.8], fov: 38 },
    { f: 764, pos: [1.0, G + 1.65, 4.9], look: [0.1, G + 1.3, -0.8], fov: 36 } ] },
  under: { fr: 'C', K: [
    { f: 765, pos: [1.0, G + 1.65, 4.9], look: [0.1, G + 1.3, -0.8], fov: 36 },
    { f: 788, pos: [0.25, G + 2.5, 5.3], look: [0, G, 4.05], fov: 46, ease: 'smooth' },
    { f: 800, pos: [0.0, G + 0.25, 4.0], look: [0.02, G - 4, 4.04], fov: 50, ease: 'easeIn' },
    { f: 814, pos: [-0.3, G - 3.4, 4.0], look: [10, G - 5.8, 4.0], fov: 52, ease: 'easeOut' },
    { f: 839, pos: [4.6, G - 4.3, 4.25], look: [14, G - 6.0, 4.0], fov: 44, roll: 3 } ] },
};
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  if (D.fr === 'C') { c.pos = C3(c.pos); c.look = C3(c.look); }
  if (D.fr === 'S') { const sh = shipAt(f).pos; c.pos = add3(sh, c.pos); c.look = add3(sh, c.look); }
  // white flashes on place / time jumps
  for (const [a, k] of [[114, 0.9], [576, 0.85], [651, 0.9], [438, 0.35]]) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, k * (1 - (f - a) / 6));
  if (D.fr === 'S') c.shadowAt = S_(f, [0, DECKH, 0]);
  if (S.id === 'aerial' || S.id === 'entry') c.shadowAt = [0, 0, -40];
  if (S.id === 'under') c.shadowAt = C3([0, G, 2]);
  if (S.id === 'hook' || S.id === 'street') c.shadowAt = C3([0, G, 0]);
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const TOUR = [-0.8, G, -1.0], LOC = [0.95, G, -0.7];
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, C3([TOUR[0], G + 1.5, TOUR[2]])), cinf: lerp(12, 7, smooth(ramp(f, 26, 100))) };
    case 'date': return { focus: f < 140 ? dist(C.pos, S_(f, [0, DECKH + 1.9, -0.72])) : lerp(dist(C.pos, S_(f, [0, DECKH + 1.9, -0.72])), 60, smooth(ramp(f, 140, 170))), cinf: lerp(12, 0, smooth(ramp(f, 132, 168))) };
    case 'river': return { focus: dist(C.pos, S_(f, [-0.32, DECKH + 1.6, -5.3])), cinf: 9 };
    case 'name': return { focus: dist(C.pos, S_(f, [1.9, DECKH + 1.0, 3.2])), cinf: 5 };
    case 'stuck': return { focus: dist(C.pos, S_(f, [1.9, DECKH + 1.6, 2.1])), cinf: 8 };
    case 'street': return { focus: dist(C.pos, C3([0.1, G + 1.5, -0.8])), cinf: 9 };
    case 'under': return f > 806 ? { focus: dist(C.pos, C3([12, G - 6, 4])), cinf: 5 } : { focus: 10, cinf: 0 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const sh = shipAt(f);
  const W = { ship: sh.pos, shipRoll: sh.roll, shipPitch: sh.pitch, mapProg: 0, mapSeal: 0, mapAge: 0, doors: 0, doorsOpen: 1, ladder: 0, cover: 0 };
  W.mapProg = clamp((f - 388) / 40); W.mapSeal = f >= 428 ? M.back(clamp((f - 428) / 6), 2.2) : 0;
  if (f >= 576) { W.mapProg = 1; W.mapSeal = 1; W.mapAge = smooth(ramp(f, 580, 612)); }
  if (f >= 484) { W.ladder = M.back(ramp(f, 536, 546), 2.4); W.doors = M.back(ramp(f, 549, 559), 2.0); }
  W.cover = smooth(ramp(f, 772, 786));
  return W;
};

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => p && globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}) => { const i = idle(f, seed); return { seed, blink: blinkAt(f, seed), tilt: q(i.tilt, 1), headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };

export const actorsAt = (f, T) => {
  globalThis.__T = T;
  const S = shotAt(f), out = [];
  const onDeck = (p) => S_(f, [p[0], DECKH, p[1]]);
  const deckGround = (p) => ({ ground: S_(f, [0, DECKH, 0])[1] });
  switch (S.id) {
    case 'hook': {
      const searching = f < 88, side = f < 40 ? 0.7 : f < 60 ? q(lerp(0.7, -0.7, smooth(ramp(f, 40, 56))), 2) : -0.7;
      const shrug = M.back(ramp(f, 88, 96), 2);
      out.push(R('tourist', life(f, 5, searching ? { R: 'brow', L: 'hang', expr: 'squint', look: side, headTilt: side * 6 } : { L: 'shrug', R: 'shrug', expr: 'nervous', look: 0, bob: q(-0.02 * shrug, 3), headTilt: -6 }), C3(TOUR)));
      const w = walk(f, 0, 1.0, 0.7); // a local strolling by on the beach side
      out.push(R('local', life(f, 9, { step: q(w.phase, 2), look: 0.3, facing: 1, expr: 'smile' }), C3([-9 + w.dist, G, -2.8])));
      break;
    }
    case 'date': {
      out.push(R('sailor', life(f, 11, { R: 'scope', expr: 'squint', facing: -1 }), onDeck([-1.7, -3.2]), deckGround()));
      out.push(R('captain', life(f, 3, { L: 'hip', R: 'hip', expr: 'stern', look: -0.3 }), onDeck([1.3, -1.2]), deckGround()));
      out.push(R('sailor2', life(f, 13, { expr: 'neutral', look: 0.4 }), onDeck([-1.0, 4.4]), deckGround()));
      break;
    }
    case 'entry': {
      out.push(R('captain', life(f, 3, { L: 'point', expr: 'grin' }), onDeck([0.8, -4.5]), { ...deckGround(), s: 1.3 }));
      out.push(R('sailor', life(f, 11, { R: 'scope', expr: 'squint' }), onDeck([-1.4, -5.5]), { ...deckGround(), s: 1.3 }));
      break;
    }
    case 'river': {
      const giant = f >= 359;
      const arms = giant ? { L: 'up', R: 'up', bob: q(-0.03 * M.back(ramp(f, 359, 366), 3), 3) } : { R: 'point', L: 'hip' };
      out.push(R('captain', life(f, 3, { ...arms, expr: giant ? 'laugh' : 'grin', look: giant ? 0 : 0.5, facing: giant ? 0 : 1 }), onDeck([-0.32, -5.3]), deckGround()));
      out.push(R('sailor', life(f, 11, { R: f < 352 ? 'scope' : 'hang', L: 'hang', expr: f < 352 ? 'squint' : 'shock', facing: -1, look: -0.5 }), onDeck([0.62, -5.5]), deckGround()));
      break;
    }
    case 'name': break;
    case 'stuck': {
      const shrug = f >= 612;
      out.push(R('captain', life(f, 3, shrug ? { L: 'hip', R: 'hip', expr: 'whistle', look: -0.8, facing: -1 } : { L: 'cross', R: 'cross', expr: 'smile', look: 0.2 }), onDeck([1.75, 1.75]), deckGround()));
      out.push(R('sailor', life(f, 11, shrug ? { L: 'shrug', R: 'shrug', expr: 'nervous', look: 0.3 } : { expr: 'neutral', look: -0.3 }), onDeck([0.55, 2.4]), deckGround()));
      break;
    }
    case 'street': case 'under': {
      if (S.id === 'under' && f > 800) break;
      const proud = f >= 703;
      const tl = f < 700 ? 0.6 : 0.8;
      out.push(R('tourist', life(f, 5, { expr: f > 735 ? 'shock' : 'neutral', look: tl, facing: 1, L: 'hang', R: f > 735 ? 'cheek' : 'hang' }), C3(TOUR)));
      out.push(R('local', life(f, 9, proud ? { L: 'chest', R: 'hip', expr: 'grin', look: -0.3, facing: -1, bob: q(-0.015 * M.back(ramp(f, 703, 710), 3), 3) } : { R: 'up', L: 'hip', expr: 'smile', look: -0.6, facing: -1 }), C3(LOC)));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const gull = (i, base, sp, sc) => { const w = q(Math.sin(f * 0.35 + i * 2), 1); const t = f * sp + i * 7; out.push(FX('gull' + w, (p) => T.fxGull(p, w), [base[0] + Math.sin(t * 0.05) * 6, base[1] + Math.sin(t * 0.09) * 1.5, base[2] + Math.cos(t * 0.05) * 4], sc, { blob: false })); };
  if (S.id === 'hook' && f >= 92) { const k = M.back(ramp(f, 92, 100), 2.5); out.push(FX('q', (p) => T.fxQuestion(p), C3([TOUR[0] + 0.15, G + 2.25 + 0.1 * Math.sin(f * 0.2), TOUR[2]]), q(0.35 * k, 2))); }
  if (S.id === 'hook') for (let i = 0; i < 3; i++) gull(i, C3([-6 + i * 5, G + 9 + i, -14]), 1, 0.9);
  if (S.id === 'date') for (let i = 0; i < 3; i++) gull(i, S_(f, [-3 + i * 4, DECKH + 9 + i, -14 - i * 3]), 1, 1.0);
  if (S.id === 'entry') for (let i = 0; i < 4; i++) gull(i, [-20 + i * 12, 26 + i * 3, 30 - i * 14], 1, 3.5);
  if (S.id === 'river' && f >= 359 && f < 380) { const k = M.back(ramp(f, 359, 365), 2.5); out.push(FX('bang', (p) => T.fxBang(p), S_(f, [-0.05, DECKH + 2.3, -5.3]), q(0.3 * k, 2))); }
  if (S.id === 'name' && f >= 386 && f < 430) {
    const t = clamp((f - 388) / 40), x = 1.9 - 0.42 + t * 0.84, bob = 0.03 * Math.abs(Math.sin(f * 0.9));
    out.push(FX('quill', (p) => T.fxQuill(p), S_(f, [x + 0.02, DECKH + 1.03 + bob, 3.2]), 0.34, { pitch: 0.95, roll: -0.25, order: 6 }));
  }
  if (S.id === 'name' && f >= 429 && f < 437) { const t = q((f - 429) / 8, 2); out.push(FX('puff' + t, (p) => { p.g.translate(150, 700); p.g.scale(1.2, 1.2); T.fxPuff(p, t); }, S_(f, [2.32, DECKH + 1.02, 3.48]), 0.35, { pitch: 1.0 })); }
  if (S.id === 'aerial') {
    for (let i = 0; i < 4; i++) gull(i, [-30 + i * 20, 70 + i * 6, 40 - i * 30], 1, 7);
    if (f >= 484) for (let i = 0; i < 14; i++) { // the sea pouring in through the mouth
      const t = ((f - 484) * 0.012 + i / 14) % 1, x = (i % 5 - 2) * 9 + Math.sin(i * 1.7) * 3, z = 90 - t * 150, a = q(Math.min(1, t * 5, (1 - t) * 4) * clamp((f - 484) / 10), 1);
      if (a > 0) out.push(FX('chev' + a, (p) => T.fxChevron(p, a), [x, 0.3, z], 3.2, { pitch: -Math.PI / 2, yawAbs: 0 }));
    }
    if (f >= 536 && f < 548) { const t = q((f - 536) / 12, 2); out.push(FX('puffL' + t, (p) => { p.g.translate(150, 700); p.g.scale(2, 2); T.fxPuff(p, t); }, [-30, LAND + 6, 28], 9)); }
    if (f >= 549 && f < 570) for (const s of [-1, 1]) { const t = q((f - 549) / 21, 2); out.push(FX('spl' + t, (p) => { p.g.translate(0, 130); p.g.scale(0.75, 0.75); T.fxSplash(p, t); }, [s * 14, 0, 16], 12)); }
  }
  if (S.id === 'stuck') {
    if (f >= 612) for (let i = 0; i < 3; i++) { const t = ((f - 612) / 26 + i / 3) % 1; out.push(FX('note' + (i % 2), (p) => { p.g.translate(200, 300); T.fxNote(p, i % 2, '#3a2b4a'); }, S_(f, [1.45 - t * 0.5, DECKH + 2.2 + t * 0.6, 1.75]), 0.22, { alpha: 1 })); }
  }
  if (S.id === 'street' && f >= 703 && f < 730) { const t = q((f - 703) / 27, 2); out.push(FX('spark' + t, (p) => T.fxSpark(p, t), C3([LOC[0] - 0.3, G + 1.6, LOC[2] + 0.1]), 0.25)); }
  if (S.id === 'under') {
    if (f >= 796) {
      out.push(FX('shaft', (p) => T.fxShaft(p), C3([MH[0], G - 6.4, MH[1]]), 2.6, { order: 7, alpha: 0.9 }));
      for (let i = 0; i < 4; i++) { const t = ((f * 0.04 + i * 0.29) % 1); out.push(FX('drop', (p) => T.fxDrip(p), C3([3 + i * 3.2, G - 1.3 - t * 4.6, 4.9 - (i % 2) * 1.8]), 0.06)); }
      // the fish jumps on "asfalto"
      if (f >= 822) { const t = clamp((f - 822) / 16), fl = q(Math.sin(f * 1.3), 1); out.push(FX('fish' + fl, (p) => T.fxFish(p, fl), C3([11.5 + t * 1.6, G - 6.5 + 1.5 * Math.sin(t * Math.PI), 4.0]), 0.55, { roll: q(0.8 - t * 1.6, 2) })); }
      if (f >= 820 && f < 832) { const t = q((f - 820) / 12, 2); out.push(FX('spa' + t, (p) => { p.g.translate(0, 130); p.g.scale(0.75, 0.75); T.fxSplash(p, t); }, C3([11.4, G - 6.5, 4.0]), 0.9)); }
      if (f >= 834) { const t = q((f - 834) / 12, 2); out.push(FX('spb' + t, (p) => { p.g.translate(0, 130); p.g.scale(0.75, 0.75); T.fxSplash(p, t); }, C3([13.2, G - 6.5, 4.0]), 1.0)); }
    }
  }
  return out;
};
const MOUTH_ = 26;

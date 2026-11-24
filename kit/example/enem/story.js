// "O chute que vale menos" — timed to voice.mp3 (25.36 s, 761 frames @ 30 fps). See work/PLAN.md for word frames.
import { M, camFromKeys, idle, blinkAt, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 761;
export const CL = [0, 0, 0], STo = [300, 0, 0], PIo = [-300, 0, 0];
export const SHOTS = [
  { id: 'hook', a: 0, b: 97, light: 'day' },
  { id: 'twins', a: 98, b: 224, light: 'day' },
  { id: 'tri', a: 225, b: 329, light: 'day' },
  { id: 'stairs', a: 330, b: 438, light: 'day' },
  { id: 'bruno', a: 439, b: 524, light: 'day' },
  { id: 'goal', a: 525, b: 612, light: 'day' },
  { id: 'verdict', a: 613, b: 702, light: 'dusk' },
  { id: 'payoff', a: 703, b: 760, light: 'day' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const FR = { C: CL, S: STo, P: PIo };
const C3 = (p) => add3(CL, p), S3 = (p) => add3(STo, p), P3 = (p) => add3(PIo, p);

// ---------- lights ----------
export const LIGHTS = {
  day: { az: 120, el: 50, sky: '#c8e2ff', ground: '#9a8a62', hemi: 1.2, sun: '#fff3de', sunI: 2.5, fog: '#cfe6f7', fogNear: 120, fogFar: 1300,
    skyTop: '#2f86e0', skyHor: '#c7e8ff', sat: 1.12, waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.2, shadowExt: 16 },
  dusk: { az: 70, el: 18, sky: '#a898d8', ground: '#5a4a6a', hemi: 1.1, sun: '#ffb08a', sunI: 2.0, fog: '#d9a0a8', fogNear: 120, fogFar: 1300,
    skyTop: '#3b3170', skyHor: '#e79a8a', sunDisc: '#ffe0c0', sunSize: 0.004, sat: 1.1, gain: '#f4e8ff', waterDeep: '#2a3a6e', waterShal: '#5a6aa0', glint: '#ffe0d0', vig: 0.32, shadowExt: 18 },
};
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.id === 'hook') L.shadowExt = 6;
  if (S.id === 'twins') L.shadowExt = 10;
  if (S.id === 'tri' || S.id === 'stairs') L.shadowExt = 18;
  if (S.id === 'goal' || S.id === 'payoff') L.shadowExt = 30;
  return L;
};

// ---------- the staircase ----------
export const stepTop = (i) => [i * 1.1 + 0.55, i + 1, 0.2];
const brunoStair = (f) => {
  if (f < 466) return { pos: stepTop(0), roll: f >= 449 && f < 464 ? -0.45 * Math.sin(Math.PI * ramp(f, 449, 464)) : 0 };
  const t = ramp(f, 466, 483), s = smooth(t), a = stepTop(0), b = stepTop(7);
  return { pos: [lerp(a[0], b[0], s), lerp(a[1], b[1], s) + 1.2 * Math.sin(Math.PI * t), 0.2], roll: 0 };
};

// ---------- the ball ----------
const SPOT = [-0.35, 0.11, 0.0];
export const ballAt = (f) => {
  if (f < 532) return { pos: SPOT, vis: true, spin: 0 };
  if (f < 558) { const t = ramp(f, 532, 556); return { pos: [lerp(SPOT[0], 3.4, t), 0.11 + 4.6 * Math.sin(t * Math.PI * 0.62) + t * 0.6, lerp(SPOT[2], -15, t)], vis: f < 556, spin: f * 0.5 }; }
  if (f < 576) return { pos: SPOT, vis: f >= 562, pop: M.back(ramp(f, 562, 568), 2.5), spin: 0 };
  if (f < 588) { const t = ramp(f, 576, 588); return { pos: [lerp(SPOT[0], -1.0, t), 0.11 + 1.1 * Math.sin(t * Math.PI * 0.55), lerp(SPOT[2], -12.7, t)], vis: true, spin: f * 0.6 }; }
  const t = ramp(f, 588, 600); return { pos: [-1.0, lerp(0.95, 0.11, t * t), lerp(-12.7, -12.4, t)], vis: true, spin: 0 };
};

// ---------- cameras ----------
const CAMS = {
  hook: { fr: 'C', K: [
    { f: 0, pos: [0.85, 1.6, 0.6], look: [0.85, 0.79, -0.04], fov: 40 },
    { f: 60, pos: [0.86, 1.64, 0.68], look: [0.85, 0.8, -0.04], fov: 40 },
    { f: 97, pos: [0.82, 1.78, 1.5], look: [0.7, 1.0, -0.4], fov: 44 } ], kicks: [{ f: 24, a: 0.01 }] },
  twins: { fr: 'C', K: [
    { f: 97, pos: [0.82, 1.78, 1.5], look: [0.7, 1.0, -0.4], fov: 44 },
    { f: 150, pos: [0, 1.72, 5.1], look: [0, 1.6, -1.5], fov: 50, path: [[0.6, 1.85, 3.2]] },
    { f: 224, pos: [0, 1.7, 4.7], look: [0, 1.62, -1.5], fov: 48 } ], kicks: [{ f: 213, a: 0.015 }] },
  tri: { fr: 'S', K: [
    { f: 225, pos: [2.2, 1.4, 13.5], look: [4.6, 4.8, 0], fov: 52 },
    { f: 246, pos: [2.4, 1.6, 13.4], look: [4.7, 5.2, 0], fov: 52 },
    { f: 300, pos: [5.2, 7.6, 17.5], look: [5.5, 9.8, -2.6], fov: 46, path: [[3.6, 3.6, 16.5]] },
    { f: 329, pos: [5.3, 7.8, 16.8], look: [5.5, 9.8, -2.6], fov: 45 } ], kicks: [{ f: 252, a: 0.03 }] },
  stairs: { fr: 'S', K: [
    { f: 330, pos: [2.6, 2.3, 13.5], look: [3.4, 2.9, 0], fov: 48 },
    { f: 372, pos: [3.0, 2.8, 14.5], look: [3.6, 3.4, 0], fov: 48 },
    { f: 410, pos: [5.0, 5.8, 19.5], look: [5.0, 5.9, 0], fov: 50 },
    { f: 438, pos: [5.0, 6.0, 19.0], look: [5.0, 6.0, 0], fov: 49 } ] },
  bruno: { fr: 'S', K: [
    { f: 439, pos: [1.7, 2.9, 6.4], look: [0.6, 2.2, 0], fov: 42 },
    { f: 466, pos: [1.6, 2.85, 6.1], look: [0.6, 2.15, 0], fov: 42 },
    { f: 483, pos: [8.7, 9.8, 6.9], look: [8.2, 9.15, 0], fov: 44 },
    { f: 524, pos: [8.6, 9.7, 6.4], look: [8.2, 9.1, 0], fov: 42 } ], kicks: [{ f: 449, a: 0.025 }, { f: 483, a: 0.02 }] },
  goal: { fr: 'P', K: [
    { f: 525, pos: [0.85, 1.7, 6.6], look: [-0.55, 1.3, -8], fov: 52 },
    { f: 612, pos: [0.75, 1.65, 5.9], look: [-0.6, 1.3, -8], fov: 51 } ], kicks: [{ f: 532, a: 0.015 }, { f: 576, a: 0.015 }, { f: 588, a: 0.03 }] },
  verdict: { fr: 'S', K: [
    { f: 613, pos: [5.5, 9.2, 15.8], look: [5.5, 10.6, -2.6], fov: 48 },
    { f: 676, pos: [5.5, 9.7, 12.6], look: [5.5, 10.7, -2.6], fov: 47 },
    { f: 684, pos: [5.5, 9.8, 11.9], look: [5.5, 10.75, -2.6], fov: 46, roll: 4, ease: 'easeOut' },
    { f: 702, pos: [5.5, 9.85, 11.5], look: [5.5, 10.75, -2.6], fov: 46, roll: 4 } ], kicks: [{ f: 657, a: 0.02 }, { f: 679, a: 0.045 }] },
  payoff: { fr: 'P', K: [
    { f: 703, pos: [0.0, 1.0, -2.4], look: [0, 6.5, -24], fov: 52 },
    { f: 760, pos: [0.05, 1.2, -3.0], look: [0, 8.0, -24], fov: 48 } ], kicks: [{ f: 703, a: 0.02 }, { f: 744, a: 0.03 }] },
};
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  const o = FR[D.fr]; c.pos = add3(o, c.pos); c.look = add3(o, c.look);
  for (const [a, k] of [[225, 0.9], [525, 0.9], [613, 0.8], [703, 0.6]]) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, k * (1 - (f - a) / 6));
  if (S.id === 'hook' || S.id === 'twins') c.shadowAt = C3([0, 0, -0.5]);
  if (S.id === 'tri' || S.id === 'stairs' || S.id === 'verdict') c.shadowAt = S3([4.5, 3, 0]);
  if (S.id === 'bruno') c.shadowAt = S3(brunoStair(f).pos);
  if (S.id === 'goal') c.shadowAt = P3([0, 0, -4]);
  if (S.id === 'payoff') c.shadowAt = P3([0, 0, -12]);
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ANA = [-0.85, 0, -0.45], BRU = [0.85, 0, -0.45];
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, C3([0.85, 0.8, -0.05])), cinf: 9 };
    case 'twins': return { focus: lerp(dist(C.pos, C3([0.85, 0.8, -0.05])), dist(C.pos, C3([0, 1.6, -0.45])), smooth(ramp(f, 100, 140))), cinf: lerp(9, 5, smooth(ramp(f, 100, 150))) };
    case 'bruno': { const b = brunoStair(f).pos; return { focus: dist(C.pos, S3([b[0], b[1] + 1.5, b[2]])), cinf: 6 }; }
    case 'goal': return { focus: dist(C.pos, P3([-1.0, 1.4, 0.5])), cinf: 4 };
    case 'payoff': return { focus: lerp(dist(C.pos, P3([0.5, 1.5, -7.0])), dist(C.pos, P3([0, 10.8, -29])), smooth(ramp(f, 734, 742))), cinf: 6 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const W = {};
  W.fill = q(smooth(ramp(f, 17, 24)), 2);
  W.board = f < 135 ? 0 : f < 180 ? 1 : 2;
  W.bpop = W.board === 1 ? q(M.back(ramp(f, 135, 142), 2.5), 2) : 1;
  W.bscale = f >= 178 && f < 186 ? q(1 + 0.08 * Math.sin(Math.PI * ramp(f, 178, 186)), 3) : 1;
  W.ana = Math.round(lerp(400, 712, smooth(ramp(f, 182, 215))) / 2) * 2;
  W.bruno = Math.round(lerp(400, 538, smooth(ramp(f, 182, 202))) / 2) * 2;
  W.easy = f >= 382 ? q(M.back(ramp(f, 382, 390), 2.5), 2) : 0;
  W.hard = f >= 413 ? q(M.back(ramp(f, 413, 421), 2.5), 2) : 0;
  if (f < 248) W.tri = { mode: 0 };
  else if (f < 613) W.tri = { mode: 1, l: [0, 1, 2].map((i) => q(M.back(ramp(f, 248 + i * 3, 255 + i * 3), 2.2), 2)) };
  else if (f < 677) W.tri = { mode: 2, x: q(smooth(ramp(f, 655, 663)), 2) };
  else W.tri = { mode: 3, s: q(M.back(ramp(f, 677, 683), 3), 2) };
  W.plate = f >= 274 ? q(M.back(ramp(f, 274, 284), 1.8), 2) : 0;
  W.bulge = f >= 587 ? q(0.55 * Math.exp(-(f - 587) / 9) * (1 + 0.3 * Math.sin((f - 587) * 0.9)), 3) : 0;
  if (f < 703) W.score = { mode: 0 };
  else { const shrink = smooth(ramp(f, 738, 750)); W.score = { mode: 1, pop: q(M.back(ramp(f, 703, 709), 2.5), 2), v: q(M.back(ramp(f, 705, 711), 2.5) * lerp(1, 0.42, shrink), 2), label: f >= 744 ? '+0,3' : '+1' }; }
  return W;
};

// ---------- actors (2D cards) ----------
const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => p && globalThis.__T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const life = (f, seed, o = {}) => { const i = idle(f, seed); return { seed, blink: o.expr === 'blind' ? 0 : blinkAt(f, seed), tilt: q(i.tilt, 1), ...o, headTilt: q(i.headTilt + (o.headTilt || 0), 1), bob: q(i.bob + (o.bob || 0), 3) }; };
const nod = (f, at, k = 0.025) => (f >= at && f < at + 8 ? -k * Math.sin(Math.PI * (f - at) / 8) : 0);
let outfitsSet = false;

export const actorsAt = (f, T) => {
  globalThis.__T = T;
  if (!outfitsSet) { Object.assign(T.OUTFITS, {
    ana: { tunic: '#e8607e', skin: '#c99067', hair: '#2b1a14' },
    bruno: { tunic: '#3f7fd0', skin: '#f5c9a0', hair: '#5a3b2a', stripes: '#2f63a8' },
    kidA: { tunic: '#5d8a3a', skin: '#ecd0b6', hair: '#1e1714' },
    kidB: { tunic: '#d9a441', skin: '#8a5a3a', hair: '#1e1714', cap: '#c0352f' } }); outfitsSet = true; }
  const S = shotAt(f), out = [];
  switch (S.id) {
    case 'hook': case 'twins': {
      const anaO = f < 190 ? { expr: 'smile', look: 0.3, bob: nod(f, 135) } : { L: 'chest', R: 'hip', expr: 'grin', look: 0.2, bob: q(nod(f, 190, 0.03) + nod(f, 207, 0.03), 3) };
      const bruO = f < 24 ? { expr: 'squint', look: -0.2 } : f < 66 ? { expr: 'grin', look: -0.2, R: 'thumb' } : f < 135 ? { expr: 'nervous', look: -0.3 }
        : f < 200 ? { expr: 'smile', look: -0.3, bob: nod(f, 135) } : f < 214 ? { L: 'cheek', R: 'cheek', expr: 'shock', look: -0.4 } : { L: 'cheek', R: 'cheek', expr: 'pained', look: -0.4 };
      out.push(R('ana', life(f, 4, anaO), C3(ANA)));
      out.push(R('bruno', life(f, 7, bruO), C3(BRU), { alpha: q(clamp((f - 60) / 14), 2) }));
      out.push(R('kidA', life(f, 12, { expr: 'squint', look: 0.2, R: 'temple', swirl: q(f * 0.2, 1) }), C3([-2.7, 0, -0.45])));
      out.push(R('kidB', life(f, 15, { expr: 'nervous', look: -0.3 }), C3([2.7, 0, -0.45])));
      out.push(R('civA', life(f, 18, { expr: 'neutral', look: 0.4 }), C3([-0.85, 0, -2.65])));
      out.push(R('civB', life(f, 21, { expr: 'squint', look: -0.3 }), C3([0.85, 0, -2.65])));
      break;
    }
    case 'tri': case 'stairs': {
      const shock = f >= 252 && f < 330;
      const o = f < 252 ? { R: 'brow', expr: 'squint', look: 0.5, headTilt: -5 } : shock ? { L: 'up', R: 'up', expr: 'shock', look: 0.4, bob: q(-0.03 * M.back(ramp(f, 252, 259), 3), 3) } : { R: 'brow', expr: 'squint', look: 0.6 };
      out.push(R('bruno', life(f, 7, o), S3([2.6, 0, 5.0])));
      break;
    }
    case 'bruno': {
      const b = brunoStair(f);
      const o = f < 449 ? { expr: 'smile', look: 0.4 } : f < 462 ? { expr: 'shock', L: 'up', R: 'up' } : f < 466 ? { expr: 'dazed' } : f < 483 ? { expr: 'shock', L: 'up', R: 'up' }
        : f < 501 ? { expr: 'squint', look: -0.2, bob: q(-0.04 * Math.exp(-(f - 483) / 4), 3) } : { expr: 'grin', L: 'chest', look: -0.3, bob: nod(f, 501, 0.03) };
      out.push(R('bruno', life(f, 7, o), S3(b.pos), { roll: q(b.roll, 2) }));
      break;
    }
    case 'goal': {
      const kick1 = f >= 529 && f < 537, kick2 = f >= 573 && f < 581;
      const step = kick1 ? q(0.25 * Math.sin(Math.PI * ramp(f, 529, 537)), 2) : kick2 ? q(0.25 * Math.sin(Math.PI * ramp(f, 573, 581)), 2) : 0;
      let o;
      if (f < 529) o = { expr: 'stern', L: 'hip', R: 'hip', look: -0.5 };
      else if (f < 545) o = { expr: 'grin', step, look: -0.5 };
      else if (f < 562) o = { expr: 'shock', L: 'cheek', R: 'cheek', look: -0.6 };
      else if (f < 590) o = { expr: 'blind', step, L: 'reach', R: 'hang' };
      else o = { expr: 'laugh', L: 'up', R: 'up', bob: nod(f, 590, 0.04) };
      out.push(R('bruno', life(f, 7, o), P3([-0.95, 0, 0.5])));
      break;
    }
    case 'verdict': {
      const o = f < 657 ? { expr: 'grin', L: 'chest', look: -0.5 } : f < 679 ? { expr: 'nervous', L: 'shrug', R: 'shrug', look: -0.6 } : { expr: 'pained', L: 'cheek', R: 'cheek', look: -0.6, bob: nod(f, 679, 0.04) };
      out.push(R('bruno', life(f, 7, o), S3(stepTop(6))));
      break;
    }
    case 'payoff': {
      const o = f < 738 ? { expr: 'laugh', L: 'up', R: 'up', look: -0.3, bob: q(0.02 * Math.sin(f * 0.6), 3) } : f < 744 ? { expr: 'nervous', look: -0.4, L: 'shrug', R: 'shrug' } : { expr: 'pained', L: 'shrug', R: 'shrug', look: -0.4, bob: nod(f, 744, 0.04) };
      out.push(R('bruno', life(f, 7, o), P3([0.5, 0, -7.0])));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1] - 1.125 * s, z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const ink = '#241726';
const drawCoin = (p) => { const g = p.g; p.ell(300, 500, 150, 150, '#f2c94a', 12); p.ell(300, 500, 112, 112, null, 6); g.font = 'bold 150px Arial, "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#8a5a10'; g.fillText('+1', 300, 510); };
const drawBall = (p, spin) => { const g = p.g; p.ell(300, 500, 120, 120, '#ffffff', 10); g.save(); g.translate(300, 500); g.rotate(spin);
  const pent = (cx, cy, r) => { const pts = []; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return pts; };
  p.poly(pent(0, 0, 38), ink, 0); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5 + Math.PI / 5; p.poly(pent(Math.cos(a) * 98, Math.sin(a) * 98, 28), ink, 0); }
  g.restore(); p.ell(300, 500, 120, 120, null, 10); };
const drawX = (p) => { p.stroke([[170, 370], [430, 630]], 90, '#ffffff'); p.stroke([[430, 370], [170, 630]], 90, '#ffffff'); p.stroke([[170, 370], [430, 630]], 60, '#e0483e'); p.stroke([[430, 370], [170, 630]], 60, '#e0483e'); };
const drawCheck = (p) => { p.stroke([[150, 500], [260, 620], [460, 360]], 95, '#ffffff'); p.stroke([[150, 500], [260, 620], [460, 360]], 64, '#2fae55'); };

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const BUB = [0.853, 0.79, -0.081];
  if (S.id === 'hook' && f >= 22) {
    const s = 0.2 * M.back(ramp(f, 22, 30), 2.4) * lerp(1, 0.1, smooth(ramp(f, 64, 80))), rise = 0.14 * smooth(ramp(f, 22, 34));
    out.push(FX('coin', drawCoin, C3([BUB[0], BUB[1] + 0.07 + rise, BUB[2]]), q(s, 3), { alpha: f > 80 ? q(lerp(1, 0.4, ramp(f, 80, 92)), 2) : 1 }));
    if (f < 32) { const t = q((f - 22) / 10, 2); out.push(FX('spk' + t, (p) => T.fxSpark(p, t), C3([BUB[0] + 0.05, BUB[1] + 0.12, BUB[2]]), 0.1)); }
    if (f >= 66 && f < 80) { const t = q((f - 66) / 14, 2); out.push(FX('pf' + t, (p) => T.fxPuff(p, t), C3([BUB[0], BUB[1] + 0.2, BUB[2] + 0.02]), 0.12, { alpha: 0.8 })); }
  }
  if (S.id === 'twins' && f >= 213 && f < 228) { const t = q((f - 213) / 15, 2); out.push(FX('spa' + t, (p) => T.fxSpark(p, t), C3([-0.6, 2.85, -3.8]), 0.35)); }
  if (S.id === 'tri') {
    if (f >= 236 && f < 252) out.push(FX('qm', (p) => T.fxQuestion(p), S3([2.8, 2.5 + 0.05 * Math.sin(f * 0.3), 5.0]), 0.35));
    if (f >= 250 && f < 278) { const t = q((f - 250) / 28, 2); out.push(FX('burst' + t, (p) => T.fxBurst(p, t, '#fff3b0', 14), S3([5.5, 11.0, -3.1]), 5.5, { order: 1 })); }
  }
  if (S.id === 'stairs') {
    for (const [a, ii] of [[382, [0, 1, 2]], [413, [5, 6, 7]]]) if (f >= a && f < a + 14) { const t = q((f - a) / 14, 2); for (const i of ii) { const p = stepTop(i); out.push(FX('ss' + t, (pp) => T.fxSpark(pp, t), S3([p[0] + 0.3, p[1] - 0.1, 1.7]), 0.3)); } }
  }
  if (S.id === 'bruno') {
    if (f >= 449 && f < 472) { const k = M.back(ramp(f, 449, 455), 2.5); out.push(FX('x', drawX, S3([0.9, 1.9, 1.0]), q(0.42 * k, 2))); }
    if (f >= 449 && f < 460) { const k = M.back(ramp(f, 449, 454), 2.5); out.push(FX('bang', (p) => T.fxBang(p), S3([0.2, 1.4, 0.8]), q(0.3 * k, 2))); }
    if (f >= 483 && f < 495) { const t = q((f - 483) / 12, 2); out.push(FX('dust' + t, (p) => T.fxDust(p, t), S3([8.25, 8.15, 0.6]), 0.5)); }
    if (f >= 501) { const k = M.back(ramp(f, 501, 507), 2.5); out.push(FX('chk', drawCheck, S3([7.45, 10.6 + 0.04 * Math.sin(f * 0.25), 0.6]), q(0.5 * k, 2))); }
    if (f >= 501 && f < 515) { const t = q((f - 501) / 14, 2); out.push(FX('sp' + t, (p) => T.fxSpark(p, t), S3([7.45, 10.9, 0.5]), 0.4)); }
  }
  if (S.id === 'goal' || S.id === 'payoff') {
    const b = ballAt(f);
    if (b.vis) out.push(FX('ball' + q(b.spin % 6.283, 1), (p) => drawBall(p, b.spin), P3(b.pos), q(0.4 * (b.pop ?? 1), 3), { order: 6 }));
    if (S.id === 'goal') {
      for (const a of [531, 575]) if (f >= a && f < a + 9) { const t = q((f - a) / 9, 2); out.push(FX('kp' + t, (p) => T.fxPuff(p, t), P3([-0.3, 0.35, 0.05]), 0.3)); }
      if (f >= 548 && f < 562) out.push(FX('qq', (p) => T.fxQuestion(p), P3([-0.75, 2.45 + 0.05 * Math.sin(f * 0.3), 0.5]), 0.35));
      if (f >= 588 && f < 606) { const t = q((f - 588) / 18, 2); out.push(FX('gb' + t, (p) => T.fxBurst(p, t, '#fff3b0', 12), P3([-1.0, 1.4, -13.3]), 1.6, { order: 1 })); }
    }
    if (S.id === 'payoff') {
      if (f >= 703 && f < 725) { const t = q((f - 703) / 22, 2); out.push(FX('pb' + t, (p) => T.fxBurst(p, t, '#fff3b0', 16), P3([0, 10.8, -29.8]), 7, { order: 1 })); }
      if (f >= 740 && f < 754) { const t = q((f - 740) / 14, 2); out.push(FX('dp' + t, (p) => T.fxPuff(p, t), P3([0, 10.0, -28.8]), 2.2, { alpha: 0.85 })); }
    }
  }
  if (S.id === 'verdict' && f >= 657) out.push(FX('drip', (p) => T.fxDrip(p), S3([stepTop(6)[0] + 0.35, 9.0 - ((f - 657) * 0.01) % 0.4, 0.4]), 0.1));
  return out;
};

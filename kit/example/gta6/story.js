// "Treze anos de espera" — timed to voice.mp3 (27.28 s, 818 frames @ 30 fps). See work/PLAN.md.
import { M, camFromKeys, idle, blinkAt, q, clamp, lerp, lerp3, ramp } from './motion.js';
export const FPS = 30, TOTAL = 818;
export const PL = [0, 0, 0], RO = [300, 0, 0];
export const SHOTS = [
  { id: 'hook', a: 0, b: 108, light: 'day' },
  { id: 'chart', a: 109, b: 176, light: 'day' },
  { id: 'y2013', a: 177, b: 301, light: 'gold' },
  { id: 'lapse', a: 302, b: 497, light: 'gold' },
  { id: 'delay', a: 498, b: 577, light: 'room' },
  { id: 'day', a: 578, b: 660, light: 'room' },
  { id: 'dig', a: 661, b: 741, light: 'room' },
  { id: 'payoff', a: 742, b: 817, light: 'night' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const smooth = M.smooth;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const FR = { P: PL, R: RO };
const P3 = (p) => add3(PL, p), R3 = (p) => add3(RO, p);

// ---------- layout (room-local) ----------
export const MARC = [0.6, 0, -0.5], SON = [1.3, 0, -0.75], TVP = [-1.5, 0, -1.5], CAL = [1.3, 2.05, -2.93], BOX = [0.6, 0, 0.12];
export const CASEX = 2.7;
export const MPAY = [-0.35, 0, -0.55], SPAY = [0.45, 0, -0.95];
export const marcAt = (f) => { if (f < 742) return MARC; const t = smooth(ramp(f, 744, 764)); return [lerp(MARC[0], MPAY[0], t), 0, lerp(MARC[2], MPAY[2], t)]; };

// ---------- lights ----------
const hx = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixC = (a, b, t) => '#' + hx(a).map((v, i) => Math.round(lerp(v, hx(b)[i], t)).toString(16).padStart(2, '0')).join('');
const mixL = (A, B, t) => { const o = { ...A }; for (const k in B) { if (typeof B[k] === 'number' && typeof A[k] === 'number') o[k] = lerp(A[k], B[k], t); else if (typeof B[k] === 'string' && B[k][0] === '#' && typeof A[k] === 'string') o[k] = mixC(A[k], B[k], t); } return o; };
export const LIGHTS = {
  day: { az: 120, el: 50, sky: '#c8e2ff', ground: '#9a8a62', hemi: 1.2, sun: '#fff3de', sunI: 2.5, fog: '#cfe6f7', fogNear: 120, fogFar: 1300,
    skyTop: '#2f86e0', skyHor: '#c7e8ff', sat: 1.12, waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.2, shadowExt: 12 },
  gold: { az: 60, el: 38, sky: '#ffe2b8', ground: '#8a6a4a', hemi: 1.2, sun: '#ffd9a0', sunI: 1.7, fog: '#f2c9a0', fogNear: 120, fogFar: 1300,
    skyTop: '#e8925a', skyHor: '#ffd8a0', sat: 1.1, gain: '#fff0dc', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.3, shadowExt: 7, lamp: 3, lampAt: [300.5, 2.6, 1.2] },
  room: { az: 70, el: 45, sky: '#dfe8ff', ground: '#7a6a5a', hemi: 1.25, sun: '#fff4e4', sunI: 1.6, fog: '#d6e4f2', fogNear: 120, fogFar: 1300,
    skyTop: '#4f8fd8', skyHor: '#cfe4ff', sat: 1.1, gain: '#ffffff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.26, shadowExt: 7, lamp: 3, lampAt: [300.5, 2.6, 1.2] },
  night: { az: 60, el: 40, sky: '#6f7fc0', ground: '#3a3050', hemi: 1.0, sun: '#9fb0ff', sunI: 0.9, fog: '#2a3060', fogNear: 120, fogFar: 1300,
    skyTop: '#141a3e', skyHor: '#3a4a8a', sat: 1.05, gain: '#e4ecff', waterDeep: '#1f6f9a', waterShal: '#4fc0cf', glint: '#effaff', vig: 0.4, shadowExt: 7, lamp: 6, lampAt: [299.0, 1.5, 0.2] },
};
export const lightFor = (S, f) => {
  let L = { ...LIGHTS[S.light] };
  if (S.id === 'lapse') L = mixL(LIGHTS.gold, LIGHTS.room, smooth(ramp(f, 310, 480)));
  if (S.id === 'chart') L.shadowExt = 16;
  return L;
};

// ---------- cameras ----------
const CAMS = {
  hook: { fr: 'P', K: [
    { f: 0, pos: [-CASEX, 1.62, 2.3], look: [-CASEX, 1.5, 0], fov: 40 },
    { f: 47, pos: [-CASEX + 0.06, 1.6, 2.05], look: [-CASEX, 1.5, 0], fov: 40 },
    { f: 48, pos: [CASEX, 1.62, 2.35], look: [CASEX, 1.5, 0], fov: 40 },
    { f: 62, pos: [CASEX - 0.05, 1.62, 2.4], look: [CASEX, 1.5, 0], fov: 40 },
    { f: 98, pos: [0, 2.6, 14.5], look: [0, 1.7, 0], fov: 46, ease: 'easeOut' },
    { f: 108, pos: [0, 2.7, 14.7], look: [0, 1.75, 0], fov: 46 } ], kicks: [{ f: 82, a: 0.012 }] },
  chart: { fr: 'P', K: [
    { f: 109, pos: [0, 2.7, 14.7], look: [0, 1.75, 0], fov: 46 },
    { f: 140, pos: [0.4, 7.4, 15.5], look: [0, 2.6, -6.6], fov: 50, path: [[0.3, 4.6, 16.2]] },
    { f: 176, pos: [0.5, 7.6, 14.8], look: [0, 2.9, -6.6], fov: 50 } ], kicks: [{ f: 158, a: 0.03 }] },
  y2013: { fr: 'R', K: [
    { f: 177, pos: [-0.3, 2.0, 6.4], look: [-0.35, 1.25, -1.5], fov: 52 },
    { f: 236, pos: [-0.2, 1.9, 5.6], look: [-0.25, 1.3, -1.2], fov: 50 },
    { f: 270, pos: [0.65, 1.65, 2.1], look: [0.6, 1.5, -0.5], fov: 40 },
    { f: 301, pos: [0.66, 1.64, 1.95], look: [0.6, 1.52, -0.5], fov: 40 } ], kicks: [{ f: 218, a: 0.015 }] },
  lapse: { fr: 'R', K: [
    { f: 302, pos: [0.66, 1.64, 1.95], look: [0.6, 1.52, -0.5], fov: 40 },
    { f: 336, pos: [-0.3, 2.0, 6.4], look: [-0.35, 1.2, -1.5], fov: 52, ease: 'easeOut' },
    { f: 410, pos: [-0.35, 1.95, 6.0], look: [-0.4, 1.2, -1.5], fov: 51 },
    { f: 436, pos: [1.0, 1.75, 3.7], look: [1.0, 1.3, -0.8], fov: 46 },
    { f: 497, pos: [1.05, 1.72, 3.4], look: [1.05, 1.28, -0.8], fov: 46 } ], kicks: [{ f: 478, a: 0.012 }] },
  delay: { fr: 'R', K: [
    { f: 498, pos: [CAL[0], CAL[1], CAL[2] + 1.55], look: [CAL[0], CAL[1], CAL[2]], fov: 40 },
    { f: 577, pos: [CAL[0], CAL[1], CAL[2] + 1.35], look: [CAL[0], CAL[1], CAL[2]], fov: 40, roll: -2 } ], kicks: [{ f: 516, a: 0.02 }, { f: 542, a: 0.03 }] },
  day: { fr: 'R', K: [
    { f: 578, pos: [CAL[0], CAL[1], CAL[2] + 1.35], look: [CAL[0], CAL[1], CAL[2]], fov: 40 },
    { f: 620, pos: [CAL[0] - 0.05, CAL[1], CAL[2] + 1.5], look: [CAL[0], CAL[1], CAL[2]], fov: 40 },
    { f: 646, pos: [0.95, 1.75, 2.8], look: [0.95, 1.45, -1.5], fov: 52 },
    { f: 660, pos: [0.95, 1.75, 2.65], look: [0.95, 1.45, -1.5], fov: 52 } ], kicks: [{ f: 617, a: 0.012 }] },
  dig: { fr: 'R', K: [
    { f: 661, pos: [0.75, 1.15, 2.7], look: [0.6, 0.9, -0.4], fov: 46 },
    { f: 674, pos: [0.75, 1.17, 2.6], look: [0.6, 0.92, -0.4], fov: 46 },
    { f: 696, pos: [0.72, 1.45, 2.4], look: [0.6, 1.35, -0.4], fov: 44 },
    { f: 741, pos: [0.7, 1.5, 2.15], look: [0.6, 1.4, -0.4], fov: 43 } ], kicks: [{ f: 676, a: 0.012 }] },
  payoff: { fr: 'R', K: [
    { f: 742, pos: [0.7, 1.62, 3.4], look: [-0.3, 1.15, -1.1], fov: 50 },
    { f: 766, pos: [0.0, 1.62, 3.1], look: [-0.95, 1.15, -1.1], fov: 52 },
    { f: 780, pos: [-0.05, 1.6, 2.95], look: [-0.98, 1.15, -1.1], fov: 52 },
    { f: 790, pos: [-0.4, 1.52, 2.3], look: [-1.05, 1.2, -1.1], fov: 52, roll: 4, ease: 'easeOut' },
    { f: 817, pos: [-0.42, 1.52, 2.15], look: [-1.05, 1.2, -1.1], fov: 52, roll: 4 } ], kicks: [{ f: 782, a: 0.04 }, { f: 803, a: 0.02 }] },
};
export const camAt = (f) => {
  const S = shotAt(f), D = CAMS[S.id];
  const c = camFromKeys(D.K, f, { kicks: D.kicks || [], creep: 0.0006 });
  const o = FR[D.fr]; c.pos = add3(o, c.pos); c.look = add3(o, c.look);
  for (const [a, k] of [[177, 0.9]]) if (f >= a && f < a + 6) c.flash = Math.max(c.flash || 0, k * (1 - (f - a) / 6));
  c.shadowAt = S.id === 'hook' || S.id === 'chart' ? P3([0, 0, -2]) : R3([0, 0, -1]);
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return f < 62 ? { focus: dist(C.pos, P3([f < 48 ? -CASEX : CASEX, 1.5, 0])), cinf: 7 } : { focus: 14, cinf: lerp(7, 0, ramp(f, 62, 90)) };
    case 'y2013': return { focus: dist(C.pos, R3([MARC[0], 1.6, MARC[2]])), cinf: lerp(0, 7, ramp(f, 236, 270)) };
    case 'lapse': return { focus: dist(C.pos, R3([MARC[0], 1.6, MARC[2]])), cinf: lerp(7, 0, ramp(f, 302, 330)) };
    case 'delay': return { focus: dist(C.pos, R3(CAL)), cinf: 6 };
    case 'day': return { focus: f < 625 ? dist(C.pos, R3(CAL)) : dist(C.pos, R3([MARC[0], 1.6, MARC[2]])), cinf: f < 625 ? 6 : 4 };
    case 'dig': case 'payoff': { const m = marcAt(f); return { focus: dist(C.pos, R3([m[0], 1.5, m[2]])), cinf: 6 }; }
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
const pop = (f, a, d = 7, s = 2.4) => (f < a ? 0 : q(M.back(ramp(f, a, a + d), s), 2));
export const worldAt = (f) => {
  const W = {};
  W.lamps = f < 60 ? 0 : Math.min(13, Math.floor(1 + (f - 60) / 1.85));
  W.count = W.lamps;
  W.cpop = f >= 82 ? q(1 + 0.25 * Math.exp(-(f - 82) / 5) * Math.cos((f - 82) * 0.8), 2) : 1;
  W.cols = [pop(f, 112), pop(f, 119), pop(f, 126), pop(f, 133), f < 140 ? 0 : q(lerp(0.04, 1, M.back(ramp(f, 140, 160), 1.6)), 3)];
  W.tv = f < 218 ? 'g5' : f < 302 ? 'win' : f < 742 ? 'g5' : f < 780 ? 'load' : 'bad';
  W.tvLoad = f >= 742 && f < 780 ? q(clamp((f - 744) / 34), 2) : 0;
  W.tvBad = f >= 780 ? pop(f, 780, 6, 3) : 0;
  W.win = q(smooth(ramp(f, 218, 226)), 2);
  if (f < 302) W.cal = { m: 'Y', y: 2013 };
  else if (f < 498) W.cal = { m: 'Y', y: 2013 + Math.min(11, Math.floor(ramp(f, 306, 470) * 11.99)) };
  else if (f < 532) W.cal = { m: 'A', st: f >= 516 ? pop(f, 516, 6, 3) : 0 };
  else if (f < 580) W.cal = { m: 'B', st: f >= 542 ? pop(f, 542, 6, 3) : 0 };
  else W.cal = { m: 'C', ring: f >= 617 ? pop(f, 617, 7, 2.5) : 0 };
  W.sky = f >= 302 && f < 498 ? q(0.5 + 0.5 * Math.cos((f - 302) * 0.28), 1) : f >= 742 ? 0 : 1;
  W.hideCounter = f >= 112 ? q(1 - smooth(ramp(f, 112, 122)), 2) : 1;
  W.cons = f < 498 ? [pop(f, 371), pop(f, 381), pop(f, 395)] : [0, 0, 0];
  W.bills = f >= 476 ? q(lerp(0.05, 1, M.back(ramp(f, 476, 486), 2)), 2) : 0;
  W.box = f >= 661 ? 1 : 0;
  const rise = f < 674 ? 0 : M.back(ramp(f, 674, 690), 1.6);
  const mp = marcAt(f); W.console = f >= 661 ? { y: q(lerp(0.32, 1.06, rise), 3) + (f >= 744 && f < 764 ? 0.03 * Math.abs(Math.sin((f - 744) * 0.6)) : 0), z: q(lerp(BOX[2], mp[2] + 0.24, rise), 3), x: mp[0], rot: q(0.15 * Math.sin(Math.PI * ramp(f, 674, 692)), 2) } : null;
  W.sticker = f >= 713 ? q(1 + 0.3 * Math.exp(-(f - 713) / 4), 2) : 1;
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
    marcos: { tunic: '#e0563a', skin: '#f5c9a0', hair: '#3a2418', stripes: '#c2402a' },
    marcosB: { tunic: '#3f7fd0', skin: '#f5c9a0', hair: '#3a2418', beard: '#4a2e1e', stout: true },
    filho: { tunic: '#f2c94a', skin: '#f5c9a0', hair: '#6a4126' } }); outfitsSet = true; }
  const S = shotAt(f), out = [];
  switch (S.id) {
    case 'hook': case 'chart': {
      let o;
      if (f < 80) o = { expr: 'squint', look: q(lerp(-0.4, 0.4, smooth(ramp(f, 30, 56))), 2), R: 'brow' };
      else if (f < 112) o = { expr: 'shock', L: 'cheek', R: 'cheek', look: 0, bob: nod(f, 82, 0.04) };
      else if (f < 157) o = { expr: 'nervous', R: 'brow', look: 0.1, headTilt: -6 };
      else o = { expr: 'shock', L: 'up', R: 'up', look: 0.1, bob: q(-0.04 * M.back(ramp(f, 157, 164), 3), 3) };
      out.push(R('marcosB', life(f, 7, o), P3([0, 0, 0.9])));
      break;
    }
    case 'y2013': {
      const o = f < 218 ? { expr: 'grin', look: -0.5, L: 'reach' } : f < 256 ? { expr: 'laugh', L: 'up', R: 'up', look: -0.2, bob: q(hop(f, 218), 3) }
        : { expr: 'stern', R: 'up', L: 'chest', look: 0, bob: nod(f, 260, 0.03) };
      out.push(R('marcos', life(f, 7, o), R3(MARC)));
      break;
    }
    case 'lapse': {
      const beard = f >= 445;
      let o;
      if (f < 372) o = { expr: f % 40 < 20 ? 'squint' : 'neutral', look: -0.5, L: 'reach' };
      else if (f < 421) o = { expr: 'smile', look: -0.6, R: 'point' };
      else if (f < 462) o = { expr: beard ? 'dazed' : 'neutral', look: 0.2, R: beard ? 'cheek' : 'hang' };
      else if (f < 476) o = { expr: 'grin', look: 0.5, L: 'chest' };
      else o = { expr: 'pained', look: 0.4, L: 'temple', swirl: q(f * 0.2, 1) };
      out.push(R(beard ? 'marcosB' : 'marcos', life(f, 7, o, f < 421 ? 4 : 1), R3(MARC)));
      if (f >= 462) out.push(R('filho', life(f, 15, { expr: 'smile', look: -0.4 }), R3(SON), { s: q(0.55 * M.back(ramp(f, 462, 470), 2.5), 3) }));
      break;
    }
    case 'day': {
      if (f >= 600) {
        const o = f < 622 ? { expr: 'squint', look: 0.5, R: 'brow' } : { expr: 'laugh', L: 'up', R: 'up', bob: q(hop(f, 622, 0.07), 3) };
        out.push(R('marcosB', life(f, 7, o), R3(MARC)));
        out.push(R('filho', life(f, 15, f < 626 ? { expr: 'smile', look: -0.3 } : { expr: 'laugh', L: 'up', R: 'up', bob: q(hop(f, 626, 0.05), 3) }), R3(SON), { s: 0.55 }));
      }
      break;
    }
    case 'dig': case 'payoff': {
      let o;
      if (f < 674) o = { expr: 'squint', L: 'reach', R: 'reach', look: 0, headTilt: 6 };
      else if (f < 696) o = { expr: 'shock', L: 'reach', R: 'reach', look: 0 };
      else if (f < 742) o = { expr: 'grin', L: 'reach', R: 'reach', look: 0.1, bob: q(nod(f, 698, 0.03) + nod(f, 715, 0.03), 3) };
      else if (f < 780) o = { expr: 'grin', L: 'reach', R: 'reach', look: -0.6 };
      else if (f < 792) o = { expr: 'shock', L: 'reach', R: 'reach', look: -0.6, bob: q(-0.03 * M.back(ramp(f, 780, 786), 3), 3) };
      else o = { expr: 'pained', L: 'reach', R: 'reach', look: 0.2, bob: nod(f, 803, 0.04) };
      out.push(R('marcosB', life(f, 7, o), R3(marcAt(f))));
      if (S.id === 'payoff') out.push(R('filho', life(f, 15, f < 782 ? { expr: 'smile', look: -0.6 } : { expr: 'nervous', L: 'shrug', R: 'shrug', look: -0.3 }), R3(SPAY), { s: 0.55 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1] - 1.125 * s, z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const INK = '#241726';
const drawBill = (p) => { const g = p.g; g.save(); g.translate(300, 500); g.rotate(-0.12); g.fillStyle = '#ffffff'; g.fillRect(-170, -120, 340, 240); g.lineWidth = 12; g.strokeStyle = INK; g.strokeRect(-170, -120, 340, 240);
  g.font = 'bold 64px Arial, "DejaVu Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#d0352f'; g.fillText('BOLETO', 0, -55);
  g.fillStyle = INK; for (let i = 0; i < 26; i++) g.fillRect(-140 + i * 11, 10, i % 3 ? 5 : 8, 80); g.restore(); };

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' && f >= 82 && f < 104) { const t = q((f - 82) / 22, 2); out.push(FX('cb' + t, (p) => T.fxBurst(p, t, '#fff3b0', 12), P3([0, 4.3, -0.2]), 1.6, { order: 1 })); }
  if (S.id === 'chart' && f >= 157 && f < 177) { const t = q((f - 157) / 20, 2); out.push(FX('gb' + t, (p) => T.fxBurst(p, t, '#ffd0a0', 14), P3([3.6, 7.0, -6.2]), 2.6, { order: 1 })); }
  if (S.id === 'y2013' && f >= 218 && f < 246) {
    const t = q((f - 218) / 28, 2); out.push(FX('wb' + t, (p) => T.fxBurst(p, t, '#ffe28a', 14), R3([TVP[0] + 0.1, 1.45, TVP[2] + 0.2]), 0.7, { order: 1 }));
    out.push(FX('ws' + t, (p) => T.fxStars(p, t), R3([MARC[0], 2.1, MARC[2] + 0.1]), 0.45));
  }
  if (S.id === 'lapse') {
    for (const [a, x, z] of [[371, -1.68, -0.89], [381, -1.28, -1.1], [395, -0.89, -1.32]]) if (f >= a && f < a + 12) { const t = q((f - a) / 12, 2); out.push(FX('cs' + a + t, (p) => T.fxSpark(p, t), R3([x, 0.45, z + 0.1]), 0.3)); }
    if (f >= 443 && f < 455) { const t = q((f - 443) / 12, 2); out.push(FX('bp' + t, (p) => T.fxPuff(p, t), R3([MARC[0], 1.45, MARC[2] + 0.12]), 0.35, { alpha: 0.9 })); }
    if (f >= 460 && f < 472) { const t = q((f - 460) / 12, 2); out.push(FX('sp' + t, (p) => T.fxPuff(p, t), R3([SON[0], 0.6, SON[2] + 0.1]), 0.4, { alpha: 0.9 })); }
    if (f >= 478) { const k = M.back(ramp(f, 478, 485), 2.6); out.push(FX('bill', drawBill, R3([1.5, 1.15 + 0.03 * Math.sin(f * 0.3), 0.75]), q(0.42 * k, 2))); }
  }
  if (S.id === 'day' && f >= 617 && f < 640) { const t = q((f - 617) / 23, 2); out.push(FX('ds' + t, (p) => T.fxSpark(p, t), R3([CAL[0] + 0.05, CAL[1] - 0.12, CAL[2] + 0.08]), 0.32)); }
  if (S.id === 'dig') {
    if (f >= 674 && f < 692) { const t = q((f - 674) / 18, 2); out.push(FX('dd' + t, (p) => T.fxDust(p, t), R3([BOX[0], 0.55, BOX[2] + 0.3]), 0.55, { alpha: 0.9 })); }
    if (f >= 713 && f < 728) { const t = q((f - 713) / 15, 2); out.push(FX('st' + t, (p) => T.fxSpark(p, t), R3([MARC[0] + 0.12, 1.2, MARC[2] + 0.45]), 0.25)); }
  }
  if (S.id === 'payoff') {
    if (f >= 780 && f < 796) out.push(FX('bang', (p) => T.fxBang(p), R3([TVP[0] + 0.55, 1.75, TVP[2] + 0.4]), q(0.3 * M.back(ramp(f, 780, 785), 2.5), 2)));
    if (f >= 801) { const t = q(clamp((f - 801) / 16), 2); out.push(FX('sm' + t, (p) => T.fxPuff(p, t), R3([MPAY[0], 1.2 + 0.3 * t, MPAY[2] + 0.35]), 0.42, { alpha: q(lerp(0.95, 0.5, t), 2), tint: '#9a96a8' })); }
  }
  return out;
};

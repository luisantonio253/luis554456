// Painted textures for "O Rio de Janeiro que não tem rio" (same flat-with-dark-seams style as paint.js)
import { rng, stone } from './paint.js';
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

export function sand(seed = 21) {
  const [c, g] = cv(512, 512), r = rng(seed); g.fillStyle = '#ecd59c'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { g.fillStyle = hsl(40 + r() * 8, 50, 72 + r() * 14, .55); g.beginPath(); g.ellipse(r() * 512, r() * 512, 2 + r() * 8, 1 + r() * 4, r() * 3, 0, 7); g.fill(); }
  return c;
}
export function jungle(seed = 22) {
  const [c, g] = cv(512, 512), r = rng(seed); g.fillStyle = '#3f7d36'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { g.fillStyle = hsl(95 + r() * 30, 45, 22 + r() * 22, .8); g.beginPath(); g.ellipse(r() * 512, r() * 512, 10 + r() * 26, 8 + r() * 18, r() * 3, 0, 7); g.fill(); }
  return c;
}
export function rockFace(seed = 23) {
  const [c, g] = cv(512, 1024), r = rng(seed); g.fillStyle = '#8e8a86'; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(60,56,54,${.25 + r() * .3})`; g.lineWidth = 2 + r() * 4; g.beginPath(); let x = r() * 512, y = 0; g.moveTo(x, y); while (y < 1024) { x += r() * 20 - 10; y += 30 + r() * 40; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = hsl(95 + r() * 20, 40, 28 + r() * 14, .85); g.beginPath(); g.ellipse(r() * 512, 1024 * (0.55 + 0.45 * Math.pow(r(), 0.5)), 8 + r() * 20, 6 + r() * 12, 0, 0, 7); g.fill(); }
  return c;
}
export function hullWood(seed = 24) {
  const [c, g] = cv(512, 512), r = rng(seed);
  for (let i = 0; i < 8; i++) { g.fillStyle = hsl(24, 40, 26 + r() * 8); g.fillRect(0, i * 64, 512, 64); g.fillStyle = 'rgba(15,8,4,.9)'; g.fillRect(0, i * 64, 512, 4); for (let k = 0; k < 8; k++) { g.fillStyle = '#1a120c'; g.beginPath(); g.arc(30 + k * 64 + (i % 2) * 32, i * 64 + 32, 3, 0, 7); g.fill(); } }
  return c;
}
export function sail(seed = 25) {
  const [c, g] = cv(512, 512), r = rng(seed); g.fillStyle = '#f3ead2'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(160,140,100,.25)'; g.fillRect(i * 86, 0, 4, 512); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(190,170,130,${.15 + r() * .15})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 40, 10 + r() * 20, 0, 0, 7); g.fill(); }
  g.fillStyle = '#c0262b'; const C = 256, a = 150, b = 40;
  for (let k = 0; k < 4; k++) { g.save(); g.translate(C, C); g.rotate(k * Math.PI / 2); g.beginPath(); g.moveTo(-b * 0.6, 0); g.lineTo(-b * 1.6, -a); g.lineTo(b * 1.6, -a); g.lineTo(b * 0.6, 0); g.closePath(); g.fill(); g.restore(); }
  g.fillStyle = '#f3ead2'; for (let k = 0; k < 4; k++) { g.save(); g.translate(C, C); g.rotate(k * Math.PI / 2); g.fillRect(-8, -a + 14, 16, a - 30); g.restore(); }
  return c;
}
export function asphalt(seed = 26) {
  const [c, g] = cv(512, 512), r = rng(seed); g.fillStyle = '#4a4b52'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = hsl(230, 6, 22 + r() * 30, .6); g.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 3); }
  return c;
}
export function waves() { // black-and-white wave promenade
  const [c, g] = cv(512, 512); g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, 512, 512); g.fillStyle = '#26232a';
  for (let row = 0; row < 4; row++) { g.beginPath(); const y0 = row * 128 + 40; g.moveTo(0, y0);
    for (let x = 0; x <= 512; x += 8) g.lineTo(x, y0 + 30 * Math.sin(x / 512 * Math.PI * 4));
    for (let x = 512; x >= 0; x -= 8) g.lineTo(x, y0 + 52 + 30 * Math.sin(x / 512 * Math.PI * 4)); g.closePath(); g.fill(); }
  return c;
}
export function concrete(seed = 28) {
  const [c, g] = cv(256, 256), r = rng(seed); g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) { g.fillStyle = hsl(40, 6, 60 + r() * 25, .5); g.fillRect(r() * 256, r() * 256, 2, 2); }
  g.fillStyle = 'rgba(80,76,70,.6)'; g.fillRect(0, 0, 256, 4); g.fillRect(0, 0, 4, 256);
  return c;
}
export function facade(seed = 29, hue = 30) {
  const [c, g] = cv(256, 512), r = rng(seed); g.fillStyle = hsl(hue, 45, 72); g.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    const x = 20 + col * 60, y = 20 + row * 62; g.fillStyle = r() < 0.25 ? '#ffe9a8' : '#3a4c66'; g.fillRect(x, y, 38, 40);
    g.fillStyle = hsl(hue, 30, 50); g.fillRect(x - 4, y + 40, 46, 6);
  }
  return c;
}
export const bricks = (seed = 30) => stone(seed, 18, 30, 40, 96, 40);
export function iron() {
  const [c, g] = cv(256, 256); g.fillStyle = '#3c3d44'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#25262c'; g.lineWidth = 8; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); g.moveTo(0, i * 32); g.lineTo(256, i * 32); g.stroke(); }
  g.strokeStyle = '#6a6b74'; g.lineWidth = 2; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * 32 + 4, 0); g.lineTo(i * 32 + 4, 256); g.stroke(); }
  return c;
}
export function doorPlanks(seed = 32) {
  const [c, g] = cv(256, 512), r = rng(seed);
  for (let i = 0; i < 6; i++) { g.fillStyle = hsl(26, 45, 34 + r() * 10); g.fillRect(i * 43, 0, 43, 512); g.fillStyle = 'rgba(20,10,4,.9)'; g.fillRect(i * 43, 0, 3, 512); }
  for (const y of [70, 440]) { g.fillStyle = '#2c2a2e'; g.fillRect(0, y, 256, 34); for (let k = 0; k < 6; k++) { g.fillStyle = '#8a8a90'; g.beginPath(); g.arc(20 + k * 43, y + 17, 6, 0, 7); g.fill(); } }
  return c;
}
/** the calendar page nailed to the mast */
export function calendar() {
  const [c, g] = cv(512, 640); g.fillStyle = '#f3ead2'; g.fillRect(0, 0, 512, 640);
  g.fillStyle = '#b8282b'; g.fillRect(0, 0, 512, 150);
  g.fillStyle = '#fff6e0'; g.textAlign = 'center'; g.font = 'bold 92px Georgia, DejaVu Serif, serif'; g.fillText('JANEIRO', 256, 110);
  g.fillStyle = '#241726'; g.font = 'bold 300px Georgia, DejaVu Serif, serif'; g.fillText('1', 256, 440);
  g.font = 'bold 110px Georgia, DejaVu Serif, serif'; g.fillText('1502', 256, 590);
  g.strokeStyle = '#241726'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 630);
  g.fillStyle = '#5a5a5a'; g.beginPath(); g.arc(256, 30, 12, 0, 7); g.fill();
  return c;
}
/** parchment map of the bay. prog 0..1 = how much of the name is written, seal 0..1, age 0..1 */
export function drawMap(c, prog = 0, seal = 0, age = 0) {
  const g = c.getContext('2d'), W = c.width, H = c.height, r = rng(5);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const gr = g.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7); gr.addColorStop(0, '#f1dfb2'); gr.addColorStop(1, '#c9a66a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(140,100,50,${.05 + r() * .08})`; g.beginPath(); g.ellipse(r() * W, r() * H, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }
  g.fillStyle = '#9ec3c0'; g.fillRect(0, H * 0.82, W, H * 0.18);
  g.beginPath(); g.moveTo(W * 0.45, H * 0.83); g.lineTo(W * 0.45, H * 0.72);
  for (let a = 100; a <= 440; a += 6) { const t = a * Math.PI / 180, w = 1 + 0.07 * Math.sin(3 * t) + 0.05 * Math.sin(7 * t + 1); g.lineTo(W * 0.5 + Math.cos(t) * W * 0.3 * w, H * 0.42 + Math.sin(t) * H * 0.3 * w); }
  g.lineTo(W * 0.55, H * 0.72); g.lineTo(W * 0.55, H * 0.83); g.closePath(); g.fill();
  g.strokeStyle = '#5a3c22'; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.moveTo(0, H * 0.82); g.lineTo(W, H * 0.82); g.stroke();
  for (const [x, y] of [[0.12, 0.3], [0.88, 0.35], [0.1, 0.62], [0.9, 0.66], [0.5, 0.07]]) { g.beginPath(); g.moveTo(W * x - 40, H * y + 30); g.lineTo(W * x, H * y - 30); g.lineTo(W * x + 40, H * y + 30); g.stroke(); }
  g.save(); g.translate(W * 0.88, H * 0.91); g.fillStyle = '#7a2a22'; g.beginPath(); g.moveTo(0, -40); g.lineTo(11, 0); g.lineTo(0, 40); g.lineTo(-11, 0); g.closePath(); g.fill(); g.restore();
  const name = 'Rio de Janeiro', n = Math.floor(name.length * Math.min(1, prog) + 1e-6);
  g.fillStyle = '#3a2412'; g.font = 'italic bold 78px Georgia, DejaVu Serif, serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  const full = g.measureText(name).width, x0 = W / 2 - full / 2;
  g.fillText(name.slice(0, n), x0, H * 0.42);
  if (seal > 0) { const s = Math.min(1, seal), k = 1 + (1 - s) * 0.6; g.save(); g.translate(W * 0.76, H * 0.62); g.scale(k, k); g.globalAlpha = Math.min(1, s * 2);
    g.fillStyle = '#b3242a'; g.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, rr = 58 + (i % 2) * 8; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill();
    g.strokeStyle = '#7a1418'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke(); g.fillStyle = '#f0c0b0'; g.fillRect(-6, -26, 12, 52); g.fillRect(-26, -6, 52, 12); g.restore(); }
  if (age > 0) {
    g.fillStyle = `rgba(110,80,40,${0.35 * age})`; g.fillRect(0, 0, W, H);
    g.strokeStyle = `rgba(250,250,250,${0.85 * age})`; g.lineWidth = 3;
    for (let i = 0; i < 7; i++) { const a = Math.PI * 0.5 * i / 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 280 * age, Math.sin(a) * 280 * age); g.stroke(); }
    for (let k = 1; k <= 4; k++) { g.beginPath(); for (let i = 0; i < 7; i++) { const a = Math.PI * 0.5 * i / 6; g.lineTo(Math.cos(a) * 70 * k * age, Math.sin(a) * 70 * k * age); } g.stroke(); }
  }
  g.strokeStyle = '#6a4a28'; g.lineWidth = 14; g.strokeRect(0, 0, W, H);
}


// ======================= WORLD: "Mais de 100 animais e milhares de portas" =======================
phG.visible = false;
redraw(screen, 'off', (g, w, h) => { g.fillStyle = '#0c0c14'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(80,100,160,.25)'; g.fillRect(0, 0, w, h * 0.4); });
redraw(calS, 'poster', (g, w, h) => { drawCover(g, w, h, 5, '#ff9a4a', '#7a3ad0', 17); g.lineWidth = 12; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h); });
redraw(winS, 'w0', (g, w, h) => drawWin(g, w, h, 0));

const backdrop = (par, seed, n = 24, r0 = 170, r1 = 290) => { const r = P.rng(seed);
  for (let i = 0; i < n; i++) { const a = i / n * 6.283 + r() * 0.2, d = r0 + r() * (r1 - r0), h = 16 + r() * 26; const m = add(new THREE.SphereGeometry(1, 14, 8), i % 3 ? M.hill : M.mount, Math.cos(a) * d, -2, Math.sin(a) * d, par, { cast: false }); m.scale.set(45 + r() * 45, h, 45 + r() * 45); } };
const clouds2 = [];
for (const [o, seed] of [[LE, 3], [NA, 5], [CN, 8]]) { const r = P.rng(seed * 13);
  for (let i = 0; i < 9; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + seed);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = rx(200 + i * 17 + r() * 10), d = 380 + r() * 160; m.position.set(o[0] + Math.cos(a) * d, 90 + r() * 110, o[2] + Math.sin(a) * d); m.scale.setScalar(110 + r() * 90);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds2.push(m);
  } }

// ---------- shared props ----------
M.dog = toon({ color: '#d9a05a' }); M.dogD = toon({ color: '#9a6634' }); M.dogL = toon({ color: '#f4e0bc' }); M.tongue = toon({ color: '#ff7a8a' });
const mkDog = (par) => {
  const root = new THREE.Group(); par.add(root); const g = new THREE.Group(); g.scale.setScalar(1.1); root.add(g);
  const SP = (sx, sy, sz, x, y, z, mat, p = g) => { const m = add(new THREE.SphereGeometry(1, 14, 10), mat, x, y, z, p); m.scale.set(sx, sy, sz); return m; };
  SP(0.16, 0.14, 0.29, 0, 0.36, 0, M.dog); SP(0.12, 0.08, 0.2, 0, 0.3, 0.06, M.dogL);
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const lg = new THREE.Group(); lg.position.set(sx * 0.085, 0.3, sz * 0.17); g.add(lg);
    add(new THREE.CylinderGeometry(0.04, 0.035, 0.28, 8), M.dog, 0, -0.14, 0, lg); SP(0.05, 0.03, 0.065, 0, -0.28, 0.02, M.dogL, lg); legs.push(lg); }
  const head = new THREE.Group(); head.position.set(0, 0.52, 0.25); g.add(head);
  SP(0.135, 0.125, 0.125, 0, 0, 0, M.dog, head); SP(0.07, 0.06, 0.09, 0, -0.035, 0.11, M.dogL, head); SP(0.032, 0.025, 0.025, 0, -0.005, 0.2, M.ink, head);
  for (const s of [-1, 1]) { SP(0.03, 0.03, 0.03, s * 0.055, 0.04, 0.1, M.white, head); SP(0.016, 0.018, 0.016, s * 0.055, 0.042, 0.125, M.ink, head); }
  const ears = [-1, 1].map((s) => { const e = new THREE.Group(); e.position.set(s * 0.1, 0.08, -0.01); head.add(e); SP(0.045, 0.1, 0.03, 0, -0.07, 0, M.dogD, e); return e; });
  const tongue = add(tbox(0.045, 0.012, 0.08, 1), M.tongue, 0, -0.085, 0.16, head, { cast: false }); tongue.rotation.x = 0.7;
  const tail = new THREE.Group(); tail.position.set(0, 0.42, -0.26); g.add(tail);
  add(new THREE.CylinderGeometry(0.025, 0.016, 0.24, 7).translate(0, 0.12, 0), M.dog, 0, 0, 0, tail); tail.rotation.x = -0.7;
  return { root, head, ears, tail, tongue, legs };
};
const poseDog = (D, s) => {
  D.root.position.set(s.x, s.y, s.z); D.root.rotation.set(0, s.yaw, 0); D.head.rotation.set(-s.head, 0, 0);
  D.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (0.25 + s.ear); });
  D.tail.rotation.set(-0.7 + (s.sad ? 1.3 : 0), 0, s.tail); D.tongue.visible = s.tongue > 0.5;
  D.legs.forEach((l, i) => { l.rotation.x = s.walk ? 0.5 * Math.sin(s.walk + (i === 0 || i === 3 ? 0 : Math.PI)) : 0; });
};
const hazMat2 = new THREE.MeshBasicMaterial({ color: '#ffb020' });
const mkCar = (par, x, z, yaw, col) => { const g = new THREE.Group(); g.position.set(x, 0.06, z); g.rotation.y = yaw; par.add(g); const mb = toon({ color: col });
  add(tbox(1.9, 0.6, 4.4, 1), mb, 0, 0.55, 0, g); add(tbox(1.6, 0.5, 2.0, 1), mb, 0, 1.1, -0.2, g);
  add(tbox(1.5, 0.42, 0.04, 1), M.glass, 0, 1.1, 0.81, g, { cast: false }); add(tbox(1.5, 0.42, 0.04, 1), M.glass, 0, 1.1, -1.21, g, { cast: false });
  for (const s of [-1, 1]) add(tbox(0.04, 0.38, 1.6, 1), M.glass, s * 0.81, 1.1, -0.2, g, { cast: false });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) add(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14).rotateZ(Math.PI / 2), M.tvBk, wx, 0.34, wz, g);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#fffbe0' }), s * 0.65, 0.62, 2.18, g, { cast: false });
  for (const [hx_, hz] of [[-0.88, 2.2], [0.88, 2.2], [-0.88, -2.2], [0.88, -2.2]]) add(new THREE.SphereGeometry(0.09, 8, 6), hazMat2, hx_, 0.72, hz, g, { cast: false });
  return g; };

// ---------- interior paintings (seen through open doors) ----------
const drawRoom = (g, w, h, kind) => {
  const pal = { home: ['#f2d6a8', '#b8744a'], loja: ['#e8f2ff', '#c8ccd2'], bar: ['#3a2450', '#5a3a2a'], academia: ['#ffe8c8', '#8a8a92'], cafe: ['#f8e0c0', '#9a6a44'], pet: ['#d8f4e0', '#c8a878'] }[kind];
  g.fillStyle = pal[0]; g.fillRect(0, 0, w, h); g.fillStyle = pal[1]; g.fillRect(0, h * 0.74, w, h * 0.26);
  const gr = g.createRadialGradient(w / 2, h * 0.12, 10, w / 2, h * 0.2, w * 0.6); gr.addColorStop(0, 'rgba(255,240,190,.75)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff4c0'; g.beginPath(); g.arc(w / 2, 28, 22, 0, 7); g.fill();
  const lab = (s, col, y = 205, px = 84) => txt(g, s, w / 2, y, px, col, INKC, 10);
  if (kind === 'home') { g.fillStyle = '#4f7a8a'; rr(g, 150, 250, 340, 110, 26); g.fill(); g.fillStyle = '#3e6272'; rr(g, 150, 210, 340, 70, 20); g.fill();
    g.fillStyle = '#ffd36a'; g.fillRect(250, 70, 140, 100); g.lineWidth = 8; g.strokeStyle = INKC; g.strokeRect(250, 70, 140, 100); g.fillStyle = '#c75a4a'; g.fillRect(170, 380, 300, 18); }
  if (kind === 'loja') { lab('LOJA', '#e2453c'); for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { g.fillStyle = PCOL[(r + c) % 5]; g.fillRect(70 + c * 56, 262 + r * 62, 40, 46); } g.fillStyle = '#8a929c'; for (let r = 0; r < 3; r++) g.fillRect(50, 310 + r * 62, 540, 8); }
  if (kind === 'bar') { g.shadowColor = '#ff4fb0'; g.shadowBlur = 30; lab('BAR', '#ff6ac0'); g.shadowBlur = 0; for (let i = 0; i < 10; i++) { g.fillStyle = PCOL[i % 5]; g.fillRect(80 + i * 50, 270, 26, 70); } g.fillStyle = '#7a4a2a'; g.fillRect(40, 340, 560, 70); }
  if (kind === 'academia') { lab('ACADEMIA', '#d0352f', 205, 72); g.fillStyle = INKC; g.fillRect(180, 320, 280, 18); for (const x of [170, 450]) { g.fillRect(x - 20, 270, 40, 120); } g.fillStyle = '#e2453c'; rr(g, 260, 330, 120, 40, 10); g.fill(); }
  if (kind === 'cafe') { lab('CAFÉ', '#7a4a24'); for (let i = 0; i < 4; i++) { g.fillStyle = '#ffffff'; rr(g, 130 + i * 110, 300, 60, 60, 10); g.fill(); g.lineWidth = 6; g.strokeStyle = INKC; g.stroke(); g.fillStyle = '#6a3a1e'; g.fillRect(138 + i * 110, 308, 44, 12); } g.fillStyle = '#9a6a44'; g.fillRect(60, 330, 520, 40); }
  if (kind === 'pet') { lab('PET SHOP', '#2a7a3a', 205, 72); for (let i = 0; i < 4; i++) { g.save(); g.translate(150 + i * 110, 320); g.fillStyle = '#ffffff'; g.fillRect(-36, -9, 72, 18); for (const s of [-1, 1]) for (const t of [-1, 1]) { g.beginPath(); g.arc(s * 38, t * 9, 12, 0, 7); g.fill(); } g.restore(); } }
  g.lineWidth = 14; g.strokeStyle = 'rgba(40,24,40,.55)'; g.strokeRect(0, 0, w, h);
};

// ---------- LE: Leonida street (day) ----------
const le = new THREE.Group(); le.position.set(...LE); scene.add(le);
backdrop(le, 31);
slab(-30, 62, -14, 2.0, le, M.grass, 0.02); slab(-30, 62, 2.0, 3.4, le, M.concrete, 0.12); slab(-30, 62, 3.4, 14, le, M.asphalt, 0.04, 0.7, 4);
for (let x = -28; x < 60; x += 6) add(tbox(2.5, 0.01, 0.15, 1), M.yellow, x, 0.045, 8.6, le, { cast: false });
slab(-3.6, -1.0, -4.4, 2.0, le, M.concrete, 0.06);
const KINDS = { '-8': 'home', 0: 'home', 8: 'loja', 16: 'bar', 24: 'academia', 32: 'cafe', 40: 'pet' };
const HUES = [30, 190, 350, 48, 210, 120, 12];
const doorHinges = []; M.win = toon({ color: '#5f8fb0' });
HOUSES.forEach((x, i) => {
  const wm = texM(P.plaster(60 + i, HUES[i % HUES.length]), 1, 1), dm = toon({ color: ['#2f62a8', '#b8282b', '#2a7a3a', '#f2a93a', '#7b5ac9', '#2fa7a5', '#e2453c'][i] });
  add(tbox(2.9, 3.25, 0.25, 2), wm, x - 2.05, 1.625, -4.5, le); add(tbox(2.9, 3.25, 0.25, 2), wm, x + 2.05, 1.625, -4.5, le);
  add(tbox(1.2, 1.05, 0.25, 2), wm, x, 2.725, -4.5, le);
  for (const s of [-1, 1]) add(tbox(0.25, 3.25, 6.5, 2), wm, x + s * 3.5, 1.625, -7.75, le);
  add(tbox(7, 3.25, 0.25, 2), wm, x, 1.625, -11, le);
  add(tbox(7.8, 0.3, 7.3, 2), M.white, x, 3.4, -7.7, le); add(tbox(7.9, 0.5, 0.2, 2), M.roofT, x, 3.55, -4.0, le);
  for (const s of [-1, 1]) { add(tbox(1.3, 1.0, 0.06, 1), M.win, x + s * 2.1, 1.7, -4.35, le, { cast: false }); add(tbox(1.5, 0.12, 0.16, 1), M.white, x + s * 2.1, 1.14, -4.32, le); }
  add(tbox(1.4, 0.12, 0.12, 1), M.white, x, 2.26, -4.33, le); for (const s of [-1, 1]) add(tbox(0.1, 2.25, 0.12, 1), M.white, x + s * 0.65, 1.12, -4.33, le);
  add(tbox(1.2, 0.02, 0.6, 1), M.rug, x, 0.035, -4.0, le, { cast: false });
  // inside: floor, dark sleeve, lit painting
  add(tbox(6.7, 0.08, 6.2, 2), M.plank, x, 0.06, -7.75, le, { cast: false });
  for (const s of [-1, 1]) add(tbox(0.1, 2.6, 1.8, 1), M.tvBk, x + s * 1.65, 1.3, -5.4, le, { cast: false });
  add(tbox(3.4, 0.1, 1.8, 1), M.tvBk, x, 2.62, -5.4, le, { cast: false });
  const rm = mkSign(3.2, 2.5, 640, 500, le, x, 1.3, -6.25, true); redraw(rm, 'r', (g, w, h) => drawRoom(g, w, h, KINDS[x]));
  const hg = new THREE.Group(); hg.position.set(x - 0.57, 0.1, -4.44); le.add(hg);
  add(tbox(1.14, 2.14, 0.07, 1), dm, 0.57, 1.07, 0, hg); add(new THREE.SphereGeometry(0.045, 8, 6), M.yellow, 1.0, 1.02, 0.06, hg, { cast: false });
  for (const yy of [0.55, 1.55]) add(tbox(0.8, 0.6, 0.02, 1), toon({ color: '#ffffff', transparent: true, opacity: 0.18 }), 0.57, yy, 0.04, hg, { cast: false });
  doorHinges.push(hg);
});
for (const [x, z, h, s] of [[-4.6, -3.2, 6.4, 1], [4.4, -3.1, 6.8, 2], [12.2, -3.3, 6.2, 3], [20.0, -3.1, 7.0, 4], [28.1, -3.2, 6.5, 5], [36.0, -3.2, 6.9, 6], [44.2, -3.1, 6.2, 7], [-11.5, -3.2, 6.6, 8]]) mkPalm(le, x, z, h, 0.1 * (s % 2 ? 1 : -1), 40 + s, 0.02);
{ const mb = new THREE.Group(); mb.position.set(-5.6, 0, 1.4); le.add(mb); add(tbox(0.08, 1.0, 0.08, 1), M.white, 0, 0.5, 0, mb); add(tbox(0.3, 0.26, 0.45, 1), M.red, 0, 1.1, 0, mb); }
add(new THREE.CylinderGeometry(0.13, 0.16, 0.55, 10), M.red, 3.0, 0.4, 2.6, le);
mkCar(le, CARP[0], CARP[2], 0.25, '#2fd0c8');
const bagG = new THREE.Group(); bagG.position.set(...BAG); le.add(bagG);
{ M.sack = toon({ color: '#c9a86a' }); const s = add(new THREE.SphereGeometry(1, 16, 12), M.sack, 0, 0.3, 0, bagG); s.scale.set(0.3, 0.32, 0.28);
  add(new THREE.CylinderGeometry(0.07, 0.12, 0.14, 10), M.sack, 0, 0.64, 0, bagG); add(new THREE.TorusGeometry(0.08, 0.025, 6, 12).rotateX(Math.PI / 2), M.darkWood, 0, 0.6, 0, bagG);
  const d = mkSign(0.3, 0.3, 160, 160, bagG, 0, 0.32, 0.285, true); redraw(d, '$', (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#c9a86a'; g.fillRect(0, 0, w, h); txt(g, '$', w / 2, h / 2 + 6, 140, '#2a7a3a', INKC, 10); }); }
const dog = mkDog(le);
const menuG = new THREE.Group(); menuG.position.set(...MENU); le.add(menuG);
const menuS = mkSign(0.86, 0.72, 600, 500, menuG, 0, 0, 0, true);
const MROWS = [['CARINHO', '#ff3a6a', 'heart'], ['BRONCA', '#ffb020', 'bang'], ['ESTUDAR', '#4fd8ff', 'mag']];
const drawMenu = (g, w, h, S) => {
  g.fillStyle = 'rgba(16,14,30,.88)'; rr(g, 6, 6, w - 12, h - 12, 40); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.stroke();
  MROWS.forEach(([lab, col, ic], i) => { const y = 105 + i * 145, on = S.sel === i, k = on ? 1 + 0.12 * S.k : 1;
    g.save(); g.translate(w / 2, y); g.scale(k, k);
    if (on) { g.fillStyle = '#ffd23f'; rr(g, -265, -58, 530, 116, 30); g.fill(); }
    g.beginPath(); g.arc(-200, 0, 44, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 7; g.strokeStyle = INKC; g.stroke();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff';
    if (ic === 'heart') { g.beginPath(); g.moveTo(-200, 18); g.bezierCurveTo(-232, -4, -222, -32, -200, -14); g.bezierCurveTo(-178, -32, -168, -4, -200, 18); g.fill(); }
    if (ic === 'bang') txt(g, '!', -200, 4, 70, '#ffffff');
    if (ic === 'mag') { g.lineWidth = 9; g.beginPath(); g.arc(-206, -6, 17, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-194, 6); g.lineTo(-178, 22); g.stroke(); }
    g.font = FONT(70); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = on ? INKC : '#ffffff'; g.fillText(lab, -130, 4);
    g.restore(); });
};
const cmpG = new THREE.Group(); cmpG.position.set(...CMP); le.add(cmpG);
for (const s of [-1, 1]) add(tbox(0.12, 3.4, 0.12, 1), M.darkWood, s * 1.5, 1.7, -0.08, cmpG);
add(tbox(3.6, 2.6, 0.1, 1), M.darkWood, 0, 2.2, -0.04, cmpG);
const cmpS = mkSign(3.4, 2.4, 850, 600, cmpG, 0, 2.2, 0.02, true);
const doorIcon = (g, x, y, s, lit) => { g.fillStyle = lit ? '#ffd23f' : '#8a8a92'; g.fillRect(x - 18 * s, y - 32 * s, 36 * s, 64 * s); g.lineWidth = 4 * s; g.strokeStyle = INKC; g.strokeRect(x - 18 * s, y - 32 * s, 36 * s, 64 * s);
  if (lit) { g.fillStyle = '#7a4a24'; g.fillRect(x - 18 * s, y - 32 * s, 10 * s, 64 * s); } else { g.fillStyle = INKC; g.beginPath(); g.arc(x + 9 * s, y, 3.5 * s, 0, 7); g.fill(); } };
const drawCmp = (g, w, h, S) => {
  g.fillStyle = '#e6e2da'; g.fillRect(0, 0, w / 2, h); g.fillStyle = '#fbf6e8'; g.fillRect(w / 2, 0, w / 2, h);
  txt(g, 'GTA V', w / 4, 80, 76, '#6a6a72'); txt(g, 'GTA VI', w * 0.75, 80, 76, '#d0352f');
  for (let i = 0; i < 3; i++) doorIcon(g, 110 + i * 100, 330, 1.6, false);
  txt(g, 'TRANCADO', w / 4, 520, 50, '#6a6a72');
  for (let i = 0; i < 20; i++) doorIcon(g, 490 + (i % 5) * 76, 190 + Math.floor(i / 5) * 92, 1.05, i < S.n);
  txt(g, 'ABERTO', w * 0.75, 560, 50, '#2a7a3a');
  g.fillStyle = INKC; g.fillRect(w / 2 - 4, 20, 8, h - 40); g.lineWidth = 12; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
};

// ---------- NA: lagoon + road (Leonida wildlife) ----------
const na = new THREE.Group(); na.position.set(...NA); scene.add(na);
backdrop(na, 37, 26, 160, 280);
slab(-40, 40, -2, 4, na, M.grass, 0.02); slab(-40, 40, 4, 12, na, M.asphalt, 0.04, 0.7, 4);
for (let x = -38; x < 40; x += 6) add(tbox(2.5, 0.01, 0.15, 1), M.yellow, x, 0.045, 8.0, na, { cast: false });
{ const g = new THREE.PlaneGeometry(260, 200); g.rotateX(-Math.PI / 2); const w = new THREE.Mesh(g, mkWater(0.4, [0.05, 0.08])); w.position.set(0, -0.08, -102); w.userData.nd = waterNd; na.add(w); }
{ const r = P.rng(71); for (let i = 0; i < 40; i++) { const x = -40 + i * 2 + r() * 1.5, z = -22 - r() * 8, s = 2 + r() * 2.5; const m = add(new THREE.SphereGeometry(1, 10, 8), i % 2 ? M.tree : M.tree2, x, s * 0.5, z, na, { cast: false }); m.scale.set(s, s * 0.8, s); }
  for (let i = 0; i < 26; i++) { const x = -12 + r() * 16, z = -2.2 - r() * 1.8; const c = add(new THREE.CylinderGeometry(0.02, 0.03, 0.8 + r() * 0.6, 5), M.palm, x, 0.3, z, na, { cast: false }); c.rotation.z = (r() - 0.5) * 0.3; } }
for (const [x, z, h, s] of [[-9, 1.0, 6.4, 1], [9.5, 1.2, 7.0, 2], [12.5, -0.5, 6.2, 3], [-14, 0.4, 6.8, 4]]) mkPalm(na, x, z, h, 0.12 * (s % 2 ? 1 : -1), 60 + s, 0.02);
{ const rk = add(new THREE.SphereGeometry(1, 12, 8), toon({ color: '#8a8a80' }), ROCK[0], 0.15, ROCK[2], na); rk.scale.set(0.55, 0.32, 0.45); }
const billG = new THREE.Group(); billG.position.set(...BILL); na.add(billG);
for (const s of [-1, 1]) add(tbox(0.14, 4.0, 0.14, 1), M.darkWood, s * 1.8, 2.0, -0.1, billG);
add(tbox(4.4, 2.8, 0.12, 1), M.darkWood, 0, 2.7, -0.05, billG);
const billS = mkSign(4.2, 2.6, 1050, 650, billG, 0, 2.7, 0.02);
const drawBill = (g, w, h, B) => {
  g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a7a3a'; g.fillRect(0, 0, w, 120);
  if (B.lp > 0) { g.save(); g.translate(w / 2, 62); g.scale(B.lp, B.lp); txt(g, 'EM LEONIDA', 0, 0, 84, '#ffffff'); g.restore(); } else txt(g, 'CONFIRMADO:', w / 2, 62, 72, '#d8f0d8');
  txt(g, B.n + '+', 255, 305, 190, '#d0352f', INKC, 12); txt(g, 'ESPÉCIES', 775, 262, 84, '#1d2a4a'); txt(g, 'DE ANIMAIS', 775, 356, 66, '#1d2a4a');
  const chip = (x, s, lab) => { if (s <= 0) return; g.save(); g.translate(x, 540); g.scale(s, s); g.fillStyle = '#ffd23f'; rr(g, -230, -52, 460, 104, 24); g.fill(); g.lineWidth = 7; g.strokeStyle = INKC; g.stroke(); txt(g, lab, 0, 4, 54, INKC); g.restore(); };
  chip(265, B.b, '60+ PÁSSAROS'); chip(785, B.m, '30+ MAMÍFEROS');
  g.lineWidth = 12; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
};
M.flam = toon({ color: '#ff8ab0' }); M.flamD = toon({ color: '#e0607e' });
const flams = FLAM.map(([x, z], i) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = 0.6 + i * 1.3; na.add(g);
  const b = add(new THREE.SphereGeometry(1, 14, 10), M.flam, 0, 1.0, 0, g); b.scale.set(0.2, 0.17, 0.32);
  const n1 = add(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 7), M.flam, 0, 1.28, 0.2, g); n1.rotation.x = 0.5;
  const n2 = add(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 7), M.flam, 0, 1.55, 0.25, g); n2.rotation.x = -0.4;
  add(new THREE.SphereGeometry(0.07, 10, 8), M.flam, 0, 1.72, 0.2, g);
  const bk = add(new THREE.ConeGeometry(0.03, 0.12, 6), M.ink, 0, 1.68, 0.3, g); bk.rotation.x = 2.2;
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), M.flamD, s * 0.05, 0.42, 0, g, { cast: false });
  g.visible = false; return g; });
const gN = mkGator(na);

// ---------- CN: the GTA 5 "TV set" town (past) ----------
const cn = new THREE.Group(); cn.position.set(...CN); scene.add(cn);
backdrop(cn, 43, 22, 150, 260);
slab(-22, 22, 0.2, 16, cn, M.asphalt, 0.04, 0.7, 4); slab(-22, 22, -14, 0.2, cn, M.sand, 0.02);
for (let x = -20; x < 22; x += 6) add(tbox(2.5, 0.01, 0.15, 1), M.white, x, 0.045, 9.0, cn, { cast: false });
const FAC = [['HOSPITAL', '#f4f1ea', '#d0352f'], ['HOTEL', '#7fb0d8', '#1d2a4a'], ['ESCRITÓRIO', '#c8c0b0', '#2a4a7a']];
const drawFacade = (g, w, h, k, on, lock) => {
  const [lab, base, ink] = FAC[k]; g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < h; y += 40) g.fillRect(0, y, w, 3);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const x = 70 + c * 160, y = 220 + r * 120; if (r === 1 && (c === 1 || c === 2)) continue;
    g.fillStyle = '#8fc4dc'; g.fillRect(x, y, 90, 80); g.lineWidth = 6; g.strokeStyle = INKC; g.strokeRect(x, y, 90, 80); g.beginPath(); g.moveTo(x + 45, y); g.lineTo(x + 45, y + 80); g.stroke(); }
  g.fillStyle = on ? '#ffe28a' : '#e8e0cc'; rr(g, 90, 50, w - 180, 120, 18); g.fill(); g.lineWidth = 7; g.strokeStyle = INKC; g.stroke();
  if (on) { g.shadowColor = '#ffd23f'; g.shadowBlur = 30; } txt(g, lab, w / 2, 112, k === 2 ? 76 : 88, ink); g.shadowBlur = 0;
  if (k === 0) { g.fillStyle = '#d0352f'; g.fillRect(w - 80, 60, 30, 90); g.fillRect(w - 110, 90, 90, 30); }
  // the painted door
  const dx = w / 2 - 55, dy = h - 220; g.fillStyle = ['#7a4a2a', '#2f62a8', '#4a4a52'][k]; g.fillRect(dx, dy, 110, 220); g.lineWidth = 7; g.strokeStyle = INKC; g.strokeRect(dx, dy, 110, 220);
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(dx + 16, dy + 20, 78, 70); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(dx + 90, dy + 120, 8, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(dx + 110, dy + 8, 10, 212);
  if (lock > 0) { g.save(); g.translate(w / 2, dy + 50); g.rotate(-0.12); g.scale(lock, lock); g.fillStyle = '#e0283a'; rr(g, -72, -24, 144, 48, 8); g.fill(); g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.stroke(); txt(g, 'FECHADO', 0, 2, 30, '#ffffff'); g.restore(); }
};
const facades = PANELS.map((x, k) => {
  add(tbox(7, 6, 0.12, 2), M.plank, x, 3, 0, cn);
  const s = mkSign(7, 6, 700, 600, cn, x, 3, 0.065);
  for (const bx of [-2.6, 0, 2.6]) { const b = add(tbox(0.12, 6.31, 0.12, 2), M.beam, x + bx, 2.75, -1.65, cn); b.rotation.x = 0.513; add(tbox(0.5, 0.3, 0.4, 1), M.sack || toon({ color: '#c9a86a' }), x + bx, 0.17, -3.2, cn); }
  for (const yy of [1.5, 4.5]) add(tbox(7, 0.14, 0.1, 2), M.beam, x, yy, -0.12, cn);
  return s; });
for (const sx of [-1, 1]) { const g = new THREE.Group(); g.position.set(sx * 12.5, 0, 7.5); g.rotation.y = sx * 0.6 + Math.PI; cn.add(g);
  for (let i = 0; i < 3; i++) { const l = add(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), M.tvBk, Math.cos(i * 2.1) * 0.35, 1.1, Math.sin(i * 2.1) * 0.35, g); l.rotation.set(Math.sin(i * 2.1) * 0.3, 0, -Math.cos(i * 2.1) * 0.3); }
  add(tbox(0.6, 0.5, 0.7, 1), M.tvBk, 0, 2.5, 0, g); add(new THREE.CircleGeometry(0.24, 16), new THREE.MeshBasicMaterial({ color: '#fff4c8' }), 0, 2.5, -0.36, g, { cast: false }).rotation.y = Math.PI; }
{ const g = new THREE.Group(); g.position.set(11, 0, -5.5); g.rotation.set(0, 0.4, -0.25); cn.add(g); for (const s of [-1, 1]) add(tbox(0.08, 3.2, 0.08, 1), M.wood, s * 0.25, 1.6, 0, g); for (let i = 0; i < 8; i++) add(tbox(0.5, 0.05, 0.06, 1), M.wood, 0, 0.3 + i * 0.38, 0, g); }
const gtavG = new THREE.Group(); gtavG.position.set(1.05, 0, 1.55); cn.add(gtavG);
add(tbox(0.08, 1.4, 0.08, 1), M.darkWood, 0, 0.7, -0.05, gtavG);
{ const s = mkSign(0.96, 0.64, 480, 320, gtavG, 0, 1.6, 0, true); redraw(s, 'v', (g, w, h) => { g.fillStyle = '#1d2a4a'; g.fillRect(0, 0, w, h); g.lineWidth = 14; g.strokeStyle = '#ffd23f'; g.strokeRect(7, 7, w - 14, h - 14);
  txt(g, 'GTA V', w / 2, 120, 120, '#ffffff'); txt(g, '2013', w / 2, 240, 90, '#ffd23f'); }); }

// ---------- RO additions: the PC desk (mod scene) ----------
add(tbox(1.3, 0.06, 0.65, 1), M.wood, DESK[0], 0.76, DESK[2], ro);
for (const [dx, dz] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]]) add(tbox(0.05, 0.74, 0.05, 1), M.darkWood, DESK[0] + dx, 0.37, DESK[2] + dz, ro);
add(tbox(0.25, 0.5, 0.5, 1), M.tvBk, DESK[0] + 0.45, 0.25, DESK[2], ro);
add(tbox(0.12, 0.25, 0.08, 1), M.tvBk, DESK[0], 0.9, DESK[2] - 0.1, ro); add(tbox(0.74, 0.46, 0.05, 1), M.tvBk, DESK[0], 1.2, DESK[2] - 0.08, ro);
const monS = mkSign(0.68, 0.4, 480, 284, ro, DESK[0], 1.2, DESK[2] - 0.05, true);
add(tbox(0.5, 0.02, 0.16, 1), M.tvBk, DESK[0] - 0.05, 0.8, DESK[2] + 0.15, ro); add(tbox(0.07, 0.02, 0.1, 1), M.white, DESK[0] + 0.3, 0.8, DESK[2] + 0.16, ro);
const drawMon2 = (g, w, h, S) => {
  g.fillStyle = '#10204a'; g.fillRect(0, 0, w, h);
  if (S.m === 'mod') { txt(g, 'INSTALANDO MOD...', w / 2, 64, 40, '#ffffff'); txt(g, 'abrir_predios.zip', w / 2, 118, 30, '#8fc4ff');
    g.fillStyle = '#2a3a6a'; g.fillRect(40, 168, w - 80, 40); g.fillStyle = '#4fd86a'; g.fillRect(40, 168, (w - 80) * S.p, 40); g.lineWidth = 4; g.strokeStyle = '#ffffff'; g.strokeRect(40, 168, w - 80, 40);
    txt(g, Math.round(S.p * 100) + '%', w / 2, 244, 36, '#ffffff'); return; }
  g.save(); g.translate(w / 2, 110); g.scale(S.s, S.s); doorIcon(g, -60, 0, 1.4, true); g.beginPath(); g.arc(50, 0, 44, 0, 7); g.fillStyle = '#2fae55'; g.fill();
  g.lineWidth = 12; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 2); g.lineTo(46, 18); g.lineTo(72, -16); g.stroke(); g.restore();
  txt(g, 'PRÉDIO ABERTO!', w / 2, 230, 44, '#ffd23f');
};

// ---------- MP: the sticker album board ----------
const critter = (g, k, sc = 1) => { g.save(); g.scale(sc, sc); g.lineJoin = 'round';
  const E = (x, y, rx_, ry, col, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx_, ry, rot, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 4; g.strokeStyle = INKC; g.stroke(); };
  const eye = (x, y) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fillStyle = INKC; g.fill(); };
  if (k === 0) { g.strokeStyle = '#ff8ab0'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(40, -40, 20, -60); g.stroke(); E(0, 10, 34, 22, '#ff8ab0'); E(22, -62, 11, 9, '#ff8ab0'); eye(24, -64); g.strokeStyle = '#e0607e'; g.lineWidth = 4; g.beginPath(); g.moveTo(-4, 30); g.lineTo(-4, 70); g.moveTo(8, 30); g.lineTo(8, 70); g.stroke(); }
  else if (k === 1) { E(0, 20, 40, 24, '#d9a05a'); E(-36, -8, 22, 20, '#d9a05a'); E(-48, -24, 8, 14, '#9a6634', 0.4); eye(-40, -10); }
  else if (k === 2) { E(0, 0, 44, 22, '#ffb020'); g.beginPath(); g.moveTo(40, 0); g.lineTo(66, -20); g.lineTo(66, 20); g.closePath(); g.fillStyle = '#ffb020'; g.fill(); g.stroke(); eye(-24, -4); }
  else if (k === 3) { E(0, 20, 42, 24, '#b87a44'); E(-38, -16, 18, 16, '#b87a44'); g.strokeStyle = '#7a4a24'; g.lineWidth = 6; g.beginPath(); g.moveTo(-44, -30); g.lineTo(-56, -60); g.moveTo(-32, -30); g.lineTo(-26, -60); g.stroke(); eye(-42, -18); }
  else if (k === 4) { E(0, 15, 48, 26, '#1a1420'); E(-44, -12, 22, 20, '#1a1420'); txt(g, '?', 4, 10, 80, '#ffd23f'); }
  else if (k === 5) { E(0, 15, 40, 26, '#8a8a92'); E(-34, -12, 22, 19, '#9a9aa2'); E(-34, -14, 20, 7, '#2a2a32'); }
  else if (k === 6) { E(0, 12, 46, 16, '#5ab84a'); E(-50, 4, 18, 12, '#5ab84a'); eye(-54, 0); }
  else if (k === 7) { E(0, 10, 34, 22, '#ffffff'); g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.beginPath(); g.moveTo(-20, 0); g.quadraticCurveTo(-40, -30, -26, -54); g.stroke(); E(-24, -56, 10, 8, '#ffffff'); eye(-26, -57); }
  else { gatorShape(g, 0, 0, 0.55); }
  g.restore(); };
const NAMES = ['RARO', 'CACHORRO', 'PEIXE', 'CERVO', 'ESCONDIDO', 'GUAXINIM', 'IGUANA', 'GARÇA', 'LENDÁRIO'];
const drawAlbum = (g, w, h, A) => {
  g.fillStyle = '#fbf3df'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,90,60,.12)'; g.lineWidth = 2; for (let y = 240; y < h; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.fillStyle = '#2a7a3a'; g.fillRect(0, 0, w, 230); txt(g, 'ÁLBUM DE LEONIDA', w / 2, 92, 70, '#ffffff', INKC, 10); txt(g, 'FAUNA · 170+ ESPÉCIES', w / 2, 178, 40, '#ffd23f');
  SLOTS.forEach(([cx, cy], k) => {
    g.save(); g.translate(cx, cy); g.setLineDash([14, 10]); g.lineWidth = 5; g.strokeStyle = 'rgba(80,60,50,.5)'; rr(g, -110, -100, 220, 200, 18); g.stroke(); g.setLineDash([]);
    txt(g, String(k + 1), 0, 0, 70, 'rgba(80,60,50,.25)');
    const s = A.s[k]; if (s > 0) {
      g.scale(s, s); g.rotate((k % 3 - 1) * 0.04);
      const frame = k === 0 ? '#b8c4d0' : k === 8 ? '#ffc83a' : k === 4 ? '#5a4a6a' : '#ffffff';
      if (k === 8) { g.shadowColor = '#ffd23f'; g.shadowBlur = 30 + 30 * A.glow; }
      g.fillStyle = frame; rr(g, -108, -98, 216, 196, 16); g.fill(); g.shadowBlur = 0; g.lineWidth = 6; g.strokeStyle = INKC; g.stroke();
      g.fillStyle = k === 4 ? '#3a2e4a' : '#dff2ff'; rr(g, -92, -84, 184, 128, 10); g.fill();
      g.save(); g.translate(0, -20); critter(g, k, 1.05); g.restore();
      txt(g, NAMES[k], 0, 72, k === 4 ? 30 : 34, k === 8 ? '#7a4a00' : k === 4 ? '#ffd23f' : INKC);
    }
    g.restore(); });
  g.lineWidth = 12; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
};

// ---------- per-frame world state ----------
function worldState(S, f) {
  poseDog(dog, S.dog); poseGator(gN, S.gator);
  hazMat2.color.set(S.haz ? '#ffb020' : '#5a3a10');
  bagG.visible = S.bag > 0.001; bagG.scale.setScalar(Math.max(0.001, S.bag));
  doorHinges.forEach((h, k) => { h.rotation.y = S.doors[k] * 1.45; });
  if (S.menu) { menuG.visible = true; menuG.scale.setScalar(Math.max(0.001, S.menu.s)); redraw(menuS, JSON.stringify(S.menu), (g, w, h) => drawMenu(g, w, h, S.menu)); } else menuG.visible = false;
  redraw(billS, JSON.stringify(S.bill), (g, w, h) => drawBill(g, w, h, S.bill));
  flams.forEach((fl, i) => { fl.visible = S.flam[i] > 0.001; fl.scale.setScalar(Math.max(0.001, S.flam[i])); });
  redraw(board, JSON.stringify(S.album), (g, w, h) => drawAlbum(g, w, h, S.album)); boardG.scale.x = 1;
  gtavG.visible = S.gtav > 0.001; gtavG.scale.setScalar(Math.max(0.001, S.gtav));
  facades.forEach((s, k) => { const lk = k === 2 ? S.lock : 0; redraw(s, 'f' + S.on[k] + '_' + lk, (g, w, h) => drawFacade(g, w, h, k, S.on[k], lk)); });
  redraw(monS, JSON.stringify(S.mon), (g, w, h) => drawMon2(g, w, h, S.mon));
  cmpG.visible = S.cmpShow && S.cmp.s > 0.001; cmpG.scale.setScalar(Math.max(0.001, S.cmp.s)); if (cmpG.visible) redraw(cmpS, JSON.stringify(S.cmp), (g, w, h) => drawCmp(g, w, h, S.cmp));
  for (const c of clouds2) c.quaternion.copy(camera.quaternion);
}

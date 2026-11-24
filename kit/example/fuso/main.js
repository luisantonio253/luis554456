import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, NZ, BU, WA, RO, MI, SH, TVN, CLK, USP, WS, FOUR, SHEEP, BSHEEP, PANELS, PX, TVP, CAL, TVM, CNT, FLS } from './story.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 2500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 1), beam: texM(P.beam(2), 1, 1), stone: texM(P.stone(4), 1, 1),
  grass: texM(P.grass(6), 1, 1), jungle: texM(P2.jungle(22), 1, 1), sand: texM(P2.sand(21), 1, 1), rock: texM(P2.rockFace(23), 1, 1),
  hull: texM(P2.hullWood(24), 1, 1), sail: new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(P2.sail(25)), side: THREE.DoubleSide }),
  asphalt: texM(P2.asphalt(26), 1, 1), waves: texM(P2.waves(), 1, 1), concrete: texM(P2.concrete(28), 1, 1),
  bricks: texM(P2.bricks(30), 1, 1), iron: texM(P2.iron(), 1, 1), door: texM(P2.doorPlanks(32), 1, 1),
  trunk: toon({ color: '#6a4a32' }), tree: toon({ color: '#3e7a34' }), tree2: toon({ color: '#5c9a3c' }), palm: toon({ color: '#4f9a3a' }),
  hill: toon({ color: '#4f8a3c' }), mount: toon({ color: '#5f8a6a' }), mountFar: toon({ color: '#86a7b4' }),
  wood: toon({ color: '#7a5434' }), darkWood: toon({ color: '#4a3020' }), rope: toon({ color: '#c9b48a' }),
  chrome: toon({ color: '#d7e2ea' }), yellow: toon({ color: '#f2c94a' }), red: toon({ color: '#b8282b' }), white: toon({ color: '#f4f1ea' }),
  tunnelDark: toon({ color: '#2a2a30' }),
};
M.facades = [30, 190, 350, 12, 210, 48].map((h, i) => texM(P2.facade(40 + i, h), 1, 1));

// ---------- ink / normal-depth contract ----------
const ndMat = new THREE.ShaderMaterial({
  // InstancedMesh (tree carpets) must apply instanceMatrix here too, or every instance lands as one ghost mesh at the origin in the ink pass
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vec4 p = vec4(position,1.); vec3 nn = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix*p; nn = mat3(instanceMatrix)*nn;
    #endif
    vN = normalize(normalMatrix*nn); vec4 mv = modelViewMatrix*p; vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.52,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
/** box with world-scaled UVs per face (texel density 1 tile per `t` metres) */
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};
/** planar UVs from world xz (tile every t m) */
const planarUV = (geo, t = 8, axes = 'xz') => {
  const p = geo.attributes.position, uv = geo.attributes.uv || new THREE.BufferAttribute(new Float32Array(p.count * 2), 2);
  for (let i = 0; i < p.count; i++) { const a = axes === 'xy' ? [p.getX(i), p.getY(i)] : axes === 'zy' ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getZ(i)]; uv.setXY(i, a[0] / t, a[1] / t); }
  geo.setAttribute('uv', uv); return geo;
};
const rngW = P.rng(44);

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
const lamp = new THREE.PointLight('#ffe7b0', 0, 30, 1.6); scene.add(lamp);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- water ----------
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#1f6f9a') }, shal: { value: new THREE.Color('#4fb4c8') }, glint: { value: new THREE.Color('#effaff') } };
const mkWater = (scale, flow) => {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), t: waterU.t, deep: waterU.deep, shal: waterU.shal, glint: waterU.glint, sc: { value: scale }, flow: { value: new THREE.Vector2(...flow) } }, fog: true,
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform float t, sc; uniform vec2 flow; uniform vec3 deep, shal, glint; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 p = vW.xz*sc - flow*t;
        float n = noise(p) * .6 + noise(p*2.3 + 7.) * .4;
        vec3 c = mix(deep, shal, .3 + .45*n);
        float streak = smoothstep(.8, .86, noise(p*vec2(3.2,.8)*1.6 - flow*t*1.5));
        c = mix(c, glint, streak*.55);
        gl_FragColor = vec4(c,1.);
        #include <fog_fragment>
      }`,
  });
  return m;
};
// ---------- sea + per-set backdrops ----------
{ const g = new THREE.PlaneGeometry(30000, 30000); g.rotateX(-Math.PI / 2); const sea = new THREE.Mesh(g, mkWater(0.06, [0.25, 0.15])); sea.position.y = -1.5; sea.userData.nd = waterNd; scene.add(sea); }
const backdrop = (c, seed, hillMat) => { const r = P.rng(seed);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + r() * 0.2, d = 560 + r() * 200, h = 90 + r() * 120; add(new THREE.ConeGeometry(110 + r() * 70, h, 7), i % 2 ? M.mountFar : M.mount, c[0] + Math.cos(a) * d, h / 2 - 6, c[2] + Math.sin(a) * d, scene, { cast: false }); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.2, d = 230 + r() * 90; const m = add(new THREE.SphereGeometry(1, 16, 10), hillMat, c[0] + Math.cos(a) * d, -2, c[2] + Math.sin(a) * d, scene, { cast: false }); m.scale.set(45 + r() * 40, 18 + r() * 25, 45 + r() * 40); }
};
backdrop(NZ, 3, M.hill); backdrop(BU, 5, M.hill); backdrop(WA, 7, M.hill); backdrop(RO, 9, M.hill); backdrop(MI, 11, toon({ color: '#3a6a5a' }));

// ---------- canvas signs ----------
const FONT = (px, w = 'bold') => `${w} ${px}px Arial, "DejaVu Sans", "Liberation Sans", sans-serif`;
const mkSign = (w, h, cw, ch, parent, x, y, z, basic = false) => {
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const mat = basic ? new THREE.MeshBasicMaterial({ map: t }) : toon({ map: t });
  const m = add(new THREE.PlaneGeometry(w, h), mat, x, y, z, parent, { cast: false });
  return { c, g: c.getContext('2d'), t, m, key: null };
};
const redraw = (s, key, fn) => { if (s.key === key) return; s.key = key; const g = s.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s.c.width, s.c.height); fn(g, s.c.width, s.c.height); s.t.needsUpdate = true; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const txt = (g, s, x, y, px, col, stroke = null, sw = 0) => { g.font = FONT(px); g.textAlign = 'center'; g.textBaseline = 'middle'; if (stroke) { g.lineJoin = 'round'; g.lineWidth = sw; g.strokeStyle = stroke; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); };
const INKC = '#241726';
const drawCover = (g, w, h, n, top, bot, seed) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.beginPath(); g.arc(w * 0.5, h * 0.66, Math.min(w, h) * 0.26, 0, 7); g.fillStyle = '#ffd36a'; g.fill();
  const r = P.rng(seed); g.fillStyle = '#2a1838';
  for (let x = 0; x < w; x += w / 13) { const bh = h * (0.1 + r() * 0.22); g.fillRect(x, h * 0.8 - bh, w / 13 - 3, bh + h * 0.25); }
  g.strokeStyle = '#2a1838'; g.lineCap = 'round'; g.lineWidth = Math.min(w, h) * 0.035;
  g.beginPath(); g.moveTo(w * 0.83, h); g.quadraticCurveTo(w * 0.87, h * 0.75, w * 0.8, h * 0.52); g.stroke();
  for (let k = 0; k < 6; k++) { const a = -3.0 + k * 0.6; g.beginPath(); g.moveTo(w * 0.8, h * 0.52); g.quadraticCurveTo(w * 0.8 + Math.cos(a) * w * 0.1, h * 0.52 + Math.sin(a) * h * 0.08 - 10, w * 0.8 + Math.cos(a) * w * 0.18, h * 0.52 + Math.sin(a) * h * 0.1 + 18); g.stroke(); }
  if (n) txt(g, String(n), w * 0.4, h * 0.34, Math.min(w * 0.9, h * 0.5), '#ffffff', INKC, Math.min(w, h) * 0.04);
};
const drawLock = (g, cx, cy, k) => { g.save(); g.translate(cx, cy); g.scale(k, k);
  g.lineWidth = 26; g.strokeStyle = '#c9cfd6'; g.beginPath(); g.arc(0, -40, 58, Math.PI, 0); g.lineTo(58, 0); g.moveTo(-58, 0); g.lineTo(-58, -40); g.stroke();
  g.fillStyle = '#ffd23f'; rr(g, -95, -10, 190, 140, 22); g.fill(); g.lineWidth = 10; g.strokeStyle = INKC; g.stroke();
  g.fillStyle = INKC; g.beginPath(); g.arc(0, 45, 18, 0, 7); g.fill(); g.fillRect(-7, 45, 14, 45); g.restore(); };
const drawTVs = (g, w, h, st, S) => {
  if (st === 'menu') { drawCover(g, w, h, 6, '#ff6ac0', '#5a3ad0', 61); txt(g, 'PRESS START', w / 2, h * 0.9, 40, '#ffffff', INKC, 6); return; }
  if (st === 'chase') { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1050'); gr.addColorStop(1, '#ff5aa0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = P.rng(12); g.fillStyle = '#1a0a2a'; for (let x = 0; x < w; x += w / 14) { const bh = h * (0.15 + r() * 0.3); g.fillRect(x, h * 0.72 - bh, w / 14 - 4, bh); }
    g.fillStyle = '#3a3048'; g.fillRect(0, h * 0.72, w, h * 0.28); g.fillStyle = '#ffd23f'; for (let x = -80 + (S.chaseX * 160) % 160; x < w; x += 160) g.fillRect(w - x, h * 0.85, 70, 10);
    const car = (x, col, pol) => { g.fillStyle = col; rr(g, x, h * 0.7, 150, 50, 16); g.fill(); rr(g, x + 30, h * 0.62, 90, 40, 14); g.fill(); g.lineWidth = 6; g.strokeStyle = INKC; rr(g, x, h * 0.7, 150, 50, 16); g.stroke();
      g.fillStyle = INKC; for (const wx of [x + 32, x + 118]) { g.beginPath(); g.arc(wx, h * 0.8, 18, 0, 7); g.fill(); }
      if (pol) { g.fillStyle = S.chase ? '#ff2a2a' : '#2a6aff'; g.fillRect(x + 50, h * 0.58, 24, 14); g.fillStyle = S.chase ? '#2a6aff' : '#ff2a2a'; g.fillRect(x + 76, h * 0.58, 24, 14); } };
    car(w * 0.58, '#ffd23f', false); car(w * 0.22, '#f4f1ea', true); car(-w * 0.06, '#f4f1ea', true);
    txt(g, '★ ★ ★', w * 0.78, h * 0.12, 54, S.chase ? '#ffffff' : '#ffd23f', INKC, 6); return; }
  if (st === 'g6') { drawCover(g, w, h, 6, '#ff6ac0', '#5a3ad0', 61); txt(g, 'JOGANDO!', w / 2, h * 0.9, 50, '#7dff6a', INKC, 7); return; }
  g.fillStyle = '#10101c'; g.fillRect(0, 0, w, h); drawLock(g, w / 2, h * 0.38, (S && S.lk) || 1); txt(g, 'LIBERA 00:00', w / 2, h * 0.86, 52, '#ffffff', INKC, 6);
};
const drawCal = (g, w, h) => {
  g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.lineWidth = 10; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
  g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, 130); txt(g, 'NOVEMBRO 2026', w / 2, 78, 56, '#ffffff');
  'DSTQQSS'.split('').forEach((d, i) => txt(g, d, 48 + i * 64, 168, 30, '#8a7a8a'));
  for (let d = 1; d <= 30; d++) { const k = d - 1, cx = 48 + (k % 7) * 64, cy = 222 + Math.floor(k / 7) * 64, hot = d === 19;
    if (hot) { g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.fillStyle = '#ffe14a'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#d0352f'; g.stroke(); }
    txt(g, String(d), cx, cy + 2, hot ? 36 : 30, hot ? '#d0352f' : '#2b2b3a'); }
};
const drawWin = (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#101a44'); gr.addColorStop(1, '#3a4a8a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff'; const r = P.rng(4); for (let i = 0; i < 18; i++) g.fillRect(r() * w, r() * h * 0.7, 3, 3); g.beginPath(); g.arc(w * 0.3, h * 0.28, 18, 0, 7); g.fillStyle = '#f4f1ea'; g.fill();
  g.fillStyle = '#5a6a7a'; g.fillRect(0, h * 0.78, w, h * 0.22);
  g.lineWidth = 14; g.strokeStyle = '#f4f1ea'; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
};

// ---------- sheep ----------
M.wool = toon({ color: '#f4f1ea' }); M.sheepF = toon({ color: '#2b2430' }); M.eyeW = toon({ color: '#ffffff' });
const mkSheepG = (parent, x, y, z, r) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; parent.add(g);
  const b = add(new THREE.SphereGeometry(1, 14, 10), M.wool, 0, 0.62, 0, g); b.scale.set(0.42, 0.34, 0.58);
  for (const [lx, lz] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) add(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6), M.sheepF, lx, 0.21, lz, g);
  const hd = new THREE.Group(); hd.position.set(0, 0.8, 0.52); g.add(hd);
  add(new THREE.SphereGeometry(1, 12, 8), M.sheepF, 0, 0, 0.06, hd).scale.set(0.15, 0.17, 0.21);
  add(new THREE.SphereGeometry(1, 10, 8), M.wool, 0, 0.13, -0.02, hd).scale.set(0.15, 0.08, 0.13);
  for (const s of [-1, 1]) { add(new THREE.SphereGeometry(1, 8, 6), M.sheepF, s * 0.17, 0.05, -0.02, hd).scale.set(0.1, 0.04, 0.05);
    add(new THREE.SphereGeometry(0.035, 8, 6), M.eyeW, s * 0.075, 0.05, 0.2, hd); add(new THREE.SphereGeometry(0.018, 6, 4), M.sheepF, s * 0.075, 0.05, 0.228, hd); }
  g.userData.head = hd; return g; };

// ---------- NZ: island at night ----------
const nz = new THREE.Group(); nz.position.set(...NZ); scene.add(nz);
{ const pr = [[42, -1.9], [36, -1.1], [30, -0.45], [24, -0.1], [20, 0.02], [10, 0.02], [0, 0.02]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pr, 72), p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), r = P.rng(8);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); c.set(y > -0.3 ? '#5f9a3c' : y > -1.0 ? '#e8d39a' : '#c9b27a'); if (y > -0.3) c.offsetHSL(0, 0, (r() - 0.5) * 0.05); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  add(g, toon({ vertexColors: true, side: THREE.DoubleSide }), 0, 0, 0, nz, { cast: false }); }
M.hillG = toon({ color: '#5a9440' }); M.hillG2 = toon({ color: '#4c8838' });
for (const [x, y, z, sx, sy, sz] of [[-14, -3, -24, 14, 6.5, 10], [10, -3.5, -27, 16, 7.5, 11], [0, -4, -36, 24, 9, 10], [-24, -3, -12, 10, 5, 9], [24, -3, -14, 10, 5.5, 9]])
  add(new THREE.SphereGeometry(1, 24, 14), y < -3.2 ? M.hillG2 : M.hillG, x, y, z, nz, { cast: false }).scale.set(sx, sy, sz);
{ const r = P.rng(31); for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * 34, z = -10 - r() * 9; add(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 6), M.trunk, x, 0.7, z, nz); add(new THREE.SphereGeometry(1, 10, 8), i % 2 ? M.tree : M.tree2, x, 1.9, z, nz).scale.set(1.0, 1.1, 1.0); } }
for (let i = 0; i < 11; i++) add(tbox(0.12, 1.0, 0.12, 1), M.wood, -10 + i * 2, 0.5, -7, nz);
for (const y of [0.45, 0.85]) add(tbox(20, 0.08, 0.06, 2), M.wood, 0, y, -7, nz, { cast: false });
// clock tower
M.navy = toon({ color: '#1d2a4a' }); M.dark = toon({ color: '#15151c' });
add(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 8), M.navy, CLK[0], 2.3, CLK[2], nz);
const clkG = new THREE.Group(); clkG.position.set(CLK[0], 4.0, CLK[2]); nz.add(clkG);
add(tbox(1.95, 1.3, 0.22, 1), M.dark, 0, 0, 0, clkG);
const clk = mkSign(1.8, 1.15, 640, 410, clkG, 0, 0, 0.115, true);
const drawClock = (g, w, h, S) => { g.fillStyle = '#0c1020'; g.fillRect(0, 0, w, h); g.lineWidth = 14; g.strokeStyle = '#ffd23f'; g.strokeRect(7, 7, w - 14, h - 14);
  txt(g, S.clock, w / 2, h * 0.42, 128, S.clock[0] === '2' ? '#ffd23f' : '#7dff6a'); txt(g, S.clockDay, w / 2, h * 0.8, 70, '#ffffff'); };
// signpost "ESTADOS UNIDOS"
add(new THREE.CylinderGeometry(0.06, 0.07, 2.6, 8), M.wood, USP[0], 1.3, USP[2], nz);
const usS = mkSign(1.9, 0.52, 600, 164, nz, USP[0] + 0.3, 2.15, USP[2] + 0.08);
const drawUS = (g, w, h, k) => { g.fillStyle = '#b8854a'; g.beginPath(); g.moveTo(8, 10); g.lineTo(w - 70, 10); g.lineTo(w - 6, h / 2); g.lineTo(w - 70, h - 10); g.lineTo(8, h - 10); g.closePath(); g.fill(); g.lineWidth = 9; g.strokeStyle = INKC; g.stroke();
  txt(g, 'ESTADOS UNIDOS', w / 2 - 28, h / 2 + 3, 60, '#3a2418');
  if (k > 0) { g.save(); g.translate(w / 2 - 20, h / 2); g.scale(k, k); g.globalAlpha = 0.8; g.lineCap = 'round'; g.lineWidth = 18; g.strokeStyle = '#e0283a'; g.beginPath(); g.moveTo(-200, -66); g.lineTo(200, 66); g.moveTo(200, -66); g.lineTo(-200, 66); g.stroke(); g.restore(); } };
// welcome sign
for (const s of [-1, 1]) add(tbox(0.1, 1.6, 0.1, 1), M.wood, WS[0] + s * 1.1, 0.8, WS[2] - 0.05, nz);
const wsS = mkSign(2.6, 1.2, 700, 323, nz, WS[0], 1.55, WS[2]);
redraw(wsS, 'w', (g, w, h) => { g.fillStyle = '#2f7a4a'; rr(g, 6, 6, w - 12, h - 12, 26); g.fill(); g.lineWidth = 10; g.strokeStyle = '#f4f1ea'; rr(g, 20, 20, w - 40, h - 40, 18); g.stroke();
  txt(g, 'BEM-VINDO À', w / 2, h * 0.32, 56, '#f4f1ea'); txt(g, 'NOVA ZELÂNDIA', w / 2, h * 0.66, 80, '#ffffff'); });
// TV on a crate
const tvN = new THREE.Group(); tvN.position.set(TVN[0], 0, TVN[2]); tvN.rotation.y = -0.5; nz.add(tvN);
add(tbox(0.95, 0.75, 0.6, 1), M.wood, 0, 0.375, 0, tvN); add(tbox(0.3, 0.05, 0.2, 1), M.dark, 0, 0.775, 0, tvN);
add(tbox(1.15, 0.7, 0.08, 1), M.dark, 0, 1.15, 0, tvN);
const nzScreen = mkSign(1.05, 0.6, 640, 366, tvN, 0, 1.15, 0.045, true);
// controller in the shepherd's hands
const pad = new THREE.Group(); pad.position.set(SH[0], 1.05, SH[2] + 0.24); nz.add(pad);
add(tbox(0.3, 0.07, 0.13, 1), M.dark, 0, 0, 0, pad); for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.07, 10, 8), M.dark, s * 0.15, -0.02, -0.01, pad);
add(new THREE.SphereGeometry(0.022, 8, 6), toon({ color: '#e0283a' }), 0.07, 0.04, 0.03, pad); add(new THREE.SphereGeometry(0.022, 8, 6), toon({ color: '#2fae55' }), 0.11, 0.04, 0.0, pad);
const sheepG = SHEEP.map(([x, z, r]) => mkSheepG(nz, x, 0.02, z, r));
const fourG = FOUR.map(([x, z, r]) => mkSheepG(nz, x, 0.02, z, r));

// ---------- BU: city bus, morning ----------
const bu = new THREE.Group(); bu.position.set(...BU); scene.add(bu);
add(tbox(60, 0.4, 260, 4), M.asphalt, 0, -1.1, 0, bu, { cast: false });
M.busW = toon({ color: '#f2efe6' }); M.busO = toon({ color: '#2f8a6a' }); M.seat = toon({ color: '#3a5aa0' }); M.seatD = toon({ color: '#2a4278' }); M.pole = toon({ color: '#f2c94a' }); M.busF = toon({ color: '#4a4a56' });
add(tbox(2.9, 0.3, 11.4, 1), M.busF, 0, -0.15, -0.3, bu, { cast: false });
for (const s of [-1, 1]) {
  add(tbox(0.1, 1.0, 11.4, 1), M.busW, s * 1.45, 0.5, -0.3, bu); add(tbox(0.1, 0.5, 11.4, 1), M.busW, s * 1.45, 2.24, -0.3, bu);
  for (let k = 0; k < 9; k++) add(tbox(0.12, 1.0, 0.16, 1), M.busW, s * 1.45, 1.49, -5.8 + k * 1.4, bu);
  add(tbox(0.04, 0.22, 11.4, 1), M.busO, s * 1.4, 0.8, -0.3, bu, { cast: false });
}
add(tbox(2.9, 0.08, 11.4, 1), M.busW, 0, 2.5, -0.3, bu);
add(tbox(2.9, 1.0, 0.1, 1), M.busW, 0, 0.5, -6.0, bu); add(tbox(2.9, 0.5, 0.1, 1), M.busW, 0, 2.24, -6.0, bu); add(tbox(2.9, 2.5, 0.1, 1), M.busW, 0, 1.25, 5.4, bu);
for (const zz of [-4.8, -3.8, -2.8, -1.8, -0.8, 0.2, 1.2, 2.2, 3.2]) for (const s of [-1, 1]) {
  add(tbox(0.9, 0.12, 0.46, 1), M.seat, s * 0.92, 0.45, zz, bu); add(tbox(0.9, 0.62, 0.08, 1), M.seatD, s * 0.92, 0.8, zz + 0.23, bu); add(tbox(0.08, 0.4, 0.08, 1), M.busF, s * 0.92, 0.2, zz, bu); }
for (const zz of [-3.3, -0.3, 2.7]) for (const s of [-1, 1]) if (!(s < 0 && zz > -1 && zz < 0)) add(new THREE.CylinderGeometry(0.03, 0.03, 2.5, 8), M.pole, s * 0.47, 1.25, zz, bu);
add(new THREE.CylinderGeometry(0.028, 0.028, 11, 8), M.pole, 0.1, 2.12, -0.3, bu).rotation.x = Math.PI / 2;
add(tbox(1.3, 0.42, 0.06, 1), M.dark, -0.75, 2.13, -2.13, bu);
const busClkG = new THREE.Group(); busClkG.position.set(-0.75, 2.13, -2.095); bu.add(busClkG);
const busClk = mkSign(1.2, 0.34, 600, 170, busClkG, 0, 0, 0, true);
redraw(busClk, 'c', (g, w, h) => { g.fillStyle = '#0a0a0e'; g.fillRect(0, 0, w, h); txt(g, '08:00', w * 0.25, h / 2 + 4, 92, '#ff9a2a'); txt(g, 'QUA 18/11', w * 0.75, h / 2 + 4, 52, '#ff9a2a'); });
const bldgs = []; { const r = P.rng(55);
  for (let i = 0; i < 26; i++) { const s = i % 2 ? 1 : -1, hgt = 6 + r() * 10, w = 5 + r() * 4; const m = add(tbox(w, hgt, 6, 3), M.facades[i % 6], s * (7 + r() * 3 + w / 2), hgt / 2 - 0.9, 0, bu, { cast: false }); m.userData.z0 = (i >> 1) * 10 + r() * 3; bldgs.push(m); }
  for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1; const m = add(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), M.navy, s * 4.5, 1.6, 0, bu, { cast: false }); m.userData.z0 = i * 13; bldgs.push(m); } }
const bSheep = mkSheepG(bu, BSHEEP[0], BSHEEP[1], BSHEEP[2], 0.5);

// ---------- WA: world-clock wall ----------
const wa = new THREE.Group(); wa.position.set(...WA); scene.add(wa);
add(tbox(44, 0.6, 30, 3), M.concrete, 0, -0.3, 6, wa, { cast: false });
M.wallN = toon({ color: '#2a3354' }); M.frame = toon({ color: '#141826' });
add(tbox(26, 9.5, 0.4, 2), M.wallN, 0, 4.75, -0.55, wa);
for (const s of [-1, 1]) add(tbox(0.4, 9.5, 14, 2), M.wallN, s * 13.2, 4.75, 6.4, wa);
const panels = PANELS.map((_, i) => { add(tbox(2.24, 3.04, 0.08, 1), M.frame, PX(i), 2.6, -0.33, wa); return mkSign(2.1, 2.9, 420, 580, wa, PX(i), 2.6, -0.275, true); });
const drawPanel = (g, w, h, Pn) => { const on = Pn.rel;
  g.fillStyle = on ? '#2fae55' : '#1d2a4a'; rr(g, 6, 6, w - 12, h - 12, 30); g.fill(); g.lineWidth = 12; g.strokeStyle = on ? '#bff5c8' : '#4a5a8a'; g.stroke();
  txt(g, Pn.n, w / 2, 72, Pn.n.length > 10 ? 44 : 56, '#ffffff');
  g.fillStyle = '#0c1020'; rr(g, 28, 130, w - 56, 170, 20); g.fill(); txt(g, Pn.t, w / 2, 218, 120, on ? '#7dff6a' : '#ffd23f');
  if (on) { txt(g, 'LIBERADO', w / 2, 385, 64, '#ffffff'); g.lineWidth = 22; g.lineCap = 'round'; g.strokeStyle = '#ffffff'; g.beginPath(); g.moveTo(w / 2 - 50, 470); g.lineTo(w / 2 - 12, 508); g.lineTo(w / 2 + 60, 438); g.stroke(); }
  else { txt(g, 'FALTAM', w / 2, 375, 46, '#9aa8d0'); txt(g, Pn.left, w / 2, 465, Pn.left.length > 4 ? 84 : 100, '#ffffff'); } };
const headG = new THREE.Group(); wa.add(headG);
add(tbox(3.8, 1.04, 0.08, 1), M.frame, 0, 4.8, -0.33, headG); const head = mkSign(3.7, 0.95, 740, 190, headG, 0, 4.8, -0.275, true);
const drawHead = (g, w, h, u) => { g.fillStyle = '#ffd23f'; rr(g, 4, 4, w - 8, h - 8, 26); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke();
  if (u < 0) { txt(g, 'MEIA-NOITE DE 19/11', w / 2, h / 2 + 4, 66, '#1d2a4a'); return; }
  txt(g, '+' + Math.floor(u + 1e-6) + ' h', w * 0.2, h / 2 + 6, 96, '#d0352f'); txt(g, 'DEPOIS DA', w * 0.69, h * 0.34, 40, '#1d2a4a'); txt(g, 'NOVA ZELÂNDIA', w * 0.69, h * 0.68, 42, '#1d2a4a'); };


// ---------- RO: living room at night ----------
const ro = new THREE.Group(); ro.position.set(...RO); scene.add(ro);
M.wallA = texM(P.plaster(8, 30), 1, 1); M.wallB = texM(P.plaster(9, 200), 1, 1);
M.sofa = toon({ color: '#4f7a8a' }); M.sofaD = toon({ color: '#3e6272' }); M.rug = toon({ color: '#c75a4a' });
add(tbox(8.4, 0.6, 7.4, 2), M.plank, 0, -0.3, -0.4, ro, { cast: false });
add(tbox(8.4, 5.6, 0.3, 3), M.wallA, 0, 2.8, -3.15, ro);
for (const s of [-1, 1]) add(tbox(0.3, 5.6, 7.4, 3), M.wallB, s * 4.05, 2.8, -0.4, ro);
add(tbox(8, 0.14, 0.05, 1), M.darkWood, 0, 0.07, -2.98, ro, { cast: false });
{ const g = new THREE.CylinderGeometry(1.5, 1.5, 0.02, 40); add(g, M.rug, 0.4, 0.01, -0.6, ro, { cast: false }).scale.set(1.25, 1, 0.75); }
add(tbox(2.4, 0.45, 0.9, 1), M.sofa, 0.6, 0.225, -2.4, ro); add(tbox(2.4, 0.85, 0.25, 1), M.sofaD, 0.6, 0.6, -2.83, ro);
for (const s of [-1, 1]) add(tbox(0.25, 0.65, 0.9, 1), M.sofaD, 0.6 + s * 1.3, 0.325, -2.4, ro);
add(tbox(0.66, 0.86, 0.03, 1), M.darkWood, CAL[0], CAL[1], -2.985, ro, { cast: false });
const calS = mkSign(0.6, 0.8, 480, 640, ro, CAL[0], CAL[1], CAL[2]); redraw(calS, 'c', drawCal);
add(tbox(1.25, 1.15, 0.04, 1), M.white, -2.9, 1.9, -2.98, ro, { cast: false });
const winS = mkSign(1.12, 1.02, 256, 232, ro, -2.9, 1.9, -2.955, true); redraw(winS, 'w', drawWin);
const tvG = new THREE.Group(); tvG.position.set(TVP[0], 0, TVP[2]); tvG.rotation.y = 0.5; ro.add(tvG);
add(tbox(1.6, 0.5, 0.5, 1), M.darkWood, 0, 0.25, 0, tvG); add(tbox(0.3, 0.06, 0.2, 1), M.dark, 0, 0.53, 0, tvG); add(tbox(1.25, 0.75, 0.07, 1), M.dark, 0, 0.95, 0, tvG);
const roScreen = mkSign(1.15, 0.67, 640, 372, tvG, 0, 0.95, 0.04, true);
add(tbox(0.4, 0.09, 0.3, 1), toon({ color: '#e8e8ee' }), 0.45, 0.545, 0.05, tvG);

// ---------- MI: Miami porch at night ----------
const mi = new THREE.Group(); mi.position.set(...MI); scene.add(mi);
add(tbox(90, 0.6, 70, 4), M.sand, 0, -0.3, -12, mi, { cast: false });
add(tbox(8.4, 0.3, 4.6, 2), M.plank, 0, 0.15, -3.9, mi);
M.wallM = toon({ color: '#6fd0c4' }); M.wallP = toon({ color: '#ff8ab8' }); M.neonP = new THREE.MeshBasicMaterial({ color: '#ff5ad0' }); M.neonC = new THREE.MeshBasicMaterial({ color: '#5ae8ff' });
add(tbox(9, 4.9, 0.3, 2), M.wallM, 0, 2.75, -6.35, mi);
for (const s of [-1, 1]) add(tbox(0.3, 4.9, 4.6, 2), M.wallP, s * 4.35, 2.75, -3.9, mi);
add(tbox(9.6, 0.25, 5.4, 2), M.white, 0, 5.3, -3.9, mi);
add(tbox(8.6, 0.08, 0.06, 1), M.neonP, 0, 4.95, -6.17, mi, { cast: false }); add(tbox(8.6, 0.06, 0.06, 1), M.neonC, 0, 4.75, -6.17, mi, { cast: false });
add(tbox(1.25, 1.15, 0.04, 1), M.white, -2.6, 2.7, -6.19, mi, { cast: false }); const miWin = mkSign(1.12, 1.02, 256, 232, mi, -2.6, 2.7, -6.165, true); redraw(miWin, 'w', drawWin);
const tvM = new THREE.Group(); tvM.position.set(TVM[0], TVM[1], TVM[2]); tvM.rotation.y = -0.45; mi.add(tvM);
add(tbox(1.3, 0.55, 0.45, 1), M.darkWood, 0, 0.275, 0, tvM); add(tbox(1.2, 0.72, 0.08, 1), M.dark, 0, 1.0, 0, tvM);
const miScreen = mkSign(1.1, 0.62, 640, 360, tvM, 0, 1.0, 0.045, true);
add(tbox(2.5, 0.95, 0.08, 1), M.dark, CNT[0], CNT[1], -6.16, mi);
const cntS = mkSign(2.4, 0.85, 720, 255, mi, CNT[0], CNT[1], -6.11, true);
const drawCnt = (g, w, h, s) => { g.fillStyle = '#0a0a0e'; g.fillRect(0, 0, w, h); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  txt(g, 'FALTAM', w / 2, h * 0.18, 44, '#ff8ab8'); txt(g, `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, w / 2, h * 0.62, 150, '#ff3a3a'); };
for (const s of [-1, 1]) add(tbox(0.1, 1.5, 0.1, 1), M.wood, FLS[0] + s * 0.85, 0.3 + 0.75, FLS[2] - 0.05, mi);
const flG = new THREE.Group(); flG.position.set(FLS[0], 1.65, FLS[2]); mi.add(flG);
const flS = mkSign(2.1, 0.8, 640, 244, flG, 0, 0, 0);
redraw(flS, 'f', (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffb04a'); gr.addColorStop(1, '#ff5a8a'); g.fillStyle = gr; rr(g, 6, 6, w - 12, h - 12, 30); g.fill(); g.lineWidth = 10; g.strokeStyle = INKC; g.stroke(); txt(g, 'FLÓRIDA', w / 2, h / 2 + 6, 128, '#1d3a5a', '#ffffff', 10); });
M.palmT = toon({ color: '#8a6a4a' });
const mkPalm = (parent, x, z, h, lean) => { const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); let px = 0, py = 0; const seg = h / 7;
  for (let i = 0; i < 7; i++) { const a = lean * (i / 7) * 0.5; const m = add(new THREE.CylinderGeometry(0.16 - i * 0.012, 0.19 - i * 0.012, seg * 1.08, 8), M.palmT, px + Math.sin(a) * seg / 2, py + Math.cos(a) * seg / 2, 0, g); m.rotation.z = -a; px += Math.sin(a) * seg; py += Math.cos(a) * seg; }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const lf = add(new THREE.SphereGeometry(1, 10, 6), M.palm, px + Math.cos(a) * 1.1, py - 0.25, Math.sin(a) * 1.1, g); lf.scale.set(1.5, 0.12, 0.38); lf.rotation.order = 'YXZ'; lf.rotation.y = -a; lf.rotation.z = -0.35; }
  return g; };
for (const [x, z, h, l] of [[-5.6, -5.0, 7, 0.4], [5.8, -4.6, 8, -0.5], [-8, -9, 9, 0.3], [8.2, -9.5, 7.5, -0.3], [3, -12, 8.5, 0.2], [-3, -13, 9, -0.2]]) mkPalm(mi, x, z, h, l);
{ const r = P.rng(77); for (let i = 0; i < 22; i++) { const hgt = 12 + r() * 30, w = 6 + r() * 6; add(tbox(w, hgt, 6, 4), M.facades[i % 6], -60 + i * 5.8, hgt / 2 - 0.3, -55 - r() * 25, mi, { cast: false }); } }

// clouds: painted billboards around each set (no fog, no ink)
const clouds = [];
{ const r = P.rng(90);
  for (const c0 of [NZ, BU, WA, RO, MI]) for (let i = 0; i < 7; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = rx(205 + r() * 130), d = 900 + r() * 300; m.position.set(c0[0] + Math.cos(a) * d, 160 + r() * 200, c0[2] + Math.sin(a) * d); m.scale.setScalar(220 + r() * 160);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds.push(m);
  } }

function worldState(S, f) {
  redraw(clk, S.clock + S.clockDay, (g, w, h) => drawClock(g, w, h, S)); clk.m.scale.setScalar(S.clockPop);
  redraw(usS, 'u' + S.usX, (g, w, h) => drawUS(g, w, h, S.usX));
  wsS.m.scale.setScalar(S.wsPop);
  sheepG.forEach((g, i) => { const k = S.sheep[i]; g.visible = k > 0.001; g.scale.setScalar(Math.max(0.001, k)); g.userData.head.rotation.x = 0.3 + 0.3 * Math.sin(f * 0.07 + i * 1.3); });
  fourG.forEach((g, i) => { const k = S.four[i]; g.visible = k > 0.001; g.scale.setScalar(Math.max(0.001, k)); g.userData.head.rotation.x = 0.08 * Math.sin(f * 0.1 + i); });
  pad.visible = S.pad;
  redraw(nzScreen, S.tvN + S.chase + S.chaseX, (g, w, h) => drawTVs(g, w, h, S.tvN, S));
  busClkG.scale.setScalar(Math.max(0.001, S.busClk));
  for (const m of bldgs) m.position.z = ((m.userData.z0 + S.busT * 0.32) % 130) - 70;
  bSheep.visible = S.bSheep > 0.001; bSheep.scale.setScalar(Math.max(0.001, S.bSheep)); bSheep.userData.head.rotation.x = 0.1 * Math.sin(f * 0.3);
  panels.forEach((p, i) => { const Pn = S.panels[i]; redraw(p, JSON.stringify([Pn.n, Pn.t, Pn.rel, Pn.left]), (g, w, h) => drawPanel(g, w, h, Pn)); p.m.scale.setScalar(Pn.pop); });
  redraw(head, 'h' + (S.u < 0 ? -1 : Math.floor(S.u + 1e-6)), (g, w, h) => drawHead(g, w, h, S.u)); headG.position.x = S.headX;
  redraw(roScreen, S.tvR, (g, w, h) => drawTVs(g, w, h, S.tvR, {}));
  redraw(miScreen, 'l' + S.lockBang, (g, w, h) => drawTVs(g, w, h, 'lock', { lk: S.lockBang }));
  redraw(cntS, 'c' + Math.ceil(S.count), (g, w, h) => drawCnt(g, w, h, Math.ceil(S.count)));
  flG.scale.setScalar(Math.max(0.001, S.flSign));
}

// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25;
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor() {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; if (c.g > .995 && abs(c.b-.52) < .004) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;
      if (card) ds = 1e4;
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9);
    }
    return e * (1. - smoothstep(180., 900., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    c = c*gain + lift;
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), max(flash, 0.));
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
  lamp.intensity = L.lamp || 0; if (L.lampAt) lamp.position.set(...L.lampAt); lamp.color.set(L.lampCol || '#ffe7b0');
  for (const c of clouds) c.material.color.set(L.cloud || '#ffffff');
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 150); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
}

function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.order = 'YXZ';
    c.mesh.rotation.set(a.pitch || 0, a.yawAbs ?? (Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0)), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? a.y) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const W_ = worldAt(f); worldState(W_, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;

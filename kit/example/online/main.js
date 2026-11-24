import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PZ, LR, ST, WD, TB, TVX, CALX, CLX, RK, RDP, BRD, FP, B6, B5, PODP } from './story.js';

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
// ======================= WORLD: "O GTA 6 tem online… e ele se chama GTA 5" =======================
const world = new THREE.Group(); scene.add(world);
{ const g = new THREE.PlaneGeometry(4000, 4000); g.rotateX(-Math.PI / 2); planarUV(g, 6); add(g, M.grass, 0, -0.3, 0, world, { cast: false }); }
for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2 + 0.1, d = 520 + rngW() * 140, h = 14 + rngW() * 20; const m = add(new THREE.SphereGeometry(1, 16, 10), M.hill, Math.cos(a) * d, 0, Math.sin(a) * d, world, { cast: false }); m.scale.set(60 + rngW() * 50, h, 60 + rngW() * 50); }
{ // tree carpet, kept away from every set
  const KEEP = [[PZ, 46], [LR, 26], [ST, 50], [WD, 46], [TB, 70]];
  const geo = new THREE.SphereGeometry(1, 10, 8), N = 650, inst = new THREE.InstancedMesh(geo, M.tree, N), inst2 = new THREE.InstancedMesh(geo, M.tree2, N), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0, k2 = 0;
  for (let i = 0; i < 9000 && (k < N || k2 < N); i++) {
    const x = (rngW() - 0.5) * 900, z = (rngW() - 0.5) * 900;
    if (KEEP.some(([c, r]) => Math.hypot(x - c[0], z - c[2]) < r)) continue;
    const r = 2.5 + rngW() * 3.5; p.set(x, r * 0.6, z); s.set(r, r * 0.9, r); m4.compose(p, qq, s);
    if (i % 2 && k < N) inst.setMatrixAt(k++, m4); else if (k2 < N) inst2.setMatrixAt(k2++, m4);
  }
  inst.count = k; inst2.count = k2; inst.castShadow = inst2.castShadow = true; inst.receiveShadow = inst2.receiveShadow = true; world.add(inst); world.add(inst2);
}

// ---------- canvas helpers ----------
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
const txt = (g, s, x, y, px, col, stroke = null, sw = 0, font = FONT) => { g.font = font(px); g.textAlign = 'center'; g.textBaseline = 'middle'; if (stroke) { g.lineJoin = 'round'; g.lineWidth = sw; g.strokeStyle = stroke; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); };
const fit = (s, px, maxW) => Math.min(px, Math.floor(maxW / (s.length * 0.62)));
const INKC = '#241726';
const tilesC = (a, b, n = 8) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), s = 256 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
  g.strokeStyle = 'rgba(40,30,40,.3)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke(); } return c; };
const slab = (x0, x1, z0, z1, par, mat, top = 0, th = 0.7, t = 2) => add(tbox(x1 - x0, th, z1 - z0, t), mat, (x0 + x1) / 2, top - th / 2, (z0 + z1) / 2, par, { cast: false });
const stamp = (g, x, y, s, word, col, px, rot = -0.22) => { if (s <= 0) return; g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.font = FONT(px);
  const tw = g.measureText(word).width; g.lineWidth = px * 0.14; g.strokeStyle = col; rr(g, -tw / 2 - px * 0.3, -px * 0.75, tw + px * 0.6, px * 1.5, px * 0.2); g.fillStyle = 'rgba(255,250,240,.94)'; g.fill(); g.stroke(); txt(g, word, 0, px * 0.05, px, col); g.restore(); };
const popS = (g, x, y, s, fn) => { if (s <= 0) return; g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };
const fmtT = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// ---------- shared props / materials ----------
M.trunkP = toon({ color: '#8a6a44' }); M.frond = toon({ color: '#3f9a3a' }); M.frond2 = toon({ color: '#5ab04a' }); M.coco = toon({ color: '#5a3a1e' });
const frondGeo = (() => { const g = new THREE.SphereGeometry(1, 10, 6); g.translate(0, 0, 1); return g; })();
const mkPalm = (par, x, z, h = 6, lean = 0.1, seed = 1, y0 = 0) => {
  const r = P.rng(seed * 31 + 5), g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = r() * 6.28; par.add(g);
  for (let i = 0; i < 5; i++) { const t0 = i / 5, t1 = (i + 1) / 5, x0 = lean * h * t0 * t0, x1 = lean * h * t1 * t1, ya = h * t0, yb = h * t1;
    const len = Math.hypot(x1 - x0, yb - ya), m = add(new THREE.CylinderGeometry(0.16 - 0.04 * t1, 0.21 - 0.04 * t0, len * 1.05, 7), M.trunkP, (x0 + x1) / 2, (ya + yb) / 2, 0, g); m.rotation.z = -Math.atan2(x1 - x0, yb - ya); }
  const tx = lean * h, ty = h;
  for (let k = 0; k < 8; k++) { const m = add(frondGeo, k % 2 ? M.frond : M.frond2, tx, ty, 0, g); m.scale.set(0.38, 0.06, 1.7 + r() * 0.4); m.rotation.order = 'YXZ'; m.rotation.set(0.35 + r() * 0.35, k / 8 * 6.283 + r() * 0.3, 0); }
  for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.13, 8, 6), M.coco, tx + Math.cos(k * 2.1) * 0.18, ty - 0.18, Math.sin(k * 2.1) * 0.18, g);
  return g;
};
M.brass = toon({ color: '#e0ad3e' }); M.ink = toon({ color: '#1a1420' }); M.tvBk = toon({ color: '#15151c' });
M.pave = texM(tilesC('#e8dcc4', '#dccdb0', 8), 1, 1);
M.steel = toon({ color: '#8f9aa8' }); M.steelD = toon({ color: '#5a6474' }); M.steelL = toon({ color: '#c6ced8' });
M.storeW = texM(P.plaster(12, 260), 1, 1); M.wallA = texM(P.plaster(8, 215), 1, 1); M.wallB = texM(P.plaster(9, 200), 1, 1);
const backFac = (par, seed, zb = -24, x0 = 16) => { const r = P.rng(seed); let k = 0;
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const h = 9 + r() * 12, x = s * (x0 + i * 7); add(tbox(6.4, h, 7, 4), M.facades[k++ % 6], x, h / 2, zb - r() * 3, par); } };
const basicM = (c) => new THREE.MeshBasicMaterial({ color: c });
const UPV = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const rod = (par, mat, r = 0.02) => add(new THREE.CylinderGeometry(r, r, 1, 6).translate(0, 0.5, 0), mat, 0, 0, 0, par);
const setRod = (m, a, b) => { _a.set(...a); _b.set(...b).sub(_a); const len = _b.length(); m.position.copy(_a); m.quaternion.setFromUnitVectors(UPV, _b.normalize()); m.scale.set(1, len, 1); };

// ---------- LR: living room (cut-away) at night ----------
const lr = new THREE.Group(); lr.position.set(...LR); scene.add(lr);
add(tbox(8.4, 0.6, 7.4, 2), M.plank, 0, -0.3, -0.4, lr, { cast: false });
add(tbox(8.4, 5.6, 0.3, 3), M.wallA, 0, 2.8, -3.15, lr);
for (const s of [-1, 1]) add(tbox(0.3, 5.6, 7.4, 3), M.wallB, s * 4.05, 2.8, -0.4, lr);
add(tbox(4.2, 0.02, 3.0, 1), toon({ color: '#6a5ad0' }), 0.4, 0.01, -0.6, lr, { cast: false });
add(tbox(2.4, 0.6, 0.5, 1), M.darkWood, TVX, 0.3, -2.72, lr);
add(tbox(0.5, 0.09, 0.34, 1), M.white, TVX - 0.6, 0.65, -2.7, lr); add(tbox(0.06, 0.01, 0.05, 1), basicM('#5ad0ff'), TVX - 0.6, 0.7, -2.52, lr, { cast: false });
add(tbox(2.16, 1.28, 0.08, 1), M.tvBk, TVX, 1.42, -2.82, lr);
const tvS = mkSign(2.02, 1.14, 808, 456, lr, TVX, 1.42, -2.77, true);
{ // sofa against the left wall, seat facing +x
  const so = new THREE.Group(); so.position.set(-3.1, 0, -0.6); lr.add(so); const cu = toon({ color: '#c8403a' }), cu2 = toon({ color: '#a8302c' });
  add(tbox(1.0, 0.45, 2.4, 1), cu2, 0, 0.225, 0, so); add(tbox(0.85, 0.16, 1.1, 1), cu, 0.05, 0.53, -0.58, so); add(tbox(0.85, 0.16, 1.1, 1), cu, 0.05, 0.53, 0.58, so);
  add(tbox(0.28, 1.0, 2.4, 1), cu2, -0.4, 0.5, 0, so); for (const s of [-1, 1]) add(tbox(1.0, 0.65, 0.22, 1), cu2, 0, 0.33, s * 1.25, so); }
add(tbox(0.86, 1.06, 0.03, 1), M.darkWood, CALX, 3.0, -2.985, lr, { cast: false });
const calS = mkSign(0.8, 1.0, 320, 400, lr, CALX, 3.0, -2.965);
add(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 28).rotateX(Math.PI / 2), M.darkWood, CLX, 3.2, -2.97, lr);
const clkS = mkSign(0.84, 0.84, 336, 336, lr, CLX, 3.2, -2.935);
{ add(tbox(1.6, 0.06, 0.3, 1), M.darkWood, 3.0, 1.9, -2.85, lr); const PC = ['#e2453c', '#ffd23f', '#3f7fd0', '#5ad0a0', '#ff8a3a', '#7a5ad0'];
  for (let i = 0; i < 7; i++) add(tbox(0.09, 0.28, 0.2, 1), toon({ color: PC[i % 6] }), 2.35 + i * 0.13, 2.07, -2.85, lr); }
{ const s = mkSign(1.1, 1.4, 330, 420, lr, -1.5, 3.4, -2.98); redraw(s, 'po', (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff7ab0'); gr.addColorStop(1, '#3a1a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.beginPath(); g.arc(w / 2, h * 0.62, 90, 0, 7); g.fillStyle = '#ffd36a'; g.fill(); g.fillStyle = '#2a1838'; for (let x = 0; x < w; x += 30) g.fillRect(x, h * 0.72 - (x * 7 % 60), 26, 200);
  txt(g, 'VICE', w / 2, 70, 80, '#ffffff', INKC, 10); g.lineWidth = 12; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h); }); }

// ---------- ST: game store at night, 2013 ----------
const st = new THREE.Group(); st.position.set(...ST); scene.add(st);
M.floorT = texM(tilesC('#f2f0ea', '#d8dde2', 6), 1, 1); M.shelf = toon({ color: '#e8e4dc' }); M.shelfD = toon({ color: '#8a929c' });
M.glassD = toon({ color: '#a8d8ea', transparent: true, opacity: 0.4 });
const PCOL = ['#e2453c', '#ffd23f', '#3f7fd0', '#5ad0a0', '#ff8a3a'];
slab(-6.4, 6.4, -6.2, 9, st, M.floorT); slab(-24, 24, -40, -6.2, st, M.asphalt, 0, 0.7, 4);
slab(-24, -6.4, -6.2, 16, st, M.concrete, 0, 0.7, 2); slab(6.4, 24, -6.2, 16, st, M.concrete, 0, 0.7, 2); slab(-6.4, 6.4, 9, 16, st, M.concrete, 0, 0.7, 2);
for (const s of [-1, 1]) add(tbox(0.3, 5.6, 15.5, 3), M.storeW, s * 6.55, 2.8, 1.5, st);
add(tbox(13.4, 5.6, 0.3, 3), M.storeW, 0, 2.8, 9.1, st);
for (const s of [-1, 1]) add(tbox(5.0, 5.6, 0.3, 3), M.storeW, s * 3.9, 2.8, -6.35, st);
add(tbox(2.8, 3.0, 0.3, 3), M.storeW, 0, 4.1, -6.35, st);
add(tbox(13.6, 0.5, 15.9, 2), M.concrete, 0, 5.85, 1.4, st);
add(tbox(14.0, 0.3, 1.4, 1), M.red, 0, 5.4, -7.1, st);
const winMat = basicM('#ffe3a0');
for (const s of [-1, 1]) { add(tbox(3.6, 2.0, 0.04, 1), winMat, s * 3.9, 1.5, -6.52, st, { cast: false }); add(tbox(3.8, 0.12, 0.12, 1), M.white, s * 3.9, 2.56, -6.55, st); add(tbox(3.8, 0.12, 0.12, 1), M.white, s * 3.9, 0.44, -6.55, st); }
for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const b = add(tbox(0.5, 0.7, 0.06, 1), toon({ color: PCOL[(i + (s > 0 ? 2 : 0)) % 5] }), s * 3.9 + (i - 1) * 1.0, 1.35, -6.56, st, { cast: false }); b.rotation.x = 0.05; }
const doorL = add(tbox(1.4, 2.6, 0.05, 1), M.glassD, -0.7, 1.3, -6.1, st, { cast: false }), doorR = add(tbox(1.4, 2.6, 0.05, 1), M.glassD, 0.7, 1.3, -6.1, st, { cast: false });
add(tbox(2.6, 0.04, 6, 1), basicM('#fff6e0'), 0, 5.55, 1.4, st, { cast: false });
{ const s = mkSign(2.4, 0.86, 720, 258, st, 0, 4.45, -6.53, true); s.m.rotation.y = Math.PI; redraw(s, 'g', (g, w, h) => { g.fillStyle = '#1d2a4a'; rr(g, 4, 4, w - 8, h - 8, 34); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ffd23f'; g.stroke(); g.shadowColor = '#ffd23f'; g.shadowBlur = 20; txt(g, 'GAMES', w / 2, h / 2 + 6, 150, '#ffd23f'); g.shadowBlur = 0; }); }
const clockS = mkSign(1.3, 0.6, 390, 180, st, -2.45, 3.35, -6.56, true); clockS.m.rotation.y = Math.PI;
add(tbox(1.42, 0.72, 0.06, 1), M.tvBk, -2.45, 3.35, -6.52, st);
add(tbox(2.12, 1.42, 0.06, 1), M.tvBk, 2.6, 3.55, -6.52, st);
const dayS = mkSign(2.0, 1.3, 600, 390, st, 2.6, 3.55, -6.56, true); dayS.m.rotation.y = Math.PI;
{ const cols = PCOL.map((c) => toon({ color: c })), N = 260, inst = cols.map((m) => new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), m, N)), cnt = cols.map(() => 0), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), r = P.rng(55);
  for (const sx of [-1, 1]) { const x = sx * 2.4;
    add(tbox(0.06, 1.9, 6, 1), M.shelfD, x, 0.95, 2, st); add(tbox(0.9, 0.12, 6, 1), M.shelfD, x, 0.06, 2, st);
    for (const y of [0.55, 1.05, 1.55]) add(tbox(0.9, 0.04, 6, 1), M.shelf, x, y, 2, st, { cast: false });
    for (const y of [0.12, 0.57, 1.07, 1.57]) for (const fx of [-1, 1]) for (let z = -0.85; z < 4.9; z += 0.21) {
      const k = Math.floor(r() * 5); if (cnt[k] >= N) continue; const hh = 0.7 + r() * 0.5; p.set(x + fx * 0.25, y + 0.13 * hh, z); sc.set(1, hh, 1); m4.compose(p, qq, sc); inst[k].setMatrixAt(cnt[k]++, m4); } }
  inst.forEach((m, k) => { m.count = cnt[k]; m.castShadow = m.receiveShadow = true; st.add(m); }); }
for (const [x, z] of [[-11, -9.2], [8.5, -9.2], [-9.2, 3]]) { add(new THREE.CylinderGeometry(0.07, 0.09, 5.5, 6), M.tvBk, x, 2.75, z, st); add(new THREE.SphereGeometry(0.26, 10, 8), basicM('#fff2c0'), x, 5.55, z, st, { cast: false }); }
for (let z = -38; z < -10; z += 6) add(tbox(0.15, 0.01, 2.5, 1), M.yellow, 0, 0.005, z - 4, st, { cast: false });
{ const r = P.rng(77); let k = 0; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const h = 7 + r() * 9; add(tbox(7, h, 8, 4), M.facades[k++ % 6], s * (14 + i * 8.5), h / 2, -34 - r() * 4, st); } }
for (const s of [-1, 1]) { add(tbox(6.5, 6 + (s > 0 ? 2 : 0), 14, 4), M.facades[s > 0 ? 2 : 4], s * 11, (6 + (s > 0 ? 2 : 0)) / 2, 3, st); }
mkPalm(st, 9.5, -12.5, 6.5, -0.1, 6);
// server rack on the sidewalk (falls toward the street, pivot on its front-bottom edge)
const rackG = new THREE.Group(); rackG.position.set(RK[0], 0, RK[2] - 0.35); st.add(rackG);
const rackLeds = [];
{ const body = new THREE.Group(); body.position.set(0, 0, 0.35); rackG.add(body);
  add(tbox(0.9, 2.1, 0.7, 1), M.tvBk, 0, 1.05, 0, body); add(tbox(0.96, 0.08, 0.76, 1), M.steelD, 0, 2.12, 0, body);
  for (let i = 0; i < 7; i++) { add(tbox(0.78, 0.2, 0.02, 1), M.steelD, 0, 0.3 + i * 0.25, -0.36, body);
    for (let k = 0; k < 3; k++) { const m = add(tbox(0.05, 0.05, 0.02, 1), basicM('#5aff7a'), -0.28 + k * 0.08, 0.3 + i * 0.25, -0.375, body, { cast: false }); rackLeds.push(m); } }
  const s = mkSign(0.8, 0.26, 320, 104, body, 0, 1.98, -0.37, true); s.m.rotation.y = Math.PI;
  redraw(s, 'sv', (g, w, h) => { g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h); txt(g, 'SERVIDOR', w / 2, h / 2 + 4, 58, '#1d2a4a'); }); }

// ---------- WD: western street (Red Dead) ----------
const wd = new THREE.Group(); wd.position.set(...WD); scene.add(wd);
slab(-30, 30, -24, 20, wd, M.sand, 0, 0.7, 6);
{ const sal = new THREE.Group(); sal.position.set(-1.0, 0, -6); wd.add(sal);
  add(tbox(10, 5.0, 1.2, 3), M.plank, 0, 2.5, 0, sal); add(tbox(7, 1.8, 0.4, 2), M.plank, 0, 5.9, 0.2, sal);
  add(tbox(10.4, 0.2, 2.6, 2), M.darkWood, 0, 3.0, 1.6, sal); for (const x of [-4.8, -1.6, 1.6, 4.8]) add(new THREE.CylinderGeometry(0.1, 0.1, 3.0, 8), M.darkWood, x, 1.5, 2.75, sal);
  add(tbox(10.4, 0.25, 3.0, 1), M.darkWood, 0, 0.12, 1.5, sal, { cast: false });
  add(tbox(1.6, 2.2, 0.08, 1), M.door, 0, 1.25, 0.64, sal); for (const x of [-3.2, 3.2]) add(tbox(1.4, 1.2, 0.06, 1), basicM('#ffd9a0'), x, 1.8, 0.63, sal, { cast: false });
  const s = mkSign(5.4, 1.2, 900, 200, sal, 0, 5.9, 0.42); redraw(s, 'sl', (g, w, h) => { g.fillStyle = '#e8c890'; g.fillRect(0, 0, w, h); g.lineWidth = 10; g.strokeStyle = '#4a3020'; g.strokeRect(5, 5, w - 10, h - 10); txt(g, 'SALOON', w / 2, h / 2 + 6, 150, '#5a2a14'); }); }
{ const r = P.rng(41); for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const h = 4 + r() * 2, x = s * (12 + i * 7); add(tbox(6, h, 6, 3), M.plank, x, h / 2, -8 - r() * 4, wd); } }
M.cactus = toon({ color: '#4f9a4a' });
const cactus = (x, z, h = 2.4) => { const g = new THREE.Group(); g.position.set(x, 0, z); wd.add(g); add(new THREE.CylinderGeometry(0.26, 0.3, h, 10), M.cactus, 0, h / 2, 0, g);
  for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8), M.cactus, s * 0.5, h * 0.55, 0, g).rotation.z = Math.PI / 2; add(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 8), M.cactus, s * 0.82, h * 0.55 + 0.4 + (s > 0 ? 0.2 : 0), 0, g); } };
cactus(-7.5, 1.5, 2.6); cactus(8.2, -1.5, 3.0); cactus(-12, 6, 2.2); cactus(13, 7, 2.5);
for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI + Math.PI, d = 70 + (i % 3) * 18; const m = add(new THREE.SphereGeometry(1, 12, 8), M.rock, Math.cos(a) * d, 0, Math.sin(a) * d * 0.7 - 20, wd, { cast: false }); m.scale.set(14 + (i * 7) % 10, 10 + (i * 5) % 12, 10); }
const rdG = new THREE.Group(); rdG.position.set(...RDP); wd.add(rdG);
for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.1, 0.12, 3.6, 8), M.darkWood, s * 1.3, 1.8, -0.08, rdG);
add(tbox(3.0, 2.2, 0.1, 1), M.darkWood, 0, 2.6, -0.1, rdG);
const rdS = mkSign(2.8, 2.0, 700, 500, rdG, 0, 2.6, -0.04);

// ---------- PZ: city lot that builds itself, then the party ----------
const pz = new THREE.Group(); pz.position.set(...PZ); scene.add(pz);
slab(-30, 30, -30, 18, pz, M.pave, 0, 0.7, 4);
slab(-11, 11, -26, -3, pz, texM(P2.sand(33), 1, 1), 0.03, 0.7, 3);
backFac(pz, 12, -38, 18);
const BLD = [[-8, -21, 4, 13, 0], [-3.5, -22, 4, 17, 1], [1.5, -21.5, 4.5, 11, 2], [6.5, -21, 4, 15, 3], [-8.2, -14.5, 3.6, 8, 4], [-3.8, -15.5, 3.4, 10, 5], [1.0, -14.5, 3.6, 7, 0], [-8.4, -8.5, 3.4, 5.5, 2]];
const bldG = BLD.map(([x, z, w, h, k]) => { const g = new THREE.Group(); g.position.set(x, 0, z); pz.add(g); add(tbox(w, h, w, 3), M.facades[k], 0, h / 2, 0, g); add(tbox(w + 0.3, 0.3, w + 0.3, 1), M.concrete, 0, h + 0.15, 0, g); g.scale.set(1, 0.001, 1); g.visible = false; return g; });
const craneG = new THREE.Group(); craneG.position.set(-11.5, 0, -18); pz.add(craneG);
{ const cy = toon({ color: '#f2b82a' }); add(tbox(0.6, 20, 0.6, 2), cy, 0, 10, 0, craneG); add(tbox(14, 0.5, 0.5, 2), cy, 5, 20, 0, craneG); add(tbox(1.2, 1.2, 1.2, 1), M.tvBk, -1.0, 19.6, 0, craneG);
  const hook = rod(craneG, M.ink, 0.03); setRod(hook, [9, 20, 0], [9, 15, 0]); add(tbox(0.7, 0.4, 0.7, 1), M.steelD, 9, 14.8, 0, craneG); }
const festaG = new THREE.Group(); festaG.position.set(...FP); pz.add(festaG);
{ add(tbox(6, 3.6, 4.5, 2), toon({ color: '#ff7ab0' }), 0, 1.8, 0, festaG); add(tbox(6.6, 0.4, 5.1, 1), toon({ color: '#7a2a8a' }), 0, 3.8, 0, festaG);
  add(tbox(1.6, 2.4, 0.08, 1), basicM('#ffe9a0'), 0, 1.2, 2.27, festaG, { cast: false });
  const s = mkSign(4.2, 1.2, 840, 240, festaG, 0, 4.9, 0.5, true); redraw(s, 'fe', (g, w, h) => { g.fillStyle = '#1a0c28'; rr(g, 4, 4, w - 8, h - 8, 40); g.fill(); g.shadowColor = '#ff5fb0'; g.shadowBlur = 30; txt(g, 'FESTA', w / 2, h / 2 + 8, 170, '#ffe0f4'); g.shadowBlur = 0; });
  const ball = add(new THREE.SphereGeometry(0.55, 16, 12), M.steelL, 0, 6.6, 0.5, festaG); ball.name = 'ball';
  for (let i = 0; i < 12; i++) add(new THREE.SphereGeometry(0.1, 8, 6), basicM(['#ff5fb0', '#ffd23f', '#5ad0ff'][i % 3]), -3 + i * 0.55, 3.55 - 0.25 * Math.sin(i / 11 * Math.PI), 2.4, festaG, { cast: false }); }
festaG.scale.setScalar(0.001); festaG.visible = false;
const boardG = new THREE.Group(); boardG.position.set(...BRD); pz.add(boardG);
for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.07, 0.08, 2.6, 8), M.darkWood, s * 1.4, 1.3, -0.06, boardG);
add(tbox(3.3, 2.0, 0.08, 1), M.darkWood, 0, 2.3, -0.08, boardG);
const brdS = mkSign(3.1, 1.8, 868, 504, boardG, 0, 2.3, -0.02);
mkPalm(pz, -14, 2, 7, 0.1, 1); mkPalm(pz, 14, 1, 7.5, -0.1, 2); mkPalm(pz, 13, -8, 6.5, 0.1, 3);

// ---------- TB: two towers at night — new empty GTA 6, old packed GTA 5 ----------
const tb = new THREE.Group(); tb.position.set(...TB); scene.add(tb);
slab(-34, 34, -26, 24, tb, M.pave, 0, 0.7, 6);
slab(-34, 34, 9, 24, tb, M.asphalt, 0.02, 0.7, 6);
for (let x = -30; x < 32; x += 6) add(tbox(2.5, 0.01, 0.15, 1), M.yellow, x, 0.03, 16.5, tb, { cast: false });
backFac(tb, 33, -40, 24);
const winC = (cols, rows, lit, seed, base, glass) => { const c = document.createElement('canvas'); c.width = 512; c.height = 1024; const g = c.getContext('2d'), r = P.rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 512, 1024); const cw = 512 / cols, ch = 1024 / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const on = r() < lit; g.fillStyle = on ? (r() < 0.5 ? '#ffe39a' : '#ffc8f0') : glass; g.fillRect(i * cw + cw * 0.14, j * ch + ch * 0.18, cw * 0.72, ch * 0.64); }
  return c; };
const b6 = new THREE.Group(); b6.position.set(...B6); tb.add(b6);
{ const tex = P.tex(winC(8, 22, 0, 61, '#3a4a6a', '#1a2440'));
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#9aa8c8' }); add(tbox(9, 28, 8, 1), toon({ color: '#3a4a6a' }), 0, 14, 0, b6);
  add(new THREE.PlaneGeometry(9, 26), mat, 0, 15, 4.02, b6, { cast: false });
  add(tbox(9.4, 0.4, 8.4, 1), M.steelL, 0, 28.2, 0, b6);
  add(tbox(4, 3, 0.1, 1), M.glassD, 0, 1.5, 4.05, b6, { cast: false }); add(tbox(4.4, 0.3, 0.3, 1), M.steelL, 0, 3.1, 4.1, b6);
  const top = mkSign(7.6, 2.6, 900, 308, b6, 0, 26.6, 4.12, true); redraw(top, 't6', (g, w, h) => { g.fillStyle = '#10142a'; rr(g, 4, 4, w - 8, h - 8, 40); g.fill(); g.lineWidth = 10; g.strokeStyle = '#5ad0ff'; g.stroke(); g.shadowColor = '#5ad0ff'; g.shadowBlur = 30; txt(g, 'GTA 6', w / 2, h / 2 + 10, 220, '#e8fbff'); g.shadowBlur = 0; });
  const rib = mkSign(5.6, 0.9, 900, 144, b6, 0, 3.6, 4.2, true); redraw(rib, 'in', (g, w, h) => { g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, h); txt(g, 'INAUGURAÇÃO', w / 2, h / 2 + 4, 96, '#ffffff'); });
  const rr2 = add(tbox(4.4, 0.08, 0.04, 1), M.red, 0, 1.2, 4.25, b6); }
const b5 = new THREE.Group(); b5.position.set(...B5); tb.add(b5);
{ const tex = P.tex(winC(6, 9, 0.85, 62, '#7a3a2a', '#3a1a1a'));
  add(tbox(9, 12, 6, 3), M.bricks, 0, 6, 0, b5);
  add(new THREE.PlaneGeometry(8.4, 6.2), new THREE.MeshBasicMaterial({ map: tex, color: '#d8c0b8' }), 0, 7.9, 3.02, b5, { cast: false });
  add(tbox(9.4, 0.4, 6.4, 1), M.concrete, 0, 12.2, 0, b5);
  add(tbox(3.2, 2.8, 0.1, 1), basicM('#ffd9a0'), 0, 1.4, 3.05, b5, { cast: false }); add(tbox(3.6, 0.3, 0.3, 1), M.darkWood, 0, 2.95, 3.1, b5);
  for (let i = 0; i < 16; i++) add(new THREE.SphereGeometry(0.09, 8, 6), basicM(['#ff5fb0', '#ffd23f', '#5ad0ff', '#7dff6a'][i % 4]), -4.2 + i * 0.56, 4.55 - 0.2 * Math.sin(i / 15 * Math.PI), 3.3, b5, { cast: false });
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), M.tvBk, s * 2.2, 13.2, 0.4, b5); }
const neonS = mkSign(7.6, 1.7, 1140, 255, b5, 0, 11.0, 3.15, true);
const infoS = mkSign(4.6, 2.2, 828, 396, b5, 0, 3.6 + 2.0, 3.12, true);
add(tbox(4.8, 2.4, 0.06, 1), M.tvBk, B5[0], 5.6, B5[2] + 3.08, tb);
const cntG = new THREE.Group(); cntG.position.set(0, 15.0, 0.4); b5.add(cntG);
add(tbox(5.4, 2.4, 0.16, 1), M.tvBk, 0, 0, -0.1, cntG);
const cntS = mkSign(5.2, 2.2, 1040, 440, cntG, 0, 0, 0.0, true);
// exec's podium + speech bubble
const podG = new THREE.Group(); podG.position.set(...PODP); tb.add(podG);
add(tbox(0.9, 1.05, 0.5, 1), toon({ color: '#1d2a4a' }), 0, 0.525, 0.42, podG);
{ const mic = rod(podG, M.ink, 0.02); setRod(mic, [0, 1.05, 0.3], [0, 1.4, 0.15]); add(new THREE.SphereGeometry(0.05, 8, 6), M.steelD, 0, 1.42, 0.14, podG); }
const bubG = new THREE.Group(); bubG.position.set(0.35, 3.05, 0.2); bubG.userData.s = 0.82; podG.add(bubG);
const bubS = mkSign(2.8, 1.6, 700, 400, bubG, 0, 0, 0, true);
redraw(bubS, 'b', (g, w, h) => { g.fillStyle = '#ffffff'; rr(g, 10, 10, w - 20, h - 90, 60); g.fill(); g.beginPath(); g.moveTo(170, h - 84); g.lineTo(110, h - 8); g.lineTo(260, h - 84); g.closePath(); g.fill(); g.lineWidth = 12; g.strokeStyle = INKC; rr(g, 10, 10, w - 20, h - 90, 60); g.stroke();
  txt(g, 'TODO MOTIVO', w / 2, 110, 88, '#1d2a4a'); txt(g, 'PRA CONTINUAR!', w / 2, 220, 80, '#d0352f'); });
for (const [x, z] of [[-16, 6], [-1.0, 6], [16, 6], [-24, -2], [24, -2]]) { add(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), M.tvBk, x, 3, z, tb); add(new THREE.SphereGeometry(0.3, 10, 8), basicM('#fff2c0'), x, 6.1, z, tb, { cast: false }); }
mkPalm(tb, -15, 2, 8, 0.1, 11); mkPalm(tb, 15.5, 2, 7.5, -0.1, 12); mkPalm(tb, 1.0, -6, 7, 0.06, 13);

// ---------- per-frame drawing ----------
const drawTV = (g, w, h, T_) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1a5a'); gr.addColorStop(1, '#ff5fb0'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(20,10,40,.55)'; for (let x = 0; x < w; x += 46) g.fillRect(x, h * 0.62 - ((x * 13) % 90), 40, 200);
  if (T_.m === 'title') { txt(g, 'GTA 6', w / 2, 190, 200, '#ffffff', INKC, 16); popS(g, w / 2, 350, T_.nv, () => { g.fillStyle = '#ffd23f'; rr(g, -150, -46, 300, 92, 22); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke(); txt(g, 'NOVO!', 0, 4, 70, '#d0352f'); }); return; }
  txt(g, 'GTA 6', w / 2, 60, 70, '#ffffff', INKC, 10);
  if (T_.m === 'friends') { g.fillStyle = 'rgba(10,8,30,.75)'; rr(g, 70, 110, w - 140, 310, 26); g.fill(); txt(g, 'CONVIDAR AMIGOS', w / 2, 160, 56, '#ffffff');
    for (let k = 0; k < 3; k++) { const x = w / 2 + (k - 1) * 200, y = 300; g.globalAlpha = T_.lock > 0 ? 0.35 : 1; g.fillStyle = '#8fb0ff'; g.beginPath(); g.arc(x, y - 40, 40, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y + 50, 64, 46, 0, Math.PI, 0); g.fill(); g.globalAlpha = 1; }
    popS(g, w / 2, 300, T_.lock, () => { g.fillStyle = '#ffd23f'; g.lineWidth = 10; g.strokeStyle = INKC; g.beginPath(); g.arc(0, -40, 46, Math.PI, 0); g.lineWidth = 22; g.stroke(); g.lineWidth = 16; g.strokeStyle = '#ffd23f'; g.stroke(); rr(g, -70, -40, 140, 110, 16); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke(); g.fillStyle = INKC; g.beginPath(); g.arc(0, 8, 14, 0, 7); g.fill(); g.fillRect(-5, 8, 10, 32); });
    return; }
  // menu
  const item = (y, s, on, sel) => { g.fillStyle = sel ? '#ffffff' : 'rgba(10,8,30,.7)'; rr(g, 90, y - 50, w - 180, 100, 22); g.fill(); txt(g, s, w / 2 - 30, y + 2, 58, on ? (sel ? '#1d2a4a' : '#ffffff') : 'rgba(255,255,255,.35)'); };
  item(180, 'MODO HISTÓRIA', true, true); item(320, 'ONLINE', false, false);
  popS(g, w - 140, 180, T_.ok, () => { g.fillStyle = '#2f8a3a'; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(-18, 2); g.lineTo(-4, 16); g.lineTo(20, -14); g.stroke(); });
  stamp(g, w / 2, 322, T_.st, 'INDISPONÍVEL', '#d0352f', 76, -0.1);
};
const drawCal = (g, w, h, C) => { g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, 96); txt(g, 'ONLINE', w / 2, 52, 60, '#ffffff');
  txt(g, 'DATA:', w / 2, 150, 46, '#1d2a4a'); popS(g, w / 2, 270, C.q, () => txt(g, '???', 0, 0, 150, '#d0352f')); g.lineWidth = 8; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h); };
const drawClk = (g, w, h, a) => { g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 8, 0, 7); g.fillStyle = '#fbf6e8'; g.fill(); g.lineWidth = 12; g.strokeStyle = INKC; g.stroke();
  for (let i = 0; i < 12; i++) { const t = i / 12 * 6.283; g.fillStyle = INKC; g.beginPath(); g.arc(w / 2 + Math.sin(t) * 130, h / 2 - Math.cos(t) * 130, 9, 0, 7); g.fill(); }
  g.lineCap = 'round'; const hand = (t, L, lw, c) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(t) * L, h / 2 - Math.cos(t) * L); g.stroke(); };
  hand(a / 12 * 6.283, 80, 16, INKC); hand(a * 6.283, 120, 9, '#d0352f'); };
const drawDate = (g, w, h, s) => { g.fillStyle = '#0c0c14'; g.fillRect(0, 0, w, h); g.shadowColor = '#7dff6a'; g.shadowBlur = 20; txt(g, s, w / 2, h / 2 + 6, fit(s, 120, w - 30), '#7dff6a'); g.shadowBlur = 0; };
const drawDay = (g, w, h, D) => { g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.lineWidth = 12; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
  g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, 100); txt(g, 'GTA 5 · 2013', w / 2, 54, 62, '#ffffff');
  if (D.m === 'solo') { popS(g, w / 2, 245, D.s, () => { txt(g, 'SÓ HISTÓRIA', 0, -40, 70, '#1d2a4a'); txt(g, 'ONLINE: FECHADO', 0, 50, 50, '#d0352f'); }); return; }
  if (D.m === 'wait') { txt(g, 'ONLINE ABRE EM', w / 2, 160, 46, '#1d2a4a'); txt(g, D.d + (D.d === 1 ? ' DIA' : ' DIAS'), w / 2, 270, 100, '#d0352f'); return; }
  if (D.m === 'open') { g.fillStyle = '#2f8a3a'; rr(g, 60, 150, w - 120, 190, 26); g.fill(); txt(g, 'ONLINE', w / 2, 200, 56, '#ffffff'); txt(g, 'ABRIU!', w / 2, 290, 90, '#ffffff'); return; }
  const r = P.rng(D.gl + 3); g.fillStyle = '#d0352f'; g.fillRect(40, 140, w - 80, 210); for (let i = 0; i < 6; i++) { g.fillStyle = r() < 0.5 ? '#0c0c14' : '#ffffff'; g.fillRect(r() * w, 140 + r() * 210, 40 + r() * 140, 10 + r() * 18); }
  txt(g, 'ERRO', w / 2 + (r() - 0.5) * 16, 250, 130, '#ffffff', INKC, 10); };
const drawRD = (g, w, h, D) => { g.fillStyle = '#e8c890'; g.fillRect(0, 0, w, h); g.lineWidth = 14; g.strokeStyle = '#4a3020'; g.strokeRect(7, 7, w - 14, h - 14);
  g.fillStyle = '#7a2a14'; g.fillRect(14, 14, w - 28, 110); txt(g, 'RED DEAD 2', w / 2, 72, 86, '#fbe8c0');
  txt(g, 'O ONLINE ABRIU EM', w / 2, 180, 50, '#4a3020');
  if (D.mes > 0) popS(g, w / 2, 330, D.mes, () => txt(g, '1 MÊS', 0, 0, 140, '#7a2a14', '#fbe8c0', 12));
  else if (D.d > 0) txt(g, 'DIA ' + D.d, w / 2, 330, 130, '#4a3020');
  if (D.mes > 0 || D.d > 0) txt(g, 'OUT → NOV 2018', w / 2, 455, 40, '#7a4a24'); };
const drawBrd = (g, w, h, B) => { g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); g.lineWidth = 12; g.strokeStyle = '#4a3020'; g.strokeRect(6, 6, w - 12, h - 12);
  txt(g, 'SEMPRE ASSIM:', w / 2, 80, 72, '#1d2a4a');
  popS(g, w / 2, 220, B.a, () => txt(g, '1. A CIDADE', 0, 0, 92, '#3f7fd0'));
  popS(g, w / 2, 360, B.b, () => txt(g, '2. A FESTA', 0, 0, 92, '#d04a9a'));
  if (B.c > 0) stamp(g, w / 2, 440, B.c, 'DETALHE', '#d0352f', 60, -0.08); };
const drawNeon = (g, w, h, N_) => { g.fillStyle = '#140a1e'; rr(g, 4, 4, w - 8, h - 8, 50); g.fill(); g.lineWidth = 10; g.strokeStyle = N_.five ? '#ffd23f' : '#ff5fb0'; g.stroke();
  if (!N_.on) return; g.shadowColor = N_.five ? '#ffd23f' : '#ff5fb0'; g.shadowBlur = 34;
  if (N_.five) { g.save(); g.translate(w / 2, h / 2 + 8); g.scale(N_.five, N_.five); txt(g, 'GTA 5', 0, 0, 200, '#fff6d0'); g.restore(); }
  else txt(g, 'GTA ONLINE', w / 2, h / 2 + 8, 170, '#ffe0f4');
  g.shadowBlur = 0; };
const drawInfo = (g, w, h, I) => { g.fillStyle = '#0c0c18'; g.fillRect(0, 0, w, h); g.lineWidth = 10; g.strokeStyle = '#5ad0ff'; g.strokeRect(5, 5, w - 10, h - 10);
  popS(g, w / 2, 80, I.since, () => txt(g, 'DESDE 2013', 0, 0, 84, '#ffffff'));
  popS(g, w / 2, 200, I.on, () => { g.beginPath(); g.arc(-200, 0, 26, 0, 7); g.fillStyle = '#7dff6a'; g.shadowColor = '#7dff6a'; g.shadowBlur = 20; g.fill(); g.shadowBlur = 0; txt(g, 'LIGADO', 40, 4, 92, '#7dff6a'); });
  popS(g, w / 2, 320, I.up, () => { g.fillStyle = '#ffd23f'; rr(g, -330, -50, 660, 100, 20); g.fill(); txt(g, 'NOVA ATUALIZAÇÃO', 0, 4, 62, '#1d2a4a'); }); };
const drawCnt = (g, w, h, C) => { g.fillStyle = '#14204a'; g.fillRect(0, 0, w, h); g.lineWidth = 14; g.strokeStyle = '#ffd23f'; g.strokeRect(7, 7, w - 14, h - 14);
  txt(g, 'JOGADORES POR SEMANA', w / 2, 80, 62, '#8fb0ff');
  if (C.big > 0) popS(g, w / 2, 260, C.big, () => txt(g, 'MILHÕES', 0, 0, 190, '#ffd23f', INKC, 14));
  else txt(g, fmtT(C.v), w / 2, 260, 170, '#7dff6a'); };
function worldState(S, f) {
  redraw(tvS, JSON.stringify(S.tv), (g, w, h) => drawTV(g, w, h, S.tv));
  redraw(calS, 'c' + S.calQ, (g, w, h) => drawCal(g, w, h, { q: S.calQ }));
  redraw(clkS, 'k' + S.clk, (g, w, h) => drawClk(g, w, h, S.clk));
  redraw(clockS, S.date, (g, w, h) => drawDate(g, w, h, S.date));
  redraw(dayS, JSON.stringify(S.day), (g, w, h) => drawDay(g, w, h, S.day));
  doorL.position.x = -0.7 - 1.3 * S.doors; doorR.position.x = 0.7 + 1.3 * S.doors;
  rackG.rotation.x = -1.45 * S.rack; rackLeds.forEach((m, i) => { m.material.color.set(S.rack > 0.05 ? (((i * 7 + Math.floor(f / 3)) % 5) ? '#2a0808' : '#ff3a2a') : (((i * 5 + Math.floor(f / 4)) % 4) ? '#5aff7a' : '#1a5a2a')); });
  redraw(rdS, JSON.stringify(S.rd), (g, w, h) => drawRD(g, w, h, S.rd));
  bldG.forEach((g, i) => { const s = S.bld[i]; g.visible = s > 0.002; g.scale.y = Math.max(0.001, s); });
  festaG.visible = S.festa > 0.002; festaG.scale.setScalar(Math.max(0.001, S.festa)); festaG.getObjectByName('ball').rotation.y = f * 0.08;
  redraw(brdS, JSON.stringify(S.brd), (g, w, h) => drawBrd(g, w, h, S.brd));
  redraw(neonS, JSON.stringify(S.neon), (g, w, h) => drawNeon(g, w, h, S.neon));
  redraw(infoS, JSON.stringify(S.info), (g, w, h) => drawInfo(g, w, h, S.info));
  redraw(cntS, JSON.stringify(S.cnt), (g, w, h) => drawCnt(g, w, h, S.cnt));
  podG.visible = S.pod; bubG.visible = S.bub > 0.002; bubG.scale.setScalar(Math.max(0.001, S.bub * 0.82));
}

// clouds: painted billboards far away (no fog, no ink)
const clouds = [];
{ const r = P.rng(90);
  for (let i = 0; i < 18; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = rx(200 + r() * 140), d = 900 + r() * 300; m.position.set(Math.cos(a) * d, 160 + r() * 200, Math.sin(a) * d - 200); m.scale.setScalar(220 + r() * 160);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); clouds.push(m);
  } }
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
  lamp.color.set(L.lampCol || '#ffe7b0'); lamp.intensity = L.lamp || 0; if (L.lampAt) lamp.position.set(...L.lampAt);
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
  for (const c of clouds) { c.quaternion.copy(camera.quaternion); c.material.color.set(L.cloud || '#ffffff'); }
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

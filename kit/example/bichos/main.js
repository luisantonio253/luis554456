import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PO, RO, ST, SR, MP, LE, NA, CN, TVP, TVY, TVYAW, CAL, PPH, BH, DH, BAG, CARP, MENU, BF, HOUSES, CMP, BILL, ROCK, GATOR, FLAM, PANELS, DESK, SLOTS } from './story.js';

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
// ======================= WORLD: "As cenas absurdas do trailer" =======================
const world = new THREE.Group(); scene.add(world);
{ const g = new THREE.PlaneGeometry(4000, 4000); g.rotateX(-Math.PI / 2); planarUV(g, 6); add(g, M.grass, 0, -0.3, 0, world, { cast: false }); } // >= 25 cm below every set floor
for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2 + 0.1, d = 420 + rngW() * 140, h = 18 + rngW() * 26; const m = add(new THREE.SphereGeometry(1, 16, 10), M.hill, Math.cos(a) * d, 0, Math.sin(a) * d, world, { cast: false }); m.scale.set(60 + rngW() * 50, h, 60 + rngW() * 50); }
{ // tree carpet, kept away from every set and the sea
  const KEEP = [[PO, 34], [RO, 26], [ST, 44], [SR, 95], [MP, 60]];
  const geo = new THREE.SphereGeometry(1, 10, 8), N = 650, inst = new THREE.InstancedMesh(geo, M.tree, N), inst2 = new THREE.InstancedMesh(geo, M.tree2, N), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0, k2 = 0;
  for (let i = 0; i < 8000 && (k < N || k2 < N); i++) {
    const x = (rngW() - 0.5) * 900, z = (rngW() - 0.5) * 700 - 40;
    if (KEEP.some(([c, r]) => Math.hypot(x - c[0], z - c[2]) < r)) continue;
    if (Math.abs(x - SR[0]) < 30 && z < SR[2] + 30 && z > SR[2] - 110) continue;
    if (Math.abs(x - MP[0]) < 125 && z < MP[2] + 30 && z > MP[2] - 300) continue;
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
const txt = (g, s, x, y, px, col, stroke = null, sw = 0) => { g.font = FONT(px); g.textAlign = 'center'; g.textBaseline = 'middle'; if (stroke) { g.lineJoin = 'round'; g.lineWidth = sw; g.strokeStyle = stroke; g.strokeText(s, x, y); } g.fillStyle = col; g.fillText(s, x, y); };
const INKC = '#241726';
const tilesC = (a, b, n = 8) => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), s = 256 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
  g.strokeStyle = 'rgba(40,30,40,.3)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke(); } return c; };
const slab = (x0, x1, z0, z1, par, mat, top = 0, th = 0.7, t = 2) => add(tbox(x1 - x0, th, z1 - z0, t), mat, (x0 + x1) / 2, top - th / 2, (z0 + z1) / 2, par, { cast: false });
const stamp = (g, x, y, s, word, col, px, rot = -0.22) => { if (s <= 0) return; g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.font = FONT(px);
  const tw = g.measureText(word).width; g.lineWidth = px * 0.14; g.strokeStyle = col; rr(g, -tw / 2 - px * 0.3, -px * 0.75, tw + px * 0.6, px * 1.5, px * 0.2); g.fillStyle = 'rgba(255,250,240,.9)'; g.fill(); g.stroke(); txt(g, word, 0, px * 0.05, px, col); g.restore(); };

// generic "game cover" art: sunset, skyline, palm, big number (no real logo)
const drawCover = (g, w, h, n, top, bot, seed) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.beginPath(); g.arc(w * 0.5, h * 0.66, Math.min(w, h) * 0.26, 0, 7); g.fillStyle = '#ffd36a'; g.fill();
  const r = P.rng(seed); g.fillStyle = '#2a1838';
  for (let x = 0; x < w; x += w / 13) { const bh = h * (0.1 + r() * 0.22); g.fillRect(x, h * 0.8 - bh, w / 13 - 3, bh + h * 0.25); }
  g.strokeStyle = '#2a1838'; g.lineCap = 'round'; g.lineWidth = Math.min(w, h) * 0.035;
  g.beginPath(); g.moveTo(w * 0.83, h); g.quadraticCurveTo(w * 0.87, h * 0.75, w * 0.8, h * 0.52); g.stroke();
  for (let k = 0; k < 6; k++) { const a = -3.0 + k * 0.6; g.beginPath(); g.moveTo(w * 0.8, h * 0.52); g.quadraticCurveTo(w * 0.8 + Math.cos(a) * w * 0.1, h * 0.52 + Math.sin(a) * h * 0.08 - 10, w * 0.8 + Math.cos(a) * w * 0.18, h * 0.52 + Math.sin(a) * h * 0.1 + 18); g.stroke(); }
  txt(g, String(n), w * 0.4, h * 0.34, Math.min(w * 0.9, h * 0.5), '#ffffff', INKC, Math.min(w, h) * 0.04);
};
// cartoon gator silhouette for 2D thumbnails
const gatorShape = (g, cx, cy, s) => { g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = '#4f7a3a'; g.strokeStyle = INKC; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(-150, 6); g.quadraticCurveTo(-90, -10, -60, -14); g.quadraticCurveTo(0, -30, 60, -12); g.lineTo(130, -6); g.lineTo(132, 8); g.lineTo(60, 14); g.quadraticCurveTo(0, 24, -60, 14); g.closePath(); g.fill(); g.stroke();
  for (const ex of [52, 70]) { g.beginPath(); g.arc(ex, -18, 9, 0, 7); g.fillStyle = '#ffffff'; g.fill(); g.stroke(); g.beginPath(); g.arc(ex + 2, -18, 4, 0, 7); g.fillStyle = INKC; g.fill(); }
  g.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(80 + i * 10, 6); g.lineTo(85 + i * 10, 13); g.lineTo(90 + i * 10, 6); g.fill(); } g.restore(); };
const PCOL = ['#e2453c', '#ffd23f', '#3f7fd0', '#5ad0a0', '#ff8a3a'];
const drawThumb = (g, x, y, w, h, kind) => {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); g.scale(w / 320, h / 240);
  if (kind === 'pool') {
    g.fillStyle = '#7fd0ff'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#f7a8b8'; g.fillRect(0, 30, 320, 90); g.fillStyle = '#c96a4a'; g.fillRect(0, 22, 320, 14);
    g.fillStyle = '#8fc4dc'; g.fillRect(125, 55, 70, 65); g.fillStyle = '#efe2c8'; g.fillRect(0, 120, 320, 120); g.fillStyle = '#4fb8e0'; g.fillRect(30, 140, 260, 84);
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(30, 140, 260, 84); gatorShape(g, 165, 180, 0.95);
  } else if (kind === 'store') {
    g.fillStyle = '#e8eef2'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#c8ccd2'; g.beginPath(); g.moveTo(0, 240); g.lineTo(125, 100); g.lineTo(195, 100); g.lineTo(320, 240); g.fill();
    g.fillStyle = '#a8d8ea'; g.fillRect(130, 40, 60, 60); g.fillStyle = '#e2453c'; g.fillRect(110, 20, 100, 16);
    for (let i = 0; i < 5; i++) { g.fillStyle = PCOL[i]; g.fillRect(0, 50 + i * 32, 90 - i * 8, 20); g.fillStyle = PCOL[(i + 2) % 5]; g.fillRect(230 + i * 8, 50 + i * 32, 90, 20); }
    gatorShape(g, 160, 195, 0.8);
  } else {
    g.fillStyle = '#2a1050'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#ff4fb0'; g.fillRect(0, 34, 320, 8); g.fillStyle = '#4fd8ff'; g.fillRect(0, 52, 320, 6);
    g.fillStyle = '#3a2a5a'; g.fillRect(0, 178, 320, 62); g.fillStyle = '#ffd23f'; for (let i = 0; i < 5; i++) g.fillRect(10 + i * 70, 205, 36, 6);
    g.fillStyle = '#2fd0c8'; rr(g, 70, 140, 180, 46, 12); g.fill(); g.lineWidth = 5; g.strokeStyle = INKC; g.stroke(); rr(g, 105, 116, 110, 30, 10); g.fill(); g.stroke();
    for (const wx of [110, 210]) { g.beginPath(); g.arc(wx, 188, 17, 0, 7); g.fillStyle = INKC; g.fill(); }
    g.strokeStyle = '#ff5aa8'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(160, 112); g.lineTo(160, 80); g.moveTo(160, 84); g.lineTo(140, 58); g.moveTo(160, 84); g.lineTo(182, 60); g.moveTo(160, 110); g.lineTo(150, 116); g.moveTo(160, 110); g.lineTo(172, 116); g.stroke();
    g.beginPath(); g.arc(160, 66, 13, 0, 7); g.fillStyle = '#c99067'; g.fill();
  }
  g.restore(); g.lineWidth = Math.max(2, w * 0.012); g.strokeStyle = INKC; g.strokeRect(x, y, w, h);
};
const drawTV = (g, w, h, S) => {
  if (S.m === 'cover') { drawCover(g, w, h, 6, '#ff6ac0', '#5a3ad0', 61); stamp(g, w / 2, h * 0.52, S.st, 'EXAGERADO', '#e0283a', 84); return; }
  drawThumb(g, 0, 0, w, h - 34, S.k);
  g.fillStyle = '#0c0c14'; g.fillRect(0, h - 34, w, 34); g.fillStyle = '#4a4a5a'; g.fillRect(60, h - 21, w - 80, 8); g.fillStyle = '#e0283a'; g.fillRect(60, h - 21, (w - 80) * S.p, 8);
  g.fillStyle = '#ffffff';
  if (S.m === 'pause') { g.fillStyle = 'rgba(10,10,20,.35)'; g.fillRect(0, 0, w, h - 34); g.fillStyle = '#ffffff'; g.fillRect(w / 2 - 48, h * 0.32, 32, 110); g.fillRect(w / 2 + 16, h * 0.32, 32, 110); g.fillRect(18, h - 27, 7, 20); g.fillRect(31, h - 27, 7, 20); }
  else { g.beginPath(); g.moveTo(18, h - 28); g.lineTo(40, h - 17); g.lineTo(18, h - 6); g.fill(); }
  if (S.rs) stamp(g, w / 2, h * 0.45, S.rs, 'RESUMO', '#e0283a', 110);
};
const drawCal = (g, w, h, C) => {
  g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.lineWidth = 10; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
  g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, 130);
  for (const x of [120, 360]) { g.beginPath(); g.arc(x, 22, 13, 0, 7); g.fillStyle = '#3a3a48'; g.fill(); }
  txt(g, 'DEZEMBRO 2023', w / 2, 78, 54, '#ffffff');
  'DSTQQSS'.split('').forEach((d, i) => txt(g, d, 48 + i * 64, 168, 30, '#8a7a8a'));
  for (let d = 1; d <= 31; d++) { const k = d - 1 + 5, cx = 48 + (k % 7) * 64, cy = 222 + Math.floor(k / 7) * 64;
    const hot = d === 5 && C.ring > 0;
    if (hot) { g.beginPath(); g.arc(cx, cy, 30 * C.ring, 0, 7); g.fillStyle = '#ffe14a'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#d0352f'; g.stroke(); }
    txt(g, String(d), cx, cy + 2, hot ? 36 : 30, hot ? '#d0352f' : '#2b2b3a'); }
};
const drawWin = (g, w, h, k) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, k > 0.5 ? '#5aa8f0' : '#101a44'); gr.addColorStop(1, k > 0.5 ? '#d8f0ff' : '#3a4a8a');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (k > 0.5) { g.beginPath(); g.arc(w * 0.7, h * 0.3, 26, 0, 7); g.fillStyle = '#fff3b0'; g.fill(); }
  else { g.fillStyle = '#ffffff'; const r = P.rng(4); for (let i = 0; i < 18; i++) g.fillRect(r() * w, r() * h * 0.7, 3, 3); g.beginPath(); g.arc(w * 0.3, h * 0.28, 18, 0, 7); g.fillStyle = '#f4f1ea'; g.fill(); }
  g.fillStyle = '#5a6a7a'; g.fillRect(0, h * 0.78, w, h * 0.22);
  g.lineWidth = 14; g.strokeStyle = '#f4f1ea'; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
};
const FEED = ['car', 'store', 'pool', 'car', 'store'];
const drawPhoneScr = (g, w, h, S) => {
  g.fillStyle = '#101018'; g.fillRect(0, 0, w, h); txt(g, 'VIRAIS', w / 2, 34, 32, '#ffffff');
  g.fillStyle = '#ff3a6a'; g.beginPath(); g.arc(40, 34, 10, 0, 7); g.fill();
  if (S.m === 'feed') {
    g.save(); g.beginPath(); g.rect(0, 64, w, h - 64); g.clip();
    FEED.forEach((k, i) => { const y = 74 + i * 215 - S.sc * 215; if (y > -220 && y < h) { drawThumb(g, 12, y, w - 24, 165, k); txt(g, '♥ 2,3 mi', 80, y + 188, 24, '#ff6a8a'); } });
    g.restore(); return;
  }
  drawThumb(g, 8, 80, w - 16, 220, 'pool');
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(w / 2 - 22, 160); g.lineTo(w / 2 + 28, 190); g.lineTo(w / 2 - 22, 220); g.fill();
  txt(g, 'JACARÉ NA', w / 2, 345, 34, '#ffffff'); txt(g, 'PISCINA!', w / 2, 390, 34, '#ffffff');
  txt(g, '▶ 2,3 mi', w / 2, 450, 32, '#ffd23f'); txt(g, '♥ 870 mil', w / 2, 500, 30, '#ff6a8a');
  if (S.ok > 0) { g.save(); g.translate(w / 2, 190); g.scale(S.ok, S.ok); g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fillStyle = '#2fae55'; g.fill(); g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke();
    g.lineWidth = 18; g.lineCap = 'round'; g.beginPath(); g.moveTo(-32, 2); g.lineTo(-8, 28); g.lineTo(36, -26); g.stroke(); g.restore(); }
};
// Florida outline in board canvas px (840 x 1080)
const FLA = [[50, 350], [620, 360], [640, 430], [668, 510], [696, 600], [718, 690], [734, 790], [728, 880], [702, 960], [668, 1000], [640, 985], [606, 935], [566, 866], [526, 790], [488, 705], [458, 622], [430, 545], [396, 470], [352, 440], [290, 425], [220, 438], [150, 420], [90, 405], [50, 400]];
const POLA = [[200, 620, -0.08, 'pool'], [440, 520, 0.06, 'store'], [650, 700, -0.05, 'car']];
const drawBoard = (g, w, h, B) => {
  g.fillStyle = '#5ab8e0'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4;
  for (let i = 0; i < 14; i++) { const y = 340 + i * 52; g.beginPath(); for (let x = 0; x <= w; x += 20) g.lineTo(x, y + 6 * Math.sin(x * 0.05 + i)); g.stroke(); }
  g.fillStyle = '#b8d8a0'; g.fillRect(0, 300, w, 62);
  g.beginPath(); FLA.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = '#7ccf6a'; g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.lineJoin = 'round'; g.stroke();
  g.beginPath(); g.ellipse(650, 760, 30, 24, 0, 0, 7); g.fillStyle = '#5ab8e0'; g.fill(); g.lineWidth = 5; g.stroke();
  for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(640 - i * 26, 1015 + i * 9, 12, 6, -0.3, 0, 7); g.fillStyle = '#7ccf6a'; g.fill(); g.lineWidth = 4; g.stroke(); }
  if (B.mode === 'map') {
    if (B.pin >= 0) { const py = 870 - (1 - B.pin) * 160; g.beginPath(); g.moveTo(720, 930); g.lineTo(704, py + 14); g.lineTo(736, py + 14); g.closePath(); g.fillStyle = INKC; g.fill();
      g.beginPath(); g.arc(720, py, 28, 0, 7); g.fillStyle = '#e0283a'; g.fill(); g.lineWidth = 7; g.strokeStyle = INKC; g.stroke(); g.beginPath(); g.arc(712, py - 8, 8, 0, 7); g.fillStyle = '#ffffff'; g.fill(); }
    if (B.lab > 0) { g.save(); g.translate(520, 960); g.scale(B.lab, B.lab); g.fillStyle = '#ffffff'; rr(g, -165, -62, 330, 124, 18); g.fill(); g.lineWidth = 7; g.strokeStyle = INKC; g.stroke();
      txt(g, 'VICE CITY', 0, -22, 54, '#d0352f'); txt(g, '= MIAMI', 0, 32, 48, '#1d2a4a'); g.restore(); }
  } else {
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, 300, w, h - 300);
    for (const [x, y, rot, k] of POLA) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = '#ffffff'; g.fillRect(-122, -110, 244, 236); g.lineWidth = 5; g.strokeStyle = INKC; g.strokeRect(-122, -110, 244, 236);
      drawThumb(g, -108, -96, 216, 162, k); g.beginPath(); g.arc(0, -112, 12, 0, 7); g.fillStyle = '#e0283a'; g.fill();
      if (B.ok > 0) { g.save(); g.translate(0, -15); g.scale(B.ok, B.ok); g.beginPath(); g.arc(0, 0, 58, 0, 7); g.fillStyle = '#2fae55'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.stroke();
        g.lineWidth = 15; g.lineCap = 'round'; g.beginPath(); g.moveTo(-26, 2); g.lineTo(-6, 22); g.lineTo(28, -20); g.stroke(); g.restore(); }
      else if (B.qm > 0) { g.save(); g.translate(0, -15); g.scale(B.qm, B.qm); txt(g, '?', 0, 0, 150, '#e0283a', '#ffffff', 14); g.restore(); }
      g.restore(); }
  }
  g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, 300); g.fillStyle = '#d0352f'; g.fillRect(0, 290, w, 12);
  g.save(); g.translate(w / 2, B.sub > 0 ? 112 : 150); g.scale(B.tp, B.tp); txt(g, B.title, 0, 0, 130, '#1d2a4a'); g.restore();
  if (B.sub > 0) { g.save(); g.translate(w / 2, 232); g.scale(B.sub, B.sub); txt(g, '= FLÓRIDA', 0, 0, 72, '#d0352f'); g.restore(); }
  g.lineWidth = 12; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
};

// ---------- shared props ----------
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
M.gator = toon({ color: '#4f7a3a' }); M.gatorD = toon({ color: '#3a5e2c' }); M.belly = toon({ color: '#cfc98e' }); M.ink = toon({ color: '#1a1420' });
const mkGator = (par) => {
  const root = new THREE.Group(); par.add(root); const g = new THREE.Group(); g.scale.setScalar(0.75); root.add(g);
  const SP = (sx, sy, sz, x, y, z, mat, p = g) => { const m = add(new THREE.SphereGeometry(1, 16, 10), mat, x, y, z, p); m.scale.set(sx, sy, sz); return m; };
  SP(0.4, 0.2, 0.85, 0, 0.26, 0, M.gator); SP(0.34, 0.1, 0.72, 0, 0.17, 0.02, M.belly);
  for (let i = 0; i < 7; i++) add(new THREE.ConeGeometry(0.05, 0.12, 5), M.gatorD, 0, 0.46, -0.6 + i * 0.2, g);
  const tail = new THREE.Group(); tail.position.set(0, 0.24, -0.75); g.add(tail);
  SP(0.26, 0.14, 0.5, 0, 0, -0.4, M.gator, tail);
  for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.04, 0.1, 5), M.gatorD, 0, 0.15 - i * 0.015, -0.1 - i * 0.22, tail);
  const tail2 = new THREE.Group(); tail2.position.set(0, -0.02, -0.78); tail.add(tail2);
  SP(0.15, 0.09, 0.45, 0, 0, -0.35, M.gator, tail2);
  { const c = add(new THREE.ConeGeometry(0.09, 0.45, 6), M.gator, 0, 0, -0.95, tail2); c.rotation.x = -Math.PI / 2; }
  const head = new THREE.Group(); head.position.set(0, 0.28, 0.78); g.add(head);
  SP(0.27, 0.15, 0.3, 0, 0, 0, M.gator, head);
  add(tbox(0.34, 0.1, 0.62, 1), M.gator, 0, -0.02, 0.45, head);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.08, 0.12); head.add(jaw);
  add(tbox(0.3, 0.06, 0.64, 1), M.belly, 0, -0.03, 0.33, jaw);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const t = add(new THREE.ConeGeometry(0.022, 0.06, 4), M.white, s * 0.15, -0.09, 0.28 + i * 0.1, head, { cast: false }); t.rotation.x = Math.PI; }
  for (const s of [-1, 1]) { SP(0.075, 0.075, 0.075, s * 0.12, 0.13, 0.06, M.white, head); SP(0.03, 0.055, 0.03, s * 0.12, 0.14, 0.125, M.ink, head); SP(0.02, 0.015, 0.02, s * 0.06, 0.04, 0.72, M.ink, head); }
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const lg = new THREE.Group(); lg.position.set(sx * 0.32, 0.2, sz * 0.45); g.add(lg);
    const c = add(new THREE.CylinderGeometry(0.07, 0.06, 0.26, 7), M.gator, sx * 0.08, -0.1, 0, lg); c.rotation.z = sx * 0.6;
    SP(0.1, 0.04, 0.13, sx * 0.17, -0.19, 0.04, M.gatorD, lg); legs.push(lg); }
  return { root, tail, tail2, jaw, legs };
};
const poseGator = (G, s) => { G.root.position.set(s.x, s.y, s.z); G.root.rotation.order = 'YXZ'; G.root.rotation.set(s.pitch, s.yaw, 0);
  G.tail.rotation.y = s.tail; G.tail2.rotation.y = s.tail * 1.4; G.jaw.rotation.x = s.jaw;
  G.legs.forEach((l, i) => { l.rotation.x = s.walk ? 0.5 * Math.sin(s.walk + (i === 0 || i === 3 ? 0 : Math.PI)) : 0; }); };
// ---------- RO: Pedro's living room (cut-away) ----------
const ro = new THREE.Group(); ro.position.set(...RO); scene.add(ro);
M.wallA = texM(P.plaster(8, 30), 1, 1); M.wallB = texM(P.plaster(9, 200), 1, 1);
M.sofa = toon({ color: '#4f7a8a' }); M.sofaD = toon({ color: '#3e6272' }); M.tvBk = toon({ color: '#15151c' }); M.rug = toon({ color: '#c75a4a' });
add(tbox(8.4, 0.6, 7.4, 2), M.plank, 0, -0.3, -0.4, ro, { cast: false });
add(tbox(8.4, 5.6, 0.3, 3), M.wallA, 0, 2.8, -3.15, ro);
for (const s of [-1, 1]) add(tbox(0.3, 5.6, 7.4, 3), M.wallB, s * 4.05, 2.8, -0.4, ro);
add(tbox(8, 0.14, 0.05, 1), M.darkWood, 0, 0.07, -2.98, ro, { cast: false });
{ const g = new THREE.CylinderGeometry(1.5, 1.5, 0.02, 40); add(g, M.rug, 0.4, 0.01, -0.6, ro, { cast: false }).scale.set(1.25, 1, 0.75); }
add(tbox(2.4, 0.45, 0.9, 1), M.sofa, 0.6, 0.225, -2.4, ro);
add(tbox(2.4, 0.85, 0.25, 1), M.sofaD, 0.6, 0.6, -2.83, ro);
for (const s of [-1, 1]) add(tbox(0.25, 0.65, 0.9, 1), M.sofaD, 0.6 + s * 1.3, 0.325, -2.4, ro);
add(tbox(0.66, 0.86, 0.03, 1), M.darkWood, CAL[0], CAL[1], -2.985, ro, { cast: false });
const calS = mkSign(0.6, 0.8, 480, 640, ro, CAL[0], CAL[1], CAL[2]);
add(tbox(1.25, 1.15, 0.04, 1), M.white, -2.9, 1.9, -2.98, ro, { cast: false });
const winS = mkSign(1.12, 1.02, 256, 232, ro, -2.9, 1.9, -2.955, true);
const tvG = new THREE.Group(); tvG.position.set(TVP[0], 0, TVP[2]); tvG.rotation.y = TVYAW; ro.add(tvG);
add(tbox(1.6, 0.9, 0.5, 1), M.darkWood, 0, 0.45, 0, tvG);
add(tbox(0.3, 0.08, 0.2, 1), M.tvBk, 0, 0.94, 0, tvG);
add(tbox(1.25, 0.75, 0.07, 1), M.tvBk, 0, TVY, 0, tvG);
const screen = mkSign(1.15, 0.67, 640, 372, tvG, 0, TVY, 0.04, true);
add(tbox(0.9, 0.06, 0.55, 1), M.wood, 1.7, 0.42, 0.45, ro);
for (const [dx, dz] of [[-0.38, -0.22], [0.38, -0.22], [-0.38, 0.22], [0.38, 0.22]]) add(tbox(0.05, 0.4, 0.05, 1), M.darkWood, 1.7 + dx, 0.2, 0.45 + dz, ro);
const phG = new THREE.Group(); ro.add(phG);
add(tbox(0.1, 0.2, 0.012, 1), M.tvBk, 0, 0, 0, phG); add(new THREE.SphereGeometry(0.01, 6, 4), M.chrome, 0.03, 0.08, -0.008, phG, { cast: false });
const phScr = mkSign(0.088, 0.18, 300, 600, phG, 0, 0, 0.0065, true);
const tiles = [];
for (let r = 0; r < 9; r++) for (let c = 0; c < 11; c++) {
  const i = tiles.length, t = mkSign(0.64, 0.48, 160, 120, ro, -3.6 + c * 0.72, 0.55 + r * 0.56, -2.88, true);
  redraw(t, 'x', (g, w, h) => { drawThumb(g, 0, 0, w, h, ['pool', 'store', 'car'][(i * 7) % 3]); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(w / 2 - 12, h / 2 - 15); g.lineTo(w / 2 + 16, h / 2); g.lineTo(w / 2 - 12, h / 2 + 15); g.fill();
    g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(w - 14, 14, 7, 0, 7); g.fill(); });
  t.m.visible = false; tiles.push(t);
}
// ---------- MP: beach with the big map board ----------
const mp = new THREE.Group(); mp.position.set(...MP); scene.add(mp);
slab(-45, 45, -12, 26, mp, M.sand, 0, 0.7, 3);
{ const g = new THREE.PlaneGeometry(250, 290); g.rotateX(-Math.PI / 2); const w = new THREE.Mesh(g, mkWater(0.25, [0.25, 0.15])); w.position.set(0, -0.06, -157); w.userData.nd = waterNd; mp.add(w); }
for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.1, 0.12, 6.4, 8), M.darkWood, s * 1.95, 3.2, -0.15, mp);
add(tbox(4.5, 5.7, 0.14, 1), M.darkWood, 0, 3.4, -0.08, mp);
const boardG = new THREE.Group(); boardG.position.set(0, 3.4, 0); mp.add(boardG);
const board = mkSign(4.2, 5.4, 840, 1080, boardG, 0, 0, 0.0, true);
mkPalm(mp, -5.5, -3, 7, 0.15, 21); mkPalm(mp, 6.4, -4.5, 7.5, -0.12, 22); mkPalm(mp, -8, 5, 6, 0.2, 23); mkPalm(mp, 9, 4, 6.5, -0.15, 24);
add(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), M.white, -4.2, 1.2, 3.5, mp); add(new THREE.ConeGeometry(1.4, 0.55, 10), M.pink, -4.2, 2.45, 3.5, mp);

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

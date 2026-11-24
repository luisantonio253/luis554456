import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PO, RO, ST, SR, MP, TVP, TVY, TVYAW, CAL, PPH, SIGNP, CNT, CAR, tileScale } from './story.js';

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

// ---------- PO: Florida backyard pool ----------
const po = new THREE.Group(); po.position.set(...PO); scene.add(po);
M.deck = texM(tilesC('#efe2c8', '#e2d2b4', 6), 1, 1); M.poolT = texM(tilesC('#7fd0ea', '#66c0de', 8), 1, 1);
M.stucco = texM(P.plaster(11, 350), 1, 1); M.glass = toon({ color: '#8fc4dc' }); M.roofT = toon({ color: '#c96a4a' }); M.hedge = toon({ color: '#3f8a3a' }); M.pink = toon({ color: '#ff7aa8' });
slab(-10, 10, 0.4, 5.5, po, M.deck); slab(-10, 10, -9.6, -4.4, po, M.deck); slab(-10, -2.6, -4.4, 0.4, po, M.deck); slab(2.6, 10, -4.4, 0.4, po, M.deck);
for (const [w, d, x, z] of [[5.8, 0.3, 0, 0.45], [5.8, 0.3, 0, -4.45], [0.3, 4.8, -2.65, -2], [0.3, 4.8, 2.65, -2]]) add(tbox(w, 0.06, d, 1), M.white, x, 0.03, z, po, { cast: false });
add(tbox(5.2, 0.1, 4.8, 1), M.poolT, 0, -1.4, -2, po, { cast: false });
for (const [w, d, x, z] of [[5.2, 0.1, 0, 0.35], [5.2, 0.1, 0, -4.35], [0.1, 4.8, -2.55, -2], [0.1, 4.8, 2.55, -2]]) add(tbox(w, 1.4, d, 1), M.poolT, x, -0.7, z, po, { cast: false });
{ const g = new THREE.PlaneGeometry(5.1, 4.7); g.rotateX(-Math.PI / 2); const w = new THREE.Mesh(g, mkWater(0.7, [0.05, 0.1])); w.position.set(0, -0.18, -2); w.userData.nd = waterNd; po.add(w); }
add(tbox(20, 4.6, 0.4, 3), M.stucco, 0, 2.3, -9.8, po);
add(tbox(3.4, 2.5, 0.08, 1), M.glass, 0, 1.25, -9.57, po, { cast: false });
add(tbox(3.7, 0.14, 0.14, 1), M.white, 0, 2.57, -9.55, po); for (const s of [-1, 1]) add(tbox(0.14, 2.6, 0.14, 1), M.white, s * 1.78, 1.3, -9.55, po);
for (const x of [-6, 5.6]) { add(tbox(2.0, 1.3, 0.08, 1), M.glass, x, 2.3, -9.57, po, { cast: false }); add(tbox(2.3, 0.14, 0.2, 1), M.white, x, 1.6, -9.52, po); }
add(tbox(21, 0.35, 2.6, 1), M.roofT, 0, 4.75, -9.1, po);
for (const s of [-1, 1]) add(tbox(1.0, 1.5, 15, 2), M.hedge, s * 10.3, 0.75, -2.2, po);
mkPalm(po, -8, -7.6, 6.5, 0.12, 1); mkPalm(po, 8.3, -6.9, 7.2, -0.15, 2); mkPalm(po, -8.6, 3.8, 5.8, 0.2, 3); mkPalm(po, 8.8, 4.2, 6, -0.1, 4);
for (const x of [4.6, 6.4]) { add(tbox(0.8, 0.35, 2.0, 1), M.white, x, 0.175, -6.6, po); const b = add(tbox(0.8, 0.08, 0.8, 1), M.white, x, 0.6, -7.75, po); b.rotation.x = 0.9; }
add(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), M.white, 5.5, 1.25, -7.9, po); add(new THREE.ConeGeometry(1.5, 0.6, 10), M.pink, 5.5, 2.6, -7.9, po);
{ const fl = new THREE.Group(); fl.position.set(1.5, -0.16, -0.7); po.add(fl); const t = add(new THREE.TorusGeometry(0.42, 0.14, 8, 18), M.pink, 0, 0, 0, fl); t.rotation.x = Math.PI / 2;
  const n = add(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), M.pink, 0.36, 0.38, 0, fl); n.rotation.z = 0.25; add(new THREE.SphereGeometry(0.12, 10, 8), M.pink, 0.27, 0.75, 0, fl);
  const bk = add(new THREE.ConeGeometry(0.05, 0.16, 6), M.ink, 0.16, 0.72, 0, fl); bk.rotation.z = Math.PI / 2; }
const signG = new THREE.Group(); signG.position.set(...SIGNP); po.add(signG);
add(tbox(0.08, 1.1, 0.08, 1), M.white, 0, 0.55, 0, signG); add(tbox(1.36, 0.86, 0.06, 1), M.darkWood, 0, 1.4, 0, signG);
{ const s = mkSign(1.3, 0.8, 520, 320, signG, 0, 1.4, 0.035); redraw(s, 'f', (g, w, h) => { g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); txt(g, 'FLÓRIDA', w / 2, 112, 104, '#2a7a3a'); txt(g, '2019', w / 2, 236, 100, '#d0352f'); }); }
const gP = mkGator(po);
const pole = add(new THREE.CylinderGeometry(0.025, 0.025, 1, 6).translate(0, 0.5, 0), M.chrome, 0, 0, 0, po);
const tapeG = new THREE.Group(); tapeG.position.set(0.93, 0.62, 1.5); po.add(tapeG);
add(tbox(3.0, 0.03, 0.08, 1), M.yellow, 0, 0, 0, tapeG); for (const x of [-1.5, 1.5]) add(tbox(0.04, 0.22, 0.08, 1), M.yellow, x, 0, 0, tapeG);
{ const s = mkSign(1.0, 0.5, 400, 200, tapeG, 0, 0.36, 0, true); redraw(s, 't', (g, w, h) => { g.fillStyle = '#ffd23f'; rr(g, 4, 4, w - 8, h - 8, 26); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke(); txt(g, '≈ 3 m', w / 2, h / 2 + 4, 112, '#1d2a4a'); }); }

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

// ---------- ST: convenience store (camera inside, looking at the doors) ----------
const st = new THREE.Group(); st.position.set(...ST); scene.add(st);
M.floorT = texM(tilesC('#f2f0ea', '#d8dde2', 6), 1, 1); M.storeW = texM(P.plaster(12, 190), 1, 1); M.shelf = toon({ color: '#e8e4dc' }); M.shelfD = toon({ color: '#8a929c' });
M.glassD = toon({ color: '#a8d8ea', transparent: true, opacity: 0.4 });
slab(-6.4, 6.4, -6.2, 9, st, M.floorT); slab(-16, 16, -40, -6.2, st, M.asphalt, 0, 0.7, 4);
for (const s of [-1, 1]) add(tbox(0.3, 5.6, 15.5, 3), M.storeW, s * 6.55, 2.8, 1.5, st);
for (const s of [-1, 1]) { add(tbox(5.0, 5.6, 0.3, 3), M.storeW, s * 3.9, 2.8, -6.35, st); add(tbox(3.6, 2.0, 0.04, 1), M.glass, s * 3.9, 1.5, -6.18, st, { cast: false }); }
add(tbox(2.8, 3.0, 0.3, 3), M.storeW, 0, 4.1, -6.35, st);
add(tbox(2.9, 0.12, 0.34, 1), M.shelfD, 0, 2.62, -6.3, st);
const doorL = add(tbox(1.4, 2.6, 0.05, 1), M.glassD, -0.7, 1.3, -6.1, st, { cast: false }), doorR = add(tbox(1.4, 2.6, 0.05, 1), M.glassD, 0.7, 1.3, -6.1, st, { cast: false });
{ const s = mkSign(2.8, 0.7, 840, 210, st, 0, 3.25, -6.18, true); redraw(s, 'b', (g, w, h) => { g.fillStyle = '#d0352f'; rr(g, 4, 4, w - 8, h - 8, 30); g.fill(); g.lineWidth = 8; g.strokeStyle = '#ffffff'; g.stroke(); txt(g, 'BEM-VINDO', w / 2, h / 2 + 6, 112, '#ffffff'); }); }
{ const cols = PCOL.map((c) => toon({ color: c })), N = 260, inst = cols.map((m) => new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), m, N)), cnt = cols.map(() => 0), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), r = P.rng(55);
  for (const sx of [-1, 1]) {
    const x = sx * 2.4;
    add(tbox(0.06, 1.9, 6, 1), M.shelfD, x, 0.95, 2, st); add(tbox(0.9, 0.12, 6, 1), M.shelfD, x, 0.06, 2, st);
    for (const y of [0.55, 1.05, 1.55]) add(tbox(0.9, 0.04, 6, 1), M.shelf, x, y, 2, st, { cast: false });
    for (const y of [0.12, 0.57, 1.07, 1.57]) for (const fx of [-1, 1]) for (let z = -0.85; z < 4.9; z += 0.21) {
      const k = Math.floor(r() * 5); if (cnt[k] >= N) continue; const hh = 0.7 + r() * 0.5; p.set(x + fx * 0.25, y + 0.13 * hh, z); sc.set(1, hh, 1); m4.compose(p, qq, sc); inst[k].setMatrixAt(cnt[k]++, m4); }
  }
  inst.forEach((m, k) => { m.count = cnt[k]; m.castShadow = m.receiveShadow = true; st.add(m); });
}
add(tbox(0.9, 1.0, 2.2, 1), M.wood, CNT[0], 0.5, CNT[2], st); add(tbox(0.4, 0.25, 0.35, 1), M.tvBk, CNT[0], 1.13, CNT[2] + 0.5, st);
add(tbox(0.5, 0.36, 0.06, 1), M.tvBk, CNT[0], 1.3, CNT[2] - 0.5, st);
const mon = mkSign(0.44, 0.3, 220, 150, st, CNT[0], 1.3, CNT[2] - 0.465, true);
const camG = new THREE.Group(); camG.position.set(6.1, 4.6, -5.9); camG.rotation.set(0.45, -2.4, 0, 'YXZ'); st.add(camG);
add(tbox(0.22, 0.18, 0.45, 1), M.white, 0, 0, 0, camG); add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10).rotateX(Math.PI / 2), M.tvBk, 0, 0, 0.25, camG);
add(tbox(0.06, 0.3, 0.06, 1), M.white, 0, 0.18, -0.12, camG);
const ledMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a' }); add(new THREE.SphereGeometry(0.03, 8, 6), ledMat, 0.07, 0.07, 0.2, camG, { cast: false });
mkPalm(st, -5.5, -15, 7, 0.1, 5); mkPalm(st, 5.5, -17, 6.5, -0.1, 6); mkPalm(st, -11, -24, 7.5, 0.15, 7);
const gS = mkGator(st);

// ---------- SR: Miami street at night ----------
const sr = new THREE.Group(); sr.position.set(...SR); scene.add(sr);
slab(-5, 5, -95, 20, sr, M.asphalt, 0, 0.7, 4); for (const s of [-1, 1]) slab(s > 0 ? 5 : -9, s > 0 ? 9 : -5, -95, 20, sr, M.concrete, 0.15, 0.85, 2);
for (let z = -90; z < 18; z += 6) add(tbox(0.15, 0.01, 2.5, 1), M.yellow, 0, 0.005, z, sr, { cast: false });
{ const r = P.rng(77); let k = 0; for (const s of [-1, 1]) for (let z = -86; z < 16; z += 12) { const h = 7 + r() * 12; add(tbox(6, h, 11.4, 4), M.facades[k++ % 6], s * 12, h / 2, z, sr); } }
const neonSigns = [];
for (const [x, z, word, col] of [[-8.7, -10, 'HOTEL', '#4fd8ff'], [8.7, -16, 'BAR', '#ff4fb0'], [-8.7, -34, 'CLUB', '#ffd23f'], [8.7, -40, 'SODA', '#7dff6a']]) {
  const s = mkSign(0.9, 2.6, 180, 520, sr, x, 4.4, z, true);
  redraw(s, 'n', (g, w, h) => { g.fillStyle = '#16102a'; rr(g, 4, 4, w - 8, h - 8, 20); g.fill(); g.lineWidth = 8; g.strokeStyle = col; g.stroke(); g.shadowColor = col; g.shadowBlur = 18;
    word.split('').forEach((ch, i) => txt(g, ch, w / 2, 60 + i * ((h - 100) / Math.max(1, word.length - 1)), 92, col)); g.shadowBlur = 0; });
  neonSigns.push(s);
}
for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.15, 0.18, 11.5, 8), M.tvBk, s * 6.2, 5.75, -26, sr);
add(tbox(12.8, 3.9, 0.3, 1), M.tvBk, 0, 10, -26.2, sr);
const miami = mkSign(12.4, 3.6, 1200, 348, sr, 0, 10, -26.0, true);
for (const z of [-12, -34]) for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), M.tvBk, s * 6.0, 3.0, z, sr); add(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff2c0' }), s * 5.5, 6.0, z, sr, { cast: false }); }
for (const z of [3, -8, -21, -38]) for (const s of [-1, 1]) mkPalm(sr, s * 7.3, z + (s > 0 ? 2 : 0), 6.5, s * 0.06, 11 + z + s, 0.15);
const carG = new THREE.Group(); carG.position.set(...CAR); sr.add(carG);
M.carB = toon({ color: '#2fd0c8' });
add(tbox(1.9, 0.6, 4.4, 1), M.carB, 0, 0.55, 0, carG); add(tbox(1.6, 0.5, 2.0, 1), M.carB, 0, 1.1, -0.2, carG);
add(tbox(1.5, 0.42, 0.04, 1), M.glass, 0, 1.1, 0.81, carG, { cast: false }); add(tbox(1.5, 0.42, 0.04, 1), M.glass, 0, 1.1, -1.21, carG, { cast: false });
for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) add(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14).rotateZ(Math.PI / 2), M.tvBk, x, 0.34, z, carG);
for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#fffbe0' }), s * 0.65, 0.62, 2.18, carG, { cast: false });
const hazMat = new THREE.MeshBasicMaterial({ color: '#ffb020' });
for (const [x, z] of [[-0.88, 2.2], [0.88, 2.2], [-0.88, -2.2], [0.88, -2.2]]) add(new THREE.SphereGeometry(0.08, 8, 6), hazMat, x, 0.72, z, carG, { cast: false });

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

// ---------- per-frame world state ----------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), UPV = new THREE.Vector3(0, 1, 0);
const EYEW = new THREE.Vector3(RO[0] + PPH[0], 1.6, RO[2] + PPH[2]);
const drawMiami = (g, w, h, on) => { g.fillStyle = '#14102a'; rr(g, 6, 6, w - 12, h - 12, 40); g.fill(); g.lineWidth = 16; g.strokeStyle = on > 0.5 ? '#4fd8ff' : '#2a3a4a'; g.stroke();
  if (on > 0.5) { g.shadowColor = '#ff4fb0'; g.shadowBlur = 50; } txt(g, 'MIAMI', w / 2, h / 2 + 10, 250, on > 0.5 ? '#ff6ac0' : '#4a2a40'); g.shadowBlur = 0; };
const drawMon = (g, w, h, led) => { g.fillStyle = '#3a4a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a6a5a'; g.fillRect(20, 80, 180, 40); g.fillStyle = '#7a8a7a'; g.fillRect(80, 40, 60, 50);
  if (led) { g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(28, 26, 12, 0, 7); g.fill(); } txt(g, 'REC', 80, 28, 34, '#ffffff'); txt(g, 'CAM 01', w / 2, h - 18, 24, '#d8f0d8'); };
function worldState(S, f) {
  poseGator(gP, S.gp); poseGator(gS, S.gs);
  if (S.pole) { _a.set(...S.pole.a); _b.set(...S.pole.b).sub(_a); const len = _b.length(); pole.visible = true; pole.position.copy(_a); pole.quaternion.setFromUnitVectors(UPV, _b.normalize()); pole.scale.set(1, len, 1); } else pole.visible = false;
  signG.visible = S.sign > 0.001; signG.scale.setScalar(Math.max(0.001, S.sign));
  tapeG.visible = S.tape > 0.001; tapeG.scale.set(Math.max(0.001, S.tape), Math.max(0.001, S.tape), 1);
  doorL.position.x = -0.7 - 1.3 * S.doors; doorR.position.x = 0.7 + 1.3 * S.doors;
  ledMat.color.set(S.led ? '#ff2a2a' : '#4a1010'); redraw(mon, 'm' + S.led, (g, w, h) => drawMon(g, w, h, S.led));
  redraw(miami, 'n' + S.neon, (g, w, h) => drawMiami(g, w, h, S.neon));
  hazMat.color.set(S.haz ? '#ffb020' : '#4a3010');
  redraw(screen, JSON.stringify(S.tv), (g, w, h) => drawTV(g, w, h, S.tv));
  redraw(calS, JSON.stringify(S.cal), (g, w, h) => drawCal(g, w, h, S.cal));
  redraw(winS, 'w' + S.sky, (g, w, h) => drawWin(g, w, h, S.sky));
  if (!S.phone) phG.visible = false;
  else {
    phG.visible = true; phG.scale.setScalar(Math.max(0.001, S.phone.s));
    if (!S.phone.pov) { phG.position.set(PPH[0], 1.08, PPH[2] + 0.3); phG.rotation.set(0, Math.PI, 0); }
    else { const d = [TVP[0] - PPH[0], TVY - 1.6, TVP[2] - PPH[2]], l = Math.hypot(...d); phG.position.set(PPH[0] + d[0] / l * 0.42, 1.6 + d[1] / l * 0.42 - 0.2, PPH[2] + d[2] / l * 0.42); phG.rotation.set(0, 0, 0); phG.updateMatrixWorld(); phG.lookAt(EYEW); }
    redraw(phScr, JSON.stringify(S.phone.scr), (g, w, h) => drawPhoneScr(g, w, h, S.phone.scr));
  }
  redraw(board, JSON.stringify(S.board), (g, w, h) => drawBoard(g, w, h, S.board)); boardG.scale.x = S.flip;
  tiles.forEach((t, i) => { const k = tileScale(S.tilesF, i); t.m.visible = k > 0.001; t.m.scale.setScalar(Math.max(0.001, k)); });
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

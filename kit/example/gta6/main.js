import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, PL, RO, MARC, SON, TVP, CAL, BOX, CASEX } from './story.js';

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
// ---------- world: ground + backdrop ----------
const world = new THREE.Group(); scene.add(world);
{ const g = new THREE.PlaneGeometry(4000, 4000); g.rotateX(-Math.PI / 2); planarUV(g, 6); add(g, M.grass, 0, -0.3, 0, world, { cast: false }); } // keep >= 25 cm below every set floor: no z-fighting
for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, d = 700 + rngW() * 250, h = 120 + rngW() * 160; add(new THREE.ConeGeometry(130 + rngW() * 80, h, 7), i % 2 ? M.mountFar : M.mount, Math.cos(a) * d, h / 2 - 5, Math.sin(a) * d, world, { cast: false }); }
for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2 + 0.1, d = 380 + rngW() * 120, h = 30 + rngW() * 50; const m = add(new THREE.SphereGeometry(1, 16, 10), M.hill, Math.cos(a) * d, 0, Math.sin(a) * d, world, { cast: false }); m.scale.set(60 + rngW() * 50, h, 60 + rngW() * 50); }
{ // trees, kept away from the three sets
  const geo = new THREE.SphereGeometry(1, 10, 8), N = 700, inst = new THREE.InstancedMesh(geo, M.tree, N), inst2 = new THREE.InstancedMesh(geo, M.tree2, N), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0, k2 = 0;
  for (let i = 0; i < 6000 && (k < N || k2 < N); i++) {
    const x = (rngW() - 0.5) * 900, z = (rngW() - 0.5) * 500 - 60;
    if (Math.abs(x - PL[0]) < 45 && z > -50 && z < 40) continue;
    if (Math.abs(x - RO[0]) < 30 && z > -30 && z < 30) continue;
    
    const r = 2.5 + rngW() * 3.5; p.set(x, r * 0.6, z); s.set(r, r * 0.9, r); m4.compose(p, qq, s);
    if (i % 2 && k < N) inst.setMatrixAt(k++, m4); else if (k2 < N) inst2.setMatrixAt(k2++, m4);
  }
  inst.count = k; inst2.count = k2; inst.castShadow = inst2.castShadow = true; inst.receiveShadow = inst2.receiveShadow = true; world.add(inst); world.add(inst2);
}

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
const drawCounter = (g, w, h, n) => {
  g.fillStyle = '#121218'; rr(g, 6, 6, w - 12, h - 12, 30); g.fill(); g.lineWidth = 12; g.strokeStyle = '#ffd23f'; g.stroke();
  txt(g, `${n} ${n === 1 ? 'ANO' : 'ANOS'}`, w / 2, h / 2 + 6, 170, n >= 13 ? '#ff6a4a' : '#ffe9a8', '#000000', 8);
};
const drawLabel = (g, w, h, s, hot) => { g.fillStyle = hot ? '#e2453c' : '#f4f1ea'; rr(g, 4, 4, w - 8, h - 8, 22); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke(); txt(g, s, w / 2, h / 2 + 4, 100, hot ? '#ffffff' : '#1d2a4a'); };
const drawTV = (g, w, h, S) => {
  if (S.tv === 'g5') { drawCover(g, w, h, 5, '#ff9a5a', '#c8407a', 35); txt(g, 'PRESS START', w / 2, h * 0.9, 34, '#ffffff', INKC, 6); return; }
  if (S.tv === 'win') { g.fillStyle = '#1a1030'; g.fillRect(0, 0, w, h); const r = P.rng(9); const cols = ['#ffd23f', '#ff6a8a', '#5ad0ff', '#7dff6a'];
    for (let i = 0; i < 70; i++) { g.fillStyle = cols[i % 4]; g.fillRect(r() * w, r() * h, 10, 16); }
    txt(g, 'ZERADO!', w / 2, h * 0.36, 120 * (0.6 + 0.4 * S.win), '#ffd23f', INKC, 12); txt(g, '100%', w / 2, h * 0.72, 96, '#ffffff', INKC, 10); return; }
  if (S.tv === 'load') { g.fillStyle = '#0c0c14'; g.fillRect(0, 0, w, h); drawCover(g, w, h * 0.78, 6, '#ff6ac0', '#5a3ad0', 61);
    g.fillStyle = '#333344'; rr(g, 60, h * 0.86, w - 120, 26, 13); g.fill(); g.fillStyle = '#7dff6a'; rr(g, 60, h * 0.86, Math.max(26, (w - 120) * S.tvLoad), 26, 13); g.fill(); return; }
  g.fillStyle = '#3a0c12'; g.fillRect(0, 0, w, h);
  const k = S.tvBad; g.save(); g.translate(w / 2, h * 0.4); g.scale(k, k);
  g.beginPath(); g.arc(0, 0, 95, 0, 7); g.fillStyle = '#e0283a'; g.fill(); g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.stroke();
  g.lineCap = 'round'; g.lineWidth = 26; g.beginPath(); g.moveTo(-45, -45); g.lineTo(45, 45); g.moveTo(45, -45); g.lineTo(-45, 45); g.stroke(); g.restore();
  txt(g, 'INCOMPATÍVEL', w / 2, h * 0.84, 64 * Math.min(1, k), '#ffffff', INKC, 8);
};
const MONTHS = { B: ['MAIO 2026', 5, 31, 26], C: ['NOVEMBRO 2026', 0, 30, 19] };
const drawCal = (g, w, h, C) => {
  g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.lineWidth = 10; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
  g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, 130);
  for (const x of [120, 360]) { g.beginPath(); g.arc(x, 22, 13, 0, 7); g.fillStyle = '#3a3a48'; g.fill(); }
  if (C.m === 'Y') { txt(g, 'CALENDÁRIO', w / 2, 78, 52, '#ffffff'); txt(g, String(C.y), w / 2, 380, 170, '#1d2a4a'); return; }
  if (C.m === 'A') { txt(g, '2025', w / 2, 78, 76, '#ffffff'); txt(g, 'LANÇAMENTO', w / 2, 230, 50, '#5a4a5a'); txt(g, 'OUTONO', w / 2, 340, 104, '#1d2a4a'); g.beginPath(); g.ellipse(w / 2, 340, 215, 80, 0, 0, 7); g.lineWidth = 9; g.strokeStyle = '#2fae55'; g.stroke(); }
  else {
    const [title, off, n, day] = MONTHS[C.m]; txt(g, title, w / 2, 78, title.length > 10 ? 56 : 70, '#ffffff');
    'DSTQQSS'.split('').forEach((d, i) => txt(g, d, 48 + i * 64, 168, 30, '#8a7a8a'));
    for (let d = 1; d <= n; d++) { const k = d - 1 + off, cx = 48 + (k % 7) * 64, cy = 222 + Math.floor(k / 7) * 64;
      const hot = d === day && (C.m === 'B' || C.ring > 0);
      if (hot) { const s = C.m === 'C' ? C.ring : 1; g.beginPath(); g.arc(cx, cy, 30 * s, 0, 7); g.fillStyle = '#ffe14a'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#d0352f'; g.stroke(); }
      txt(g, String(d), cx, cy + 2, hot ? 36 : 30, hot ? '#d0352f' : '#2b2b3a'); }
  }
  if (C.st > 0) { g.save(); g.translate(w / 2, 400); g.rotate(-0.28); g.scale(C.st, C.st); g.globalAlpha = 0.92;
    g.lineWidth = 16; g.strokeStyle = '#d0352f'; rr(g, -200, -70, 400, 140, 20); g.stroke(); txt(g, 'ADIADO', 0, 6, 104, '#d0352f'); g.restore(); }
};
const drawWin = (g, w, h, k) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, k > 0.5 ? '#5aa8f0' : '#101a44'); gr.addColorStop(1, k > 0.5 ? '#d8f0ff' : '#3a4a8a');
  g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalAlpha = Math.abs(k - 0.5) * 2;
  if (k > 0.5) { g.beginPath(); g.arc(w * 0.7, h * 0.3, 26, 0, 7); g.fillStyle = '#fff3b0'; g.fill(); }
  else { g.fillStyle = '#ffffff'; const r = P.rng(4); for (let i = 0; i < 18; i++) g.fillRect(r() * w, r() * h * 0.7, 3, 3); g.beginPath(); g.arc(w * 0.3, h * 0.28, 18, 0, 7); g.fillStyle = '#f4f1ea'; g.fill(); }
  g.globalAlpha = 1; g.fillStyle = '#5a6a7a'; g.fillRect(0, h * 0.78, w, h * 0.22);
  g.lineWidth = 14; g.strokeStyle = '#f4f1ea'; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
};

// ---------- PL: the plaza (cases, lamps, counter, chart) ----------
const pl = new THREE.Group(); pl.position.set(...PL); scene.add(pl);
add(tbox(34, 0.6, 30, 3), M.concrete, 0, -0.3, -4, pl, { cast: false });
M.ped = toon({ color: '#3a3f5c' }); M.caseBk = toon({ color: '#1a1a22' }); M.colA = toon({ color: '#7a8ad8' }); M.colB = toon({ color: '#e2453c' }); M.navy = toon({ color: '#1d2a4a' });
for (const [s, n, top, bot, yr, seed] of [[-1, 5, '#ff9a5a', '#c8407a', '2013', 35], [1, 6, '#ff6ac0', '#5a3ad0', '2026', 61]]) {
  add(tbox(1.2, 1.0, 1.0, 1), M.ped, s * CASEX, 0.5, 0, pl);
  const plt = mkSign(0.9, 0.3, 300, 100, pl, s * CASEX, 0.55, 0.505); redraw(plt, yr, (g, w, h) => { g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h); txt(g, yr, w / 2, h / 2 + 3, 76, '#1d2a4a'); });
  add(tbox(0.84, 1.16, 0.1, 1), M.caseBk, s * CASEX, 1.58, -0.02, pl);
  const c = mkSign(0.8, 1.12, 400, 560, pl, s * CASEX, 1.58, 0.035); redraw(c, 'c', (g, w, h) => drawCover(g, w, h, n, top, bot, seed));
}
const lampTiles = [];
for (let i = 0; i < 13; i++) { const m = add(tbox(0.26, 0.08, 0.26, 1), toon({ color: '#4a4f6a' }), -2.1 + i * 0.35, 0.04, 1.6, pl, { cast: false }); lampTiles.push(m); }
const cntG = new THREE.Group(); pl.add(cntG);
for (const x of [-1.5, 1.5]) add(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8), M.navy, x, 2.2, -0.35, cntG);
add(tbox(3.1, 1.25, 0.16, 1), M.navy, 0, 4.3, -0.42, cntG);
const counter = mkSign(2.9, 1.08, 812, 302, cntG, 0, 4.3, -0.33, true);
const cols = [], labels = [];
[1, 2, 4, 5, 13].forEach((gap, i) => {
  const x = -3.6 + i * 1.8, h = gap * 0.5, g = new THREE.BoxGeometry(1.3, h, 1.3); g.translate(0, h / 2, 0);
  cols.push(add(g, i === 4 ? M.colB : M.colA, x, 0, -6.6, pl));
  const lb = mkSign(1.7, 0.62, 450, 164, pl, x, 0.5, -5.45); lb.m.rotation.x = -0.55; redraw(lb, 'l', (gg, w, hh) => drawLabel(gg, w, hh, gap === 1 ? '1 ANO' : `${gap} ANOS`, i === 4)); labels.push(lb);
  
});
if (false) { const hd = mkSign(4.4, 0.9, 900, 184, pl, -2.7, 3.9, -7.3); redraw(hd, 'h', (g, w, h) => { g.fillStyle = '#ffd23f'; rr(g, 4, 4, w - 8, h - 8, 26); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke(); txt(g, 'ESPERA ENTRE OS JOGOS', w / 2, h / 2 + 4, 70, '#1d2a4a'); }); }

// ---------- RO: Marcos' living room (cut-away) ----------
const ro = new THREE.Group(); ro.position.set(...RO); scene.add(ro);
M.wallA = texM(P.plaster(8, 30), 1, 1); M.wallB = texM(P.plaster(9, 200), 1, 1);
M.sofa = toon({ color: '#4f7a8a' }); M.sofaD = toon({ color: '#3e6272' }); M.tvBk = toon({ color: '#15151c' }); M.card = toon({ color: '#b8854a' }); M.tape = toon({ color: '#d9c48a' });
M.conA = toon({ color: '#202028' }); M.conB = toon({ color: '#e8e8ee' }); M.rug = toon({ color: '#c75a4a' });
add(tbox(8.4, 0.6, 7.4, 2), M.plank, 0, -0.3, -0.4, ro, { cast: false });
add(tbox(8.4, 5.6, 0.3, 3), M.wallA, 0, 2.8, -3.15, ro);
for (const s of [-1, 1]) add(tbox(0.3, 5.6, 7.4, 3), M.wallB, s * 4.05, 2.8, -0.4, ro);
add(tbox(8, 0.14, 0.05, 1), M.darkWood, 0, 0.07, -2.98, ro, { cast: false });
{ const g = new THREE.CylinderGeometry(1.5, 1.5, 0.02, 40); add(g, M.rug, 0.4, 0.01, -0.6, ro, { cast: false }).scale.set(1.25, 1, 0.75); }
// sofa
add(tbox(2.4, 0.45, 0.9, 1), M.sofa, 0.6, 0.225, -2.4, ro);
add(tbox(2.4, 0.85, 0.25, 1), M.sofaD, 0.6, 0.6, -2.83, ro);
for (const s of [-1, 1]) add(tbox(0.25, 0.65, 0.9, 1), M.sofaD, 0.6 + s * 1.3, 0.325, -2.4, ro);
// calendar + window
add(tbox(0.66, 0.86, 0.03, 1), M.darkWood, CAL[0], CAL[1], -2.985, ro, { cast: false });
const calS = mkSign(0.6, 0.8, 480, 640, ro, CAL[0], CAL[1], CAL[2]);
add(tbox(1.25, 1.15, 0.04, 1), M.white, -2.9, 1.9, -2.98, ro, { cast: false });
const winS = mkSign(1.12, 1.02, 256, 232, ro, -2.9, 1.9, -2.955, true);
// TV corner (yawed toward the room)
const tvG = new THREE.Group(); tvG.position.set(TVP[0], 0, TVP[2]); tvG.rotation.y = 0.5; ro.add(tvG);
add(tbox(1.6, 0.5, 0.5, 1), M.darkWood, 0, 0.25, 0, tvG);
add(tbox(0.3, 0.06, 0.2, 1), M.tvBk, 0, 0.53, 0, tvG);
add(tbox(1.25, 0.75, 0.07, 1), M.tvBk, 0, 0.95, 0, tvG);
const screen = mkSign(1.15, 0.67, 640, 372, tvG, 0, 0.95, 0.04, true);
const consoles = [];
for (const [x, w, h, d, mat] of [[-0.45, 0.4, 0.09, 0.3, M.conA], [0, 0.34, 0.08, 0.28, M.conB], [0.45, 0.2, 0.4, 0.3, M.conB]]) {
  const g = new THREE.Group(); g.position.set(x, 0, 0.5); tvG.add(g);
  const b = new THREE.BoxGeometry(w, h, d); b.translate(0, h / 2, 0); add(b, mat, 0, 0, 0, g);
  if (h > 0.2) add(tbox(0.06, 0.36, 0.31, 1), M.conA, 0, 0.2, 0, g); else add(tbox(w * 0.6, 0.012, 0.02, 1), M.yellow, 0, h * 0.6, d / 2, g, { cast: false });
  consoles.push(g);
}
// coffee table + bills
add(tbox(0.9, 0.06, 0.55, 1), M.wood, 1.7, 0.42, 0.45, ro);
for (const [dx, dz] of [[-0.38, -0.22], [0.38, -0.22], [-0.38, 0.22], [0.38, 0.22]]) add(tbox(0.05, 0.4, 0.05, 1), M.darkWood, 1.7 + dx, 0.2, 0.45 + dz, ro);
const billG = new THREE.BoxGeometry(0.32, 0.5, 0.24); billG.translate(0, 0.25, 0);
const bills = add(billG, M.white, 1.62, 0.45, 0.42, ro);
for (let i = 1; i < 6; i++) add(tbox(0.33, 0.012, 0.245, 1), M.tape, 0, i * 0.08, 0, bills, { cast: false });
// cardboard box
const boxG = new THREE.Group(); boxG.position.set(BOX[0], 0, BOX[2]); ro.add(boxG);
add(tbox(0.7, 0.04, 0.5, 1), M.card, 0, 0.02, 0, boxG);
for (const [x, z, w, d] of [[0, 0.23, 0.7, 0.04], [0, -0.23, 0.7, 0.04], [0.33, 0, 0.04, 0.5], [-0.33, 0, 0.04, 0.5]]) add(tbox(w, 0.45, d, 1), M.card, x, 0.225, z, boxG);
{ const fl = add(tbox(0.7, 0.02, 0.22, 1), M.card, 0, 0.5, 0.33, boxG); fl.rotation.x = 0.9; const fb = add(tbox(0.7, 0.02, 0.22, 1), M.card, 0, 0.5, -0.33, boxG); fb.rotation.x = -0.9; }
add(tbox(0.12, 0.01, 0.51, 1), M.tape, 0.2, 0.452, 0, boxG, { cast: false });
// the old console Marcos holds
const held = new THREE.Group(); ro.add(held);
add(tbox(0.42, 0.09, 0.32, 1), M.conA, 0, 0, 0, held);
add(tbox(0.25, 0.012, 0.02, 1), M.yellow, -0.05, 0.01, 0.161, held, { cast: false });
const sticker = mkSign(0.15, 0.07, 160, 76, held, 0.12, 0.0, 0.163, true);
redraw(sticker, 's', (g, w, h) => { g.fillStyle = '#ffd23f'; rr(g, 2, 2, w - 4, h - 4, 12); g.fill(); txt(g, '2013', w / 2, h / 2 + 3, 54, '#1d2a4a'); });

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
  lamp.intensity = L.lamp || 0; if (L.lampAt) lamp.position.set(...L.lampAt);
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 150); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
}

function worldState(S, f) {
  lampTiles.forEach((m, i) => { const on = i < S.lamps; m.material.color.set(on ? '#ffd23f' : '#4a4f6a'); m.material.emissive.set(on ? '#7a5a00' : '#000000'); });
  redraw(counter, 'n' + S.count, (g, w, h) => drawCounter(g, w, h, S.count)); counter.m.scale.setScalar(S.cpop); cntG.visible = S.hideCounter > 0.01; cntG.scale.set(1, Math.max(0.01, S.hideCounter), 1);
  cols.forEach((c, i) => { const k = S.cols[i]; c.visible = labels[i].m.visible = k > 0.001; c.scale.set(1, Math.max(0.001, k), 1); labels[i].m.scale.setScalar(Math.max(0.001, i === 4 ? Math.min(1, k * 1.5) : k)); });
  redraw(screen, [S.tv, S.tvLoad, S.tvBad, S.win].join('|'), (g, w, h) => drawTV(g, w, h, S));
  redraw(calS, JSON.stringify(S.cal), (g, w, h) => drawCal(g, w, h, S.cal));
  redraw(winS, 'w' + S.sky, (g, w, h) => drawWin(g, w, h, S.sky));
  consoles.forEach((c, i) => { const k = S.cons[i]; c.visible = k > 0.001; c.scale.setScalar(Math.max(0.001, k)); });
  bills.visible = S.bills > 0.001; bills.scale.set(1, Math.max(0.001, S.bills), 1);
  boxG.visible = !!S.box;
  held.visible = !!S.console; if (S.console) { held.position.set(S.console.x, S.console.y, S.console.z); held.rotation.z = S.console.rot; }
  sticker.m.scale.setScalar(S.sticker);
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

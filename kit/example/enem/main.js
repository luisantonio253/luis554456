import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, CL, STo, PIo } from './story.js';

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
    if (Math.abs(x - CL[0]) < 22 && z > -30 && z < 30) continue;
    if (Math.abs(x - STo[0] - 5) < 30 && z > -40 && z < 40) continue;
    if (Math.abs(x - PIo[0]) < 50 && z > -60 && z < 40) continue;
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

const drawSheet = (g, w, h, fill) => {
  g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2f63a8'; g.fillRect(0, 0, w, 78);
  txt(g, 'ENEM', 110, 40, 46, '#ffffff'); txt(g, 'CARTÃO-RESPOSTA', 340, 40, 28, '#ffe08a');
  const filled = { 0: 1, 1: 3, 3: 0, 4: 4, 5: 2, 6: 1, 7: 3, 8: 0 };
  for (let r = 0; r < 9; r++) {
    const y = 120 + r * 62; txt(g, String(r + 1).padStart(2, '0'), 54, y, 26, '#5a4a5a');
    for (let c = 0; c < 5; c++) {
      const x = 120 + c * 70;
      g.beginPath(); g.arc(x, y, 21, 0, 7); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d0653a'; g.stroke();
      txt(g, 'ABCDE'[c], x, y + 1, 18, '#d0653a');
      let k = filled[r] === c ? 1 : 0; if (r === 2 && c === 2) k = fill;
      if (k > 0) { g.beginPath(); g.arc(x, y, 19 * k, 0, 7); g.fillStyle = '#1b1822'; g.fill(); }
      if (r === 2 && c === 2 && fill >= 1) { g.beginPath(); g.arc(x, y, 30, 0, 7); g.lineWidth = 6; g.strokeStyle = '#f2c230'; g.stroke(); }
    }
  }
};
const drawBoard = (g, w, h, name, col, phase, val, pop) => {
  g.fillStyle = '#f7f7f2'; rr(g, 6, 6, w - 12, h - 12, 26); g.fill(); g.lineWidth = 12; g.strokeStyle = '#4a4a58'; g.stroke();
  txt(g, name, w / 2, 70, 66, col);
  if (phase === 1) { txt(g, '30 acertos', w / 2, 190, 74 * pop, '#2b2b3a'); g.lineWidth = 16; g.strokeStyle = '#2fa44a'; g.lineCap = 'round'; g.beginPath(); g.moveTo(w / 2 - 50, 280); g.lineTo(w / 2 - 12, 316); g.lineTo(w / 2 + 60, 246); g.stroke(); }
  if (phase === 2) { txt(g, 'NOTA', w / 2, 150, 46, '#7a7a88'); txt(g, String(val), w / 2, 250, 130, col, '#ffffff', 10); }
};
const drawStep = (g, w, h, n, state) => {
  const bg = state === 1 ? '#2fae55' : state === 2 ? '#e0483e' : '#3a3f5c';
  g.fillStyle = bg; rr(g, 4, 4, w - 8, h - 8, 18); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke();
  txt(g, String(n), w / 2, state ? 62 : h / 2 + 4, state ? 74 : 104, '#ffffff', INKC, 8);
  if (state) txt(g, state === 1 ? 'FÁCIL' : 'DIFÍCIL', w / 2, 140, 44, '#ffffff', INKC, 6);
};
const dice = (g, x, y, s) => { g.save(); g.translate(x, y); g.rotate(-0.25); g.fillStyle = '#ffffff'; rr(g, -s / 2, -s / 2, s, s, s * 0.18); g.fill(); g.lineWidth = s * 0.07; g.strokeStyle = INKC; g.stroke();
  for (const [px, py] of [[-0.25, -0.25], [0.25, 0.25], [0, 0], [0.25, -0.25], [-0.25, 0.25]]) { g.beginPath(); g.arc(px * s, py * s, s * 0.08, 0, 7); g.fillStyle = INKC; g.fill(); } g.restore(); };
const drawTri = (g, w, h, st) => {
  g.fillStyle = '#1d2a4a'; rr(g, 8, 8, w - 16, h - 16, 40); g.fill(); g.lineWidth = 16; g.strokeStyle = '#ffd23f'; g.stroke();
  if (st.mode === 0) { for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(w / 2 + (i - 1) * 70, h / 2, 16, 0, 7); g.fillStyle = '#3d4d78'; g.fill(); } return; }
  if (st.mode === 1) { ['T', 'R', 'I'].forEach((ch, i) => { const s = st.l[i]; if (s > 0.01) txt(g, ch, w / 2 + (i - 1) * 230, h / 2 + 14, 300 * s, '#ffd23f', INKC, 22 * s); }); return; }
  txt(g, 'TRI', w / 2, 62, 64, '#ffd23f');
  if (st.mode === 2) {
    txt(g, 'TALENTO?', w / 2, 250, 128, '#ffffff', INKC, 14);
    if (st.x > 0) { g.lineCap = 'round'; g.strokeStyle = '#e0483e'; g.lineWidth = 34; const a = Math.min(1, st.x * 2), b = Math.max(0, st.x * 2 - 1);
      g.beginPath(); g.moveTo(230, 160); g.lineTo(230 + 564 * a, 160 + 190 * a); g.stroke(); if (b > 0) { g.beginPath(); g.moveTo(794, 160); g.lineTo(794 - 564 * b, 160 + 190 * b); g.stroke(); } }
  }
  if (st.mode === 3) {
    g.save(); g.translate(w / 2 - 60, 255); g.rotate(-0.08); g.scale(st.s, st.s);
    g.lineWidth = 14; g.strokeStyle = '#e0483e'; rr(g, -265, -105, 530, 210, 28); g.stroke();
    txt(g, 'CHUTE!', 0, 6, 158, '#e0483e', '#ffffff', 10); g.restore();
    dice(g, w / 2 + 300, 245, 120 * st.s);
  }
};
const drawPlate = (g, w, h) => { g.fillStyle = '#ffd23f'; rr(g, 4, 4, w - 8, h - 8, 26); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke(); txt(g, 'Teoria de Resposta ao Item', w / 2, h / 2 + 3, 62, '#1d2a4a'); };
const drawScore = (g, w, h, st) => {
  g.fillStyle = '#121218'; rr(g, 6, 6, w - 12, h - 12, 30); g.fill(); g.lineWidth = 12; g.strokeStyle = '#3a3a48'; g.stroke();
  g.fillStyle = '#1e1e28'; for (let x = 20; x < w - 20; x += 14) for (let y = 20; y < h - 20; y += 14) g.fillRect(x, y, 8, 8);
  if (st.mode === 0) { txt(g, 'PLACAR', w / 2, 90, 64, '#ffb43a'); txt(g, 'BRUNO   0', w / 2, 290, 130, '#ffe9a8'); return; }
  txt(g, 'GOL!', w / 2, 110, 120 * st.pop, '#7dff6a', '#000000', 6);
  if (st.v > 0.01) txt(g, st.label, w / 2, 320, 210 * st.v, '#ffe14a', '#000000', 8);
};

// ---------- CL: the exam room (cut-away) ----------
const cl = new THREE.Group(); cl.position.set(...CL); scene.add(cl);
M.plaster = texM(P.plaster(8, 200), 1, 1); M.plasterB = texM(P.plaster(9, 40), 1, 1);
add(tbox(10.6, 0.4, 9, 2.5), M.plank, 0, -0.2, -0.5, cl, { cast: false });
add(tbox(10.6, 3.6, 0.3, 3), M.plaster, 0, 1.8, -4.15, cl);
for (const s of [-1, 1]) add(tbox(0.3, 3.6, 9, 3), M.plasterB, s * 5.15, 1.8, -0.5, cl);
add(tbox(10, 0.16, 0.06, 1), M.darkWood, 0, 0.08, -3.98, cl, { cast: false });
const chalk = mkSign(1.3, 0.85, 520, 340, cl, 0, 2.5, -3.97);
redraw(chalk, 'c', (g, w, h) => { g.fillStyle = '#2f5a44'; g.fillRect(0, 0, w, h); g.lineWidth = 22; g.strokeStyle = '#8a5a34'; g.strokeRect(0, 0, w, h);
  txt(g, 'ENEM', w / 2, 120, 120, '#f4f1ea'); g.globalAlpha = 0.85; txt(g, 'Matemática', w / 2, 240, 54, '#f4f1ea'); g.globalAlpha = 1; });
const boardA = mkSign(1.1, 0.75, 440, 300, cl, -1.3, 2.55, -3.97), boardB = mkSign(1.1, 0.75, 440, 300, cl, 1.3, 2.55, -3.97);
const clockS = mkSign(0.5, 0.5, 200, 200, cl, -3.4, 2.7, -3.97);
redraw(clockS, 'k', (g) => { g.beginPath(); g.arc(100, 100, 92, 0, 7); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 12; g.strokeStyle = INKC; g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.fillStyle = INKC; g.fillRect(100 + Math.cos(a) * 72 - 3, 100 + Math.sin(a) * 72 - 3, 6, 6); }
  g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(100, 100); g.lineTo(100, 42); g.stroke(); g.lineWidth = 7; g.beginPath(); g.moveTo(100, 100); g.lineTo(146, 118); g.stroke(); });
clockS.m.material.transparent = true;
const desk = (x, z) => { add(tbox(1.0, 0.05, 0.62, 1), M.wood, x, 0.76, z, cl); for (const [dx, dz] of [[-0.44, -0.26], [0.44, -0.26], [-0.44, 0.26], [0.44, 0.26]]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 6), M.chrome, x + dx, 0.37, z + dz, cl); };
for (const [x, z] of [[-0.85, 0], [0.85, 0], [-2.7, 0], [2.7, 0], [-0.85, -2.2], [0.85, -2.2], [-2.7, -2.2], [2.7, -2.2]]) desk(x, z);
const sheet = mkSign(0.4, 0.53, 512, 680, cl, 0.85, 0.79, 0.0); sheet.m.rotation.x = -Math.PI / 2;
const sheetA = mkSign(0.4, 0.53, 512, 680, cl, -0.85, 0.79, 0.0); sheetA.m.rotation.x = -Math.PI / 2; redraw(sheetA, 'a', (g, w, h) => drawSheet(g, w, h, 1));
for (const [x, z] of [[-2.7, 0], [2.7, 0], [-0.85, -2.2], [0.85, -2.2], [-2.7, -2.2], [2.7, -2.2]]) { const s = mkSign(0.4, 0.53, 512, 680, cl, x, 0.79, z); s.m.rotation.x = -Math.PI / 2; redraw(s, 'o', (g, w, h) => drawSheet(g, w, h, 0)); }
{ const pen = add(new THREE.CylinderGeometry(0.008, 0.008, 0.15, 6), M.yellow, 1.12, 0.795, 0.12, cl, { cast: false }); pen.rotation.set(Math.PI / 2, 0, 0.6); }

// ---------- ST: the TRI staircase ----------
const st = new THREE.Group(); st.position.set(...STo); scene.add(st);
M.stepA = toon({ color: '#d9d3f2' }); M.stepB = toon({ color: '#c3bbe8' }); M.navy = toon({ color: '#1d2a4a' });
add(tbox(40, 0.42, 30, 4), M.concrete, 4, -0.13, -2, st, { cast: false });
const stepSigns = [];
for (let i = 0; i < 8; i++) { const h = i + 1; add(tbox(1.1, h, 3, 2), i % 2 ? M.stepB : M.stepA, i * 1.1 + 0.55, h / 2, 0, st); stepSigns.push(mkSign(0.92, 0.62, 256, 172, st, i * 1.1 + 0.55, h - 0.42, 1.51)); }
for (const x of [2.4, 8.6]) add(new THREE.CylinderGeometry(0.16, 0.2, 12.2, 10), M.navy, x, 6.1, -2.85, st);
add(tbox(6.9, 3.05, 0.3, 2), M.navy, 5.5, 11.0, -2.78, st);
const triS = mkSign(6.6, 2.8, 1024, 434, st, 5.5, 11.0, -2.62, true);
const plate = mkSign(6.0, 0.75, 1024, 128, st, 5.5, 9.0, -2.55); redraw(plate, 'p', drawPlate);
plate.m.userData.x0 = 5.5;

// ---------- PI: the football pitch ----------
const pi = new THREE.Group(); pi.position.set(...PIo); scene.add(pi);
{
  const c = document.createElement('canvas'); c.width = 1024; c.height = 820; const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#4f9a3c' : '#5aa845'; g.fillRect(0, i * 820 / 16, 1024, 820 / 16 + 1); }
  const X = (x) => (x + 25) / 50 * 1024, Z = (z) => (z + 25) / 40 * 820;
  g.strokeStyle = '#f4f4ee'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(0, Z(-11)); g.lineTo(1024, Z(-11)); g.stroke();
  g.strokeRect(X(-20.15), Z(-11), X(20.15) - X(-20.15), Z(5.5) - Z(-11));
  g.strokeRect(X(-9.15), Z(-11), X(9.15) - X(-9.15), Z(-5.5) - Z(-11));
  g.beginPath(); g.arc(X(0), Z(0), 6, 0, 7); g.fillStyle = '#f4f4ee'; g.fill();
  g.beginPath(); g.arc(X(0), Z(0), (9.15 / 50) * 1024, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const gg = new THREE.PlaneGeometry(50, 40); gg.rotateX(-Math.PI / 2);
  add(gg, toon({ map: t }), 0, 0.01, -5, pi, { cast: false });
  add(tbox(50.2, 0.32, 40.2, 4), M.hill, 0, -0.15, -5, pi, { cast: false }); // pitch base reaching below the ground
}
const post = (x, y, z, len, rotZ = 0) => { const m = add(new THREE.CylinderGeometry(0.06, 0.06, len, 10), M.white, x, y, z, pi); m.rotation.z = rotZ; return m; };
post(-3.66, 1.22, -11, 2.44); post(3.66, 1.22, -11, 2.44); post(0, 2.44, -11, 7.44, Math.PI / 2);
const netC = document.createElement('canvas'); netC.width = 256; netC.height = 256; { const g = netC.getContext('2d'); g.strokeStyle = '#ffffff'; g.lineWidth = 5; for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); } }
const netT = new THREE.CanvasTexture(netC); netT.wrapS = netT.wrapT = THREE.RepeatWrapping; netT.colorSpace = THREE.SRGBColorSpace;
const netMat = (rx_, ry_) => { const t = netT.clone(); t.needsUpdate = true; t.repeat.set(rx_, ry_); const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }); return m; };
const net = new THREE.Group(); net.position.set(0, 0, -11); pi.add(net);
const netPiece = (geo, mat, x, y, z, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.set(...rot); m.userData.nd = cardNd(mat.map); net.add(m); return m; };
const netBack = netPiece(new THREE.PlaneGeometry(7.32, 2.44, 8, 4), netMat(14, 5), 0, 1.22, -2, null);
netPiece(new THREE.PlaneGeometry(7.32, 2.0), netMat(14, 4), 0, 2.44, -1, [-Math.PI / 2, 0, 0]);
for (const s of [-1, 1]) netPiece(new THREE.PlaneGeometry(2.0, 2.44), netMat(4, 5), s * 3.66, 1.22, -1, [0, Math.PI / 2, 0]);
netBack.userData.p0 = netBack.geometry.attributes.position.array.slice();
// stands + crowd
add(tbox(46, 1.2, 0.6, 2), M.concrete, 0, 0.6, -18.5, pi);
{ const w = add(tbox(46, 0.5, 11.5, 3), M.concrete, 0, 3.6, -24.3, pi); w.rotation.x = rx(32); }
{
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const g = c.getContext('2d'); const r = P.rng(5);
  g.fillStyle = '#8a8fa0'; g.fillRect(0, 0, 2048, 512);
  const cols = ['#e2453c', '#f2c230', '#2f63a8', '#f4f1ea', '#2fae55', '#e8607e', '#7a4ab8', '#ff9a3a'], sk = ['#ffe2c2', '#f5c9a0', '#c99067', '#8a5a3a'];
  for (let row = 0; row < 10; row++) for (let x = 0; x < 2048; x += 26) { const y = 30 + row * 48 + r() * 6, xx = x + r() * 10;
    g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.ellipse(xx, y + 18, 13, 14, 0, 0, 7); g.fill();
    g.fillStyle = sk[(r() * sk.length) | 0]; g.beginPath(); g.arc(xx, y, 9, 0, 7); g.fill(); g.strokeStyle = INKC; g.lineWidth = 2; g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = add(new THREE.PlaneGeometry(46, 11), toon({ map: t }), 0, 3.95, -24.0, pi, { cast: false }); m.rotation.x = -rx(58);
}
for (const x of [-3.6, 3.6]) add(new THREE.CylinderGeometry(0.18, 0.22, 11, 8), M.navy, x, 5.5, -29.5, pi);
add(tbox(9.6, 4.7, 0.4, 2), M.navy, 0, 10.8, -29.4, pi);
const scoreS = mkSign(9.2, 4.3, 1024, 480, pi, 0, 10.8, -29.18, true);
for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.2, 0.3, 18, 8), M.navy, s * 21, 9, -27, pi); add(tbox(3, 1.6, 0.6, 1), M.white, s * 21, 18.4, -27, pi); }
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
  redraw(sheet, 'f' + S.fill.toFixed(2), (g, w, h) => drawSheet(g, w, h, S.fill));
  redraw(boardA, `A${S.board}|${S.ana}|${S.bpop.toFixed(2)}`, (g, w, h) => drawBoard(g, w, h, 'ANA', '#c23a64', S.board, S.ana, S.bpop));
  redraw(boardB, `B${S.board}|${S.bruno}|${S.bpop.toFixed(2)}`, (g, w, h) => drawBoard(g, w, h, 'BRUNO', '#2f63a8', S.board, S.bruno, S.bpop));
  for (const b of [boardA, boardB]) b.m.scale.setScalar(S.bscale);
  stepSigns.forEach((s, i) => { const state = i < 3 && S.easy > 0 ? 1 : i >= 5 && S.hard > 0 ? 2 : 0; redraw(s, `${state}`, (g, w, h) => drawStep(g, w, h, i + 1, state));
    const k = state === 1 ? S.easy : state === 2 ? S.hard : 1; s.m.scale.setScalar(Math.max(0.01, k)); });
  const ts = S.tri; redraw(triS, JSON.stringify(ts), (g, w, h) => drawTri(g, w, h, ts));
  plate.m.visible = S.plate > 0.001; plate.m.scale.set(Math.max(0.001, S.plate), 1, 1);
  const pa = netBack.geometry.attributes.position, p0 = netBack.userData.p0;
  for (let i = 0; i < pa.count; i++) { const x = p0[i * 3], y = p0[i * 3 + 1]; const d = Math.exp(-((x + 1.0) ** 2) / 2.5 - (y + 0.0) ** 2 / 1.2); pa.setZ(i, -S.bulge * d); }
  pa.needsUpdate = true;
  const sc = S.score; redraw(scoreS, JSON.stringify(sc), (g, w, h) => drawScore(g, w, h, sc));
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

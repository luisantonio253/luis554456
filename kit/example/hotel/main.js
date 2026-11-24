import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, HO, CI, HX, RK, PL, LAY, NCLIP, clipAt, tileScale } from './story.js';

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
// ======================= WORLD: "O vazamento do Fire Stick" =======================
const world = new THREE.Group(); scene.add(world);
{ const g = new THREE.PlaneGeometry(4000, 4000); g.rotateX(-Math.PI / 2); planarUV(g, 6); add(g, M.grass, 0, -0.3, 0, world, { cast: false }); }
const { TVC, FS, REM, KID, DESK, CALW, ITEMS, CAR, BILL, NOINT, TOWX, WINX, GATE, CNTS, COMM } = LAY;

// ---------- canvas helpers ----------
const FONT = (px, w = 'bold') => `${w} ${px}px Arial, "DejaVu Sans", "Liberation Sans", sans-serif`;
const MONO = (px) => `bold ${px}px "Courier New", "DejaVu Sans Mono", "Liberation Mono", monospace`;
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
const INKC = '#241726';
const slab = (x0, x1, z0, z1, par, mat, top = 0, th = 0.7, t = 2) => add(tbox(x1 - x0, th, z1 - z0, t), mat, (x0 + x1) / 2, top - th / 2, (z0 + z1) / 2, par, { cast: false });
const stamp = (g, x, y, s, word, col, px, rot = -0.22) => { if (s <= 0) return; g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.font = FONT(px);
  const tw = g.measureText(word).width; g.lineWidth = px * 0.14; g.strokeStyle = col; rr(g, -tw / 2 - px * 0.3, -px * 0.75, tw + px * 0.6, px * 1.5, px * 0.2); g.fillStyle = 'rgba(255,250,240,.92)'; g.fill(); g.stroke(); txt(g, word, 0, px * 0.05, px, col); g.restore(); };
const wifi = (g, x, y, s, col) => { g.save(); g.translate(x, y); g.strokeStyle = col; g.lineCap = 'round'; g.lineWidth = 16 * s;
  for (const r of [1, 2, 3]) { g.beginPath(); g.arc(0, 0, r * 34 * s, -Math.PI * 0.78, -Math.PI * 0.22); g.stroke(); }
  g.fillStyle = col; g.beginPath(); g.arc(0, 0, 13 * s, 0, 7); g.fill(); g.restore(); };
const glow = (m) => { m.userData.ndSkip = false; return m; };
const BAS = (c) => new THREE.MeshBasicMaterial({ color: c });

// grey-box "work in progress" game clip thumbnail (no real assets)
const drawClip = (g, x, y, w, h, k) => {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); g.scale(w / 320, h / 180);
  const sky = ['#ff9a6a', '#7ac8ff', '#c08aff', '#ffcf6a'][k % 4];
  const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, sky); gr.addColorStop(1, '#ffe8c8'); g.fillStyle = gr; g.fillRect(0, 0, 320, 180);
  g.fillStyle = '#9aa0a8'; for (let i = 0; i < 7; i++) { const bh = 30 + ((i * 53 + k * 31) % 70); g.fillRect(i * 48 - 6, 130 - bh, 40, bh); }
  g.fillStyle = '#6a6f78'; g.fillRect(0, 128, 320, 52); g.fillStyle = '#f2f2f2'; for (let i = 0; i < 6; i++) g.fillRect(10 + i * 56, 152, 30, 5);
  if (k % 3 === 0) { g.fillStyle = '#d8dce2'; rr(g, 120, 118, 110, 30, 8); g.fill(); g.fillStyle = INKC; g.beginPath(); g.arc(142, 150, 10, 0, 7); g.arc(208, 150, 10, 0, 7); g.fill(); }
  else { g.fillStyle = '#c8ccd2'; rr(g, 150, 70, 26, 62, 12); g.fill(); g.beginPath(); g.arc(163, 62, 13, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, 320, 28); txt(g, 'EM PRODUÇÃO', 160, 15, 20, '#ffe14a');
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(148, 78); g.lineTo(178, 95); g.lineTo(148, 112); g.fill();
  g.restore(); g.lineWidth = Math.max(2, w * 0.015); g.strokeStyle = INKC; g.strokeRect(x, y, w, h);
};

// ---------- HO: hotel room (cut-away, night) ----------
const ho = new THREE.Group(); ho.position.set(...HO); scene.add(ho);
M.carpet = toon({ color: '#6a4a5a' }); M.wallH = texM(P.plaster(8, 200), 1, 1); M.wallH2 = texM(P.plaster(9, 215), 1, 1);
M.blanket = toon({ color: '#4f62a8' }); M.sheet = toon({ color: '#f2efe6' }); M.tvBk = toon({ color: '#15151c' }); M.dk = toon({ color: '#2a2a33' });
add(tbox(7.6, 0.6, 7.0, 2), M.carpet, 0, -0.3, -0.2, ho, { cast: false });
add(tbox(7.6, 5.6, 0.3, 3), M.wallH, 0, 2.8, -3.2, ho);
for (const s of [-1, 1]) add(tbox(0.3, 5.6, 7.0, 3), M.wallH2, s * 3.75, 2.8, -0.2, ho);
add(tbox(7.2, 0.14, 0.05, 1), M.darkWood, 0, 0.07, -3.03, ho, { cast: false });
// bed
add(tbox(2.1, 0.32, 2.3, 1), M.darkWood, -2.3, 0.16, -1.9, ho);
add(tbox(2.0, 0.28, 2.2, 1), M.sheet, -2.3, 0.46, -1.9, ho);
add(tbox(2.04, 0.06, 1.5, 1), M.blanket, -2.3, 0.62, -1.45, ho, { cast: false });
add(tbox(2.2, 1.2, 0.12, 1), M.darkWood, -2.3, 0.75, -3.0, ho);
for (const x of [-2.8, -1.8]) { const p = add(new THREE.SphereGeometry(1, 14, 8), M.sheet, x, 0.66, -2.65, ho); p.scale.set(0.4, 0.1, 0.22); }
// nightstand + lamp
add(tbox(0.5, 0.55, 0.45, 1), M.wood, -0.9, 0.275, -2.8, ho);

// dresser + TV + Fire Stick
add(tbox(1.9, 0.8, 0.5, 1), M.darkWood, TVC[0], 0.4, -2.8, ho);
add(tbox(0.3, 0.1, 0.18, 1), M.tvBk, TVC[0], 0.85, -2.85, ho);
add(tbox(0.06, 0.3, 0.06, 1), M.tvBk, TVC[0], 0.98, -2.92, ho);
const tvBody = add(tbox(1.62, 0.95, 0.07, 1), M.tvBk, TVC[0], TVC[1], TVC[2] - 0.02, ho);
const scrG = new THREE.Group(); scrG.position.set(TVC[0], TVC[1], TVC[2] + 0.02); ho.add(scrG);
const screen = mkSign(1.5, 0.84, 640, 358, scrG, 0, 0, 0, true);
const stickG = new THREE.Group(); stickG.position.set(...FS); ho.add(stickG);
add(tbox(0.04, 0.12, 0.03, 1), M.tvBk, 0, 0.0, 0, stickG); add(tbox(0.03, 0.05, 0.02, 1), M.dk, 0, 0.08, -0.01, stickG);
const stLed = new THREE.MeshBasicMaterial({ color: '#3a2010' }); add(new THREE.SphereGeometry(0.008, 6, 4), stLed, 0, -0.035, 0.017, stickG, { cast: false });
// window (night city) + desk (empty) + calendar
const winS = mkSign(1.3, 1.1, 300, 254, ho, DESK[0], 2.15, -3.03, true);
redraw(winS, 'w', (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0c1238'); gr.addColorStop(1, '#3a3a7a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = P.rng(5); for (let i = 0; i < 9; i++) { const bx = i * 36 - 6, bh = 60 + r() * 110; g.fillStyle = '#1c1c3c'; g.fillRect(bx, h - bh, 32, bh); g.fillStyle = '#ffd86a'; for (let k = 0; k < 8; k++) if (r() > 0.55) g.fillRect(bx + 5 + (k % 3) * 9, h - bh + 8 + Math.floor(k / 3) * 16, 5, 7); }
  g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(w * 0.75, h * 0.2, 16, 0, 7); g.fill();
  g.lineWidth = 14; g.strokeStyle = '#e8e2d4'; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); });
add(tbox(1.42, 1.22, 0.04, 1), M.white, DESK[0], 2.15, -3.06, ho, { cast: false });
add(tbox(1.4, 0.06, 0.7, 1), M.wood, DESK[0], 0.78, DESK[2], ho);
for (const [dx, dz] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) add(tbox(0.06, 0.76, 0.06, 1), M.darkWood, DESK[0] + dx, 0.38, DESK[2] + dz, ho);
add(tbox(0.5, 0.06, 0.5, 1), M.dk, DESK[0], 0.48, DESK[2] + 0.75, ho); add(tbox(0.5, 0.6, 0.06, 1), M.dk, DESK[0], 0.8, DESK[2] + 1.0, ho);
const dust = mkSign(0.72, 0.5, 360, 250, ho, DESK[0], 0.815, DESK[2] - 0.02); dust.m.rotation.x = -Math.PI / 2; dust.m.material.transparent = true;
redraw(dust, 'd', (g, w, h) => { g.fillStyle = '#b07a4a'; g.fillRect(0, 0, w, h); const r = P.rng(3); g.fillStyle = 'rgba(230,220,200,.55)'; for (let i = 0; i < 600; i++) g.fillRect(r() * w, r() * h, 2, 2);
  g.fillStyle = '#9a6a3e'; rr(g, 40, 30, w - 80, h - 60, 12); g.fill(); g.setLineDash([14, 10]); g.lineWidth = 6; g.strokeStyle = '#e8e0d0'; rr(g, 40, 30, w - 80, h - 60, 12); g.stroke(); });
const tagG = new THREE.Group(); tagG.position.set(DESK[0] + 0.25, 0.9, DESK[2] + 0.1); ho.add(tagG);
const tagS = mkSign(0.5, 0.2, 400, 160, tagG, 0, 0, 0, true); tagS.m.rotation.x = -0.9;
redraw(tagS, 't', (g, w, h) => { g.fillStyle = '#ffd23f'; rr(g, 6, 6, w - 12, h - 12, 16); g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke(); txt(g, 'APREENDIDO', w / 2, h / 2 + 4, 62, '#c0202a'); });
const calS = mkSign(0.55, 0.7, 440, 560, ho, CALW[0], CALW[1], CALW[2] - 0.02);
add(tbox(0.6, 0.75, 0.02, 1), M.darkWood, CALW[0], CALW[1], CALW[2] - 0.04, ho, { cast: false });
// wall art + door
add(tbox(1.0, 0.7, 0.04, 1), M.white, -2.3, 2.6, -3.03, ho, { cast: false });
{ const s = mkSign(0.9, 0.6, 300, 200, ho, -2.3, 2.6, -3.0); redraw(s, 'a', (g, w, h) => { g.fillStyle = '#7fc8e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd36a'; g.beginPath(); g.arc(w * 0.7, h * 0.35, 30, 0, 7); g.fill(); g.fillStyle = '#4f9a6a'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * 0.35, h * 0.45); g.lineTo(w * 0.7, h); g.fill(); }); }
// remote control (3D, the payoff object)
const remG = new THREE.Group(); ho.add(remG);
add(tbox(0.055, 0.022, 0.19, 1), M.tvBk, 0, 0, 0, remG);
const remLed = new THREE.MeshBasicMaterial({ color: '#ff3030' }); add(new THREE.SphereGeometry(0.009, 8, 6), remLed, 0, 0.012, 0.075, remG, { cast: false });
for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) add(new THREE.CylinderGeometry(0.007, 0.007, 0.006, 8), BAS(['#e8e8e8', '#5ad0ff', '#7dff9a'][i]), -0.012 + j * 0.024, 0.013, 0.03 - i * 0.03, remG, { cast: false });
add(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10), BAS('#d0352f'), 0, 0.013, -0.06, remG, { cast: false });
// bought items: bag, phone, keyboard, mouse
const bagG = new THREE.Group(); bagG.position.set(...ITEMS.bag); ho.add(bagG);
add(tbox(0.38, 0.42, 0.18, 1), toon({ color: '#e8c08a' }), 0, 0.21, 0, bagG); { const h = add(new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), M.darkWood, 0, 0.42, 0, bagG); }
const phG = new THREE.Group(); phG.position.set(...ITEMS.ph); ho.add(phG);
add(tbox(0.09, 0.012, 0.18, 1), M.tvBk, 0, 0, 0, phG); { const s = mkSign(0.08, 0.16, 120, 240, phG, 0, 0.007, 0, true); s.m.rotation.x = -Math.PI / 2; redraw(s, 'p', (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5ad0ff'); gr.addColorStop(1, '#8a5aff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.fillRect(14, 20, w - 28, 10); }); }
const kbG = new THREE.Group(); kbG.position.set(...ITEMS.kb); ho.add(kbG);
add(tbox(0.46, 0.025, 0.16, 1), M.dk, 0, 0, 0, kbG);
{ const s = mkSign(0.44, 0.14, 440, 140, kbG, 0, 0.0135, 0, true); s.m.rotation.x = -Math.PI / 2; redraw(s, 'k', (g, w, h) => { g.fillStyle = '#2a2a33'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8dce2'; for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) g.fillRect(6 + c * 31, 8 + r * 32, 26, 26); g.fillRect(100, 8 + 3 * 32, 220, 26); }); }
const msG = new THREE.Group(); msG.position.set(...ITEMS.ms); ho.add(msG);
{ const m = add(new THREE.SphereGeometry(1, 14, 10), M.dk, 0, 0.015, 0, msG); m.scale.set(0.035, 0.02, 0.055); add(tbox(0.004, 0.004, 0.03, 1), M.chrome, 0, 0.034, -0.025, msG, { cast: false }); }

const drawTV = (g, w, h, S) => {
  g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
  if (S.m === 'off') { g.fillStyle = 'rgba(120,140,200,.14)'; g.beginPath(); g.moveTo(w * 0.1, 0); g.lineTo(w * 0.32, 0); g.lineTo(w * 0.12, h); g.lineTo(-w * 0.1, h); g.fill(); return; }
  if (S.m === 'menu') {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a1438'); gr.addColorStop(1, '#0a0a18'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    txt(g, 'SÉRIES', 110, 44, 46, '#ffffff'); txt(g, 'FILMES', 290, 44, 32, '#8a8aa8');
    const cols = ['#e2453c', '#3f7fd0', '#ffd23f', '#5ad0a0', '#ff8a3a'];
    for (let i = 0; i < 5; i++) { const x = 24 + i * 124, y = 92; g.fillStyle = cols[i]; rr(g, x, y, 108, 156, 12); g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x + 54, y + 62, 22, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 12, y + 112, 84, 12); g.fillRect(x + 12, y + 130, 60, 10);
      if (i === S.sel) { g.lineWidth = 9; g.strokeStyle = '#ffffff'; rr(g, x - 4, y - 4, 116, 164, 14); g.stroke(); } }
    for (let i = 0; i < 5; i++) { g.fillStyle = '#2a2a48'; rr(g, 24 + i * 124, 270, 108, 70, 10); g.fill(); }
    return;
  }
  // terminal-ish screens: green on black
  g.fillStyle = '#031208'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(80,255,140,.06)'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2);
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = MONO(30); g.fillStyle = '#5aff8a';
  if (S.m === 'up') {
    ['> conectado', '> pasta: GTA_6', '> 90 vídeos'].forEach((l, i) => g.fillText(l, 30, 50 + i * 44));
    txt(g, 'ENVIANDO...', w / 2, 210, 54, '#7dff9a', null, 0, MONO);
    g.strokeStyle = '#5aff8a'; g.lineWidth = 6; g.strokeRect(60, 258, w - 120, 46); g.fillStyle = '#5aff8a'; g.fillRect(70, 268, (w - 140) * S.p, 26);
    txt(g, Math.round(S.p * 100) + '%', w / 2, 330, 30, '#bfffd0', null, 0, MONO);
    return;
  }
  if (S.m === 'term') {
    const L = ['> ligando...', '> modo: computador', '> teclado: ok', '> mouse: ok', '> celular: ok', '> internet: ok', '> pronto'];
    L.slice(0, Math.max(1, S.n)).forEach((l, i) => g.fillText(l, 30, 40 + i * 44));
    if (S.blink) g.fillRect(30, 40 + Math.max(1, S.n) * 44 - 16, 18, 32);
    return;
  }
  // code
  g.font = MONO(22); g.fillStyle = '#2f9a55';
  for (let i = 0; i < 15; i++) { const k = (i + S.sc) % 15; g.fillText(['if (', 'car.', 'void ', 'map[', '} else {', 'npc->', 'for(i=0;', 'return ', 'radio(', 'vice_'][k % 10] + '0x' + ((k * 2654435761) >>> 0).toString(16).slice(0, 6) + ');', 24, 18 + i * 24); }
  g.fillStyle = 'rgba(3,18,8,.8)'; rr(g, 70, 100, w - 140, 160, 16); g.fill(); g.lineWidth = 6; g.strokeStyle = '#e0283a'; g.stroke();
  txt(g, 'SOLTAR O CÓDIGO?', w / 2, 150, 46, '#ffffff'); txt(g, S.blink ? '[ S ]   N' : '  S   [ N ]', w / 2, 218, 40, '#ffe14a', null, 0, MONO);
};
const drawCalW = (g, w, h, C) => {
  g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.lineWidth = 10; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
  g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, 110); txt(g, 'JULGAMENTO', w / 2, 58, 58, '#ffffff');
  for (let d = 0; d < 20; d++) { const cx = 62 + (d % 5) * 79, cy = 165 + Math.floor(d / 5) * 82; txt(g, String(d + 1), cx, cy, 34, '#2b2b3a');
    if (d < C.xs) { g.strokeStyle = '#c0202a'; g.lineWidth = 9; g.beginPath(); g.moveTo(cx - 24, cy - 24); g.lineTo(cx + 24, cy + 24); g.moveTo(cx + 24, cy - 24); g.lineTo(cx - 24, cy + 24); g.stroke(); } }
  txt(g, '???', w / 2, h - 40, 56, '#d0352f');
};

// ---------- CI: city street at night (police, billboard, company towers) ----------
const ci = new THREE.Group(); ci.position.set(...CI); scene.add(ci);
slab(-5, 5, -60, 20, ci, M.asphalt, 0, 0.7, 4); for (const s of [-1, 1]) slab(s > 0 ? 5 : -10, s > 0 ? 10 : -5, -60, 20, ci, M.concrete, 0.15, 0.85, 2);
for (let z = -55; z < 18; z += 6) add(tbox(0.15, 0.01, 2.5, 1), M.yellow, 0, 0.005, z, ci, { cast: false });
{ let k = 0; const r = P.rng(81); for (const s of [-1, 1]) for (let z = -24; z < 16; z += 11) { const h = 8 + r() * 10; add(tbox(6, h, 10.4, 4), M.facades[k++ % 6], s * 13, h / 2, z, ci); } }
const towers = [];
TOWX.forEach((x, i) => { const h = [17, 21, 15][i]; add(tbox(5.6, h, 8, 4), M.facades[(i + 2) % 6], x, h / 2, -34, ci);
  towers.push(mkSign(5.0, 1.5, 800, 240, ci, x, 9.5, -29.95, true)); });
for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), M.tvBk, BILL[0] + s * 1.8, 2.1, BILL[2] - 0.1, ci);
add(tbox(4.6, 2.6, 0.12, 1), M.tvBk, BILL[0], BILL[1], BILL[2] - 0.08, ci);
const billS = mkSign(4.4, 2.4, 880, 480, ci, BILL[0], BILL[1], BILL[2], true);
add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), M.chrome, NOINT[0], 0.65, NOINT[2] - 0.05, ci);
const nointG = new THREE.Group(); nointG.position.set(...NOINT); ci.add(nointG);
add(tbox(2.1, 1.5, 0.06, 1), M.white, 0, 0, -0.04, nointG); const nointS = mkSign(2.0, 1.4, 600, 420, nointG, 0, 0, 0, true);
for (const z of [-8, -20]) for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), M.tvBk, s * 5.6, 3.0, z, ci); add(new THREE.SphereGeometry(0.28, 10, 8), BAS('#fff2c0'), s * 5.1, 6.0, z, ci, { cast: false }); }
// police car
const carG = new THREE.Group(); carG.position.set(...CAR); carG.rotation.y = 0.35; ci.add(carG);
M.copW = toon({ color: '#f4f1ea' }); M.copB = toon({ color: '#1d2a5a' });
add(tbox(1.9, 0.6, 4.4, 1), M.copB, 0, 0.55, 0, carG); add(tbox(1.92, 0.3, 1.6, 1), M.copW, 0, 0.6, 0.2, carG); add(tbox(1.6, 0.5, 2.0, 1), M.copW, 0, 1.1, -0.2, carG);
add(tbox(1.5, 0.42, 0.04, 1), toon({ color: '#8fc4dc' }), 0, 1.1, 0.81, carG, { cast: false });
for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) add(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14).rotateZ(Math.PI / 2), M.tvBk, x, 0.34, z, carG);
const sirR = BAS('#ff2020'), sirB = BAS('#2040ff');
add(tbox(0.5, 0.16, 0.3, 1), sirR, -0.28, 1.43, -0.2, carG, { cast: false }); add(tbox(0.5, 0.16, 0.3, 1), sirB, 0.28, 1.43, -0.2, carG, { cast: false });
for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.12, 8, 6), BAS('#fffbe0'), s * 0.65, 0.62, 2.18, carG, { cast: false });
// laptop held by the cop
const lapG = new THREE.Group(); ci.add(lapG);
add(tbox(0.4, 0.025, 0.28, 1), M.chrome, 0, 0, 0, lapG);
const lid = new THREE.Group(); lid.position.set(0, 0.012, -0.14); lapG.add(lid); add(tbox(0.4, 0.27, 0.02, 1), M.chrome, 0, 0.135, 0, lid);
add(tbox(0.36, 0.23, 0.005, 1), BAS('#5ad0ff'), 0, 0.135, 0.012, lid, { cast: false }); lid.rotation.x = -0.25;

// ---------- HX: hotel exterior at night ----------
const hx = new THREE.Group(); hx.position.set(...HX); scene.add(hx);
slab(-30, 30, 0, 30, hx, M.asphalt, 0, 0.7, 4); slab(-30, 30, -2, 3, hx, M.concrete, 0.12, 0.8, 2);
add(tbox(14, 16, 10, 4), toon({ color: '#c9a88a' }), 0, 8, -5.05, hx);
const facS = mkSign(14, 16, 700, 800, hx, 0, 8, 0.0, false);
redraw(facS, 'f', (g, w, h) => { g.fillStyle = '#d8b494'; g.fillRect(0, 0, w, h); const r = P.rng(9);
  for (let c = 0; c < 6; c++) for (let rw = 1; rw < 7; rw++) { const x = c * w / 6 + 18, y = h - (rw + 1) * h / 7 + 18, ww = w / 6 - 36, hh = h / 7 - 40;
    const target = c === 4 && rw === 4, lit = target || r() > 0.55;
    g.fillStyle = target ? '#5aff8a' : lit ? '#ffd27a' : '#2a3050'; g.fillRect(x, y, ww, hh); g.lineWidth = 6; g.strokeStyle = '#6a4a3a'; g.strokeRect(x, y, ww, hh); g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + hh); g.stroke(); }
  g.fillStyle = '#3a2a2a'; g.fillRect(w / 2 - 60, h - 110, 120, 110); g.fillStyle = '#ffd27a'; g.fillRect(w / 2 - 50, h - 100, 100, 90); });
add(tbox(8.4, 2.4, 0.3, 1), M.tvBk, 0, 17.3, -0.2, hx);
const hotelS = mkSign(8.2, 2.2, 820, 220, hx, 0, 17.3, -0.02, true);
add(tbox(5, 0.2, 2.4, 1), M.red, 0, 3.2, 1.0, hx);
for (const x of [-12, 12]) { add(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), M.tvBk, x, 3.0, 4, hx); add(new THREE.SphereGeometry(0.28, 10, 8), BAS('#fff2c0'), x, 6.0, 4, hx, { cast: false }); }
for (const s of [-1, 1]) { const h = 10 + (s > 0 ? 4 : 0); add(tbox(10, h, 10, 4), M.facades[s > 0 ? 3 : 4], s * 13, h / 2, -5, hx); }

// ---------- RK: the studio "fortress" ----------
const rk = new THREE.Group(); rk.position.set(...RK); scene.add(rk);
slab(-40, 40, -20, 45, rk, M.concrete, 0, 0.7, 3); slab(-3.5, 3.5, 0.6, 45, rk, M.asphalt, 0.02, 0.7, 4);
M.fortW = texM(P.stone(14), 1, 1);
add(tbox(34, 10, 1.2, 3), M.fortW, 0, 5, -0.6, rk);
for (let i = -16; i <= 16; i += 2) add(tbox(1.0, 0.9, 1.3, 1), M.fortW, i, 10.45, -0.6, rk);
for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(2.2, 2.4, 14, 16), M.fortW, s * 14.5, 7, -0.6, rk); add(new THREE.CylinderGeometry(2.6, 2.6, 0.8, 16), M.dk, s * 14.5, 14.4, -0.6, rk); }
// vault gate
add(new THREE.CylinderGeometry(2.9, 2.9, 0.25, 40).rotateX(Math.PI / 2), M.dk, GATE[0], GATE[1], 0.05, rk, { cast: false });
add(new THREE.CircleGeometry(2.6, 40), BAS('#0a2a14'), GATE[0], GATE[1], 0.19, rk, { cast: false });
add(new THREE.CircleGeometry(1.7, 32), BAS('#2ad06a'), GATE[0], GATE[1], 0.21, rk, { cast: false });
const doorP = new THREE.Group(); doorP.position.set(GATE[0] - 2.6, GATE[1], 0.32); rk.add(doorP);
const door = new THREE.Group(); door.position.set(2.6, 0, 0); doorP.add(door);
add(new THREE.CylinderGeometry(2.6, 2.6, 0.35, 40).rotateX(Math.PI / 2), M.chrome, 0, 0, 0, door);
add(new THREE.TorusGeometry(1.6, 0.08, 8, 32), M.dk, 0, 0, 0.2, door);
for (let k = 0; k < 3; k++) { const b = add(tbox(2.4, 0.16, 0.12, 1), M.dk, 0, 0, 0.24, door); b.rotation.z = k * Math.PI / 3; }
add(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 20).rotateX(Math.PI / 2), M.yellow, 0, 0, 0.3, door);
const qgS = mkSign(10, 1.8, 1000, 180, rk, 0, 7.7, 0.02, true);
redraw(qgS, 'q', (g, w, h) => { g.fillStyle = '#14102a'; rr(g, 6, 6, w - 12, h - 12, 26); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ffd23f'; g.stroke(); txt(g, 'QG DO GTA 6', w / 2, h / 2 + 6, 120, '#ffd23f'); });
const gscS = mkSign(1.5, 0.95, 300, 190, rk, 3.6, 2.4, 0.03, true);
const cntS = mkSign(2.8, 1.7, 560, 340, rk, CNTS[0], CNTS[1], 0.03, true);
add(tbox(6.3, 3.7, 0.12, 1), M.tvBk, COMM[0], COMM[1], -0.02, rk);
const commS = mkSign(6.0, 3.4, 900, 510, rk, COMM[0], COMM[1], 0.06, true);
// security cameras + lasers + searchlights
for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 5.2, 8.8, 0.3); g.rotation.set(0.5, s * 0.4, 0, 'YXZ'); rk.add(g);
  add(tbox(0.3, 0.26, 0.6, 1), M.white, 0, 0, 0.2, g); add(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10).rotateX(Math.PI / 2), M.tvBk, 0, 0, 0.52, g); add(new THREE.SphereGeometry(0.04, 8, 6), BAS('#ff2a2a'), 0.1, 0.1, 0.5, g, { cast: false }); }
const laserMat = new THREE.MeshBasicMaterial({ color: '#ff2a3a', transparent: true, opacity: 0.85 });
const lasers = new THREE.Group(); rk.add(lasers);
for (const s of [-1, 1]) add(tbox(0.25, 3.0, 0.25, 1), M.dk, s * 3.4, 1.5, 3.2, rk);
for (let i = 0; i < 6; i++) { const m = add(new THREE.CylinderGeometry(0.02, 0.02, 6.8, 6).rotateZ(Math.PI / 2), laserMat, 0, 0.45 + i * 0.45, 3.2, lasers, { cast: false }); m.userData.ndSkip = true; }
const beamMat = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false });
const beams = [];
for (const s of [-1, 1]) { const p = new THREE.Group(); p.position.set(s * 14.5, 14.9, -0.6); rk.add(p);
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 12).rotateX(Math.PI / 2), M.chrome, 0, 0, 0, p);
  const b = add(new THREE.ConeGeometry(4, 40, 24, 1, true).translate(0, -20, 0).rotateX(-Math.PI / 2), beamMat, 0, 0, 0, p, { cast: false }); b.userData.ndSkip = true; b.renderOrder = 3;
  beams.push(p); }
for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI - 0.1, d = 160 + (i % 3) * 30; const m = add(new THREE.SphereGeometry(1, 16, 10), M.hill, Math.cos(a) * d, 0, -60 - Math.sin(a) * d, rk, { cast: false }); m.scale.set(40, 18 + (i % 4) * 7, 40); }
// leaked clips
const clips = [];
for (let i = 0; i < NCLIP; i++) { const s = mkSign(1.6, 0.9, 320, 180, rk, 0, 0, 0, true); redraw(s, 'c', (g, w, h) => drawClip(g, 0, 0, w, h, i)); s.m.visible = false; clips.push(s); }

// ---------- PL: plaza with a wall of phones ----------
const pl = new THREE.Group(); pl.position.set(...PL); scene.add(pl);
slab(-30, 30, -6, 30, pl, M.concrete, 0, 0.7, 3);
add(tbox(13.4, 11, 0.6, 3), M.dk, 0, 5.5, -0.35, pl);
const vazS = mkSign(6, 1.3, 900, 195, pl, 0, 10.3, 0.0, true);
redraw(vazS, 'v', (g, w, h) => { g.fillStyle = '#e0283a'; rr(g, 6, 6, w - 12, h - 12, 26); g.fill(); g.lineWidth = 10; g.strokeStyle = '#ffffff'; g.stroke(); txt(g, 'VAZOU!', w / 2, h / 2 + 6, 140, '#ffffff'); });
const tiles = [];
for (let r = 0; r < 6; r++) for (let c = 0; c < 13; c++) {
  const i = tiles.length, t = mkSign(0.82, 1.32, 150, 240, pl, -5.4 + c * 0.9, 1.35 + r * 1.45, 0.0, true);
  redraw(t, 'x', (g, w, h) => { g.fillStyle = '#101018'; rr(g, 0, 0, w, h, 18); g.fill(); drawClip(g, 10, 50, w - 20, 84, (i * 7) % 11); g.fillStyle = '#ff3a6a'; txt(g, '♥ ' + (1 + (i * 13) % 9) + ',' + (i % 10) + ' mi', w / 2, 168, 22, '#ff6a8a'); txt(g, '▶ VAZOU', w / 2, 205, 22, '#ffd23f'); });
  t.m.visible = false; tiles.push(t);
}
for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.07, 0.09, 6, 6), M.tvBk, s * 8, 3.0, 4, pl); add(new THREE.SphereGeometry(0.28, 10, 8), BAS('#fff2c0'), s * 7.6, 6.0, 4, pl, { cast: false }); }
{ let k = 0; for (const s of [-1, 1]) { add(tbox(8, 14, 8, 4), M.facades[k++ % 6], s * 12, 7, -3, pl); } }

// ---------- per-frame world state ----------
const remBed = [HO[0] + REM[0], HO[1] + REM[1], HO[2] + REM[2]];
function worldState(S, f) {
  redraw(screen, JSON.stringify(S.tv), (g, w, h) => drawTV(g, w, h, S.tv)); scrG.scale.x = S.flip;
  stLed.color.set(S.led ? '#ff9a20' : '#3a2010');
  remLed.color.set(f >= 1632 && f < 1650 && Math.floor(f / 3) % 2 ? '#ffe0e0' : '#ff3030');
  if (S.remHeld) { remG.position.set(KID[0], 1.06, KID[2] + 0.28); remG.rotation.set(-0.4, 0, 0); }
  else { remG.position.set(...REM); remG.rotation.set(0, 0.45, 0); }
  const I = S.items;
  bagG.visible = I.bag > 0.001; bagG.scale.setScalar(Math.max(0.001, I.bag));
  phG.visible = I.ph > 0.001; phG.scale.setScalar(Math.max(0.001, I.ph));
  msG.visible = I.ms > 0.001; msG.scale.setScalar(Math.max(0.001, I.ms));
  kbG.visible = I.kb > 0.001; kbG.scale.setScalar(Math.max(0.001, I.kb));
  if (I.kbHeld) { kbG.position.set(KID[0], 1.02, KID[2] + 0.3); kbG.rotation.set(0.9, 0, 0); } else { kbG.position.set(...ITEMS.kb); kbG.rotation.set(0, 0, 0); }
  redraw(calS, 'c' + S.cal.xs, (g, w, h) => drawCalW(g, w, h, S.cal));
  tagG.visible = S.tag > 0.001; tagG.scale.setScalar(Math.max(0.001, S.tag));
  // street
  redraw(billS, JSON.stringify(S.bill), (g, w, h) => { g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#d0352f'; g.fillRect(0, 0, w, 36); g.fillRect(0, h - 36, w, 36);
    if (S.bill.a > 0) { g.save(); g.translate(w / 2, 165); g.scale(S.bill.a, S.bill.a); txt(g, 'SETEMBRO', 0, 0, 150, '#1d2a4a'); g.restore(); }
    if (S.bill.b > 0) { g.save(); g.translate(w / 2, 335); g.scale(S.bill.b, S.bill.b); txt(g, '2022', 0, 0, 190, '#d0352f', INKC, 10); g.restore(); } });
  towers.forEach((t, i) => redraw(t, 'i' + S.inv[i], (g, w, h) => { g.fillStyle = '#16102a'; rr(g, 4, 4, w - 8, h - 8, 26); g.fill(); g.lineWidth = 8; g.strokeStyle = ['#4fd8ff', '#ff4fb0', '#7dff6a'][i]; g.stroke();
    txt(g, ['BANCO', 'APP', 'CHIPS'][i], w / 2, h / 2 + 6, 120, ['#4fd8ff', '#ff4fb0', '#7dff6a'][i]); stamp(g, w / 2, h / 2, S.inv[i], 'INVADIDO', '#e0283a', 92, -0.12); }));
  nointG.visible = S.noint > 0.001; nointG.scale.setScalar(Math.max(0.001, S.noint));
  redraw(nointS, 'n' + S.nox, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.lineWidth = 14; g.strokeStyle = INKC; g.strokeRect(0, 0, w, h);
    txt(g, 'PROIBIDO', w / 2, 70, 84, '#c0202a'); wifi(g, w / 2, 330, 1.7, '#1d2a4a');
    if (S.nox > 0) { g.save(); g.translate(w / 2, 255); g.scale(S.nox, S.nox); g.strokeStyle = '#e0283a'; g.lineWidth = 26; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 135, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-95, -95); g.lineTo(95, 95); g.stroke(); g.restore(); } });
  sirR.color.set(S.siren ? '#ff2020' : '#4a0808'); sirB.color.set(S.siren ? '#10184a' : '#2040ff');
  if (S.laptop) { lapG.visible = true; const up = S.laptop.up; lapG.position.set(S.copX, 0.74 + 0.06 * up, -4.3 + 0.34); lapG.rotation.set(0.25, 0, 0); lid.rotation.x = -0.45 - 1.0 * (1 - up); }
  else lapG.visible = false;
  // hotel
  redraw(hotelS, 'h' + S.neon, (g, w, h) => { g.fillStyle = '#14102a'; rr(g, 6, 6, w - 12, h - 12, 30); g.fill(); g.lineWidth = 12; g.strokeStyle = S.neon ? '#ff4fb0' : '#3a2a40'; g.stroke();
    if (S.neon) { g.shadowColor = '#ff4fb0'; g.shadowBlur = 40; } txt(g, 'HOTEL', w / 2, h / 2 + 8, 160, S.neon ? '#ff8ad0' : '#4a2a40'); g.shadowBlur = 0; });
  // fortress
  doorP.position.y = GATE[1] - 6.2 * S.gate; door.rotation.z = -2.4 * S.gate;
  redraw(gscS, S.gscr, (g, w, h) => { g.fillStyle = '#0a0a10'; g.fillRect(0, 0, w, h); const ok = S.gscr === 'lib'; g.lineWidth = 10; g.strokeStyle = ok ? '#3aff7a' : '#ff3a3a'; g.strokeRect(5, 5, w - 10, h - 10);
    txt(g, 'ACESSO', w / 2, 64, 50, '#ffffff'); txt(g, ok ? 'LIBERADO' : 'NEGADO', w / 2, 132, 50, ok ? '#3aff7a' : '#ff3a3a'); });
  redraw(cntS, 'n' + S.cnt, (g, w, h) => { g.fillStyle = '#0a0a10'; g.fillRect(0, 0, w, h); g.lineWidth = 12; g.strokeStyle = '#ffd23f'; g.strokeRect(6, 6, w - 12, h - 12);
    txt(g, 'VÍDEOS VAZADOS', w / 2, 70, 52, '#ffffff'); txt(g, String(S.cnt), w / 2, 220, 170, S.cnt >= 90 ? '#ff4a4a' : '#ffd23f'); });
  redraw(commS, JSON.stringify(S.comm), (g, w, h) => { g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2a4a'; g.fillRect(0, 0, w, 110); txt(g, 'COMUNICADO', w / 2, 58, 78, '#ffffff');
    const L = ['Os vídeos que vazaram', 'são do GTA 6 de verdade,', 'ainda em produção.', 'Seguimos trabalhando.'];
    L.slice(0, S.comm.lines).forEach((l, i) => txt(g, l, w / 2, 170 + i * 82, 54, '#2b2b3a'));
    stamp(g, w / 2, h / 2 + 50, S.comm.st, 'É VERDADE', '#e0283a', 120, -0.16); });
  lasers.visible = S.lasers;
  beams.forEach((b, i) => { const a = Math.sin(S.sweep * 0.035 + i * 2.2); b.rotation.set(-0.35 + 0.12 * Math.cos(S.sweep * 0.05 + i), (i ? -1 : 1) * (0.45 + 0.4 * a), 0, 'YXZ'); });
  clips.forEach((c, i) => { const p = clipAt(S.clipsF, i); if (!p) { c.m.visible = false; return; } c.m.visible = true; c.m.position.set(p.x, p.y, p.z); c.m.scale.setScalar(Math.max(0.001, p.s)); c.m.rotation.set(0, 0, p.rot); });
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

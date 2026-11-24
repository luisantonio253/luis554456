import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, TOP, SZ, crestZ, xr, rvHalf, H as HT, RY, zSea, SRCY, DO, dTop, KMX, KMZ, SIGN, canoeAt } from './story.js';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

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
const seaMat = mkWater(0.06, [0, 0.25]);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2300), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0, 18 + 1150);
sea.userData.nd = waterNd; sea.receiveShadow = false; scene.add(sea);

// rivers: water that only exists on one side of a moving z "cut" (reveal / rewind)
const mkRiver = (scale, flow, sgn) => {
  const m = mkWater(scale, flow);
  m.uniforms.cut = { value: 0 }; m.uniforms.sgn = { value: sgn };
  m.fragmentShader = m.fragmentShader.replace('void main(){', 'uniform float cut, sgn;\n      void main(){ if (sgn*(vW.z-cut) > 0.) discard;');
  const nd = new THREE.ShaderMaterial({ uniforms: m.uniforms,
    vertexShader: `varying float vD; varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix*w; vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float cut, sgn; varying float vD; varying vec3 vW; void main(){ if (sgn*(vW.z-cut) > 0.) discard; gl_FragColor=vec4(.5,1.,.52,vD); }` });
  return [m, nd];
};
const strip = (pts) => { // pts: [[x,y,z,half,dirx,dirz], ...] -> ribbon
  const pos = [], idx = [];
  pts.forEach(([x, y, z, h, dx, dz], i) => { const L = Math.hypot(dx, dz) || 1, px = -dz / L, pz = dx / L;
    pos.push(x - px * h, y, z - pz * h, x + px * h, y, z + pz * h);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
};

// ---------- world: the Serra do Mar, the plateau and the Tietê ----------
const world = new THREE.Group(); scene.add(world);
{
  const xs = [], zz = [];
  for (let x = -900; x < -150; x += 12) xs.push(x); for (let x = -150; x < -40; x += 3) xs.push(x); for (let x = -40; x < 40; x += 1.25) xs.push(x); for (let x = 40; x < 150; x += 2.5) xs.push(x); for (let x = 150; x <= 900; x += 12) xs.push(x);
  for (let z = -1400; z < -60; z += 10) zz.push(z); for (let z = -60; z < 64; z += 0.8) zz.push(z); for (let z = 64; z <= 240; z += 6) zz.push(z);
  const nx = xs.length, nz = zz.length, pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const C = (h) => new THREE.Color(h), cS = C('#e6d39a'), cSw = C('#c8b27a'), cF = C('#2f6a34'), cF2 = C('#457f3a'), cR = C('#7a7468'), cG = C('#7fae4a'), cG2 = C('#a3c25c'), cB = C('#b9a776'), t = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], z = zz[j], h = HT(x, z), k = (j * nx + i) * 3; pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
    const n = 0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.03) * Math.sin(z * 0.041 - x * 0.02), zc = crestZ(x);
    if (z > zc + 2) { if (h < 1.7) t.copy(h < 0.2 ? cSw : cS); else { t.copy(cF).lerp(cF2, n); if (((x * 7.3 + z * 3.1) % 5 + 5) % 5 < 0.6) t.lerp(cR, 0.5); } }
    else { t.copy(cG).lerp(cG2, n); if (z < SZ && Math.abs(x - xr(z)) < rvHalf(z) + 1.4) t.lerp(cB, 0.7); if (z > zc - 1) t.lerp(cF2, 0.5); }
    col[k] = t.r; col[k + 1] = t.g; col[k + 2] = t.b;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let q = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  add(g, toon({ vertexColors: true }), 0, 0, 0, world, { cast: true });
}
// forest: Atlantic forest on the wall, clumps on the plateau
{
  const geo = new THREE.SphereGeometry(1, 10, 8), N = 2600, A = new THREE.InstancedMesh(geo, M.tree, N), B = new THREE.InstancedMesh(geo, M.tree2, N), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let ka = 0, kb = 0;
  for (let i = 0; i < 40000 && (ka < N || kb < N); i++) {
    const x = (rngW() - 0.5) * 760, z = 70 - Math.pow(rngW(), 1.7) * 1000, h = HT(x, z), zc = crestZ(x), wall = z > zc + 1.5;
    if (h < 1.8) continue;
    if (!wall && Math.sin(x * 0.05 + z * 0.03) * Math.sin(z * 0.041 - x * 0.02) < 0.25 && rngW() > 0.08) continue;
    if (Math.hypot(x, z - SZ) < 15) continue;
    if (z < SZ + 3 && Math.abs(x - xr(Math.min(z, SZ))) < rvHalf(z) + 5.5) continue;
    if (Math.abs(x) < 4 && z > SZ && z < 60) continue; // keep the "normal river" path clear
    if (Math.hypot(x - KMX(), z - KMZ) < 16) continue;
    const r = wall ? 1.8 + rngW() * 2.2 : 2.4 + rngW() * 3.4; p.set(x, h + r * 0.35, z); s.set(r, r * 0.85, r); m4.compose(p, qq, s);
    if (i % 2 && ka < N) A.setMatrixAt(ka++, m4); else if (kb < N) B.setMatrixAt(kb++, m4);
  }
  A.count = ka; B.count = kb; for (const I of [A, B]) { I.castShadow = I.receiveShadow = true; world.add(I); }
}
// the spring: a little pond ringed with stones
{
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1.35, 28), mkWater(0.6, [0.2, -0.5])); pond.rotation.x = -Math.PI / 2; pond.position.set(0, SRCY, SZ); pond.userData.nd = waterNd; world.add(pond);
  const rs = P.rng(12); for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2 + 0.3; if (Math.abs(Math.sin(a) + 1) < 0.25) continue; // gap on the inland side (outflow)
    const r = 0.22 + rs() * 0.25, x = Math.cos(a) * 1.5, z = SZ + Math.sin(a) * 1.5; const m = add(new THREE.DodecahedronGeometry(r, 0), M.stone, x, HT(x, z) + r * 0.4, z, world); m.rotation.set(rs() * 3, rs() * 3, 0); }
}
// the Tietê (reveals inland) and the "normal" river (pours down the wall, then rewinds)
const [tieteMat, tieteNd] = mkRiver(0.25, [0, -1.1], -1);
{
  const pts = []; for (let z = SZ + 0.6; z > -1400; z -= z > SZ - 40 ? 0.5 : 3) { const x = xr(Math.min(z, SZ)); pts.push([x, z > SZ ? SRCY : Math.min(RY(z), SRCY), z, rvHalf(z), xr(z - 1) - xr(z), -1]); }
  const m = new THREE.Mesh(strip(pts), tieteMat); m.userData.nd = tieteNd; m.receiveShadow = true; world.add(m);
}
const [ghostMat, ghostNd] = mkRiver(0.4, [0, 2.4], 1);
const ghost = (() => {
  const pts = [], zE = zSea(0) + 7; for (let z = SZ; z < zE; z += 0.3) { const h = HT(0, z); pts.push([0, h > 0 ? Math.max(h + 0.5, 0.06) : 0.06, z, 0.8 + 0.6 * clamp((z - SZ) / 30), 0, 1]); }
  const m = new THREE.Mesh(strip(pts), ghostMat); m.userData.nd = ghostNd; world.add(m); return m;
})();
// the milestone sign on the river bank
const signC = document.createElement('canvas'); signC.width = 640; signC.height = 300; const signT = P.tex(signC); signT.wrapS = signT.wrapT = THREE.ClampToEdgeWrapping;
let signKey = -1;
const drawSign = (v) => {
  const g = signC.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#d7a466'; g.fillRect(0, 0, 640, 300);
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(110,60,20,${0.12 + 0.05 * (i % 2)})`; g.fillRect(0, i * 60 + 28, 640, 6); }
  g.strokeStyle = '#4a2a14'; g.lineWidth = 16; g.strokeRect(8, 8, 624, 284);
  g.fillStyle = '#3a2412'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 54px Arial Black, DejaVu Sans, Arial'; g.fillText('RIO TIETÊ', 320, 76);
  const s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  g.font = 'bold 104px Arial Black, DejaVu Sans, Arial'; g.fillText(s + ' km', 320, 200);
  signT.needsUpdate = true;
};
{
  const sg = new THREE.Group(); const [sx, sy, sz] = SIGN(); sg.position.set(sx, sy, sz); world.add(sg);
  sg.rotation.y = Math.atan2(6.3, 5.6);
  add(new THREE.CylinderGeometry(0.09, 0.11, 1.9, 8), M.darkWood, 0, 0.95, -0.06, sg);
  add(tbox(1.5, 0.9, 0.08, 1), M.darkWood, 0, 1.55, -0.02, sg);
  add(new THREE.PlaneGeometry(1.42, 0.83), new THREE.MeshToonMaterial({ gradientMap: grad, map: signT }), 0, 1.55, 0.025, sg, { cast: false });
  drawSign(0);
}
// the canoe
const canoe = new THREE.Group(); scene.add(canoe);
const paddles = [];
{
  const sh = new THREE.Shape(), hp = [[0, -3.8], [0.42, -2.9], [0.58, -1.2], [0.6, 0.6], [0.5, 2.6], [0, 3.6], [-0.5, 2.6], [-0.6, 0.6], [-0.58, -1.2], [-0.42, -2.9]];
  sh.moveTo(hp[0][0], -hp[0][1]); for (const [x, z] of hp.slice(1)) sh.lineTo(x, -z);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: 0.65, bevelEnabled: false, curveSegments: 1 }); hull.rotateX(-Math.PI / 2); hull.translate(0, -0.12, 0); planarUV(hull, 1.5, 'zy');
  add(hull, [M.plank, M.hull], 0, 0, 0, canoe);
  for (const [z, s] of [[-2.0, 1], [0.1, 1], [2.2, -1]]) {
    const pv = new THREE.Group(); pv.position.set(s * 0.72, 1.15, z); canoe.add(pv);
    const sh_ = add(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6), M.wood, 0, -0.75, 0, pv); sh_.rotation.z = s * 0.25;
    add(tbox(0.06, 0.55, 0.22, 0.5), M.wood, s * 0.24, -1.7, 0, pv);
    pv.userData.s = s; pv.userData.k = paddles.length * 2; paddles.push(pv);
  }
}
// ---------- the cut-away diorama of the Serra (frame D) ----------
const dio = new THREE.Group(); dio.position.set(...DO); scene.add(dio);
{
  const strataC = document.createElement('canvas'); strataC.width = 256; strataC.height = 512; const g = strataC.getContext('2d'), r = P.rng(77);
  const bands = [['#4a3a2a', 40], ['#b8683a', 70], ['#c9a06a', 90], ['#8a5a3a', 60], ['#7a7a80', 120], ['#5f6068', 132]];
  let y = 0; for (const [c, h] of bands) { g.fillStyle = c; g.fillRect(0, y, 256, h); y += h; }
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(30,20,10,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * 256, r() * 512, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, 7); g.fill(); }
  const strata = texM(strataC, 1, 1); strata.map.wrapT = THREE.ClampToEdgeWrapping;
  const sh = new THREE.Shape(), pts = [[-150, -10]];
  for (let x = -150; x < 0; x += 3) pts.push([x, dTop(x)]); for (let x = 0; x <= 24; x += 1) pts.push([x, dTop(x)]);
  pts.push([30, 0.2], [34, -3], [70, -3], [70, -10]);
  sh.moveTo(...pts[0]); for (const p of pts.slice(1)) sh.lineTo(...p);
  const eg = new THREE.ExtrudeGeometry(sh, { depth: 14, bevelEnabled: false, curveSegments: 1 });
  const pa = eg.attributes.position, uv = eg.attributes.uv; for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / 40, 1 - (TOP - pa.getY(i)) / 46);
  { const nm = eg.attributes.normal, cc = new Float32Array(pa.count * 3), t = new THREE.Color(), gr_ = new THREE.Color('#6aa444'), rk = new THREE.Color('#8a7f6e'), sd = new THREE.Color('#e6d39a');
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), ny = nm.getY(i); t.copy(x > 23.5 ? sd : x > 0.5 && ny < 0.75 ? rk : gr_); cc[i * 3] = t.r; cc[i * 3 + 1] = t.g; cc[i * 3 + 2] = t.b; }
    eg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
  add(eg, [strata, toon({ vertexColors: true })], 0, 0, 0, dio);
  add(tbox(10, 0.3, 14, 2), M.sand, 29, 0.42, 7, dio, { cast: false });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(130, 14), mkWater(0.12, [0.1, 0.2])); w.rotation.x = -Math.PI / 2; w.position.set(24 + 65, 0.02, 7); w.userData.nd = waterNd; dio.add(w);
  add(tbox(130, 3, 14, 4), toon({ color: '#2a5f9a' }), 24 + 65, -1.5, 7, dio, { cast: false });
  add(tbox(330, 2, 40, 6), M.darkWood, -20, -11, 7, dio, { cast: false }); // the table
  // the little river on top of the ramp, flowing away from the sea
  const rp = []; for (let x = -1; x > -150; x -= 1) rp.push([x, dTop(x) + 0.08, 5.5, 1.0, -1, 0]);
  const rm = new THREE.Mesh(strip(rp), mkWater(0.3, [-1.2, 0])); rm.userData.nd = waterNd; dio.add(rm);
  // trees along the top + on the wall
  for (let i = 0; i < 30; i++) { const x = -140 + i * 5 + (i % 3), z = i % 2 ? 2.2 : 8.6, r = 1.1 + (i % 4) * 0.35; add(new THREE.SphereGeometry(r, 10, 8), i % 2 ? M.tree : M.tree2, x, dTop(x) + r * 0.6, z, dio); }
  for (let i = 0; i < 8; i++) { const x = 2 + i * 2.6, r = 0.9 + (i % 3) * 0.3; add(new THREE.SphereGeometry(r, 10, 8), M.tree, x, dTop(x) + 0.2, 6 - (i % 2) * 3.5, dio); }
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
  lamp.intensity = L.lamp || 0; if (L.lampAt) lamp.position.set(...L.lampAt);
}
function placeSun(L, focus) {
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 150); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
}

function worldState(S, f) {
  tieteMat.uniforms.cut.value = S.tiete;
  ghostMat.uniforms.cut.value = S.ghost; ghost.visible = S.ghost > SZ + 0.3;
  if (S.kmVal !== signKey) { signKey = S.kmVal; drawSign(S.kmVal); }
  const ff = Math.max(780, Math.min(954, f)), c = canoeAt(ff);
  canoe.position.set(...c.pos); canoe.rotation.set(0, c.yaw, c.roll, 'YXZ');
  for (const p of paddles) p.rotation.set(0.7 * Math.sin(ff * 0.22 + p.userData.k), 0, 0);
  waterU.t.value = f / 30;
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

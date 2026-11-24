import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import * as P2 from './paint2.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt, LAND, SO, G, MH } from './story.js';

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
const seaMat = mkWater(0.06, [0, -0.25]);
const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0, -300);
sea.userData.nd = waterNd; sea.receiveShadow = false; scene.add(sea);

// ---------- world: the bay (1502) ----------
const world = new THREE.Group(); scene.add(world);
// coast: U-shaped polygon around Guanabara-like bay, mouth between two headlands at z = 0
const BAY = { cx: 0, cz: -190, rx: 160, rz: 175 }, MOUTH = 26;
{
  const sh = new THREE.Shape(), pt = (x, z) => [x, -z];
  const pts = [pt(-900, 30)];
  for (let x = -880; x < -MOUTH - 30; x += 20) pts.push(pt(x, 30 + 6 * Math.sin(x * 0.03)));
  pts.push(pt(-MOUTH, 25), pt(-MOUTH, -17.3));
  const a0 = 90 + Math.asin(MOUTH / BAY.rx) * 180 / Math.PI, a1 = 450 - Math.asin(MOUTH / BAY.rx) * 180 / Math.PI;
  for (let a = a0 + 3; a < a1 - 2; a += 3) {
    const t = rx(a), edge = Math.min(1, Math.min(a - a0, a1 - a) / 25), w = 1 + edge * (0.09 * Math.sin(3 * t) + 0.05 * Math.sin(7 * t + 1) + 0.03 * Math.sin(13 * t));
    pts.push(pt(BAY.cx + Math.cos(t) * BAY.rx * w, BAY.cz + Math.sin(t) * BAY.rz * w));
  }
  pts.push(pt(MOUTH, -17.3), pt(MOUTH, 25));
  for (let x = MOUTH + 30; x < 880; x += 20) pts.push(pt(x, 30 + 6 * Math.sin(x * 0.03 + 1)));
  pts.push(pt(900, 30), pt(900, -1300), pt(-900, -1300));
  sh.moveTo(...pts[0]); for (const p of pts.slice(1)) sh.lineTo(...p);
  const g = new THREE.ExtrudeGeometry(sh, { depth: LAND, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  planarUV(g, 14);
  const land = add(g, [M.grass, M.sand], 0, 0, 0, world, { cast: false });
}
// headlands: the sugarloaf (left), its little brother, and the right hand dome
const dome = (x, z, r, h, mat = M.rock, ry = 0) => { const m = add(new THREE.SphereGeometry(1, 36, 24), mat, x, 0, z, world, { cast: true }); m.scale.set(r, h, r * 0.9); m.rotation.y = ry; return m; };
const LOAF = [-44, 6];
dome(LOAF[0], LOAF[1], 22, 74); dome(-74, -4, 19, 34, M.rock); dome(46, 8, 22, 40, M.rock); dome(70, -2, 18, 26, M.jungle);
// jungle cap on domes
for (const [x, z, r, h] of [[-74, -4, 19.4, 22], [46, 8, 22.4, 28], [LOAF[0], LOAF[1], 14, 76]]) { const m = add(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), M.jungle, x, h * (x === LOAF[0] ? 0.0 : 0.0), z, world, { cast: false }); m.scale.set(r, h, r * 0.9); m.visible = x !== LOAF[0]; }
// islands in the bay and outside
for (const [x, z, r, h] of [[-60, -120, 16, 9], [40, -200, 24, 12], [-20, -260, 12, 7], [90, -110, 10, 8], [-110, 120, 30, 26], [130, 160, 20, 18], [0, 260, 16, 12]]) { const m = add(new THREE.SphereGeometry(1, 20, 12), M.jungle, x, 0, z, world, { cast: false }); m.scale.set(r, h, r); }
// mountain ring behind the bay
for (let i = 0; i < 26; i++) { const a = rx(200 + i * 5.8), d = 260 + rngW() * 80, h = 50 + rngW() * 90, r = 40 + rngW() * 40;
  const x = BAY.cx + Math.cos(a) * d * 1.3, z = BAY.cz + Math.sin(a) * d; const m = add(new THREE.ConeGeometry(r, h, 8), i % 3 ? M.mount : M.hill, x, LAND + h / 2 - 2, z, world, { cast: false }); m.rotation.y = rngW() * 3; }
for (let i = 0; i < 18; i++) { const a = rx(190 + i * 9), d = 600 + rngW() * 200, h = 120 + rngW() * 140; add(new THREE.ConeGeometry(110 + rngW() * 60, h, 7), M.mountFar, Math.cos(a) * d, h / 2 - 5, BAY.cz + Math.sin(a) * d * 0.8, world, { cast: false }); }
// the corcovado-like peak
{ const m = add(new THREE.ConeGeometry(34, 120, 9), M.mount, -150, LAND + 58, -150, world, { cast: false }); m.scale.set(1, 1, 0.7); }
// jungle trees along the coast (instanced blobs)
{
  const geo = new THREE.SphereGeometry(1, 10, 8), N = 900, inst = new THREE.InstancedMesh(geo, M.tree, N), inst2 = new THREE.InstancedMesh(geo, M.tree2, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0, k2 = 0;
  for (let i = 0; i < 4000 && (k < N || k2 < N); i++) {
    const x = (rngW() - 0.5) * 700, z = 30 - rngW() * 640;
    const e = ((x - BAY.cx) / BAY.rx) ** 2 + ((z - BAY.cz) / BAY.rz) ** 2; if (e < 1.12) continue; if (Math.abs(x) < MOUTH + 6 && z > -25) continue;
    const r = 3 + rngW() * 4; p.set(x, LAND + r * 0.5, z); s.set(r, r * 0.8, r); m4.compose(p, q, s);
    if (i % 2 && k < N) inst.setMatrixAt(k++, m4); else if (k2 < N) inst2.setMatrixAt(k2++, m4);
  }
  inst.count = k; inst2.count = k2; inst.castShadow = inst2.castShadow = true; inst.receiveShadow = inst2.receiveShadow = true; world.add(inst); world.add(inst2);
}
// the giant doors at the mouth (gag) + the giant pool ladder
const doors = [];
for (const s of [-1, 1]) {
  const hinge = new THREE.Group(); hinge.position.set(s * (MOUTH + 1), 0, 14); world.add(hinge);
  const d = add(tbox(MOUTH + 2, 30, 1.4, 6), M.door, -s * (MOUTH + 2) / 2, 15, 0, hinge);
  add(new THREE.CylinderGeometry(0.9, 0.9, 32, 10), M.darkWood, 0, 15, 0, hinge);
  const knob = add(new THREE.SphereGeometry(1.4, 12, 8), M.yellow, -s * (MOUTH - 2), 15, 1.2, hinge);
  hinge.userData.s = s; doors.push(hinge);
}
const ladder = new THREE.Group(); ladder.position.set(-31, LAND, 28); ladder.rotation.y = Math.PI / 2; world.add(ladder);
for (const s of [-1, 1]) { const arc = add(new THREE.TorusGeometry(4, 0.45, 8, 24, Math.PI), M.chrome, s * 3.5, 10, 0, ladder); arc.rotation.y = Math.PI / 2; add(new THREE.CylinderGeometry(0.45, 0.45, 10, 8), M.chrome, s * 3.5, 5, -4, ladder); add(new THREE.CylinderGeometry(0.45, 0.45, 16, 8), M.chrome, s * 3.5, 2, 4, ladder); }
for (let i = 0; i < 4; i++) add(tbox(7, 0.5, 1.6, 2), M.chrome, 0, 8 - i * 3.2, 4.4, ladder);
ladder.userData.p0 = ladder.position.clone();

// ---------- the caravel ----------
const ship = new THREE.Group(); scene.add(ship);
const DECKH = 3;
{
  const sh = new THREE.Shape(); // top-view outline (x, -z) with the bow at z = -12
  const hp = [[-3.4, 11], [3.4, 11], [3.6, 2], [3.2, -6], [1.8, -10.5], [0, -12.5], [-1.8, -10.5], [-3.2, -6], [-3.6, 2]];
  sh.moveTo(hp[0][0], -hp[0][1]); for (const [x, z] of hp.slice(1)) sh.lineTo(x, -z);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: DECKH + 1.2, bevelEnabled: false, curveSegments: 1 }); hull.rotateX(-Math.PI / 2); hull.translate(0, -1.2, 0); planarUV(hull, 3, 'zy');
  add(hull, [M.plank, M.hull], 0, 0, 0, ship);
  const deckG = new THREE.ShapeGeometry(sh); deckG.rotateX(-Math.PI / 2); planarUV(deckG, 2.5);
  add(deckG, M.plank, 0, DECKH + 0.01, 0, ship, { cast: false });
  // gunwale rails
  for (let i = 0; i < hp.length; i++) { const a = hp[i], b = hp[(i + 1) % hp.length]; if (i === 0) continue; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const r = add(tbox(0.3, 0.7, L + 0.2, 1), M.hull, (a[0] + b[0]) / 2, DECKH + 0.35, (a[1] + b[1]) / 2, ship); r.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); }
  // stern castle
  add(tbox(7.0, 2.2, 4.6, 2), M.hull, 0, DECKH + 1.1, 8.8, ship);
  add(tbox(7.2, 0.2, 4.8, 2), M.plank, 0, DECKH + 2.25, 8.8, ship);
  for (const s of [-1, 1]) add(box(0.9, 1.3, 0.1), M.darkWood, s * 1.6, DECKH + 0.95, 6.47, ship, { cast: false });
  add(box(1.0, 1.7, 0.1), M.darkWood, 0, DECKH + 0.85, 6.47, ship, { cast: false });
  // forecastle
  add(tbox(4.6, 1.6, 3.2, 2), M.hull, 0, DECKH + 0.8, -8.6, ship);
  // masts + yards + sails
  const mast = (z, h, sails) => {
    add(new THREE.CylinderGeometry(0.22, 0.3, h, 10), M.wood, 0, DECKH + h / 2, z, ship);
    for (const [y, w, hh] of sails) {
      add(new THREE.CylinderGeometry(0.12, 0.12, w + 0.6, 8), M.wood, 0, DECKH + y + hh / 2, z - 0.35, ship).rotation.z = Math.PI / 2;
      const g = new THREE.PlaneGeometry(w, hh, 10, 8), pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) / w * 2, v = pa.getY(i) / hh * 2; pa.setZ(i, -(1 - u * u) * (1 - 0.4 * v * v) * w * 0.12); }
      g.computeVertexNormals();
      const s = add(g, M.sail, 0, DECKH + y, z - 0.5, ship); s.userData.billow = pa.array.slice(); s.userData.w = w; s.userData.hh = hh; sailMeshes.push(s);
    }
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 10), M.wood, 0, DECKH + h - 0.6, z, ship); // crow's nest-ish
  };
  var sailMeshes = [];
  mast(-1, 18, [[6.2, 8.5, 6.5], [13.0, 6, 4.2]]);
  mast(-8, 13, [[6.0, 6, 5.0]]);
  mast(6.8, 11, []);
  // lateen sail on the mizzen
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 7.5, 3, 0, 1, 6], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0.5, 1, 1, 0.2], 2)); g.computeVertexNormals();
    add(g, M.sail, 0.15, DECKH + 2.5, 5.0, ship); }
  // bowsprit + ropes
  const bs = add(new THREE.CylinderGeometry(0.14, 0.2, 7, 8), M.wood, 0, DECKH + 1.6, -14.5, ship); bs.rotation.x = rx(70);
  const rope = (a, b) => { const v = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)), L = v.length(); const r = add(new THREE.CylinderGeometry(0.04, 0.04, L, 4), M.rope, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, ship, { cast: false }); r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); };
  for (const s of [-1, 1]) { rope([s * 3.4, DECKH + 0.6, -1], [0, DECKH + 17, -1]); rope([s * 3.4, DECKH + 0.6, 1.5], [0, DECKH + 16, -1]); rope([s * 3.2, DECKH + 0.6, -6], [0, DECKH + 12.5, -8]); }
  rope([0, DECKH + 17.5, -1], [0, DECKH + 4.5, -17.5]);
  // barrels + the map table
  for (const [x, z] of [[-2.6, -3.5], [-2.9, -2.4], [2.8, -4.4]]) add(new THREE.CylinderGeometry(0.45, 0.4, 1.0, 12), M.wood, x, DECKH + 0.5, z, ship);
  add(tbox(1.8, 0.12, 1.3, 1), M.darkWood, 1.9, DECKH + 0.95, 3.3, ship);
  for (const [dx, dz] of [[-0.8, -0.55], [0.8, -0.55], [-0.8, 0.55], [0.8, 0.55]]) add(box(0.1, 0.9, 0.1), M.darkWood, 1.9 + dx, DECKH + 0.45, 3.3 + dz, ship);
  ship.userData.sails = sailMeshes;
}
// the map (dynamic canvas) and the calendar page
const mapC = document.createElement('canvas'); mapC.width = 1024; mapC.height = 768; const mapT = P.tex(mapC); mapT.wrapS = mapT.wrapT = THREE.ClampToEdgeWrapping;
const mapMesh = add(new THREE.PlaneGeometry(1.6, 1.2), toon({ map: mapT }), 1.9, DECKH + 1.02, 3.3, ship, { cast: false }); mapMesh.rotation.x = -Math.PI / 2;
let mapKey = '';
const calT = P.tex(P2.calendar()); calT.wrapS = calT.wrapT = THREE.ClampToEdgeWrapping;
const cal = add(new THREE.PlaneGeometry(0.8, 1.0), toon({ map: calT }), 0, DECKH + 1.9, -0.64, ship, { cast: false });

// ---------- world: modern Rio street (+ the hidden river) at SO ----------
const city = new THREE.Group(); city.position.set(...SO); scene.add(city);
{
  // its own sea + beach + promenade
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700), mkWater(0.07, [0.05, -0.2])); s2.rotation.x = -Math.PI / 2; s2.position.set(0, 0, -380); s2.userData.nd = waterNd; city.add(s2);
  const beach = add(tbox(1400, G, 34, 10), M.sand, 0, G / 2 - 0.05, -21, city, { cast: false });
  const prom = add(planarUV(new THREE.PlaneGeometry(1400, 5), 5, 'xy'), M.waves, 0, G + 0.01, -1.5, city, { cast: false }); prom.rotation.x = -Math.PI / 2;
  // road slab with the manhole hole at MH (x, z): 1 m square
  const R0 = 1, R1 = 9, hz = 0.5;
  const road = (x0, x1, z0, z1) => { const g = tbox(x1 - x0, 1, z1 - z0, 6); const m = add(g, M.asphalt, (x0 + x1) / 2, G - 0.5, (z0 + z1) / 2, city, { cast: false }); return m; };
  road(-700, MH[0] - hz, R0, R1); road(MH[0] + hz, 700, R0, R1); road(MH[0] - hz, MH[0] + hz, R0, MH[1] - hz); road(MH[0] - hz, MH[0] + hz, MH[1] + hz, R1);
  for (let x = -60; x < 60; x += 6) add(box(3, 0.02, 0.18), M.yellow, x, G + 0.012, 5.6, city, { cast: false }); // dashed centre line
  add(tbox(1400, 0.25, 0.3, 2), M.concrete, 0, G + 0.12, 1.0, city); // kerb
  add(tbox(1400, G + 0.2, 4, 4), M.concrete, 0, (G + 0.2) / 2, 11, city, { cast: false }); // far sidewalk
  // buildings
  const rb = P.rng(71);
  for (let x = -200; x < 200; x += 0) { const w = 10 + rb() * 10, h = 14 + rb() * 34, d = 14; add(tbox(w, h, d, 8), M.facades[(Math.abs(x) * 7 | 0) % 6], x + w / 2, h / 2, 13 + d / 2 + rb() * 3, city); add(tbox(w + 0.6, 0.8, d + 0.6, 4), M.concrete, x + w / 2, h + 0.4, 13 + d / 2, city); x += w + 0.6; }
  // palms on the promenade
  const palm = (x, z, h = 7) => { const g = new THREE.Group(); g.position.set(x, G, z); city.add(g);
    const tr = add(new THREE.CylinderGeometry(0.16, 0.26, h, 7), M.trunk, 0, h / 2, 0, g); tr.rotation.z = 0.07;
    for (let k = 0; k < 7; k++) { const f = add(new THREE.ConeGeometry(0.45, 3.6, 4), M.palm, 0, h, 0, g); f.geometry = f.geometry.clone(); f.geometry.translate(0, 1.8, 0); f.rotation.set(rx(70), k * 0.9, 0, 'YXZ'); f.scale.set(1, 1, 0.25); }
    palms.push(g); return g; };
  var palms = []; city.userData.palms = palms;
  for (let x = -90; x < 90; x += 11) palm(x + (x % 3), -3.2, 6.5 + ((x * 13) % 3));
  // backdrop: the sugarloaf across the water, hills, islands
  const cdome = (x, z, r, h, mat) => { const m = add(new THREE.SphereGeometry(1, 36, 24), mat, x, 0, z, city, { cast: false }); m.scale.set(r, h, r * 0.9); return m; };
  cdome(-150, -430, 40, 150, M.rock); cdome(-215, -410, 34, 70, M.rock); cdome(-60, -520, 60, 50, M.jungle); cdome(140, -480, 70, 90, M.jungle); cdome(260, -560, 90, 130, M.hill); cdome(40, -300, 18, 12, M.jungle);
  for (let i = 0; i < 10; i++) add(new THREE.ConeGeometry(120, 160 + i * 10, 7), M.mountFar, -500 + i * 110, 70, -700 - (i % 3) * 60, city, { cast: false });
  // manhole cover
  const cover = add(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 24), M.iron, MH[0], G + 0.03, MH[1], city); city.userData.cover = cover;
  // the tunnel + the Carioca river (under the road)
  const TZ = MH[1], FL = G - 7, CE = G - 1;
  add(tbox(140, 0.4, 7, 3), M.bricks, 0, CE - 0.2, TZ, city).visible = true; // ceiling under slab (has the same hole? no: offset below)
  for (const s of [-1, 1]) add(tbox(140, CE - FL, 0.5, 3), M.bricks, 0, (CE + FL) / 2, TZ + s * 3.5, city);
  for (const s of [-1, 1]) add(tbox(0.5, CE - FL, 7, 3), M.tunnelDark, s * 70, (CE + FL) / 2, TZ, city);
  for (const s of [-1, 1]) add(tbox(140, 1.0, 1.6, 2), M.stone, 0, FL + 0.5, TZ + s * 2.45, city); // walkways
  add(tbox(140, 0.3, 7, 3), M.stone, 0, FL - 0.15, TZ, city);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(140, 3.3), mkWater(0.35, [-1.6, 0])); river.rotation.x = -Math.PI / 2; river.position.set(0, FL + 0.55, TZ); river.userData.nd = waterNd; city.add(river);
  // arches every 8 m
  for (let x = -64; x <= 64; x += 8) for (const s of [-1, 1]) add(tbox(0.7, CE - FL, 0.6, 2), M.stone, x, (CE + FL) / 2, TZ + s * 3.1, city);
  // shaft lining around the hole through slab + ceiling
  for (const [dx, dz, w, d] of [[-0.55, 0, 0.1, 1.2], [0.55, 0, 0.1, 1.2], [0, -0.55, 1.2, 0.1], [0, 0.55, 1.2, 0.1]]) add(tbox(w, 1.5, d, 1), M.bricks, MH[0] + dx, G - 0.75 - 0.05, MH[1] + dz, city);
  for (let i = 0; i < 5; i++) add(box(0.7, 0.06, 0.06), M.iron, MH[0], G - 1.2 - i * 0.55, MH[1] - 0.42, city); // rungs
}
// cut the ceiling hole: replace the solid ceiling with 4 pieces
{
  const TZ = MH[1], CE = G - 1;
  const ceil = city.children.find((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.width === 140 && c.geometry.parameters.height === 0.4);
  if (ceil) { city.remove(ceil);
    const piece = (x0, x1, z0, z1) => add(tbox(x1 - x0, 0.4, z1 - z0, 3), M.bricks, (x0 + x1) / 2, CE - 0.2, (z0 + z1) / 2, city);
    piece(-70, MH[0] - 0.5, TZ - 3.5, TZ + 3.5); piece(MH[0] + 0.5, 70, TZ - 3.5, TZ + 3.5); piece(MH[0] - 0.5, MH[0] + 0.5, TZ - 3.5, MH[1] - 0.5); piece(MH[0] - 0.5, MH[0] + 0.5, MH[1] + 0.5, TZ + 3.5); }
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
  // ship pose
  ship.position.set(...S.ship); ship.rotation.set(S.shipPitch || 0, 0, S.shipRoll || 0);
  for (const s of ship.userData.sails) { const pa = s.geometry.attributes.position, b = s.userData.billow; for (let i = 0; i < pa.count; i++) pa.setZ(i, b[i * 3 + 2] * (1 + 0.08 * Math.sin(f * 0.15 + b[i * 3] * 0.6))); pa.needsUpdate = true; }
  // map
  const mk = `${S.mapProg.toFixed(3)}|${S.mapSeal.toFixed(2)}|${S.mapAge.toFixed(2)}`;
  if (mk !== mapKey) { mapKey = mk; P2.drawMap(mapC, S.mapProg, S.mapSeal, S.mapAge); mapT.needsUpdate = true; }
  // gags
  doors.forEach((d) => { d.visible = S.doors > 0.001; d.scale.set(1, Math.max(0.001, S.doors), 1); d.rotation.y = d.userData.s * rx(-75) * Math.min(1, S.doorsOpen); });
  ladder.visible = S.ladder > 0.001; ladder.scale.setScalar(Math.max(0.001, S.ladder) * 1.6); ladder.position.copy(ladder.userData.p0);
  // city
  city.userData.cover.position.set(MH[0] + S.cover * 1.25, G + 0.03 + Math.sin(Math.min(1, S.cover) * Math.PI) * 0.05, MH[1] + S.cover * 0.3);
  city.userData.palms.forEach((p, i) => { p.rotation.z = 0.03 * Math.sin(f * 0.06 + i); });
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

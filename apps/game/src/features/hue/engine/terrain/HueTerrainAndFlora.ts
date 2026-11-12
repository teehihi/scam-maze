import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  fbm2D,
  getCanalCenterX,
  getCanalHalfWidth,
  getPathFactor,
  getRiverCenterZ,
  getRiverHalfWidth,
  getTerrainHeight,
  getTuDucLakeFactor,
  smoothstep,
  WORLD_SIZE,
} from '../../world/hueWorldConfig';
import {
  applyHueSurface,
  ensureSharedBakes,
  groundSet,
  HUE_NOISE_GLSL,
  HUE_SHARED,
  isBuiltUp,
  photoSet,
} from '../materials/HueSurface';

export interface TerrainAndFloraResult {
  group: THREE.Group;
  updateWind: (elapsed: number) => void;
  setRainWetness: (wetness: number) => void;
  updateCamera: (camPos: THREE.Vector3) => void;
  /**
   * Hides the grass blades inside an oriented box on the ground (the car), so they do not poke
   * through the floor into the cabin. `yaw` is the Three.js Y rotation; zero half sizes disable it.
   */
  setGrassExclusion: (x: number, z: number, yaw: number, halfWidth: number, halfLength: number) => void;
  dispose: () => void;
}

function fract(v: number) {
  return v - Math.floor(v);
}
const rand = (idx: number, salt: number) => fract(Math.sin(idx * 127.1 + salt * 311.7) * 43758.5453);
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isClearedForArchitecture(x: number, z: number): boolean {
  if (Math.abs(z - getRiverCenterZ(x)) < getRiverHalfWidth(x) + 4.0) return true;
  if (z > getRiverCenterZ(x) + 10 && Math.abs(x - getCanalCenterX(z)) < getCanalHalfWidth() + 3.8) return true;
  if (getPathFactor(x, z) > 0.22) return true;
  if (x > -250 && x < -165 && z > -168 && z < -35) return true;
  if (x > -66 && x < -24 && z > -126 && z < -90) return true;
  if (Math.abs(x - 195) < 17 && Math.abs(z) < 92) return true;
  if (x > 228 && x < 294 && z > 188 && z < 240) return true;
  if (getTuDucLakeFactor(x, z) > 0.06) return true;
  if (x > -148 && x < -26 && z > 132 && z < 208) return true;
  if (Math.hypot(x + 220, z - 94) < 12) return true;
  if (x > 8 && x < 72 && z > 234 && z < 382) return true;
  return false;
}

/** Ground layer weights driven by geology & use: laterite on slopes/hills, litter under pines, mud at waterline, worn paths. */
function groundWeights(x: number, z: number) {
  const y = getTerrainHeight(x, z);
  const hx = getTerrainHeight(x + 1.5, z);
  const hz = getTerrainHeight(x, z + 1.5);
  const slope = Math.hypot(hx - y, hz - y) / 1.5;
  const n = fbm2D(x * 0.03, z * 0.03, 3) * 0.5 + 0.5;
  const n2 = fbm2D(x * 0.11 + 40, z * 0.11 - 13, 3) * 0.5 + 0.5;
  let lat = smoothstep(0.45, 0.95, slope) * 0.75 + smoothstep(0.74, 0.88, n2) * smoothstep(3, 9, y) * 0.5;
  const forest = Math.min(0.55, smoothstep(105, 195, z) * 0.5 + smoothstep(12, 24, y) * 0.3) * smoothstep(0.35, 0.7, n);
  const lakeBasin = getTuDucLakeFactor(x, z) > 0.15 && y < 4.8;
  let mud = 1 - smoothstep(0.35, 1.6 + n2 * 0.8, y);
  if (lakeBasin) mud = Math.max(mud, 1 - smoothstep(3.6, 4.9, y));
  let path = smoothstep(0.08, 0.6, getPathFactor(x, z));
  // trampled verges beside paths expose soil
  lat = Math.max(lat, smoothstep(0.05, 0.22, getPathFactor(x, z)) * 0.3 * (1 - path));
  if (isBuiltUp(x, z)) path = Math.max(path, 0.6);
  const sum = lat + forest + mud + path;
  const grass = Math.max(0, 1 - sum);
  return { y, lat: Math.min(1, lat), forest: Math.min(1, forest), mud: Math.min(1, mud), path: Math.min(1, path), grass };
}

// ---------------------------------------------------------------------------
// Canvas-painted foliage atlases (alpha cut-outs)
// ---------------------------------------------------------------------------
type LeafKind = 'broad' | 'needle' | 'phuong' | 'frangi' | 'reed';
function makeFoliageTexture(kind: LeafKind): THREE.CanvasTexture {
  const W = kind === 'reed' ? 256 : 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const r = mulberry(kind.length * 977 + 13);
  const hsl = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`;

  const leaf = (x: number, y: number, len: number, wid: number, ang: number, col: string, rib = true) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(wid, len * 0.25, wid * 0.8, len * 0.75, 0, len);
    g.bezierCurveTo(-wid * 0.8, len * 0.75, -wid, len * 0.25, 0, 0);
    g.fill();
    if (rib) {
      g.strokeStyle = 'rgba(20,30,10,0.35)';
      g.lineWidth = Math.max(1, wid * 0.08);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, len * 0.95);
      g.stroke();
    }
    g.restore();
  };

  if (kind === 'reed') {
    for (let i = 0; i < 46; i++) {
      const x0 = W * (0.1 + r() * 0.8);
      const h = H * (0.45 + r() * 0.55);
      const bend = (r() - 0.5) * W * 0.5;
      g.strokeStyle = hsl(70 + r() * 30, 30 + r() * 25, 22 + r() * 22);
      g.lineWidth = 2 + r() * 3;
      g.beginPath();
      g.moveTo(x0, H);
      g.quadraticCurveTo(x0 + bend * 0.3, H - h * 0.6, x0 + bend, H - h);
      g.stroke();
    }
  } else if (kind === 'needle') {
    g.fillStyle = 'rgba(0,0,0,0)';
    for (let k = 0; k < 42; k++) {
      const cx = W * (0.12 + r() * 0.76);
      const cy = H * (0.12 + r() * 0.76);
      const n = 40 + Math.floor(r() * 24);
      g.fillStyle = hsl(100, 30, 15);
      g.beginPath(); g.ellipse(cx, cy, 20, 15, r()*3, 0, Math.PI*2); g.fill();
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const L = 22 + r() * 40;
        g.strokeStyle = hsl(95 + r() * 25, 28 + r() * 20, 16 + r() * 16);
        g.lineWidth = 3.2 + r() * 2.2;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L * 0.8);
        g.stroke();
      }
    }
  } else {
    const count = kind === 'frangi' ? 26 : 150;
    for (let i = 0; i < count; i++) {
      const x = W * (0.1 + r() * 0.8);
      const y = H * (0.1 + r() * 0.8);
      const s = kind === 'frangi' ? 1.0 + r() * 0.5 : 0.6 + r() * 0.6;
      const len = (kind === 'frangi' ? 120 : 46) * s;
      const wid = (kind === 'frangi' ? 30 : 17) * s;
      const ang = r() * Math.PI * 2;
      let h = 88 + r() * 30;
      let sat = 35 + r() * 25;
      let l = 18 + r() * 20;
      if (kind === 'phuong' && r() < 0.62) {
        h = 2 + r() * 14;
        sat = 70 + r() * 20;
        l = 34 + r() * 14;
      }
      if (r() < 0.06 && kind !== 'phuong') {
        h = 48 + r() * 12;
        sat = 45;
        l = 34; // ageing yellow leaf
      }
      leaf(x, y, len, wid, ang, hsl(h, sat, l), kind !== 'phuong');
    }
    if (kind === 'frangi') {
      for (let i = 0; i < 9; i++) {
        const fx = W * (0.25 + r() * 0.5);
        const fy = H * (0.25 + r() * 0.5);
        for (let p = 0; p < 5; p++) leaf(fx, fy, 22, 11, (p / 5) * Math.PI * 2 + r() * 0.3, hsl(45, 30, 94), false);
        g.fillStyle = hsl(46, 90, 60);
        g.beginPath();
        g.arc(fx, fy, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  return t;
}

// ---------------------------------------------------------------------------
// Procedural tree builder: tapered branch tubes + leaf-card clumps
// ---------------------------------------------------------------------------
function taperedTube(pts: THREE.Vector3[], r0: number, r1: number, radial = 6): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = Math.max(3, pts.length * 2);
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const rr = THREE.MathUtils.lerp(r0, r1, Math.pow(i / segs, 0.8));
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(rr).add(c);
      p.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.deleteAttribute('uv');
  return geo;
}

interface Clump {
  c: THREE.Vector3;
  r: number;
  flat?: number;
}

function leafCards(clumps: Clump[], cards: number, size: number, center: THREE.Vector3, rnd: () => number, horiz = 0): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const corners = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [0.5, 0.5, 1, 1],
    [-0.5, 0.5, 0, 1],
  ];
  let vi = 0;
  for (const cl of clumps) {
    for (let k = 0; k < cards; k++) {
      const u = rnd() * Math.PI * 2;
      const vv = Math.acos(2 * rnd() - 1);
      const rr = Math.cbrt(rnd()) * cl.r;
      const p = new THREE.Vector3(
        Math.sin(vv) * Math.cos(u) * rr,
        Math.cos(vv) * rr * (cl.flat ?? 0.75),
        Math.sin(vv) * Math.sin(u) * rr,
      ).add(cl.c);
      if (horiz > 0 && rnd() < horiz) e.set(-Math.PI / 2 + (rnd() - 0.5) * 0.9, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.6, 'YXZ');
      else e.set((rnd() - 0.5) * Math.PI, rnd() * Math.PI * 2, (rnd() - 0.5) * Math.PI, 'YXZ');
      q.setFromEuler(e);
      const s = size * (0.75 + rnd() * 0.5);
      const radial = p.clone().sub(center).normalize();
      const fn = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      if (fn.dot(radial) < 0) fn.negate();
      const n = fn.multiplyScalar(0.25).add(radial.multiplyScalar(0.75)).add(new THREE.Vector3(0, 0.25, 0)).normalize();
      for (const [cx, cy, tu, tv] of corners) {
        const o = new THREE.Vector3(cx * s, cy * s, 0).applyQuaternion(q).add(p);
        pos.push(o.x, o.y, o.z);
        nor.push(n.x, n.y, n.z);
        uv.push(tu, tv);
      }
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

type Species = 'pine' | 'broad' | 'frangi';
function buildTreeGeometry(sp: Species, seed: number): { wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry } {
  const rnd = mulberry(seed);
  const wood: THREE.BufferGeometry[] = [];
  const clumps: Clump[] = [];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  if (sp === 'pine') {
    const H = 12 + rnd() * 3;
    const lx = (rnd() - 0.5) * 1.4;
    const lz = (rnd() - 0.5) * 1.4;
    const trunk = [V(0, -0.3, 0), V(lx * 0.15, H * 0.3, lz * 0.1), V(lx * 0.55, H * 0.65, lz * 0.5), V(lx, H, lz)];
    wood.push(taperedTube(trunk, 0.3, 0.06, 8));
    const tc = new THREE.CatmullRomCurve3(trunk);
    const nb = 7 + Math.floor(rnd() * 3);
    for (let k = 0; k < nb; k++) {
      const t = 0.58 + (k / nb) * 0.4;
      const base = tc.getPointAt(t);
      const a = k * 2.399 + rnd() * 0.5;
      const L = (3.2 - (k / nb) * 1.6) * (0.8 + rnd() * 0.4);
      const dir = V(Math.cos(a), 0.25 + rnd() * 0.25, Math.sin(a));
      const mid = base.clone().addScaledVector(dir, L * 0.5);
      const end = base.clone().addScaledVector(dir, L).add(V(0, 0.5, 0));
      wood.push(taperedTube([base, mid, end], 0.1, 0.025, 5));
      clumps.push({ c: end, r: 1.15 + rnd() * 0.4, flat: 0.42 });
      clumps.push({ c: mid.clone().add(V(0, 0.3, 0)), r: 0.8, flat: 0.45 });
    }
    clumps.push({ c: tc.getPointAt(1).add(V(0, 0.2, 0)), r: 1.4, flat: 0.5 });
    const leaves = leafCards(clumps, 24, 1.35, tc.getPointAt(0.85), rnd, 0.7);
    return { wood: mergeGeometries(wood)!, leaves };
  }

  if (sp === 'broad') {
    const T = 2.6 + rnd() * 0.8;
    wood.push(taperedTube([V(0, -0.3, 0), V(0.1, T * 0.5, 0), V(0, T, 0.1)], 0.34, 0.24, 8));
    const nl = 3 + Math.floor(rnd() * 2);
    for (let i = 0; i < nl; i++) {
      const a = (i / nl) * Math.PI * 2 + rnd() * 0.6;
      const d = V(Math.cos(a), 0, Math.sin(a));
      const p0 = V(0, T, 0.1);
      const p1 = p0.clone().addScaledVector(d, 1.3).add(V(0, 1.3, 0));
      const p2 = p0.clone().addScaledVector(d, 2.6).add(V(0, 2.2 + rnd(), 0));
      wood.push(taperedTube([p0, p1, p2], 0.2, 0.08, 6));
      for (let j = 0; j < 2; j++) {
        const a2 = a + (j - 0.5) * 1.1;
        const d2 = V(Math.cos(a2), 0.5, Math.sin(a2));
        const q2 = p2.clone().addScaledVector(d2, 1.6 + rnd());
        wood.push(taperedTube([p2, p2.clone().lerp(q2, 0.5).add(V(0, 0.2, 0)), q2], 0.08, 0.03, 5));
        clumps.push({ c: q2.clone().add(V(0, 0.4, 0)), r: 1.7 + rnd() * 0.5, flat: 0.65 });
      }
      clumps.push({ c: p2.clone().add(V(0, 0.2, 0)), r: 1.4, flat: 0.7 });
    }
    clumps.push({ c: V(0, T + 3.6, 0), r: 2.0, flat: 0.6 });
    const leaves = leafCards(clumps, 34, 1.2, V(0, T + 2.6, 0), rnd);
    return { wood: mergeGeometries(wood)!, leaves };
  }

  // Frangipani (cây đại): thick grey limbs forking dichotomously, rosettes at blunt tips
  const grow = (p: THREE.Vector3, d: THREE.Vector3, r: number, depth: number) => {
    const L = 0.9 + rnd() * 0.5;
    const e = p.clone().addScaledVector(d, L);
    wood.push(taperedTube([p, p.clone().lerp(e, 0.5).add(V(0, 0.08, 0)), e], r, r * 0.78, 6));
    if (depth === 0) {
      clumps.push({ c: e.clone().add(V(0, 0.35, 0)), r: 0.75, flat: 0.55 });
      return;
    }
    for (const s of [-1, 1]) {
      const nd = d.clone().applyAxisAngle(V(0, 1, 0), s * (0.7 + rnd() * 0.5)).add(V((rnd() - 0.5) * 0.4, 0.35, 0)).normalize();
      grow(e, nd, r * 0.75, depth - 1);
    }
  };
  wood.push(taperedTube([V(0, -0.3, 0), V(0.05, 0.8, 0), V(0, 1.5, 0)], 0.26, 0.22, 8));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rnd();
    grow(V(0, 1.5, 0), V(Math.cos(a) * 0.7, 0.75, Math.sin(a) * 0.7).normalize(), 0.16, 3);
  }
  const leaves = leafCards(clumps, 7, 0.95, V(0, 3.2, 0), rnd, 0.5);
  return { wood: mergeGeometries(wood)!, leaves };
}

function makeLeafMaterial(map: THREE.Texture, sway: number, trans = 0.35): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map,
    alphaTest: 0.42,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0,
  });
  m.customProgramCacheKey = () => 'hue-leaf';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, HUE_SHARED, { hSway: { value: sway }, hTrans: { value: trans } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float hTime; uniform float hSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x*0.13 + instanceMatrix[3].z*0.17;
        #endif
        float hm = max(position.y - 1.0, 0.0);
        float gust = sin(hTime*1.1+ph)*0.6 + sin(hTime*2.7+ph*1.7)*0.3 + sin(hTime*0.37+ph*0.3)*0.5;
        transformed.x += gust*hSway*hm*0.025;
        transformed.z += cos(hTime*0.9+ph)*hSway*hm*0.018;
        transformed += normal * sin(hTime*7.0 + position.x*4.0 + position.z*3.0 + ph) * 0.025 * hSway;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 hSunDir; uniform vec3 hSunColor; uniform float hTrans;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      .replace(
        '#include <opaque_fragment>',
        `vec3 sunV = normalize((viewMatrix*vec4(hSunDir,0.0)).xyz);
         float bl = pow(max(dot(-normalize(vViewPosition), sunV), 0.0), 4.0);
         outgoingLight += diffuseColor.rgb * hSunColor * (bl*1.6 + 0.12) * hTrans * max(hSunDir.y*2.0, 0.15);
         #include <opaque_fragment>`,
      );
  };
  return m;
}

export function buildHueTerrainAndFlora(): TerrainAndFloraResult {
  ensureSharedBakes();
  const root = new THREE.Group();
  root.name = 'HueTerrainAndFlora';

  // -------------------------------------------------------------------------
  // 1. Terrain with 5-layer photo-scanned splat shader (high-definition 256 grid)
  // -------------------------------------------------------------------------
  const segs = 256;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
  geo.rotateX(-Math.PI * 0.5);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const splat = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const w = groundWeights(pos.getX(i), pos.getZ(i));
    pos.setY(i, w.y);
    splat[i * 4] = w.lat;
    splat[i * 4 + 1] = w.path;
    splat[i * 4 + 2] = w.mud;
    splat[i * 4 + 3] = w.forest;
  }
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.computeVertexNormals();

  const layers = (['grass', 'laterite', 'path', 'mud', 'forest'] as const).map((k) => groundSet(k));
  const terrainMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  terrainMat.customProgramCacheKey = () => 'hue-terrain';
  terrainMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, HUE_SHARED);
    layers.forEach((l, i) => {
      shader.uniforms['gC' + i] = { value: l.color };
      shader.uniforms['gN' + i] = { value: l.normal };
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vTW; varying vec3 vTN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat; vTW = (modelMatrix*vec4(transformed,1.0)).xyz; vTN = normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec4 vSplat; varying vec3 vTW; varying vec3 vTN;
        uniform sampler2D gC0,gC1,gC2,gC3,gC4,gN0,gN1,gN2,gN3,gN4;
        uniform sampler2D hTerrainH; uniform vec4 hTerrainRect; uniform float hWetness; uniform float hTime;
        ${HUE_NOISE_GLSL}
        vec4 antiTile(sampler2D t, vec2 uv){
          vec4 a = texture2D(t, uv);
          vec4 b = texture2D(t, uv*0.29 + vec2(0.37,0.71));
          float m = hNoise(uv*0.21);
          return mix(a, b, smoothstep(0.35,0.65,m)*0.55);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `
        vec2 wxz = vTW.xz;
        vec4 c0 = antiTile(gC0, wxz/2.4);
        vec4 c1 = antiTile(gC1, wxz/3.2);
        vec4 c2 = texture2D(gC2, wxz/2.6);
        vec4 c3 = texture2D(gC3, wxz/3.0);
        vec4 c4 = texture2D(gC4, wxz/2.8);
        float wl = clamp(vSplat.x,0.0,1.0), wp = clamp(vSplat.y,0.0,1.0), wm = clamp(vSplat.z,0.0,1.0), wf = clamp(vSplat.w,0.0,1.0);
        float wg = max(0.0, 1.0 - wl - wp - wm - wf);
        // break blend boundaries with noise, then height-blend (luminance as height proxy)
        float bn = hFbm(wxz*0.35)-0.5;
        wl = max(wl + bn*0.35*wl*(1.0-wl)*4.0, 0.0);
        float h0 = dot(c0.rgb, vec3(0.33)), h1 = dot(c1.rgb, vec3(0.33)), h2 = dot(c2.rgb, vec3(0.33)), h3 = dot(c3.rgb,vec3(0.33)), h4 = dot(c4.rgb,vec3(0.33));
        float s0 = wg + h0*0.5, s1 = wl + h1*0.5, s2 = wp + h2*0.5, s3 = wm + h3*0.5, s4 = wf + h4*0.5;
        float ma = max(max(max(s0,s1),max(s2,s3)),s4) - 0.18;
        float b0 = max(s0-ma,0.0)*step(0.001,wg), b1 = max(s1-ma,0.0)*step(0.001,wl), b2 = max(s2-ma,0.0)*step(0.001,wp), b3 = max(s3-ma,0.0)*step(0.001,wm), b4 = max(s4-ma,0.0)*step(0.001,wf);
        float bs = max(b0+b1+b2+b3+b4, 1e-4);
        b0/=bs; b1/=bs; b2/=bs; b3/=bs; b4/=bs;
        vec3 galb = c0.rgb;
        // macro hue drift: sun-scorched straw patches vs lush damp grass
        float dry = smoothstep(0.4, 0.75, hFbm(wxz*0.012 + 3.7));
        galb *= vec3(0.78, 1.0, 0.55);
        galb = mix(galb, galb*vec3(1.2,1.08,0.8), dry*0.3);
        galb *= 0.85 + 0.3*hFbm(wxz*0.05);
        vec3 alb = galb*b0 + c1.rgb*b1 + c2.rgb*b2 + c3.rgb*b3 + c4.rgb*b4;
        // waterline darkening & rain
        float wetBank = 1.0 - smoothstep(0.1, 1.2, vTW.y);
        float wet = clamp(max(wetBank*0.9, hWetness*0.8), 0.0, 1.0);
        alb *= mix(1.0, 0.58, wet);
        diffuseColor.rgb *= alb;
        float tRough = 0.95*b0 + 0.9*b1 + 0.85*b2 + 0.7*b3 + 0.92*b4;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        'float roughnessFactor = mix(tRough, 0.32, wet*0.8);',
      )
      .replace(
        '#include <normal_fragment_maps>',
        `{
          vec3 t0 = texture2D(gN0, wxz/2.4).xyz*2.0-1.0;
          vec3 t1 = texture2D(gN1, wxz/3.2).xyz*2.0-1.0;
          vec3 t2 = texture2D(gN2, wxz/2.6).xyz*2.0-1.0;
          vec3 t3 = texture2D(gN3, wxz/3.0).xyz*2.0-1.0;
          vec3 t4 = texture2D(gN4, wxz/2.8).xyz*2.0-1.0;
          vec3 tn = t0*b0 + t1*b1 + t2*b2*1.2 + t3*b3 + t4*b4;
          tn.xy *= mix(1.1, 0.4, wet);
          vec3 gN = normalize(vTN);
          vec3 wn = normalize(vec3(tn.x + gN.x, abs(tn.z)*gN.y, tn.y + gN.z));
          normal = normalize((viewMatrix*vec4(wn,0.0)).xyz);
        }`,
      );
  };
  const terrainMesh = new THREE.Mesh(geo, terrainMat);
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);

  // -------------------------------------------------------------------------
  // 2. Distant ranges (Ngự Bình, Trường Sơn foothills) — fbm ridgelines, forest-dark
  // -------------------------------------------------------------------------
  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x2c3d30, roughness: 0.97 });
  [560, 750].forEach((rad, ringIdx) => {
    const mGeo = new THREE.RingGeometry(rad - 55, rad + 185, 256, 8);
    mGeo.rotateX(-Math.PI * 0.5);
    const mp = mGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < mp.count; i++) {
      const mx = mp.getX(i);
      const mz = mp.getZ(i);
      const r = Math.hypot(mx, mz);
      const t = (r - (rad - 55)) / 240;
      const profile = Math.pow(Math.sin(Math.min(1, Math.max(0, t)) * Math.PI), 0.8);
      const ang = Math.atan2(mz, mx);
      const ridgeH =
        (ringIdx === 0 ? 46 : 92) +
        34 * Math.sin(ang * 5 + ringIdx) +
        20 * Math.cos(ang * 11 - 0.7) +
        26 * fbm2D(mx * 0.008, mz * 0.008, 5) +
        8 * fbm2D(mx * 0.03, mz * 0.03, 3);
      const riverGap = 1 - 0.62 * Math.exp(-Math.pow(Math.sin(ang), 2) * 8) * (mx > 0 ? 1 : 0.35);
      mp.setY(i, -6 + profile * Math.max(12, ridgeH) * riverGap);
    }
    mGeo.computeVertexNormals();
    root.add(new THREE.Mesh(mGeo, mountainMat));
  });

  // -------------------------------------------------------------------------
  // 3. Trees: branching wood with photo bark + alpha leaf-card canopies (instanced)
  // -------------------------------------------------------------------------
  const pineBarkMat = applyHueSurface(new THREE.MeshStandardMaterial(), {
    set: photoSet('pinebark'), scale: 1.2, saturation: 0.8, damp: 0.5, moss: 0.3, streaks: 0, macro: 0.4,
  });
  const barkMat = applyHueSurface(new THREE.MeshStandardMaterial(), {
    set: photoSet('bark'), scale: 1.4, saturation: 0.55, damp: 0.5, moss: 0.4, streaks: 0, macro: 0.4,
  });
  const frangiBarkMat = applyHueSurface(new THREE.MeshStandardMaterial(), {
    set: photoSet('bark'), scale: 1.0, saturation: 0.15, tint: new THREE.Color(1.45, 1.42, 1.35), damp: 0.4, moss: 0.4, streaks: 0, macro: 0.3,
  });
  const needleMat = makeLeafMaterial(makeFoliageTexture('needle'), 0.8, 0.25);
  needleMat.alphaTest = 0.3;
  const broadMat = makeLeafMaterial(makeFoliageTexture('broad'), 1.0, 0.45);
  const phuongMat = makeLeafMaterial(makeFoliageTexture('phuong'), 1.0, 0.45);
  const frangiMat = makeLeafMaterial(makeFoliageTexture('frangi'), 0.7, 0.4);

  const placeSpecies = (
    sp: Species,
    list: { x: number; z: number; s: number; rot: number }[],
    woodMat: THREE.Material,
    leafMat: THREE.Material,
    variants = 3,
  ) => {
    const byVar: (typeof list)[] = Array.from({ length: variants }, () => []);
    list.forEach((t, i) => byVar[i % variants].push(t));
    byVar.forEach((items, v) => {
      if (!items.length) return;
      const g = buildTreeGeometry(sp, 1000 + v * 77 + sp.length * 13);
      const wood = new THREE.InstancedMesh(g.wood, woodMat, items.length);
      const leaves = new THREE.InstancedMesh(g.leaves, leafMat, items.length);
      wood.castShadow = true;
      wood.receiveShadow = true;
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      leaves.userData.noAO = true;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const col = new THREE.Color();
      items.forEach((t, i) => {
        const y = getTerrainHeight(t.x, t.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot);
        m.compose(new THREE.Vector3(t.x, y, t.z), q, new THREE.Vector3(t.s, t.s * (0.92 + rand(i, 7) * 0.16), t.s));
        wood.setMatrixAt(i, m);
        leaves.setMatrixAt(i, m);
        const k = 0.82 + rand(i + v * 31, 9) * 0.36;
        col.setRGB(k * (0.95 + rand(i, 3) * 0.1), k, k * (0.9 + rand(i, 5) * 0.12));
        leaves.setColorAt(i, col);
      });
      wood.instanceMatrix.needsUpdate = true;
      leaves.instanceMatrix.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      wood.computeBoundingSphere();
      leaves.computeBoundingSphere();
      root.add(wood, leaves);
    });
  };

  // Thông Huế (restored lush density across Ngự Bình & hill slopes)
  const pines: { x: number; z: number; s: number; rot: number }[] = [];
  for (let i = 0; i < 800 && pines.length < 280; i++) {
    const x = (rand(i, 1) - 0.5) * 840;
    const z = (rand(i, 2) - 0.5) * 840;
    if (isClearedForArchitecture(x, z)) continue;
    const hillBias = z > 65 || (z < -125 && x < -120);
    if (!hillBias && rand(i, 3) > 0.24) continue;
    const y = getTerrainHeight(x, z);
    if (y < 2.0) continue;
    pines.push({ x, z, s: 0.82 + rand(i, 4) * 0.5, rot: rand(i, 5) * Math.PI * 2 });
  }
  placeSpecies('pine', pines, pineBarkMat, needleMat, 3);

  // Cây đại (frangipani) in pagoda & garden-house courtyards
  const frangiSpots: [number, number, number][] = [
    [-218, -96, 1.05], [-202, -96, 1.0], [-222, -79, 0.92], [-198, -79, 0.95], [-226, -108, 1.1],
    [-194, -108, 1.08], [-216, -64, 0.85], [-204, -64, 0.88], [-55, -102, 0.95], [-35, -102, 0.92], [-52, -118, 0.98],
  ];
  placeSpecies('frangi', frangiSpots.map(([x, z, s], i) => ({ x, z, s: s * 1.15, rot: i * 1.4 })), frangiBarkMat, frangiMat, 3);

  // Riverside broadleaf & flamboyant (phượng) trees
  const broad: { x: number; z: number; s: number; rot: number }[] = [];
  const phuong: { x: number; z: number; s: number; rot: number }[] = [];
  for (let i = 0; i < 200 && broad.length + phuong.length < 75; i++) {
    const x = -285 + (i / 200) * 590 + (rand(i, 12) - 0.5) * 16;
    const side = i % 2 === 0 ? -1 : 1;
    const z = getRiverCenterZ(x) + side * (getRiverHalfWidth(x) + 8 + rand(i, 13) * 18);
    if (isClearedForArchitecture(x, z)) continue;
    if (getTerrainHeight(x, z) < 1.2) continue;
    const t = { x, z, s: 0.85 + rand(i, 14) * 0.45, rot: rand(i, 15) * Math.PI * 2 };
    if (Math.abs(x - 195) < 105 && i % 3 === 0) phuong.push(t);
    else broad.push(t);
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const lx = -72 + Math.cos(a) * 52;
    const lz = 175 + Math.sin(a) * 34;
    if (!isClearedForArchitecture(lx, lz)) broad.push({ x: lx, z: lz, s: 0.95, rot: a });
  }
  placeSpecies('broad', broad, barkMat, broadMat, 3);
  placeSpecies('broad', phuong, barkMat, phuongMat, 2);

  // -------------------------------------------------------------------------
  // 4. Reeds & wild cogon-grass tufts (crossed alpha cards)
  // -------------------------------------------------------------------------
  // Car footprint where no grass or reeds grow: x, z, cos(yaw), sin(yaw) and half width / length
  const grassHole = { value: new THREE.Vector4(0, 0, 1, 0) };
  const grassHoleSize = { value: new THREE.Vector2(0, 0) };
  const reedTex = makeFoliageTexture('reed');
  const reedMat = makeLeafMaterial(reedTex, 1.4, 0.2);
  // Reed tufts are ~1.1 m wide cards: drop every tuft whose root lies under the car (plus margin).
  const REED_HOLE_MARGIN = 0.6;
  const leafCompile = reedMat.onBeforeCompile;
  reedMat.customProgramCacheKey = () => 'hue-reed';
  reedMat.onBeforeCompile = (shader, renderer) => {
    leafCompile.call(reedMat, shader, renderer);
    Object.assign(shader.uniforms, { hGrassHole: grassHole, hGrassHoleSize: grassHoleSize });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec4 hGrassHole; uniform vec2 hGrassHoleSize;')
      .replace(
        '#include <project_vertex>',
        `#ifdef USE_INSTANCING
          vec2 rd = instanceMatrix[3].xz - hGrassHole.xy;
          vec2 rl = vec2(rd.x*hGrassHole.z - rd.y*hGrassHole.w, rd.x*hGrassHole.w + rd.y*hGrassHole.z);
          vec2 rh = hGrassHoleSize + vec2(${REED_HOLE_MARGIN.toFixed(2)}) * step(0.001, hGrassHoleSize.x);
          if (abs(rl.x) < rh.x && abs(rl.y) < rh.y) transformed = vec3(0.0);
        #endif
        #include <project_vertex>`,
      );
  };
  reedMat.alphaTest = 0.35;
  const reedParts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const p = new THREE.PlaneGeometry(1.1, 1.8);
    p.translate(0, 0.9, 0);
    p.rotateY((k / 3) * Math.PI);
    const n = p.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    reedParts.push(p);
  }
  const reedGeo = mergeGeometries(reedParts)!;
  const reedM: THREE.Matrix4[] = [];
  const rm = new THREE.Matrix4();
  const rq = new THREE.Quaternion();
  for (let i = 0; i < 400; i++) {
    const x = (rand(i, 21) - 0.5) * 680;
    const side = i % 2 === 0 ? 1 : -1;
    const z = getRiverCenterZ(x) + side * (getRiverHalfWidth(x) - 1.5 + rand(i, 22) * 5.2);
    if (Math.abs(x + 210) < 12 && z < 0) continue;
    if (Math.abs(x - 195) < 12) continue;
    const y = getTerrainHeight(x, z);
    if (y < -0.25 || y > 1.7) continue;
    const sc = 0.7 + rand(i, 24) * 0.7;
    rq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(i, 23) * Math.PI * 2);
    reedM.push(rm.compose(new THREE.Vector3(x, y - 0.1, z), rq, new THREE.Vector3(sc, sc, sc)).clone());
  }
  for (let i = 0; i < 600; i++) {
    const x = (rand(i, 41) - 0.5) * 640;
    const z = (rand(i, 42) - 0.5) * 700;
    if (isClearedForArchitecture(x, z) || isBuiltUp(x, z)) continue;
    const y = getTerrainHeight(x, z);
    if (y < 1.3) continue;
    const sc = 0.4 + rand(i, 44) * 0.45;
    rq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(i, 43) * Math.PI * 2);
    reedM.push(rm.compose(new THREE.Vector3(x, y - 0.05, z), rq, new THREE.Vector3(sc * 1.2, sc * 0.7, sc * 1.2)).clone());
  }
  const reedInst = new THREE.InstancedMesh(reedGeo, reedMat, reedM.length);
  reedM.forEach((mm, i) => reedInst.setMatrixAt(i, mm));
  reedInst.instanceMatrix.needsUpdate = true;
  reedInst.receiveShadow = true;
  reedInst.userData.noAO = true;
  reedInst.computeBoundingSphere();
  root.add(reedInst);

  // -------------------------------------------------------------------------
  // 5. GPU grass field that travels with the visitor (real blades underfoot)
  // -------------------------------------------------------------------------
  const DRES = 256;
  const dens = new Uint8Array(DRES * DRES * 4);
  const half = WORLD_SIZE * 0.5;
  for (let j = 0; j < DRES; j++) {
    const z = -half + ((j + 0.5) / DRES) * WORLD_SIZE;
    for (let i = 0; i < DRES; i++) {
      const x = -half + ((i + 0.5) / DRES) * WORLD_SIZE;
      if (Math.abs(x) > 420 || Math.abs(z) > 420) continue;
      const w = groundWeights(x, z);
      let d = w.grass * 1.0 + w.lat * 0.25 + w.forest * 0.3;
      // Absolute suppression in courtyards, terraces, architectural zones & paved paths
      if (w.y < 0.5 || isBuiltUp(x, z) || isClearedForArchitecture(x, z)) d = 0;
      d *= 1 - smoothstep(0.05, 0.3, getPathFactor(x, z));
      dens[(j * DRES + i) * 4] = Math.round(Math.min(1, d) * 255);
      dens[(j * DRES + i) * 4 + 3] = 255;
    }
  }
  const densTex = new THREE.DataTexture(dens, DRES, DRES, THREE.RGBAFormat);
  densTex.magFilter = THREE.LinearFilter;
  densTex.minFilter = THREE.LinearFilter;
  densTex.needsUpdate = true;

  const BLADES = 5;
  const bPos: number[] = [];
  const bT: number[] = [];
  const bIdx: number[] = [];
  const br = mulberry(77);
  for (let b = 0; b < BLADES; b++) {
    const ox = (br() - 0.5) * 0.3;
    const oz = (br() - 0.5) * 0.3;
    const a = br() * Math.PI;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const lean = 0.12 + br() * 0.15;
    const w = 0.011 + br() * 0.008;
    const base = bPos.length / 3;
    const rows = [0, 0.45, 1];
    rows.forEach((t, ri) => {
      const ww = w * (1 - t * 0.85);
      const cx = ox + -sa * lean * t * t;
      const cz = oz + ca * lean * t * t;
      if (ri < 2) {
        bPos.push(cx - ca * ww, t, cz - sa * ww, cx + ca * ww, t, cz + sa * ww);
        bT.push(t, t);
      } else {
        bPos.push(cx, t, cz);
        bT.push(t);
      }
    });
    bIdx.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const grassGeo = new THREE.InstancedBufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  grassGeo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(bPos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  grassGeo.setAttribute('aT', new THREE.Float32BufferAttribute(bT, 1));
  grassGeo.setIndex(bIdx);
  const GR = 26;
  const COUNT = 28000;
  const offs = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    offs[i * 3] = (br() - 0.5) * GR * 2;
    offs[i * 3 + 1] = (br() - 0.5) * GR * 2;
    offs[i * 3 + 2] = br();
  }
  grassGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 3));
  grassGeo.instanceCount = COUNT;
  const grassCam = { value: new THREE.Vector3() };
  const grassMat = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide });
  grassMat.customProgramCacheKey = () => 'hue-grass';
  grassMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, HUE_SHARED, {
      hGrassCam: grassCam,
      hGrassD: { value: densTex },
      hGR: { value: GR },
      hGrassHole: grassHole,
      hGrassHoleSize: grassHoleSize,
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aOff; attribute float aT;
        uniform vec3 hGrassCam; uniform sampler2D hGrassD; uniform float hGR;
        uniform vec4 hGrassHole; uniform vec2 hGrassHoleSize;
        uniform sampler2D hTerrainH; uniform vec4 hTerrainRect; uniform float hTime; uniform float hWetness;
        varying vec3 vGCol;
        ${HUE_NOISE_GLSL}`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0,1.0,0.0);')
      .replace(
        '#include <begin_vertex>',
        `vec2 cam = hGrassCam.xz;
         vec2 wp = cam + mod(aOff.xy - cam + hGR, 2.0*hGR) - hGR;
         vec2 duv = (wp - hTerrainRect.xy)/hTerrainRect.z;
         float d = texture2D(hGrassD, duv).r;
         float patchN = hNoise(wp*0.35);
         float dist = length(wp - cam);
         float fade = 1.0 - smoothstep(hGR*0.55, hGR*0.97, dist);
         float keep = step(aOff.z, d*(0.55+0.6*patchN)) * fade;
         // no blades under the car: world -> car-local (inverse of the Y rotation)
         vec2 hd = wp - hGrassHole.xy;
         vec2 hl = vec2(hd.x*hGrassHole.z - hd.y*hGrassHole.w, hd.x*hGrassHole.w + hd.y*hGrassHole.z);
         keep *= 1.0 - step(abs(hl.x), hGrassHoleSize.x) * step(abs(hl.y), hGrassHoleSize.y);
         float hgt = (0.12 + 0.26*aOff.z*aOff.z + 0.16*patchN) * keep;
         float ang = aOff.z*43.0;
         vec3 lp = position; lp.y *= hgt; lp.xz *= 1.0 + aOff.z;
         vec3 transformed = vec3(cos(ang)*lp.x - sin(ang)*lp.z, lp.y, sin(ang)*lp.x + cos(ang)*lp.z);
         float wv = sin(hTime*1.8 + wp.x*0.35 + wp.y*0.22)*0.6 + hNoise(wp*0.15 + hTime*0.4)*0.8;
         transformed.xz += vec2(0.9, 0.4) * wv * aT*aT * 0.12 * hgt * 3.0;
         transformed.xz += wp;
         transformed.y += hTerrainAt(wp) - 0.02;
         float hueN = hNoise(wp*0.08 + 5.0);
         vec3 lush = vec3(0.05,0.09,0.02), dryc = vec3(0.12,0.12,0.05);
         vec3 tip = mix(vec3(0.13,0.21,0.05), vec3(0.22,0.24,0.09), hueN*0.6);
         vGCol = mix(mix(lush, dryc, hueN*0.6)*0.6, tip, aT) * (0.8 + 0.4*fract(aOff.z*91.7)) * mix(1.0, 0.7, hWetness);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGCol; uniform vec3 hSunDir; uniform vec3 hSunColor;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb = vGCol;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      .replace(
        '#include <opaque_fragment>',
        `vec3 sunVg = normalize((viewMatrix*vec4(hSunDir,0.0)).xyz);
         outgoingLight += vGCol * hSunColor * pow(max(dot(-normalize(vViewPosition), sunVg),0.0),3.0) * 0.5 * max(hSunDir.y*2.0,0.1);
         #include <opaque_fragment>`,
      );
  };
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.frustumCulled = false;
  grass.receiveShadow = false;
  grass.userData.noAO = true;
  root.add(grass);

  const updateWind = (elapsed: number) => {
    HUE_SHARED.hTime.value = elapsed;
  };
  const setRainWetness = (wetness: number) => {
    HUE_SHARED.hWetness.value = Math.max(0, Math.min(1, wetness));
  };
  const updateCamera = (camPos: THREE.Vector3) => {
    grassCam.value.copy(camPos);
    // Skip blade field when high above ground (aerial views)
    grass.visible = camPos.y - getTerrainHeight(camPos.x, camPos.z) < 40;
  };

  const setGrassExclusion = (x: number, z: number, yaw: number, halfWidth: number, halfLength: number) => {
    grassHole.value.set(x, z, Math.cos(yaw), Math.sin(yaw));
    grassHoleSize.value.set(halfWidth, halfLength);
  };
  const dispose = () => {
    densTex.dispose();
    grassGeo.dispose();
    grassMat.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
    root.clear();
  };

  return { group: root, updateWind, setRainWetness, updateCamera, setGrassExclusion, dispose };
}

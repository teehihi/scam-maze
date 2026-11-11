import * as THREE from 'three';
import { getTerrainHeight, getWalkableHeight, WORLD_SIZE } from '../../world/hueWorldConfig';

export type PhotoKey =
  | 'brick'
  | 'plaster'
  | 'roof'
  | 'slab'
  | 'rubble'
  | 'concrete'
  | 'wood'
  | 'pinebark'
  | 'bark';

export type GroundKey = 'grass' | 'laterite' | 'path' | 'mud' | 'forest';

export interface PhotoSet {
  color: THREE.Texture;
  normal: THREE.Texture;
  arm: THREE.Texture;
}

let maxAniso = 8;
export function setMaxAnisotropy(a: number) {
  maxAniso = Math.max(1, Math.min(16, a));
  photoCache.forEach((set) => {
    set.color.anisotropy = maxAniso;
    set.normal.anisotropy = maxAniso;
    set.arm.anisotropy = maxAniso;
    set.color.needsUpdate = true;
    set.normal.needsUpdate = true;
    set.arm.needsUpdate = true;
  });
  groundCache.forEach((set) => {
    set.color.anisotropy = maxAniso;
    set.normal.anisotropy = maxAniso;
    set.color.needsUpdate = true;
    set.normal.needsUpdate = true;
  });
}

// ---------------------------------------------------------------------------
// Procedural PBR Texture Synthesis for Heritage Materials
// Generates self-contained PBR maps (Albedo, Tangent Normal, ARM)
// ---------------------------------------------------------------------------

function fract(v: number): number {
  return v - Math.floor(v);
}

function hash2D(x: number, y: number, seed = 1): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return fract(n);
}

function procNoise(u: number, v: number, freq: number, seed = 1): number {
  const x = u * freq;
  const y = v * freq;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const x0 = ((ix % freq) + freq) % freq;
  const x1 = (x0 + 1) % freq;
  const y0 = ((iy % freq) + freq) % freq;
  const y1 = (y0 + 1) % freq;

  const a = hash2D(x0, y0, seed);
  const b = hash2D(x1, y0, seed);
  const c = hash2D(x0, y1, seed);
  const d = hash2D(x1, y1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function procFbm(u: number, v: number, baseFreq: number, octaves = 3, seed = 1): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * procNoise(u, v, freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function buildProcMaps(
  size: number,
  normalStrength: number,
  sampler: (u: number, v: number) => { r: number; g: number; b: number; h: number; rough: number }
): PhotoSet {
  const albedo = new Uint8Array(size * size * 4);
  const normalData = new Uint8Array(size * size * 4);
  const armData = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const res = sampler(u, v);
      const i = y * size + x;
      const idx = i * 4;
      height[i] = res.h;
      albedo[idx] = clampByte(res.r);
      albedo[idx + 1] = clampByte(res.g);
      albedo[idx + 2] = clampByte(res.b);
      albedo[idx + 3] = 255;

      const rv = clampByte(res.rough * 255);
      const ao = clampByte((0.45 + 0.6 * res.h) * 255);
      armData[idx] = ao;
      armData[idx + 1] = rv;
      armData[idx + 2] = 0;
      armData[idx + 3] = 255;
    }
  }

  const sampleH = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return height[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dX * normalStrength;
      let ny = -dY * normalStrength;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      normalData[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      normalData[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normalData[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
    }
  }

  const color = new THREE.DataTexture(albedo, size, size, THREE.RGBAFormat);
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.colorSpace = THREE.SRGBColorSpace;
  color.magFilter = THREE.LinearFilter;
  color.minFilter = THREE.LinearMipmapLinearFilter;
  color.generateMipmaps = true;
  color.anisotropy = maxAniso;
  color.needsUpdate = true;

  const normal = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.colorSpace = THREE.NoColorSpace;
  normal.magFilter = THREE.LinearFilter;
  normal.minFilter = THREE.LinearMipmapLinearFilter;
  normal.generateMipmaps = true;
  normal.anisotropy = maxAniso;
  normal.needsUpdate = true;

  const arm = new THREE.DataTexture(armData, size, size, THREE.RGBAFormat);
  arm.wrapS = arm.wrapT = THREE.RepeatWrapping;
  arm.colorSpace = THREE.NoColorSpace;
  arm.magFilter = THREE.LinearFilter;
  arm.minFilter = THREE.LinearMipmapLinearFilter;
  arm.generateMipmaps = true;
  arm.anisotropy = maxAniso;
  arm.needsUpdate = true;

  return { color, normal, arm };
}

const photoCache = new Map<PhotoKey, PhotoSet>();
const groundCache = new Map<GroundKey, { color: THREE.Texture; normal: THREE.Texture }>();

export function photoSet(key: PhotoKey): PhotoSet {
  const cached = photoCache.get(key);
  if (cached) return cached;

  let set: PhotoSet;
  const size = 256;

  switch (key) {
    case 'brick': {
      // Huế imperial red/terracotta kiln fired brick with lime mortar
      set = buildProcMaps(size, 2.5, (u, v) => {
        const rows = 8;
        const row = Math.floor(v * rows);
        const colShift = (row % 2) * 0.5;
        const cols = 4;
        const col = Math.floor((u + colShift) * cols);
        const fu = (u + colShift) * cols - col;
        const fv = v * rows - row;
        const mortar = smoothstep(0.04, 0.08, fu) * (1 - smoothstep(0.92, 0.96, fu)) *
                       smoothstep(0.06, 0.12, fv) * (1 - smoothstep(0.88, 0.94, fv));
        const grain = procFbm(u, v, 16, 3, 101);
        const brickR = lerp(165, 195, grain) + (hash2D(col, row, 17) - 0.5) * 18;
        const brickG = lerp(85, 108, grain) + (hash2D(col, row, 19) - 0.5) * 12;
        const brickB = lerp(68, 88, grain) + (hash2D(col, row, 23) - 0.5) * 10;
        return {
          r: lerp(148, brickR, mortar),
          g: lerp(144, brickG, mortar),
          b: lerp(138, brickB, mortar),
          h: mortar * 0.65 + grain * 0.15,
          rough: lerp(0.92, 0.72 + grain * 0.1, mortar),
        };
      });
      break;
    }
    case 'plaster': {
      // Weathered lime plaster with gentle damp patina
      set = buildProcMaps(size, 1.8, (u, v) => {
        const f = procFbm(u, v, 12, 3, 203);
        const micro = procFbm(u, v, 32, 2, 211);
        const tone = lerp(208, 234, f) + (micro - 0.5) * 8;
        return {
          r: tone,
          g: tone * 0.96,
          b: tone * 0.88,
          h: 0.5 + (f - 0.5) * 0.25 + (micro - 0.5) * 0.1,
          rough: lerp(0.78, 0.92, f),
        };
      });
      break;
    }
    case 'roof': {
      // Curved imperial roofing tiles (yin-yang / tube tile courses)
      set = buildProcMaps(size, 3.2, (u, v) => {
        const ribs = 12;
        const rx = fract(u * ribs);
        const tileShape = Math.sin(rx * Math.PI);
        const coursing = Math.sin(v * Math.PI * 8);
        const f = procFbm(u, v, 14, 2, 307);
        const baseR = lerp(178, 198, f);
        const baseG = lerp(92, 112, f);
        const baseB = lerp(62, 78, f);
        return {
          r: baseR * (0.8 + 0.2 * tileShape),
          g: baseG * (0.8 + 0.2 * tileShape),
          b: baseB * (0.8 + 0.2 * tileShape),
          h: tileShape * 0.7 + coursing * 0.15,
          rough: lerp(0.68, 0.82, tileShape),
        };
      });
      break;
    }
    case 'slab': {
      // Rectangular cut stone flagstones (Đá Thanh Hóa)
      set = buildProcMaps(size, 2.2, (u, v) => {
        const nx = 4;
        const ny = 4;
        const ix = Math.floor(u * nx);
        const iy = Math.floor(v * ny);
        const fx = u * nx - ix;
        const fy = v * ny - iy;
        const joint = smoothstep(0.03, 0.07, fx) * (1 - smoothstep(0.93, 0.97, fx)) *
                      smoothstep(0.03, 0.07, fy) * (1 - smoothstep(0.93, 0.97, fy));
        const noise = procFbm(u, v, 10, 3, 401);
        const val = lerp(138, 168, noise);
        return {
          r: lerp(90, val, joint),
          g: lerp(92, val * 1.02, joint),
          b: lerp(96, val * 1.05, joint),
          h: joint * 0.7 + noise * 0.15,
          rough: lerp(0.9, 0.74, joint),
        };
      });
      break;
    }
    case 'rubble': {
      // Polygonal rubble masonry (Đá hộc kè sông / chân thành)
      set = buildProcMaps(size, 2.8, (u, v) => {
        const f1 = procFbm(u, v, 6, 3, 503);
        const f2 = procFbm(u + 0.3, v - 0.2, 8, 3, 509);
        const cell = Math.sin(f1 * 12.0) * Math.cos(f2 * 12.0);
        const joint = smoothstep(0.05, 0.18, Math.abs(cell));
        const stoneVal = lerp(118, 155, f1);
        return {
          r: lerp(98, stoneVal, joint),
          g: lerp(96, stoneVal * 0.98, joint),
          b: lerp(92, stoneVal * 0.94, joint),
          h: joint * 0.75 + f1 * 0.15,
          rough: lerp(0.95, 0.82, joint),
        };
      });
      break;
    }
    case 'concrete': {
      // Weathered French-colonial cement render with aggregate speckles
      set = buildProcMaps(size, 2.0, (u, v) => {
        const f = procFbm(u, v, 16, 3, 601);
        const sp = hash2D(Math.floor(u * 128), Math.floor(v * 128), 607);
        const speck = sp > 0.9 ? 35 : 0;
        const val = lerp(128, 158, f) - speck;
        return {
          r: val,
          g: val,
          b: val * 0.98,
          h: 0.5 + (f - 0.5) * 0.25,
          rough: lerp(0.82, 0.95, f),
        };
      });
      break;
    }
    case 'wood': {
      // Aged Vietnamese ironwood (Gỗ lim) with longitudinal grain
      set = buildProcMaps(size, 1.8, (u, v) => {
        const grain = procFbm(u * 28, v * 2, 8, 3, 701);
        const ring = Math.sin(u * Math.PI * 18 + grain * 3.0);
        const base = lerp(96, 132, 0.5 + 0.5 * ring);
        return {
          r: base * 1.08,
          g: base * 0.78,
          b: base * 0.52,
          h: 0.5 + ring * 0.15 + grain * 0.1,
          rough: lerp(0.58, 0.74, 0.5 + 0.5 * ring),
        };
      });
      break;
    }
    case 'pinebark':
    case 'bark': {
      // Scots pine fissured bark (Thông núi Ngự Bình / Thiên An)
      set = buildProcMaps(size, 3.4, (u, v) => {
        const plate = Math.sin(u * Math.PI * 14 + procFbm(u, v, 6, 2, 809) * 2.0);
        const furrow = smoothstep(0.12, 0.45, Math.abs(plate));
        const val = lerp(68, 114, furrow);
        return {
          r: val * 1.15,
          g: val * 0.82,
          b: val * 0.65,
          h: furrow * 0.8,
          rough: lerp(0.96, 0.85, furrow),
        };
      });
      break;
    }
  }

  photoCache.set(key, set);
  return set;
}

export function groundSet(key: GroundKey): { color: THREE.Texture; normal: THREE.Texture } {
  const cached = groundCache.get(key);
  if (cached) return cached;

  let set: { color: THREE.Texture; normal: THREE.Texture };
  const size = 256;

  switch (key) {
    case 'grass': {
      const p = buildProcMaps(size, 2.6, (u, v) => {
        const f = procFbm(u, v, 14, 3, 901);
        const micro = procFbm(u, v, 42, 2, 907);
        const blade = f * 0.72 + micro * 0.28;
        return {
          r: lerp(52, 84, blade),
          g: lerp(98, 154, blade),
          b: lerp(32, 54, blade),
          h: blade,
          rough: 0.88,
        };
      });
      set = { color: p.color, normal: p.normal };
      break;
    }
    case 'laterite': {
      const p = buildProcMaps(size, 2.6, (u, v) => {
        const f = procFbm(u, v, 10, 3, 911);
        return {
          r: lerp(142, 178, f),
          g: lerp(68, 88, f),
          b: lerp(45, 62, f),
          h: f,
          rough: 0.94,
        };
      });
      set = { color: p.color, normal: p.normal };
      break;
    }
    case 'path': {
      const p = buildProcMaps(size, 1.8, (u, v) => {
        const f = procFbm(u, v, 12, 3, 921);
        return {
          r: lerp(165, 192, f),
          g: lerp(148, 172, f),
          b: lerp(122, 145, f),
          h: f * 0.7,
          rough: 0.84,
        };
      });
      set = { color: p.color, normal: p.normal };
      break;
    }
    case 'mud': {
      const p = buildProcMaps(size, 1.4, (u, v) => {
        const f = procFbm(u, v, 8, 3, 931);
        return {
          r: lerp(70, 92, f),
          g: lerp(58, 76, f),
          b: lerp(44, 58, f),
          h: f * 0.5,
          rough: 0.42,
        };
      });
      set = { color: p.color, normal: p.normal };
      break;
    }
    case 'forest': {
      const p = buildProcMaps(size, 2.4, (u, v) => {
        const f = procFbm(u, v, 12, 3, 941);
        return {
          r: lerp(82, 110, f),
          g: lerp(64, 86, f),
          b: lerp(42, 60, f),
          h: f * 0.8,
          rough: 0.96,
        };
      });
      set = { color: p.color, normal: p.normal };
      break;
    }
  }

  groundCache.set(key, set);
  return set;
}

// ---------------------------------------------------------------------------
// World-baked data textures shared by every surface (terrain height & grass density)
// ---------------------------------------------------------------------------
const BAKE_RES = 64;
function bakeTerrainHeightTexture(): THREE.DataTexture {
  const data = new Uint16Array(BAKE_RES * BAKE_RES);
  const half = WORLD_SIZE * 0.5;
  for (let j = 0; j < BAKE_RES; j++) {
    const z = -half + ((j + 0.5) / BAKE_RES) * WORLD_SIZE;
    for (let i = 0; i < BAKE_RES; i++) {
      const x = -half + ((i + 0.5) / BAKE_RES) * WORLD_SIZE;
      data[j * BAKE_RES + i] = THREE.DataUtils.toHalfFloat(getTerrainHeight(x, z));
    }
  }
  const t = new THREE.DataTexture(data, BAKE_RES, BAKE_RES, THREE.RedFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export const HUE_SHARED = {
  hTerrainH: { value: null as THREE.Texture | null },
  hTerrainRect: { value: new THREE.Vector4(-WORLD_SIZE * 0.5, -WORLD_SIZE * 0.5, WORLD_SIZE, 0) },
  hWetness: { value: 0 },
  hTime: { value: 0 },
  hSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.4).normalize() },
  hSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
};

export function ensureSharedBakes() {
  if (!HUE_SHARED.hTerrainH.value) HUE_SHARED.hTerrainH.value = bakeTerrainHeightTexture();
}

/** True where architecture/platforms sit above natural ground (used to keep grass out of buildings). */
export function isBuiltUp(x: number, z: number): boolean {
  return getWalkableHeight(x, z) > getTerrainHeight(x, z) + 0.25;
}

// ---------------------------------------------------------------------------
// GLSL utilities
// ---------------------------------------------------------------------------
export const HUE_NOISE_GLSL = /* glsl */ `
float hHash(vec2 p){ p = fract(p*vec2(233.34,851.73)); p += dot(p,p+23.45); return fract(p.x*p.y); }
float hNoise(vec2 p){
  vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hHash(i),hHash(i+vec2(1,0)),u.x), mix(hHash(i+vec2(0,1)),hHash(i+vec2(1,1)),u.x), u.y);
}
float hFbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*hNoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5;} return s/0.9375; }
float hTerrainAt(vec2 xz){ return texture2D(hTerrainH, (xz - hTerrainRect.xy)/hTerrainRect.z).r; }
`;

const SHARED_PARS = /* glsl */ `
uniform sampler2D hTerrainH;
uniform vec4 hTerrainRect;
uniform float hWetness;
uniform float hTime;
uniform vec3 hSunDir;
uniform vec3 hSunColor;
`;

export interface SurfaceOptions {
  set?: PhotoSet;
  /** metres per texture tile (triplanar) or tiles per UV unit (uv mode) */
  scale: number;
  uvMode?: boolean;
  tint?: THREE.ColorRepresentation;
  saturation?: number;
  normalStrength?: number;
  roughMul?: number;
  aoStrength?: number;
  streaks?: number;
  damp?: number;
  moss?: number;
  porous?: number;
  macro?: number;
  /** number of semi-cylindrical tube-tile ribs per UV unit (ngói ống) */
  ribs?: number;
}

const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;
const FLATN = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
FLATN.needsUpdate = true;

/**
 * Upgrades any MeshStandard/Physical material to the physically-motivated Huế surface model:
 * world-space triplanar at true metric scale + rising damp, rain-run black mould streaks,
 * moss on horizontals, crevice grime, macro variation and rain wetness.
 */
export function applyHueSurface(mat: THREE.MeshStandardMaterial, o: SurfaceOptions) {
  ensureSharedBakes();
  const set = o.set ?? { color: WHITE, normal: FLATN, arm: WHITE };
  mat.map = null;
  mat.normalMap = null;
  mat.roughnessMap = null;
  if (o.uvMode) {
    mat.defines = { ...(mat.defines || {}), HUE_UV: '', USE_UV: '' };
  }
  const tint = new THREE.Color(o.tint ?? 0xffffff);
  const u = {
    hMapC: { value: set.color },
    hMapN: { value: set.normal },
    hMapA: { value: set.arm },
    hScale: { value: o.scale },
    hTint: { value: tint },
    hSat: { value: o.saturation ?? 1 },
    hNormalStr: { value: o.normalStrength ?? 1 },
    hRoughMul: { value: o.roughMul ?? 1 },
    hAOStr: { value: o.aoStrength ?? 0.8 },
    hStreaks: { value: o.streaks ?? 0.3 },
    hDamp: { value: o.damp ?? 0.6 },
    hMoss: { value: o.moss ?? 0.3 },
    hPorous: { value: o.porous ?? 1 },
    hMacro: { value: o.macro ?? 0.6 },
    hRibs: { value: o.ribs ?? 0 },
  };
  mat.userData.hue = u;
  mat.customProgramCacheKey = () => 'hue-surface-v3' + (o.uvMode ? '-uv' : '-tri');
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, HUE_SHARED);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHW;\nvarying vec3 vHN;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 hwp = vec4(transformed, 1.0);
        vec3 hon = objectNormal;
        #ifdef USE_INSTANCING
          hwp = instanceMatrix * hwp;
          hon = mat3(instanceMatrix) * hon;
        #endif
        hwp = modelMatrix * hwp;
        vHW = hwp.xyz;
        vHN = normalize(mat3(modelMatrix) * hon);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHW; varying vec3 vHN;
        uniform sampler2D hMapC; uniform sampler2D hMapN; uniform sampler2D hMapA;
        uniform float hScale, hSat, hNormalStr, hRoughMul, hAOStr, hStreaks, hDamp, hMoss, hPorous, hMacro, hRibs;
        uniform vec3 hTint;
        ${SHARED_PARS}
        ${HUE_NOISE_GLSL}
        mat3 hCotangent(vec3 N, vec3 p, vec2 uv){
          vec3 dp1=dFdx(p), dp2=dFdy(p); vec2 duv1=dFdx(uv), duv2=dFdy(uv);
          vec3 dp2perp=cross(dp2,N), dp1perp=cross(N,dp1);
          vec3 T=dp2perp*duv1.x+dp1perp*duv2.x; vec3 B=dp2perp*duv1.y+dp1perp*duv2.y;
          float im=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12));
          return mat3(T*im,B*im,N);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        `
        float hFace = gl_FrontFacing ? 1.0 : -1.0;
        vec3 hN = normalize(vHN) * hFace;
        vec4 hC = vec4(0.0); vec3 hArm = vec3(0.0); vec3 hNrmW = hN;
        #ifdef HUE_UV
        {
          vec2 huv = vUv * hScale;
          hC = texture2D(hMapC, huv); hArm = texture2D(hMapA, huv).rgb;
          vec3 tn = texture2D(hMapN, huv).xyz*2.0-1.0; tn.xy *= hNormalStr;
          if (hRibs > 0.0) {
            float fx = fract(vUv.x * hRibs);
            float cyl = sin(fx*3.14159);
            tn.x += -cos(fx*3.14159)*1.1;
            hArm.r *= 0.35 + 0.65*cyl;
            hC.rgb *= 0.72 + 0.28*cyl;
          }
          hNrmW = normalize(hCotangent(hN, vHW, vUv) * normalize(tn));
        }
        #else
        {
          vec3 p = vHW / hScale;
          vec3 w = pow(abs(hN), vec3(4.0)); w /= (w.x+w.y+w.z);
          vec3 s = vec3(hN.x<0.0?-1.0:1.0, hN.y<0.0?-1.0:1.0, hN.z<0.0?-1.0:1.0);
          vec2 uvX = vec2(p.z*s.x, p.y), uvY = vec2(p.x*s.y, p.z), uvZ = vec2(-p.x*s.z, p.y);
          vec3 tX = vec3(0.0,0.0,1.0), tY = tX, tZ = tX;
          if (w.x > 0.01) { hC += texture2D(hMapC, uvX)*w.x; hArm += texture2D(hMapA, uvX).rgb*w.x; tX = texture2D(hMapN, uvX).xyz*2.0-1.0; }
          if (w.y > 0.01) { hC += texture2D(hMapC, uvY)*w.y; hArm += texture2D(hMapA, uvY).rgb*w.y; tY = texture2D(hMapN, uvY).xyz*2.0-1.0; }
          if (w.z > 0.01) { hC += texture2D(hMapC, uvZ)*w.z; hArm += texture2D(hMapA, uvZ).rgb*w.z; tZ = texture2D(hMapN, uvZ).xyz*2.0-1.0; }
          hC /= max(w.x*step(0.01,w.x)+w.y*step(0.01,w.y)+w.z*step(0.01,w.z), 1e-3);
          hArm /= max(w.x*step(0.01,w.x)+w.y*step(0.01,w.y)+w.z*step(0.01,w.z), 1e-3);
          tX.xy *= hNormalStr; tY.xy *= hNormalStr; tZ.xy *= hNormalStr;
          tX.x *= s.x; tY.x *= s.y; tZ.x *= -s.z;
          tX = vec3(tX.xy + hN.zy, abs(tX.z)*hN.x);
          tY = vec3(tY.xy + hN.xz, abs(tY.z)*hN.y);
          tZ = vec3(tZ.xy + hN.xy, abs(tZ.z)*hN.z);
          hNrmW = normalize(tX.zyx*w.x + tY.xzy*w.y + tZ.xyz*w.z);
        }
        #endif
        vec3 hAlb = hC.rgb;
        float hLum = dot(hAlb, vec3(0.2126,0.7152,0.0722));
        hAlb = mix(vec3(hLum), hAlb, hSat) * hTint;
        hAlb *= mix(1.0, hArm.r, hAOStr*0.45);
        float hUp = smoothstep(0.55, 0.92, hN.y);
        float hWet = hWetness * hPorous * (0.5 + 0.5*hUp);
        hAlb *= mix(1.0, 0.65, hWet);
        diffuseColor.rgb *= hAlb;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness * clamp(hArm.g * hRoughMul, 0.04, 1.0);
         roughnessFactor = mix(roughnessFactor, 0.35, clamp(hWet*0.8, 0.0, 1.0));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `normal = normalize((viewMatrix * vec4(hNrmW, 0.0)).xyz);`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
         float hAO = mix(1.0, hArm.r, hAOStr);
         reflectedLight.indirectDiffuse *= hAO;
         reflectedLight.indirectSpecular *= hAO;`,
      );
  };
  mat.needsUpdate = true;
  return mat;
}

/** Build a 512² ARM-style texture from a procedural height/roughness sampler, for procedural surfaces. */
export function makeArmFromHeightRough(height: Float32Array, rough: Uint8Array, size: number): THREE.DataTexture {
  const d = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const h = height[i];
    d[i * 4] = Math.max(0, Math.min(255, Math.round((0.45 + 0.6 * h) * 255)));
    d[i * 4 + 1] = rough[i * 4];
    d[i * 4 + 2] = 0;
    d[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

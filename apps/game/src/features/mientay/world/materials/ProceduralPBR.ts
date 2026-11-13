import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../math/Noise';

export interface PBRMaterialConfig {
  id: string;
  size?: number;
  repeatX?: number;
  repeatY?: number;
  metalness?: number;
  roughness?: number;
  normalScale?: number;
  weathering?: {
    tideMoss?: boolean;
    rainStreaks?: boolean;
    macroScale?: number;
    macroStrength?: number;
  };
}

interface PBRChannelBuffers {
  albedo: Uint8Array;
  height: Float32Array;
  roughness: Uint8Array;
  metalness?: Uint8Array;
}

function makeDataTex(
  data: Uint8Array,
  size: number,
  srgb: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Computes tangent-space normal map from a tileable scalar heightfield [0..1]
 * using a 3x3 Sobel operator with wrap-around boundary sampling.
 */
function heightToNormalRGBA(height: Float32Array, size: number, strength = 2.6): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const sample = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return height[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      out[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }
  return out;
}

function grayToRGBA(gray: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const v = gray[i];
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function heightToGrayRGBA(height: Float32Array, size: number, ao = false): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    // AO is intentionally soft: seams and pores lose indirect light, while the
    // raised grain remains available to the sun and image-based lighting.
    const v = ao
      ? clamp(Math.round((0.58 + height[i] * 0.42) * 255), 92, 255)
      : clamp(Math.round(height[i] * 255), 0, 255);
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

function fastIntHash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Tileable value noise helper by blending across periodic domain
function tileNoise(u: number, v: number, freq: number, seedOffset = 0): number {
  const x = u * freq;
  const y = v * freq;
  const ix0 = Math.floor(x);
  const iy0 = Math.floor(y);
  const fx = x - ix0;
  const fy = y - iy0;
  const x0 = ((ix0 % freq) + freq) % freq;
  const y0 = ((iy0 % freq) + freq) % freq;
  const x1 = (x0 + 1) % freq;
  const y1 = (y0 + 1) % freq;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const s = Math.round(seedOffset * 17);
  const a = fastIntHash(x0, y0, s);
  const b = fastIntHash(x1, y0, s);
  const c = fastIntHash(x0, y1, s);
  const d = fastIntHash(x1, y1, s);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function tileFbm(u: number, v: number, baseFreq: number, octaves = 4, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileNoise(u, v, freq, seed + i * 19.3);
    norm += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

function setRGBA(buf: Uint8Array, idx: number, r: number, g: number, b: number, a = 255) {
  buf[idx] = clamp(Math.round(r), 0, 255);
  buf[idx + 1] = clamp(Math.round(g), 0, 255);
  buf[idx + 2] = clamp(Math.round(b), 0, 255);
  buf[idx + 3] = a;
}

// ============================================================================
// Material Synthesizers
// ============================================================================

function genWoodPlank(size: number, darkTone = false): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);
  const plankCount = 5;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const plankId = Math.floor(v * plankCount);
    const localV = (v * plankCount) % 1;
    const seamDist = Math.min(localV, 1 - localV);
    const seam = 1 - smoothstep(0.0, 0.022, seamDist);
    const plankShift = ((plankId * 37.7) % 1) * 0.6;
    const plankHue = Math.sin(plankId * 2.17) * 0.5 + 0.5;

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const grainWarp = tileFbm(u, v, 8, 3, plankId * 5) * 0.18;
      const fiber = Math.sin((localV * 14 + grainWarp * 9 + u * 1.5) * Math.PI);
      const fineGrain = tileFbm(u, v, 24, 3, 13 + plankId);
      const weatherPatch = tileFbm(u + plankShift, v, 4, 3, 71);

      const jointU = (u + (plankId % 2) * 0.5) % 1;
      const endJoint = 1 - smoothstep(0.0, 0.008, Math.min(jointU, 1 - jointU));
      const gap = Math.max(seam, endJoint);

      const h = clamp(
        0.65 +
          fiber * 0.045 +
          (fineGrain - 0.5) * 0.11 -
          gap * 0.36 -
          (1 - weatherPatch) * 0.05,
        0,
        1,
      );
      height[y * size + x] = h;

      const baseR = darkTone ? lerp(66, 86, plankHue) : lerp(102, 128, plankHue);
      const baseG = darkTone ? lerp(48, 63, plankHue) : lerp(74, 95, plankHue);
      const baseB = darkTone ? lerp(35, 45, plankHue) : lerp(51, 66, plankHue);

      const grainShade = 0.89 + fiber * 0.05 + fineGrain * 0.12;
      const silverWeather = smoothstep(0.58, 0.92, weatherPatch) * 0.18;
      const ao = 1 - gap * 0.48;

      const r = lerp(baseR * grainShade, 118, silverWeather) * ao;
      const g = lerp(baseG * grainShade, 112, silverWeather) * ao;
      const b = lerp(baseB * grainShade, 102, silverWeather) * ao;

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(
        Math.round((0.8 + (1 - h) * 0.16 + gap * 0.1) * 255),
        140,
        250,
      );
    }
  }
  return { albedo, height, roughness };
}

function genPilingBark(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Organic longitudinal bark ridges without periodic striping
      const coarse = tileFbm(u * 1, v * 0.35, 8, 4, 3);
      const streak = tileFbm(u * 1, v * 0.12, 16, 3, 17);
      const fine = tileFbm(u, v, 32, 3, 29);
      const lichen = smoothstep(0.68, 0.88, tileFbm(u, v, 6, 3, 99));

      const h = clamp(coarse * 0.45 + streak * 0.35 + fine * 0.2, 0, 1);
      height[y * size + x] = h;

      let r = lerp(52, 82, h);
      let g = lerp(41, 65, h);
      let b = lerp(31, 50, h);
      r = lerp(r, 94, lichen * 0.34);
      g = lerp(g, 99, lichen * 0.34);
      b = lerp(b, 74, lichen * 0.34);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(Math.round((0.88 + (1 - h) * 0.1) * 255), 180, 252);
    }
  }
  return { albedo, height, roughness };
}

function genYinYangTile(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);
  const cols = 8;
  const rows = 10;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const localV = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const colPhase = (u * cols) % 1;
      const col = Math.floor(u * cols);
      // Yin-yang profile: half-width convex cylinder tile + half-width concave valley
      const waveX = Math.cos(colPhase * Math.PI * 2);
      const convexMask = smoothstep(-0.1, 0.3, waveX);
      const overlapDrop = 1 - localV; // stepped shingle overlap downward
      const tileLip = smoothstep(0.88, 1.0, localV);

      const perTileHash = ((Math.sin(col * 17.3 + row * 53.1) * 43758.5) % 1 + 1) % 1;
      const clayGrain = tileFbm(u, v, 32, 3, 41);
      const mossPatch = smoothstep(0.62, 0.86, tileFbm(u, v, 8, 3, 108));

      const h = clamp(
        0.48 + waveX * 0.28 + overlapDrop * 0.18 - tileLip * 0.36 + (clayGrain - 0.5) * 0.06,
        0,
        1,
      );
      height[y * size + x] = h;

      // Terracotta fired clay palette with soot darkening & moss
      let r = lerp(138, 178, perTileHash) * (0.86 + clayGrain * 0.24);
      let g = lerp(66, 92, perTileHash) * (0.86 + clayGrain * 0.24);
      let b = lerp(45, 62, perTileHash) * (0.86 + clayGrain * 0.24);

      // Darken under overlap lip & concave valleys
      const ao = (1 - tileLip * 0.45) * (0.78 + convexMask * 0.24);
      r *= ao;
      g *= ao;
      b *= ao;

      // Tropical moss patina in valleys & weathered spots
      const mossAmt = mossPatch * (1 - convexMask * 0.65) * 0.55;
      r = lerp(r, 64, mossAmt);
      g = lerp(g, 82, mossAmt);
      b = lerp(b, 46, mossAmt);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(
        Math.round(lerp(0.66, 0.9, mossAmt + (1 - clayGrain) * 0.2) * 255),
        120,
        248,
      );
    }
  }
  return { albedo, height, roughness };
}

function genLimeStucco(
  size: number,
  tintRGB: [number, number, number] = [214, 186, 126],
): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Fine troweled lime-sand plaster ("vữa vôi ô dước") without directional streaks
      const plaster = tileFbm(u, v, 8, 4, 17);
      const sandGrain = tileFbm(u, v, 36, 3, 55);
      const microPore = tileNoise(u, v, 64, 91);
      const dampPatch = smoothstep(0.52, 0.84, tileFbm(u, v, 4, 3, 21));
      const hairline = 1 - smoothstep(0.0, 0.045, Math.abs(tileFbm(u, v, 10, 3, 73) - 0.5));

      const h = clamp(
        0.62 + (plaster - 0.5) * 0.14 + (sandGrain - 0.5) * 0.14 + (microPore - 0.5) * 0.08 - hairline * 0.12,
        0,
        1,
      );
      height[y * size + x] = h;

      let r = tintRGB[0] * (0.88 + plaster * 0.18 + (sandGrain - 0.5) * 0.08);
      let g = tintRGB[1] * (0.88 + plaster * 0.18 + (sandGrain - 0.5) * 0.08);
      let b = tintRGB[2] * (0.88 + plaster * 0.18 + (sandGrain - 0.5) * 0.08);

      // Subtle mineral dampness & aged moss-grey lime patina
      r = lerp(r, r * 0.78, dampPatch * 0.42);
      g = lerp(g, g * 0.8, dampPatch * 0.42);
      b = lerp(b, b * 0.75, dampPatch * 0.42);

      // Hairline plaster crazing darkened slightly
      r *= 1 - hairline * 0.1;
      g *= 1 - hairline * 0.1;
      b *= 1 - hairline * 0.1;

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(
        Math.round((0.82 + (1 - sandGrain) * 0.14) * 255),
        185,
        250,
      );
    }
  }
  return { albedo, height, roughness };
}

function genGachTau(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);
  const tiles = 6;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const ty = Math.floor(v * tiles);
    const lv = (v * tiles) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const tx = Math.floor(u * tiles);
      const lu = (u * tiles) % 1;

      const edge = Math.min(lu, 1 - lu, lv, 1 - lv);
      const joint = 1 - smoothstep(0.015, 0.055, edge);
      const tileSeed = ((Math.sin(tx * 23.1 + ty * 61.7) * 9132.4) % 1 + 1) % 1;
      const wear = tileFbm(u, v, 16, 4, 14);
      const mossJoint = smoothstep(0.42, 0.78, tileFbm(u, v, 8, 3, 62)) * joint;

      const h = clamp(0.68 - joint * 0.45 + (wear - 0.5) * 0.1, 0, 1);
      height[y * size + x] = h;

      let r = lerp(148, 178, tileSeed) * (0.84 + wear * 0.24);
      let g = lerp(74, 94, tileSeed) * (0.84 + wear * 0.24);
      let b = lerp(52, 66, tileSeed) * (0.84 + wear * 0.24);

      // Dark sandy mortar + green moss in courtyard joints
      r = lerp(r, 82, joint * 0.78);
      g = lerp(g, 76, joint * 0.78);
      b = lerp(b, 64, joint * 0.78);

      r = lerp(r, 64, mossJoint * 0.8);
      g = lerp(g, 88, mossJoint * 0.8);
      b = lerp(b, 44, mossJoint * 0.8);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(
        Math.round(lerp(0.64, 0.92, joint * 0.7 + wear * 0.25) * 255),
        130,
        245,
      );
    }
  }
  return { albedo, height, roughness };
}

function genAgedBrick(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);
  const rows = 12;
  const cols = 6;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const lv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const offsetU = (u * cols + (row % 2) * 0.5) % cols;
      const col = Math.floor(offsetU);
      const lu = offsetU % 1;

      const mortar = Math.max(
        1 - smoothstep(0.02, 0.08, Math.min(lu, 1 - lu)),
        1 - smoothstep(0.04, 0.14, Math.min(lv, 1 - lv)),
      );
      const seed = ((Math.sin(col * 31.3 + row * 71.7) * 4231.5) % 1 + 1) % 1;
      const grit = tileFbm(u, v, 32, 3, 9);
      const moss = smoothstep(0.58, 0.82, tileFbm(u, v, 8, 3, 44));

      const h = clamp(0.72 - mortar * 0.42 + (grit - 0.5) * 0.16, 0, 1);
      height[y * size + x] = h;

      let r = lerp(128, 168, seed) * (0.82 + grit * 0.28);
      let g = lerp(64, 86, seed) * (0.82 + grit * 0.28);
      let b = lerp(46, 62, seed) * (0.82 + grit * 0.28);

      r = lerp(r, 150, mortar * 0.75);
      g = lerp(g, 144, mortar * 0.75);
      b = lerp(b, 130, mortar * 0.75);

      r = lerp(r, 58, moss * 0.52);
      g = lerp(g, 76, moss * 0.52);
      b = lerp(b, 44, moss * 0.52);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(Math.round((0.78 + grit * 0.18) * 255), 170, 250);
    }
  }
  return { albedo, height, roughness };
}

function genCorrugatedTin(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);
  const metalness = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const sheetSeam = 1 - smoothstep(0, 0.025, Math.min(v * 2 % 1, 1 - (v * 2 % 1)));
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const corr = Math.sin(u * Math.PI * 36) * 0.5 + 0.5;
      const rustField = tileFbm(u, v, 8, 4, 37);
      const fineRust = tileFbm(u, v, 32, 3, 73);
      const rustMask = smoothstep(0.46, 0.72, rustField * 0.72 + fineRust * 0.28 + sheetSeam * 0.22);

      const h = clamp(0.25 + corr * 0.52 + (fineRust - 0.5) * 0.1 - sheetSeam * 0.15, 0, 1);
      height[y * size + x] = h;

      // Galvanized dull zinc grey-blue vs warm burnt rust
      const zincR = lerp(128, 158, corr) * (0.9 + fineRust * 0.16);
      const zincG = lerp(134, 164, corr) * (0.9 + fineRust * 0.16);
      const zincB = lerp(140, 170, corr) * (0.9 + fineRust * 0.16);

      const rustR = lerp(104, 146, fineRust);
      const rustG = lerp(52, 74, fineRust);
      const rustB = lerp(32, 44, fineRust);

      const r = lerp(zincR, rustR, rustMask) * (1 - sheetSeam * 0.25);
      const g = lerp(zincG, rustG, rustMask) * (1 - sheetSeam * 0.25);
      const b = lerp(zincB, rustB, rustMask) * (1 - sheetSeam * 0.25);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(
        Math.round(lerp(0.38, 0.9, rustMask) * 255),
        75,
        245,
      );
      metalness[y * size + x] = clamp(
        Math.round(lerp(0.75, 0.08, rustMask) * 255),
        10,
        215,
      );
    }
  }
  return { albedo, height, roughness, metalness };
}

function genNipaThatch(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const tier = Math.floor(v * 7);
    const tierV = (v * 7) % 1;
    const tierShadow = smoothstep(0.84, 1.0, tierV);
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Dried layered straw fibers running downward with slight diagonal jitter
      const strand = tileNoise(u, v * 0.25, 64, tier * 11);
      const bundle = tileFbm(u, v, 16, 3, tier * 7);
      const weather = tileFbm(u, v, 6, 3, 52);

      const h = clamp(strand * 0.55 + bundle * 0.35 - tierShadow * 0.35, 0, 1);
      height[y * size + x] = h;

      const r = lerp(92, 148, strand) * (0.82 + weather * 0.28) * (1 - tierShadow * 0.45);
      const g = lerp(74, 118, strand) * (0.82 + weather * 0.28) * (1 - tierShadow * 0.45);
      const b = lerp(46, 74, strand) * (0.82 + weather * 0.28) * (1 - tierShadow * 0.45);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(Math.round((0.88 + (1 - strand) * 0.1) * 255), 200, 252);
    }
  }
  return { albedo, height, roughness };
}

function genStoneGranite(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);
  const rows = 5;
  const cols = 4;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const lv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const offsetU = (u * cols + (row % 2) * 0.5) % cols;
      const col = Math.floor(offsetU);
      const lu = offsetU % 1;

      const seam = Math.max(
        1 - smoothstep(0.015, 0.055, Math.min(lu, 1 - lu)),
        1 - smoothstep(0.02, 0.07, Math.min(lv, 1 - lv)),
      );
      const grain = tileFbm(u, v, 32, 4, 31 + col + row);
      const moss = smoothstep(0.56, 0.8, tileFbm(u, v, 8, 3, 77)) * (0.35 + seam * 0.65);

      const h = clamp(0.68 - seam * 0.42 + (grain - 0.5) * 0.18, 0, 1);
      height[y * size + x] = h;

      let r = lerp(88, 126, grain) * (1 - seam * 0.38);
      let g = lerp(92, 130, grain) * (1 - seam * 0.38);
      let b = lerp(96, 134, grain) * (1 - seam * 0.38);

      r = lerp(r, 64, moss * 0.72);
      g = lerp(g, 82, moss * 0.72);
      b = lerp(b, 48, moss * 0.72);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(Math.round((0.72 + seam * 0.22) * 255), 145, 248);
    }
  }
  return { albedo, height, roughness };
}

function genKhmerRoofTile(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);
  const cols = 10;
  const rows = 12;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = Math.floor(v * rows);
    const lv = (v * rows) % 1;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const offsetU = (u * cols + (row % 2) * 0.5) % cols;
      const lu = offsetU % 1;
      const dx = lu - 0.5;
      const scallop = smoothstep(0.45, 0.95, lv + Math.abs(dx) * 0.65);
      const ridge = 1 - Math.abs(dx) * 1.4;
      const borderBand = row % 6 === 0;
      const noise = tileFbm(u, v, 16, 3, 19);

      const h = clamp(0.55 + ridge * 0.26 - scallop * 0.32, 0, 1);
      height[y * size + x] = h;

      // Rich saffron-amber & emerald border Khmer ceramic glazed tiles
      let r = borderBand ? lerp(42, 72, noise) : lerp(188, 224, noise);
      let g = borderBand ? lerp(112, 148, noise) : lerp(92, 128, noise);
      let b = borderBand ? lerp(64, 88, noise) : lerp(28, 42, noise);

      const ao = 1 - scallop * 0.42;
      setRGBA(albedo, (y * size + x) * 4, r * ao, g * ao, b * ao);
      roughness[y * size + x] = clamp(Math.round((0.3 + scallop * 0.35) * 255), 55, 190);
    }
  }
  return { albedo, height, roughness };
}

function genDaBoCeramic(size: number): PBRChannelBuffers {
  const albedo = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const roughness = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const drip = tileFbm(u, v * 0.4, 16, 4, 23);
      const speckle = tileNoise(u, v, 64, 51);
      const ridge = Math.sin(v * Math.PI * 16) * 0.5 + 0.5;
      const h = clamp(0.5 + ridge * 0.14 + (drip - 0.5) * 0.15, 0, 1);
      height[y * size + x] = h;

      // Traditional "da bò" chestnut-amber mottled glaze
      const r = lerp(96, 152, drip) * (0.85 + speckle * 0.24);
      const g = lerp(52, 88, drip) * (0.85 + speckle * 0.24);
      const b = lerp(26, 44, drip) * (0.85 + speckle * 0.24);

      setRGBA(albedo, (y * size + x) * 4, r, g, b);
      roughness[y * size + x] = clamp(Math.round(lerp(0.18, 0.44, speckle) * 255), 35, 130);
    }
  }
  return { albedo, height, roughness };
}

// ============================================================================
// World-Space Weathering Shader Hook (Tidal Wetness, Algae, Macro Variation)
// ============================================================================

export function injectMekongWeathering(
  material: THREE.MeshStandardMaterial,
  options: {
    tideMoss?: boolean;
    rainStreaks?: boolean;
    macroScale?: number;
    macroStrength?: number;
  } = {},
): THREE.MeshStandardMaterial {
  const tideMoss = options.tideMoss ?? true;
  const rainStreaks = options.rainStreaks ?? false;
  const macroScale = options.macroScale ?? 0.22;
  const macroStrength = options.macroStrength ?? 0.18;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWeatherMacroScale = { value: macroScale };
    shader.uniforms.uWeatherMacroStrength = { value: macroStrength };
    shader.uniforms.uWeatherTideMoss = { value: tideMoss ? 1.0 : 0.0 };
    shader.uniforms.uWeatherRainStreaks = { value: rainStreaks ? 1.0 : 0.0 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMekongWorldPos;
        varying vec3 vMekongWorldNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 mkWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mkWp = instanceMatrix * mkWp;
        #endif
        mkWp = modelMatrix * mkWp;
        vMekongWorldPos = mkWp.xyz;
        vec3 mkWn = objectNormal;
        #ifdef USE_INSTANCING
          mkWn = mat3(instanceMatrix) * mkWn;
        #endif
        vMekongWorldNormal = normalize(mat3(modelMatrix) * mkWn);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vMekongWorldPos;
        varying vec3 vMekongWorldNormal;
        uniform float uWeatherMacroScale;
        uniform float uWeatherMacroStrength;
        uniform float uWeatherTideMoss;
        uniform float uWeatherRainStreaks;

        float mkHash2(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float mkNoise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mkHash2(i), mkHash2(i + vec2(1.0, 0.0)), f.x),
            mix(mkHash2(i + vec2(0.0, 1.0)), mkHash2(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float mkFbm2(vec2 p) {
          float s = 0.0;
          s += 0.55 * mkNoise2(p);
          s += 0.30 * mkNoise2(p * 2.13 + vec2(17.3, 9.1));
          s += 0.15 * mkNoise2(p * 4.41 + vec2(43.7, 21.8));
          return s;
        }
        vec2 mkBoxUv(vec3 p, vec3 n) {
          vec3 an = abs(n);
          if (an.y >= an.x && an.y >= an.z) return p.xz;
          if (an.x >= an.z) return p.yz;
          return p.xy;
        }
        float mkDetailHeight2D(vec2 uv) {
          float a = mkNoise2(uv * 2.3);
          float b = mkNoise2(uv * 6.4 + vec2(13.7, 5.1));
          return a * 0.62 + b * 0.38;
        }
        vec3 gMekongDetailGrad = vec3(0.0);`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float macroN = mkFbm2(vMekongWorldPos.xz * uWeatherMacroScale + vMekongWorldPos.y * 0.25);
          float microN = mkNoise2(vMekongWorldPos.xz * 3.7 + vMekongWorldPos.y * 2.9);
          float camDistW = length(cameraPosition - vMekongWorldPos);
          float camDetailFade = 1.0 - smoothstep(14.0, 48.0, camDistW);
          float macroMod = 1.0 + (macroN - 0.5) * uWeatherMacroStrength * 2.0 + (microN - 0.5) * 0.08;
          if (camDetailFade > 0.02) {
            vec3 detailN = normalize(vMekongWorldNormal + vec3(0.0001));
            vec2 duv = mkBoxUv(vMekongWorldPos * 1.65, detailN);
            float h0 = mkDetailHeight2D(duv);
            float hx = mkDetailHeight2D(duv + vec2(0.05, 0.0));
            float hy = mkDetailHeight2D(duv + vec2(0.0, 0.05));
            macroMod += (h0 - 0.5) * 0.14 * camDetailFade;
            vec3 an = abs(detailN);
            vec2 g2 = vec2(hx - h0, hy - h0) / 0.05;
            if (an.y >= an.x && an.y >= an.z) gMekongDetailGrad = vec3(g2.x, 0.0, g2.y);
            else if (an.x >= an.z) gMekongDetailGrad = vec3(0.0, g2.x, g2.y);
            else gMekongDetailGrad = vec3(g2.x, g2.y, 0.0);
          }
          diffuseColor.rgb *= macroMod;

          if (uWeatherRainStreaks > 0.5) {
            float streak = mkFbm2(vec2(vMekongWorldPos.x * 1.8 + vMekongWorldPos.z * 1.8, vMekongWorldPos.y * 0.22));
            float dampBase = 1.0 - smoothstep(1.45, 2.35, vMekongWorldPos.y);
            float streakMask = smoothstep(0.52, 0.82, streak) * (1.0 - abs(vMekongWorldNormal.y));
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.58, 0.60, 0.52), dampBase * 0.45 + streakMask * 0.26);
          }

          if (uWeatherTideMoss > 0.5) {
            float tideN = (mkNoise2(vMekongWorldPos.xz * 1.7) - 0.5) * 0.14;
            float wy = vMekongWorldPos.y + tideN;
            // Capillary wet absorption zone up to +0.44m above river water
            float wetZone = 1.0 - smoothstep(0.05, 0.46, wy);
            // Green-brown river algae band right around tidal waterline (-0.12 .. +0.30)
            float algaeBand = smoothstep(-0.20, 0.02, wy) * (1.0 - smoothstep(0.12, 0.34, wy));
            float algaePatch = smoothstep(0.35, 0.72, mkFbm2(vMekongWorldPos.xz * 2.8 + wy));
            diffuseColor.rgb *= mix(1.0, 0.46, wetZone);
            vec3 algaeCol = vec3(0.09, 0.13, 0.05);
            diffuseColor.rgb = mix(diffuseColor.rgb, algaeCol, algaeBand * algaePatch * 0.72);
          }
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float detailFadeN = 1.0 - smoothstep(14.0, 48.0, length(cameraPosition - vMekongWorldPos));
          if (detailFadeN > 0.02) {
            vec3 viewGradient = (viewMatrix * vec4(gMekongDetailGrad, 0.0)).xyz;
            normal = normalize(normal - viewGradient * 0.14 * detailFadeN);
          }
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          float roughDetail = mkNoise2(vMekongWorldPos.xz * 5.3 + vMekongWorldPos.y * 4.1);
          roughnessFactor = clamp(roughnessFactor + (roughDetail - 0.5) * 0.10, 0.05, 1.0);
        }
        if (uWeatherTideMoss > 0.5) {
          float tideNr = (mkNoise2(vMekongWorldPos.xz * 1.7) - 0.5) * 0.14;
          float wetR = 1.0 - smoothstep(0.04, 0.42, vMekongWorldPos.y + tideNr);
          roughnessFactor = mix(roughnessFactor, 0.15, wetR * 0.85);
        }`,
      );
  };
  material.customProgramCacheKey = () =>
    `mekong-weather-${tideMoss ? 1 : 0}-${rainStreaks ? 1 : 0}-${macroScale.toFixed(2)}`;
  return material;
}

// ============================================================================
// Material Library Singleton Cache
// ============================================================================

interface CachedBaseTextures {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  aoMap: THREE.DataTexture;
  metalnessMap?: THREE.DataTexture;
}

export class MekongMaterialLibrary {
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private baseTextures = new Map<string, CachedBaseTextures>();
  private textures: THREE.Texture[] = [];

  private buildPBR(
    cfg: PBRMaterialConfig,
    familyKey: string,
    createBuffers: () => PBRChannelBuffers,
  ): THREE.MeshStandardMaterial {
    const size = cfg.size ?? 256;
    const rx = cfg.repeatX ?? 1;
    const ry = cfg.repeatY ?? 1;

    let base = this.baseTextures.get(familyKey);
    if (!base) {
      const buffers = createBuffers();
      const map = makeDataTex(buffers.albedo, size, true, 1, 1);
      const normalMap = makeDataTex(heightToNormalRGBA(buffers.height, size, 3.0), size, false, 1, 1);
      const roughnessMap = makeDataTex(grayToRGBA(buffers.roughness, size), size, false, 1, 1);
      const aoMap = makeDataTex(heightToGrayRGBA(buffers.height, size, true), size, false, 1, 1);
      this.textures.push(map, normalMap, roughnessMap, aoMap);

      let metalnessMap: THREE.DataTexture | undefined;
      if (buffers.metalness) {
        metalnessMap = makeDataTex(grayToRGBA(buffers.metalness, size), size, false, 1, 1);
        this.textures.push(metalnessMap);
      }
      base = { map, normalMap, roughnessMap, aoMap, metalnessMap };
      this.baseTextures.set(familyKey, base);
    }

    const withRepeat = (src: THREE.DataTexture): THREE.DataTexture => {
      if (rx === 1 && ry === 1) return src;
      const cloned = src.clone();
      cloned.repeat.set(rx, ry);
      cloned.needsUpdate = true;
      this.textures.push(cloned);
      return cloned;
    };

    const map = withRepeat(base.map);
    const normalMap = withRepeat(base.normalMap);
    const roughnessMap = withRepeat(base.roughnessMap);
    const aoMap = withRepeat(base.aoMap);
    const metalnessMap = base.metalnessMap ? withRepeat(base.metalnessMap) : undefined;

    const matParams: THREE.MeshStandardMaterialParameters = {
      name: cfg.id,
      map,
      normalMap,
      normalScale: new THREE.Vector2(cfg.normalScale ?? 1.0, cfg.normalScale ?? 1.0),
      roughnessMap,
      roughness: cfg.roughness ?? 1.0,
      metalness: cfg.metalness ?? (metalnessMap ? 1.0 : 0.0),
      aoMap,
      aoMapIntensity: 0.62,
      envMapIntensity: 0.55,
    };
    if (metalnessMap) {
      matParams.metalnessMap = metalnessMap;
    }
    const mat = new THREE.MeshStandardMaterial(matParams);

    if (cfg.weathering) {
      injectMekongWeathering(mat, cfg.weathering);
    }

    this.materials.set(cfg.id, mat);
    return mat;
  }

  getWoodPlank(repeatX = 2, repeatY = 2, dark = false): THREE.MeshStandardMaterial {
    const family = `wood-${dark ? 'd' : 'l'}`;
    const key = `${family}-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.15,
        weathering: { tideMoss: true, macroScale: 0.25, macroStrength: 0.2 },
      },
      family,
      () => genWoodPlank(512, dark),
    );
  }

  getPilingBark(repeatX = 1, repeatY = 3): THREE.MeshStandardMaterial {
    const key = `bark-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.35,
        weathering: { tideMoss: true, macroScale: 0.3, macroStrength: 0.16 },
      },
      'bark',
      () => genPilingBark(512),
    );
  }

  getYinYangTile(repeatX = 4, repeatY = 3): THREE.MeshStandardMaterial {
    const key = `yinyang-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.55,
        weathering: { tideMoss: false, macroScale: 0.18, macroStrength: 0.22 },
      },
      'yinyang',
      () => genYinYangTile(512),
    );
  }

  getLimeStucco(
    variant: 'ochre' | 'cream' | 'sage' | 'khmerCream',
    repeatX = 1,
    repeatY = 1,
  ): THREE.MeshStandardMaterial {
    const family = `stucco-${variant}`;
    const key = `${family}-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const tintMap: Record<typeof variant, [number, number, number]> = {
      ochre: [216, 178, 102],
      cream: [222, 212, 186],
      sage: [176, 188, 162],
      khmerCream: [226, 214, 184],
    };
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 0.72,
        weathering: { tideMoss: false, rainStreaks: true, macroScale: 0.22, macroStrength: 0.16 },
      },
      family,
      () => genLimeStucco(512, tintMap[variant]),
    );
  }

  getGachTau(repeatX = 4, repeatY = 4): THREE.MeshStandardMaterial {
    const key = `gachtau-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.1,
        weathering: { tideMoss: false, macroScale: 0.14, macroStrength: 0.2 },
      },
      'gachtau',
      () => genGachTau(512),
    );
  }

  getAgedBrick(repeatX = 3, repeatY = 2): THREE.MeshStandardMaterial {
    const key = `brick-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.25,
        weathering: { tideMoss: true, rainStreaks: true, macroScale: 0.2, macroStrength: 0.2 },
      },
      'brick',
      () => genAgedBrick(512),
    );
  }

  getCorrugatedTin(repeatX = 2, repeatY = 2): THREE.MeshStandardMaterial {
    const key = `tin-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.5,
        weathering: { tideMoss: false, macroScale: 0.28, macroStrength: 0.22 },
      },
      'tin',
      () => genCorrugatedTin(512),
    );
  }

  getNipaThatch(repeatX = 3, repeatY = 2): THREE.MeshStandardMaterial {
    const key = `thatch-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.3,
        weathering: { tideMoss: false, macroScale: 0.25, macroStrength: 0.18 },
      },
      'thatch',
      () => genNipaThatch(512),
    );
  }

  getStoneGranite(repeatX = 4, repeatY = 1): THREE.MeshStandardMaterial {
    const key = `granite-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.2,
        weathering: { tideMoss: true, macroScale: 0.2, macroStrength: 0.18 },
      },
      'granite',
      () => genStoneGranite(512),
    );
  }

  getKhmerTile(repeatX = 3, repeatY = 3): THREE.MeshStandardMaterial {
    const key = `khmertile-${repeatX}-${repeatY}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 512,
        repeatX,
        repeatY,
        normalScale: 1.2,
        weathering: { tideMoss: false, macroScale: 0.2, macroStrength: 0.12 },
      },
      'khmertile',
      () => genKhmerRoofTile(512),
    );
  }

  getDaBoCeramic(): THREE.MeshStandardMaterial {
    const key = 'dabo-ceramic';
    const existing = this.materials.get(key);
    if (existing) return existing;
    return this.buildPBR(
      {
        id: key,
        size: 256,
        repeatX: 2,
        repeatY: 1,
        normalScale: 0.85,
      },
      'dabo-ceramic',
      () => genDaBoCeramic(256),
    );
  }

  /**
   * Painted Cần Thơ Boat Eye decal ("Mắt Ghe") canvas texture
   */
  createMatGheTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 128);

    // Traditional crimson bow backdrop sweep
    ctx.fillStyle = '#9f231b';
    ctx.beginPath();
    ctx.moveTo(10, 64);
    ctx.quadraticCurveTo(95, 16, 240, 24);
    ctx.lineTo(240, 104);
    ctx.quadraticCurveTo(95, 112, 10, 64);
    ctx.closePath();
    ctx.fill();

    // Crisp white border
    ctx.strokeStyle = '#f3ede0';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Round white sclera
    ctx.fillStyle = '#f7f3ea';
    ctx.beginPath();
    ctx.ellipse(116, 64, 40, 29, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Large black pupil ("tròng đen choán gần hết mắt" - Cần Thơ style)
    ctx.fillStyle = '#111214';
    ctx.beginPath();
    ctx.ellipse(112, 64, 24, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle specular glint & gold corner lash
    ctx.fillStyle = '#fffdf8';
    ctx.beginPath();
    ctx.arc(104, 56, 5, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textures.push(tex);
    return tex;
  }

  /**
   * Weathered Vietnamese heritage shophouse signboard texture
   */
  createSignboardTexture(
    title: string,
    subtitle: string,
    bgHex = '#f1e4c3',
    borderHex = '#6b2718',
    textHex = '#591c11',
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 160);

    // Subtle aged stain patches
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(i * 19.3) * 0.5 + 0.5) * 512;
      const y = (Math.cos(i * 41.7) * 0.5 + 0.5) * 160;
      const r = 12 + (i % 24);
      ctx.fillStyle = `rgba(92, 68, 42, ${0.03 + (i % 5) * 0.015})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 492, 140);
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 472, 120);

    ctx.fillStyle = textHex;
    ctx.font = 'bold 42px "Playfair Display", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 66);

    ctx.fillStyle = '#3d2c1e';
    ctx.font = '600 22px "Be Vietnam Pro", sans-serif';
    ctx.fillText(subtitle, 256, 114);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textures.push(tex);
    return tex;
  }

  /**
   * Alpha-cutout botanical leaf cluster texture (with midribs & venation)
   */
  createLeafClusterTexture(kind: 'banyan' | 'orchard' | 'bamboo'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 256);

    const leafCount = kind === 'bamboo' ? 14 : 11;
    for (let i = 0; i < leafCount; i++) {
      const ang = (i / leafCount) * Math.PI * 2 + Math.sin(i * 7.1) * 0.25;
      const dist = kind === 'bamboo' ? 38 + (i % 3) * 16 : 26 + (i % 3) * 18;
      const cx = 128 + Math.cos(ang) * dist * 0.65;
      const cy = 128 + Math.sin(ang) * dist * 0.65;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);

      const len = kind === 'bamboo' ? 68 : 54;
      const wid = kind === 'bamboo' ? 11 : 24;

      const shade = 0.8 + ((i * 37) % 10) * 0.03;
      const r = Math.round((kind === 'bamboo' ? 76 : 56) * shade);
      const g = Math.round((kind === 'bamboo' ? 118 : 106) * shade);
      const b = Math.round((kind === 'bamboo' ? 42 : 38) * shade);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
      ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
      ctx.fill();

      // Central midrib vein
      ctx.strokeStyle = `rgba(148, 178, 86, 0.55)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(len * 0.9, 0);
      ctx.stroke();

      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.textures.push(tex);
    return tex;
  }

  dispose(): void {
    for (const m of this.materials.values()) m.dispose();
    for (const t of this.textures) t.dispose();
    this.materials.clear();
    this.baseTextures.clear();
    this.textures = [];
  }
}

import * as THREE from 'three';
import { applyHueSurface, HUE_SHARED, makeArmFromHeightRough, photoSet } from './HueSurface';
import type { PhotoSet, SurfaceOptions } from './HueSurface';

function fract(v: number): number {
  return v - Math.floor(v);
}

function hash2D(x: number, y: number, seed = 1): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return fract(n);
}

function tileableNoise(u: number, v: number, freq: number, seed = 1): number {
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

function tileableFbm(u: number, v: number, baseFreq: number, octaves = 4, seed = 1): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileableNoise(u, v, freq, seed + i * 17);
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

interface PBRMaps {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  arm: THREE.DataTexture;
}

function buildNormalFromHeight(
  height: Float32Array,
  size: number,
  strength: number,
): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
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

      const dX = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dY = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = clampByte((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function finalizeTexture(
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
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeMaps(
  size: number,
  normalStrength: number,
  repeatX: number,
  repeatY: number,
  sampler: (
    u: number,
    v: number,
  ) => { r: number; g: number; b: number; h: number; rough: number },
): PBRMaps {
  const albedo = new Uint8Array(size * size * 4);
  const roughData = new Uint8Array(size * size * 4);
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
      roughData[idx] = rv;
      roughData[idx + 1] = rv;
      roughData[idx + 2] = rv;
      roughData[idx + 3] = 255;
    }
  }

  const map = finalizeTexture(albedo, size, true, repeatX, repeatY);
  const roughnessMap = finalizeTexture(roughData, size, false, repeatX, repeatY);
  const normalMap = buildNormalFromHeight(height, size, normalStrength);
  normalMap.repeat.set(repeatX, repeatY);
  normalMap.anisotropy = 8;
  const arm = makeArmFromHeightRough(height, roughData, size);
  return { map, normalMap, roughnessMap, arm };
}

export interface HueMaterialSet {
  // Chùa Thiên Mụ materials
  hueBrick: THREE.MeshStandardMaterial;
  hueLimeRose: THREE.MeshStandardMaterial;
  hueLimeWall: THREE.MeshStandardMaterial;
  phapLamJade: THREE.MeshPhysicalMaterial;
  phapLamCobalt: THREE.MeshPhysicalMaterial;
  ngoiTerracotta: THREE.MeshStandardMaterial;

  // Lăng Tự Đức & Cầu Ngói & Nhà Rường materials
  ngoiLuuLyGold: THREE.MeshPhysicalMaterial;
  ngoiLuuLyGreen: THREE.MeshPhysicalMaterial;
  goLimAged: THREE.MeshStandardMaterial;
  goLimLacquered: THREE.MeshPhysicalMaterial;
  sonSonThepVang: THREE.MeshPhysicalMaterial;

  // Stone & Masonry
  daThanh: THREE.MeshStandardMaterial;
  daThanhStairs: THREE.MeshStandardMaterial;
  daHocMortar: THREE.MeshStandardMaterial;

  // Lăng Khải Định materials
  khaiDinhConcrete: THREE.MeshStandardMaterial;
  khaiDinhRelief: THREE.MeshStandardMaterial;
  khaiDinhDarkTrim: THREE.MeshStandardMaterial;
  porcelainMosaicWall: THREE.MeshPhysicalMaterial;
  porcelainMosaicWallWide: THREE.MeshPhysicalMaterial;
  porcelainMosaicBuuTan: THREE.MeshPhysicalMaterial;
  porcelainMosaicCeiling: THREE.MeshPhysicalMaterial;
  marbleTileFloor: THREE.MeshPhysicalMaterial;
  giltBronze: THREE.MeshStandardMaterial;
  antiqueBronzeBell: THREE.MeshStandardMaterial;

  // Cầu Trường Tiền & Village
  eiffelSilverSteel: THREE.MeshStandardMaterial;
  eiffelWroughtIron: THREE.MeshStandardMaterial;
  ochreVillagePlaster: THREE.MeshStandardMaterial;
  bambooWoven: THREE.MeshStandardMaterial;

  // Utility dynamic weather hook
  setRainWetness: (wetness: number) => void;
}

export function createHueMaterialFoundry(): HueMaterialSet {
  const disposableTextures: THREE.Texture[] = [];
  const track = (maps: PBRMaps) => {
    disposableTextures.push(maps.map, maps.normalMap, maps.roughnessMap, maps.arm);
    return maps;
  };

  // 4. Pháp Lam Men Ngọc & Men Chàm (Tháp Phước Duyên plaques & Cù Dao)
  const buildPhapLam = (baseR: number, baseG: number, baseB: number, seed: number) =>
    track(
      makeMaps(256, 2.5, 1, 1, (u, v) => {
        const border =
          u < 0.09 || u > 0.91 || v < 0.09 || v > 0.91
            ? 1
            : u < 0.13 || u > 0.87 || v < 0.13 || v > 0.87
              ? 0.5
              : 0;
        const swirl = Math.sin(u * Math.PI * 6) * Math.cos(v * Math.PI * 6);
        const craze = 1 - smoothstep(0.0, 0.035, Math.abs(tileableFbm(u, v, 14, 3, seed) - 0.5));
        const sheen = tileableFbm(u, v, 10, 3, seed + 5);

        let r = baseR + (sheen - 0.5) * 26;
        let g = baseG + (sheen - 0.5) * 26;
        let b = baseB + (sheen - 0.5) * 24;

        // Gilt floral / dragon border motif
        if (border > 0.7) {
          r = 188;
          g = 152;
          b = 78;
        } else if (border > 0.3) {
          r = 228;
          g = 216;
          b = 186;
        } else if (Math.abs(swirl) > 0.72) {
          r = lerp(r, 220, 0.4);
          g = lerp(g, 206, 0.4);
          b = lerp(b, 165, 0.4);
        }

        // Subtle enamel crazing
        r -= craze * 18;
        g -= craze * 18;
        b -= craze * 16;

        return {
          r,
          g,
          b,
          h: 0.5 + border * 0.25 + (swirl > 0.7 ? 0.15 : 0) - craze * 0.1,
          rough: border > 0.7 ? 0.32 : 0.18 + craze * 0.22,
        };
      }),
    );

  const phapLamJadeMaps = buildPhapLam(62, 134, 128, 107);
  const phapLamCobaltMaps = buildPhapLam(38, 78, 138, 119);

  // 10. Phù Điêu Rồng Mây Lăng Khải Định (Refined grey carved limestone relief, isotropic grain)
  const khaiDinhReliefMaps = track(
    makeMaps(512, 3.6, 1, 1, (u, v) => {
      const warpX = tileableFbm(u, v, 6, 3, 619) * 0.28;
      const warpY = tileableFbm(u + 0.3, v + 0.7, 6, 3, 629) * 0.28;
      const carving = tileableFbm(u + warpX, v + warpY, 12, 4, 631);
      const micro = tileableFbm(u, v, 32, 3, 641);
      const ridge = smoothstep(0.36, 0.68, carving);
      const mold = smoothstep(0.32, 0.75, (1 - ridge) * 0.6 + micro * 0.4);

      const r = lerp(142, 66, mold) + (micro - 0.5) * 14;
      const g = lerp(140, 68, mold) + (micro - 0.5) * 14;
      const b = lerp(134, 65, mold) + (micro - 0.5) * 14;

      return {
        r,
        g,
        b,
        h: ridge * 0.68 + (micro - 0.5) * 0.2,
        rough: lerp(0.72, 0.94, mold),
      };
    }),
  );

  // 11. Nghệ Thuật Khảm Sành Sứ & Thủy Tinh Màu (Cung Thiên Định Crown Jewel!)
  const buildPorcelainMosaic = (
    mode: 'wall' | 'wallWide' | 'buutan' | 'ceiling',
  ) =>
    track(
      makeMaps(
        512,
        3.8,
        mode === 'wallWide' ? 6 : mode === 'wall' ? 2 : 1,
        mode === 'wallWide' ? 2 : mode === 'wall' ? 2 : 1,
        (u, v) => {
          const cells = mode === 'buutan' ? 30 : mode === 'ceiling' ? 24 : 56;
          const gu = u * cells;
          const gv = v * cells;
          const cu = Math.floor(gu);
          const cv = Math.floor(gv);

          let minD1 = 99;
          let minD2 = 99;
          let bestSeed = 0;
          let tiltX = 0;
          let tiltY = 0;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nu = (((cu + dx) % cells) + cells) % cells;
              const nv = (((cv + dy) % cells) + cells) % cells;
              const jx = cu + dx + 0.18 + 0.64 * hash2D(nu, nv, 701);
              const jy = cv + dy + 0.18 + 0.64 * hash2D(nu, nv, 709);
              const dist = Math.hypot(gu - jx, gv - jy);
              if (dist < minD1) {
                minD2 = minD1;
                minD1 = dist;
                bestSeed = hash2D(nu, nv, 719);
                tiltX = hash2D(nu, nv, 727) - 0.5;
                tiltY = hash2D(nu, nv, 733) - 0.5;
              } else if (dist < minD2) {
                minD2 = dist;
              }
            }
          }

          const edge = minD2 - minD1;
          const shardMask = smoothstep(0.035, 0.085, edge);

          // Ornamental floral/dragon color zones using warped organic curves
          const warp = tileableFbm(u, v, 4, 3, 743) * 0.45;
          const motif =
            Math.sin((u + warp) * Math.PI * 4) * Math.cos((v + warp) * Math.PI * 4);

          let sr = 198;
          let sg = 190;
          let sb = 175;

          if (mode === 'buutan') {
            const fold = Math.sin(u * Math.PI * 10 + v * 2.2);
            if (fold > 0.42) {
              sr = 212;
              sg = 158;
              sb = 42;
            } else if (fold > -0.1) {
              sr = 26;
              sg = 124;
              sb = 92;
            } else if (fold > -0.55) {
              sr = 164;
              sg = 38;
              sb = 36;
            } else {
              sr = 34;
              sg = 74;
              sb = 166;
            }
          } else if (mode === 'ceiling') {
            const cloud = tileableFbm(u, v, 5, 4, 751);
            if (Math.abs(motif) > 0.36) {
              sr = 190;
              sg = 150;
              sb = 70;
            } else if (cloud > 0.5) {
              sr = 226;
              sg = 218;
              sb = 196;
            } else {
              sr = 150;
              sg = 160;
              sb = 166;
            }
          } else {
            // Cung Thiên Định walls: ivory & blue-and-white porcelain shards (broken bowls/plates)
            // forming floral tableaux, with celadon leaves, rouge petals and amber hearts.
            const lu = (gu - cu), lv = (gv - cv);
            const brush = Math.sin((lu * 3.1 + lv * 1.7 + bestSeed * 9.0) * 3.0) > 0.55 && bestSeed > 0.35;
            const blossom = tileableFbm(u + warp * 0.3, v, 5, 3, 761);
            const sprig = tileableFbm(u, v + warp * 0.3, 7, 3, 787);
            if (blossom > 0.68) {
              sr = 190 + bestSeed * 40; sg = 88 + bestSeed * 50; sb = 98 + bestSeed * 34;
            } else if (blossom > 0.64) {
              sr = 206; sg = 160; sb = 66;
            } else if (sprig > 0.62 || motif > 0.62) {
              sr = 66 + bestSeed * 40; sg = 124 + bestSeed * 40; sb = 90 + bestSeed * 30;
            } else if (brush) {
              sr = 52; sg = 84; sb = 150;
            } else {
              const tone = 214 + (bestSeed - 0.5) * 26;
              sr = tone; sg = tone - 4; sb = tone - 16 + (bestSeed > 0.7 ? 14 : 0);
            }
          }

          // Darker recessed lime mortar grout so ceramic shards pop vividly
          const groutR = 78;
          const groutG = 72;
          const groutB = 64;

          const lx = ((gu - cu) - 0.5) * tiltX;
          const ly = ((gv - cv) - 0.5) * tiltY;
          const shardH = 0.68 + bestSeed * 0.2 + lx * 0.32 + ly * 0.32;

          return {
            r: lerp(groutR, sr, shardMask),
            g: lerp(groutG, sg, shardMask),
            b: lerp(groutB, sb, shardMask),
            h: shardMask * shardH,
            rough: lerp(0.92, 0.16 + bestSeed * 0.1, shardMask),
          };
        },
      ),
    );

  const mosaicWallMaps = buildPorcelainMosaic('wall');
  const mosaicWallWideMaps = buildPorcelainMosaic('wallWide');
  const mosaicBuuTanMaps = buildPorcelainMosaic('buutan');
  const mosaicCeilingMaps = buildPorcelainMosaic('ceiling');

  // 12. Đá Hoa Cẩm Thạch Cung Thiên Định (Checkered colonial-imperial marble tile floor)
  const marbleMaps = track(
    makeMaps(512, 1.5, 5, 5, (u, v) => {
      const n = 4;
      const ix = Math.floor(u * n);
      const iy = Math.floor(v * n);
      const fx = u * n - ix;
      const fy = v * n - iy;
      const grout = smoothstep(0.0, 0.03, fx) * (1 - smoothstep(0.97, 1.0, fx)) *
        smoothstep(0.0, 0.03, fy) * (1 - smoothstep(0.97, 1.0, fy));
      const checker = (ix + iy) % 2 === 0;
      const vein = smoothstep(0.42, 0.54, tileableFbm(u * 2, v * 2, 6, 4, 809));
      const base = checker ? 216 : 64;
      const accent = checker ? 168 : 112;
      const val = lerp(base, accent, vein * 0.45);
      return {
        r: lerp(95, val, grout),
        g: lerp(92, val * 0.98, grout),
        b: lerp(88, val * 0.94, grout),
        h: grout * 0.7,
        rough: lerp(0.75, 0.24, grout),
      };
    }),
  );

  // 13. Thép Nhũ Bạc Đinh Tán Cầu Trường Tiền
  const steelMaps = track(
    makeMaps(256, 2.2, 2, 1, (u, v) => {
      const f = tileableFbm(u, v, 12, 3, 907);
      const rust = smoothstep(0.68, 0.9, tileableFbm(u, v, 8, 4, 919));
      const rivetX = Math.abs((u * 8) % 1 - 0.5);
      const rivetY = Math.abs((v * 4) % 1 - 0.5);
      const rivet = 1 - smoothstep(0.1, 0.2, Math.hypot(rivetX, rivetY));

      let r = 178 + (f - 0.5) * 24 + rivet * 18;
      let g = 182 + (f - 0.5) * 24 + rivet * 18;
      let b = 186 + (f - 0.5) * 22 + rivet * 16;

      r = lerp(r, 128, rust * 0.55);
      g = lerp(g, 82, rust * 0.55);
      b = lerp(b, 58, rust * 0.55);

      return {
        r,
        g,
        b,
        h: 0.45 + rivet * 0.45 + (f - 0.5) * 0.1,
        rough: lerp(0.38, 0.82, rust),
      };
    }),
  );

  const bambooMaps = track(
    makeMaps(256, 3.0, 3, 2, (u, v) => {
      const wx = Math.floor(u * 12);
      const wy = Math.floor(v * 12);
      const fx = u * 12 - wx;
      const fy = v * 12 - wy;
      const over = (wx + wy) % 2 === 0;
      const strip = over ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
      const f = tileableFbm(u, v, 16, 2, 977);
      return {
        r: 138 * (0.65 + 0.35 * strip) + (f - 0.5) * 20,
        g: 106 * (0.65 + 0.35 * strip) + (f - 0.5) * 16,
        b: 64 * (0.65 + 0.35 * strip) + (f - 0.5) * 12,
        h: strip * 0.7 + 0.15,
        rough: 0.72,
      };
    }),
  );

  // ---------------------------------------------------------------------------
  // Instantiate materials: photo-scanned CC0 surfaces + Huế weathering surface model.
  // Albedo targets calibrated against field photography of each monument.
  // ---------------------------------------------------------------------------
  const S = (params: THREE.MeshStandardMaterialParameters, o: SurfaceOptions) =>
    applyHueSurface(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...params }), o);
  const P = (params: THREE.MeshPhysicalMaterialParameters, o: SurfaceOptions) =>
    applyHueSurface(new THREE.MeshPhysicalMaterial({ roughness: 1, metalness: 0, ...params }), o) as THREE.MeshPhysicalMaterial;
  const proc = (m: PBRMaps): PhotoSet => ({ color: m.map, normal: m.normalMap, arm: m.arm });

  const brickSet = photoSet('brick');
  const plasterSet = photoSet('plaster');
  const roofSet = photoSet('roof');
  const slabSet = photoSet('slab');
  const rubbleSet = photoSet('rubble');
  const concreteSet = photoSet('concrete');
  const woodSet = photoSet('wood');

  // Tháp Phước Duyên: fired brick with remnant lime render, monsoon-darkened
  const hueBrick = S({}, { set: brickSet, scale: 1.25, saturation: 0.72, tint: 0xd9b8a8, streaks: 0.6, damp: 0.75, moss: 0.4, normalStrength: 1.2 });
  // Faded rose lime-wash frames
  const hueLimeRose = S({}, { set: plasterSet, scale: 2.2, saturation: 0.18, tint: new THREE.Color(1.55, 1.12, 1.02), streaks: 0.75, damp: 0.7, moss: 0.35 });
  // Aged lime plaster walls (vôi vữa)
  const hueLimeWall = S({}, { set: plasterSet, scale: 2.4, saturation: 0.3, tint: new THREE.Color(1.42, 1.36, 1.2), streaks: 0.8, damp: 0.8, moss: 0.45 });
  const phapLamJade = new THREE.MeshPhysicalMaterial({ map: phapLamJadeMaps.map, normalMap: phapLamJadeMaps.normalMap, roughnessMap: phapLamJadeMaps.roughnessMap, clearcoat: 0.9, clearcoatRoughness: 0.14, normalScale: new THREE.Vector2(0.8, 0.8) });
  const phapLamCobalt = new THREE.MeshPhysicalMaterial({ map: phapLamCobaltMaps.map, normalMap: phapLamCobaltMaps.normalMap, roughnessMap: phapLamCobaltMaps.roughnessMap, clearcoat: 0.92, clearcoatRoughness: 0.12, normalScale: new THREE.Vector2(0.8, 0.8) });
  // Unglazed fish-scale terracotta (ngói vảy) with moss in the laps — uv-mapped along roof slope
  const ngoiTerracotta = S({ side: THREE.DoubleSide }, { set: roofSet, uvMode: true, scale: 1.7, saturation: 0.85, tint: 0xf0d2c4, moss: 0.55, damp: 0, streaks: 0.25, normalStrength: 1.3 });
  // Imperial yellow & celadon glazed tube tiles (ngói ống lưu ly)
  const ngoiLuuLyGold = P({ side: THREE.DoubleSide, clearcoat: 0.55, clearcoatRoughness: 0.22 }, { set: roofSet, uvMode: true, scale: 1.7, saturation: 0, tint: new THREE.Color(2.5, 1.55, 0.32), roughMul: 0.42, moss: 0.25, damp: 0, streaks: 0.35, ribs: 13, porous: 0.25, normalStrength: 0.7 });
  const ngoiLuuLyGreen = P({ side: THREE.DoubleSide, clearcoat: 0.55, clearcoatRoughness: 0.22 }, { set: roofSet, uvMode: true, scale: 1.7, saturation: 0, tint: new THREE.Color(0.55, 1.45, 1.05), roughMul: 0.42, moss: 0.25, damp: 0, streaks: 0.35, ribs: 13, porous: 0.25, normalStrength: 0.7 });
  // Gỗ lim: dense dark ironwood, sun-greyed
  const goLimAged = S({}, { set: woodSet, scale: 1.6, saturation: 0.45, tint: new THREE.Color(0.95, 0.8, 0.72), damp: 0.25, streaks: 0.15, moss: 0.05, porous: 0.6 });
  // Sơn son: cinnabar lacquer over wood, grain telegraphing through
  const goLimLacquered = P({ color: 0x7a1f18, clearcoat: 0.6, clearcoatRoughness: 0.32 }, { set: woodSet, scale: 1.8, saturation: 0, tint: new THREE.Color(3.2, 3.2, 3.2), roughMul: 0.55, normalStrength: 0.35, damp: 0.3, streaks: 0.1, moss: 0, porous: 0.2, macro: 0.35 });
  const sonSonThepVang = new THREE.MeshPhysicalMaterial({ color: 0xc99a3e, metalness: 0.85, roughness: 0.34, clearcoat: 0.3, normalMap: khaiDinhReliefMaps.normalMap, normalScale: new THREE.Vector2(0.8, 0.8) });
  // Đá thanh: blue-grey Thanh Hóa limestone
  const daThanh = S({}, { set: slabSet, scale: 3.2, saturation: 0.12, tint: new THREE.Color(1.15, 1.25, 1.36), damp: 0.55, moss: 0.5, streaks: 0.3 });
  const daThanhStairs = S({}, { set: slabSet, scale: 2.6, saturation: 0.12, tint: new THREE.Color(1.1, 1.2, 1.3), damp: 0.6, moss: 0.6, streaks: 0.25, normalStrength: 1.2 });
  // Đá hộc: polygonal rubble masonry with lime pointing
  const daHocMortar = S({}, { set: rubbleSet, scale: 2.8, saturation: 0.55, tint: new THREE.Color(1.1, 1.1, 1.05), damp: 0.6, moss: 0.45, streaks: 0.45, normalStrength: 1.3 });
  // Khải Định: 1920s cement render blackened by lichen & rain-run mould
  const khaiDinhConcrete = S({}, { set: concreteSet, scale: 3.4, saturation: 0.25, tint: new THREE.Color(0.86, 0.86, 0.84), streaks: 1.0, damp: 0.85, moss: 0.3, normalStrength: 1.1 });
  const khaiDinhRelief = S({}, { set: concreteSet, scale: 2.2, saturation: 0.2, tint: new THREE.Color(0.78, 0.78, 0.76), streaks: 1.0, damp: 0.8, moss: 0.35, normalStrength: 1.6 });
  const khaiDinhDarkTrim = S({}, { set: concreteSet, scale: 2.6, saturation: 0.2, tint: new THREE.Color(0.5, 0.51, 0.49), streaks: 0.7, damp: 0.7, moss: 0.25 });
  const mosaicOpts = { streaks: 0, damp: 0, moss: 0, porous: 0, macro: 0.12, aoStrength: 0.7, normalStrength: 1.1 };
  const porcelainMosaicWall = P({ clearcoat: 0.85, clearcoatRoughness: 0.16 }, { set: proc(mosaicWallMaps), scale: 2.6, ...mosaicOpts });
  const porcelainMosaicWallWide = P({ clearcoat: 0.85, clearcoatRoughness: 0.16 }, { set: proc(mosaicWallWideMaps), scale: 2.6, ...mosaicOpts });
  const porcelainMosaicBuuTan = P({ clearcoat: 0.9, clearcoatRoughness: 0.12 }, { set: proc(mosaicBuuTanMaps), scale: 1.6, ...mosaicOpts });
  const porcelainMosaicCeiling = P({ clearcoat: 0.6, clearcoatRoughness: 0.25 }, { set: proc(mosaicCeilingMaps), scale: 4.0, saturation: 0.85, ...mosaicOpts });
  const marbleTileFloor = P({ clearcoat: 0.55, clearcoatRoughness: 0.18 }, { set: proc(marbleMaps), scale: 2.4, streaks: 0, damp: 0, moss: 0, porous: 0, macro: 0.25, normalStrength: 0.5 });
  const giltBronze = new THREE.MeshStandardMaterial({ color: 0xc9973c, metalness: 0.92, roughness: 0.3, normalMap: khaiDinhReliefMaps.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  const antiqueBronzeBell = new THREE.MeshStandardMaterial({ color: 0x3e3a2c, metalness: 0.75, roughness: 0.5, normalMap: khaiDinhReliefMaps.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
  const eiffelSilverSteel = S({ metalness: 0.65 }, { set: proc(steelMaps), scale: 1.6, streaks: 0.45, damp: 0.2, moss: 0, porous: 0.3, macro: 0.3, roughMul: 0.75 });
  const eiffelWroughtIron = new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.68, roughness: 0.55 });
  // Vôi vàng: ochre lime-washed village & citadel walls
  const ochreVillagePlaster = S({}, { set: plasterSet, scale: 2.2, saturation: 0.2, tint: new THREE.Color(1.9, 1.42, 0.72), streaks: 0.8, damp: 0.8, moss: 0.45 });
  const bambooWoven = S({}, { set: proc(bambooMaps), scale: 1.0, streaks: 0.2, damp: 0.3, moss: 0.1 });

  const setRainWetness = (wetness: number) => {
    const w = Math.max(0, Math.min(1, wetness));
    HUE_SHARED.hWetness.value = w;
  };

  return {
    hueBrick,
    hueLimeRose,
    hueLimeWall,
    phapLamJade,
    phapLamCobalt,
    ngoiTerracotta,
    ngoiLuuLyGold,
    ngoiLuuLyGreen,
    goLimAged,
    goLimLacquered,
    sonSonThepVang,
    daThanh,
    daThanhStairs,
    daHocMortar,
    khaiDinhConcrete,
    khaiDinhRelief,
    khaiDinhDarkTrim,
    porcelainMosaicWall,
    porcelainMosaicWallWide,
    porcelainMosaicBuuTan,
    porcelainMosaicCeiling,
    marbleTileFloor,
    giltBronze,
    antiqueBronzeBell,
    eiffelSilverSteel,
    eiffelWroughtIron,
    ochreVillagePlaster,
    bambooWoven,
    setRainWetness,
  };
}

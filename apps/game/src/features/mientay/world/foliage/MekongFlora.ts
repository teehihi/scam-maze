import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SeededRNG, clamp, lerp } from '../math/Noise';
import {
  WATER_LEVEL,
  sampleEastCanalDistance,
  sampleMainRiverDistance,
  sampleTerrainInfo,
} from '../terrain/MekongHeightfield';
import { MekongMaterialLibrary } from '../materials/ProceduralPBR';
import { sampleRiverWave } from '../water/MekongWater';

export interface FloraSystem {
  group: THREE.Group;
  update: (
    elapsedTime: number,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
    fogColor: THREE.Color,
    fogDensity: number,
  ) => void;
  dispose: () => void;
}

// ============================================================================
// Exclusion zones so trees/grass never clip into buildings, paths, or bridges
// ============================================================================
function isProtectedFootprint(x: number, z: number): boolean {
  // Mansion & Shophouses courtyard (x: 24..82, z: 22..72)
  if (x > 22 && x < 84 && z > 20 && z < 74) return true;
  // Stilt Village boardwalks & houses (x: 15..44, z: -15..21)
  if (x > 14 && x < 44 && z > -16 && z < 21) return true;
  // Khmer Pagoda terrace & plaza (x: -74..-34, z: -12..28)
  if (x > -76 && x < -33 && z > -13 && z < 29) return true;
  // Main river bridge corridor (x: -44..22, z: -72..-60)
  if (x > -44 && x < 22 && z > -73 && z < -59) return true;
  // Canal bridges (wooden bridge x:22..31, monkey bridge x:44..52, z:-39..-14)
  if (x > 21 && x < 32 && z > -40 && z < -13) return true;
  if (x > 43 && x < 53 && z > -40 && z < -13) return true;
  // Lotus pond water basin (70, -74) radius 11.5
  if (Math.hypot(x - 70, z + 74) < 12.0) return true;
  return false;
}

// ============================================================================
// Wind + Subsurface Scattering Shader Injection for Palms & Foliage
// ============================================================================
function injectFoliageWindSSS(
  mat: THREE.MeshStandardMaterial,
  windStrength = 0.22,
  sssTint = new THREE.Color(0x88b824),
  uniformTracker: Array<{ uTime: { value: number }; uSunDir: { value: THREE.Vector3 }; uSunColor: { value: THREE.Color } }>,
  keepCustomNormals = false,
): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindAmp = { value: windStrength };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0.5, 0.5, 0.5) };
    shader.uniforms.uSunColor = { value: new THREE.Color(0xffe4b5) };
    shader.uniforms.uSssTint = { value: sssTint };
    uniformTracker.push(shader.uniforms as { uTime: { value: number }; uSunDir: { value: THREE.Vector3 }; uSunColor: { value: THREE.Color } });

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWindAmp;
        varying vec3 vFolWorldPos;
        varying float vFolHeightFactor;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 fWp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fWp = instanceMatrix * fWp;
        #endif
        fWp = modelMatrix * fWp;
        float swayPhase = fWp.x * 0.28 + fWp.z * 0.21 + uTime * 1.45;
        float gust = sin(swayPhase) * 0.65 + sin(swayPhase * 2.3 + fWp.y * 0.6) * 0.35;
        float hf = clamp(uv.y, 0.0, 1.0);
        transformed.x += gust * uWindAmp * hf * hf;
        transformed.z += cos(swayPhase * 0.85) * uWindAmp * 0.55 * hf * hf;
        vFolHeightFactor = hf;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 fWpOut = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          fWpOut = instanceMatrix * fWpOut;
        #endif
        fWpOut = modelMatrix * fWpOut;
        vFolWorldPos = fWpOut.xyz;`,
      );

    if (keepCustomNormals) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace(
          'normal *= faceDirection;',
          '// preserve rounded canopy normal',
        ),
      );
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSssTint;
        varying vec3 vFolWorldPos;
        varying float vFolHeightFactor;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `{
          vec3 V = normalize(cameraPosition - vFolWorldPos);
          vec3 L = normalize(uSunDir);
          float backLit = pow(max(dot(-V, L), 0.0), 3.0);
          float sunUp = smoothstep(-0.05, 0.25, L.y);
          gl_FragColor.rgb += uSssTint * uSunColor * backLit * (0.28 + 0.42 * vFolHeightFactor) * sunUp;
        }
        #include <dithering_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `foliage-sss-${windStrength.toFixed(2)}-${keepCustomNormals ? 1 : 0}`;
  return mat;
}

// ============================================================================
// 1. Curved Ringed Coconut Trunk & Arched Pinnate Frond Geometry
// ============================================================================
function buildCoconutTrunkGeometry(height: number, bend: number, baseR: number): THREE.BufferGeometry {
  const segsY = 26;
  const segsR = 9;
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= segsY; iy++) {
    const t = iy / segsY;
    // Graceful S/C palm curve leaning toward light
    const cx = Math.sin(t * Math.PI * 0.72) * bend * 0.6 + t * t * bend * 0.4;
    const cy = t * height;
    const ringWave = 1.0 + Math.sin(t * Math.PI * 36) * 0.045;
    const r = lerp(baseR, baseR * 0.42, Math.pow(t, 0.75)) * ringWave * (iy === 0 ? 1.32 : 1.0);

    // Local tangent slope for tilting ring frame
    const dt = 0.01;
    const t2 = Math.min(1, t + dt);
    const cx2 = Math.sin(t2 * Math.PI * 0.72) * bend * 0.6 + t2 * t2 * bend * 0.4;
    const dx = (cx2 - cx) / dt;
    const dy = height;
    const tilt = Math.atan2(dx, dy);

    for (let ir = 0; ir <= segsR; ir++) {
      const ang = (ir / segsR) * Math.PI * 2;
      const lx = Math.cos(ang) * r;
      const lz = Math.sin(ang) * r;
      const rx = lx * Math.cos(tilt);
      const ry = -lx * Math.sin(tilt);
      verts.push(cx + rx, cy + ry, lz);
      uvs.push(ir / segsR, t * 6);
    }
  }

  const stride = segsR + 1;
  for (let iy = 0; iy < segsY; iy++) {
    for (let ir = 0; ir < segsR; ir++) {
      const a = iy * stride + ir;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a single realistic 3D arched pinnate palm frond with V-folded leaflets along a curved rachis.
 * uv.y stores distance along the frond [0 at stem -> 1 at drooping tip] for wind shader!
 */
function buildPalmFrondGeometry(
  length: number,
  droop: number,
  leafletCount = 22,
  leafletLen = 0.72,
  leafletWidth = 0.07,
): THREE.BufferGeometry {
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vOffset = 0;

  // Slender central rachis spine (triangular prism)
  const spineSegs = 12;
  for (let i = 0; i < spineSegs; i++) {
    const t0 = i / spineSegs;
    const t1 = (i + 1) / spineSegs;
    const z0 = t0 * length;
    const y0 = Math.sin(t0 * Math.PI * 0.78) * (length * 0.24) - Math.pow(t0, 2.1) * droop;
    const z1 = t1 * length;
    const y1 = Math.sin(t1 * Math.PI * 0.78) * (length * 0.24) - Math.pow(t1, 2.1) * droop;
    const w0 = lerp(0.045, 0.008, t0);
    const w1 = lerp(0.045, 0.008, t1);

    verts.push(-w0, y0, z0, w0, y0, z0, w1, y1, z1, -w1, y1, z1);
    uvs.push(0.2, t0, 0.8, t0, 0.8, t1, 0.2, t1);
    indices.push(vOffset, vOffset + 1, vOffset + 2, vOffset, vOffset + 2, vOffset + 3);
    vOffset += 4;
  }

  // Paired pinnate leaflets ("lá dừa chẻ") angled forward and drooping slightly
  for (let i = 1; i <= leafletCount; i++) {
    const t = 0.12 + (i / leafletCount) * 0.86;
    const sz = t * length;
    const sy = Math.sin(t * Math.PI * 0.78) * (length * 0.24) - Math.pow(t, 2.1) * droop;
    const taper = Math.sin(clamp((t - 0.08) / 0.92, 0, 1) * Math.PI * 0.88 + 0.15);
    const len = leafletLen * (0.45 + 0.65 * taper);
    const wid = leafletWidth * (0.65 + 0.35 * taper);

    for (const side of [-1, 1]) {
      const tipX = side * len * 0.88;
      const tipY = sy - len * (0.28 + t * 0.32);
      const tipZ = sz + len * 0.34;
      const midX = side * len * 0.48;
      const midY = sy + len * 0.08;
      const midZ = sz + len * 0.18;

      // 4-vert tapered leaflet diamond/ribbon
      verts.push(
        0, sy, sz - wid * 0.45,
        midX, midY, midZ + wid * 0.55,
        tipX, tipY, tipZ,
        midX, midY - 0.04, midZ - wid * 0.55,
      );
      uvs.push(0, t, 0.5, t, 1, t, 0.5, t);
      indices.push(vOffset, vOffset + 1, vOffset + 2, vOffset, vOffset + 2, vOffset + 3);
      vOffset += 4;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCoconutCrownGeometry(): { frondGeo: THREE.BufferGeometry; nutGeo: THREE.BufferGeometry } {
  const fronds: THREE.BufferGeometry[] = [];
  const frondSpecs = [
    { count: 6, pitch: -0.52, len: 3.4, droop: 1.45 }, // lower drooping older fronds
    { count: 6, pitch: -0.18, len: 3.6, droop: 1.05 }, // middle spreading fronds
    { count: 4, pitch: 0.25, len: 2.8, droop: 0.55 },  // upper young fronds
  ];

  let ringIdx = 0;
  for (const tier of frondSpecs) {
    for (let i = 0; i < tier.count; i++) {
      const yaw = (i / tier.count) * Math.PI * 2 + ringIdx * 0.55;
      const fg = buildPalmFrondGeometry(tier.len, tier.droop, 20, 0.68, 0.065);
      fg.rotateX(tier.pitch);
      fg.rotateZ(((i % 2 === 0 ? 1 : -1) * 0.14));
      fg.rotateY(yaw);
      fronds.push(fg);
    }
    ringIdx++;
  }

  const nuts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const n = new THREE.SphereGeometry(0.14, 7, 6);
    n.scale(0.88, 1.15, 0.88);
    n.translate(Math.cos(a) * 0.24, -0.22 - (i % 2) * 0.08, Math.sin(a) * 0.24);
    nuts.push(n);
  }

  return {
    frondGeo: mergeGeometries(fronds, false)!,
    nutGeo: mergeGeometries(nuts, false)!,
  };
}

function buildNipaClumpGeometry(): { frondGeo: THREE.BufferGeometry; fruitGeo: THREE.BufferGeometry } {
  const fronds: THREE.BufferGeometry[] = [];
  const frondCount = 9;
  for (let i = 0; i < frondCount; i++) {
    const yaw = (i / frondCount) * Math.PI * 2 + (i % 2) * 0.2;
    const len = 3.2 + (i % 3) * 0.65;
    const fg = buildPalmFrondGeometry(len, 0.85, 18, 0.62, 0.072);
    // Nipa fronds rise steeply out of mud then arch outward!
    fg.rotateX(-0.98 + (i % 3) * 0.16);
    fg.rotateY(yaw);
    fg.translate(Math.cos(yaw) * 0.18, 0.05, Math.sin(yaw) * 0.18);
    fronds.push(fg);
  }

  // Spiky globular Nipa fruit head ("quầy dừa nước") at base
  const fruit = new THREE.DodecahedronGeometry(0.24, 1);
  fruit.translate(0.25, 0.28, 0.12);

  return {
    frondGeo: mergeGeometries(fronds, false)!,
    fruitGeo: fruit,
  };
}

// ============================================================================
// 2. Recursive Organic Tree Skeleton (Banyan, Mango/Longan, Mangrove)
//    Inspired directly by dgreenheck/ez-tree (tapered gnarly branches + rounded leaf normals)
// ============================================================================
function buildRecursiveTropicalTree(options: {
  seed: number;
  trunkHeight: number;
  trunkRadius: number;
  levels: number;
  spreadAngle: number;
  gnarliness: number;
  childrenPerBranch: number;
  leafSize: number;
  leavesPerTip: number;
  aerialRoots?: boolean;
  mangroveStilts?: boolean;
}): { barkGeo: THREE.BufferGeometry; leafGeo: THREE.BufferGeometry } {
  const rng = new SeededRNG(options.seed);
  const bVerts: number[] = [];
  const bUvs: number[] = [];
  const bIndices: number[] = [];

  const lVerts: number[] = [];
  const lNormals: number[] = [];
  const lUvs: number[] = [];
  const lIndices: number[] = [];

  const addTube = (
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    len: number,
    rStart: number,
    rEnd: number,
    steps: number,
    radialSegs: number,
    gnarl: number,
  ): { endPos: THREE.Vector3; endDir: THREE.Vector3 } => {
    const baseIdx = bVerts.length / 3;
    const pos = origin.clone();
    const curDir = dir.clone().normalize();
    const stepLen = len / steps;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const r = lerp(rStart, rEnd, t);
      const up = Math.abs(curDir.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const tangent = new THREE.Vector3().crossVectors(curDir, up).normalize();
      const bitangent = new THREE.Vector3().crossVectors(curDir, tangent).normalize();

      for (let j = 0; j <= radialSegs; j++) {
        const a = (j / radialSegs) * Math.PI * 2;
        const offset = new THREE.Vector3()
          .addScaledVector(tangent, Math.cos(a) * r)
          .addScaledVector(bitangent, Math.sin(a) * r);
        bVerts.push(pos.x + offset.x, pos.y + offset.y, pos.z + offset.z);
        bUvs.push(j / radialSegs, t * 2);
      }

      if (s < steps) {
        curDir.x += rng.range(-gnarl, gnarl);
        curDir.z += rng.range(-gnarl, gnarl);
        curDir.y += 0.05; // gentle phototropism upward
        curDir.normalize();
        pos.addScaledVector(curDir, stepLen);
      }
    }

    const stride = radialSegs + 1;
    for (let s = 0; s < steps; s++) {
      for (let j = 0; j < radialSegs; j++) {
        const a = baseIdx + s * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        bIndices.push(a, c, b, b, c, d);
      }
    }

    return { endPos: pos, endDir: curDir };
  };

  const addLeafCluster = (center: THREE.Vector3, size: number) => {
    for (let c = 0; c < options.leavesPerTip; c++) {
      const baseV = lVerts.length / 3;
      const ox = center.x + rng.range(-size * 0.45, size * 0.45);
      const oy = center.y + rng.range(-size * 0.25, size * 0.35);
      const oz = center.z + rng.range(-size * 0.45, size * 0.45);
      const yaw = rng.range(0, Math.PI * 2);
      const pitch = rng.range(-0.45, 0.55);
      const s = size * rng.range(0.78, 1.22);

      // Crossed double leaf card for volumetric silhouette from all angles
      for (const rotY of [0, Math.PI * 0.5]) {
        const idx0 = lVerts.length / 3;
        const corners = [
          new THREE.Vector3(-s * 0.5, -s * 0.2, 0),
          new THREE.Vector3(s * 0.5, -s * 0.2, 0),
          new THREE.Vector3(s * 0.5, s * 0.8, 0),
          new THREE.Vector3(-s * 0.5, s * 0.8, 0),
        ];
        const eul = new THREE.Euler(pitch, yaw + rotY, 0);
        for (const pt of corners) {
          pt.applyEuler(eul);
          const wx = ox + pt.x;
          const wy = oy + pt.y;
          const wz = oz + pt.z;
          lVerts.push(wx, wy, wz);
          // Rounded canopy normal pointing outward & up from cluster center
          const n = new THREE.Vector3(wx - center.x, wy - center.y + 0.65, wz - center.z).normalize();
          lNormals.push(n.x, n.y, n.z);
        }
        lUvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        lIndices.push(idx0, idx0 + 1, idx0 + 2, idx0, idx0 + 2, idx0 + 3);
      }
      void baseV;
    }
  };

  const grow = (
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    len: number,
    rad: number,
    level: number,
  ) => {
    const rEnd = level === options.levels ? rad * 0.22 : rad * 0.58;
    const steps = level === 0 ? 6 : 4;
    const radial = level === 0 ? 8 : level === 1 ? 6 : 5;
    const { endPos, endDir } = addTube(
      origin,
      dir,
      len,
      rad,
      rEnd,
      steps,
      radial,
      options.gnarliness * (1 + level * 0.45),
    );

    // Optional hanging Banyan aerial roots from primary limbs!
    if (options.aerialRoots && level === 1 && endPos.y > 1.8) {
      const rootCount = rng.int(1, 2);
      for (let ar = 0; ar < rootCount; ar++) {
        const rootOrigin = new THREE.Vector3().lerpVectors(origin, endPos, rng.range(0.35, 0.9));
        const rootLen = Math.max(0.5, rootOrigin.y - 0.1);
        addTube(
          rootOrigin,
          new THREE.Vector3(rng.range(-0.04, 0.04), -1, rng.range(-0.04, 0.04)),
          rootLen,
          rng.range(0.035, 0.065),
          rng.range(0.025, 0.045),
          5,
          4,
          0.03,
        );
      }
    }

    if (level >= options.levels) {
      addLeafCluster(endPos, options.leafSize);
      return;
    }

    const childCount = options.childrenPerBranch;
    const baseYaw = rng.range(0, Math.PI * 2);
    for (let i = 0; i < childCount; i++) {
      const yaw = baseYaw + (i / childCount) * Math.PI * 2 + rng.range(-0.35, 0.35);
      const pitch = options.spreadAngle * rng.range(0.72, 1.15);
      const childOrigin = new THREE.Vector3().lerpVectors(
        origin,
        endPos,
        level === 0 ? rng.range(0.68, 1.0) : rng.range(0.55, 1.0),
      );
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const perp = new THREE.Vector3(1, 0, 0).applyQuaternion(qYaw);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(perp, pitch);
      const childDir = endDir.clone().applyQuaternion(qPitch).normalize();
      if (childDir.y < 0.08) childDir.y = 0.08;
      childDir.normalize();

      grow(
        childOrigin,
        childDir,
        len * rng.range(0.66, 0.82),
        rEnd * rng.range(0.68, 0.85),
        level + 1,
      );
    }
  };

  // Optional flared mangrove stilt prop roots ("rễ cọc cây bần / đước")
  if (options.mangroveStilts) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const start = new THREE.Vector3(0, rng.range(0.7, 1.35), 0);
      const dir = new THREE.Vector3(Math.cos(a) * 0.72, -1.0, Math.sin(a) * 0.72).normalize();
      addTube(start, dir, start.y * 1.45, options.trunkRadius * 0.35, options.trunkRadius * 0.22, 4, 4, 0.08);
    }
  }

  grow(
    new THREE.Vector3(0, -0.25, 0),
    new THREE.Vector3(rng.range(-0.1, 0.1), 1, rng.range(-0.1, 0.1)).normalize(),
    options.trunkHeight,
    options.trunkRadius,
    0,
  );

  const barkGeo = new THREE.BufferGeometry();
  barkGeo.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
  barkGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
  barkGeo.setIndex(bIndices);
  barkGeo.computeVertexNormals();

  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(lVerts, 3));
  leafGeo.setAttribute('normal', new THREE.Float32BufferAttribute(lNormals, 3));
  leafGeo.setAttribute('uv', new THREE.Float32BufferAttribute(lUvs, 2));
  leafGeo.setIndex(lIndices);

  return { barkGeo, leafGeo };
}

// ============================================================================
// 3. Banana Plant & Bamboo Clump
// ============================================================================
function buildBananaPlantGeometry(): { stemGeo: THREE.BufferGeometry; leafGeo: THREE.BufferGeometry } {
  const stemParts: THREE.BufferGeometry[] = [];
  const mainStem = new THREE.CylinderGeometry(0.11, 0.17, 2.1, 7, 1);
  mainStem.translate(0, 1.05, 0);
  stemParts.push(mainStem);
  const sucker = new THREE.CylinderGeometry(0.07, 0.11, 1.35, 6, 1);
  sucker.rotateZ(0.12);
  sucker.translate(-0.24, 0.65, 0.16);
  stemParts.push(sucker);

  const leafParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2 + (i % 2) * 0.2;
    const verts: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const segs = 7;
    const len = 1.65 + (i % 3) * 0.22;
    const maxW = 0.36;

    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const z = t * len;
      const y = Math.sin(t * Math.PI * 0.85) * 0.48 - t * t * 0.65;
      const w = Math.sin(Math.pow(t, 0.7) * Math.PI) * maxW;
      verts.push(-w, y - 0.04, z, 0, y + 0.03, z, w, y - 0.04, z);
      uvs.push(0, t, 0.5, t, 1, t);
    }
    for (let s = 0; s < segs; s++) {
      const r0 = s * 3;
      const r1 = (s + 1) * 3;
      indices.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1, r0 + 1, r1 + 1, r0 + 2, r0 + 2, r1 + 1, r1 + 2);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    lg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    lg.setIndex(indices);
    lg.computeVertexNormals();
    lg.rotateX(-0.35 + (i % 2) * 0.18);
    lg.rotateY(yaw);
    lg.translate(0, i < 6 ? 1.98 : 1.25, 0);
    leafParts.push(lg);
  }

  return {
    stemGeo: mergeGeometries(stemParts, false)!,
    leafGeo: mergeGeometries(leafParts, false)!,
  };
}

function buildBambooCulmGeometry(seed: number): { culmGeo: THREE.BufferGeometry; leafGeo: THREE.BufferGeometry } {
  const rng = new SeededRNG(seed);
  const culms: THREE.BufferGeometry[] = [];
  const leaves: THREE.BufferGeometry[] = [];

  const count = 9;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const rad = rng.range(0.15, 0.65);
    const height = rng.range(6.8, 10.2);
    const arch = rng.range(1.2, 2.6);

    const segs = 12;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const bow = t * t * arch;
      pts.push(
        new THREE.Vector3(
          Math.cos(a) * (rad + bow),
          t * height - Math.pow(t, 3) * 0.85,
          Math.sin(a) * (rad + bow),
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 14, rng.range(0.042, 0.064), 6, false);
    culms.push(tube);

    // Bamboo foliage cards near upper half of each arching culm
    for (let k = 0; k < 5; k++) {
      const pt = curve.getPoint(0.45 + k * 0.13);
      const card = new THREE.PlaneGeometry(1.15, 1.15);
      card.rotateY(rng.range(0, Math.PI));
      card.rotateX(rng.range(-0.4, 0.4));
      card.translate(pt.x, pt.y, pt.z);
      leaves.push(card);
    }
  }

  return {
    culmGeo: mergeGeometries(culms, false)!,
    leafGeo: mergeGeometries(leaves, false)!,
  };
}

// ============================================================================
// 4. Instanced Bezier Grass & Sedge (from procedural-grass-threejs technique!)
// ============================================================================
function buildRiverGrassSystem(
  count: number,
  rng: SeededRNG,
  sunDir: THREE.Vector3,
  sunColor: THREE.Color,
): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  // Build 4-segment tapered curved blade geometry
  const segs = 4;
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const baseW = 0.048;
  const baseH = 0.62;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = baseW * (1 - Math.pow(t, 1.35));
    const y = t * baseH;
    const bendZ = t * t * 0.14;
    if (i === segs) {
      verts.push(0, y, bendZ);
      uvs.push(0.5, 1.0);
    } else {
      verts.push(-w * 0.5, y, bendZ, w * 0.5, y, bendZ);
      uvs.push(0, t, 1, t);
    }
  }

  for (let i = 0; i < segs - 1; i++) {
    const r0 = i * 2;
    const r1 = (i + 1) * 2;
    indices.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
  }
  const tipStart = (segs - 1) * 2;
  indices.push(tipStart, tipStart + 1, tipStart + 2);

  const bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  bladeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bladeGeo.setIndex(indices);
  bladeGeo.computeVertexNormals();

  // Scatter grass instances along fertile banks, orchard beds, and paths edges
  const posRot = new Float32Array(count * 4);
  const scaleVar = new Float32Array(count * 4);
  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < count * 6) {
    attempts++;
    const x = rng.range(-125, 125);
    const z = rng.range(-125, 125);
    if (isProtectedFootprint(x, z)) continue;

    const info = sampleTerrainInfo(x, z);
    // Grass thrives above wet mudline (+0.38m .. +2.2m) and off packed dirt paths
    if (info.height < 0.36 || info.height > 2.3) continue;
    if (info.pathFactor > 0.42) continue;

    // Extra lush density along riverbank slopes (0.4 .. 1.3m) and orchard edges
    const bankBonus = info.height < 1.15 ? 1.0 : 0.65;
    if (rng.next() > bankBonus) continue;

    posRot[placed * 4] = x;
    posRot[placed * 4 + 1] = info.height - 0.03;
    posRot[placed * 4 + 2] = z;
    posRot[placed * 4 + 3] = rng.range(0, Math.PI * 2);

    const isReed = info.height < 0.72;
    scaleVar[placed * 4] = rng.range(0.8, 1.35);
    scaleVar[placed * 4 + 1] = isReed ? rng.range(1.2, 2.05) : rng.range(0.55, 1.35);
    scaleVar[placed * 4 + 2] = rng.range(0.08, 0.34);
    scaleVar[placed * 4 + 3] = rng.next();
    placed++;
  }

  const instGeo = new THREE.InstancedBufferGeometry();
  instGeo.index = bladeGeo.index;
  instGeo.attributes.position = bladeGeo.attributes.position;
  instGeo.attributes.normal = bladeGeo.attributes.normal;
  instGeo.attributes.uv = bladeGeo.attributes.uv;
  instGeo.setAttribute(
    'aPositionRotation',
    new THREE.InstancedBufferAttribute(posRot.subarray(0, placed * 4), 4),
  );
  instGeo.setAttribute(
    'aScaleVariation',
    new THREE.InstancedBufferAttribute(scaleVar.subarray(0, placed * 4), 4),
  );
  instGeo.instanceCount = placed;
  instGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 190);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: sunColor.clone() },
      uFogColor: { value: new THREE.Color(0xd5c4a8) },
      uFogDensity: { value: 0.0028 },
    },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec4 aPositionRotation;
      attribute vec4 aScaleVariation;

      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vColorVar;
      varying float vFade;

      float gHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float gNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(gHash(i), gHash(i + vec2(1.0, 0.0)), f.x),
          mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vUv = uv;
        vColorVar = aScaleVariation.w;

        vec3 pos = position;
        pos.x *= aScaleVariation.x;
        pos.y *= aScaleVariation.y;

        float tilt = aScaleVariation.z;
        float ct = cos(tilt);
        float st = sin(tilt);
        pos = vec3(pos.x, pos.y * ct - pos.z * st, pos.y * st + pos.z * ct);

        float rot = aPositionRotation.w;
        float cr = cos(rot);
        float sr = sin(rot);
        vec3 rotated = vec3(pos.x * cr - pos.z * sr, pos.y, pos.x * sr + pos.z * cr);
        vec3 wp = rotated + aPositionRotation.xyz;

        // 3-layer tropical grass wind (global sway + rolling gusts + micro flutter)
        float h2 = uv.y * uv.y;
        vec2 windDir = normalize(vec2(0.75, 0.65));
        float globalSway = sin(dot(wp.xz, windDir) * 0.25 + uTime * 1.3) * 0.14;
        float gustEnv = smoothstep(0.32, 0.72, gNoise(wp.xz * 0.045 - uTime * 0.28));
        float gust = sin(dot(wp.xz, windDir) * 0.65 + uTime * 2.4) * 0.24 * gustEnv;
        float turb = sin(uTime * 3.8 + gHash(aPositionRotation.xz) * 6.28) * 0.04;

        wp.xz += windDir * (globalSway + gust) * h2;
        wp.x += turb * h2;
        wp.y -= abs(globalSway + gust) * 0.22 * h2;

        vWorldPos = wp;
        float camDist = length(cameraPosition - wp);
        vFade = 1.0 - smoothstep(68.0, 108.0, camDist);

        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;

      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vColorVar;
      varying float vFade;

      void main() {
        if (vFade < 0.02) discard;

        float h = vUv.y;
        vec3 rootCol = vec3(0.055, 0.105, 0.028);
        vec3 tipCol = mix(vec3(0.155, 0.255, 0.055), vec3(0.26, 0.29, 0.075), vColorVar);
        vec3 col = mix(rootCol, tipCol, h);

        // Root ambient occlusion
        float ao = mix(0.42, 1.0, smoothstep(0.0, 0.42, h));
        col *= ao;

        vec3 L = normalize(uSunDir);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float sunUp = smoothstep(-0.04, 0.25, L.y);
        float diffuse = 0.48 + 0.52 * max(L.y, 0.0);
        float sss = pow(max(dot(-V, L), 0.0), 3.0) * 0.55 * h * sunUp;

        vec3 lit = col * (uSunColor * diffuse * 0.85 + vec3(0.24, 0.28, 0.22)) + vec3(0.24, 0.34, 0.06) * uSunColor * sss;

        float camDist = length(cameraPosition - vWorldPos);
        float fogF = 1.0 - exp(-pow(camDist * uFogDensity, 1.55));
        lit = mix(lit, uFogColor, clamp(fogF, 0.0, 0.98));

        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(instGeo, material);
  mesh.frustumCulled = false;
  mesh.name = 'MekongRiverGrass';
  return { mesh, material };
}

// ============================================================================
// 5. Drifting Lục Bình (Water Hyacinth) & Ao Sen (Lotus Pond)
// ============================================================================
interface HyacinthCluster {
  mesh: THREE.Group;
  baseX: number;
  baseZ: number;
  phase: number;
  driftSpeed: number;
}

function createWaterHyacinthMat(
  leafMat: THREE.MeshStandardMaterial,
  flowerMat: THREE.MeshStandardMaterial,
  rng: SeededRNG,
): THREE.Group {
  const cluster = new THREE.Group();
  const rosetteCount = rng.int(4, 8);

  for (let r = 0; r < rosetteCount; r++) {
    const ox = rng.range(-0.9, 0.9);
    const oz = rng.range(-0.9, 0.9);
    for (let l = 0; l < 5; l++) {
      const a = (l / 5) * Math.PI * 2 + r;
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.14, 6), leafMat);
      leaf.rotation.x = -Math.PI * 0.38;
      leaf.rotation.z = a;
      leaf.position.set(ox + Math.cos(a) * 0.14, 0.08 + (l % 2) * 0.04, oz + Math.sin(a) * 0.14);
      cluster.add(leaf);
    }
    if (r % 2 === 0) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), flowerMat);
      spike.position.set(ox, 0.22, oz);
      cluster.add(spike);
    }
  }
  return cluster;
}

function createLotusPond(
  group: THREE.Group,
  rng: SeededRNG,
  disposables: Array<{ dispose: () => void }>,
) {
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x3b6e28,
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xf49bb4,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xe6be32, roughness: 0.7 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x325a21, roughness: 0.8 });
  disposables.push(padMat, petalMat, centerMat, stemMat);

  const padGeo = new THREE.CircleGeometry(0.42, 12, 0.15, Math.PI * 1.85);
  padGeo.rotateX(-Math.PI / 2);
  const padInst = new THREE.InstancedMesh(padGeo, padMat, 75);
  padInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  for (let i = 0; i < 75; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 9.5;
    const x = 70 + Math.cos(a) * r;
    const z = -74 + Math.sin(a) * r;
    dummy.position.set(x, WATER_LEVEL + 0.035, z);
    dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(rng.range(0.65, 1.35));
    dummy.updateMatrix();
    padInst.setMatrixAt(i, dummy.matrix);

    if (i < 22) {
      const flower = new THREE.Group();
      const h = rng.range(0.28, 0.56);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, h, 5), stemMat);
      stem.position.y = h * 0.5;
      flower.add(stem);

      const core = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.06, 6), centerMat);
      core.rotation.x = Math.PI;
      core.position.y = h + 0.02;
      flower.add(core);

      for (let p = 0; p < 8; p++) {
        const pa = (p / 8) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.075, 5, 4), petalMat);
        petal.scale.set(0.55, 1.25, 0.25);
        petal.position.set(Math.cos(pa) * 0.065, h + 0.04, Math.sin(pa) * 0.065);
        petal.rotation.set(0.45, -pa, 0);
        flower.add(petal);
      }
      flower.position.set(x + 0.15, WATER_LEVEL, z - 0.12);
      group.add(flower);
    }
  }
  padInst.instanceMatrix.needsUpdate = true;
  group.add(padInst);
}

// ============================================================================
// Master Flora Builder
// ============================================================================
export function createMekongFlora(mats: MekongMaterialLibrary): FloraSystem {
  const group = new THREE.Group();
  group.name = 'MekongFlora';
  const rng = new SeededRNG(202604);
  const disposables: Array<{ dispose: () => void }> = [];
  const shaderTrackers: Array<{
    uTime: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
  }> = [];

  // Shared materials
  const barkMat = mats.getPilingBark(1, 2);
  const palmBarkMat = barkMat.clone();
  palmBarkMat.color.setHex(0xb8aa9a);
  disposables.push(palmBarkMat);

  const coconutFrondMat = injectFoliageWindSSS(
    new THREE.MeshStandardMaterial({
      color: 0x4c7c28,
      roughness: 0.52,
      side: THREE.DoubleSide,
    }),
    0.24,
    new THREE.Color(0x95c72c),
    shaderTrackers,
  );
  const nipaFrondMat = injectFoliageWindSSS(
    new THREE.MeshStandardMaterial({
      color: 0x3b6e22,
      roughness: 0.46,
      side: THREE.DoubleSide,
    }),
    0.16,
    new THREE.Color(0x88bc26),
    shaderTrackers,
  );
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x5c7224, roughness: 0.55 });
  const nipaFruitMat = new THREE.MeshStandardMaterial({ color: 0x4d2a16, roughness: 0.8 });

  const banyanLeafTex = mats.createLeafClusterTexture('banyan');
  const banyanLeafMat = injectFoliageWindSSS(
    new THREE.MeshStandardMaterial({
      map: banyanLeafTex,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.65,
    }),
    0.12,
    new THREE.Color(0x7fb424),
    shaderTrackers,
    true,
  );

  const bambooLeafTex = mats.createLeafClusterTexture('bamboo');
  const bambooLeafMat = injectFoliageWindSSS(
    new THREE.MeshStandardMaterial({
      map: bambooLeafTex,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.6,
    }),
    0.2,
    new THREE.Color(0x9cc938),
    shaderTrackers,
    true,
  );
  const bambooCulmMat = new THREE.MeshStandardMaterial({ color: 0x77943a, roughness: 0.45 });

  const bananaLeafMat = injectFoliageWindSSS(
    new THREE.MeshStandardMaterial({
      color: 0x5d8d26,
      roughness: 0.42,
      side: THREE.DoubleSide,
    }),
    0.18,
    new THREE.Color(0xaad12c),
    shaderTrackers,
  );
  const bananaStemMat = new THREE.MeshStandardMaterial({ color: 0x677c32, roughness: 0.72 });

  disposables.push(
    coconutFrondMat,
    nipaFrondMat,
    nutMat,
    nipaFruitMat,
    banyanLeafMat,
    bambooLeafMat,
    bambooCulmMat,
    bananaLeafMat,
    bananaStemMat,
  );

  // --------------------------------------------------------------------------
  // A. Coconut Palms ("Cây Dừa Bến Tre / Miền Tây") leaning gracefully over banks
  // --------------------------------------------------------------------------
  const palmVariants = [
    { h: 8.8, bend: 2.3, r: 0.21 },
    { h: 10.6, bend: 3.1, r: 0.23 },
    { h: 7.4, bend: 1.6, r: 0.19 },
  ];
  const crownPack = buildCoconutCrownGeometry();
  disposables.push(crownPack.frondGeo, crownPack.nutGeo);

  const palmPlacements: Array<{ x: number; z: number; y: number; yaw: number; scale: number; variant: number }> = [];
  for (let i = 0; i < 145; i++) {
    const isOuter = i >= 70;
    const x = isOuter ? Math.cos(i * 2.39) * rng.range(105, 185) : rng.range(-125, 125);
    const z = isOuter ? Math.sin(i * 2.39) * rng.range(105, 185) : rng.range(-125, 125);
    if (isProtectedFootprint(x, z)) continue;
    const info = sampleTerrainInfo(x, z);
    if (info.height < 0.72 || info.height > 2.8 || info.pathFactor > 0.4) continue;

    if (!isOuter) {
      const mr = sampleMainRiverDistance(x, z);
      const ec = sampleEastCanalDistance(x, z);
      const nearWater = mr.dist < mr.halfWidth + 15 || ec.dist < ec.halfWidth + 11;
      if (!nearWater && info.orchardFactor < 0.25 && rng.next() > 0.34) continue;
    }

    const leanYaw = Math.atan2(-z * 0.25, -x) + rng.range(-0.9, 0.9);
    palmPlacements.push({
      x,
      z,
      y: info.height - 0.1,
      yaw: leanYaw,
      scale: rng.range(0.85, 1.24),
      variant: i % palmVariants.length,
    });
  }

  for (let v = 0; v < palmVariants.length; v++) {
    const spec = palmVariants[v];
    const items = palmPlacements.filter((p) => p.variant === v);
    if (items.length === 0) continue;

    const trunkGeo = buildCoconutTrunkGeometry(spec.h, spec.bend, spec.r);
    disposables.push(trunkGeo);

    const trunkInst = new THREE.InstancedMesh(trunkGeo, palmBarkMat, items.length);
    const frondInst = new THREE.InstancedMesh(crownPack.frondGeo, coconutFrondMat, items.length);
    const nutInst = new THREE.InstancedMesh(crownPack.nutGeo, nutMat, items.length);
    trunkInst.castShadow = trunkInst.receiveShadow = true;
    frondInst.castShadow = frondInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    items.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      // Crown sits at exact trunk tip (cx at t=1 is bend*(0.6*sin(0.72pi)+0.4) ~ bend*0.86)
      const tipLocal = new THREE.Vector3(spec.bend * 0.862 * p.scale, spec.h * p.scale, 0);
      tipLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
      dummy.position.set(p.x + tipLocal.x, p.y + tipLocal.y - 0.08, p.z + tipLocal.z);
      dummy.rotation.set(0, p.yaw + idx * 1.1, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      frondInst.setMatrixAt(idx, dummy.matrix);
      nutInst.setMatrixAt(idx, dummy.matrix);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    frondInst.instanceMatrix.needsUpdate = true;
    nutInst.instanceMatrix.needsUpdate = true;
    group.add(trunkInst, frondInst, nutInst);
  }

  // --------------------------------------------------------------------------
  // B. Nipa Palms ("Dừa Nước") densely lining muddy canal & river edges
  // --------------------------------------------------------------------------
  const nipaPack = buildNipaClumpGeometry();
  disposables.push(nipaPack.frondGeo, nipaPack.fruitGeo);

  const nipaSpots: Array<{ x: number; z: number; y: number; yaw: number; s: number }> = [];
  for (let i = 0; i < 420 && nipaSpots.length < 135; i++) {
    const x = rng.range(-128, 128);
    const z = rng.range(-128, 128);
    if (isProtectedFootprint(x, z)) continue;
    // Keep clear of main mansion riverfront embankment (x: 18..34, z: 22..72)
    if (x > 16 && x < 36 && z > 18 && z < 75) continue;

    const info = sampleTerrainInfo(x, z);
    // Nipa palms root directly in tidal mud (-0.18m .. +0.58m)!
    if (info.height < -0.2 || info.height > 0.58) continue;

    nipaSpots.push({
      x,
      z,
      y: info.height - 0.08,
      yaw: rng.range(0, Math.PI * 2),
      s: rng.range(0.78, 1.28),
    });
  }

  if (nipaSpots.length > 0) {
    const nipaFronds = new THREE.InstancedMesh(nipaPack.frondGeo, nipaFrondMat, nipaSpots.length);
    const nipaFruits = new THREE.InstancedMesh(nipaPack.fruitGeo, nipaFruitMat, nipaSpots.length);
    nipaFronds.castShadow = true;
    nipaFronds.receiveShadow = true;

    const dummy = new THREE.Object3D();
    nipaSpots.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      nipaFronds.setMatrixAt(idx, dummy.matrix);
      nipaFruits.setMatrixAt(idx, dummy.matrix);
    });
    nipaFronds.instanceMatrix.needsUpdate = true;
    nipaFruits.instanceMatrix.needsUpdate = true;
    group.add(nipaFronds, nipaFruits);
  }

  // --------------------------------------------------------------------------
  // C. Ancient Banyan Tree ("Cây Đa Cổ Thụ") at West Bank Shrine + Mansion Courtyard Tree
  // --------------------------------------------------------------------------
  const banyanCoords: Array<[number, number, number, number]> = [
    [-40.5, -13.5, 1.25, 901], // Hero Ancient Banyan beside Khmer Shrine landing!
    [76.0, 29.0, 1.05, 902],   // Heritage Mansion garden shade tree
    [-64.0, 32.0, 1.15, 903],  // Behind Khmer Pagoda
  ];
  for (const [bx, bz, bScale, bSeed] of banyanCoords) {
    const by = sampleTerrainInfo(bx, bz).height;
    const { barkGeo, leafGeo } = buildRecursiveTropicalTree({
      seed: bSeed,
      trunkHeight: 3.4,
      trunkRadius: 0.62,
      levels: 3,
      spreadAngle: 0.72,
      gnarliness: 0.22,
      childrenPerBranch: 3,
      leafSize: 2.35,
      leavesPerTip: 5,
      aerialRoots: true,
    });
    disposables.push(barkGeo, leafGeo);

    const bBark = new THREE.Mesh(barkGeo, barkMat);
    const bLeaf = new THREE.Mesh(leafGeo, banyanLeafMat);
    bBark.castShadow = bBark.receiveShadow = true;
    bLeaf.castShadow = bLeaf.receiveShadow = true;

    const treeGrp = new THREE.Group();
    treeGrp.add(bBark, bLeaf);
    treeGrp.position.set(bx, by, bz);
    treeGrp.scale.setScalar(bScale);
    group.add(treeGrp);
  }

  // --------------------------------------------------------------------------
  // D. Orchard Trees (Mango / Longan) & Mangrove ("Cây Bần") with Stilt Roots
  // --------------------------------------------------------------------------
  const orchardPrototypes = [101, 202, 303].map((seed) => {
    const g = buildRecursiveTropicalTree({
      seed,
      trunkHeight: 2.4,
      trunkRadius: 0.28,
      levels: 2,
      spreadAngle: 0.68,
      gnarliness: 0.18,
      childrenPerBranch: 3,
      leafSize: 1.95,
      leavesPerTip: 4,
    });
    disposables.push(g.barkGeo, g.leafGeo);
    return g;
  });

  const mangroveProto = buildRecursiveTropicalTree({
    seed: 555,
    trunkHeight: 2.6,
    trunkRadius: 0.24,
    levels: 2,
    spreadAngle: 0.64,
    gnarliness: 0.24,
    childrenPerBranch: 3,
    leafSize: 1.75,
    leavesPerTip: 4,
    mangroveStilts: true,
  });
  disposables.push(mangroveProto.barkGeo, mangroveProto.leafGeo);

  const orchardSpots: Array<{ x: number; y: number; z: number; yaw: number; s: number; p: number }> = [];
  const mangroveSpots: Array<{ x: number; y: number; z: number; yaw: number; s: number }> = [];

  for (let i = 0; i < 980; i++) {
    const isHorizon = i >= 720;
    const x = isHorizon ? rng.range(-225, 225) : rng.range(-180, 180);
    const z = isHorizon ? rng.range(-225, 225) : rng.range(-180, 180);
    if (isHorizon && Math.hypot(x, z) < 120) continue;
    if (isProtectedFootprint(x, z)) continue;
    const info = sampleTerrainInfo(x, z);
    if (info.pathFactor > 0.35) continue;

    if (info.height >= 0.05 && info.height <= 0.52 && mangroveSpots.length < 38) {
      mangroveSpots.push({ x, y: info.height, z, yaw: rng.range(0, Math.PI * 2), s: rng.range(0.85, 1.35) });
    } else if (info.height > 0.82 && info.height < 3.0 && orchardSpots.length < 210) {
      if (info.orchardFactor > 0.25 || Math.hypot(x, z) > 62) {
        orchardSpots.push({
          x,
          y: info.height,
          z,
          yaw: rng.range(0, Math.PI * 2),
          s: isHorizon ? rng.range(1.15, 1.75) : rng.range(0.9, 1.45),
          p: i % orchardPrototypes.length,
        });
      }
    }
  }

  for (let p = 0; p < orchardPrototypes.length; p++) {
    const sub = orchardSpots.filter((o) => o.p === p);
    if (sub.length === 0) continue;
    const proto = orchardPrototypes[p];
    const bInst = new THREE.InstancedMesh(proto.barkGeo, barkMat, sub.length);
    const lInst = new THREE.InstancedMesh(proto.leafGeo, banyanLeafMat, sub.length);
    bInst.castShadow = bInst.receiveShadow = true;
    lInst.castShadow = lInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    sub.forEach((o, idx) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(0, o.yaw, 0);
      dummy.scale.setScalar(o.s);
      dummy.updateMatrix();
      bInst.setMatrixAt(idx, dummy.matrix);
      lInst.setMatrixAt(idx, dummy.matrix);
    });
    bInst.instanceMatrix.needsUpdate = true;
    lInst.instanceMatrix.needsUpdate = true;
    group.add(bInst, lInst);
  }

  if (mangroveSpots.length > 0) {
    const mbInst = new THREE.InstancedMesh(mangroveProto.barkGeo, barkMat, mangroveSpots.length);
    const mlInst = new THREE.InstancedMesh(mangroveProto.leafGeo, banyanLeafMat, mangroveSpots.length);
    mbInst.castShadow = mbInst.receiveShadow = true;
    mlInst.castShadow = mlInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    mangroveSpots.forEach((o, idx) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(0, o.yaw, 0);
      dummy.scale.setScalar(o.s);
      dummy.updateMatrix();
      mbInst.setMatrixAt(idx, dummy.matrix);
      mlInst.setMatrixAt(idx, dummy.matrix);
    });
    mbInst.instanceMatrix.needsUpdate = true;
    mlInst.instanceMatrix.needsUpdate = true;
    group.add(mbInst, mlInst);
  }

  // --------------------------------------------------------------------------
  // E. Banana Groves & Bamboo Clumps ("Chuối Vườn & Bụi Tre Ngà")
  // --------------------------------------------------------------------------
  const bananaPack = buildBananaPlantGeometry();
  const bambooPack = buildBambooCulmGeometry(777);
  disposables.push(bananaPack.stemGeo, bananaPack.leafGeo, bambooPack.culmGeo, bambooPack.leafGeo);

  const bananaSpots: Array<{ x: number; y: number; z: number; yaw: number; s: number }> = [];
  const bambooSpots: Array<{ x: number; y: number; z: number; yaw: number; s: number }> = [];

  for (let i = 0; i < 240; i++) {
    const x = rng.range(-120, 120);
    const z = rng.range(-120, 120);
    if (isProtectedFootprint(x, z)) continue;
    const info = sampleTerrainInfo(x, z);
    if (info.height < 0.78 || info.height > 2.1 || info.pathFactor > 0.32) continue;

    if ((info.orchardFactor > 0.25 || x < -35) && bananaSpots.length < 34) {
      bananaSpots.push({ x, y: info.height, z, yaw: rng.range(0, Math.PI * 2), s: rng.range(0.85, 1.25) });
    } else if (bambooSpots.length < 22 && Math.hypot(x, z) > 42) {
      bambooSpots.push({ x, y: info.height, z, yaw: rng.range(0, Math.PI * 2), s: rng.range(0.9, 1.25) });
    }
  }

  if (bananaSpots.length > 0) {
    const bsInst = new THREE.InstancedMesh(bananaPack.stemGeo, bananaStemMat, bananaSpots.length);
    const blInst = new THREE.InstancedMesh(bananaPack.leafGeo, bananaLeafMat, bananaSpots.length);
    bsInst.castShadow = blInst.castShadow = true;
    blInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    bananaSpots.forEach((b, idx) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.yaw, 0);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      bsInst.setMatrixAt(idx, dummy.matrix);
      blInst.setMatrixAt(idx, dummy.matrix);
    });
    bsInst.instanceMatrix.needsUpdate = true;
    blInst.instanceMatrix.needsUpdate = true;
    group.add(bsInst, blInst);
  }

  if (bambooSpots.length > 0) {
    const bcInst = new THREE.InstancedMesh(bambooPack.culmGeo, bambooCulmMat, bambooSpots.length);
    const blInst = new THREE.InstancedMesh(bambooPack.leafGeo, bambooLeafMat, bambooSpots.length);
    bcInst.castShadow = blInst.castShadow = true;
    const dummy = new THREE.Object3D();
    bambooSpots.forEach((b, idx) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.yaw, 0);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      bcInst.setMatrixAt(idx, dummy.matrix);
      blInst.setMatrixAt(idx, dummy.matrix);
    });
    bcInst.instanceMatrix.needsUpdate = true;
    blInst.instanceMatrix.needsUpdate = true;
    group.add(bcInst, blInst);
  }

  // --------------------------------------------------------------------------
  // F. Instanced Riverbank Grass & Reeds (28,000 blades + Shoreline Mud Debris)
  // --------------------------------------------------------------------------
  const grassSys = buildRiverGrassSystem(28000, rng, new THREE.Vector3(0.5, 0.5, 0.5), new THREE.Color(0xffe4b5));
  disposables.push(grassSys.mesh.geometry, grassSys.material);
  group.add(grassSys.mesh);

  // Alluvial Riverbank Driftwood, Pebbles & Fallen Coconut Husks along Mud Line!
  const driftwoodGeo = new THREE.CylinderGeometry(0.045, 0.075, 1.35, 6);
  driftwoodGeo.rotateZ(Math.PI * 0.48);
  const pebbleGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const driftMat = mats.getPilingBark(1, 1);
  const pebbleMat = mats.getStoneGranite(1, 1);
  disposables.push(driftwoodGeo, pebbleGeo);

  const driftSpots: Array<{ x: number; y: number; z: number; yaw: number; s: number }> = [];
  const pebbleSpots: Array<{ x: number; y: number; z: number; yaw: number; s: number }> = [];
  for (let i = 0; i < 650 && (driftSpots.length < 48 || pebbleSpots.length < 75); i++) {
    const x = rng.range(-115, 115);
    const z = rng.range(-115, 115);
    if (isProtectedFootprint(x, z)) continue;
    const info = sampleTerrainInfo(x, z);
    if (info.height >= -0.05 && info.height <= 0.48 && driftSpots.length < 48 && rng.next() < 0.35) {
      driftSpots.push({ x, y: info.height + 0.02, z, yaw: rng.range(0, Math.PI * 2), s: rng.range(0.7, 1.4) });
    } else if (info.height >= 0.12 && info.height <= 1.25 && pebbleSpots.length < 75) {
      pebbleSpots.push({ x, y: info.height - 0.04, z, yaw: rng.range(0, Math.PI * 2), s: rng.range(0.45, 1.35) });
    }
  }
  if (driftSpots.length > 0) {
    const dInst = new THREE.InstancedMesh(driftwoodGeo, driftMat, driftSpots.length);
    dInst.castShadow = dInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    driftSpots.forEach((d, idx) => {
      dummy.position.set(d.x, d.y, d.z);
      dummy.rotation.set(rng.range(-0.08, 0.08), d.yaw, rng.range(-0.1, 0.1));
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      dInst.setMatrixAt(idx, dummy.matrix);
    });
    dInst.instanceMatrix.needsUpdate = true;
    group.add(dInst);
  }
  if (pebbleSpots.length > 0) {
    const pInst = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleSpots.length);
    pInst.castShadow = pInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    pebbleSpots.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(rng.range(0, 1), p.yaw, rng.range(0, 1));
      dummy.scale.set(p.s * 1.2, p.s * 0.65, p.s);
      dummy.updateMatrix();
      pInst.setMatrixAt(idx, dummy.matrix);
    });
    pInst.instanceMatrix.needsUpdate = true;
    group.add(pInst);
  }

  // --------------------------------------------------------------------------
  // G. Lotus Pond ("Ao Sen") & Drifting Water Hyacinth ("Lục Bình Trôi Sông")
  // --------------------------------------------------------------------------
  createLotusPond(group, rng, disposables);

  const hyacinthLeafMat = new THREE.MeshStandardMaterial({
    color: 0x264c16,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });
  const hyacinthFlowerMat = new THREE.MeshStandardMaterial({
    color: 0x9b74c8,
    roughness: 0.65,
  });
  disposables.push(hyacinthLeafMat, hyacinthFlowerMat);

  const hyacinths: HyacinthCluster[] = [];
  for (let i = 0; i < 34; i++) {
    const x = rng.range(-26, 8);
    const z = rng.range(-90, 72);
    if (x > 6 && z > 20 && z < 34) continue; // Keep Ferry Pier dock clear
    const h = sampleTerrainInfo(x, z).height;
    if (h > -1.0) continue;
    const cluster = createWaterHyacinthMat(hyacinthLeafMat, hyacinthFlowerMat, rng);
    cluster.position.set(x, WATER_LEVEL, z);
    cluster.rotation.y = rng.range(0, Math.PI * 2);
    // Drifts and tilts as one unit every frame: merged inside itself, never with the rest.
    cluster.userData.rigid = true;
    group.add(cluster);
    hyacinths.push({
      mesh: cluster,
      baseX: x,
      baseZ: z,
      phase: rng.range(0, 10),
      driftSpeed: rng.range(0.18, 0.38),
    });
  }

  return {
    group,
    update: (
      elapsedTime: number,
      sunDir: THREE.Vector3,
      sunColor: THREE.Color,
      fogColor: THREE.Color,
      fogDensity: number,
    ) => {
      for (const u of shaderTrackers) {
        u.uTime.value = elapsedTime;
        u.uSunDir.value.copy(sunDir);
        u.uSunColor.value.copy(sunColor);
      }
      grassSys.material.uniforms.uTime.value = elapsedTime;
      grassSys.material.uniforms.uSunDir.value.copy(sunDir);
      grassSys.material.uniforms.uSunColor.value.copy(sunColor);
      grassSys.material.uniforms.uFogColor.value.copy(fogColor);
      grassSys.material.uniforms.uFogDensity.value = fogDensity;

      // Gentle river current drift + wave bobbing for Water Hyacinth mats
      for (const hy of hyacinths) {
        const curZ = ((hy.baseZ - elapsedTime * hy.driftSpeed + 95) % 175) - 95;
        const w = sampleRiverWave(hy.baseX, curZ, elapsedTime);
        hy.mesh.position.set(
          hy.baseX + Math.sin(elapsedTime * 0.35 + hy.phase) * 0.35,
          w.height - 0.02,
          curZ,
        );
        hy.mesh.rotation.x = w.slopeZ * 0.65;
        hy.mesh.rotation.z = -w.slopeX * 0.65;
      }
    },
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

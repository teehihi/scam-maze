import * as THREE from 'three';
import { WORLD_SIZE, sampleTerrainInfo } from './MekongHeightfield';
import { clamp } from '../math/Noise';

export interface MekongTerrainResult {
  group: THREE.Group;
  heightDataTex: THREE.DataTexture;
  material: THREE.MeshStandardMaterial;
  update: (elapsedTime: number) => void;
  dispose: () => void;
}

function buildAdaptiveGridGeometry(
  span: number,
  segments: number,
  warpCore = true,
): THREE.BufferGeometry {
  const count = (segments + 1) * (segments + 1);
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const pathFactors = new Float32Array(count);
  const orchardFactors = new Float32Array(count);

  const half = span * 0.5;

  // Non-linear coordinate warp concentrates vertex resolution inside the +/-115m navigable core
  // while seamlessly reaching +/-260m horizon without LOD seams!
  const mapCoord = (t: number) => {
    const s = t * 2 - 1; // -1..1
    if (!warpCore) return s * half;
    const absS = Math.abs(s);
    const warped = Math.sign(s) * (absS * 0.52 + absS * absS * absS * 0.48);
    return warped * half;
  };

  let vIdx = 0;
  for (let iz = 0; iz <= segments; iz++) {
    const tz = iz / segments;
    const z = mapCoord(tz);
    for (let ix = 0; ix <= segments; ix++) {
      const tx = ix / segments;
      const x = mapCoord(tx);
      const info = sampleTerrainInfo(x, z);

      positions[vIdx * 3] = x;
      positions[vIdx * 3 + 1] = info.height;
      positions[vIdx * 3 + 2] = z;

      uvs[vIdx * 2] = (x + half) / span;
      uvs[vIdx * 2 + 1] = (z + half) / span;
      pathFactors[vIdx] = info.pathFactor;
      orchardFactors[vIdx] = info.orchardFactor;
      vIdx++;
    }
  }

  const indices: number[] = [];
  const stride = segments + 1;
  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * stride + ix;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aPathFactor', new THREE.BufferAttribute(pathFactors, 1));
  geo.setAttribute('aOrchardFactor', new THREE.BufferAttribute(orchardFactors, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a 512x512 16-bit encoded RG terrain height DataTexture covering WORLD_SIZE
 * so the Mekong water shader can accurately evaluate water depth & shoreline proximity.
 */
function buildTerrainHeightDataTexture(res = 512): THREE.DataTexture {
  const data = new Uint8Array(res * res * 4);
  const half = WORLD_SIZE * 0.5;

  for (let y = 0; y < res; y++) {
    const z = -half + (y / (res - 1)) * WORLD_SIZE;
    for (let x = 0; x < res; x++) {
      const worldX = -half + (x / (res - 1)) * WORLD_SIZE;
      const info = sampleTerrainInfo(worldX, z);
      // Height range [-8m .. +12m] -> normalized [0..1] -> 16-bit integer [0..65535]
      const normH = clamp((info.height + 8.0) / 20.0, 0, 1);
      const q = Math.round(normH * 65535);
      const hi = (q >> 8) & 0xff;
      const lo = q & 0xff;

      const idx = (y * res + x) * 4;
      data[idx] = hi;
      data[idx + 1] = lo;
      data[idx + 2] = Math.round(clamp(info.riverFactor, 0, 1) * 255);
      data[idx + 3] = Math.round(clamp(info.mudFactor, 0, 1) * 255);
    }
  }

  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createMekongTerrain(): MekongTerrainResult {
  const group = new THREE.Group();
  group.name = 'MekongTerrain';

  const geometry = buildAdaptiveGridGeometry(WORLD_SIZE, 280, true);
  const heightDataTex = buildTerrainHeightDataTexture(512);

  const material = new THREE.MeshStandardMaterial({
    name: 'MekongAlluvialTerrain',
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTerrainTime = { value: 0 };
    material.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aPathFactor;
        attribute float aOrchardFactor;
        varying vec3 vTerrWorldPos;
        varying vec3 vTerrWorldNormal;
        varying float vPathFactor;
        varying float vOrchardFactor;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 tWp = modelMatrix * vec4(transformed, 1.0);
        vTerrWorldPos = tWp.xyz;
        vTerrWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        vPathFactor = aPathFactor;
        vOrchardFactor = aOrchardFactor;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vTerrWorldPos;
        varying vec3 vTerrWorldNormal;
        varying float vPathFactor;
        varying float vOrchardFactor;

        float trHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float trNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(trHash(i), trHash(i + vec2(1.0, 0.0)), f.x),
            mix(trHash(i + vec2(0.0, 1.0)), trHash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float trFbm(vec2 p) {
          float s = 0.0;
          mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
          s += 0.52 * trNoise(p);
          p = rot * p * 2.17 + vec2(13.1, 7.7);
          s += 0.30 * trNoise(p);
          p = rot * p * 2.23 + vec2(29.3, 19.4);
          s += 0.18 * trNoise(p);
          return s;
        }
        float trRelief(vec2 xz) {
          float coarse = trFbm(xz * 0.45);
          float fine = trFbm(xz * 2.6);
          float micro = trNoise(xz * 12.0);
          return coarse * 0.45 + fine * 0.38 + micro * 0.17;
        }
        uniform float uTerrainTime;

        float trMudCrack(vec2 p) {
          float c1 = abs(trNoise(p) - 0.5);
          float c2 = abs(trNoise(vec2(p.x * 0.8 - p.y * 0.6, p.x * 0.6 + p.y * 0.8) * 1.43 + vec2(11.3, 4.7)) - 0.5);
          return min(c1, c2) * 2.0;
        }
        float trPuddleMask(vec2 xz, float pathFactor, float orchardFactor) {
          float puddleNoise = trFbm(xz * 0.31 + vec2(7.4, 3.1));
          float humanUse = clamp(pathFactor * 1.15 + orchardFactor * 0.42, 0.0, 1.0);
          return smoothstep(0.58, 0.76, puddleNoise) * humanUse;
        }
        float trCloudShadow(vec2 xz) {
          vec2 drift = vec2(uTerrainTime * 0.55, uTerrainTime * 0.22);
          float field = trFbm((xz + drift) * 0.016 + vec2(4.7, 9.2));
          return smoothstep(0.54, 0.78, field);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 xz = vTerrWorldPos.xz;
          float wy = vTerrWorldPos.y;
          float distCam = length(cameraPosition - vTerrWorldPos);
          float detailFade = 1.0 - smoothstep(45.0, 145.0, distCam);

          float macroN = trFbm(xz * 0.075);
          float fineN = trFbm(xz * 0.95);
          float microN = trNoise(xz * 8.5);
          float grain = fineN * 0.65 + microN * 0.35;

          float slope = 1.0 - clamp(vTerrWorldNormal.y, 0.0, 1.0);

          // 1. Alluvial river silt & tidal wet mud ("bùn phù sa miền Tây")
          vec3 wetMudCol = mix(vec3(0.095, 0.072, 0.052), vec3(0.145, 0.112, 0.078), fineN);
          // 2. Damp mossy bank earth
          vec3 dampBankCol = mix(vec3(0.14, 0.125, 0.078), vec3(0.10, 0.145, 0.06), macroN);
          // 3. Packed ochre-brown Mekong dirt path ("đất nện phù sa")
          vec3 pathCol = mix(vec3(0.28, 0.21, 0.14), vec3(0.35, 0.27, 0.18), grain);
          // 4. Lush tropical riverbank & orchard vegetation mat
          vec3 grassDark = vec3(0.068, 0.135, 0.038);
          vec3 grassWarm = vec3(0.135, 0.195, 0.052);
          vec3 grassCol = mix(grassDark, grassWarm, clamp(macroN * 1.15 + (fineN - 0.5) * 0.35, 0.0, 1.0));
          // Orchard rich dark humus soil in ditches/under shade
          vec3 orchardSoil = mix(vec3(0.11, 0.088, 0.058), vec3(0.16, 0.13, 0.08), fineN);

          float wetMask = 1.0 - smoothstep(0.08, 0.56, wy + (fineN - 0.5) * 0.16);
          float bankMask = smoothstep(0.28, 0.72, wy) * (1.0 - smoothstep(0.65, 1.15, wy));
          float steepMud = smoothstep(0.18, 0.45, slope);

          vec3 col = grassCol;
          col = mix(col, orchardSoil, clamp(vOrchardFactor * (0.45 + (1.0 - smoothstep(0.5, 1.25, wy)) * 0.45), 0.0, 0.85));
          col = mix(col, dampBankCol, clamp(bankMask * 0.75 + steepMud * 0.55, 0.0, 1.0));
          col = mix(col, pathCol, clamp(vPathFactor * 0.92, 0.0, 1.0));
          col = mix(col, wetMudCol, clamp(wetMask, 0.0, 1.0));

          // Close-up micro pebble & dried leaf litter breakup
          float fleck = smoothstep(0.62, 0.88, microN) * detailFade;
          col *= 1.0 + (grain - 0.5) * 0.24 * detailFade + (fleck - 0.3) * 0.08;

          // Drying alluvium develops mud cracks only near the shoreline within detail range.
          float mudTransition = smoothstep(0.16, 0.34, wy) * (1.0 - smoothstep(0.62, 0.92, wy));
          if (mudTransition > 0.01 && detailFade > 0.05) {
            float crackEdge = trMudCrack(xz * 2.4 + vec2(3.7, 8.1));
            float crack = (1.0 - smoothstep(0.015, 0.085, crackEdge)) * mudTransition * detailFade;
            col = mix(col, col * vec3(0.52, 0.46, 0.38), crack * 0.72);
          }

          // Fine current-aligned sediment ribs remain readable in shallow mud.
          float sediment = sin(dot(xz, normalize(vec2(0.24, 1.0))) * 15.0 + fineN * 5.0);
          float sedimentMask = (1.0 - smoothstep(0.02, 0.48, wy)) * smoothstep(-0.45, -0.05, wy);
          col *= 1.0 + sediment * 0.028 * sedimentMask * detailFade;

          // Rain-filled depressions on compacted paths and orchard tracks.
          float puddle = trPuddleMask(xz, vPathFactor, vOrchardFactor);
          col = mix(col, vec3(0.075, 0.068, 0.052), puddle * 0.62);

          // Broad, slow cloud shadows bind ground, waterline and vegetation.
          float cloudShade = trCloudShadow(xz);
          col *= mix(1.0, 0.76, cloudShade * 0.52);

          diffuseColor.rgb *= col;
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float distN = length(cameraPosition - vTerrWorldPos);
          float nFade = 1.0 - smoothstep(25.0, 95.0, distN);
          if (nFade > 0.01) {
            float eps = 0.08;
            float hC = trRelief(vTerrWorldPos.xz);
            float hX = trRelief(vTerrWorldPos.xz + vec2(eps, 0.0));
            float hZ = trRelief(vTerrWorldPos.xz + vec2(0.0, eps));
            float bumpAmt = mix(0.65, 1.4, 1.0 - smoothstep(0.0, 0.55, vTerrWorldPos.y));
            vec3 pert = normalize(vec3((hC - hX) * bumpAmt, 1.0, (hC - hZ) * bumpAmt));
            // Transform world-space bump perturbation into view space
            vec3 viewPert = normalize((viewMatrix * vec4(pert, 0.0)).xyz);
            normal = normalize(mix(normal, normalize(normal + (viewPert - normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)) * 1.35), nFade * 0.85));
          }
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          float wetN = trNoise(vTerrWorldPos.xz * 2.1);
          float wetBand = 1.0 - smoothstep(0.05, 0.52, vTerrWorldPos.y + (wetN - 0.5) * 0.14);
          float pathDry = clamp(vPathFactor, 0.0, 1.0);
          float puddleR = trPuddleMask(vTerrWorldPos.xz, vPathFactor, vOrchardFactor);
          roughnessFactor = mix(0.92, 0.78, pathDry);
          roughnessFactor = mix(roughnessFactor, 0.14, wetBand * 0.92);
          roughnessFactor = mix(roughnessFactor, 0.07, puddleR * 0.88);
        }`,
      );
  };
  material.customProgramCacheKey = () => 'mekong-terrain-v1';

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'MekongTerrainMesh';
  group.add(mesh);

  return {
    group,
    heightDataTex,
    material,
    update: (elapsedTime: number) => {
      const shader = material.userData.shader as
        | { uniforms: { uTerrainTime?: { value: number } } }
        | undefined;
      if (shader?.uniforms.uTerrainTime) shader.uniforms.uTerrainTime.value = elapsedTime;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      heightDataTex.dispose();
    },
  };
}

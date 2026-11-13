import * as THREE from 'three';
import { WATER_LEVEL, WORLD_SIZE } from '../terrain/MekongHeightfield';

const WATER_PLANE_NORMAL = new THREE.Vector3(0, 1, 0);

/**
 * Shared CPU wave height & slope evaluation (mirrors the primary swell waves in GLSL)
 * so boats and floating water hyacinths pitch & roll realistically with the river.
 */
export function sampleRiverWave(x: number, z: number, time: number): {
  height: number;
  slopeX: number;
  slopeZ: number;
} {
  const dirAx = 0.28;
  const dirAz = 0.96;
  const dirBx = 0.85;
  const dirBz = 0.52;

  const pA = (x * dirAx + z * dirAz) * 0.24 - time * 1.15;
  const pB = (x * dirBx + z * dirBz) * 0.41 - time * 1.55;

  const ampA = 0.032;
  const ampB = 0.018;

  const h = Math.sin(pA) * ampA + Math.sin(pB) * ampB;
  const dA = Math.cos(pA) * ampA * 0.24;
  const dB = Math.cos(pB) * ampB * 0.41;

  return {
    height: WATER_LEVEL + h,
    slopeX: dA * dirAx + dB * dirBx,
    slopeZ: dA * dirAz + dB * dirBz,
  };
}

function updatePlanarReflectionCamera(
  sourceCamera: THREE.PerspectiveCamera,
  reflectionCamera: THREE.PerspectiveCamera,
  seaLevel: number,
  clipBias = 0.004,
): void {
  sourceCamera.updateMatrixWorld(true);
  reflectionCamera.copy(sourceCamera);

  const camPos = sourceCamera.getWorldPosition(new THREE.Vector3());
  const rotMat = new THREE.Matrix4().extractRotation(sourceCamera.matrixWorld);
  const reflectorPos = new THREE.Vector3(0, seaLevel, 0);

  const view = reflectorPos
    .clone()
    .sub(camPos)
    .reflect(WATER_PLANE_NORMAL)
    .negate()
    .add(reflectorPos);

  const lookTarget = new THREE.Vector3(0, 0, -1)
    .applyMatrix4(rotMat)
    .add(camPos);

  const target = reflectorPos
    .clone()
    .sub(lookTarget)
    .reflect(WATER_PLANE_NORMAL)
    .negate()
    .add(reflectorPos);

  const up = new THREE.Vector3(0, 1, 0)
    .applyMatrix4(rotMat)
    .reflect(WATER_PLANE_NORMAL);

  reflectionCamera.position.copy(view);
  reflectionCamera.up.copy(up);
  reflectionCamera.lookAt(target);
  reflectionCamera.updateMatrixWorld(true);
  reflectionCamera.projectionMatrix.copy(sourceCamera.projectionMatrix);

  const reflectorPlane = new THREE.Plane(WATER_PLANE_NORMAL.clone(), -seaLevel);
  reflectorPlane.applyMatrix4(reflectionCamera.matrixWorldInverse);
  const clipPlane = new THREE.Vector4(
    reflectorPlane.normal.x,
    reflectorPlane.normal.y,
    reflectorPlane.normal.z,
    reflectorPlane.constant,
  );
  const projection = reflectionCamera.projectionMatrix;
  const e = projection.elements;
  const q = new THREE.Vector4(
    (Math.sign(clipPlane.x) + e[8]) / e[0],
    (Math.sign(clipPlane.y) + e[9]) / e[5],
    -1,
    (1 + e[10]) / e[14],
  );
  clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
  e[2] = clipPlane.x;
  e[6] = clipPlane.y;
  e[10] = clipPlane.z + 1.0 - clipBias;
  e[14] = clipPlane.w;
  reflectionCamera.projectionMatrixInverse.copy(projection).invert();
}

export interface MekongWaterSystem {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  updateUniforms: (params: {
    time: number;
    sunDir: THREE.Vector3;
    sunColor: THREE.Color;
    sunIntensity: number;
    skyHorizonColor: THREE.Color;
    skyZenithColor: THREE.Color;
    fogColor: THREE.Color;
    fogDensity: number;
    camera: THREE.Camera;
  }) => void;
  renderReflection: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    hiddenObjects?: THREE.Object3D[],
  ) => void;
  setInteractionPoints: (points: THREE.Vector4[]) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createMekongWater(heightDataTex: THREE.DataTexture): MekongWaterSystem {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 160, 160);
  geometry.rotateX(-Math.PI / 2);

  let reflWidth = 640;
  let reflHeight = 360;
  const reflTarget = new THREE.WebGLRenderTarget(reflWidth, reflHeight, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });

  const reflCamera = new THREE.PerspectiveCamera();
  const textureMatrix = new THREE.Matrix4();

  const uniforms = {
    uTime: { value: 0 },
    uWorldSize: { value: WORLD_SIZE },
    uSeaLevel: { value: WATER_LEVEL },
    uHeightMap: { value: heightDataTex },
    uHeightTexSize: { value: 512.0 },
    uPlanarReflection: { value: reflTarget.texture },
    uPlanarReflectionMatrix: { value: textureMatrix },
    uPlanarEnabled: { value: 1.0 },
    uSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
    uSunColor: { value: new THREE.Color(0xffe4b5) },
    uSunIntensity: { value: 2.5 },
    uSkyHorizon: { value: new THREE.Color(0xd7c7ad) },
    uSkyZenith: { value: new THREE.Color(0x4b749f) },
    uFogColor: { value: new THREE.Color(0xcfbca0) },
    uFogDensity: { value: 0.0028 },
    uCameraPos: { value: new THREE.Vector3() },
    uInteract: {
      value: Array.from({ length: 20 }, () => new THREE.Vector4(0, 0, 0, 0)),
    },
    uInteractCount: { value: 0 },
  };

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform mat4 uPlanarReflectionMatrix;

    varying vec3 vWorldPos;
    varying vec4 vReflCoord;
    varying float vCrest;

    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);

      // Gentle Mekong river swell displacement
      float pA = dot(wp.xz, vec2(0.28, 0.96)) * 0.24 - uTime * 1.15;
      float pB = dot(wp.xz, vec2(0.85, 0.52)) * 0.41 - uTime * 1.55;
      float disp = sin(pA) * 0.032 + sin(pB) * 0.018;
      wp.y += disp;

      vWorldPos = wp.xyz;
      vCrest = clamp((disp / 0.05) * 0.5 + 0.5, 0.0, 1.0);
      vReflCoord = uPlanarReflectionMatrix * wp;

      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const fragmentShader = /* glsl */ `
    precision highp float;

    uniform float uTime;
    uniform float uWorldSize;
    uniform float uSeaLevel;
    uniform sampler2D uHeightMap;
    uniform float uHeightTexSize;
    uniform sampler2D uPlanarReflection;
    uniform float uPlanarEnabled;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform float uSunIntensity;
    uniform vec3 uSkyHorizon;
    uniform vec3 uSkyZenith;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform vec3 uCameraPos;
    uniform vec4 uInteract[20];
    uniform int uInteractCount;

    varying vec3 vWorldPos;
    varying vec4 vReflCoord;
    varying float vCrest;

    const float PI = 3.14159265359;
    const float F0 = 0.02037;

    float hash2(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
        mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float s = 0.0;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      s += 0.54 * vnoise(p);
      p = rot * p * 2.13 + vec2(17.1, 31.7);
      s += 0.30 * vnoise(p);
      p = rot * p * 2.19 + vec2(7.3, 19.2);
      s += 0.16 * vnoise(p);
      return s;
    }

    vec2 domainWarp(vec2 xz, float t) {
      vec2 warp = vec2(
        vnoise(xz * 0.09 + vec2(0.0, t * 0.018)),
        vnoise(xz * 0.09 + vec2(19.7, -t * 0.014))
      ) - 0.5;
      return xz + warp * 2.1;
    }

    float foamLace(float field) {
      float contour = 1.0 - smoothstep(0.015, 0.115, abs(field - 0.54));
      float sheet = smoothstep(0.68, 0.88, field) * 0.55;
      return clamp(contour + sheet, 0.0, 1.0);
    }

    float cellGlitter(vec2 p, float t) {
      vec2 cell = floor(p);
      float h = hash2(cell);
      float twinkle = 0.5 + 0.5 * sin(t * (1.6 + h * 2.4) + h * 41.0);
      float local = smoothstep(0.18, 0.02, length(fract(p) - 0.5));
      return step(0.935, h) * twinkle * local;
    }

    // 16-bit RG height decode + bilinear filtering across texels
    float decodeHeight(vec4 texel) {
      float hNorm = (texel.r * 255.0 * 256.0 + texel.g * 255.0) / 65535.0;
      return hNorm * 20.0 - 8.0;
    }

    float sampleTerrainHeight(vec2 xz) {
      vec2 uv = clamp((xz + uWorldSize * 0.5) / uWorldSize, 0.0, 1.0);
      vec2 texelPos = uv * (uHeightTexSize - 1.0);
      vec2 i0 = floor(texelPos);
      vec2 f = fract(texelPos);
      vec2 inv = vec2(1.0 / uHeightTexSize);

      vec2 uv00 = (i0 + 0.5) * inv;
      vec2 uv10 = (i0 + vec2(1.5, 0.5)) * inv;
      vec2 uv01 = (i0 + vec2(0.5, 1.5)) * inv;
      vec2 uv11 = (i0 + vec2(1.5, 1.5)) * inv;

      float h00 = decodeHeight(texture2D(uHeightMap, uv00));
      float h10 = decodeHeight(texture2D(uHeightMap, uv10));
      float h01 = decodeHeight(texture2D(uHeightMap, uv01));
      float h11 = decodeHeight(texture2D(uHeightMap, uv11));

      return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
    }

    // Multi-scale Mekong current ripple heightfield
    float waterRippleHeight(vec2 xz, float t) {
      // Advect downstream along +Z / slight -X river current
      vec2 flowA = xz * 0.42 + vec2(0.08, -0.35) * t;
      vec2 flowB = xz * 1.15 + vec2(-0.18, -0.52) * t;
      vec2 flowC = xz * 3.10 + vec2(0.14, -0.78) * t;

      float swell = sin(dot(xz, vec2(0.28, 0.96)) * 0.24 - t * 1.15) * 0.35
                  + sin(dot(xz, vec2(0.85, 0.52)) * 0.41 - t * 1.55) * 0.20;
      float w1 = (fbm(flowA) - 0.5) * 0.42;
      float w2 = (fbm(flowB) - 0.5) * 0.24;
      float w3 = (vnoise(flowC) - 0.5) * 0.08;
      return swell + w1 + w2 + w3;
    }

    vec3 computeWaterNormal(vec2 xz, float t, float camDist) {
      float detailFade = 1.0 - smoothstep(35.0, 180.0, camDist);
      float eps = mix(0.22, 0.06, detailFade);
      float hC = waterRippleHeight(xz, t);
      float hX = waterRippleHeight(xz + vec2(eps, 0.0), t);
      float hZ = waterRippleHeight(xz + vec2(0.0, eps), t);
      float strength = mix(0.09, 0.22, detailFade);
      return normalize(vec3((hC - hX) * strength / eps, 1.0, (hC - hZ) * strength / eps));
    }

    float ggxSpecular(vec3 N, vec3 V, vec3 L, float roughness) {
      float NoV = max(dot(N, V), 0.001);
      float NoL = max(dot(N, L), 0.0);
      if (NoL <= 0.0) return 0.0;
      vec3 H = normalize(V + L);
      float NoH = max(dot(N, H), 0.0);
      float VoH = max(dot(V, H), 0.0);
      float a = max(roughness * roughness, 0.002);
      float a2 = a * a;
      float denom = NoH * NoH * (a2 - 1.0) + 1.0;
      float D = a2 / max(PI * denom * denom, 0.0001);
      float k = (roughness + 1.0);
      k = k * k * 0.125;
      float Gv = NoV / (NoV * (1.0 - k) + k);
      float Gl = NoL / (NoL * (1.0 - k) + k);
      float F = F0 + (1.0 - F0) * pow(1.0 - VoH, 5.0);
      return D * Gv * Gl * F * NoL / max(4.0 * NoV * NoL, 0.001);
    }

    void main() {
      float terrainY = sampleTerrainHeight(vWorldPos.xz);
      float depth = uSeaLevel - terrainY;

      // Clean clip right inside dry banks to prevent z-fighting with terrain
      if (depth < -0.02) discard;
      float safeDepth = max(depth, 0.0);

      vec3 toCam = uCameraPos - vWorldPos;
      float camDist = length(toCam);
      vec3 V = toCam / max(camDist, 0.0001);
      vec3 L = normalize(uSunDir);

      vec2 warpedXZ = camDist < 120.0 ? domainWarp(vWorldPos.xz, uTime) : vWorldPos.xz;
      vec3 N = computeWaterNormal(warpedXZ, uTime, camDist);

      // Pilings, moored hulls and bridge piers shed small expanding rings (near-field).
      float interactionFoam = 0.0;
      if (camDist < 75.0) {
        vec2 interactionGradient = vec2(0.0);
        for (int i = 0; i < 20; i++) {
          if (i >= uInteractCount) break;
          vec4 anchor = uInteract[i];
          if (anchor.z <= 0.001) continue;
          vec2 delta = vWorldPos.xz - anchor.xy;
          float d2 = dot(delta, delta);
          if (d2 > anchor.z * anchor.z) continue;
          float dist = sqrt(d2);
          float envelope = exp(-dist * 0.52) * smoothstep(anchor.z, anchor.z * 0.18, dist);
          float ring = sin(dist * 13.0 - uTime * 2.7 + anchor.w * 6.2831);
          interactionGradient += (delta / max(dist, 0.001)) * ring * envelope;
          interactionFoam += smoothstep(0.35, 0.92, ring * 0.5 + 0.5) * envelope;
        }
        N.xz += interactionGradient * 0.075;
        N = normalize(N);
      }

      // Schlick Fresnel (grazing angle reflection dominance)
      float NoV = clamp(dot(N, V), 0.0, 1.0);
      float fresnel = F0 + (1.0 - F0) * pow(1.0 - NoV, 5.0);
      fresnel = clamp(fresnel * 1.08, 0.03, 0.94);

      // --- Authentic Mekong Alluvial Silt Absorption ("Nước Phù Sa") ---
      float siltTurbidity = fbm(vWorldPos.xz * 0.18 + vec2(0.03, -0.11) * uTime);
      vec3 shallowSiltCol = mix(vec3(0.24, 0.17, 0.095), vec3(0.30, 0.22, 0.125), siltTurbidity);
      vec3 deepMekongCol = mix(vec3(0.085, 0.072, 0.044), vec3(0.12, 0.098, 0.058), siltTurbidity);

      // Beer-Lambert fast silt attenuation (Mekong water becomes opaque around 1.1m)
      vec3 absorption = vec3(1.65, 1.95, 2.65);
      vec3 transmittance = exp(-absorption * safeDepth);
      float sunUp = clamp(L.y * 1.8 + 0.15, 0.08, 1.0);
      vec3 sunLight = uSunColor * uSunIntensity * 0.28 + uSkyHorizon * 0.24;

      vec3 waterBody = mix(deepMekongCol, shallowSiltCol, dot(transmittance, vec3(0.333)));
      waterBody *= sunLight * (0.58 + 0.42 * sunUp);

      // --- Real Planar Reflection + Sky Fresnel Fallback ---
      vec3 skyReflDir = reflect(-V, N);
      float skyGrad = smoothstep(-0.05, 0.65, max(skyReflDir.y, 0.0));
      vec3 fallbackSky = mix(uSkyHorizon * 0.72, uSkyZenith * 0.85, skyGrad);

      vec3 reflColor = fallbackSky;
      if (uPlanarEnabled > 0.5 && vReflCoord.w > 0.001) {
        vec2 reflUv = (vReflCoord.xy / vReflCoord.w) * 0.5 + 0.5;
        vec2 distort = N.xz * (0.042 + 0.022 * (1.0 - NoV));
        vec2 sampleUv = clamp(reflUv + distort, 0.002, 0.998);
        vec3 planarTex = min(texture2D(uPlanarReflection, sampleUv).rgb, vec3(1.65));
        float edgeFade = smoothstep(0.0, 0.08, sampleUv.x) * smoothstep(1.0, 0.92, sampleUv.x)
                       * smoothstep(0.0, 0.08, sampleUv.y) * smoothstep(1.0, 0.92, sampleUv.y);
        reflColor = mix(fallbackSky, planarTex, edgeFade);
      }

      // --- GGX Sun Specular Sparkle across Ripples ---
      // Derivative slope variance broadens only unresolved distant facets;
      // nearby ripples keep compact, physically separated glints.
      vec3 dNx = dFdx(N);
      vec3 dNy = dFdy(N);
      float slopeVariance = clamp(max(dot(dNx, dNx), dot(dNy, dNy)) * 1.8, 0.0, 1.0);
      float adaptiveRoughness = mix(0.052, 0.17, slopeVariance);
      float specPrimary = ggxSpecular(N, V, L, adaptiveRoughness) * uSunIntensity * 0.72;
      float specGlint = ggxSpecular(N, V, L, 0.018) * uSunIntensity * 0.48;
      vec3 specular = uSunColor * (specPrimary + specGlint) * smoothstep(-0.02, 0.14, L.y);

      // Fixed surface cells twinkle in place, avoiding marching sparkle.
      vec2 glitterPos = warpedXZ * vec2(1.35, 2.35) + vec2(uTime * 0.22, -uTime * 0.11);
      float glitter = cellGlitter(glitterPos, uTime)
        * smoothstep(0.08, 0.42, specGlint + specPrimary * 0.35)
        * (1.0 - smoothstep(55.0, 150.0, camDist));
      specular += uSunColor * glitter * 0.38 * smoothstep(-0.02, 0.14, L.y);

      // Shallow alluvial caustic shimmer (near-field only).
      if (camDist < 70.0 && safeDepth < 1.35) {
        float causticField = vnoise(warpedXZ * 2.25 + vec2(uTime * 0.32, -uTime * 0.21)) * 0.65
                           + vnoise(warpedXZ * 4.8 - vec2(uTime * 0.21, uTime * 0.19)) * 0.35;
        float caustic = pow(smoothstep(0.48, 0.82, causticField), 2.0)
          * (1.0 - smoothstep(0.25, 1.35, safeDepth));
        waterBody += vec3(0.10, 0.085, 0.045) * caustic * sunUp * 0.55;
      }

      // --- Broken alluvial shoreline foam / meniscus ---
      float shoreBand = 1.0 - smoothstep(0.008, 0.22, safeDepth);
      float shoreFoam = 0.0;
      if (shoreBand > 0.01) {
        float foamField = vnoise(warpedXZ * 1.65 - vec2(0.12 * uTime, 0.42 * uTime)) * 0.65
                        + vnoise(warpedXZ * 3.7 + vec2(0.08 * uTime, -0.35 * uTime)) * 0.35;
        shoreFoam = shoreBand * foamLace(foamField);
      }
      float totalFoam = clamp(shoreFoam * 0.72 + interactionFoam * 0.58, 0.0, 1.0);
      vec3 foamCol = vec3(0.58, 0.52, 0.40) * (uSunColor * 0.38 + uSkyHorizon * 0.52);

      float cleanFoam = clamp(shoreFoam * 0.65 + interactionFoam * 0.16, 0.0, 1.0);
      vec3 color = mix(waterBody, reflColor, fresnel * 0.88) + specular;
      color = mix(color, foamCol, clamp(cleanFoam * 0.42, 0.0, 0.5));

      // Smooth alpha feathering at very edge of wet bank (0 .. 0.06m)
      float edgeAlpha = smoothstep(0.0, 0.06, safeDepth);

      // Exponential squared atmospheric haze matching scene fog
      float fogFactor = 1.0 - exp(-pow(camDist * uFogDensity, 1.55));
      color = mix(color, uFogColor, clamp(fogFactor, 0.0, 0.98));

      gl_FragColor = vec4(color, edgeAlpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = WATER_LEVEL;
  mesh.name = 'MekongRiverWater';

  return {
    mesh,
    material,
    updateUniforms: ({
      time,
      sunDir,
      sunColor,
      sunIntensity,
      skyHorizonColor,
      skyZenithColor,
      fogColor,
      fogDensity,
      camera,
    }) => {
      uniforms.uTime.value = time;
      uniforms.uSunDir.value.copy(sunDir).normalize();
      uniforms.uSunColor.value.copy(sunColor);
      uniforms.uSunIntensity.value = sunIntensity;
      uniforms.uSkyHorizon.value.copy(skyHorizonColor);
      uniforms.uSkyZenith.value.copy(skyZenithColor);
      uniforms.uFogColor.value.copy(fogColor);
      uniforms.uFogDensity.value = fogDensity;
      uniforms.uCameraPos.value.copy(camera.position);
    },
    renderReflection: (renderer, scene, camera, hiddenObjects = []) => {
      if (camera.position.y <= WATER_LEVEL + 0.06) {
        uniforms.uPlanarEnabled.value = 0.0;
        return;
      }
      uniforms.uPlanarEnabled.value = 1.0;

      updatePlanarReflectionCamera(camera, reflCamera, WATER_LEVEL);
      textureMatrix.multiplyMatrices(
        reflCamera.projectionMatrix,
        reflCamera.matrixWorldInverse,
      );

      const savedVis: Array<[THREE.Object3D, boolean]> = [
        [mesh, mesh.visible],
      ];
      mesh.visible = false;
      for (const obj of hiddenObjects) {
        if (obj) {
          savedVis.push([obj, obj.visible]);
          obj.visible = false;
        }
      }

      const prevTarget = renderer.getRenderTarget();
      const prevShadowAuto = renderer.shadowMap.autoUpdate;
      const prevXr = renderer.xr.enabled;

      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(reflTarget);
      renderer.clear();
      renderer.render(scene, reflCamera);

      renderer.setRenderTarget(prevTarget);
      renderer.shadowMap.autoUpdate = prevShadowAuto;
      renderer.xr.enabled = prevXr;
      for (const [obj, vis] of savedVis) {
        obj.visible = vis;
      }
    },
    setInteractionPoints: (points: THREE.Vector4[]) => {
      const arr = uniforms.uInteract.value as THREE.Vector4[];
      const count = Math.min(points.length, arr.length);
      for (let i = 0; i < arr.length; i++) {
        if (i < count) arr[i].copy(points[i]);
        else arr[i].set(0, 0, 0, 0);
      }
      uniforms.uInteractCount.value = count;
    },
    resize: (width, height) => {
      const targetW = Math.max(256, Math.round(width * 0.5));
      const targetH = Math.max(256, Math.round(height * 0.5));
      if (targetW !== reflWidth || targetH !== reflHeight) {
        reflWidth = targetW;
        reflHeight = targetH;
        reflTarget.setSize(targetW, targetH);
      }
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      reflTarget.dispose();
    },
  };
}

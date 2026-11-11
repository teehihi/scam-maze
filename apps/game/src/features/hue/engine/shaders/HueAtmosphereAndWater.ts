import * as THREE from 'three';
import {
  WATER_LEVEL_RIVER,
  WATER_LEVEL_TU_DUC,
  WORLD_SIZE,
} from '../../world/hueWorldConfig';
import type { AtmospherePreset } from '../../world/hueWorldConfig';
import { ensureSharedBakes, HUE_NOISE_GLSL, HUE_SHARED } from '../materials/HueSurface';

export interface AtmosphereAndWaterSystem {
  skyMesh: THREE.Mesh;
  riverWater: THREE.Mesh;
  lakeWater: THREE.Mesh;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  applyAtmosphere: (
    preset: AtmospherePreset,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
  ) => void;
  update: (elapsed: number, cameraPos: THREE.Vector3) => void;
  dispose: (targetScene?: THREE.Scene) => void;
}

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vWorldDir = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uFogColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uStars;
uniform float uHaze;

varying vec3 vWorldDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise2(p);
    p *= 2.04;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float y = dir.y;

  float horizonBlend = 1.0 - pow(max(y, 0.0), 0.46);
  vec3 sky = mix(uSkyZenith, uSkyHorizon, horizonBlend);

  float hazeBand = exp(-abs(y) * 7.5);
  sky = mix(sky, uFogColor, hazeBand * uHaze);
  if (y < 0.0) {
    sky = mix(sky, uFogColor, clamp(-y * 4.5, 0.0, 1.0));
  }

  // Sun / Moon disc & Mie atmospheric scattering
  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  float disc = smoothstep(0.9992, 0.9997, sunDot);
  float glow = pow(sunDot, 160.0) * 0.75;
  float halo = pow(sunDot, 14.0) * 0.24;
  float horizonWarmth = pow(sunDot, 4.0) * hazeBand * 0.34;
  float overcast = smoothstep(0.7, 1.0, uHaze);
  sky += uSunColor * (disc * 2.8 * (1.0 - overcast) + glow * (1.0 - overcast * 0.85) + halo + horizonWarmth);

  // Humid tropical cumulus: domain-warped fbm, sun-lit crowns, shadowed bases, silver lining
  if (y > 0.0) {
    vec2 cuv = dir.xz / (y + 0.12) * 0.6 + vec2(uTime * 0.004, uTime * 0.0016);
    vec2 warp = vec2(fbm(cuv * 0.8 + 3.1), fbm(cuv * 0.8 - 7.3));
    float c = fbm(cuv * 1.25 + warp * 1.4);
    float cov = mix(0.5, 0.36, uHaze);
    float dens = smoothstep(cov, cov + 0.26, c) * smoothstep(0.0, 0.18, y);
    float cTop = fbm(cuv * 1.25 + warp * 1.4 + normalize(uSunDir.xz + 1e-4) * 0.06);
    float lit = clamp((c - cTop) * 6.0 + 0.55, 0.0, 1.0);
    vec3 base = mix(uSkyHorizon * 0.62, uFogColor * 0.8, 0.4);
    vec3 crown = mix(uSkyHorizon * 1.12, uSunColor * 1.05, 0.35 + 0.4 * max(uSunDir.y, 0.0));
    vec3 cloudCol = mix(base, crown, lit);
    float edge = smoothstep(cov, cov + 0.08, c) * (1.0 - smoothstep(cov + 0.08, cov + 0.22, c));
    cloudCol += uSunColor * edge * pow(sunDot, 6.0) * 1.4;
    // thin high cirrus veil
    float ci = fbm(vec2(cuv.x * 0.35, cuv.y * 2.2) + 11.0);
    sky = mix(sky, uSkyHorizon * 1.08, smoothstep(0.55, 0.85, ci) * 0.18 * smoothstep(0.05, 0.4, y));
    float far = 1.0 - smoothstep(0.0, 0.12, y);
    sky = mix(sky, cloudCol, dens * 0.88 * (1.0 - uStars * 0.6) * (1.0 - far * 0.5));
  }

  // Night stars
  if (uStars > 0.02 && y > 0.03) {
    vec3 cell = floor(dir * 260.0);
    float sh = hash21(cell.xy + cell.z * 17.3);
    float star = step(0.9965, sh) * smoothstep(0.03, 0.28, y);
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.4 + sh * 100.0);
    sky += vec3(0.85, 0.9, 1.0) * star * twinkle * uStars * 0.95;
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;

function createHueWaterShader(flowSpeed: number, rippleScale: number, waterLevel = 0) {
  ensureSharedBakes();
  return new THREE.ShaderMaterial({
    name: 'HueStylizedWaterShader',
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.4).normalize() },
      uSunColor: { value: new THREE.Color(0xffe7be) },
      uSkyZenith: { value: new THREE.Color(0x2c67a8) },
      uSkyHorizon: { value: new THREE.Color(0xd9d8cc) },
      uWaterShallow: { value: new THREE.Color(0x285e58) },
      uWaterDeep: { value: new THREE.Color(0x102e34) },
      uFogColor: { value: new THREE.Color(0xc9d5da) },
      uFogDensity: { value: 0.00145 },
      uFlowSpeed: { value: flowSpeed },
      uRippleScale: { value: rippleScale },
      uWaterLevel: { value: waterLevel },
      hTerrainH: HUE_SHARED.hTerrainH,
      hTerrainRect: HUE_SHARED.hTerrainRect,
      hWetness: HUE_SHARED.hWetness,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyHorizon;
      uniform vec3 uWaterShallow;
      uniform vec3 uWaterDeep;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform float uFlowSpeed;
      uniform float uRippleScale;
      uniform float uWaterLevel;
      uniform sampler2D hTerrainH;
      uniform vec4 hTerrainRect;
      uniform float hWetness;

      varying vec3 vWorldPos;
      ${HUE_NOISE_GLSL}

      float wh(vec2 p, float t) {
        vec2 flow = vec2(-t * uFlowSpeed, t * uFlowSpeed * 0.18);
        float h = hNoise(p * 0.18 + flow * 0.18) * 0.55;
        h += hNoise(p * 0.55 + flow * 0.5 + vec2(t * 0.05, -t * 0.07)) * 0.28;
        h += hNoise(p * 1.7 + flow * 1.2 - vec2(t * 0.21, t * 0.13)) * 0.12;
        h += hNoise(p * 4.3 + vec2(-t * 0.6, t * 0.45)) * 0.05;
        return h;
      }

      void main() {
        vec2 p = vWorldPos.xz * uRippleScale;
        float dist = length(cameraPosition - vWorldPos);
        float eps = 0.06 + dist * 0.0015;
        float h0 = wh(p, uTime);
        float hx = wh(p + vec2(eps, 0.0), uTime);
        float hz = wh(p + vec2(0.0, eps), uTime);
        float amp = mix(0.55, 0.18, smoothstep(10.0, 220.0, dist)) * (1.0 + hWetness * 1.2);
        vec3 n = normalize(vec3((h0 - hx) / eps * amp, 1.0, (h0 - hz) / eps * amp));

        // rain drop rings during drizzle
        if (hWetness > 0.01) {
          vec2 cell = floor(vWorldPos.xz * 1.3);
          vec2 f = fract(vWorldPos.xz * 1.3) - 0.5;
          float ph = fract(uTime * 0.8 + hHash(cell));
          float ring = sin((length(f) - ph * 0.5) * 60.0) * (1.0 - ph) * smoothstep(0.5, 0.0, length(f));
          n.xz += f * ring * 0.6 * hWetness;
          n = normalize(n);
        }

        vec3 V = normalize(cameraPosition - vWorldPos);

        // depth below surface from terrain heightmap -> turbid alluvial shallows vs jade depths
        float bed = texture2D(hTerrainH, (vWorldPos.xz - hTerrainRect.xy) / hTerrainRect.z).r;
        float depth = max(uWaterLevel - bed, 0.0);
        float depthF = 1.0 - exp(-depth * 0.35);
        vec3 silt = uWaterShallow * vec3(1.15, 1.05, 0.75);
        vec3 body = mix(silt, uWaterDeep * 0.75, depthF) * 0.62;
        body *= 0.85 + 0.15 * hNoise(vWorldPos.xz * 0.02 + uTime * 0.01);

        // Fast analytic sky & mountain reflection
        vec3 R = reflect(-V, n);
        float horizonBlend = 1.0 - pow(max(R.y, 0.0), 0.38);
        vec3 refl = mix(uSkyZenith, uSkyHorizon, horizonBlend);

        // Subtle mountain reflection tint along horizon
        float mtnBand = exp(-abs(R.y) * 10.0) * 0.35;
        refl = mix(refl, uFogColor * 0.68, mtnBand);

        // Shimmering sun reflection glints
        float sunSpec = max(dot(R, normalize(uSunDir)), 0.0);
        refl += uSunColor * (pow(sunSpec, 72.0) * 1.9 + pow(sunSpec, 9.0) * 0.3);

        // Fresnel blending
        float ndv = clamp(dot(n, V), 0.0, 1.0);
        float F = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);
        F = mix(F, 0.0, smoothstep(1.2, 0.0, depth) * 0.6);
        vec3 col = mix(body, refl, clamp(F, 0.0, 0.94));

        // GGX sun glint specular highlights
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(V + L);
        float ndh = max(dot(n, H), 0.0);
        float a2 = 0.014;
        float dd = ndh * ndh * (a2 - 1.0) + 1.0;
        float D = a2 / (3.14159 * dd * dd);
        col += uSunColor * D * F * 0.35 * smoothstep(0.0, 0.08, L.y);

        float fogFactor = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createHueAtmosphereAndWater(
  scene: THREE.Scene,
): AtmosphereAndWaterSystem {
  // 1. Procedural Sky Dome (radius 1300m)
  const skyGeo = new THREE.SphereGeometry(1300, 40, 24);
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uSkyZenith: { value: new THREE.Color(0x2c67a8) },
      uSkyHorizon: { value: new THREE.Color(0xd9d8cc) },
      uFogColor: { value: new THREE.Color(0xc9d5da) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.6, 0.4).normalize() },
      uSunColor: { value: new THREE.Color(0xffe7be) },
      uTime: { value: 0 },
      uStars: { value: 0 },
      uHaze: { value: 0.62 },
    },
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  // 2. Main Sun/Moon Directional Shadow Light & Ambient Hemisphere Light
  const sunLight = new THREE.DirectionalLight(0xffe7be, 3.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.radius = 2.0;
  sunLight.shadow.blurSamples = 4;
  sunLight.shadow.camera.near = 20;
  sunLight.shadow.camera.far = 750;
  const shadowExtent = 60;
  sunLight.shadow.camera.left = -shadowExtent;
  sunLight.shadow.camera.right = shadowExtent;
  sunLight.shadow.camera.top = shadowExtent;
  sunLight.shadow.camera.bottom = -shadowExtent;
  sunLight.shadow.bias = -0.0002;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0x98c2ea, 0x4a4337, 0.92);
  scene.add(hemiLight);

  // 3. Fast Zero-Overhead Sông Hương & Kênh Như Ý Water Plane (y = 0)
  const riverGeo = new THREE.PlaneGeometry(WORLD_SIZE + 260, WORLD_SIZE + 260);
  const riverMat = createHueWaterShader(0.55, 0.65, WATER_LEVEL_RIVER);
  const riverWater = new THREE.Mesh(riverGeo, riverMat);
  riverWater.rotation.x = -Math.PI * 0.5;
  riverWater.position.y = WATER_LEVEL_RIVER;
  scene.add(riverWater);

  // 4. Fast Zero-Overhead Hồ Lưu Khiêm (Lăng Tự Đức Lotus Lake, y = 4.0)
  const lakeGeo = new THREE.CircleGeometry(52, 48);
  const lakeMat = createHueWaterShader(0.16, 1.05, WATER_LEVEL_TU_DUC);
  const lakeWater = new THREE.Mesh(lakeGeo, lakeMat);
  lakeWater.rotation.x = -Math.PI * 0.5;
  lakeWater.position.set(-72, WATER_LEVEL_TU_DUC, 175);
  scene.add(lakeWater);

  // Dedicated offscreen sky-only scene for PMREM environment lighting generation
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat);
  envScene.add(envSky);
  // Earth-toned lower hemisphere so ambient bounce comes from soil & vegetation, not bright haze
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(48, 32), new THREE.MeshBasicMaterial({ color: 0x2b2a1f, side: THREE.DoubleSide }));
  envGround.rotation.x = -Math.PI / 2;
  envGround.position.y = -2;
  envScene.add(envGround);

  const sunDirVec = new THREE.Vector3();
  let pmrem: THREE.PMREMGenerator | null = null;
  let currentEnvRT: THREE.WebGLRenderTarget | null = null;

  const applyAtmosphere = (
    preset: AtmospherePreset,
    renderer: THREE.WebGLRenderer,
    targetScene: THREE.Scene,
  ) => {
    const phi = THREE.MathUtils.degToRad(90 - preset.sunElevation);
    const theta = THREE.MathUtils.degToRad(preset.sunAzimuth);
    sunDirVec.setFromSphericalCoords(1, phi, theta).normalize();

    skyMat.uniforms.uSkyZenith.value.set(preset.skyZenith);
    skyMat.uniforms.uSkyHorizon.value.set(preset.skyHorizon);
    skyMat.uniforms.uFogColor.value.set(preset.fogColor);
    skyMat.uniforms.uSunDir.value.copy(sunDirVec);
    skyMat.uniforms.uSunColor.value.set(preset.sunColor);
    skyMat.uniforms.uStars.value = preset.stars;
    skyMat.uniforms.uHaze.value = 0.62 + preset.rainIntensity * 0.38;

    sunLight.color.set(preset.sunColor);
    sunLight.intensity = preset.sunIntensity;
    hemiLight.color.set(preset.ambientSky);
    hemiLight.groundColor.set(preset.ambientGround);
    hemiLight.intensity = preset.ambientIntensity * 0.38;
    HUE_SHARED.hSunDir.value.copy(sunDirVec);
    HUE_SHARED.hSunColor.value.set(preset.sunColor).multiplyScalar(Math.min(1.2, preset.sunIntensity / 3));
    (envGround.material as THREE.MeshBasicMaterial).color.set(preset.ambientGround).multiplyScalar(0.55);

    targetScene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
    renderer.toneMappingExposure = preset.exposure;

    [riverWater, lakeWater].forEach((water) => {
      const u = (water.material as THREE.ShaderMaterial).uniforms;
      u.uSunDir.value.copy(sunDirVec);
      u.uSunColor.value.set(preset.sunColor);
      u.uSkyZenith.value.set(preset.skyZenith);
      u.uSkyHorizon.value.set(preset.skyHorizon);
      u.uWaterShallow.value.set(preset.waterShallow);
      u.uWaterDeep.value.set(preset.waterDeep);
      u.uFogColor.value.set(preset.fogColor);
      u.uFogDensity.value = preset.fogDensity;
    });

    // Sync PBR sky reflections across gilt bronze, glazed ngói lưu ly, steel, and mosaic shards
    if (!pmrem) {
      pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
    }
    if (currentEnvRT) currentEnvRT.dispose();
    currentEnvRT = pmrem.fromScene(envScene, 0.04);
    targetScene.environment = currentEnvRT.texture;
    targetScene.environmentIntensity = preset.id === 'night' ? 0.4 : 1.0;
  };

  const update = (elapsed: number, cameraPos: THREE.Vector3) => {
    skyMat.uniforms.uTime.value = elapsed;
    skyMesh.position.copy(cameraPos);
    skyMesh.updateMatrixWorld();

    (riverWater.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    (lakeWater.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;

    // Only render lake reflection when player is in or near Tự Đức lake basin
    const distToTuDuc = Math.hypot(cameraPos.x - (-87), cameraPos.z - 170);
    lakeWater.visible = distToTuDuc < 220;

    // Keep shadow frustum centered near camera so close-up architectural details always receive crisp shadows!
    const snap = 4.0;
    const sx = Math.round(cameraPos.x / snap) * snap;
    const sz = Math.round(cameraPos.z / snap) * snap;
    sunLight.target.position.set(sx, 6, sz);
    sunLight.position.set(
      sx + sunDirVec.x * 260,
      6 + sunDirVec.y * 260,
      sz + sunDirVec.z * 260,
    );
    sunLight.target.updateMatrixWorld();
  };

  const dispose = (targetScene?: THREE.Scene) => {
    if (targetScene) {
      targetScene.environment = null;
      targetScene.fog = null;
    }
    if (currentEnvRT) {
      currentEnvRT.dispose();
      currentEnvRT = null;
    }
    if (pmrem) {
      pmrem.dispose();
      pmrem = null;
    }

    envScene.traverse((obj) => {
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
    envScene.clear();

    skyGeo.dispose();
    skyMat.dispose();
    riverGeo.dispose();
    riverMat.dispose();
    lakeGeo.dispose();
    lakeMat.dispose();

    if (sunLight.shadow.map) {
      sunLight.shadow.map.dispose();
      sunLight.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
  };

  return {
    skyMesh,
    riverWater,
    lakeWater,
    sunLight,
    hemiLight,
    applyAtmosphere,
    update,
    dispose,
  };
}

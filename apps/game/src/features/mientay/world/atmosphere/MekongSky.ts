import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { clamp, lerp, smoothstep } from '../math/Noise';

export interface AtmosphereState {
  timeOfDay: number; // hours 5.5 .. 21.0
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  skyHorizonColor: THREE.Color;
  skyZenithColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  nightFactor: number; // 0 in day, 1 at twilight/night
}

export interface MekongAtmosphereSystem {
  group: THREE.Group;
  csm: CSM;
  state: AtmosphereState;
  setTimeOfDay: (hours: number, renderer?: THREE.WebGLRenderer, forceIBL?: boolean) => void;
  update: (elapsedTime: number) => void;
  applyCSMToScene: (root: THREE.Object3D) => void;
  dispose: () => void;
}

interface TimeKeyframe {
  hour: number;
  elevationDeg: number;
  azimuthDeg: number;
  turbidity: number;
  rayleigh: number;
  mieCoeff: number;
  mieG: number;
  sunColor: [number, number, number];
  sunIntensity: number;
  skyTop: [number, number, number];
  skyHorizon: [number, number, number];
  hemiSky: [number, number, number];
  hemiGround: [number, number, number];
  hemiIntensity: number;
  fogColor: [number, number, number];
  fogDensity: number;
  cloudTint: [number, number, number];
  cloudLit: [number, number, number];
  nightFactor: number;
}

const KEYFRAMES: TimeKeyframe[] = [
  {
    hour: 5.75, // Bình Minh Sớm (Golden Dawn Mist)
    elevationDeg: 9.0,
    azimuthDeg: 82,
    turbidity: 6.2,
    rayleigh: 2.1,
    mieCoeff: 0.0028,
    mieG: 0.72,
    sunColor: [1.0, 0.78, 0.5],
    sunIntensity: 1.95,
    skyTop: [0.22, 0.38, 0.62],
    skyHorizon: [0.85, 0.66, 0.46],
    hemiSky: [0.64, 0.7, 0.84],
    hemiGround: [0.38, 0.28, 0.18],
    hemiIntensity: 0.65,
    fogColor: [0.76, 0.62, 0.48],
    fogDensity: 0.0022,
    cloudTint: [0.54, 0.48, 0.54],
    cloudLit: [0.98, 0.76, 0.5],
    nightFactor: 0.22,
  },
  {
    hour: 7.25, // Sáng Chợ Nổi (Morning Market Crisp Sunlight)
    elevationDeg: 24,
    azimuthDeg: 94,
    turbidity: 3.2,
    rayleigh: 1.25,
    mieCoeff: 0.0009,
    mieG: 0.56,
    sunColor: [1.0, 0.92, 0.78],
    sunIntensity: 2.15,
    skyTop: [0.18, 0.44, 0.78],
    skyHorizon: [0.72, 0.78, 0.82],
    hemiSky: [0.68, 0.8, 0.94],
    hemiGround: [0.4, 0.3, 0.2],
    hemiIntensity: 0.68,
    fogColor: [0.68, 0.74, 0.76],
    fogDensity: 0.0014,
    cloudTint: [0.62, 0.66, 0.72],
    cloudLit: [0.98, 0.94, 0.86],
    nightFactor: 0.0,
  },
  {
    hour: 12.0, // Trưa Nhiệt Đới (Tropical Noon)
    elevationDeg: 64,
    azimuthDeg: 138,
    turbidity: 2.6,
    rayleigh: 0.95,
    mieCoeff: 0.0007,
    mieG: 0.54,
    sunColor: [1.0, 0.96, 0.88],
    sunIntensity: 2.2,
    skyTop: [0.14, 0.42, 0.8],
    skyHorizon: [0.66, 0.78, 0.86],
    hemiSky: [0.72, 0.84, 0.98],
    hemiGround: [0.4, 0.31, 0.2],
    hemiIntensity: 0.7,
    fogColor: [0.66, 0.76, 0.82],
    fogDensity: 0.0011,
    cloudTint: [0.68, 0.72, 0.78],
    cloudLit: [0.98, 0.98, 0.95],
    nightFactor: 0.0,
  },
  {
    hour: 17.25, // Hoàng Hôn Sông Hậu (Golden Amber Sunset)
    elevationDeg: 10.5,
    azimuthDeg: 256,
    turbidity: 7.0,
    rayleigh: 2.4,
    mieCoeff: 0.0025,
    mieG: 0.68,
    sunColor: [1.0, 0.66, 0.34],
    sunIntensity: 2.0,
    skyTop: [0.2, 0.28, 0.5],
    skyHorizon: [0.84, 0.56, 0.36],
    hemiSky: [0.66, 0.58, 0.72],
    hemiGround: [0.4, 0.25, 0.15],
    hemiIntensity: 0.64,
    fogColor: [0.74, 0.52, 0.36],
    fogDensity: 0.0018,
    cloudTint: [0.48, 0.4, 0.46],
    cloudLit: [0.98, 0.64, 0.34],
    nightFactor: 0.18,
  },
  {
    hour: 19.75, // Đêm Đèn Dầu & Đom Đóm (Twilight Lantern Hour)
    elevationDeg: -3.5,
    azimuthDeg: 274,
    turbidity: 4.5,
    rayleigh: 3.2,
    mieCoeff: 0.006,
    mieG: 0.75,
    sunColor: [0.42, 0.56, 0.84],
    sunIntensity: 0.48,
    skyTop: [0.035, 0.055, 0.12],
    skyHorizon: [0.1, 0.13, 0.22],
    hemiSky: [0.2, 0.28, 0.44],
    hemiGround: [0.1, 0.08, 0.06],
    hemiIntensity: 0.48,
    fogColor: [0.07, 0.1, 0.16],
    fogDensity: 0.0024,
    cloudTint: [0.08, 0.11, 0.18],
    cloudLit: [0.2, 0.26, 0.42],
    nightFactor: 1.0,
  },
];

function sampleAtmosphereKeyframes(hour: number) {
  const h = clamp(hour, KEYFRAMES[0].hour, KEYFRAMES[KEYFRAMES.length - 1].hour);
  let i0 = 0;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i].hour && h <= KEYFRAMES[i + 1].hour) {
      i0 = i;
      break;
    }
  }
  const a = KEYFRAMES[i0];
  const b = KEYFRAMES[Math.min(i0 + 1, KEYFRAMES.length - 1)];
  const span = Math.max(0.001, b.hour - a.hour);
  const t = smoothstep(0, 1, (h - a.hour) / span);

  const lerp3 = (c1: [number, number, number], c2: [number, number, number]) =>
    new THREE.Color(lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t));

  return {
    elevationDeg: lerp(a.elevationDeg, b.elevationDeg, t),
    azimuthDeg: lerp(a.azimuthDeg, b.azimuthDeg, t),
    turbidity: lerp(a.turbidity, b.turbidity, t),
    rayleigh: lerp(a.rayleigh, b.rayleigh, t),
    mieCoeff: lerp(a.mieCoeff, b.mieCoeff, t),
    mieG: lerp(a.mieG, b.mieG, t),
    sunColor: lerp3(a.sunColor, b.sunColor),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    skyTop: lerp3(a.skyTop, b.skyTop),
    skyHorizon: lerp3(a.skyHorizon, b.skyHorizon),
    hemiSky: lerp3(a.hemiSky, b.hemiSky),
    hemiGround: lerp3(a.hemiGround, b.hemiGround),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    fogColor: lerp3(a.fogColor, b.fogColor),
    fogDensity: lerp(a.fogDensity, b.fogDensity, t),
    cloudTint: lerp3(a.cloudTint, b.cloudTint),
    cloudLit: lerp3(a.cloudLit, b.cloudLit),
    nightFactor: lerp(a.nightFactor, b.nightFactor, t),
  };
}

export function createMekongAtmosphere(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  shadowMapSize = 2048,
): MekongAtmosphereSystem {
  const group = new THREE.Group();
  group.name = 'MekongAtmosphere';

  // 1. Physical Sky Dome (Preetham scattering)
  const sky = new Sky();
  sky.scale.setScalar(1000);
  group.add(sky);

  // 2. Tropical Cumulus Cloud Dome (procedural FBM + forward sun silver-lining)
  const cloudUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.5, 0.3, 0.5).normalize() },
    uCloudBase: { value: new THREE.Color(0x9ca4b0) },
    uCloudLit: { value: new THREE.Color(0xfff1dc) },
    uHorizonColor: { value: new THREE.Color(0xdcc2a0) },
    uNightFactor: { value: 0 },
  };

  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uCloudBase;
      uniform vec3 uCloudLit;
      uniform vec3 uHorizonColor;
      uniform float uNightFactor;

      varying vec3 vWorldDir;

      float cHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float cNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(cHash(i), cHash(i + vec2(1.0, 0.0)), f.x),
          mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float cFbm(vec2 p) {
        float s = 0.0;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        s += 0.52 * cNoise(p);
        p = rot * p * 2.07 + vec2(11.3, 5.9);
        s += 0.28 * cNoise(p);
        p = rot * p * 2.13 + vec2(27.1, 19.3);
        s += 0.13 * cNoise(p);
        p = rot * p * 2.21 + vec2(7.7, 37.2);
        s += 0.07 * cNoise(p);
        return s;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        if (dir.y < 0.01) discard;

        // Project sky ray onto curved cloud plane
        vec2 uv = dir.xz / (dir.y + 0.18);
        vec2 drift = vec2(uTime * 0.008, uTime * 0.004);

        float shape = cFbm(uv * 1.15 + drift);
        float detail = cFbm(uv * 3.1 - drift * 1.3);
        float density = smoothstep(0.47, 0.78, shape * 0.78 + detail * 0.22);

        // Soft fade toward horizon so distant mist never clips
        float horizonFade = smoothstep(0.02, 0.22, dir.y);
        float alpha = density * horizonFade * mix(0.84, 0.42, uNightFactor);

        // Directional self-shadowing & forward silver lining
        vec2 sunStep = normalize(uSunDir.xz + vec2(0.0001)) * 0.16;
        float shadowSample = cFbm((uv + sunStep) * 1.15 + drift);
        float litFactor = clamp(1.0 - (shadowSample - shape) * 3.0, 0.15, 1.0);
        float forwardScatter = pow(max(dot(dir, normalize(uSunDir)), 0.0), 6.0) * 0.65;

        vec3 col = mix(uCloudBase, uCloudLit, clamp(litFactor * 0.82 + forwardScatter, 0.0, 1.15));
        col = mix(uHorizonColor, col, smoothstep(0.04, 0.30, dir.y));

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const cloudDome = new THREE.Mesh(new THREE.SphereGeometry(430, 40, 24), cloudMat);
  cloudDome.name = 'TropicalCloudDome';
  group.add(cloudDome);

  // 3. Hemisphere Alluvial Bounce Light
  const hemiLight = new THREE.HemisphereLight(0xd0e4ff, 0x74583b, 0.95);
  group.add(hemiLight);

  // 4. Cascaded Shadow Maps (CSM) for crisp nearby shadows + wide 135m coverage
  const csm = new CSM({
    maxFar: 135,
    cascades: 3,
    mode: 'practical',
    parent: scene,
    shadowMapSize,
    lightDirection: new THREE.Vector3(-0.6, -0.5, -0.6).normalize(),
    camera,
    lightIntensity: 2.8,
    lightFar: 320,
    lightNear: 0.5,
    lightMargin: 45,
  });
  csm.fade = true;
  for (const light of csm.lights) {
    light.shadow.bias = -0.00045;
    light.shadow.normalBias = 0.028;
  }

  // 5. Exponential distance aerial perspective fog
  const fog = new THREE.FogExp2(0xd5c4a8, 0.0028);
  scene.fog = fog;
  scene.add(group);

  // Private PMREM scene for accurate sky/horizon IBL reflections
  let pmremGen: THREE.PMREMGenerator | null = null;
  let envRT: THREE.WebGLRenderTarget | null = null;
  let lastIBLHour = -999;

  const state: AtmosphereState = {
    timeOfDay: 7.0,
    sunDir: new THREE.Vector3(0.7, 0.35, 0.6).normalize(),
    sunColor: new THREE.Color(0xffe0b0),
    sunIntensity: 3.0,
    skyHorizonColor: new THREE.Color(0xdcc9ae),
    skyZenithColor: new THREE.Color(0x3c6ca8),
    fogColor: new THREE.Color(0xd6c3a5),
    fogDensity: 0.0028,
    nightFactor: 0.0,
  };

  function bakePMREMEnvironment(renderer: THREE.WebGLRenderer, sunVec: THREE.Vector3, kf: ReturnType<typeof sampleAtmosphereKeyframes>) {
    if (!pmremGen) {
      pmremGen = new THREE.PMREMGenerator(renderer);
      pmremGen.compileEquirectangularShader();
    }
    const envScene = new THREE.Scene();
    // Bounded HDR gradient dome prevents raw Sky sun-disk radiance (>20x) from blowing out PBR albedo!
    const envDomeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTop: { value: kf.skyTop },
        uHorizon: { value: kf.skyHorizon },
        uGround: { value: kf.hemiGround },
        uSunDir: { value: sunVec },
        uSunCol: { value: kf.sunColor },
        uNight: { value: kf.nightFactor },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSunDir;
        uniform vec3 uSunCol;
        uniform float uNight;
        void main() {
          vec3 d = normalize(vDir);
          vec3 skyCol = d.y >= 0.0
            ? mix(uHorizon * 0.72, uTop * 0.85, smoothstep(0.0, 0.65, d.y))
            : mix(uHorizon * 0.55, uGround * 0.65, smoothstep(0.0, -0.45, d.y));
          float sunGlow = pow(max(dot(d, normalize(uSunDir)), 0.0), 24.0) * (1.0 - uNight);
          skyCol += uSunCol * sunGlow * 0.9;
          gl_FragColor = vec4(skyCol, 1.0);
        }
      `,
    });
    const envDome = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), envDomeMat);
    envScene.add(envDome);

    const newRT = pmremGen.fromScene(envScene, 0.025);
    if (envRT) envRT.dispose();
    envRT = newRT;
    scene.environment = envRT.texture;
    scene.environmentIntensity = lerp(0.45, 0.2, kf.nightFactor);

    envDome.geometry.dispose();
    envDomeMat.dispose();
  }

  function setTimeOfDay(hours: number, renderer?: THREE.WebGLRenderer, forceIBL = false) {
    state.timeOfDay = hours;
    const kf = sampleAtmosphereKeyframes(hours);

    const phi = THREE.MathUtils.degToRad(90 - kf.elevationDeg);
    const theta = THREE.MathUtils.degToRad(kf.azimuthDeg);
    state.sunDir.setFromSphericalCoords(1, phi, theta).normalize();

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = kf.turbidity;
    skyUniforms['rayleigh'].value = kf.rayleigh;
    skyUniforms['mieCoefficient'].value = kf.mieCoeff;
    skyUniforms['mieDirectionalG'].value = kf.mieG;
    skyUniforms['sunPosition'].value.copy(state.sunDir);

    // For twilight/night, tint sky dome down smoothly
    sky.visible = kf.nightFactor < 0.98;
    scene.background = kf.skyTop.clone().lerp(kf.fogColor, 0.35);

    // Update CSM directional lights (lightDirection points FROM light TOWARD scene)
    const lightDirToScene = state.sunDir.clone().negate();
    if (kf.elevationDeg < 4) {
      // Keep moonlight casting subtle long angle from above horizon
      const moonPhi = THREE.MathUtils.degToRad(90 - 24);
      const moonTheta = THREE.MathUtils.degToRad(kf.azimuthDeg - 25);
      lightDirToScene.setFromSphericalCoords(1, moonPhi, moonTheta).negate().normalize();
    }
    csm.lightDirection.copy(lightDirToScene);
    for (const l of csm.lights) {
      l.color.copy(kf.sunColor);
      l.intensity = kf.sunIntensity;
    }

    hemiLight.color.copy(kf.hemiSky);
    hemiLight.groundColor.copy(kf.hemiGround);
    hemiLight.intensity = kf.hemiIntensity;

    fog.color.copy(kf.fogColor);
    fog.density = kf.fogDensity;

    cloudUniforms.uSunDir.value.copy(state.sunDir);
    cloudUniforms.uCloudBase.value.copy(kf.cloudTint);
    cloudUniforms.uCloudLit.value.copy(kf.cloudLit);
    cloudUniforms.uHorizonColor.value.copy(kf.skyHorizon);
    cloudUniforms.uNightFactor.value = kf.nightFactor;

    state.sunColor.copy(kf.sunColor);
    state.sunIntensity = kf.sunIntensity;
    state.skyHorizonColor.copy(kf.skyHorizon);
    state.skyZenithColor.copy(kf.skyTop);
    state.fogColor.copy(kf.fogColor);
    state.fogDensity = kf.fogDensity;
    state.nightFactor = kf.nightFactor;

    if (renderer && (forceIBL || Math.abs(hours - lastIBLHour) >= 0.12)) {
      lastIBLHour = hours;
      bakePMREMEnvironment(renderer, state.sunDir, kf);
    }
  }

  function applyCSMToScene(root: THREE.Object3D) {
    const visited = new Set<THREE.Material>();
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (
            m &&
            !visited.has(m) &&
            (m instanceof THREE.MeshStandardMaterial ||
              m instanceof THREE.MeshPhysicalMaterial ||
              m instanceof THREE.MeshPhongMaterial)
          ) {
            visited.add(m);
            const prevCompile = m.onBeforeCompile;
            const prevKey = m.customProgramCacheKey;
            csm.setupMaterial(m);
            const csmCompile = m.onBeforeCompile;
            m.onBeforeCompile = (shader, renderer) => {
              csmCompile.call(m, shader, renderer);
              if (prevCompile && prevCompile !== THREE.Material.prototype.onBeforeCompile) {
                prevCompile.call(m, shader, renderer);
              }
            };
            if (prevKey && prevKey !== THREE.Material.prototype.customProgramCacheKey) {
              m.customProgramCacheKey = () => `${prevKey.call(m)}-csm`;
            }
          }
        }
      }
    });
  }

  setTimeOfDay(6.85); // Start in luminous golden morning market light

  return {
    group,
    csm,
    state,
    setTimeOfDay,
    update: (elapsedTime: number) => {
      cloudUniforms.uTime.value = elapsedTime;
      csm.update();
    },
    applyCSMToScene,
    dispose: () => {
      csm.dispose();
      cloudMat.dispose();
      cloudDome.geometry.dispose();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      if (envRT) envRT.dispose();
      if (pmremGen) pmremGen.dispose();
    },
  };
}

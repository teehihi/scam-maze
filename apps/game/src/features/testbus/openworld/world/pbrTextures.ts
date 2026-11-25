/**
 * Photorealistic Ho Chi Minh City PBR Material Library
 * Powered by REAL Saigon photographic PBR texture sets (Albedo + Normal + Roughness + Emissive)
 * from `public/images/drive-look/` and `public/images/survey/` — WITH proper async clone upload
 * hooks and subtle world-space tropical weathering (rising wall dampness, plaster variation, wet puddles).
 */
import * as T from "three";

const loader = new T.TextureLoader();

interface CachedBaseTex {
  base: T.Texture;
  loaded: boolean;
  clones: T.Texture[];
}
const baseCache = new Map<string, CachedBaseTex>();
const texCache = new Map<string, T.Texture>();
const textureLoadedListeners: ((tex: T.Texture) => void)[] = [];

/** Subscribe to newly loaded photographic textures so OpenWorldEngine can gently pre-upload them to VRAM (1/frame). */
export function onPbrTextureLoaded(cb: (tex: T.Texture) => void): () => void {
  textureLoadedListeners.push(cb);
  for (const entry of baseCache.values()) {
    if (entry.loaded) {
      cb(entry.base);
      for (const c of entry.clones) cb(c);
    }
  }
  return () => {
    const idx = textureLoadedListeners.indexOf(cb);
    if (idx >= 0) textureLoadedListeners.splice(idx, 1);
  };
}

function loadPhotoTex(
  relPath: string,
  srgb: boolean,
  repeatX = 1,
  repeatY = 1,
): T.Texture {
  const key = `${relPath}|${srgb ? 1 : 0}|${repeatX}|${repeatY}`;
  const cached = texCache.get(key);
  if (cached) return cached;

  const baseKey = `${relPath}|${srgb ? 1 : 0}`;
  let entry = baseCache.get(baseKey);
  if (!entry) {
    const newEntry: CachedBaseTex = {
      base: null as unknown as T.Texture,
      loaded: false,
      clones: [],
    };
    const srcUrl = `/assets/testbus/ow/images/${relPath}`;
    const base = loader.load(srcUrl, (loadedTex) => {
      newEntry.loaded = true;
      loadedTex.needsUpdate = true;
      for (const cb of textureLoadedListeners) cb(loadedTex);
      // CRITICAL FIX: notify ALL cloned repeat-variant textures the instant the image finishes downloading!
      for (const c of newEntry.clones) {
        c.image = loadedTex.image;
        c.needsUpdate = true;
        for (const cb of textureLoadedListeners) cb(c);
      }
    });
    // `Texture.image` stays null until the async decode lands, so the texture cannot otherwise say
    // which file it is. Anything auditing materials (asset verification, the QA rasteriser) needs
    // this, and a texture that cannot name its own source is not auditable.
    base.userData.src = srcUrl;
    base.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    base.wrapS = T.RepeatWrapping;
    base.wrapT = T.RepeatWrapping;
    base.anisotropy = 8;
    newEntry.base = base;
    entry = newEntry;
    baseCache.set(baseKey, entry);
  }

  if (repeatX === 1 && repeatY === 1) {
    texCache.set(key, entry.base);
    return entry.base;
  }

  const tex = entry.base.clone();
  tex.userData.src = entry.base.userData.src;
  tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
  tex.wrapS = T.RepeatWrapping;
  tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (entry.loaded) {
    tex.image = entry.base.image;
    tex.needsUpdate = true;
  }
  entry.clones.push(tex);
  texCache.set(key, tex);
  return tex;
}

export const SAIGON_SHADER_UNIFORMS = {
  uWetness: { value: 0.86 },
  uNight: { value: 0.95 },
  uTime: { value: 0.0 },
  uRain: { value: 0.36 },
};

/**
 * GTA 6-Grade World-Space Tropical Weathering & Wet-Road Reflection Shader Injection:
 *  - True non-repeating Hash Value-Noise + 3-Octave FBM (ZERO periodic sin/cos plaid tiling!)
 *  - Ground-only rising monsoon dampness & moss (y ∈ [0, 1.85m] ONLY — NEVER repeating up skyscraper floors!)
 *  - Weather-driven dynamic puddles (dry dusty asphalt at Clear noon, glossy puddles + animated raindrop ripples in rain!)
 *  - View-aligned Anisotropic Wet-Asphalt City Light Streaks across EVERY boulevard & granite plaza at night!
 */
function injectTropicalWeathering(
  mat: T.MeshStandardMaterial,
  mode: "wall" | "floor" | "asphalt",
  strength = 1.0,
) {
  mat.customProgramCacheKey = () => `saigon-weather-v2-${mode}-${strength.toFixed(1)}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSaigonWet = SAIGON_SHADER_UNIFORMS.uWetness;
    shader.uniforms.uSaigonNight = SAIGON_SHADER_UNIFORMS.uNight;
    shader.uniforms.uSaigonTime = SAIGON_SHADER_UNIFORMS.uTime;
    shader.uniforms.uSaigonRain = SAIGON_SHADER_UNIFORMS.uRain;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSaigonWorld;\nvarying vec3 vSaigonNorm;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
         vSaigonWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vSaigonNorm = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    const noiseLib = /* glsl */ `
      uniform float uSaigonWet, uSaigonNight, uSaigonTime, uSaigonRain;
      varying vec3 vSaigonWorld;
      varying vec3 vSaigonNorm;
      float sHash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float sNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(sHash(i), sHash(i + vec2(1.0, 0.0)), u.x),
          mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      float sFbm(vec2 p) {
        float v = 0.0;
        v += 0.55 * sNoise(p);
        v += 0.30 * sNoise(p * 2.13 + vec2(17.1, 31.7));
        v += 0.15 * sNoise(p * 4.41 - vec2(9.4, 23.2));
        return v;
      }
    `;

    const fragPatch =
      mode === "wall"
        ? /* glsl */ `
          vec2 wpWall = vec2(vSaigonWorld.x + vSaigonWorld.z, vSaigonWorld.y);
          float macroN = sFbm(wpWall * 0.22);
          float microN = sNoise(wpWall * 1.45);
          float macroVar = 1.0 + ((macroN - 0.5) * 0.24 + (microN - 0.5) * 0.08) * ${strength.toFixed(2)};
          // Authentic ground-only rising tropical dampness & moss (strictly y < 1.85m, ZERO repeating sky bands!)
          float baseDamp = 1.0 - smoothstep(0.08, 1.85, max(vSaigonWorld.y, 0.0));
          float dripMask = smoothstep(0.54, 0.86, sNoise(vec2((vSaigonWorld.x + vSaigonWorld.z) * 1.35, vSaigonWorld.y * 0.16)));
          float wallVert = 1.0 - abs(vSaigonNorm.y);
          float grime = clamp((baseDamp * (0.38 + uSaigonWet * 0.22) + dripMask * 0.14) * wallVert, 0.0, 0.52) * ${strength.toFixed(2)};
          diffuseColor.rgb *= macroVar * mix(vec3(1.0), vec3(0.42, 0.44, 0.39), grime);
        `
        : /* glsl */ `
          float fbmPuddle = sFbm(vSaigonWorld.xz * 0.16);
          float detailPuddle = sNoise(vSaigonWorld.xz * 0.95);
          float fineGrain = sNoise(vSaigonWorld.xz * 14.0) * 0.6 + sNoise(vSaigonWorld.xz * 31.0) * 0.4;
          float puddleRaw = smoothstep(0.42, 0.76, fbmPuddle * 0.78 + detailPuddle * 0.22);
          float puddleMask = puddleRaw * smoothstep(0.08, 0.85, uSaigonWet);
          // Photorealistic Saigon road wheel-rut tire wear + subtle tar cracks + oil patches
          float wheelTrackX = pow(abs(sin(vSaigonWorld.z * 0.88)), 2.2);
          float wheelTrackZ = pow(abs(sin(vSaigonWorld.x * 0.88)), 2.2);
          float tireWear = ${mode === "asphalt" ? "mix(0.84, 1.04, 0.5 * (wheelTrackX + wheelTrackZ))" : "1.0"};
          float tarCrack = ${mode === "asphalt" ? "1.0 - smoothstep(0.955, 0.992, 1.0 - abs(sNoise(vSaigonWorld.xz * 1.4) - 0.5) * 2.0) * 0.32" : "1.0"};
          float wetDark = mix(1.0, ${mode === "asphalt" ? "0.50" : "0.64"}, uSaigonWet * 0.55 + puddleMask * 0.45);
          float dryVar = (${mode === "asphalt" ? "1.06" : "0.94"} + (fbmPuddle - 0.5) * 0.24 + (fineGrain - 0.5) * 0.14) * tireWear * tarCrack;
          diffuseColor.rgb *= dryVar * mix(1.0, wetDark, ${strength.toFixed(2)});
        `;

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${noiseLib}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${fragPatch}`);

    if (mode === "floor" || mode === "asphalt") {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <roughnessmap_fragment>",
          /* glsl */ `
          #include <roughnessmap_fragment>
          float rFbm = sFbm(vSaigonWorld.xz * 0.16);
          float rDet = sNoise(vSaigonWorld.xz * 0.95);
          float rPuddle = smoothstep(0.42, 0.76, rFbm * 0.78 + rDet * 0.22) * smoothstep(0.08, 0.85, uSaigonWet);
          float dryRough = roughnessFactor;
          float wetRough = mix(${mode === "asphalt" ? "0.46" : "0.38"}, 0.08, rPuddle);
          roughnessFactor = clamp(mix(dryRough, wetRough, uSaigonWet), 0.07, 0.96);
          `,
        )
        .replace(
          "#include <lights_fragment_end>",
          /* glsl */ `
          #include <lights_fragment_end>
          // Physically-restrained micro-grain wet asphalt specular glint (warm sodium streetlamps + subtle cool LED)
          if (uSaigonWet > 0.22 && uSaigonNight > 0.15 && vSaigonNorm.y > 0.7) {
            vec3 viewV = normalize(cameraPosition - vSaigonWorld);
            float fresnelW = pow(1.0 - clamp(viewV.y, 0.0, 1.0), 3.6);
            float streakPuddle = smoothstep(0.46, 0.80, sFbm(vSaigonWorld.xz * 0.18)) * uSaigonWet;
            float microGrain = 0.55 + 0.45 * sNoise(vSaigonWorld.xz * 7.5);
            vec2 ripUv = fract(vSaigonWorld.xz * 1.35) - 0.5;
            float ripWave = sin(length(ripUv) * 30.0 - uSaigonTime * 9.0) * exp(-length(ripUv) * 5.5) * uSaigonRain;
            // Tight, crisp specular streaks strictly along curb streetlamps (zero fuzzy rainbow airbrush!)
            vec2 projXZ = vSaigonWorld.xz - viewV.xz * (2.2 / max(viewV.y, 0.15));
            float glint1 = pow(sNoise(vec2(projXZ.x * 0.55 + ripWave * 0.15, projXZ.y * 0.16)), 5.0);
            float glint2 = pow(sNoise(vec2(projXZ.x * 0.16, projXZ.y * 0.55 + ripWave * 0.15)), 5.0);
            float warmMix = sNoise(projXZ * 0.18);
            vec3 lampTint = mix(vec3(1.0, 0.78, 0.46), vec3(0.76, 0.86, 1.0), smoothstep(0.62, 0.88, warmMix));
            float streakInt = (glint1 + glint2) * microGrain * fresnelW * (0.14 + streakPuddle * 0.65) * uSaigonNight * ${mode === "asphalt" ? "0.34" : "0.22"};
            reflectedLight.indirectSpecular += lampTint * streakInt;
          }
          `,
        );
    }
  };
}

/** Real Saigon weathered plaster/stucco walls with photographic normal relief + tropical dampness weathering */
export function createWeatheredStuccoPBR(
  baseHex: string,
  _stainHex = "#787264",
  _seed = 101,
  repeatX = 2,
  repeatY = 2,
): T.MeshStandardMaterial {
  const map = loadPhotoTex("drive-look/stucco-map.webp", true, repeatX, repeatY);
  const normalMap = loadPhotoTex("drive-look/stucco-normal.webp", false, repeatX, repeatY);
  const mat = new T.MeshStandardMaterial({
    color: new T.Color(baseHex),
    map,
    normalMap,
    normalScale: new T.Vector2(1.15, 1.15),
    roughness: 0.9,
    metalness: 0.02,
  });
  injectTropicalWeathering(mat, "wall", 1.0);
  return mat;
}

/**
 * District 1 facade material from a Poly Haven CC0 scan (see public/assets/testbus/ow/images/q1/LICENSE.txt).
 * UVs are projected from world space, so one tile always covers `tileMeters` of wall no matter how large the
 * box is. The box meshes in this scene use 0-1 UVs per face, which stretched textures across whole towers.
 */
export function createWorldFacadePBR(
  id: string,
  tintHex = "#ffffff",
  tileMeters = 3.4,
  normalStrength = 1.0,
  roughness = 0.9,
): T.MeshStandardMaterial {
  const map = loadPhotoTex(`q1/${id}-map.webp`, true);
  const normalMap = loadPhotoTex(`q1/${id}-normal.webp`, false);
  const roughnessMap = loadPhotoTex(`q1/${id}-rough.webp`, false);
  const mat = new T.MeshStandardMaterial({
    color: new T.Color(tintHex),
    map,
    normalMap,
    normalScale: new T.Vector2(normalStrength, normalStrength),
    roughnessMap,
    roughness,
    metalness: 0.02,
  });
  injectTropicalWeathering(mat, "wall", 0.9);
  const weather = mat.onBeforeCompile;
  mat.customProgramCacheKey = () => `saigon-q1-facade-${tileMeters.toFixed(2)}`;
  mat.onBeforeCompile = (shader, renderer) => {
    weather.call(mat, shader, renderer);
    shader.vertexShader = shader.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
      {
        vec4 fwp = modelMatrix * vec4(position, 1.0);
        vec3 fn = abs(normalize(mat3(modelMatrix) * normal));
        vec2 fuv = fn.y > 0.7 ? fwp.xz : (fn.x > fn.z ? vec2(fwp.z, fwp.y) : vec2(fwp.x, fwp.y));
        fuv /= ${tileMeters.toFixed(3)};
        #ifdef USE_MAP
          vMapUv = fuv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = fuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = fuv;
        #endif
      }`,
    );
  };
  return mat;
}
/** Real Vietnamese weathered brick wall with matched photographic normal & roughness maps */
export function createVietnameseBrickPBR(
  tintHex = "#d6c2b4",
  repeatX = 2,
  repeatY = 2,
): T.MeshStandardMaterial {
  const map = loadPhotoTex("drive-look/brick-map.webp", true, repeatX, repeatY);
  const normalMap = loadPhotoTex("drive-look/brick-normal.webp", false, repeatX, repeatY);
  const roughnessMap = loadPhotoTex("drive-look/brick-rough.webp", false, repeatX, repeatY);
  const mat = new T.MeshStandardMaterial({
    color: new T.Color(tintHex),
    map,
    normalMap,
    normalScale: new T.Vector2(1.1, 1.1),
    roughnessMap,
    roughness: 0.92,
    metalness: 0.03,
  });
  injectTropicalWeathering(mat, "wall", 0.85);
  return mat;
}

/** Real Saigon ceramic/concrete paving slabs (courtyard, balcony, sidewalks) with realistic wet-puddle breakup */
export function createCeramicTilePBR(
  tileHex: string,
  _groutHex = "#625c52",
  _tilesPerSide = 6,
  repeatX = 4,
  repeatY = 4,
): T.MeshStandardMaterial {
  const map = loadPhotoTex("drive-look/slab-map.webp", true, repeatX, repeatY);
  const normalMap = loadPhotoTex("drive-look/slab-normal.webp", false, repeatX, repeatY);
  const roughnessMap = loadPhotoTex("drive-look/slab-rough.webp", false, repeatX, repeatY);
  const mat = new T.MeshStandardMaterial({
    color: new T.Color(tileHex),
    map,
    normalMap,
    normalScale: new T.Vector2(0.85, 0.85),
    roughnessMap,
    roughness: 0.82,
    metalness: 0.03,
  });
  injectTropicalWeathering(mat, "floor", 0.9);
  return mat;
}

/** Real Saigon rusted corrugated metal roofing with photographic rib normals */
export function createCorrugatedTinPBR(
  tintHex = "#92a4b2",
  _rustHex = "#6b442b",
  repeatX = 4,
  repeatY = 3,
): T.MeshStandardMaterial {
  const map = loadPhotoTex("drive-look/tin-map.webp", true, repeatX, repeatY);
  const normalMap = loadPhotoTex("drive-look/tin-normal.webp", false, repeatX, repeatY);
  return new T.MeshStandardMaterial({
    color: new T.Color(tintHex),
    map,
    normalMap,
    normalScale: new T.Vector2(1.2, 1.2),
    roughness: 0.58,
    metalness: 0.56,
  });
}

/** Real scanned Ho Chi Minh City asphalt (exact Bus Station survey road PBR!) */
export function createSaigonAsphaltPBR(repeatX = 4, repeatY = 14): T.MeshStandardMaterial {
  const map = loadPhotoTex("survey/map.webp", true, repeatX, repeatY);
  const normalMap = loadPhotoTex("survey/normal.webp", false, repeatX, repeatY);
  const roughnessMap = loadPhotoTex("survey/rough.webp", false, repeatX, repeatY);
  const mat = new T.MeshStandardMaterial({
    color: 0xd8dce0,
    map,
    normalMap,
    normalScale: new T.Vector2(0.9, 0.9),
    roughnessMap,
    roughness: 0.84,
    metalness: 0.05,
  });
  injectTropicalWeathering(mat, "asphalt", 0.92);
  return mat;
}

/** Real granite/stone plaza paving for Bitexco & Landmark 81 waterfront */
export function createGranitePlazaPBR(repeatX = 10, repeatY = 10): T.MeshStandardMaterial {
  const map = loadPhotoTex("drive-look/slab-map.webp", true, repeatX, repeatY);
  const normalMap = loadPhotoTex("drive-look/slab-normal.webp", false, repeatX, repeatY);
  const roughnessMap = loadPhotoTex("drive-look/slab-rough.webp", false, repeatX, repeatY);
  const mat = new T.MeshStandardMaterial({
    color: 0xd4cec4,
    map,
    normalMap,
    normalScale: new T.Vector2(0.65, 0.65),
    roughnessMap,
    roughness: 0.68,
    metalness: 0.06,
  });
  injectTropicalWeathering(mat, "floor", 0.65);
  return mat;
}

/** Real photographic Saigon shophouse facade (3-story or 5-story with matched normal, roughness & lit-window emissive!) */
export function createRealSaigonShophousePBR(
  variant: 3 | 5,
  tintHex = "#ffffff",
  repeatX = 1,
): T.MeshStandardMaterial {
  const prefix = variant === 5 ? "drive-look/shop5" : "drive-look/shop3";
  const map = loadPhotoTex(`${prefix}-map.webp`, true, repeatX, 1);
  const normalMap = loadPhotoTex(`${prefix}-normal.webp`, false, repeatX, 1);
  const roughnessMap = loadPhotoTex(`${prefix}-rough.webp`, false, repeatX, 1);
  const emissiveMap = loadPhotoTex(`${prefix}-emissive.webp`, true, repeatX, 1);
  return new T.MeshStandardMaterial({
    color: new T.Color(tintHex),
    map,
    normalMap,
    normalScale: new T.Vector2(0.95, 0.95),
    roughnessMap,
    roughness: 0.86,
    metalness: 0.08,
    emissive: new T.Color(0xffe0ad),
    emissiveMap,
    emissiveIntensity: 0.85,
  });
}

/** Real photographic tropical tree bark PBR (from Bus Station drive-look!) */
export function createRealTreeBarkPBR(repeatX = 1, repeatY = 3): T.MeshStandardMaterial {
  const map = loadPhotoTex("drive-look/trunk-map.webp", true, repeatX, repeatY);
  const normalMap = loadPhotoTex("drive-look/trunk-normal.webp", false, repeatX, repeatY);
  return new T.MeshStandardMaterial({
    color: 0xbcb6ac,
    map,
    normalMap,
    normalScale: new T.Vector2(1.25, 1.25),
    roughness: 0.92,
    metalness: 0.02,
  });
}

/** Animated Physically-Inspired Saigon River & Reflecting Pool Water Shader (Gerstner ripples + Sky/Sunset Sync + Fog!) */
export function createSaigonRiverWaterMaterial(): T.ShaderMaterial {
  return new T.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0.9 },
      uRain: { value: 0.36 },
      uSunDir: { value: new T.Vector3(0.4, 0.5, -0.6).normalize() },
      uFogColor: { value: new T.Color(0x1d1a26) },
      uFogDensity: { value: 0.0022 },
      uSkyHorizon: { value: new T.Color(0x262230) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying float vFogDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPos = viewMatrix * wp;
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uNight, uRain, uFogDensity;
      uniform vec3 uSunDir, uFogColor, uSkyHorizon;
      varying vec3 vWorldPos;
      varying float vFogDepth;

      float waveHeight(vec2 p, float t) {
        float w = sin(p.x * 0.45 + t * 1.45) * 0.35;
        w += sin(p.y * 0.62 - t * 1.15 + p.x * 0.25) * 0.28;
        w += sin((p.x - p.y) * 1.35 + t * 2.4) * 0.14;
        w += sin((p.x + p.y * 1.4) * 2.8 - t * 3.1) * 0.07;
        float r = sin(length(fract(p * 0.85) - 0.5) * 28.0 - t * 9.5) * exp(-length(fract(p * 0.85) - 0.5) * 5.0);
        return w + r * uRain * 0.22;
      }

      void main() {
        vec2 p = vWorldPos.xz;
        float e = 0.09;
        float h = waveHeight(p, uTime);
        float hx = waveHeight(p + vec2(e, 0.0), uTime);
        float hz = waveHeight(p + vec2(0.0, e), uTime);
        vec3 N = normalize(vec3((h - hx) * 1.15, 1.0, (h - hz) * 1.15));
        vec3 V = normalize(cameraPosition - vWorldPos);

        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);
        vec3 deepDay = vec3(0.11, 0.20, 0.19); // authentic alluvial Saigon River jade-brown tint
        vec3 deepNight = vec3(0.024, 0.038, 0.068);

        vec3 baseCol = mix(deepDay, deepNight, uNight);
        vec3 reflCol = mix(uSkyHorizon * 1.05, vec3(0.11, 0.15, 0.24), uNight * 0.42);

        // Authentic shimmering vertical Thủ Thiêm & Ba Son Bridge city-light reflection columns dancing on river ripples!
        float shimmerWave = sin(p.y * 1.45 + uTime * 2.8 + N.x * 16.0) * 0.5 + 0.5;
        float fineGlint = pow(max(0.0, sin(p.y * 3.8 - uTime * 4.2 + N.z * 22.0) * 0.5 + 0.5), 3.0);
        float colMask =
          exp(-pow((p.x + 82.0) / 14.0, 2.0)) +
          exp(-pow((p.x + 36.0) / 16.0, 2.0)) +
          exp(-pow((p.x - 10.0) / 18.0, 2.0)) +
          exp(-pow((p.x - 56.0) / 15.0, 2.0)) +
          exp(-pow((p.x - 104.0) / 16.0, 2.0)) +
          exp(-pow((p.x - 148.0) / 12.0, 2.0)) * 1.25;
        vec3 cityGlow = mix(vec3(1.0, 0.72, 0.36), vec3(0.42, 0.78, 1.0), smoothstep(-0.2, 0.7, sin(p.x * 0.075)));
        float reflRibbon = clamp(colMask, 0.0, 1.3) * (0.35 + 0.65 * shimmerWave + 0.85 * fineGlint) * uNight;
        reflCol += cityGlow * reflRibbon * (0.48 + fresnel * 0.85);

        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 140.0) * (1.0 - uNight * 0.45) * 2.4;
        vec3 specCol = mix(vec3(1.0, 0.94, 0.80), vec3(0.80, 0.88, 1.0), uNight);

        vec3 col = mix(baseCol, reflCol, clamp(0.24 + fresnel * 0.76, 0.0, 1.0)) + specCol * spec;
        float fogFactor = 1.0 - exp(-pow(vFogDepth * (uFogDensity * 0.72), 2.0));
        col = mix(col, uFogColor, clamp(fogFactor, 0.0, 0.88));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

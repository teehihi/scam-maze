import * as THREE from 'three';
import * as T from './textures';

const cache = new Map<string, THREE.Material>();
const texCache = new Map<string, T.TexSet>();
export const windUniform = { value: 0 };
const wettable: { m: THREE.MeshStandardMaterial; col: THREE.Color }[] = [];
const puddles: THREE.MeshStandardMaterial[] = [];
const emitters: { m: THREE.MeshStandardMaterial; base: number }[] = [];
let _ao: THREE.CanvasTexture | null = null, _ct: THREE.CanvasTexture | null = null;

function tex(name: string, f: () => T.TexSet): T.TexSet {
  let t = texCache.get(name);
  if (!t) { t = f(); texCache.set(name, t); }
  return t;
}
const microSet = () => tex('micro', () => T.microTex());

export interface Weather { macro: number; grime: number; streak: number; moss?: number }
const NOISE = `
float h31_(vec3 p){ p = fract(p*0.3183099+vec3(.1,.2,.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn_(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31_(i),h31_(i+vec3(1,0,0)),f.x),mix(h31_(i+vec3(0,1,0)),h31_(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31_(i+vec3(0,0,1)),h31_(i+vec3(1,0,1)),f.x),mix(h31_(i+vec3(0,1,1)),h31_(i+vec3(1,1,1)),f.x),f.y),f.z); }`;
/** world-space weathering: breaks texture tiling, grime in the splash zone, algae, rain streaks. Same program for all materials, uniforms per material. */
function weather(m: THREE.MeshStandardMaterial, w: Weather) {
  const u = { uMacro: { value: w.macro }, uGrime: { value: w.grime }, uStreak: { value: w.streak }, uMoss: { value: w.moss ?? 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix*vec4(transformed,1.0)).xyz; vWN = normalize(mat3(modelMatrix)*normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN; uniform float uMacro, uGrime, uStreak, uMoss;\n' + NOISE + '\nfloat wSplash_, wN3_;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float n1 = vn_(vWP*0.5), n2 = vn_(vWP*2.3+7.0), n3 = vn_(vWP*9.0+3.0);
          diffuseColor.rgb *= 1.0 + uMacro*((n1-0.5)*0.34 + (n2-0.5)*0.18 + (n3-0.5)*0.1);
          float sp = 0.0;
          if (uGrime > 0.0 || uStreak > 0.0) {
            float side = 1.0 - smoothstep(0.35, 0.8, abs(vWN.y));
            sp = (1.0 - smoothstep(0.0, 0.55 + 0.55*n2, vWP.y)) * uGrime * side;
            diffuseColor.rgb *= 1.0 - sp*(0.30 + 0.25*n3);
            float algae = sp * smoothstep(0.45, 0.75, n1) * (0.5 + uMoss);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.74,0.86,0.66), algae*0.6);
            if (uStreak > 0.0 && vWP.y > 0.6) {
              float st = vn_(vec3((vWP.x+vWP.z)*6.0, vWP.y*0.32, vWP.x*0.2-vWP.z*0.2));
              float stk = smoothstep(0.6, 0.88, st) * uStreak * side * smoothstep(0.6, 2.5, vWP.y) * (0.5 + 0.5*n1);
              diffuseColor.rgb *= 1.0 - stk*0.26; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.0,0.95,0.86), stk*0.3);
            }
          }
          wSplash_ = sp; wN3_ = n3;
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (wN3_-0.5)*0.16*uMacro + wSplash_*0.12, 0.05, 1.0);');
  };
  m.customProgramCacheKey = () => 'weather1';
}

/** textured PBR surface. Roughness map is absolute (scalar 1 × map); scanned sets also carry a normal map. */
function std(ts: T.TexSet | null, color: string, rough: number, metal = 0, bump = 1.5, extra: THREE.MeshStandardMaterialParameters = {}, w?: Weather) {
  const hasR = !!ts?.rough;
  const m = new THREE.MeshStandardMaterial({ roughness: hasR ? 1 : rough, color: new THREE.Color(color), metalness: metal, ...extra });
  if (ts?.map) m.map = ts.map;
  if (ts?.normal) { m.normalMap = ts.normal; m.normalScale.set(bump, bump); } else if (ts?.bump) { m.bumpMap = ts.bump; m.bumpScale = bump; }
  if (ts?.rough) m.roughnessMap = ts.rough;
  if (w) weather(m, w);
  return m;
}
const WX: Weather = { macro: 1, grime: 1, streak: 1, moss: 0.3 }, WI: Weather = { macro: 0.7, grime: 0.25, streak: 0, moss: 0 }, WG: Weather = { macro: 1, grime: 0.8, streak: 0, moss: 0.2 }, WS: Weather = { macro: 0.5, grime: 0.15, streak: 0.0 };
function sway(m: THREE.Material, cloth: boolean) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp_ = modelMatrix * vec4(position,1.0);
        float s_ = sin(uTime*1.6 + wp_.x*0.8 + wp_.z*0.6)*0.5 + sin(uTime*3.3 + wp_.y*1.7 + wp_.x*1.3)*0.25;
        float a_ = ${cloth ? '(1.0-uv.y)*0.16' : '0.045'};
        transformed.x += s_*a_; transformed.z += s_*a_*0.7;`);
  };
}

export function mat(key: string): THREE.Material {
  let m = cache.get(key);
  if (m) return m;
  const i = key.indexOf(':');
  const kind = i < 0 ? key : key.slice(0, i), arg = i < 0 ? '' : key.slice(i + 1);
  switch (kind) {
    case 'px': m = std(tex('plx', () => T.realTex('plx', 2.6)), arg, 1, 0, 1.3, {}, WX); break;
    case 'pi': m = std(tex('pli', () => T.realTex('pli', 2.2)), arg, 1, 0, 0.9, {}, WI); break;
    case 'tile': m = std(tex('tile', () => T.realTex('tile', 1.8)), arg, 1, 0, 0.7, {}, WI); break;
    case 'tileW': m = std(tex('tileW', () => T.tilesTex(4, 1.2, { grout: 4, vary: 0.04, dirt: 0.06, seed: 6 })), arg, 1, 0, 1.2, {}, WI); break;
    case 'mosaic': m = std(tex('mosaic', () => T.tilesTex(16, 0.8, { grout: 2, vary: 0.12, dirt: 0.14, seed: 9 })), arg, 1, 0, 1.2, {}, WI); break;
    case 'paver': m = std(tex('paver', () => T.realTex('paver', 1.6)), arg, 1, 0, 1.4, {}, WG); break;
    case 'terr': m = std(tex('terr', () => T.terrazzoTex()), arg, 1, 0, 1.0, {}, WS); break;
    case 'stone': m = std(tex('stone', () => T.realTex('stone', 1.8)), arg, 1, 0, 1.4, {}, WX); break;
    case 'gb': m = std(tex('gb', () => T.gachBongTex()), '#ffffff', 1, 0, 1.0, {}, WS); break;
    case 'brick': m = std(tex('brick', () => T.realTex('brick', 2.4)), arg || '#ffffff', 1, 0, 1.6, {}, WX); break;
    case 'conc': m = std(tex('conc', () => T.realTex('conc', 2.2)), arg || '#ffffff', 1, 0, 1.2, {}, WG); break;
    case 'roof': m = std(tex('roof', () => T.realTex('roof', 2.4)), '#ffffff', 1, 0, 1.6, { side: THREE.DoubleSide }, { macro: 1, grime: 0, streak: 0 }); break;
    case 'asph': m = std(tex('asph', () => T.realTex('asph', 3.2)), '#ffffff', 1, 0, 1.6, {}, { macro: 1.1, grime: 0, streak: 0 }); break;
    case 'wood': m = std(tex('wood6', () => T.realTex('wood', 1.5)), arg, 1, 0, 0.8, {}, WS); break;
    case 'woodF': m = std(tex('wood2', () => T.realTex('woodF', 1.2)), arg, 1, 0, 0.7, {}, WS); break;
    case 'woodP': m = std(tex('wood1', () => T.realTex('woodF', 0.8)), arg, 1, 0, 0.6, {}, WS); break;
    case 'dirt': m = std(tex('dirt', () => T.realTex('dirt', 1.6)), arg || '#ffffff', 1, 0, 1.6, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, { macro: 1, grime: 0, streak: 0 }); break;
    case 'tole': m = std(tex('tole', () => T.corrugatedTex()), arg, 1, 0.45, 3, {}, { macro: 1, grime: 0.2, streak: 0 }); break;
    case 'shut': m = std(tex('shut', () => T.shutterTex()), arg, 1, 0.5, 2.5, {}, WS); break;
    case 'cloth': m = std(tex('fab', () => T.realTex('cloth', 0.45)), arg, 1, 0, 0.8, {}, { macro: 1, grime: 0, streak: 0 }); break;
    case 'metal': m = std(tex('brush', () => T.brushedTex()), arg, 1, 0.85, 0.5, {}, WS); break;
    case 'leaf': m = new THREE.MeshStandardMaterial({ map: T.leafCardTex(arg as 'green', arg.length), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: '#e8ffe0' }); sway(m, false); break;
    case 'laundry': m = new THREE.MeshStandardMaterial({ color: arg, roughness: 0.95, side: THREE.DoubleSide }); sway(m, true); break;
    // glass: thin, slightly green, modest reflection (mirror-like panes washed out interiors at dusk)
    case 'glass': m = new THREE.MeshStandardMaterial({ color: '#d6ebf2', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, envMapIntensity: 0.6, depthWrite: false }); break;
    case 'ao': m = new THREE.MeshBasicMaterial({ map: (_ao ??= T.aoStripTex()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); break;
    case 'contact': m = new THREE.MeshBasicMaterial({ map: (_ct ??= T.contactTex()), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); break;
    case 'emit': { const e = new THREE.MeshStandardMaterial({ color: '#222', emissive: arg, emissiveIntensity: 1.6, roughness: 0.5 }); emitters.push({ m: e, base: 1.6 }); m = e; break; }
    case 'puddle': { const p = new THREE.MeshStandardMaterial({ color: '#1a2024', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false, envMapIntensity: 2.2 }); puddles.push(p); m = p; break; }
    case 'flag': {
      const c = document.createElement('canvas'); c.width = 192; c.height = 128; const x = c.getContext('2d')!;
      x.fillStyle = '#da251d'; x.fillRect(0, 0, 192, 128); x.fillStyle = '#ffff00'; x.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 15 : 38; x.lineTo(96 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
      x.fill(); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.MeshStandardMaterial({ map: tx, side: THREE.DoubleSide, roughness: 0.9 }); sway(m, true); break;
    }
    // solid colour surfaces get shared micro-roughness + fine bump so no plane reads as perfectly uniform CG
    case 'g': case 'r': case 'rubber': case 'ceramic': case 'm': case 'mr': {
      const ms = microSet();
      const rough = kind === 'g' ? 0.3 : kind === 'r' ? 0.92 : kind === 'rubber' ? 0.9 : kind === 'ceramic' ? 0.14 : kind === 'm' ? 0.35 : 0.6;
      const metal = kind === 'm' ? 0.85 : kind === 'mr' ? 0.6 : 0;
      const sm = new THREE.MeshStandardMaterial({ color: arg, roughness: rough, roughnessMap: ms.rough, metalness: metal, bumpMap: ms.bump, bumpScale: kind === 'ceramic' ? 0.05 : 0.25 }); weather(sm, { macro: kind === 'ceramic' ? 0.25 : 0.7, grime: kind === 'r' ? 0.4 : 0.15, streak: 0 }); m = sm;
      break;
    }
    default: m = new THREE.MeshStandardMaterial({ color: key, roughness: 0.65 });
  }
  if (['asph', 'paver', 'conc', 'stone', 'terr', 'tile', 'tileW', 'mosaic', 'dirt'].includes(kind)) {
    const s = m as THREE.MeshStandardMaterial; wettable.push({ m: s, col: s.color.clone() });
  }
  cache.set(key, m);
  return m;
}

/** rain: roughness collapses, colours darken, puddles fill */
export function setWet(w: number) {
  for (const o of wettable) {
    o.m.roughness = 1 - 0.72 * w;
    o.m.color.copy(o.col).multiplyScalar(1 - 0.35 * w);
    o.m.envMapIntensity = 0.55 + 1.2 * w;
  }
  for (const p of puddles) p.opacity = 0.18 + 0.5 * w;
}
export function setNightEmit(n: number) { for (const e of emitters) e.m.emissiveIntensity = e.base * n; }
export function setAnisotropy(a: number) { T.texCfg.aniso = a; }
export const solid = (hex: string, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });

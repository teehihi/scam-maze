import * as T from "three";

/**
 * Vehicle lights bonded directly to every vehicle's own 3D geometry (0 mm gap, zero floating boxes).
 *
 * 1. `markLampParts` splits native GLB lamp meshes by end (head / tail) AND lateral side (signal_left / signal_right)
 *    using the vehicle's own triangles:
 *    - harmony / taxi_corolla: `klosz` headlights + `door_FL/door_FR` mirror blinkers + `Material.014` bumper amber
 *      + `Material.005` rear tail/brake & outer corner turn signals.
 *    - savanna: `Headlight_Metal` + `glass-headlight-cover` front/rear corners + `Glass_-_Red` brake/tail.
 *    - mula_van: `Lights` headlights + `Signal` native turn signals + `Stop` brake/tail.
 *    - motorbike.glb: `farol_0` headlight + `luzes_de_tras_0` center tail/brake & outer stalk blinkers.
 *    - bike-supercub: `lamp_headlight` front headlight + rear taillight.
 *
 * 2. `attachDynamicLamps` binds independent per-vehicle brake flare & left/right turn-signal controllers directly
 *    to those native split meshes. For single-atlas models that lack dedicated lamp meshes (e.g. `bike-pcx`,
 *    `baothu`, `bike-rider`), it projects a wafer-thin flush lens onto the exact nearest chassis bodywork triangle
 *    and embeds it slightly into the real surface along `-normal` so nothing ever floats in mid-air.
 */

type LampRole = "head" | "tail" | "signal_left" | "signal_right";

const RE_PURE_SIGNAL = /^(signal$|material\.014$|pisca|seta|blinker)/i;
const RE_MIRROR_DOOR = /^door_f[lr]/i;
const RE_HEAD = /^(farol|klosz$|lights$|headlight_metal|glass-headlight-cover|headligth-lines|lamp_headlight)/i;
const RE_TAIL = /^(luzes|material\.005$|material\.019$|stop$|glass_-_red)/i;
const RE_DUAL_END_LAMP = /^lamp_headlight/i;
const RE_WIDE_CORNER_SIGNAL_HEAD = /^(klosz$|glass-headlight-cover)/i;
const RE_WIDE_CORNER_SIGNAL_TAIL = /^(luzes|material\.005$|stop$)/i;

/** Share of the vehicle length, from each end, where its lamps sit. */
const END_SLAB_HEAD = 0.18;
const END_SLAB_TAIL = 0.21;

const headMats: T.MeshStandardMaterial[] = [];
const tailMats: T.MeshStandardMaterial[] = [];
const lampCache = new Map<string, T.MeshStandardMaterial>();
let level = { lit: 0, wet: 0 };

/** Per-vehicle brake & turn-signal controller attached to moving vehicles. */
export interface DynamicVehicleLamps {
  setBrake(amount: number): void;
  setBlinker(dir: -1 | 0 | 1, blinkOn: boolean): void;
}

const perVehicleBrakeMats: { mat: T.MeshStandardMaterial; brake: number }[] = [];

function lampMaterial(source: T.Material, role: LampRole): T.MeshStandardMaterial | null {
  if (!(source instanceof T.MeshStandardMaterial)) return null;
  const key = `${source.uuid}|${role}`;
  const hit = lampCache.get(key);
  if (hit) return hit;

  const m = source.clone();
  m.name = `${source.name}_lamp_${role}`;
  // A lit lens is opaque so its glow is not divided by glass alpha.
  m.transparent = false;
  m.opacity = 1;
  m.depthWrite = true;
  m.roughness = Math.min(m.roughness, 0.24);

  if (role === "head") {
    m.color.lerp(new T.Color(0xf4f1ea), 0.6);
    m.emissive.set(0xfff0d2);
    m.emissiveMap = m.map ?? null;
    headMats.push(m);
    applyLevel(m, "head");
  } else if (role === "tail") {
    m.color.lerp(new T.Color(0x8a0f0a), 0.55);
    m.emissive.set(0xff1e0e);
    m.emissiveMap = m.map ?? null;
    tailMats.push(m);
    applyLevel(m, "tail");
  } else {
    // Native sculpted turn-signal lens (starts off as dark-amber glass; flashed per-vehicle by attachDynamicLamps).
    m.color.lerp(new T.Color(0x6e3e08), 0.65);
    m.emissive.set(0xffa40e);
    m.emissiveMap = null;
    m.emissiveIntensity = 0.05;
  }

  lampCache.set(key, m);
  return m;
}

function applyTailBrake(m: T.MeshStandardMaterial, brake: number) {
  // Tail glow at night (2.8) + crisp daylight-visible crimson brake flare (+6.0 when braking).
  m.emissiveIntensity = 0.14 + level.lit * 2.8 + brake * 6.0;
}

function applyLevel(m: T.MeshStandardMaterial, role: "head" | "tail") {
  m.emissiveIntensity = role === "head" ? 0.04 + level.lit * 7.0 : 0.12 + level.lit * 3.0;
}

const _v = new T.Vector3();
const _a = new T.Vector3();
const _b = new T.Vector3();
const _c = new T.Vector3();
const _ab = new T.Vector3();
const _ac = new T.Vector3();
const _nrm = new T.Vector3();
const _up = new T.Vector3(0, 1, 0);
const _zAxis = new T.Vector3(0, 0, 1);

function materialsOf(mesh: T.Mesh): T.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** The model's own nose direction in `host` space: front wheels minus rear wheels, else headlight minus tail. */
function modelForward(host: T.Object3D, vehicle: T.Object3D, fallback: T.Vector3): T.Vector3 {
  const pick = (re: RegExp) => {
    const out: T.Vector3[] = [];
    vehicle.traverse((o) => {
      if (re.test(o.name)) out.push(host.worldToLocal(o.getWorldPosition(new T.Vector3())));
    });
    return out;
  };
  const avg = (list: T.Vector3[]) => list.reduce((s, p) => s.add(p), new T.Vector3()).multiplyScalar(1 / list.length);
  const front = pick(/^wheel_F[LR]/i);
  const rear = pick(/^wheel_R[LR]/i);
  if (front.length && rear.length) return avg(front).sub(avg(rear)).setY(0).normalize();
  const centre = (re: RegExp) => {
    const box = new T.Box3();
    vehicle.traverse((o) => {
      if (o instanceof T.Mesh && (re.test(o.name) || materialsOf(o).some((m) => re.test(m.name)))) box.expandByObject(o);
    });
    return box.isEmpty() ? null : host.worldToLocal(box.getCenter(new T.Vector3()));
  };
  const head = centre(/^farol|lamp_headlight/i);
  const tail = centre(/^luzes/i);
  if (head && tail) return head.sub(tail).setY(0).normalize();
  return fallback.clone().setY(0).normalize();
}

function addSplitMesh(source: T.Mesh, indices: number[], mat: T.MeshStandardMaterial, suffix: string) {
  const geo = source.geometry.clone();
  geo.setIndex(indices);
  const part = new T.Mesh(geo, mat);
  part.name = `${source.name}_${suffix}`;
  part.position.copy(source.position);
  part.quaternion.copy(source.quaternion);
  part.scale.copy(source.scale);
  part.castShadow = false;
  part.receiveShadow = source.receiveShadow;
  source.parent?.add(part);
}

/**
 * Turns the vehicle's own sculpted lamp parts into functional headlights, brake/taillights, and native left/right
 * turn signals — directly on the model's real triangles with zero detached geometry.
 * Call before `equipVehicle` / `mergeVehicleBody`. Returns whether a headlight part was found.
 */
export function markLampParts(host: T.Object3D, vehicle: T.Object3D, fallbackForward: T.Vector3): { head: boolean } {
  host.updateWorldMatrix(true, true);
  const fwd = modelForward(host, vehicle, fallbackForward);
  // Driver's TRUE left side in `host` space: invariant even if `equipVehicle` rotates the vehicle 180° around Y later!
  const leftAxis = new T.Vector3().crossVectors(_up, fwd).normalize();
  const toHost = new T.Matrix4().copy(host.matrixWorld).invert();

  // Vehicle longitudinal & lateral extent in host space.
  let lo = Infinity;
  let hi = -Infinity;
  let latLo = Infinity;
  let latHi = -Infinity;
  const meshes: T.Mesh[] = [];
  vehicle.traverse((o) => {
    if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh) return;
    meshes.push(o);
    const pos = o.geometry.getAttribute("position");
    if (!pos) return;
    const m = new T.Matrix4().multiplyMatrices(toHost, o.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const d = _v.dot(fwd);
      const lat = _v.dot(leftAxis);
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
      latLo = Math.min(latLo, lat);
      latHi = Math.max(latHi, lat);
    }
  });
  if (!Number.isFinite(lo)) return { head: false };
  const len = Math.max(0.01, hi - lo);
  const mid = (lo + hi) * 0.5;
  const latMid = (latLo + latHi) * 0.5;
  const halfLatSpan = Math.max(0.1, (latHi - latLo) * 0.5);

  let foundHead = false;

  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) continue;
    const src = mesh.material;
    const matName = src.name || "";
    const meshName = mesh.name || "";
    const parentName = mesh.parent?.name || "";
    const match = (re: RegExp) => re.test(matName) || re.test(meshName) || re.test(parentName);

    const isPureSignal = match(RE_PURE_SIGNAL) || (match(RE_MIRROR_DOOR) && /^klosz$/i.test(matName));
    const isDualEnd = match(RE_DUAL_END_LAMP);
    const isHead = !isPureSignal && match(RE_HEAD);
    const isTail = !isPureSignal && !isHead && match(RE_TAIL);
    if (!isPureSignal && !isHead && !isTail) continue;

    const pos = mesh.geometry.getAttribute("position");
    if (!pos) continue;
    const index = mesh.geometry.index;
    const triCount = Math.floor((index ? index.count : pos.count) / 3);
    if (triCount <= 0) continue;
    const vert = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
    const m = new T.Matrix4().multiplyMatrices(toHost, mesh.matrixWorld);

    // Measure this mesh's own lateral extent so corner signal thresholds adapt cleanly per model.
    let meshMaxLat = 0;
    for (let t = 0; t < triCount; t++) {
      _a.fromBufferAttribute(pos, vert(t, 0)).applyMatrix4(m);
      _b.fromBufferAttribute(pos, vert(t, 1)).applyMatrix4(m);
      _c.fromBufferAttribute(pos, vert(t, 2)).applyMatrix4(m);
      const lat = ((_a.dot(leftAxis) + _b.dot(leftAxis) + _c.dot(leftAxis)) / 3) - latMid;
      meshMaxLat = Math.max(meshMaxLat, Math.abs(lat));
    }

    const headTris: number[] = [];
    const tailTris: number[] = [];
    const sigLTris: number[] = [];
    const sigRTris: number[] = [];
    const restTris: number[] = [];

    let allOnFrontHalf = true;
    let allOnRearHalf = true;

    for (let t = 0; t < triCount; t++) {
      const i0 = vert(t, 0);
      const i1 = vert(t, 1);
      const i2 = vert(t, 2);
      _a.fromBufferAttribute(pos, i0).applyMatrix4(m);
      _b.fromBufferAttribute(pos, i1).applyMatrix4(m);
      _c.fromBufferAttribute(pos, i2).applyMatrix4(m);
      const d = (_a.dot(fwd) + _b.dot(fwd) + _c.dot(fwd)) / 3;
      const lat = (_a.dot(leftAxis) + _b.dot(leftAxis) + _c.dot(leftAxis)) / 3 - latMid;
      if (d < mid) allOnFrontHalf = false;
      if (d > mid) allOnRearHalf = false;

      if (isPureSignal) {
        // Side mirror blinkers + native `Signal` / `Material.014` meshes split cleanly into left vs right.
        if (lat >= 0) sigLTris.push(i0, i1, i2);
        else sigRTris.push(i0, i1, i2);
        continue;
      }

      if (isDualEnd) {
        if (d > hi - len * 0.24) headTris.push(i0, i1, i2);
        else if (d < lo + len * 0.24) tailTris.push(i0, i1, i2);
        else restTris.push(i0, i1, i2);
        continue;
      }

      if (isHead) {
        const atFront = d > hi - len * END_SLAB_HEAD;
        const atRear = d < lo + len * END_SLAB_TAIL;
        if (atFront) {
          // Outer corners of wide lens covers (`klosz`, `glass-headlight-cover`) act as native front turn signals!
          if (match(RE_WIDE_CORNER_SIGNAL_HEAD) && meshMaxLat > halfLatSpan * 0.6 && Math.abs(lat) > meshMaxLat * 0.78) {
            if (lat >= 0) sigLTris.push(i0, i1, i2);
            else sigRTris.push(i0, i1, i2);
          } else {
            headTris.push(i0, i1, i2);
          }
        } else if (atRear && /^glass-headlight-cover/i.test(matName) && Math.abs(lat) > meshMaxLat * 0.72) {
          // Savanna rear clear-lens corner indicator housings!
          if (lat >= 0) sigLTris.push(i0, i1, i2);
          else sigRTris.push(i0, i1, i2);
        } else {
          restTris.push(i0, i1, i2);
        }
        continue;
      }

      if (isTail) {
        const atRear = d < lo + len * END_SLAB_TAIL;
        if (atRear) {
          const cornerRatio = /^luzes/i.test(matName) ? 0.52 : 0.78;
          if (match(RE_WIDE_CORNER_SIGNAL_TAIL) && meshMaxLat > 0.16 && Math.abs(lat) > meshMaxLat * cornerRatio) {
            if (lat >= 0) sigLTris.push(i0, i1, i2);
            else sigRTris.push(i0, i1, i2);
          } else {
            tailTris.push(i0, i1, i2);
          }
        } else {
          restTris.push(i0, i1, i2);
        }
      }
    }

    // Small setback motorbike lamp (behind front wheel or fender): treat whole mesh as that lamp.
    if (isHead && !headTris.length && !sigLTris.length && !sigRTris.length && allOnFrontHalf) {
      headTris.push(...restTris);
      restTris.length = 0;
    } else if (isTail && !tailTris.length && !sigLTris.length && !sigRTris.length && allOnRearHalf) {
      tailTris.push(...restTris);
      restTris.length = 0;
    }

    const activeBuckets: { role: LampRole; tris: number[] }[] = [];
    if (headTris.length) {
      foundHead = true;
      activeBuckets.push({ role: "head", tris: headTris });
    }
    if (tailTris.length) activeBuckets.push({ role: "tail", tris: tailTris });
    if (sigLTris.length) activeBuckets.push({ role: "signal_left", tris: sigLTris });
    if (sigRTris.length) activeBuckets.push({ role: "signal_right", tris: sigRTris });
    if (!activeBuckets.length) continue;

    // Single bucket covers entire mesh: swap material directly with zero extra meshes.
    if (!restTris.length && activeBuckets.length === 1) {
      const mat = lampMaterial(src, activeBuckets[0].role);
      if (mat) mesh.material = mat;
      continue;
    }

    // Split into clean sub-meshes sharing the exact original vertices & UVs.
    if (restTris.length) {
      const keep = mesh.geometry.clone();
      keep.setIndex(restTris);
      mesh.geometry = keep;
      for (const b of activeBuckets) {
        const mat = lampMaterial(src, b.role);
        if (mat) addSplitMesh(mesh, b.tris, mat, `lamp_${b.role}`);
      }
    } else {
      // No rest triangles left: reuse `mesh` for the first bucket and add sibling meshes for the others.
      const first = activeBuckets[0];
      const firstMat = lampMaterial(src, first.role);
      const firstGeo = mesh.geometry.clone();
      firstGeo.setIndex(first.tris);
      mesh.geometry = firstGeo;
      if (firstMat) mesh.material = firstMat;
      for (let k = 1; k < activeBuckets.length; k++) {
        const b = activeBuckets[k];
        const mat = lampMaterial(src, b.role);
        if (mat) addSplitMesh(mesh, b.tris, mat, `lamp_${b.role}`);
      }
    }
  }

  host.updateWorldMatrix(true, true);
  return { head: foundHead };
}

let beamMat: T.MeshBasicMaterial | null = null;

function beamTexture(): T.Texture {
  const w = 128;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  if (!ctx) return t;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const along = y / (h - 1);
    const half = 0.22 + 0.78 * Math.sqrt(along);
    const fall = Math.min(1, along * 7) * Math.pow(1 - along, 1.6);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) * 2;
      const edge = 1 - Math.min(1, Math.max(0, (u - half * 0.55) / (half * 0.45)));
      const v = Math.max(0, fall * edge * edge);
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 240;
      img.data[i + 2] = 210;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return t;
}

function beamMaterial() {
  beamMat ??= new T.MeshBasicMaterial({
    map: beamTexture(),
    color: 0xffe9c4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  return beamMat;
}

export type LightKind = "car" | "truck" | "moto";

/** The pool of light on the road ahead of a vehicle whose headlight was found. `forward` is the driving direction. */
export function addHeadlightBeam(host: T.Object3D, vehicle: T.Object3D, forward: T.Vector3, kind: LightKind) {
  host.updateWorldMatrix(true, true);
  const inv = new T.Matrix4().copy(host.matrixWorld).invert();
  const box = new T.Box3();
  const tmp = new T.Box3();
  vehicle.traverse((o) => {
    if (o instanceof T.Mesh && !(o instanceof T.SkinnedMesh)) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      box.union(tmp);
    }
  });
  if (box.isEmpty()) return;
  const f = forward.clone().setY(0).normalize();
  const centre = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3());
  const halfLen = Math.abs(f.x) > Math.abs(f.z) ? size.x / 2 : size.z / 2;
  const len = kind === "moto" ? 9 : kind === "truck" ? 15 : 14;
  const wid = kind === "moto" ? 3.2 : 5.2;
  const beam = new T.Mesh(new T.PlaneGeometry(wid, len), beamMaterial());
  beam.rotation.order = "YXZ";
  beam.rotation.set(-Math.PI / 2, Math.atan2(f.x, f.z), 0);
  beam.position.copy(centre).addScaledVector(f, halfLen + len / 2 - 0.2).setY(box.min.y + 0.03);
  beam.renderOrder = 2;
  beam.name = "HeadlightBeam";
  host.add(beam);
}

export interface RoundLampOptions {
  role: "head" | "tail";
  /** Centre of the lens base in `parent` local space. */
  position: T.Vector3;
  radius: number;
  /** How far the dome stands out of the body, in metres. */
  depth: number;
  /** Lens axis in `parent` local space (the direction the light leaves). */
  facing: T.Vector3;
  name: string;
}

/**
 * Mounts a rounded, emissive lens (shallow dome) on a node of a vehicle rig, for models whose mesh has no lamp
 * of its own. The material follows the same night level as native lamps: head lenses are driven by
 * `setVehicleLightLevel`, tail lenses are picked up by `attachDynamicLamps` for the brake light.
 * Because it is a child of `parent`, it moves with that node (for example a steering bone).
 */
export function mountRoundLamp(parent: T.Object3D, opts: RoundLampOptions): T.Mesh {
  const isHead = opts.role === "head";
  const mat = new T.MeshStandardMaterial({
    name: `${opts.name}_lamp_${opts.role}`,
    color: isHead ? 0xf4f1ea : 0x7a0d09,
    emissive: isHead ? 0xfff0d2 : 0xff1e0e,
    roughness: 0.2,
  });
  if (isHead) {
    headMats.push(mat);
    applyLevel(mat, "head");
  } else {
    tailMats.push(mat);
    applyLevel(mat, "tail");
  }
  // Upper half of a sphere squashed along its axis: a round face with a gentle bulge.
  const geo = new T.SphereGeometry(opts.radius, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, opts.depth / opts.radius, 1);
  const lens = new T.Mesh(geo, mat);
  lens.name = opts.name;
  lens.position.copy(opts.position);
  lens.quaternion.setFromUnitVectors(_up, opts.facing.clone().normalize());
  lens.castShadow = false;
  parent.add(lens);
  return lens;
}

interface SurfaceSample {
  pos: T.Vector3;
  normal: T.Vector3;
}

/**
 * Sample outward-facing surface centroids & normals of the vehicle's actual bodywork meshes in `chassis` local space.
 * Skips wheels, beams, contact shadows, riders/crew, and invisible placeholder boxes.
 */
function sampleChassisBodySurface(chassis: T.Object3D, isMoto: boolean): SurfaceSample[] {
  chassis.updateWorldMatrix(true, true);
  const inv = new T.Matrix4().copy(chassis.matrixWorld).invert();
  const samples: SurfaceSample[] = [];
  const skipName = /wheel|tire|headlightbeam|contact|shadow|rider|crew|head|helmet/i;
  const maxY = isMoto ? 1.18 : 1.45;
  const minY = isMoto ? 0.42 : 0.34;

  chassis.traverse((o) => {
    if (!o.visible) return;
    // Skip any subtree belonging to hidden fallback geometry or wheels/crew.
    let p: T.Object3D | null = o;
    while (p && p !== chassis) {
      if (!p.visible || skipName.test(p.name)) return;
      p = p.parent;
    }
    if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh) return;
    const pos = o.geometry.getAttribute("position");
    if (!pos || pos.count < 3) return;
    // Skip flat ground quads (contact shadow / road planes).
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox!;
    if (bb.max.y - bb.min.y < 0.04 && bb.max.x - bb.min.x > 0.6) return;

    const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const index = o.geometry.index;
    const triCount = Math.floor((index ? index.count : pos.count) / 3);
    const step = Math.max(1, Math.floor(triCount / 450));
    const vert = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);

    for (let t = 0; t < triCount; t += step) {
      _a.fromBufferAttribute(pos, vert(t, 0)).applyMatrix4(m);
      _b.fromBufferAttribute(pos, vert(t, 1)).applyMatrix4(m);
      _c.fromBufferAttribute(pos, vert(t, 2)).applyMatrix4(m);
      const cy = (_a.y + _b.y + _c.y) / 3;
      if (cy < minY || cy > maxY) continue;
      _ab.subVectors(_b, _a);
      _ac.subVectors(_c, _a);
      _nrm.crossVectors(_ab, _ac);
      if (_nrm.lengthSq() < 1e-8) continue;
      _nrm.normalize();
      samples.push({
        pos: new T.Vector3((_a.x + _b.x + _c.x) / 3, cy, (_a.z + _b.z + _c.z) / 3),
        normal: _nrm.clone(),
      });
    }
  });
  return samples;
}

/**
 * Mount a wafer-thin flush LED strip directly onto the nearest real chassis body surface triangle,
 * embedded 4 mm INTO the bodywork along `-normal` so there is ZERO air gap and ZERO floating geometry.
 */
function mountFlushSurfaceLamp(
  chassis: T.Object3D,
  samples: SurfaceSample[],
  target: T.Vector3,
  desiredDir: T.Vector3,
  width: number,
  height: number,
  mat: T.Material,
  name: string,
): T.Mesh | null {
  if (samples.length === 0) return null;
  let best: SurfaceSample | null = null;
  let bestScore = Infinity;

  for (const s of samples) {
    // Only snap onto triangles on the matching side/end that face outward toward `desiredDir` (or nearly so).
    if (desiredDir.z > 0.5 && s.pos.z < 0.15) continue;
    if (desiredDir.z < -0.5 && s.pos.z > -0.15) continue;
    if (Math.abs(target.x) > 0.08 && Math.sign(s.pos.x) !== Math.sign(target.x)) continue;

    const dx = s.pos.x - target.x;
    const dy = (s.pos.y - target.y) * 1.4;
    const dz = s.pos.z - target.z;
    const align = s.normal.dot(desiredDir);
    const alignPenalty = align < 0.15 ? 0.65 : (1 - align) * 0.12;
    const score = Math.sqrt(dx * dx + dy * dy + dz * dz) + alignPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) return null;

  // Outward orientation guaranteed to face the viewer, blended smoothly with true bodywork surface normal.
  const outNormal = best.normal.clone();
  if (outNormal.dot(desiredDir) < 0) outNormal.negate();
  outNormal.lerp(desiredDir, 0.35).normalize();

  const depth = 0.016;
  const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), mat);
  mesh.name = name;
  // Embed slightly (depth * 0.25) INTO the bodywork so it is physically bonded to the fairing/bumper with 0 mm gap!
  mesh.position.copy(best.pos).addScaledVector(outNormal, depth * 0.22);
  mesh.quaternion.setFromUnitVectors(_zAxis, outNormal);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  chassis.add(mesh);
  return mesh;
}

/**
 * Attach independent per-vehicle dynamic Brake Lights + Left/Right Amber Turn Signals.
 *
 * Prioritizes native sculpted GLB lamp meshes split by `markLampParts` (zero added geometry!).
 * Only falls back to surface-projected flush lenses welded onto the actual bodywork mesh for models
 * that do not contain dedicated tail/signal sub-meshes (`bike-pcx`, `baothu`, `bike-rider`).
 */
export function attachDynamicLamps(
  chassis: T.Object3D,
  halfWidth: number,
  halfLength: number,
  isMoto: boolean,
): DynamicVehicleLamps {
  const uniqueTailEntries: { mat: T.MeshStandardMaterial; brake: number }[] = [];
  const leftSignalMats: T.MeshStandardMaterial[] = [];
  const rightSignalMats: T.MeshStandardMaterial[] = [];
  let hasNativeHead = false;

  // 1. Bind directly to every native GLB split lamp mesh on this vehicle (0 mm gap, exact model triangles!).
  chassis.traverse((o) => {
    if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh) return;
    const mat = o.material;
    if (!(mat instanceof T.MeshStandardMaterial)) return;
    if (mat.name.endsWith("_lamp_head")) {
      hasNativeHead = true;
    } else if (mat.name.endsWith("_lamp_tail")) {
      const cloned = mat.clone();
      o.material = cloned;
      const entry = { mat: cloned, brake: 0 };
      uniqueTailEntries.push(entry);
      perVehicleBrakeMats.push(entry);
      applyTailBrake(cloned, 0);
    } else if (mat.name.endsWith("_lamp_signal_left")) {
      const cloned = mat.clone();
      o.material = cloned;
      leftSignalMats.push(cloned);
    } else if (mat.name.endsWith("_lamp_signal_right")) {
      const cloned = mat.clone();
      o.material = cloned;
      rightSignalMats.push(cloned);
    }
  });

  const needsTail = uniqueTailEntries.length === 0;
  const needsSignals = leftSignalMats.length === 0 || rightSignalMats.length === 0;
  const needsHead = !hasNativeHead && isMoto;

  // 2. For single-atlas models without separate GLB lamp meshes, project wafer-thin lenses flush onto real body triangles.
  if (needsTail || needsSignals || needsHead) {
    const samples = sampleChassisBodySurface(chassis, isMoto);

    if (needsHead) {
      const headMat = new T.MeshStandardMaterial({
        color: 0xf4f1ea,
        emissive: 0xfff0d2,
        emissiveIntensity: 0.04 + level.lit * 7.0,
        roughness: 0.18,
      });
      headMats.push(headMat);
      mountFlushSurfaceLamp(
        chassis,
        samples,
        new T.Vector3(0, 0.96, halfLength * 0.84),
        new T.Vector3(0, 0.05, 1).normalize(),
        0.13,
        0.09,
        headMat,
        "FlushHeadlight",
      );
    }

    if (needsTail) {
      const brakeMat = new T.MeshStandardMaterial({
        color: 0x7a0d09,
        emissive: 0xff1e0e,
        emissiveIntensity: 0.14,
        roughness: 0.22,
      });
      const entry = { mat: brakeMat, brake: 0 };
      uniqueTailEntries.push(entry);
      perVehicleBrakeMats.push(entry);
      applyTailBrake(brakeMat, 0);

      if (isMoto) {
        mountFlushSurfaceLamp(
          chassis,
          samples,
          new T.Vector3(0, 0.84, -halfLength * 0.88),
          new T.Vector3(0, 0.1, -1).normalize(),
          0.11,
          0.055,
          brakeMat,
          "FlushTailLamp",
        );
      } else {
        for (const side of [-1, 1]) {
          mountFlushSurfaceLamp(
            chassis,
            samples,
            new T.Vector3(side * halfWidth * 0.68, 0.78, -halfLength * 0.95),
            new T.Vector3(side * 0.18, 0.05, -1).normalize(),
            0.22,
            0.075,
            brakeMat,
            side > 0 ? "FlushTailLampL" : "FlushTailLampR",
          );
        }
      }
    }

    if (needsSignals) {
      const makeSigMat = () =>
        new T.MeshStandardMaterial({
          color: 0x6e3e08,
          emissive: 0xffa40e,
          emissiveIntensity: 0.05,
          roughness: 0.22,
        });

      const addSide = (side: 1 | -1, targetList: T.MeshStandardMaterial[]) => {
        if (targetList.length > 0) return;
        const sigMat = makeSigMat();
        targetList.push(sigMat);
        const w = isMoto ? 0.045 : 0.085;
        const h = isMoto ? 0.036 : 0.055;
        const xAim = side * (isMoto ? halfWidth * 0.45 : halfWidth * 0.82);
        const yAim = isMoto ? 0.86 : 0.72;
        mountFlushSurfaceLamp(
          chassis,
          samples,
          new T.Vector3(xAim, yAim, halfLength * 0.86),
          new T.Vector3(side * 0.45, 0.05, 0.89).normalize(),
          w,
          h,
          sigMat,
          side > 0 ? "FlushSignalFL" : "FlushSignalFR",
        );
        mountFlushSurfaceLamp(
          chassis,
          samples,
          new T.Vector3(xAim, yAim, -halfLength * 0.88),
          new T.Vector3(side * 0.45, 0.05, -0.89).normalize(),
          w,
          h,
          sigMat,
          side > 0 ? "FlushSignalRL" : "FlushSignalRR",
        );
      };
      // Vehicle local frame: +Z = forward, +X = LEFT (dir === -1), -X = RIGHT (dir === 1).
      addSide(1, leftSignalMats);
      addSide(-1, rightSignalMats);
    }
  }

  let lastBrake = -1;
  let lastDir: -1 | 0 | 1 = 0;
  let lastBlink = false;

  const setSignalMats = (mats: T.MeshStandardMaterial[], lit: boolean) => {
    for (const m of mats) {
      if (lit) {
        m.color.setHex(0xffc94a);
        m.emissive.setHex(0xffa40e);
        m.emissiveIntensity = 5.4;
      } else {
        m.color.setHex(0x6e3e08);
        m.emissive.setHex(0xffa40e);
        m.emissiveIntensity = 0.05;
      }
    }
  };

  return {
    setBrake(amount: number) {
      const b = Math.max(0, Math.min(1, amount));
      if (Math.abs(b - lastBrake) < 0.03) return;
      lastBrake = b;
      for (const e of uniqueTailEntries) {
        e.brake = b;
        applyTailBrake(e.mat, b);
      }
    },
    setBlinker(dir: -1 | 0 | 1, blinkOn: boolean) {
      if (dir === lastDir && blinkOn === lastBlink) return;
      lastDir = dir;
      lastBlink = blinkOn;
      setSignalMats(leftSignalMats, dir === -1 && blinkOn);
      setSignalMats(rightSignalMats, dir === 1 && blinkOn);
    },
  };
}

/** 0 = day (lamps off), 1 = night. Wet roads show a brighter pool. */
export function setVehicleLightLevel(lit: number, wetness: number) {
  if (Math.abs(lit - level.lit) < 0.004 && Math.abs(wetness - level.wet) < 0.01) return;
  level = { lit, wet: wetness };
  for (const m of headMats) applyLevel(m, "head");
  for (const m of tailMats) applyLevel(m, "tail");
  for (const e of perVehicleBrakeMats) applyTailBrake(e.mat, e.brake);
  if (beamMat) beamMat.opacity = lit * (0.18 + wetness * 0.14);
}

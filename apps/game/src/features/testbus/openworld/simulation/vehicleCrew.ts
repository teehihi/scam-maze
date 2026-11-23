import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { warmSkin } from "./drive-look";
import { mergeVehicleBody } from "./vehicleLod";

/**
 * Biomechanical seated drivers & motorbike riders for moving vehicles.
 *
 * Measures exact vertex-level anchor geometry directly from each vehicle GLB (front rider saddle,
 * swept handlebar rubber grips, footpegs, fuel-tank knee clearance, and car steering-wheel rim),
 * then solves full-body posture in a rig-agnostic world-space pipeline:
 *   1. Skeleton-height normalization & hip-socket saddle seating
 *   2. Multi-segment spine lean + counter-leveled neck/head gaze
 *   3. 2-bone analytical Leg IK onto exact footpegs / pedals + tank-clearing knee pole + flat foot aim
 *   4. Clavicle protraction + adaptive torso lean assist + palm-compensated 2-bone Arm IK
 *   5. Exact 3-axis palm basis wrist orientation + curled 5-finger grip wrap around the bar/rim
 *
 * Works uniformly across UE4/UE5 rigs, full Mixamo rigs (`rowan`, `juno3`), and compact Mixamo (`manvn`).
 */

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const FILES = [
  "npc-alan",
  "npc-arthur",
  "manvn",
  "npc-yoshida",
  "npc-nguoigia",
  "npc-blackguy",
  "rowan",
  "juno3",
  "npc-napole",
  "npc-sofia",
  "npc-linmei",
  "npc-freya",
];
/**
 * Rigs unsuitable for exposed motorbikes:
 * - `npc-nguoigia`: long kimono robe clips off the back of a motorbike saddle.
 * - `manvn`: compact rig with 0 finger bones (rigid flat paddle hands); reserved for enclosed car cabins.
 */
const NO_MOTO = new Set(["npc-nguoigia", "manvn"]);
const MOTO_FILES = FILES.filter((f) => !NO_MOTO.has(f));

const MIXAMO: Record<string, string> = {
  pelvis: "Hips",
  spine_01: "Spine",
  spine_02: "Spine1",
  spine_03: "Spine2",
  neck_01: "Neck",
  head: "Head",
  clavicle_l: "LeftShoulder",
  clavicle_r: "RightShoulder",
  thigh_l: "LeftUpLeg",
  calf_l: "LeftLeg",
  foot_l: "LeftFoot",
  ball_l: "LeftToeBase",
  thigh_r: "RightUpLeg",
  calf_r: "RightLeg",
  foot_r: "RightFoot",
  ball_r: "RightToeBase",
  upperarm_l: "LeftArm",
  lowerarm_l: "LeftForeArm",
  hand_l: "LeftHand",
  upperarm_r: "RightArm",
  lowerarm_r: "RightForeArm",
  hand_r: "RightHand",
};

const FINGER_NAMES = ["index", "middle", "ring", "pinky", "thumb"] as const;
type FingerName = (typeof FINGER_NAMES)[number];
const MIXAMO_FINGER: Record<FingerName, string> = {
  index: "Index",
  middle: "Middle",
  ring: "Ring",
  pinky: "Pinky",
  thumb: "Thumb",
};

function findBone(root: T.Object3D, name: string): T.Object3D | undefined {
  const direct = root.getObjectByName(name);
  if (direct) return direct;
  const base = MIXAMO[name];
  if (!base) return undefined;
  return (
    root.getObjectByName(`mixamorig:${base}`) ??
    root.getObjectByName(`mixamorig${base}`) ??
    root.getObjectByName(base) ??
    undefined
  );
}

function findFingerBone(root: T.Object3D, side: "l" | "r", finger: FingerName, seg: 1 | 2 | 3): T.Object3D | undefined {
  const ueName = `${finger}_0${seg}_${side}`;
  const direct = root.getObjectByName(ueName);
  if (direct) return direct;
  const lr = side === "l" ? "Left" : "Right";
  const mxBase = `${lr}Hand${MIXAMO_FINGER[finger]}${seg}`;
  return (
    root.getObjectByName(`mixamorig:${mxBase}`) ??
    root.getObjectByName(`mixamorig${mxBase}`) ??
    root.getObjectByName(mxBase) ??
    undefined
  );
}

const cache = new Map<string, Promise<T.Group | null>>();
function source(file: string) {
  let p = cache.get(file);
  if (!p) {
    p = loader
      .loadAsync(`/assets/testbus/ow/models/${file}.optimized.glb`)
      .then((g) => g.scene)
      .catch(() => null);
    cache.set(file, p);
  }
  return p;
}

export type CrewKind = "car" | "moto";

export interface SeatSpec {
  /** Exact seat cushion surface contact point (rider's sit-bones, host-local). */
  seatSurface: T.Vector3;
  /** Backwards-compatible pelvis estimate in host-local space. */
  pelvis: T.Vector3;
  /** Horizontal unit vector the vehicle drives toward, in host-local space. */
  forward: T.Vector3;
  /** Horizontal unit vector pointing to the driver's RIGHT (`forward × UP`), in host-local space. */
  right: T.Vector3;
  /** Left & right grip center targets on handlebar / steering wheel rim (host-local). */
  handL: T.Vector3;
  handR: T.Vector3;
  /** Outward grip cylinder axes (pointing pinky-ward along each bar/rim tangent), host-local. */
  gripAxisL: T.Vector3;
  gripAxisR: T.Vector3;
  /** Radius of the gripped handlebar / steering rim (meters). */
  gripRadius: number;
  /** Left & right footpeg / pedal targets in host-local space. */
  footL: T.Vector3;
  footR: T.Vector3;
  /** Minimum knee lateral half-width so thighs/knees hug the fuel tank without clipping. */
  kneeHalfWidth: number;
  /** Base forward torso lean angle in radians (positive = lean forward; negative = car recline). */
  torsoLean: number;
  /** Optional interior ceiling height (host-local Y) to prevent head clipping through car roofs. */
  roofY?: number;
}

const UP = new T.Vector3(0, 1, 0);

function nodeCentre(host: T.Object3D, node: T.Object3D): T.Vector3 {
  const box = new T.Box3().setFromObject(node, true);
  return host.worldToLocal(box.getCenter(new T.Vector3()));
}

/** Collect all mesh vertex positions under `node` transformed into `host`-local coordinates. */
function collectHostVertices(host: T.Object3D, node: T.Object3D, maxSamples = 6000): T.Vector3[] {
  host.updateWorldMatrix(true, true);
  const hostInv = host.matrixWorld.clone().invert();
  const mat = new T.Matrix4();
  const out: T.Vector3[] = [];
  node.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const pos = o.geometry?.getAttribute("position");
    if (!pos) return;
    mat.multiplyMatrices(hostInv, o.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / maxSamples));
    for (let i = 0; i < pos.count; i += step) {
      out.push(new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mat));
    }
  });
  return out;
}

function avgVec(pts: T.Vector3[]): T.Vector3 {
  const sum = new T.Vector3();
  if (!pts.length) return sum;
  for (const p of pts) sum.add(p);
  return sum.multiplyScalar(1 / pts.length);
}

/**
 * Find the driving position and exact ergonomic anchor points of a vehicle from its named parts & geometry.
 * Must run BEFORE body meshes are merged, and after the vehicle sits at its final place under `host`.
 */
export function findSeat(host: T.Object3D, vehicle: T.Object3D, kind: CrewKind): SeatSpec | null {
  host.updateWorldMatrix(true, true);
  const named = (re: RegExp) => {
    let hit: T.Object3D | null = null;
    vehicle.traverse((o) => {
      if (!hit && re.test(o.name)) hit = o;
    });
    return hit as T.Object3D | null;
  };

  if (kind === "car") {
    const front = [named(/^wheel_FL/i), named(/^wheel_FR/i)].filter((x): x is T.Object3D => !!x);
    const rear = [named(/^wheel_RL/i), named(/^wheel_RR/i)].filter((x): x is T.Object3D => !!x);
    const steer = named(/^steering_wheel/i);
    if (!front.length || !rear.length || !steer) return null;
    const avgPos = (list: T.Object3D[]) =>
      list
        .reduce((a, o) => a.add(host.worldToLocal(o.getWorldPosition(new T.Vector3()))), new T.Vector3())
        .multiplyScalar(1 / list.length);
    const forward = avgPos(front).sub(avgPos(rear));
    forward.y = 0;
    forward.normalize();
    const right = new T.Vector3().crossVectors(forward, UP).normalize();

    // Sample actual steering-wheel RIM vertices (closest to the driver along -forward) so long steering columns
    // like savanna.glb & mula_van.glb never drag the driver's hands forward into the dashboard!
    const steerVerts = collectHostVertices(host, steer, 2000);
    let rimCenter = host.worldToLocal(steer.getWorldPosition(new T.Vector3()));
    let rimRadius = 0.17;
    if (steerVerts.length >= 12) {
      let minFwd = Infinity;
      for (const p of steerVerts) {
        const f = p.dot(forward);
        if (f < minFwd) minFwd = f;
      }
      const rimPts = steerVerts.filter((p) => p.dot(forward) <= minFwd + 0.17);
      if (rimPts.length >= 6) {
        let minLat = Infinity,
          maxLat = -Infinity,
          minY = Infinity,
          maxY = -Infinity,
          minF = Infinity,
          maxF = -Infinity;
        for (const p of rimPts) {
          const lat = p.dot(right);
          const f = p.dot(forward);
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
          if (f < minF) minF = f;
          if (f > maxF) maxF = f;
        }
        const midLat = (minLat + maxLat) * 0.5;
        const midF = (minF + maxF) * 0.5;
        const midY = (minY + maxY) * 0.5;
        rimCenter = right.clone().multiplyScalar(midLat).addScaledVector(forward, midF);
        rimCenter.y = midY;
        rimRadius = T.MathUtils.clamp((maxLat - minLat) * 0.5, 0.145, 0.205);
      }
    }

    // Measure interior ceiling height above the driver so heads never poke through low sedan roofs (harmony.glb!)
    const bodyNode = named(/^body$/i);
    let roofY: number | undefined;
    if (bodyNode) {
      const bBox = new T.Box3().setFromObject(bodyNode, true);
      roofY = host.worldToLocal(new T.Vector3(0, bBox.max.y, 0)).y;
    }

    // Seat cushion placed naturally behind & below the steering wheel rim
    const seatSurface = rimCenter.clone().addScaledVector(forward, -0.44);
    seatSurface.y = rimCenter.y - 0.42;
    if (roofY !== undefined) {
      seatSurface.y = Math.min(seatSurface.y, roofY - 0.96);
    }
    const pelvis = seatSurface.clone().add(new T.Vector3(0, 0.10, 0));

    // Realistic 10-and-2 driving grip on the steering wheel rim
    const handL = rimCenter
      .clone()
      .addScaledVector(right, -rimRadius * 0.94)
      .add(new T.Vector3(0, rimRadius * 0.24, 0));
    const handR = rimCenter
      .clone()
      .addScaledVector(right, rimRadius * 0.94)
      .add(new T.Vector3(0, rimRadius * 0.24, 0));
    // Rim tangents pointing downward (pinky lower, thumb hooking upper-inside rim)
    const gripAxisL = new T.Vector3(0, -0.94, 0).addScaledVector(right, -0.34).normalize();
    const gripAxisR = new T.Vector3(0, -0.94, 0).addScaledVector(right, 0.34).normalize();

    const pedalBase = rimCenter.clone().addScaledVector(forward, 0.24);
    pedalBase.y = Math.max(0.24, seatSurface.y - 0.18);
    const footL = pedalBase.clone().addScaledVector(right, -0.14);
    const footR = pedalBase.clone().addScaledVector(right, 0.08);

    return {
      seatSurface,
      pelvis,
      forward,
      right,
      handL,
      handR,
      gripAxisL,
      gripAxisR,
      gripRadius: 0.017,
      footL,
      footR,
      kneeHalfWidth: 0.14,
      torsoLean: -0.14,
      roofY,
    };
  }

  // ===== MOTORBIKE (`kind === "moto"`) =====
  const head = named(/farol/i);
  const tail = named(/luzes.*tras/i);
  const seat = named(/banco/i);
  const grip = named(/acelerador/i);
  if (!head || !tail || !seat) return null;

  const forward = nodeCentre(host, head).sub(nodeCentre(host, tail));
  forward.y = 0;
  forward.normalize();
  const right = new T.Vector3().crossVectors(forward, UP).normalize();

  // 1. Vertex-sample the FRONT RIDER SADDLE of `banco` (excludes the high rear passenger pillion!)
  const seatVerts = collectHostVertices(host, seat, 2500);
  const seatCenterFallback = nodeCentre(host, seat);
  const seatBox = new T.Box3().setFromObject(seat, true);
  let seatSurface = seatCenterFallback.clone();
  seatSurface.y = host.worldToLocal(new T.Vector3(0, seatBox.min.y + (seatBox.max.y - seatBox.min.y) * 0.48, 0)).y;

  if (seatVerts.length >= 16) {
    let minF = Infinity,
      maxF = -Infinity;
    for (const p of seatVerts) {
      const f = p.dot(forward);
      if (f < minF) minF = f;
      if (f > maxF) maxF = f;
    }
    const seatLen = Math.max(0.15, maxF - minF);
    const latCenter = seatCenterFallback.dot(right);
    // Rider sits in the front-middle pocket (between 22% and 62% back from front tip of saddle, away from rear pillion!)
    const riderZoneFMin = maxF - seatLen * 0.62;
    const riderZoneFMax = maxF - seatLen * 0.18;
    const riderBand = seatVerts.filter(
      (p) =>
        p.dot(forward) >= riderZoneFMin &&
        p.dot(forward) <= riderZoneFMax &&
        Math.abs(p.dot(right) - latCenter) < 0.11,
    );
    const ys = (riderBand.length >= 8 ? riderBand : seatVerts).map((p) => p.y).sort((a, b) => a - b);
    const saddleTopY = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.88))];
    // Sit snugly in the contoured front rider pocket (44% back from front tip of banco, well ahead of rear pillion!)
    const riderF = maxF - seatLen * 0.44;
    seatSurface = right.clone().multiplyScalar(latCenter).addScaledVector(forward, riderF);
    seatSurface.y = saddleTopY;
  }

  // 2. Vertex-sample LEFT & RIGHT rubber handlebar grips from `acelerador` (handles symmetric dual-grip mesh!)
  let handL = seatSurface.clone().addScaledVector(forward, 0.54).addScaledVector(right, -0.30).add(new T.Vector3(0, 0.20, 0));
  let handR = seatSurface.clone().addScaledVector(forward, 0.54).addScaledVector(right, 0.30).add(new T.Vector3(0, 0.20, 0));
  let gripAxisL = right.clone().multiplyScalar(-0.76).addScaledVector(forward, -0.65).normalize();
  let gripAxisR = right.clone().multiplyScalar(0.76).addScaledVector(forward, -0.65).normalize();

  if (grip) {
    const gVerts = collectHostVertices(host, grip, 2500);
    const lat0 = seatSurface.dot(right);
    let maxAbsLat = 0;
    for (const p of gVerts) {
      const a = Math.abs(p.dot(right) - lat0);
      if (a > maxAbsLat) maxAbsLat = a;
    }
    if (maxAbsLat > 0.16) {
      const leftPts = gVerts.filter((p) => p.dot(right) - lat0 < -maxAbsLat * 0.68);
      const rightPts = gVerts.filter((p) => p.dot(right) - lat0 > maxAbsLat * 0.68);
      if (leftPts.length >= 6 && rightPts.length >= 6) {
        const innerL = avgVec(gVerts.filter((p) => { const d = p.dot(right) - lat0; return d < -maxAbsLat * 0.58 && d > -maxAbsLat * 0.78; }));
        const outerL = avgVec(gVerts.filter((p) => p.dot(right) - lat0 <= -maxAbsLat * 0.82));
        const innerR = avgVec(gVerts.filter((p) => { const d = p.dot(right) - lat0; return d > maxAbsLat * 0.58 && d < maxAbsLat * 0.78; }));
        const outerR = avgVec(gVerts.filter((p) => p.dot(right) - lat0 >= maxAbsLat * 0.82));
        // Center of rubber grip sleeve (halfway between switch collar and bar end!)
        handL = avgVec(leftPts);
        handR = avgVec(rightPts);
        if (innerL.lengthSq() > 0 && outerL.lengthSq() > 0) {
          const axL = outerL.clone().sub(innerL);
          if (axL.lengthSq() > 1e-4) gripAxisL = axL.normalize();
        }
        if (innerR.lengthSq() > 0 && outerR.lengthSq() > 0) {
          const axR = outerR.clone().sub(innerR);
          if (axR.lengthSq() > 1e-4) gripAxisR = axR.normalize();
        }
      }
    }
  }

  // 3. Measure fuel-tank width so knees hug outside the tank without clipping into it
  const tank = named(/tanque/i);
  let kneeHalfWidth = 0.22;
  if (tank) {
    const tVerts = collectHostVertices(host, tank, 1200);
    const lat0 = seatSurface.dot(right);
    const seatF = seatSurface.dot(forward);
    let maxTankW = 0;
    for (const p of tVerts) {
      const df = p.dot(forward) - seatF;
      if (df > -0.05 && df < 0.42) {
        const w = Math.abs(p.dot(right) - lat0);
        if (w > maxTankW) maxTankW = w;
      }
    }
    if (maxTankW > 0.08) kneeHalfWidth = Math.max(0.20, maxTankW + 0.055);
  }

  // 4. Vertex-sample rider footpegs on lower frame/plastic meshes (fallback to standard naked-bike peg geometry)
  const bikeBox = new T.Box3().setFromObject(vehicle, true);
  const bikeMinY = host.worldToLocal(new T.Vector3(0, bikeBox.min.y, 0)).y;
  const bikeH = Math.max(0.8, host.worldToLocal(new T.Vector3(0, bikeBox.max.y, 0)).y - bikeMinY);
  let footL = seatSurface
    .clone()
    .addScaledVector(forward, 0.10)
    .addScaledVector(right, -0.21)
    .add(new T.Vector3(0, -0.46, 0));
  let footR = seatSurface
    .clone()
    .addScaledVector(forward, 0.10)
    .addScaledVector(right, 0.21)
    .add(new T.Vector3(0, -0.46, 0));

  const frameNode = named(/plastico/i) ?? named(/metal/i);
  if (frameNode) {
    const fVerts = collectHostVertices(host, frameNode, 4000);
    const lat0 = seatSurface.dot(right);
    const seatF = seatSurface.dot(forward);
    const pegCand = fVerts.filter((p) => {
      const yRel = (p.y - bikeMinY) / bikeH;
      const df = p.dot(forward) - seatF;
      const lat = Math.abs(p.dot(right) - lat0);
      return yRel > 0.23 && yRel < 0.34 && df > -0.04 && df < 0.24 && lat > 0.14;
    });
    if (pegCand.length >= 12) {
      let maxPegLat = 0;
      for (const p of pegCand) {
        const a = Math.abs(p.dot(right) - lat0);
        if (a > maxPegLat) maxPegLat = a;
      }
      const leftPeg = pegCand.filter((p) => p.dot(right) - lat0 < -(maxPegLat - 0.05));
      const rightPeg = pegCand.filter((p) => p.dot(right) - lat0 > maxPegLat - 0.05);
      if (leftPeg.length >= 4 && rightPeg.length >= 4) {
        const pL = avgVec(leftPeg);
        const pR = avgVec(rightPeg);
        // Symmetrize pegs cleanly and lift slightly (+0.035m) so the shoe sole rests ON TOP of the peg
        const midF = (pL.dot(forward) + pR.dot(forward)) * 0.5;
        const midY = (pL.y + pR.y) * 0.5 + 0.035;
        const halfLat = Math.max(0.18, (Math.abs(pL.dot(right) - lat0) + Math.abs(pR.dot(right) - lat0)) * 0.5);
        footL = right.clone().multiplyScalar(lat0 - halfLat).addScaledVector(forward, midF);
        footL.y = midY;
        footR = right.clone().multiplyScalar(lat0 + halfLat).addScaledVector(forward, midF);
        footR.y = midY;
      }
    }
  }

  return {
    seatSurface,
    pelvis: seatSurface.clone().add(new T.Vector3(0, 0.10, 0)),
    forward,
    right,
    handL,
    handR,
    gripAxisL,
    gripAxisR,
    gripRadius: 0.018,
    footL,
    footR,
    kneeHalfWidth,
    torsoLean: 0.34,
  };
}

/** Apply a world-space rotation `deltaWorldQ` to `bone` cleanly in its parent's local frame. */
function applyWorldDelta(bone: T.Object3D, deltaWorldQ: T.Quaternion) {
  if (!bone.parent) return;
  const parentW = bone.parent.getWorldQuaternion(new T.Quaternion());
  const localDelta = parentW.clone().invert().multiply(deltaWorldQ).multiply(parentW);
  bone.quaternion.premultiply(localDelta);
  bone.updateMatrixWorld(true);
}

/** Rotate `bone` so the vector `(bone -> child)` aligns with world-space direction `toWorld`. */
function aim(bone: T.Object3D | undefined, child: T.Object3D | undefined, toWorld: T.Vector3) {
  if (!bone || !child || !bone.parent) return;
  const cur = child.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3()));
  if (cur.lengthSq() < 1e-8 || toWorld.lengthSq() < 1e-8) return;
  cur.normalize();
  const target = toWorld.clone().normalize();
  applyWorldDelta(bone, new T.Quaternion().setFromUnitVectors(cur, target));
}

/** Rotate `bone` by `angleRad` around a world-space axis `worldAxis`. */
function rotateAroundWorldAxis(bone: T.Object3D | undefined, worldAxis: T.Vector3, angleRad: number) {
  if (!bone || !bone.parent || Math.abs(angleRad) < 1e-5 || worldAxis.lengthSq() < 1e-8) return;
  const dq = new T.Quaternion().setFromAxisAngle(worldAxis.clone().normalize(), angleRad);
  applyWorldDelta(bone, dq);
}

/** Exact 2-bone analytical IK in world space: bends the mid joint toward `hint` and places `end` on `target`. */
function solveTwoBoneIK(
  root: T.Object3D | undefined,
  mid: T.Object3D | undefined,
  end: T.Object3D | undefined,
  target: T.Vector3,
  hint: T.Vector3,
): { reachRatio: number } {
  if (!root || !mid || !end) return { reachRatio: 0 };
  const s = root.getWorldPosition(new T.Vector3());
  const e = mid.getWorldPosition(new T.Vector3());
  const h = end.getWorldPosition(new T.Vector3());
  const l1 = s.distanceTo(e);
  const l2 = e.distanceTo(h);
  if (l1 < 1e-4 || l2 < 1e-4) return { reachRatio: 0 };

  const toTarget = target.clone().sub(s);
  const rawDist = toTarget.length();
  const maxReach = (l1 + l2) * 0.992;
  const minReach = Math.abs(l1 - l2) + 0.04;
  const d = T.MathUtils.clamp(rawDist, minReach, maxReach);
  const dir = rawDist > 1e-5 ? toTarget.clone().divideScalar(rawDist) : new T.Vector3(0, -1, 0);

  const a = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const bendH = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const pole = hint.clone().addScaledVector(dir, -hint.dot(dir));
  if (pole.lengthSq() < 1e-6) {
    pole.set(0, -1, 0).addScaledVector(dir, dir.y);
  }
  pole.normalize();

  const joint = s.clone().addScaledVector(dir, a).addScaledVector(pole, bendH);
  const endGoal = s.clone().addScaledVector(dir, d);
  aim(root, mid, joint.clone().sub(s));
  aim(mid, end, endGoal.clone().sub(mid.getWorldPosition(new T.Vector3())));
  return { reachRatio: rawDist / (l1 + l2) };
}

/**
 * Measure the current world-space orthonormal palm basis of a hand directly from its knuckle bones.
 * Verified across both UE4/UE5 and Mixamo rigs:
 *   - `fwd`: wrist -> middle knuckle (points out along fingers)
 *   - `pinkyToIdx`: pinky knuckle -> index knuckle (points toward thumb side)
 *   - `palmOut`: points OUT of the palm (into the handlebar grip!)
 */
function measureHandBasis(root: T.Object3D, side: "l" | "r", hand: T.Object3D) {
  const idx = findFingerBone(root, side, "index", 1);
  const mid = findFingerBone(root, side, "middle", 1);
  const pnk = findFingerBone(root, side, "pinky", 1);
  if (!idx || !mid || !pnk) return null;

  const wPos = hand.getWorldPosition(new T.Vector3());
  const mPos = mid.getWorldPosition(new T.Vector3());
  const iPos = idx.getWorldPosition(new T.Vector3());
  const pPos = pnk.getWorldPosition(new T.Vector3());

  const palmDist = wPos.distanceTo(mPos);
  const fwd = mPos.clone().sub(wPos).normalize();
  const acrossRaw = iPos.clone().sub(pPos).normalize();
  // Left hand: palmOut = cross(fwd, pinkyToIdx); Right hand: palmOut = cross(pinkyToIdx, fwd)
  const palmOut = (
    side === "l" ? new T.Vector3().crossVectors(fwd, acrossRaw) : new T.Vector3().crossVectors(acrossRaw, fwd)
  ).normalize();
  // Re-orthogonalize across so (fwd, across, palmOut) is an exact right-handed basis
  const across = (
    side === "l" ? new T.Vector3().crossVectors(palmOut, fwd) : new T.Vector3().crossVectors(fwd, palmOut)
  ).normalize();

  return { fwd, across, palmOut, palmDist };
}

/**
 * Rotate `hand` so its measured palm basis `(fwd, across, palmOut)` matches the exact desired world grip basis,
 * then curl all 4 fingers + opposing thumb naturally around the handlebar / steering wheel cylinder.
 */
function orientAndGripHand(
  root: T.Object3D,
  side: "l" | "r",
  hand: T.Object3D | undefined,
  targetFwd: T.Vector3,
  targetPinkyToIdx: T.Vector3,
  targetPalmOut: T.Vector3,
) {
  if (!hand || !hand.parent) return;
  const cur = measureHandBasis(root, side, hand);
  if (!cur) return;

  // Build exact orthonormal basis rotation: R = M_target * M_current^T
  // Ensure consistent handedness between source and destination bases!
  const tFwd = targetFwd.clone().normalize();
  const tPalm = targetPalmOut.clone().normalize();
  const tAcross = (
    side === "l" ? new T.Vector3().crossVectors(tPalm, tFwd) : new T.Vector3().crossVectors(tFwd, tPalm)
  ).normalize();
  // Check alignment with intended pinky->index direction
  if (tAcross.dot(targetPinkyToIdx) < 0) tAcross.negate();

  // Columns must have determinant +1 for both matrices
  const cZ = new T.Vector3().crossVectors(cur.fwd, cur.across).normalize();
  const tZ = new T.Vector3().crossVectors(tFwd, tAcross).normalize();
  const mCur = new T.Matrix4().makeBasis(cur.fwd, cur.across, cZ);
  const mTgt = new T.Matrix4().makeBasis(tFwd, tAcross, tZ);
  const mDelta = mTgt.multiply(mCur.transpose());
  const qDelta = new T.Quaternion().setFromRotationMatrix(mDelta);
  applyWorldDelta(hand, qDelta);

  // Re-read the oriented palm basis to curl all 5 fingers tightly around the cylindrical grip!
  const after = measureHandBasis(root, side, hand);
  const palmDir = after ? after.palmOut : tPalm;

  // 4 fingers wrap over the front/top of the grip and curl underneath toward `palmDir`
  const segAngles: readonly [number, number, number] = [0.96, 1.24, 0.82];
  for (const finger of ["index", "middle", "ring", "pinky"] as const) {
    const f1 = findFingerBone(root, side, finger, 1);
    const f2 = findFingerBone(root, side, finger, 2);
    const f3 = findFingerBone(root, side, finger, 3);
    const segs = [f1, f2, f3];
    for (let i = 0; i < segs.length; i++) {
      const b = segs[i];
      if (!b) continue;
      const next = segs[i + 1];
      const boneDir = next
        ? next.getWorldPosition(new T.Vector3()).sub(b.getWorldPosition(new T.Vector3())).normalize()
        : (after?.fwd ?? tFwd).clone();
      // Exact universal curl axis: rotating `boneDir` by +angle around `cross(boneDir, palmDir)` bends INTO palm!
      const curlAxis = new T.Vector3().crossVectors(boneDir, palmDir);
      if (curlAxis.lengthSq() > 1e-6) {
        rotateAroundWorldAxis(b, curlAxis.normalize(), segAngles[i]);
      }
    }
  }

  // Opposing thumb wraps underneath the bar toward the curled index/middle fingertips
  const th1 = findFingerBone(root, side, "thumb", 1);
  const th2 = findFingerBone(root, side, "thumb", 2);
  const th3 = findFingerBone(root, side, "thumb", 3);
  if (th1 && th2) {
    const thumbGoal = palmDir.clone().multiplyScalar(0.72).addScaledVector(tFwd, 0.56).addScaledVector(tAcross, -0.35).normalize();
    aim(th1, th2, thumbGoal);
    const thDir = th2.getWorldPosition(new T.Vector3()).sub(th1.getWorldPosition(new T.Vector3())).normalize();
    const thCurlAxis = new T.Vector3().crossVectors(thDir, palmDir.clone().addScaledVector(tAcross, -0.6).normalize());
    if (thCurlAxis.lengthSq() > 1e-6) {
      thCurlAxis.normalize();
      rotateAroundWorldAxis(th2, thCurlAxis, 0.58);
      rotateAroundWorldAxis(th3, thCurlAxis, 0.52);
    }
  }
}

/** Compute true standing anatomical height from skeleton bone lengths (immune to hunched rest poses!). */
function estimateSkeletonHeight(obj: T.Object3D): number {
  const b = (n: string) => findBone(obj, n);
  const th = b("thigh_l") ?? b("thigh_r");
  const cf = b("calf_l") ?? b("calf_r");
  const ft = b("foot_l") ?? b("foot_r");
  const pel = b("pelvis");
  const sp1 = b("spine_01");
  const sp2 = b("spine_02");
  const sp3 = b("spine_03");
  const nk = b("neck_01");
  const hd = b("head");
  if (!th || !cf || !ft || !pel || !hd) return 0;

  const wp = (o: T.Object3D) => o.getWorldPosition(new T.Vector3());
  const d = (a: T.Object3D, c: T.Object3D) => wp(a).distanceTo(wp(c));
  const chain = [pel, sp1, sp2, sp3, nk, hd].filter((x): x is T.Object3D => !!x);
  let torso = 0;
  for (let i = 0; i < chain.length - 1; i++) torso += d(chain[i], chain[i + 1]);
  const leg = d(th, cf) + d(cf, ft);
  // Add foot sole height (~0.09m ratio) + head crown above head joint (~0.14m ratio) => factor ~1.14
  return (leg + torso) * 1.13;
}

export interface CrewMember {
  root: T.Group;
  dispose(): void;
}

/** Add a biomechanically posed driver / motorbike rider to `host`. */
export async function addCrew(
  host: T.Object3D,
  seat: SeatSpec,
  kind: CrewKind,
  variant: number,
  isDisposed: () => boolean,
): Promise<CrewMember | null> {
  const files = kind === "moto" ? MOTO_FILES : FILES;
  const src = await source(files[variant % files.length]);
  if (!src || isDisposed()) return null;

  const obj = cloneSkinned(src) as T.Group;
  const crew = new T.Group();
  crew.name = "VehicleCrew";
  crew.add(obj);

  obj.updateMatrixWorld(true);
  const skelH = estimateSkeletonHeight(obj);
  const bounds = new T.Box3().setFromObject(obj, true);
  const rawH = skelH > 0.4 ? skelH : Math.max(0.1, bounds.max.y - bounds.min.y);
  const targetHeight = kind === "moto" ? 1.65 + (variant % 3) * 0.03 : 1.66 + (variant % 4) * 0.025;
  obj.scale.setScalar(targetHeight / rawH);

  obj.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.name === "HumanBody") {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m instanceof T.MeshStandardMaterial) warmSkin(m);
        }
      }
    }
  });

  // Face the vehicle's driving direction (all 11 NPC rigs face +Z, with Left = +X, Right = -X).
  crew.rotation.y = Math.atan2(seat.forward.x, seat.forward.z);
  host.add(crew);
  host.updateWorldMatrix(true, true);

  const bone = (n: string) => findBone(obj, n);
  const fwdW = seat.forward.clone().transformDirection(host.matrixWorld).normalize();
  const rightW = seat.right.clone().transformDirection(host.matrixWorld).normalize();
  const upW = UP.clone().transformDirection(host.matrixWorld).normalize();
  // Right-hand rule: rotating by +angle around `pitchAxisW = upW × fwdW` (pointing LEFT) pitches UP -> FORWARD!
  const pitchAxisW = new T.Vector3().crossVectors(upW, fwdW).normalize();
  const toWorldPt = (v: T.Vector3) => v.clone().applyMatrix4(host.matrixWorld);

  // 1. Save rest neck/head local quaternions BEFORE neutralizing spine (preserves natural level eye gaze!)
  const nkBone = bone("neck_01");
  const hdBone = bone("head");
  const restNeckQ = nkBone?.quaternion.clone();
  const restHeadQ = hdBone?.quaternion.clone();

  // Neutralize only the lower/mid spine chain (`spine_01 -> spine_02 -> spine_03 -> neck_01`) so hunched rest poses stand tall
  const torsoChain = [bone("spine_01"), bone("spine_02"), bone("spine_03"), nkBone].filter(
    (x): x is T.Object3D => !!x,
  );
  const resetTorsoVertical = () => {
    for (let i = 0; i < torsoChain.length - 1; i++) {
      aim(torsoChain[i], torsoChain[i + 1], upW);
    }
    if (nkBone && restNeckQ) {
      nkBone.quaternion.copy(restNeckQ);
      nkBone.updateMatrixWorld(true);
    }
    if (hdBone && restHeadQ) {
      hdBone.quaternion.copy(restHeadQ);
      hdBone.updateMatrixWorld(true);
    }
  };
  resetTorsoVertical();

  // Level shoulders horizontally (fixes asymmetric rest poses like npc-freya & npc-blackguy!)
  const clvL = bone("clavicle_l");
  const clvR = bone("clavicle_r");
  const uArmL = bone("upperarm_l");
  const uArmR = bone("upperarm_r");
  if (clvL && uArmL) aim(clvL, uArmL, rightW.clone().multiplyScalar(-0.96).addScaledVector(upW, -0.08).addScaledVector(fwdW, 0.14));
  if (clvR && uArmR) aim(clvR, uArmR, rightW.clone().multiplyScalar(0.96).addScaledVector(upW, -0.08).addScaledVector(fwdW, 0.14));

  // 2. Seat the character flush onto the measured saddle / car cushion using hip-socket (thigh) height
  const thL = bone("thigh_l");
  const thR = bone("thigh_r");
  const pelvis = bone("pelvis");
  const hipRef =
    thL && thR
      ? thL.getWorldPosition(new T.Vector3()).add(thR.getWorldPosition(new T.Vector3())).multiplyScalar(0.5)
      : pelvis?.getWorldPosition(new T.Vector3());
  if (hipRef) {
    // Glute / hamstring flesh thickness below hip socket when seated is ~0.080m on a bike saddle, ~0.085m on car cushion
    const hipOffsetY = kind === "moto" ? 0.080 : 0.085;
    const desiredHipHost = seat.seatSurface.clone().add(new T.Vector3(0, hipOffsetY, 0));
    const curHipHost = host.worldToLocal(hipRef.clone());
    crew.position.add(desiredHipHost.sub(curHipHost));
    host.updateWorldMatrix(true, true);
  }

  // Clamp car driver head below roof if needed
  if (kind === "car" && seat.roofY !== undefined) {
    if (hdBone) {
      const headTopHostY = host.worldToLocal(hdBone.getWorldPosition(new T.Vector3())).y + 0.15;
      if (headTopHostY > seat.roofY - 0.05) {
        crew.position.y -= headTopHostY - (seat.roofY - 0.05);
        host.updateWorldMatrix(true, true);
      }
    }
  }

  // 3. Apply natural base spine lean & level head gaze straight down the road (NOT tilted up at the sky!)
  const applyTorsoLean = (leanRad: number) => {
    resetTorsoVertical();
    const sp1 = bone("spine_01");
    const sp2 = bone("spine_02");
    const sp3 = bone("spine_03");
    rotateAroundWorldAxis(sp1, pitchAxisW, leanRad * 0.46);
    rotateAroundWorldAxis(sp2, pitchAxisW, leanRad * 0.34);
    rotateAroundWorldAxis(sp3, pitchAxisW, leanRad * 0.20);
    // Counter-pitch neck & head smoothly so the eyes look dead-level down the road ahead!
    rotateAroundWorldAxis(nkBone, pitchAxisW, -leanRad * 0.48);
    rotateAroundWorldAxis(hdBone, pitchAxisW, -leanRad * 0.34);
    obj.updateMatrixWorld(true);
  };
  applyTorsoLean(seat.torsoLean);

  // 4. Exact 2-Bone Leg IK onto measured footpegs / car pedals + natural knee clearance + flat shoe alignment
  const legDefs: readonly { side: "l" | "r"; sign: -1 | 1; footTarget: T.Vector3 }[] = [
    { side: "l", sign: -1, footTarget: seat.footL },
    { side: "r", sign: 1, footTarget: seat.footR },
  ];
  for (const { side, sign, footTarget } of legDefs) {
    const thigh = bone(`thigh_${side}`);
    const calf = bone(`calf_${side}`);
    const foot = bone(`foot_${side}`);
    const ball = bone(`ball_${side}`);
    if (!thigh || !calf || !foot) continue;

    // Knee pole vector: pushes knees forward and just outside the fuel tank (`kneeHalfWidth`)
    const latPush = kind === "moto" ? Math.max(0.28, seat.kneeHalfWidth * 1.45) : 0.12;
    const kneeHint = fwdW.clone().multiplyScalar(0.95).addScaledVector(rightW, sign * latPush).addScaledVector(upW, 0.22);
    solveTwoBoneIK(thigh, calf, foot, toWorldPt(footTarget), kneeHint);

    // Rest the shoe arch flat/natural on the footpeg (or angled onto car pedals)
    if (ball) {
      const footAim =
        kind === "moto"
          ? fwdW.clone().multiplyScalar(0.94).addScaledVector(upW, -0.22).addScaledVector(rightW, sign * 0.08)
          : fwdW.clone().multiplyScalar(0.55).addScaledVector(upW, 0.82);
      aim(foot, ball, footAim);
    }
  }

  // 5. Compute exact grip basis & palm-compensated wrist targets for Left and Right hands
  const buildGripTargets = () => {
    const out: {
      side: "l" | "r";
      sign: -1 | 1;
      gripAxisW: T.Vector3;
      targetFwd: T.Vector3;
      targetPinkyToIdx: T.Vector3;
      targetPalmOut: T.Vector3;
      wristTarget: T.Vector3;
    }[] = [];

    for (const [side, sign, gripLocal, axisLocal] of [
      ["l", -1, seat.handL, seat.gripAxisL],
      ["r", 1, seat.handR, seat.gripAxisR],
    ] as const) {
      const gripW = toWorldPt(gripLocal);
      const axisW = axisLocal.clone().transformDirection(host.matrixWorld).normalize();
      // Pinky sits outward along `axisW`; Index/Thumb sit inward along `-axisW`
      const targetPinkyToIdx = axisW.clone().negate();

      let targetPalmOut: T.Vector3;
      let targetFwd: T.Vector3;
      if (kind === "moto") {
        // Palm presses downward & slightly forward onto the cylindrical rubber grip
        targetPalmOut = upW.clone().multiplyScalar(-0.88).addScaledVector(fwdW, 0.47).normalize();
        // Make palmOut strictly perpendicular to the grip cylinder axis
        targetPalmOut.addScaledVector(targetPinkyToIdx, -targetPalmOut.dot(targetPinkyToIdx)).normalize();
        // Left: fwd = cross(pinkyToIdx, palmOut); Right: fwd = cross(palmOut, pinkyToIdx) -> both point FORWARD over bar!
        targetFwd = (
          side === "l"
            ? new T.Vector3().crossVectors(targetPinkyToIdx, targetPalmOut)
            : new T.Vector3().crossVectors(targetPalmOut, targetPinkyToIdx)
        ).normalize();
      } else {
        // Car steering wheel: palm faces inward toward the rim center & slightly forward
        targetPalmOut = rightW.clone().multiplyScalar(-sign * 0.72).addScaledVector(fwdW, 0.69).normalize();
        targetPalmOut.addScaledVector(targetPinkyToIdx, -targetPalmOut.dot(targetPinkyToIdx)).normalize();
        targetFwd = (
          side === "l"
            ? new T.Vector3().crossVectors(targetPinkyToIdx, targetPalmOut)
            : new T.Vector3().crossVectors(targetPalmOut, targetPinkyToIdx)
        ).normalize();
      }

      // Measure actual wrist-to-knuckle length on this rig so the PALM (not the wrist bone!) lands dead-center on the grip!
      const handBone = bone(`hand_${side}`);
      const mid1 = findFingerBone(obj, side, "middle", 1);
      const palmLen =
        handBone && mid1 ? handBone.getWorldPosition(new T.Vector3()).distanceTo(mid1.getWorldPosition(new T.Vector3())) : 0.072;

      const wristTarget = gripW
        .clone()
        .addScaledVector(targetFwd, -palmLen * 0.74)
        .addScaledVector(targetPalmOut, -(seat.gripRadius + 0.016));

      out.push({ side, sign, gripAxisW: axisW, targetFwd, targetPinkyToIdx, targetPalmOut, wristTarget });
    }
    return out;
  };

  let gripTargets = buildGripTargets();

  // 6. Adaptive Torso Lean Assist: if shorter-armed riders (e.g. npc-linmei) would over-extend (>93% reach),
  //    lean the torso smoothly closer to the handlebars so EVERY rider achieves a relaxed natural elbow bend!
  if (kind === "moto") {
    let worstRatio = 0;
    for (const g of gripTargets) {
      const u = bone(`upperarm_${g.side}`);
      const l = bone(`lowerarm_${g.side}`);
      const h = bone(`hand_${g.side}`);
      if (!u || !l || !h) continue;
      const l1 = u.getWorldPosition(new T.Vector3()).distanceTo(l.getWorldPosition(new T.Vector3()));
      const l2 = l.getWorldPosition(new T.Vector3()).distanceTo(h.getWorldPosition(new T.Vector3()));
      const d = u.getWorldPosition(new T.Vector3()).distanceTo(g.wristTarget);
      worstRatio = Math.max(worstRatio, d / Math.max(0.1, l1 + l2));
    }
    if (worstRatio > 0.91) {
      const extraLean = T.MathUtils.clamp((worstRatio - 0.88) * 1.45, 0.05, 0.34);
      applyTorsoLean(seat.torsoLean + extraLean);
      // Slight forward clavicle reach for extra comfort
      if (clvL && uArmL) aim(clvL, uArmL, rightW.clone().multiplyScalar(-0.92).addScaledVector(upW, -0.06).addScaledVector(fwdW, 0.28));
      if (clvR && uArmR) aim(clvR, uArmR, rightW.clone().multiplyScalar(0.92).addScaledVector(upW, -0.06).addScaledVector(fwdW, 0.28));
      gripTargets = buildGripTargets();
    }
  }

  // 7. Solve exact 2-Bone Arm IK + Orient Wrists + Curl all 5 Fingers around the Handlebar / Steering Rim!
  for (const g of gripTargets) {
    const u = bone(`upperarm_${g.side}`);
    const l = bone(`lowerarm_${g.side}`);
    const h = bone(`hand_${g.side}`);
    if (!u || !l || !h) continue;

    // Natural relaxed riding elbow pole: down, slightly back, slightly outward
    const elbowHint =
      kind === "moto"
        ? upW.clone().multiplyScalar(-0.82).addScaledVector(fwdW, -0.42).addScaledVector(rightW, g.sign * 0.32)
        : upW.clone().multiplyScalar(-0.88).addScaledVector(fwdW, -0.34).addScaledVector(rightW, g.sign * 0.24);

    solveTwoBoneIK(u, l, h, g.wristTarget, elbowHint);
    orientAndGripHand(obj, g.side, h, g.targetFwd, g.targetPinkyToIdx, g.targetPalmOut);
  }

  obj.updateMatrixWorld(true);
  return {
    root: crew,
    dispose() {
      crew.removeFromParent();
    },
  };
}

/**
 * Sign (+1/-1) to apply to `wheel.rotation.x` per unit of travel so each wheel rolls in the direction the vehicle
 * moves. Works from the wheel's own axle direction, so it is correct for left/right wheels and flipped models.
 */
export function wheelSpinSigns(host: T.Object3D, wheels: T.Object3D[], forwardLocal: T.Vector3): number[] {
  host.updateWorldMatrix(true, true);
  const hostInv = host.getWorldQuaternion(new T.Quaternion()).invert();
  return wheels.map((w) => {
    const parentQ = (w.parent ?? host).getWorldQuaternion(new T.Quaternion());
    const axle = new T.Vector3(1, 0, 0).applyQuaternion(parentQ).applyQuaternion(hostInv);
    const rolls = new T.Vector3().crossVectors(axle, UP);
    return rolls.dot(forwardLocal) >= 0 ? 1 : -1;
  });
}

/** World-size wheel radius of a wheel node (half its height). */
export function wheelRadius(wheel: T.Object3D, fallback: number): number {
  const size = new T.Box3().setFromObject(wheel, true).getSize(new T.Vector3());
  return size.y > 0.05 ? size.y / 2 : fallback;
}

/**
 * Make a moving vehicle drive "forward" (host-local `forward`), merge its body to a few draw calls and seat a
 * driver. Returns the vehicle node to use (it is wrapped in a flipped group when the model faced backwards).
 */
export async function equipVehicle(opts: {
  host: T.Object3D;
  vehicle: T.Object3D;
  kind: CrewKind;
  forward: T.Vector3;
  variant: number;
  isDisposed: () => boolean;
  withCrew?: boolean;
}): Promise<{ vehicle: T.Object3D; crew: CrewMember | null }> {
  const { host, kind, forward, variant, isDisposed } = opts;
  let vehicle = opts.vehicle;
  let seat = findSeat(host, vehicle, kind);
  if (seat && seat.forward.dot(forward) < 0 && vehicle.parent) {
    const parent = vehicle.parent;
    const flip = new T.Group();
    flip.rotation.y = Math.PI;
    parent.add(flip);
    flip.add(vehicle);
    vehicle = flip;
    seat = findSeat(host, vehicle, kind);
  }
  if (kind === "car") mergeVehicleBody(vehicle);
  let crew: CrewMember | null = null;
  if (seat && opts.withCrew !== false) crew = await addCrew(host, seat, kind, variant, isDisposed);
  return { vehicle, crew };
}

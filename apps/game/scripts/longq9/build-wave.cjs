'use strict';
/**
 * Rigs the yellow Thai Honda Wave scan that Long Q9 rides.
 *
 *   node apps/game/scripts/longq9/build-wave.cjs [--probe]      (run from the workspace root)
 *
 * Input:  apps/game/scripts/longq9/source/xelongq9.glb   one fused mesh (64k vertices), +X forward, wheel axle along Z
 * Output: apps/game/public/assets/testbus/ow/models/wave-longq9.optimized.glb
 *
 * The scan is one connected mesh, so the parts that move are split out by geometry (classifyVertex). The author's
 * transform is baked (rotation +90 degrees about X, uniform scale 1.62), the bike is turned to face +Z (+X becomes +Z)
 * and its ground sits at y = 0. The origin stays on the bike's centre line, 0.01 m from the middle of the wheelbase.
 *
 * Node hierarchy of the output (all parts share one material and texture):
 *   Wave_Root
 *     Wave_Chassis                     frame, engine, seat, basket, leg shield, rear fender, exhaust
 *     Wave_Steering                    handlebar, cowl, fork, front fender. Origin on the steering axis. Its rest rotation
 *                                      tilts local Y onto the axis; steer by rotating about local Y (rest * rotY(yaw)).
 *       Wave_FrontWheel                origin at the hub. Spin about local X.
 *       Wave_HeadLamp, Wave_SignalFL, Wave_SignalFR   lamp anchors that turn with the handlebar
 *     Wave_RearWheel                   origin at the hub. Spin about local X.
 *     Wave_Kickstand                   a rod on a hinge at the left side. Rotate about local X between the folded and
 *                                      the deployed angle given in its extras.
 *     Wave_TailLamp, Wave_SignalRL, Wave_SignalRR   lamp anchors on the rear of the frame
 *     Wave_Rider                       where the rider's origin goes (his feet on y = 0); the seat top is at SEAT_TOP_Y
 * Anchors carry their size in extras so the runtime does not hard-code guesses. The numbers below were measured on the
 * split geometry (run with --probe to print the extremes they come from).
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, weld, quantize, reorder, meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

const HERE = __dirname;
const SOURCE = path.join(HERE, "source/xelongq9.glb");
const OUTPUT = path.resolve(HERE, "../../public/assets/testbus/ow/models/wave-longq9.optimized.glb");
const MAX_OUTPUT_BYTES = 2_621_440;
const TEXTURE_SIZE = 1024;

/** Scale of the author's site (glbLoader.ts). */
const SCALE = 1.62;
/** Hubs in the final frame: [forward z, height y]. Measured on the scan after the author's transform. */
const FRONT_HUB = [0.6087, 0.2732], REAR_HUB = [-0.5877, 0.2616];
const FRONT_R = 0.284, REAR_R = 0.272;
/** Half width of the wheel tests. The tread reaches about 0.075 m from the centre line. */
const FRONT_HALF_W = 0.072, REAR_HALF_W = 0.07;
/** Steering axis: passes through STEER_TOP and the front hub. */
const STEER_TOP = [0.3, 0.97];
const SEAT_TOP_Y = 0.76;
/** The author's rider rule: Long's origin sits 0.16 m behind the bike origin. */
const RIDER_OFFSET_Z = -0.16;

const PARTS = { chassis: 0, steering: 1, front: 3, rear: 4 };

/** Kickstand: hinge on the left side (+X when facing +Z). Folded points back and slightly up, deployed reaches the ground. */
const KICK_HINGE = [0.27, 0.225, -0.1];
const KICK_FOLDED_DEG = 10, KICK_DEPLOYED_DEG = -75;
const KICK_RADIUS = 0.011;

const deg = (d) => (d * Math.PI) / 180;
const quatX = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];

/** Part of one vertex (final frame: x lateral, y up, z forward). */
function classifyVertex(x, y, z, axis) {
  const l = Math.abs(x);
  let c = PARTS.chassis;
  const rf = Math.hypot(z - FRONT_HUB[0], y - FRONT_HUB[1]);
  const rr = Math.hypot(z - REAR_HUB[0], y - REAR_HUB[1]);
  if (rf <= FRONT_R && l <= FRONT_HALF_W) {
    const ang = (Math.atan2(y - FRONT_HUB[1], z - FRONT_HUB[0]) * 180) / Math.PI;
    const fender = (ang > 35 && ang < 155 && rf > 0.256) || (ang > 65 && ang < 145 && l > 0.044 && rf > 0.06);
    c = fender ? PARTS.steering : PARTS.front;
  } else if (rr <= REAR_R && l <= REAR_HALF_W) {
    const ang = (Math.atan2(y - REAR_HUB[1], z - REAR_HUB[0]) * 180) / Math.PI;
    const fender = (ang > -15 && ang < 145 && rr > 0.246) || (ang > -25 && ang < 130 && l > 0.043 && rr > 0.06);
    c = fender ? PARTS.chassis : PARTS.rear;
  }
  if (c === PARTS.chassis || c === PARTS.steering) {
    const t = (z - STEER_TOP[0]) * axis.nrm[0] + (y - STEER_TOP[1]) * axis.nrm[1]; // distance in front of the axis
    c = y >= 0.97 || (y < 0.685 && z > 0.4 && t > -0.06) ? PARTS.steering : PARTS.chassis;
  }
  return c;
}

/** Triangle part: wheels need two vertices, otherwise the majority, chassis on a tie. */
function classifyTriangle(a, b, c) {
  const count = {};
  for (const k of [a, b, c]) count[k] = (count[k] || 0) + 1;
  for (const w of [PARTS.front, PARTS.rear]) if (count[w] >= 2) return w;
  return count[PARTS.steering] >= 2 ? PARTS.steering : PARTS.chassis;
}

function kickstandGeometry() {
  // A rod along -Z from the hinge, 8 sided, with a small foot block at the end.
  const length = KICK_HINGE[1] / Math.sin(deg(-KICK_DEPLOYED_DEG)) + 0.005;
  const sides = 8;
  const pos = [], nor = [], uv = [], idx = [];
  const ring = (z, r) => {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      pos.push(Math.cos(a) * r, Math.sin(a) * r, z);
      nor.push(Math.cos(a), Math.sin(a), 0);
      uv.push(0.5, 0.5);
    }
  };
  ring(0, KICK_RADIUS); ring(-length, KICK_RADIUS);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    idx.push(i, sides + i, j, j, sides + i, sides + j);
  }
  // End caps
  for (const [base, z, flip] of [[0, 0, true], [sides, -length, false]]) {
    const c = pos.length / 3;
    pos.push(0, 0, z); nor.push(0, 0, flip ? 1 : -1); uv.push(0.5, 0.5);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      idx.push(c, base + (flip ? j : i), base + (flip ? i : j));
    }
  }
  return { pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: Float32Array.from(uv), idx: Uint16Array.from(idx), length };
}

async function main() {
  const probe = process.argv.includes("--probe");
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const THREE = await import("three");
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(SOURCE);
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);

  const srcNode = root.listNodes().find((n) => n.getMesh());
  const srcMesh = srcNode.getMesh();
  const prim = srcMesh.listPrimitives()[0];
  const material = prim.getMaterial();
  const world = new THREE.Matrix4().compose(new THREE.Vector3(...srcNode.getTranslation()), new THREE.Quaternion(...srcNode.getRotation()), new THREE.Vector3(...srcNode.getScale()));
  // scale, then +X forward -> +Z forward (rotate -90 degrees about Y)
  const bake = new THREE.Matrix4().makeRotationY(-Math.PI / 2).multiply(new THREE.Matrix4().makeScale(SCALE, SCALE, SCALE)).multiply(world);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(bake);
  const posAttr = prim.getAttribute("POSITION"), norAttr = prim.getAttribute("NORMAL"), uvAttr = prim.getAttribute("TEXCOORD_0");
  const n = posAttr.getCount();
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2);
  const v = new THREE.Vector3();
  let minY = Infinity;
  for (let i = 0; i < n; i++) {
    v.fromArray(posAttr.getElement(i, [0, 0, 0])).applyMatrix4(bake).toArray(P, i * 3);
    minY = Math.min(minY, P[i * 3 + 1]);
    v.fromArray(norAttr.getElement(i, [0, 0, 0])).applyMatrix3(normalMatrix).normalize().toArray(N, i * 3);
    UV.set(uvAttr.getElement(i, [0, 0]), i * 2);
  }
  for (let i = 0; i < n; i++) P[i * 3 + 1] -= minY; // ground at y = 0
  const indices = prim.getIndices().getArray();

  // Steering axis in the (z, y) plane.
  const dz = FRONT_HUB[0] - STEER_TOP[0], dy = FRONT_HUB[1] - STEER_TOP[1], dl = Math.hypot(dz, dy);
  const axis = { dir: [dz / dl, dy / dl], nrm: [-dy / dl, dz / dl] };
  const tilt = Math.atan2(-dz, -dy); // angle of the upward axis from +Y, towards +Z
  const axisUp = [-dz / dl, -dy / dl]; // (z, y) pointing up the fork

  const cls = new Uint8Array(n);
  for (let i = 0; i < n; i++) cls[i] = classifyVertex(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], axis);

  // Frames: steering local = Rx(-tilt about X)^-1 * (p - pivot); the pivot is where the axis crosses y = STEER_TOP[1].
  const steerPivot = [0, STEER_TOP[1], STEER_TOP[0]];
  const steerAngle = -Math.atan2(-axisUp[0], axisUp[1]) * -1; // rotation about +X taking +Y onto the axis (z up-forward negative)
  // Rx(a) maps +Y to (0, cos a, sin a); the axis points up and backwards (z < 0 when going up), so a is negative.
  const a = Math.atan2(axisUp[0], axisUp[1]);
  const steerQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
  const steerInv = steerQ.clone().invert();
  void steerAngle; void tilt;

  const hubs = {
    chassis: [0, 0, 0], rear: [0, REAR_HUB[1], REAR_HUB[0]], steering: steerPivot, front: [0, FRONT_HUB[1], FRONT_HUB[0]],
  };
  const toLocal = { chassis: null, rear: null, steering: steerInv, front: steerInv };
  const nameOf = Object.fromEntries(Object.entries(PARTS).map(([k, val]) => [val, k]));
  const buckets = Object.fromEntries(Object.keys(PARTS).map((k) => [k, { map: new Map(), pos: [], nor: [], uv: [], idx: [] }]));
  const tmp = new THREE.Vector3();
  for (let t = 0; t < indices.length; t += 3) {
    const part = nameOf[classifyTriangle(cls[indices[t]], cls[indices[t + 1]], cls[indices[t + 2]])];
    const b = buckets[part];
    for (let k = 0; k < 3; k++) {
      const i = indices[t + k];
      let j = b.map.get(i);
      if (j === undefined) {
        j = b.pos.length / 3;
        b.map.set(i, j);
        tmp.set(P[i * 3] - hubs[part][0], P[i * 3 + 1] - hubs[part][1], P[i * 3 + 2] - hubs[part][2]);
        const nv = new THREE.Vector3(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
        if (toLocal[part]) { tmp.applyQuaternion(toLocal[part]); nv.applyQuaternion(toLocal[part]); }
        b.pos.push(tmp.x, tmp.y, tmp.z);
        b.nor.push(nv.x, nv.y, nv.z);
        b.uv.push(UV[i * 2], UV[i * 2 + 1]);
      }
      b.idx.push(j);
    }
  }

  const stats = Object.fromEntries(Object.entries(buckets).map(([k, b]) => [k, { tris: b.idx.length / 3, verts: b.pos.length / 3 }]));
  const totalTris = Object.values(stats).reduce((s, x) => s + x.tris, 0);
  console.log("parts:", JSON.stringify(stats), `total ${totalTris} of ${indices.length / 3} source triangles`);
  if (totalTris !== indices.length / 3) throw new Error("triangles were lost in the split");

  if (probe) {
    // Extremes of the final-frame geometry the anchors are measured on.
    const ext = (name, filter) => {
      let best = null;
      for (let i = 0; i < n; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        if (!filter(x, y, z, cls[i])) continue;
        if (!best) best = { minX: x, maxX: x, minY: y, maxY: y, minZ: z, maxZ: z };
        best.minX = Math.min(best.minX, x); best.maxX = Math.max(best.maxX, x); best.minY = Math.min(best.minY, y);
        best.maxY = Math.max(best.maxY, y); best.minZ = Math.min(best.minZ, z); best.maxZ = Math.max(best.maxZ, z);
      }
      console.log(name, best && Object.fromEntries(Object.entries(best).map(([k, val]) => [k, +val.toFixed(3)])));
    };
    ext("all", () => true);
    ext("chassis", (x, y, z, c) => c === PARTS.chassis);
    ext("steering", (x, y, z, c) => c === PARTS.steering);
    ext("steering y>0.75", (x, y, z, c) => c === PARTS.steering && y > 0.75);
    ext("steering y>0.97", (x, y, z, c) => c === PARTS.steering && y > 0.97);
    ext("front z>0.5 y 0.7..1.1 steering", (x, y, z, c) => c === PARTS.steering && z > 0.45 && y > 0.7);
    ext("rear z<-0.5 y>0.4 chassis", (x, y, z, c) => c === PARTS.chassis && z < -0.5 && y > 0.4);
    ext("rear z<-0.6 y>0.4", (x, y, z) => z < -0.6 && y > 0.4);
    ext("seat band y 0.6..0.9 z -0.5..0.1", (x, y, z, c) => c === PARTS.chassis && y > 0.6 && y < 0.9 && z > -0.5 && z < 0.1);
    ext("engine y<0.35 |z|<0.2", (x, y, z, c) => c === PARTS.chassis && y < 0.35 && z > -0.2 && z < 0.1);
    // Seat top: highest chassis point per z slice.
    for (let z0 = -0.6; z0 < 0.35; z0 += 0.1) {
      let hi = 0;
      for (let i = 0; i < n; i++) if (cls[i] === PARTS.chassis && Math.abs(P[i * 3]) < 0.05 && P[i * 3 + 2] >= z0 && P[i * 3 + 2] < z0 + 0.1) hi = Math.max(hi, P[i * 3 + 1]);
      console.log(`chassis top at z ${z0.toFixed(1)}..${(z0 + 0.1).toFixed(1)} on the centre line: ${hi.toFixed(3)}`);
    }
    return;
  }

  // Build the document.
  for (const m of srcMesh.listPrimitives()) m.dispose();
  srcNode.dispose();
  srcMesh.dispose();

  const makePrim = (pos, nor, uv, idx, mat) =>
    doc.createPrimitive()
      .setAttribute("POSITION", acc("VEC3", pos))
      .setAttribute("NORMAL", acc("VEC3", nor))
      .setAttribute("TEXCOORD_0", acc("VEC2", uv))
      .setIndices(acc("SCALAR", idx))
      .setMaterial(mat);
  const partMesh = (name) => {
    const b = buckets[name];
    const mesh = doc.createMesh(`Wave_${name[0].toUpperCase()}${name.slice(1)}`);
    mesh.addPrimitive(makePrim(Float32Array.from(b.pos), Float32Array.from(b.nor), Float32Array.from(b.uv), Uint32Array.from(b.idx), material));
    return mesh;
  };

  const metal = doc.createMaterial("Wave_DarkMetal").setBaseColorFactor([0.07, 0.07, 0.08, 1]).setMetallicFactor(0.6).setRoughnessFactor(0.45);
  const kick = kickstandGeometry();
  const kickMesh = doc.createMesh("Wave_KickstandRod").addPrimitive(makePrim(kick.pos, kick.nor, kick.uv, kick.idx, metal));

  const rootNode = doc.createNode("Wave_Root");
  // Moving parts are pivot nodes without a mesh; the mesh hangs on a child node. Quantization moves and scales the nodes
  // that carry a mesh, so keeping the pivots mesh-free leaves their positions and rotations exactly as measured.
  const withMesh = (pivot, name) => {
    pivot.addChild(doc.createNode(`${pivot.getName()}_Mesh`).setMesh(name ? partMesh(name) : kickMesh));
    return pivot;
  };
  const chassis = doc.createNode("Wave_Chassis").setMesh(partMesh("chassis"));
  const steering = withMesh(doc.createNode("Wave_Steering").setTranslation(steerPivot).setRotation(steerQ.toArray()), "steering");
  const frontLocal = new THREE.Vector3(0, FRONT_HUB[1] - steerPivot[1], FRONT_HUB[0] - steerPivot[2]).applyQuaternion(steerInv);
  const front = withMesh(doc.createNode("Wave_FrontWheel").setTranslation(frontLocal.toArray()), "front");
  const rear = withMesh(doc.createNode("Wave_RearWheel").setTranslation(hubs.rear), "rear");
  const kickNode = withMesh(doc.createNode("Wave_Kickstand").setTranslation(KICK_HINGE).setRotation(quatX(deg(KICK_FOLDED_DEG))), null);
  kickNode.setExtras({
    foldedDeg: KICK_FOLDED_DEG, deployedDeg: KICK_DEPLOYED_DEG, axis: "x", length: +kick.length.toFixed(3),
    note: "rotate about local X by the angle; positive swings the rod up and back, negative down to the ground",
  });
  steering.setExtras({ steerAxisTiltDeg: +((a * 180) / Math.PI).toFixed(2), note: "rest rotation tilts local Y onto the steering axis; yaw about local Y" });
  front.setExtras({ radius: FRONT_R, hub: [0, FRONT_HUB[1], FRONT_HUB[0]] });
  rear.setExtras({ radius: REAR_R, hub: [0, REAR_HUB[1], REAR_HUB[0]] });
  steering.addChild(front);

  rootNode.addChild(chassis).addChild(steering).addChild(rear).addChild(kickNode);
  const anchor = (name, parent, p, extras) => {
    const node = doc.createNode(name).setTranslation(p).setExtras(extras || {});
    parent.addChild(node);
    return node;
  };
  const inSteering = (p) => new THREE.Vector3(p[0] - steerPivot[0], p[1] - steerPivot[1], p[2] - steerPivot[2]).applyQuaternion(steerInv).toArray();
  const A = ANCHORS;
  anchor("Wave_HeadLamp", steering, inSteering(A.headLamp), { size: A.headLampSize, forward: [0, 0, 1] });
  anchor("Wave_SignalFL", steering, inSteering(A.signalFL), { size: A.signalSize });
  anchor("Wave_SignalFR", steering, inSteering(A.signalFR), { size: A.signalSize });
  anchor("Wave_TailLamp", rootNode, A.tailLamp, { size: A.tailLampSize, forward: [0, 0, -1] });
  anchor("Wave_SignalRL", rootNode, A.signalRL, { size: A.signalSize });
  anchor("Wave_SignalRR", rootNode, A.signalRR, { size: A.signalSize });
  anchor("Wave_Rider", rootNode, [0, 0, RIDER_OFFSET_Z], { seatTopY: SEAT_TOP_Y, note: "origin of the rider (feet on y = 0)" });
  rootNode.setExtras({ seatTopY: SEAT_TOP_Y, wheelBase: +(FRONT_HUB[0] - REAR_HUB[0]).toFixed(4), faces: "+Z" });

  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) scene.removeChild(child);
    scene.addChild(rootNode);
  }

  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const webp = await sharp(image).resize({ width: TEXTURE_SIZE, height: TEXTURE_SIZE, fit: "inside", withoutEnlargement: true }).webp({ quality: 88, effort: 4 }).toBuffer();
    texture.setImage(webp).setMimeType("image/webp");
  }
  await doc.transform(prune({ keepLeaves: true }), dedup(), weld({ tolerance: 0.0001 }), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  await io.write(OUTPUT, doc);
  const bytes = fs.statSync(OUTPUT).size;
  console.log(`wrote ${path.relative(process.cwd(), OUTPUT)}: ${(bytes / 1048576).toFixed(2)} MB`);
  if (bytes > MAX_OUTPUT_BYTES) throw new Error(`${bytes} bytes is above the ${MAX_OUTPUT_BYTES} byte limit`);
}

/** Lamp anchors in the final bike frame [x, y, z] (z forward), measured with --probe. */
const ANCHORS = {
  // On the cowl front (its surface is at z 0.41 for y = 1.0) and at the front corners of the cowl.
  headLamp: [0, 1.0, 0.41], headLampSize: [0.14, 0.09],
  signalFL: [0.11, 0.99, 0.4], signalFR: [-0.11, 0.99, 0.4], signalSize: [0.045, 0.03],
  // Rear end of the tail cowl on the centre line (z -0.847 at y 0.8) and its corners (z -0.84, x +-0.14 at y 0.75).
  tailLamp: [0, 0.8, -0.845], tailLampSize: [0.16, 0.05],
  signalRL: [0.13, 0.75, -0.835], signalRR: [-0.13, 0.75, -0.835],
};

main().catch((err) => {
  console.error("Wave build failed:", err);
  process.exit(1);
});

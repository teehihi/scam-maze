'use strict';
/**
 * Auto-rig for T-pose character scans (one unskinned mesh, no skeleton), used by optimize-characters.cjs.
 *
 * The street NPC skeleton (bone names, hierarchy) is rebuilt around the scan so the retargeting in
 * src/features/khupho/world/retarget.ts and the sit pose work unchanged:
 * 1. The Z-up scan is baked to Y-up (node transform), standing on y = 0, facing +Z, left = +X.
 * 2. The mesh is simplified with Meshoptimizer (UVs and normals count as attributes) to `triangles`.
 * 3. A skeleton is built from per-model landmarks (MODELS below, in meters at the source size). Every bone has an
 *    identity rest rotation, so a bone's world rest orientation is the world axes and T-pose clips apply directly.
 *    There are no finger bones: hands are rigid.
 * 4. Skin weights: inverse-distance falloff to each bone segment, normalized by a per-bone radius, with left/right
 *    masks, smoothed over the position-welded mesh graph (UV seams share weights), at most 4 influences per vertex.
 *
 * Landmarks were measured on the scans (slices of the mesh) and checked on overlay renders. A new scan needs its own entry.
 */
// Rig definitions (rest-pose joint positions in meters, +Y up, character faces +Z, character's left = +X) and auto skin weights.
const BONES = [ // [name, parent]
  ["Root", null], ["pelvis", "Root"],
  ["thigh_l", "pelvis"], ["calf_l", "thigh_l"], ["foot_l", "calf_l"], ["ball_l", "foot_l"],
  ["thigh_r", "pelvis"], ["calf_r", "thigh_r"], ["foot_r", "calf_r"], ["ball_r", "foot_r"],
  ["spine_01", "pelvis"], ["spine_02", "spine_01"], ["spine_03", "spine_02"],
  ["clavicle_l", "spine_03"], ["upperarm_l", "clavicle_l"], ["lowerarm_l", "upperarm_l"], ["hand_l", "lowerarm_l"],
  ["clavicle_r", "spine_03"], ["upperarm_r", "clavicle_r"], ["lowerarm_r", "upperarm_r"], ["hand_r", "lowerarm_r"],
  ["neck_01", "spine_03"], ["head", "neck_01"],
];
// Per-model landmarks (left side only for limbs; right is mirrored through x=0).
const MODELS = {
  linh: {
    H: 1.154,
    // Shoulders: both sides move `narrow` m toward the body and the arms shrink around their axis by `slim` (0..1) before rigging.
    shoulders: { narrow: 0.012, slim: 0.14 },
    pelvis: [0, 0.555, 0], spine_01: [0, 0.62, 0], spine_02: [0, 0.72, 0.0], spine_03: [0, 0.82, 0], neck_01: [0, 0.93, -0.005], head: [0, 0.985, 0.005], headTop: [0, 1.154, 0.01],
    clavicle: [0.025, 0.895, 0.0], shoulder: [0.10, 0.912, -0.015], elbow: [0.26, 0.911, -0.016], wrist: [0.40, 0.899, -0.012], handTip: [0.517, 0.885, 0.0],
    hip: [0.052, 0.55, 0.0], knee: [0.057, 0.32, -0.02], ankle: [0.05, 0.10, -0.018], ball: [0.05, 0.03, 0.07], toeTip: [0.05, 0.02, 0.119],
    r: { torsoLow: 0.09, torso: 0.085, neck: 0.04, head: 0.085, clavicle: 0.035, upperarm: 0.03, lowerarm: 0.026, hand: 0.026, thigh: 0.055, calf: 0.04, foot: 0.04, ball: 0.035 },
  },
  minh: {
    H: 1.164,
    pelvis: [0, 0.50, 0], spine_01: [0, 0.60, 0], spine_02: [0, 0.70, 0.005], spine_03: [0, 0.80, 0.005], neck_01: [0, 0.935, -0.005], head: [0, 0.99, 0.005], headTop: [0, 1.164, 0.015],
    clavicle: [0.03, 0.895, -0.005], shoulder: [0.115, 0.895, -0.03], elbow: [0.27, 0.893, -0.032], wrist: [0.36, 0.878, -0.032], handTip: [0.455, 0.844, -0.035],
    hip: [0.058, 0.50, 0.0], knee: [0.067, 0.28, -0.012], ankle: [0.07, 0.075, -0.015], ball: [0.07, 0.03, 0.07], toeTip: [0.07, 0.02, 0.128],
    r: { torsoLow: 0.115, torso: 0.11, neck: 0.045, head: 0.085, clavicle: 0.04, upperarm: 0.035, lowerarm: 0.03, hand: 0.03, thigh: 0.06, calf: 0.045, foot: 0.045, ball: 0.04 },
  },
};
const mir = (p) => [-p[0], p[1], p[2]];
function joints(m) {
  const J = {};
  for (const k of ["pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"]) J[k] = m[k];
  J.Root = [0, 0, 0];
  for (const [s, f] of [["l", (p) => p], ["r", mir]]) {
    J[`clavicle_${s}`] = f(m.clavicle); J[`upperarm_${s}`] = f(m.shoulder); J[`lowerarm_${s}`] = f(m.elbow); J[`hand_${s}`] = f(m.wrist);
    J[`thigh_${s}`] = f(m.hip); J[`calf_${s}`] = f(m.knee); J[`foot_${s}`] = f(m.ankle); J[`ball_${s}`] = f(m.ball);
  }
  J.ends = { head: m.headTop, hand_l: m.handTip, hand_r: mir(m.handTip), ball_l: m.toeTip, ball_r: mir(m.toeTip) };
  return J;
}
// Deforming bones with their segment (a -> b) and radius.
function segments(m, J) {
  const r = m.r, S = [];
  const add = (name, a, b, rad) => S.push({ name, a, b, r: rad });
  add("pelvis", J.pelvis, J.spine_01, r.torsoLow);
  add("spine_01", J.spine_01, J.spine_02, r.torsoLow * 0.5 + r.torso * 0.5);
  add("spine_02", J.spine_02, J.spine_03, r.torso);
  add("spine_03", J.spine_03, J.neck_01, r.torso);
  add("neck_01", J.neck_01, J.head, r.neck);
  add("head", J.head, J.ends.head, r.head);
  for (const s of ["l", "r"]) {
    add(`clavicle_${s}`, J[`clavicle_${s}`], J[`upperarm_${s}`], r.clavicle);
    add(`upperarm_${s}`, J[`upperarm_${s}`], J[`lowerarm_${s}`], r.upperarm);
    add(`lowerarm_${s}`, J[`lowerarm_${s}`], J[`hand_${s}`], r.lowerarm);
    add(`hand_${s}`, J[`hand_${s}`], J.ends[`hand_${s}`], r.hand);
    add(`thigh_${s}`, J[`thigh_${s}`], J[`calf_${s}`], r.thigh);
    add(`calf_${s}`, J[`calf_${s}`], J[`foot_${s}`], r.calf);
    add(`foot_${s}`, J[`foot_${s}`], J[`ball_${s}`], r.foot);
    add(`ball_${s}`, J[`ball_${s}`], J.ends[`ball_${s}`], r.ball);
  }
  return S;
}
function segDist(p, a, b) {
  const abx = b[0]-a[0], aby = b[1]-a[1], abz = b[2]-a[2];
  const apx = p[0]-a[0], apy = p[1]-a[1], apz = p[2]-a[2];
  const L2 = abx*abx + aby*aby + abz*abz;
  let t = L2 > 0 ? (apx*abx + apy*aby + apz*abz) / L2 : 0; t = Math.max(0, Math.min(1, t));
  const dx = apx - abx*t, dy = apy - aby*t, dz = apz - abz*t;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * Skin weights: normalized-distance falloff to every bone segment, left/right masks, then
 * smoothing over the welded-by-position mesh graph so UV seams stay closed. Returns {boneNames, joints:Uint16Array(4n), weights:Float32Array(4n)}.
 */
function skin(m, mesh, opts = {}) {
  const { pos, idx } = mesh, n = pos.length / 3;
  const J = joints(m), S = segments(m, J);
  const nb = S.length, POW = opts.pow ?? 4, ITER = opts.iter ?? 4;
  // canonical id per position
  const key = new Map(), canon = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = `${Math.round(pos[i*3]*1e5)},${Math.round(pos[i*3+1]*1e5)},${Math.round(pos[i*3+2]*1e5)}`; let c = key.get(k); if (c === undefined) { c = key.size; key.set(k, c); } canon[i] = c; }
  const nc = key.size;
  const cpos = new Float32Array(nc * 3); for (let i = 0; i < n; i++) cpos.set([pos[i*3], pos[i*3+1], pos[i*3+2]], canon[i] * 3);
  let W = new Float32Array(nc * nb);
  const sideOf = (name) => name.endsWith("_l") ? 1 : name.endsWith("_r") ? -1 : 0;
  const lowerLimb = /^(thigh|calf|foot|ball)_/;
  for (let c = 0; c < nc; c++) {
    const p = [cpos[c*3], cpos[c*3+1], cpos[c*3+2]];
    let sum = 0;
    for (let b = 0; b < nb; b++) {
      const s = S[b]; let mask = 1; const sd = sideOf(s.name);
      if (sd) {
        // legs: hard-ish split at x=0; arms: only beyond the midline
        mask = lowerLimb.test(s.name) ? smooth(-0.002, 0.002, p[0] * sd) : smooth(-0.03, 0.0, p[0] * sd);
      }
      // Everything below the ankle (heel, sole, toes) belongs to the foot and toes, never to the shin.
      if (/^calf_/.test(s.name)) mask *= smooth(J[s.name.replace("calf", "foot")][1] - 0.025, J[s.name.replace("calf", "foot")][1] + 0.01, p[1]);
      const q = segDist(p, s.a, s.b) / s.r;
      const w = mask / (Math.pow(q, POW) + 1e-4);
      W[c * nb + b] = w; sum += w;
    }
    for (let b = 0; b < nb; b++) W[c * nb + b] /= sum;
  }
  // adjacency on canonical ids
  const adj = Array.from({ length: nc }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = canon[idx[t+k]], b = canon[idx[t+(k+1)%3]]; if (a !== b) { adj[a].add(b); adj[b].add(a); } }
  for (let it = 0; it < ITER; it++) {
    const N = new Float32Array(W.length);
    for (let c = 0; c < nc; c++) {
      const nbrs = [...adj[c]]; const lam = 0.6;
      for (let b = 0; b < nb; b++) {
        let a = 0; for (const o of nbrs) a += W[o * nb + b];
        N[c * nb + b] = nbrs.length ? W[c * nb + b] * (1 - lam) + (a / nbrs.length) * lam : W[c * nb + b];
      }
    }
    W = N;
  }
  // keep top 4, normalize
  const joints_ = new Uint16Array(n * 4), weights = new Float32Array(n * 4);
  const boneIndex = S.map((s) => s.name);
  for (let i = 0; i < n; i++) {
    const c = canon[i]; const arr = [];
    for (let b = 0; b < nb; b++) arr.push([b, W[c * nb + b]]);
    arr.sort((x, y) => y[1] - x[1]);
    let sum = 0; for (let k = 0; k < 4; k++) sum += arr[k][1];
    for (let k = 0; k < 4; k++) { joints_[i*4+k] = arr[k][0]; weights[i*4+k] = arr[k][1] / sum; }
  }
  return { boneNames: boneIndex, joints: joints_, weights, J, S };
}


const smoothstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * Narrows the shoulders of a T-pose scan: the arm joints and arm vertices move `narrow` m toward the body (the shoulder cap
 * blends over x = 0.05..0.13), and the arms shrink around their axis (`slim`, strongest on the upper arm). Mutates `mesh.pos` and
 * returns the landmark warp for the model's own joint positions.
 */
function warpShoulders(m, mesh) {
  const { narrow, slim } = m.shoulders;
  const yMask = (ax, y) => smoothstep(0.80, 0.88, y) * (1 - smoothstep(0.93, 0.97, y) * (1 - smoothstep(0.10, 0.14, ax)));
  const shiftX = (ax, y) => narrow * smoothstep(0.05, 0.13, ax) * yMask(ax, y);
  // Arm axis (y, z) at |x| from the landmarks.
  const axis = [[m.shoulder[0], m.shoulder], [m.elbow[0], m.elbow], [m.wrist[0], m.wrist], [m.handTip[0], m.handTip]];
  const axisAt = (ax) => {
    if (ax <= axis[0][0]) return [axis[0][1][1], axis[0][1][2]];
    for (let i = 1; i < axis.length; i++) if (ax <= axis[i][0]) { const t = (ax - axis[i-1][0]) / (axis[i][0] - axis[i-1][0]); return [axis[i-1][1][1] + t * (axis[i][1][1] - axis[i-1][1][1]), axis[i-1][1][2] + t * (axis[i][1][2] - axis[i-1][1][2])]; }
    return [axis[3][1][1], axis[3][1][2]];
  };
  const P = mesh.pos;
  for (let i = 0; i < P.length; i += 3) {
    const ax = Math.abs(P[i]), sign = P[i] < 0 ? -1 : 1;
    if (ax > 0.07 && P[i+1] > 0.84 && P[i+1] < 1.0) {
      const [ay, az] = axisAt(ax);
      const f = 1 - slim * smoothstep(0.07, 0.12, ax) * (1 - smoothstep(m.wrist[0] - 0.08, m.wrist[0], ax));
      // Only vertices near the arm axis (not hair or the head) shrink.
      if (Math.abs(P[i+1] - ay) < 0.07 && Math.abs(P[i+2] - az) < 0.07) { P[i+1] = ay + (P[i+1] - ay) * f; P[i+2] = az + (P[i+2] - az) * f; }
    }
    P[i] = sign * (ax - shiftX(ax, P[i+1]));
  }
  const landmark = (p) => [Math.sign(p[0] || 1) * (Math.abs(p[0]) - shiftX(Math.abs(p[0]), p[1])), p[1], p[2]];
  return { ...m, clavicle: landmark(m.clavicle), shoulder: landmark(m.shoulder), elbow: landmark(m.elbow), wrist: landmark(m.wrist), handTip: landmark(m.handTip) };
}

/** Z-up/node-baked, simplified, position-welded-safe mesh from the scan's only primitive. */
function simplifyScan(MeshoptSimplifier, node, prim, triangles) {
  const pos = prim.getAttribute("POSITION").getArray(), nor = prim.getAttribute("NORMAL").getArray(), uv = prim.getAttribute("TEXCOORD_0").getArray();
  const m = node.getWorldMatrix(), n = pos.length / 3;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos[i*3], y = pos[i*3+1], z = pos[i*3+2], a = nor[i*3], b = nor[i*3+1], c = nor[i*3+2];
    for (let k = 0; k < 3; k++) { P[i*3+k] = m[k]*x + m[4+k]*y + m[8+k]*z + m[12+k]; N[i*3+k] = m[k]*a + m[4+k]*b + m[8+k]*c; }
  }
  const attrs = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) attrs.set([uv[i*2], uv[i*2+1], N[i*3], N[i*3+1], N[i*3+2]], i * 5);
  const [simp] = MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(prim.getIndices().getArray()), P, 3, attrs, 5, [1, 1, 0.5, 0.5, 0.5], null, triangles * 3, 0.05, []);
  const remap = new Int32Array(n).fill(-1), keep = [];
  for (const i of simp) if (remap[i] < 0) { remap[i] = keep.length; keep.push(i); }
  const k = keep.length, out = { pos: new Float32Array(k * 3), nor: new Float32Array(k * 3), uv: new Float32Array(k * 2), idx: Uint32Array.from(simp, (i) => remap[i]) };
  keep.forEach((i, j) => { out.pos.set(P.subarray(i*3, i*3+3), j*3); out.nor.set(N.subarray(i*3, i*3+3), j*3); out.uv.set(uv.subarray(i*2, i*2+2), j*2); });
  return out;
}

/**
 * Scans can fuse the two feet (Linh's slippers touch at x = 0), which would stretch a sheet between them as soon as one
 * foot moves. Every low triangle that crosses x = 0 keeps the side of the majority of its vertices; the other vertices
 * are copied onto that side (x = +-INSET). Mutates and returns `mesh`.
 */
function separateFeet(mesh, maxY, inset = 0.003) {
  const { pos, nor, uv, idx } = mesh;
  const extra = { pos: [], nor: [], uv: [] }, copies = new Map();
  let fixed = 0, n = pos.length / 3;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t+1], idx[t+2]];
    if (v.some((i) => pos[i*3+1] > maxY)) continue;
    const side = v.map((i) => (pos[i*3] > 0 ? 1 : -1));
    const sum = side[0] + side[1] + side[2];
    if (Math.abs(sum) === 3) continue;
    const want = sum > 0 ? 1 : -1;
    v.forEach((i, k) => {
      if (side[k] === want) return;
      const key = `${i}:${want}`; let c = copies.get(key);
      if (c === undefined) {
        c = n++; copies.set(key, c);
        extra.pos.push(want * inset, pos[i*3+1], pos[i*3+2]); extra.nor.push(nor[i*3], nor[i*3+1], nor[i*3+2]); extra.uv.push(uv[i*2], uv[i*2+1]);
      }
      idx[t + k] = c;
    });
    fixed++;
  }
  const cat = (a, b) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
  mesh.pos = cat(pos, extra.pos); mesh.nor = cat(nor, extra.nor); mesh.uv = cat(uv, extra.uv);
  return fixed;
}

/**
 * Turns the scan document into a skinned character: replaces the mesh with the simplified one, adds the skeleton and
 * the skin weights. `doc` must hold one scene node with one mesh and one primitive. Returns a log line.
 */
function rigScan(doc, MeshoptSimplifier, modelId, triangles) {
  let model = MODELS[modelId];
  if (!model) throw new Error(`rig-tpose: no landmarks for "${modelId}"`);
  const root = doc.getRoot();
  const node = root.listNodes().find((n) => n.getMesh());
  const prim = node.getMesh().listPrimitives()[0];
  const mesh = simplifyScan(MeshoptSimplifier, node, prim, triangles);
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < mesh.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], mesh.pos[i+k]); max[k] = Math.max(max[k], mesh.pos[i+k]); }
  if (Math.abs(min[1]) > 0.01 || Math.abs(max[1] - model.H) > 0.01) throw new Error(`rig-tpose: ${modelId} spans y ${min[1].toFixed(3)}..${max[1].toFixed(3)}, landmarks expect 0..${model.H}`);
  if (model.shoulders) model = warpShoulders(model, mesh);
  const fusedFeet = separateFeet(mesh, 0.14);
  const sk = skin(model, mesh);

  const buffer = root.listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  for (const semantic of prim.listSemantics()) { const a = prim.getAttribute(semantic); prim.setAttribute(semantic, null); if (a.listParents().every((p) => p.propertyType === "Root")) a.dispose(); }
  const oldIdx = prim.getIndices(); prim.setIndices(null); oldIdx.dispose();
  prim.setAttribute("POSITION", acc("VEC3", mesh.pos)).setAttribute("NORMAL", acc("VEC3", mesh.nor)).setAttribute("TEXCOORD_0", acc("VEC2", mesh.uv))
    .setAttribute("JOINTS_0", acc("VEC4", boneIds(sk))).setAttribute("WEIGHTS_0", acc("VEC4", sk.weights)).setIndices(acc("SCALAR", mesh.idx));

  // Skeleton: identity rotations, so local translation = world position - parent's.
  const joint = {};
  const bones = BONES.map(([name, parent]) => {
    const n = doc.createNode(name); joint[name] = n;
    const w = sk.J[name], pw = parent ? sk.J[parent] : [0, 0, 0];
    n.setTranslation([w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]]);
    if (parent) joint[parent].addChild(n);
    return name;
  });
  const ibm = new Float32Array(bones.length * 16);
  bones.forEach((name, i) => { ibm.set([1,0,0,0, 0,1,0,0, 0,0,1,0, -sk.J[name][0], -sk.J[name][1], -sk.J[name][2], 1], i * 16); });
  const skinObj = doc.createSkin("Armature").setInverseBindMatrices(acc("MAT4", ibm)).setSkeleton(joint.Root);
  for (const name of bones) skinObj.addJoint(joint[name]);
  node.setRotation([0, 0, 0, 1]).setTranslation([0, 0, 0]).setScale([1, 1, 1]).setSkin(skinObj);
  const scene = root.listScenes()[0];
  scene.addChild(joint.Root);
  return `rigged: ${bones.length} bones, ${mesh.idx.length / 3} triangles${fusedFeet ? `, ${fusedFeet} fused foot triangles split` : ""}`;
}

/** JOINTS_0 values: indices into the skin's joint list (BONES order). */
function boneIds(sk) {
  const index = new Map(BONES.map(([name], i) => [name, i]));
  return Uint16Array.from(sk.joints, (j) => index.get(sk.boneNames[j]));
}

module.exports = { BONES, MODELS, joints, segments, skin, rigScan };

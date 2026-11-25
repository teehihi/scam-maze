'use strict';
/**
 * Builds the rigged, animated Long Q9 for the Saigon open world.
 *
 *   node apps/game/scripts/longq9/build-longq9.cjs [--preview <dir>]      (run from the workspace root)
 *
 * Input:  apps/game/scripts/longq9/source/longq9.glb     the author's original static T-pose scan (one mesh, no rig)
 * Output: apps/game/public/assets/testbus/ow/models/longq9.optimized.glb
 *
 * The rig and every pose come from the author's own web project (three/autoRigLong.ts, copied verbatim):
 *   1. The scan is baked the way the project's glbLoader.ts does it: node transform, uniform scale 1.48 (1.704 m
 *      tall), standing on y = 0, facing +Z.
 *   2. createRiggedChuLong() builds the 17-bone humanoid and its skin weights.
 *   3. applyPose() is sampled into AnimationClips (bone rotations, pelvis translation). The author's poses crouch_tire,
 *      sit_wrench and thumbs_up are used as they are. The project has no walk, so Walk is authored here with plain
 *      forward kinematics on the same bones.
 *   4. The glTF is written with gltf-transform, then optimized like the other characters (optimize-characters.cjs).
 *
 * The pose code is TypeScript; it is transpiled in memory with the workspace's TypeScript and written to .build/
 * (git-ignored), so no extra tool is needed.
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const ts = require("typescript");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, weld, resample, quantize, reorder, meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

const HERE = __dirname;
const SOURCE = path.join(HERE, "source/longq9.glb");
const OUTPUT = path.resolve(HERE, "../../public/assets/testbus/ow/models/longq9.optimized.glb");
const BUILD_DIR = path.join(HERE, ".build");
const MAX_OUTPUT_BYTES = 2_097_152;

/** Uniform scale used by the author's glbLoader.ts (LONG_SCALE). */
const LONG_SCALE = 1.48;
/** Frames per second of the baked clips. */
const FPS = 24;
/** Seconds over which a looping clip eases back into its first frame. */
const LOOP_BLEND = 1;
const TEXTURE_SIZE = 1024;

/** Clips baked into the file. The game picks them by name (src/features/testbus/openworld/simulation/longQ9.ts). */
const CLIPS = [
  { name: "Walk", seconds: 1.1, pose: "walk", blend: false },
  { name: "Crouch_Tire", seconds: 9, pose: "crouch_tire", blend: true },
  { name: "Sit_Wrench", seconds: 9, pose: "sit_wrench", blend: true },
  { name: "Thumbs_Up", seconds: 4, pose: "thumbs_up", blend: true },
];

const DEFAULT_ADJUSTMENTS = {
  spineLean: 0, headYaw: 0, headPitch: 0, armLForward: 0, armLLift: 0, armRForward: 0, armRLift: 0, squatDepth: 0, bodyTurn: 0,
};

/** Transpiles the author's TypeScript to an ES module next to this script and imports it. */
async function loadRigModule() {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  const src = fs.readFileSync(path.join(HERE, "three/autoRigLong.ts"), "utf8");
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const file = path.join(BUILD_DIR, "autoRigLong.mjs");
  fs.writeFileSync(file, out.outputText);
  return import(pathToFileURL(file).href);
}

/** Reads the scan's single triangle primitive as flat arrays, baked like glbLoader.ts (cloneToPlainBufferGeometry). */
function bakeScan(THREE, doc) {
  const root = doc.getRoot();
  const node = root.listNodes().find((n) => n.getMesh());
  const prim = node.getMesh().listPrimitives()[0];
  const q = node.getRotation(), t = node.getTranslation(), s = node.getScale();
  const world = new THREE.Matrix4().compose(new THREE.Vector3(...t), new THREE.Quaternion(...q), new THREE.Vector3(...s));
  const bake = new THREE.Matrix4().makeScale(LONG_SCALE, LONG_SCALE, LONG_SCALE).multiply(world);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(bake);
  const pos = prim.getAttribute("POSITION"), nor = prim.getAttribute("NORMAL"), uv = prim.getAttribute("TEXCOORD_0");
  const count = pos.getCount();
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uvs = new Float32Array(count * 2);
  const v = new THREE.Vector3();
  let minY = Infinity;
  for (let i = 0; i < count; i++) {
    v.fromArray(pos.getElement(i, [0, 0, 0])).applyMatrix4(bake);
    v.toArray(positions, i * 3);
    minY = Math.min(minY, v.y);
    v.fromArray(nor.getElement(i, [0, 0, 0])).applyMatrix3(normalMatrix).normalize().toArray(normals, i * 3);
    uvs.set(uv.getElement(i, [0, 0]), i * 2);
  }
  for (let i = 0; i < count; i++) positions[i * 3 + 1] -= minY;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(prim.getIndices().getArray()), 1));
  return { geometry, node, prim };
}

/** Walk cycle on the rig's own bones: every bone rests with an identity rotation, so rotations are about the world axes. */
function applyWalk(THREE, rig, phase) {
  const b = Object.fromEntries(rig.bones.map((bone) => [bone.name, bone]));
  const P = phase * Math.PI * 2;
  const s = Math.sin(P), c = Math.cos(P);
  rig.applyPose("t_pose", 0, DEFAULT_ADJUSTMENTS, false); // identity rotations, pelvis at its bind height
  const rx = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
  const rz = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
  const ry = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);

  // The pelvis dips when both legs are angled (twice per cycle) and rocks a little side to side.
  b.Pelvis.position.y = 0.777 - 0.03 + 0.03 * Math.cos(2 * P);
  b.Pelvis.position.x = 0.012 * s;
  b.Pelvis.quaternion.copy(ry(0.08 * s)).multiply(rz(0.025 * s));
  b.Spine.quaternion.copy(ry(-0.07 * s)).multiply(rx(0.03));
  b.Chest.quaternion.copy(ry(-0.06 * s));
  b.Head.quaternion.copy(ry(0.1 * s));

  // Legs: a negative rotation about +X swings a hanging limb forward (+Z). The knee bends while the leg swings forward.
  const leg = (thigh, shin, foot, ph) => {
    const sp = Math.sin(ph), cp = Math.cos(ph);
    const hip = -0.4 * sp;
    const knee = 0.12 + 0.75 * Math.max(0, cp) * Math.max(0, cp);
    b[thigh].quaternion.copy(rx(hip));
    b[shin].quaternion.copy(rx(knee));
    b[foot].quaternion.copy(rx(-(hip + knee) * 0.85));
  };
  leg("Thigh_L", "Shin_L", "Foot_L", P);
  leg("Thigh_R", "Shin_R", "Foot_R", P + Math.PI);

  // Arms hang down (T-pose arm turned about Z), swing against the legs, with a relaxed elbow.
  const arm = (upper, fore, side, ph) => {
    const swing = 0.32 * Math.sin(ph + Math.PI);
    const hang = rz(side * (-Math.PI / 2 + 0.16));
    b[upper].quaternion.copy(rx(swing)).multiply(hang);
    // Elbow bend about the world X axis, expressed in the upper arm's local frame.
    const parent = b[upper].quaternion.clone();
    const bend = rx(-(0.28 + 0.22 * Math.max(0, Math.sin(ph))));
    b[fore].quaternion.copy(parent.clone().invert()).multiply(bend).multiply(parent);
  };
  arm("UpperArm_L", "ForeArm_L", 1, P);
  arm("UpperArm_R", "ForeArm_R", -1, P + Math.PI);
  rig.skinnedMesh.updateMatrixWorld(true);
}

/** Samples the bone pose at time t (seconds) into plain arrays: one [x,y,z] and 17 quaternions. */
function samplePose(THREE, rig, clip, t) {
  const pose = (time) => {
    if (clip.pose === "walk") applyWalk(THREE, rig, time / clip.seconds);
    else rig.applyPose(clip.pose, time, DEFAULT_ADJUSTMENTS, true);
    return {
      pelvis: rig.bones[0].position.clone(),
      quats: rig.bones.map((bone) => bone.quaternion.clone()),
    };
  };
  const a = pose(t);
  // A looping clip eases from the sample at t to the sample at t - duration, so its last frame equals its first.
  if (clip.blend && t > clip.seconds - LOOP_BLEND) {
    const k = (t - (clip.seconds - LOOP_BLEND)) / LOOP_BLEND;
    const w = k * k * (3 - 2 * k);
    const b = pose(t - clip.seconds);
    a.pelvis.lerp(b.pelvis, w);
    a.quats = a.quats.map((q, i) => q.slerp(b.quats[i], w));
  }
  return a;
}

function bakeClips(THREE, rig) {
  const out = [];
  for (const clip of CLIPS) {
    const frames = Math.round(clip.seconds * FPS);
    const times = new Float32Array(frames + 1);
    const rot = rig.bones.map(() => new Float32Array((frames + 1) * 4));
    const pelvis = new Float32Array((frames + 1) * 3);
    const prev = rig.bones.map(() => null);
    for (let f = 0; f <= frames; f++) {
      const time = (f / frames) * clip.seconds;
      times[f] = time;
      const sample = samplePose(THREE, rig, clip, time);
      sample.pelvis.toArray(pelvis, f * 3);
      sample.quats.forEach((q, i) => {
        if (prev[i] && prev[i].dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); // keep the shortest path between keys
        prev[i] = q.clone();
        q.toArray(rot[i], f * 4);
      });
    }
    out.push({ name: clip.name, times, rot, pelvis });
  }
  return out;
}

/** Writes the skinned mesh and the animations into the source document, replacing the static mesh. */
function writeRig(THREE, doc, rig, scan, clips) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const geo = rig.skinnedMesh.geometry;
  const prim = scan.prim;
  prim.setAttribute("POSITION", acc("VEC3", geo.getAttribute("position").array));
  prim.setAttribute("NORMAL", acc("VEC3", geo.getAttribute("normal").array));
  prim.setAttribute("TEXCOORD_0", acc("VEC2", geo.getAttribute("uv").array));
  prim.setAttribute("JOINTS_0", acc("VEC4", Uint16Array.from(geo.getAttribute("skinIndex").array)));
  prim.setAttribute("WEIGHTS_0", acc("VEC4", Float32Array.from(geo.getAttribute("skinWeight").array)));
  prim.setIndices(acc("SCALAR", geo.index.array));

  const meshNode = scan.node;
  meshNode.setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setTranslation([0, 0, 0]).setName("LongQ9_Mesh");
  const mesh = meshNode.getMesh().setName("LongQ9");

  const joints = rig.skeleton.bones.map((bone) => {
    const node = doc.createNode(bone.name).setTranslation(bone.position.toArray()).setRotation(bone.quaternion.toArray());
    return node;
  });
  rig.skeleton.bones.forEach((bone, i) => {
    const parentIndex = rig.skeleton.bones.indexOf(bone.parent);
    if (parentIndex >= 0) joints[parentIndex].addChild(joints[i]);
  });

  const ibm = new Float32Array(joints.length * 16);
  rig.skeleton.boneInverses.forEach((m, i) => m.toArray(ibm, i * 16));
  const skin = doc.createSkin("LongQ9_Skin").setInverseBindMatrices(acc("MAT4", ibm)).setSkeleton(joints[0]);
  joints.forEach((j) => skin.addJoint(j));
  meshNode.setSkin(skin);

  const top = doc.createNode("LongQ9").addChild(meshNode).addChild(joints[0]);
  for (const scene of root.listScenes()) {
    for (const child of scene.listChildren()) scene.removeChild(child);
    scene.addChild(top);
  }

  for (const clip of clips) {
    const anim = doc.createAnimation(clip.name);
    const input = acc("SCALAR", clip.times);
    const add = (node, path, type, array) => {
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(acc(type, array)).setInterpolation("LINEAR");
      const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler);
      anim.addSampler(sampler).addChannel(channel);
    };
    joints.forEach((node, i) => add(node, "rotation", "VEC4", clip.rot[i]));
    add(joints[0], "translation", "VEC3", clip.pelvis);
  }
  return mesh;
}

/** Height of the lowest skinned vertex above y = 0 and the horizontal reach, for one pose. */
function poseExtent(THREE, rig) {
  rig.skinnedMesh.skeleton.update();
  const v = new THREE.Vector3();
  let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const count = rig.skinnedMesh.geometry.getAttribute("position").count;
  for (let i = 0; i < count; i += 7) {
    rig.skinnedMesh.getVertexPosition(i, v);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }
  return { minY, maxY, minZ, maxZ };
}

/** Side-view silhouettes of every clip (sampled every quarter) as PNG files, a quick check without a browser. */
async function writePreviews(THREE, rig, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const W = 260, H = 360, S = 190;
  for (const clip of CLIPS) {
    const cells = 4;
    const img = Buffer.alloc(W * cells * H * 3, 24);
    for (let c = 0; c < cells; c++) {
      const t = (c / cells) * clip.seconds;
      if (clip.pose === "walk") applyWalk(THREE, rig, t / clip.seconds);
      else rig.applyPose(clip.pose, t, DEFAULT_ADJUSTMENTS, true);
      rig.skinnedMesh.skeleton.update();
      const v = new THREE.Vector3();
      const n = rig.skinnedMesh.geometry.getAttribute("position").count;
      for (let i = 0; i < n; i += 2) {
        rig.skinnedMesh.getVertexPosition(i, v);
        const px = Math.round(c * W + W / 2 + v.z * S), py = Math.round(H - 20 - v.y * S);
        if (px < c * W || px >= (c + 1) * W || py < 0 || py >= H) continue;
        const o = (py * W * cells + px) * 3;
        img[o] = 230; img[o + 1] = 200; img[o + 2] = 150;
      }
      for (let x = c * W; x < (c + 1) * W; x++) { const o = ((H - 20) * W * cells + x) * 3; img[o] = 80; img[o + 1] = 200; img[o + 2] = 80; }
    }
    await sharp(img, { raw: { width: W * cells, height: H, channels: 3 } }).png().toFile(path.join(dir, `${clip.name}.png`));
  }
}

async function main() {
  const previewIndex = process.argv.indexOf("--preview");
  const previewDir = previewIndex >= 0 ? path.resolve(process.argv[previewIndex + 1]) : null;
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const THREE = await import("three");
  const { createRiggedChuLong } = await loadRigModule();
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(SOURCE);
  const root = doc.getRoot();

  const scan = bakeScan(THREE, doc);
  const material = new THREE.MeshStandardMaterial();
  const rig = createRiggedChuLong(scan.geometry, material);
  console.log(`rig: ${rig.skeleton.bones.length} bones, ${scan.geometry.getAttribute("position").count.toLocaleString("en-US")} vertices`);

  // The author's material tweak (glbLoader.ts): not too glossy, not too metallic.
  for (const m of root.listMaterials()) {
    m.setRoughnessFactor(Math.max(m.getRoughnessFactor(), 0.55));
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.15));
  }
  for (const ext of root.listExtensionsUsed()) if (ext.extensionName === "KHR_materials_specular") ext.dispose();

  const clips = bakeClips(THREE, rig);
  for (const clip of CLIPS) {
    // Feet must reach the ground at the start of the clip and never sink more than a few centimetres.
    let lo = Infinity;
    const frames = Math.round(clip.seconds * 4);
    for (let f = 0; f < frames; f++) {
      const t = (f / frames) * clip.seconds;
      if (clip.pose === "walk") applyWalk(THREE, rig, t / clip.seconds);
      else rig.applyPose(clip.pose, t, DEFAULT_ADJUSTMENTS, true);
      lo = Math.min(lo, poseExtent(THREE, rig).minY);
    }
    const e = poseExtent(THREE, rig);
    console.log(`clip ${clip.name}: ${clip.seconds} s, lowest vertex ${lo.toFixed(3)} m, z reach ${e.minZ.toFixed(2)}..${e.maxZ.toFixed(2)} m`);
  }
  if (previewDir) await writePreviews(THREE, rig, previewDir);

  writeRig(THREE, doc, rig, scan, clips);

  doc.createExtension(EXTTextureWebP).setRequired(true);
  const colorTextures = new Set(root.listMaterials().map((m) => m.getBaseColorTexture()).filter(Boolean));
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const isColor = colorTextures.has(texture);
    const webp = await sharp(image).resize({ width: TEXTURE_SIZE, height: TEXTURE_SIZE, fit: "inside", withoutEnlargement: true }).webp({ quality: isColor ? 88 : 92, effort: 4 }).toBuffer();
    texture.setImage(webp).setMimeType("image/webp");
  }
  await doc.transform(prune(), dedup(), weld({ tolerance: 0.0001 }), resample(), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  await io.write(OUTPUT, doc);
  const bytes = fs.statSync(OUTPUT).size;
  console.log(`wrote ${path.relative(process.cwd(), OUTPUT)}: ${(bytes / 1048576).toFixed(2)} MB, skins ${root.listSkins().length}, clips: ${root.listAnimations().map((a) => a.getName()).join(", ")}`);
  if (bytes > MAX_OUTPUT_BYTES) throw new Error(`${bytes} bytes is above the ${MAX_OUTPUT_BYTES} byte limit`);
}

main().catch((err) => {
  console.error("Long Q9 build failed:", err);
  process.exit(1);
});

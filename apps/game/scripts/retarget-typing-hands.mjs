// Retargets the finger and wrist motion of a Mixamo "Typing" FBX onto the Rigify first-person arms
// (`first_person_animations.glb`) and writes a small animation-only GLB. Pure CLI, no Blender.
//
//   node scripts/retarget-typing-hands.mjs [Typing.fbx] [out.glb]
//
// Why a retarget and not a plain FBX -> GLB conversion: the FBX is a whole-body Mixamo rig (65 bones,
// `mixamorig*`, centimetres, T-pose) and the arms model is a Rigify rig (`DEF-*`, metres, a posed
// first-person rest). A converted clip would not find a single bone name. The two rigs do share the
// same anatomy per hand, so the bones are matched by role (hand, thumb 1-3, index 1-3, middle 1-3,
// ring 1-3, pinky 1-3) and the motion is moved across in a rig-independent hand frame:
//   1. Per hand, a frame from the rest geometry: y = wrist -> middle knuckle, across = index -> pinky
//      knuckle, z = across x y, x = y x z (the frame `HeldHand.tsx` also uses).
//   2. Per bone, the local change from rest (rest^-1 * animated) is expressed in that frame through
//      the bone's own rest orientation, then moved to the target bone the same way.
//   3. Target local rotation = target rest * moved change.
// Only the wrist, the thumb and the four fingers are written. Shoulders, arms and forearms are not:
// the room places the arms itself, and the proportions of the two rigs differ.
// The script also measures the result (fingertip direction in the hand frame, source vs target) and
// refuses to write the file when the error is above the limit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Document, NodeIO } from "@gltf-transform/core";

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, "..");
const fbxPath = path.resolve(process.argv[2] ?? path.join(gameDir, "assets-src/characters/typing/Typing.fbx"));
const outPath = path.resolve(process.argv[3] ?? path.join(gameDir, "public/assets/3d/characters/typing-hands.glb"));
const armsPath = path.join(gameDir, "public/assets/3d/characters/first_person_animations.glb");
/** Largest accepted mean angle (degrees) between source and target fingertip directions. */
const MAX_MEAN_ERROR_DEG = 12;
const FINGERS = ["Thumb", "Index", "Middle", "Ring", "Pinky"];
const FINGER_TARGET = { Thumb: "thumb", Index: "f_index", Middle: "f_middle", Ring: "f_ring", Pinky: "f_pinky" };

const toArrayBuffer = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

/** Loads the arms GLB in Node: textures are not needed, so they are dropped before parsing. */
async function loadArms() {
  const data = fs.readFileSync(armsPath);
  const jsonLength = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString("utf8"));
  const bin = data.subarray(20 + jsonLength + 8);
  delete json.textures;
  delete json.images;
  delete json.samplers;
  json.extensionsUsed = [];
  delete json.extensionsRequired;
  for (const material of json.materials ?? []) {
    if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  let jsonBytes = Buffer.from(JSON.stringify(json));
  while (jsonBytes.length % 4) jsonBytes = Buffer.concat([jsonBytes, Buffer.from(" ")]);
  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = Buffer.alloc(total);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBytes.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonBytes.copy(out, 20);
  const binAt = 20 + jsonBytes.length;
  out.writeUInt32LE(bin.length, binAt);
  out.writeUInt32LE(0x004e4942, binAt + 4);
  bin.copy(out, binAt + 8);
  return new Promise((resolve, reject) => new GLTFLoader().parse(toArrayBuffer(out), "", resolve, reject));
}

/** A bone of the arms: its sanitized name (three removes the dots) starts with `name` and an underscore. */
function findTargetBone(root, name) {
  const want = `${name.replace(/[.]/g, "")}_`;
  let found = null;
  root.traverse((object) => {
    if (found === null && object.name.startsWith(want)) found = object;
  });
  return found;
}

const worldPosition = (object) => new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
const worldQuaternion = (object) => object.getWorldQuaternion(new THREE.Quaternion());

/** The hand frame (a rotation) from the rest positions of wrist, index, middle and pinky knuckles. */
function handFrame(wrist, index, middle, pinky) {
  const y = worldPosition(middle).sub(worldPosition(wrist)).normalize();
  const across = worldPosition(index).sub(worldPosition(pinky)).normalize();
  const z = new THREE.Vector3().crossVectors(across, y).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

async function main() {
  const fbxFile = fs.readFileSync(fbxPath);
  const fbx = new FBXLoader().parse(toArrayBuffer(fbxFile), "");
  const sourceClip = fbx.animations.find((clip) => clip.tracks.length > 0);
  if (!sourceClip) throw new Error("The FBX has no animation clip with tracks.");
  const arms = (await loadArms()).scene;
  fbx.updateMatrixWorld(true);
  arms.updateMatrixWorld(true);

  /** Per side: matched bones, frames and the retargeted tracks. */
  const sides = [
    { source: "Right", target: "R" },
    { source: "Left", target: "L" },
  ];
  const pairs = [];
  const frames = new Map();
  for (const side of sides) {
    const srcHand = fbx.getObjectByName(`mixamorig${side.source}Hand`);
    const tgtHand = findTargetBone(arms, `DEF-hand.${side.target}`);
    if (!srcHand || !tgtHand) throw new Error(`Hand bone missing (${side.source}).`);
    const srcKnuckle = (finger) => fbx.getObjectByName(`mixamorig${side.source}Hand${finger}1`);
    const tgtKnuckle = (finger) => findTargetBone(arms, `DEF-${FINGER_TARGET[finger]}.01.${side.target}`);
    const srcFrame = handFrame(srcHand, srcKnuckle("Index"), srcKnuckle("Middle"), srcKnuckle("Pinky"));
    const tgtFrame = handFrame(tgtHand, tgtKnuckle("Index"), tgtKnuckle("Middle"), tgtKnuckle("Pinky"));
    frames.set(side.source, { srcHand, tgtHand, srcFrame, tgtFrame, srcRestWorld: worldQuaternion(srcHand), tgtRestWorld: worldQuaternion(tgtHand) });
    const list = [{ role: "hand", src: srcHand, tgt: tgtHand, frames: { srcFrame, tgtFrame } }];
    for (const finger of FINGERS) {
      for (const n of [1, 2, 3]) {
        const src = fbx.getObjectByName(`mixamorig${side.source}Hand${finger}${n}`);
        const tgt = findTargetBone(arms, `DEF-${FINGER_TARGET[finger]}.0${n}.${side.target}`);
        if (!src || !tgt) throw new Error(`Bone missing: ${side.source} ${finger}${n}`);
        list.push({ role: `${finger}${n}`, src, tgt, frames: { srcFrame, tgtFrame } });
      }
    }
    for (const entry of list) {
      // bone -> hand frame, for source and target: frame^-1 * rest world.
      entry.srcToFrame = srcFrame.clone().invert().multiply(worldQuaternion(entry.src));
      entry.tgtToFrame = tgtFrame.clone().invert().multiply(worldQuaternion(entry.tgt));
      entry.srcRestLocal = entry.src.quaternion.clone();
      entry.tgtRestLocal = entry.tgt.quaternion.clone();
      entry.track = sourceClip.tracks.find((track) => track.name === `${entry.src.name}.quaternion`);
      if (!entry.track) throw new Error(`The clip has no rotation track for ${entry.src.name}.`);
      entry.side = side;
    }
    pairs.push(...list);
  }

  // Resample every track on the clip's own times (all rotation tracks of one FBX share them).
  const times = Array.from(pairs[0].track.times);
  const sample = (track, index) => new THREE.Quaternion().fromArray(track.values, index * 4);
  const values = new Map(pairs.map((entry) => [entry, new Float32Array(times.length * 4)]));
  for (let i = 0; i < times.length; i += 1) {
    for (const entry of pairs) {
      const delta = entry.srcRestLocal.clone().invert().multiply(sample(entry.track, i));
      // Change expressed in the hand frame, then in the target bone's own axes.
      const inFrame = entry.srcToFrame.clone().multiply(delta).multiply(entry.srcToFrame.clone().invert());
      const onTarget = entry.tgtToFrame.clone().invert().multiply(inFrame).multiply(entry.tgtToFrame);
      const result = entry.tgtRestLocal.clone().multiply(onTarget).normalize();
      result.toArray(values.get(entry), i * 4);
    }
  }

  // Measure: the fingertip direction (wrist -> tip, in the hand frame) is read for the source and the
  // target. The two rigs rest differently, so the check compares the CHANGE from rest: the rotation
  // that takes the rest direction to the posed direction must match between source and target.
  const tipDirections = () => {
    const result = new Map();
    for (const side of sides) {
      const { srcHand, tgtHand, srcFrame, tgtFrame, srcRestWorld, tgtRestWorld } = frames.get(side.source);
      for (const finger of FINGERS) {
        const srcTip = fbx.getObjectByName(`mixamorig${side.source}Hand${finger}4`);
        const lastTgt = findTargetBone(arms, `DEF-${FINGER_TARGET[finger]}.03.${side.target}`);
        const tgtTip = lastTgt?.children.find((child) => child.name.includes("end")) ?? null;
        if (!srcTip || !tgtTip) throw new Error(`Fingertip joint missing: ${side.source} ${finger}`);
        const read = (hand, tip, frame, restWorld) =>
          worldPosition(tip)
            .sub(worldPosition(hand))
            .applyQuaternion(worldQuaternion(hand).invert())
            .applyQuaternion(frame.clone().invert().multiply(restWorld))
            .normalize();
        result.set(`${side.source}-${finger}`, {
          finger,
          src: read(srcHand, srcTip, srcFrame, srcRestWorld),
          tgt: read(tgtHand, tgtTip, tgtFrame, tgtRestWorld),
        });
      }
    }
    return result;
  };
  const restDirections = tipDirections();
  let sum = 0;
  let count = 0;
  let worst = 0;
  const perFinger = {};
  const mixer = new THREE.AnimationMixer(fbx);
  mixer.clipAction(sourceClip).play();
  const tgtRest = new Map(pairs.map((entry) => [entry, entry.tgt.quaternion.clone()]));
  for (let i = 0; i < times.length; i += 15) {
    mixer.setTime(times[i]);
    fbx.updateMatrixWorld(true);
    for (const entry of pairs) entry.tgt.quaternion.fromArray(values.get(entry), i * 4);
    arms.updateMatrixWorld(true);
    for (const [key, now] of tipDirections()) {
      const rest = restDirections.get(key);
      const srcChange = new THREE.Quaternion().setFromUnitVectors(rest.src, now.src);
      const tgtChange = new THREE.Quaternion().setFromUnitVectors(rest.tgt, now.tgt);
      const angle = THREE.MathUtils.radToDeg(srcChange.angleTo(tgtChange));
      sum += angle;
      count += 1;
      worst = Math.max(worst, angle);
      perFinger[now.finger] = (perFinger[now.finger] ?? 0) + angle;
    }
  }
  for (const [entry, rest] of tgtRest) entry.tgt.quaternion.copy(rest);
  const mean = sum / count;
  console.log(`fingertip direction error (hand frame): mean ${mean.toFixed(1)} deg, worst ${worst.toFixed(1)} deg over ${count} samples`);
  const perFingerCount = count / FINGERS.length;
  for (const finger of FINGERS) console.log(`  ${finger}: mean ${(perFinger[finger] / perFingerCount).toFixed(1)} deg`);
  if (mean > MAX_MEAN_ERROR_DEG) throw new Error(`Retarget error ${mean.toFixed(1)} deg is above ${MAX_MEAN_ERROR_DEG}; not writing the clip.`);

  // Write the animation-only GLB: one node per target bone, named as in the arms model.
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene("typing");
  const animation = doc.createAnimation("rig|Typing");
  const input = doc.createAccessor("t").setType("SCALAR").setArray(new Float32Array(times));
  for (const entry of pairs) {
    const node = doc.createNode(entry.tgt.userData.name ?? entry.tgt.name);
    scene.addChild(node);
    const output = doc.createAccessor(`q-${node.getName()}`).setType("VEC4").setArray(values.get(entry));
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
    animation.addSampler(sampler);
    animation.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath("rotation").setSampler(sampler));
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await new NodeIO().write(outPath, doc);
  console.log(`wrote ${path.relative(process.cwd(), outPath)}: ${pairs.length} bones, ${times.length} keys, ${times[times.length - 1].toFixed(2)} s, ${fs.statSync(outPath).size} bytes`);
}

await main();

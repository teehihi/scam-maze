'use strict';
/**
 * Builds the animated Long Q9 for the Saigon open world from the author's skinned export.
 *
 *   node apps/game/scripts/longq9/build-longq9.cjs [--report]      (run from the workspace root)
 *
 * Input:  apps/game/scripts/longq9/source/longq9_anim.glb   17-joint skinned mesh, 7 procedural clips of 62.83 s
 * Output: apps/game/public/assets/testbus/ow/models/longq9.optimized.glb
 *
 * What the build does to the export:
 *   1. The clips are sin(k*t) with k in tenths, so most have no short exact period. Each clip is cut to a loop of
 *      LOOP_SECONDS that is picked per clip (the length with the smallest mismatch between t and t + length), and the
 *      head of the loop is cross-faded from the source that follows the loop, so the last key equals the first key.
 *   2. Joints that a clip does not animate fall back to the node rest pose, which is a bent-knee seated stance. Every
 *      clip is therefore completed with constant channels for the whole body: standing clips use the bind pose
 *      (derived from the skin's inverse bind matrices), the others the node rest pose. Existing channels are untouched.
 *   3. gltf-transform resample, quantize and meshopt, textures to 1024 WebP, like the other characters.
 * The clips are renamed to the names the game plays (see simulation/longQ9.ts, LONG_Q9_CLIPS).
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, weld, resample, quantize, reorder, meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

const HERE = __dirname;
const SOURCE = path.join(HERE, "source/longq9_anim.glb");
const OUTPUT = path.resolve(HERE, "../../public/assets/testbus/ow/models/longq9.optimized.glb");
const MAX_OUTPUT_BYTES = 3_145_728;
const FPS = 24;
/** Seconds of cross-fade at the head of every loop. */
const LOOP_BLEND = 1;
/** Loop lengths tried per clip, in seconds. */
const LOOP_MIN = 5, LOOP_MAX = 10;
const TEXTURE_SIZE = 1024;

/**
 * source: clip name in the export. rest: what drives the joints the clip does not animate
 * ("bind" = straight standing body from the skin, "node" = the export's rest pose). loop: fixed loop seconds, or 0 to search.
 */
const CLIPS = [
  { name: "Walk", source: "ChuLong_DiBo", rest: "node", loop: 0 },
  { name: "Ride", source: "ChuLong_LaiXe_TuanTra", rest: "node", loop: 0 },
  { name: "Greet_Seated", source: "ChuLong_NgoiXe_Chao", rest: "node", loop: 0 },
  { name: "Crouch_Repair", source: "ChuLong_NgoiXom_SuaXe", rest: "node", loop: 0 },
  { name: "Wave_Hand", source: "ChuLong_Dung_GioTay", rest: "bind", loop: 0 },
  { name: "Kneel_Pump", source: "ChuLong_QuyBom_Xe", rest: "node", loop: 0 },
];

async function loadThree() {
  return import("three");
}

/** Bind-pose local TRS of every joint: world = inverse(inverseBindMatrix), local = inverse(parentWorld) * world. */
function bindLocals(THREE, skin) {
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices().getArray();
  const world = joints.map((_, i) => new THREE.Matrix4().fromArray(ibm, i * 16).invert());
  return joints.map((joint, i) => {
    const parent = joints.findIndex((j) => j.listChildren().includes(joint));
    const local = parent >= 0 ? world[parent].clone().invert().multiply(world[i]) : world[i].clone();
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    local.decompose(t, q, s);
    return { t: t.toArray(), q: q.toArray() };
  });
}

/** Reader for one source channel: uniform keys, linear for translation, slerp for rotation. */
function channelSampler(THREE, channel) {
  const sampler = channel.getSampler();
  const times = sampler.getInput().getArray();
  const out = sampler.getOutput().getArray();
  const isRot = channel.getTargetPath() === "rotation";
  const width = isRot ? 4 : 3;
  const n = times.length;
  const dt = times[n - 1] / (n - 1);
  const a = new THREE.Quaternion(), b = new THREE.Quaternion();
  return {
    isRot,
    width,
    sample(t) {
      const f = Math.min(Math.max(t / dt, 0), n - 1);
      const i = Math.min(Math.floor(f), n - 2), k = f - i;
      if (isRot) {
        a.fromArray(out, i * 4); b.fromArray(out, (i + 1) * 4);
        return a.clone().slerp(b, k).toArray();
      }
      return [0, 1, 2].map((j) => out[i * 3 + j] * (1 - k) + out[(i + 1) * 3 + j] * k);
    },
  };
}

const smooth = (k) => k * k * (3 - 2 * k);

/** Value of the looping clip at loop time t: the head fades from the source after the loop into the source at t. */
function loopValue(THREE, s, t, length) {
  const v = s.sample(t);
  if (t >= LOOP_BLEND) return v;
  const w = smooth(t / LOOP_BLEND);
  const u = s.sample(length + t);
  if (s.isRot) return new THREE.Quaternion().fromArray(u).slerp(new THREE.Quaternion().fromArray(v), w).toArray();
  return u.map((x, i) => x * (1 - w) + v[i] * w);
}

/** Largest source mismatch between t and length + t over the blended head, a proxy for how natural the fade looks. */
function loopMismatch(samplers, length) {
  let worst = 0;
  for (let t = 0; t < LOOP_BLEND; t += 1 / FPS) {
    for (const s of samplers) {
      const a = s.sample(t), b = s.sample(length + t);
      for (let j = 0; j < s.width; j++) worst = Math.max(worst, Math.abs(a[j] - b[j]));
    }
  }
  return worst;
}

function pickLoop(samplers) {
  let best = { length: LOOP_MIN, mismatch: Infinity };
  for (let frames = LOOP_MIN * FPS; frames <= LOOP_MAX * FPS; frames++) {
    const length = frames / FPS;
    const mismatch = loopMismatch(samplers, length);
    if (mismatch < best.mismatch) best = { length, mismatch };
  }
  return best;
}

async function main() {
  const report = process.argv.includes("--report");
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const THREE = await loadThree();
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(SOURCE);
  const root = doc.getRoot();
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  if (joints.length !== 17) throw new Error(`expected 17 joints, found ${joints.length}`);
  const bind = bindLocals(THREE, skin);
  const buffer = root.listBuffers()[0];
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);

  // The author's material tweak: not too glossy, not too metallic.
  for (const m of root.listMaterials()) {
    m.setRoughnessFactor(Math.max(m.getRoughnessFactor(), 0.55));
    m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.15));
  }

  const sources = new Map(root.listAnimations().map((a) => [a.getName(), a]));
  const built = [];
  for (const clip of CLIPS) {
    const src = sources.get(clip.source);
    if (!src) throw new Error(`missing source clip ${clip.source}`);
    const channels = new Map(); // joint index -> { translation?, rotation? } samplers
    for (const ch of src.listChannels()) {
      const j = joints.indexOf(ch.getTargetNode());
      if (!channels.has(j)) channels.set(j, {});
      channels.get(j)[ch.getTargetPath()] = channelSampler(THREE, ch);
    }
    const all = [...channels.values()].flatMap((c) => Object.values(c));
    const picked = clip.loop ? { length: clip.loop, mismatch: loopMismatch(all, clip.loop) } : pickLoop(all);
    const frames = Math.round(picked.length * FPS);
    const times = Float32Array.from({ length: frames + 1 }, (_, f) => f / FPS);
    const tracks = [];
    joints.forEach((joint, j) => {
      const own = channels.get(j) || {};
      const restFor = clip.rest === "bind" ? bind[j] : { t: joint.getTranslation(), q: joint.getRotation() };
      const wantTranslation = j === 0; // only the pelvis moves; other joints keep their bone length
      for (const [path_, width] of [["translation", 3], ["rotation", 4]]) {
        if (path_ === "translation" && !wantTranslation) continue;
        const s = own[path_];
        const data = new Float32Array((frames + 1) * width);
        if (s) {
          for (let f = 0; f <= frames; f++) {
            // Last key is the first key: the loop closes exactly.
            const t = f === frames ? 0 : f / FPS;
            data.set(loopValue(THREE, s, t, picked.length), f * width);
          }
          // keep the shortest path between keys
          if (width === 4) {
            for (let f = 1; f <= frames; f++) {
              let dot = 0;
              for (let k = 0; k < 4; k++) dot += data[f * 4 + k] * data[(f - 1) * 4 + k];
              if (dot < 0) for (let k = 0; k < 4; k++) data[f * 4 + k] *= -1;
            }
          }
        } else {
          const c = path_ === "translation" ? restFor.t : restFor.q;
          for (let f = 0; f <= frames; f++) data.set(c, f * width);
        }
        tracks.push({ joint, path: path_, width, data, added: !s });
      }
    });
    built.push({ clip, length: picked.length, mismatch: picked.mismatch, times, tracks });
  }

  for (const a of root.listAnimations()) a.dispose();
  for (const b of built) {
    const anim = doc.createAnimation(b.clip.name);
    const input = acc("SCALAR", b.times);
    for (const tr of b.tracks) {
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(acc(tr.width === 4 ? "VEC4" : "VEC3", tr.data)).setInterpolation("LINEAR");
      const channel = doc.createAnimationChannel().setTargetNode(tr.joint).setTargetPath(tr.path).setSampler(sampler);
      anim.addSampler(sampler).addChannel(channel);
    }
    console.log(`clip ${b.clip.name} (${b.clip.source}): loop ${b.length.toFixed(3)} s, ${b.tracks.length} channels (${b.tracks.filter((t) => t.added).length} added), head mismatch ${b.mismatch.toExponential(2)}`);
  }
  if (report) return;

  doc.createExtension(EXTTextureWebP).setRequired(true);
  const colorTextures = new Set(root.listMaterials().map((m) => m.getBaseColorTexture()).filter(Boolean));
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const isColor = colorTextures.has(texture);
    const webp = await sharp(image).resize({ width: TEXTURE_SIZE, height: TEXTURE_SIZE, fit: "inside", withoutEnlargement: true }).webp({ quality: isColor ? 88 : 92, effort: 4 }).toBuffer();
    texture.setImage(webp).setMimeType("image/webp");
  }
  await doc.transform(prune({ keepLeaves: true }), dedup(), weld({ tolerance: 0.0001 }), resample(), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

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

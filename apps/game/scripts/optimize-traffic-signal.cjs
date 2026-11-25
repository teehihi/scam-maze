/**
 * SCAMMAZE mast-arm traffic signal model optimization.
 *
 * Input:  apps/game/assets-src/dengiaothong.glb (owner-supplied, Git LFS, never modified), 23 nodes part_0..part_22
 *         with 1.7M triangles and 3 PNG textures of 4096 px. A different path can be passed as the first
 *         argument or in TRAFFIC_SIGNAL_SRC (a checkout without git-lfs only holds the LFS pointer file).
 * Output: apps/game/public/assets/3d/optimized/props/traffic-signal.optimized.glb
 *
 * The runtime does no guessing, so this script turns the parts into role-named nodes in the signal frame of
 * world/mastArmSignal.ts: pole axis on x = z = 0, base plate bottom on y = 0, arm along +X, lamps facing -Z,
 * real metres (the pole plus street lamp is TOTAL_HEIGHT tall, like the procedural pole).
 *   pole                                     static parts joined into one primitive (base, pole, bracket, street lamp)
 *   arm                                      horizontal arm, geometry in the pole frame, extras.length = tip x
 *   head_low | head_a | head_b               group nodes at the hang point (top centre of the housing); head_low is the
 *                                            pole-mounted head, head_a the overhead head nearer the pole, head_b the tip
 *     <head>_body                            housing, back plate, clamp and the lamp visors
 *     <head>_red | _amber | _green           lamp lenses only (the front disc), so the runtime can make them glow
 *     <head>_countdown                       box (head_a and head_b), extras.faceCenter / extras.faceSize = the front face
 * Every node name above is a runtime contract (export the same strings from the runtime module).
 *
 * Steps: world transform and signal frame baked into the vertices, each lamp part split into lens and visor, per part
 * Meshopt simplification (with UV and normal attributes) to its triangle budget, parts of one role joined, WebP textures
 * of at most TEXTURE_SIZE px, quantize, meshopt. Fails if the output is larger than MAX_OUTPUT_BYTES.
 *
 * Run from the workspace root: node apps/game/scripts/optimize-traffic-signal.cjs [path/to/dengiaothong.glb]
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, quantize, reorder, meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require("meshoptimizer");
const sharp = require("sharp");

const DEFAULT_SRC = path.resolve(__dirname, "../assets-src/dengiaothong.glb");
const OUT = path.resolve(__dirname, "../public/assets/3d/optimized/props/traffic-signal.optimized.glb");
const MAX_OUTPUT_BYTES = 1_572_864;
const TEXTURE_SIZE = 1024;
const TOTAL_HEIGHT = 6.6;

/**
 * Part -> role, from the part bounding boxes (printed with BOUNDS=1). `tris` is the triangle budget of the part after
 * simplification, `error` the relative error cap. `ref` marks the part that gives a head its hang point and a lamp
 * its lens disc centre. Lamp parts are `lens` roles: the front disc becomes the lens, the rest (visor) joins the body.
 */
const POLE_PART = "part_8";
const ROLES = {
  pole: [
    { part: "part_6", tris: 500, error: 0.03 }, // base plate
    { part: "part_8", tris: 5200, error: 0.03 }, // pole
    { part: "part_12", tris: 300, error: 0.02 }, // arm-to-pole bracket
    { part: "part_2", tris: 1100, error: 0.03 }, // street lamp head
    { part: "part_19", tris: 500, error: 0.02 }, // street lamp bracket
  ],
  arm: [{ part: "part_3", tris: 1500, error: 0.03 }],
};
const HEADS = {
  head_low: {
    body: [{ part: "part_22", tris: 1800, error: 0.03, ref: true }],
    lamps: { red: "part_1", amber: "part_0", green: "part_4" },
  },
  head_a: {
    body: [
      { part: "part_13", tris: 1600, error: 0.03, ref: true },
      { part: "part_21", tris: 300, error: 0.02 },
    ],
    lamps: { red: "part_11", amber: "part_14", green: "part_18" },
    countdown: { part: "part_5", tris: 300, error: 0.05 },
  },
  head_b: {
    body: [
      { part: "part_15", tris: 1600, error: 0.03, ref: true },
      { part: "part_17", tris: 300, error: 0.02 },
      { part: "part_10", tris: 100, error: 0.03 },
    ],
    lamps: { red: "part_9", amber: "part_16", green: "part_20" },
    countdown: { part: "part_7", tris: 300, error: 0.02 },
  },
};
/** Visor (hood) triangles per lamp part, kept in the body. */
const VISOR_TRIS = 300;
const LENS_TRIS = 150;

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

/** World-space geometry of a source node: flat arrays, the node matrix is baked in (rotation only here). */
function extract(node) {
  const m = node.getWorldMatrix();
  const prim = node.getMesh().listPrimitives()[0];
  const P = prim.getAttribute("POSITION"), N = prim.getAttribute("NORMAL"), T = prim.getAttribute("TEXCOORD_0");
  const n = P.getCount();
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const v = [0, 0, 0], u = [0, 0];
  for (let i = 0; i < n; i++) {
    P.getElement(i, v);
    pos.set([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]], i * 3);
    N.getElement(i, v);
    nrm.set([m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]], i * 3);
    T.getElement(i, u);
    uv.set(u, i * 2);
  }
  return { pos, nrm, uv, idx: new Uint32Array(prim.getIndices().getArray()) };
}

const bounds = (g) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], g.pos[i + k]); max[k] = Math.max(max[k], g.pos[i + k]); }
  return { min, max, center: min.map((a, k) => (a + max[k]) / 2) };
};
const triCount = (g) => g.idx.length / 3;

/** Geometry made of the given triangles only, vertices compacted. */
function subset(g, tris) {
  const remap = new Map(), pos = [], nrm = [], uv = [], idx = [];
  for (const t of tris) for (let c = 0; c < 3; c++) {
    const old = g.idx[t * 3 + c];
    let id = remap.get(old);
    if (id === undefined) {
      id = remap.size; remap.set(old, id);
      pos.push(g.pos[old * 3], g.pos[old * 3 + 1], g.pos[old * 3 + 2]);
      nrm.push(g.nrm[old * 3], g.nrm[old * 3 + 1], g.nrm[old * 3 + 2]);
      uv.push(g.uv[old * 2], g.uv[old * 2 + 1]);
    }
    idx.push(id);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint32Array(idx) };
}

/** Meshopt simplification to about `target` triangles, normals and UVs kept as attributes. */
function simplify(g, target, error) {
  if (triCount(g) <= target) return g;
  const attrs = new Float32Array((g.pos.length / 3) * 5);
  for (let i = 0; i < g.pos.length / 3; i++) attrs.set([g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2], g.uv[i * 2], g.uv[i * 2 + 1]], i * 5);
  let [out] = MeshoptSimplifier.simplifyWithAttributes(g.idx, g.pos, 3, attrs, 5, [0.2, 0.2, 0.2, 0.3, 0.3], null, target * 3, error, ["Prune"]);
  // Dense scan detail that keeps the attribute constraints from reducing: fall back to position-only.
  if (out.length > target * 3 * 1.15) {
    const [plain] = MeshoptSimplifier.simplify(g.idx, g.pos, 3, target * 3, error, ["Prune"]);
    if (plain.length < out.length) out = plain;
  }
  // Still far above the budget (thin scan detail on a cylinder): the sloppy pass ignores topology.
  if (out.length > target * 3 * 1.5) {
    const [sloppy] = MeshoptSimplifier.simplifySloppy(g.idx, g.pos, 3, null, target * 3, error);
    if (sloppy.length && sloppy.length < out.length) out = sloppy;
  }
  const tris = []; for (let t = 0; t < out.length / 3; t++) tris.push(t);
  return subset({ ...g, idx: out }, tris);
}

function merge(list) {
  const v = list.reduce((s, g) => s + g.pos.length / 3, 0), i = list.reduce((s, g) => s + g.idx.length, 0);
  const out = { pos: new Float32Array(v * 3), nrm: new Float32Array(v * 3), uv: new Float32Array(v * 2), idx: new Uint32Array(i) };
  let vo = 0, io = 0;
  for (const g of list) {
    out.pos.set(g.pos, vo * 3); out.nrm.set(g.nrm, vo * 3); out.uv.set(g.uv, vo * 2);
    for (let k = 0; k < g.idx.length; k++) out.idx[io + k] = g.idx[k] + vo;
    vo += g.pos.length / 3; io += g.idx.length;
  }
  return out;
}

/** Splits a lamp part (already in the signal frame, front = -Z) into the lens (front-facing disc inside the visor) and the visor. */
function splitLamp(g) {
  const b = bounds(g);
  const radius = 0.72 * ((b.max[0] - b.min[0]) / 2), zLimit = b.max[2] - 0.35 * (b.max[2] - b.min[2]);
  const lens = [], visor = [], p = [0, 0, 0], q = [0, 0, 0], r = [0, 0, 0];
  for (let t = 0; t < triCount(g); t++) {
    const [a, c, d] = [g.idx[t * 3], g.idx[t * 3 + 1], g.idx[t * 3 + 2]];
    for (let k = 0; k < 3; k++) { p[k] = g.pos[a * 3 + k]; q[k] = g.pos[c * 3 + k]; r[k] = g.pos[d * 3 + k]; }
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], w = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const nz = (u[0] * w[1] - u[1] * w[0]) / (Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) || 1);
    const cx = (p[0] + q[0] + r[0]) / 3, cy = (p[1] + q[1] + r[1]) / 3, cz = (p[2] + q[2] + r[2]) / 3;
    (nz < -0.5 && Math.hypot(cx - b.center[0], cy - b.center[1]) <= radius && cz >= zLimit ? lens : visor).push(t);
  }
  return { lens: subset(g, lens), visor: subset(g, visor) };
}

async function main() {
  const input = path.resolve(process.argv[2] || process.env.TRAFFIC_SIGNAL_SRC || DEFAULT_SRC);
  if (!fs.existsSync(input)) throw new Error(`Input not found: ${input}`);
  if (fs.readFileSync(input).subarray(0, 24).toString("latin1").startsWith("version https://git-lfs")) {
    throw new Error(`${input} is a Git LFS pointer, not the model. Run "git lfs pull" or pass the real file as the first argument.`);
  }
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(input);
  const root = doc.getRoot();

  const parts = {};
  for (const node of root.listNodes()) if (node.getMesh()) parts[node.getName()] = extract(node);
  const sourceTriangles = Object.values(parts).reduce((s, g) => s + triCount(g), 0);
  if (process.env.BOUNDS) {
    for (const [name, g] of Object.entries(parts).sort()) { const b = bounds(g); console.log(name, triCount(g), b.min.map((x) => x.toFixed(3)).join(","), "|", b.max.map((x) => x.toFixed(3)).join(",")); }
  }

  // Source frame -> signal frame: rotate 180 degrees about Y (source heads face +Z, arm toward -X), pole axis to
  // x = z = 0, base bottom to y = 0, uniform scale so the whole model is TOTAL_HEIGHT tall.
  const poleBounds = bounds(parts[POLE_PART]);
  const cx = poleBounds.center[0], cz = poleBounds.center[2];
  const all = bounds(merge(Object.values(parts)));
  const y0 = all.min[1], scale = TOTAL_HEIGHT / (all.max[1] - y0);
  for (const g of Object.values(parts)) {
    for (let i = 0; i < g.pos.length; i += 3) {
      g.pos[i] = -(g.pos[i] - cx) * scale; g.pos[i + 1] = (g.pos[i + 1] - y0) * scale; g.pos[i + 2] = -(g.pos[i + 2] - cz) * scale;
      g.nrm[i] = -g.nrm[i]; g.nrm[i + 2] = -g.nrm[i + 2];
    }
  }
  // Simplification errors are relative to each piece's extent, so they stay meaningful after the scaling.
  const take = (spec) => simplify(parts[spec.part], spec.tris, spec.error);
  const rootNodes = [];
  const meshOf = (name, g) => {
    const buffer = root.listBuffers()[0];
    const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", acc("VEC3", g.pos))
      .setAttribute("NORMAL", acc("VEC3", g.nrm))
      .setAttribute("TEXCOORD_0", acc("VEC2", g.uv))
      .setIndices(acc("SCALAR", g.idx))
      .setMaterial(material);
    return doc.createMesh(name).addPrimitive(prim);
  };
  const material = root.listMaterials()[0];
  const stats = {};
  const leaf = (name, g, extras) => {
    stats[name] = triCount(g);
    const node = doc.createNode(name).setMesh(meshOf(name, g));
    if (extras) node.setExtras(extras);
    return node;
  };

  const scene = root.listScenes()[0];
  for (const old of scene.listChildren()) scene.removeChild(old);
  const add = (node) => { scene.addChild(node); rootNodes.push(node); return node; };
  const round = (v) => v.map((x) => Math.round(x * 1e4) / 1e4);

  add(leaf("pole", merge(ROLES.pole.map(take))));
  const arm = merge(ROLES.arm.map(take));
  add(leaf("arm", arm, { length: round([bounds(arm).max[0]])[0], bottomY: round([bounds(arm).min[1]])[0], topY: round([bounds(arm).max[1]])[0] }));

  const report = [];
  for (const [headName, spec] of Object.entries(HEADS)) {
    const ref = bounds(parts[spec.body.find((b) => b.ref).part]);
    const hang = [ref.center[0], ref.max[1], ref.center[2]];
    const local = (g) => { for (let i = 0; i < g.pos.length; i += 3) for (let k = 0; k < 3; k++) g.pos[i + k] -= hang[k]; return g; };
    const group = add(doc.createNode(headName).setTranslation(round(hang)));
    const bodyParts = spec.body.map(take);
    const lenses = {};
    for (const [colour, partName] of Object.entries(spec.lamps)) {
      const { lens, visor } = splitLamp(parts[partName]);
      lenses[colour] = local(simplify(lens, LENS_TRIS, 0.02));
      bodyParts.push(simplify(visor, VISOR_TRIS, 0.02));
      report.push(`${headName}_${colour}: ${partName} lens ${triCount(lens)} + visor ${triCount(visor)} source triangles, lens centre ${round(bounds(lenses[colour]).center).join(",")} size ${round(bounds(lenses[colour]).max.map((m, k) => m - bounds(lenses[colour]).min[k])).join("x")}`);
    }
    group.addChild(leaf(`${headName}_body`, local(merge(bodyParts))));
    for (const [colour, g] of Object.entries(lenses)) group.addChild(leaf(`${headName}_${colour}`, g));
    if (spec.countdown) {
      const box = local(take(spec.countdown));
      const b = bounds(box);
      // Front face (facing -Z, so the minimum z); the runtime panel sits on it.
      group.addChild(leaf(`${headName}_countdown`, box, { faceCenter: round([b.center[0], b.center[1], b.min[2]]), faceSize: round([b.max[0] - b.min[0], b.max[1] - b.min[1]]) }));
    }
  }

  // Material: the scan carries metallic = roughness = 1 for its packed texture; keep it from going dark and mirror-like.
  for (const ext of root.listExtensionsUsed()) if (ext.extensionName === "KHR_materials_specular") ext.dispose();
  material.setMetallicFactor(0.2).setRoughnessFactor(1).setExtras({});
  for (const old of root.listNodes()) if (old.getMesh()?.getName().startsWith("part_") || /^part_\d+$/.test(old.getName())) old.dispose();
  for (const mesh of root.listMeshes()) if (mesh.listParents().every((p) => p.propertyType !== "Node")) mesh.dispose();
  for (const a of root.listAnimations()) a.dispose();
  await doc.transform(prune());

  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const webp = await sharp(image).resize({ width: TEXTURE_SIZE, height: TEXTURE_SIZE, fit: "inside", withoutEnlargement: true }).webp({ quality: 85, effort: 4 }).toBuffer();
    texture.setImage(webp).setMimeType("image/webp");
    if (texture.getURI()) texture.setURI(texture.getURI().replace(/\.[a-z]+$/i, ".webp"));
  }
  await doc.transform(prune(), dedup(), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await io.write(OUT, doc);

  const bytes = fs.statSync(OUT).size;
  const total = Object.values(stats).reduce((s, n) => s + n, 0);
  console.log("=== SCAMMAZE TRAFFIC SIGNAL OPTIMIZER ===");
  console.log(`scale ${scale.toFixed(3)}, pole axis (source) x ${cx.toFixed(4)} z ${cz.toFixed(4)}`);
  for (const line of report) console.log(line);
  console.log(Object.entries(stats).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log(`traffic-signal: ${mb(fs.statSync(input).size)} -> ${mb(bytes)} | triangles ${sourceTriangles.toLocaleString("en-US")} -> ${total.toLocaleString("en-US")}`);
  if (bytes > MAX_OUTPUT_BYTES) throw new Error(`${bytes} bytes is above the ${MAX_OUTPUT_BYTES} byte limit`);
}

main().catch((err) => {
  console.error("Optimization failed:", err.message || err);
  process.exit(1);
});

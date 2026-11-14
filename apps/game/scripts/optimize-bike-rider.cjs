/**
 * SCAMMAZE bike rider optimization (neighborhood traffic in /khupho).
 *
 * Input:  apps/game/assets-src/vehicles/bike-rider/bike_rider_animated.glb (never modified)
 * Output: apps/game/public/assets/3d/optimized/bike-rider.optimized.glb
 *
 * The source is one skinned photogrammetry mesh (300,000 triangles, ~7,500 loose scan shells)
 * where every vertex follows exactly one of 4 joints: Chassis (bike + rider), Head, FrontWheel and
 * RearWheel. So the mesh is really 4 rigid parts, and skinning only costs memory and GPU time.
 *
 * Steps:
 * 1. Split the triangles by joint into 4 rigid parts. Head and wheel vertices are moved into their
 *    joint's space so the game can turn them about their own pivot (node translation = joint).
 * 2. Build 3 levels of detail with the Meshopt simplifier (attribute-aware, so UV seams and
 *    normals are kept). LOD0 and LOD1 keep the 4 parts; LOD2 (far away) is a single mesh, and
 *    its simplifier may drop tiny loose scan shells (`Prune`), which no one sees at that distance.
 * 3. Drop the skin, joints, weights and animation clips (the game turns wheels and head in code).
 * 4. prune, dedup, quantize, reorder, meshopt. The 3 JPEG textures (471 KB) are kept as they are.
 *
 * Output scene: nodes `BikeRider_LOD0`, `BikeRider_LOD1` (children `Chassis`, `Head`,
 * `FrontWheel`, `RearWheel`) and `BikeRider_LOD2` (child `Body`). Front is +Z, units as authored
 * (the bike is ~0.97 m long; the game scales it).
 *
 * Run from the workspace root: node apps/game/scripts/optimize-bike-rider.cjs
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { prune, dedup, reorder, quantize, meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require("meshoptimizer");

const INPUT_PATH = path.resolve(__dirname, "../assets-src/vehicles/bike-rider/bike_rider_animated.glb");
const OUTPUT_PATH = path.resolve(__dirname, "../public/assets/3d/optimized/bike-rider.optimized.glb");
const MAX_OUTPUT_BYTES = 5_242_880;

const PARTS = ["Chassis", "FrontWheel", "RearWheel", "Head"];
/**
 * Triangle share kept per level and part, and the largest simplification error allowed
 * (relative to the part's size). The error cap wins over the ratio, so LOD0 never loses
 * visible shape even if it stays above its target.
 */
const LODS = [
  { name: "BikeRider_LOD0", ratio: { Chassis: 0.4, Head: 0.5, FrontWheel: 1, RearWheel: 1 }, error: 0.004, merge: false, prune: false },
  { name: "BikeRider_LOD1", ratio: { Chassis: 0.1, Head: 0.12, FrontWheel: 0.3, RearWheel: 0.3 }, error: 0.02, merge: false, prune: false },
  { name: "BikeRider_LOD2", ratio: { Chassis: 0.025, Head: 0.03, FrontWheel: 0.08, RearWheel: 0.08 }, error: 0.08, merge: true, prune: true },
];
/** Attribute weights for the simplifier: normal xyz, then uv. */
const ATTR_WEIGHTS = [0.25, 0.25, 0.25, 1, 1];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

/** Keeps the vertices `tris` uses, renumbered, with positions moved by `-offset`. */
function compact(tris, pos, nrm, uv, offset) {
  const remap = new Int32Array(pos.length / 3).fill(-1);
  let n = 0;
  for (const v of tris) if (remap[v] < 0) remap[v] = n++;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), T = new Float32Array(n * 2);
  for (let v = 0; v < remap.length; v++) {
    const k = remap[v];
    if (k < 0) continue;
    for (let c = 0; c < 3; c++) { P[k * 3 + c] = pos[v * 3 + c] - offset[c]; N[k * 3 + c] = nrm[v * 3 + c]; }
    T[k * 2] = uv[v * 2]; T[k * 2 + 1] = uv[v * 2 + 1];
  }
  const I = new Uint32Array(tris.length);
  for (let i = 0; i < tris.length; i++) I[i] = remap[tris[i]];
  return { P, N, T, I };
}

function simplify(part, ratio, error, prune) {
  if (ratio >= 1) return { ...part, err: 0 };
  const count = part.P.length / 3;
  const attrs = new Float32Array(count * 5);
  for (let v = 0; v < count; v++) {
    attrs.set(part.N.subarray(v * 3, v * 3 + 3), v * 5);
    attrs[v * 5 + 3] = part.T[v * 2]; attrs[v * 5 + 4] = part.T[v * 2 + 1];
  }
  const target = Math.max(3, Math.floor((part.I.length * ratio) / 3) * 3);
  const [I, err] = MeshoptSimplifier.simplifyWithAttributes(part.I, part.P, 3, attrs, 5, ATTR_WEIGHTS, null, target, error, prune ? ["Prune"] : []);
  return { ...compact(I, part.P, part.N, part.T, [0, 0, 0]), err };
}

async function optimizeBikeRider() {
  if (!fs.existsSync(INPUT_PATH)) fail(`Input not found: ${INPUT_PATH}`);
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
  console.log("=== SCAMMAZE BIKE RIDER OPTIMIZER ===");
  console.log("Source:", INPUT_PATH, mb(fs.statSync(INPUT_PATH).size));
  const doc = await io.read(INPUT_PATH);
  const root = doc.getRoot();

  const meshes = root.listMeshes();
  if (meshes.length !== 1 || meshes[0].listPrimitives().length !== 1) fail("Expected one mesh with one primitive.");
  const prim = meshes[0].listPrimitives()[0];
  const material = prim.getMaterial();
  const skin = root.listSkins()[0];
  if (!skin) fail("Expected a skin.");
  const jointNames = skin.listJoints().map((j) => j.getName());
  const pivots = Object.fromEntries(skin.listJoints().map((j) => [j.getName(), j.getWorldTranslation()]));
  console.log("Joints:", jointNames.join(", "));

  const pos = prim.getAttribute("POSITION").getArray();
  const nrm = prim.getAttribute("NORMAL").getArray();
  const uv = prim.getAttribute("TEXCOORD_0").getArray();
  const joints = prim.getAttribute("JOINTS_0").getArray();
  const weights = prim.getAttribute("WEIGHTS_0").getArray();
  const index = prim.getIndices().getArray();
  const vertexJoint = new Uint8Array(pos.length / 3);
  for (let v = 0; v < vertexJoint.length; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (weights[v * 4 + k] > weights[v * 4 + best]) best = k;
    vertexJoint[v] = joints[v * 4 + best];
  }

  // [1/4] Split into rigid parts.
  const triLists = Object.fromEntries(PARTS.map((p) => [p, []]));
  let mixed = 0;
  for (let i = 0; i < index.length; i += 3) {
    const a = vertexJoint[index[i]], b = vertexJoint[index[i + 1]], c = vertexJoint[index[i + 2]];
    if (a !== b || a !== c) mixed++;
    triLists[jointNames[a]].push(index[i], index[i + 1], index[i + 2]);
  }
  console.log(`\n[1/4] Split: ${mixed} triangles span two joints (assigned to the first vertex's joint)`);
  const parts = {};
  for (const name of PARTS) {
    const offset = name === "Chassis" ? [0, 0, 0] : pivots[name];
    parts[name] = { ...compact(triLists[name], pos, nrm, uv, offset), offset };
    console.log(`  ${name}: ${(parts[name].I.length / 3).toLocaleString("en-US")} triangles, pivot [${offset.map((x) => x.toFixed(4)).join(", ")}]`);
  }

  // [2/4] Levels of detail.
  console.log("\n[2/4] Simplifying...");
  const scene = doc.createScene("BikeRider");
  const buffer = root.listBuffers()[0];
  const makePrim = (g) => doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(g.P).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(g.N).setBuffer(buffer))
    .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(g.T).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(g.I).setBuffer(buffer))
    .setMaterial(material);
  const report = [];
  for (const lod of LODS) {
    const holder = doc.createNode(lod.name);
    scene.addChild(holder);
    const simplified = {};
    for (const name of PARTS) simplified[name] = simplify(parts[name], lod.ratio[name], lod.error, lod.prune);
    let total = 0;
    if (lod.merge) {
      // One mesh: parts go back to model space.
      const all = { P: [], N: [], T: [], I: [] };
      let base = 0;
      for (const name of PARTS) {
        const g = simplified[name], o = parts[name].offset;
        for (let v = 0; v < g.P.length / 3; v++) all.P.push(g.P[v * 3] + o[0], g.P[v * 3 + 1] + o[1], g.P[v * 3 + 2] + o[2]);
        all.N.push(...g.N); all.T.push(...g.T);
        for (const k of g.I) all.I.push(k + base);
        base += g.P.length / 3;
      }
      const g = { P: new Float32Array(all.P), N: new Float32Array(all.N), T: new Float32Array(all.T), I: new Uint32Array(all.I) };
      holder.addChild(doc.createNode("Body").setMesh(doc.createMesh("Body").addPrimitive(makePrim(g))));
      total = g.I.length / 3;
    } else {
      for (const name of PARTS) {
        const g = simplified[name];
        const node = doc.createNode(name).setMesh(doc.createMesh(`${lod.name}_${name}`).addPrimitive(makePrim(g)));
        if (name !== "Chassis") node.setTranslation(parts[name].offset);
        holder.addChild(node);
        total += g.I.length / 3;
      }
    }
    const errs = PARTS.map((n) => `${n} ${(simplified[n].I.length / 3).toLocaleString("en-US")} (err ${simplified[n].err.toFixed(4)})`);
    console.log(`  ${lod.name}: ${total.toLocaleString("en-US")} triangles | ${errs.join(", ")}`);
    report.push({ lod: lod.name, triangles: total });
  }

  // [3/4] Remove the source graph: skin, animations and the old scene.
  console.log("\n[3/4] Removing skin, animations and the source scene...");
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  for (const a of root.listAnimations()) a.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const n of root.listNodes()) if (!n.listParents().some((p) => p === scene || p.propertyType === "Node")) n.dispose();
  meshes[0].dispose();
  root.setDefaultScene(scene);

  // [4/4] Compress.
  console.log("\n[4/4] prune, dedup, quantize, reorder, meshopt...");
  await doc.transform(prune(), dedup(), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  if (root.listSkins().length || root.listAnimations().length) fail("Skin or animations remain.");
  await io.write(OUTPUT_PATH, doc);
  const out = fs.statSync(OUTPUT_PATH).size;
  console.log("\n=== RESULT ===");
  console.log("Before:", mb(fs.statSync(INPUT_PATH).size), "| After:", mb(out));
  console.log("Levels:", report.map((r) => `${r.lod} ${r.triangles.toLocaleString("en-US")}`).join(", "));
  if (out > MAX_OUTPUT_BYTES) fail(`Output is above ${MAX_OUTPUT_BYTES} bytes.`);
}

optimizeBikeRider().catch((err) => {
  console.error("Optimization failed:", err);
  process.exit(1);
});

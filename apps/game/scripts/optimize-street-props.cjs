/**
 * SCAMMAZE street furniture and parked vehicle optimization (neighborhood in /khupho).
 *
 * Input:  apps/game/assets-src/props/furniture/*.glb and apps/game/assets-src/vehicles/parked/*.glb
 *         (never modified; vehicles and ghecao.glb are local-only, see the SOURCE.md files)
 * Output: apps/game/public/assets/3d/optimized/props/<id>.optimized.glb
 *
 * The game draws these as instanced meshes (one draw per material for every copy), so each file is
 * reduced to few materials and few triangles:
 * 1. `drop`: primitives removed by material or node name (brand logos, plates, glass the size of a coin).
 * 2. Physical extensions removed (clearcoat, specular, transmission, ...), animations removed.
 * 3. palette(): untextured materials become one material with a small palette texture.
 * 4. flatten + join: one primitive per remaining material.
 * 5. simplify each primitive to its share of `triangles` (Meshopt, error cap `error` of the primitive's
 *    size, tiny loose pieces pruned; sloppy simplifier for dense parts that do not reduce), WebP textures at most `texture` px, quantize, meshopt.
 *    (Run on the source primitives, before joining: gltf-transform's simplify() stalled on the joined
 *    meshes of these files.)
 * Size, orientation and ground offset are applied in the game (streetFurniture.ts) from the specs there.
 *
 * Run from the workspace root: node apps/game/scripts/optimize-street-props.cjs [id ...]
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, weld, quantize, reorder, meshopt, palette, flatten, join, compactPrimitive } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require("meshoptimizer");
const sharp = require("sharp");

const SRC = path.resolve(__dirname, "../assets-src");
const OUT = path.resolve(__dirname, "../public/assets/3d/optimized/props");
const MAX_OUTPUT_BYTES = 2_097_152;

const PROPS = [
  { id: "stool-low", file: "props/furniture/ghelun.glb", triangles: 600, error: 0.02, texture: 512 },
  // Thin shell with molded holes: the sloppy pass tears it, so only the topology-preserving pass is used.
  { id: "stool-high", file: "props/furniture/ghecao.glb", triangles: 16000, error: 0.012, texture: 512, sloppy: false },
  { id: "table-set", file: "props/furniture/set_table_chair.glb", triangles: 6000, error: 0.03, texture: 512 },
  // Flat A-board sign on a base (1.01 m, one printed face): a scan with a 1M-triangle mesh and 4096 px textures.
  { id: "bienhieu1", file: "props/furniture/bienhieu1.glb", triangles: 20000, error: 0.003, texture: 1024, sloppy: false },
  { id: "bike-cg125", file: "vehicles/parked/honda-cg-125.glb", triangles: 9000, error: 0.025, texture: 512 },
  { id: "bike-supercub", file: "vehicles/parked/super-cub-c90.glb", triangles: 9000, error: 0.05, texture: 512 },
  { id: "bike-fatboy", file: "vehicles/parked/fat-boy-cruiser.glb", triangles: 8000, error: 0.025, texture: 512 },
  { id: "bike-bobber", file: "vehicles/parked/xyn-custom-bobber.glb", triangles: 8000, error: 0.025, texture: 512 },
  // The PCX file carries a real brand logo texture and a real-format license plate: both removed.
  { id: "bike-pcx", file: "vehicles/parked/honda-pcx.glb", triangles: 10000, error: 0.05, texture: 512, dropTexture: /logo|placa|plate/i },
];

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const triangles = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute("POSITION").getCount() / 3), 0), 0);
const DROP_EXT = ["KHR_materials_clearcoat", "KHR_materials_specular", "KHR_materials_transmission", "KHR_materials_ior", "KHR_materials_sheen", "KHR_materials_volume", "KHR_materials_emissive_strength", "KHR_texture_transform"];

async function optimize(io, p) {
  const input = path.join(SRC, p.file);
  if (!fs.existsSync(input)) throw new Error(`Input not found: ${input} (local-only source, see SOURCE.md)`);
  const output = path.join(OUT, `${p.id}.optimized.glb`);
  const doc = await io.read(input);
  const root = doc.getRoot();
  const before = triangles(doc);

  let dropped = 0;
  if (p.dropTexture) {
    for (const material of root.listMaterials()) {
      const textures = [material.getBaseColorTexture(), material.getEmissiveTexture()].filter(Boolean);
      if (!textures.some((t) => p.dropTexture.test(`${t.getName()} ${t.getURI()}`))) continue;
      for (const prim of material.listParents().filter((x) => x.propertyType === "Primitive")) { prim.dispose(); dropped++; }
    }
  }
  for (const a of root.listAnimations()) a.dispose();
  for (const ext of root.listExtensionsUsed()) if (DROP_EXT.includes(ext.extensionName)) ext.dispose();
  // Non-triangle primitives (lines, points) are never drawn by the instancer.
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) if (prim.getMode() !== 4) { prim.dispose(); dropped++; }
  for (const material of root.listMaterials()) {
    material.setExtras({});
    // Blended glass becomes opaque-dark or cutout: instanced copies are not depth-sorted.
    if (material.getAlphaMode() === "BLEND") material.setAlphaMode(material.getBaseColorTexture() ? "MASK" : "OPAQUE").setAlphaCutoff(0.4);
  }

  await doc.transform(prune(), dedup(), weld({ tolerance: 0.0001 }));
  const ratio = Math.min(1, p.triangles / Math.max(1, triangles(doc)));
  if (ratio < 1) {
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      if (!indices) continue;
      const I = new Uint32Array(indices.getArray()), P = new Float32Array(prim.getAttribute("POSITION").getArray());
      const target = Math.max(3, Math.floor((I.length / 3) * ratio) * 3);
      let [out, err] = MeshoptSimplifier.simplify(I, P, 3, target, p.error, ["Prune"]);
      // Dense parts the topology-preserving pass cannot reduce (tyre treads, scanned chair
      // weave) use the sloppy simplifier, which ignores topology, within the same error.
      if (p.sloppy !== false && out.length > target * 3 && out.length > 6000) {
        const [sloppy, serr] = MeshoptSimplifier.simplifySloppy(I, P, 3, null, target, p.error);
        if (sloppy.length && sloppy.length < out.length) { out = sloppy; err = serr; }
      }
      if (process.env.DEBUG_SIMPLIFY) console.log(`  ${mesh.getName()} ${I.length / 3} -> ${out.length / 3} (target ${target / 3}, err ${err.toFixed(4)}, ${P.constructor.name}, idx ${indices.getArray().constructor.name})`);
      if (out.length === 0) { prim.dispose(); continue; }
      indices.setArray(out);
      compactPrimitive(prim);
    }
  }
  await doc.transform(prune(), palette({ min: 2 }), flatten(), join({ keepNamed: false }));

  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const webp = await sharp(image).resize({ width: p.texture, height: p.texture, fit: "inside", withoutEnlargement: true }).webp({ quality: 85, effort: 4 }).toBuffer();
    texture.setImage(webp).setMimeType("image/webp");
    if (texture.getURI()) texture.setURI(texture.getURI().replace(/\.[a-z]+$/i, ".webp"));
  }
  await doc.transform(prune(), dedup(), quantize(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(output, doc);
  const bytes = fs.statSync(output).size;
  const prims = root.listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0);
  console.log(`${p.id}: ${mb(fs.statSync(input).size)} -> ${mb(bytes)} | triangles ${before.toLocaleString("en-US")} -> ${triangles(doc).toLocaleString("en-US")} | primitives (draws per instance set) ${prims} | dropped ${dropped}`);
  if (bytes > MAX_OUTPUT_BYTES) throw new Error(`${p.id}: ${bytes} bytes is above the ${MAX_OUTPUT_BYTES} byte limit`);
}

async function main() {
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  fs.mkdirSync(OUT, { recursive: true });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const only = process.argv.slice(2);
  const list = only.length ? PROPS.filter((p) => only.includes(p.id)) : PROPS;
  if (!list.length) throw new Error(`Unknown id. Known: ${PROPS.map((p) => p.id).join(", ")}`);
  console.log("=== SCAMMAZE STREET PROP OPTIMIZER ===");
  for (const p of list) await optimize(io, p);
}

main().catch((err) => {
  console.error("Optimization failed:", err.message || err);
  process.exit(1);
});

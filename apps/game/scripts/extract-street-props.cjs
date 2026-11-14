/**
 * SCAMMAZE street props extractor.
 *
 * Input:  apps/game/public/assets/3d/optimized/MenuBG.optimized.glb (never modified)
 * Output: apps/game/public/assets/3d/optimized/street-props.optimized.glb
 *
 * The 26 MB street environment holds the banh mi cart, the battery-swap station and the penguin
 * trash bin. The neighborhood world only needs those three, so this script copies just their node
 * trees (with their meshes, materials and textures) into a small file. Each prop keeps its world
 * position from the street scene inside a wrapper node named `Prop_<name>`; the world code
 * re-centers them on load.
 *
 * Run from the workspace root: node apps/game/scripts/extract-street-props.cjs
 */
const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { prune, dedup, reorder, meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

const INPUT_PATH = path.resolve(__dirname, "../public/assets/3d/optimized/MenuBG.optimized.glb");
const OUTPUT_PATH = path.resolve(__dirname, "../public/assets/3d/optimized/street-props.optimized.glb");
/** Size gate: the props file must stay small enough to load in the background. */
const MAX_OUTPUT_BYTES = 3_145_728;
/** Largest texture side after resizing. */
const MAX_TEXTURE_SIZE = 1024;

/** Source node names (the street GLB keeps trailing spaces) and the wrapper names written. */
const PROPS = [
  { source: "BanhMi ", wrapper: "Prop_BanhMi" },
  { source: "tramdoipin ", wrapper: "Prop_BatterySwap" },
  { source: "bin ", wrapper: "Prop_TrashBin" },
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function main() {
  if (!fs.existsSync(INPUT_PATH)) fail(`Input not found: ${INPUT_PATH}`);
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
  const doc = await io.read(INPUT_PATH);
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const nodes = root.listNodes();

  const wrappers = PROPS.map(({ source, wrapper }) => {
    const target = nodes.find((n) => n.getName() === source);
    if (!target) fail(`Node "${source}" not found.`);
    const parent = target.getParentNode();
    const base = parent ? parent.getTranslation() : [0, 0, 0];
    const own = target.getTranslation();
    const holder = doc.createNode(wrapper).setTranslation([base[0] + own[0], base[1] + own[1], base[2] + own[2]]);
    target.setTranslation([0, 0, 0]);
    holder.addChild(target);
    return holder;
  });

  // Keep only the wrappers in the scene; prune() drops everything that is no longer reachable.
  for (const child of scene.listChildren()) scene.removeChild(child);
  for (const holder of wrappers) scene.addChild(holder);
  // Dispose every node outside the wrappers so their meshes and textures become unreferenced.
  const keep = new Set();
  for (const holder of wrappers) holder.traverse((n) => keep.add(n));
  for (const node of nodes) if (!keep.has(node)) node.dispose();
  // Textures: at most 1024 px on a side, WebP (the street file already uses EXT_texture_webp).
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const resized = await sharp(image)
      .resize({ width: MAX_TEXTURE_SIZE, height: MAX_TEXTURE_SIZE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
    texture.setImage(resized);
    texture.setMimeType("image/webp");
  }
  await doc.transform(prune(), dedup(), reorder({ encoder: MeshoptEncoder }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

  await io.write(OUTPUT_PATH, doc);
  const bytes = fs.statSync(OUTPUT_PATH).size;
  console.log(`Wrote ${OUTPUT_PATH}: ${(bytes / 1048576).toFixed(2)} MB`);
  console.log("Meshes:", root.listMeshes().length, "Textures:", root.listTextures().length);
  if (bytes > MAX_OUTPUT_BYTES) fail(`Output is above ${MAX_OUTPUT_BYTES} bytes.`);
}

main().catch((err) => {
  console.error("Extraction failed:", err);
  process.exit(1);
});

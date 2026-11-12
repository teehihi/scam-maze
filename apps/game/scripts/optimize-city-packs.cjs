/**
 * SCAMMAZE low-poly city pack pipeline.
 *
 * Inputs (Sketchfab packs, CC-BY 4.0, kept outside the repo in Asset3D/ or in assets-src/city/):
 *   low_poly_city.glb, low_poly_city_game-ready.glb, low_poly_city_asset_pack.glb,
 *   low_poly_cars_pack.glb
 *
 * Outputs (apps/game/public/assets/3d/optimized/):
 *   city-district.optimized.glb  Curated buildings and trees from the three city packs.
 *   city-cars.optimized.glb      The individual cars of the cars pack.
 *
 * Every exported piece is a top-level node whose origin is the centre of its footprint on the
 * ground (y = 0) and whose size is in metres. Names carry the pack prefix:
 *   gr_*  Low Poly City Game-Ready      lp_*  Low Poly City      ap_*  Low Poly City Asset Pack
 *   car_NN  Low Poly Cars Pack
 *
 * Textures: at most MAX_TEXTURE_SIZE px, WebP. Geometry: prune, dedup, weld, quantize, reorder,
 * Meshopt. No decimation (the selected pieces are small).
 *
 * Run from the workspace root: node apps/game/scripts/optimize-city-packs.cjs
 */
const fs = require("fs");
const path = require("path");
const { Document, NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, weld, reorder, quantize, meshopt, getBounds, mergeDocuments } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

const SOURCE_DIRS = [
  "/Users/tee/UTE/Kiroween/Asset3D",
  path.resolve(__dirname, "../assets-src/city"),
];
const OUTPUT_DIR = path.resolve(__dirname, "../public/assets/3d/optimized");
const MAX_TEXTURE_SIZE = 512;
const WEBP_QUALITY = 80;
const MAX_DISTRICT_BYTES = 8 * 1048576;
const MAX_CARS_BYTES = 3 * 1048576;

/** Asset-pack scale: the pack's `Person_Scale` figure is 0.0192 units tall, i.e. 1.75 m. */
const AP_SCALE = 1.75 / 0.0192;

function findSource(file) {
  for (const dir of SOURCE_DIRS) {
    const candidate = path.join(dir, file);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Source not found: ${file} (looked in ${SOURCE_DIRS.join(", ")})`);
}

/** Low Poly City Game-Ready: first node whose name starts with each prefix. */
const GR_PREFIXES = [
  "Commercial 1_", "Commercial 2.", "Commercial 3_", "Commercial 5_", "Commercial 6_",
  "Commercial 7_", "Commercial 9_", "Commercial 10_", "Commercial 11_",
  "Residential 2.", "Residential 4.003", "Residential 5.003", "Residential 6.001",
  "Residential 7.001", "Residential 8.001", "Residential 9.001", "Residential 10.001",
  "Residential 11.001", "Modern Office.001", "Cube.332_", "Cube.341_", "Cube.359_", "Post Office_",
];
/** Low Poly City: buildings (and a few trees) by node name. */
const LP_BUILDINGS = [
  "47.001", "45", "39", "43", "115", "58", "57", "69", "14", "11", "145", "30", "25", "65",
  "17", "16", "4.001", "129", "26", "53", "101", "97", "100", "124", "148",
];
const LP_TREES = ["S1 Tree_24_Color_0_559"];
/** Low Poly City Asset Pack: building groups (Base + Details parts) and single pieces. */
const AP_GROUPS = ["B1", "B2", "B3", "B4", "B5", "Shop1", "Hospital"];

function formatBytes(bytes) {
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function makeIO() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
}

function triangles(node) {
  let total = 0;
  node.traverse((child) => {
    const mesh = child.getMesh();
    if (!mesh) return;
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      total += (indices ? indices.getCount() : prim.getAttribute("POSITION").getCount()) / 3;
    }
  });
  return total;
}

/**
 * Moves `sources` under a new top-level node `name`, baking their world transforms first so
 * they keep their place inside the wrapper. The wrapper then recentres the footprint on the
 * origin, puts the lowest point at y = 0 and applies `scale`. Optionally turns the piece so its
 * longest horizontal side runs along z.
 */
function wrapPiece(doc, scene, name, sources, scale, alignLongSideToZ) {
  const wrapper = doc.createNode(name);
  const worlds = sources.map((node) => node.getWorldMatrix());
  sources.forEach((node, index) => {
    const parent = node.getParentNode();
    if (parent) parent.removeChild(node);
    for (const owner of node.listParents()) if (owner === scene) scene.removeChild(node);
    wrapper.addChild(node);
    node.setMatrix(worlds[index]);
  });
  const bounds = getBounds(wrapper);
  const size = [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]);
  const cx = (bounds.min[0] + bounds.max[0]) / 2;
  const cz = (bounds.min[2] + bounds.max[2]) / 2;
  const turn = alignLongSideToZ && size[0] > size[2];
  // Quaternion for +90 degrees about Y: [0, sin(45), 0, cos(45)].
  const rotation = turn ? [0, Math.SQRT1_2, 0, Math.SQRT1_2] : [0, 0, 0, 1];
  // After the rotation, local (x, z) maps to (z, -x); the recentring offset must be rotated too.
  const ox = turn ? cz : cx;
  const oz = turn ? -cx : cz;
  wrapper.setRotation(rotation);
  wrapper.setScale([scale, scale, scale]);
  wrapper.setTranslation([-ox * scale, -bounds.min[1] * scale, -oz * scale]);
  scene.addChild(wrapper);
  return { wrapper, size: turn ? [size[2], size[1], size[0]] : size };
}

/** Removes everything that is not inside the kept wrappers, then drops unused resources. */
async function keepOnly(doc, scene, wrappers) {
  const keep = new Set();
  for (const wrapper of wrappers) wrapper.traverse((node) => keep.add(node));
  for (const child of scene.listChildren()) if (!keep.has(child)) scene.removeChild(child);
  for (const node of doc.getRoot().listNodes()) if (!keep.has(node)) node.dispose();
  await doc.transform(prune());
}

async function resizeTextures(doc) {
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const normals = new Set(doc.getRoot().listMaterials().map((m) => m.getNormalTexture()).filter(Boolean));
  for (const texture of doc.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    let pipeline = sharp(image);
    const meta = await sharp(image).metadata();
    if (Math.max(meta.width || 0, meta.height || 0) > MAX_TEXTURE_SIZE) {
      pipeline = pipeline.resize({ width: MAX_TEXTURE_SIZE, height: MAX_TEXTURE_SIZE, fit: "inside" });
    }
    const webp = await pipeline.webp({ quality: normals.has(texture) ? 90 : WEBP_QUALITY, effort: 4 }).toBuffer();
    texture.setImage(webp);
    texture.setMimeType("image/webp");
    if (texture.getURI()) texture.setURI(texture.getURI().replace(/\.[a-z]+$/i, ".webp"));
  }
}

async function finish(doc, outputPath, maxBytes) {
  // Merged documents bring their own buffers; a GLB can hold only one.
  const [firstBuffer, ...otherBuffers] = doc.getRoot().listBuffers();
  for (const accessor of doc.getRoot().listAccessors()) accessor.setBuffer(firstBuffer);
  otherBuffers.forEach((buffer) => buffer.dispose());
  await resizeTextures(doc);
  await doc.transform(
    prune(),
    dedup(),
    weld({ tolerance: 0.0001 }),
    quantize(),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await makeIO().write(outputPath, doc);
  const bytes = fs.statSync(outputPath).size;
  console.log(`  -> ${path.relative(process.cwd(), outputPath)}: ${formatBytes(bytes)}`);
  if (bytes > maxBytes) {
    console.error(`ERROR: output is above ${formatBytes(maxBytes)}`);
    process.exit(1);
  }
}

function listPieces(scene) {
  return scene.listChildren().map((node) => `${node.getName()} (${Math.round(triangles(node))} tris)`);
}

async function buildDistrict() {
  console.log("\n=== City district ===");
  const io = makeIO();
  const out = new Document();
  out.createBuffer();
  const outScene = out.createScene("City");

  const mergeKept = async (doc, scene, wrappers) => {
    await keepOnly(doc, scene, wrappers);
    const map = mergeDocuments(out, doc);
    // Move the merged wrappers into the output scene and drop the merged (empty) scenes.
    for (const mergedScene of doc.getRoot().listScenes()) {
      const mapped = map.get(mergedScene);
      for (const child of mapped.listChildren()) {
        mapped.removeChild(child);
        outScene.addChild(child);
      }
    }
    for (const sceneInOut of out.getRoot().listScenes()) if (sceneInOut !== outScene) sceneInOut.dispose();
  };

  // --- Low Poly City Game-Ready ---
  {
    const file = findSource("low_poly_city_game-ready.glb");
    console.log("Game-Ready:", file);
    const doc = await io.read(file);
    const scene = doc.getRoot().listScenes()[0];
    const nodes = doc.getRoot().listNodes();
    const wrappers = [];
    for (const prefix of GR_PREFIXES) {
      const node = nodes.find((n) => n.getName().startsWith(prefix));
      if (!node) {
        console.warn(`  missing ${prefix}`);
        continue;
      }
      const id = prefix.replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/g, "").toLowerCase();
      wrappers.push(wrapPiece(doc, scene, `gr_${id}`, [node], 1, false).wrapper);
    }
    await mergeKept(doc, scene, wrappers);
  }

  // --- Low Poly City ---
  {
    const file = findSource("low_poly_city.glb");
    console.log("Low Poly City:", file);
    const doc = await io.read(file);
    const scene = doc.getRoot().listScenes()[0];
    const nodes = doc.getRoot().listNodes();
    const wrappers = [];
    for (const id of LP_BUILDINGS) {
      const node = nodes.find((n) => n.getName().startsWith(`Building_${id}_Color`));
      if (!node) {
        console.warn(`  missing Building_${id}`);
        continue;
      }
      wrappers.push(wrapPiece(doc, scene, `lp_building_${id.replace(".", "_")}`, [node], 1, false).wrapper);
    }
    LP_TREES.forEach((name, index) => {
      const node = nodes.find((n) => n.getName() === name);
      if (!node) return console.warn(`  missing ${name}`);
      wrappers.push(wrapPiece(doc, scene, `lp_tree_${index}`, [node], 1, false).wrapper);
    });
    await mergeKept(doc, scene, wrappers);
  }

  // --- Low Poly City Asset Pack ---
  {
    const file = findSource("low_poly_city_asset_pack.glb");
    console.log("Asset Pack:", file);
    const doc = await io.read(file);
    const scene = doc.getRoot().listScenes()[0];
    const nodes = doc.getRoot().listNodes();
    const wrappers = [];
    for (const group of AP_GROUPS) {
      // Top-most nodes of the group: `B1_Base`, `B1_Details`, ... or the single `Shop1`.
      const parts = nodes.filter((n) => {
        const name = n.getName();
        const parent = n.getParentNode();
        const isPart = name === group || name.startsWith(`${group}_`);
        return isPart && !(parent && (parent.getName() === group || parent.getName().startsWith(`${group}_`)));
      });
      if (parts.length === 0) {
        console.warn(`  missing ${group}`);
        continue;
      }
      wrappers.push(wrapPiece(doc, scene, `ap_${group.toLowerCase()}`, parts, AP_SCALE, false).wrapper);
    }
    await mergeKept(doc, scene, wrappers);
  }

  console.log("Pieces:");
  listPieces(outScene).forEach((line) => console.log("  ", line));
  await finish(out, path.join(OUTPUT_DIR, "city-district.optimized.glb"), MAX_DISTRICT_BYTES);
}

async function buildCars() {
  console.log("\n=== Cars ===");
  const io = makeIO();
  const file = findSource("low_poly_cars_pack.glb");
  console.log("Cars pack:", file);
  const doc = await io.read(file);
  const scene = doc.getRoot().listScenes()[0];
  const wrappers = [];
  const meshNodes = doc.getRoot().listNodes().filter((n) => n.getMesh());
  for (const node of meshNodes) {
    const bounds = getBounds(node);
    const size = [0, 1, 2].map((i) => bounds.max[i] - bounds.min[i]);
    // Cars are 1.4 to 2.5 m wide and 3 to 5.5 m long; the pack's ground, lines and borders
    // are far larger, so anything over 6.5 m in a horizontal direction is not a car.
    const long = Math.max(size[0], size[2]);
    const short = Math.min(size[0], size[2]);
    if (long > 6.5 || short < 1.2 || size[1] < 0.9 || size[1] > 2.4) continue;
    const id = String(wrappers.length).padStart(2, "0");
    wrappers.push(wrapPiece(doc, scene, `car_${id}`, [node], 1, true).wrapper);
  }
  console.log(`  ${wrappers.length} cars of ${meshNodes.length} meshes`);
  await keepOnly(doc, scene, wrappers);
  console.log("Pieces:");
  listPieces(scene).forEach((line) => console.log("  ", line));
  await finish(doc, path.join(OUTPUT_DIR, "city-cars.optimized.glb"), MAX_CARS_BYTES);
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await buildDistrict();
  await buildCars();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

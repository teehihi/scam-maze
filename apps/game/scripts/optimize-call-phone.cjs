/**
 * SCAMMAZE call phone optimization pipeline (spec `game-3d-phone-call-ui`, task 2.1).
 *
 * Input:  apps/game/public/assets/3d/props/phone/iphone-17-pro.glb (never modified)
 * Output: apps/game/public/assets/3d/optimized/call-phone.optimized.glb
 *
 * Steps:
 * 1. Print the primitive inventory (mesh, material, triangle count, bounds).
 * 2. Remove the primitives listed in REMOVE_PRIMITIVES (mesh name + material name).
 * 3. Branding fixes: remove the `wallpaper` textures from the `OLED` material, set its base
 *    color to the linear BRAND.navy factor and its emissive to black; rename the nodes and
 *    meshes to `CallPhoneBody` and `CallPhoneFront` so no name contains the product name.
 * 4. Textures: at most 1024 px, WebP quality 90 for normal maps and 85 for color,
 *    EXT_texture_webp required.
 * 5. prune, dedup, weld (0.0001), quantize, reorder, meshopt (medium). No decimation.
 * 6. Write the output, print the sizes, exit with code 1 above 5,242,880 bytes.
 *
 * Run from the workspace root: node apps/game/scripts/optimize-call-phone.cjs
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const { prune, dedup, weld, reorder, quantize, meshopt } = require("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

const INPUT_PATH = path.resolve(__dirname, "../public/assets/3d/props/phone/iphone-17-pro.glb");
const OUTPUT_DIR = path.resolve(__dirname, "../public/assets/3d/optimized");
const OUTPUT_PATH = path.resolve(OUTPUT_DIR, "call-phone.optimized.glb");

/** Size gate from Requirement 9.2 (5 MB). */
const MAX_OUTPUT_BYTES = 5_242_880;
/** Largest texture side after resizing. */
const MAX_TEXTURE_SIZE = 1024;
const WEBP_QUALITY_NORMAL = 90;
const WEBP_QUALITY_COLOR = 85;

/** Screen material and the texture that is removed from it. */
const SCREEN_MATERIAL = "OLED";
const WALLPAPER_TEXTURE = "wallpaper";
/** BRAND.navy (#1D1B2B) as a linear color factor. */
const SCREEN_BASE_COLOR = [0.0123, 0.011, 0.025, 1];
const SCREEN_EMISSIVE = [0, 0, 0];

/** New names: the node and mesh holding the screen become the front, the other the body. */
const FRONT_NAME = "CallPhoneFront";
const BODY_NAME = "CallPhoneBody";
/** Names that must not appear in any node, mesh or scene name of the output. */
const FORBIDDEN_NAME_PATTERNS = [/iphone/i, /17\s*pro/i, /apple/i];

/**
 * Primitives to remove, matched by the new mesh name and the material name, for example
 * `{ mesh: "CallPhoneBody", material: "Logo" }`. Empty today: no logo primitive was found in
 * the data. The manual back-render check may add an entry here.
 */
const REMOVE_PRIMITIVES = [];

function triangleCount(prim) {
  const indices = prim.getIndices();
  if (indices) return indices.getCount() / 3;
  const position = prim.getAttribute("POSITION");
  return position ? position.getCount() / 3 : 0;
}

function formatBounds(prim) {
  const position = prim.getAttribute("POSITION");
  if (!position) return "no POSITION";
  const min = position.getMin([]).map((v) => v.toFixed(5));
  const max = position.getMax([]).map((v) => v.toFixed(5));
  return `min [${min.join(", ")}] max [${max.join(", ")}]`;
}

function formatBytes(bytes) {
  return `${(bytes / 1048576).toFixed(2)} MB (${bytes.toLocaleString("en-US")} bytes)`;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

async function optimizeCallPhone() {
  if (!fs.existsSync(INPUT_PATH)) fail(`Input not found: ${INPUT_PATH}`);
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const inputBytes = fs.statSync(INPUT_PATH).size;
  console.log("=== SCAMMAZE CALL PHONE OPTIMIZER ===");
  console.log("Source:", INPUT_PATH);
  console.log("Source size:", formatBytes(inputBytes));

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

  const doc = await io.read(INPUT_PATH);
  const root = doc.getRoot();

  // [1/6] Rename nodes and meshes, then print the inventory with old and new names.
  console.log("\n[1/6] Renaming nodes and meshes...");
  const meshNodes = root.listNodes().filter((node) => node.getMesh());
  const frontNodes = meshNodes.filter((node) =>
    node
      .getMesh()
      .listPrimitives()
      .some((prim) => prim.getMaterial() && prim.getMaterial().getName() === SCREEN_MATERIAL),
  );
  if (meshNodes.length !== 2 || frontNodes.length !== 1) {
    fail(`Expected 2 mesh nodes with 1 holding "${SCREEN_MATERIAL}", found ${meshNodes.length} and ${frontNodes.length}.`);
  }
  const originalMeshNames = new Map();
  for (const node of meshNodes) {
    const mesh = node.getMesh();
    const newName = node === frontNodes[0] ? FRONT_NAME : BODY_NAME;
    originalMeshNames.set(mesh, mesh.getName());
    console.log(`  node "${node.getName()}" / mesh "${mesh.getName()}" -> "${newName}"`);
    node.setName(newName);
    mesh.setName(newName);
  }

  console.log("\nPrimitive inventory (source mesh -> new mesh | material | triangles | bounds):");
  let totalTriangles = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial() ? prim.getMaterial().getName() : "(none)";
      const tris = triangleCount(prim);
      totalTriangles += tris;
      console.log(
        `  ${originalMeshNames.get(mesh) || mesh.getName()} -> ${mesh.getName()} | ${material} | ${tris.toLocaleString("en-US")} | ${formatBounds(prim)}`,
      );
    }
  }
  console.log(`Total triangles: ${totalTriangles.toLocaleString("en-US")}`);

  // [2/6] Remove listed primitives.
  console.log("\n[2/6] Applying REMOVE_PRIMITIVES...");
  let removed = 0;
  for (const entry of REMOVE_PRIMITIVES) {
    for (const mesh of root.listMeshes().filter((m) => m.getName() === entry.mesh)) {
      for (const prim of mesh.listPrimitives()) {
        const material = prim.getMaterial();
        if (material && material.getName() === entry.material) {
          mesh.removePrimitive(prim);
          prim.dispose();
          removed++;
        }
      }
    }
  }
  console.log(`  ${REMOVE_PRIMITIVES.length} entries, ${removed} primitive(s) removed`);

  // [3/6] Screen branding fix.
  console.log("\n[3/6] Replacing the screen wallpaper...");
  const screen = root.listMaterials().find((m) => m.getName() === SCREEN_MATERIAL);
  if (!screen) fail(`Material "${SCREEN_MATERIAL}" not found.`);
  const oldBase = screen.getBaseColorTexture();
  const oldEmissive = screen.getEmissiveTexture();
  console.log(
    `  ${SCREEN_MATERIAL}: base color texture "${oldBase ? oldBase.getName() : "none"}", emissive texture "${oldEmissive ? oldEmissive.getName() : "none"}" removed`,
  );
  screen.setBaseColorTexture(null);
  screen.setEmissiveTexture(null);
  screen.setBaseColorFactor(SCREEN_BASE_COLOR);
  screen.setEmissiveFactor(SCREEN_EMISSIVE);
  console.log(`  ${SCREEN_MATERIAL}: base color [${SCREEN_BASE_COLOR.join(", ")}], emissive [${SCREEN_EMISSIVE.join(", ")}]`);
  // Dispose the wallpaper texture if nothing else uses it (prune would also drop it).
  for (const texture of [oldBase, oldEmissive]) {
    if (texture && !texture.isDisposed() && texture.listParents().every((p) => p === root)) {
      texture.dispose();
    }
  }

  // [4/6] Textures.
  console.log("\n[4/6] Resizing and encoding textures to WebP...");
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const normalTextures = new Set(root.listMaterials().map((m) => m.getNormalTexture()).filter(Boolean));
  for (const texture of root.listTextures()) {
    const image = texture.getImage();
    if (!image) continue;
    const meta = await sharp(image).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    let pipeline = sharp(image);
    if (Math.max(width, height) > MAX_TEXTURE_SIZE) {
      pipeline = pipeline.resize({ width: MAX_TEXTURE_SIZE, height: MAX_TEXTURE_SIZE, fit: "inside" });
    }
    const isNormal = normalTextures.has(texture);
    const quality = isNormal ? WEBP_QUALITY_NORMAL : WEBP_QUALITY_COLOR;
    const webp = await pipeline.webp({ quality, effort: 4 }).toBuffer();
    const outMeta = await sharp(webp).metadata();
    texture.setImage(webp);
    texture.setMimeType("image/webp");
    if (texture.getURI()) texture.setURI(texture.getURI().replace(/\.[a-z]+$/i, ".webp"));
    console.log(
      `  ${texture.getName() || "unnamed"} (${isNormal ? "normal" : "color"}, q${quality}): ${width}x${height} -> ${outMeta.width}x${outMeta.height}, ${(image.length / 1024).toFixed(1)} KB -> ${(webp.length / 1024).toFixed(1)} KB`,
    );
  }

  // [5/6] Graph transforms.
  console.log("\n[5/6] prune, dedup, weld, quantize, reorder, meshopt...");
  await doc.transform(
    prune(),
    dedup(),
    weld({ tolerance: 0.0001 }),
    quantize(),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  // Checks before writing.
  if (root.listTextures().some((t) => (t.getName() || "").toLowerCase() === WALLPAPER_TEXTURE)) {
    fail(`Texture "${WALLPAPER_TEXTURE}" is still present.`);
  }
  const named = [...root.listNodes(), ...root.listMeshes(), ...root.listScenes()];
  const badNames = named.map((p) => p.getName()).filter((n) => FORBIDDEN_NAME_PATTERNS.some((re) => re.test(n)));
  if (badNames.length > 0) fail(`Names still contain the product name: ${badNames.join(", ")}`);

  // [6/6] Write and gate.
  console.log("\n[6/6] Writing", OUTPUT_PATH);
  await io.write(OUTPUT_PATH, doc);
  const outputBytes = fs.statSync(OUTPUT_PATH).size;

  console.log("\n=== RESULT ===");
  console.log("Before:", formatBytes(inputBytes));
  console.log("After: ", formatBytes(outputBytes));
  console.log("Limit: ", formatBytes(MAX_OUTPUT_BYTES));
  console.log("Textures:", root.listTextures().map((t) => t.getName() || "unnamed").join(", "));
  if (outputBytes > MAX_OUTPUT_BYTES) {
    fail(`Output is above the ${MAX_OUTPUT_BYTES.toLocaleString("en-US")} byte limit.`);
  }
  console.log("Size gate passed.");
}

optimizeCallPhone().catch((err) => {
  console.error("Optimization failed:", err);
  process.exit(1);
});

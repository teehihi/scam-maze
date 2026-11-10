/**
 * SCAMMAZE Main Menu 3D Asset Optimization Pipeline
 *
 * Implements Phase Two:
 * - Dead/hidden geometry removal
 * - Selective decimation of over-tesselated background meshes (preserving foreground detail)
 * - Texture downscaling and EXT_texture_webp encoding
 * - Vertex welding, attribute quantization, cache reordering, and EXT_meshopt_compression
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP, EXTMeshoptCompression } = require("@gltf-transform/extensions");
const {
  simplifyPrimitive,
  prune,
  dedup,
  weld,
  reorder,
  quantize,
  meshopt
} = require("@gltf-transform/functions");
const { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

async function optimizeMenuBG() {
  const inputPath = path.resolve(__dirname, "../public/assets/3d/environments/MenuBG.glb");
  const outputDir = path.resolve(__dirname, "../public/assets/3d/optimized");
  const outputPath = path.resolve(outputDir, "MenuBG.optimized.glb");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const inStats = fs.statSync(inputPath);
  console.log("=== SCAMMAZE 3D ASSET OPTIMIZER ===");
  console.log("Source:", inputPath);
  console.log("Source Size:", (inStats.size / 1048576).toFixed(2), "MB (" + inStats.size + " bytes)");

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
      "meshopt.decoder": MeshoptDecoder,
    });

  console.log("\n[1/6] Loading source GLB with glTF-Transform...");
  const t0 = Date.now();
  const doc = await io.read(inputPath);
  console.log("Loaded in", ((Date.now() - t0) / 1000).toFixed(2), "s");
  const root = doc.getRoot();

  // Create WebP extension
  const webpExt = doc.createExtension(EXTTextureWebP).setRequired(true);

  // [2/6] Remove dead / hidden nodes
  console.log("\n[2/6] Removing dead and hidden nodes...");
  let deadNodes = 0;
  root.listNodes().forEach((node) => {
    const name = node.getName() || "";
    if (name.includes("19_6_2025") || name.toLowerCase().includes("ai guy")) {
      node.dispose();
      deadNodes++;
    }
  });
  console.log(`Disposed ${deadNodes} dead node(s)`);

  // [3/6] Selective simplification of background over-tessellated meshes
  console.log("\n[3/6] Selectively simplifying over-tessellated background meshes...");
  let simplifiedCount = 0;
  let beforeTris = 0;
  let afterTris = 0;

  root.listNodes().forEach((node) => {
    const name = node.getName() || "";
    const mesh = node.getMesh();
    if (!mesh) return;

    // 1. Penguin trash bin on sidewalk (1.5M tris -> ~18k)
    if (name.includes("bin")) {
      mesh.listPrimitives().forEach((prim) => {
        const count = prim.getIndices().getCount() / 3;
        beforeTris += count;
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.012, error: 0.005 });
        afterTris += prim.getIndices().getCount() / 3;
        simplifiedCount++;
      });
    }
    // 2. Male background pedestrian (1.5M tris -> ~30k)
    else if (name.includes("20261110000447_177df9df")) {
      mesh.listPrimitives().forEach((prim) => {
        const count = prim.getIndices().getCount() / 3;
        beforeTris += count;
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.02, error: 0.005 });
        afterTris += prim.getIndices().getCount() / 3;
        simplifiedCount++;
      });
    }
    // 3. Bitexco building base cube (496k tris -> ~7k)
    else if (name === "Cube" && mesh.getName() === "Cube.001") {
      mesh.listPrimitives().forEach((prim) => {
        const count = prim.getIndices().getCount() / 3;
        beforeTris += count;
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.015, error: 0.005 });
        afterTris += prim.getIndices().getCount() / 3;
        simplifiedCount++;
      });
    }
    // 4. Distant street hedge (152k tris -> ~25k)
    else if (name.includes("Hedge") && mesh.getName().includes("LONG skinny")) {
      mesh.listPrimitives().forEach((prim) => {
        const count = prim.getIndices().getCount() / 3;
        beforeTris += count;
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.18, error: 0.005 });
        afterTris += prim.getIndices().getCount() / 3;
        simplifiedCount++;
      });
    }
    // 5. Secondary cube prop (147k tris -> ~10k)
    else if (name.includes("Cube.007") && mesh.getName() === "Cube.011") {
      mesh.listPrimitives().forEach((prim) => {
        const count = prim.getIndices().getCount() / 3;
        beforeTris += count;
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.07, error: 0.005 });
        afterTris += prim.getIndices().getCount() / 3;
        simplifiedCount++;
      });
    }
  });

  // [3.5/6] Round 2 Deep Vehicle & Background Prop Decimation
  console.log("\n[3.5/6] Round 2: Decimating heavy vehicle hierarchies (VF3, Lexus, PCX, Fence, Pedestrians)...");
  const targetParentNames = ["vinfast", "PCX", "lexus", "Fence", "rp_mei"];
  const targetMeshes = new Set();

  function collectMeshes(node) {
    let list = [];
    const mesh = node.getMesh();
    if (mesh) list.push(mesh);
    for (const c of node.listChildren()) {
      list = list.concat(collectMeshes(c));
    }
    return list;
  }

  root.listNodes().forEach((n) => {
    if (targetParentNames.some((t) => n.getName().includes(t))) {
      collectMeshes(n).forEach((m) => targetMeshes.add(m));
    }
  });

  targetMeshes.forEach((m) => {
    m.listPrimitives().forEach((prim) => {
      const count = prim.getIndices().getCount() / 3;
      beforeTris += count;
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0.22, error: 0.005 });
      afterTris += prim.getIndices().getCount() / 3;
      simplifiedCount++;
    });
  });

  console.log(`Simplified ${simplifiedCount} primitives: ${beforeTris.toLocaleString()} tris -> ${afterTris.toLocaleString()} tris (saved ${(beforeTris - afterTris).toLocaleString()} triangles)`);

  // [4/6] Optimize textures with sharp & EXT_texture_webp
  console.log("\n[4/6] Resizing and compressing textures to WebP...");
  const textures = root.listTextures();
  let textureCount = 0;
  let totalOrigTexBytes = 0;
  let totalOptTexBytes = 0;

  for (const texture of textures) {
    const rawImage = texture.getImage();
    if (!rawImage) continue;

    totalOrigTexBytes += rawImage.length;
    textureCount++;

    const isNormal = root.listMaterials().some((m) => m.getNormalTexture() === texture);
    const isOcclusionOrMetalRough = root.listMaterials().some(
      (m) => m.getMetallicRoughnessTexture() === texture || m.getOcclusionTexture() === texture
    );

    const meta = await sharp(rawImage).metadata();
    const maxDim = Math.max(meta.width || 0, meta.height || 0);

    let pipeline = sharp(rawImage);

    // Downscale oversized textures: normal maps to 1024, other textures to 1536 max dimension
    const targetMaxDim = isNormal ? Math.min(maxDim, 1024) : Math.min(maxDim, 1536);
    if (targetMaxDim < maxDim) {
      pipeline = pipeline.resize({
        width: Math.round((meta.width / maxDim) * targetMaxDim),
        height: Math.round((meta.height / maxDim) * targetMaxDim),
        fit: "inside",
      });
    }

    let webpBuffer;
    if (isNormal) {
      // High-quality WebP for normal maps (near-lossless 90 to prevent 4MB bloat while preserving smooth normals)
      webpBuffer = await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
    } else if (isOcclusionOrMetalRough) {
      // Lossless WebP for metal/rough/ao channel accuracy
      webpBuffer = await pipeline.webp({ lossless: true, effort: 4 }).toBuffer();
    } else {
      // High-quality lossy WebP for baseColor and emissive
      webpBuffer = await pipeline.webp({ quality: 84, effort: 4 }).toBuffer();
    }

    totalOptTexBytes += webpBuffer.length;
    texture.setImage(webpBuffer);
    texture.setMimeType("image/webp");

    const reductionPct = (((rawImage.length - webpBuffer.length) / rawImage.length) * 100).toFixed(1);
    console.log(`  [Texture ${textureCount}/${textures.length}] ${texture.getName() || "unnamed"} (${maxDim}x${maxDim} -> ${targetMaxDim}x${targetMaxDim}): ${(rawImage.length / 1024).toFixed(1)} KB -> ${(webpBuffer.length / 1024).toFixed(1)} KB (-${reductionPct}%)`);
  }

  console.log(`Textures summary: ${(totalOrigTexBytes / 1048576).toFixed(2)} MB -> ${(totalOptTexBytes / 1048576).toFixed(2)} MB`);

  // [5/6] Scene graph deduplication, attribute quantization & meshopt compression
  console.log("\n[5/6] Applying glTF-Transform graph transforms (prune, dedup, weld, quantize, reorder, meshopt)...");
  await doc.transform(
    prune(),
    dedup(),
    weld({ tolerance: 0.0001 }),
    quantize(),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" })
  );

  // [6/6] Write optimized GLB
  console.log("\n[6/6] Writing optimized output GLB to:", outputPath);
  await io.write(outputPath, doc);

  const outStats = fs.statSync(outputPath);
  const reductionBytes = inStats.size - outStats.size;
  const reductionPct = ((reductionBytes / inStats.size) * 100).toFixed(2);

  console.log("\n=========================================");
  console.log("=== OPTIMIZATION COMPLETE ===");
  console.log("Original File Size:  " + (inStats.size / 1048576).toFixed(2) + " MB (" + inStats.size.toLocaleString() + " bytes)");
  console.log("Optimized File Size: " + (outStats.size / 1048576).toFixed(2) + " MB (" + outStats.size.toLocaleString() + " bytes)");
  console.log("Storage Saved:       " + (reductionBytes / 1048576).toFixed(2) + " MB (-" + reductionPct + "%)");
  console.log("=========================================\n");

  // Output stats JSON
  const summary = {
    originalPath: inputPath,
    optimizedPath: outputPath,
    originalSizeBytes: inStats.size,
    optimizedSizeBytes: outStats.size,
    reductionRatio: reductionPct + "%",
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.resolve(outputDir, "optimization-report.json"),
    JSON.stringify(summary, null, 2)
  );
}

optimizeMenuBG().catch((err) => {
  console.error("Optimization failed:", err);
  process.exit(1);
});

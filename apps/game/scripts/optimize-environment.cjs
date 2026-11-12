/**
 * SCAMMAZE Main Menu 3D Asset Optimization Pipeline
 *
 * Implements:
 * - Dead/hidden geometry removal
 * - Selective decimation of over-tesselated background meshes (preserving foreground detail)
 * - Decimation of heavy props: tramdoipin (6M tris), tudien (1.5M tris), bin (1.5M tris), vehicles (2.1M tris), electricity poles
 * - Texture downscaling and EXT_texture_webp encoding
 * - Vertex welding, attribute quantization, cache reordering, and EXT_meshopt_compression
 */

const fs = require("fs");
const path = require("path");
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTTextureWebP } = require("@gltf-transform/extensions");
const {
  simplifyPrimitive,
  prune,
  dedup,
  weld,
  reorder,
  quantize,
  meshopt,
} = require("@gltf-transform/functions");
const { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");

async function optimizeMenuBG() {
  let inputPath = "/Users/tee/UTE/Kiroween/Asset3D/MenuBG2.glb";
  if (!fs.existsSync(inputPath)) {
    inputPath = path.resolve(__dirname, "../assets-src/environments/MenuBG2.glb");
  }
  if (!fs.existsSync(inputPath)) {
    inputPath = path.resolve(__dirname, "../assets-src/environments/MenuBG.glb");
  }

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

  // Ensure WebP extension is active
  doc.createExtension(EXTTextureWebP).setRequired(true);

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

  // [3/6] Selective simplification of background and heavy props
  console.log("\n[3/6] Selectively simplifying heavy background meshes & props...");
  let simplifiedCount = 0;
  let beforeTris = 0;
  let afterTris = 0;

  function collectMeshes(node) {
    let list = [];
    const mesh = node.getMesh();
    if (mesh) list.push(mesh);
    for (const c of node.listChildren()) {
      list = list.concat(collectMeshes(c));
    }
    return list;
  }

  // Rules: [pattern, ratio, error]
  const decimationRules = [
    { pattern: "tramdoipin", ratio: 0.008, error: 0.005 }, // 6M -> ~48k
    { pattern: "tudien", ratio: 0.015, error: 0.005 },     // 1.5M -> ~22k
    { pattern: "bin", ratio: 0.012, error: 0.005 },        // 1.5M -> ~18k
    { pattern: "people", ratio: 0.02, error: 0.005 },      // 1.6M -> ~32k
    { pattern: "rp_mei", ratio: 0.02, error: 0.005 },
    { pattern: "20261110", ratio: 0.02, error: 0.005 },
    { pattern: "vehicles", ratio: 0.18, error: 0.005 },    // 2.1M -> ~380k
    { pattern: "vinfast", ratio: 0.15, error: 0.005 },
    { pattern: "lexus", ratio: 0.15, error: 0.005 },
    { pattern: "pcx", ratio: 0.15, error: 0.005 },
    { pattern: "fence", ratio: 0.04, error: 0.005 },       // 1.2M -> ~48k
    { pattern: "bitexco", ratio: 0.03, error: 0.005 },     // 692k -> ~20k
    { pattern: "electricity", ratio: 0.10, error: 0.005 }, // 365k -> ~36k
  ];

  const processedMeshes = new Set();

  root.listNodes().forEach((node) => {
    const nodeName = (node.getName() || "").toLowerCase();
    for (const rule of decimationRules) {
      if (nodeName.includes(rule.pattern)) {
        const meshes = collectMeshes(node);
        meshes.forEach((m) => {
          if (!processedMeshes.has(m)) {
            processedMeshes.add(m);
            m.listPrimitives().forEach((prim) => {
              const idx = prim.getIndices();
              if (idx) {
                const count = idx.getCount() / 3;
                beforeTris += count;
                try {
                  simplifyPrimitive(prim, {
                    simplifier: MeshoptSimplifier,
                    ratio: rule.ratio,
                    error: rule.error,
                  });
                } catch (err) {
                  // Silently keep primitive if simplifier cannot reduce further
                }
                afterTris += prim.getIndices().getCount() / 3;
                simplifiedCount++;
              }
            });
          }
        });
        break;
      }
    }
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
      webpBuffer = await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
    } else if (isOcclusionOrMetalRough) {
      webpBuffer = await pipeline.webp({ lossless: true, effort: 4 }).toBuffer();
    } else {
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

#!/usr/bin/env node
// Hook B: world and rendering change review.
// Runs when an agent saves a rendering or map file. It does NOT profile or build anything; it only
// scans the lines added since HEAD in changed world files for known risk patterns in this repo:
// another WebGLRenderer / GLTF loader / AudioContext (each already exists several times), GPU
// resources in a file with no dispose, listeners with no removal, and global quality cuts.
// Findings are heuristics: they ask for a justification, they do not prove a bug.
// Exit 1 (shown as a hook warning) when there are findings; silent otherwise. Runs in < 1 s.
import { addedLines, changedFiles, readRepoFile } from "./lib.mjs";

const WORLD_PATHS =
  /^apps\/game\/src\/(features\/(hue|mientay|ueh|testmove|vehicle|player|chapter1\/world)\/|game\/(scenes|core)\/|features\/chapter1\/ChapterOneCanvas\.tsx)/;
const SOURCE = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\.tsx?$/;

/** Files that are the documented owners of a responsibility (no warning there). */
const OWNERS = {
  renderer: [/hue\/engine\/HueWorldEngine\.ts$/, /mientay\/engine\/MekongWorldEngine\.ts$/],
  loader: [/MainMenuScene\/streetGltfLoader\.ts$/, /CityBackdrop\/CityBackdrop\.tsx$/, /vehicle\/LexusVehicle\.tsx$/],
};

const CHECKS = [
  {
    id: "renderer",
    pattern: /new\s+(THREE\.)?WebGLRenderer\s*\(/,
    message:
      "New WebGLRenderer. Six renderer setups already exist (GameCanvas, ChapterOneCanvas, TestMove, UEH, Hue, Mekong). Reuse an existing one or document why a new context is needed (each context costs GPU memory).",
  },
  {
    id: "loader",
    pattern: /new\s+GLTFLoader\s*\(|setMeshoptDecoder\s*\(/,
    message:
      "New GLTF loader setup. Meshopt loaders already exist in streetGltfLoader.ts, CityBackdrop.tsx and LexusVehicle.tsx; reuse one so R3F's cache is shared.",
  },
  {
    id: "audio",
    pattern: /new\s+(window\.)?(AudioContext|webkitAudioContext)\s*\(/,
    message: "New AudioContext. Seven or more already exist; browsers limit them. Reuse an existing audio engine if possible.",
  },
  {
    id: "quality",
    pattern: /shadowMap\.enabled\s*=\s*false|antialias\s*:\s*false|castShadow\s*=\s*false\s*;?\s*$|setPixelRatio\(\s*0?\.\d/,
    message:
      "Global quality reduction (shadows, antialias or pixel ratio). visual-quality.md: do not cut quality globally; scope the change, keep it behind graphicsQuality, and record a measurement.",
  },
];

const findings = [];
for (const path of changedFiles()) {
  if (!WORLD_PATHS.test(path) || !SOURCE.test(path) || TEST_FILE.test(path)) continue;
  const added = addedLines(path);
  if (added.length === 0) continue;
  const addedText = added.join("\n");
  const whole = readRepoFile(path);

  for (const check of CHECKS) {
    if ((OWNERS[check.id] ?? []).some((owner) => owner.test(path))) continue;
    const hit = added.find((line) => check.pattern.test(line));
    if (hit) findings.push(`${path}: ${check.message}\n    + ${hit.trim().slice(0, 140)}`);
  }

  // GPU resources created in this change, but the file never disposes anything.
  if (/new\s+(THREE\.)?\w*(Geometry|Material|Texture|RenderTarget)\s*\(/.test(addedText) && !/\.dispose\s*\(/.test(whole)) {
    findings.push(
      `${path}: creates geometries, materials, textures or render targets but has no dispose(). Free them on unmount (R3F frees JSX-created objects, not ones made with new in hooks or classes).`,
    );
  }
  // Listeners added in this change without any removal in the file.
  if (/addEventListener\s*\(/.test(addedText) && !/removeEventListener\s*\(/.test(whole)) {
    findings.push(`${path}: adds an event listener but never calls removeEventListener (leaks across route changes).`);
  }
}

if (findings.length === 0) process.exit(0);
console.log(
  `[world-check] ${findings.length} item(s) to review (heuristics; justify or fix):\n- ${findings.join("\n- ")}\n` +
    "Measure before claiming a performance gain (see .kiro/steering/visual-quality.md).",
);
process.exit(1);

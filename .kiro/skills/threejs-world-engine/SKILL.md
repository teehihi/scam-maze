---
name: threejs-world-engine
description: "How the SCAMMAZE 3D worlds are built and how to change them safely - R3F canvases vs the Hue and Mekong engine classes, renderer and quality tiers, asset loading and GLTF caching, instancing, merging, chunking and culling, resource disposal, context loss and how to measure performance. Use when editing maps, rendering, lighting, assets or performance."
---

# Three.js world engine knowledge

Current architecture summary: `.kiro/steering/architecture.md`. Visual rules:
`.kiro/steering/visual-quality.md`. Roadmap: `.kiro/specs/shared-world-engine/`.

## Where things are

| Map | Host | Entry |
|---|---|---|
| Menu street | R3F | `game/core/GameCanvas.tsx`, `game/scenes/MainMenuScene/*` |
| Chapter 1 | R3F (second canvas, menu canvas paused underneath) | `features/chapter1/ChapterOneCanvas.tsx` |
| `/testmove`, `/ueh` | R3F | `features/testmove/TestMoveCanvas.tsx`, `features/ueh/UEHCanvas.tsx` |
| `/hue` | `HueWorldEngine` class | `features/hue/HuePage.tsx`, `features/hue/engine/` |
| `/mientay` | `MekongWorldEngine` class (async `create`) | `features/mientay/MientayPage.tsx`, `features/mientay/engine/`, `world/` |

Shared: `features/player` (`CharacterRuntime`, `FirstPersonPlayer`, `usePlayerControls`,
`GameWorldAdapter`), `features/vehicle`, `config/assetPaths.ts`, `graphicsQuality` from settings.

## Safe-change checklist

1. Cached GLTF scenes (`useLoader`, drei `useGLTF`) are shared objects. If two canvases or two
   instances render one, clone it (`scene.clone(true)` shares geometry and materials). Building a
   rig into the cached scene mutates it for everyone.
2. Everything made with `new` (geometry, material, texture, render target, composer, PMREM) needs
   `dispose()` on unmount; every `addEventListener` needs a `removeEventListener`. Engine classes
   already have `dispose()` traversals; extend them.
3. Reuse loaders: `StreetGLTFLoader` / `streetLoaderExtensions` (Meshopt + byte progress),
   `CityBackdrop` loader, `LexusVehicle` loader. No KTX2/Draco is configured.
4. Many copies of a mesh: `InstancedMesh`; many static meshes with one material:
   `mientay/world/optimize/mergeStaticMeshes.ts`; large instanced sets: `spatialChunking.ts`.
5. Quality: change cost through `graphicsQuality` (R3F: DPR 1.0/1.25/1.5, shadows only on high;
   Mekong: `performanceMode`, render scale 0.7-1.0). Never lower everyone's quality.
6. Context loss: only `GameCanvas` and `ChapterOneCanvas` handle `webglcontextlost`; a new canvas
   should too.
7. A second WebGL context costs memory: prefer an existing canvas.

## Measuring

- Draw calls and triangles: `renderer.info.render.calls` / `.triangles` (R3F: `useThree().gl.info`;
  Mekong: `window.__MEKONG_DEBUG__` audit helpers).
- GLB size and complexity: `pnpm exec gltf-transform inspect <file.glb>` (root dev dependency).
- Headless Chrome (Playwright MCP) uses SwiftShader software WebGL: compare draw calls and
  relative frame counts only; real FPS needs a real GPU and must be labeled as such.
- Record before and after numbers with the method in `docs/PROJECT_PROGRESS.md`.

## Hook

`.kiro/hooks/world-engine-change-review.json` scans added lines in world files for a new
renderer, loader or AudioContext, undisposed GPU resources, leaked listeners and global quality
cuts. Treat its warnings as review items.

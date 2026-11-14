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
   `mientay/world/optimize/mergeStaticMeshes.ts` (Mekong-only for now, see the shared-world-engine
   spec for why); large instanced sets: `game/world/optimize/spatialChunking.ts` (shared, Mekong is
   the only adopter today).
5. Quality: change cost through `graphicsQuality` (R3F: DPR 1.0/1.25/1.5, shadows only on high;
   Mekong and Hue: adaptive pixel ratio via the shared `game/world/quality.ts` `AdaptiveQuality`,
   each with its own thresholds). Never lower everyone's quality.
6. Context loss: all six hosts now call `event.preventDefault()` on `webglcontextlost`, so the
   browser is allowed to restore the context instead of leaving the canvas dead permanently. What
   each host does beyond that differs, and none of this is a fallback UI:
   - `GameCanvas`: logs only (`console.warn`/`console.info`); separately has a `CanvasErrorBoundary`
     that catches thrown React render errors and shows `WebGLFallback` — a different mechanism,
     not triggered by context loss itself.
   - `ChapterOneCanvas`: logs, and also reports the lost/restored state up to `ChapterOnePage` via
     `onWebGLContextChange`, which gates whether the 3D phone model is allowed to mount
     (`modelAllowed`) — a real behavioral response, still with no dedicated fallback screen.
   - `HueWorldEngine` / `MekongWorldEngine`: via the shared `watchContextLoss`
     (`game/world/lifecycle.ts`); pause their own `requestAnimationFrame` loop on loss and resume
     it on restore (both own an explicit loop, unlike the R3F hosts). No UI feedback.
   - `TestMoveCanvas` / `UEHCanvas`: via the shared `game/world/ContextLossWatcher.tsx` (an R3F
     component wrapping `watchContextLoss`); console-only, no loop pause (R3F's own loop keeps
     running; three.js GL calls are no-ops while the context is lost) and no UI feedback.
   Neither `TestMoveCanvas` nor `UEHCanvas` has an error boundary or fallback screen at all — a
   thrown render error unrelated to context loss would still blank either page.
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

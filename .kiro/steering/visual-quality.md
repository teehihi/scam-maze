---
inclusion: fileMatch
fileMatchPattern: ["**/apps/game/src/features/hue/**", "**/apps/game/src/features/mientay/**", "**/apps/game/src/features/ueh/**", "**/apps/game/src/features/testmove/**", "**/apps/game/src/game/scenes/**", "**/apps/game/src/game/core/**", "**/apps/game/src/features/chapter1/ChapterOneCanvas.tsx", "**/apps/game/src/features/chapter1/world/**", "**/apps/game/src/features/vehicle/**", "**/apps/game/src/features/player/**", "**/apps/game/scripts/optimize-*"]
---

# Visual quality and performance

## Direction

Stylized realism and stylized low-poly, warm and lived-in, never horror. Each map has its own
identity and that is intentional: the Saigon street (menu and Chapter 1), UEH campus, Huế
monuments and the Mekong Delta. Share infrastructure, not art direction.

## Non-negotiable

Optimization must keep the picture. Do NOT:
- disable shadows, antialiasing or post-processing globally, or lower the pixel ratio for all users;
- swap detailed assets for cruder ones, delete props, or thin foliage the player can see;
- remove lighting or animation to win frames without the owner agreeing.

Quality tiers already exist (`graphicsQuality` low/medium/high in R3F canvases; Mekong
`performanceMode`). Put cost reductions behind a tier, keep High faithful, and keep Hue's ignored
setting in mind (`HuePage` does not read it yet).

## Measure first

- A performance claim needs a number and a method: draw calls and triangles
  (`renderer.info.render`), frame time, GPU, browser, resolution. Mekong has
  `window.__MEKONG_DEBUG__` (`mientay/engine/profiling.ts`).
- Headless Chrome uses software WebGL (SwiftShader): good for relative draw-call and frame-count
  comparisons, not for real FPS. Say which one you measured. No real-GPU numbers are recorded yet.

## Asset standards

- GLB with Meshopt geometry and WebP textures, through `config/assetPaths.ts`. Textures 2048 px
  max unless justified; source files stay in `assets-src` (Git LFS), never in `public/`.
- Credit every third-party asset in `config/credits.ts` and `THIRD_PARTY_NOTICES.md`.

## Rendering practice

- Reuse geometry and materials; instance repeated meshes; merge static meshes by material
  (`mergeStaticMeshes`); chunk large instanced sets (`spatialChunking`); cull by distance with
  hysteresis (Hue streaming).
- One three.js object has one parent: clone cached GLTF scenes per canvas (see
  `StreetEnvironment`).
- Dispose what you create with `new` (geometries, materials, textures, render targets, composers)
  and remove every listener on unmount. R3F frees only JSX-created objects.
- Lighting: one sun with a fitted shadow frustum; point lights only near the player; bake or
  pre-filter environment lighting (PMREM) and refresh it only when needed.
- Animation: frame-rate independent (use delta), respect reduce-motion for UI motion.

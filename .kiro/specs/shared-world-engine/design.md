# Design: Shared World Engine Infrastructure

## Principles

1. Share infrastructure, not art. Map profiles carry the look; the runtime carries plumbing.
2. Adopt, do not rewrite: each module is introduced with one Host migrated, then others follow.
3. Two real users or it stays local (coding-standards.md).
4. Every step is measured (Requirement 1) and screenshot-compared at High quality.

## Module layout (new, `apps/game/src/game/world/`)

| Module | Responsibility | Extracted from | First adopter |
|---|---|---|---|
| `stats.ts` | `createStatsProbe(renderer)`: `renderer.info` snapshot + frame-time ring buffer (p50/p95); `?stats=1` overlay | Mekong `profiling.ts` | menu `GameCanvas` |
| `rendererProfile.ts` | `MapRenderProfile {exposure, toneMapping, shadowType, antialias}`, `dprFor(quality, devicePixelRatio)`, `applyRendererProfile(renderer, profile, quality)` | GameCanvas/ChapterOneCanvas DPR, all six setups | GameCanvas + ChapterOneCanvas |
| `lifecycle.ts` | `disposeObjectTree(root)`, `ListenerBag` (add/removeAll), `watchContextLoss(canvas, handlers)` | Hue/Mekong dispose and resize code | Hue, then Mekong |
| `loaders.ts` | `createMeshoptGltfLoader()`, `meshoptExtensions` for `useLoader`, `cloneShared(scene)` | streetGltfLoader, CityBackdrop, LexusVehicle, HueVehicle | CityBackdrop, LexusVehicle |
| `optimize/` | re-export of `mergeStaticMeshes`, `freezeStaticTransforms`, `chunkInstancedMeshes` (moved from `mientay/world/optimize`) | Mientay | UEH foliage (candidate) |
| `audio.ts` | `getSharedAudioContext()` with resume-on-gesture | menu, Hue, Mekong, UEH, vehicle | vehicle audio |

Map profiles stay with each map, e.g. `features/hue/hueProfile.ts` with `exposure: 1.06`.

## Data flow

Settings (`graphicsQuality`) -> `rendererProfile` (DPR, shadows, antialias) -> Host renderer.
Host mount -> `ListenerBag` + `watchContextLoss`; unmount -> `ListenerBag.removeAll()` +
`disposeObjectTree(scene)` + `renderer.dispose()`. Assets -> `loaders.ts` -> cached GLTF ->
`cloneShared` per Host.

## Correctness properties

| ID | Property | Requirements |
|---|---|---|
| W1 | `dprFor(q, d)` is monotonic in `q` and `d`, never above the cap for `q`, never below 0.5. | 2.3 |
| W2 | `disposeObjectTree` calls `dispose` exactly once per unique geometry, material and texture in any generated tree (shared resources included), and is idempotent. | 3.1 |
| W3 | `ListenerBag.removeAll` leaves zero listeners for any generated add/remove sequence. | 3.2 |
| W4 | `cloneShared(scene)` returns a tree with the same geometry and material references and a disjoint `Object3D` set; the source keeps its parent. | 4.2 |
| W5 | For generated static mesh sets, `mergeStaticMeshes` preserves total triangle count and world-space bounds and does not increase draw calls (existing tests extended). | 5.2 |

W1-W5 are unit or seeded property tests in jsdom (three.js objects need no GPU). Requirements 2.2,
3.3 and 5.2 screenshots and counts are browser checks through Playwright MCP on the dev server
(software WebGL: compare counts and pixels, not FPS).

## Risks

- Visual drift from a shared default: mitigated by explicit map profiles and screenshot checks.
- Engine adaptive scaling fighting the shared DPR: engines keep their adaptive layer on top.
- Moving Mientay optimizers changes import paths: keep re-exports during migration.

## Not in scope

Unifying sky/water/grass shaders, a scene graph framework, ECS, Rapier, streaming formats (KTX2).

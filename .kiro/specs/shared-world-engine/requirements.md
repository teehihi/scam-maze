# Requirements: Shared World Engine Infrastructure

## Introduction

SCAMMAZE has six rendering hosts: four R3F canvases (menu, Chapter 1, `/testmove`, `/ueh`) and
two imperative engines (`HueWorldEngine`, `MekongWorldEngine`). Each grew separately, so the same
infrastructure exists several times: renderer setup (6 copies, exposure 0.88 to 1.06), DPR logic,
resize and visibility handling, dispose traversals, Meshopt GLTF loader setup (3-4 copies),
seven or more `AudioContext`s, and context-loss handling on only two canvases. Mientay has
reusable optimizers (`mergeStaticMeshes`, `spatialChunking`) that no other map uses.

This spec extracts shared INFRASTRUCTURE step by step, map by map, with before/after measurements.
It does not unify art direction: sky, water, foliage, lighting moods and exposure stay per map.

Measured facts this spec builds on: Mientay draw calls 2007 -> 471 per scene pass after merging
(headless software WebGL); street GLB 6.48 M triangles before optimization. Not measured: real-GPU
frame rate of any map.

## Glossary

- **World_Runtime**: the shared module set under `apps/game/src/game/world/` created by this spec.
- **Host**: an R3F canvas or an engine class that owns a WebGL renderer.
- **Baseline**: recorded `renderer.info.render.calls`, triangles, geometries, textures and frame
  time for a fixed camera path on a Host, with browser and GPU noted.

## Requirements

### Requirement 1: Measure before changing

**User story:** As a developer, I want a repeatable baseline per map, so that every refactor proves it did not cost frames or quality.

1.1 THE World_Runtime SHALL provide a stats probe that returns draw calls, triangles, geometries, textures and frame-time percentiles (p50, p95) for any Host.
1.2 WHEN a world change claims a performance effect THE change SHALL include Baseline numbers before and after, with the measurement environment.
1.3 THE probe SHALL be off in production builds unless enabled with a URL flag.

### Requirement 2: One renderer configuration API

**User story:** As a developer, I want renderer settings defined once with per-map overrides, so that tone mapping, color space, shadows and DPR stay consistent and intentional.

2.1 THE World_Runtime SHALL export a renderer profile builder taking a map profile (exposure, tone mapping, shadow type, antialias policy) and the player's `graphicsQuality`.
2.2 WHEN a Host adopts the profile THE rendered output at High quality SHALL match the previous output (screenshot comparison within a tolerance, same camera).
2.3 THE DPR policy (1.0 / 1.25 / 1.5 by quality, cap by device) SHALL be defined once and used by every R3F Host; engines MAY keep adaptive scaling on top of it.

### Requirement 3: Resource lifecycle

**User story:** As a player switching between maps, I want memory released when I leave a map, so that the game does not slow down or lose its WebGL context over time.

3.1 THE World_Runtime SHALL provide a disposer that frees geometries, materials (all texture slots), render targets and composers of an object tree exactly once.
3.2 WHEN a Host unmounts THE system SHALL remove every listener it added (resize, visibility, pointer lock, page hide).
3.3 WHEN the player enters and leaves each map five times THE renderer's geometry and texture counts after leaving SHALL return to the menu's Baseline (within 2%).
3.4 EVERY Host SHALL handle `webglcontextlost` and `webglcontextrestored` (today only the menu and Chapter 1 do).

### Requirement 4: Shared asset loading

**User story:** As a developer, I want one way to load GLBs, so that caching, progress and decoder setup are the same everywhere.

4.1 THE World_Runtime SHALL provide one Meshopt-enabled GLTF loader factory used by R3F (`useLoader`) and engines.
4.2 WHEN two Hosts render the same cached GLTF THE system SHALL render clones that share geometry and materials (the rule fixed in `StreetEnvironment`).
4.3 Byte progress reporting SHALL keep working for the menu startup (`menuAssetProgress`).

### Requirement 5: Reusable optimizers

**User story:** As a map author, I want merging, instancing and chunking available to every map, so that new maps start fast without copying Mientay code.

5.1 THE World_Runtime SHALL expose `mergeStaticMeshes`, `freezeStaticTransforms` and `chunkInstancedMeshes` from a shared location with their existing tests.
5.2 WHEN an optimizer is applied to a Host THE Baseline SHALL show fewer or equal draw calls AND the High-quality screenshot SHALL be unchanged within tolerance.

### Requirement 6: Audio contexts

6.1 THE system SHALL create at most one `AudioContext` per page for menu, world ambience and vehicle audio, shared through a small provider; the voice engine MAY keep its own until migrated.

### Requirement 7: Preserve identity and scope

7.1 THE refactor SHALL NOT change any map's sky, water, foliage, lighting colors, exposure or asset detail unless the owner approves.
7.2 Each step SHALL migrate one Host at a time and keep all tests, the type check and the build passing.

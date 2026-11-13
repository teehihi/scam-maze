# Implementation Plan: Shared World Engine Infrastructure

## Overview

Measure first, then extract one module with one adopter at a time. Each task keeps
`pnpm typecheck`, `pnpm test` and `pnpm build` green and records numbers in
`docs/PROJECT_PROGRESS.md`. Review each design step with the `world-architect` agent.

## Tasks

- [ ] 1. Baseline
  - [ ] 1.1 Create `game/world/stats.ts` (`createStatsProbe`) with unit tests on a mocked `renderer.info`
  - [ ] 1.2 Wire it behind `?stats=1` in `GameCanvas` and `HueWorldEngine`; record a Baseline for menu, Chapter 1, `/ueh`, `/hue`, `/mientay` (fixed camera, headless and, if available, a real GPU)
  - _Requirements: 1.1, 1.2, 1.3_
- [ ] 2. Renderer profile
  - [ ] 2.1 Create `game/world/rendererProfile.ts` with `dprFor` and `applyRendererProfile`; **Property W1**
  - [ ] 2.2 Adopt in `GameCanvas` and `ChapterOneCanvas` (remove the copied DPR ternary); screenshot compare at High
  - _Requirements: 2.1, 2.2, 2.3, 7.1_
- [ ] 3. Lifecycle
  - [ ] 3.1 Create `game/world/lifecycle.ts` (`disposeObjectTree`, `ListenerBag`, `watchContextLoss`); **Properties W2, W3**
  - [ ] 3.2 Adopt in `HueWorldEngine` (replace its dispose traversal and resize/visibility listeners); enter/leave `/hue` five times and compare renderer counts
  - [ ] 3.3 Adopt in `MekongWorldEngine`; add context-loss handling to Hue, Mekong, UEH and TestMove
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [ ] 4. Loaders
  - [ ] 4.1 Create `game/world/loaders.ts` (`createMeshoptGltfLoader`, `meshoptExtensions`, `cloneShared`); **Property W4**
  - [ ] 4.2 Adopt in `CityBackdrop`, `LexusVehicle` and `HueVehicle`; keep `StreetGLTFLoader` progress working
  - _Requirements: 4.1, 4.2, 4.3_
- [ ] 5. Optimizers
  - [ ] 5.1 Move `mergeStaticMeshes` / `spatialChunking` to `game/world/optimize/` with re-exports; **Property W5**
  - [ ] 5.2 Evaluate on UEH foliage with the Baseline; adopt only if draw calls drop and the screenshot is unchanged
  - _Requirements: 5.1, 5.2_
- [ ] 6. Audio
  - [ ] 6.1 `game/world/audio.ts` shared context; adopt in `vehicleAudio` and Hue ambience
  - _Requirements: 6.1_
- [ ] 7. Checkpoint with the owner: Baseline table before and after, screenshots per map, remaining duplication.

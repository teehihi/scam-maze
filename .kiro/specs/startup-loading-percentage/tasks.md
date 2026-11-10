# Implementation Plan: Startup Loading Percentage

## Overview

Add a framework-free byte progress store, a street-only `GLTFLoader` subclass that feeds it from
the single preload download, and wire the store into `MenuStartupLoading` with
`useSyncExternalStore`. Tests use the existing seeded-run helpers in `src/test/loadingRuns.ts`
(no new dependency). All work is in TypeScript under `apps/game`, plus two doc updates.

## Tasks

- [x] 1. Byte progress store
  - [x] 1.1 Create `apps/game/src/game/loading/menuAssetProgress.ts`
    - Export `ByteProgressEvent`, `ByteProgressStore`, `percentFromEvent`, `createByteProgressStore` and the `menuAssetProgress` singleton as in the design
    - `percentFromEvent`: `null` unless `lengthComputable`, finite `total > 0` and finite `loaded >= 0`; otherwise `min(99, floor(loaded / total * 100))`
    - `report` keeps the running maximum; `markComplete` sets 100; `reset` sets `null`; listeners fire once per real change; `subscribe` and `getPercent` are bound closures
    - No React, three or timer code
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_
  - [x] 1.2 Write `apps/game/src/game/loading/menuAssetProgress.test.ts`
    - Examples: initial `null`; unknown total stays `null`; `loaded > total` gives 99; `markComplete` gives 100; reset gives `null`
    - **Property 1: Store matches the running-max model** (seeded runs, at least 100 cases, counterexamples in the failure message)
    - **Property 2: One notification per change** (seeded runs, including unsubscribe)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 2. Street loader that reports byte progress
  - [x] 2.1 Create `apps/game/src/game/scenes/MainMenuScene/streetGltfLoader.ts`
    - `StreetGLTFLoader extends GLTFLoader` (from `three/examples/jsm/loaders/GLTFLoader.js`), overriding `load` to forward progress events to `progressStore.report` and to call `progressStore.markComplete()` before the caller's `onLoad`; `onError` forwarded unchanged
    - `streetLoaderExtensions` sets `MeshoptDecoder` from `three/examples/jsm/libs/meshopt_decoder.module.js`
    - Comment explaining why a dedicated class is needed (R3F caches by `[class, url]`; `useLoader.preload` has no `onProgress`)
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 2.2 Switch `StreetEnvironment.tsx` to the new loader
    - Replace `useGLTF.preload(CITY_MODEL_PATH)` with `useLoader.preload(StreetGLTFLoader, CITY_MODEL_PATH, streetLoaderExtensions)` and `useGLTF(CITY_MODEL_PATH)` with `useLoader(StreetGLTFLoader, CITY_MODEL_PATH, streetLoaderExtensions)`; remove the unused Drei import
    - Change no other line of scene, calibration, `compileAsync` or animation logic
    - _Requirements: 1.1, 1.2, 1.3, 4.6_
  - [x] 2.3 Write `apps/game/src/game/scenes/MainMenuScene/streetGltfLoader.test.ts`
    - Spy on `GLTFLoader.prototype.load` (no network); assert progress events reach an injected store created with `createByteProgressStore`, `onLoad` marks complete before forwarding, and the caller's `onProgress`/`onError` still run
    - _Requirements: 1.4, 2.5_

- [x] 3. Show the percentage on the startup screen
  - [x] 3.1 Update `apps/game/src/features/loading/MenuStartupLoading.tsx`
    - Read `menuAssetProgress` with `useSyncExternalStore`
    - Apply the design's display mapping: Ready → `1`; bytes complete → `1` with "Preparing the street scene"; known percent → `bytePercent / 100` with "Loading the street scene" and no file count; unknown → existing indeterminate bar and Drei file count
    - Add `bytePercent` to the watchdog effect dependencies; update the component doc comment
    - Keep hold, error, "Continue to menu", reduced motion and `SceneTransition` code unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 3.2 Update `apps/game/src/features/loading/MenuStartupLoading.test.tsx`
    - Reset `menuAssetProgress` in `beforeEach`; send byte reports inside `act`
    - Add examples: percentage shown when the total is known; indeterminate with file count when unknown; full bar with "Preparing the street scene" after completion; byte progress restarts the slow-notice watchdog
    - Change "shows Ready while the screen is held" to expect a determinate bar with `aria-valuenow="100"`, keeping its hold and `onFinished` checks
    - Rework the Property 2 "progress honesty" run so generated steps include byte events and a Scene_Ready switch, checked against the display mapping after each step and after each wait
    - **Property 3: Startup screen matches the display model**
    - **Property 4: The shown percentage never decreases**
    - Keep Property 1 and the Continue to menu property unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.4_

- [x] 4. Update documentation
  - [x] 4.1 Update `docs/architecture/OVERVIEW.md` and `docs/PROJECT_PROGRESS.md`
    - Rewrite the startup-loading paragraph in OVERVIEW section 4.2.1: byte-measured percentage of the Street_GLB, dedicated loader class sharing the preload cache entry, indeterminate fallback with file count, full bar during shader compile and the hold, sky texture not measured
    - Add a Task history entry (newest first) with all fields from AGENTS.md section 6, including the real test, typecheck and build results from task 5
    - _Requirements: 5.1, 5.2_

- [x] 5. Checkpoint - Ensure all tests pass
  - Run `pnpm test`, `pnpm typecheck` and `pnpm build` from the workspace root (84 tests before this feature; the count must grow by the new tests). Ensure all tests pass, ask the user if questions arise.

## Notes

- No optional tasks: every sub-task is required.
- No new dependencies: three's own `GLTFLoader` and `MeshoptDecoder` come from the direct `three` dependency.
- No timer may produce or animate progress; only loader events, load completion and Scene_Ready change the bar.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2"] },
    { "id": 3, "tasks": ["4.1"] }
  ]
}
```

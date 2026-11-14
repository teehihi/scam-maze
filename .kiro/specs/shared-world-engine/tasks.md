# Implementation Plan: Shared World Engine Infrastructure

## Overview

Measure first, then extract one module with one adopter at a time. Each task keeps
`pnpm typecheck`, `pnpm test` and `pnpm build` green and records numbers in
`docs/PROJECT_PROGRESS.md`. Review each design step with the `world-architect` agent.

## Tasks

- [ ] 1. Baseline — probe built and adopted; the baseline table itself is still not recorded (see 1.2)
  - [x] 1.1 Create `game/world/stats.ts` (`createStatsProbe`, `StatsProbe`, `isStatsEnabled`) with
    14 unit tests on a mocked `renderer.info`, covering `autoReset` takeover/restore, the p50/p95
    rolling window (including a ring-buffer-wrap case and a window shorter than its capacity), and
    the disabled-by-default / `?stats=1` / `force` paths.
  - [ ] 1.2 Partially done. Wired behind `?stats=1`: `GameCanvas` via a new
    `game/world/StatsProbeHost.tsx` (an R3F component using `addEffect`/`addAfterEffect`, not
    `useFrame` — `useFrame` runs *before* R3F's own render call for that frame and would read the
    previous frame's `renderer.info`), exposing `window.__WORLD_STATS__.menu()`. `HueWorldEngine`
    via a `StatsProbe` field wrapped around its `animate()`'s `renderer.render()` call, exposing
    `window.__HUE_DEBUG__.getStats()`. Verified against the running dev server (headless Chrome):
    both report real draw calls, triangles, geometries, textures, programs and frame-time
    percentiles; absent entirely (no global, no allocation) without `?stats=1`. Mekong was **not**
    wired to `stats.ts` in this pass (not in this task's listed adopters, and it already has its
    own, differently-shaped `getPerf()`/`profile()` debug methods — wiring it in is left for a
    future task if it's ever wanted). **Still missing, and the reason this subtask stays open:**
    the formal before/after Baseline recording this requirement actually asks for — a table of
    draw calls, triangles, geometries, textures and frame-time percentiles across menu, Chapter 1,
    `/ueh`, `/hue` and `/mientay`, with the measurement environment noted — has not been captured
    anywhere. The probe exists and works; the baseline it exists to produce does not yet.
  - _Requirements: 1.1, 1.2, 1.3_
  - Note (2026-11-14): `game/world/profiling.ts` (moved verbatim from Mekong's `engine/profiling.ts`,
    scene-graph audits: `auditGroups`/`auditTextures`/`auditLights`/`topMeshes`) is NOT this task's
    `stats.ts`. It audits a `THREE.Scene`'s contents; this task's probe is a `renderer.info`
    snapshot plus a frame-time ring buffer. Both coexist under `game/world/`, never imported by
    each other, by design (confirmed with the `world-architect` agent before implementation).
- [ ] 2. Renderer profile
  - [ ] 2.1 Create `game/world/rendererProfile.ts` with `dprFor` and `applyRendererProfile`; **Property W1**
  - [ ] 2.2 Adopt in `GameCanvas` and `ChapterOneCanvas` (remove the copied DPR ternary); screenshot compare at High
  - _Requirements: 2.1, 2.2, 2.3, 7.1_
  - Note (2026-11-14): `TestMoveCanvas` and `UEHCanvas` have no `dpr` prop, so they use R3F's own
    default of `dpr={[1, 2]}` (confirmed against the installed `@react-three/fiber` and its docs),
    **not an uncapped ratio** as an earlier audit pass assumed. Giving them the existing
    low/medium/high tiers (1.0 / 1.25 / 1.5) would lower the High tier below today's 2.0 on any
    display with `devicePixelRatio >= 2` (most phones and Retina laptops) — a real sharpness
    reduction for most users, which `.kiro/steering/visual-quality.md` treats as non-negotiable
    without owner sign-off. Not done in this pass; needs an owner decision (see
    `docs/PROJECT_PROGRESS.md`, 2026-11-14 entry) between (a) owner approves the drop, (b) give
    testmove/ueh a `min(maxDpr, 2)` ceiling on High instead (keeps today's behavior, just gives low
    and medium a real tier), or (c) leave testmove/ueh exactly as they are.
  - [x] 2.3 Done (2026-11-14): extracted the adaptive **mechanism** (not the static DPR tiers
    above) shared by Hue and Mekong into `game/world/quality.ts` (`AdaptiveQuality`): windowed
    average frame time, configurable drop/rise streaks, an upgrade ratchet, a `setCeiling` for
    performance-mode jumps, and a caller-supplied `onChange` so each engine applies the ratio on
    its own schedule (Mekong defers to just before the next draw; Hue applies immediately, as it
    always did). Both engines keep their exact original thresholds, now as constructor config
    instead of duplicated inline logic. 16 unit tests in `game/world/quality.test.ts` cover both
    policies, the ratchet, and `setCeiling`. This is additive to the Requirement 2 scope above (a
    reusable mechanism), not a replacement for the still-open static-tier work in 2.1/2.2.
- [x] 3. Lifecycle
  - [x] 3.1 Created `game/world/lifecycle.ts` (`disposeObjectTree`, `ListenerBag` with typed
    `Window`/`Document`/`HTMLElement` overloads, `watchContextLoss`); 15 unit tests cover
    **Properties W2, W3** (dedup/dispose-exactly-once per unique geometry/material/texture even
    when shared across meshes, idempotent `removeAll()`, zero live listeners after any add/remove
    sequence including a captured listener and a 40-listener arbitrary sequence).
  - [x] 3.2 Adopted in `HueWorldEngine`: `bindEvents`'s `cleanupListeners` closure replaced by
    `ListenerBag`; `dispose()`'s two separate traversal passes (a narrow per-landmark-chunk pass
    disposing only geometry+material, then a scene-wide pass disposing geometry+material+textures)
    replaced by one `disposeObjectTree(this.scene)` call. **This is a real behavior fix, not a pure
    move**: the old narrow pass ran before `chunk.group.clear()` detached the chunk's meshes from
    the scene, so the later full pass never reached them and their textures were never freed on
    dispose. The shared function now frees them. Also added the `if (this.disposed) return;`
    idempotency guard Hue was missing (Mekong already had it).
  - [x] 3.3 Adopted in `MekongWorldEngine`: same `ListenerBag` replacement; its existing single
    dispose traversal already disposed geometry+material+textures in one pass, so swapping it for
    `disposeObjectTree` is a pure extraction with no behavior change (confirmed line-by-line by an
    independent review). Added `watchContextLoss` to **both** Hue and Mekong as a genuinely new
    capability (neither had any `webglcontextlost`/`webglcontextrestored` handling before; only the
    menu and Chapter 1 canvases did).
  - [x] 3.4 (2026-11-14) Added context-loss handling to `/testmove` and `/ueh` too, via a new
    `game/world/ContextLossWatcher.tsx` R3F component (console-only, same scope as the menu's
    inline handlers — `event.preventDefault()` plus logging, no error boundary or fallback UI
    added; both canvases still have neither, a separate open gap, not fixed by this task). All
    four requirement-3.4 maps now have context-loss handling in some form.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
- [ ] 4. Loaders
  - [ ] 4.1 Create `game/world/loaders.ts` (`createMeshoptGltfLoader`, `meshoptExtensions`, `cloneShared`); **Property W4**
  - [ ] 4.2 Adopt in `CityBackdrop`, `LexusVehicle` and `HueVehicle`; keep `StreetGLTFLoader` progress working
  - _Requirements: 4.1, 4.2, 4.3_
- [ ] 5. Optimizers
  - [x] 5.1 Move `spatialChunking` to `game/world/optimize/` (2026-11-13/14; done as a straight move,
    no re-export stub needed since Mekong was its only consumer — see `docs/PROJECT_PROGRESS.md`).
    `mergeStaticMeshes` is deliberately **not** moved: it depends on Mekong-only conventions
    (`userData.dynamic`/`userData.rigid`, hardcoded object names, the `aPositionRotation` attribute
    name) and mutates/disposes the scene graph it's given, which is risky for a second, React-owned
    consumer. It needs a predicate-based signature redesign (caller supplies `isDynamic`/`isRigid`)
    before promotion, not a verbatim move; that redesign is its own task, not bundled into 5.1.
    Hue's monument builders DO share materials across many meshes (confirmed by reading
    `buildTrangTienBridge.ts`/`buildThanhToanAndVillage.ts`'s `mats.*` reuse), so Hue is a
    plausible second adopter once the redesign lands — not ruled out by its architecture.
  - [ ] 5.2 Evaluate on UEH foliage with the Baseline; adopt only if draw calls drop and the screenshot is unchanged
  - _Requirements: 5.1, 5.2_
- [ ] 6. Audio
  - [ ] 6.1 `game/world/audio.ts` shared context; adopt in `vehicleAudio` and Hue ambience
  - _Requirements: 6.1_
- [ ] 7. Checkpoint with the owner: Baseline table before and after, screenshots per map, remaining duplication.

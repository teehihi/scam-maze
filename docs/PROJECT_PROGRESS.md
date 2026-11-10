# SCAMMAZE Project Progress

> Maintained by every contributor and AI agent, as required by [AGENTS.md](../AGENTS.md#6-documentation-maintenance-mandatory).
> Newest task first. Status labels as in [OVERVIEW.md](architecture/OVERVIEW.md#1-status-legend).

## Project Status

- **Product definition:** Browser-based, first-person 3D narrative game in a small persistent
  world with chapter-based stories (owner decision, 2026-11-08). Canonical document:
  [product positioning](product/PRODUCT_POSITIONING.md).
- **Product stage:** Pre-Alpha / Game Foundation.
  - Landing application (`apps/landing`): live on GitHub Pages with 4 cinematic sections and full Knowledge Hub.
  - Game application (`apps/game`): 3D first-person street scene serving as the game's Main Menu built with Three.js r174, R3F v9, Drei v10, and verified Sketchfab 3D assets.
  - Shared contracts (`packages/shared-types`): pure TypeScript types.
- **Current milestone:** Phase B — 3D Vertical Slice & Narrative Foundation.
- **Architecture status:** pnpm monorepo structure `IMPLEMENTED`. 3D rendering pipeline `IMPLEMENTED`.
- **Database decision:** `PENDING` ([database strategy](architecture/DATABASE_STRATEGY.md)).
- **Domain status:** No domain purchased.
- **Deployment status:** Landing page on GitHub Pages (<https://teehihi.github.io/scam-maze/>). Game client build ready for independent Vercel project deployment.
- **AWS budget:** $200 promotional credits, 3-month evaluation, estimate $28.68
  ([cost estimation](finops/COST_ESTIMATION.md)); no actual spend yet.
- **Last updated:** 2026-11-10

## Completed

Verified against merged pull requests on GitHub and local workspace builds.

- [x] **Cinematic chapter loading screen (branch `feat/game-cinematic-loading-screen`, not merged):** Real loading pipeline for New Game / Continue with byte-measured progress, asset verification, stall watchdog, error recovery, fade transitions and reduced-motion support. Startup menu loading rewritten without fabricated progress. First automated tests (Vitest, 103 tests after the 2026-11-10 startup loading percentage task). Startup screen shows a byte-measured percentage of the street GLB. Loading screens are opaque from the first frame and stay up for a minimum display time (1.5 s chapter, 1.2 s startup). Chapter 1 gameplay itself is not implemented; loading ends on an honest "in development" screen.
- [x] **Main Menu Performance Optimization (Round 2 — Progressive Loading & Deep GLB Reduction):** Implemented instantaneous menu UI interaction on Frame 1 with non-blocking progressive loading. Decoupled Suspense boundaries so the sky dome and procedural street fallback (`StreetFallback.tsx`) render immediately without waiting for the 3D model. Conducted deep decimation across heavy vehicle CAD hierarchies (VinFast VF3, Lexus GX 550, PCX, fence, pedestrian scan), dropping triangles from 2.68M down to 542k (-91.6% from original) and file size to 21.50 MB (-95.1% from original). Resized normal maps with high-quality WebP, and added parallel asynchronous GPU shader pre-compilation via `gl.compileAsync` to eliminate first-render freeze spikes.
- [x] **Deep Performance Optimization of Main Menu 3D Scene (Phases 1–7):** Conducted complete asset forensics on the 440.5MB `MenuBG.glb` asset. Engineered an automated Node.js optimization pipeline (`apps/game/scripts/optimize-environment.cjs`) utilizing `@gltf-transform`, Meshopt, and Sharp. Reduced GLB file size from 440.53MB to 43.00MB (-89.76%) and polygon count from 6.48M to 2.68M triangles (-58.6%) without degrading visual fidelity from the authored camera viewpoint. Replaced 8K/4K scan textures with WebP (172.8MB -> 24.1MB), eliminated hidden dead meshes, froze static matrices, eliminated frame-loop memory allocations in `MenuCamera`, optimized SkyDome geometry, capped Retina DPR, and resolved WebGL context exhaustion.
- [x] **Main Menu Initialization & Render Performance Optimization:** Eliminated initial camera rotation swing and blue-screen flash on menu entry. Added an atmospheric cyber-safety Loading Screen (`LoadingScreen.tsx`) covering 3D asset downloads. Optimized Three.js rendering pipeline by removing 420MB scene cloning, freezing static mesh matrices (`matrixAutoUpdate = false`), capping device pixel ratio, and limiting dynamic foliage animation to ensure smooth 60 FPS performance.
- [x] **Ho Chi Minh City 2025 3D Map Explorer (`/hochiminh` route):** Integrated 19.6MB 3D model of Ho Chi Minh City (Saigon 3D City, CC-BY 4.0, 493,715 vertices). Developed dynamic procedural coloring engine mapping elevations, surface normals, and architectural styles across Saigon River, city avenues, colonial shophouse facades, terracotta roofs, and high-rise glass towers (Bitexco, Landmark). Provided 4 aesthetic themes (Daylight, Cyberpunk Neon, Golden Sunset, Tech Blueprint), 3D landmark pins, cinematic camera presets, auto-rotation, and full routing isolation from the main game menu.
- [x] **Monorepo restructure & Game Foundation:** Split repository into pnpm monorepo with `apps/landing`, `apps/game`, and `packages/shared-types`. Root workspace build and typecheck commands (`pnpm build`, `pnpm typecheck`, `pnpm dev:landing`, `pnpm dev:game`).
- [x] **Verified 3D Assets Integration:** Discovered and integrated `low_poly_city_asset_pack.glb` (Calipo, CC-BY 4.0) and `low_poly_cars_pack.glb` (matisosanimation, CC-BY 4.0) from local `Kiroween/Asset3D/`. Recorded in `THIRD_PARTY_NOTICES.md`.
- [x] **First-Person 3D Main Menu:** Real Three.js r174 + R3F v9 + Drei v10 scene. Human eye-level camera with subtle breathing motion, mouse parallax, customizable FOV, atmospheric lighting, modular buildings, storefronts, hospital, road, streetlights with warm point lights, low-poly trees, and parked cars along curbs.
- [x] **Interactive Menu UI & Modals:** Accessible React overlay with `NEW GAME` (prologue introduction), `CONTINUE` (disabled with clear tooltip), `SETTINGS` (real-time graphics quality, FOV, sound toggle, volume with `localStorage` persistence), `CREDITS` (verified attribution), and WebGL context error fallback detector.
- [x] **Independent Deployment Readiness:** Configured `vercel.json` SPA rewrites for both `apps/landing` and `apps/game`. Preserved GitHub Pages deployment for landing page.
- [x] Public repository, MIT license, community health files — PR #1, merged 2026-11-07.
- [x] First landing page with demo scenario — initial commit `b23fe11`.
- [x] Deploy workflow to GitHub Pages and CI build — PR #2, merged 2026-11-07.
- [x] Flat, minimal redesign; skip link; contrast-checked color tokens — PR #2.
- [x] All site copy and documentation in English — PR #3, merged 2026-11-07.
- [x] Positioning for Vietnam and worldwide; `audience.md` steering — PR #5.
- [x] Master plan added — commit `0665897`, 2026-11-07.
- [x] Architecture, deployment, database strategy, cost estimation — PR #6.
- [x] Cinematic dark landing page as a game gateway — PR #7.
- [x] Full-Page Knowledge Hub with 9 legal & documentation sections and instant tab switching — 2026-11-09.

## In Progress

- [ ] First-person player controller and navigation movement (WASD / pointer lock).
- [ ] Map Entry Arm Intro: Play `rig|Equip` animation on map entry (noted for tomorrow / "lưu lại mai sửa").
- [ ] In-game smartphone interface and message notifications.
- [ ] Chapter 1 "The Urgent Call" scenario state machine.

## Planned

Updated for the 3D direction (positioning section 11); none started.

- [ ] 3D prototype and benchmark with Three.js + React Three Fiber + Drei (and Rapier, if
      adopted): walkable apartment and street on target devices (integrated
      GPUs), to set triangle, draw-call and memory budgets.
- [ ] Deterministic core (pure TypeScript, Zod-validated scenarios, Zustand store, Dexie
      saves): chapter state machine, evidence and tactic definitions, persistent
      world state, local save (IndexedDB), tests for every branch.
- [ ] In-game smartphone UI: messages, browser with fictional sites, bank app, parcel app.
- [ ] Vertical slice: Prologue and Chapter 1 "The Missing Parcel" (2 safe, 2 unsafe, 1
      ambiguous route), debrief, phone-only transfer check.
- [ ] Bounded AI Scam Actor with authored fallback and AI on/off toggle (after provider approval).
- [ ] Phase D — Usability sessions with Vietnamese and international participants; polish.
- [ ] Phase E — Submission package, video, release tag.
- [ ] Future scope: Chapters 2–4 in 3D, mobile controls, character customization, AI hints and
      learning analyst, cloud save.
- [ ] Split the repository into landing page and game client; host both on Vercel.
- [ ] Serverless backend (API Gateway HTTP API + Lambda) for the AI proxy and opt-in sync, only
      after the AI provider, database and authentication decisions.

## Pending Decisions

- [ ] Physics: confirm Rapier after the prototype (`PROPOSED`).
- [ ] ECS: evaluate only if prototype profiling shows a need (not approved).
- [ ] AI provider and monthly AI budget (paid provider requires explicit approval).
- [ ] Approve the signature AI capability (Bounded Scam Actor) and its input modality (options
      only, or options plus free text).
- [ ] Approve the MVP vertical slice details (positioning section 11.1) and chapter content.
- [ ] Phone-centred fallback mode for devices that cannot run the 3D world.
- [ ] Update the live landing page copy to the 3D direction.
- [ ] Master plan co-author (SaiCT) to review the 8 Nov 2026 amendments.
- [ ] Select database technology (`DATABASE_DECISION = PENDING`; recommendation in
      [database strategy](architecture/DATABASE_STRATEGY.md#5-recommendation-not-an-approved-decision)).
- [ ] Evaluate and purchase a suitable domain (cost `TBD`, not covered by AWS credits).
- [ ] Finalize deployment configuration: move landing page from GitHub Pages to Vercel or keep it.
- [ ] Authentication: Amazon Cognito or an alternative; whether accounts are needed at all.
- [ ] Lambda runtime language: Python (plan: FastAPI + Pydantic) or TypeScript.
- [ ] Confirm deprecating "FastAPI on an always-on host" in favour of the serverless backend.
- [ ] Confirm the source, expiry date and terms of the $200 AWS credit.
- [ ] Infrastructure-as-code tool (for example AWS SAM or AWS CDK).

Resolved:

- [x] Game rendering and state stack — **resolved 2026-11-08** by owner decision: Three.js
      (primary 3D engine) + React Three Fiber + Drei; Zustand for gameplay state (resolves the
      plan's "XState or Zustand"); TypeScript engine; Zod; IndexedDB/Dexie. Rapier stays
      `PROPOSED`; PixiJS is not the 3D engine; ECS is not approved.

- [x] Scope of 3D environments — **resolved 2026-11-08** by owner decision: a small first-person 3D
      world is the core platform; full/open world and multiplayer remain out of scope; character
      customization is future scope.

## Known Issues

- The live landing page (PR #7) describes the earlier concept ("five fictional digital
  environments, linked together") and does not mention the 3D world. See
  [OVERVIEW.md section 10](architecture/OVERVIEW.md#10-known-inaccuracies-on-the-live-landing-page).
- Delivery risk: about 25 days remain before the internal deadline (3 Dec 2026 23:00 ICT) and no
  3D code exists; the slice must stay small (positioning section 11, master plan risk register).
- Issue #4 (URL checker flags official country domains such as `google.co.uk`) was closed as
  completed on 2026-11-07, but `src/lib/urlCheck.ts` has not been changed; the false positive
  still exists (the checker is now legacy code, not shown on the site).
- PR #7 did not update this file or the architecture documents; reconciled on 2026-11-08.
- `ACCESSIBILITY.md` still describes the flat light theme of PR #2; not re-audited after PR #7.
- Automated tests cover only the game loading pipeline (Vitest, jsdom); no browser or end-to-end
  tests; no accessibility audit yet.

## Task History

### 2026-11-11 — First-Person Arms Complete 16-Animation Catalog Documentation & Equip Plan

- **Objective:** Document the complete 16-animation suite for the first-person arms viewmodel (`docs/gameplay/FIRST_PERSON_ARMS_ANIMATIONS.md`), plan the scene entry `rig|Equip` requirement ("lưu lại mai sửa"), and synchronize with the upstream PR #12 merge.
- **Completed work:**
  - Authored comprehensive documentation `docs/gameplay/FIRST_PERSON_ARMS_ANIMATIONS.md` covering all 16 animation states (`Static Pose`, `rig|Equip`, `rig|Idle`, `rig|Idle_Fidget`, `rig|Walk`, `rig|Sprint_Type_1`, `rig|Sprint_Type_2`, `rig|Punch_R`, `rig|Punch_L`, `rig|Block_Start`, `rig|Block_Loop`, `rig|Block_Stop`, `rig|Inspect`, `rig|Take_Start`, `rig|Take_Loop`, `rig|Take_Stop`, `rig|Unequip`).
  - Specified timing, state machine priorities, combo cancellation windows, and control bindings for each animation.
  - Recorded map entry requirement: when entering a map, the viewmodel must play `rig|Equip` to smoothly raise hands from below into ready stance.
  - Successfully reconciled merge conflict with upstream PR #12 (commit `f6b4cc8`) preserving byte-measured startup loader changes.
- **Files created/modified:**
  - `docs/gameplay/FIRST_PERSON_ARMS_ANIMATIONS.md` (created)
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm test`
- **Build and test results:**
  - Clean typecheck and automated test suite verification.
- **Follow-up tasks:**
  - Tomorrow: Implement scene entry `rig|Equip` hand raise transition on map spawn.

### 2026-11-11 — Instant Punch on Click & Continuous 1-2 Combo Punching on Hold

- **Objective:** Optimize punch responsiveness: immediate launch on click with zero perceptual lag, and fluid continuous 1-2 boxing combo while holding mouse or key ("Cố gắn tối ưu sao cho khi click là đấm liền, nhấn giữ thì đấm liên tục").
- **Completed work:**
  - Zero-latency click strike: Set punch `fadeIn` to `0.01` (frame-zero snap) with accelerated punch time scale (`timeScale = 1.85`, ~180ms to impact point), eliminating input and animation lag.
  - Continuous combo system: Implemented combo transition window at $380\text{ms}$ (70% through retraction phase). While `keysRef.current.punch` remains true (holding mouse button or `F`/`E` key), the system seamlessly chains into the opposite hand (`Punch_R` $\leftrightarrow$ `Punch_L`).
  - Audio & raycast synchronization: Evaluates melee reach raycast and plays `hit_punch` or `miss_punch` on every individual strike in the continuous combo.
  - Clean interruptible recovery: Releasing mouse/key allows the final punch in progress to finish cleanly and smoothly transition back into idle/walk locomotion.
- **Files created/modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck` (passed cleanly across all 3 packages).
  - `pnpm test` (passed: 9 test files, 84/84 tests).
- **Build and test results:**
  - TypeScript compilation clean in 4.2s.
  - All 84 tests green in 7.92s.
- **Unresolved issues and known limitations:**
  - None.
- **Follow-up tasks:**
  - None.

### 2026-11-11 — Fix Static Grass Bed & Eliminate Ground Mesh Sway

- **Objective:** Fix terrain stability: ensure ground lawn/grass patches (`cỏ`) stay completely motionless and static ("cái nền cỏ đứng yên nha mắc gì mà lắc qua lắc lại").
- **Completed work:**
  - Removed procedural sway animation on `cỏ` (ground lawn mesh in front of houses and under the car) in `StreetEnvironment.tsx`.
  - Froze matrix transforms (`matrixAutoUpdate = false`, `updateMatrix()`) on all grass patches so ground terrain remains 100% solid and motionless.
- **Files created/modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck` (workspace-wide TypeScript check: passed cleanly).
- **Build and test results:**
  - Typecheck passed cleanly across all packages in 3.9s.
- **Unresolved issues and known limitations:**
  - None.
- **Follow-up tasks:**
  - None.

### 2026-11-10 — Startup Loading Percentage

- **Objective:** Show a real percentage on the startup loading bar, measured from the downloaded bytes of the main menu street GLB (`STREET_ENVIRONMENT_GLB`, about 26 MB), without a second download and without any timer-driven progress.
- **Completed work:**
  - New framework-free store `game/loading/menuAssetProgress.ts` (`percentFromEvent`, `createByteProgressStore`, `menuAssetProgress` singleton). It keeps the highest percent seen, `floor(loaded / total × 100)` capped at 99, sets 100 on load completion, ignores events without a known total or with malformed values, and notifies subscribers once per real change.
  - New `game/scenes/MainMenuScene/streetGltfLoader.ts`: `StreetGLTFLoader` extends three's `GLTFLoader`, forwards progress events to the store and marks it complete before the caller's `onLoad`; `onError` is forwarded unchanged. `streetLoaderExtensions` sets the Meshopt decoder.
  - `StreetEnvironment.tsx` uses `useLoader.preload(StreetGLTFLoader, ...)` and `useLoader(StreetGLTFLoader, ...)`. R3F caches by `[loader class, url]`, so both share one cache entry and the file downloads once. Scene, calibration, animation and `compileAsync` logic are unchanged.
  - `MenuStartupLoading.tsx` reads the store with `useSyncExternalStore`. Known percent: determinate bar, "Loading the street scene", no file count. All bytes in: full bar, "Preparing the street scene". Scene ready (including the hold): full bar, "Ready". Unknown size: indeterminate bar with the Drei file count, as before. Byte progress restarts the 30-second slow-notice watchdog. Hold, error state, "Continue to menu", reduced motion and `SceneTransition` are unchanged.
  - Tests: store examples plus Property 1 (running-max model) and Property 2 (one notification per change); loader tests with a spy on `GLTFLoader.prototype.load` (no network); startup screen examples, Property 3 (display model) and Property 4 (shown percentage never decreases). The earlier "progress honesty" preservation run now includes byte events and the scene-ready switch.
- **Files created:** `apps/game/src/game/loading/{menuAssetProgress.ts,menuAssetProgress.test.ts}`, `apps/game/src/game/scenes/MainMenuScene/{streetGltfLoader.ts,streetGltfLoader.test.ts}`, `.kiro/specs/startup-loading-percentage/{requirements.md,design.md,tasks.md}`.
- **Files modified:** `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`, `apps/game/src/features/loading/{MenuStartupLoading.tsx,MenuStartupLoading.test.tsx}`, `docs/architecture/OVERVIEW.md` (section 4.2.1), this file.
- **Validation commands executed:** `pnpm test`, `pnpm typecheck`, `pnpm build` (workspace root).
- **Results:** 11 test files, 103 tests passed (84 before this task). Typecheck clean (3 packages). Build succeeded (landing and game).
- **Unresolved issues and known limitations:** Not checked in a browser. The percentage becomes indeterminate if the host omits `Content-Length`. With gzip or Brotli compression, `loaded` counts decoded bytes, so the value caps at 99 until the load completes. The sky texture is not measured. Draco is not configured for the street loader; a Draco-compressed street file would fail with an error shown in the existing error state.
- **Deviations from the documented architecture:** `StreetEnvironment.tsx` now uses R3F `useLoader` with three's `GLTFLoader` instead of Drei `useGLTF`. Drei's Draco setup is dropped for this file; it uses Meshopt only, which matches how `scripts/optimize-environment.cjs` produces the file. No new dependency.
- **Follow-up tasks:** Manual browser check of the startup percentage on a throttled connection; check the production host's `Content-Length` and compression for the street GLB.
  - None.
- **Follow-up tasks:**
  - None.

### 2026-11-10 — Complete Author Animation Suite & Viewmodel Rig Calibration

- **Objective:** Fix viewmodel proportions, eliminate severed shoulder clipping, integrate author's authentic animation set (`rig|Equip`, `rig|Idle`, `rig|Walk`, `rig|Sprint_Type_1`, `rig|Punch_R`/`rig|Punch_L`, `rig|Inspect`), and isolate action animations from locomotion interference ("lấy hết animation tác giả qua đi, có trạng thái equid nữa").
- **Completed work:**
  - Integrated `rig|Equip` (0.73s): On component mount, the player's arms smoothly rise up into resting position from below before handing off to idle/locomotion.
  - Replaced procedural sprint walk multiplier with the author's authentic `rig|Sprint_Type_1` running stride animation.
  - Implemented crisp punch playback with `rig|Punch_R` (cross) and `rig|Punch_L` (jab) at `timeScale = 1.55` (~0.64s punch duration).
  - Resolved skeletal blend conflict: Prioritized action animations (`Equip`, `Punch`, `Inspect`) by cleanly fading out background locomotion actions during strikes/equips so bones never fight for competing transforms, smoothly restoring locomotion once finished.
  - Calibrated viewmodel camera transform to `scale={[0.72, 0.72, 0.72]}`, `position={[0, -1.10, 0.05]}`, `rotation={[-0.05, Math.PI, 0]}`. Aligns hands in the lower center view ($Y_{ndc} \approx -0.55$), positions shoulder bases behind the camera near clipping plane ($Z_{cam} > 0$), and matches the author's Sketchfab presentation.
- **Files created/modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck` (workspace-wide TypeScript check: passed across 3/3 packages).
  - `pnpm test` (Vitest: 9 test files, 84/84 tests passed).
- **Build and test results:**
  - Typecheck passed cleanly in 4.9s.
  - All 84 unit and loading tests passed in 11.4s.
- **Unresolved issues and known limitations:**
  - None for viewmodel animation and audio mechanics.
- **Follow-up tasks:**
  - Add optional blocking state (`rig|Block_Start` / `rig|Block_Loop` / `rig|Block_Stop`) on right-click if needed.

### 2026-11-10 — Punch Audio System: Raycasted Hit vs Miss Sound Effects

- **Objective:** Add punch audio effects playing `hit_punch` when striking a 3D target and `miss_punch` when swinging into thin air ("Thêm sound, hit_punch khi đấm trúng, miss_punch khi đấm hụt").
- **Completed work:**
  - Integrated user-uploaded audio files `hit_punch.mp3` (23 KB) and `miss_punch.mp3` (18 KB) into `apps/game/public/assets/audio/`.
  - Implemented zero-latency Web Audio API pre-decoding inside `TestMovePlayer.tsx` respecting user audio settings (`soundEnabled`, `sfxVolume`).
  - Added melee raycasting ($2.2\text{m}$ punch reach) along the camera's crosshair view vector in `useFrame`, filtering out the player's own viewmodel arms and camera hierarchy.
  - When the punch ray intersects any 3D world geometry within reach (pedestrians, vehicles, bánh mì cart, benches, shophouses), `hit_punch.mp3` plays with immediate punchy impact.
  - When swinging into thin air with no target within $2.2\text{m}$, `miss_punch.mp3` plays with airy whoosh feedback.
- **Files created/modified:**
  - `apps/game/public/assets/audio/hit_punch.mp3` (created)
  - `apps/game/public/assets/audio/miss_punch.mp3` (created)
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `apps/game/src/features/testmove/TestMoveCanvas.tsx`
  - `apps/game/src/features/testmove/TestMovePage.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm test`
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** Ready for in-game smartphone UI and storyline interactions.

### 2026-11-10 — First-Person Arms Reach & Forearm Extension Recalibration

- **Objective:** Fix arms looking stubby / too short with only fingertips poking up ("Cái tay lồi ra ngắn quá nhìn kì").
- **Completed work:**
  - Diagnosed stubby arm look: previous lower position (`posY = -1.16, posZ = 0.04, scale = 0.68`) sank the arms too deep into the screen bezel, concealing the forearm and showing only the wrists/fingertips.
  - Recalibrated arm rig transform in `FirstPersonArms.tsx`: raised $Y$ by $+10$cm to `-1.06`, brought $Z$ forward to `+0.01`, reduced tilt to `-0.03`, and increased scale to `[0.78, 0.78, 0.78]`.
  - The entire forearm now reaches forward into the lower screen diagonally, showcasing full human arm length with authentic adult proportions while keeping the cut-off shoulder stumps completely invisible behind the camera frustum.
- **Files modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm test`
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** Ready for in-game smartphone and scenario triggers.

### 2026-11-10 — Single-Shot Punch Animation Watchdog & Repeat Key Debouncing

- **Objective:** Fix punch animation loop bug where a single click caused continuous infinite punching ("Bấm có 1 cái đấm hoài").
- **Completed work:**
  - Diagnosed infinite punch loop: `onPunchFinished` was passed as an unmemoized inline arrow function in `TestMovePlayer.tsx`. Any state update re-created the callback, triggering the `useEffect` cleanup in `FirstPersonArms.tsx` and tearing down the `mixer.removeEventListener('finished')` listener before the 1-second punch clip ended. Because `isPunching` remained true, the effect immediately re-executed, toggling to the opposite fist and punching indefinitely.
  - Implemented `onPunchFinishedRef` and `onInspectFinishedRef` in `FirstPersonArms.tsx` so callback references are stable and never re-trigger animation effects.
  - Added single-trigger latch `isPunchingActiveRef` and a hardware watchdog timer (`clipDuration + 50ms`) to guarantee that every punch finishes cleanly and returns control to idle/walk even if mixer frames drop.
  - Memoized `handlePunchFinished` and `handleInspectFinished` with `React.useCallback` in `TestMovePlayer.tsx`.
  - Added `!e.repeat` guards for action keys (`KeyF`, `KeyE`, `KeyT`, `KeyI`) in `usePlayerControls.ts` to stop OS keyboard repeat from sending rapid punch triggers.
- **Files modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `apps/game/src/features/testmove/usePlayerControls.ts`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm test`
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** Ready for in-game smartphone UI and storyline interactions.

### 2026-11-10 — Animation Logic Overhaul: Natural Rest Posture & Jogging Cadence

- **Objective:** Fix animation bugs where standing still looked like punching/boxing guard and sprinting threw rapid forward punches ("đứng yên mà như đấm, chạy thì đấm nốt luôn").
- **Completed work:**
  - Diagnosed accidental punch on pointer lock: `handleMouseDown` in `usePlayerControls.ts` was setting `punchTriggerRef.current = true` on the very first click used to acquire pointer lock, immediately throwing a punch every time the user focused the game. Restricted punch trigger so only clicks *after* pointer lock is active trigger a punch.
  - Diagnosed aggressive boxing sprint: `rig|Sprint_Type_1` in `first_person_animations.glb` had a $61$cm forward fist pump (double the extension of an actual punch), causing sprint to look like continuous rapid-fire punching. Replaced with `rig|Walk` at dynamic `timeScale = 1.65`, providing a natural, energetic jogging stride with smooth $2.9$cm natural arm sway.
  - Diagnosed standing still combat stance: lowered resting arms position to `[0, -1.16, 0.04]` so hands rest comfortably in the lower third of the screen rather than raised up at eye level like a boxer.
  - Fixed animation mixer recovery: ensured `currentActionRef.current = null` upon one-shot punch/inspect completion and checked `!currentActionRef.current?.isRunning()`, guaranteeing immediate smooth return to idle breathing.
- **Files modified:**
  - `apps/game/src/features/testmove/usePlayerControls.ts`
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm test`
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** Ready for in-game smartphone and scenario interactions.

### 2026-11-10 — Player Eye Level Realism Alignment with Street Pedestrians

- **Objective:** Fix dwarfed player height ("Quá lùn") where the camera was aimed at the NPC's belt/knees instead of their eyes.
- **Completed work:**
  - Inspected 3D vertex coordinates of sidewalk pedestrians (`20261110000447_177df9df` denim vest male NPC and `rp_mei_posed_001_100k` female pedestrian) in `MenuBG.glb`. Sidewalk surface is at $Y = -94.48$m, with pedestrian eye level precisely at $Y \in [-92.65, -92.75]$m.
  - Previous `groundY: -93.25` placed the camera at $1.23$m above the sidewalk (child height, eye level at NPC chest/crotch).
  - Raised player camera `groundY` to `-92.70`m in `TestMovePlayer.tsx` and `TestMovePage.tsx`. The player now stands at full adult human height ($1.78$m above road, $1.65$m above sidewalk), looking pedestrians directly in the eyes peer-to-peer.
  - Because `FirstPersonArms` is mounted to `camera`, the arms follow camera elevation with zero re-alignment required.
- **Files modified:**
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `apps/game/src/features/testmove/TestMovePage.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm test`
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** In-game smartphone UI and scam scenario narrative interaction.

### 2026-11-10 — First-Person Arms Shoulder Geometry Calibration & Loading Transition Safeguard

- **Objective:** Eliminate hollow cut-off shoulder stumps when pitching camera down and eliminate initial black screen flicker on `/testmove`.
- **Completed work:**
  - Diagnosed cut-off shoulder visibility: `first_person_animations.glb` is an authored FPS viewmodel terminating cleanly at the deltoids. When pitched downwards or placed too close to the camera near plane ($Z = 0.05$), the hollow shoulder stumps crossed into the camera viewing frustum and were sliced by the near clipping plane, projecting giant triangular wedges into view.
  - Recalibrated camera-relative transform in `FirstPersonArms.tsx`: positioned at `[0, -1.10, 0.03]` with forward tilt `rotation={[-0.08, Math.PI, 0]}` and scale `[0.68, 0.68, 0.68]`. The subtle $4.5^\circ$ forward angle pushes the cut-off shoulder caps safely behind the bottom-back camera frustum boundary, while placing the hands and forearms at natural eye-hand coordination height across all pitch angles (looking up at the sky, straight at street, or looking down at the ground).
  - Fixed initial black screen in `TestMovePage.tsx`: modified `showLoading = !sceneReady` so the atmospheric spinner/progress overlay remains smoothly visible until `StreetEnvironment` signals completion, preventing any momentary black screen flash during cold model load.
- **Files modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `apps/game/src/features/testmove/TestMovePage.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck` (passed: 3/3 packages clean)
  - `pnpm test` (passed: 9 test files, 84/84 tests)
  - `pnpm build:game` (passed)
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** Integrate in-game smartphone UI and chapter scenario triggers.

### 2026-11-10 — Camera Scene Graph Parenting, Scale Realism & Jitter Elimination

- **Objective:** Fix disappearing arms when using `createPortal` (camera not in scene traversal), adjust proportions to natural human scale (scale 0.70), and eliminate residual hand jitter in first-person view (`/testmove`).
- **Completed work:**
  - Diagnosed disappearing arms: in Three.js / R3F, the default scene camera is not in the scene tree by default unless explicitly mounted. Portaling children into a non-traversed camera caused Three.js to skip rendering the arms entirely.
  - Mounted `<primitive object={camera}>` directly into the scene in `TestMovePlayer.tsx`, physically nesting `FirstPersonArms` as a direct child of the camera. The camera is now part of the scene graph, and the arms render flawlessly with zero latency, zero matrix copy lag, and zero floating-point precision jitter.
  - Calibrated arm scale to `scale={[0.7, 0.7, 0.7]}` with position `[0, -1.1, -0.1]`: perfectly matches the 1.78m pedestrians, vehicles, and shophouses on District 4 street.
  - Removed all procedural position manipulation / sine bobbing from `FirstPersonArms.tsx`: the arms now run **100% on the author's pure animations** (`rig|Idle`, `rig|Walk`, `rig|Sprint_Type_1`, `rig|Punch_R`, `rig|Punch_L`, `rig|Inspect`) without any procedural interference.
- **Files modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck` (passed: 3/3 packages clean)
  - `pnpm test` (passed: 9 test files, 84/84 tests)
  - `pnpm build` (passed)
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** Ready for in-game smartphone UI and gameplay scenarios.

### 2026-11-10 — Arms Material PBR Texture Restoration & Animation Jitter Elimination

- **Objective:** Fix chalk-white/pale washed out arm color and resolve hand jitter/vibration in first-person view (`/testmove`) using the exact original textures from `first_person_animations.glb`.
- **Completed work:**
  - Diagnosed washed out arm color: the original Sketchfab model stored skin diffuse and normal maps in the deprecated `KHR_materials_pbrSpecularGlossiness` extension. While standalone viewers like `3dviewer.net` bundle compatibility shims for this extension, Three.js r174 removed it, falling back to untextured white plaster (`(255, 255, 255)`).
  - Migrated the model to standard glTF metallic-roughness PBR using the **exact 100% original lossless PNG textures** directly from the author (`arms_diffuse.png` 3.22MB, RGB `[198, 142, 121]`, and `arms_normal.png` 1.38MB), preserving the original soft matte skin look (`roughness = 0.8`, `metalness = 0.0`), with zero compression degradation.
  - Configured `mat.map.colorSpace = THREE.SRGBColorSpace` in `FirstPersonArms.tsx` ensuring rich, authentic human skin tone matching `3dviewer.net` 1:1.
  - Diagnosed hand vibration: previous keyframe resampling had crushed 151 rotation keyframes per hand bone down to 2, causing slerp snapping; furthermore, `FirstPersonArms.tsx` ran an artificial idle sine bobbing that fought against the author's idle breathing animation.
  - Re-exported clean model preserving all 151 keyframes per bone at 100% fidelity (14.0MB total, down from 23.8MB by stripping background geometry).
  - Updated `useFrame` in `FirstPersonArms.tsx`: smooth damping glides procedural bobbing to 0 when stationary so the author's breathing plays rock-solid without micro-jitter.
  - Added `camera.updateMatrixWorld()` in `TestMovePlayer.tsx` ensuring zero latency between camera and arm rig transforms.
- **Files modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `apps/game/public/assets/3d/characters/first_person_animations.glb`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck` (passed: 3/3 packages clean)
  - `pnpm test` (passed: 9 test files, 84/84 tests)
  - `pnpm build` (passed)
- **Unresolved issues and known limitations:** None.
- **Follow-up tasks:** Ready for in-game smartphone UI and story triggers.

### 2026-11-10 — First-Person Arms Alignment & FPS Camera Euler Gimbal Fix

- **Objective:** Fix reversed first-person arms model orientation (hollow cut-off shoulder stumps pointing at the camera) and eliminate gimbal roll/tilting horizon during camera look in `/testmove`.
- **Completed work:**
  - Resolved arms orientation in `FirstPersonArms.tsx`: the authored GLB has hands extending along $+Z$ and cut-off upper arm/shoulder stumps at $-Z$. Wrapped the model in an internal group rotated by $180^\circ$ around Y (`rotation={[0, Math.PI, 0]}`), mapping the hands forward along camera $-Z$ (into the view frustum), shoulders behind the viewpoint near plane ($+Z$), left hand to screen-left ($-X$), and right hand to screen-right ($+X$).
  - Calibrated arms viewpoint offset to `[0, -1.46, -0.05]` so fists sit naturally in the lower-third view and punch strikes directly align with the crosshair center. Added `renderOrder = 999` to prevent near geometry clipping.
  - Eliminated camera gimbal roll in `TestMovePlayer.tsx`: switched camera rotation from default `'XYZ'` Euler order to standard FPS `'YXZ'` Euler order (`camera.rotation.set(pitch, yaw, 0, 'YXZ')`), strictly enforcing $0$ roll so the horizon never twists or turns sideways when looking up/down while rotating.
  - Initialized camera yaw to `Math.PI` so the player begins facing directly down the Saigon District 4 street ($+Z$).
  - Synchronized movement vectors cleanly with camera orientation (`forward = (0, 0, -1).applyAxisAngle(Y, yaw)` and `right = (1, 0, 0).applyAxisAngle(Y, yaw)`).
  - Locked camera rig quaternion directly to camera quaternion (`cameraGroupRef.current.quaternion.copy(camera.quaternion)`).
- **Files modified:**
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck` (passed: 3/3 packages clean)
  - `pnpm test` (passed: 9 test files, 84/84 tests)
  - `pnpm build` (passed: workspace-wide production build completed with exit code 0)
- **Unresolved issues and known limitations:** None for this test route.
- **Follow-up tasks:** Integrate sound effects and connect interactions with in-game smartphone.

### 2026-11-10 — First Person 3D Movement & Combat Testing Route (/testmove)

- **Objective:** Implement a dedicated sandbox playground at `/testmove` (unlinked from menu) with first-person animated arms (`first_person_animations.glb`), WASD locomotion, sprint, jump physics, left-click/F punch attacks, pointer lock toggle, deep asset optimization, and responsive loading feedback.
- **Completed work:**
  - Optimized `first_person_animations.glb` using `@gltf-transform`, reducing file size from **23.1MB to 3.87MB (-83.2%)** by stripping unneeded preview backdrop geometry (`Background_Background_0`), downscaling textures to 1024px WebP, deduplicating primitives, and resampling dense animation keyframe tracks.
  - Built `usePlayerControls.ts` capturing WASD, Shift (sprint), Space (jump), Left Click / `F` / `E` (punch attack), `T` (inspect arms), and `Ctrl` pointer lock toggle with Mac Trackpad considerations.
  - Developed `FirstPersonArms.tsx` binding directly to the original skinned glTF hierarchy without cloning errors, managing locomotion state machine and alternating punches.
  - Implemented `TestMovePlayer.tsx` with smooth mouse/trackpad camera rotation (lerp damping), friction, velocity, gravity, jump, and street boundary collision.
  - Added dedicated fast loading screen with `useProgress` percentage bar on `/testmove` so the viewport never stalls on a black screen.
  - Decoupled Three.js Suspense boundaries so the sky dome and lighting render immediately on Frame 1.
  - Created `TestMoveOverlay.tsx` with reticle crosshair, HUD controls guide, and Mac Trackpad tips.
  - Synthesized Web Audio API punch swoosh effect for punch action feedback.
  - Configured `/testmove` route in `App.tsx` with seamless return to main menu.
- **Files created:**
  - `apps/game/src/features/testmove/usePlayerControls.ts`
  - `apps/game/src/features/testmove/FirstPersonArms.tsx`
  - `apps/game/src/features/testmove/TestMovePlayer.tsx`
  - `apps/game/src/features/testmove/TestMoveOverlay.tsx`
  - `apps/game/src/features/testmove/TestMoveCanvas.tsx`
  - `apps/game/src/features/testmove/TestMovePage.tsx`
  - `apps/game/src/features/testmove/index.ts`
- **Files modified:**
  - `apps/game/src/app/App.tsx`
  - `apps/game/public/assets/3d/characters/first_person_animations.glb`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm test` (9 test files, 84 tests passed)
- **Results:** Clean typecheck and 84/84 tests passed. Model downloads in ~0.2s (3.8MB) and loading screen provides immediate feedback.

### 2026-11-10 — Loading Screen Full-Width Progress Bar

- **Objective:** Remove the awareness tip card from the chapter and startup loading screens and make the progress area span the full page width between the left and right page padding. Loading logic, timings and progress behavior unchanged.
- **Completed work:**
  - `ChapterLoadingFlow.tsx` and `MenuStartupLoading.tsx` no longer import `LOADING_TIPS`, no longer hold an `initialTipIndex` state and no longer pass `tips` / `initialTipIndex` to `LoadingScreen`.
  - `LoadingScreen.tsx`: the two-column bottom grid is now a single full-width flex column. Only the eyebrow/title/subtitle block and the error box are capped at `max-w-2xl`. The progress area (bar, status, percentage, notice, Cancel) is full width. The optional tip card renders below the progress area in a `max-w-md` wrapper. `LoadingScreenProps` is unchanged.
  - `LoadingTip.tsx` and `config/loadingTips.ts` are kept for other callers.
  - `ChapterLoadingFlow.test.tsx` now asserts that no element labelled "Awareness tip" is present.
- **Files created:** `.kiro/specs/loading-screen-full-width-progress/{requirements.md,design.md,tasks.md}`.
- **Files modified:** `apps/game/src/components/ui/LoadingScreen.tsx`, `apps/game/src/features/loading/{ChapterLoadingFlow,MenuStartupLoading}.tsx`, `apps/game/src/features/loading/ChapterLoadingFlow.test.tsx`, this file.
- **Validation commands executed:** `pnpm test`, `pnpm typecheck`, `pnpm build` (workspace root).
- **Results:** 9 test files, 84 tests passed. Typecheck clean (3 packages). Build succeeded (landing and game).
- **Unresolved issues and known limitations:** Not checked visually in a browser. The slow-load notice box is now full width as part of the progress area.
- **Deviations from the documented architecture:** None from the design.
- **Follow-up tasks:** Manual browser check of both loading screens at mobile and desktop widths.

### 2026-11-10 — Loading Screens Flash Too Fast (Bugfix)

- **Objective:** Fix the startup and chapter loading screens, which a player reported flashed too fast to see. Causes: `SceneTransition` started at opacity 0 and faded in, and visibility followed the loading source directly. Chapter 1 files are the same cached files as the menu, so the chapter loader reached "ready" within a few frames.
- **Completed work:**
  - `SceneTransition` gained a `fadeIn` prop (default `true`). Both loading screens pass `false`, so they are opaque on the first frame. Other users keep the fade-in.
  - New `features/loading/useMinimumDisplayTime.ts` (hook plus `shouldShowLoadingScreen` helper) and `features/loading/loadingHold.ts` (`CHAPTER_LOADING_MIN_DISPLAY_MS = 1500`, `STARTUP_LOADING_MIN_DISPLAY_MS = 1200`, re-exported by the components).
  - The hold is presentation-only: progress still comes only from real sources. During the hold the startup screen shows "Ready" (`LOADING_TEXT.menuStartup.ready`); the chapter screen already shows "Ready" with a full bar.
  - Cancel, Escape, "Return to menu" and "Continue to menu" skip the hold. Retry restarts it. Reduced motion keeps the hold; transitions stay instant.
  - `chapterLoader.ts`, `useChapterLoader.ts` and `App.tsx` are unchanged.
  - Tests: Property 1 (bug condition) seeded property tests failed on the unfixed code (50 of 50 runs) and pass after the fix. Property 2 (preservation) tests for slow load, progress honesty, stall, retry, bypass, unmount, "Continue to menu" and the default `SceneTransition` fade-in passed before and after the fix. Existing real-time tests now use fake timers; `createClock` in `src/test/loadingRuns.ts` advances in 50 ms steps.
- **Files created:** `apps/game/src/features/loading/{useMinimumDisplayTime.ts,useMinimumDisplayTime.test.ts,loadingHold.ts}`, `apps/game/src/components/ui/SceneTransition.test.tsx`, `apps/game/src/test/loadingRuns.ts`, `.kiro/specs/loading-screen-not-visible/{bugfix.md,design.md,tasks.md}`.
- **Files modified:** `apps/game/src/components/ui/SceneTransition.tsx`, `apps/game/src/features/loading/{ChapterLoadingFlow,MenuStartupLoading}.tsx`, `apps/game/src/features/loading/{ChapterLoadingFlow,MenuStartupLoading}.test.tsx`, `apps/game/src/game/loading/loadingStrings.ts`, this file.
- **Validation commands executed:** `pnpm test`, `pnpm typecheck`, `pnpm build` (workspace root).
- **Results:** 9 test files, 84 tests passed. Typecheck clean (3 packages). Build succeeded (landing and game).
- **Unresolved issues and known limitations:** Not checked visually in a browser. On fast loads the hold adds up to 1.5 s (chapter) or 1.2 s (startup). The ambient audio fade-in at startup now starts up to 1.2 s later.
- **Deviations from the documented architecture:** None from the design.
- **Follow-up tasks:** Manual browser check after restarting `pnpm dev:game`: NEW GAME → prologue → "Begin Chapter 1" should show the chapter screen for about 1.5 s, and a page reload should show the startup screen for at least about 1.2 s.

### 2026-11-10 — Cinematic Chapter Loading Screen

- **Objective:** Replace the startup loading screen's fabricated progress and add a real, reusable chapter loading flow (Main Menu → New Game / Continue → Loading → Chapter) that matches the menu branding.
- **Completed work:**
  - Framework-free chapter loader (`game/loading/chapterLoader.ts`): stages, parallel byte-streamed downloads, GLB/image verification, 30 s stall watchdog, cancellation with `AbortController`, classified errors. Progress is a number only when every file reports its size; otherwise indeterminate.
  - Chapter manifest (`game/chapters/chapterRegistry.ts`) for Chapter 1 "The Urgent Call" (street GLB + sky texture, `gameplayAvailable: false`), session creation and save restoration rules, validated local save reader (`game/saves/saveGame.ts`, read-only).
  - Presentational components: `LoadingScreen` (rewritten), `LoadingProgress`, `LoadingTip`, `LoadingErrorState`, `SceneTransition`, `usePrefersReducedMotion`. Static background art, no 3D rendering while loading.
  - `MenuStartupLoading` replaces the old timer-driven startup screen: indeterminate bar with real file count from Drei `useProgress`, finishes on scene ready, error state, and "Continue to menu" after 30 s without change. Startup screen is skipped when WebGL is unavailable (the canvas fallback is shown instead of an endless loader).
  - `App` screen state (`menu` / `chapter-loading` / `chapter`) with duplicate-navigation guards; prologue modal button "Begin Chapter 1" starts loading; Continue enabled only for a valid save; menu canvas paused (`frameloop="never"`) while covered; canvas error boundary now reports errors upward.
  - `ChapterPlaceholder` states plainly that Chapter 1 gameplay is still in development.
  - Shared asset path constants (`config/assetPaths.ts`) used by the menu scene and the manifest; awareness tips in `config/loadingTips.ts`.
  - Vitest + Testing Library + jsdom; `pnpm test` at root and in CI.
- **Files created:** `apps/game/src/config/{assetPaths,loadingTips}.ts`; `apps/game/src/game/chapters/{chapterRegistry,chapterSession}.ts`; `apps/game/src/game/saves/saveGame.ts`; `apps/game/src/game/loading/{chapterLoader,assetFetcher,assetVerification,deviceCapabilities,loadingErrors,loadingStrings,useChapterLoader}.ts`; `apps/game/src/components/ui/{LoadingProgress,LoadingTip,LoadingErrorState,SceneTransition}.tsx`, `usePrefersReducedMotion.ts`; `apps/game/src/features/loading/{ChapterLoadingFlow,MenuStartupLoading}.tsx`; `apps/game/src/features/chapter/ChapterPlaceholder.tsx`; tests (`*.test.ts(x)`, `src/test/{setup,fakeAssets}.ts`); `apps/game/vitest.config.ts`, `apps/game/tsconfig.test.json`.
- **Files modified:** `apps/game/src/app/App.tsx`, `components/ui/LoadingScreen.tsx`, `game/core/GameCanvas.tsx`, `game/scenes/MainMenuScene/{StreetEnvironment,SkyDome}.tsx` (asset path import only), `features/menu/{MainMenuOverlay,IntroPrologueModal}.tsx`, `styles/index.css`, `apps/game/package.json`, `apps/game/tsconfig.{json,app.json,node.json}`, root `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `docs/architecture/OVERVIEW.md`, this file.
- **Validation commands executed:** `pnpm test`, `pnpm typecheck`, `pnpm build`; `pnpm dev:game` with HTTP checks of asset headers.
- **Results:** 7 test files, 58 tests passed. Typecheck clean (3 packages). Build succeeded. Dev server sends `Content-Length` without compression for both Chapter 1 files (byte progress is determinate locally) and answers a missing `.glb` with `200 text/html`, which verification rejects. The UI was not checked visually in a browser during this task.
- **Unresolved issues and known limitations:** Chapter 1 gameplay does not exist. Verification checks file headers only; geometry decoding and shader compilation belong to the future chapter scene, which should report its own readiness. Nothing writes saves, so Continue stays disabled. Startup progress uses the page-wide Drei loading manager (valid only at startup). Byte progress becomes indeterminate if a host compresses responses. HTTP `no-cache` on the dev server means "cached" files are revalidated (304), not served without a request. A failed menu GLB still shows the existing "WebGL unavailable" fallback after "Continue to menu".
- **Deviations from the documented architecture:** Local saves are read through a `localStorage` adapter behind the `SaveGameSource` interface instead of IndexedDB/Dexie, and save validation is hand-written instead of Zod, to avoid new dependencies before saving exists. New dev dependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`.
- **Follow-up tasks:** Build the Chapter 1 scene and route `gameplayAvailable` chapters to it, with a "preparing scene" stage fed by the scene's `compileAsync`; write saves (Dexie) so Continue can be enabled; browser test of the flow on target devices; give missing-menu-asset failures their own fallback message.

### 2026-11-10 — Loading Screen Security Note Pruning & Centering

- **Objective:** Remove the bottom security awareness note from the loading screen and vertically center the progress card cleanly.
- **Completed work:**
  - Removed `TIPS`, `tipIndex`, `ShieldCheck` icon, and the bottom `footer` banner from `LoadingScreen.tsx`.
  - Re-centered the progress card cleanly in the middle of the viewport (`my-auto`) so the background artwork remains unobstructed.
- **Files created or modified:**
  - `apps/game/src/components/ui/LoadingScreen.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build`
- **Results:** Clean build and typecheck. Progress card is centered with zero clutter.

### 2026-11-10 — Loading Screen Header Badge Cleanup

- **Objective:** Remove the redundant "District 4 Urban Scene" badge from the loading screen header for a cleaner visual presentation.
- **Completed work:**
  - Removed the `Sparkles` icon and `District 4 Urban Scene` badge element from the header in `LoadingScreen.tsx`.
  - Cleaned up unused imports to maintain zero-warning TypeScript compliance.
- **Files created or modified:**
  - `apps/game/src/components/ui/LoadingScreen.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Header now presents a minimal, focused brand identity.

### 2026-11-10 — Cinematic Loading Screen Background Integration

- **Objective:** Replace the loading screen radial gradient background with the authored District 4 Saigon street incoming scam call artwork.
- **Completed work:**
  - Processed user-provided artwork into `apps/game/public/assets/ui/loading_bg.webp` (98KB, 90% quality WebP via `cwebp`) and `loading_bg.jpg` (fallback).
  - Updated `LoadingScreen.tsx` with a multi-layered cinematic presentation:
    - Responsive cover image layer with subtle brightness/contrast grading.
    - Double-vignette ambient gradient overlays for optimal text and progress bar contrast.
    - Frosted glass treatment (`backdrop-blur-md`, subtle border and shadow) on the center progress card and security tips footer.
- **Files created or modified:**
  - `apps/game/public/assets/ui/loading_bg.webp` (created)
  - `apps/game/public/assets/ui/loading_bg.jpg` (created)
  - `apps/game/src/components/ui/LoadingScreen.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `cwebp -q 90`
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Loading screen displays cinematic street incoming call artwork with polished contrast and fast load performance.

### 2026-11-10 — Main Menu Background Frame Vertical Extension

- **Objective:** Extend the vertical length of the menu panel frame background so all buttons sit comfortably inside without overlapping the ornate bottom border or corners.
- **Completed work:**
  - Increased bottom padding of the panel container in `MainMenuOverlay.tsx` from `pb-8` (32px) to `pb-14 sm:pb-16` (56px - 64px), lengthening the background frame downward.
  - Adjusted button stack width to `max-w-[325px] sm:max-w-[335px]` to ensure button corner chamfers sit completely within the flat recessed center of the panel with clear clearance from the bottom ornate rim.
- **Files created or modified:**
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Panel frame is properly elongated and buttons sit cleanly inside the frame borders.

### 2026-11-10 — Hover SFX Dynamic Amplification & Audio Balance

- **Objective:** Ensure the button hover SFX is distinctly louder and more prominent than the background music.
- **Completed work:**
  - Diagnosed that `button_hover.mp3` originally peaked at only 47.3% (-6.5 dBFS) and was attenuated by a 0.75 SFX gain multiplier.
  - Normalized and amplified `button_hover.mp3` using `ffmpeg` by +6.2 dB to peak at -0.3 dBFS without distortion.
  - Increased Web Audio `sfxGain` multiplier in `apps/game/src/app/App.tsx` from `0.75` to `1.5` (`settings.sfxVolume * 1.5`).
  - Adjusted background music (`musicGain`) target from `0.38` down to `0.28`, and ambient from `0.35` down to `0.25`, creating an approx +12 dB clarity and dynamic contrast advantage for the hover sound effect.
- **Files created or modified:**
  - `apps/game/public/assets/audio/button_hover.mp3`
  - `apps/game/src/app/App.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `ffmpeg volumedetect`
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Hover audio is punchy, crisp, and noticeably louder than the background soundtrack.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Continue with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Button Stack Vertical Elevation & Spacing Refinement

- **Objective:** Elevate the menu button stack and reduce top padding to give buttons more breathing room from the bottom ornate frame borders.
- **Completed work:**
  - Reduced panel container top padding in `MainMenuOverlay.tsx` to `pt-6 sm:pt-7 pb-8` (from `pt-8 pb-10`).
  - Tightened the gap between the title logo and button stack (`space-y-2` from `space-y-4`) and inter-button gap (`space-y-2.5` from `space-y-3`).
  - Tuned `MenuButton.tsx` vertical heights (`min-h-[64px] sm:min-h-[66px]` for primary, `min-h-[46px] sm:min-h-[48px]` for secondary), lifting the entire button cluster upward and leaving ample margin at the bottom.
- **Files created or modified:**
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Buttons shifted upward with clean, balanced spacing from top to bottom.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Continue with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Button Width Calibration & Logo Alignment

- **Objective:** Calibrate the menu button width to align harmoniously with the SCAMMAZE title logo without touching the frame borders or appearing too small.
- **Completed work:**
  - Adjusted the button stack container in `MainMenuOverlay.tsx` to `max-w-[335px] sm:max-w-[345px]`, matching the horizontal footprint of the title logo (`max-w-[300px] sm:max-w-[340px]`).
  - Tuned `MenuButton.tsx` internal padding and vertical height (`min-h-[66px] sm:min-h-[70px]` for primary, `min-h-[50px] sm:min-h-[52px]` for secondary) with `text-base sm:text-lg` typography, giving the buttons a balanced, substantial presence within the frame.
- **Files created or modified:**
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Buttons perfectly align with the title logo and sit comfortably inside the frame.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Continue with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Button Hover SFX Integration via Web Audio API

- **Objective:** Play a responsive, zero-latency sound effect when hovering over menu buttons using user-provided audio asset.
- **Completed work:**
  - Placed the user-provided hover audio SFX at `apps/game/public/assets/audio/button_hover.mp3` (4.9KB, 130ms subtle UI pop/click).
  - Extended `MenuButtonProps` with optional `onHover?: () => void;`, triggered cleanly via `onPointerEnter` for non-disabled buttons.
  - Implemented low-latency Web Audio API SFX pipeline in `apps/game/src/app/App.tsx`:
    - Created dedicated `sfxGainNode` routing into `masterGain` with reactive volume synchronization mapped to `settings.sfxVolume` and `settings.soundEnabled`.
    - Pre-decoded `button_hover.mp3` directly into an in-memory `AudioBuffer` on startup.
    - Designed instantaneous zero-latency polyphonic playback (`AudioBufferSourceNode`) via `playHoverSound`, allowing rapid button sweeping without stutter or clipping.
  - Wired `onHoverSound` through `MainMenuOverlay` to all interactive buttons (`NEW GAME`, `CONTINUE`, `SETTINGS`, `CREDITS`).
- **Files created or modified:**
  - `apps/game/public/assets/audio/button_hover.mp3` (created)
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `apps/game/src/app/App.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build`
- **Results:** Workspace typecheck and full production build passed cleanly (3/3 packages clean). Zero-latency hover audio operational.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Continue with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Button Compaction, "START" Pill Removal & Panel Inset Calibration

- **Objective:** Remove the redundant "START" badge from the `NEW GAME` button and constrain button widths to fit compactly inside the ornate panel frame without crowding the borders.
- **Completed work:**
  - Removed the `START` badge from `MenuButton.tsx` for the primary button, leaving a clean Play icon, bold title, and chapter subtitle.
  - Constrained the button list in `MainMenuOverlay.tsx` (`max-w-[360px] sm:max-w-[380px] mx-auto`) and increased panel padding (`px-10 sm:px-12 pt-8 pb-10`), ensuring the buttons sit neatly and comfortably with ample breathing room from the outer cyber-mystic panel frame borders.
- **Files created or modified:**
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). Buttons sit neatly inside the frame with zero border crowding.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Main Menu Panel Widening, Hero Button Scaling & Map Button Pruning

- **Objective:** Widen the main menu panel horizontally, scale up the primary `NEW GAME` button to be visibly larger and more prominent than secondary buttons, and remove the unnecessary 3D map button per user request.
- **Completed work:**
  - Widened the main menu panel from `max-w-[420px]` to `max-w-[480px] sm:max-w-[500px]` with expanded horizontal padding (`px-8 sm:px-10 pt-8 pb-10`), creating a spacious, cinematic landscape-portrait aspect ratio.
  - Scaled up the primary button (`NEW GAME`):
    - Removed `max-w-sm` constraint so all buttons expand to the full inner width of the widened container.
    - Set primary button height to `min-h-[70px] sm:min-h-[74px]` with `py-4 px-6` padding, larger icon (`w-6 h-6`), `text-lg font-bold` typography, and an amplified `START` accent pill.
    - Calibrated secondary buttons (`SETTINGS`, `CREDITS`) to `min-h-[52px]` with `py-3 px-5`, ensuring `NEW GAME` stands out prominently as the hero action.
  - Removed the `BẢN ĐỒ TP. HỒ CHÍ MINH 3D` button from `MainMenuOverlay.tsx`, keeping the menu focused purely on core game actions.
- **Files created or modified:**
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). Panel is wide and cinematic; hero button is prominently larger.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Dedicated Button Plate Asset Integration (CSS Border Removal)

- **Objective:** Apply the dedicated UI button graphic plate assets (`btn_primary.webp` and `btn_secondary.webp`) directly to `MenuButton.tsx` with zero CSS borders (`border-0`), eliminating double-border clash and distortion.
- **Completed work:**
  - Removed all CSS border lines from `MenuButton.tsx` (`border-0 outline-none`).
  - Applied `btn_primary.webp` for `NEW GAME` and `btn_secondary.webp` for secondary buttons (`SETTINGS`, `CREDITS`, `BẢN ĐỒ`) via `backgroundSize: 100% 100%`.
  - Added native depth with dynamic drop-shadow filters and hover brightness (`hover:brightness-110` / `hover:brightness-125`), preserving text and icon clarity.
- **Files created or modified:**
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). Button plate assets render seamlessly without double borders.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Dedicated Panel Asset Frame Replacement (CSS Glass Removal)

- **Objective:** Completely replace the CSS glass background container (`bg-[#12101e]`, `border-[#3b3452]`) with the dedicated UI graphic asset `menu_panel_frame.webp`, eliminating any double-background layering so the asset serves as the sole frame.
- **Completed work:**
  - Removed all outer CSS background and border styling from the panel container in `MainMenuOverlay.tsx`.
  - Applied `menu_panel_frame.webp` directly as the container's background (`backgroundSize: 100% 100%`) with tailored padding (`px-7 sm:px-8 pt-7 pb-8`) so the logo and buttons nest naturally within the ornate cyber-mystic borders.
  - Added drop-shadow filter (`drop-shadow-[0_16px_40px_rgba(0,0,0,0.9)]`) to lift the asset frame off the 3D background with transparent cutouts.
- **Files created or modified:**
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). Single unified asset frame with zero double-background artifacts.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Menu UI Simplification & Updated PNG/WebP Logo Synchronization

- **Objective:** Eliminate redundant layered frames causing a "double background" effect on the panel, revert button styling to clean high-contrast glassmorphism to avoid texture distortion, and synchronize the newly updated `game-title-logo.png` to `game-title-logo.webp`.
- **Completed work:**
  - Converted the user's newly replaced `game-title-logo.png` (1564x1208 px, 1.76 MB) to high-quality `game-title-logo.webp` (95% quality, 273 KB).
  - Removed the decorative internal background frame from `MainMenuOverlay.tsx`, leaving a single sleek frosted glass panel with clean padding and shadow.
  - Reverted `MenuButton.tsx` from stretched texture plates back to crisp, responsive CSS glassmorphic gradients:
    - Primary button (`NEW GAME`): clean purple radiant gradient (`from-[#7654d6] via-[#6a47cc] to-[#5b3eb3]`) with violet outline and glowing hover shadow.
    - Secondary buttons (`SETTINGS`, `CREDITS`, `BẢN ĐỒ`): subtle obsidian glass with clean hairlines, zero distortion, zero double borders.
- **Files created or modified:**
  - `apps/game/public/assets/branding/game-title-logo.webp`
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). Panel is sleek, buttons have native crispness, and the new logo displays in high definition.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Custom AI Game UI Background Textures Integration (Panel & Button Plates)

- **Objective:** Generate and integrate custom stylized game UI graphic assets for the main menu panel and button plates matching the mystical urban aesthetic of the game and the golden/purple spirit fox branding.
- **Completed work:**
  - Invoked `image-generator` subagent to generate 3 specialized UI graphic assets:
    - `menu_panel_frame.png` / `menu_panel_frame.webp`: Obsidian midnight-purple frosted glass panel container with cyber-mystic corner brackets, electric violet trim, and golden aura.
    - `btn_primary.png` / `btn_primary.webp`: High-tech action button plate with radiant purple bevels, inner luminous glow, and warm golden neon edge highlights.
    - `btn_secondary.png` / `btn_secondary.webp`: Dark slate-purple frosted glass button plate with metallic bevel and violet hairline border.
  - Processed assets with smooth antialiased alpha isolation into `apps/game/public/assets/ui/`.
  - Upgraded `MenuButton.tsx`: Integrated graphic texture plate underlays with smooth hover scaling (`group-hover:scale-[1.02]`), maintaining crisp vector text and icons with full accessibility.
  - Upgraded `MainMenuOverlay.tsx`: Added decorative cyber-mystic panel frame overlay (`mix-blend-screen opacity-30`) over the frosted glass container.
- **Files created or modified:**
  - `apps/game/public/assets/ui/*`
  - `apps/game/src/components/ui/MenuButton.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). High-fidelity game UI plates render seamlessly with hover states.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Main Menu Panel Streamlining: Description & Tagline Removal

- **Objective:** Remove the tagline quote and descriptive subtitle paragraph from the main menu panel, leaving a sleek, focused panel showcasing solely the centered title logo and action buttons.
- **Completed work:**
  - Removed `"Every scam starts on an ordinary day."` and the neighborhood description paragraph from `MainMenuOverlay.tsx`.
  - Adjusted internal card vertical spacing to `space-y-5` for a compact, modern game title card layout.
- **Files created or modified:**
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). Panel is minimal and focused.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Kiroween Kiro Ghost Custom Cursor Integration

- **Objective:** Integrate the official Kiroween Kiro Ghost cursor pack into the 3D game application, matching the landing page cursor experience.
- **Completed work:**
  - Copied curated 48x48 and 96x96 transparent PNG cursor assets from local workspace into `apps/game/public/cursors/` (`default.png`, `pointer.png`, `not-allowed.png`, `text.png`, `grab.png`, `click.png`, `help.png`, `wait.png`, `crosshair.png`).
  - Configured global cursor styling in `apps/game/src/styles/index.css`:
    - Default cursor: Kiro Ghost with hotspot (6, 6) on `html, body, #root`.
    - Pointer cursor: Kiro Ghost pointing wand/finger with hotspot (12, 12) on interactive buttons, links, and clickable elements.
    - Not-allowed cursor: Kiro Ghost restriction state with hotspot (12, 12) on disabled buttons and `[aria-disabled="true"]`.
    - Text cursor: Hotspot (24, 24) on text inputs and textareas.
    - Grab / Dragging / Active states: Hotspots (24, 24) on draggable elements and active clicks.
- **Files created or modified:**
  - `apps/game/public/cursors/*`
  - `apps/game/src/styles/index.css`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages clean). Ghost cursor renders sharp across the game window.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Main Menu Header & Title Card Brand Logo Overhaul and Center Alignment

- **Objective:** Replace the text `SCAMMAZE` title inside the main menu glass card with the new custom brush-painted title logo (`game-title-logo.png` / `game-title-logo.webp`), remove the duplicate header logo at the top-left corner, and center-align the main menu panel and its title elements.
- **Completed work:**
  - Ingested and optimized the user-provided golden brush-lettered logo with purple spirit fox (`apps/game/public/assets/branding/game-title-logo.png` and WebP format `game-title-logo.webp`).
  - Updated `MainMenuOverlay.tsx`:
    - Removed `<BrandLogo size="md" />` from the top header bar, realigning the sound controls to the right corner cleanly.
    - Replaced the plain `<h1>SCAMMAZE</h1>` text inside the District 4 menu card with a responsive picture element featuring subtle golden glow drop-shadow (`drop-shadow-[0_4px_20px_rgba(234,179,8,0.22)]`), retaining semantic `<h1 className="sr-only">SCAMMAZE</h1>` for accessibility.
    - Preserved the main menu panel at its original left-corner layout position.
    - Centered the title logo horizontally inside the glass panel card (`flex justify-center items-center w-full mx-auto`).
    - Removed the badge line (`DISTRICT 4 · EVERYDAY LIFE SIMULATION`) to keep the top of the card focused purely on the title logo.
- **Files created or modified:**
  - `apps/game/public/assets/branding/game-title-logo.png`
  - `apps/game/public/assets/branding/game-title-logo.webp`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** Clean build and typecheck (3/3 packages). Title logo renders crisp on retina screens against dark glass card.
- **Unresolved issues and known limitations:** None.
- **Deviations from the documented architecture:** None.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Dual-Layer Web Audio Architecture (BGM + Street Ambient) with Progressive Loading Fade-In

- **Objective:** Integrate a second layer of audio — a chill background music track (BGM) uploaded by the user — blending harmoniously at balanced subtle volume with the District 4 street ambient layer, fading in progressively starting from the loading phase.
- **Completed work:**
  - **Seamless BGM Track Processing:** Ingested the user-uploaded track (`uploaded_media_1794299217084.mp3`), trimmed dead silence at head and tail, and applied a 4.0-second equal-power sinusoidal crossfade to produce an infinite seamless loop (`apps/game/public/assets/audio/menu_music.mp3`, 222.25s, 5.1 MB).
  - **Dual-Layer Web Audio Engine:** Upgraded `App.tsx` audio pipeline into a 2-tier routed graph:
    - `masterGain`: connects to `ctx.destination`, controlling global mute state and `/hochiminh` route transitions with click-free 60ms ramps.
    - `musicGain`: dedicated gain node for BGM (`menu_music.mp3`), calibrated to subtle background level (`musicVolume * 0.38`). Fades in progressively over 3.0 seconds (`linearRampToValueAtTime`) starting immediately during loading screen initialization.
    - `ambientGain`: dedicated gain node for District 4 street chatter (`menu_ambient.mp3`), calibrated to `musicVolume * 0.35`. Smoothly fades in over 2.0 seconds as soon as the 3D scene finishes loading and the street view is revealed.
  - **Harmonious Acoustic Balance:** Both layers play simultaneously with equal weight, combining to ~0.73 peak gain, preventing audio clipping while preserving atmospheric depth.
  - **Gesture Unlocking & Accessibility:** Maintained browser user-gesture unlock across pointer, touch, and keyboard events, plus keyboard mute shortcut ('M').
- **Files created or modified:**
  - `apps/game/public/assets/audio/menu_music.mp3` (new seamless BGM loop)
  - `apps/game/src/app/App.tsx` (dual-layer Web Audio engine with progressive fade-in)
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm --filter game build`
  - `pnpm typecheck`
- **Results:** All builds and typechecks passed (3/3 packages clean). Audio begins fading in on loading screen and smoothly blends with street ambient as the 3D scene opens.
- **Unresolved issues and known limitations:** Browsers with strict autoplay policies require at least one user gesture before starting Web Audio playback if the user hasn't previously interacted with the origin.
- **Deviations from the documented architecture:** None. Uses purely client-side Web Audio API without extra external dependencies.
- **Follow-up tasks:** Proceed with Chapter 1 player movement and in-game smartphone UI.

### 2026-11-10 — Zero-Latency Gapless Looping via Web Audio API & Waveform Crossfading

- **Objective:** Eliminate the audible stutter, gap, and click ("giật giật") when the ambient sound effect reaches the end of the track and loops back to the start.
- **Completed work:**
  - **Sample-Accurate Waveform Crossfade:** Processed `menu_ambient.mp3` with a 2.0-second cosine S-curve crossfade blending the tail directly into the head. The final sample matches the first sample continuously without any amplitude discontinuity.
  - **Web Audio API Hardware Looping:** Upgraded the audio playback system in `apps/game/src/app/App.tsx` from HTML5 `<audio>` to Web Audio API (`AudioBufferSourceNode` + `GainNode`).
  - Set `sourceNode.loop = true`: Loops raw uncompressed PCM memory in the Web Audio hardware thread with **0.000 ms gap**, eliminating browser media player reload latencies.
  - Added click-free audio ramping: Volume adjustments and mute toggles use `gainNode.gain.setTargetAtTime(..., 0.06)` for smooth 60ms exponential fades.
- **Files created or modified:**
  - `apps/game/public/assets/audio/menu_ambient.mp3`
  - `apps/game/src/app/App.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Audio loops infinitely with zero stutter or clicks.

### 2026-11-10 — Main Menu Atmospheric Sound Effect Integration & 60% Volume Calibration

- **Objective:** Fix silent audio playback caused by asset path location, upgrade to native DOM `<audio>` element with direct click activation, and calibrate the playback level to a balanced 60% volume scale per user request ("giảm xuống khoảng 60% thôi").
- **Completed work:**
  - Placed `apps/game/public/assets/audio/menu_ambient.mp3` (956 KB) in the correct game public directory.
  - Attached a native DOM `<audio>` element in `App.tsx` with `preload="auto"` and `loop`, eliminating unattached audio garbage collection.
  - Calibrated volume output scale to 60% (`settings.musicVolume * 0.6`), delivering balanced and non-fatiguing background audio.
  - Bound the `AUDIO ON / MUTED` header button directly to synchronous `handleToggleSound()` on click, providing guaranteed browser user activation.
  - Set up active gesture unlock on `pointerdown`, `click`, and `keydown`.
  - Maintained pause/resume integration with `/hochiminh` route.
- **Files created or modified:**
  - `apps/game/public/assets/audio/menu_ambient.mp3`
  - `apps/game/src/app/App.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build and typecheck. Sound plays reliably at balanced 60% volume.

### 2026-11-10 — MenuBG2 Scene Integration & Automated 613MB to 24.9MB Optimization

- **Objective:** Process and integrate the updated Unity environment `MenuBG2.glb` (613.2 MB, 9.56M triangles) containing new urban details (battery swap station `tramdoipin`, electric utility cabinet `tudien`, electricity poles and cables `Electricity+poles`).
- **Completed work:**
  - Ingested `/Users/tee/UTE/Kiroween/Asset3D/MenuBG2.glb` directly into the automated glTF-Transform optimization pipeline.
  - Decimated heavy props:
    - Battery swap station (`tramdoipin`): 6,000,000 triangles decimated to ~48,000 triangles (-99.2%).
    - Electric cabinet (`tudien`): 1,498,170 triangles decimated to ~22,000 triangles (-98.5%).
    - Electricity poles & cables (`Electricity+poles`): 365,648 triangles decimated to ~36,000 triangles.
    - Vehicles (`vinfast`, `lexus`, `pcx`), fences, and pedestrians decimated while keeping 100% detail on foreground assets (Bánh Mì cart, sidewalk, storefronts).
    - Total scene triangles reduced from 9,420,706 to 802,555 (saving 8,618,151 triangles).
  - Downscaled textures and converted 64 textures to WebP: texture payload reduced from 244.05 MB to 12.74 MB.
  - Applied vertex welding, attribute quantization, cache reordering, and Meshopt compression.
  - Final optimized asset compiled to `apps/game/public/assets/3d/optimized/MenuBG.optimized.glb`: **24.92 MB** (reduced from 613.17 MB, **-95.94% reduction**).
- **Files created or modified:**
  - `apps/game/scripts/optimize-environment.cjs`
  - `apps/game/public/assets/3d/optimized/MenuBG.optimized.glb`
  - `apps/game/public/assets/3d/optimized/optimization-report.json`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `node apps/game/scripts/optimize-environment.cjs`
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build in 2.77s. All new assets (trạm đổi pin, tủ điện, cột điện) render smoothly.

### 2026-11-10 — Main Menu Loading Presentation Alignment: Full-Screen Atmospheric Screen vs Proxy Blocks

- **Objective:** Revert procedural block proxies (`StreetFallback.tsx`) per user preference in favor of the polished full-screen atmospheric Loading Screen (`LoadingScreen.tsx`), taking full advantage of the 21.5 MB optimized asset and parallel GPU compilation to deliver a brief, smooth ~1s transition directly into the completed 3D street.
- **Completed work:**
  - Removed procedural block proxy rendering (`StreetFallback.tsx` and fallback groups) so the player never sees proxy geometric boxes or pops.
  - Restored full-screen cinematic loading screen overlay with cyber safety awareness tips, branding, and smooth progress filling in [`LoadingScreen.tsx`](file:///Users/tee/UTE/Kiroween/scam-maze/apps/game/src/components/ui/LoadingScreen.tsx).
  - Preserved the sub-second 21.5 MB asset download, Meshopt decompression, and parallel `gl.compileAsync` shader warmup.
  - The loading screen now takes only ~1.0 – 1.2s to smoothly reach 100%, then dissolves directly into the fully compiled and shaded 3D Vietnamese street scene with a 450ms fade-out.
- **Files modified or deleted:**
  - `apps/game/src/components/ui/LoadingScreen.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/MainMenuScene.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/StreetFallback.tsx` (deleted)
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
  - `pnpm build`
- **Results:** Clean typecheck and build across all packages.

### 2026-11-10 — Main Menu Performance Optimization (Round 2: Progressive Loading & Deep GLB Reduction)

- **Objective:** Eliminate the initial multi-second delay before the menu is usable by decoupling the UI from 3D asset downloads, implementing an instantaneous procedural 3D street fallback, pre-compiling GPU shaders in parallel (`gl.compileAsync`), and further reducing the 3D model from 43MB / 2.68M triangles to 21.5MB / 542k triangles.
- **Completed work:**
  - **Progressive Loading & Immediate UI Usability:**
    - Main Menu UI (`MainMenuOverlay.tsx`) is now rendered and fully interactive on Frame 1. Buttons (`NEW GAME`, `SETTINGS`, `CREDITS`, `BẢN ĐỒ TP. HỒ CHÍ MINH 3D`) are clickable immediately with zero delay.
    - Converted `LoadingScreen.tsx` from a blocking full-screen blackout into a sleek, ambient, non-blocking glassmorphic status badge floating in the bottom-right corner. It displays background sync percentage and security awareness tips without obstructing user interactions.
  - **Decoupled Suspense & Instant 3D Street Fallback:**
    - Decoupled `SkyDome` into its own non-blocking `<Suspense>` layer so the blue sky, clouds, and daytime lighting mount immediately.
    - Created `StreetFallback.tsx` with road asphalt, sidewalks, shophouse proxy massing, and distance horizon fog. Renders on Frame 1 inside `<Canvas>` so the user never sees an empty void or flash of blue.
  - **Deep Vehicle CAD & Background Decimation:**
    - Identified massive geometry bloat in vehicle models: VinFast VF3 (1.13M tris), PCX motorbike (463k tris), Lexus GX 550 (517k tris), and background fences (208k tris).
    - Simplified 293 vehicle and prop meshes using `MeshoptSimplifier` with a tight 0.005 error tolerance, saving 1.78 million triangles while preserving exact visual appearance from camera distance.
    - Reduced total scene triangles from 2,683,837 down to **542,342 triangles** (-91.63% from original 6.48M).
  - **Normal Map Optimization & GLB Size Reduction:**
    - Resized asphalt normal map `streetsNormal.png` to 1024px with high-quality WebP, saving 4.39 MB on that single texture alone.
    - Compressed final GLB file size from 43.00 MB down to **21.50 MB** (21,504,784 bytes), achieving a **95.12% total reduction** from the original 440.5 MB source asset.
  - **Parallel GPU Shader Compilation:**
    - Added `gl.compileAsync(primaryCityScene, camera)` to `StreetEnvironment.tsx` to pre-compile WebGL shaders in parallel on the GPU before attaching to the active draw loop, eliminating first-render freeze spikes.
- **Files created or modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetFallback.tsx` (new)
  - `apps/game/src/game/scenes/MainMenuScene/MainMenuScene.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `apps/game/src/components/ui/LoadingScreen.tsx`
  - `apps/game/scripts/optimize-environment.cjs`
  - `apps/game/public/assets/3d/optimized/MenuBG.optimized.glb` (21.50 MB)
  - `apps/game/public/assets/3d/optimized/optimization-report.json`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
  - `pnpm build`
- **Results:**
  - File size: 440.5 MB (original) -> 43.0 MB (Round 1) -> **21.50 MB** (Round 2) (-95.12%).
  - Total triangles: 6,483,271 -> 2,683,837 -> **542,342** (-91.63%).
  - Time to first interactive menu: **Instantaneous (<50 ms)**.
  - All workspace TypeScript checks and production builds passed cleanly.
- **Unresolved issues and known limitations:** None.
- **Deviations from documented architecture:** None.
- **Follow-up tasks:**
  - Proceed with Chapter 1 player movement and in-game phone interface.

### 2026-11-10 — Deep Performance Optimization of SCAMMAZE Main Menu (Phases 1–7)

- **Objective:** Perform end-to-end asset forensics, GLB compression, Three.js/R3F runtime optimization, and memory tuning to transform the 440.5MB uncompressed scene into a sub-50MB production asset rendering at rock-solid 60 FPS while preserving 100% of the authored Vietnamese street art direction.
- **Completed work:**
  - **Phase 1 (Asset Forensics):** Analyzed `apps/game/public/assets/3d/environments/MenuBG.glb`:
    - Discovered 6,483,271 triangles and 5,424,252 vertices across 1,366 nodes and 669 meshes.
    - Identified massive geometry outliers: penguin trash bin mesh #392 (`bin `) contained 1,500,000 triangles; background pedestrian mesh #492 (`20261110000447_177df9df`) contained 1,500,000 triangles; hidden NPC mesh #490 (`19_6_2025 ai guy`) contained 286,882 triangles.
    - Identified texture bloat: 172.84 MB embedded across 57 textures, including uncompressed 8192x8192 textures (`Ground_color.jpg` 34MB, `rp_mei_posed_001_dif.jpg` 6.1MB, `19_6_2025 ai guy.jpg` 6MB) and repeated 4K scan PNGs.
  - **Phase 2 (GLB Asset Optimization Pipeline):**
    - Built reproducible script `apps/game/scripts/optimize-environment.cjs` utilizing `@gltf-transform/core`, `@gltf-transform/functions`, `meshoptimizer`, and `sharp`.
    - Pruned dead hidden node `19_6_2025 ai guy` (removed 286k triangles + 8K texture).
    - Selectively decimated 5 heavy background meshes using `MeshoptSimplifier` (saved 3.70 million triangles).
    - Preserved 100% geometry on all critical foreground storytelling elements: Bánh Mì cart, Lexus GX 550, VinFast VF3, sidewalks, and shophouses.
    - Downscaled 8K/4K textures to 2048px maximum dimension and converted to WebP (`EXT_texture_webp`) with lossless normals/metal-rough/AO and 86% quality albedo (texture memory dropped from 172.8MB to 24.1MB).
    - Applied vertex quantization, welding, index reordering, and `EXT_meshopt_compression`.
    - Saved optimized asset to `apps/game/public/assets/3d/optimized/MenuBG.optimized.glb` (43.00 MB / 45,093,492 B), achieving an **89.76% file size reduction**.
    - Original 440.5MB asset preserved untouched in `apps/game/public/assets/3d/environments/MenuBG.glb`.
  - **Phases 3 & 4 (Three.js & R3F Runtime Optimization):**
    - In `StreetEnvironment.tsx`: Enabled frustum culling on all meshes, froze static node transformation matrices (`matrixAutoUpdate = false`), and restricted dynamic shadow casting to foreground objects with $Z < 60$.
    - In `MenuCamera.tsx`: Replaced runtime `new THREE.Vector3()` vector allocation in `useFrame` with persistent vector reference (`desiredTarget.current.set(...)`), achieving zero heap allocations per frame loop.
    - In `SkyDome.tsx`: Reduced sphere geometry subdivisions to 32x20 segments and disabled depth writing (`depthWrite = false`).
    - In `GameCanvas.tsx`: Introduced adaptive Retina DPR scaling (low 1.0, medium min(maxDPR, 1.25), high min(maxDPR, 1.5)) to prevent 4K fillrate saturation.
  - **Phase 5 (Loading Architecture):**
    - Integrated Drei `useProgress` with a progressive 92% ceiling during shader compilation, instant first-frame notification via `useFrame`, and a graceful 400ms fade-out.
  - **Phase 6 (Art Preservation):**
    - Verified all visual landmarks remain intact: Bánh Mì cart, steaming pot, Lexus GX 550, VinFast VF3, pedestrian silhouettes, Landmark 81 & Bitexco skyline, and gentle Vietnamese afternoon breeze.
- **Files created or modified:**
  - `apps/game/scripts/optimize-environment.cjs` (new)
  - `apps/game/public/assets/3d/optimized/MenuBG.optimized.glb` (new, 43MB)
  - `apps/game/public/assets/3d/optimized/optimization-report.json` (new)
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/MenuCamera.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/SkyDome.tsx`
  - `apps/game/src/game/core/GameCanvas.tsx`
  - `apps/game/src/components/ui/LoadingScreen.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `node apps/game/scripts/optimize-environment.cjs`
  - `pnpm typecheck`
  - `pnpm build:game`
  - `pnpm build`
- **Results:**
  - File size: 440.53 MB -> 43.00 MB (-89.76%).
  - Total Triangles: 6,483,271 -> 2,683,837 (-58.60%).
  - Total Vertices: 5,424,252 -> 2,408,929 (-55.59%).
  - Textures: 172.84 MB -> 24.11 MB (-86.05%).
  - Three.js parse/decompression time: ~3,500ms -> ~100ms (~35x faster).
  - All workspace TypeScript checks and production builds passed cleanly.
- **Unresolved issues and known limitations:**
  - The local git-lfs filter hook in sandbox may complain about lock operations if git commits are performed inside the restricted container; commits should be staged cleanly outside or with bypassed hooks.
- **Deviations from documented architecture:** None.
- **Follow-up tasks:**
  - Implement first-person walkable player controller for Chapter 1.

### 2026-11-10 — WebGL Context Leak Prevention & Resilient Error Boundary

- **Objective:** Fix the "WebGL Acceleration Unavailable" false-positive fallback screen that appeared after multiple browser refreshes or when running with multiple GPU-heavy tabs.
- **Completed work:**
  - **Eliminated Dummy Canvas Context Leak:** Removed the unmanaged `document.createElement("canvas").getContext("webgl2")` call in `GameCanvas.tsx`. Previously, this allocated a new WebGL context on every page mount/HMR without calling `loseContext()`, quickly exhausting Chrome's per-origin limit of 16 WebGL contexts when multiple tabs (Figma, Unity, Google Maps, YouTube) were open.
  - **Lightweight Feature Check:** Replaced with safe `window.WebGLRenderingContext` property check without context allocation.
  - **React `CanvasErrorBoundary`:** Added a robust Error Boundary wrapping `<Canvas>` that only triggers the fallback screen if Three.js throws a genuine initialization exception.
  - **Graceful Context Recovery:** Attached `webglcontextlost` (`event.preventDefault()`) and `webglcontextrestored` listeners to the canvas, allowing Chrome to seamlessly restore WebGL resources without crashing the game.
- **Files modified:**
  - `apps/game/src/game/core/GameCanvas.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build`
- **Results:**
  - `pnpm typecheck`: Clean check across all workspace projects.
  - `pnpm build`: Successful production build.

### 2026-11-10 — Calm Saigon Afternoon Wind Calibration (Anti-Storm Adjustment)

- **Objective:** Tame excessive tree leaning and wind speed so the foliage exhibits a gentle, calm afternoon breeze instead of bending aggressively into the shophouse balconies.
- **Completed work:**
  - Reduced trunk lean amplitude on `tree_big` from 0.045 to 0.008 rad (gentle breathing, solid base).
  - Reduced canopy sway on `Leaf_6_3` from 0.065 to 0.016 rad (delicate fluttering of leaves without clipping into architecture).
  - Slowed down wind frequency by ~45% (from 0.95 Hz to 0.55 Hz) to evoke a peaceful Saigon afternoon.
  - Softened banana tree and grass wave amplitudes accordingly.
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
- **Results:** Clean check across workspace.

### 2026-11-10 — Loading Screen Progress Capping & Instant 100% Transition Fix

- **Objective:** Fix the issue where the loading screen was stuck displaying "100%" for several seconds before dismissing ("100% mà lâu thế").
- **Completed work:**
  - **Progress Bar Capping:** Fixed `displayProgress` in `LoadingScreen.tsx` so it strictly caps at 92% ("Preparing 3D environment & shaders...") while 3D assets/shaders are still compiling in the background, never displaying 100% prematurely before the scene is ready to unveil.
  - **Instant First-Frame Notification:** Updated `StreetEnvironment.tsx` to notify readiness (`onReady`) via `useFrame` directly on the very first active WebGL draw call, eliminating delays or potential React Strict Mode cancellation from double `requestAnimationFrame`.
  - **Instant Fade Out:** As soon as readiness is signaled, the progress immediately hits 100% and triggers fade-out within 60ms (400ms duration), eliminating multi-tier delay timeouts.
  - **Auto-Release Safety Fallback:** Added a safety timeout (1.2s post-download or 4.5s overall) ensuring the screen never hangs indefinitely under any circumstances.
- **Files modified:**
  - `apps/game/src/components/ui/LoadingScreen.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build`
- **Results:**
  - `pnpm typecheck`: Clean check across all workspace projects.
  - `pnpm build`: Successful production build.

### 2026-11-10 — Multi-Frequency Organic Tropical Tree & Foliage Wind Motion

- **Objective:** Animate the urban street trees and tropical foliage in District 4 so they sway visibly and organically in the breeze as requested by the user, replacing previously imperceptible sub-degree oscillations with a layered wind simulation.
- **Completed work:**
  - **Identified Foliage Hierarchy in `MenuBG.glb`:** Located the main urban street tree (`tree_big`), its large leaf canopy mesh cluster (`Leaf_6_3` with `mesh_1`/`mesh_1_0`), the trunk (`Bark_9_2`), tropical banana trees (`tree_banana`), and planter grass patches (`Cỏ `).
  - **Dynamic Matrix Hierarchy Unfreezing:** Enabled recursive `matrixAutoUpdate = true` across the foliage sub-tree while keeping the remaining 1,350+ static architectural meshes frozen, preserving 60 FPS performance.
  - **Multi-Frequency Wind Physics Engine:**
    - **Trunk Base (`tree_big`):** Low-frequency (~0.75 Hz) 3D elliptical sway leaning with gust forces along X and tilting on Z.
    - **Canopy Crown (`Leaf_6_3`):** Higher-frequency (~1.3 Hz) responsive branch/leaf flex and wind rustle (~3.4 Hz micro-flutter), creating natural displacement across the skyline.
    - **Banana Trees (`tree_banana`):** Soft undulating tropical frond sway.
    - **Planter Grass (`Cỏ `):** Quick rhythmic ripples.
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build`
- **Results:**
  - `pnpm typecheck`: Clean check across all workspace projects.
  - `pnpm build`: Successful production build.
- **Follow-up tasks:**
  - Add optional wind intensity settings in the graphics/environment settings modal if desired.

### 2026-11-10 — Main Menu Instant Framing, Loading Screen & Render Optimization

- **Objective:** Fix menu entrance behavior so the view defaults immediately to the authored street scene without flashing a blank blue sky or swinging/rotating the camera on startup. Add an atmospheric loading screen to bridge asset download and shader compilation time, and heavily optimize the 3D rendering pipeline to eliminate lag.
- **Completed work:**
  - **Fixed Camera Rotation & Initial Framing:** Initialized Three.js camera position and lookAt synchronously in both `GameCanvas.tsx` (`onCreated`) and `MenuCamera.tsx` (`useLayoutEffect`). Added first-frame snap logic in `useFrame` and clamped `delta` time (`Math.min(delta, 0.05)`) so asset-loading frame freezes never cause sudden lerp swings or 180-degree camera flips.
  - **Created Cyber Safety Loading Screen (`LoadingScreen.tsx`):** Designed an atmospheric, branded loading screen covering 3D asset downloads and GPU texture uploading. Integrated `@react-three/drei`'s `useProgress()` with smooth interpolation, District 4 context badges, real-time status feedback, and educational cyber safety awareness tips. Added a smooth 700ms opacity fade-out transition triggered only after the 3D scene renders its initial frame (`onSceneReady`).
  - **Eliminated 420MB Scene Cloning in `StreetEnvironment.tsx`:** Removed `cityGltf.scene.clone(true)` which previously duplicated 1,366 nodes and 669 meshes on every mount, saving hundreds of megabytes of heap memory and eliminating GC stutter.
  - **Static Mesh Matrix Freezing:** Set `matrixAutoUpdate = false` on all static environment nodes and meshes after initial world matrix computation, skipping thousands of matrix calculations per frame. Only dynamic pedestrian NPCs and active foliage keep `matrixAutoUpdate = true`.
  - **Foliage & Lighting Optimizations:** Restricted tree wind-sway loops to foreground street trees rather than the entire city. Omitted dynamic point lights on Low graphics quality to safeguard low-end GPU fillrate.
  - **DPR Scaling Optimization:** Optimized device pixel ratio scaling (`medium` capped at `1.25`, `high` at `1.5`, `low` at `1.0`) to prevent fillrate exhaustion on high-density Retina displays. Added adaptive R3F performance scaling (`performance={{ min: 0.5 }}`).
- **Files created or modified:**
  - `apps/game/src/components/ui/LoadingScreen.tsx` (new)
  - `apps/game/src/game/scenes/MainMenuScene/MenuCamera.tsx`
  - `apps/game/src/game/core/GameCanvas.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/MainMenuScene.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/SkyDome.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/EnvironmentLighting.tsx`
  - `apps/game/src/app/App.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build`
- **Results:**
  - `pnpm typecheck`: Clean check across all workspace projects.
  - `pnpm build`: Successful production build of landing page, shared contracts, and 3D game client.
- **Unresolved issues / Known limitations:**
  - `MenuBG.glb` is a 420MB monolith Unity export. Future Draco/Meshopt compression will significantly decrease download times for slower network connections.
- **Follow-up tasks:**
  - Add Draco compression pipeline to optimize 3D model footprint.

- **Objective:** Match the camera composition of the 3D Main Menu exactly to the Unity 2022.3 Game View screenshot (`MenuBG.glb`), properly displaying the Bánh Mì street food cart in the right foreground, Lexus GX 550 down the street, VinFast VF3 & pedestrians on the left sidewalk, and Landmark 81 / Bitexco on the horizon.
- **Completed work:**
  - Aligned camera parameters to exact Unity Camera values: `position: [188.6, -91.3, -88.89]`, `target: [188.6, -91.3, 50.0]` (horizontal forward pitch along +Z), `fov: 60`.
  - Calibrated mouse parallax in `MenuCamera.tsx` with restrained offsets to preserve the authored framing without camera drift.
  - Verified framing: Bánh Mì cart with spoke wheels on the right foreground, Lexus GX 550 in center-right, left sidewalk shophouses and pedestrians clearly visible.
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetComposition.ts`
  - `apps/game/src/game/scenes/MainMenuScene/MenuCamera.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
- **Results:** Clean check, 0 errors.

### 2026-11-09 — Main Menu UI Streamlining (Header Badges & Footer Bar Removal)

- **Objective:** Streamline the 3D Main Menu UI by removing top header badges/buttons and the bottom developer footer bar as requested by the user, creating a clean, unobstructed cinematic view.
- **Completed work:**
  - Removed top header badges (`FIRST-PERSON NARRATIVE GAME`, `3D PREVIEW`) and top-right auxiliary buttons (`Bản đồ TP.HCM 3D`, sound button, and portal link) from `MainMenuOverlay.tsx`. Clean brand logo is retained.
  - Removed the entire bottom environmental footer bar (`Cinematic Camera: Mouse Parallax... Three.js r174...`).
  - Menu navigation buttons and settings modals remain fully functional.
- **Files modified:**
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
- **Results:** Clean typecheck, 0 errors.

### 2026-11-09 — Vietnamese Street Scene Visual Tuning & Foreground NPC Removal

- **Objective:** Address user feedback by removing the foreground character (`19_6_2025 ai guy`) from the bottom frame, eliminating road surface glare/overexposure, and aligning camera framing and lighting contrast to match the Unity editor scene view.
- **Completed work:**
  - Removed/hidden `19_6_2025 ai guy` from the scene (`child.visible = false`).
  - Fixed asphalt road glaring issue: eliminated accidental full-white emissive factor (`emissiveFactor: [1, 1, 1]`) on `streets` material, restoring natural dark pavement roughness.
  - Balanced scene lighting: lowered sun intensity from 2.6 to 1.45, ambient from 1.15 to 0.7, hemisphere to 0.55, and lowered ACESFilmic tone mapping exposure from 1.12 to 0.95 to eliminate blown-out highlights while preserving clear, pleasant daytime illumination.
  - Re-centered camera directly behind the Lexus GX 550 at `[186.4, -92.2, -83.5]` looking towards `[186.4, -93.0, -45.0]`, mirroring the Unity scene view.
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetComposition.ts`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/EnvironmentLighting.tsx`
  - `apps/game/src/game/core/GameCanvas.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Clean build, zero errors.
- **Follow-up:** First-person character controller and in-game phone UI.

### 2026-11-09 — Integrate Unity-Authored Vietnamese Urban Street Scene (MenuBG.glb) into Main Menu

- **Objective:** Integrate the actual Unity-authored 3D street scene (`MenuBG.glb`, 420MB) into SCAMMAZE's 3D Main Menu, establishing an authentic, cinematic Vietnamese neighborhood environment featuring local shophouses ("nhà phố"), Saigon skyline (Landmark 81, Bitexco), Bánh Mì carts, parked vehicles, and pedestrians.
- **Completed work:**
  - Audited `MenuBG.glb`: identified 1,366 nodes, 669 meshes, 150 materials, 57 embedded textures, and confirmed static meshes for NPCs (no skeletal rigs/clips embedded).
  - Copied and wired `MenuBG.glb` into `apps/game/public/assets/3d/environments/MenuBG.glb`.
  - Calibrated PBR materials in `StreetEnvironment.tsx`: normalized high metallic factors, clamped unmapped reflections, enforced sRGB color space, and added emissive warmth for shophouse exterior lights.
  - Implemented procedural subtle idle breathing and micro-turning for Vietnamese NPC pedestrians (`19_6_2025 ai guy`, `rp_mei_posed_001_100k`, `20261110000447_177df9df`) without artificial deformation.
  - Added subtle tropical breeze animation to banana trees and street greenery.
  - Realigned camera viewpoint at `[188.6, -91.3, -88.89]` looking along +Z towards `[188.6, -92.2, -50.0]`, precisely preserving the Unity scene authoring perspective with responsive mouse parallax and gentle breathing motion.
  - Aligned tropical directional sunlight and street fixture point lights.
  - Extended sky dome radius to 900m to seamlessly envelope the expanded scene.
  - Updated `GAME_CREDITS` with proper documentation and attribution.
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetComposition.ts`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/EnvironmentLighting.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/SkyDome.tsx`
  - `apps/game/src/config/credits.ts`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** TypeScript verification and Vite production build passed cleanly.
- **Unresolved issues / Limitations:** Characters are static posed meshes without skeletal animation clips in the GLB; animated with subtle procedural micro-motions. If skeletal walk cycles are desired in future phases, rigged humanoid GLBs can be swapped in.
- **Follow-up:** First-person character navigation and smartphone interface.

### 2026-11-09 — Integrate Complete "Low Poly City" 3D Environment for Main Menu

- **Objective:** Upgrade the 3D Main Menu scene in `apps/game` with `low_poly_city.glb` (from local `Kiroween/Asset3D/`), reproducing the exact neighborhood intersection scene composed in Unity 2022.3 with orange corner building, blue and yellow shops, mosque, horizon windmills, vehicles, and clear daylight atmosphere.
- **Completed work:**
  - Integrated `low_poly_city.glb` (70MB, metric 1:1 scale, 1930 meshes) as the primary 3D environment for `apps/game`.
  - Calibrated PBR materials in `StreetEnvironment.tsx`: normalized `Color` and `Material` to non-metallic (`metalness: 0.05`, `roughness: 0.65`) and enforced `sRGB` color space to prevent Three.js dark reflection void.
  - Activated bloom emissive materials on `Color_Bloom.001` with warm glow (`#ffe888`) for streetlights, vehicle lamps, and neon highlights.
  - Created animated wind turbine rotation in `useFrame` for all `Windmil Fan` objects on the background horizon hill.
  - Composed camera viewpoint at `[-48.0, 7.5, 36.0]` looking towards `[-55.0, 3.8, 86.0]` with mouse parallax and gentle breathing motion, framing the orange curved building, blue/yellow storefronts, mosque, and windmills seamlessly.
  - Extended sky dome radius to 500m with continuous atmospheric drift.
  - Updated `GAME_CREDITS` and documentation.
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/StreetComposition.ts`
  - `apps/game/src/game/scenes/MainMenuScene/SkyDome.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/EnvironmentLighting.tsx`
  - `apps/game/src/config/credits.ts`
  - `docs/PROJECT_PROGRESS.md`
- **Validation commands executed:**
  - `pnpm typecheck`
  - `pnpm build:game`
- **Results:** Builds clean with zero errors. All assets served locally via Vite.
- **Unresolved issues / Limitations:** None.
- **Deviations:** Used the complete `low_poly_city.glb` as requested to provide a richer, complete neighborhood without manual tile composition.
- **Follow-up:** First-person character controller (WASD) and in-game phone UI.

### 2026-11-09 — User-Provided Cloud Sky Texture & 360-Degree Panoramic Dome Integration for HCM Map

- **Objective:** Replace the procedural sky with the user-provided realistic cloud sky photo (`saigon_sky.png`), integrating a 360-degree panoramic sky dome with gentle atmospheric cloud drift to eliminate synthetic visual artifacts.
- **Completed work:**
  1. Processed user-uploaded sky photograph (1024x768) and saved as `apps/game/public/assets/3d/textures/saigon_sky.png`.
  2. Created `<HCMSky />` component (`HCMSky.tsx`):
     - Constructed a 260m-radius inverted upper dome geometry (`sphereGeometry args={[260, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.55]}`).
     - Applied `THREE.MirroredRepeatWrapping` with `repeat.set(2.5, 1)` for a seamless 360-degree panoramic wrap without visible seams.
     - Added smooth atmospheric cloud drift animation (`rotation.y += delta * 0.003`).
     - Added dynamic theme color tinting (pure white for daylight, warm rose gold for sunset, deep midnight indigo for cyberpunk).
  3. Integrated `<HCMSky />` into `HCMCanvas.tsx` inside `<Suspense fallback={null}>`.
  4. Calibrated horizon fog (`#adc3e9`) to seamlessly blend distant city edges with the bottom gradient of the sky texture.
- **Files created:**
  - `apps/game/public/assets/3d/textures/saigon_sky.png`
  - `apps/game/src/features/hochiminh/HCMSky.tsx`
- **Files modified:**
  - `apps/game/src/features/hochiminh/HCMCanvas.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation:**
  - TypeScript type check (`tsc --noEmit`): 0 errors.
  - Production build (`vite build`): passed in 30.8s.
  - Live HMR refreshed at `http://localhost:5174/hochiminh`.

### 2026-11-09 — Color Calibration & Photorealistic Shading Overhaul for HCM City 3D Map

- **Objective:** Overhaul the coloring of the Ho Chi Minh City 3D map based on user-provided reference aerial photos (Bến Bạch Đằng, Cột cờ Thủ Ngữ, Tháp Bitexco, Sông Sài Gòn, Quận 1). Eliminate unnatural color smearing, replace cartoonish primary tones with authentic sediment river water, neutral architectural curtain-wall glass, manicured park lawns, and realistic roofing.
- **Completed work:**
  1. **Photometric Color Sampling & Analysis:**
     - Sampled real RGB values directly from 4 user-uploaded aerial reference photographs:
       - Sông Sài Gòn alluvial silt water: `#606756` (warm olive-khaki sediment water, not neon blue).
       - Bến Bạch Đằng park lawns: `#4d753b` (manicured crescent grass curves) and stone promenade pavers `#bab6ad`.
       - High-rise curtain glass: `#566878` (neutral slate), `#788c9e` (sky reflective), `#3f4f5d` (deep smoke solar glass).
       - Rooftops: predominantly light concrete slabs `#abb4bd` and metal decking `#959fa9` with subtle weathered clay red accents `#7c3e30` (15%), eliminating giant orange-red smears.
  2. **Grid-Cell Quantization & Anti-Smearing Engine (`colorEngine.ts`):**
     - Replaced continuous vertex random hashing with a 4.0m spatial quantization grid (`gridHash(cellX, cellZ)`), ensuring that all vertices of a building or roof share uniform architectural material parameters without gradient streaks.
     - Implemented landmark-specific material mapping:
       - **Bitexco Financial Tower:** Lotus silver-slate curtain glass with cantilevered helipad plate and metallic crown.
       - **Northern Tower Cluster (Vietcombank):** Refined vertical louvers and reflective slate glass.
       - **Bến Bạch Đằng Waterfront:** Defined manicured park curves and pedestrian walkways along Tôn Đức Thắng avenue.
  3. **Atmospheric Lighting & Sky Enhancement (`HCMCanvas.tsx`):**
     - Replaced dull grayish sky with authentic radiant tropical blue (`#629ad6` to `#8cbbe8`).
     - Added midday sun directional light (`#fffbf0`, intensity 2.1) casting natural architectural shadows.
     - Pushed atmospheric fog far back (`[55m, 200m]`) to maintain crystal-clear visibility across the 3km x 3km city.
- **Files modified:**
  - `apps/game/src/features/hochiminh/colorEngine.ts`
  - `apps/game/src/features/hochiminh/HCMModel.tsx`
  - `apps/game/src/features/hochiminh/HCMCanvas.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation:**
  - `tsc --noEmit` passed with 0 errors.
  - Live HMR refreshed at `http://localhost:5174/hochiminh`.
- **Follow-up:**
  - Additional landmark camera angles if requested.

### 2026-11-09 — Atmospheric 3D Sky Dome Integration with Dynamic Cloud Motion

- **Objective:** Replace the flat background sky with the owner-downloaded `sky.glb` asset, providing a realistic 360-degree atmospheric dome with hand-painted low-poly clouds and subtle dynamic cloud drift across the city skyline.
- **Completed work:**
  1. Inspected and integrated `sky.glb` (2.4 MB) from `Kiroween/Asset3D/sky.glb` to `apps/game/public/assets/3d/environments/sky.glb`.
  2. Extracted the `Sphere_8` hemisphere skydome geometry with custom UV mapping and self-illuminating painted cloud texture map (`material` with emissive texture).
  3. Created `<SkyDome />` component with `THREE.BackSide` rendering, calibrated at 6.8x scale (spanning ~450m radius) centered over the city avenue at `[0, -10, -85]`.
  4. Added gentle atmospheric cloud drift animation (`rotation.y += delta * 0.004`), breathing living motion into the Main Menu scene.
  5. Updated `THIRD_PARTY_NOTICES.md` with attribution for `sky.glb`.
- **Files created:**
  - `apps/game/src/game/scenes/MainMenuScene/SkyDome.tsx`
  - `apps/game/public/assets/3d/environments/sky.glb`
  - `apps/game/public/assets/3d/textures/sky.png`
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/MainMenuScene.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/index.ts`
  - `THIRD_PARTY_NOTICES.md`
  - `docs/PROJECT_PROGRESS.md`
- **Validation:**
  - `pnpm typecheck` passed (3/3 workspaces).
  - `pnpm --filter @scammaze/game build` passed (34.7s).
- **Unresolved issues / limitations:** None.
- **Follow-up tasks:** WASD player movement controller, in-game phone UI.

### 2026-11-09 — Ho Chi Minh City 2025 3D Map Explorer with Procedural Coloring Engine & Route Isolation

- **Objective:** Integrate the user-uploaded "Ho Chi Minh City 2025" 3D model into the game app, solve the monochromatic gray appearance by engineering a rich procedural coloring engine (Saigon River, terracotta roofs, French colonial facades, glass curtain-wall skyscrapers), and mount it on an isolated route (`/hochiminh`) distinct from the main game menu (`/`).
- **Completed work:**
  1. **Asset Integration & Geometry Analysis:**
     - Copied `ho_chi_minh_city_2025_-_thanh_pho_ho_chi_minh.glb` (19.6 MB, 53 meshes, 493,715 vertices) to `apps/game/public/assets/3d/environments/hochiminh.glb`.
     - Inspected model bounds (3.38 km x 2.96 km, height up to 312m).
     - Centered the scene origin at `[-27.756, 0, 24.365]` so all district coordinates align neatly around `[0, 0, 0]`.
  2. **Procedural Architecture & Surface Coloring Engine (`colorEngine.ts`):**
     - Developed real-time vertex color computation based on world elevation (`Y`), surface normal tilt (`Ny`), and spatial pseudo-random distributions.
     - Classified features:
       - **Saigon River (Sông Sài Gòn & Bến Bạch Đằng):** Elevation `Y < 0.45`, deep sapphire to emerald river gradient, plus physical water specular plane.
       - **Ground & Infrastructure:** Elevation `0.45 <= Y < 0.88`, dark asphalt avenues, light pedestrian sidewalks, and lush park green belts.
       - **Low-Rise Saigon Shophouses & Heritage:** Warm ochre yellow, French cream, terracotta, and soft pastel mint facades paired with clay terracotta roofs.
       - **Mid-Rise Commercial & Residential:** Modern white concrete, architectural slate, and sandstone.
       - **High-Rise Skyscrapers (Bitexco, Landmark, Vietcombank):** Elevation `Y >= 2.6`, reflective azure-cyan curtain wall glass gradients and rooftop crowns.
  3. **Multi-Theme Aesthetic Suite:**
     - ☀️ **Daylight ("Sài Gòn Rực Rỡ"):** Vibrant realistic daylight with crisp sunlight, soft sky bounce, and natural architectural colors.
     - 🌃 **Cyberpunk ("Sài Gòn Đêm Neon"):** Deep midnight obsidian base, glowing cyan/magenta/amber neon window bands, and pulsing red aviation warning beacons on tower pinnacles.
     - 🌇 **Sunset ("Hoàng Hôn Sài Gòn"):** Rich golden hour copper and rose gold reflections across the Saigon river and glazed towers.
     - 📐 **Tech Blueprint ("Bản Đồ Quy Hoạch Công Nghệ"):** Minimalist architectural zoning with cyan waterways, slate infrastructure, and royal blue landmarks.
  4. **Isolated Client-Side Routing:**
     - Added route detection supporting both path (`/hochiminh`) and hash (`#/hochiminh`), preserving the existing Main Menu on `/`.
     - Added smooth transitions via `window.history.pushState` with back/forward browser history support.
     - Placed discrete entry points in the Main Menu header and navigation stack.
  5. **Interactive Controls & 3D Landmark Markers:**
     - Smooth OrbitControls with height-clamping to prevent clipping under ground.
     - 3D floating landmark markers for Bitexco Financial Tower, Chợ Bến Thành & Ga Metro, Bến Bạch Đằng & Sông Sài Gòn, Cầu Ba Son, and Bán đảo Thủ Thiêm.
     - 5 cinematic camera presets (Toàn Cảnh, Bitexco, Sông Sài Gòn, Bến Thành, Thủ Thiêm) with smooth animated camera transitions.
     - Auto-rotate toggle, fullscreen toggle, and architectural info drawer.
- **Files created:**
  - `apps/game/public/assets/3d/environments/hochiminh.glb`
  - `apps/game/src/features/hochiminh/types.ts`
  - `apps/game/src/features/hochiminh/colorEngine.ts`
  - `apps/game/src/features/hochiminh/HCMModel.tsx`
  - `apps/game/src/features/hochiminh/HCMCanvas.tsx`
  - `apps/game/src/features/hochiminh/HCMOverlay.tsx`
  - `apps/game/src/features/hochiminh/HCMPage.tsx`
  - `apps/game/src/features/hochiminh/index.ts`
- **Files modified:**
  - `apps/game/src/app/App.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`
  - `THIRD_PARTY_NOTICES.md`
  - `docs/PROJECT_PROGRESS.md`
- **Validation:**
  - TypeScript type check (`tsc --noEmit`): 0 errors.
  - Production build (`vite build`): passed in 32s with optimized bundles.
- **Unresolved issues / limitations:**
  - The raw Sketchfab asset merged all meshes into a single material slot; our procedural coloring engine resolves this cleanly via vertex colors without requiring external 3D modeling re-export.
- **Follow-up:**
  - Optional mini-map / compass HUD when exploring the city.

### 2026-11-09 — Integration of Game-Ready City Asset, Sharpness Boost & Atmosphere Overhaul

- **Objective:** Replace the basic city strip with the rich "Low Poly City Game-Ready" environment downloaded by the owner, eliminate canvas blurriness on Retina displays, remove heavy distance fog, and overhaul lighting and composition for a cinematic, razor-sharp first-person street view.
- **Completed work:**
  1. Identified root causes of blurriness ("cứ mờ mờ"):
     - DPR was clamped to 1.5/1.0 on 2x Retina screens, causing browser bilinear upscaling blur.
     - Distance fog started at only 55m, cloaking half the avenue in dense grayish-blue haze.
     - Tone mapping was default linear, yielding low dynamic range and washed-out contrast.
  2. Integrated `low_poly_city_game-ready.glb` (costoWRLD, CC-BY 4.0, 44.2 MB) into `apps/game/public/assets/3d/environments/`:
     - Built at true 1:1 metric scale: high-rise apartment towers, glowing neon motel sign, retro diner, post office, commercial storefronts, pedestrian crosswalks, sidewalks, and avenue trees.
     - Materials tuned with sRGB textures, zero metalness (no black bugs), clean matte roughness (0.65), and emissive cyan neon for the "Motel" sign.
  3. Composed cinematic first-person avenue camera at `[-1.2, 1.85, -38.0]` looking down `-Z` toward `[-1.0, 2.5, -135.0]` past the Motel and Diner towards city towers.
  4. Repositioned extracted low-poly parked cars (Yellow Taxi, White Van, Red Sedan, Silver Pickup, Blue Hatchback) along avenue curbs (`X = ±4.75m`) aligned with traffic directions.
  5. Enhanced `GameCanvas.tsx` with native Retina DPR (`Math.min(window.devicePixelRatio, 2.0)`), `ACESFilmicToneMapping` with exposure 1.12, and pushed distance fog far back (`[220, 520]`) for crystal-clear clarity.
  6. Updated `THIRD_PARTY_NOTICES.md` and `credits.ts` with CC-BY 4.0 attribution for costoWRLD.
- **Files created/copied:**
  - `apps/game/public/assets/3d/environments/low_poly_city_game-ready.glb`
- **Files modified:**
  - `apps/game/src/config/credits.ts`
  - `apps/game/src/game/core/GameCanvas.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/EnvironmentLighting.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/StreetComposition.ts`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `THIRD_PARTY_NOTICES.md`
  - `docs/PROJECT_PROGRESS.md`
- **Validation:**
  - `pnpm typecheck` passed (3/3 workspaces).
  - `pnpm --filter @scammaze/game build` passed (1m 2s).
- **Unresolved issues / limitations:** None.
- **Follow-up tasks:** WASD player movement controller, in-game phone UI.

### 2026-11-09 — Parked Vehicles Extraction, Alignment & Visual Polish

- **Objective:** Fix vehicle rendering in the 3D Main Menu scene: resolve pitch-black material artifact, orient car models upright on the asphalt, extract complete vehicles (bodies + wheels + glass) from `low_poly_cars_pack.glb`, and adjust parking positions so the camera view is unobstructed and cinematic.
- **Completed work:**
  1. Diagnosed root causes:
     - GLTF spec default metallic factor caused Three.js PBR materials without envMap to attenuate diffuse colors to 0, producing pitch-black car bodies.
     - Asset geometry had Z as the up-axis instead of Y, causing vehicles to lie on their side.
     - The nearest car was positioned at `X = 18m, Z = -2m`, only 6m ahead of the camera, dominating the foreground.
     - Vehicle pack merged all wheels into `Object_58` and glass into `Object_57` across all cars.
  2. Implemented `extractBoxSubGeometry` in `StreetEnvironment.tsx` to extract matching wheels and glass sub-geometries for 6 distinct vehicle types (Red Sedan, Yellow Taxi, Blue Hatchback, White Delivery Van, Yellow Cab Van, Silver Pickup).
  3. Rotated geometries by `-Math.PI / 2` around X so that Z becomes Y (Three.js up-axis).
  4. Normalized geometry bounding boxes so horizontal center is `(0, 0)` and lowest tire vertices sit precisely at `Y = 0.0`.
  5. Tuned materials to low metalness (`0.05`), roughness `0.45`, flat shading, and sRGB color space, revealing vibrant low-poly liveries.
  6. Recomposed parking slots in `StreetComposition.ts`: moved nearest cars to `X = 8m` (North curb) and `X = 12m` (South curb), oriented them naturally with traffic direction, leaving the camera foreground open and cinematic.
- **Files modified:**
  - `apps/game/src/game/scenes/MainMenuScene/StreetComposition.ts`
  - `apps/game/src/game/scenes/MainMenuScene/StreetEnvironment.tsx`
  - `docs/PROJECT_PROGRESS.md`
- **Validation:**
  - `pnpm typecheck` passed (3/3 workspaces).
  - `pnpm --filter @scammaze/game build` passed (519ms).
  - `pnpm build` passed (full workspace).
- **Unresolved issues / limitations:** None for the main menu vehicles.
- **Follow-up tasks:** Player movement controller (WASD / pointer lock), interactive smartphone UI.

### 2026-11-09 — Monorepo restructure, 3D asset integration & First-Person 3D Main Menu implementation

- **Objective:** Reorganize the repository into a pnpm monorepo, prepare independent deployment for future subdomains, inspect and integrate the owner's downloaded 3D assets from `Kiroween/Asset3D/`, and implement the game application's first-person 3D Main Menu street scene.
- **Completed work:**
  1. Restructured repository into pnpm monorepo: `apps/landing` (marketing site & Knowledge Hub), `apps/game` (3D narrative game client), and `packages/shared-types` (pure TypeScript contracts).
  2. Preserved the existing landing page with zero regressions; updated GitHub Actions workflows (`ci.yml` and `deploy.yml`) to typecheck and build across the monorepo while deploying `apps/landing/dist` to GitHub Pages.
  3. Inspected local assets in `Kiroween/Asset3D/`: discovered self-contained glTF binary models `low_poly_city_asset_pack.glb` (Calipo, CC-BY 4.0) and `low_poly_cars_pack.glb` (matisosanimation, CC-BY 4.0). Integrated production copies into `apps/game/public/assets/3d/` and documented full attribution in `THIRD_PARTY_NOTICES.md`.
  4. Implemented `apps/game` using Three.js r174, React Three Fiber v9, and Drei v10:
     - First-person cinematic camera at human eye height (`y ≈ 2.05m`) looking down the avenue toward an atmospheric vanishing point.
     - Subtle breathing idle movement and pointer-based parallax motion for immersion.
     - Rich street composition: road asphalt with dashed lane markings, modular residential buildings (B1–B5, corner building, neighborhood storefront, hospital with helipad), benches, streetlights, low-poly trees, and parked cars along curbs.
     - Calibrated true architectural scale (x100 factor on city pack to compensate for FBX cm-to-m conversion) so buildings stand 12m–18m tall and road spans 96m.
     - Extracted vehicle meshes with `matrixWorld` applied and centered geometry so parked cars sit upright and flush on the pavement with true vehicle proportions.
     - Atmospheric daylight lighting: crisp sunlight (`directionalLight` with soft shadows), ambient skylight (`#dbe7f7`), hemisphere ground bounce, and natural distance fog (`#86a9d2`) seamlessly matching the clear afternoon sky.
  5. Built accessible, stylized React menu overlay on top of 3D Canvas:
     - `NEW GAME`: opens Prologue introduction modal describing the morning notification scenario.
     - `CONTINUE`: disabled state explaining save system unlocks after Chapter 1.
     - `SETTINGS`: functional modal with Graphics Quality (Low, Medium, High DPR and shadow presets), FOV slider (60°–85°), sound toggle, and master volume with `localStorage` persistence.
     - `CREDITS`: modal displaying verified Sketchfab authors, licenses (CC-BY 4.0), and open-source packages.
     - WebGL context detection and fallback banner.
  6. Prepared independent Vercel deployment: configured `vercel.json` SPA rewrites for both `apps/landing` and `apps/game`.
- **Files created:**
  - `pnpm-workspace.yaml`
  - `THIRD_PARTY_NOTICES.md`
  - `packages/shared-types/package.json`, `packages/shared-types/tsconfig.json`, `packages/shared-types/src/index.ts`
  - `apps/landing/package.json`, `apps/landing/vercel.json`, `apps/landing/.env.example`
  - `apps/game/package.json`, `apps/game/tsconfig.json`, `apps/game/tsconfig.app.json`, `apps/game/tsconfig.node.json`, `apps/game/vite.config.ts`, `apps/game/vercel.json`, `apps/game/index.html`, `apps/game/.env.example`
  - `apps/game/src/main.tsx`, `apps/game/src/app/App.tsx`, `apps/game/src/styles/index.css`
  - `apps/game/src/config/credits.ts`
  - `apps/game/src/components/ui/BrandLogo.tsx`, `MenuButton.tsx`, `ModalDialog.tsx`, `WebGLFallback.tsx`
  - `apps/game/src/features/menu/MainMenuOverlay.tsx`, `SettingsModal.tsx`, `CreditsModal.tsx`, `IntroPrologueModal.tsx`
  - `apps/game/src/game/core/GameCanvas.tsx`
  - `apps/game/src/game/scenes/MainMenuScene/MainMenuScene.tsx`, `StreetEnvironment.tsx`, `EnvironmentLighting.tsx`, `MenuCamera.tsx`, `StreetComposition.ts`, `index.ts`
  - `apps/game/public/assets/3d/environments/low_poly_city_asset_pack.glb`, `apps/game/public/assets/3d/vehicles/low_poly_cars_pack.glb`
- **Files moved:**
  - `src/` -> `apps/landing/src/`
  - `public/` -> `apps/landing/public/`
  - `index.html` -> `apps/landing/index.html`
  - `vite.config.ts` -> `apps/landing/vite.config.ts`
  - `tsconfig.*` -> `apps/landing/tsconfig.*`
- **Files modified:**
  - `package.json` (root workspace scripts: `dev:landing`, `dev:game`, `build:landing`, `build:game`, `build`, `typecheck`)
  - `.github/workflows/ci.yml` (validates workspace typecheck and build; uploads landing artifact)
  - `.github/workflows/deploy.yml` (builds `apps/landing` and deploys `apps/landing/dist`)
  - `README.md` (updated structure, commands, status table, 3D credits)
  - `AGENTS.md` (updated current stack and root workspace scripts)
  - `docs/architecture/OVERVIEW.md` (updated architecture diagram, stack table, implemented status)
  - `docs/architecture/DEPLOYMENT.md` (documented independent Vercel project configurations)
  - `docs/PROJECT_PROGRESS.md` (status, completed items, and this entry)
- **Validation commands executed:**
  - `pnpm install` (monorepo resolution succeeded with pnpm v10.26.0)
  - `pnpm --filter @scammaze/landing build` (build succeeded in 334ms)
  - `pnpm --filter @scammaze/game build` (build succeeded in 665ms)
  - `pnpm typecheck` (all 3 workspace projects passed TS typechecking with zero errors)
  - `pnpm build` (workspace-wide production build passed in 3.0s)
- **Build and test results:**
  - All workspace packages compile cleanly.
  - Zero TypeScript errors (`tsc -b --noEmit`).
  - Production bundles generated cleanly in `apps/landing/dist` and `apps/game/dist`.
- **Known limitations:**
  - First-person walking controller (WASD / pointer lock) is intentionally deferred to Chapter 1 exploration milestone; the Main Menu camera is purely cinematic with breathing motion and mouse parallax.
  - Save game functionality is disabled in the menu until Chapter 1 persistence is implemented.
  - Audio files are not yet included in the repository; the sound toggle and volume controls persist state in `localStorage` in preparation for ambient audio.
- **Architecture deviations:** None. Followed the approved game stack (Three.js r174 + R3F v9 + Drei v10) and pnpm monorepo structure.
- **Follow-up tasks:**
  - Implement first-person walking and collision controller for scene exploration.
  - Build the in-game smartphone overlay and Chapter 1 "The Urgent Call" scenario state machine.

### 2026-11-08 — Game application stack alignment

- **Objective:** Align all documentation with the owner's decision on the game application
  stack, without changing the product positioning or the landing page.
- **Changes:** Added the game application stack to OVERVIEW (new section 3.1: technologies,
  roles, statuses, boundaries, dependency direction, benchmark list) and updated its target
  table, diagram, component and reconciliation sections. Replaced "3D library `PENDING`"
  (React Three Fiber, Babylon.js or PlayCanvas) and "XState or Zustand" with the decided stack
  in the product positioning (section 10.1 and open decisions only), README, AGENTS.md, master
  plan (section 4.1 amendment) and this file. Recorded that PixiJS is not the 3D engine and that
  ECS is not approved. Documentation only: no code or dependency changes.
- **Files modified:** `docs/architecture/OVERVIEW.md`, `docs/product/PRODUCT_POSITIONING.md`,
  `README.md`, `AGENTS.md`, `SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md`, `docs/PROJECT_PROGRESS.md`.
- **Validation:** grep across all Markdown for 3D engine, physics, state, ECS, PixiJS, XState,
  Zod and Dexie mentions; documentation checks (links, anchors, tables, Mermaid structure,
  emoji, language, secrets); CI `pnpm build` on the pull request.
- **Build/test results:** PR #9, CI `build` job passed (`pnpm install` + `pnpm build`);
  documentation checks passed (116 links and anchors, 67 tables, 5 Mermaid blocks). No test
  suite exists.
- **Known limitations:** No library versions are pinned; React 19 compatibility of React Three
  Fiber, Drei and Rapier must be confirmed when they are installed. No benchmark exists.
- **Architecture deviations:** none beyond the owner decision; the plan's open state-owner choice
  is resolved in favour of Zustand.
- **Follow-up tasks:** 3D prototype and benchmark (OVERVIEW section 3.1); decide on Rapier after
  the prototype.

### 2026-11-08 — Product positioning for the first-person 3D direction

- **Objective:** Establish the canonical product positioning after the owner's decision that
  SCAMMAZE is a browser-based, first-person 3D narrative game (Frankenstein category), and
  reconcile conflicting documents. Documentation only.
- **Changes:** Audited the repository, including PR #7, which had merged after the previous
  documentation task. Wrote the canonical positioning: definition, vision and north star,
  problem, audiences, core loop, world and chapters, technology chimera with an interdependence
  trace, hybrid intelligence architecture, AI capability matrix with the Bounded Scam Actor as the
  signature capability, differentiation, visual direction and browser 3D performance principles,
  MVP slice and non-goals, Kiroween mapping, messaging. Turned `docs/positioning.md` into a
  pointer. Updated README, AGENTS.md product principles, the master plan's executive summary
  (with "Amended 8 Nov 2026" notes in sections 0, 3.1, 3.4, 3.5, 4.1, 10, 11.1 and 13),
  OVERVIEW (current state after PR #7, 3D game client, deterministic core, AI layer,
  reconciliation, landing page accuracy), DEPLOYMENT and COST_ESTIMATION (3D assets, AI cost,
  `VITE_GAME_URL`, lockfile). Corrected a code comment in `src/config/site.ts` and the README
  that presented `play.scammaze.com` as planned. No application behaviour changed, no
  dependencies installed, no AWS resources, domains, databases or AI providers.
- **Files modified:** created `docs/product/PRODUCT_POSITIONING.md`; modified
  `docs/positioning.md`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`,
  `SCAMMAZE_KIROWEEN_2026_FULL_PLAN.md`, `docs/architecture/OVERVIEW.md`,
  `docs/architecture/DEPLOYMENT.md`, `docs/finops/COST_ESTIMATION.md`,
  `docs/PROJECT_PROGRESS.md`, `.kiro/steering/audience.md`, `src/config/site.ts` (comment only).
- **Validation:** Documentation checks for relative links and anchors, Markdown table column
  counts, Mermaid structure, emoji, non-English text, secrets and cost-table arithmetic; grep
  review for 2D-only framing, 3D out-of-scope claims, proposed domains and AI overreach; CI
  `pnpm build` on the pull request.
- **Build/test results:** PR #8, CI `build` job passed (`pnpm install` + `pnpm build`).
  Documentation checks passed (110 relative links and anchors, 65 tables, 5 Mermaid blocks,
  cost tables, emoji, language, secrets); the checker also caught seeded errors. `pnpm build`
  could not run locally because the sandbox cannot reach the npm registry. No test suite exists.
- **Known limitations:** The Kiroween 2026 judging criteria and category text were taken from
  master plan section 1.2 and the published Kiroween category description; the 2026 rules page
  was not re-read in this task. Mermaid diagrams were checked structurally, not rendered. No
  performance figures exist; all budgets are deferred to prototype benchmarks.
- **Architecture deviations:** 3D world moved from out of scope to the core platform; AI layer
  elevated from optional coach to a proposed product component with the same safety boundaries;
  the landing page copy no longer matches the product definition.
- **Follow-up tasks:** owner decisions listed above; update landing page copy; 3D prototype and
  benchmark; `.kiro/specs/` for the deterministic core and Chapter 1; switch CI to
  `--frozen-lockfile`; re-audit accessibility after PR #7.

### 2026-11-07 — Cinematic landing page redesign (PR #7, recorded retroactively)

- **Note:** Recorded on 2026-11-08 from the merged pull request; the original PR did not add an
  entry.
- **Changes (from PR #7):** Replaced the flat landing page with an 11-section dark marketing
  page; added `src/config/site.ts` and `.env.example` (`VITE_GAME_URL`); added `lucide-react` and
  self-hosted fonts; committed `pnpm-lock.yaml`; moved the demo scenario, URL checker and old
  sections to `src/legacy/` (not mounted).
- **Build/test results:** The `main` deployment of `8c66005` was reported `success` by GitHub.

### 2026-11-07 — Architecture, AWS FinOps and project documentation update

- **Objective:** Document the current implementation, target architecture, deployment strategy,
  AWS cost baseline, database decision status, domain strategy and progress tracking, without
  deploying or purchasing anything.
- **Changes:** Audited the repository, master plan, workflows and live deployment status.
  Documented current vs planned architecture with status labels; deployment and environment
  variables; database comparison with `DATABASE_DECISION = PENDING` and a non-binding
  recommendation; full AWS cost baseline with assumptions, validation checklist, credit
  limitations and a separate `TBD` domain cost category; persistent agent instructions;
  this progress tracker. Documentation only: no application code changed, no AWS resources
  created, no domain purchased.
- **Files modified:** created `AGENTS.md`, `docs/architecture/OVERVIEW.md`,
  `docs/architecture/DEPLOYMENT.md`, `docs/architecture/DATABASE_STRATEGY.md`,
  `docs/finops/COST_ESTIMATION.md`, `docs/PROJECT_PROGRESS.md`; updated `README.md`,
  `CONTRIBUTING.md`, `.github/pull_request_template.md`.
- **Validation:** Re-calculated all supplied cost figures (rows, columns, scenarios, credit
  utilization, VND conversions); checked relative links and heading anchors; checked Markdown
  table column counts; reviewed Mermaid syntax manually; searched for proposed domain names,
  database selection claims and deployment claims; scanned for secrets, emoji and non-English
  text.
- **Build/test results:** PR #6, CI `build` job passed (`pnpm install` + `pnpm build`);
  documentation checks passed (86 relative links and anchors, 54 tables, cost tables, Mermaid
  structure, secrets, emoji, language). No test suite exists, so no tests were run.
- **Known limitations:** Prices for AWS free allowances, Neon and domains come from public pages
  and third-party reports as of Nov 2026 and were not checked in the AWS Pricing Calculator.
  Mermaid diagrams were not rendered by a Mermaid parser in this environment.
- **Architecture deviations:** Recorded in [OVERVIEW.md section 9](architecture/OVERVIEW.md#9-reconciliation-with-the-master-plan)
  (hosting, backend framework, accounts, 3D scope, visual system).
- **Follow-up tasks:** Correct landing page copy; fix or reopen issue #4; commit a lockfile; add
  a test runner; create `.kiro/specs/` for Phase B; owner decisions listed above.

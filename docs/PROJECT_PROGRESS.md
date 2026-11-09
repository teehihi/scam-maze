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
- **Last updated:** 2026-11-09

## Completed

Verified against merged pull requests on GitHub and local workspace builds.

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
- No automated tests; no accessibility audit yet.

## Task History

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

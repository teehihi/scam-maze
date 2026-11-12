# Implementation Plan: 3D phone call UI (`game-3d-phone-call-ui`)

## Overview

This plan implements the approved design in TypeScript (React 19, React Three Fiber, Drei,
Vitest). It starts with the phone asset and the chapter loader, then adds the pure layout and
motion modules, the extracted keyboard hook, the two DOM components, the 3D phone and the
screen host. It ends by wiring `CallPresentation` into `ChapterOnePage` with a locked `call`
overlay entry, followed by the property tests, the import-boundary test, the docs and the push.

The owner accepted the design's answers to "Requirements gaps found during design":

- lines with speaker `caller` or `npc` count as Caller_Lines;
- system narration is shown in `PlayerChoiceOverlay` above the options;
- the `ChapterLoadingFlow` test expects 3 files for Chapter 1 instead of 2;
- the page and accessibility tests are rewritten for the new post-call behavior;
- no camera pose restore (the call writes nothing to the camera).

### Rules for every task

- **Branch.** Task 1.1 creates `feat/game-3d-phone-call-ui` from the current tip of
  `feat/game-i18n-en-vi` (`0610f65`) and confirms it with `git branch --show-current`. Commits
  stay local until task 14.1, which pushes without force options. Never merge, and never push to
  `main` or `feat/game-i18n-en-vi`.
- **Tests are required.** No test sub-task is optional. Property tests use
  `apps/game/src/test/seededRandom.ts` and `apps/game/src/test/chapterRuns.ts`, run at least 100
  cases, set an explicit `PROPERTY_TIMEOUT_MS = 60_000`, print the seed and case on failure, and
  start with the comment `// Feature: game-3d-phone-call-ui, Property N: <title>`. Add no new dev
  dependencies.
- **Running tests.** Run targeted tests with
  `pnpm --filter @scammaze/game exec vitest run <paths>`. Never run tests and typecheck in
  parallel.
- **PowerShell.** Do not chain commands with `&&`. Run each command as its own call.
- **Commits.** Conventional Commits (`type(scope): summary`, type `feat`, `fix`, `test`, `docs`,
  `chore` or `refactor`). Stage named files only, never `git add -A` or `git add .`. Keep the
  human as author and add the trailer
  `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`. Never stage the
  original candidates `apps/game/public/assets/3d/props/phone/*.glb` (already committed, not
  changed by this feature), `.env` files, `apps/game/dist/` or `node_modules/`.
- **Content.** Repository content in English. All UI text through i18n keys in both `en` and
  `vi` (no hard-coded text, no string concatenation). No emoji. Never use "safe" or "an toàn"
  for a number, message, URL or caller. Fictional numbers stay plain text, never links.
- **Boundaries.** `apps/game/src/game/narrative/**` imports no React, Three.js or i18n module and
  is not modified by this feature.

## Tasks

- [x] 1. Create the feature branch
  - [x] 1.1 Create and check out `feat/game-3d-phone-call-ui`
    - Check that the working tree has no unrelated staged changes (`git status --short`).
    - Run `git switch -c feat/game-3d-phone-call-ui 0610f65` (the tip of `feat/game-i18n-en-vi`).
    - Confirm with `git branch --show-current` that the output is exactly
      `feat/game-3d-phone-call-ui`, and with `git log --oneline -1` that HEAD is `0610f65`.
    - _Requirements: 14.1, 14.3_

- [x] 2. Phone model asset, asset path, source notes and credits
  - [x] 2.1 Write the optimization script and produce the Phone_Model
    - Create `apps/game/scripts/optimize-call-phone.cjs` with the existing root tools only
      (`@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`,
      `meshoptimizer`, `sharp`).
    - Read `apps/game/public/assets/3d/props/phone/iphone-17-pro.glb`; print the primitive
      inventory (mesh, material, triangle count, bounds); apply a `REMOVE_PRIMITIVES` list
      (mesh name + material name, empty today).
    - Branding plan: remove the `wallpaper` base color and emissive textures from `OLED`, set its
      base color to the linear `BRAND.navy` factor `[0.0123, 0.0110, 0.0250, 1]` and emissive to
      black; rename nodes and meshes to `CallPhoneBody` and `CallPhoneFront` so no name contains
      the product name.
    - Textures at most 1024 px, WebP quality 90 for normal maps and 85 for color,
      `EXT_texture_webp` required; then `prune()`, `dedup()`, `weld({ tolerance: 0.0001 })`,
      `quantize()`, `reorder()`, `meshopt({ level: "medium" })`; no decimation.
    - Write `apps/game/public/assets/3d/optimized/call-phone.optimized.glb`, print sizes before
      and after, exit with code 1 above 5,242,880 bytes.
    - Run `node apps/game/scripts/optimize-call-phone.cjs` from the workspace root and keep the
      printed sizes and inventory for task 2.3.
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 2.2 Add the asset path constant
    - In `apps/game/src/config/assetPaths.ts`, add
      `CALL_PHONE_GLB = "/assets/3d/optimized/call-phone.optimized.glb"` with a doc comment
      naming the script.
    - _Requirements: 9.2, 9.11_
  - [x] 2.3 Update `SOURCE.md`
    - In `apps/game/public/assets/3d/props/phone/SOURCE.md`, record the selected candidate
      (`iphone-17-pro.glb`), the output file name, the command and all settings, the sizes before
      and after (measured in task 2.1), the inspection table from the design (each texture and
      material, what was found), each branding change, the `REMOVE_PRIMITIVES` result, and the
      pending manual back-render check.
    - _Requirements: 9.3, 9.5_
  - [x] 2.4 Add the Asset_Credits entry and its locale keys
    - In `apps/game/src/config/credits.ts`, add `CreditItemId` `"callPhone"` to the `vehicles`
      group with the fields from the design (name `call-phone.optimized.glb`, creator
      `not stated`, candidate named as plain text without a path, license as stated by the owner
      on 2026-11-12, notes).
    - Add `items.callPhone.notes` in `apps/game/src/i18n/locales/en/credits.ts` and
      `apps/game/src/i18n/locales/vi/credits.ts` with the design's en and vi text.
    - Run `pnpm --filter @scammaze/game exec vitest run src/features/menu/CreditsModal.test.tsx`;
      if it counts entries, update the expected count only, without weakening any assertion.
    - _Requirements: 9.4, 12.1_
  - [x] 2.5 Write the credits unit test
    - Create `apps/game/src/config/credits.callPhone.test.ts`: exactly one `callPhone` entry;
      name `call-phone.optimized.glb`; candidate text contains `iphone-17-pro.glb` but no
      `props/phone/` path; creator `not stated`; license text names the owner statement of
      2026-11-12; the notes key exists in en and vi and contains no "safe" or "an toàn".
    - Run it with `pnpm --filter @scammaze/game exec vitest run src/config/credits.callPhone.test.ts`.
    - _Requirements: 9.4, 12.1_
  - [x] 2.6 Commit the asset
    - Stage by name: `apps/game/scripts/optimize-call-phone.cjs`,
      `apps/game/public/assets/3d/optimized/call-phone.optimized.glb`,
      `apps/game/public/assets/3d/props/phone/SOURCE.md`, `apps/game/src/config/assetPaths.ts`,
      `apps/game/src/config/credits.ts`, `apps/game/src/config/credits.callPhone.test.ts`, both
      `credits.ts` locale files, and `CreditsModal.test.tsx` only if it changed.
    - Do not stage the original `props/phone/*.glb` candidates.
    - Commit `feat(game): add optimized call phone model and credits` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 3. Chapter loader optional assets and the registry entry
  - [x] 3.1 Add the optional flag and the Chapter 1 phone entry
    - In `apps/game/src/game/chapters/chapterRegistry.ts`, add `optional?: boolean` to
      `ChapterAsset` (with the design's doc comment) and add the Chapter 1 entry
      `{ id: "call-phone", url: CALL_PHONE_GLB, kind: "gltf", loadingText: "Loading the phone", optional: true }`.
    - Add `chapter-1.assets.call-phone` to `apps/game/src/i18n/locales/en/chapters.ts`
      ("Loading the phone") and `apps/game/src/i18n/locales/vi/chapters.ts`
      ("Đang tải điện thoại").
    - _Requirements: 9.7, 9.10, 12.1_
  - [x] 3.2 Skip failed optional assets in the loader
    - In `apps/game/src/game/loading/chapterLoader.ts`, catch a rejection of an optional asset
      (network error, HTTP error, verification failure, shared abort), mark it done, set
      `totals[index]` to the bytes received (or 0), write nothing to the console, and continue.
    - Keep required asset failures and the stall timer behavior unchanged; when only optional
      downloads are pending at a stall, the chapter becomes ready.
    - Keep the byte-based progress so a skipped asset still lets progress reach 1.
    - _Requirements: 9.12, 8.5_
  - [x] 3.3 Extend the registry test
    - In `apps/game/src/game/chapters/chapterRegistry.test.ts`: `CALL_PHONE_GLB` appears exactly
      once in the Chapter 1 assets and is `optional`; the file exists under `apps/game/public/`;
      its size is at most 5,242,880 bytes; its file name contains no real brand or product name;
      it passes `verifyAsset`; its GLB JSON has no image named `wallpaper` and no node or mesh
      name containing the product name; the `OLED` primitive accessor bounds match
      `SCREEN_WIDTH_M` and `SCREEN_HEIGHT_M` (values from the design) within 0.5 mm.
    - _Requirements: 9.2, 9.3, 9.7, 10.1, 13.6_
  - [x] 3.4 Add loader unit tests for optional assets
    - In `apps/game/src/game/loading/chapterLoader.test.ts`: a failing optional asset is skipped
      and progress reaches 1; a stall with only optional downloads pending still reaches `ready`;
      a failing required asset still ends in `error`; no console output for a skipped asset.
    - _Requirements: 9.12_
  - [x] 3.5 Write the property test for optional assets
    - Create `apps/game/src/game/loading/chapterLoader.optional.property.test.ts` using
      `createFakeFetch` and `createTestDeps` from `apps/game/src/test/fakeAssets.ts`.
    - **Property 10: Optional assets never block the chapter**
    - **Validates: Requirements 9.12**
  - [x] 3.6 Update the chapter loading flow test
    - In `apps/game/src/features/loading/ChapterLoadingFlow.test.tsx`, register the phone URL
      with the fake fetch, change the expected file count for Chapter 1 from 2 to 3 (for example
      "0 / 3 tệp"), and assert the Vietnamese loading text for `call-phone`. Keep every other
      assertion as it is.
    - _Requirements: 9.7, 9.10, 13.9_
  - [x] 3.7 Commit the loader change
    - Run the tests from 3.3 to 3.6 with
      `pnpm --filter @scammaze/game exec vitest run <paths>`, then stage by name
      `chapterRegistry.ts`, `chapterRegistry.test.ts`, `chapterLoader.ts`,
      `chapterLoader.test.ts`, `chapterLoader.optional.property.test.ts`,
      `ChapterLoadingFlow.test.tsx` and both `chapters.ts` locale files.
    - Commit `feat(game): load the call phone as an optional chapter asset` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 4. Pure call layout, motion, sink and model status modules
  - [x] 4.1 Implement `callLayout.ts`
    - Create `apps/game/src/features/chapter1/call/callLayout.ts` with no imports from three,
      React or i18n: `Viewport`, `Rect`, `CallLayout`, the constants (`SCREEN_WIDTH_M`,
      `SCREEN_HEIGHT_M`, `SCREEN_ASPECT`, `SCREEN_CORNER_RATIO`, `NARROW_BREAKPOINT`,
      `MAX_SCREEN_HEIGHT`, `MIN_CHOICE_WIDTH`), `computeCallLayout`, `rectsIntersectArea`,
      `solveScreenPose` (with the 0.06 m guard clamp) and `projectScreenRect`, following the
      narrow and wide layout rules in the design.
    - _Requirements: 1.3, 1.4, 3.2, 3.3, 3.4, 10.2, 10.3_
  - [x] 4.2 Implement `phoneMotion.ts`
    - Create `apps/game/src/features/chapter1/call/phoneMotion.ts` with `ENTRY_DURATION_MS = 400`,
      the vibration constants, `MotionInput` and `phoneMotionOffset` (slide in from the right
      with cubic ease-out; vibration bursts only while ringing; 0 with reduced motion).
    - _Requirements: 6.3, 6.4, 6.5_
  - [x] 4.3 Implement `phoneScreenSink.ts` and `phoneModelStatus.ts`
    - `apps/game/src/features/chapter1/call/phoneScreenSink.ts`: `createPhoneScreenSink()` with
      `publish`, `current` and `subscribe`; ignore a rectangle that differs from the last one by
      less than 0.25 px on every edge; always forward `null`.
    - `apps/game/src/features/chapter1/call/phoneModelStatus.ts`: `hasPhoneModelFailed`,
      `reportPhoneModelFailure` (first call logs one `console.warn` with
      `Phone model could not be loaded: <url>` and the error as a second argument; later calls do
      nothing) and `resetPhoneModelStatusForTests`.
    - _Requirements: 8.2, 8.5, 8.8, 10.5_
  - [x] 4.4 Write the layout property test
    - Create `apps/game/src/features/chapter1/call/callLayout.property.test.ts` with one `it`
      block for this property.
    - **Property 5: Layout keeps the screen and the choices inside the viewport and apart**
    - **Validates: Requirements 1.3, 1.4, 3.2, 3.3, 3.4**
  - [x] 4.5 Write the pose and projection property test
    - Add a second `it` block to `apps/game/src/features/chapter1/call/callLayout.property.test.ts`;
      use `THREE.PerspectiveCamera` and `Vector3.project` (no WebGL context).
    - **Property 6: Pose and projection round trip**
    - **Validates: Requirements 10.3, 10.5, 10.7**
  - [x] 4.6 Write the motion property test
    - Create `apps/game/src/features/chapter1/call/phoneMotion.property.test.ts`.
    - **Property 7: Motion stays within bounds**
    - **Validates: Requirements 6.3, 6.4, 6.5**
  - [x] 4.7 Write unit tests for the sink and the model status
    - Create `apps/game/src/features/chapter1/call/phoneScreenSink.test.ts` (sub-0.25 px changes
      are ignored, `null` is always forwarded, unsubscribe stops delivery) and
      `apps/game/src/features/chapter1/call/phoneModelStatus.test.ts` (one warning containing the
      asset path for repeated failures, `hasPhoneModelFailed` after the first, reset for tests).
    - _Requirements: 8.5, 8.8_
  - [x] 4.8 Commit the pure modules
    - Run the tests from 4.4 to 4.7, stage the eight files of tasks 4.1 to 4.7 by name, and
      commit `feat(game): add call layout, motion and screen sink modules` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 5. Extract the dialogue option keyboard hook
  - [x] 5.1 Create `useDialogueOptionKeys` and use it in `DialoguePanel`
    - Create `apps/game/src/features/chapter1/dialogue/useDialogueOptionKeys.ts` with the design
      interface (`options`, `onSelectOption`, `disabled`, `numberKeys`, `autoFocus`, `nodeKey`;
      returns `setOptionRef`, `onOptionKeyDown`, `focusFirst`).
    - Move the number key (1 to 9, no Alt, Ctrl or Meta, no repeat, not in typing targets, not
      disabled, N within the count), Arrow Up and Down with wrap, Home and End, and focus-first on
      node change logic out of `apps/game/src/features/chapter1/dialogue/DialoguePanel.tsx`
      without behavior changes.
    - Run `pnpm --filter @scammaze/game exec vitest run src/features/chapter1` and confirm the
      existing `DialoguePanel` behavior tests pass unchanged.
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.7, 11.7_
  - [x] 5.2 Write the keyboard property test
    - Create `apps/game/src/features/chapter1/dialogue/useDialogueOptionKeys.property.test.tsx`.
    - **Property 8: Option keyboard rules**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.7**
  - [x] 5.3 Commit the hook extraction
    - Stage `useDialogueOptionKeys.ts`, `useDialogueOptionKeys.property.test.tsx` and
      `DialoguePanel.tsx` by name; commit
      `refactor(game): extract dialogue option keyboard hook` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 6. Theme tokens and call presentation i18n keys
  - [x] 6.1 Add choice option and call button styles to the theme
    - In `apps/game/src/features/chapter1/theme.ts`, add `UI.choiceOption` from `BRAND` colors and
      `#38344f` only: default, hover, pressed (`active:`), keyboard focus (`focus-visible:`
      outline at least 2 px) and disabled styles without an opacity change; add call button
      disabled styles without opacity.
    - _Requirements: 3.9, 7.7, 7.8_
  - [x] 6.2 Add the new call presentation keys
    - Add `phone.callPresentation.name` ("Phone call" / "Cuộc gọi điện thoại") and
      `phone.callPresentation.screenLabel` ("Phone screen" / "Màn hình điện thoại") to
      `apps/game/src/i18n/locales/en/chapter1/phone.ts` and
      `apps/game/src/i18n/locales/vi/chapter1/phone.ts`. Keep `phone.overlay.callInProgress`
      for now; task 10.5 removes it.
    - _Requirements: 7.1, 12.1_
  - [x] 6.3 Write the contrast test
    - Create `apps/game/src/features/chapter1/call/contrast.test.ts`: compute WCAG contrast from
      the hex values used by the screen text, call buttons, choice options in every state
      (including disabled) and the dimming layer; assert text at least 4.5:1 and the focus
      outline at least 3:1 against the adjacent background.
    - _Requirements: 6.6, 7.7, 7.8_
  - [x] 6.4 Commit theme and keys
    - Stage `theme.ts`, `contrast.test.ts` and both `chapter1/phone.ts` locale files by name;
      commit `feat(game): add call presentation theme tokens and i18n keys` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 7. Phone screen content and the player choice overlay
  - [x] 7.1 Implement `PhoneScreenUI`
    - Create `apps/game/src/features/chapter1/call/PhoneScreenUI.tsx` importing only React,
      `react-i18next`, `lucide-react`, `usePrefersReducedMotion` and `theme.ts`.
    - Export `CallScreenView` and `PhoneScreenUIProps`. Render the ringing and active content
      from the design table inside a `section` with
      `aria-label={t("phone.callPresentation.screenLabel")}`; keep the existing test IDs.
    - Number as `<p dir="ltr">` with `whitespace-nowrap`, no link, no `tel:`, no tab stop.
      Caller_Line card with `aria-live="polite"` `aria-atomic="true"`, scrollable, not a Tab stop;
      `phone.call.connecting` in a polite live region for `"connecting"`; no line for `null`.
    - Native buttons only, labels from existing keys, `disabled` while paused, `aria-hidden`
      icons, text at least `text-sm`, container query for side-by-side ringing buttons, no
      trust badge, no emoji.
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 2.10, 2.11, 5.5, 5.6, 11.2, 12.4, 12.5_
  - [x] 7.2 Implement `PlayerChoiceOverlay`
    - Create `apps/game/src/features/chapter1/call/PlayerChoiceOverlay.tsx` (no three imports)
      with the design props (`view`, `narration`, `disabled`, `onSelectOption`, `region`).
    - Fixed root at `region`, `maxHeight: region.height`, vertical scroll only; visible label
      from `dialogue.optionsLabel` with an id used by `aria-labelledby` on the `ol`; optional
      narration paragraph labeled with `dialogue.systemSpeaker`; `ol > li > button` per option
      with an `aria-hidden` key hint, wrapped text with no truncation,
      `dialogue.fallbackOption` for fallback options, test IDs `dialogue-option-<id>`;
      `dialogue.noOptions` and no list for zero options; `UI.choiceOption` styles.
    - Keyboard behavior from `useDialogueOptionKeys` (`numberKeys` and `autoFocus` on, `disabled`
      while paused).
    - _Requirements: 3.1, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8, 7.10, 11.2, 12.4, 12.5_
  - [x] 7.3 Write `PhoneScreenUI` unit tests
    - Create `apps/game/src/features/chapter1/call/PhoneScreenUI.test.tsx`: ringing and active
      items; number `dir="ltr"`, no link ancestor, not focusable; connecting state; live region
      node stays the same across re-renders and its text changes only with the line; icons
      `aria-hidden`; no emoji; no `text-xs` class; no "safe", "verified", "trusted" or "an toàn"
      text; buttons disabled while paused and handlers not called.
    - _Requirements: 1.5, 2.1, 2.2, 2.5, 2.8, 2.9, 2.10, 2.11, 5.6, 13.1_
  - [x] 7.4 Write `PlayerChoiceOverlay` unit tests
    - Create `apps/game/src/features/chapter1/call/PlayerChoiceOverlay.test.tsx`: visible label
      names the list; `noOptions` with zero buttons; narration paragraph for a system line;
      wrap classes and no truncate or ellipsis classes; `UI.choiceOption` classes; click, Enter
      and Space call `onSelectOption` once with the option ID; disabled options while paused.
    - _Requirements: 3.5, 3.7, 3.8, 3.9, 4.1, 4.7, 7.10_
  - [x] 7.5 Commit the DOM components
    - Run the tests from 7.3 and 7.4, stage the four files of tasks 7.1 to 7.4 by name, and
      commit `feat(game): add phone screen UI and player choice overlay` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 8. Screen host, 3D phone and canvas integration
  - [x] 8.1 Implement `PhoneScreenHost`
    - Create `apps/game/src/features/chapter1/call/PhoneScreenHost.tsx` (no three imports): one
      `div` with `data-testid="phone-screen-host"` and `data-mode`, fixed position with
      `transform`, `width`, `height`, `border-radius`, `container-type: inline-size` and the
      opaque `#1d1b2b` background; `fallback` adds the 2D bezel, `pending` sets `opacity: 0`;
      `model` subscribes to the sink in an effect and writes the style on the element ref with no
      React render per frame. The element type and tree position never change between modes.
    - _Requirements: 8.1, 8.3, 8.4, 8.6, 10.3, 10.5, 10.6, 10.7, 11.2_
  - [x] 8.2 Implement `PhoneModel3D`, `PhoneModelWarmup` and `PhoneModelBoundary`
    - Create `apps/game/src/features/chapter1/call/PhoneModel3D.tsx` importing `CALL_PHONE_GLB`,
      `callLayout.ts`, `phoneMotion.ts` and the sink type only (nothing from the narrative store,
      selectors or `useChapterState`).
    - `useGLTF(CALL_PHONE_GLB)`, clone once with `useMemo`, no shadows, `frustumCulled = false`,
      inner group rotated by π about Y; rig updated in `useFrame` at default priority: compute the
      layout from `useThree` size, add `phoneMotionOffset`, solve the pose, copy the camera pose
      into the rig and translate; project the four anchor corners and publish the bounding
      rectangle; dimming plane as a rig child with `MeshBasicMaterial` (`BRAND.graphite`,
      opacity 0.6, `depthWrite: false`); publish `null` on unmount.
    - Add no light, environment map, post-processing or second canvas, and never write to the
      camera.
    - `PhoneModelWarmup` calls `useGLTF(CALL_PHONE_GLB)` and renders `null`; `PhoneModelBoundary`
      calls `onError` in `componentDidCatch` and then renders `null`.
    - _Requirements: 1.1, 1.6, 6.3, 6.4, 6.5, 6.6, 9.6, 10.1, 10.5, 11.3, 11.4_
  - [x] 8.3 Integrate the phone into `ChapterOneCanvas`
    - In `apps/game/src/features/chapter1/ChapterOneCanvas.tsx`, add the props `callPhone`,
      `phoneModelEnabled`, `onPhoneModelError` and `onWebGLContextChange`.
    - Set `aria-hidden="true"` on `Canvas` with no accessible name; keep the game view `div`
      focusable and not hidden.
    - After `onSceneReady` and while `phoneModelEnabled`, mount the warmup inside its own
      `PhoneModelBoundary` and `Suspense`; while `callPhone` is set and `phoneModelEnabled`,
      mount `PhoneModel3D` inside its own boundary and `Suspense` wrapping only the phone.
    - Call `onWebGLContextChange(true|false)` from the existing context lost and restored
      listeners through a ref to the latest prop.
    - _Requirements: 1.6, 1.7, 5.4, 7.9, 8.2, 8.7, 9.6, 9.8_
  - [x] 8.4 Write `PhoneScreenHost` unit tests
    - Create `apps/game/src/features/chapter1/call/PhoneScreenHost.test.tsx`: `pending` and
      `fallback` use `layout.screen`; `pending` has `opacity: 0`; `model` follows sink
      publications without re-rendering the child (render counter); switching modes keeps the
      same host and child DOM nodes.
    - _Requirements: 8.3, 8.6, 10.5, 10.7_
  - [x] 8.5 Commit the 3D phone
    - Run the test from 8.4, stage `PhoneScreenHost.tsx`, `PhoneScreenHost.test.tsx`,
      `PhoneModel3D.tsx` and `ChapterOneCanvas.tsx` by name, and commit
      `feat(game): render the call phone in the chapter canvas` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 9. Checkpoint - Ensure all tests pass
  - Run `pnpm test`, then `pnpm typecheck`, then `pnpm build`, one after the other (never in
    parallel). Fix failures in the files of this feature. Ensure all tests pass, ask the user if
    questions arise.

- [x] 10. Call presentation wiring in the chapter page
  - [x] 10.1 Add the generated call state helper
    - Create `apps/game/src/test/callStates.ts`: for a seed, pick one of the three Chapter 1
      calls and build its setup prefix (scam call; callback after a scam call with no Decision;
      official line from the decision-panel prefix in `playthroughs.test.ts` plus
      `VERIFY_CLAIM claim.caller-identity official-line`), then stop while ringing or answer and
      walk 0 to 6 random available options; also pick the locale (`en` or `vi`). Build states
      with `chapterReducer` through `runSequence` from `apps/game/src/test/chapterRuns.ts` and
      `apps/game/src/test/seededRandom.ts`.
    - _Requirements: 13.10, 13.11_
  - [x] 10.2 Implement `CallPresentation` and `useViewport`
    - Create `apps/game/src/features/chapter1/call/useViewport.ts` (window size with a `resize`
      listener).
    - Create `apps/game/src/features/chapter1/call/CallPresentation.tsx` with the design props
      (`store`, `scenario`, `paused`, `modelAllowed`, `screenSink`, `onAnswer`, `onEnd`,
      `onSelectOption`). Read `state.call` and `selectDialogueView(state, scenario)` through
      `useChapterState`; create no store and hold no dialogue state.
    - Build `CallScreenView` from `scenario.calls[call.current]`; use the dialogue view only when
      `view.callId === call.current`; speaker `caller` or `npc` gives the Caller_Line, any other
      speaker gives `narration` and `line: null`; no linked view gives `"connecting"`.
    - Mode: `pending` → `model` on the first non-null sink rectangle, `pending` → `fallback`
      after 200 ms, `model` → `fallback` on `null` or when `modelAllowed` turns false.
    - Render the `role="dialog"` `aria-modal="true"` root with
      `aria-label={t("phone.callPresentation.name")}`, the dimming layer when not in model mode,
      `PhoneScreenHost` with the single `PhoneScreenUI`, then `PlayerChoiceOverlay` only while
      active.
    - Single dispatch guard keyed on `${call.current}:${call.status}`; `paused` disables all
      controls; initial focus: Accept while ringing, first option while active with options,
      Hang up otherwise; no focus change while paused; no Escape handling.
    - _Requirements: 1.1, 1.2, 2.4, 2.6, 3.1, 3.2, 3.10, 4.5, 4.8, 5.1, 5.2, 5.3, 5.7, 6.6, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.6, 8.7, 11.1, 11.8, 12.7_
  - [x] 10.3 Add the locked `call` overlay kind
    - In `apps/game/src/features/chapter1/overlays.ts`, add `{ kind: "call" }` to `Overlay` and
      `"call"` to `ESCAPE_LOCKED`.
    - _Requirements: 7.5_
  - [x] 10.4 Wire the presentation into `ChapterOnePage`
    - In `apps/game/src/features/chapter1/ChapterOnePage.tsx`, replace the effect that opens the
      2D phone for a busy call with the design's effect (push `{ kind: "call" }` and record
      `callOpenedAtRef`; remove `"call"` wherever it is when the call ends; no `OPEN_PHONE`).
    - Remove `callSlot` and the `IncomingCallScreen` and `CallScreen` imports; render
      `CallPresentation` for the `"call"` overlay with `handleAnswerCall`, `handleEndCall` and
      `handleSelectOption`.
    - Wrap each overlay in `<div key={overlay.kind} className="contents" hidden={belowCall}>` so
      overlays below a `call` entry stay mounted but hidden.
    - Add page state `webglAvailable` (`checkBasicWebGLSupport()` once), `webglLost`,
      `phoneModelFailed` (initialized from `hasPhoneModelFailed()`), `phoneScreenSink`
      (`useState(createPhoneScreenSink)`); derive `modelAllowed` and `paused`; pass `callPhone`,
      `phoneModelEnabled`, `onPhoneModelError` (calls `reportPhoneModelFailure(CALL_PHONE_GLB, error)`
      and sets `phoneModelFailed`) and `onWebGLContextChange` to the canvas.
    - Do not add camera save or restore (owner decision).
    - _Requirements: 1.1, 1.7, 5.4, 6.1, 6.2, 6.8, 6.9, 6.10, 7.5, 7.6, 8.1, 8.2, 8.7, 8.8, 11.6, 11.7, 11.8_
  - [x] 10.5 Remove the 2D call slot
    - In `apps/game/src/features/chapter1/phone/PhoneOverlay.tsx`, remove the `callSlot` prop and
      its rendering; update `apps/game/src/features/chapter1/phone/PhoneOverlay.test.tsx`
      accordingly.
    - Delete `apps/game/src/features/chapter1/phone/IncomingCallScreen.tsx` and
      `apps/game/src/features/chapter1/phone/CallScreen.tsx` after confirming with a search that
      no file imports them.
    - Remove the unused `phone.overlay.callInProgress` key from both `chapter1/phone.ts` locale
      files.
    - _Requirements: 1.2, 11.6_
  - [x] 10.6 Rewrite the existing page tests for the new call behavior
    - In `apps/game/src/features/chapter1/ChapterOnePage.test.tsx` and
      `apps/game/src/features/chapter1/accessibility.test.tsx`, replace the expectations that the
      2D "Phone" dialog opens on a ring and stays open after the call with the new behavior: a
      "Phone call" dialog during the call, and after the call either an empty stack with
      `ResumePrompt` or the pre-call overlay on top.
    - In `apps/game/src/features/chapter1/ChapterOnePage.restore.test.tsx`, assert that a
      restored active call opens the call presentation after the title card.
    - Keep the assertion strength; do not touch the protected tests listed in Requirement 13.9.
    - Run `pnpm --filter @scammaze/game exec vitest run src/features/chapter1`.
    - _Requirements: 1.1, 6.8, 6.9, 7.6, 13.9_
  - [x] 10.7 Commit the wiring
    - Stage by name: `callStates.ts`, `useViewport.ts`, `CallPresentation.tsx`, `overlays.ts`,
      `ChapterOnePage.tsx`, `PhoneOverlay.tsx`, `PhoneOverlay.test.tsx`, both `chapter1/phone.ts`
      locale files, `ChapterOnePage.test.tsx`, `accessibility.test.tsx`,
      `ChapterOnePage.restore.test.tsx`, and the two deleted files (`git rm` or `git add` on the
      deleted paths).
    - Commit `feat(game): present phone calls on the 3D phone with a choice overlay` with the
      trailer.
    - _Requirements: 14.1, 14.2_

- [x] 11. Call presentation property, page and boundary tests
  - [x] 11.1 Write the equivalence property test
    - Create `apps/game/src/features/chapter1/call/callPresentation.equivalence.property.test.tsx`
      using `callStates.ts`; activation by click, Enter, Space and number key; model and fallback
      modes simulated through the sink.
    - **Property 1: Presentation does not change game state**
    - **Validates: Requirements 4.1, 4.6, 4.8, 11.8, 13.3, 13.10**
  - [x] 11.2 Write the phone screen content property test
    - Create `apps/game/src/features/chapter1/call/callPresentation.content.property.test.tsx`
      with one `it` block for this property.
    - **Property 2: The phone screen holds only phone-owned content**
    - **Validates: Requirements 1.2, 2.1, 2.2, 2.3, 2.4, 2.6, 12.6, 13.1, 13.2**
  - [x] 11.3 Write the choice overlay property test
    - Add a second `it` block to
      `apps/game/src/features/chapter1/call/callPresentation.content.property.test.tsx`.
    - **Property 3: The choice overlay mirrors the dialogue options**
    - **Validates: Requirements 3.1, 3.2, 3.6, 3.10, 7.10, 13.2**
  - [x] 11.4 Write the fallback parity property test
    - Create `apps/game/src/features/chapter1/call/callPresentation.parity.property.test.tsx`.
    - **Property 4: Fallback parity**
    - **Validates: Requirements 5.8, 8.4, 8.6**
  - [x] 11.5 Write the call button property test
    - Create `apps/game/src/features/chapter1/call/callButtons.property.test.tsx`.
    - **Property 9: Call buttons dispatch once and always end the call**
    - **Validates: Requirements 5.3, 5.7**
  - [x] 11.6 Write the chapter page call tests
    - Create `apps/game/src/features/chapter1/call/ChapterOnePage.call.test.tsx` with the canvas
      stub and hoisted `harness` pattern; define `window.WebGLRenderingContext` for model mode;
      call `resetPhoneModelStatusForTests()` in `afterEach`.
    - Cover: ring gives one "Phone call" dialog, focus on Accept, canvas `enabled=false`, pointer
      lock released; Accept keeps `enabled=false` (13.4a); Decline and Hang up remove the
      presentation, set `enabled=true`, show `ResumePrompt` and focus the game view (13.4b,
      13.4c); ring while the 2D phone is open restores the same stack and focus after Hang up;
      the official call from the decision panel returns to the decision panel; Escape, P and J do
      nothing during a call; Tab and Shift+Tab wrap in the order call buttons then options; no
      WebGL gives fallback with `callPhone` null; a model error gives fallback, exactly one
      warning with the asset path and no `alert` role; loading gives fallback after 200 ms with
      working controls; context loss gives fallback; a later call after a failure gives fallback
      with still one warning; a call ending under a pause turns `[call, pause]` into `[pause]`
      and resume gives an empty stack with `enabled=true`; `vi` ringing and active chrome text
      equals the `vi` dictionary values; a locale switch during a call keeps the state; P with no
      call shows the 2D phone apps and no presentation; talking to Sam shows `DialoguePanel` and
      no presentation; a stale option ID leaves the state unchanged.
    - _Requirements: 1.1, 4.9, 6.1, 6.2, 6.8, 6.9, 6.10, 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.2, 8.3, 8.5, 8.7, 8.8, 11.6, 11.7, 12.2, 12.3, 12.7, 13.4, 13.5, 13.7, 13.11_
  - [x] 11.7 Write the import-boundary test
    - Create `apps/game/src/features/chapter1/call/importBoundaries.test.ts`: walk the relative
      imports of `PhoneScreenUI.tsx`, `PlayerChoiceOverlay.tsx`, `PhoneScreenHost.tsx`,
      `CallPresentation.tsx`, `callLayout.ts` and `phoneMotion.ts` and fail on `three`,
      `@react-three/fiber` or `@react-three/drei`; check that `PhoneModel3D.tsx` imports no
      narrative store, selectors or `useChapterState`, uses no `Light`, `Environment` or
      `EffectComposer`, and never assigns `camera.position`, `camera.rotation` or
      `camera.quaternion`; check that no file under `apps/game/src/` contains
      `props/phone/iphone-17-pro.glb` or `props/phone/phone-17-pro-max.glb`; check that
      `ChapterOneCanvas.tsx` passes `aria-hidden` to `Canvas`.
    - Confirm that `apps/game/src/game/narrative/boundaries.test.ts` passes unchanged and that no
      file under `apps/game/src/game/narrative/` changed on this branch (`git diff --stat 0610f65 -- apps/game/src/game/narrative`).
    - _Requirements: 1.6, 7.9, 9.11, 11.2, 11.3, 11.4, 11.5, 11.9_
  - [x] 11.8 Commit the tests
    - Run the tests from 11.1 to 11.7, stage the six new test files by name, and commit
      `test(game): cover the 3D phone call presentation` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Run `pnpm test`, then `pnpm typecheck`, then `pnpm build`, one after the other. Record each
    exit status and the pass, fail and skip counts from `pnpm test` for task 13.2. Do not report a
    failing or skipped check as passing. Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 13.8, 13.9, 14.5_

- [x] 13. Documentation
  - [x] 13.1 Update the architecture overview
    - In `docs/architecture/OVERVIEW.md`, describe the Chapter 1 call UI as implemented: the
      locked `call` overlay entry, `CallPresentation` with the 3D phone in the existing canvas,
      the projected DOM screen, `PlayerChoiceOverlay`, the 2D fallback, the optional chapter
      asset, and that the other phone apps stay in the 2D `PhoneOverlay`. Keep the status labels
      correct.
    - _Requirements: 14.6_
  - [x] 13.2 Add the progress entry
    - At the top of "Task history" in `docs/PROJECT_PROGRESS.md`, add one entry with the nine
      mandatory items (date and title, objective, completed work, files created, modified or
      deleted, validation commands, build and test results from task 12 with real counts,
      unresolved issues and limitations, deviations, follow-up tasks).
    - Also include: the selected Phone_Model with source ("not provided"), author ("not stated")
      and license; how the screen is attached (DOM projected onto the screen anchor); how the
      choice overlay works; the reused Narrative_Core logic; the owner-accepted gap resolutions;
      the known limitations from the design (about 51 MB of unused candidates in `dist`, no
      tilt, camera settling, manual-only 30 fps and 4 px checks not yet measured, pending back
      render check).
    - Update "Project status", "Completed", "In progress" and "Planned". If any check failed or
      could not run, say so and do not describe the feature as completed or verified.
    - _Requirements: 13.8, 14.4, 14.5, 14.6_
  - [x] 13.3 Commit the docs and spec files
    - Stage `docs/architecture/OVERVIEW.md`, `docs/PROJECT_PROGRESS.md` and
      `.kiro/specs/game-3d-phone-call-ui/requirements.md`, `design.md`, `tasks.md` and
      `.config.kiro` by name; commit
      `docs(game): record the 3D phone call UI` with the trailer.
    - _Requirements: 14.1, 14.2_

- [x] 14. Push the branch
  - [x] 14.1 Push without force
    - Confirm `git branch --show-current` is `feat/game-3d-phone-call-ui` and `git status --short`
      shows no staged changes left over.
    - Run `git push -u origin feat/game-3d-phone-call-ui` with no `--force`,
      `--force-with-lease` or `+refspec`. Do not merge and do not push to `main` or
      `feat/game-i18n-en-vi`; the pull request depends on `feat/game-i18n-en-vi` and the merge is
      left to the owner.
    - _Requirements: 14.3_

## Notes

- All test sub-tasks are required by the owner; none is marked optional.
- Checkpoint 9 runs after wave 10 and before wave 11. Checkpoint 12 runs after wave 17 and before
  wave 18, so the progress entry records real results.
- Manual checks from the design (frame rate, 4 px alignment screenshots, back render for logos,
  camera settling) are not coding tasks. Task 13.2 records them as not measured unless the owner
  performed them.
- Requirement 6.7 (camera restore within 0.01) is resolved by the owner-accepted design: the call
  writes nothing to the camera, which task 11.7 checks.
- Each task references requirements for traceability; property sub-tasks reference their design
  property number.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "4.1", "5.1", "6.1", "6.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "3.1", "3.2", "4.2", "4.3", "5.2", "6.3"] },
    { "id": 3, "tasks": ["2.5", "3.3", "3.4", "3.5", "3.6", "4.4", "4.6", "4.7", "7.1", "7.2"] },
    { "id": 4, "tasks": ["2.6", "4.5", "7.3", "7.4", "8.1", "8.2"] },
    { "id": 5, "tasks": ["3.7", "8.3", "8.4"] },
    { "id": 6, "tasks": ["4.8"] },
    { "id": 7, "tasks": ["5.3"] },
    { "id": 8, "tasks": ["6.4"] },
    { "id": 9, "tasks": ["7.5"] },
    { "id": 10, "tasks": ["8.5"] },
    { "id": 11, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 12, "tasks": ["10.4"] },
    { "id": 13, "tasks": ["10.5", "10.6"] },
    { "id": 14, "tasks": ["10.7"] },
    { "id": 15, "tasks": ["11.1", "11.2", "11.4", "11.5", "11.6", "11.7"] },
    { "id": 16, "tasks": ["11.3"] },
    { "id": 17, "tasks": ["11.8"] },
    { "id": 18, "tasks": ["13.1", "13.2"] },
    { "id": 19, "tasks": ["13.3"] },
    { "id": 20, "tasks": ["14.1"] }
  ]
}
```

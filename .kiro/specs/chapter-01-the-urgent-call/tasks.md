# Implementation Plan: Chapter 1 "The Urgent Call"

## Overview

The plan follows the brief's dependency order. Pure work comes first: scenario data, the
deterministic chapter core, then saves. The rendering layer follows: controls, world, page, phone,
journal, decisions, debrief, save UI and polish. The last steps enable the chapter in the registry
and App shell, and update the docs. All code is TypeScript in `apps/game`. The repository audit is
recorded in `design.md` (Overview → Repository audit), so it needs no task.

Rules for every task:

- Work on branch `feat/chapter-01-playable`. Do not push; the orchestrator pushes at the end.
- Test sub-tasks are required, not optional. The brief makes tests part of the deliverable.
- Property tests use the seeded LCG helpers from `src/test/seededRandom.ts`, with at least 100
  cases each. Each property test is a single `it(...)` with the comment
  `// Feature: chapter-01-the-urgent-call, Property N: <title>`. Do not add new dependencies.
- `apps/game/src/game/narrative/**` must not import React, Three.js, R3F, Drei, Rapier, Zustand or
  Dexie.
- All repository content is in English. No emoji. Use only `Northgate Bank` and other fictional
  names, only domains ending in `.test`, `.example` or `.invalid`, and only phone numbers that
  start with `+000`. Never call anything "safe". Use no currency in user-facing text.
- Commit sub-tasks use Conventional Commits, stage named files only, and end the message with
  `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`.
- After each code task, run the relevant `pnpm --filter @scammaze/game test -- <path>` and report
  the result as observed.

## Tasks

- [x] 1. Foundations
  - [x] 1.1 Extract the seeded random helpers into a dependency-free module
    - Create `apps/game/src/test/seededRandom.ts` with `createLcg`, `randomInt` and `pick`, moved
      from `src/test/loadingRuns.ts`
    - In `loadingRuns.ts`, re-export them from `seededRandom.ts` so existing loading tests stay
      unchanged
    - Run the existing loading tests to confirm nothing broke
    - _Requirements: 18.3_
  - [x] 1.2 Add shared street play-area constants
    - Create `apps/game/src/game/scenes/MainMenuScene/streetPlayArea.ts` exporting
      `STREET_PLAY_SPAWN = [188.6, -92.70, -88.89]`, `STREET_PLAY_SPAWN_YAW = Math.PI`,
      `STREET_PLAY_BOUNDS = { minX: 180, maxX: 198.5, minZ: -92, maxZ: 52, groundY: -92.70 }`
      and `clampToPlayArea(position)`
    - Do not modify `features/testmove/**`
    - _Requirements: 2.2, 2.3, 15.3_
  - [x] 1.3 Define core types and IDs
    - Create `apps/game/src/game/narrative/chapter1/ids.ts` with the string-literal ID unions
      (objectives, interactables, evidence, claims, calls, NPCs, dialogue graphs, flags,
      decisions, outcomes, warning signs)
    - Create `apps/game/src/game/narrative/types.ts` with `CoreAction`, `RingReason`,
      `ActionResult`, `ChapterState`, `CallRecord`, `ConversationState`, `EventLogEntry`,
      `ScenarioDefinition`, `EvidenceItem`, `Claim`, `Objective`, `InteractableDef`,
      `DialogueGraph`, `DialogueNode`, `DialogueOption`, `Condition`, `Effect`,
      `DiscoveryCondition`, `DecisionDef`, `EndingDef` and `DebriefContent`, as in design Data
      Models
    - _Requirements: 5.1, 9.1, 11.2_

- [x] 2. Canonical narrative data (step 01)
  - [x] 2.1 Author claims, evidence, interactables and objectives
    - Create `chapter1/claims.ts`, `chapter1/evidence.ts` (the eleven items from the design table,
      with relations, warning signs, relevance and `debriefHint`), `chapter1/interactables.ts`
      (five objects with label, action label, inspection text, produced action and evidence) and
      `chapter1/objectives.ts` (five objectives, text only; predicates come in 3.3)
    - Include the journal note for the number mismatch: "The numbers are different. That is a
      warning sign, but caller ID can be faked, so a matching number would not prove anything
      either."
    - _Requirements: 3.7, 11.1, 11.2, 11.10, 12.1, 16.1, 16.2, 16.3_
  - [x] 2.2 Author the four dialogue graphs
    - Create `chapter1/dialogues/scamCall.ts`, `callback.ts`, `shopkeeper.ts` and
      `officialLine.ts` with persona, `lines` maps (approved line IDs), nodes, options, conditions,
      effects, pressure markers, end nodes and debrief tags, following the design flowchart
    - Mark only `officialLine` with `independentChannel: true`
    - Write no codes, account details or step-by-step payment instructions
    - _Requirements: 9.1, 9.10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9, 12.4_
  - [x] 2.3 Author phone content, decisions, endings and debrief, and assemble the scenario
    - Create `chapter1/phone.ts` (the urgent text with `northgate-secure-verify.invalid`, the
      one-time-code text "Never share this code with anyone, including bank staff.", bank app
      screens, contacts `+000 555 0142` and `+000 555 0100`, official website `northgate.example`)
    - Create `chapter1/decisions.ts`, `chapter1/endings.ts` (four consequence variants, simulation
      label) and `chapter1/debrief.ts` (mechanism, safer alternatives, per-outcome summaries,
      decision notes per tag; the `uncertain` text says it is a partial result, not a failure)
    - Create `chapter1/scenario.ts` exporting `CHAPTER_1_SCENARIO`
    - _Requirements: 7.2, 13.2, 13.3, 13.11, 13.12, 14.3, 14.6, 16.4, 16.5, 16.7_
  - [x] 2.4 Implement the scenario validator
    - Create `apps/game/src/game/narrative/validateScenario.ts` returning error strings for:
      dangling node or start references, nodes with no reachable end, unknown line IDs, unknown
      evidence, claim or object references, `setClaimStatus` outside independent-channel graphs,
      debrief tags without text, and duplicate IDs
    - _Requirements: 9.8, 9.9, 9.10, 12.6_
  - [x] 2.5 Write validator and content-lint tests
    - `narrative/validateScenario.test.ts`: real scenario returns `[]`; broken fixtures return
      the expected errors
    - `narrative/chapter1/content.test.ts`: walk every string in `CHAPTER_1_SCENARIO`; domains
      are reserved addresses; phone numbers match `^\+000 `; no currency symbols or ISO currency
      codes; no whole word "safe"; no blaming phrases; no emoji code points; at least four
      evidence items with both physical and device sources; the scam graph has at least three
      paths to end nodes
    - _Requirements: 9.8, 9.9, 10.1, 11.1, 14.6, 16.1, 16.2, 16.3, 16.4, 16.5, 18.1_

- [x] 3. Deterministic game core (steps 04, 06, 07, 08, pure parts)
  - [x] 3.1 Implement conditions, effects and the evidence registry
    - Create `narrative/conditions.ts` (`evaluateCondition`, `applyEffect`) and
      `narrative/evidence.ts` (`canDiscover`, `discover` as an idempotent append,
      `evidenceForClaim`)
    - _Requirements: 11.3, 11.4, 11.5, 12.6_
  - [x] 3.2 Implement the dialogue engine
    - Create `narrative/dialogueEngine.ts` with `startConversation` (honors `startNodeWhen`),
      `availableOptions` (adds `__fallback.end` when no authored option is available) and
      `selectOption` (effects in order, `onEnter`, pressure cap, history append, end handling)
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.3, 10.6, 10.7_
  - [x] 3.3 Implement the objective manager
    - Create `narrative/objectives.ts` with the activation and completion predicates from the
      design table, and `runObjectiveManager(prev, next, action)` returning the changed
      objectives
    - Phone and journal actions never satisfy a predicate
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  - [x] 3.4 Implement the outcome function
    - Create `narrative/outcome.ts` with `selectOutcome` exactly as in the design, plus
      `selectConsequenceVariant`
    - _Requirements: 13.7, 13.9, 13.10_
  - [x] 3.5 Implement the reducer
    - Create `narrative/reducer.ts` with `isCoreAction`, `createInitialState` and
      `chapterReducer`. The pipeline is: shape check, outcome lock, guards from the design table,
      apply, objective manager, outcome, then the Event_Log append
    - Handle the RING_CALL rules (unlimited re-ring for `call.scam-1`, callback at most once),
      END_CALL as decline or hang up, the VERIFY_CLAIM methods and MAKE_DECISION
      `follow-request` setting `money_moved`
    - Never mutate the input state; return the same object when rejecting
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.9, 8.6, 8.8, 10.4, 10.5, 10.8, 12.2, 12.3, 12.4, 12.5, 13.4, 13.5, 13.6, 13.8_
  - [x] 3.6 Implement selectors and the debrief builder
    - Create `narrative/selectors.ts`: `selectActiveObjectives`, `selectDialogueView`,
      `selectJournalEntries` (stance text, "Points against this claim" for `contradicts`),
      `selectClaimStatuses`, `selectDecisionPanel` (availability and hints), `selectCallLog`,
      `selectPhoneMessages`, `enumerateCandidateActions(state)`
    - Create `narrative/debrief.ts` with `buildDebrief(state, scenario)`
    - _Requirements: 11.7, 11.8, 11.9, 13.1, 13.2, 13.3, 14.3, 14.4, 14.5_
  - [x] 3.7 Implement the chapter store
    - Create `narrative/store.ts` with `createChapterStore(initial, scenario)` exposing
      `getState`, `dispatch` (notifies only when accepted), `subscribe` and `replace`
    - _Requirements: 5.8_
  - [x] 3.8 Write unit tests for the core
    - `narrative/reducer.test.ts`: transitions per action and every rejection reason in the
      requirements
    - `narrative/objectives.test.ts`: the objective order, and phone neutrality
    - `narrative/evidence.test.ts`: every discovery route; duplicate and unavailable rejection
    - `narrative/dialogueEngine.test.ts`: Sam's start node before and after the call; the
      challenge option gated by the card; one-time-code delivery; pressure cap; fallback
    - `narrative/outcome.test.ts`: the four consequence variants; decision gating
    - _Requirements: 5.3, 5.4, 6.1–6.8, 8.6, 8.8, 9.2–9.7, 10.2–10.8, 11.3–11.5, 12.2–12.5, 13.4–13.10, 18.1_
  - [x] 3.9 Write the core test harness
    - Create `apps/game/src/test/chapterRuns.ts` with `generateActionSequence(seed, length)`
      (70% candidate actions, 20% invalid well-formed, 10% malformed), `runSequence`,
      `assertInvariants(state)` (the design invariant list), `completeChapterFrom(state)` (the
      guided policy), `shrinkFailingPrefix`, and the constants `CORE_PROPERTY_SEED` and
      `CORE_PROPERTY_RUNS = 200`
    - _Requirements: 18.3, 18.4_
  - [x] 3.10 Write the property test for dispatch results
    - File `narrative/properties/dispatch.property.test.ts`
    - **Property 1: Every dispatch returns a result, and rejections change nothing**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.6, 6.8, 8.6, 8.8, 9.6, 11.4, 11.5, 12.3, 13.4**
  - [x] 3.11 Write the property test for state invariants
    - File `narrative/properties/invariants.property.test.ts`
    - **Property 2: Reachable states satisfy the state invariants**
    - **Validates: Requirements 5.1, 9.7, 10.6, 11.3, 12.6, 13.7, 18.3**
  - [x] 3.12 Write the property test for determinism
    - File `narrative/properties/determinism.property.test.ts`
    - **Property 3: The core is deterministic**
    - **Validates: Requirements 5.5, 18.5**
  - [x] 3.13 Write the property test for no soft-lock
    - File `narrative/properties/noSoftLock.property.test.ts`
    - **Property 4: No soft-lock**
    - **Validates: Requirements 8.1, 8.2, 8.4, 9.4, 18.4**
  - [x] 3.14 Write the property test for the terminal state
    - File `narrative/properties/terminal.property.test.ts`
    - **Property 5: After the Outcome only FINISH_CHAPTER is accepted**
    - **Validates: Requirements 5.9, 13.5**
  - [x] 3.15 Write the property test for the outcome function
    - File `narrative/properties/outcome.property.test.ts`
    - **Property 6: Outcome function matches the outcome table**
    - **Validates: Requirements 13.6, 13.7, 13.9, 13.10**
  - [x] 3.16 Write the property test for phone neutrality
    - File `narrative/properties/phoneNeutral.property.test.ts`
    - **Property 7: Opening and closing the phone never changes objectives**
    - **Validates: Requirements 6.9**
  - [x] 3.17 Write the property test for dialogue options
    - File `narrative/properties/dialogueOptions.property.test.ts`
    - **Property 8: Dialogue options respect conditions and never dead-end**
    - **Validates: Requirements 9.3, 9.4**
  - [x] 3.18 Write the property test for the journal
    - File `narrative/properties/journal.property.test.ts`
    - **Property 10: The journal shows exactly the discovered evidence in order**
    - **Validates: Requirements 11.7, 11.8**
  - [x] 3.19 Write the property test for the debrief
    - File `narrative/properties/debrief.property.test.ts`
    - **Property 11: The debrief is derived only from data and the Event_Log**
    - **Validates: Requirements 14.4, 14.5**
  - [x] 3.20 Write the property test for store notifications
    - File `narrative/properties/store.property.test.ts`
    - **Property 14: The store notifies exactly on accepted actions**
    - **Validates: Requirements 5.8**
  - [x] 3.21 Write the scripted end-to-end playthroughs
    - File `narrative/chapter1/playthroughs.test.ts` with four scripted runs from the design:
      `verified` (contradiction chain and official line), `risky` with money moved in the call,
      `risky` with the code shared and then the official line, and `uncertain` (decline, re-ring,
      hang up, stop-and-wait)
    - Assert the objective order, the claim statuses, the outcome, the consequence variant and the
      debrief sections
    - _Requirements: 10.1, 11.10, 13.7, 13.9, 13.10, 14.3, 18.2_
  - [x] 3.22 Write the module boundary test
    - File `narrative/boundaries.test.ts`: read every `.ts` file under `game/narrative/` with
      `node:fs`, and fail on imports of `react`, `three`, `@react-three/`, `@dimforge/rapier`,
      `zustand` or `dexie`
    - _Requirements: 5.7_
  - [x] 3.23 Commit the narrative data and core
    - Stage `apps/game/src/test/seededRandom.ts`, `apps/game/src/test/loadingRuns.ts`,
      `apps/game/src/test/chapterRuns.ts` and `apps/game/src/game/narrative/**`
    - Message: `feat(game): add deterministic Chapter 1 narrative core and scenario data`
    - _Requirements: 18.1_

- [x] 4. Checkpoint: core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Save format version 2 (step 10, pure parts)
  - [x] 5.1 Extend the save module with version 2, migration, write and clear
    - In `apps/game/src/game/saves/saveGame.ts`, add `SAVE_STORAGE_KEY_V2`,
      `SAVE_FORMAT_VERSION_V2`, `SavedGameV2`, `parseSaveEnvelopeV2` and
      `SaveGameSource.write?` / `clear?`
    - `read()` order: the v2 key; if it is absent, migrate v1 to a start Checkpoint, write it and
      remove the v1 key (if the write fails, keep v1 and return the migrated value)
    - Reject unknown versions. Treat blocked storage as no save, and make `write` return `false`
      when storage fails
    - Keep `SavedGame` fields so `chapterLoader` keeps working
    - _Requirements: 15.3, 15.4, 15.9, 15.10, 15.14_
  - [x] 5.2 Implement checkpoint encode and replay restore
    - Create `apps/game/src/game/saves/chapterProgress.ts` with
      `encodeProgress(state, pose, checkpointId)` (accepted actions from the Event_Log, capped at
      1000) and `restoreProgress(progress, scenario)` (replay through `chapterReducer`, reject on
      any rejection, check that the pose is finite, clamp it with `clampToPlayArea`)
    - _Requirements: 15.3, 15.5, 15.6, 15.7_
  - [x] 5.3 Pass progress through the session and loader
    - In `game/chapters/chapterSession.ts`, add an optional `progress` to `ChapterSession`, and
      copy it in `restoreChapterSession`
    - In `game/loading/chapterLoader.ts`, run `restoreProgress` in the continue path, and fail
      with `invalid-save` when it is not ok
    - _Requirements: 15.6, 15.12_
  - [x] 5.4 Write unit tests for saves
    - Extend `saves/saveGame.test.ts` (v2 valid, unknown version, v1 migration, write failure,
      clear) and add `saves/chapterProgress.test.ts` (non-finite pose, out-of-bounds pose
      clamped, cap) and loader continue-path cases in `loading/chapterLoader.test.ts`
    - _Requirements: 15.3, 15.6, 15.7, 15.9, 15.10, 15.14, 18.1_
  - [x] 5.5 Write the property test for the save round trip
    - File `saves/chapterProgress.property.test.ts`
    - **Property 12: Save round trip**
    - **Validates: Requirements 15.3, 15.5, 15.8**
  - [x] 5.6 Write the property test for tampered saves
    - File `saves/chapterProgress.tamper.property.test.ts`
    - **Property 13: Tampered saves are rejected**
    - **Validates: Requirements 15.6**
  - [x] 5.7 Commit the save version 2 work
    - Stage `apps/game/src/game/saves/**`, `apps/game/src/game/chapters/chapterSession.ts` and
      `apps/game/src/game/loading/chapterLoader.ts` and their tests
    - Message: `feat(game): add versioned chapter progress saves with replay validation`

- [x] 6. Player input pause support (steps 02 and 03 prerequisite)
  - [x] 6.1 Add an `enabled` option to the player controls and player
    - In `features/player/usePlayerControls.ts`, add an optional `{ enabled?: boolean }` (default
      `true`). When it is `false`: clear keys and triggers once, exit pointer lock, ignore
      gameplay keys, mouse move and mouse down, skip the lock on mousedown, and ignore Ctrl
    - In `FirstPersonPlayer.tsx` and `types.ts`, add an optional `enabled` prop that skips
      movement and look updates while it is `false`. Existing callers keep their behavior
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 6.2 Write tests for the controls hook
    - File `features/player/usePlayerControls.test.ts`: when disabled, keydown sets no keys,
      mousedown requests no lock, and disabling clears held keys; when enabled, behavior is
      unchanged
    - _Requirements: 4.2, 4.3, 18.1_

- [x] 7. Chapter scene canvas and interactions (steps 02 and 03)
  - [x] 7.1 Implement focus detection
    - Create `features/chapter1/interaction/findFocusedInteractable.ts`, a pure ray–sphere test
      with `MAX_INTERACT_DISTANCE = 3.0` and no three import
    - _Requirements: 3.1, 3.2_
  - [x] 7.2 Write the property test for focus detection
    - File `features/chapter1/interaction/findFocusedInteractable.property.test.ts`, 500 cases
      against a brute-force reference
    - **Property 9: Focus selection matches a brute-force reference**
    - **Validates: Requirements 3.1, 3.2**
  - [x] 7.3 Add procedural props, the layout and the interaction probe
    - Create `features/chapter1/world/propLayout.ts` (the five positions from the design, radius
      0.6, each inside `STREET_PLAY_BOUNDS`), `world/InteractableProps.tsx` (simple meshes, with a
      Lavender emissive highlight when focused) and `world/InteractionProbe.tsx` (`useFrame`
      calls `findFocusedInteractable` and reports changes only)
    - Calibrate the positions visually against the street geometry with `pnpm dev:game`, and
      record the final values in `propLayout.ts`
    - _Requirements: 2.5, 3.1_
  - [x] 7.4 Create the chapter canvas
    - Create `features/chapter1/ChapterOneCanvas.tsx` with SkyDome, EnvironmentLighting,
      StreetEnvironment (`onReady` → prop `onSceneReady`), FirstPersonPlayer (`enabled`, spawn
      from props or `STREET_PLAY_SPAWN`, `STREET_PLAY_BOUNDS`, `onInteract`), InteractableProps
      and InteractionProbe
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 7.5 Map interactables to core actions
    - Create `features/chapter1/interaction/interactionToAction.ts`, which maps an
      `InteractableId` to `INTERACT_OBJECT` or `TALK_TO_NPC` from scenario data
    - Add `interactionToAction.test.ts` for all five objects, the null focus case and a layout
      bounds check
    - _Requirements: 2.5, 3.4, 3.5, 3.7_
  - [x] 7.6 Commit the controls and world work
    - Stage `apps/game/src/features/player/**` changes,
      `apps/game/src/game/scenes/MainMenuScene/streetPlayArea.ts` and
      `apps/game/src/features/chapter1/{interaction,world}/**` and `ChapterOneCanvas.tsx`
    - Message: `feat(game): add Chapter 1 street canvas, props and look-at interaction`

- [x] 8. Chapter page shell and HUD (steps 03 and 04, UI)
  - [x] 8.1 Add the theme, the overlay stack and the state hook
    - Create `features/chapter1/theme.ts` (the brand tokens), `overlays.ts` (the stack type with
      `push`, `pop`, `top`, `isOpen`) and `useChapterState.ts` (`useSyncExternalStore` binding)
    - _Requirements: 4.6, 7.9_
  - [x] 8.2 Build the title card, the HUD components and the inspection panel
    - Create `intro/ChapterTitleCard.tsx` (number, title, subtitle, "Preparing the street" while
      not ready, Begin or Continue), `hud/ObjectiveToast.tsx`, `hud/ObjectiveTracker.tsx` (a
      polite `aria-live` region), `hud/InteractionPrompt.tsx` ("Press E to … …"),
      `hud/ResumePrompt.tsx` ("Click to resume"), `hud/EvidenceNotice.tsx`, `hud/HudButtons.tsx`
      (Phone and Journal buttons with `lucide-react` icons and visible text) and
      `panels/InspectionPanel.tsx`
    - _Requirements: 1.4, 1.5, 3.3, 3.6, 4.4, 4.10, 6.10, 11.6_
  - [x] 8.3 Implement the call triggers
    - Create `features/chapter1/useCallTriggers.ts`. The exploration clock counts only while the
      chapter is playing with no overlay open and the tab visible. It rings 3 s after the first
      interaction, falls back at 60 s, re-rings 20 s after a decline, and rings the callback once
      90 s after the first call ends with no decision
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  - [x] 8.4 Create the chapter page
    - Create `features/chapter1/ChapterOnePage.tsx`: create the store (fresh, or restored state
      from `session.progress`), the overlay stack and `inputEnabled`. Show the title card until
      Begin dispatches START_CHAPTER. Connect `onInteract` → focused ID → `interactionToAction`
      → dispatch
    - Keys: Escape closes the top overlay or opens pause, P toggles the phone, J toggles the
      journal. Show "Click to resume" after an overlay closes, and lock the pointer on click.
      Render the HUD. Add an `onReturnToMenu` prop
    - Punches never dispatch to the store
    - _Requirements: 1.4, 1.5, 1.6, 2.6, 3.4, 3.5, 3.6, 4.1, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  - [x] 8.5 Write tests for the call triggers
    - File `features/chapter1/useCallTriggers.test.ts` with fake timers: ring after the first
      interaction, the 60 s fallback, re-ring after a decline, the callback after 90 s, at most
      one callback, and timers paused while an overlay is open
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 18.6_
  - [x] 8.6 Write integration tests for the page
    - File `features/chapter1/ChapterOnePage.test.tsx`, with `ChapterOneCanvas` mocked by a stub
      that exposes `onSceneReady`, `onInteract` and the focus callback
    - Cover: Begin disabled until ready; Begin dispatches START_CHAPTER; one interact with focus
      gives exactly one INTERACT_OBJECT; no focus gives no dispatch; the inspection panel opens;
      the overlay disables input; Escape, P and J behavior; the resume prompt
    - _Requirements: 1.5, 1.6, 3.4, 3.5, 3.6, 4.1, 4.4, 4.6, 4.7, 4.8, 4.9, 18.6_

- [x] 9. Virtual smartphone and dialogue UI (steps 05 and 06, UI)
  - [x] 9.1 Build the phone frame and apps
    - Create `features/chapter1/phone/PhoneOverlay.tsx` (a responsive frame: full width below
      640 px, at most 380 px at 640 px and wider; an app router), `phone/PhoneHome.tsx`,
      `phone/MessagesApp.tsx`, `phone/CallHistoryApp.tsx` and `phone/BankApp.tsx`
    - Opening an evidence item dispatches INSPECT_EVIDENCE; opening the bank app dispatches
      VERIFY_CLAIM `bank-app`
    - Render domains and numbers as plain text, never as `<a>`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_
  - [x] 9.2 Build the call screens and the shared dialogue panel
    - Create `phone/IncomingCallScreen.tsx` (caller name, `+000 555 0142`, Accept, Decline, the
      "Incoming call" caption, a vibration animation that is off under reduced motion),
      `phone/CallScreen.tsx` (the dialogue and Hang up) and `dialogue/DialoguePanel.tsx` (line and
      options from `selectDialogueView`, used by phone calls and by Sam face to face)
    - _Requirements: 8.3, 8.7, 9.3, 9.4, 9.5_
  - [x] 9.3 Wire the phone and dialogue into the page
    - In `ChapterOnePage.tsx`: OPEN_PHONE and CLOSE_PHONE with the overlay stack; a ringing call
      pushes the phone; ANSWER_CALL, END_CALL and SELECT_DIALOGUE_OPTION handlers; TALK_TO_NPC
      opens the face-to-face dialogue overlay; the phone cannot close while a call is ringing or
      active
    - _Requirements: 4.8, 7.1, 8.3, 10.7, 10.8_
  - [x] 9.4 Write phone and dialogue tests
    - File `features/chapter1/phone/PhoneOverlay.test.tsx`: the unread message at start; opening
      the message dispatches INSPECT_EVIDENCE; the page contains no anchor elements; keyboard
      navigation; Accept shows the options, and selecting one advances the node (phone →
      dialogue)
    - _Requirements: 7.2, 7.3, 7.4, 7.6, 8.3, 9.5, 18.6_

- [x] 10. Evidence journal and decisions (steps 07 and 08, UI)
  - [x] 10.1 Build the evidence journal
    - Create `features/chapter1/journal/EvidenceJournal.tsx`: discovered entries in order, with
      title, description, source, location and stance text per claim; a claim list with status
      text; a "Decide" button when the decision panel is available
    - _Requirements: 11.7, 11.8, 11.9, 13.1, 17.6_
  - [x] 10.2 Build the decision panel
    - Create `features/chapter1/decision/DecisionPanel.tsx` with the three options from
      `selectDecisionPanel`, the unavailable state with its hint, and the two-step official
      route: VERIFY_CLAIM, then MAKE_DECISION `verify-independently` after confirmation
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  - [x] 10.3 Wire the journal and decisions into the page
    - In `ChapterOnePage.tsx`: the journal overlay, the decision overlay opened from the journal
      and the phone, and the evidence notice when `discovered` grows
    - _Requirements: 4.9, 11.6, 13.1_
  - [x] 10.4 Write evidence-to-decision tests
    - File `features/chapter1/decision/DecisionPanel.test.tsx`: the official option is
      unavailable with its hint until the card or letter is found; it is enabled after
      discovery; the journal shows only discovered items and the "Points against this claim"
      text
    - _Requirements: 11.7, 11.9, 13.3, 18.6_

- [x] 11. Endings and debrief (step 09)
  - [x] 11.1 Build the ending transition and the debrief screen
    - Create `features/chapter1/ending/EndingTransition.tsx` (outcome title, consequence variant,
      "Simulation: nothing real happened.", Continue) and `debrief/DebriefScreen.tsx` (all
      `DebriefView` sections, Replay, Return to menu)
    - _Requirements: 13.11, 14.1, 14.3_
  - [x] 11.2 Wire the endings and debrief into the page
    - In `ChapterOnePage.tsx`: when an outcome is set, show the ending transition; Continue
      dispatches FINISH_CHAPTER and shows the debrief; Return to menu calls `onReturnToMenu`;
      Replay is connected in 12.2
    - _Requirements: 1.7, 14.1, 14.2_
  - [x] 11.3 Write consequence-to-debrief tests
    - File `features/chapter1/debrief/DebriefScreen.test.tsx`: a risky run shows the simulation
      label and the right variant; the debrief lists evidence found, warning signs and clues
      missed for a scripted state; an uncertain run shows the partial-result wording
    - _Requirements: 13.11, 14.1, 14.3, 14.5, 18.6_
  - [x] 11.4 Commit the chapter UI
    - Stage `apps/game/src/features/chapter1/**` (page, HUD, intro, panels, phone, dialogue,
      journal, decision, ending, debrief, theme, overlays, hooks, tests)
    - Message: `feat(game): add Chapter 1 page, smartphone, dialogue, journal and debrief`

- [x] 12. Save, continue and replay (step 10, UI)
  - [x] 12.1 Implement the checkpoint saver
    - Create `features/chapter1/useCheckpointSaver.ts`. Write when objectives change and no call
      is ringing or active. If a change happens during a call, write when the call ends. Also
      write after FINISH_CHAPTER (`debrief`). Report a write failure through a callback
    - _Requirements: 15.1, 15.2, 15.14_
  - [x] 12.2 Connect restore, restart, replay and the pause menu
    - Create `features/chapter1/pause/PauseMenu.tsx` (Resume, Restart chapter with confirm, Save
      and return to menu)
    - In `ChapterOnePage.tsx`: restore the state and pose from `session.progress` and skip the
      intro text; Restart and Replay call `clear()` and `store.replace(createInitialState())`;
      show the notice "Progress cannot be saved on this device." on write failure
    - _Requirements: 15.12, 15.13, 15.14_
  - [x] 12.3 Update Continue availability in the App shell
    - In `app/App.tsx`, `readContinueAvailability` validates v2 progress with `restoreProgress`.
      Reasons: "No saved game found." and "Your saved game could not be read. Start a new game
      instead."
    - _Requirements: 15.6, 15.11_
  - [x] 12.4 Write save-to-restore integration tests
    - File `features/chapter1/useCheckpointSaver.test.tsx` (writes on an objective change, a
      deferred write during a call, a storage failure notice) and
      `features/chapter1/ChapterOnePage.restore.test.tsx` (mount with progress restores the
      objectives and evidence; Restart clears the save)
    - _Requirements: 15.1, 15.2, 15.12, 15.13, 15.14, 18.6_

- [x] 13. Checkpoint: full chapter loop works through the UI tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Visual polish and accessibility (step 11)
  - [x] 14.1 Apply reduced motion, focus management and accessible names
    - Across `features/chapter1/**` and `ChapterOnePage.tsx`: use `usePrefersReducedMotion` to
      remove slide, shake and fade; move focus into an overlay when it opens and return it when
      it closes; give icon-only buttons an `aria-label`; set `aria-hidden` on decorative icons;
      use text labels for stance, call status and outcome; apply restrained styling with the
      brand tokens
    - _Requirements: 16.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
  - [x] 14.2 Fade menu music during the chapter
    - In `app/App.tsx`, the music gain target is 0 while `screen.kind === "chapter"`, and the
      street ambient is kept. Menu-screen behavior is unchanged
    - _Requirements: 17.7, 17.8_
  - [x] 14.3 Update the prologue status callout
    - In `features/menu/IntroPrologueModal.tsx`, replace "Scheduled for Milestone… / In
      Progress" with an honest playable status ("Playable · about 8 to 15 minutes"), and keep the
      existing story text
    - _Requirements: 1.1, 19.3_
  - [x] 14.4 Write accessibility and icon tests
    - File `features/chapter1/accessibility.test.tsx`: reduced motion removes the animation
      classes (`mockReducedMotion`); focus moves into the phone and back; icon-only buttons have
      names; a source scan finds no emoji code points under `features/chapter1/`
    - _Requirements: 16.6, 17.1, 17.2, 17.3, 17.4, 18.1_
  - [x] 14.5 Commit the save UI and polish
    - Stage `apps/game/src/features/chapter1/**` changes, `apps/game/src/app/App.tsx` and
      `apps/game/src/features/menu/IntroPrologueModal.tsx`
    - Message: `feat(game): add Chapter 1 checkpoints, continue, restart and accessibility polish`

- [x] 15. Enable Chapter 1 gameplay
  - [x] 15.1 Set `gameplayAvailable` and render the chapter page
    - In `game/chapters/chapterRegistry.ts`, set `gameplayAvailable: true` for `chapter-1`
    - In `app/App.tsx`, render `ChapterOnePage` when the session's chapter has
      `gameplayAvailable`, and keep `ChapterPlaceholder` otherwise. Return to menu refreshes
      Continue. Keep the menu canvas mounted and paused (the documented decision)
    - _Requirements: 1.1, 1.2, 1.3, 1.7_
  - [x] 15.2 Write the routing tests
    - Update `game/chapters/chapterRegistry.test.ts` for the flag. Add `app/App.chapter.test.tsx`
      with the loader, canvas and page mocked: a playable chapter renders the page; a test
      chapter with the flag `false` renders the placeholder; Return to menu shows the menu
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 18.6_
  - [x] 15.3 Commit the enablement
    - Stage `apps/game/src/game/chapters/**` and `apps/game/src/app/**`
    - Message: `feat(game): make Chapter 1 "The Urgent Call" playable from New Game`

- [x] 16. Full test run and documentation (step 12)
  - [x] 16.1 Write the chapter narrative document
    - Create `docs/gameplay/CHAPTER_01_THE_URGENT_CALL.md` with the story, interactables and
      positions, evidence table, claims, contradiction chains, dialogue graph summaries,
      decisions, outcomes and debrief content, the content-safety notes and status labels
    - _Requirements: 19.4_
  - [x] 16.2 Update the architecture overview
    - In `docs/architecture/OVERVIEW.md`, describe the chapter core, the store, save v2 (replay
      validation, v1 migration), the chapter page and canvas and the controls `enabled` flag, with
      `IMPLEMENTED` and `PLANNED` labels. Note the open follow-up to measure the cost of the second
      WebGL context
    - _Requirements: 19.3_
  - [x] 16.3 Add the progress entry
    - In `docs/PROJECT_PROGRESS.md`, add the newest task-history entry with the nine AGENTS.md §6
      items. Record the deviation (Chapter 1 is "The Urgent Call", not "The Missing Parcel" from
      positioning section 11, which becomes a later chapter), the `verified` naming, the
      unmeasured play time and FPS, and the manual checks still needed. Update the status
      sections
    - _Requirements: 19.1, 19.2_
  - [x] 16.4 Run the quality gates and record the results
    - Run `pnpm test`, `pnpm typecheck` and `pnpm build` from the repository root. Fix any
      failures. Write the exact observed results, such as test and file counts, into the progress
      entry
    - _Requirements: 18.7_
  - [x] 16.5 Commit the documentation
    - Stage `docs/gameplay/CHAPTER_01_THE_URGENT_CALL.md`, `docs/architecture/OVERVIEW.md` and
      `docs/PROJECT_PROGRESS.md`
    - Message: `docs: document Chapter 1 "The Urgent Call" and record progress`

- [x] 17. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- No test sub-task is optional in this plan. The brief requires unit, integration, scripted and
  property tests.
- Property numbering follows `design.md`. Property 9 (focus math) is in task 7.2, and Properties
  12 and 13 (saves) are in tasks 5.5 and 5.6.
- Prop positions in `propLayout.ts` are a starting point. Task 7.3 calibrates them against the
  real street geometry. This is a manual visual check and is reported as such.
- Manual checks that automated tests do not cover: WebGL rendering, pointer lock in real browsers,
  the phone layout at 375 px and 1440 px, the menu music fade, and real play time. Report them as
  done or not done. Do not claim frame rates without measurements.
- Tasks that edit `ChapterOnePage.tsx` (8.4, 9.3, 10.3, 11.2, 12.2, 14.1) are in separate waves,
  and so are the tasks that edit `App.tsx` (12.3, 14.2, 15.1). Commit tasks run alone in their
  wave, and each one comes after every task whose files it stages.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "6.1", "7.1"] },
    { "id": 2, "tasks": ["2.2", "6.2", "7.2"] },
    { "id": 3, "tasks": ["2.3", "7.3"] },
    { "id": 4, "tasks": ["2.4", "3.1", "7.4"] },
    { "id": 5, "tasks": ["2.5", "3.2", "3.3", "3.4"] },
    { "id": 6, "tasks": ["3.5"] },
    { "id": 7, "tasks": ["3.6", "3.7", "7.5", "5.1"] },
    { "id": 8, "tasks": ["3.8", "3.9", "5.2", "8.1"] },
    { "id": 9, "tasks": ["3.10", "3.11", "3.12", "3.13", "3.14", "3.15", "3.16", "3.17", "3.18", "3.19", "3.20", "3.21", "3.22", "5.3", "8.2", "8.3"] },
    { "id": 10, "tasks": ["3.23"] },
    { "id": 11, "tasks": ["5.4", "5.5", "5.6", "8.4", "8.5"] },
    { "id": 12, "tasks": ["5.7"] },
    { "id": 13, "tasks": ["7.6"] },
    { "id": 14, "tasks": ["8.6", "9.1", "9.2"] },
    { "id": 15, "tasks": ["9.3", "10.1", "10.2", "11.1"] },
    { "id": 16, "tasks": ["9.4", "10.3"] },
    { "id": 17, "tasks": ["10.4", "11.2"] },
    { "id": 18, "tasks": ["11.3", "12.3"] },
    { "id": 19, "tasks": ["11.4"] },
    { "id": 20, "tasks": ["12.1"] },
    { "id": 21, "tasks": ["12.2"] },
    { "id": 22, "tasks": ["12.4", "14.2", "14.3"] },
    { "id": 23, "tasks": ["14.1"] },
    { "id": 24, "tasks": ["14.4"] },
    { "id": 25, "tasks": ["14.5"] },
    { "id": 26, "tasks": ["15.1"] },
    { "id": 27, "tasks": ["15.2"] },
    { "id": 28, "tasks": ["15.3"] },
    { "id": 29, "tasks": ["16.1", "16.2", "16.3"] },
    { "id": 30, "tasks": ["16.4"] },
    { "id": 31, "tasks": ["16.5"] }
  ]
}
```

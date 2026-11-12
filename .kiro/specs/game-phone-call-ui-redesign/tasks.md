# Implementation Plan: Phone call UI redesign (`game-phone-call-ui-redesign`)

## Overview

This plan implements the approved design in TypeScript (React 19, Vitest, Tailwind v4,
`lucide-react`, `i18next`). It starts with the pure modules (layout subtitle rectangle, timer
format, call dialogue derivation), then the locale keys and the End call style, then the three
components (`PhoneCallScreen`, `CallSubtitleOverlay`, `CallPresentation`) and the small
`ChapterOnePage` wiring for the Speaker toggle. The existing tests that asserted the caller line
inside the phone are updated on purpose, the new property tests are added, and a checkpoint runs
the full test, typecheck and build commands. The plan ends with the docs, the commits and a push
without force.

Resolved assumptions (recorded in the design):

- No screenshots were attached; the design is derived from the owner's text.
- "Call ended" is not displayed, because the locked `call` overlay closes when the call ends.
- Keypad, Hold and the optional "Call" header are omitted.
- Speaker toggles the phone-speaker sound effect for the current call and applies from the next
  line or Replay.

### Rules for every task

- **Branch.** Task 1.1 creates `feat/game-phone-call-ui-redesign` from the current tip of
  `feat/chapter-01-voice-narrative` (`f5694a6`) and confirms it with `git branch --show-current`.
  Commits stay local until task 8.3, which pushes without force options. Never merge, and never
  push to `main` or `feat/chapter-01-voice-narrative`. Preserve unrelated working-tree changes.
- **Tests are required.** No test sub-task is optional. Property tests use
  `apps/game/src/test/seededRandom.ts` and `apps/game/src/test/callStates.ts`, run at least 100
  cases, set an explicit `PROPERTY_TIMEOUT_MS = 60_000`, print the seed and case on failure, and
  start with the comment `// Feature: game-phone-call-ui-redesign, Property N: <title>`. Add no
  new dependencies.
- **Running tests.** Run targeted tests with
  `pnpm --filter @scammaze/game exec vitest run <paths>`. Never run tests and typecheck in
  parallel.
- **PowerShell.** Do not chain commands with `&&`. Run each command as its own call.
- **Commits.** Conventional Commits (`type(scope): summary`). Stage named files only, never
  `git add -A` or `git add .`. Keep the human as author and add the trailer
  `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`. Never stage
  `.env` files, `apps/game/dist/`, `apps/game/.voice-cache/` or `node_modules/`.
- **Content.** Repository content in English. All UI text through i18n keys in both `en` and `vi`
  (no hard-coded text, no string concatenation). No emoji; icons from `lucide-react`. Never use
  "safe" or "an toàn" for a number, message, URL or caller. Fictional numbers stay plain text.
- **Boundaries.** Do not modify `apps/game/src/game/narrative/**`, scenario data, or
  `apps/game/src/game/voice/**`. Do not change `PhoneScreenHost.tsx`, `PlayerChoiceOverlay.tsx`
  or `PhoneModel3D.tsx`. All paths below are under `apps/game/src/` unless they start with
  `docs/` or `ACCESSIBILITY.md`; `call/` means `features/chapter1/call/`.

## Tasks

- [x] 1. Create the feature branch
  - [x] 1.1 Create and check out `feat/game-phone-call-ui-redesign`
    - Run `git status --short` and note unrelated changes; do not stage or discard them.
    - Run `git switch -c feat/game-phone-call-ui-redesign f5694a6`.
    - Confirm with `git branch --show-current` that the output is exactly
      `feat/game-phone-call-ui-redesign`, and with `git log --oneline -1` that HEAD is `f5694a6`.
    - _Requirements: 11.3_

- [x] 2. Pure modules: layout, timer, call dialogue view
  - [x] 2.1 Add the subtitle rectangle to `call/callLayout.ts`
    - Add `subtitle: Rect` to `CallLayout` and the constants `SUBTITLE_MAX_HEIGHT = 104`,
      `SUBTITLE_MIN_HEIGHT = 56`, `SUBTITLE_NARROW_SHARE = 0.35`.
    - Narrow layout: place the subtitle between the screen and the choice rectangle, then start
      the choice rectangle below it (formulas in the design). Wide layout: keep `choice`
      unchanged and place the subtitle in the left column directly above it.
    - Keep every existing guarantee (aspect ratio, minimum screen width 132, choice inside the
      viewport, no screen and choice intersection).
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - [x] 2.2 Extend `call/callLayout.property.test.ts` with the subtitle assertions
    - **Property 3: Subtitle rectangle is inside the viewport and apart from the phone and the choices**
    - Reuse `generateViewport` (widths 320 to 2560, heights 480 to 1600, boundary values mixed
      in); assert inside viewport, zero intersection with `screen` and `choice`, position
      relative to the choice by layout kind; keep the existing Property 5 and 6 tests unchanged.
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
  - [x] 2.3 Create `call/callTimer.ts` and `call/callDialogueView.ts`
    - `callTimer.ts`: `formatCallDuration(totalSeconds)` returning `{ text, iso }` with `mm:ss`
      (at least two minute digits; negative or non-finite input gives `00:00`).
    - `callDialogueView.ts`: export the types `PhoneCallView` and `SubtitleContent`, the function
      `deriveCallDialogueView({ call, callDef, dialogueView })` (logic moved from
      `CallPresentation.tsx`: linked-view check, caller line for speaker `caller` or `npc`,
      narration, `connecting`) and `isSubtitleVisible({ subtitlesEnabled, audible })`.
    - No React, three, i18n or store imports in either file.
    - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.8, 9.2_
  - [x] 2.4 Write the timer property test `call/callTimer.property.test.ts`
    - **Property 4: Call timer format**
    - Seeded integers (including 0, 59, 60, 3599, 3600, large values) match `^\d{2,}:[0-5]\d$`
      and round-trip to the input; negative, `NaN` and `Infinity` give `00:00`.
    - **Validates: Requirements 1.4**

- [x] 3. Locale keys and the End call style
  - [x] 3.1 Update `i18n/locales/{en,vi}/chapter1/phone.ts` and `features/chapter1/theme.ts`
    - Set `phone.call.hangUp` to "End call" / "Kết thúc cuộc gọi".
    - Add `phone.call.speaker` ("Speaker" / "Loa ngoài"), `phone.call.replayAria` ("Replay last
      line" / "Nghe lại câu vừa rồi") and `phone.subtitle.label` ("Caller subtitles" / "Phụ đề
      cuộc gọi"). Make the Vietnamese `phone.call.replay` value "Nghe lại" so the accessible name
      contains the visible label.
    - In `theme.ts` add `UI.buttonEndCall` (red `#c93c47`, white text, hover `#d9505b`, solid
      disabled colors like `buttonAccept`, same focus outline as the other buttons). Keep every
      class a complete literal string.
    - _Requirements: 3.3, 4.3, 9.5, 10.1_
  - [x] 3.2 Add the End call pair to `call/contrast.test.ts`
    - Assert white on `#c93c47` is at least 4.5:1 and keep the existing pairs.
    - _Requirements: 4.3_

- [x] 4. Components and wiring
  - [x] 4.1 Rename and rewrite the phone screen as `call/PhoneCallScreen.tsx`
    - Run `git mv apps/game/src/features/chapter1/call/PhoneScreenUI.tsx apps/game/src/features/chapter1/call/PhoneCallScreen.tsx`.
    - Implement the design: `PhoneCallScreenProps`, avatar (`User` icon, `aria-hidden`,
      `data-testid="call-screen-avatar"`), status text, name, number, `mm:ss` timer via
      `formatCallDuration`, 3-column round button row (Mute, Speaker, Replay) with labels, red
      End call (`UI.buttonEndCall`), ringing Decline (`UI.buttonEndCall`) and Accept.
    - Remove the caller line, connecting text and notice from the phone. Keep the test IDs listed
      in the design and add `call-screen-speaker`. Verify that `Speaker` exists in the installed
      `lucide-react`; if not, use `Volume1`.
    - Compact layout below 360 px (smaller avatar, tighter gaps, all buttons kept); labels become
      `sr-only` below a 200 px container; ringing wobble and transitions respect reduced motion.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.9, 3.10, 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 10.1, 10.2, 10.3, 10.6, 10.7_
  - [x] 4.2 Create `call/CallSubtitleOverlay.tsx`
    - Implement `CallSubtitleOverlayProps` from the design: fixed region from `layout.subtitle`,
      `pointer-events: none`, `role="region"` with the `phone.subtitle.label` name, persistent
      polite `call-subtitle-region` (`aria-atomic`), `call-subtitle-line` with the speaker name,
      a second persistent polite `call-notice` for the voice notice, vertical scroll without
      truncation, transparent when empty, 150 ms fade keyed by `nodeKey` only without reduced
      motion.
    - Move the notice key table (`phone.call.notice.*`) and `phone.call.connecting` use here.
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 6.8, 10.5_
  - [x] 4.3 Refactor `call/CallPresentation.tsx`
    - Use `deriveCallDialogueView` and `isSubtitleVisible`; render `PhoneCallScreen` and, while
      the call is active, `CallSubtitleOverlay` with `layout.subtitle` between the phone host and
      `PlayerChoiceOverlay`.
    - Add the optional prop `speaker?: { on: boolean; onToggle: () => void }`; build `controls`
      without caption and notice fields; keep the dispatch guard, focus, mode logic and all other
      props unchanged.
    - _Requirements: 3.4, 3.5, 3.6, 3.8, 5.1, 5.3, 5.4, 5.5, 7.1, 7.3, 7.5, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2_
  - [x] 4.4 Wire the Speaker toggle in `features/chapter1/ChapterOnePage.tsx`
    - Add `speakerOverride` state (`boolean | null`), pass `phoneVoiceFilter: speakerOn` to
      `useVoicePlayback`, reset the override to `null` when `call.current` changes (including to
      `null`), and pass `speaker` to `CallPresentation`. Never write the saved setting.
    - _Requirements: 3.5, 8.5, 8.6, 9.1_

- [x] 5. Update and add tests
  - [x] 5.1 Rename and update `call/PhoneScreenUI.test.tsx` to `call/PhoneCallScreen.test.tsx`
    - Use `git mv`. Cover: ringing content and buttons, active content (avatar, name, number,
      status, `mm:ss` timer), no `call-line-region`, no `dialogue-line`, no scrolling region,
      number is plain text (no link, no tab stop), no trust wording, English and Vietnamese.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.5, 3.10_
  - [x] 5.2 Rename and update `call/PhoneScreenUI.controls.test.tsx` to `call/PhoneCallScreen.controls.test.tsx`
    - Use `git mv`. Remove the caption-visibility and notice cases (`captionVisible`,
      `call-line-region`, `dialogue-line`, `call-notice`). Add: exact button set and order (Mute,
      Speaker, Replay, End call), `aria-pressed` on Mute and Speaker, Replay disabled without
      audio, handlers called once, disabled while paused, compact layout keeps timer and buttons,
      accessible names contain visible labels in both locales, reduced motion.
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.4, 4.6, 8.4, 10.1_
  - [x] 5.3 Create `call/CallSubtitleOverlay.test.tsx`
    - Cover: line and speaker name shown; replaced when the node changes; `connecting` text;
      notice region; empty and transparent when `visible` is false and no notice; persistent live
      region node (same element after a rerender); not a tab stop; no pointer events; long line
      scrolls and is not truncated; no fade class or animation under reduced motion.
    - _Requirements: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 6.8_
  - [x] 5.4 Update `call/callPresentation.content.property.test.tsx` (Property 1)
    - **Property 1: The phone screen holds only call content**
    - Rewrite the old Property 2 checks: the phone host text contains no Caller_Line, connecting
      or notice text and no `dialogue-option-*` element; the button set is Decline and Accept
      while ringing, and Mute, Speaker, Replay and End call while active with voice controls; the
      caller line text is in `call-subtitle-line` when it applies.
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1, 7.1**
  - [x] 5.5 Create `call/callSubtitle.property.test.tsx` (Property 2)
    - **Property 2: Subtitle visibility and content**
    - Seeded random `subtitlesEnabled`, `audible`, locale and node from `callStates.ts`: the
      subtitle region holds exactly the current Caller_Line iff the node is a Caller_Line and
      (subtitles enabled or not audible); `isSubtitleVisible` equals
      `subtitlesEnabled || !audible`; `deriveCallDialogueView` never returns an earlier line.
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
  - [x] 5.6 Re-point the presentation equivalence tests (Property 5)
    - **Property 5: Presentation equivalence across modes**
    - Update `call/callPresentation.equivalence.property.test.tsx`,
      `call/callPresentation.parity.property.test.tsx`,
      `call/callPresentation.voiceEquivalence.property.test.tsx`, `call/callButtons.property.test.tsx`
      and `call/PhoneScreenHost.test.tsx` for the renamed component and the test IDs. Add the
      subtitle text to the compared output of the mode-equivalence check.
    - **Validates: Requirements 2.6, 3.8, 8.3, 9.3**
  - [x] 5.7 Update `features/chapter1/call/ChapterOnePage.call.test.tsx` and `features/chapter1/ChapterOnePage.voice.test.tsx`
    - Call test: the control order and focus checks (about lines 389 to 400) include Speaker;
      the line assertions move to the subtitle overlay; the `hangUp` text is "End call";
      choosing an option advances the node and the overlay is outside `phone-screen-host`;
      End call dispatches `END_CALL` once and removes the overlay; the 3D phone canvas stays
      enabled while the call shows; the Speaker press changes `phoneVoiceFilter` for the call and
      resets after the call without changing the saved setting.
    - Voice test: `queryCaption` reads `call-subtitle-line`; voice playback still starts on a
      Caller_Line; End call stops the playback; Mute affects the voice; Replay replays the last
      line; the subtitle shows with subtitles off when nothing is audible and stays empty when the
      voice is audible; `call-notice` is inside the overlay.
    - _Requirements: 3.4, 3.5, 3.6, 3.8, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.5, 8.6, 9.4, 11.1_
  - [x] 5.8 Update `features/chapter1/accessibility.test.tsx`
    - Point the live-region checks (about lines 515 to 518 and 646 to 648) at
      `call-subtitle-region` and `call-notice`; the line-change check (about 615 to 620) reads
      `call-subtitle-line`; the button list includes Speaker; the dialog name and focus checks
      stay; add the Vietnamese accessible-name check for Speaker and Replay.
    - _Requirements: 5.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 5.9 Update `call/importBoundaries.test.ts`
    - Replace `PhoneScreenUI.tsx` with `PhoneCallScreen.tsx` in the DOM entry file list and add
      `CallSubtitleOverlay.tsx`; add `callDialogueView.ts` and `callTimer.ts` to the pure-module
      checks (no React, three, i18n or store imports).
    - _Requirements: 9.2_

- [x] 6. Checkpoint - full verification
  - Run each command on its own, in this order, and record the real output:
    `pnpm test`, then `pnpm typecheck`, then `pnpm build`. Never run them in parallel.
  - Also confirm that the phone model tests still pass (`call/phoneModelStatus.test.ts`,
    `call/screenQuad.property.test.ts`, `call/phoneMotion.property.test.ts`, the canvas tests).
  - Fix failures at the cause. Ensure all tests pass, ask the user if questions arise.

- [x] 7. Documentation
  - [x] 7.1 Add the `docs/PROJECT_PROGRESS.md` entry (newest first)
    - Include the nine AGENTS.md items: date and title, objective, completed work, files created,
      modified or deleted, validation commands executed, build and test results (exact; state
      what was not run), unresolved issues and limitations (manual visual checks at 320, 768 and
      1920 px and real-speaker sound not executed unless the owner ran them; "Call ended" status
      not displayed), deviations (file rename of `PhoneScreenUI`, notices moved to the overlay),
      and follow-ups. Update "Project status" and the "In progress" or "Completed" sections only
      for what was verified.
    - _Requirements: 11.2, 11.5_
  - [x] 7.2 Update `ACCESSIBILITY.md` and `docs/architecture/OVERVIEW.md`
    - `ACCESSIBILITY.md` (call section near lines 46 to 76): caption now in the subtitle overlay
      outside the phone, visible when Subtitles is on or nothing is audible; Speaker toggle
      semantics (sound effect only, applies from the next line or Replay); button set and
      keyboard order; reduced motion for the fade.
    - `docs/architecture/OVERVIEW.md` (lines about the in-game phone and the call screen, about
      47 and 182): the call screen is a device UI, caller text is in `CallSubtitleOverlay`,
      choices in `PlayerChoiceOverlay`; keep status labels correct.
    - _Requirements: 11.5_

- [ ] 8. Delivery
  - [x] 8.1 Commit the code and tests
    - Stage the changed and new files under `apps/game/src/` by name (including the `git mv`
      renames) and commit with `feat(game): redesign the phone call screen with external
      subtitles` plus the Co-authored-by trailer. Confirm with `git status --short` that nothing
      unrelated is staged.
    - _Requirements: 11.3_
  - [x] 8.2 Commit the docs and the spec
    - Stage `docs/PROJECT_PROGRESS.md`, `ACCESSIBILITY.md`, `docs/architecture/OVERVIEW.md` and
      `.kiro/specs/game-phone-call-ui-redesign/*` by name; commit with
      `docs(game): record the phone call UI redesign` plus the trailer.
    - _Requirements: 11.3, 11.5_
  - [-] 8.3 Push without force
    - Run `git push -u origin feat/game-phone-call-ui-redesign` with no force option. Do not
      merge and do not open a merge action. Report the commit hashes and the real results of
      task 6.
    - _Requirements: 11.4_

## Notes

- All test sub-tasks are required; none is marked optional.
- The checkpoint (task 6) runs after wave 5 and before wave 6, so the progress entry records real
  results.
- Manual checks (visual look, readability at 320, 768 and 1920 px, real-speaker sound) are not
  coding tasks. Task 7.1 records them as not executed unless the owner performed them.
- Existing tests asserting the caller line inside the phone are updated in tasks 5.1, 5.2, 5.4,
  5.7 and 5.8; run `grep` for `call-line-region`, `dialogue-line`, `captionVisible` and
  `PhoneScreenUI` after task 5.9 and fix any remaining reference before the checkpoint.
- Each task references requirements for traceability; property sub-tasks reference their design
  property number.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.3", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.2", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["4.4", "5.4", "5.5", "5.6", "5.9"] },
    { "id": 5, "tasks": ["5.7", "5.8"] },
    { "id": 6, "tasks": ["7.1", "7.2", "8.1"] },
    { "id": 7, "tasks": ["8.2"] },
    { "id": 8, "tasks": ["8.3"] }
  ]
}
```

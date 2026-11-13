---
inclusion: fileMatch
fileMatchPattern: ["**/apps/game/src/game/narrative/**", "**/apps/game/src/game/saves/**", "**/apps/game/src/features/chapter1/**", "**/apps/game/src/i18n/locales/*/chapter1/**"]
---

# Gameplay rules (deterministic narrative core)

## State and transitions

- All gameplay state is one `ChapterState` (`game/narrative/types.ts`). It changes only through
  `chapterReducer(state, action, scenario)` with a `CoreAction` (14 kinds), via `ChapterStore`.
  UI, audio, voice and the 3D scene read state through selectors; they never write it.
- The reducer is pure: no clock, randomness, I/O, React, Three.js or i18n. A rejected action
  returns the SAME state object with a `reason` from `REASONS`; an accepted one appends exactly
  one `EventLogEntry` with `seq === events.length`.
- Unknown or malformed actions are rejected, never thrown (`isCoreAction` whitelists ids).
- Lifecycle: `not-started` -> `START_CHAPTER` -> `playing` -> decision recorded ->
  `selectOutcome` sets `outcome` and `status: "ended"` -> only `FINISH_CHAPTER` is accepted ->
  `finished` accepts nothing.

## Branching and scenarios

- Scenario data is plain JSON-compatible data (`ScenarioDefinition`). Branches are dialogue
  options with `conditions`, `effects` and `next` (a node id or `{ end: "hang-up" }`).
- Every scenario change must keep `validateScenario` empty (V1 references and schema, V3 shape:
  every node reaches an end, pressure nodes end within 3 steps, at most 4 unconditional options;
  V4 no impossible conditions) and `analyzeReachability` clean (all outcomes reachable, no
  unreachable node or option, no soft lock).
- Earlier choices may change later dialogue only through flags, evidence, claims and the call log.

## Valid states (checked by `assertInvariants` in `src/test/chapterRuns.ts`)

No duplicate or unknown discovered evidence or interacted objects; objectives known and never both
active and completed; the conversation's graph and node exist; call status matches the current
call and an active call has a conversation; an outcome only with a decision; `verified` and
`investigator` only with a contradicted caller identity and never with `code_shared` or
`money_moved`; a contradicted claim only with `ev.official-confirmation`; `pressure` in 0..3;
event `seq` contiguous; `finished` only with an outcome.

## Progression, decisions, scoring

- There is no numeric score. Results are categorical outcomes; `pressure` (0..3) is the only
  number and is clamped by `applyEffect`.
- `risky` whenever `code_shared` or `money_moved` is set, regardless of the decision. The
  investigator outcome needs `verify-independently`, a contradicted caller identity and the
  ending's `unlockWhen`. Never reward a dangerous action.
- The debrief is derived only from scenario data and the event log.

## Saves

A save stores the action log; restore replays it through the reducer, so a save is valid exactly
when every action is accepted. Changing reducer behavior can invalidate saves: keep
`savedPathsStillReplay.test.ts` green or bump the save version with a migration.

## AI

AI may later propose wording only. It never chooses outcomes, evidence, flags or state, and the
game must play identically with AI unavailable.

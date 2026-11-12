# Implementation Plan: Chapter 1 Voice Narrative

## Overview

This plan turns the approved `requirements.md` and `design.md` into small coding tasks. It extends the
Chapter 1 scenario (schema, engine, content, Vietnamese overlay), adds the voice module (manifest,
generator, player, Web Audio graph), settings, the phone call UI changes, the follow-up call, the new
endings, lenient save restore, tests and documentation. Every task can be executed alone by a sub-agent
that reads the named design.md sections. The implementation language is TypeScript (design.md uses
TypeScript), with one PowerShell script and one Node `.mjs` script for the voice generator.

Path shorthand used in every task: `SRC` = `apps/game/src`. `NARR` = `SRC/game/narrative`.
`C1` = `SRC/game/narrative/chapter1`. `VOICE` = `SRC/game/voice`. `OVL` = `SRC/i18n/narrative/chapter1.vi`.
`F1` = `SRC/features/chapter1`. All paths are relative to `d:\scam-maze`.

## Execution Rules (apply to every task)

Git and branch
- The first task creates branch `feat/chapter-01-voice-narrative` from the current tip of `feat/game-3d-phone-call-ui` (`8c93d27`) and confirms it with `git branch --show-current`. Never merge anything, never merge `main`, never rebase onto `main`.
- Commits are local, one per phase, made only by the commit tasks. The final task pushes with `git push -u origin feat/chapter-01-voice-narrative` and no force option.
- Commit format: Conventional Commits. Stage named files only (never `git add .` or `git add -A`). Never stage the `iphone` source GLBs or any unrelated or untracked file. Add this trailer to every commit with a third `-m`: `Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>`. Do not skip hooks.

Commands (PowerShell)
- Never use `&&` in PowerShell. Run commands as separate calls, or use `;` only when a failure of the first command does not matter.
- Targeted tests: `pnpm --filter @scammaze/game exec vitest run <paths>`.
- Typecheck: `pnpm --filter @scammaze/game exec tsc --noEmit -p tsconfig.app.json` and then `pnpm --filter @scammaze/game exec tsc --noEmit -p tsconfig.test.json`.
- Never run tests and typecheck in parallel. Checkpoints run `pnpm test`, then `pnpm typecheck`, then `pnpm build`, one after the other, from `d:\scam-maze`.
- Intermediate tasks inside one phase can leave `tsc` errors in files that a later task of the same phase owns (for example, new IDs are added before the data that uses them). Only checkpoints require a clean typecheck.

Tests
- Test sub-tasks are required. They are not optional and carry no `*` postfix.
- Property tests use `SRC/test/seededRandom.ts`, `SRC/test/chapterRuns.ts` and `SRC/test/callStates.ts`, at least 100 cases (use the existing `CORE_PROPERTY_RUNS`, which is 200, where it fits), `const PROPERTY_TIMEOUT_MS = 60_000` as the test timeout, and the comment `// Feature: chapter-01-voice-narrative, Property N: <title>` above the test. Failures print the seed, the case index and the shortest failing prefix.
- No new dev dependency. No new runtime dependency (default none; if one seems needed, stop and justify it in design.md first).
- Tests use no network, no WebGL, no real audio device, no microphone and no AI provider. Use `SRC/test/fakeAudioPort.ts` (task 14.2) for audio.
- Do not delete, skip or weaken an existing assertion. Update an existing test only for a reason listed in design.md "Known test updates", and record each update (file, reason) in the "Baseline Record" section at the end of this file so task 27.1 can copy it into the progress doc.

Repository rules
- All repository content is English. UI text goes through i18n keys in both `SRC/i18n/locales/en/**` and `SRC/i18n/locales/vi/**` (English first, Vietnamese typed against it). Vietnamese narrative goes only in the overlay under `OVL`, keyed by stable IDs. One complete string per sentence, no concatenation.
- No emoji anywhere. Icons come from `lucide-react` and carry `aria-hidden="true"` when decorative.
- Never write "safe" in English game text, never "an toàn" as a safety claim in Vietnamese. Say "matches the official record", "does not match", "protected", "secure" or "trusted channel".
- Fictional companies, reserved domains (`.test`, `.example`, `.invalid`) and `+000` phone numbers only. No real brand, currency or country-specific payment method. No instruction that could be used for real fraud.
- `NARR/**` must not import React, Three.js, i18n, `game/voice` or any audio API (`NARR/boundaries.test.ts` must stay green with no allowlist change).
- The core game must stay playable with AI off, offline and without a microphone. Voice, captions and sound never change state, evidence, decisions or outcomes.
- Update `docs/PROJECT_PROGRESS.md` at the end (task 27.1) with the nine mandatory items of AGENTS.md section 6.

Honesty rules
- Never mark an audio clip `present` unless the MP3 file exists, is non-empty and was produced by `apps/game/scripts/generate-chapter1-voice.mjs` in this feature.
- Never label English audio as Vietnamese. If a Vietnamese voice is unavailable, the Vietnamese clips stay `missing`.
- Report real test, typecheck and build results only. Report no playtime unless a human measured it. Say "not verified" for anything a test cannot prove (sound quality, browser playback, redistribution terms).

## Tasks

- [x] 1. Branch, baseline and audit
  - [x] 1.1 Create the branch and record the baseline counts
    - Run `git status --short` and keep any uncommitted work untouched. Run `git switch -c feat/chapter-01-voice-narrative feat/game-3d-phone-call-ui`. Run `git branch --show-current` and confirm the output is `feat/chapter-01-voice-narrative`. Run `git rev-parse --short HEAD` and confirm it is `8c93d27`; if not, stop and report.
    - From `d:\scam-maze`, run `pnpm test`, then `pnpm typecheck`, then `pnpm build`, one after the other. Record the exit status and the test file, test passed, failed and skipped counts in the "Baseline Record" section at the end of this file.
    - Record the dialogue node count per graph, Spoken_Node count and option count with the design.md audit values (4 graphs, 26 nodes, 18 Spoken_Nodes, 39 options, 11 evidence items, 5 objectives) only if you can re-confirm them by reading `NARR/chapter1/dialogues/*.ts`; otherwise record the real counts you found.
    - Edit only this tasks.md file.
    - _Requirements: 1.2, 18.1_
  - [x] 1.2 Audit the items the requirements left unconfirmed
    - Read `SRC/features/chapter1/call/PhoneScreenUI.tsx`, `SRC/app/settingsStorage.ts`, `NARR/chapter1/playthroughs.test.ts`, `NARR/chapter1/content.test.ts`, `SRC/i18n/narrative.test.ts`, `SRC/game/saves/chapterProgress.ts` and `SRC/game/loading/chapterLoader.ts`.
    - In the "Baseline Record" section record, for each audit table row of design.md ("Audit findings"), whether it is confirmed, plus: how the caller line is rendered today, whether stored settings are merged with defaults, which option IDs and event indices the playthroughs hard-code, and where `WARNING_SIGN_IDS` definitions and the `startNodeWhen` field live. If a finding contradicts design.md, write the correction there and tell the owner in the final message.
    - Edit only this tasks.md file. Make no code change.
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 2. Scenario schema and engine extension
  - [x] 2.1 Append new IDs to `NARR/chapter1/ids.ts`
    - Read design.md "Components and Interfaces" section 1 and "Data Models" "New IDs".
    - Append (never reorder or remove) to the end of each list: `SPEAKER_IDS`, `TONE_IDS`, `ACT_IDS` (new lists with their types), `OBJECTIVE_IDS` (`obj.call-bank`, `obj.hold-firm`, `obj.file-report`), `EVIDENCE_IDS` (`ev.transfer-check`, `ev.second-number`, `ev.case-sms`, `ev.shifting-story`), `FLAG_IDS` (`asked_details`, `asked_time`, `heard_deadline`, `link_questioned`, `secrecy_heard`, `case_sms_sent`, `followup_rang`, `report_filed`), `WARNING_SIGN_IDS` (`ws.secrecy`, `ws.inconsistent-story`, `ws.changing-numbers`), `CALL_IDS` (`call.followup`), `DIALOGUE_GRAPH_IDS` (`dlg.followup`), `MESSAGE_IDS` (`msg.case-sms`), `OUTCOME_IDS` (`investigator`).
    - Edit only `ids.ts`.
    - _Requirements: 2.1, 2.9, 16.4_
  - [x] 2.2 Extend the scenario types in `NARR/types.ts`
    - Read design.md "Components and Interfaces" section 1.
    - Add only optional or additive members: `DialogueNode.tone`, `speakerId`, `pauseBeforeMs`, `waitForVoice`; `DialogueGraph.persona.speakerId`; the four `Condition` kinds (`callRang`, `objectiveCompleted`, `outcomeSet`, `evidenceCountAtLeast`); `EndingDef.unlockWhen`; `ActDef`; `ScenarioDefinition.acts`; `RingReason` value `"follow-up"`.
    - Edit only `types.ts`.
    - _Requirements: 2.1, 9.2, 15.5, 16.4_
  - [x] 2.3 Add the four condition kinds in `NARR/conditions.ts`
    - Add the four `case` branches to `evaluateCondition` exactly as in design.md section 2 table row `conditions.ts`. Keep `assertNever` exhaustive.
    - Edit only `conditions.ts`.
    - _Requirements: 9.3, 14.2_
  - [x] 2.4 Add the follow-up ring to `NARR/reducer.ts`
    - Read design.md section 2 row `reducer.ts`. Add `call.followup` to `INCOMING_CALL_IDS`, `"follow-up"` to `RING_REASONS`, a third `RING_CALL` branch (reject if it has a record, if a decision exists, or if the callback is not `ended` or `declined`; on accept set flag `followup_rang`), the reasons `followupNotYet` and `followupAlreadyRang`, and the `hangUpTag` mapping to `hung-up-on-followup`. Change nothing else.
    - Edit only `reducer.ts`.
    - _Requirements: 2.5, 10.6, 10.7_
  - [x] 2.5 Add the investigator outcome in `NARR/outcome.ts`
    - Change `selectOutcome(state, scenario = CHAPTER_1_SCENARIO)` with the order in design.md "Decisions and endings": risky flags first, then investigator (decision `verify-independently`, caller identity contradicted, and `evaluateConditions(scenario.endings.investigator.unlockWhen)`), then verified, then uncertain. Keep it pure and deterministic. If importing `CHAPTER_1_SCENARIO` as a default creates a cycle, take the scenario as a required argument and update the callers instead.
    - Edit only `outcome.ts` (and callers if a signature change forces it; list them in the final message).
    - _Requirements: 14.2, 14.3, 14.5_
  - [x] 2.6 Update `NARR/selectors.ts`
    - Add `CALL_LOG_EVIDENCE["call.followup"] = "ev.second-number"`, the follow-up ring candidate in `enumerateCandidateActions`, and `selectCurrentAct(state, scenario): ActDef` (the last act whose `enterWhen` holds).
    - Edit only `selectors.ts`.
    - _Requirements: 2.1, 2.5_
  - [x] 2.7 Add three objective rules in `NARR/objectives.ts`
    - Append rules for `obj.call-bank`, `obj.hold-firm`, `obj.file-report` to `OBJECTIVE_RULES` using the "Activates when" and "Completes when" columns of design.md "Objectives per act". Existing rules do not change.
    - Edit only `objectives.ts`.
    - _Requirements: 2.1, 10.5, 3.3_
  - [x] 2.8 Extend the localization walker in `NARR/localize.ts`
    - Make the walker visit `acts[i].title` (key `acts/<id>/title`). Check that new optional node fields add no translatable text. Keep the key scheme unchanged.
    - Edit only `localize.ts`.
    - _Requirements: 12.2_

- [x] 3. Chapter 1 narrative content in English
  - [x] 3.1 Create `C1/acts.ts`
    - Export `CHAPTER_1_ACTS: ActDef[]` with the six acts, titles, `enterWhen`, `exitWhen` and objective lists from design.md "Acts". Act 1 title is "An ordinary morning" (gap G1).
    - Create only `acts.ts`.
    - _Requirements: 2.1, 2.2, 2.8_
  - [x] 3.2 Add the three objectives in `C1/objectives.ts`
    - Add `obj.call-bank`, `obj.hold-firm`, `obj.file-report` with the English texts of design.md "Objectives per act".
    - Edit only `objectives.ts`.
    - _Requirements: 3.3, 10.1_
  - [x] 3.3 Add four evidence items and warning signs in `C1/evidence.ts`
    - Add `ev.transfer-check`, `ev.second-number`, `ev.case-sms`, `ev.shifting-story` with source, discovery method, claim stance, meaning, warning signs and debrief hint per design.md "Evidence". Add the three warning signs `ws.secrecy`, `ws.inconsistent-story`, `ws.changing-numbers` where `WARNING_SIGN_IDS` definitions live (found in task 1.2). Wording: "matches the official record" or "does not match", never "safe". URLs are plain text on `.invalid` or `.example`.
    - Edit only `evidence.ts` (and the file that holds warning sign definitions if different, naming it in the final message).
    - _Requirements: 10.1, 10.2, 10.8, 10.9_
  - [x] 3.4 Add the follow-up call and case message in `C1/phone.ts`
    - Add `call.followup` (incoming, display name "Northgate Case Desk", number `+000 555 0177`), message `msg.case-sms` (from "Northgate Bank", a case reference and the look-alike address `northgate-case-review.invalid`), and the contact entry for the new number.
    - Edit only `phone.ts`.
    - _Requirements: 2.5, 10.2, 12.2_
  - [x] 3.5 Extend `C1/dialogues/scamCall.ts`
    - Read design.md "Dialogue graphs" table for `dlg.scam-call`. Keep every existing node ID, option ID, target and condition. Add `tone` and `speakerId` to every caller node, `waitForVoice` on `scam.open`, `persona.speakerId = "spk.alex"`, the nine new nodes, the new options on existing nodes, the new effects (flags, evidence, debrief tags) and the pressure markers. At most four options are available at once at every node.
    - Edit only `scamCall.ts`.
    - _Requirements: 2.3, 9.1, 9.2, 9.4, 9.5, 9.6, 9.7, 9.8_
  - [x] 3.6 Extend `C1/dialogues/officialLine.ts`
    - Read the `dlg.official-line` table. Keep `official.greeting` as a `system` node. Add tones, `persona.speakerId = "spk.northgate-agent"`, the new hub, transfer, numbers, advice and report nodes, and the `confirm` and `locked` option additions. Only this graph sets claim statuses.
    - Edit only `officialLine.ts`.
    - _Requirements: 2.4, 10.2, 10.5, 14.2_
  - [x] 3.7 Extend `C1/dialogues/callback.ts`
    - Read the `dlg.callback` table. Add tones, `persona.speakerId = "spk.alex"`, `waitForVoice` on `callback.open`, the new nodes, the new options on `callback.open`, and `startNodeWhen` for `callback.time-up` when flag `asked_time` is set.
    - Edit only `callback.ts`.
    - _Requirements: 2.5, 9.4, 9.5, 9.6_
  - [x] 3.8 Create `C1/dialogues/followup.ts`
    - Read the `dlg.followup` table. Create graph `dlg.followup` (persona "Morgan Hale", `spk.case-officer`) with seven Spoken_Nodes, the two end nodes (`followup.end.hung-up`, `followup.end.money-moved`), `waitForVoice` on `followup.open` and `followup.code-used`, and `startNodeWhen` for `followup.code-used` when `code_shared`.
    - Create only `followup.ts`.
    - _Requirements: 2.5, 9.6, 10.7_
  - [x] 3.9 Extend `C1/dialogues/shopkeeper.ts`
    - Read the `dlg.shopkeeper` table. Add tones, `persona.speakerId = "spk.sam"`, the four Act 1 small-talk nodes and `sam.after-call.numbers`, and the new options. Existing IDs and targets stay.
    - Edit only `shopkeeper.ts`.
    - _Requirements: 2.2, 7.11_
  - [x] 3.10 Add the investigator ending and debrief text in `C1/endings.ts` and `C1/debrief.ts`
    - Add `endings.investigator` with the `unlockWhen` conditions of design.md "Decisions and endings" (flag `report_filed` and `evidenceCountAtLeast` 8 of the 11 listed items), title "Checked, reported and documented", simulation label, neutral wording. In `debrief.ts` add the `investigator` outcome summary and `decisionNotes` for the 11 new debrief tags. No text uses "safe" or blames the player.
    - Edit only `endings.ts` and `debrief.ts`.
    - _Requirements: 14.1, 14.2, 14.4, 14.5, 14.6_
  - [x] 3.11 Wire the new data in `C1/scenario.ts`
    - Add `acts: CHAPTER_1_ACTS`, the `dlg.followup` graph, the new call, message, objectives and evidence to `CHAPTER_1_SCENARIO`. Confirm `createInitialState` includes the new flags and that the four old playthrough logs still produce accepted actions (run `NARR/chapter1/playthroughs.test.ts` and note failures that are only objective timeline changes).
    - Edit only `scenario.ts`.
    - _Requirements: 2.1, 2.9, 13.7_
  - [x] 3.12 Update `SRC/test/chapterRuns.ts` for the new call and reason
    - Add `call.followup` and reason `follow-up` to the incoming call and ring reason lists, the random action generator, the guided policy and `assertInvariants` (investigator needs no risky flag; `investigator` and `verified` never co-occur with `code_shared` or `money_moved`).
    - Edit only `chapterRuns.ts`.
    - _Requirements: 17.5, 13.7_

- [x] 4. Vietnamese narrative overlay
  - [x] 4.1 Add Vietnamese text for `dlg.scam-call` in `OVL/dialogues.ts`
    - For every new and every existing line ID of the graph add `dialogues/dlg.scam-call/lines/<lineId>` text and option texts. Natural speech, not word-for-word. Use gender-neutral "tôi" and "quý khách" where a male voice must not contradict the text. Keep "Northgate Bank" untranslated. No "an toàn" as a safety claim.
    - Edit only `dialogues.ts` (this task owns the scam-call block).
    - _Requirements: 12.2, 9.8_
  - [x] 4.2 Add Vietnamese text for `dlg.official-line` and `dlg.callback` in `OVL/dialogues.ts`
    - Same rules as 4.1 for the two graphs.
    - Edit only `dialogues.ts` (these two blocks).
    - _Requirements: 12.2_
  - [x] 4.3 Add Vietnamese text for `dlg.followup` and `dlg.shopkeeper` in `OVL/dialogues.ts`
    - Same rules as 4.1, including the persona name and role of `dlg.followup`.
    - Edit only `dialogues.ts` (these two blocks).
    - _Requirements: 12.2_
  - [x] 4.4 Add acts, objectives and world text in `OVL/core.ts`
    - Add `acts/<id>/title` for six acts and `objectives/<id>/text` for the three new objectives. Touch `OVL/world.ts` only if the walker now reports missing keys there.
    - Edit only `core.ts` (and `world.ts` if required).
    - _Requirements: 12.2_
  - [x] 4.5 Add evidence text in `OVL/evidence.ts`
    - Add Vietnamese title, meaning, relation notes, warning sign texts and hints for the four new evidence items and three new warning signs.
    - Edit only `evidence.ts`.
    - _Requirements: 12.2_
  - [x] 4.6 Add phone text in `OVL/phone.ts`
    - Add `phone/messages/msg.case-sms/*`, `phone/contacts/+000 555 0177/name` and `calls/call.followup/displayName`.
    - Edit only `phone.ts`.
    - _Requirements: 12.2_
  - [x] 4.7 Add ending and debrief text in `OVL/decisions.ts`
    - Add `endings/investigator/*`, `debrief/outcomeSummaries/investigator` and `debrief/decisionNotes/<tag>` for the 11 new tags.
    - Edit only `decisions.ts`.
    - _Requirements: 12.2, 14.6_

- [x] 5. Keep existing tests green
  - [x] 5.1 Update `NARR/chapter1/playthroughs.test.ts` for the new objectives
    - Update only the exact `objectiveTimeline` arrays and the `state.objectives.active` expectations of the four runs (design.md "Known test updates" item 1). Option IDs, claim statuses, evidence lists, outcomes and event indices must remain valid; if one does not, stop and investigate before editing. Record each change and its reason in the Baseline Record.
    - Edit only `playthroughs.test.ts`.
    - _Requirements: 13.7_
  - [x] 5.2 Update `NARR/objectives.test.ts`
    - Add the three new objectives and rules to its expectations. Do not weaken any assertion.
    - Edit only `objectives.test.ts`.
    - _Requirements: 13.7_
  - [x] 5.3 Update the lint walker in `NARR/chapter1/content.test.ts`
    - Add `speakerId`, `objectiveId` and `objectives` to the identifier-valued property list so `spk.alex` is not read as a domain. Keep every rule (reserved domains, `+000`, no currency, no "safe", no blaming phrases, no emoji, no other bank name) and confirm the new content passes them.
    - Edit only `content.test.ts`.
    - _Requirements: 13.7, 10.8_
  - [x] 5.4 Update the lint walker copy in `SRC/i18n/narrative.test.ts`
    - Same property-name additions as 5.3. Confirm every Narrative_Text_Key has non-empty Vietnamese text. Fix any missing overlay key in the owning overlay file only by reporting it (do not edit overlay files in this task).
    - Edit only `narrative.test.ts`.
    - _Requirements: 12.2, 12.7, 13.7_
  - [x] 5.5 Fix `ScenarioDefinition` fixture literals in other tests
    - Run `rg "persona:" SRC --glob "*.test.ts*"` and `rg "ScenarioDefinition" SRC --glob "*.test.ts*"` to find fixtures that build scenario literals. Add `acts: []` and `speakerId` to each persona. Do not touch `validateScenario.test.ts` (task 8.3), `playthroughs.test.ts`, `objectives.test.ts`, `content.test.ts` or `narrative.test.ts`.
    - List the edited files in the final message and in the Baseline Record.
    - _Requirements: 13.7_

- [x] 6. Checkpoint A - narrative content builds and existing tests pass
  - Run, one after the other: `pnpm test`, `pnpm typecheck`, `pnpm build`. Fix failures in the owning files. Record real counts in the Baseline Record. Ensure all tests pass, ask the user if questions arise.

- [x] 7. Commit: schema, engine and content
  - [x] 7.1 Create the local commit for tasks 2 to 5
    - Run `git status --short`. Stage by name only the files edited by tasks 2.1 to 5.5 (`NARR/types.ts`, `conditions.ts`, `reducer.ts`, `outcome.ts`, `selectors.ts`, `objectives.ts`, `localize.ts`, `C1/**` data files, `OVL/**` files, `SRC/test/chapterRuns.ts`, the test files of tasks 5.1 to 5.5, and any caller fixed in 2.5). Do not stage `iphone` GLBs or anything else.
    - Commit: `git commit -m "feat(game): extend Chapter 1 scenario schema, engine and content" -m "<body listing node, option and evidence counts you measured>" -m "Co-authored-by: Kiro Agent <244629292+kiro-agent@users.noreply.github.com>"`.
    - _Requirements: 18.2_

- [x] 8. Engine and content-validator tests
  - [x] 8.1 Extend `NARR/validateScenario.ts` (checks V1, V3 static, V4 static)
    - Read design.md "Content validator". Add: node IDs unique across all graphs; tone required on every Spoken_Node (`speaker` is `caller` or `npc`); `speakerId` exists; `pauseBeforeMs` is 0 to 3000; act references; no more than four unconditional options per node; every pressure node reaches an end within three option steps; no cycle without an exit; conditions that can never be true (flag no effect sets, evidence with no discovery, claim status no effect produces, `callEnded` or `callRang` for a call without a graph). Return issues as `{ check, where, message }`. Reuse existing checks; never throw on bad input.
    - Edit only `validateScenario.ts`.
    - _Requirements: 13.1, 13.2, 9.2_
  - [x] 8.2 Create `NARR/reachability.ts` (check V2 and measured V3/V4)
    - Implement the pure solver of design.md "Reachability solver": state key, moves from `enumerateCandidateActions` applied by the real `chapterReducer`, free-action saturation, `maxStates` default 100000 with `truncated`, reverse-edge soft-lock check, outputs `{ states, truncated, outcomesReached, unreachableNodes, unreachableOptions, softLocks, maxAvailableOptions, minAvailableOptions }`. Import only inside `NARR`.
    - Create only `reachability.ts`. Record the explored state count in the Baseline Record when task 8.4 runs.
    - _Requirements: 13.3_
  - [x] 8.3 Extend `NARR/validateScenario.test.ts`
    - Example tests: the real scenario returns no issue; one broken fixture per new check returns an issue naming the item.
    - Edit only `validateScenario.test.ts`.
    - _Requirements: 13.1, 17.1_
  - [x] 8.4 Write `NARR/reachability.test.ts` and Property 3, Property 4
    - **Property 3: Every ending is reachable and no state is a soft lock**
    - **Property 4: Available options stay within bounds**
    - **Validates: Requirements 2.6, 2.7, 9.6, 10.6, 10.7, 13.3, 14.1, 8.2**
    - Example tests: `truncated` is false; `verified`, `investigator`, `risky`, `uncertain` are all reached; no unreachable node or option; no soft lock. Seeded tests: from random reachable states `END_CALL` is accepted with a live call, `stop-and-wait` is accepted after the first call ends, and option counts are at most four (and at least two except single-continuation nodes).
    - Create only `reachability.test.ts`.
    - _Requirements: 13.3, 14.1, 17.1_
  - [x] 8.5 Write Property 5 in `NARR/properties/conditionedOptions.property.test.ts`
    - **Property 5: Evidence-conditioned options are deterministic and local**
    - **Validates: Requirements 9.3, 9.4**
    - Include a case for each link of design.md "Where earlier choices change later dialogue" (at least eleven): adding the named evidence or flag changes available options or the start node.
    - Create only this file.
    - _Requirements: 9.3, 9.4, 9.5, 17.1_
  - [x] 8.6 Write `C1/acts.test.ts`
    - Example tests: six acts in order; `exitWhen` equals the next act's `enterWhen`; each objective belongs to exactly one act; Act 1 uses only existing interactables.
    - Create only this file.
    - _Requirements: 2.1, 2.2_
  - [x] 8.7 Write Property 1 in `NARR/properties/acts.property.test.ts`
    - **Property 1: Act progression is monotonic**
    - **Validates: Requirements 2.1**
    - Create only this file.
    - _Requirements: 2.1_
  - [x] 8.8 Write Property 6 in `NARR/properties/outcome.investigator.property.test.ts`
    - **Property 6: Outcomes are deterministic, exact and never reward a dangerous action**
    - **Validates: Requirements 14.2, 14.3, 14.5**
    - Create only this file.
    - _Requirements: 14.2, 14.3, 14.5_
  - [x] 8.9 Extend `NARR/conditions.test.ts`
    - Add example tests for `callRang`, `objectiveCompleted`, `outcomeSet`, `evidenceCountAtLeast` (true, false, boundary count).
    - Edit only `conditions.test.ts`.
    - _Requirements: 9.3_
  - [x] 8.10 Write `NARR/reducer.followup.test.ts`
    - Example tests: `RING_CALL` for `call.followup` is rejected before the callback closes, after a decision, and when already rung; accepted otherwise; sets `followup_rang`; hanging up tags `hung-up-on-followup`; `ev.second-number` is discoverable after the ring.
    - Create only this file.
    - _Requirements: 2.5, 10.7_

- [x] 9. Audio manifest contract and generator script
  - [x] 9.1 Create `VOICE/manifestTypes.ts`, `VOICE/hash.ts` and the asset path constant
    - `manifestTypes.ts`: `VOICE_MANIFEST_SCHEMA_VERSION`, `ClipStatus`, `VoiceClipEntry`, `VoiceManifest` exactly as design.md section 4. `hash.ts`: `fnv1a32(text): string` (8 hex digits). Add `CHAPTER1_VOICE_BASE = "/audio/chapter01"` to `SRC/config/assetPaths.ts`. These modules import only types from `NARR`.
    - Create `manifestTypes.ts`, `hash.ts`; edit `assetPaths.ts`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 9.2 Create `VOICE/selectClip.ts`
    - Implement `ClipChoice` and `selectClip` with the rules of design.md section 4 (present only; `english-voice` label only for a non-`en` locale when the setting is on and the English entry is present).
    - Create only this file.
    - _Requirements: 4.5, 12.4, 12.5_
  - [x] 9.3 Create `VOICE/renderManifest.ts`
    - `renderManifest(manifest): string` produces deterministic TypeScript source with the header comment "Generated by `scripts/generate-chapter1-voice.mjs`. Do not edit by hand.", sorted by `clipId` then locale, stable key order, `\n` line ends. Export a `parseManifestSource` helper for tests (evaluate the exported const safely without `eval` of untrusted input; the test helper may use a small literal parser or `new Function` only inside the test file).
    - Create only this file.
    - _Requirements: 4.1, 4.2_
  - [x] 9.4 Create `VOICE/voiceReport.ts`
    - `buildVoiceReport(manifest, lineTextFor)` returns counts per locale, status and origin and the list of `missing` entries with `clipId`, locale, speaker and line text. A dev preview line is never counted as `present`.
    - Create only this file.
    - _Requirements: 4.8, 6.7, 6.8_
  - [x] 9.5 Create `VOICE/buildVoiceJobs.ts`
    - `buildVoiceJobs(scenario, overlays, cast)` returns one job per Spoken_Node and locale: `{ clipId, graphId, speakerId, tone, locale, text, textHash, voice, rate, pitch, outWav, outMp3 }` with the cast table and tone rate multipliers of design.md section 10. Include the `VoiceJob` and `VoiceJobResult` JSON shapes that the PowerShell worker reads and writes, as exported types.
    - Create only this file.
    - _Requirements: 4.7, 4.9_
  - [x] 9.6 Write Property 9 in `VOICE/selectClip.property.test.ts`
    - **Property 9: Clip selection respects availability and labels**
    - **Validates: Requirements 4.4, 4.5, 5.1, 12.1, 12.4, 12.5**
    - Create only this file.
    - _Requirements: 4.5, 12.4, 12.5, 17.3_
  - [x] 9.7 Write Property 20 in `VOICE/renderManifest.property.test.ts`
    - **Property 20: Manifest source round trip**
    - **Validates: Requirements 4.1, 4.2**
    - Create only this file.
    - _Requirements: 4.1, 4.2_
  - [x] 9.8 Write Property 17 in `VOICE/voiceReport.property.test.ts`
    - **Property 17: The missing-clip report is exact**
    - **Validates: Requirements 4.8, 6.7, 6.8**
    - Create only this file.
    - _Requirements: 4.8, 6.8_
  - [x] 9.9 Write `VOICE/buildVoiceJobs.test.ts`
    - Example tests: job count equals Spoken_Nodes times 2; `system` nodes are skipped; `textHash` equals `fnv1a32(text)`; cast voices, rates and tone multipliers match the design; the Vietnamese text comes from the overlay.
    - Create only this file.
    - _Requirements: 4.7_
  - [x] 9.10 Create `apps/game/scripts/generate-chapter1-voice.ps1`
    - Read design.md section 10 step 4. Windows only. Reads a JSON job file; for each job creates a `Windows.Media.SpeechSynthesis.SpeechSynthesizer`, selects the voice by display name, sets `Options.SpeakingRate` and `Options.AudioPitch`, writes a 16 kHz mono WAV into `apps/game/.voice-cache/`, normalizes the peak to -3 dBFS in a small compiled C# helper (`Add-Type`), measures duration and RMS, encodes MP3 with `MediaTranscoder` (mono, 16000 Hz, 48000 bps, retry at 32000 bps if refused), and prints a JSON result list. No network call. Exit with a clear message before changing any file if the platform or speech API is missing; if a voice is not installed, return an error result for those jobs only.
    - Create only this file.
    - _Requirements: 4.7, 4.9, 4.10_
  - [x] 9.11 Create `apps/game/scripts/generate-chapter1-voice.mjs`, package scripts and `.gitignore` entry
    - Implement the steps of design.md section 10 (Vite `createServer` in middleware mode and `ssrLoadModule` to load scenario, overlay and `buildVoiceJobs`; skip fresh work by `sourceTextHash`, cast values and file existence; run the `.ps1` worker; verify MP3 frame sync, size limits and duration within 120 ms; write the manifest with `renderManifest`; print counts and every missing clip). Flags: `--locale`, `--only`, `--force`, `--dry-run`, `--print-script`, `--report`, `--strict`. Failed jobs become `missing`, `origin: "none"`, `credit: "not provided"`. Never write `present` for a file that was not verified. Add the three scripts `voice:chapter1`, `voice:script`, `voice:report` to `apps/game/package.json` and `apps/game/.voice-cache/` to the root `.gitignore`.
    - Create the `.mjs`; edit `apps/game/package.json` and `.gitignore`.
    - _Requirements: 4.6, 4.8, 4.10, 16.5_

- [x] 10. Generate the real voice clips
  - [x] 10.1 Probe the voices and dry-run the generator
    - From `d:\scam-maze` on Windows run `pnpm --filter @scammaze/game voice:script` and `pnpm --filter @scammaze/game voice:chapter1 -- --dry-run`. Confirm that Microsoft David, Mark, Zira (`en-US`) and Microsoft An (`vi-VN`) are installed (list the OneCore voices in a one-line PowerShell command). Record the probe result and the dry-run job count in the Baseline Record. If Microsoft An is absent, record that all Vietnamese clips will stay `missing`.
    - Edit only this tasks.md file.
    - _Requirements: 4.9, 4.6_
  - [x] 10.2 Run the generator for real
    - Run `pnpm --filter @scammaze/game voice:chapter1`. It writes `apps/game/src/game/voice/chapter1.manifest.ts` and `apps/game/public/audio/chapter01/<locale>/<nodeId>.mp3`. If the Vietnamese voice is missing, run `-- --locale en` and let the Vietnamese entries be written as `missing`. Do not hand-edit the manifest or fabricate any file.
    - Creates only generator output.
    - _Requirements: 4.4, 4.6, 4.9_
  - [x] 10.3 Verify and record the generated clips
    - Check with `Get-ChildItem apps/game/public/audio/chapter01 -Recurse -File` that every `present` manifest entry has an existing, non-empty `.mp3`, that no `.wav` file is in `public/`, and that `apps/game/.voice-cache/` is not tracked. Run `pnpm --filter @scammaze/game voice:report`. Record in the Baseline Record the count of `present`, `missing` and `placeholder-tts` clips per locale, total bytes per locale and the failures. State that sound quality and browser playback are not verified.
    - Edit only this tasks.md file.
    - _Requirements: 4.6, 4.8, 6.8_

- [x] 11. Content validator for subtitles, manifest and files
  - [x] 11.1 Create `SRC/game/content/validateChapterContent.ts` (checks V5, V6, V7)
    - Pure TypeScript, no Node import. Implement V5 (non-empty English line and Vietnamese overlay text for every Spoken_Node), V6 (manifest coverage, `clipId === nodeId`, `speakerId`, `sourceTextHash` freshness, known statuses, `present` has `sources`, `durationMs` and `bytes`, `missing` has none) and V7 (injected `fileInfo(publicPath)`: file exists, path under `/audio/chapter01/<locale>/`, MIME `audio/mpeg`, bytes equal, at most 150 KB per clip and 6 MB per locale, duration 0.5 to 25 s). Issues are `{ check, where, message }`.
    - Create only this file.
    - _Requirements: 13.1, 13.2, 4.5_
  - [x] 11.2 Write `SRC/game/content/validateChapterContent.test.ts`
    - Example tests on the real scenario, overlay and committed manifest, with `fileInfo` supplied from `node:fs` over `apps/game/public`. Expect no issue. Add broken-fixture examples for each of V5, V6, V7.
    - Create only this file.
    - _Requirements: 13.1, 17.1, 17.3_
  - [x] 11.3 Write Property 2 in `SRC/game/content/validateChapterContent.faults.property.test.ts`
    - **Property 2: The content validator detects injected faults**
    - **Validates: Requirements 4.2, 4.6, 9.2, 11.7, 13.1**
    - Apply one mutation from the 24-item catalogue of design.md section 3 to a deep copy; assert at least one issue naming the mutated item; assert the unmutated inputs return none.
    - Create only this file.
    - _Requirements: 13.1, 17.1_

- [x] 12. Checkpoint B - validator, manifest and generator
  - Run, one after the other: `pnpm test`, `pnpm typecheck`, `pnpm build`. Fix failures. If `validateChapterContent.test.ts` reports a stale hash, rerun task 10.2 for the affected clips. Ensure all tests pass, ask the user if questions arise.

- [x] 13. Commits: validator, voice contracts, clips
  - [x] 13.1 Commit the validator, solver and engine tests
    - Stage by name the files of tasks 8.1 to 8.10. Commit `test(game): add scenario validator, reachability solver and engine tests` with the trailer.
    - _Requirements: 18.2_
  - [x] 13.2 Commit the voice contracts, generator scripts and content validator
    - Stage by name: the files of tasks 9.1 to 9.11 and 11.1 to 11.3 (including `apps/game/package.json`, `.gitignore`, `SRC/config/assetPaths.ts`), but not `chapter1.manifest.ts` and not `public/audio/**`. Commit `feat(game): add voice manifest contract, TTS generator script and content validator` with the trailer.
    - _Requirements: 18.2_
  - [x] 13.3 Commit the generated manifest and clips
    - Stage `VOICE/chapter1.manifest.ts` and each `.mp3` listed as `present` in it (enumerate them with `Get-ChildItem` and pass explicit paths to `git add`). Commit `feat(game): add generated Chapter 1 voice clips and manifest` with a body stating the real counts per locale and that the redistribution terms are not verified, plus the trailer.
    - _Requirements: 4.9, 18.2_

- [x] 14. Voice player and Web Audio graph
  - [x] 14.1 Create `VOICE/audioPort.ts` and `VOICE/mixPlan.ts`
    - `audioPort.ts`: `LoadedClip`, `PlaybackHandle`, `AudioPort`, `PreviewPort` and `StopReason` types only (design.md section 4). `mixPlan.ts`: the constants of the mix table and pure functions `voiceGain`, `effectivePauseMs`, `tensionGain`, `ringtoneGain`, `ambienceGain`, all within the 0.2 linear peak cap. Neither imports React or Three.js.
    - Create these two files.
    - _Requirements: 5.13, 11.3, 11.10_
  - [x] 14.2 Create the test double `SRC/test/fakeAudioPort.ts`
    - Implement `AudioPort` with manual control: completion of `load`, `fireEnded(id)`, `failLoad(url)`, `refuseResume()`, counters of live handles, timers and listeners, a fake clock and fake `setTimer`/`clearTimer`, and a fake `speechSynthesis` for `PreviewPort`.
    - Create only this file.
    - _Requirements: 17.2, 17.6_
  - [x] 14.3 Create the pure choice gate `VOICE/optionsGate.ts`
    - Implement the gate rule of design.md section 5 as a pure function of a minimal input type it defines itself (`phase`, `audible`, `durationMs`, `endedAt`, node `waitForVoice`, elapsed times, skip), so it does not import `VoiceDialoguePlayer.ts`. This extracts the gate from `useOptionsGate` so Property 14 can test it; record this small deviation in the Baseline Record.
    - Create only this file.
    - _Requirements: 5.9, 5.10_
  - [x] 14.4 Create `VOICE/VoiceDialoguePlayer.ts`
    - Implement `createVoiceDialoguePlayer` with the state machine, `playId` stale-callback rule, synchronous `stop`, `dispose`, `LATE_CLIP_MS`, prefetch cache (8 buffers, LRU, concurrency 2), once-per-clip failure log, mute flag, `replay` unmuting first, `pause`/`resume` with offset, gain rules, `selectClip` use, dev preview hand-off. It never throws and never touches the narrative store.
    - Create only this file.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7, 5.8, 5.11, 5.12, 5.13_
  - [x] 14.5 Create `VOICE/devSpeechPreview.ts`
    - `PreviewPort` over `speechSynthesis`, created only when `import.meta.env.DEV` or `import.meta.env.VITE_DEV_VOICE_PREVIEW === "true"`. A pure `pickPreviewVoice(voices, locale)` returns a voice whose `lang` starts with the locale tag or `null`. Silent when none matches. Follows stop, mute and dispose.
    - Create only this file.
    - _Requirements: 6.2, 6.3, 6.5, 6.6_
  - [x] 14.6 Create `VOICE/webAudioEngine.ts`
    - Real `AudioPort` plus ringtone, connect click, ambience and tension, one lazily created `AudioContext`, the graph of design.md "Web Audio graph" (phone filter high-pass 300 Hz and low-pass 3400 Hz Q 0.707, master gain, `DynamicsCompressor` limiter, all gains capped by `PEAK_CAP`). `supported` is false when the constructor is missing. `dispose` closes only the context it created.
    - Create only this file.
    - _Requirements: 5.5, 11.10, 15.1, 15.3, 15.4, 15.6_
  - [x] 14.7 Write Property 19 in `VOICE/mixPlan.property.test.ts`
    - **Property 19: The mix plan stays inside its caps**
    - **Validates: Requirements 11.3, 11.10, 15.4, 15.5**
    - Create only this file.
    - _Requirements: 11.3, 11.10, 15.4_
  - [x] 14.8 Write Property 10 and Property 11 in `VOICE/VoiceDialoguePlayer.property.test.ts`
    - **Property 10: At most one clip is audible**
    - **Property 11: Stopping is immediate and releases everything**
    - **Validates: Requirements 5.3, 5.4, 6.6, 15.6**
    - Use `fakeAudioPort`; load and ended callbacks complete in random order, including stale ones; also run with the dev preview port.
    - Create only this file.
    - _Requirements: 5.3, 5.4, 6.6, 15.6_
  - [x] 14.9 Write Property 12 and Property 13 in `VOICE/VoiceDialoguePlayer.failures.property.test.ts`
    - **Property 12: Failures fall back to captions and are logged once**
    - **Property 13: Audibility, gain and caption visibility are consistent**
    - **Validates: Requirements 5.5, 5.7, 5.11, 7.3, 7.6, 15.3**
    - Create only this file.
    - _Requirements: 5.5, 5.7, 5.11, 7.3, 7.6, 15.3_
  - [x] 14.10 Write Property 14 in `VOICE/optionsGate.property.test.ts`
    - **Property 14: The choice gate always opens**
    - **Validates: Requirements 5.9**
    - Create only this file.
    - _Requirements: 5.9_
  - [x] 14.11 Write Property 18 in `VOICE/devSpeechPreview.property.test.ts`
    - **Property 18: The dev preview never speaks with the wrong language**
    - **Validates: Requirements 6.5**
    - Create only this file.
    - _Requirements: 6.5_
  - [x] 14.12 Write example tests in `VOICE/VoiceDialoguePlayer.test.ts`
    - Cover: correct clip per node and locale; quick node changes never overlap; replay restarts the latest line and changes no state; hang-up and dispose stop within the same call and remove listeners; mute and volume 0; blocked autoplay shows `blocked` and Replay works after unlock; missing and failing clips fall back; late clip (over 1500 ms) is skipped; English clip is labeled `english-voice` and never as Vietnamese; pause and resume.
    - Create only this file.
    - _Requirements: 17.2, 17.3_
  - [x] 14.13 Write `VOICE/webAudioEngine.test.ts`
    - With a minimal stub `AudioContext` on `globalThis`, check: graph creation is lazy, `supported` is false without the constructor, gains never exceed the cap, `dispose` closes the context. No real audio device.
    - Create only this file.
    - _Requirements: 15.1, 17.6_
  - [x] 14.14 Write `VOICE/boundaries.test.ts`
    - Scan every `.ts` file under `VOICE` (same scanner approach as `NARR/boundaries.test.ts`) and fail on imports of React, `react-dom`, Three.js, R3F, Drei, i18next, Zustand or Dexie. Allow `game/narrative` and `@scammaze/shared-types`.
    - Create only this file.
    - _Requirements: 5.13, 16.3_

- [x] 15. Settings, migration and Settings screen
  - [x] 15.1 Extend `GameSettings` in `packages/shared-types/src/index.ts`
    - Add `ReducedMotionSetting` and the six fields `voiceVolume`, `subtitlesEnabled`, `reducedStress`, `reducedMotion`, `phoneVoiceFilter`, `englishVoiceFallback`. Keep the six existing fields unchanged.
    - Edit only this file.
    - _Requirements: 11.1_
  - [x] 15.2 Update `SRC/app/settingsStorage.ts`
    - Add the defaults (`1.0`, `true`, `false`, `"system"`, `true`, `false`) to `DEFAULT_SETTINGS`. After the legacy merge, run `sanitizeNewFields`: `voiceVolume` finite and clamped to 0..1 (else 1.0), booleans must be booleans, `reducedMotion` one of three strings, else defaults. Legacy fields keep their behavior. Storage key stays `scammaze_settings_v1`.
    - Edit only this file.
    - _Requirements: 11.1, 11.2_
  - [x] 15.3 Write Property 15 (parsing) in `SRC/app/settingsStorage.property.test.ts`
    - **Property 15: Settings parsing is total, bounded and idempotent**
    - **Validates: Requirements 11.2, 11.4**
    - Add the seeded property for random stored JSON, plus examples: an old stored object (five legacy fields only) loads with defaults for the six new fields and keeps its values.
    - Edit only this file.
    - _Requirements: 11.2_
  - [x] 15.4 Add the six fields to `GameSettings` fixtures in other tests
    - In `SRC/app/App.i18n.test.tsx`, `SRC/features/chapter1/accessibility.test.tsx`, `SRC/features/chapter1/call/ChapterOnePage.call.test.tsx`, `SRC/features/chapter1/ChapterOnePage.test.tsx`, `SRC/features/chapter1/ChapterOnePage.restore.test.tsx` and the test that holds `applyLocale` properties (find it with `rg "applyLocale" SRC --glob "*.test.*"`), spread `DEFAULT_SETTINGS` into each `GameSettings` literal. Do not touch `settingsStorage.property.test.ts` or `SettingsModal.test.tsx`.
    - _Requirements: 13.7_
  - [x] 15.5 Create `SRC/components/ui/useReducedMotion.ts` and `F1/comfort/ComfortProvider.tsx`
    - `useReducedMotion()` reads the provider and falls back to the OS query when there is no provider (leave `usePrefersReducedMotion.ts` unchanged). `ComfortProvider` publishes `{ reducedMotion, reducedStress, subtitlesEnabled }`, where effective reduced motion is `on`, or `system` and the OS query matches. Export a pure `effectiveReducedMotion(setting, osQuery)`.
    - Create these two files.
    - _Requirements: 11.4, 11.3_
  - [x] 15.6 Write the motion part of Property 15 in `F1/comfort/comfort.property.test.ts`
    - **Property 15: Settings parsing is total, bounded and idempotent**
    - **Validates: Requirements 11.2, 11.4**
    - Test `effectiveReducedMotion` over all setting and OS combinations, and that a component outside the provider keeps the OS behavior.
    - Create only this file.
    - _Requirements: 11.4_
  - [x] 15.7 Add settings and prologue strings in `SRC/i18n/locales/{en,vi}/settings.ts` and `menu.ts`
    - Add every `settings:*` key of design.md section 8 table (voice heading, voice volume, captions, phone filter, English fallback, reduced stress and hint, motion heading and three options, toggle on and off) and change `menu:prologue.location` to "A city street · Morning" / "Một con phố trong thành phố · Buổi sáng". Edit en first, then vi.
    - Edit those four files only.
    - _Requirements: 11.1, 12.3, 12.8_
  - [x] 15.8 Add the "Voice and comfort" section to `SRC/features/menu/SettingsModal.tsx`
    - Controls: Voice volume slider (only when sound is on), Captions toggle, Phone speaker effect toggle, English voice fallback toggle (only when the language is Vietnamese), Reduced-stress toggle with hint, three-option radio group for reduced motion. Native elements, existing classes, all text through i18n keys. Master volume for chapter audio remains `sfxVolume`.
    - Edit only this file.
    - _Requirements: 11.1, 11.8, 11.9_
  - [x] 15.9 Extend `SRC/features/menu/SettingsModal.test.tsx`
    - Example tests: each new control renders, is keyboard operable, writes the right field, and conditional controls appear only in their condition; labels exist in both locales.
    - Edit only this file.
    - _Requirements: 11.1, 11.8_

- [x] 16. Checkpoint C - voice player and settings
  - Run, one after the other: `pnpm test`, `pnpm typecheck`, `pnpm build`. Fix failures. Ensure all tests pass, ask the user if questions arise.

- [x] 17. Commits: voice player, settings
  - [x] 17.1 Commit the voice player and audio engine
    - Stage by name the files of tasks 14.1 to 14.14 (including `SRC/test/fakeAudioPort.ts`). Commit `feat(game): add voice dialogue player, choice gate and Web Audio engine` with the trailer.
    - _Requirements: 18.2_
  - [x] 17.2 Commit settings and migration
    - Stage by name the files of tasks 15.1 to 15.9. Commit `feat(game): add voice, caption, reduced-stress and reduced-motion settings` with the trailer.
    - _Requirements: 18.2_

- [x] 18. Phone call UI updates
  - [x] 18.1 Add phone UI strings in `SRC/i18n/locales/{en,vi}/chapter1/phone.ts`
    - Add the `phone.call.*` and `phone.sound.*` keys of design.md section 8 (duration, mute, unmute, replay, listening, showReplies, the four notices, ringing, connected). English first, then Vietnamese.
    - Edit those two files only.
    - _Requirements: 7.8, 11.6, 12.3_
  - [x] 18.2 Add HUD strings in `SRC/i18n/locales/{en,vi}/chapter1/hud.ts`
    - Add `hud.act.label` ("Act {{number}}: {{title}}"), `hud.saveTrimmed.message` and `hud.saveTrimmed.dismiss`. English first, then Vietnamese. No concatenation.
    - Edit those two files only.
    - _Requirements: 12.3, 13.5_
  - [x] 18.3 Create `F1/voice/useCallDuration.ts`
    - Whole seconds since the call became `active`, from a presentation clock (`performance.now()`), frozen while paused, reset per call, never stored in the store or saves.
    - Create only this file.
    - _Requirements: 7.5_
  - [x] 18.4 Update `F1/call/PhoneScreenUI.tsx`
    - Add only optional props `controls?: CallControlsView`, `onToggleMute`, `onReplay` (design.md section 6). Active layout: avatar (hidden when `compact`), name, number (`dir="ltr"`, plain text), status, duration as `<time role="timer">`, notice line, existing caption region, Mute (`aria-pressed`, `Volume2`/`VolumeX`), Replay (`RotateCcw`, never remounted), Hang up. Without the new props the output must be identical to today.
    - Edit only this file.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 7.8, 7.9, 7.10, 11.9_
  - [x] 18.5 Update `F1/call/PlayerChoiceOverlay.tsx`
    - Add optional `waiting` and `onSkipWait`. While waiting: a status line, one "Show replies now" button that takes focus, number keys off. When waiting ends the first option is focused. Layout, region and keyboard logic unchanged.
    - Edit only this file.
    - _Requirements: 5.9, 8.1, 8.3, 8.6, 8.9_
  - [x] 18.6 Create `F1/voice/useVoicePlayback.ts`
    - Create one player per mount (disposed on unmount) over `webAudioEngine`, build `VoiceTarget` from `selectDialogueView` and `state.call` (phone or face-to-face), call `show`/`stop` with the right reason, `configure` on settings and locale changes (locale change stops the clip and starts none), `pause`/`resume` with the pause overlay, prefetch Act 1 and Act 2 nodes and the next nodes, and return `{ snapshot, muted, unlock, replay, setMuted, optionsWaiting, skipWait }`. Use `optionsGate.ts`. Mute resets per call.
    - Create only this file.
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.9, 12.1, 12.6, 4.11_
  - [x] 18.7 Create `F1/voice/useCallAudio.ts`
    - Ringtone while the call is `ringing`, connect click on `active`, tension level from `state.pressure` while a call is active, with reduced-stress factors; stop all on call end, pause menu and unmount.
    - Create only this file.
    - _Requirements: 11.3, 15.1, 15.4, 15.6_
  - [x] 18.8 Update `F1/call/CallPresentation.tsx`
    - Pass the controller state to `PhoneScreenUI` (`controls`, notice, mute, replay) and `PlayerChoiceOverlay` (`waiting`, `onSkipWait`), show the non-speech captions ("Phone ringing", "Call connected") through the notice line, keep the single dispatch guard, and call `voice.unlock()` inside the Answer click handler. Props for voice are optional so existing tests still pass.
    - Edit only this file.
    - _Requirements: 7.1, 7.2, 8.4, 11.6, 5.5_
  - [x] 18.9 Update `F1/dialogue/DialoguePanel.tsx`
    - Add an optional `voice` prop with a Replay button and the notice line. The text card is always visible (the Subtitles setting affects only the phone caption).
    - Edit only this file.
    - _Requirements: 7.11_
  - [x] 18.10 Write Property 21 in `F1/voice/useCallDuration.property.test.tsx`
    - **Property 21: The call duration is whole seconds and presentation only**
    - **Validates: Requirements 7.5**
    - Create only this file.
    - _Requirements: 7.5_
  - [x] 18.11 Write `F1/call/PhoneScreenUI.controls.test.tsx`
    - Example tests: ringing and active content; duration element; Mute `aria-pressed` and label change; Replay disabled states; caption hidden only when `captionVisible` is false; no player option inside the phone tree; number as plain text with `dir="ltr"`; no emoji; the compact layout keeps two caption lines at `layout.screen.height` 288 using `computeCallLayout` numbers; absent props render as before.
    - Create only this file.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.9, 11.9_
  - [x] 18.12 Write `F1/call/PlayerChoiceOverlay.gate.test.tsx`
    - Example tests: waiting state hides options and shows one Skip button with focus; number keys off while waiting; focus moves to the first option when waiting ends; no change when `waiting` is absent.
    - Create only this file.
    - _Requirements: 5.9, 8.3_
  - [x] 18.13 Write `F1/dialogue/DialoguePanel.voice.test.tsx`
    - Example tests: Replay calls the controller; notice text appears for `english-voice` and `no-audio`; text card always visible; keyboard focus stays on Replay after activation.
    - Create only this file.
    - _Requirements: 7.11, 8.6_

- [x] 19. Evidence, follow-up call, endings and credits
  - [x] 19.1 Add the follow-up trigger to `F1/useCallTriggers.ts`
    - Add a second pure function `stepFollowupTrigger` (45 s after the callback is `ended` or `declined`, only while no decision exists and the phone is free; once only). Leave `stepCallTriggers` untouched.
    - Edit only this file.
    - _Requirements: 2.5, 10.7_
  - [x] 19.2 Write `F1/useCallTriggers.followup.test.ts`
    - Example tests: no ring before 45 s, rings once at 45 s, never with a live call, a conversation or a decision, never twice.
    - Create only this file.
    - _Requirements: 2.5_
  - [x] 19.3 Write `C1/evidenceCoverage.test.ts`
    - Check that each of the 15 evidence items has a discovery that maps to an existing interactable, device screen or dialogue node, that no new interactable or 3D object was added by this feature, that each evidence type of requirement 10.2 is covered, and that no evidence needs a long exchange with a scammer for the investigator set.
    - Create only this file.
    - _Requirements: 10.2, 10.3, 14.5_
  - [x] 19.4 Show the act label in `F1/hud/ObjectiveTracker.tsx`
    - Show `hud.act.label` from `selectCurrentAct`. Keep existing behavior and accessible names.
    - Edit only this file.
    - _Requirements: 2.1, 2.8_
  - [x] 19.5 Add the investigator icon in `F1/ending/EndingTransition.tsx`
    - Add `FileCheck` (lucide-react) to the outcome icon map for `investigator`, decorative with `aria-hidden="true"`, paired with text.
    - Edit only this file.
    - _Requirements: 14.1, 14.6_
  - [x] 19.6 Add the voice credits entry
    - In `SRC/config/credits.ts` add group `audio` and item `chapter1Voices` (name "Chapter 1 voice clips", creator text, source `apps/game/scripts/generate-chapter1-voice.ps1`, license "Terms of use not verified (see docs/PROJECT_PROGRESS.md)"). Add `groups.audio.category` and `items.chapter1Voices.notes` to `SRC/i18n/locales/{en,vi}/credits.ts`, English first. Do not add credits for pre-existing audio (flag it as gap G16 in the Baseline Record).
    - Edit those three files only.
    - _Requirements: 4.10_
  - [x] 19.7 Create `F1/hud/SaveTrimmedNotice.tsx`
    - A dismissible, localized, polite notice using `hud.saveTrimmed.*`, native button, visible focus, no emoji.
    - Create only this file.
    - _Requirements: 13.5_
  - [x] 19.8 Update credit and chapter dictionary tests
    - Find tests that enumerate credit group and item IDs (`rg "CreditGroupId|CreditItemId|credits" SRC --glob "*.test.*"`) and add the new IDs, keeping en and vi parity.
    - Edit only those test files; list them in the Baseline Record.
    - _Requirements: 12.3, 13.7_

- [x] 20. Save restore leniency
  - [x] 20.1 Add lenient restore to `SRC/game/saves/chapterProgress.ts`
    - `restoreProgress(..., { lenient: true })` replays the actions in order, stops at the first rejected action, and returns the state after the last accepted action with `trimmed: true` and `acceptedActions: n`. More than 1000 actions or a non-finite pose stay hard failures. A fully accepted log returns `trimmed: false`. `encodeProgress` stays unchanged.
    - Edit only this file.
    - _Requirements: 13.4, 13.5, 13.6_
  - [x] 20.2 Use lenient restore in `SRC/game/loading/chapterLoader.ts` and `SRC/game/chapters/chapterSession.ts`
    - A trimmed restore is a success that carries a notice flag; zero accepted actions starts the chapter at the beginning with the same notice. Keep `invalid-save` only for damaged data (too many actions, non-finite pose).
    - Edit only these two files.
    - _Requirements: 13.5_
  - [x] 20.3 Write Property 16 in `SRC/game/saves/chapterProgress.lenient.property.test.ts`
    - **Property 16: Lenient restore returns the longest accepted prefix**
    - **Validates: Requirements 13.4, 13.5**
    - Create only this file.
    - _Requirements: 13.4, 13.5_
  - [x] 20.4 Extend `SRC/game/saves/chapterProgress.test.ts` and `SRC/game/loading/chapterLoader.test.ts`
    - Add: `encodeProgress` output has exactly `checkpointId`, `actions`, `playerPose` (no audio, duration, caption or locale); the loader returns a success with the trimmed notice for a drifted log, and `invalid-save` only for damaged data.
    - Edit only these two files.
    - _Requirements: 13.5, 13.6_
  - [x] 20.5 Write `C1/savedPathsStillReplay.test.ts`
    - Copy the four action logs of `playthroughs.test.ts` as frozen fixtures (read that file; do not edit it) and assert that each is fully accepted by the new scenario and restored with `trimmed: false`.
    - Create only this file.
    - _Requirements: 13.4, 13.7_

- [x] 21. Checkpoint D - phone UI, follow-up, endings, saves
  - Run, one after the other: `pnpm test`, `pnpm typecheck`, `pnpm build`. Fix failures. Ensure all tests pass, ask the user if questions arise.

- [x] 22. Commits: phone UI, follow-up and endings, saves
  - [x] 22.1 Commit the phone call UI
    - Stage by name the files of tasks 18.1 to 18.13. Commit `feat(game): add voice-call controls, captions and choice gate to the phone UI` with the trailer.
    - _Requirements: 18.2_
  - [x] 22.2 Commit follow-up call, endings, act label and credits
    - Stage by name the files of tasks 19.1 to 19.8. Commit `feat(game): add follow-up call trigger, investigator ending icon, act label and voice credits` with the trailer.
    - _Requirements: 18.2_
  - [x] 22.3 Commit lenient save restore
    - Stage by name the files of tasks 20.1 to 20.5. Commit `feat(game): restore old saves to the last accepted action with a notice` with the trailer.
    - _Requirements: 18.2_

- [x] 23. Page integration and new tests
  - [x] 23.1 Wire everything in `F1/ChapterOnePage.tsx`
    - Create the voice controller (`useVoicePlayback`, `useCallAudio`, `useCallDuration`), call `voice.unlock()` inside `handleBegin` and `handleAnswerCall`, pass `voice` and settings to `CallPresentation` and the dialogue overlay, wrap the content in `ComfortProvider`, apply the follow-up trigger, show `SaveTrimmedNotice` from the loader result, and keep `pause`/`resume` tied to the pause overlay. Verify `ChapterOneCanvas.tsx` already receives the effective `reducedMotion` and change it only if it does not.
    - Edit only `ChapterOnePage.tsx` (and `ChapterOneCanvas.tsx` only if required, naming it in the final message).
    - _Requirements: 5.5, 11.3, 11.4, 13.5, 16.3_
  - [x] 23.2 Write `F1/ChapterOnePage.voice.test.tsx`
    - With `fakeAudioPort` injected: pressing Begin and Answer unlock audio; a full run reaches an ending and the debrief with AI off and no microphone; the caption and replay work with sound off; a language switch keeps the state and stops the clip; the trimmed notice appears for a drifted save; the 3D phone UI is used and choices render outside the phone.
    - Create only this file.
    - _Requirements: 17.2, 17.3, 17.4, 16.6_
  - [x] 23.3 Write Property 7 in the existing equivalence test `F1/call/callPresentation.voiceEquivalence.property.test.tsx`
    - **Property 7: Presentation equivalence**
    - **Validates: Requirements 8.1, 8.4, 8.8**
    - At least 100 seeded cases per call graph, each with `PROPERTY_TIMEOUT_MS = 60_000`. Create this new file next to the existing equivalence tests and leave those untouched.
    - Create only this file.
    - _Requirements: 8.1, 8.4, 8.8, 17.5_
  - [x] 23.4 Write Property 8 in `NARR/properties/audioIndependence.property.test.ts`
    - **Property 8: The core is independent of audio, locale and settings**
    - **Validates: Requirements 5.8, 5.10, 7.7, 8.5, 12.6, 13.6**
    - Create only this file.
    - _Requirements: 5.8, 5.10, 12.6, 13.6_
  - [x] 23.5 Add new playthrough runs to `NARR/chapter1/playthroughs.test.ts`
    - Add four runs: investigator ending (report filed, 8 of 11 evidence items), callback exposed after the official line, follow-up with money moved (risky), follow-up hang-up. Use real option IDs; do not edit the existing four runs.
    - Edit only this file.
    - _Requirements: 14.1, 17.1_
  - [x] 23.6 Extend `F1/accessibility.test.tsx`
    - Add: keyboard-only flow for answering, muting, replaying, choosing an option and reading the debrief; the new controls have accessible names and visible focus classes; Settings voice controls are labeled.
    - Edit only this file.
    - _Requirements: 11.8, 11.9, 17.4_
  - [x] 23.7 Write `F1/noAuthoredText.test.ts`
    - Scan the new and changed components (`PhoneScreenUI.tsx`, `PlayerChoiceOverlay.tsx`, `CallPresentation.tsx`, `DialoguePanel.tsx`, `SaveTrimmedNotice.tsx`, `useVoicePlayback.ts`, `useCallAudio.ts`) and fail on string literals that look like authored dialogue or user-facing sentences outside i18n calls; also fail on emoji and on the word "safe" in UI strings.
    - Create only this file.
    - _Requirements: 16.1, 12.3_

- [x] 24. Missing-clips report and counts
  - [x] 24.1 Produce the missing-clips report and the content counts
    - Run `pnpm --filter @scammaze/game voice:report` and record in the Baseline Record the counts per locale and status and origin, the full list of `missing` clips (clipId, locale, speaker, line text), and the number of voice clips implemented vs missing. Measure node, Spoken_Node, option, evidence, objective, call and ending counts with a temporary script under `apps/game/scripts/tmp-count.mjs` (load the scenario with Vite `ssrLoadModule`), record them, then delete the script. State that playtime is not measured.
    - Edit only this tasks.md file (and create then delete the temporary script).
    - _Requirements: 3.1, 3.5, 4.8, 18.6_

- [x] 25. Architecture and accessibility documentation
  - [x] 25.1 Update `docs/architecture/OVERVIEW.md`
    - In sections 4.2 and 4.3 describe the voice module, the audio graph, the manifest, the generator and lenient restore with status labels (`IMPLEMENTED` only for what was verified in this feature, `PLANNED` otherwise). In section 9 keep the seeded-generator deviation note. Record the optionsGate extraction. No cost change: no new service was added.
    - Edit only this file.
    - _Requirements: 18.7_
  - [x] 25.2 Update `ACCESSIBILITY.md`
    - Document captions, mute, replay, reduced-stress, reduced motion and the keyboard flow, and list what is not verified (screen reader behavior, sound quality).
    - Edit only this file.
    - _Requirements: 11.5, 11.8, 18.7_

- [x] 26. Checkpoint E - final verification
  - Run, one after the other, from `d:\scam-maze`: `pnpm test`, then `pnpm typecheck`, then `pnpm build`, and then the two `tsc --noEmit` commands (`tsconfig.app.json`, `tsconfig.test.json`). Record exit status and counts. Run `pnpm --filter @scammaze/game voice:report` once more. Fix failures; do not describe the feature as complete if any command fails. Ensure all tests pass, ask the user if questions arise.

- [x] 27. Progress document
  - [x] 27.1 Update `docs/PROJECT_PROGRESS.md`
    - Add one entry (newest first) with the nine mandatory items of AGENTS.md section 6: date and title; objective; completed work (voice clips implemented vs missing per locale, node counts, option count against the 80 to 120 target, evidence, objectives, endings); files created, modified, deleted; validation commands; real baseline and final test, typecheck and build counts from the Baseline Record and checkpoint E; unresolved issues (redistribution terms not verified, one male Vietnamese voice, quality not judged, MP3 playback not verified in browsers, playtime not measured, option count above target, `apartment` scene absent, credits missing for older audio); deviations (MP3 not Opus, `/audio/chapter01/` path, `placeholder-tts` unused, extracted `optionsGate.ts`, seeded generator instead of a property library, Act 1 in the street, lenient restore, Act 1 title "morning"); follow-ups.
    - Inside the same entry add a "Manual playtest checklist" subsection with these unchecked items: play start to end and time it with the ending reached; listen to every English and Vietnamese clip for clarity; confirm MP3 playback in Chrome, Firefox, Safari and on a phone; test autoplay in a fresh browser profile; test the blocked-autoplay notice; test screen reader behavior on the caption and notice lines; confirm keyboard-only play; run the generator once with the network off; owner check of the redistribution terms of the generated audio before any public release.
    - Also record: the update list of existing tests with reasons, the audit results of task 1.2, and the missing-clips report from task 24.1. Mark nothing complete that was not verified. Chapter 1 is not "complete" until a human has played it.
    - Edit only `docs/PROJECT_PROGRESS.md`.
    - _Requirements: 1.1, 1.3, 1.4, 13.7, 14.8, 14.9, 17.7, 17.8, 18.5, 18.6_

- [ ] 28. Commits: integration and documentation
  - [x] 28.1 Commit page integration and new tests
    - Stage by name the files of tasks 23.1 to 23.7 (plus `ChapterOneCanvas.tsx` only if 23.1 changed it). Commit `feat(game): wire Chapter 1 voice playback into the chapter page and add integration tests` with the trailer.
    - _Requirements: 18.2_
  - [-] 28.2 Commit documentation
    - Stage by name `docs/architecture/OVERVIEW.md`, `ACCESSIBILITY.md`, `docs/PROJECT_PROGRESS.md` and this `tasks.md` (only if `git ls-files .kiro/specs` shows the specs are tracked). Commit `docs: record Chapter 1 voice narrative results and architecture` with the trailer.
    - _Requirements: 18.2, 18.5_

- [ ] 29. Push
  - [~] 29.1 Push the branch without force
    - Run `git branch --show-current` (must be `feat/chapter-01-voice-narrative`), `git status --short` (nothing of this feature left unstaged) and `git log --oneline -15`. Then `git push -u origin feat/chapter-01-voice-narrative`. No force option, no merge, no pull request merge, no push to `main`. Report the pushed commit list. The owner or another person merges.
    - _Requirements: 18.3_

## Notes

- Test sub-tasks are required in this plan (no `*` optional marker), as the owner decided.
- Order deviation, on purpose: the "keep existing tests green" updates (task 5) and `chapterRuns.ts` (task 3.12) come right after the content and overlay, before the validator, so every checkpoint and commit is green. The commit tasks sit after their checkpoints.
- Checkpoints (tasks 6, 12, 16, 21, 26) are not in the dependency graph. Each runs after the wave named below and before the next wave starts: A after wave 8, B after wave 16, C after wave 19, D after wave 23, E after wave 26.
- A wave may contain one commit task at most. Commit tasks stage only named files, so other tasks in the same wave may keep working on files that the commit does not stage.
- Tasks in the same wave edit different files. Tasks 4.1, 4.2 and 4.3 share `OVL/dialogues.ts`, so they are in different waves. Tasks 1.1, 1.2, 10.1, 10.3 and 24.1 write to the Baseline Record in this file, so they are also in different waves.
- If a task changes English line text after clips were generated, rerun task 10.2 for the affected clips; the validator (V6) reports stale hashes.
- Each property test file carries the tag comment `// Feature: chapter-01-voice-narrative, Property N: <title>`, uses at least 100 seeded cases and `PROPERTY_TIMEOUT_MS = 60_000`.
- The sub-agent must not start the dev server or any watcher. Use `vitest run` only.

## Baseline Record

Filled in by tasks 1.1, 1.2, 5.x, 8.2, 10.1, 10.3, 14.3, 19.6, 24.1 and copied into the progress doc by task 27.1.

- Branch and base commit: `feat/chapter-01-voice-narrative` already existed and was checked out (not recreated); tip `f185ccf` (contains the phone branch and main merged). This differs from the `8c93d27` written in task 1.1, as the owner expected. Uncommitted before the run: only this file and `tasks.meta.json`.
- Baseline `pnpm test`: exit 0. 82 test files passed, 0 failed (82 total). 756 tests passed, 0 failed (756 total). Skipped: none reported. Duration 60.93 s.
- Baseline `pnpm typecheck`: exit 0 (shared-types, landing and game all Done, no errors).
- Baseline `pnpm build`: exit 0. Game main JS chunk `dist/assets/index-DmihYyt0.js` 1,894.05 kB (gzip 538.88 kB), built in 14.22 s. Landing JS `index-DW2A16ld.js` 300.55 kB (gzip 92.95 kB).
- Baseline node, option and evidence counts (re-confirmed by reading `NARR/chapter1/dialogues/*.ts`, `evidence.ts`, `objectives.ts`): 4 graphs, 26 nodes (scamCall 10, callback 5, officialLine 5, shopkeeper 6), 18 Spoken_Nodes (speaker caller or npc: 7, 3, 3, 5), 39 options (19, 8, 5, 7), 11 evidence items, 5 objectives. Matches the design.md audit values.
- Audit results and corrections (task 1.2, read-only audit, paths relative to `apps/game/src`; branch confirmed `feat/chapter-01-voice-narrative`):
  - Confirmed against the code, every design.md "Audit findings" row checked: `types.ts` closed shapes; `ids.ts` closed ID lists; `reducer.ts` (`RING_REASONS` line 97 has 4 reasons, `INCOMING_CALL_IDS` line 98 has `call.scam-1` and `call.callback`, `hangUpTag` line 255); `dialogueEngine.ts` generic, `startNodeWhen` honored in the start-node selector; `outcome.ts` (`selectOutcome(state)` line 20, no scenario parameter); `selectors.ts` (`CALL_LOG_EVIDENCE` line 67, ring candidates lines 470 and 477); `validateScenario.ts` (reference, duplicate option, end-reachable and independent-channel checks only; no tone, speaker, count or reachability check); `boundaries.test.ts` (non-test allowlist is only `game/scenes/MainMenuScene/streetPlayArea.ts`; test allowlist adds `test/seededRandom.ts` and `test/chapterRuns.ts`); `test/chapterRuns.ts` (`INCOMING_CALLS` line 55 hard-codes the two calls); `chapterProgress.ts` (any rejected action gives `actionRejected`, line 80); `chapterLoader.ts` (invalid replay becomes `invalid-save`, lines 150-154 and 247-252); `PlayerChoiceOverlay.tsx` (number keys and `autoFocus: true`, no waiting state); `useCallTriggers.ts` (fixed timer constants and `stepCallTriggers`); `SettingsModal.tsx` (one slider writes `musicVolume` and `sfxVolume` together, lines 174-179); `config/credits.ts` (`CreditGroupId` = environments, vehicles, project; no audio entry); `chapterRegistry.ts` (`sceneIds: ["apartment", "street"]`, `startSceneId: "street"`); `usePrefersReducedMotion` reads only the OS media query. Not re-confirmed this task: the `i18n/narrative.test.ts` "every key has non-empty Vietnamese text" rule beyond reading its lint-walker copy, and the baseline counts (already re-confirmed in 1.1).
  - Caller line today (`features/chapter1/call/PhoneScreenUI.tsx`): `CallScreenView` active has `line: { speakerName, text } | "connecting" | null`. The line renders inside one stable `aria-live="polite"` `aria-atomic` region (`data-testid="call-line-region"`, `tabIndex={-1}`, scrollable) as a `UI.card` (`data-testid="dialogue-line"`) with the speaker name and the text. No duration, no mute or replay control, no caption-size or voice props. Only the OS reduced-motion query is used, for the ringing icon wobble. Requirement 7 gaps are real.
  - Stored settings merge (`app/settingsStorage.ts`): confirmed. `parseStoredSettings` does `{ ...DEFAULT_SETTINGS, ...parsed }`, so missing keys get defaults; only `language` is validated. Null, arrays, primitives and bad JSON give the defaults; storage errors give the defaults. Additional finding (not in design.md): the `GameSettings` type is in `packages/shared-types/src/index.ts` (line 13, fields graphicsQuality, soundEnabled, musicVolume, sfxVolume, fov, language) and `DEFAULT_SETTINGS` is typed `GameSettings`. Adding the new settings of design D-settings needs an edit to `packages/shared-types/src/index.ts` as well as `settingsStorage.ts`; the settings task must name that file.
  - `playthroughs.test.ts` hard-codes (374 lines, 4 tests): run 1 "verified" (line 99) option IDs `opt.scam.open.ask-proof`, `opt.scam.knows.challenge`, `opt.scam.challenged.call-card`, `opt.official.greeting.wait`, `opt.official.agent.report`, `opt.official.confirm.block`, and `state.events[9]` (line 131); run 2 "risky" (line 193) `opt.scam.open.yes-what`, `opt.scam.code.read-code`, `opt.scam.move.move-money`, and `state.events[7]` (line 225); run 3 "risky, locked" (line 244) `opt.scam.open.yes-what`, `opt.scam.code.read-code`, `opt.scam.move.stop`, `opt.scam.guilt.hang-up`, `opt.official.greeting.wait`, `opt.official.agent.report`, `opt.official.confirm.code-shared`, `opt.official.locked.block`; run 4 "uncertain" (line 318) event indices `state.events[2]` and `state.events[5]` (lines 339-340, `objectivesActivated` `[]` and `["obj.check-claims", "obj.decide"]`). Exact `objectiveTimeline` arrays at lines 137, 207, 266, 342; `state.objectives.active` at lines 149, 218, 352; `state.claims` with four keys via the `claims()` helper (line 64); outcome and consequence IDs (`verified.reported`, `risky.money-moved`, `risky.code-shared-locked`, `uncertain.stopped`). Consequence for later tasks: all those option IDs, node targets and action orders must stay valid; event indices stay valid only if the new nodes add no extra accepted action before them.
  - Lint walkers: `game/narrative/chapter1/content.test.ts` (`IDENTIFIER_KEYS`, lines 34-67) and the copy in `i18n/narrative.test.ts` (lines 190-195) both lack `speakerId`, `objectiveId` and `objectives`, so task 5.3 and 5.4 are needed as planned. The `content.test.ts` list also has `objectId`, `npcId`, `interactableId` and `warningSigns`; the `narrative.test.ts` copy has the same list without line breaks.
  - `WARNING_SIGN_IDS` is in `game/narrative/chapter1/ids.ts` (line 92; 6 IDs from `ws.urgency` to `ws.emotional-pressure`). The definitions (`CHAPTER_1_WARNING_SIGNS: Record<WarningSignId, WarningSignDef>`) are in `game/narrative/chapter1/evidence.ts` (line 9), with the Vietnamese labels in `i18n/narrative/chapter1.vi/core.ts` (keys `warningSigns/<id>/label` and `/description`), not in `evidence.ts` of the overlay. Correction for task 4.5: the three new warning sign texts go in `OVL/core.ts`, not `OVL/evidence.ts`; task 4.4 owns `core.ts`, so add the warning sign keys to task 4.4 and remove them from 4.5 (or let 4.5 edit `core.ts`; the owner decides). Task 3.3 is consistent (edit `evidence.ts` only; `ids.ts` is task 2.1).
  - `startNodeWhen` field: type in `game/narrative/types.ts` line 214 (`startNodeWhen?: Array<{ when: Condition[]; nodeId: string }>` on `DialogueGraph`); evaluated in `game/narrative/dialogueEngine.ts` (start-node selector, loop at line 104); validated in `validateScenario.ts` lines 200-203; currently used only in `chapter1/dialogues/shopkeeper.ts` line 99. So tasks 3.7 and 3.8 can use it with no type change.
  - Contradictions with design.md: none that change behavior. Two corrections: (1) the settings type lives in `packages/shared-types` (above); (2) Vietnamese warning sign text lives in `OVL/core.ts` (above).
- Checkpoint A (task 6): first `pnpm test` run exit 1: 82 files (81 passed, 1 failed), 761 tests (760 passed, 1 failed), 0 skipped. The only failure was the stale expectation in `dialogueEngine.test.ts` (see test updates). After that fix: `pnpm test` exit 0, 82 files passed, 761 tests passed, 0 failed, 0 skipped, 53.25 s. `pnpm typecheck` exit 0 (shared-types, landing, game Done). `pnpm build` exit 0; game main JS chunk `dist/assets/index-DYdfX1y9.js` 1,956.83 kB (gzip 551.95 kB), built in 11.18 s (baseline 1,894.05 kB, +62.78 kB); landing JS `index-DW2A16ld.js` 300.55 kB (gzip 92.95 kB), unchanged. Test count rose from 756 to 761 (cause not investigated).
- Checkpoint B (task 12): first `pnpm test` exit 0: 95 files passed, 846 tests passed, 0 failed, 0 skipped, 99.45 s. First `pnpm typecheck` exit 2: 8 type errors, all in test files of this feature (no production-code error): `content/validateChapterContent.faults.property.test.ts` (224-225, graph ID literals `dlg.sam` and `dlg.alex` are not in `DialogueGraphId`), `narrative/conditions.test.ts` (77, 78, 83, 84, `as const` made `evidenceIds` readonly), `narrative/validateScenario.test.ts` (224 `delete` of required `persona.speakerId`; 366 and 389 `as never` keys made the assigned value `never`). Fixed in those three test files only (typed `Condition` fixture, cast of `persona` and of `evidence`/`calls` to `Record<string, unknown>`, real graph IDs `dlg.shopkeeper` and `dlg.scam-call`). No assertion changed or weakened. Rerun of those three files: 3 files, 52 tests passed. After the fix: `pnpm typecheck` exit 0; `pnpm build` exit 0. The full `pnpm test` was not rerun after the type-only test fixes (only the three edited files were).
  - Build output: `apps/game/dist/audio/chapter01/en` 54 files, 2,764,098 bytes; `.../vi` 54 files, 2,968,002 bytes; total `dist/audio` 108 files, 5,732,100 bytes (about 5.47 MiB), matching the manifest bytes of task 10.3. Game main JS chunk `dist/assets/index-ChCxAyQz.js` 1,957.05 kB (gzip 552.10 kB), built in 13.71 s; baseline 1,894.05 kB (+63.00 kB), Checkpoint A 1,956.83 kB (+0.22 kB). Vite prints the existing "chunks larger than 1500 kB" warning (also present before). Landing JS unchanged at 300.55 kB. Browser playback of the MP3 files is not verified.
- Existing test updates and reasons:
  - `apps/game/src/game/narrative/dialogueEngine.test.ts` (test "starts at the greeting before the scam call", ~line 46): the expected Sam greeting options now include `opt.sam.greet.chat` (order `ask-notice`, `bye`, `chat`). Reason: task 3.9 intentionally added the small-talk option per the design.md shopkeeper table. No assertion weakened; the check is still an exact `toEqual`.
- Reachability solver explored states: 59,718 (`truncated` false, budget 100,000), about 6 s per run; recorded by task 8.4. Outcomes reached: investigator, risky, uncertain, verified. No unreachable node or option, 0 soft locks, option count max 4 and min 1. The state key omits flags that no Condition or engine code reads (`ENGINE_READ_FLAGS`). `NARR/reachability.test.ts` runs the full solver once (`beforeAll`, 120 s timeout) plus two seeded tests (200 cases each, 60 s timeout). Last run: 7 tests passed, about 10 s for the file.
- Voice probe result (task 10.1, Windows, PowerShell): the OneCore voice tokens under `HKLM:\SOFTWARE\Microsoft\Speech_OneCore\Voices\Tokens` list Microsoft David (English, United States), Microsoft Mark (English, United States), Microsoft Zira (English, United States) and Microsoft An (Vietnamese, Vietnam). All four required voices are installed, so no Vietnamese clip needs to stay `missing` for lack of a voice. `System.Speech` also lists the desktop voices David and Zira (en-US) only; the OneCore list is the one the generator needs. This matches the 9.10 smoke test (MP3s produced by David, Mark, Zira and An). Sound quality is not verified.
- Dry run (task 10.1): `pnpm --filter @scammaze/game voice:script` exit 0, printed 108 lines. `pnpm --filter @scammaze/game voice:chapter1 -- --dry-run` exit 0: jobs in scope 108, up to date 0, jobs to run 108 (en 54, vi 54), nothing written. Matches the 9.11 dry run. Voice assignment: scam and callback lines (spk.alex) David (en) and An (vi); Sam (spk.sam) Mark and An pitch 0.9; Northgate agent Zira and An pitch 1.2; case officer (spk.case-officer) Mark pitch 0.9 and An pitch 0.8. The dry run printed a harmless "WebSocket server error: Port 24678 is already in use" line (a Vite dev-server port conflict from the script's startup; exit code still 0).
- Voice probe result: see "Voice probe result (task 10.1" above.
- Generated clips per locale (present, missing, placeholder-tts), bytes (task 10.3, verified on branch `feat/chapter-01-voice-narrative`):
  - en: 54 present, 0 missing, 0 placeholder-tts; 2,764,098 bytes in total (smallest clip 18,791 bytes).
  - vi: 54 present, 0 missing, 0 placeholder-tts; 2,968,002 bytes in total (smallest clip 21,167 bytes).
  - Origin: all 108 entries are `tts-generated`. Files on disk under `apps/game/public/audio/chapter01/`: 54 `.mp3` in `en`, 54 `.mp3` in `vi`, nothing else.
  - File check: a script parsed the real manifest; all 108 `present` entries have an existing, non-empty `.mp3` whose size equals `bytes`. Failures: 0.
  - No generated `.wav` in `apps/game/public/`. The only `.wav` there is the pre-existing `assets/audio/drive.wav`.
  - `apps/game/.voice-cache/` is ignored (`git check-ignore -v` matched `.gitignore:12`) and `git ls-files` lists 0 tracked files in it.
  - `pnpm --filter @scammaze/game voice:report` exit 0: 108 clip entries, by locale en 54 and vi 54, by status present 108, by origin tts-generated 108. No missing list.
  - `pnpm --filter @scammaze/game exec vitest run src/game/content`: 1 file passed, 1 test passed, 0 failed (checks the real manifest against V5 to V7).
  - Not verified: sound quality, intelligibility, browser playback of the MP3 files, and redistribution terms of the generated audio. No human has listened to the clips.
- Missing-clips report: after task 10.3 no clip is `missing` (0 in en, 0 in vi); task 24.1 still owns the final report.
- Final missing-clips report (task 24.1, `pnpm --filter @scammaze/game voice:report`, exit 0, branch `feat/chapter-01-voice-narrative`): 108 clip entries. By locale: en 54, vi 54. By status: present 108 (missing 0, placeholder-tts 0). By origin: tts-generated 108. By locale and status: en present 54; vi present 54. The `missing` list is empty: no clipId, locale, speaker or line text to list. Voice clips implemented 108 (54 en + 54 vi) vs missing 0. This counts manifest entries only. Sound quality, intelligibility, browser playback of the MP3 files and redistribution terms are not verified. The command printed no Vite port 24678 warning in this run.
- Final content counts (task 24.1, measured with a temporary script `apps/game/scripts/tmp-count.mjs` that loaded `game/narrative/chapter1/scenario.ts` through Vite `ssrLoadModule`; Spoken_Node = node with speaker `caller` or `npc`, same rule as `isSpokenNode`; options = sum of `node.options` lengths). The script was deleted afterwards; `Test-Path apps/game/scripts/tmp-count.mjs` returned False and `git status --short apps/game/scripts` listed nothing.
  - Dialogue graphs 5 (baseline 4).
  - Nodes 64 (baseline 26): scam-call 21, callback 12, shopkeeper 9, official-line 13, followup 9.
  - Spoken_Nodes 54 (baseline 18): 18, 10, 8, 11, 7 in the same graph order. This equals the 54 clips per locale in the manifest.
  - Options 138 (baseline 39): 57, 28, 13, 23, 17. Above the target, as already listed among the unresolved issues.
  - Evidence items 15 (baseline 11). Objectives 8 (baseline 5). Calls 4. Acts 6. Endings 4. For reference: decisions 3, warning signs 10.
  - Playtime is not measured. No human has played Chapter 1 start to end, and no duration figure is claimed.
- Deviations: (not recorded yet)
  - 14.3: gate extracted into pure VOICE/optionsGate.ts with elapsed-time fields instead of endedAt, so Property 14 can test it.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "2.6", "2.7", "2.8"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10"] },
    { "id": 5, "tasks": ["3.11", "4.1", "4.4", "4.5", "4.6", "4.7"] },
    { "id": 6, "tasks": ["3.12", "4.2", "5.1", "5.2", "5.3"] },
    { "id": 7, "tasks": ["4.3", "5.5"] },
    { "id": 8, "tasks": ["5.4"] },
    { "id": 9, "tasks": ["7.1", "8.1", "8.2", "8.6", "8.7", "8.8", "8.9", "8.10", "9.1"] },
    { "id": 10, "tasks": ["8.3", "8.4", "8.5", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 11, "tasks": ["9.6", "9.7", "9.8", "9.9", "9.10", "11.1"] },
    { "id": 12, "tasks": ["9.11", "11.3"] },
    { "id": 13, "tasks": ["10.1"] },
    { "id": 14, "tasks": ["10.2"] },
    { "id": 15, "tasks": ["10.3"] },
    { "id": 16, "tasks": ["11.2"] },
    { "id": 17, "tasks": ["13.1", "14.1", "14.3", "15.1", "15.7"] },
    { "id": 18, "tasks": ["13.2", "14.2", "14.4", "14.5", "14.6", "14.7", "14.10", "15.2", "15.5", "15.8"] },
    { "id": 19, "tasks": ["13.3", "14.8", "14.9", "14.11", "14.12", "14.13", "14.14", "15.3", "15.4", "15.6", "15.9"] },
    { "id": 20, "tasks": ["17.1", "18.1", "18.2", "18.3", "19.1", "19.3", "19.5", "19.6", "20.1"] },
    { "id": 21, "tasks": ["17.2", "18.4", "18.5", "18.6", "18.7", "18.10", "19.2", "19.4", "19.7", "19.8", "20.2", "20.3", "20.5"] },
    { "id": 22, "tasks": ["18.8", "18.9", "18.11", "18.12"] },
    { "id": 23, "tasks": ["18.13", "20.4"] },
    { "id": 24, "tasks": ["22.1", "23.1", "23.3", "23.4", "23.5", "23.7", "25.1", "25.2"] },
    { "id": 25, "tasks": ["22.2", "23.2", "23.6", "24.1"] },
    { "id": 26, "tasks": ["22.3"] },
    { "id": 27, "tasks": ["27.1", "28.1"] },
    { "id": 28, "tasks": ["28.2"] },
    { "id": 29, "tasks": ["29.1"] }
  ]
}
```
- Checkpoint C (task 16): first runs: `pnpm test` exit 1 (104 files: 103 passed, 1 failed; 903 tests: 902 passed, 1 failed; 0 skipped); `pnpm typecheck` exit 2 and `pnpm build` exit 2 (type errors in test files). Test-file fixes only, no assertion removed or weakened: (1) `game/voice/webAudioEngine.test.ts`: the fake compressor was typed `FakeNode & Record<string, FakeParam>` (TS2322, no string index signature); replaced by a `FakeCompressor extends FakeNode` class with `threshold`, `knee`, `ratio`, `attack`, `release` params. (2) `features/chapter1/comfort/comfort.property.test.ts` line 32: TS2769, `ComfortProvider` requires `children`; passed `children: probe` in the props object. (3) `app/App.i18n.test.tsx` "keeps every other settings field when the language changes": the stored fixture was a 6-field partial, but saving now writes the six new settings with defaults (known test update, design.md item 4 / task 15.4); the fixture now spreads `DEFAULT_SETTINGS`, the `toEqual` assertions are unchanged. After the fixes: `pnpm test` exit 0, 104 files passed, 903 tests passed, 0 failed, 0 skipped; `pnpm typecheck` exit 0; `pnpm build` exit 0 (game built in 13.31 s, landing built in 0.92 s). No production-code bug found. Temp logs deleted. Not committed.
- Checkpoint D (task 21): `pnpm test` exit 0: 113 files passed, 1029 tests passed, 0 failed, 0 skipped, 72.90 s. `pnpm typecheck` exit 0 (shared-types, landing, game Done). `pnpm build` exit 0; game main JS chunk `dist/assets/index-CI1HoV57.js` 1,971.73 kB (gzip 556.14 kB), built in 9.40 s (baseline 1,894.05 kB, Checkpoint B 1,957.05 kB); landing JS `index-DW2A16ld.js` 300.55 kB, unchanged. No failures, so no code was changed. Temp logs deleted. Not committed.
- Task 19.6 and 19.8 notes: the credits source for the voice entry is the `.mjs` generator (`apps/game/scripts/generate-chapter1-voice.mjs`). Test files updated for the new credit IDs: `apps/game/src/config/credits.callPhone.test.ts` and `apps/game/src/features/menu/CreditsModal.test.tsx` (en and vi parity kept).
- Gap G16 (flagged for the owner, not part of this feature): the older audio files in `apps/game/public/assets/audio/` and `public/reality/` have no credits entries.
- Task 20.2 test updates (owner-approved):
  - `apps/game/src/game/loading/chapterLoader.test.ts`: the case "fails with invalid-save for tampered progress (a rejected action)" was stale by design, because a rejected action now trims the restore (Req. 13.5, `restoreSession` lenient). Replaced by "trims a rejected action and restores the accepted prefix with saveTrimmed", which expects a ready session with `saveTrimmed: true` and the state of the accepted prefix. The damaged-data case stays: a non-finite pose still fails with `invalid-save`, and a new case with 1001 actions (above `SAVE_MAX_ACTIONS`) also fails with `invalid-save`. No other assertion changed.
  - `apps/game/src/game/narrative/chapter1/evidenceCoverage.test.ts` and new `apps/game/src/features/chapter1/world/noNewWorldObjects.test.ts`: `boundaries.test.ts` (unchanged, boundary is correct) rejected the imports of `chapterRegistry` and `propLayout` inside `game/narrative`. The four G14 "no new interactable or 3D object" tests moved with identical assertions to the new file outside `game/narrative`. The pure narrative checks stay in `evidenceCoverage.test.ts` with no outside imports.
- `useCallTriggers.test.ts`: callback-once test now counts callback rings because the follow-up call rings after the callback by design. The `call.current === null` expectation was removed; the existing `ringCount(store, "call.callback")` equals 1 assertions stay (owner-approved, task 19.1).


### Task 23.1 test update (owner approved)

- File: `apps/game/src/features/chapter1/call/ChapterOnePage.call.test.tsx`, test "wraps Tab and Shift+Tab inside the call dialog".
- Reason: the active call screen now has the designed voice controls (Mute, Replay) before Hang up (`PhoneScreenUI.tsx`). The old expectation `[hang-up, ...options]` was stale.
- New expectation: tab order is Mute, Replay (only when enabled; a disabled button is not tabbable), Hang up, then the options. The wrap checks (Tab from the last option to the first call control, Shift+Tab back to the last option) are kept.
- Result: `pnpm --filter @scammaze/game exec vitest run src/features/chapter1 src/app` gave 39 files passed, 339 tests passed, 0 failed.

- Checkpoint E (task 26), all run sequentially from `d:\scam-maze`; no failures, so no code was changed:
  - `pnpm test` exit 0: 117 test files passed, 1061 tests passed, 0 failed, 0 skipped (no skipped count in the output), 73.24 s.
  - `pnpm typecheck` exit 0.
  - `pnpm build` exit 0. Game main JS chunk `dist/assets/index-ByzuU0UT.js` 2,041.10 kB (gzip 568.31 kB); baseline 1,894.05 kB (+147.05 kB), Checkpoint D 1,971.73 kB (+69.37 kB). Landing JS `index-DW2A16ld.js` 300.55 kB (gzip 92.95 kB), unchanged. The existing "chunks larger than 1500 kB" warning was not checked again.
  - `pnpm --filter @scammaze/game exec tsc --noEmit -p tsconfig.app.json` exit 0; `-p tsconfig.test.json` exit 0.
  - Dist audio: `dist/audio/chapter01/en` 54 files, 2,764,098 bytes; `.../vi` 54 files, 2,968,002 bytes; chapter01 total 108 files, 5,732,100 bytes (about 5.47 MiB). Older audio in `dist/assets/audio` 10 files, 8,123,512 bytes; `dist/reality` 1 file, 6,247,012 bytes.
  - `pnpm --filter @scammaze/game voice:report` exit 0: 108 clip entries; by locale en 54, vi 54; by status present 108 (missing 0); by origin tts-generated 108.
  - Not verified: sound quality, MP3 playback in browsers, playtime (manual playtest checklist in task 27.1). The full list of tests and commands passing does not make Chapter 1 complete; a human has not played it. Temp logs deleted. Not committed.

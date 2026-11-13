---
name: scam-scenario-authoring
description: "How to author or change a SCAMMAZE scam scenario - the ScenarioDefinition schema (dialogue graphs, nodes, options, conditions, effects, evidence, claims, decisions, endings, acts), scam categories, branching design, educational goals and the validation steps. Use when writing new dialogue, a new chapter, new evidence or endings, or reviewing scenario realism."
---

# Authoring scam scenarios

Reference implementation: Chapter 1, `apps/game/src/game/narrative/chapter1/` (data) and
`apps/game/src/i18n/locales/{en,vi}/chapter1/` (text). Types: `game/narrative/types.ts`.

## Schema essentials

- `ScenarioDefinition`: `objectives`, `interactables`, `claims`, `evidence`, `warningSigns`,
  `journalNotes`, `calls`, `npcs`, `dialogues`, `phone`, `decisions`, `endings`, `debrief`, `acts`.
  Record keys must equal each item's `id`. Ids are listed in `chapter1/ids.ts` (`as const`).
- `DialogueGraph`: `persona {speakerId, name, role, honesty}`, `channel`, `independentChannel`
  (only these may `setClaimStatus`), `startNodeId`, optional `startNodeWhen[]`, `lines`, `nodes`.
- `DialogueNode`: `speaker` (`caller`/`npc` are spoken and need `tone` and a known speaker),
  `lineId`, optional `pressure`, `pauseBeforeMs` (0..3000), `onEnter` effects, `options[]`, or
  `end {kind: "hung-up"|"completed"}` (an end node has no options).
- `DialogueOption`: `id` (unique across the scenario), `lineId`, `conditions?`, `effects?`,
  `next` (node id or `{end: "hang-up"}`), `debriefTag?` (needs a decision note).
- Conditions: `hasEvidence`, `hasAnyEvidence`, `flag`, `notFlag`, `callEnded`, `claimStatus`,
  `callRang`, `objectiveCompleted`, `outcomeSet`, `evidenceCountAtLeast`.
  Effects: `setFlag`, `discoverEvidence`, `addPressure`, `setClaimStatus`, `recordDecision`,
  `deliverMessage`. A new kind is engine work (gameplay-engineer), not data.
- Endings: `variants[{id, when, text}]`, last variant unconditional; optional `unlockWhen`.
  Outcomes: `verified`, `investigator`, `uncertain`, `risky`.

## Design rules

- Branch for learning: each choice changes something the player can see later (evidence, a flag
  that changes a line, a claim status, an ending variant). Avoid cosmetic forks.
- Pressure nodes must reach an end within 3 option steps; at most 4 unconditional options per node.
- Scam categories to draw from: impersonation (bank, courier, police, tax office), OTP or code
  theft, fake refund or prize, job or investment lure, family emergency, account "suspension",
  move-to-another-app, remote-access request. Combine with one or two pressure tactics
  (urgency, authority, secrecy, isolation, small steps).
- Teach verifiable signals: unknown number, mismatch with the official channel, request for a
  code, time pressure, request to keep it secret. The fix is always to stop and verify through a
  channel the player already trusts.
- Never: real brands or people, real phone numbers or domains, clickable links, the word "safe"
  as a verdict, instructions usable for real fraud, graphic or shaming consequences.

## Validation (must be clean before finishing)

```bash
SCAMMAZE_PBT_QUICK=1 pnpm --filter @scammaze/game exec vitest run \
  src/game/narrative/validateScenario.test.ts src/game/narrative/reachability.test.ts \
  src/game/narrative/chapter1/content.test.ts src/game/narrative/properties/
```

- `validateScenario` must return `[]`. `analyzeReachability` must reach every outcome with no
  unreachable node or option and no soft lock.
- Add a playthrough to `chapter1/playthroughs.test.ts` for each new path; add the Vietnamese
  text in the same change (the i18n tests fail on missing keys).
- Voice: spoken lines need clips in the voice manifest (`game/voice/chapter1.manifest.ts`,
  checked by `validateChapterContent` V5-V7). Intro narration clips are listed in
  `features/chapter1/intro/introScript.ts`.

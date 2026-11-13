# Implementation Plan: Scenario Engine Validation

## Overview

Properties first (they define "valid"), then the authoring command, then the open checks. All
work is TypeScript under `apps/game`, using the existing seeded generators. No new dependency.

## Tasks

- [x] 1. Scenario validation properties
  - [x] 1.1 Create `apps/game/src/game/narrative/properties/scenarioValidation.property.test.ts`
    - Fault injectors (8 kinds): dangling `next`, missing start node, end node with options, `pauseBeforeMs` out of range, spoken node without tone, duplicate option ID, one-node and two-node cycles
    - **Property SV1** (fault detection) and **Property SV2** (robust reducer, rejection reasons, fault-reach rate), 200 seeded cases
    - **Property SV3** (total, pure, deterministic validator on garbage; non-object roots rejected), 200 cases
    - **Property SV4** (pressure bounds, including non-number amounts), 400 cases
    - **Property SV5** (variants and orphan node vs Solver), 4 variants, 1 in quick mode
    - Every failure prints `SCAMMAZE_PBT_SEED` (and `SCAMMAZE_PBT_FAULT` for SV1); `SCAMMAZE_PBT_RUNS`, `SCAMMAZE_PBT_QUICK`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 5.1, 5.2, 5.3_
  - [x] 1.2 Validator root check (`checkRoot` in `validateScenario.ts`) plus two example tests in `validateScenario.test.ts`; SV3 found that junk roots were accepted as valid
    - _Requirements: 3.1_
  - Evidence (2026-11-13, see docs/PROJECT_PROGRESS.md): `scenarioValidation.property.test.ts`, `validateScenario.test.ts` and `boundaries.test.ts` pass (52 tests). Mutation test: each of the 9 checks covered (8 fault kinds plus the root check) was removed in turn and the matching property failed with a reproducible seed (9 of 9 killed). SV2 reached the faulty graph in 69 of 200 cases. Design reviewed by the qa-security-reviewer instructions (emulated; custom agents were not registered in that session); its findings were fixed.
- [x] 2. Scenario hook
  - [x] 2.1 `.kiro/hooks/scenario-change-validation.json` and `scenario-create-validation.json` run `.kiro/scripts/check-scenarios.mjs` (gate in quick mode, reminder when scenario data changes without a test change)
    - _Requirements: 6.1_
- [ ] 3. Authoring command
  - [ ] 3.1 Add `scenario:check` to `apps/game/package.json` running the gate; print a summary of validator issues per check and Solver results
  - [ ] 3.2 Document it in `.kiro/skills/scam-scenario-authoring/SKILL.md` and `CONTRIBUTING.md`
  - _Requirements: 6.2_
- [ ] 4. Combined V4 satisfiability (flags first)
  - [ ] 4.1 Add the producer analysis to `validateScenario.ts` as a V4 check
  - [ ] 4.2 Add a fault injector "flag condition before its only producer" to SV1
  - _Requirements: 1.5_
- [ ] 5. Untrusted scenario guard
  - [ ] 5.1 `game/narrative/parseScenario.ts` with `parseScenarioDefinition(raw: unknown)` returning a result, never throwing
  - [ ] 5.2 Property: every SV3 garbage case is rejected with issues; the real scenario is accepted unchanged
  - _Requirements: 6.3, 3.1_
- [ ] 6. Checkpoint
  - Run `pnpm typecheck`, `pnpm test`, `pnpm build`; ask the owner before starting Chapter 2 multi-chapter work.

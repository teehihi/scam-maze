# Design: Scenario Engine Validation

## Current state (verified 2026-11-13)

| Piece | File | Covers |
|---|---|---|
| Static validator | `game/narrative/validateScenario.ts` | V1 references and schema, V3 shape (reach an end, pressure nodes end within 3 steps, at most 4 unconditional options), V4 single impossible conditions. Catches internal exceptions and reports them as V1. |
| Solver | `game/narrative/reachability.ts` | Explores real reducer states (budget 100,000) with free-action saturation; reports outcomes reached, unreachable nodes and options, soft locks. |
| Content | `game/content/validateChapterContent.ts` | V5 subtitles, V6 voice manifest, V7 clip files. |
| Properties | `game/narrative/properties/*.property.test.ts` | Determinism, invariants, terminal, no soft lock, options, outcome table, journal, debrief, store and more, on the real scenario only. |
| Generators | `src/test/seededRandom.ts`, `src/test/chapterRuns.ts` | Seeded LCG, `caseSeed`, `generateActionSequence`, `runSequence`, `assertInvariants`, `shrinkFailingPrefix`. |

Decision: no property-based testing library is added. The repository already has a seeded,
reproducible generator framework used by 48 `*.property.test.ts(x)` files in `apps/game/src`
(17 of them in `game/narrative/properties/`, counted 2026-11-13), and the narrative boundary test
forbids extra packages in narrative tests. A second framework would split conventions for no
gain. New properties follow the existing pattern (200 cases, seed in every failure message).

## Architecture of the new properties

`game/narrative/properties/scenarioValidation.property.test.ts` adds properties over GENERATED
scenarios:

- Fault injectors (8 kinds): functions `(clone, lcg, seed) => {fault, check, mentions, graphId} | null`
  that mutate a JSON clone of Chapter 1 at a seeded target: dangling `next`, missing start node,
  end node with options, `pauseBeforeMs` out of range, spoken node without tone, duplicate option
  ID, one-node cycle, two-node cycle. Cases cycle through the kinds (`index % kinds`).
- SV2 plays 20-80 seeded actions on the faulty clone and records whether play reached the faulty
  graph (69 of 200 cases on 2026-11-13); the property requires at least one.
- Garbage generator: replaces 1-4 values at depth 1-3 with junk (`null`, numbers, strings, empty
  arrays and objects, NaN), or replaces the whole scenario with a non-object (20% of cases).
  Immutability uses `structuredClone` + `isDeepStrictEqual` (sees NaN and undefined).
- Variant generator: reverses node record order and option order per graph and node (seeded).
  Order-sensitive lists (`startNodeWhen`, ending variants, acts) are first-match or sequential by
  design, so they are not reordered: that would change the meaning, not preserve it.
- Orphan generator: copies a spoken node into a new end node that no option targets.
- Reproduction: every failure prints `SCAMMAZE_PBT_SEED=<seed>` (SV1 also `SCAMMAZE_PBT_FAULT=<kind>`);
  `SCAMMAZE_PBT_RUNS=<n>` changes the case count; `SCAMMAZE_PBT_QUICK=1` runs one solver variant.

## Validator change made by this spec

The properties found that the Validator accepted `{}`, `[]`, `"x"`, `42`, `true` and
`{dialogues: {}}` with zero issues. `checkRoot` in `validateScenario.ts` now reports a non-object
root ("Scenario must be an object, got ...") and missing or empty `objectives`, `dialogues`,
`decisions`, `endings` and `acts` as V1. Chapter 1 is unaffected (still zero issues).

## Correctness properties

| ID | Property | Requirements |
|---|---|---|
| SV1 | For every injected fault, the Validator reports an issue with the expected check whose message names the mutated item. | 1.1-1.4 |
| SV2 | For any seeded action sequence on a faulty scenario, the reducer does not throw, rejections keep the state reference and carry a reason, and event `seq` is contiguous; some cases reach the faulty graph. | 2.1-2.3 |
| SV3 | For any garbage input, the Validator returns well-formed issues, does not mutate the input, is deterministic, `validateScenario` equals the messages, and a non-object root is rejected. | 3.1-3.4 |
| SV4 | For any valid start pressure (0..3) and any sequence of `addPressure` amounts (including non-numbers from loaded data), pressure stays an integer in 0..3. | 4.1 |
| SV5 | Reordered variants validate clean and the Solver reaches all four outcomes with no soft lock or unreachable node; an orphan node passes static validation and is reported unreachable. | 5.1, 5.2 |

Costs (measured 2026-11-13 on the owner's Mac, Vitest 5): SV1-SV4 about 0.1 s each for 200 cases;
SV5 about 2.2 s per Solver run (8 runs in full mode, 2 in quick mode). Gate in quick mode: about
8 s including startup.

## Open design items (tasks 3-6)

- `scenario:check` script: a Vitest run of the gate plus a printed summary (issues per check,
  outcomes reached, unreachable counts). Implemented as a package script so it works without Kiro.
- Combined V4 satisfiability: compute, per flag/evidence/claim, the set of effects that can
  produce it on paths that reach the condition; report conditions whose producers are only on
  paths after the condition. Start with flags only.
- Untrusted scenario guard `parseScenarioDefinition(raw: unknown): {ok: true, scenario} | {ok:
  false, issues}`: shape guard plus `validateScenarioIssues`; pure, in `game/narrative/`, no Zod
  until a dependency decision is recorded (AGENTS.md lists Zod as intended but it is not installed).
- Multi-chapter readiness: the Validator reads Chapter 1 ID lists (`chapter1/ids.ts`, for example
  `FLAG_IDS`); a second chapter needs those lists passed in. Do this when Chapter 2 starts.

## Testing strategy

Every requirement has a property or example test; the gate runs on every agent save of scenario
files (hook) and in CI through `pnpm test`.

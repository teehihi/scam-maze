---
name: gameplay-testing
description: "How to test SCAMMAZE gameplay - scenario validation, seeded property-based tests, playthrough and save-replay tests, and browser QA of the running game at localhost:5174 with Playwright MCP. Use when adding or changing gameplay, scenarios or UI flows, or when asked to verify, regression-test or QA the game."
---

# Gameplay testing in SCAMMAZE

## Commands

| Goal | Command (from the repo root) |
|---|---|
| Everything (CI gate) | `pnpm typecheck && pnpm test && pnpm build` |
| Tests for files you changed | `pnpm --filter @scammaze/game exec vitest related --run <paths relative to apps/game>` |
| Scenario gate (about 8 s in quick mode) | `SCAMMAZE_PBT_QUICK=1 pnpm --filter @scammaze/game exec vitest run src/game/narrative/validateScenario.test.ts src/game/narrative/reachability.test.ts src/game/narrative/chapter1/content.test.ts src/game/narrative/properties/scenarioValidation.property.test.ts` |
| All narrative properties | `pnpm --filter @scammaze/game exec vitest run src/game/narrative/properties/` |
| One test by name | `pnpm --filter @scammaze/game exec vitest run <file> -t "<name>"` |

Never run `pnpm dev`: the owner keeps the game on port 5174.

## Layers

1. Static scenario checks: `validateScenarioIssues(scenario)` returns `{check: "V1"|"V3"|"V4",
   where, message}[]`; empty means valid. Never throws.
2. Solver: `analyzeReachability(scenario)` explores real reducer states; assert
   `!truncated`, every `OUTCOME_IDS` entry in `outcomesReached`, empty `unreachableNodes`,
   `unreachableOptions` and `softLocks`.
3. Example tests: `chapter1/playthroughs.test.ts` (scripted paths per outcome),
   `savedPathsStillReplay.test.ts` (frozen save logs must still replay).
4. Properties (`game/narrative/properties/`): determinism, invariants, terminal, no soft lock,
   dialogue options, outcome table, journal, debrief, store, and scenario validation (SV1-SV5 on
   generated scenarios). Do not duplicate an existing property; extend the right file.
5. Component tests (jsdom): `ChapterOnePage*.test.tsx`, accessibility, intro (`src/test/chapterIntro.ts`
   `passIntro()` clicks through every narrated paragraph). `HTMLMediaElement.play/pause` are
   stubbed in `src/test/setup.ts`.
6. Browser QA: Playwright MCP on the running game (below).

## Writing a property test

- Generators: `createLcg(seed)`, `randomInt`, `pick` (`src/test/seededRandom.ts`);
  `caseSeed(base, i)`, `generateActionSequence(seed, length, initial?, scenario?)`,
  `runSequence`, `assertInvariants`, `completeChapterFrom`, `shrinkFailingPrefix`
  (`src/test/chapterRuns.ts`).
- Pattern: derive a file seed from `CORE_PROPERTY_SEED`, loop `CORE_PROPERTY_RUNS` (200) cases,
  collect failures as strings that include the seed, then `expect(failures, report).toEqual([])`.
  Use a 60-120 s timeout for heavy properties.
- Mutate scenarios only on JSON clones; assert the real scenario is unchanged afterwards.
- Narrative test files may import only vitest, node built-ins, relative narrative modules and the
  two helpers above (`boundaries.test.ts`).
- Reproduce: `SCAMMAZE_PBT_SEED=<seed>`; change case count: `SCAMMAZE_PBT_RUNS=<n>` (supported
  by `scenarioValidation.property.test.ts`).

## Browser QA with Playwright MCP (server `playwright` in `.kiro/settings/mcp.json`)

Flow that covers the main regression surface:
1. `browser_navigate` to `http://localhost:5174/`; wait for the menu nav (buttons NEW GAME,
   CONTINUE, SETTINGS, CREDITS & LICENSES). Startup loading can take several seconds.
2. `browser_snapshot`; check console with `browser_console_messages` (no errors).
3. Settings: click SETTINGS, check the two-column dialog, press Escape, focus returns.
4. New game: click NEW GAME, wait for `[data-testid=chapter-intro]`; click the intro until the
   continue button is enabled (one click shows a paragraph, the next moves on), click it.
5. In game: press Escape for the pause menu, choose "Return to menu"; the street must be visible
   again behind the menu (regression of the shared-GLTF bug) and CONTINUE enabled.
6. `browser_take_screenshot` at each step with `filename: ".kiro/qa-output/<step>.png"` (a bare
   name is saved relative to the repo root; `.kiro/qa-output/` is gitignored). Report console
   errors (`browser_console_messages`) and failed requests (`browser_network_requests`).
Headless Chrome uses software WebGL: judge layout and flow, not frame rate.

Tips: `browser_evaluate` returns values JSON-encoded (a string comes back quoted). Prefer
reading state through the DOM (`aria-current`, `data-testid`, `role=dialog`) over pixels. The menu
runs under React.StrictMode in dev, so dev-only double-invocation bugs show up on 5174 and not in
a production build: test on 5174.

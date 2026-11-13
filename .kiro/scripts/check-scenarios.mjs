#!/usr/bin/env node
// Hook A: scenario change validation.
// Runs when an agent saves or creates a scenario-related file (narrative core, Chapter 1 data,
// chapter text). It runs the static validator (V1/V3/V4), the reachability solver, the content
// lint and the scenario-validation properties (about 3-6 s), and reminds the agent when scenario
// data changed without any test change. Exit 1 (shown as a hook warning) on failure; silent
// success otherwise.
import { changedFiles, run, tail } from "./lib.mjs";

const SCENARIO_GATE_TESTS = [
  "src/game/narrative/validateScenario.test.ts",
  "src/game/narrative/reachability.test.ts",
  "src/game/narrative/chapter1/content.test.ts",
  "src/game/narrative/properties/scenarioValidation.property.test.ts",
];

const SCENARIO_DATA = /^apps\/game\/src\/(game\/narrative\/(chapter1\/|types\.ts|validateScenario\.ts|reachability\.ts)|i18n\/locales\/(en|vi)\/chapter1\/)/;
const TEST_FILE = /\.test\.tsx?$/;

const changed = changedFiles();
const scenarioChanges = changed.filter((path) => SCENARIO_DATA.test(path) && !TEST_FILE.test(path));
const testChanges = changed.filter((path) => TEST_FILE.test(path) && path.startsWith("apps/game/src/"));

// Quick mode: one solver variant in the SV5 property (CI and `pnpm test` run the full set).
process.env.SCAMMAZE_PBT_QUICK = "1";
const result = run("pnpm", ["--filter", "@scammaze/game", "exec", "vitest", "run", ...SCENARIO_GATE_TESTS, "--reporter=dot"]);

const notes = [];
if (scenarioChanges.length > 0 && testChanges.length === 0) {
  notes.push(
    `Scenario data or rules changed without a test change:\n  ${scenarioChanges.join("\n  ")}\n` +
      "  Add or update a playthrough, validator or property test (see .kiro/skills/gameplay-testing).",
  );
}

if (!result.ok) {
  console.log("[scenario-check] Scenario gate FAILED. Fix the scenario or the rule before continuing.");
  console.log(tail(result.output, 40));
  if (notes.length) console.log(`\n${notes.join("\n")}`);
  process.exit(1);
}
if (notes.length) {
  console.log(`[scenario-check] Scenario gate passed.\n${notes.join("\n")}`);
  process.exit(1);
}
// Passing with tests in place: stay quiet to save tokens.
process.exit(0);

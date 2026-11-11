import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  assertInvariants,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";

/** Index of the first state in the run that violates an invariant, or -1. */
function firstViolatingState(actions: readonly unknown[]): { index: number; violations: string[] } {
  const { states } = runSequence(actions);
  for (let index = 0; index < states.length; index += 1) {
    const violations = assertInvariants(states[index]);
    if (violations.length > 0) return { index, violations };
  }
  return { index: -1, violations: [] };
}

describe("chapter core properties", () => {
  // Feature: chapter-01-the-urgent-call, Property 2: Reachable states satisfy the state invariants
  it("keeps every reachable state within the state invariants", () => {
    for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
      const seed = caseSeed(CORE_PROPERTY_SEED, run);
      const length = randomInt(createLcg(seed ^ 0x5f3759df), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const failure = firstViolatingState(actions);
      if (failure.index === -1) continue;

      const prefix =
        shrinkFailingPrefix(actions, (candidate) => firstViolatingState(candidate).index !== -1) ?? actions;
      const shrunk = firstViolatingState(prefix);
      const report = [
        `Invariant violated (case ${run}, seed ${seed}, length ${length}).`,
        `Shrunk prefix (${prefix.length} actions):`,
        ...prefix.map((action, i) => `  ${i}: ${describeAction(action)}`),
        `Violations at state ${shrunk.index}:`,
        ...shrunk.violations.map((message) => `  - ${message}`),
      ].join("\n");
      expect.fail(report);
    }
  });
});

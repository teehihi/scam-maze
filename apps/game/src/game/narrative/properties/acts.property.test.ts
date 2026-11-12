import { describe, expect, it } from "vitest";
import { ACT_IDS } from "../chapter1/ids";
import { selectCurrentAct } from "../selectors";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/**
 * Replays `actions` and checks, over the accepted steps, that the act index never decreases and
 * that `act.6` is selected exactly when an outcome exists. Returns the first problem or `null`.
 */
function firstProblem(actions: readonly unknown[]): string | null {
  const { states, results } = runSequence(actions);
  const indexOf = (state: (typeof states)[number]) => ACT_IDS.indexOf(selectCurrentAct(state).id);

  const initialAct = selectCurrentAct(states[0]).id;
  if ((initialAct === "act.6") !== (states[0].outcome !== null)) {
    return `initial state: act ${initialAct} with outcome ${String(states[0].outcome)}`;
  }

  let previous = indexOf(states[0]);
  for (let i = 0; i < results.length; i += 1) {
    const state = states[i + 1];
    const act = selectCurrentAct(state).id;
    if ((act === "act.6") !== (state.outcome !== null)) {
      return `after action ${i}: act ${act} with outcome ${String(state.outcome)}`;
    }
    if (!results[i].accepted) continue;
    const current = ACT_IDS.indexOf(act);
    if (current < previous) {
      return `after action ${i}: act index went from ${previous} to ${current} (${act})`;
    }
    previous = current;
  }
  return null;
}

describe("act progression properties", () => {
  // Feature: chapter-01-voice-narrative, Property 1: Act progression is monotonic
  it("never moves to an earlier act, and selects act.6 exactly when an outcome exists", () => {
    for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
      const seed = caseSeed(CORE_PROPERTY_SEED, run);
      const length = randomInt(createLcg(seed ^ 0x5f3759df), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const problem = firstProblem(actions);
      if (problem === null) continue;

      const prefix = shrinkFailingPrefix(actions, (candidate) => firstProblem(candidate) !== null) ?? actions;
      const report = [
        `Act progression violated (case ${run}, seed ${seed}, length ${length}).`,
        `Shortest failing prefix (${prefix.length} actions):`,
        ...prefix.map((action, i) => `  ${i}: ${describeAction(action)}`),
        `Problem: ${firstProblem(prefix) ?? problem}`,
      ].join("\n");
      expect.fail(report);
    }
  }, PROPERTY_TIMEOUT_MS);
});

// Property 4 (design.md, "Correctness Properties"): no soft-lock. From every state reached by a
// seeded random action sequence, the guided completion policy reaches an Outcome and then
// FINISH_CHAPTER within its budget, with every action accepted. A second test checks that each
// Outcome (verified, risky, uncertain) is reachable from the start state by a scripted path.

import { describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  GUIDED_POLICY_MAX_STEPS,
  caseSeed,
  completeChapterFrom,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction } from "../types";

/** Seed offset so this file's sequences differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x0004) >>> 0;

/** Returns a failure message when the guided policy cannot finish the chapter from `start`. */
function softLockProblem(start: ChapterState): string | null {
  let completion;
  try {
    completion = completeChapterFrom(start);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const { actions, outcomeState, final } = completion;
  if (final.status !== "finished") return `final status is ${final.status}`;
  if (final.outcome === null || outcomeState.outcome === null) return "no outcome after completion";
  if (actions.length > GUIDED_POLICY_MAX_STEPS) return `used ${actions.length} actions`;
  if (start.status !== "finished" && actions.at(-1)?.type !== "FINISH_CHAPTER") {
    return `last action is ${describeAction(actions.at(-1))}, not FINISH_CHAPTER`;
  }
  // Replay independently: every policy action must be accepted.
  let state = start;
  for (const [index, action] of actions.entries()) {
    const result = chapterReducer(state, action);
    if (!result.accepted) return `step ${index} ${describeAction(action)} rejected: ${result.reason ?? ""}`;
    state = result.state;
  }
  return null;
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("Property 4: No soft-lock", () => {
  it("completes the chapter from every randomly reached state", () => {
    // Feature: chapter-01-the-urgent-call, Property 4: No soft-lock
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const length = randomInt(createLcg(seed ^ 0x5a5a5a5a), 0, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const run = runSequence(actions);
      // Check the final state and one intermediate state of the run.
      const middle = run.states[Math.floor(run.states.length / 2)];
      for (const start of [run.final, middle]) {
        const problem = softLockProblem(start);
        if (problem !== null) {
          const prefix = shrinkFailingPrefix(actions, (p) => softLockProblem(runSequence(p).final) !== null);
          throw new Error(
            `Soft-lock (seed ${seed}, case ${index}): ${problem}. Shortest failing prefix: ` +
              `${(prefix ?? actions).map(describeAction).join(", ")}`,
          );
        }
      }
    }
  }, PROPERTY_TIMEOUT_MS);

  it("reaches every outcome from the start state through a scripted path", () => {
    const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
    const afterScamCall: CoreAction[] = [
      { type: "START_CHAPTER" },
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      { type: "ANSWER_CALL" },
      option("opt.scam.open.verify"),
    ];
    const afterOfficialLine: CoreAction[] = [
      ...afterScamCall,
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.block"),
    ];
    const paths: Record<"verified" | "risky" | "uncertain", CoreAction[]> = {
      verified: [...afterOfficialLine, { type: "MAKE_DECISION", decision: "verify-independently" }],
      risky: [...afterScamCall, { type: "MAKE_DECISION", decision: "follow-request" }],
      uncertain: [...afterScamCall, { type: "MAKE_DECISION", decision: "stop-and-wait" }],
    };

    for (const [outcome, path] of Object.entries(paths)) {
      const run = runSequence([...path, { type: "FINISH_CHAPTER" }], createInitialState());
      run.results.forEach((result, step) => {
        expect(result.accepted, `${outcome} path step ${step}: ${result.reason ?? ""}`).toBe(true);
      });
      expect(run.final.outcome).toBe(outcome);
      expect(run.final.status).toBe("finished");
    }

    // The guided policy alone also finishes from the initial state.
    expect(softLockProblem(createInitialState())).toBeNull();
  }, PROPERTY_TIMEOUT_MS);
});

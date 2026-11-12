// Tests for the reachability solver on the real Chapter 1 scenario.
// Feature: chapter-01-voice-narrative, Property 3 and Property 4.
// Validates: Requirements 2.6, 2.7, 9.6, 10.6, 10.7, 13.3, 14.1, 8.2.
//
// The full solver explores about 60,000 states (a few seconds), so it runs once per file in
// `beforeAll`. The seeded tests use the reducer on random reachable states and do not call it again.

import { beforeAll, describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
} from "../../test/chapterRuns";
import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { availableOptions } from "./dialogueEngine";
import { analyzeReachability, type ReachabilityReport } from "./reachability";
import { chapterReducer } from "./reducer";
import type { ChapterState } from "./types";

const PROPERTY_TIMEOUT_MS = 60_000;
const SOLVER_TIMEOUT_MS = 120_000;

let report: ReachabilityReport;

beforeAll(() => {
  report = analyzeReachability(CHAPTER_1_SCENARIO);
}, SOLVER_TIMEOUT_MS);

describe("analyzeReachability on the Chapter 1 scenario", () => {
  it("finishes within the state budget", () => {
    expect(report.truncated).toBe(false);
    expect(report.states).toBeGreaterThan(0);
  });

  it("reaches verified, investigator, risky and uncertain", () => {
    for (const outcome of ["verified", "investigator", "risky", "uncertain"]) {
      expect(report.outcomesReached).toContain(outcome);
    }
  });

  it("has no unreachable dialogue node and no unreachable option", () => {
    expect(report.unreachableNodes).toEqual([]);
    expect(report.unreachableOptions).toEqual([]);
  });

  it("has no soft lock", () => {
    expect(report.softLocks).toEqual([]);
  });

  it("keeps the available option count between one and four", () => {
    expect(report.maxAvailableOptions).toBeLessThanOrEqual(4);
    expect(report.minAvailableOptions).toBeGreaterThanOrEqual(1);
  });
});

/** Every state of one seeded random run, including the initial state. */
function randomRunStates(index: number): { seed: number; actions: unknown[]; states: ChapterState[] } {
  const seed = caseSeed(CORE_PROPERTY_SEED, index);
  const actions = generateActionSequence(seed, CORE_SEQUENCE_MAX_LENGTH);
  return { seed, actions, states: runSequence(actions).states };
}

const firstCallEnded = (state: ChapterState): boolean =>
  state.call.log.some((record) => record.callId === "call.scam-1" && record.status === "ended");

describe("seeded random reachable states", () => {
  // Feature: chapter-01-voice-narrative, Property 3: Every ending is reachable and no state is a soft lock
  it(
    "accepts END_CALL with a live call and stop-and-wait once the first call has ended",
    () => {
      let liveCallStates = 0;
      let decisionStates = 0;
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const { seed, actions, states } = randomRunStates(index);
        states.forEach((state, position) => {
          const where = `seed ${seed}, case ${index}, state ${position}, prefix ${describeAction(
            actions.slice(0, position),
          )}`;
          if (state.call.current !== null) {
            liveCallStates += 1;
            const result = chapterReducer(state, { type: "END_CALL" }, CHAPTER_1_SCENARIO);
            expect(result.accepted, `END_CALL rejected: ${where}`).toBe(true);
          }
          const phoneFree = state.call.current === null && state.conversation === null;
          if (state.status === "playing" && state.decision === null && state.outcome === null && phoneFree && firstCallEnded(state)) {
            decisionStates += 1;
            const result = chapterReducer(state, { type: "MAKE_DECISION", decision: "stop-and-wait" }, CHAPTER_1_SCENARIO);
            expect(result.accepted, `stop-and-wait rejected: ${where}`).toBe(true);
          }
        });
      }
      // The generator must actually exercise both situations, or the test proves nothing.
      expect(liveCallStates).toBeGreaterThan(0);
      expect(decisionStates).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );

  // Feature: chapter-01-voice-narrative, Property 4: Available options stay within bounds
  it(
    "keeps option counts at most four, and at least two except at single-continuation nodes",
    () => {
      let conversationStates = 0;
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const { seed, actions, states } = randomRunStates(index);
        states.forEach((state, position) => {
          if (state.conversation === null) return;
          const where = `seed ${seed}, case ${index}, state ${position}, prefix ${describeAction(
            actions.slice(0, position),
          )}`;
          const graph = CHAPTER_1_SCENARIO.dialogues[state.conversation.graphId];
          const node = graph.nodes[state.conversation.nodeId];
          const views = availableOptions(state, CHAPTER_1_SCENARIO).filter((view) => !view.fallback);
          conversationStates += 1;
          expect(views.length, `more than four options: ${where}`).toBeLessThanOrEqual(4);
          if (node.options.length >= 2) {
            expect(views.length, `fewer than two options at ${node.id}: ${where}`).toBeGreaterThanOrEqual(2);
          }
        });
      }
      expect(conversationStates).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

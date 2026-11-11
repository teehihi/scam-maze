/**
 * Property 1 (design.md, "Correctness Properties"): every dispatch returns an Action_Result
 * without throwing, rejections return the same state object with a non-empty reason, and
 * accepted actions append exactly one Event_Log entry. The input state is never mutated.
 */

import { describe, expect, it } from "vitest";
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
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState } from "../types";

/** Checks one dispatch against Property 1. Returns a violation message, or null when it holds. */
function checkDispatch(state: ChapterState, action: unknown): string | null {
  const before = JSON.stringify(state);
  let result: ReturnType<typeof chapterReducer>;
  try {
    result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
  } catch (error) {
    return `reducer threw: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (result === null || typeof result !== "object") return "reducer returned no Action_Result";
  if (typeof result.accepted !== "boolean") return "result.accepted is not a boolean";
  if (JSON.stringify(state) !== before) return "the input state was mutated";
  if (!result.accepted) {
    if (result.state !== state) return "rejected, but result.state is not the input state object";
    if (typeof result.reason !== "string" || result.reason.trim() === "") {
      return "rejected without a non-empty reason";
    }
    return null;
  }
  if (result.state.events.length !== state.events.length + 1) {
    return `accepted, but events grew from ${state.events.length} to ${result.state.events.length}`;
  }
  return null;
}

/** Replays `actions` from the initial state; returns the first violation, or null. */
function firstViolation(actions: readonly unknown[]): { step: number; message: string } | null {
  let state = createInitialState();
  for (let step = 0; step < actions.length; step += 1) {
    const message = checkDispatch(state, actions[step]);
    if (message !== null) return { step, message };
    state = chapterReducer(state, actions[step], CHAPTER_1_SCENARIO).state;
  }
  return null;
}

describe("chapter core dispatch", () => {
  it("returns a result for every dispatch and leaves state unchanged on rejection", () => {
    // Feature: chapter-01-the-urgent-call, Property 1: Every dispatch returns a result, and rejections change nothing
    const failures: string[] = [];
    let accepted = 0;
    let rejected = 0;

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(CORE_PROPERTY_SEED, index);
      const length = randomInt(createLcg(seed ^ 0x5bd1e995), 1, CORE_SEQUENCE_MAX_LENGTH);

      let actions: unknown[];
      try {
        actions = generateActionSequence(seed, length);
      } catch (error) {
        failures.push(
          `case ${index} (seed ${seed}): generating the sequence threw: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      const violation = firstViolation(actions);
      if (violation !== null) {
        const shrunk = shrinkFailingPrefix(actions, (prefix) => firstViolation(prefix) !== null) ?? actions;
        failures.push(
          `case ${index} (seed ${seed}, length ${length}): step ${violation.step} ` +
            `${describeAction(actions[violation.step])}: ${violation.message}\n` +
            `  shrunk prefix (${shrunk.length}): [${shrunk.map(describeAction).join(", ")}]`,
        );
        continue;
      }

      const run = runSequence(actions);
      for (const result of run.results) {
        if (result.accepted) accepted += 1;
        else rejected += 1;
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
    // The generator must exercise both branches of the property.
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });
});

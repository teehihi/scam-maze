/**
 * Property 14 (design.md, "Correctness Properties"): for any seeded action sequence dispatched
 * through `createChapterStore`, subscribers are notified once per accepted action and never on a
 * rejected one, and `getState()` equals the state produced by folding the reducer over the same
 * sequence. Rejected dispatches keep the same state object, unsubscribed listeners are never
 * called again, and `replace` notifies exactly once.
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
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { createInitialState } from "../reducer";
import { createChapterStore } from "../store";
import type { CoreAction } from "../types";

/** Runs one case and returns its violation messages (empty when the property holds). */
function checkCase(index: number, seed: number): { violations: string[]; accepted: number; rejected: number } {
  const next = createLcg(seed ^ 0x27d4eb2f);
  const length = randomInt(next, 1, CORE_SEQUENCE_MAX_LENGTH);
  const actions = generateActionSequence(seed, length);
  // Step after which the second listener unsubscribes (0 = before the first dispatch).
  const unsubscribeAt = randomInt(next, 0, length);

  const violations: string[] = [];
  const fail = (message: string): void => {
    violations.push(`case ${index} (seed ${seed}, length ${length}): ${message}`);
  };

  const initial = createInitialState();
  const store = createChapterStore(initial, CHAPTER_1_SCENARIO);
  const expected = runSequence(actions, initial, CHAPTER_1_SCENARIO);

  let kept = 0;
  let dropped = 0;
  let neverCalled = 0;
  store.subscribe(() => {
    kept += 1;
  });
  let unsubscribeDropped: (() => void) | null = store.subscribe(() => {
    dropped += 1;
  });
  store.subscribe(() => {
    neverCalled += 1;
  })();

  let acceptedCount = 0;
  let droppedExpected = 0;
  let rejectedCount = 0;

  for (let step = 0; step < actions.length; step += 1) {
    if (step === unsubscribeAt && unsubscribeDropped !== null) {
      unsubscribeDropped();
      unsubscribeDropped = null;
    }
    const action = actions[step];
    const before = store.getState();
    const keptBefore = kept;
    // The generator also yields malformed values; the store must pass them to the reducer.
    const result = store.dispatch(action as CoreAction);
    const label = `step ${step} ${describeAction(action)}`;

    if (result.accepted !== expected.results[step].accepted) {
      fail(`${label}: accepted is ${result.accepted}, the reducer fold says ${expected.results[step].accepted}`);
      break;
    }
    if (result.accepted) {
      acceptedCount += 1;
      if (unsubscribeDropped !== null) droppedExpected += 1;
      if (kept !== keptBefore + 1) fail(`${label}: accepted, but listeners ran ${kept - keptBefore} times`);
      if (store.getState() !== result.state) fail(`${label}: getState() is not the result state`);
    } else {
      rejectedCount += 1;
      if (kept !== keptBefore) fail(`${label}: rejected, but listeners ran ${kept - keptBefore} times`);
      if (store.getState() !== before) fail(`${label}: rejected, but getState() changed object`);
    }
  }

  if (kept !== acceptedCount) fail(`kept listener ran ${kept} times for ${acceptedCount} accepted actions`);
  if (dropped !== droppedExpected) {
    fail(`unsubscribed listener ran ${dropped} times, expected ${droppedExpected} (unsubscribed at ${unsubscribeAt})`);
  }
  if (neverCalled !== 0) fail(`listener unsubscribed before any dispatch ran ${neverCalled} times`);
  expect(store.getState()).toEqual(expected.final);

  // replace notifies exactly once and sets the given state object.
  const keptBeforeReplace = kept;
  const droppedBeforeReplace = dropped;
  const replacement = createInitialState();
  store.replace(replacement);
  if (kept !== keptBeforeReplace + 1) fail(`replace notified ${kept - keptBeforeReplace} times`);
  if (dropped !== droppedBeforeReplace && unsubscribeDropped === null) fail("replace called an unsubscribed listener");
  if (neverCalled !== 0) fail("replace called a listener unsubscribed before any dispatch");
  if (store.getState() !== replacement) fail("getState() after replace is not the replacement state");

  return { violations, accepted: acceptedCount, rejected: rejectedCount };
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("chapter store notifications", () => {
  it("notifies exactly on accepted actions and mirrors the reducer fold", () => {
    // Feature: chapter-01-the-urgent-call, Property 14: The store notifies exactly on accepted actions
    const failures: string[] = [];
    let accepted = 0;
    let rejected = 0;

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const outcome = checkCase(index, caseSeed(CORE_PROPERTY_SEED ^ 0x14, index));
      failures.push(...outcome.violations);
      accepted += outcome.accepted;
      rejected += outcome.rejected;
    }

    expect(failures, failures.join("\n")).toEqual([]);
    // The generator must exercise both branches of the property.
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});

/**
 * Property 3: The core is deterministic (design.md, "Correctness Properties").
 *
 * For any seeded action sequence, dispatching the same sequence twice from
 * `createInitialState()` produces deeply equal Chapter_States and identical accepted/rejected
 * flags at every step. The same holds after a JSON round trip of the actions (the shape a save or
 * replay would use), and replaying only the actions recorded in the Event_Log reproduces the final
 * state.
 *
 * **Validates: Requirements 5.5, 18.5**
 */

import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";

/** Offset so this file's cases do not reuse another property file's sequences. */
const PROPERTY_SEED = (CORE_PROPERTY_SEED + 3) >>> 0;

/** 200 cases of up to 80 actions, each run four times with deep comparisons, exceed Vitest's 5 s default. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("Chapter 1 core properties", () => {
  // Feature: chapter-01-the-urgent-call, Property 3: The core is deterministic
  it("produces identical states and results for the same action sequence", () => {
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(PROPERTY_SEED, index);
      const length = randomInt(createLcg(seed), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const label = `seed ${seed} (case ${index}, length ${length})`;

      // Same sequence twice: deep-equal states and identical results at every step.
      const first = runSequence(actions);
      const second = runSequence(actions);
      expect(second.states, label).toEqual(first.states);
      expect(second.results, label).toEqual(first.results);
      expect(
        second.results.map((result) => result.accepted),
        label,
      ).toEqual(first.results.map((result) => result.accepted));

      // JSON round trip of the actions. `undefined` entries become `null` in a JSON array and
      // both are malformed values the reducer rejects, so the state sequence must not change.
      const roundTripped = JSON.parse(JSON.stringify(actions)) as unknown[];
      const fromJson = runSequence(roundTripped);
      expect(fromJson.states, label).toEqual(first.states);
      expect(
        fromJson.results.map((result) => result.accepted),
        label,
      ).toEqual(first.results.map((result) => result.accepted));

      // Replaying the Event_Log's actions reproduces the final state, and every replayed action
      // is accepted again.
      const logged = first.final.events.map((entry) => entry.action);
      const replay = runSequence(logged);
      expect(replay.final, label).toEqual(first.final);
      expect(
        replay.results.every((result) => result.accepted),
        label,
      ).toBe(true);
    }
  }, PROPERTY_TIMEOUT_MS);
});

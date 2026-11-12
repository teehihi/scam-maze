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
import { chapterReducer } from "../reducer";
import type { ChapterState, CoreAction } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const PHONE_NEUTRAL_SEED = (CORE_PROPERTY_SEED ^ 0x00070007) >>> 0;

const OPEN_PHONE: CoreAction = { type: "OPEN_PHONE" };
const CLOSE_PHONE: CoreAction = { type: "CLOSE_PHONE" };

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("chapter core phone neutrality", () => {
  it("never changes objectives when the phone is opened or closed", () => {
    // Feature: chapter-01-the-urgent-call, Property 7: Opening and closing the phone never changes objectives
    let acceptedOpens = 0;
    let acceptedCloses = 0;

    /** Dispatches `action` on `state`; when accepted, checks objectives and returns the new state. */
    function checkPhoneAction(state: ChapterState, action: CoreAction, where: string): ChapterState | null {
      const result = chapterReducer(state, action);
      if (!result.accepted) return null;
      if (action.type === "OPEN_PHONE") acceptedOpens += 1;
      else acceptedCloses += 1;
      const context = `${where}, ${action.type}`;
      expect(result.state.objectives, context).toEqual(state.objectives);
      const entry = result.state.events.at(-1);
      expect(entry, context).toBeDefined();
      expect(entry?.derived.objectivesActivated, context).toEqual([]);
      expect(entry?.derived.objectivesCompleted, context).toEqual([]);
      return result.state;
    }

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(PHONE_NEUTRAL_SEED, index);
      const next = createLcg(seed);
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      const run = runSequence(generateActionSequence(seed, length));

      run.states.forEach((state, step) => {
        const where = `seed ${seed} (case ${index}), step ${step}`;
        // Open, then close the opened phone, so CLOSE_PHONE is exercised in accepted states too.
        const opened = checkPhoneAction(state, OPEN_PHONE, where);
        if (opened !== null) checkPhoneAction(opened, CLOSE_PHONE, `${where}, after OPEN_PHONE`);
        checkPhoneAction(state, CLOSE_PHONE, where);
      });
    }

    // The property is only meaningful if both actions were accepted in some reachable states.
    expect(acceptedOpens).toBeGreaterThan(0);
    expect(acceptedCloses).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});

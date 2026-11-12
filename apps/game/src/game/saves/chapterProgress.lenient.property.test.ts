import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import type { CoreAction } from "../narrative/types";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../test/chapterRuns";
import { createLcg, randomInt } from "../../test/seededRandom";
import { encodeProgress, restoreProgress } from "./chapterProgress";
import type { ChapterProgressV2 } from "./saveGame";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/** Base seed for this file, derived from the shared core seed. */
const FILE_SEED = (CORE_PROPERTY_SEED ^ 0x1e41e47) >>> 0;
const RUNS = Math.max(100, CORE_PROPERTY_RUNS);

function makeProgress(actions: readonly unknown[], checkpointId = "cp.test"): ChapterProgressV2 {
  return { checkpointId, actions: actions as CoreAction[], playerPose: null };
}

describe("chapterProgress lenient restore property", () => {
  // Feature: chapter-01-voice-narrative, Property 16: Lenient restore returns the longest accepted prefix
  it(
    "returns the state of the longest accepted prefix, trimmed iff an action was rejected, and equals strict restore for valid logs",
    () => {
      let trimmedCases = 0;
      let fullCases = 0;

      for (let run = 0; run < RUNS; run += 1) {
        const seed = caseSeed(FILE_SEED, run);
        const next = createLcg(seed);
        const length = randomInt(next, 1, CORE_SEQUENCE_MAX_LENGTH);
        const generated = generateActionSequence(seed, length);
        const generatedRun = runSequence(generated);

        // Drifted log: accepted up to index k, rejected at index k (when one exists), then any tail.
        const rejectedAt = generatedRun.results.findIndex((result) => !result.accepted);
        const label = (extra: string) => `seed=${seed} case=${run} ${extra}`;

        const driftedAccepted = rejectedAt === -1 ? generated.length : rejectedAt;
        const drifted = makeProgress(generated);
        const lenient = restoreProgress(drifted, CHAPTER_1_SCENARIO, { lenient: true });

        const shrunk = () =>
          shrinkFailingPrefix(generated, (prefix) => {
            const r = restoreProgress(makeProgress(prefix), CHAPTER_1_SCENARIO, { lenient: true });
            return !r.ok || r.acceptedActions !== runSequence(prefix).results.findIndex((x) => !x.accepted);
          })?.map(describeAction);

        expect(lenient.ok, label(`shortest failing prefix=${JSON.stringify(shrunk())}`)).toBe(true);
        if (!lenient.ok) continue;

        const expectedPrefix = runSequence(generated.slice(0, driftedAccepted));
        expect(lenient.acceptedActions, label("acceptedActions")).toBe(driftedAccepted);
        expect(lenient.trimmed, label("trimmed")).toBe(rejectedAt !== -1);
        expect(lenient.state, label("state equals replay of the first k actions")).toEqual(expectedPrefix.final);
        if (lenient.trimmed) trimmedCases += 1;

        // Valid log: only accepted actions. Lenient equals strict and is not trimmed.
        const validActions = generated.filter((_, index) => generatedRun.results[index].accepted);
        const validRun = runSequence(validActions);
        expect(
          validRun.results.every((result) => result.accepted),
          label("filtered log is fully accepted"),
        ).toBe(true);
        const valid = makeProgress(validActions);
        const strict = restoreProgress(valid, CHAPTER_1_SCENARIO);
        const validLenient = restoreProgress(valid, CHAPTER_1_SCENARIO, { lenient: true });
        expect(strict.ok, label("strict restore of valid log")).toBe(true);
        expect(validLenient.ok, label("lenient restore of valid log")).toBe(true);
        if (strict.ok && validLenient.ok) {
          expect(validLenient.trimmed, label("valid log not trimmed")).toBe(false);
          expect(validLenient.acceptedActions, label("valid log acceptedActions")).toBe(validActions.length);
          expect(validLenient.state, label("lenient equals strict")).toEqual(strict.state);
          expect(validLenient.pose, label("pose")).toEqual(strict.pose);
          fullCases += 1;
        }

        // Saves do not depend on locale or audio: encoding keeps only these three keys.
        if (strict.ok) {
          const encoded = encodeProgress(strict.state, null, "cp.test");
          expect(encoded === null ? [] : Object.keys(encoded).sort(), label("encoded keys")).toEqual([
            "actions",
            "checkpointId",
            "playerPose",
          ]);
          if (encoded !== null) {
            const again = restoreProgress(JSON.parse(JSON.stringify(encoded)) as ChapterProgressV2, CHAPTER_1_SCENARIO, {
              lenient: true,
            });
            expect(again.ok && again.trimmed, label("round trip not trimmed")).toBe(false);
            if (again.ok) expect(again.state, label("round trip state")).toEqual(strict.state);
          }
        }
      }

      // The generator must exercise both branches.
      expect(trimmedCases).toBeGreaterThan(0);
      expect(fullCases).toBe(RUNS);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

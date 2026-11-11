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
import { STANCE_TEXT, selectJournalEntries } from "../selectors";
import type { ChapterState } from "../types";

/** Messages describing how the journal for `state` differs from the property. */
function journalViolations(state: ChapterState): string[] {
  const violations: string[] = [];
  const entries = selectJournalEntries(state);

  // Entry IDs equal state.discovered, in the same order (so no undiscovered item appears).
  const ids = entries.map((entry) => entry.id);
  if (JSON.stringify(ids) !== JSON.stringify(state.discovered)) {
    violations.push(`journal ids ${JSON.stringify(ids)} differ from discovered ${JSON.stringify(state.discovered)}`);
  }

  // Each entry's stances come from the Evidence_Item relations in Scenario_Data.
  for (const entry of entries) {
    const item = CHAPTER_1_SCENARIO.evidence[entry.id];
    const expected = item.relations.map((relation) => ({
      claimId: relation.claimId,
      stance: relation.stance,
      stanceText: STANCE_TEXT[relation.stance],
      note: relation.note,
    }));
    const actual = entry.stances.map(({ claimId, stance, stanceText, note }) => ({ claimId, stance, stanceText, note }));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      violations.push(`stances of ${entry.id} do not match Scenario_Data relations`);
    }
  }

  // A journal note appears exactly once when all its required evidence is discovered, else never.
  const shownNotes = entries.flatMap((entry) => entry.notes);
  for (const note of CHAPTER_1_SCENARIO.journalNotes) {
    const unlocked = note.requires.length > 0 && note.requires.every((id) => state.discovered.includes(id));
    const expectedCount = CHAPTER_1_SCENARIO.journalNotes.filter(
      (other) =>
        other.text === note.text &&
        other.requires.length > 0 &&
        other.requires.every((id) => state.discovered.includes(id)),
    ).length;
    const count = shownNotes.filter((text) => text === note.text).length;
    if (count !== expectedCount) {
      violations.push(`note ${note.id} shown ${count} times, expected ${expectedCount} (unlocked: ${unlocked})`);
    }
  }
  return violations;
}

/** Index of the first state in the run whose journal violates the property, or -1. */
function firstViolatingState(actions: readonly unknown[]): { index: number; violations: string[] } {
  const { states } = runSequence(actions);
  for (let index = 0; index < states.length; index += 1) {
    const violations = journalViolations(states[index]);
    if (violations.length > 0) return { index, violations };
  }
  return { index: -1, violations: [] };
}

describe("chapter core properties", () => {
  // Feature: chapter-01-the-urgent-call, Property 10: The journal shows exactly the discovered evidence in order
  it("shows exactly the discovered evidence in discovery order, with notes once unlocked", () => {
    // **Validates: Requirements 11.7, 11.8**
    const baseSeed = (CORE_PROPERTY_SEED ^ 0x10) >>> 0;
    for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
      const seed = caseSeed(baseSeed, run);
      const length = randomInt(createLcg(seed ^ 0x5f3759df), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const failure = firstViolatingState(actions);
      if (failure.index === -1) continue;

      const prefix =
        shrinkFailingPrefix(actions, (candidate) => firstViolatingState(candidate).index !== -1) ?? actions;
      const shrunk = firstViolatingState(prefix);
      const report = [
        `Journal property violated (case ${run}, seed ${seed}, length ${length}).`,
        `Shrunk prefix (${prefix.length} actions):`,
        ...prefix.map((action, i) => `  ${i}: ${describeAction(action)}`),
        `Violations at state ${shrunk.index}:`,
        ...shrunk.violations.map((message) => `  - ${message}`),
      ].join("\n");
      expect.fail(report);
    }
  });
});

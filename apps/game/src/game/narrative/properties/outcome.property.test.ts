import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  completeChapterFrom,
  describeAction,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { CLAIM_IDS, DECISION_IDS, FLAG_IDS, OUTCOME_IDS, type DecisionId, type OutcomeId } from "../chapter1/ids";
import { selectConsequenceVariant, selectOutcome } from "../outcome";
import { createInitialState, isCoreAction } from "../reducer";
import type { ChapterState, ClaimStatus, Condition, EndingDef, ScenarioDefinition } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const OUTCOME_SEED = (CORE_PROPERTY_SEED ^ 0x00060006) >>> 0;

const CLAIM_STATUSES: readonly ClaimStatus[] = ["unverified", "supported", "contradicted", "inconclusive"];
const DECISIONS_OR_NONE: readonly (DecisionId | null)[] = [null, ...DECISION_IDS];

/** Reference outcome table, written independently of `selectOutcome` (design, Property 6). */
function referenceOutcome(state: ChapterState): OutcomeId | null {
  const decision = state.decision;
  if (decision === null) return null;
  const risky = state.flags.code_shared === true || state.flags.money_moved === true;
  if (risky) return "risky";
  const identity = state.claims["claim.caller-identity"];
  if (decision === "verify-independently" && identity === "contradicted") return "verified";
  if (decision === "stop-and-wait") return "uncertain";
  return null;
}

/** Reference Chapter 1 consequence variant table (design, "Endings"). */
function referenceChapter1Variant(state: ChapterState, outcome: OutcomeId): string {
  switch (outcome) {
    case "verified":
      return "verified.reported";
    case "uncertain":
      return "uncertain.stopped";
    case "risky":
      if (state.flags.money_moved) return "risky.money-moved";
      if (state.flags.code_shared && state.flags.account_locked) return "risky.code-shared-locked";
      return "risky.code-shared";
  }
}

/** A hand-built state: random flags, claim statuses and decision, then the forced combination. */
function craftedState(
  next: () => number,
  codeShared: boolean,
  moneyMoved: boolean,
  decision: DecisionId | null,
  identity: ClaimStatus,
): ChapterState {
  const base = createInitialState();
  const flags = { ...base.flags };
  for (const flag of FLAG_IDS) flags[flag] = next() < 0.5;
  flags.code_shared = codeShared;
  flags.money_moved = moneyMoved;
  const claims = { ...base.claims };
  for (const claim of CLAIM_IDS) claims[claim] = pick(next, CLAIM_STATUSES);
  claims["claim.caller-identity"] = identity;
  return { ...base, status: "playing", decision, flags, claims };
}

/** Independent evaluator for the condition kinds used by the synthetic variants below. */
function holds(condition: Condition, state: ChapterState): boolean {
  switch (condition.kind) {
    case "flag":
      return state.flags[condition.flag] === true;
    case "notFlag":
      return state.flags[condition.flag] !== true;
    case "claimStatus":
      return state.claims[condition.claimId] === condition.status;
    default:
      throw new Error(`Unexpected condition kind in synthetic variant: ${condition.kind}`);
  }
}

function randomCondition(next: () => number): Condition {
  switch (randomInt(next, 0, 2)) {
    case 0:
      return { kind: "flag", flag: pick(next, FLAG_IDS) };
    case 1:
      return { kind: "notFlag", flag: pick(next, FLAG_IDS) };
    default:
      return { kind: "claimStatus", claimId: pick(next, CLAIM_IDS), status: pick(next, CLAIM_STATUSES) };
  }
}

/** A scenario whose endings have 1-5 random variants (possibly none matching). */
function syntheticScenario(next: () => number): ScenarioDefinition {
  const endings = {} as Record<OutcomeId, EndingDef>;
  for (const outcome of OUTCOME_IDS) {
    const count = randomInt(next, 1, 5);
    const variants = Array.from({ length: count }, (_, index) => ({
      id: `${outcome}.v${index}`,
      when: Array.from({ length: randomInt(next, 0, 2) }, () => randomCondition(next)),
      text: `Variant ${index}`,
    }));
    endings[outcome] = { ...CHAPTER_1_SCENARIO.endings[outcome], variants };
  }
  return { ...CHAPTER_1_SCENARIO, endings };
}

function checkVariants(state: ChapterState, outcome: OutcomeId | null, context: string, next: () => number): void {
  if (outcome === null) {
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO, null), context).toBeNull();
    return;
  }
  expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO, outcome)?.id, context).toBe(
    referenceChapter1Variant(state, outcome),
  );
  const scenario = syntheticScenario(next);
  const expected = scenario.endings[outcome].variants.find((variant) =>
    variant.when.every((condition) => holds(condition, state)),
  );
  expect(selectConsequenceVariant(state, scenario, outcome)?.id ?? null, `${context}, synthetic`).toBe(
    expected?.id ?? null,
  );
}

describe("chapter core outcome function", () => {
  it("matches the reference outcome table and picks the first matching consequence variant", () => {
    // Feature: chapter-01-the-urgent-call, Property 6: Outcome function matches the outcome table
    let decisionsChecked = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(OUTCOME_SEED, index);
      const next = createLcg(seed);
      const context = `seed ${seed} (case ${index})`;

      // Hand-built: every combination of the four inputs, with random other flags and claims.
      for (const codeShared of [false, true]) {
        for (const moneyMoved of [false, true]) {
          for (const decision of DECISIONS_OR_NONE) {
            for (const identity of CLAIM_STATUSES) {
              const state = craftedState(next, codeShared, moneyMoved, decision, identity);
              const where = `${context}, code_shared=${codeShared} money_moved=${moneyMoved} decision=${String(decision)} identity=${identity}`;
              const expected = referenceOutcome(state);
              expect(selectOutcome(state), where).toBe(expected);
              checkVariants(state, expected, where, next);
            }
          }
        }
      }

      // Reachable: a random run, then the guided policy to an Outcome.
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const run = runSequence(actions);
      run.results.forEach((result, step) => {
        const action = actions[step];
        if (!result.accepted || !isCoreAction(action) || action.type !== "MAKE_DECISION") return;
        const where = `${context}, step ${step} ${describeAction(action)}`;
        decisionsChecked += 1;
        expect(result.state.outcome, where).not.toBeNull();
        expect(result.state.outcome, where).toBe(selectOutcome(result.state));
      });
      const completion = completeChapterFrom(run.final);
      for (const action of completion.actions) {
        if (action.type === "MAKE_DECISION") decisionsChecked += 1;
      }
      for (const state of [...run.states, completion.outcomeState, completion.final]) {
        const where = `${context}, reachable state with decision ${String(state.decision)}`;
        if (state.outcome !== null) {
          expect(state.outcome, where).toBe(referenceOutcome(state));
          expect(state.outcome, where).toBe(selectOutcome(state));
        }
        checkVariants(state, state.outcome, where, next);
        expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id ?? null, where).toBe(
          state.outcome === null ? null : referenceChapter1Variant(state, state.outcome),
        );
      }
    }
    expect(decisionsChecked).toBeGreaterThan(0);
  });
});

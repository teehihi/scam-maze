import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { CLAIM_IDS, DECISION_IDS, EVIDENCE_IDS, FLAG_IDS, type EvidenceId, type OutcomeId } from "../chapter1/ids";
import { selectOutcome } from "../outcome";
import { createInitialState } from "../reducer";
import type { ChapterState, ClaimStatus } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const INVESTIGATOR_SEED = (CORE_PROPERTY_SEED ^ 0x00060007) >>> 0;

const CLAIM_STATUSES: readonly ClaimStatus[] = ["unverified", "supported", "contradicted", "inconclusive"];

/** The eleven evidence items listed by the investigator ending (design.md, "Endings"). */
const LISTED_EVIDENCE: readonly EvidenceId[] = [
  "ev.caller-number",
  "ev.bank-card",
  "ev.bank-letter",
  "ev.bank-app",
  "ev.shop-poster",
  "ev.community-alert",
  "ev.sam-testimony",
  "ev.official-confirmation",
  "ev.transfer-check",
  "ev.second-number",
  "ev.partial-info",
];

/** Minimum number of listed evidence items for the investigator outcome. */
const REQUIRED_EVIDENCE = 8;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/** Reference rule for the investigator outcome, written independently of `selectOutcome`. */
function referenceIsInvestigator(state: ChapterState): boolean {
  const risky = state.flags.code_shared === true || state.flags.money_moved === true;
  const listed = LISTED_EVIDENCE.filter((id) => state.discovered.includes(id)).length;
  return (
    state.decision === "verify-independently" &&
    state.claims["claim.caller-identity"] === "contradicted" &&
    !risky &&
    state.flags.report_filed === true &&
    listed >= REQUIRED_EVIDENCE
  );
}

/** Returns one message per violated clause of Property 6 for `state`. Empty means it holds. */
function violations(state: ChapterState): string[] {
  const found: string[] = [];
  const first: OutcomeId | null = selectOutcome(state);
  const second: OutcomeId | null = selectOutcome(state);
  if (first !== second) found.push(`not deterministic: ${String(first)} then ${String(second)}`);
  const expectedInvestigator = referenceIsInvestigator(state);
  if ((first === "investigator") !== expectedInvestigator) {
    found.push(`investigator is ${first === "investigator"} but the rule says ${expectedInvestigator}`);
  }
  if ((first === "investigator" || first === "verified") && (state.flags.code_shared || state.flags.money_moved)) {
    found.push(`${first} outcome with code_shared=${state.flags.code_shared} money_moved=${state.flags.money_moved}`);
  }
  return found;
}

/** A hand-built state: random flags, claims, decision and discovered evidence, biased to the boundary. */
function craftedState(next: () => number): ChapterState {
  const base = createInitialState();
  const flags = { ...base.flags };
  for (const flag of FLAG_IDS) flags[flag] = next() < 0.5;
  // Keep the risky flags rare so investigator states are common enough to test.
  flags.code_shared = next() < 0.15;
  flags.money_moved = next() < 0.15;
  flags.report_filed = next() < 0.7;
  const claims = { ...base.claims };
  for (const claim of CLAIM_IDS) claims[claim] = pick(next, CLAIM_STATUSES);
  if (next() < 0.7) claims["claim.caller-identity"] = "contradicted";

  // Discovered: a target count of listed items around the threshold, plus random other items.
  const target = randomInt(next, REQUIRED_EVIDENCE - 2, LISTED_EVIDENCE.length);
  const listed = [...LISTED_EVIDENCE].sort(() => next() - 0.5).slice(0, target);
  const others = EVIDENCE_IDS.filter((id) => !LISTED_EVIDENCE.includes(id) && next() < 0.5);
  const discovered = [...listed, ...others];

  const decision = next() < 0.75 ? "verify-independently" : pick(next, [null, ...DECISION_IDS]);
  return { ...base, status: "playing", decision, flags, claims, discovered };
}

describe("chapter core investigator outcome", () => {
  it("is deterministic, exact and never rewards a dangerous action", () => {
    // Feature: chapter-01-voice-narrative, Property 6: Outcomes are deterministic, exact and never reward a dangerous action
    let investigatorStates = 0;
    let boundaryBelow = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(INVESTIGATOR_SEED, index);
      const next = createLcg(seed);
      const context = `seed ${seed} (case ${index})`;

      // Hand-built states.
      for (let n = 0; n < 20; n += 1) {
        const state = craftedState(next);
        expect(violations(state), `${context}, crafted state ${n}`).toEqual([]);
        if (selectOutcome(state) === "investigator") investigatorStates += 1;
        const listed = LISTED_EVIDENCE.filter((id) => state.discovered.includes(id)).length;
        if (listed === REQUIRED_EVIDENCE - 1 && selectOutcome(state) !== "investigator") boundaryBelow += 1;
      }

      // Reachable states of a random run, with the shortest failing prefix on failure.
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const run = runSequence(actions);
      run.states.forEach((state, step) => {
        const found = violations(state);
        if (found.length === 0) return;
        const prefix = shrinkFailingPrefix(actions, (candidate) =>
          violations(runSequence(candidate).final).length > 0,
        );
        expect.fail(`${context}, step ${step}, shortest failing prefix length ${prefix?.length}: ${found.join("; ")}`);
      });
    }
    expect(investigatorStates).toBeGreaterThan(0);
    expect(boundaryBelow).toBeGreaterThan(0);
    expect(CHAPTER_1_SCENARIO.endings.investigator.unlockWhen).toBeDefined();
  }, PROPERTY_TIMEOUT_MS);
});

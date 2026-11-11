// Outcome function and consequence variant selection for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Outcome function" and "Endings",
// and Requirements 13.7, 13.9, 13.10.

import type { OutcomeId } from "./chapter1/ids";
import { evaluateConditions } from "./conditions";
import type { ChapterState, EndingDef, ScenarioDefinition } from "./types";

/** One consequence text variant of an Ending. */
export type ConsequenceVariant = EndingDef["variants"][number];

/**
 * Maps the state to an Outcome, exactly as the design's outcome table:
 * - a risky flag (`code_shared` or `money_moved`) gives `risky`, but only once a Decision exists;
 * - `verify-independently` with the caller identity Claim contradicted gives `verified`;
 * - `stop-and-wait` gives `uncertain`;
 * - anything else gives `null`.
 */
export function selectOutcome(state: ChapterState): OutcomeId | null {
  if (state.flags.code_shared || state.flags.money_moved) return state.decision ? "risky" : null;
  if (
    state.decision === "verify-independently" &&
    state.claims["claim.caller-identity"] === "contradicted"
  ) {
    return "verified";
  }
  if (state.decision === "stop-and-wait") return "uncertain";
  return null;
}

/**
 * Returns the first consequence variant of the Outcome's Ending whose conditions all hold.
 * The Outcome defaults to `state.outcome`. Returns `null` when there is no Outcome, no Ending
 * for it, or no variant matches (the last variant of each Ending has no conditions, so this
 * only happens with broken data).
 */
export function selectConsequenceVariant(
  state: ChapterState,
  scenario: ScenarioDefinition,
  outcome: OutcomeId | null = state.outcome,
): ConsequenceVariant | null {
  if (outcome === null) return null;
  if (!Object.hasOwn(scenario.endings, outcome)) return null;
  const ending = scenario.endings[outcome];
  return ending.variants.find((variant) => evaluateConditions(variant.when, state, scenario)) ?? null;
}

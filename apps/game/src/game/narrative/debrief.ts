// Debrief builder for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Debrief builder", and
// Requirements 14.3-14.5.
//
// Every listed decision, Evidence_Item, warning sign and missed clue comes only from
// Scenario_Data and the Event_Log (Requirement 14.4). The Outcome and its consequence variant
// come from the state's Outcome and the authored Ending.

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type { EvidenceId, OutcomeId, WarningSignId } from "./chapter1/ids";
import { selectConsequenceVariant } from "./outcome";
import type { ChapterState, ScenarioDefinition } from "./types";

export interface DebriefView {
  outcome: {
    id: OutcomeId;
    title: string;
    summary: string;
    consequence: { id: string; text: string } | null;
    /** "Simulation: nothing real happened." */
    simulationLabel: string;
  };
  /** Event_Log entries with a debrief tag that has decision note text, in log order. */
  decisions: Array<{ seq: number; tag: string; text: string }>;
  /** Discovered evidence, in discovery order. */
  evidenceFound: Array<{ id: EvidenceId; title: string }>;
  /** Union of the warning signs of the discovered evidence, in first-seen order. */
  warningSignsNoticed: Array<{ id: WarningSignId; label: string }>;
  /** Evidence with a debrief hint that was not discovered, in scenario order (Requirement 14.5). */
  cluesMissed: Array<{ id: EvidenceId; title: string; hint: string }>;
  mechanism: string;
  saferAlternatives: string[];
}

/**
 * Builds the debrief for a state with an Outcome. Returns `null` when no Outcome is set.
 * Pure: never mutates its inputs.
 */
export function buildDebrief(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): DebriefView | null {
  const outcomeId = state.outcome;
  if (outcomeId === null || !Object.hasOwn(scenario.endings, outcomeId)) return null;
  const ending = scenario.endings[outcomeId];
  const variant = selectConsequenceVariant(state, scenario, outcomeId);

  const decisions: DebriefView["decisions"] = [];
  const found: EvidenceId[] = [];
  for (const entry of state.events) {
    for (const tag of entry.derived.debriefTags) {
      if (Object.hasOwn(scenario.debrief.decisionNotes, tag)) {
        decisions.push({ seq: entry.seq, tag, text: scenario.debrief.decisionNotes[tag] });
      }
    }
    for (const id of entry.derived.evidence) {
      if (!found.includes(id) && Object.hasOwn(scenario.evidence, id)) found.push(id);
    }
  }

  const signs: WarningSignId[] = [];
  for (const id of found) {
    for (const sign of scenario.evidence[id].warningSigns) {
      if (!signs.includes(sign)) signs.push(sign);
    }
  }

  const cluesMissed: DebriefView["cluesMissed"] = [];
  for (const id of Object.keys(scenario.evidence) as EvidenceId[]) {
    const item = scenario.evidence[id];
    if (item.debriefHint && !found.includes(id)) {
      cluesMissed.push({ id, title: item.title, hint: item.debriefHint });
    }
  }

  return {
    outcome: {
      id: outcomeId,
      title: ending.title,
      summary: scenario.debrief.outcomeSummaries[outcomeId] ?? "",
      consequence: variant ? { id: variant.id, text: variant.text } : null,
      simulationLabel: ending.simulationLabel,
    },
    decisions,
    evidenceFound: found.map((id) => ({ id, title: scenario.evidence[id].title })),
    warningSignsNoticed: signs
      .filter((id) => Object.hasOwn(scenario.warningSigns, id))
      .map((id) => ({ id, label: scenario.warningSigns[id].label })),
    cluesMissed,
    mechanism: scenario.debrief.mechanism,
    saferAlternatives: [...scenario.debrief.saferAlternatives],
  };
}

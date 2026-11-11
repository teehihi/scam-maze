// Property 11 (design.md, "Correctness Properties"): the debrief is derived only from data and
// the Event_Log. Each case runs a seeded random action sequence, then completes the chapter with
// the guided policy, and checks `buildDebrief` against values computed here from Scenario_Data,
// `state.discovered` and `state.events`. It also checks that the debrief is the same when built
// twice and when built from a state rebuilt by replaying the Event_Log actions.

import { describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  completeChapterFrom,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import type { EvidenceId, WarningSignId } from "../chapter1/ids";
import { evaluateConditions } from "../conditions";
import { buildDebrief } from "../debrief";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState } from "../types";

/** Seed offset so this file's sequences differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x000b) >>> 0;

const scenario = CHAPTER_1_SCENARIO;

/** Rebuilds a state by dispatching every Event_Log action from the initial state. */
function replayEventLog(state: ChapterState): ChapterState {
  let rebuilt = createInitialState();
  for (const entry of state.events) {
    const result = chapterReducer(rebuilt, entry.action, scenario);
    if (!result.accepted) {
      throw new Error(`Replay of event ${entry.seq} was rejected: ${result.reason ?? ""}`);
    }
    rebuilt = result.state;
  }
  return rebuilt;
}

function checkDebrief(state: ChapterState, label: string): void {
  const outcome = state.outcome;
  expect(outcome, `${label}: completed state has an outcome`).not.toBeNull();
  if (outcome === null) return;

  const view = buildDebrief(state, scenario);
  expect(view, `${label}: debrief exists`).not.toBeNull();
  if (view === null) return;

  // Evidence found equals the discovered set, in discovery order.
  expect(view.evidenceFound.map((item) => item.id), `${label}: evidence found`).toEqual(state.discovered);
  for (const item of view.evidenceFound) {
    expect(item.title, `${label}: evidence title ${item.id}`).toBe(scenario.evidence[item.id].title);
  }

  // Every decision line comes from decisionNotes for a tag present in that Event_Log entry,
  // and every tagged entry with a note is listed.
  const expectedDecisions = state.events.flatMap((entry) =>
    entry.derived.debriefTags
      .filter((tag) => Object.hasOwn(scenario.debrief.decisionNotes, tag))
      .map((tag) => ({ seq: entry.seq, tag, text: scenario.debrief.decisionNotes[tag] })),
  );
  for (const line of view.decisions) {
    const entry = state.events[line.seq];
    expect(entry?.derived.debriefTags ?? [], `${label}: decision tag ${line.tag} in event ${line.seq}`).toContain(
      line.tag,
    );
    expect(line.text, `${label}: decision text for ${line.tag}`).toBe(scenario.debrief.decisionNotes[line.tag]);
  }
  expect(view.decisions, `${label}: decision lines`).toEqual(expectedDecisions);

  // Warning signs equal the union over the discovered evidence.
  const expectedSigns = new Set<WarningSignId>(
    state.discovered.flatMap((id) => scenario.evidence[id].warningSigns),
  );
  const noticed = view.warningSignsNoticed.map((sign) => sign.id);
  expect(new Set(noticed).size, `${label}: warning signs have no duplicates`).toBe(noticed.length);
  expect(new Set(noticed), `${label}: warning signs`).toEqual(expectedSigns);
  for (const sign of view.warningSignsNoticed) {
    expect(sign.label, `${label}: warning sign label ${sign.id}`).toBe(scenario.warningSigns[sign.id].label);
  }

  // Clues missed equal the undiscovered evidence that has a debrief hint, in scenario order.
  const expectedMissed = (Object.keys(scenario.evidence) as EvidenceId[])
    .filter((id) => Boolean(scenario.evidence[id].debriefHint) && !state.discovered.includes(id))
    .map((id) => ({ id, title: scenario.evidence[id].title, hint: scenario.evidence[id].debriefHint }));
  expect(view.cluesMissed, `${label}: clues missed`).toEqual(expectedMissed);

  // Outcome summary and consequence variant match Scenario_Data.
  const ending = scenario.endings[outcome];
  expect(view.outcome.id).toBe(outcome);
  expect(view.outcome.title).toBe(ending.title);
  expect(view.outcome.summary).toBe(scenario.debrief.outcomeSummaries[outcome] ?? "");
  expect(view.outcome.simulationLabel).toBe(ending.simulationLabel);
  const variant = ending.variants.find((candidate) => evaluateConditions(candidate.when, state, scenario));
  expect(variant, `${label}: a consequence variant matches`).toBeDefined();
  expect(view.outcome.consequence, `${label}: consequence variant`).toEqual(
    variant ? { id: variant.id, text: variant.text } : null,
  );
  expect(view.mechanism).toBe(scenario.debrief.mechanism);
  expect(view.saferAlternatives).toEqual(scenario.debrief.saferAlternatives);

  // Building twice gives a deep-equal view; replaying the Event_Log gives the same view.
  expect(buildDebrief(state, scenario), `${label}: built twice`).toEqual(view);
  const rebuilt = replayEventLog(state);
  expect(rebuilt, `${label}: replayed state`).toEqual(state);
  expect(buildDebrief(rebuilt, scenario), `${label}: debrief from replayed state`).toEqual(view);
}

describe("Property 11: The debrief is derived only from data and the Event_Log", () => {
  it("builds the debrief only from Scenario_Data and the Event_Log for random completed runs", () => {
    // Feature: chapter-01-the-urgent-call, Property 11: The debrief is derived only from data and the Event_Log
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const length = randomInt(createLcg(seed ^ 0x5a5a5a5a), 0, CORE_SEQUENCE_MAX_LENGTH);
      const run = runSequence(generateActionSequence(seed, length));
      const { outcomeState, final } = completeChapterFrom(run.final);
      const label = `seed ${seed}, case ${index}`;
      checkDebrief(outcomeState, `${label} (outcome state)`);
      checkDebrief(final, `${label} (finished state)`);
    }
  });
});

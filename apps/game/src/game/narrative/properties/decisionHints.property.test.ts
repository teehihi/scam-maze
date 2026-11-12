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
import type { DecisionId } from "../chapter1/ids";
import { REASONS, type ReasonCode } from "../reducer";
import { selectDecisionPanel } from "../selectors";
import type { ChapterState, ScenarioDefinition } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const DECISION_HINTS_SEED = (CORE_PROPERTY_SEED ^ 0x00090009) >>> 0;

/** Prefix that marks scenario hints in the relabeled scenario, so they never equal a core reason. */
const SCENARIO_MARK = "[scenario hint] ";

/**
 * The Chapter 1 scenario with every `unavailableHint` prefixed. Hints that come from scenario
 * data then carry the mark, and core reasons never do, so the origin of each hint is visible in
 * its text (as it is after localization, where scenario hints are translated and reasons are not).
 */
function relabeledScenario(): ScenarioDefinition {
  const decisions = { ...CHAPTER_1_SCENARIO.decisions };
  for (const id of Object.keys(decisions) as DecisionId[]) {
    const def = decisions[id];
    decisions[id] = {
      ...def,
      unavailableHint: SCENARIO_MARK + def.unavailableHint,
      ...(def.preStep
        ? { preStep: { ...def.preStep, unavailableHint: SCENARIO_MARK + def.preStep.unavailableHint } }
        : {}),
    };
  }
  return { ...CHAPTER_1_SCENARIO, decisions };
}

/** Every hint text the scenario data can produce. */
function scenarioHints(scenario: ScenarioDefinition): Set<string> {
  const hints = new Set<string>();
  for (const def of Object.values(scenario.decisions)) {
    hints.add(def.unavailableHint);
    if (def.preStep) hints.add(def.preStep.unavailableHint);
  }
  return hints;
}

const REASON_TEXTS = new Set<string>(Object.values(REASONS));

interface Counts {
  reason: number;
  scenario: number;
}

function checkHint(
  view: { hint: string | null; hintCode: ReasonCode | null },
  fromScenario: Set<string>,
  marked: boolean,
  where: string,
  counts: Counts,
): void {
  if (view.hintCode !== null) {
    counts.reason += 1;
    expect(Object.hasOwn(REASONS, view.hintCode), where).toBe(true);
    expect(view.hint, where).toBe(REASONS[view.hintCode]);
    return;
  }
  if (view.hint === null) return;
  counts.scenario += 1;
  expect(fromScenario.has(view.hint), `${where}: hint "${view.hint}" is not scenario data`).toBe(true);
  if (marked) {
    expect(view.hint.startsWith(SCENARIO_MARK), where).toBe(true);
    expect(REASON_TEXTS.has(view.hint), where).toBe(false);
  }
}

function checkPanel(
  state: ChapterState,
  scenario: ScenarioDefinition,
  fromScenario: Set<string>,
  marked: boolean,
  where: string,
  counts: Counts,
): void {
  for (const option of selectDecisionPanel(state, scenario).options) {
    checkHint(option, fromScenario, marked, `${where}, option ${option.id}`, counts);
    if (option.preStep) {
      checkHint(option.preStep, fromScenario, marked, `${where}, pre-step of ${option.id}`, counts);
    }
  }
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("decision panel hint codes", () => {
  it("sets hintCode exactly when the hint is a core reason", () => {
    // Feature: game-i18n-en-vi, Property 9: Decision hint codes match their reasons
    const scenarios: { scenario: ScenarioDefinition; marked: boolean }[] = [
      { scenario: CHAPTER_1_SCENARIO, marked: false },
      { scenario: relabeledScenario(), marked: true },
    ];
    const counts: Counts = { reason: 0, scenario: 0 };
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(DECISION_HINTS_SEED, index);
      const next = createLcg(seed);
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      for (const { scenario, marked } of scenarios) {
        const fromScenario = scenarioHints(scenario);
        const context = `seed ${seed} (case ${index}, ${marked ? "relabeled" : "canonical"} scenario)`;
        const actions = generateActionSequence(seed, length, undefined, scenario);
        const run = runSequence(actions, undefined, scenario);
        const completion = completeChapterFrom(run.final, undefined, scenario);
        const states = [...run.states, completion.outcomeState, completion.final];
        states.forEach((state, step) => {
          checkPanel(state, scenario, fromScenario, marked, `${context}, state ${step}`, counts);
        });
      }
    }
    // Both hint origins must actually occur, or the property says nothing.
    expect(counts.reason).toBeGreaterThan(0);
    expect(counts.scenario).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});

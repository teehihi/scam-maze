/**
 * Test harness for the Chapter 1 core property tests (design.md, "Correctness Properties" and
 * "Testing Strategy"). No property-based testing library is installed, so action sequences come
 * from the fixed-seed LCG in seededRandom.ts. The same seed always yields the same sequence, so a
 * failing case can be reproduced from its seed and case index.
 *
 * This module imports only the pure chapter core and seededRandom.ts (no React, no Testing
 * Library), so pure core tests can use it.
 */

import { CHAPTER_1_SCENARIO } from "../game/narrative/chapter1/scenario";
import {
  CLAIM_IDS,
  DECISION_IDS,
  EVIDENCE_IDS,
  INTERACTABLE_IDS,
  NPC_IDS,
  OBJECTIVE_IDS,
  VERIFY_METHODS,
  type IncomingCallId,
} from "../game/narrative/chapter1/ids";
import { availableOptions } from "../game/narrative/dialogueEngine";
import { chapterReducer, createInitialState } from "../game/narrative/reducer";
import { enumerateCandidateActions } from "../game/narrative/selectors";
import type {
  ActionResult,
  ChapterState,
  CoreAction,
  RingReason,
  ScenarioDefinition,
} from "../game/narrative/types";
import { createLcg, pick, randomInt } from "./seededRandom";

/** Fixed seed for core property tests. Files may derive per-case seeds from it. */
export const CORE_PROPERTY_SEED = 0x0c4a9701;

/** Number of generated cases per core property test (design: at least 100). */
export const CORE_PROPERTY_RUNS = 200;

/** Maximum length of a generated core action sequence (design: up to 80 actions). */
export const CORE_SEQUENCE_MAX_LENGTH = 80;

/** Accepted-action budget of the guided completion policy (design, Property 4). */
export const GUIDED_POLICY_MAX_STEPS = 60;

/** Seed for case `index` of a property test that uses `baseSeed`. */
export function caseSeed(baseSeed: number, index: number): number {
  return (baseSeed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
}

// ---------------------------------------------------------------------------
// Action generator
// ---------------------------------------------------------------------------

const INCOMING_CALLS: readonly IncomingCallId[] = ["call.scam-1", "call.callback"];
const RING_REASONS: readonly RingReason[] = ["first-interaction", "exploration-timer", "re-ring", "callback"];

/** Every authored option ID across all graphs, plus one that exists nowhere. */
const ALL_OPTION_IDS: readonly string[] = [
  ...Object.values(CHAPTER_1_SCENARIO.dialogues).flatMap((graph) =>
    Object.values(graph.nodes).flatMap((node) => node.options.map((option) => option.id)),
  ),
  "opt.does-not-exist",
];

/** Values that fail the reducer's shape check (`isCoreAction`). */
export const MALFORMED_ACTIONS: readonly unknown[] = [
  null,
  undefined,
  42,
  "START_CHAPTER",
  [],
  [{ type: "START_CHAPTER" }],
  {},
  { type: 7 },
  { type: "UNKNOWN_ACTION" },
  { type: "start_chapter" },
  { type: "INTERACT_OBJECT" },
  { type: "INTERACT_OBJECT", objectId: "obj.does-not-exist" },
  { type: "INSPECT_EVIDENCE", evidenceId: 3 },
  { type: "RING_CALL", callId: "call.official", reason: "re-ring" },
  { type: "RING_CALL", callId: "call.scam-1" },
  { type: "TALK_TO_NPC", npcId: "npc.nobody" },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "" },
  { type: "SELECT_DIALOGUE_OPTION" },
  { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "guess" },
  { type: "MAKE_DECISION", decision: "run-away" },
  { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.unknown" },
];

/** A random well-formed Core_Action with known IDs, not drawn from the candidate list. */
function randomWellFormedAction(next: () => number): CoreAction {
  switch (randomInt(next, 0, 13)) {
    case 0:
      return { type: "START_CHAPTER" };
    case 1:
      return { type: "INTERACT_OBJECT", objectId: pick(next, INTERACTABLE_IDS) };
    case 2:
      return { type: "INSPECT_EVIDENCE", evidenceId: pick(next, EVIDENCE_IDS) };
    case 3:
      return { type: "OPEN_PHONE" };
    case 4:
      return { type: "CLOSE_PHONE" };
    case 5:
      return { type: "RING_CALL", callId: pick(next, INCOMING_CALLS), reason: pick(next, RING_REASONS) };
    case 6:
      return { type: "ANSWER_CALL" };
    case 7:
      return { type: "END_CALL" };
    case 8:
      return { type: "TALK_TO_NPC", npcId: pick(next, NPC_IDS) };
    case 9:
      return { type: "SELECT_DIALOGUE_OPTION", optionId: pick(next, ALL_OPTION_IDS) };
    case 10:
      return { type: "VERIFY_CLAIM", claimId: pick(next, CLAIM_IDS), method: pick(next, VERIFY_METHODS) };
    case 11:
      return { type: "MAKE_DECISION", decision: pick(next, DECISION_IDS) };
    case 12:
      return { type: "COMPLETE_OBJECTIVE", objectiveId: pick(next, OBJECTIVE_IDS) };
    default:
      return { type: "FINISH_CHAPTER" };
  }
}

/**
 * A well-formed action that the reducer rejects in `state`. Tries a few random well-formed
 * actions and returns the first rejected one; if all of them happen to be accepted, returns the
 * last try (so the 20% bucket is "almost always invalid", never malformed).
 */
function invalidWellFormedAction(
  next: () => number,
  state: ChapterState,
  scenario: ScenarioDefinition,
): CoreAction {
  let action = randomWellFormedAction(next);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!chapterReducer(state, action, scenario).accepted) return action;
    action = randomWellFormedAction(next);
  }
  return action;
}

/**
 * Generates `length` dispatchable values from `seed`, tracking the running state so candidate
 * actions fit it. Mix per step (design: 70/20/10):
 * - 70%: an action from `enumerateCandidateActions(state)` (falls back to the 20% bucket when the
 *   list is empty, for example after FINISH_CHAPTER);
 * - 20%: a well-formed Core_Action that is rejected in the current state;
 * - 10%: a malformed value from `MALFORMED_ACTIONS`.
 * The running state starts at `initial` (default `createInitialState()`).
 */
export function generateActionSequence(
  seed: number,
  length: number,
  initial: ChapterState = createInitialState(),
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): unknown[] {
  const next = createLcg(seed);
  const actions: unknown[] = [];
  let state = initial;
  for (let i = 0; i < length; i += 1) {
    const roll = next();
    let action: unknown;
    if (roll < 0.7) {
      const candidates = enumerateCandidateActions(state, scenario);
      action = candidates.length > 0 ? pick(next, candidates) : invalidWellFormedAction(next, state, scenario);
    } else if (roll < 0.9) {
      action = invalidWellFormedAction(next, state, scenario);
    } else {
      action = pick(next, MALFORMED_ACTIONS);
    }
    actions.push(action);
    state = chapterReducer(state, action, scenario).state;
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Running sequences
// ---------------------------------------------------------------------------

export interface SequenceRun {
  /** `states[0]` is the initial state; `states[i + 1]` is the state after `actions[i]`. */
  states: ChapterState[];
  /** `results[i]` is the Action_Result of `actions[i]`. */
  results: ActionResult[];
  final: ChapterState;
}

/** Dispatches every value through `chapterReducer`. Exceptions from the reducer propagate. */
export function runSequence(
  actions: readonly unknown[],
  initial: ChapterState = createInitialState(),
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): SequenceRun {
  const states: ChapterState[] = [initial];
  const results: ActionResult[] = [];
  let state = initial;
  for (const action of actions) {
    const result = chapterReducer(state, action, scenario);
    results.push(result);
    state = result.state;
    states.push(state);
  }
  return { states, results, final: state };
}

/** Short printable form of a dispatched value, for failure messages. */
export function describeAction(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ---------------------------------------------------------------------------
// State invariants
// ---------------------------------------------------------------------------

function duplicates<T>(items: readonly T[]): T[] {
  return items.filter((item, index) => items.indexOf(item) !== index);
}

/**
 * Checks the state invariants from design.md ("Data Models", state invariants list) and returns
 * one message per violation. An empty list means every invariant holds. It returns instead of
 * throwing so a property test can report all violations of a state together with the seed and
 * the shrunk prefix; use `expect(assertInvariants(state)).toEqual([])`.
 */
export function assertInvariants(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): string[] {
  const violations: string[] = [];

  // discovered and interacted: no duplicates, every ID exists in Scenario_Data.
  for (const id of duplicates(state.discovered)) violations.push(`discovered has duplicate ${id}`);
  for (const id of duplicates(state.interacted)) violations.push(`interacted has duplicate ${id}`);
  for (const id of state.discovered) {
    if (!Object.hasOwn(scenario.evidence, id)) violations.push(`discovered has unknown evidence ${id}`);
  }
  for (const id of state.interacted) {
    if (!Object.hasOwn(scenario.interactables, id)) violations.push(`interacted has unknown object ${id}`);
  }

  // Active and completed objectives are disjoint (and known).
  for (const id of state.objectives.active) {
    if (state.objectives.completed.includes(id)) violations.push(`objective ${id} is both active and completed`);
  }
  for (const id of [...state.objectives.active, ...state.objectives.completed]) {
    if (!Object.hasOwn(scenario.objectives, id)) violations.push(`unknown objective ${id}`);
  }

  // A current conversation points at an existing node of an existing graph.
  const conversation = state.conversation;
  if (conversation !== null) {
    const graph = Object.hasOwn(scenario.dialogues, conversation.graphId)
      ? scenario.dialogues[conversation.graphId]
      : undefined;
    if (!graph) violations.push(`conversation has unknown graph ${conversation.graphId}`);
    else if (!Object.hasOwn(graph.nodes, conversation.nodeId)) {
      violations.push(`conversation node ${conversation.nodeId} is not in ${conversation.graphId}`);
    }
  }

  // call.status ∈ {ringing, active} ⇔ call.current !== null.
  const live = state.call.status === "ringing" || state.call.status === "active";
  if (live !== (state.call.current !== null)) {
    violations.push(`call status ${state.call.status} does not match current call ${String(state.call.current)}`);
  }

  // An active call other than the official line has its conversation linked to it.
  if (
    state.call.status === "active" &&
    state.call.current !== null &&
    state.call.current !== "call.official" &&
    conversation?.callId !== state.call.current
  ) {
    violations.push(`active call ${state.call.current} has no linked conversation`);
  }

  // outcome ⇒ decision.
  if (state.outcome !== null && state.decision === null) violations.push(`outcome ${state.outcome} without a decision`);

  // verified ⇒ caller identity contradicted and no risky flag.
  if (state.outcome === "verified") {
    if (state.claims["claim.caller-identity"] !== "contradicted") {
      violations.push("verified outcome but the caller identity claim is not contradicted");
    }
    if (state.flags.code_shared) violations.push("verified outcome with code_shared");
    if (state.flags.money_moved) violations.push("verified outcome with money_moved");
  }

  // Any contradicted claim ⇒ the official confirmation is discovered.
  for (const [claimId, status] of Object.entries(state.claims)) {
    if (status === "contradicted" && !state.discovered.includes("ev.official-confirmation")) {
      violations.push(`claim ${claimId} is contradicted without ev.official-confirmation`);
    }
  }

  // 0 ≤ pressure ≤ 3 (whole number).
  if (!Number.isInteger(state.pressure) || state.pressure < 0 || state.pressure > 3) {
    violations.push(`pressure ${state.pressure} is out of range`);
  }

  // events[i].seq === i.
  state.events.forEach((entry, index) => {
    if (entry.seq !== index) violations.push(`events[${index}].seq is ${entry.seq}`);
  });

  // finished ⇒ outcome.
  if (state.status === "finished" && state.outcome === null) violations.push("finished without an outcome");

  return violations;
}

// ---------------------------------------------------------------------------
// Guided completion policy
// ---------------------------------------------------------------------------

function scam1Ended(state: ChapterState): boolean {
  return state.call.log.some((record) => record.callId === "call.scam-1" && record.status === "ended");
}

function scam1Answered(state: ChapterState): boolean {
  return state.call.log.some(
    (record) => record.callId === "call.scam-1" && (record.status === "answered" || record.status === "ended"),
  );
}

/**
 * The next action of the guided policy, in priority order:
 * 1. not started → START_CHAPTER; Outcome set → FINISH_CHAPTER;
 * 2. a call is current: if the first scam call rings and was never answered, ANSWER_CALL (its
 *    end is what unlocks the decisions); otherwise END_CALL (declines or hangs up);
 * 3. a face-to-face conversation → its first available option (the fallback when no authored
 *    option is available);
 * 4. the first scam call has ended → MAKE_DECISION stop-and-wait;
 * 5. otherwise RING_CALL call.scam-1 (re-ring or exploration timer).
 * Returns `null` when the chapter is finished.
 */
function guidedAction(state: ChapterState, scenario: ScenarioDefinition): CoreAction | null {
  if (state.status === "finished") return null;
  if (state.status === "not-started") return { type: "START_CHAPTER" };
  if (state.outcome !== null) return { type: "FINISH_CHAPTER" };

  if (state.call.current !== null) {
    if (state.call.status === "ringing" && state.call.current === "call.scam-1" && !scam1Answered(state)) {
      return { type: "ANSWER_CALL" };
    }
    return { type: "END_CALL" };
  }

  if (state.conversation !== null) {
    const [first] = availableOptions(state, scenario);
    if (first) return { type: "SELECT_DIALOGUE_OPTION", optionId: first.id };
  }

  if (scam1Ended(state)) return { type: "MAKE_DECISION", decision: "stop-and-wait" };

  const rang = state.call.log.some((record) => record.callId === "call.scam-1");
  return { type: "RING_CALL", callId: "call.scam-1", reason: rang ? "re-ring" : "exploration-timer" };
}

export interface GuidedCompletion {
  /** Accepted actions taken by the policy, in order. */
  actions: CoreAction[];
  /** First state with an Outcome (before FINISH_CHAPTER). */
  outcomeState: ChapterState;
  /** Final state, with `status === "finished"`. */
  final: ChapterState;
}

/**
 * Drives the chapter from any reachable state to an Outcome and then FINISH_CHAPTER, using the
 * guided policy above, within `maxSteps` accepted actions (default 60, design Property 4).
 * Throws when the policy proposes a rejected action or runs out of steps, because either means
 * the state may be soft-locked. From a finished state it returns immediately with no actions.
 */
export function completeChapterFrom(
  start: ChapterState,
  maxSteps: number = GUIDED_POLICY_MAX_STEPS,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): GuidedCompletion {
  const actions: CoreAction[] = [];
  let state = start;
  let outcomeState: ChapterState | null = state.outcome !== null ? state : null;
  for (let step = 0; step <= maxSteps; step += 1) {
    const action = guidedAction(state, scenario);
    if (action === null) {
      if (outcomeState === null) throw new Error("Guided policy: finished state without an outcome.");
      return { actions, outcomeState, final: state };
    }
    if (step === maxSteps) break;
    const result = chapterReducer(state, action, scenario);
    if (!result.accepted) {
      throw new Error(
        `Guided policy: ${describeAction(action)} rejected after ${actions.length} steps: ${result.reason ?? ""}`,
      );
    }
    actions.push(action);
    state = result.state;
    if (outcomeState === null && state.outcome !== null) outcomeState = state;
  }
  throw new Error(`Guided policy: no finished chapter within ${maxSteps} accepted actions.`);
}

// ---------------------------------------------------------------------------
// Shrinking
// ---------------------------------------------------------------------------

/**
 * Returns the shortest prefix of `actions` for which `fails(prefix)` is true, or `null` when even
 * the full sequence passes. Re-runs prefixes from length 0 upward (design: "found by re-running
 * prefixes of the failing sequence"). `fails` should replay the prefix from the initial state.
 */
export function shrinkFailingPrefix<T>(actions: readonly T[], fails: (prefix: T[]) => boolean): T[] | null {
  for (let length = 0; length <= actions.length; length += 1) {
    const prefix = actions.slice(0, length);
    if (fails(prefix)) return prefix;
  }
  return null;
}

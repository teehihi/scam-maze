// Bounded reachability solver for a scenario (check V2, measured parts of V3 and V4).
//
// It explores the states the real `chapterReducer` can reach from `createInitialState`, using the
// moves of `enumerateCandidateActions`. It never re-implements game rules, so it cannot disagree
// with the game. Pure and deterministic: no React, Three.js, i18n, audio, clock or randomness.

import { availableOptions } from "./dialogueEngine";
import { chapterReducer, createInitialState } from "./reducer";
import { enumerateCandidateActions } from "./selectors";
import type { ChapterState, CoreAction, ScenarioDefinition } from "./types";

/** Default state budget (design.md "Reachability solver"). */
export const DEFAULT_MAX_STATES = 100_000;

/** At most this many soft-lock state keys are listed in the report. */
const MAX_REPORTED_SOFT_LOCKS = 20;

/** Guard for the free-action saturation loop. */
const MAX_SATURATION_PASSES = 200;

export interface ReachabilityOptions {
  /** State budget. Default `DEFAULT_MAX_STATES`. */
  maxStates?: number;
}

export interface ReachabilityReport {
  /** Number of distinct states (by state key) that were discovered. */
  states: number;
  /** True when the budget was exceeded. A truncated report proves nothing. */
  truncated: boolean;
  /** Distinct `state.outcome` values seen in reachable states, sorted. */
  outcomesReached: string[];
  /** Node IDs that never became the current node or the end node of a conversation. Sorted. */
  unreachableNodes: string[];
  /** Authored option IDs that were never available in any reachable state. Sorted. */
  unreachableOptions: string[];
  /** State keys of explored states from which no outcome is reachable (capped list). */
  softLocks: string[];
  /** Largest number of options available at once (0 when no conversation was seen). */
  maxAvailableOptions: number;
  /** Smallest number of options available at once at a non-end node (0 when none was seen). */
  minAvailableOptions: number;
}

/** Moves that only add evidence or open the phone. They never remove an option, so they are saturated. */
function isFreeAction(action: CoreAction): boolean {
  switch (action.type) {
    case "INTERACT_OBJECT":
    case "INSPECT_EVIDENCE":
    case "OPEN_PHONE":
      return true;
    case "VERIFY_CLAIM":
      return action.method === "bank-app";
    default:
      return false;
  }
}

/**
 * Flags that engine code reads directly (reducer guards, candidate actions, objectives, outcome),
 * outside any scenario Condition. Keep this list in sync when the engine starts reading a new flag.
 */
export const ENGINE_READ_FLAGS: readonly string[] = ["scam1_rang", "code_shared", "money_moved", "report_filed"];

/**
 * Flags that can influence which actions are possible or which Outcome is selected: every flag
 * named by a `flag` or `notFlag` Condition anywhere in the scenario (a conservative deep walk),
 * plus `ENGINE_READ_FLAGS`. Flags outside this set are only read by presentation, so states that
 * differ only in them behave the same and share one state key.
 */
export function relevantFlags(scenario: ScenarioDefinition): string[] {
  const found = new Set<string>(ENGINE_READ_FLAGS);
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if ((record.kind === "flag" || record.kind === "notFlag") && typeof record.flag === "string") {
      found.add(record.flag);
    }
    for (const child of Object.values(record)) walk(child);
  };
  walk(scenario);
  return [...found].sort();
}

/** Compact, order-independent key of the parts of the state that decide which actions are possible. */
function stateKey(state: ChapterState, flags: readonly string[]): string {
  const sortedRecord = (record: Record<string, unknown>): Array<[string, unknown]> =>
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]]);
  const flagRecord = state.flags as Record<string, boolean>;
  return JSON.stringify([
    state.status,
    flags.filter((flag) => flagRecord[flag] === true),
    sortedRecord(state.claims),
    [...state.discovered].sort(),
    state.decision,
    state.outcome,
    state.pressure,
    state.call.current,
    state.call.status,
    state.call.log.map((record) => `${record.callId}:${record.status}`).sort(),
    state.conversation === null ? null : [state.conversation.graphId, state.conversation.nodeId],
    state.phone.open,
    [...state.interacted].sort(),
  ]);
}

/** Applies free actions until none of them changes the state key. */
function saturate(initial: ChapterState, scenario: ScenarioDefinition, flags: readonly string[]): ChapterState {
  let state = initial;
  for (let pass = 0; pass < MAX_SATURATION_PASSES; pass += 1) {
    let progressed = false;
    for (const action of enumerateCandidateActions(state, scenario)) {
      if (!isFreeAction(action)) continue;
      const before = stateKey(state, flags);
      const result = chapterReducer(state, action, scenario);
      if (result.accepted && stateKey(result.state, flags) !== before) {
        state = result.state;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return state;
}

/** Moves that branch the search: everything except free actions, phone closing and finishing. */
function branchingMoves(state: ChapterState, scenario: ScenarioDefinition): CoreAction[] {
  return enumerateCandidateActions(state, scenario).filter(
    (action) => !isFreeAction(action) && action.type !== "CLOSE_PHONE" && action.type !== "FINISH_CHAPTER",
  );
}

/**
 * Explores the reachable states of `scenario` breadth-first within `maxStates` and reports
 * reachability, soft locks and option-count bounds.
 */
export function analyzeReachability(
  scenario: ScenarioDefinition,
  options: ReachabilityOptions = {},
): ReachabilityReport {
  const maxStates = options.maxStates ?? DEFAULT_MAX_STATES;
  const flags = relevantFlags(scenario);

  const indexByKey = new Map<string, number>();
  const keys: string[] = [];
  const isOutcome: boolean[] = [];
  const reverseEdges: number[][] = [];
  const outcomes = new Set<string>();
  const seenNodes = new Set<string>();
  const seenOptions = new Set<string>();
  let maxAvailable = 0;
  let minAvailable = Number.POSITIVE_INFINITY;
  let truncated = false;

  const observe = (state: ChapterState): void => {
    if (state.outcome !== null) outcomes.add(state.outcome);
    if (state.conversation !== null) {
      seenNodes.add(state.conversation.nodeId);
      const views = availableOptions(state, scenario);
      if (views.length > 0) {
        maxAvailable = Math.max(maxAvailable, views.length);
        minAvailable = Math.min(minAvailable, views.length);
      }
      for (const view of views) if (!view.fallback) seenOptions.add(view.id);
    }
    for (const entry of state.conversationHistory) if (entry.endNodeId) seenNodes.add(entry.endNodeId);
  };

  const queue: ChapterState[] = [];
  const register = (state: ChapterState): number | null => {
    const key = stateKey(state, flags);
    const known = indexByKey.get(key);
    if (known !== undefined) return known;
    if (keys.length >= maxStates) {
      truncated = true;
      return null;
    }
    const index = keys.length;
    indexByKey.set(key, index);
    keys.push(key);
    isOutcome.push(state.outcome !== null);
    reverseEdges.push([]);
    queue.push(state);
    return index;
  };

  const start = chapterReducer(createInitialState(scenario), { type: "START_CHAPTER" }, scenario);
  const first = saturate(start.state, scenario, flags);
  observe(first);
  register(first);

  // `queue` is read by index so that expanded states stay out of the way without O(n) shifts.
  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head];
    if (state.outcome !== null) continue;
    const fromIndex = head;
    for (const action of branchingMoves(state, scenario)) {
      const result = chapterReducer(state, action, scenario);
      if (!result.accepted) continue;
      const next = saturate(result.state, scenario, flags);
      observe(next);
      const toIndex = register(next);
      if (toIndex !== null) reverseEdges[toIndex].push(fromIndex);
    }
  }

  // Soft locks: explored states that cannot reach any state with an outcome.
  const softLocks: string[] = [];
  if (!truncated) {
    const canFinish = new Array<boolean>(keys.length).fill(false);
    const stack: number[] = [];
    isOutcome.forEach((flag, index) => {
      if (flag) {
        canFinish[index] = true;
        stack.push(index);
      }
    });
    while (stack.length > 0) {
      const index = stack.pop() as number;
      for (const from of reverseEdges[index]) {
        if (!canFinish[from]) {
          canFinish[from] = true;
          stack.push(from);
        }
      }
    }
    for (let index = 0; index < keys.length && softLocks.length < MAX_REPORTED_SOFT_LOCKS; index += 1) {
      if (!canFinish[index]) softLocks.push(keys[index]);
    }
  }

  const allNodes: string[] = [];
  const allOptions: string[] = [];
  for (const graph of Object.values(scenario.dialogues)) {
    for (const node of Object.values(graph.nodes)) {
      allNodes.push(node.id);
      for (const option of node.options) allOptions.push(option.id);
    }
  }

  return {
    states: keys.length,
    truncated,
    outcomesReached: [...outcomes].sort(),
    unreachableNodes: allNodes.filter((id) => !seenNodes.has(id)).sort(),
    unreachableOptions: allOptions.filter((id) => !seenOptions.has(id)).sort(),
    softLocks,
    maxAvailableOptions: maxAvailable,
    minAvailableOptions: Number.isFinite(minAvailable) ? minAvailable : 0,
  };
}

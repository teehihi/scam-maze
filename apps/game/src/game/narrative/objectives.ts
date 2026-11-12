// Objective manager for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Objective manager" (Requirement 6).
//
// Each objective has an activation and a completion predicate over `(prev, next, action)`.
// The predicates read accepted action types and Chapter_State facts only. OPEN_PHONE and
// CLOSE_PHONE never change objectives, and the Evidence_Journal is UI state that never reaches
// the core (Requirement 6.9).

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { OBJECTIVE_IDS, type EvidenceId, type ObjectiveId } from "./chapter1/ids";
import { evaluateCondition } from "./conditions";
import type { ChapterState, CoreAction, CoreActionType, ScenarioDefinition } from "./types";

/** Input for every objective predicate. `action` is the accepted action that produced `next`. */
export interface ObjectiveContext {
  prev: ChapterState;
  next: ChapterState;
  action: CoreAction;
  scenario: ScenarioDefinition;
}

export interface ObjectiveRule {
  id: ObjectiveId;
  activateWhen: (ctx: ObjectiveContext) => boolean;
  completeWhen: (ctx: ObjectiveContext) => boolean;
}

export interface ObjectiveManagerResult {
  /** `next` with updated objectives, or `next` itself when nothing changed. */
  state: ChapterState;
  /** Objectives activated in this step, in `OBJECTIVE_IDS` order. */
  activated: ObjectiveId[];
  /** Objectives completed in this step, in `OBJECTIVE_IDS` order. */
  completed: ObjectiveId[];
}

/** Actions that never activate or complete an objective (Requirement 6.9). */
export const OBJECTIVE_NEUTRAL_ACTIONS: readonly CoreActionType[] = ["OPEN_PHONE", "CLOSE_PHONE"];

/** Evidence that does not count toward "Check what the caller told you." */
const CHECK_CLAIMS_EXCLUDED: readonly EvidenceId[] = ["ev.sms-alert"];

/** Number of claim-related evidence items needed to complete `obj.check-claims` (Requirement 6.5). */
export const CHECK_CLAIMS_REQUIRED_EVIDENCE = 2;

// ---------------------------------------------------------------------------
// State facts
// ---------------------------------------------------------------------------

function hasInteracted(state: ChapterState): boolean {
  return (
    state.interacted.length > 0 ||
    Object.values(state.npc).some((npc) => npc.timesTalked > 0)
  );
}

function scam1HasRung(state: ChapterState): boolean {
  return (
    state.flags.scam1_rang === true ||
    state.call.log.some((record) => record.callId === "call.scam-1")
  );
}

function scam1Answered(state: ChapterState): boolean {
  return (
    state.call.log.some(
      (record) =>
        record.callId === "call.scam-1" &&
        (record.status === "answered" || record.status === "ended"),
    ) ||
    state.conversation?.graphId === "dlg.scam-call" ||
    state.conversationHistory.some((entry) => entry.graphId === "dlg.scam-call")
  );
}

/** The first scam call was answered and has since ended (a decline does not count). */
function scam1EndedAfterAnswer(state: ChapterState): boolean {
  return evaluateCondition({ kind: "callEnded", callId: "call.scam-1" }, state);
}

const PRESSURE_CALL_IDS = ["call.callback", "call.followup"] as const;

/** The callback or the follow-up call has a log record. */
function pressureCallHasRecord(state: ChapterState): boolean {
  return state.call.log.some((record) =>
    (PRESSURE_CALL_IDS as readonly string[]).includes(record.callId),
  );
}

/** Every callback or follow-up record is ended or declined (and at least one exists). */
function pressureCallClosed(state: ChapterState): boolean {
  const records = state.call.log.filter((record) =>
    (PRESSURE_CALL_IDS as readonly string[]).includes(record.callId),
  );
  return (
    records.length > 0 &&
    records.every((record) => record.status === "ended" || record.status === "declined")
  );
}

/** Discovered evidence items that relate to at least one Claim, excluding the first SMS alert. */
export function claimRelatedEvidenceCount(
  state: ChapterState,
  scenario: ScenarioDefinition,
): number {
  return state.discovered.filter((id) => {
    if (CHECK_CLAIMS_EXCLUDED.includes(id)) return false;
    const item = scenario.evidence[id];
    return item !== undefined && item.relations.length > 0;
  }).length;
}

// ---------------------------------------------------------------------------
// Rules (design table)
// ---------------------------------------------------------------------------

export const OBJECTIVE_RULES: Record<ObjectiveId, ObjectiveRule> = {
  "obj.look-around": {
    id: "obj.look-around",
    activateWhen: ({ action, next }) => action.type === "START_CHAPTER" && next.status === "playing",
    completeWhen: ({ next }) => hasInteracted(next),
  },
  "obj.answer-call": {
    id: "obj.answer-call",
    activateWhen: ({ next }) => scam1HasRung(next),
    completeWhen: ({ next }) => scam1Answered(next),
  },
  "obj.check-claims": {
    id: "obj.check-claims",
    activateWhen: ({ next }) => scam1EndedAfterAnswer(next),
    completeWhen: ({ next, scenario }) =>
      claimRelatedEvidenceCount(next, scenario) >= CHECK_CLAIMS_REQUIRED_EVIDENCE,
  },
  "obj.decide": {
    id: "obj.decide",
    // A Decision recorded inside the scam call (money moved) activates and completes this
    // objective in the same step, so the debrief history stays consistent.
    activateWhen: ({ next }) => scam1EndedAfterAnswer(next) || next.decision !== null,
    completeWhen: ({ next }) => next.decision !== null,
  },
  "obj.review": {
    id: "obj.review",
    activateWhen: ({ next }) => next.decision !== null,
    completeWhen: ({ next }) => next.status === "finished",
  },
  "obj.call-bank": {
    id: "obj.call-bank",
    activateWhen: ({ next }) => scam1EndedAfterAnswer(next),
    completeWhen: ({ next }) => next.discovered.includes("ev.official-confirmation"),
  },
  "obj.hold-firm": {
    id: "obj.hold-firm",
    activateWhen: ({ next }) => pressureCallHasRecord(next),
    completeWhen: ({ next }) =>
      next.call.current === null &&
      pressureCallClosed(next) &&
      next.flags.code_shared !== true &&
      next.flags.money_moved !== true,
  },
  "obj.file-report": {
    id: "obj.file-report",
    activateWhen: ({ next }) => next.discovered.includes("ev.official-confirmation"),
    completeWhen: ({ next }) => next.flags.report_filed === true,
  },
};

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

/**
 * Activates and completes objectives after an accepted action. Pure: never mutates its inputs.
 * Activation runs first, then completion, both in `OBJECTIVE_IDS` order, so an objective can be
 * activated and completed in the same step. Only active objectives can complete, and an
 * objective is never activated twice.
 */
export function runObjectiveManager(
  prev: ChapterState,
  next: ChapterState,
  action: CoreAction,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): ObjectiveManagerResult {
  if (OBJECTIVE_NEUTRAL_ACTIONS.includes(action.type)) {
    return { state: next, activated: [], completed: [] };
  }

  const ctx: ObjectiveContext = { prev, next, action, scenario };
  const active = new Set<ObjectiveId>(next.objectives.active);
  const done = new Set<ObjectiveId>(next.objectives.completed);
  const activated: ObjectiveId[] = [];
  const completed: ObjectiveId[] = [];

  for (const id of OBJECTIVE_IDS) {
    if (active.has(id) || done.has(id)) continue;
    if (OBJECTIVE_RULES[id].activateWhen(ctx)) {
      active.add(id);
      activated.push(id);
    }
  }

  for (const id of OBJECTIVE_IDS) {
    if (!active.has(id)) continue;
    if (OBJECTIVE_RULES[id].completeWhen(ctx)) {
      active.delete(id);
      done.add(id);
      completed.push(id);
    }
  }

  if (activated.length === 0 && completed.length === 0) {
    return { state: next, activated, completed };
  }

  return {
    state: {
      ...next,
      objectives: {
        active: OBJECTIVE_IDS.filter((id) => active.has(id)),
        completed: OBJECTIVE_IDS.filter((id) => done.has(id)),
      },
    },
    activated,
    completed,
  };
}

/**
 * Guard for COMPLETE_OBJECTIVE (Requirement 6.8): the objective is active and its completion
 * predicate holds on the current state.
 */
export function canCompleteObjective(
  state: ChapterState,
  objectiveId: ObjectiveId,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): boolean {
  if (!state.objectives.active.includes(objectiveId)) return false;
  const rule = OBJECTIVE_RULES[objectiveId];
  if (!rule) return false;
  return rule.completeWhen({
    prev: state,
    next: state,
    action: { type: "COMPLETE_OBJECTIVE", objectiveId },
    scenario,
  });
}

/** Rejection reason for COMPLETE_OBJECTIVE when `canCompleteObjective` is false. */
export const OBJECTIVE_CONDITION_NOT_MET = "Objective condition not met.";

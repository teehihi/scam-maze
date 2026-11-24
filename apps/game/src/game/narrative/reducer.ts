// Chapter reducer for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-double-deception/design.md (core and reducer sections).
//
// Pipeline per dispatched value:
// 1. Shape check (`isCoreAction`), otherwise "Unknown action."
// 2. Outcome lock: once an Outcome is set, only FINISH_CHAPTER is accepted.
// 3. Per-action guard from the design's guard table. A failing guard returns a reason.
// 4. Apply the action (pure; the input state is never mutated).
// 5. Beats (pplyBeats): scripted state changes, each once; fired beats are tagged in the event.
// 6. Objective manager (activations and completions).
// 7. Outcome function, when a Decision exists and no Outcome is set yet.
// 8. Append one Event_Log entry with the derived evidence, flags, objectives and debrief tags.
//
// A rejected action returns the same state object, `accepted: false` and a non-empty reason.

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import {
  CALL_IDS,
  CLAIM_IDS,
  DECISION_IDS,
  DEVICE_ACTION_IDS,
  EVIDENCE_IDS,
  FLAG_IDS,
  INTERACTABLE_IDS,
  NPC_IDS,
  OBJECTIVE_IDS,
  VERIFY_METHODS,
  type CallId,
  type ClaimId,
  type DeviceActionId,
  type EvidenceId,
  type FlagId,
  type IncomingCallId,
  type NpcId,
  type ObjectiveId,
  type VerifyMethod,
} from "./chapter1/ids";
import { applyBeats, beatTag } from "./beats";
import {
  CHAPTER_1_INITIAL_STATE,
  PERSISTENT_FLAG_IDS,
  RESOURCE_IDS,
  clampResource,
  cloneInitialState,
  type PersistentFlagId,
  type ResourceId,
} from "./resources";
import { applyEffect, applyEffects, evaluateConditions, recordTransaction } from "./conditions";
import { canRecordDeduction, matchDeduction } from "./deductions";
import { findSessionInterruptions, simulateThesisSession, THESIS_FOCUS_MODES } from "./thesisSession";
import { createInitialDeviceItems, deviceItemDef, itemActionDef } from "./device";
import { WORLD_TAG_PREFIX, createInitialWorld, elapsedMinutes, eventDef, gameplayConfig, responseFor, settleWorld } from "./world";
import { REST_MODES, effectiveWorkMinutes, restOption, workFatigue } from "./fatigue";
import { endConversation, selectOption, startConversation } from "./dialogueEngine";
import { canDiscover, discover, type DiscoveryTrigger } from "./evidence";
import {
  canCompleteObjective,
  OBJECTIVE_CONDITION_NOT_MET,
  runObjectiveManager,
} from "./objectives";
import { selectOutcome } from "./outcome";
import type {
  ActionResult,
  CallRecord,
  ChapterState,
  ClaimStatus,
  CoreAction,
  EventLogEntry,
  RingReason,
  ScenarioDefinition,
} from "./types";

// ---------------------------------------------------------------------------
// Rejection reasons
// ---------------------------------------------------------------------------

export const REASONS = {
  unknownAction: "Unknown action.",
  chapterEnded: "The chapter has ended.",
  notStarted: "The chapter has not started.",
  alreadyStarted: "The chapter has already started.",
  unknownObject: "This object does not exist.",
  wrongObjectAction: "This object cannot be used that way.",
  callInProgress: "Finish the call first.",
  conversationInProgress: "Finish the conversation first.",
  unknownEvidence: "This evidence does not exist.",
  evidenceNotAvailable: "Evidence not available yet.",
  evidenceAlreadyRecorded: "Evidence already recorded.",
  phoneAlreadyOpen: "The phone is already open.",
  phoneAlreadyClosed: "The phone is already closed.",
  callAlreadyRinging: "A call is already ringing.",
  unknownCall: "This call does not exist.",
  callNotYet: "This call cannot ring yet.",
  callAlreadyRang: "This call has already been answered.",
  decisionAlreadyMade: "A decision has already been made.",
  noCallRinging: "No call is ringing.",
  noCallToEnd: "There is no call to end.",
  unknownNpc: "This person is not here.",
  needOfficialNumber: "You need the bank's official number first.",
  phoneClosed: "Open your phone first.",
  decisionUnavailable: "This decision is not available yet.",
  chapterNotEnded: "The chapter has not ended yet.",
  chapterAlreadyFinished: "The chapter is already finished.",
  // Reason codes for DEVICE_ACTION and COMBINE_EVIDENCE.
  unknownDeviceAction: "This device action does not exist.",
  deviceActionUnavailable: "This action is not available yet.",
  deviceActionAlreadyDone: "This action was already done.",
  combinationInvalid: "These items do not combine.",
  deductionAlreadyRecorded: "This deduction is already recorded.",
  // Reason codes for the world clock actions.
  timeIsUp: "The deadline has passed.",
  thesisComplete: "The thesis is already complete.",
  workTooShort: "That is too little time to make progress.",
  thesisNeedsTasks: "More progress needs a thesis task, such as the supervisor's confirmation.",
  thesisSessionAlreadyActive: "A thesis session is already paused.",
  noPausedThesisSession: "There is no paused thesis session to continue.",
  noThesisSessionToEnd: "There is no paused thesis session to end.",
  draftAlreadySaved: "This manuscript version is already saved.",
  thesisEvidenceMissing: "Cite an interview count and state the sample limitation before resolving the findings revision.",
  notEnoughTimeForAction: "There is not enough time left to complete this action.",
  restUnavailable: "Resting is not part of this scenario.",
  unknownThesisTask: "This thesis task does not exist.",
  thesisTaskDone: "This thesis task is already done.",
  thesisTaskUnavailable: "This thesis task is not available now.",
  unknownEvent: "This event does not exist.",
  eventNotPending: "This event is not waiting for an answer.",
  unknownResponse: "This response does not exist.",
  responseUnavailable: "This response is not available now.",
  // Reason codes for the phone and laptop.
  unknownItem: "This item does not exist.",
  itemNotArrived: "This item has not arrived yet.",
  unknownItemAction: "This action does not exist.",
  itemActionUnavailable: "This action is not available now.",
  itemActionDone: "This action was already used.",
  notEnoughCash: "There is not enough cash for this.",
} as const;

/** Stable code of a core rejection reason; the UI translates by this code. */
export type ReasonCode = keyof typeof REASONS;

// ---------------------------------------------------------------------------
// Shape check
// ---------------------------------------------------------------------------

const RING_REASONS: readonly RingReason[] = ["first-interaction", "exploration-timer", "re-ring", "callback", "follow-up"];
const INCOMING_CALL_IDS: readonly IncomingCallId[] = CALL_IDS.filter((id): id is IncomingCallId => id !== "call.official");
const THESIS_DRAFT_SECTIONS = ["introduction", "findings", "full-draft"] as const;
const MAX_THESIS_DRAFT_CHARACTERS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/** Largest single time step: the whole chapter. */
export const MAX_ADVANCE_MINUTES = 72 * 60;
/** Largest single thesis session: one day. */
export const MAX_WORK_MINUTES = 24 * 60;
function isWholeMinutes(value: unknown, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
}
function isOptionalElapsedMinutes(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_WORK_MINUTES);
}
function isShortId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 80;
}
/** True when `value` has the shape of a known Core_Action with known IDs (Requirement 5.4). */
export function isCoreAction(value: unknown): value is CoreAction {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "START_CHAPTER":
    case "OPEN_PHONE":
    case "CLOSE_PHONE":
    case "ANSWER_CALL":
    case "END_CALL":
    case "FINISH_CHAPTER":
      return true;
    case "INTERACT_OBJECT":
      return isOneOf(INTERACTABLE_IDS, value.objectId);
    case "INSPECT_EVIDENCE":
      return isOneOf(EVIDENCE_IDS, value.evidenceId);
    case "RING_CALL":
      // Later missions define their own call ids; the reducer rejects ids the scenario does not know.
      // The parked story's outgoing call is never rung.
      return (isOneOf(INCOMING_CALL_IDS, value.callId) || (isShortId(value.callId) && !isOneOf(CALL_IDS, value.callId))) && isOneOf(RING_REASONS, value.reason);
    case "TALK_TO_NPC":
      // No NPC exists in this chapter; the reducer rejects it with "This person is not here.".
      return typeof value.npcId === "string";
    case "SELECT_DIALOGUE_OPTION":
      return typeof value.optionId === "string" && value.optionId.length > 0;
    case "VERIFY_CLAIM":
      return isOneOf(CLAIM_IDS, value.claimId) && isOneOf(VERIFY_METHODS, value.method);
    case "MAKE_DECISION":
      return isOneOf(DECISION_IDS, value.decision);
    case "COMPLETE_OBJECTIVE":
      return isOneOf(OBJECTIVE_IDS, value.objectiveId);
    case "DEVICE_ACTION":
      return isOneOf(DEVICE_ACTION_IDS, value.deviceActionId);
    case "COMBINE_EVIDENCE":
      return (
        Array.isArray(value.evidenceIds) &&
        value.evidenceIds.length >= 2 &&
        value.evidenceIds.length <= 3 &&
        value.evidenceIds.every((id) => isOneOf(EVIDENCE_IDS, id)) &&
        new Set(value.evidenceIds).size === value.evidenceIds.length
      );
    case "ADVANCE_TIME":
      return isWholeMinutes(value.minutes, MAX_ADVANCE_MINUTES);
    case "WORK_ON_THESIS":
      return (
        isWholeMinutes(value.minutes, MAX_WORK_MINUTES) &&
        (value.focusMode === undefined || isOneOf(THESIS_FOCUS_MODES, value.focusMode)) &&
        isOptionalElapsedMinutes(value.sessionElapsedMinutes)
      );
    case "START_THESIS_SESSION":
      return isWholeMinutes(value.minutes, MAX_WORK_MINUTES) && isOneOf(THESIS_FOCUS_MODES, value.mode);
    case "RESUME_THESIS_SESSION":
    case "END_THESIS_SESSION":
      return true;
    case "SAVE_THESIS_DRAFT":
      return isOneOf(THESIS_DRAFT_SECTIONS, value.sectionId) && typeof value.content === "string" && value.content.length <= MAX_THESIS_DRAFT_CHARACTERS;
    case "REST":
      return isOneOf(REST_MODES, value.mode);
    case "RESPOND_EVENT":
      return isShortId(value.eventId) && isShortId(value.response);
    case "COMPLETE_THESIS_TASK":
      return isShortId(value.taskId);
    case "OPEN_DEVICE_ITEM":
      return isShortId(value.itemId);
    case "USE_DEVICE_ITEM":
      return isShortId(value.itemId) && isShortId(value.actionId);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function recordOf<K extends string, V>(keys: readonly K[], value: () => V): Record<K, V> {
  const record = {} as Record<K, V>;
  for (const key of keys) record[key] = value();
  return record;
}

/**
 * The state before START_CHAPTER. Every Claim is `unverified` and every flag is false. Resources and
 * persistent flags come from `scenario.initial`, or from `CHAPTER_1_INITIAL_STATE` (72 hours, 60%
 * thesis, 2,500,000 VND).
 */
export function createInitialState(scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): ChapterState {
  const initial = cloneInitialState(scenario.initial ?? CHAPTER_1_INITIAL_STATE);
  return {
    chapterId: "chapter-1",
    status: "not-started",
    objectives: { active: [], completed: [] },
    phone: { open: false, unread: [], messages: [] },
    call: { current: null, status: "idle", log: [] },
    conversation: null,
    conversationHistory: [],
    npc: recordOf<NpcId, { timesTalked: number }>(NPC_IDS, () => ({ timesTalked: 0 })),
    interacted: [],
    discovered: [],
    claims: recordOf<ClaimId, ClaimStatus>(CLAIM_IDS, () => "unverified"),
    decision: null,
    deductions: [],
    flags: recordOf<FlagId, boolean>(FLAG_IDS, () => false),
    resources: initial.resources,
    persistent: initial.persistent,
    world: createInitialWorld(scenario),
    device: { items: createInitialDeviceItems(scenario), ledger: [], location: null, submission: "not-submitted" },
    pressure: 0,
    outcome: null,
    events: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ApplyResult = { ok: true; state: ChapterState; debriefTags: string[] } | { ok: false; reason: string };

function reject(reason: string): ApplyResult {
  return { ok: false, reason };
}

function accept(state: ChapterState, debriefTags: string[] = []): ApplyResult {
  return { ok: true, state, debriefTags };
}

function findRecordIndex(state: ChapterState, callId: CallId): number {
  for (let i = state.call.log.length - 1; i >= 0; i -= 1) {
    if (state.call.log[i].callId === callId) return i;
  }
  return -1;
}

/** True when the call has any record in the call log (it rang before, whatever happened to it). */
function hasRung(state: ChapterState, callId: CallId): boolean {
  return state.call.log.some((record) => record.callId === callId);
}

/** True when an accepted VERIFY_CLAIM with this method is in the Event_Log. */
function hasVerifiedBy(state: ChapterState, method: VerifyMethod): boolean {
  return state.events.some((entry) => entry.action.type === "VERIFY_CLAIM" && entry.action.method === method);
}

/** True when an accepted DEVICE_ACTION with this ID is in the Event_Log. */
function hasDoneDeviceAction(state: ChapterState, id: DeviceActionId): boolean {
  return state.events.some((entry) => entry.action.type === "DEVICE_ACTION" && entry.action.deviceActionId === id);
}

/** Updates the latest record for `callId`, or appends a new one built from Scenario_Data. */
function upsertCallRecord(
  state: ChapterState,
  callId: CallId,
  update: (record: CallRecord | null) => CallRecord,
): CallRecord[] {
  const index = findRecordIndex(state, callId);
  if (index === -1) return [...state.call.log, update(null)];
  return state.call.log.map((record, i) => (i === index ? update(record) : record));
}

function newCallRecord(callId: CallId, scenario: ScenarioDefinition): CallRecord {
  const def = scenario.calls[callId];
  return {
    callId,
    direction: def.direction,
    displayName: def.displayName,
    number: def.number,
    status: "ringing",
    ringCount: 0,
  };
}

/** Discovers every `dialogue-node` evidence item whose node has been reached (idempotent). */
function sweepDialogueEvidence(state: ChapterState, scenario: ScenarioDefinition): ChapterState {
  let next = state;
  for (const id of Object.keys(scenario.evidence) as EvidenceId[]) {
    if (scenario.evidence[id].discovery.via !== "dialogue-node") continue;
    if (canDiscover(next, id, "dialogue-node", scenario)) next = discover(next, id);
  }
  return next;
}

/** Discovers every evidence item that matches the trigger (idempotent). */
function discoverByTrigger(
  state: ChapterState,
  ids: readonly EvidenceId[],
  trigger: DiscoveryTrigger,
  scenario: ScenarioDefinition,
): ChapterState {
  let next = state;
  for (const id of ids) {
    if (canDiscover(next, id, trigger, scenario)) next = discover(next, id);
  }
  return next;
}

/** Starts an outgoing call from the phone: an active call linked to the call's dialogue graph. */
function startOutgoingCall(state: ChapterState, callId: CallId, scenario: ScenarioDefinition): ChapterState {
  const calling: ChapterState = {
    ...state,
    call: {
      current: callId,
      status: "active",
      log: upsertCallRecord(state, callId, (record) => ({
        ...(record ?? newCallRecord(callId, scenario)),
        status: "answered",
        ringCount: (record?.ringCount ?? 0) + 1,
      })),
    },
  };
  const next = startConversation(calling, scenario.calls[callId].graphId, scenario, { callId });
  return sweepDialogueEvidence(next, scenario);
}
/** Debrief tag recorded when the player hangs up an active call with END_CALL. */
const HANG_UP_TAG = "hung-up";

/** Flag recorded when the player declines or hangs up the first call (Requirement 5, first call). */
const FIRST_CALL_ID: CallId = "call.alex";
const FIRST_CALL_REJECTED_FLAG: FlagId = "first_call_rejected";

// ---------------------------------------------------------------------------
// Per-action guard and apply
// ---------------------------------------------------------------------------

function applyThesisSessionWork(
  state: ChapterState,
  scenario: ScenarioDefinition,
  plannedMinutes: number,
  mode: "normal" | "deep" | "rush",
  sessionElapsedMinutes: number,
): ApplyResult {
  if (state.call.current !== null) return reject(REASONS.callInProgress);
  if (state.conversation !== null) return reject(REASONS.conversationInProgress);
  if (state.resources.timeMinutes <= 0) return reject(REASONS.timeIsUp);
  if (state.resources.thesisProgress >= 100) return reject(REASONS.thesisComplete);
  const config = gameplayConfig(scenario);
  const progressRemainder = state.world.thesisWorkRemainderUnits ?? 0;
  const exactProgress = state.resources.thesisProgress + progressRemainder / 1000;
  if (config.thesisFreeWorkMaxPercent - exactProgress <= 0) return reject(REASONS.thesisNeedsTasks);
  const minutes = Math.min(plannedMinutes, state.resources.timeMinutes);
  const input = {
    startElapsedMinutes: elapsedMinutes(state, scenario),
    sessionElapsedMinutes,
    plannedMinutes: minutes,
    startFatigue: state.resources.fatigue,
    startProgress: exactProgress,
    freeWorkMaxPercent: config.thesisFreeWorkMaxPercent,
    baseMinutesPerPercent: config.thesisMinutesPerPercent,
    mode,
    fatigueConfig: config.fatigue,
  } as const;
  const full = simulateThesisSession(input);
  if (full.effectiveMinutesSpent < 1) return reject(REASONS.workTooShort);
  const interruption = findSessionInterruptions(state, scenario, full.effectiveMinutesSpent, mode)
    .find((item) => item.atSessionMinute < full.effectiveMinutesSpent) ?? null;
  const spent = interruption ? Math.min(full.effectiveMinutesSpent, interruption.atSessionMinute) : full.effectiveMinutesSpent;
  const segment = interruption ? simulateThesisSession({ ...input, plannedMinutes: spent }) : full;
  if (segment.effectiveMinutesSpent < 1) return reject(REASONS.workTooShort);

  const totalProgressUnits = progressRemainder + segment.progressUnitsGain;
  const worked = applyEffects(
    state,
    [
      { kind: "adjustResource", resource: "thesisProgress", delta: Math.floor(totalProgressUnits / 1000) },
      { kind: "adjustResource", resource: "timeMinutes", delta: -segment.effectiveMinutesSpent },
      { kind: "adjustResource", resource: "fatigue", delta: segment.fatigueGain },
    ],
    scenario,
  );
  const remainingMinutes = Math.max(0, full.effectiveMinutesSpent - segment.effectiveMinutesSpent);
  const thesisWorkSession = interruption !== null && remainingMinutes > 0
    ? {
        mode,
        plannedMinutes,
        elapsedMinutes: sessionElapsedMinutes + segment.effectiveMinutesSpent,
        remainingMinutes,
        interruption,
      }
    : null;
  return accept({
    ...worked,
    world: {
      ...worked.world,
      thesisWorkRemainderUnits: totalProgressUnits % 1000,
      thesisWorkSession,
    },
  }, [`${WORLD_TAG_PREFIX}thesis_session:${mode}`]);
}

function applyAction(state: ChapterState, action: CoreAction, scenario: ScenarioDefinition): ApplyResult {
  if (action.type !== "START_CHAPTER" && action.type !== "FINISH_CHAPTER" && state.status === "not-started") {
    return reject(REASONS.notStarted);
  }

  switch (action.type) {
    case "START_CHAPTER": {
      if (state.status !== "not-started") return reject(REASONS.alreadyStarted);
      let next: ChapterState = {
        ...state,
        status: "playing",
        claims: recordOf<ClaimId, ClaimStatus>(CLAIM_IDS, () => "unverified"),
      };
      for (const message of Object.values(scenario.phone.messages)) {
        if (message.deliveredAtStart) {
          next = applyEffect(next, { kind: "deliverMessage", messageId: message.id }, scenario);
        }
      }
      return accept(next);
    }

    case "INTERACT_OBJECT": {
      if (!Object.hasOwn(scenario.interactables, action.objectId)) return reject(REASONS.unknownObject);
      const def = scenario.interactables[action.objectId];
      if (def.produces.type !== "INTERACT_OBJECT") return reject(REASONS.wrongObjectAction);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      let next = state.interacted.includes(action.objectId)
        ? state
        : { ...state, interacted: [...state.interacted, action.objectId] };
      next = discoverByTrigger(next, def.reveals, { via: "interact", objectId: action.objectId }, scenario);
      return accept(next);
    }

    case "INSPECT_EVIDENCE": {
      if (!Object.hasOwn(scenario.evidence, action.evidenceId)) return reject(REASONS.unknownEvidence);
      if (state.discovered.includes(action.evidenceId)) return reject(REASONS.evidenceAlreadyRecorded);
      if (!canDiscover(state, action.evidenceId, { via: "inspect" }, scenario)) {
        return reject(REASONS.evidenceNotAvailable);
      }
      let next = discover(state, action.evidenceId);
      const readIds = Object.values(scenario.phone.messages)
        .filter((message) => message.evidenceId === action.evidenceId)
        .map((message) => message.id);
      if (readIds.some((id) => next.phone.unread.includes(id))) {
        next = {
          ...next,
          phone: { ...next.phone, unread: next.phone.unread.filter((id) => !readIds.includes(id)) },
        };
      }
      return accept(next);
    }

    case "OPEN_PHONE": {
      if (state.phone.open) return reject(REASONS.phoneAlreadyOpen);
      return accept({ ...state, phone: { ...state.phone, open: true } });
    }

    case "CLOSE_PHONE": {
      if (!state.phone.open) return reject(REASONS.phoneAlreadyClosed);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      return accept({ ...state, phone: { ...state.phone, open: false } });
    }

    case "RING_CALL": {
      if (state.call.status === "ringing") return reject(REASONS.callAlreadyRinging);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      const callId = action.callId;
      if (!Object.hasOwn(scenario.calls, callId)) return reject(REASONS.unknownCall);
      const def = scenario.calls[callId];
      if (def.direction !== "incoming") return reject(REASONS.callNotYet);
      if (state.decision !== null) return reject(REASONS.decisionAlreadyMade);
      // Every incoming call rings at most once: answered, declined, missed or ended calls never ring again.
      if (hasRung(state, callId)) return reject(REASONS.callAlreadyRang);
      if (!def.ringWhen.some((all) => evaluateConditions(all, state, scenario))) {
        return reject(REASONS.callNotYet);
      }
      const next: ChapterState = {
        ...state,
        call: {
          current: callId,
          status: "ringing",
          log: upsertCallRecord(state, callId, (record) => ({
            ...(record ?? newCallRecord(callId, scenario)),
            status: "ringing",
            ringCount: (record?.ringCount ?? 0) + 1,
          })),
        },
      };
      return accept(next);
    }

    case "ANSWER_CALL": {
      const callId = state.call.current;
      if (state.call.status !== "ringing" || callId === null) return reject(REASONS.noCallRinging);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      const answered: ChapterState = {
        ...state,
        call: {
          current: callId,
          status: "active",
          log: upsertCallRecord(state, callId, (record) => ({
            ...(record ?? newCallRecord(callId, scenario)),
            status: "answered",
          })),
        },
      };
      let next = startConversation(answered, scenario.calls[callId].graphId, scenario, { callId });
      next = sweepDialogueEvidence(next, scenario);
      return accept(next);
    }

    case "END_CALL": {
      const callId = state.call.current;
      if (callId === null) return reject(REASONS.noCallToEnd);
      if (state.call.status === "ringing") {
        // Decline: the call record stays in the log as declined.
        let declined: ChapterState = {
          ...state,
          call: {
            current: null,
            status: "declined",
            log: upsertCallRecord(state, callId, (record) => ({
              ...(record ?? newCallRecord(callId, scenario)),
              status: "declined",
            })),
          },
        };
        if (callId === FIRST_CALL_ID) {
          declined = applyEffect(declined, { kind: "setFlag", flag: FIRST_CALL_REJECTED_FLAG }, scenario);
        }
        return accept(declined);
      }
      // Hang up an active call: end its conversation at the current node.
      let next =
        state.conversation !== null && state.conversation.callId === callId
          ? endConversation(state, null)
          : state;
      if (next.call.current !== null) {
        next = {
          ...next,
          call: {
            current: null,
            status: "ended",
            log: upsertCallRecord(next, callId, (record) => ({
              ...(record ?? newCallRecord(callId, scenario)),
              status: "ended",
            })),
          },
        };
      }
      if (callId === FIRST_CALL_ID) {
        next = applyEffect(next, { kind: "setFlag", flag: FIRST_CALL_REJECTED_FLAG }, scenario);
      }
      return accept(next, [HANG_UP_TAG]);
    }

    case "TALK_TO_NPC": {
      // This chapter has no NPC conversations (`NPC_IDS` is empty), so every NPC is unknown.
      return reject(REASONS.unknownNpc);
    }

    case "SELECT_DIALOGUE_OPTION": {
      const result = selectOption(state, action.optionId, scenario);
      if (!result.ok) return reject(result.reason);
      return accept(sweepDialogueEvidence(result.state, scenario), result.debriefTags);
    }

    case "VERIFY_CLAIM":
      return applyVerify(state, action.claimId, action.method, scenario);

    case "MAKE_DECISION": {
      if (state.decision !== null) return reject(REASONS.decisionAlreadyMade);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (!Object.hasOwn(scenario.decisions, action.decision)) return reject(REASONS.decisionUnavailable);
      const def = scenario.decisions[action.decision];
      if (!evaluateConditions(def.requires, state, scenario)) {
        return reject(def.unavailableHint || REASONS.decisionUnavailable);
      }
      let next = applyEffects(state, def.effects, scenario);
      next = applyEffect(next, { kind: "recordDecision", decision: action.decision }, scenario);
      return accept(next, def.debriefTag ? [def.debriefTag] : []);
    }

    case "COMPLETE_OBJECTIVE": {
      if (!canCompleteObjective(state, action.objectiveId, scenario)) {
        return reject(OBJECTIVE_CONDITION_NOT_MET);
      }
      return accept({
        ...state,
        objectives: {
          active: state.objectives.active.filter((id) => id !== action.objectiveId),
          completed: OBJECTIVE_IDS.filter(
            (id) => id === action.objectiveId || state.objectives.completed.includes(id),
          ),
        },
      });
    }

    case "FINISH_CHAPTER": {
      if (state.outcome === null) return reject(REASONS.chapterNotEnded);
      if (state.status === "finished") return reject(REASONS.chapterAlreadyFinished);
      return accept({ ...state, status: "finished" });
    }

    case "DEVICE_ACTION": {
      if (!Object.hasOwn(scenario.deviceActions, action.deviceActionId)) {
        return reject(REASONS.unknownDeviceAction);
      }
      const def = scenario.deviceActions[action.deviceActionId];
      if (def.once && hasDoneDeviceAction(state, def.id)) return reject(REASONS.deviceActionAlreadyDone);
      if (!evaluateConditions(def.requires, state, scenario)) return reject(REASONS.deviceActionUnavailable);
      let next = applyEffects(state, def.effects, scenario);
      next = discoverByTrigger(next, def.reveals, { via: "device", deviceActionId: def.id }, scenario);
      return accept(next, def.debriefTag ? [def.debriefTag] : []);
    }

    case "ADVANCE_TIME": {
      if (state.resources.timeMinutes <= 0) return reject(REASONS.timeIsUp);
      return accept(applyEffect(state, { kind: "adjustResource", resource: "timeMinutes", delta: -action.minutes }, scenario));
    }
    case "START_THESIS_SESSION": {
      if (state.world.thesisWorkSession !== null) return reject(REASONS.thesisSessionAlreadyActive);
      return applyThesisSessionWork(state, scenario, action.minutes, action.mode, 0);
    }
    case "RESUME_THESIS_SESSION": {
      const session = state.world.thesisWorkSession;
      if (session === null) return reject(REASONS.noPausedThesisSession);
      return applyThesisSessionWork(state, scenario, session.remainingMinutes, session.mode, session.elapsedMinutes);
    }
    case "END_THESIS_SESSION": {
      if (state.world.thesisWorkSession === null) return reject(REASONS.noThesisSessionToEnd);
      return accept({ ...state, world: { ...state.world, thesisWorkSession: null } }, [`${WORLD_TAG_PREFIX}thesis_session:end`]);
    }
    case "SAVE_THESIS_DRAFT": {
      if (state.resources.timeMinutes <= 0) return reject(REASONS.timeIsUp);
      if (state.world.thesisDraft[action.sectionId] === action.content) return reject(REASONS.draftAlreadySaved);
      return accept({
        ...state,
        world: { ...state.world, thesisDraft: { ...state.world.thesisDraft, [action.sectionId]: action.content } },
      }, [`${WORLD_TAG_PREFIX}thesis_draft:${action.sectionId}`]);
    }
    case "WORK_ON_THESIS": {
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      if (state.resources.timeMinutes <= 0) return reject(REASONS.timeIsUp);
      if (state.resources.thesisProgress >= 100) return reject(REASONS.thesisComplete);
      const config = gameplayConfig(scenario);
      // Free work gets the thesis only to the configured limit; the rest comes from thesis tasks.
      const room = config.thesisFreeWorkMaxPercent - state.resources.thesisProgress - (state.world.thesisWorkRemainderUnits ?? 0) / 1000;
      if (room <= 0) return reject(REASONS.thesisNeedsTasks);
      const minutes = Math.min(action.minutes, state.resources.timeMinutes);
      if (action.focusMode !== undefined) {
        // Non-linear Deep-Work Session (Warm-up -> Flow -> Burnout + circadian night curve).
        const sim = simulateThesisSession({
          startElapsedMinutes: elapsedMinutes(state, scenario),
          sessionElapsedMinutes: action.sessionElapsedMinutes,
          plannedMinutes: minutes,
          startFatigue: state.resources.fatigue,
          startProgress: state.resources.thesisProgress + (state.world.thesisWorkRemainderUnits ?? 0) / 1000,
          freeWorkMaxPercent: config.thesisFreeWorkMaxPercent,
          baseMinutesPerPercent: config.thesisMinutesPerPercent,
          mode: action.focusMode,
          fatigueConfig: config.fatigue,
        });
        if (sim.effectiveMinutesSpent < 1) return reject(REASONS.workTooShort);
        const totalProgressUnits = (state.world.thesisWorkRemainderUnits ?? 0) + sim.progressUnitsGain;
        const wholeProgressGain = Math.floor(totalProgressUnits / 1000);
        const remainderUnits = totalProgressUnits % 1000;
        const worked = applyEffects(
          state,
          [
            { kind: "adjustResource", resource: "thesisProgress", delta: wholeProgressGain },
            { kind: "adjustResource", resource: "timeMinutes", delta: -sim.effectiveMinutesSpent },
            { kind: "adjustResource", resource: "fatigue", delta: sim.fatigueGain },
          ],
          scenario,
        );
        return accept(
          {
            ...worked,
            world: { ...worked.world, thesisWorkRemainderUnits: remainderUnits },
          },
          [`${WORLD_TAG_PREFIX}thesis_session:${action.focusMode}`],
        );
      }
      // Legacy linear mode (kept exact for existing tests and replays without `focusMode`).
      const perPercent = effectiveWorkMinutes(config.thesisMinutesPerPercent, state.resources.fatigue, config.fatigue);
      const gain = Math.min(room, Math.floor(minutes / perPercent));
      if (gain < 1) return reject(REASONS.workTooShort);
      const spent = Math.min(minutes, gain * perPercent);
      return accept(
        applyEffects(
          state,
          [
            { kind: "adjustResource", resource: "thesisProgress", delta: gain },
            { kind: "adjustResource", resource: "timeMinutes", delta: -spent },
            { kind: "adjustResource", resource: "fatigue", delta: workFatigue(spent, config.fatigue) },
          ],
          scenario,
        ),
      );
    }
    case "REST": {
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      const config = gameplayConfig(scenario).fatigue;
      if (!config.enabled) return reject(REASONS.restUnavailable);
      if (state.resources.timeMinutes <= 0) return reject(REASONS.timeIsUp);
      const option = restOption(action.mode, config);
      const minutes = Math.min(option.minutes, state.resources.timeMinutes);
      const recovery = Math.round((option.recovery * minutes) / option.minutes);
      const rested = applyEffects(
        state,
        [
          { kind: "adjustResource", resource: "timeMinutes", delta: -minutes },
          { kind: "adjustResource", resource: "fatigue", delta: -recovery },
        ],
        scenario,
      );
      const slept = (rested.world.sleptMinutes ?? 0) + (action.mode === "sleep" ? minutes : 0);
      return accept({ ...rested, world: { ...rested.world, sleptMinutes: slept } }, [`${WORLD_TAG_PREFIX}rest:${action.mode}`]);
    }
    case "COMPLETE_THESIS_TASK": {
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      const task = scenario.thesisTasks?.find((candidate) => candidate.id === action.taskId);
      if (task === undefined) return reject(REASONS.unknownThesisTask);
      if (state.world.thesisTasksDone.includes(task.id)) return reject(REASONS.thesisTaskDone);
      if (task.id === "draft.findings" && action.researchNotes !== undefined) {
        // `researchNotes` marks the new editor workflow. Older replay logs have no field and retain
        // their historical task semantics; new UI actions must prove the saved text is grounded.
        const findings = state.world.thesisDraft.findings ?? "";
        const hasCount = /(?:9|6)\s*(?:of|out of)\s*24|(?:9|6)\s*trong số\s*24/i.test(findings);
        const hasSampleLimit = /not an? (?:estimate|generalization)|not all students|không (?:phải|đại diện)|không suy rộng/i.test(findings);
        if (!hasCount || !hasSampleLimit) return reject(REASONS.thesisEvidenceMissing);
      }
      if (state.resources.thesisProgress >= 100) return reject(REASONS.thesisComplete);
      if (!evaluateConditions(task.requires, state, scenario)) return reject(REASONS.thesisTaskUnavailable);
      const taskConfig = gameplayConfig(scenario);
      const timeCost = effectiveWorkMinutes(task.timeCostMinutes ?? 0, state.resources.fatigue, taskConfig.fatigue);
      if (timeCost > 0 && state.resources.timeMinutes <= 0) return reject(REASONS.timeIsUp);
      if (timeCost > state.resources.timeMinutes) return reject(REASONS.notEnoughTimeForAction);
      let next: ChapterState = { ...state, world: { ...state.world, thesisTasksDone: [...state.world.thesisTasksDone, task.id] } };
      next = applyEffect(next, { kind: "adjustResource", resource: "fatigue", delta: workFatigue(timeCost, taskConfig.fatigue) }, scenario);
      next = applyEffect(next, { kind: "adjustResource", resource: "thesisProgress", delta: task.progressGain }, scenario);
      if (timeCost > 0) next = applyEffect(next, { kind: "adjustResource", resource: "timeMinutes", delta: -timeCost }, scenario);
      next = applyEffects(next, task.effects, scenario);
      // The persistent consequence is derived from the saved manuscript, never a UI-supplied note ID.
      // Only the known-channel finding can inform this later choice; the classmate finding does not.
      const savedFindings = state.world.thesisDraft.findings ?? "";
      const citesSavedChannel = /9\s*(?:of|trong số)\s*24.{0,180}(?:saved portal|cổng thông tin đã lưu)/i.test(savedFindings);
      if (task.id === "draft.findings" && citesSavedChannel) {
        next = { ...next, persistent: { ...next.persistent, researchSavedChannelIncluded: true } };
      }
      return accept(next, [`${WORLD_TAG_PREFIX}thesis:${task.id}`]);
    }
    case "RESPOND_EVENT": {
      if (state.call.current !== null) return reject(REASONS.callInProgress);
      if (state.conversation !== null) return reject(REASONS.conversationInProgress);
      const def = eventDef(scenario, action.eventId);
      if (def === undefined || !Object.hasOwn(state.world.events, action.eventId)) return reject(REASONS.unknownEvent);
      const current = state.world.events[action.eventId];
      if (current.status !== "pending") return reject(REASONS.eventNotPending);
      const response = responseFor(def, action.response);
      if (response === undefined) return reject(REASONS.unknownResponse);
      if (!evaluateConditions(response.requires, state, scenario)) return reject(REASONS.responseUnavailable);
      const start = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
      const now = Math.max(0, start - state.resources.timeMinutes);
      const resolvedAt = response.kind === "postpone" ? null : now;
      const status = response.kind === "respond" ? "resolved" : response.kind === "ignore" ? "ignored" : "pending";
      let next: ChapterState = {
        ...state,
        world: {
          ...state.world,
          events: {
            ...state.world.events,
            [action.eventId]: {
              ...current,
              status,
              resolvedAtMinute: resolvedAt,
              postponed: current.postponed + (response.kind === "postpone" ? 1 : 0),
              response: response.kind === "postpone" ? current.response : response.id,
            },
          },
        },
      };
      if (response.timeCostMinutes !== undefined && response.timeCostMinutes > 0) {
        next = applyEffect(next, { kind: "adjustResource", resource: "timeMinutes", delta: -response.timeCostMinutes }, scenario);
      }
      next = applyEffects(next, response.effects, scenario);
      return accept(next, [`${WORLD_TAG_PREFIX}response:${action.eventId}:${response.id}`]);
    }
    case "OPEN_DEVICE_ITEM": {
      const item = deviceItemDef(scenario, action.itemId);
      if (item === undefined) return reject(REASONS.unknownItem);
      if (!Object.hasOwn(state.device.items, action.itemId)) return reject(REASONS.itemNotArrived);
      const current = state.device.items[action.itemId];
      // Opening an item again is allowed and changes nothing.
      if (current.read) return accept(state);
      const start = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
      const now = Math.max(0, start - state.resources.timeMinutes);
      let next: ChapterState = {
        ...state,
        device: { ...state.device, items: { ...state.device.items, [action.itemId]: { ...current, read: true, readAtMinute: now } } },
      };
      next = applyEffects(next, item.onOpen, scenario);
      return accept(next, [`${WORLD_TAG_PREFIX}item:${action.itemId}:opened`]);
    }
    case "USE_DEVICE_ITEM": {
      const item = deviceItemDef(scenario, action.itemId);
      if (item === undefined) return reject(REASONS.unknownItem);
      if (!Object.hasOwn(state.device.items, action.itemId)) return reject(REASONS.itemNotArrived);
      const def = itemActionDef(item, action.actionId);
      if (def === undefined) return reject(REASONS.unknownItemAction);
      const current = state.device.items[action.itemId];
      if (def.once === true && current.done.includes(def.id)) return reject(REASONS.itemActionDone);
      if (!evaluateConditions(def.visibleWhen, state, scenario) || !evaluateConditions(def.requires, state, scenario)) {
        return reject(REASONS.itemActionUnavailable);
      }
      const cashCost = def.cashCost ?? 0;
      if (cashCost > 0 && def.allowDebt !== true && state.resources.cash < cashCost) return reject(REASONS.notEnoughCash);
      const timeCost = def.timeCostMinutes ?? 0;
      if (timeCost > 0 && state.resources.timeMinutes <= 0) return reject(REASONS.timeIsUp);
      if (timeCost > state.resources.timeMinutes) return reject(REASONS.notEnoughTimeForAction);
      if (def.callId !== undefined) {
        if (state.call.current !== null) return reject(REASONS.callInProgress);
        if (state.conversation !== null) return reject(REASONS.conversationInProgress);
        if (!Object.hasOwn(scenario.calls, def.callId) || scenario.calls[def.callId as CallId].direction !== "outgoing") {
          return reject(REASONS.unknownCall);
        }
      }
      const startMinute = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
      const doneAtMinute = Math.max(0, startMinute - Math.max(0, state.resources.timeMinutes - timeCost));
      let next: ChapterState = {
        ...state,
        device: {
          ...state.device,
          items: {
            ...state.device.items,
            [action.itemId]: {
              ...current,
              read: true,
              readAtMinute: current.readAtMinute ?? 0,
              done: current.done.includes(def.id) ? current.done : [...current.done, def.id],
              doneAt: { ...current.doneAt, [def.id]: doneAtMinute },
            },
          },
        },
      };
      if (timeCost > 0) next = applyEffect(next, { kind: "adjustResource", resource: "timeMinutes", delta: -timeCost }, scenario);
      if (cashCost > 0) next = recordTransaction(next, scenario, def.ledgerLabel ?? def.id, -cashCost, def.counterparty ?? null, item.id, def.id, def.ledgerCategory ?? null);
      if (def.moveTo !== undefined) next = applyEffect(next, { kind: "setLocation", placeId: def.moveTo }, scenario);
      next = applyEffects(next, def.effects, scenario);
      if (def.callId !== undefined) next = startOutgoingCall(next, def.callId as CallId, scenario);
      return accept(next, [`${WORLD_TAG_PREFIX}item:${action.itemId}:${def.id}`]);
    }
    case "COMBINE_EVIDENCE": {
      const ids = action.evidenceIds;
      if (!ids.every((id) => Object.hasOwn(scenario.evidence, id) && state.discovered.includes(id))) {
        return reject(REASONS.evidenceNotAvailable);
      }
      const deduction = matchDeduction(ids, scenario);
      if (deduction === null) return reject(REASONS.combinationInvalid);
      if (state.deductions.includes(deduction.id)) return reject(REASONS.deductionAlreadyRecorded);
      if (!canRecordDeduction(state, deduction, scenario)) return reject(REASONS.combinationInvalid);
      const recorded: ChapterState = { ...state, deductions: [...state.deductions, deduction.id] };
      return accept(applyEffects(recorded, deduction.effects, scenario), [deduction.debriefTag]);
    }
  }
}

function applyVerify(
  state: ChapterState,
  claimId: ClaimId,
  method: VerifyMethod,
  scenario: ScenarioDefinition,
): ApplyResult {
  if (method === "saved-official-contact") {
    // E03 (paper) or E03b (app): the saved official contact.
    if (!state.discovered.includes("ev.official-contact-paper") && !state.discovered.includes("ev.official-contact-app")) {
      return reject(REASONS.needOfficialNumber);
    }
    if (state.call.current !== null) return reject(REASONS.callInProgress);
    if (state.conversation !== null) return reject(REASONS.conversationInProgress);
    if (state.decision !== null) return reject(REASONS.decisionAlreadyMade);
    // The player calls the saved official contact: an outgoing Call linked to the official line graph.
    const callId: CallId = "call.official";
    if (!Object.hasOwn(scenario.calls, callId)) return reject(REASONS.unknownCall);
    const calling: ChapterState = {
      ...state,
      call: {
        current: callId,
        status: "active",
        log: upsertCallRecord(state, callId, (record) => ({
          ...(record ?? newCallRecord(callId, scenario)),
          status: "answered",
          ringCount: (record?.ringCount ?? 0) + 1,
        })),
      },
    };
    let next = startConversation(calling, scenario.calls[callId].graphId, scenario, { callId });
    next = discoverByTrigger(next, EVIDENCE_IDS, { via: "verify", method }, scenario);
    next = sweepDialogueEvidence(next, scenario);
    return accept(next);
  }

  // bank-app
  if (!state.phone.open) return reject(REASONS.phoneClosed);
  if (state.call.current !== null) return reject(REASONS.callInProgress);
  if (hasVerifiedBy(state, method)) return reject(REASONS.evidenceAlreadyRecorded);
  let next = discoverByTrigger(state, EVIDENCE_IDS, { via: "verify", method }, scenario);
  // The app is not an independent channel, so the result is `inconclusive`.
  // A `contradicted` status from the official line is kept, because it is the stronger result.
  if (next.claims[claimId] !== "contradicted") {
    next = applyEffect(next, { kind: "setClaimStatus", claimId, status: "inconclusive" }, scenario);
  }
  return accept(next);
}

/**
 * Night checks (`FatigueConfig.nightChecksAtMinute`): once the clock passes a check, a night with
 * less sleep than the minimum adds fatigue. Idempotent: each check is made once. Sleep taken in the
 * action that crosses the check counts for that night.
 */
export function applyNightChecks(state: ChapterState, scenario: ScenarioDefinition): ChapterState {
  const config = gameplayConfig(scenario).fatigue;
  if (!config.enabled) return state;
  const now = elapsedMinutes(state, scenario);
  let checked = state.world.nightsChecked ?? 0;
  let slept = state.world.sleptMinutes ?? 0;
  let fatigue = state.resources.fatigue;
  const before = checked;
  while (checked < config.nightChecksAtMinute.length && config.nightChecksAtMinute[checked] <= now) {
    if (slept < config.minSleepMinutes) fatigue += config.missedSleepPenalty;
    slept = 0;
    checked += 1;
  }
  if (checked === before) return state;
  return {
    ...state,
    resources: { ...state.resources, fatigue: clampResource("fatigue", fatigue) },
    world: { ...state.world, sleptMinutes: slept, nightsChecked: checked },
  };
}

/**
 * Appends the entry. Free-roam ticks (`ADVANCE_TIME`) that changed nothing but the clock merge
 * into the previous such tick, so a 72-hour chapter does not fill the save with thousands of
 * actions. The merged action replays to the same state, because neither step had anything due.
 */
function appendEntry(events: EventLogEntry[], entry: EventLogEntry): EventLogEntry[] {
  const last = events[events.length - 1];
  if (last !== undefined && isQuietTick(last) && isQuietTick(entry)) {
    const minutes = (last.action as { minutes: number }).minutes + (entry.action as { minutes: number }).minutes;
    if (minutes <= MAX_ADVANCE_MINUTES) {
      const timeDelta = (last.derived.resources.timeMinutes ?? 0) + (entry.derived.resources.timeMinutes ?? 0);
      const merged: EventLogEntry = {
        ...last,
        action: { type: "ADVANCE_TIME", minutes },
        derived: { ...last.derived, resources: timeDelta === 0 ? {} : { timeMinutes: timeDelta } },
      };
      return [...events.slice(0, -1), merged];
    }
  }
  return [...events, entry];
}
function isQuietTick(entry: EventLogEntry): boolean {
  const { derived } = entry;
  return (
    entry.action.type === "ADVANCE_TIME" &&
    derived.evidence.length === 0 &&
    derived.flags.length === 0 &&
    derived.persistent.length === 0 &&
    derived.objectivesActivated.length === 0 &&
    derived.objectivesCompleted.length === 0 &&
    derived.debriefTags.length === 0 &&
    Object.keys(derived.resources).every((key) => key === "timeMinutes")
  );
}
/** Net change per resource between two states. Lists only resources that changed. */
function resourceChanges(before: ChapterState, after: ChapterState): Partial<Record<ResourceId, number>> {
  const changes: Partial<Record<ResourceId, number>> = {};
  for (const id of RESOURCE_IDS) {
    const delta = after.resources[id] - before.resources[id];
    if (delta !== 0) changes[id] = delta;
  }
  return changes;
}
/** Persistent flags whose value differs between two states. */
function persistentChanges(before: ChapterState, after: ChapterState): PersistentFlagId[] {
  return PERSISTENT_FLAG_IDS.filter((flag) => before.persistent[flag] !== after.persistent[flag]);
}
// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Computes the next Chapter_State from the current state, a dispatched value and Scenario_Data
 * (Requirement 5.5). Every call returns an Action_Result (Requirement 5.2). Rejections return
 * the input state object unchanged with a non-empty reason (Requirement 5.3).
 */
export function chapterReducer(
  state: ChapterState,
  action: unknown,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): ActionResult {
  // 1. Shape check.
  if (!isCoreAction(action)) return { state, accepted: false, reason: REASONS.unknownAction };

  // 2. Outcome lock (Requirement 5.9).
  if (state.outcome !== null && action.type !== "FINISH_CHAPTER") {
    return { state, accepted: false, reason: REASONS.chapterEnded };
  }

  // 3 and 4. Guard and apply.
  const applied = applyAction(state, action, scenario);
  if (!applied.ok) return { state, accepted: false, reason: applied.reason };

  // 5. Beats. The fired IDs are tagged in this entry so a beat never fires twice.
  const beats = applyBeats(applyNightChecks(applied.state, scenario), scenario);
  // 5b. World clock: events, deadlines and missions that are due at the new simulated time.
  const world = settleWorld(beats.state, scenario);
  const debriefTags = [...applied.debriefTags, ...beats.fired.map(beatTag), ...world.tags];

  // 6. Objective manager.
  const manager = runObjectiveManager(state, world.state, action, scenario);
  let next = manager.state;
  const objectivesCompleted: ObjectiveId[] = [...manager.completed];
  if (action.type === "COMPLETE_OBJECTIVE" && !objectivesCompleted.includes(action.objectiveId)) {
    objectivesCompleted.unshift(action.objectiveId);
  }

  // 6. Outcome (Requirement 13.6).
  if (next.outcome === null && next.decision !== null) {
    const outcome = selectOutcome(next, scenario);
    if (outcome !== null) {
      next = { ...next, outcome, status: next.status === "finished" ? "finished" : "ended" };
    }
  }

  // 7. Event_Log append (Requirement 5.6).
  const entry: EventLogEntry = {
    seq: state.events.length,
    action,
    derived: {
      evidence: next.discovered.filter((id) => !state.discovered.includes(id)),
      flags: FLAG_IDS.filter((flag) => next.flags[flag] === true && state.flags[flag] !== true),
      resources: resourceChanges(state, next),
      persistent: persistentChanges(state, next),
      objectivesActivated: [...manager.activated],
      objectivesCompleted,
      debriefTags,
    },
  };
  next = { ...next, events: appendEntry(state.events, entry) };

  return { state: next, accepted: true };
}

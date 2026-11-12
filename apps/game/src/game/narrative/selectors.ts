// Selectors for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Store" (selectors) and
// Requirements 11.7-11.9, 13.1-13.3.
//
// Every view selector is memoized by state identity (and scenario identity), so calling it twice
// with the same state returns the same object. This keeps `useSyncExternalStore` bindings stable.
// Selectors never mutate their inputs and read only Chapter_State and Scenario_Data.

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type {
  CallId,
  ClaimId,
  DecisionId,
  DialogueGraphId,
  EvidenceId,
  InteractableId,
  MessageId,
  NpcId,
  ObjectiveId,
  VerifyMethod,
} from "./chapter1/ids";
import { evaluateCondition, evaluateConditions } from "./conditions";
import { availableOptions, type DialogueOptionView } from "./dialogueEngine";
import { canDiscover } from "./evidence";
import { canCompleteObjective } from "./objectives";
import { REASONS, type ReasonCode } from "./reducer";
import type {
  ActDef,
  CallRecord,
  ChapterState,
  ClaimStatus,
  CoreAction,
  DialogueNode,
  EvidenceItem,
  Objective,
  ScenarioDefinition,
  Stance,
} from "./types";

// ---------------------------------------------------------------------------
// Display text
// ---------------------------------------------------------------------------

/**
 * Journal text for each Stance (Requirements 11.8, 11.9). A `contradicts` Stance is described as
 * pointing against the Claim, never as proof.
 */
export const STANCE_TEXT: Record<Stance, string> = {
  supports: "Points toward this claim",
  contradicts: "Points against this claim",
  inconclusive: "Does not settle this claim",
  "needs-verification": "Needs checking through a channel you trust",
};

/** Journal text for each Claim status. */
export const CLAIM_STATUS_TEXT: Record<ClaimStatus, string> = {
  unverified: "Not checked yet",
  supported: "Evidence points toward this claim",
  contradicted: "Contradicted by Northgate's official line",
  inconclusive: "Checked, but not settled",
};

/** Speaker name shown for the player's own lines. */
export const PLAYER_SPEAKER_NAME = "You";

/** Phone call history entries that reveal an Evidence_Item when opened (Requirement 11.10). */
export const CALL_LOG_EVIDENCE: Partial<Record<CallId, EvidenceId>> = {
  "call.scam-1": "ev.caller-number",
  "call.callback": "ev.caller-number",
  "call.followup": "ev.second-number",
};

/** Claim checked by each VERIFY_CLAIM method when the method is not tied to a decision. */
const VERIFY_METHOD_CLAIM: Record<VerifyMethod, ClaimId> = {
  "official-line": "claim.caller-identity",
  "bank-app": "claim.account-suspended",
};

// ---------------------------------------------------------------------------
// Memoization by state identity
// ---------------------------------------------------------------------------

function memoByState<R>(
  compute: (state: ChapterState, scenario: ScenarioDefinition) => R,
): (state: ChapterState, scenario?: ScenarioDefinition) => R {
  const cache = new WeakMap<ChapterState, WeakMap<ScenarioDefinition, { value: R }>>();
  return (state, scenario = CHAPTER_1_SCENARIO) => {
    let byScenario = cache.get(state);
    if (!byScenario) {
      byScenario = new WeakMap();
      cache.set(state, byScenario);
    }
    const hit = byScenario.get(scenario);
    if (hit) return hit.value;
    const value = compute(state, scenario);
    byScenario.set(scenario, { value });
    return value;
  };
}

function scam1Answered(state: ChapterState): boolean {
  return state.call.log.some(
    (record) => record.callId === "call.scam-1" && (record.status === "answered" || record.status === "ended"),
  );
}

function scam1Ended(state: ChapterState): boolean {
  return evaluateCondition({ kind: "callEnded", callId: "call.scam-1" }, state);
}

function isPlaying(state: ChapterState): boolean {
  return state.status === "playing" && state.outcome === null;
}

// ---------------------------------------------------------------------------
// Objectives
// ---------------------------------------------------------------------------

/** Active objectives with their text, in objective order. */
export const selectActiveObjectives = memoByState((state, scenario): Objective[] =>
  state.objectives.active
    .filter((id) => Object.hasOwn(scenario.objectives, id))
    .map((id) => scenario.objectives[id]),
);

// ---------------------------------------------------------------------------
// Acts
// ---------------------------------------------------------------------------

/**
 * The current act: the last act (highest index) whose `enterWhen` holds. Falls back to the first
 * act when none holds. Pure; reads only Chapter_State and Scenario_Data.
 */
export function selectCurrentAct(state: ChapterState, scenario: ScenarioDefinition = CHAPTER_1_SCENARIO): ActDef {
  let current = scenario.acts[0];
  for (const act of scenario.acts) {
    if (evaluateConditions(act.enterWhen, state, scenario)) current = act;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Dialogue
// ---------------------------------------------------------------------------

export interface DialogueView {
  graphId: DialogueGraphId;
  nodeId: string;
  /** Linked Call, or `null` for a face-to-face conversation. */
  callId: CallId | null;
  channel: "phone" | "face-to-face";
  speaker: DialogueNode["speaker"];
  /** Persona name for caller and NPC lines, "You" for player lines, `null` for system lines. */
  speakerName: string | null;
  line: string;
  options: DialogueOptionView[];
}

/** The current conversation as the Dialogue panel shows it, or `null` when there is none. */
export const selectDialogueView = memoByState((state, scenario): DialogueView | null => {
  const conversation = state.conversation;
  if (!conversation || !Object.hasOwn(scenario.dialogues, conversation.graphId)) return null;
  const graph = scenario.dialogues[conversation.graphId];
  if (!Object.hasOwn(graph.nodes, conversation.nodeId)) return null;
  const node = graph.nodes[conversation.nodeId];
  const speakerName =
    node.speaker === "caller" || node.speaker === "npc"
      ? graph.persona.name
      : node.speaker === "player"
        ? PLAYER_SPEAKER_NAME
        : null;
  return {
    graphId: graph.id,
    nodeId: node.id,
    callId: conversation.callId,
    channel: graph.channel,
    speaker: node.speaker,
    speakerName,
    line: Object.hasOwn(graph.lines, node.lineId) ? graph.lines[node.lineId] : "",
    options: availableOptions(state, scenario),
  };
});

// ---------------------------------------------------------------------------
// Journal and claims
// ---------------------------------------------------------------------------

export interface JournalStance {
  claimId: ClaimId;
  claimText: string;
  stance: Stance;
  /** Text from `STANCE_TEXT`. */
  stanceText: string;
  note: string;
}

export interface JournalEntry {
  id: EvidenceId;
  title: string;
  description: string;
  source: EvidenceItem["source"];
  location: string;
  stances: JournalStance[];
  /**
   * Journal notes whose required evidence is all discovered, attached to the entry that
   * completed the requirement (the latest discovered of the required items).
   */
  notes: string[];
}

/** Discovered Evidence_Items in discovery order, with stance text (Requirements 11.7-11.9). */
export const selectJournalEntries = memoByState((state, scenario): JournalEntry[] => {
  const notesByEntry = new Map<EvidenceId, string[]>();
  for (const note of scenario.journalNotes) {
    if (note.requires.length === 0) continue;
    if (!note.requires.every((id) => state.discovered.includes(id))) continue;
    let anchor = note.requires[0];
    for (const id of note.requires) {
      if (state.discovered.indexOf(id) > state.discovered.indexOf(anchor)) anchor = id;
    }
    notesByEntry.set(anchor, [...(notesByEntry.get(anchor) ?? []), note.text]);
  }

  const entries: JournalEntry[] = [];
  for (const id of state.discovered) {
    if (!Object.hasOwn(scenario.evidence, id)) continue;
    const item = scenario.evidence[id];
    entries.push({
      id,
      title: item.title,
      description: item.description,
      source: item.source,
      location: item.location,
      stances: item.relations.map((relation) => ({
        claimId: relation.claimId,
        claimText: Object.hasOwn(scenario.claims, relation.claimId) ? scenario.claims[relation.claimId].text : "",
        stance: relation.stance,
        stanceText: STANCE_TEXT[relation.stance],
        note: relation.note,
      })),
      notes: notesByEntry.get(id) ?? [],
    });
  }
  return entries;
});

export interface ClaimStatusView {
  id: ClaimId;
  text: string;
  status: ClaimStatus;
  /** Text from `CLAIM_STATUS_TEXT`. */
  statusText: string;
  /** Discovered evidence related to the Claim, in discovery order. */
  evidence: Array<{ evidenceId: EvidenceId; title: string; stance: Stance; stanceText: string; note: string }>;
}

/** Every Claim with its status and related discovered evidence, in scenario order. */
export const selectClaimStatuses = memoByState((state, scenario): ClaimStatusView[] =>
  (Object.keys(scenario.claims) as ClaimId[]).map((claimId) => {
    const status = state.claims[claimId] ?? "unverified";
    const evidence: ClaimStatusView["evidence"] = [];
    for (const id of state.discovered) {
      if (!Object.hasOwn(scenario.evidence, id)) continue;
      const item = scenario.evidence[id];
      for (const relation of item.relations) {
        if (relation.claimId !== claimId) continue;
        evidence.push({
          evidenceId: id,
          title: item.title,
          stance: relation.stance,
          stanceText: STANCE_TEXT[relation.stance],
          note: relation.note,
        });
      }
    }
    return {
      id: claimId,
      text: scenario.claims[claimId].text,
      status,
      statusText: CLAIM_STATUS_TEXT[status],
      evidence,
    };
  }),
);

// ---------------------------------------------------------------------------
// Decision panel
// ---------------------------------------------------------------------------

export interface DecisionPreStepView {
  label: string;
  method: VerifyMethod;
  claimId: ClaimId;
  /** True when VERIFY_CLAIM with this method would be accepted now. */
  available: boolean;
  /** Shown when unavailable; `null` when available or done. */
  hint: string | null;
  /** Code of `hint` when it is a core rejection reason; `null` when it comes from scenario data. */
  hintCode: ReasonCode | null;
  /** True once the verification step has been taken. */
  done: boolean;
}

export interface DecisionOptionView {
  id: DecisionId;
  label: string;
  /** True when MAKE_DECISION with this decision would be accepted now. */
  available: boolean;
  /** Shown when unavailable; `null` when available. */
  hint: string | null;
  /** Code of `hint` when it is a core rejection reason; `null` when it comes from scenario data. */
  hintCode: ReasonCode | null;
  preStep: DecisionPreStepView | null;
}

export interface DecisionPanelView {
  /** True while the first scam Call has ended and no Decision exists (Requirement 13.1). */
  offered: boolean;
  options: DecisionOptionView[];
}

function busyReasonCode(state: ChapterState): ReasonCode | null {
  if (state.call.current !== null) return "callInProgress";
  if (state.conversation !== null) return "conversationInProgress";
  return null;
}

interface HintView {
  hint: string | null;
  hintCode: ReasonCode | null;
}

const NO_HINT: HintView = { hint: null, hintCode: null };

function reasonHint(code: ReasonCode): HintView {
  return { hint: REASONS[code], hintCode: code };
}

function scenarioHint(text: string): HintView {
  return { hint: text, hintCode: null };
}

/**
 * The decision panel with availability and hints from `decisions.requires`, `unavailableHint`
 * and `preStep` (Requirements 13.1-13.3).
 */
export const selectDecisionPanel = memoByState((state, scenario): DecisionPanelView => {
  const offered = isPlaying(state) && state.decision === null && scam1Ended(state);
  const busy = busyReasonCode(state);
  const options = (Object.keys(scenario.decisions) as DecisionId[]).map((id): DecisionOptionView => {
    const def = scenario.decisions[id];
    let preStep: DecisionPreStepView | null = null;
    let preStepPendingHint: string | null = null;
    if (def.preStep) {
      const step = def.preStep;
      const done = state.events.some(
        (entry) => entry.action.type === "VERIFY_CLAIM" && entry.action.method === step.method,
      );
      const meets = evaluateConditions(step.requires, state, scenario);
      const available = offered && !done && meets && busy === null;
      const stepHint =
        available || done
          ? NO_HINT
          : !meets
            ? scenarioHint(step.unavailableHint)
            : busy !== null
              ? reasonHint(busy)
              : NO_HINT;
      preStep = { label: step.label, method: step.method, claimId: step.claimId, available, ...stepHint, done };
      if (!meets) preStepPendingHint = step.unavailableHint;
    }
    const meets = evaluateConditions(def.requires, state, scenario);
    const available = offered && meets && busy === null;
    const optionHint = available
      ? NO_HINT
      : !meets
        ? scenarioHint(preStepPendingHint ?? def.unavailableHint)
        : busy !== null
          ? reasonHint(busy)
          : state.decision !== null
            ? reasonHint("decisionAlreadyMade")
            : scenarioHint(def.unavailableHint);
    return { id, label: def.label, available, ...optionHint, preStep };
  });
  return { offered, options };
});

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export interface CallLogEntryView extends CallRecord {
  /** Evidence revealed by opening this entry, if any. */
  evidenceId: EvidenceId | null;
  evidenceRecorded: boolean;
  /** True when INSPECT_EVIDENCE for `evidenceId` would be accepted now. */
  evidenceAvailable: boolean;
}

/** Call history, oldest first, with the evidence each entry can reveal. */
export const selectCallLog = memoByState((state, scenario): CallLogEntryView[] =>
  state.call.log.map((record) => {
    const evidenceId = CALL_LOG_EVIDENCE[record.callId] ?? null;
    return {
      ...record,
      // Caller name from the (possibly localized) scenario by call ID, else the stored record.
      displayName: scenario.calls[record.callId]?.displayName ?? record.displayName,
      evidenceId,
      evidenceRecorded: evidenceId !== null && state.discovered.includes(evidenceId),
      evidenceAvailable:
        evidenceId !== null && state.status === "playing" && canDiscover(state, evidenceId, "inspect", scenario),
    };
  }),
);

export interface PhoneMessageView {
  id: MessageId;
  from: string;
  body: string;
  unread: boolean;
  evidenceId: EvidenceId;
  evidenceRecorded: boolean;
}

/** Delivered messages in delivery order. */
export const selectPhoneMessages = memoByState((state, scenario): PhoneMessageView[] =>
  state.phone.messages
    .filter((id) => Object.hasOwn(scenario.phone.messages, id))
    .map((id) => {
      const message = scenario.phone.messages[id];
      return {
        id,
        from: message.from,
        body: message.body,
        unread: state.phone.unread.includes(id),
        evidenceId: message.evidenceId,
        evidenceRecorded: state.discovered.includes(message.evidenceId),
      };
    }),
);

// ---------------------------------------------------------------------------
// Candidate actions
// ---------------------------------------------------------------------------

/**
 * Actions that are likely to be accepted from `state`, in a fixed order. Used by property tests
 * and the guided completion policy. The list mirrors the reducer guards; a few entries may still
 * be rejected, but every accepted action family is covered. Not memoized (returns a new array).
 */
export function enumerateCandidateActions(
  state: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): CoreAction[] {
  if (state.status === "not-started") return [{ type: "START_CHAPTER" }];
  if (state.status === "finished") return [];
  if (state.outcome !== null) return [{ type: "FINISH_CHAPTER" }];

  const actions: CoreAction[] = [];
  const callCurrent = state.call.current;

  if (state.conversation !== null) {
    for (const option of availableOptions(state, scenario)) {
      actions.push({ type: "SELECT_DIALOGUE_OPTION", optionId: option.id });
    }
    if (callCurrent !== null) actions.push({ type: "END_CALL" });
  } else if (state.call.status === "ringing" && callCurrent !== null) {
    actions.push({ type: "ANSWER_CALL" });
    actions.push({ type: "END_CALL" });
  } else if (callCurrent !== null) {
    // An active call without a conversation can only be hung up.
    actions.push({ type: "END_CALL" });
  } else {
    // Idle: explore, inspect, ring, verify, decide.
    for (const id of Object.keys(scenario.interactables) as InteractableId[]) {
      if (scenario.interactables[id].produces.type === "INTERACT_OBJECT") {
        actions.push({ type: "INTERACT_OBJECT", objectId: id });
      }
    }
    for (const id of Object.keys(scenario.npcs) as NpcId[]) {
      actions.push({ type: "TALK_TO_NPC", npcId: id });
    }

    if (!scam1Answered(state)) {
      const rang = state.call.log.some((record) => record.callId === "call.scam-1");
      const reason = rang ? "re-ring" : state.interacted.length > 0 ? "first-interaction" : "exploration-timer";
      actions.push({ type: "RING_CALL", callId: "call.scam-1", reason });
    }
    if (
      scam1Ended(state) &&
      state.decision === null &&
      !state.call.log.some((record) => record.callId === "call.callback")
    ) {
      actions.push({ type: "RING_CALL", callId: "call.callback", reason: "callback" });
    }

    const callbackRecord = state.call.log.find((record) => record.callId === "call.callback");
    if (
      state.decision === null &&
      callbackRecord !== undefined &&
      (callbackRecord.status === "ended" || callbackRecord.status === "declined") &&
      !state.call.log.some((record) => record.callId === "call.followup")
    ) {
      actions.push({ type: "RING_CALL", callId: "call.followup", reason: "follow-up" });
    }

    if (
      state.decision === null &&
      state.flags.scam1_rang === true &&
      (state.discovered.includes("ev.bank-card") || state.discovered.includes("ev.bank-letter"))
    ) {
      const claimId =
        Object.values(scenario.decisions).find((def) => def.preStep?.method === "official-line")?.preStep
          ?.claimId ?? VERIFY_METHOD_CLAIM["official-line"];
      actions.push({ type: "VERIFY_CLAIM", claimId, method: "official-line" });
    }
    if (state.phone.open && !state.discovered.includes("ev.bank-app")) {
      actions.push({ type: "VERIFY_CLAIM", claimId: VERIFY_METHOD_CLAIM["bank-app"], method: "bank-app" });
    }

    if (state.decision === null) {
      for (const id of Object.keys(scenario.decisions) as DecisionId[]) {
        if (evaluateConditions(scenario.decisions[id].requires, state, scenario)) {
          actions.push({ type: "MAKE_DECISION", decision: id });
        }
      }
    }
  }

  // Evidence that can be inspected now (phone messages and call history). Not blocked by calls.
  for (const id of Object.keys(scenario.evidence) as EvidenceId[]) {
    if (scenario.evidence[id].discovery.via === "inspect" && canDiscover(state, id, "inspect", scenario)) {
      actions.push({ type: "INSPECT_EVIDENCE", evidenceId: id });
    }
  }

  for (const id of state.objectives.active as ObjectiveId[]) {
    if (canCompleteObjective(state, id, scenario)) actions.push({ type: "COMPLETE_OBJECTIVE", objectiveId: id });
  }

  if (!state.phone.open) actions.push({ type: "OPEN_PHONE" });
  else if (callCurrent === null) actions.push({ type: "CLOSE_PHONE" });

  return actions;
}

// Core and scenario types for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Data Models".

import type {
  ActId,
  CallId,
  ClaimId,
  DecisionId,
  DeductionId,
  DeviceActionId,
  DialogueGraphId,
  EvidenceId,
  FlagId,
  IncomingCallId,
  InteractableId,
  MessageId,
  NpcId,
  ObjectiveId,
  OutcomeId,
  SourceId,
  SpeakerId,
  Tone,
  VerifyMethod,
  WarningSignId,
} from "./chapter1/ids";
import type { ProvenanceTrust } from "@scammaze/shared-types";
import type { FatigueConfig, RestMode } from "./fatigue";
import type { ChapterInitialState, ChapterResources, PersistentFlagId, PersistentFlags, ResourceId } from "./resources";

// ---------------------------------------------------------------------------
// Core actions and results
// ---------------------------------------------------------------------------

export type RingReason = "first-interaction" | "exploration-timer" | "re-ring" | "callback" | "follow-up";
export type ThesisResearchNoteId = "saved-channel" | "classmate" | "sample-limit";

export type CoreAction =
  | { type: "START_CHAPTER" }
  | { type: "INTERACT_OBJECT"; objectId: InteractableId }
  | { type: "INSPECT_EVIDENCE"; evidenceId: EvidenceId }
  | { type: "OPEN_PHONE" }
  | { type: "CLOSE_PHONE" }
  | { type: "RING_CALL"; callId: IncomingCallId; reason: RingReason }
  | { type: "ANSWER_CALL" }
  /** Declines when ringing, hangs up when active. */
  | { type: "END_CALL" }
  | { type: "TALK_TO_NPC"; npcId: NpcId }
  | { type: "SELECT_DIALOGUE_OPTION"; optionId: string }
  | { type: "VERIFY_CLAIM"; claimId: ClaimId; method: VerifyMethod }
  | { type: "MAKE_DECISION"; decision: DecisionId }
  | { type: "COMPLETE_OBJECTIVE"; objectiveId: ObjectiveId }
  | { type: "FINISH_CHAPTER" }
  /** A laptop or phone action defined by `DeviceActionDef` (opens a record, inspects, compares). */
  | { type: "DEVICE_ACTION"; deviceActionId: DeviceActionId }
  /** Combines 2 to 3 unique evidence items into a deduction. Order does not matter. */
  | { type: "COMBINE_EVIDENCE"; evidenceIds: EvidenceId[] }
  /** Lets simulated time pass (free roam). Whole minutes, 1 to 4320. Scheduled events and deadlines run in time order. */
  | { type: "ADVANCE_TIME"; minutes: number }
  /** Works on the thesis for `minutes`. Optional `focusMode` engages the non-linear Warm-up -> Flow -> Burnout deep-work model. */
  | { type: "WORK_ON_THESIS"; minutes: number; focusMode?: "normal" | "deep" | "rush"; sessionElapsedMinutes?: number }
  /** Starts a core-owned work block; any interruption and remaining minutes are persisted in WorldState. */
  | { type: "START_THESIS_SESSION"; minutes: number; mode: "normal" | "deep" | "rush" }
  /** Continues the saved remainder of a paused work block. */
  | { type: "RESUME_THESIS_SESSION" }
  /** Ends a paused block without losing already committed work. */
  | { type: "END_THESIS_SESSION" }
  /** Stores manuscript text in replayable ChapterState for save/load and review validation. */
  | { type: "SAVE_THESIS_DRAFT"; sectionId: ThesisDraftSectionId; content: string }
  /** Rests: a short break or a night of sleep. Costs the time of the option and lowers fatigue. */
  | { type: "REST"; mode: RestMode }
  /** Answers a pending event with one of its responses: act on it, postpone it or ignore it. */
  | { type: "RESPOND_EVENT"; eventId: string; response: string }
  /** Completes one thesis task (optionally using a deliberate review approach). Costs its time and adds its progress. */
  | { type: "COMPLETE_THESIS_TASK"; taskId: string; approachId?: string; researchNotes?: ThesisResearchNoteId[] }
  /** Opens a message, email, listing, file or appointment on the phone or laptop. The first time it marks it read. Reading costs no time. */
  | { type: "OPEN_DEVICE_ITEM"; itemId: string }
  /** Uses one action of a device item: reply, pay, travel, apply, submit, call. Costs time and cash as the item says. */
  | { type: "USE_DEVICE_ITEM"; itemId: string; actionId: string };

export type CoreActionType = CoreAction["type"];

export interface ActionResult {
  state: ChapterState;
  accepted: boolean;
  /** Non-empty when `accepted` is false. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Chapter state
// ---------------------------------------------------------------------------

export type ChapterStatus = "not-started" | "playing" | "ended" | "finished";
export type CallStatus = "idle" | "ringing" | "active" | "declined" | "ended";
export type ClaimStatus = "unverified" | "supported" | "contradicted" | "inconclusive";
export type Stance = "supports" | "contradicts" | "inconclusive" | "needs-verification";
export type PressureLevel = 0 | 1 | 2 | 3;

export interface CallRecord {
  callId: CallId;
  direction: "incoming" | "outgoing";
  /** From Scenario_Data. */
  displayName: string;
  /** Fictional_Phone_Number, always starting with `+000`. */
  number: string;
  status: "ringing" | "answered" | "declined" | "missed" | "ended";
  ringCount: number;
}

export interface ConversationState {
  graphId: DialogueGraphId;
  nodeId: string;
  /** `null` for face-to-face conversations (Sam). */
  callId: CallId | null;
  history: Array<{ nodeId: string; optionId: string }>;
}

export interface ChapterState {
  chapterId: "chapter-1";
  status: ChapterStatus;
  objectives: { active: ObjectiveId[]; completed: ObjectiveId[] };
  /** Message IDs. */
  phone: { open: boolean; unread: MessageId[]; messages: MessageId[] };
  call: { current: CallId | null; status: CallStatus; log: CallRecord[] };
  conversation: ConversationState | null;
  conversationHistory: Array<{
    graphId: DialogueGraphId;
    history: ConversationState["history"];
    endNodeId: string | null;
  }>;
  npc: Record<NpcId, { timesTalked: number }>;
  interacted: InteractableId[];
  /** Discovery order, no duplicates. */
  discovered: EvidenceId[];
  claims: Record<ClaimId, ClaimStatus>;
  decision: DecisionId | null;
  /** Recorded deductions in recording order, no duplicates. */
  deductions: DeductionId[];
  flags: Record<FlagId, boolean>;
  /** Time, thesis progress, cash, digital security, support network and evidence value. */
  resources: ChapterResources;
  /** Event-level state that stays after a mission ends (account, backup, housing, identity, relationships). */
  persistent: PersistentFlags;
  /** Scheduled events and time-boxed missions (see `GameEventDef` and `MissionDef`). */
  world: WorldState;
  /** Phone and laptop content: what has arrived, what was read or done, the bank ledger, the location, the submission. */
  device: DeviceState;
  pressure: PressureLevel;
  outcome: OutcomeId | null;
  events: EventLogEntry[];
}

export type EventStatus = "pending" | "resolved" | "ignored" | "expired";
export interface EventState {
  status: EventStatus;
  /** Elapsed minutes at which the event arrived (its scheduled time when it has one). */
  firedAtMinute: number;
  resolvedAtMinute: number | null;
  /** How many times the player postponed it. */
  postponed: number;
  /** The response id that resolved or ignored it, or null. A postponement does not set it. */
  response: string | null;
}
export type MissionStatus = "locked" | "open" | "completed" | "failed";
export interface MissionState {
  status: MissionStatus;
  /** The current path, or null before the mission entered its first path. */
  path: string | null;
  /** Every path the mission has been on, in order. Paths already used do not apply their effects again. */
  pathHistory: string[];
  openedAtMinute: number | null;
  closedAtMinute: number | null;
}
export type ThesisDraftSectionId = "introduction" | "findings" | "full-draft";
export type ThesisInterruptionKind = "story_event" | "device_item" | "eye_strain" | "minh_ping" | "citation_gap";
export interface ThesisWorkInterruption {
  id: string;
  atSessionMinute: number;
  kind: ThesisInterruptionKind;
  urgent: boolean;
  title: { en: string; vi: string };
  body: { en: string; vi: string };
  appHint?: "email" | "chat" | "bank" | "phone";
}
export interface ThesisWorkSessionState {
  mode: "normal" | "deep" | "rush";
  plannedMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  interruption: ThesisWorkInterruption;
}
export interface WorldState {
  /** Only events that have arrived. */
  events: Record<string, EventState>;
  /** Thesis tasks the player completed, in order. */
  thesisTasksDone: string[];
  /** Sub-percent progress retained between work actions (1 unit = 0.001 percentage point). */
  thesisWorkRemainderUnits: number;
  /** Paused work block, persisted by action replay so closing the editor cannot erase its remainder. */
  thesisWorkSession: ThesisWorkSessionState | null;
  /** Saved manuscript sections are chapter state, not component-local text. */
  thesisDraft: Partial<Record<ThesisDraftSectionId, string>>;
  /** Every mission of the scenario. */
  missions: Record<string, MissionState>;
  /** Minutes slept since the last night check. Absent in old states (0). */
  sleptMinutes?: number;
  /** Night checks already made (see `FatigueConfig.nightChecksAtMinute`). Absent in old states (0). */
  nightsChecked?: number;
}
export type SubmissionStatus = "not-submitted" | "submitted";
export interface DeviceItemState {
  arrivedAtMinute: number;
  read: boolean;
  readAtMinute: number | null;
  /** Action ids used on this item, in order. */
  done: string[];
  /** Simulated minute at which each action finished (after its time cost). Absent in old states. */
  doneAt?: Record<string, number>;
}
/**
 * What a ledger line means for the finance summary: `loss` is money that left and is gone (a fee, an
 * unauthorized transfer), `locked` is money sent to a platform that keeps it. A line with no
 * category is ordinary spending. Each line is counted once, so the totals never double count.
 */
export type LedgerCategory = "loss" | "locked";

export interface LedgerEntry {
  /** 0-based, contiguous. */
  seq: number;
  /** Absent for ordinary spending and in old states. */
  category?: LedgerCategory;
  atMinute: number;
  /** Key into `ScenarioDefinition.ledgerLabels`, or an item action id. */
  label: string;
  /** Negative for money out, positive for money in, in VND. */
  amount: number;
  counterparty: string | null;
  itemId: string | null;
  actionId: string | null;
}
export interface DeviceState {
  items: Record<string, DeviceItemState>;
  ledger: LedgerEntry[];
  /** Id of the place Alex is at (from the map app), or null before any travel. */
  location: string | null;
  submission: SubmissionStatus;
}
export interface EventLogEntry {
  /** 0-based, contiguous. */
  seq: number;
  action: CoreAction;
  derived: {
    evidence: EvidenceId[];
    flags: FlagId[];
    /** Net change of each resource caused by this action. Only changed resources are listed. */
    resources: Partial<Record<ResourceId, number>>;
    /** Persistent flags whose value changed in this action. */
    persistent: PersistentFlagId[];
    objectivesActivated: ObjectiveId[];
    objectivesCompleted: ObjectiveId[];
    /** For example "shared-code", "challenged-number", "hung-up-to-verify". */
    debriefTags: string[];
  };
}

// ---------------------------------------------------------------------------
// Conditions, effects and discovery
// ---------------------------------------------------------------------------

export type Condition =
  | { kind: "hasEvidence"; evidenceId: EvidenceId }
  | { kind: "hasAnyEvidence"; evidenceIds: EvidenceId[] }
  | { kind: "flag"; flag: FlagId }
  | { kind: "notFlag"; flag: FlagId }
  | { kind: "callEnded"; callId: CallId }
  | { kind: "claimStatus"; claimId: ClaimId; status: ClaimStatus }
  /** A call log record exists for the call. */
  | { kind: "callRang"; callId: CallId }
  /** The call ended, was declined or was missed. */
  | { kind: "callClosed"; callId: CallId }
  /** The deduction is in `ChapterState.deductions`. */
  | { kind: "deductionRecorded"; deductionId: DeductionId }
  /** The recorded final decision equals `decision`. */
  | { kind: "decisionIs"; decision: DecisionId }
  | { kind: "objectiveCompleted"; objectiveId: ObjectiveId }
  | { kind: "outcomeSet" }
  /** At least `count` of the listed evidence items are discovered. */
  | { kind: "evidenceCountAtLeast"; evidenceIds: EvidenceId[]; count: number }
  | { kind: "resourceAtLeast"; resource: ResourceId; value: number }
  | { kind: "resourceAtMost"; resource: ResourceId; value: number }
  | { kind: "persistent"; flag: PersistentFlagId; value: boolean }
  /** At least `minutes` of the chapter have passed. */
  | { kind: "elapsedAtLeast"; minutes: number }
  | { kind: "eventStatus"; eventId: string; status: EventStatus | "not-arrived" }
  /** The event was resolved or ignored with this response id. */
  | { kind: "eventResponse"; eventId: string; response: string }
  | { kind: "missionStatus"; missionId: string; status: MissionStatus }
  | { kind: "missionPath"; missionId: string; path: string }
  /** The item has arrived on a device. */
  | { kind: "itemArrived"; itemId: string }
  /** The item was opened. */
  | { kind: "itemOpened"; itemId: string }
  /** The action was used on the item. */
  | { kind: "itemActionDone"; itemId: string; actionId: string }
  | { kind: "atLocation"; placeId: string }
  | { kind: "submission"; status: SubmissionStatus }
  | { kind: "thesisTaskDone"; taskId: string }
  /** At least one of the conditions holds. */
  | { kind: "anyOf"; conditions: Condition[] }
  /** Every one of the conditions holds. */
  | { kind: "allOf"; conditions: Condition[] }
  /** The condition does not hold. */
  | { kind: "not"; condition: Condition }
  /** The mission is open and has been open for at least `minutes` simulated minutes. */
  | { kind: "missionOpenFor"; missionId: string; minutes: number };

export type Effect =
  | { kind: "setFlag"; flag: FlagId }
  | { kind: "discoverEvidence"; evidenceId: EvidenceId }
  /** Adds pressure, capped at 3. Defaults to 1. */
  | { kind: "addPressure"; amount?: number }
  /** Allowed only in graphs with `independentChannel: true` (enforced by the validator). */
  | { kind: "setClaimStatus"; claimId: ClaimId; status: ClaimStatus }
  | { kind: "recordDecision"; decision: DecisionId }
  | { kind: "deliverMessage"; messageId: MessageId }
  /** Adds `delta` (may be negative) to a resource, clamped to the resource limits. */
  | { kind: "adjustResource"; resource: ResourceId; delta: number }
  /** Sets a persistent flag to `value`. */
  | { kind: "setPersistent"; flag: PersistentFlagId; value: boolean }
  /** Opens a locked mission now. Does nothing for an open, completed or failed mission. */
  | { kind: "openMission"; missionId: string }
  /** Locks an open mission. Does nothing once it is completed or failed. */
  | { kind: "lockMission"; missionId: string }
  /** Makes a device item arrive now (a new email, a reply, a listing). Does nothing if it already arrived. */
  | { kind: "deliverItem"; itemId: string }
  /** Moves money and adds a bank ledger line. `amount` is negative for money out. Cash may go below zero. */
  | { kind: "recordTransaction"; label: string; amount: number; counterparty?: string; limitToCash?: boolean; category?: LedgerCategory }
  | { kind: "setLocation"; placeId: string }
  | { kind: "setSubmission"; status: SubmissionStatus };

export type DiscoveryCondition =
  | { via: "interact"; objectId: InteractableId }
  | { via: "inspect"; requires: Condition[] }
  | { via: "dialogue-node"; nodeId: string }
  | { via: "verify"; method: VerifyMethod }
  /** Revealed by a device action that lists the item in its `reveals`. */
  | { via: "device"; deviceActionId: DeviceActionId };

export type DiscoveryVia = DiscoveryCondition["via"];

// ---------------------------------------------------------------------------
// Scenario content
// ---------------------------------------------------------------------------

export interface Claim {
  id: ClaimId;
  text: string;
}

/** Data-driven objective: text plus activation and completion predicates. */
export interface Objective {
  id: ObjectiveId;
  text: string;
  /** All conditions must hold for the objective to become active. */
  activateWhen: Condition[];
  /** All conditions must hold for the objective to complete. */
  completeWhen: Condition[];
  /** Optional hint, shown only when the player opens hints. */
  hint?: string;
}

export interface InteractableDef {
  id: InteractableId;
  /** Object name, for example "Your wallet on the café table". */
  label: string;
  /** Verb shown in the prompt, for example "check". */
  actionLabel: string;
  inspectionText: string;
  produces: { type: "INTERACT_OBJECT" } | { type: "TALK_TO_NPC"; npcId: NpcId };
  /** Evidence revealed directly by the interaction (empty for NPCs; their evidence comes from dialogue). */
  reveals: EvidenceId[];
}

export interface WarningSignDef {
  id: WarningSignId;
  label: string;
  description: string;
}

export interface EvidenceItem {
  id: EvidenceId;
  title: string;
  description: string;
  source: "physical" | "device" | "dialogue" | "npc" | "verification";
  location: string;
  discovery: DiscoveryCondition;
  relations: Array<{ claimId: ClaimId; stance: Stance; note: string }>;
  warningSigns: WarningSignId[];
  /** Provenance source the item claims to come from. */
  sourceId: SourceId;
  /** Educational relevance. */
  relevance: string;
  /** Shown in "clues missed" when not discovered. */
  debriefHint?: string;
}

/** Journal note shown once all listed evidence is discovered (for example the number mismatch). */
export interface JournalNote {
  id: string;
  requires: EvidenceId[];
  text: string;
}

export interface DialogueGraph {
  id: DialogueGraphId;
  persona: { speakerId: SpeakerId; name: string; role: string; honesty: "scammer" | "trusted" | "neutral" };
  channel: "phone" | "face-to-face";
  /** Only `dlg.official-line` is true. */
  independentChannel: boolean;
  startNodeId: string;
  startNodeWhen?: Array<{ when: Condition[]; nodeId: string }>;
  /** Approved line IDs → text. */
  lines: Record<string, string>;
  nodes: Record<string, DialogueNode>;
}

export interface DialogueNode {
  id: string;
  speaker: "caller" | "player" | "npc" | "system";
  lineId: string;
  pressure?: boolean;
  /** Required by the content validator on every Spoken_Node. */
  tone?: Tone;
  /** Overrides `graph.persona.speakerId` for this node. */
  speakerId?: SpeakerId;
  /** Presentation only, 0..3000. Delays audio start, not the caption. */
  pauseBeforeMs?: number;
  /** Presentation only. Holds the choice list until the voice line ends. */
  waitForVoice?: boolean;
  onEnter?: Effect[];
  options: DialogueOption[];
  end?: { kind: "hung-up" | "completed"; debriefTag?: string };
}

export interface DialogueOption {
  id: string;
  lineId: string;
  conditions?: Condition[];
  effects?: Effect[];
  next: string | { end: "hang-up" };
  debriefTag?: string;
}

export interface CallDef {
  id: CallId;
  direction: "incoming" | "outgoing";
  displayName: string;
  /** Fictional_Phone_Number, always starting with `+000`. */
  number: string;
  graphId: DialogueGraphId;
  /** The call rings when any inner list has all its conditions true (OR of ANDs). Empty for outgoing calls. */
  ringWhen: Condition[][];
}

export interface NpcDef {
  id: NpcId;
  name: string;
  interactableId: InteractableId;
  graphId: DialogueGraphId;
}

export interface PhoneMessage {
  id: MessageId;
  from: string;
  body: string;
  /** Evidence recorded when the player opens the message. */
  evidenceId: EvidenceId;
  /** True when the message is on the phone at chapter start; otherwise delivered by an effect. */
  deliveredAtStart: boolean;
}

export interface PhoneContent {
  messages: Record<MessageId, PhoneMessage>;
  contacts: Array<{ name: string; number: string }>;
  /** Official website as plain text (a reserved domain, never a link). */
  officialWebsite: string;
  bankApp: { title: string; screens: Array<{ id: string; title: string; body: string }> };
}

export interface DecisionDef {
  id: DecisionId;
  /** Panel label for the final decision. */
  label: string;
  /** All conditions must hold for MAKE_DECISION to be available. */
  requires: Condition[];
  /** Shown when the decision is unavailable. */
  unavailableHint: string;
  /** Optional verification step before the decision (the official-line call). */
  preStep?: {
    label: string;
    method: VerifyMethod;
    claimId: ClaimId;
    requires: Condition[];
    unavailableHint: string;
  };
  /** Effects applied when the decision is recorded (for example `money_moved`). */
  effects?: Effect[];
  debriefTag?: string;
}

/** Ending aftermath: what happens next on the phone and laptop, with closing narration. */
export interface Aftermath {
  /** Narrative consequence shown in the ending. */
  consequence: string;
  /** Phone aftermath text. */
  phone: string;
  /** Laptop aftermath text. */
  laptop: string;
  /** Summary of the evidence the player had. */
  evidenceSummary: string;
  /** Case report text. */
  caseReport: string;
  /** Spoken closing node IDs in `dlg.aftermath`, played in order. */
  narrationNodeIds: string[];
}

export interface EndingDef {
  id: OutcomeId;
  title: string;
  /** First variant whose conditions all hold is shown. The last variant should have no conditions. */
  variants: Array<{ id: string; when: Condition[]; text: string }>;
  /** "Simulation: nothing real happened." */
  simulationLabel: string;
  /** Extra conditions that must hold for this outcome. */
  unlockWhen?: Condition[];
  /** All conditions must hold for this ending to be selected. */
  selectWhen: Condition[];
  /** Selection priority: the lowest matching `order` wins. */
  order: number;
  /** Aftermath content for this ending. */
  aftermath: Aftermath;
}

export interface DebriefContent {
  /** What the scammer did. */
  mechanism: string;
  /** What the player can do instead. */
  saferAlternatives: string[];
  outcomeSummaries: Record<OutcomeId, string>;
  /** Debrief tag → decision note text. */
  decisionNotes: Record<string, string>;
  /** Text for the forensic analysis section of the debrief. */
  analysis: DebriefAnalysisContent;
}

/** Which of the two traps the player entered. `first` is the code request of the first caller. */
export type DebriefTrap = "none" | "first" | "second" | "both";

export interface DebriefAnalysisContent {
  /** How the first caller built pressure. */
  pressureBuilt: string;
  /** Why the laptop warning and the later call looked trustworthy. */
  whyWarningLooked: string;
  /** Why the third caller gave no independent evidence. */
  thirdCallerNote: string;
  /** Text per trap outcome. */
  trapNotes: Record<DebriefTrap, string>;
  /** How to verify a similar claim. */
  verifyNextTime: string[];
}

export interface ActDef {
  id: ActId;
  /** Translatable, key `acts/<id>/title`. */
  title: string;
  /** Monotonic: once true it stays true. */
  enterWhen: Condition[];
  /** Equals the next act's `enterWhen` (checked by the validator). */
  exitWhen: Condition[];
  /** Each objective belongs to exactly one act. */
  objectives: ObjectiveId[];
}

export type SourceIdentifierKey = "case" | "contact" | "domain" | "app" | "callerId";

/** Where a piece of evidence claims to come from. `trust` is authoring truth, shown only in the debrief. */
export interface SourceDef {
  id: SourceId;
  label: string;
  kind: "call" | "voicemail" | "notification" | "document" | "app" | "note" | "official-line" | "calendar";
  /** What the source says it is, for example "Northgate Bank security". */
  claimedOrigin: string;
  trust: ProvenanceTrust;
  identifiers: Array<{ key: SourceIdentifierKey; value: string }>;
}

/** What the validator checks between the input sources of a deduction. */
export type DeductionBasis =
  /** All input sources carry the same value for the key. */
  | { kind: "shared-identifier"; key: SourceIdentifierKey }
  /** The input sources carry different values for the key. */
  | { kind: "conflicting-identifier"; key: SourceIdentifierKey };

/** A reasoning step made by combining evidence. Effects: flags and `inconclusive` claim statuses only. */
export interface DeductionDef {
  id: DeductionId;
  /** All required. */
  inputs: EvidenceId[];
  /** Exactly one of these must also be present. */
  inputsAnyOf?: EvidenceId[];
  requires: Condition[];
  basis: DeductionBasis;
  /** For example "These claims are not independently verified." */
  statement: string;
  effects: Effect[];
  debriefTag: string;
}

/** An action on the laptop or the phone. Evidence is revealed only through `reveals`. */
export interface DeviceActionDef {
  id: DeviceActionId;
  device: "laptop" | "phone";
  label: string;
  requires: Condition[];
  effects: Effect[];
  reveals: EvidenceId[];
  /** When true the action is accepted once. */
  once: boolean;
  debriefTag?: string;
}

/** A scripted state change applied once, in order, when its conditions hold (for example the notification arrives). */
export interface BeatDef {
  id: string;
  when: Condition[];
  effects: Effect[];
}

/** When something starts: at a scheduled time, when conditions hold, or both (both must hold). */
export interface WorldTrigger {
  /** Minutes since the chapter started (Tuesday 17:00 is 0). */
  atMinute?: number;
  when?: Condition[];
  /**
   * Fires `minutes` after a device action finished, at exactly that minute (the ledger and the log
   * then show the scheduled time, not the time of the next action).
   */
  afterAction?: { itemId: string; actionId: string; minutes: number };
  /**
   * Device actions that stop the trigger when they finished at or before the minute it would fire.
   * An action that finishes later does not undo something that already happened.
   */
  cancelledBy?: { itemId: string; actionId: string }[];
}
/** One way to answer an event. Responses carry no score: the player reads the consequences. */
export interface EventResponseDef {
  id: string;
  label: string;
  /** `respond` resolves the event, `postpone` keeps it pending, `ignore` closes it without acting. */
  kind: "respond" | "postpone" | "ignore";
  requires?: Condition[];
  /** Simulated minutes this response takes. */
  timeCostMinutes?: number;
  effects?: Effect[];
}
export interface ThesisInterruptionMetadata {
  /** Routine notices may be suppressed by the player's deep-focus mode; urgent notices break through. */
  urgent: boolean;
  appHint?: "email" | "chat" | "bank" | "phone";
}

/** Something that happens to Alex while the clock runs: a message, call, offer or request. */
export interface GameEventDef {
  id: string;
  title: string;
  body: string;
  channel: "message" | "call" | "email" | "visit" | "notification";
  trigger: WorldTrigger;
  /** An optional event can be ignored with no effect on the main goal. */
  optional: boolean;
  /** True: the event resolves as soon as it arrives and waits for no answer (a consequence, such as a bank alert). */
  autoResolve?: boolean;
  /** Explicit work-session interruption policy; absence means the event does not interrupt writing. */
  thesisInterruption?: ThesisInterruptionMetadata;
  /** Minutes after it arrives before it expires while still pending. Omit for no expiry. */
  deadlineAfterMinutes?: number;
  onFire?: Effect[];
  onExpire?: Effect[];
  responses: EventResponseDef[];
}
/** A way a mission can play out. The first path whose `when` holds is the current path. */
/** Where a mission step happens in the room: the HUD marker points at this prop. */
export type MissionStepTarget = "laptop" | "phone";
/** The app on the target device that a step names ("Laptop · Mail"). `thesis` is the laptop's Thesis window. */
export type MissionStepApp = DeviceAppId | "thesis";
/**
 * One concrete step of a mission path, shown in the task tracker and the task list. Steps are
 * guidance only: they read state and never change it, and the mission still completes on its own
 * `completeWhen`. Labels stay neutral: a step never says whether a message is honest.
 */
export interface MissionStepDef {
  id: string;
  label: string;
  target?: MissionStepTarget;
  app?: MissionStepApp;
  /** Listed only while these hold (or once it is done). Defaults to always. */
  visibleWhen?: Condition[];
  /** Done while all hold. Without it the step stays open until the mission ends (a choice to make). */
  doneWhen?: Condition[];
  /** Listed, but never the current step: the player may skip it. */
  optional?: boolean;
}
export interface MissionPathDef {
  id: string;
  when: Condition[];
  /** Objective text shown while the mission is on this path. */
  objective: string;
  /** Applied the first time the mission enters this path. */
  onEnter?: Effect[];
  /** Concrete steps in order. The first visible, required step that is not done is the current one. */
  steps?: MissionStepDef[];
}
/** A time-boxed goal whose shape adapts to earlier decisions. Consequences are never reset. */
export interface MissionDef {
  id: string;
  title: string;
  optional: boolean;
  opensWhen: WorldTrigger;
  /** Minutes since the chapter started. Past it, an open mission fails. */
  deadlineAtMinute?: number;
  /** All must hold for the mission to complete. */
  completeWhen: Condition[];
  /** Paths in priority order. The last one should have no conditions. */
  paths: MissionPathDef[];
  onOpen?: Effect[];
  onComplete?: Effect[];
  /** Failing a mission is not game over: these effects can open an alternative mission. */
  onFail?: Effect[];
}
export type DeviceAppId = "mail" | "messages" | "contacts" | "bank" | "map" | "calendar" | "housing" | "jobs" | "files";
export type DeviceKind = "phone" | "laptop";
/** One thing a player can do with a device item. No score: the player reads the costs and decides. */
/** One line of a conversation on a contact: what Alex says or what the other side answers. */
export interface ConversationLine {
  speaker: "alex" | "other";
  text: string;
  /** Stable recording key when this line is voiced; absent lines remain subtitle-only. */
  voiceId?: string;
}

export interface DeviceItemActionDef {
  id: string;
  label: string;
  /**
   * Lines added to the conversation history of the item once this action is done (Alex's turn and
   * the answer). Time and effects belong to the action, so history, cost and state never disagree.
   */
  transcript?: ConversationLine[];
  requires?: Condition[];
  /** Simulated minutes the action takes. */
  timeCostMinutes?: number;
  /** VND taken from cash and written to the bank ledger. Rejected when cash is lower, unless `allowDebt`. */
  cashCost?: number;
  allowDebt?: boolean;
  /** Key into `ScenarioDefinition.ledgerLabels` for the ledger line. Defaults to this action. */
  ledgerLabel?: string;
  /** How the finance summary counts the cash this action takes (see `LedgerCategory`). */
  ledgerCategory?: LedgerCategory;
  counterparty?: string;
  /** Moves Alex to this place (map app). */
  moveTo?: string;
  /** Places this outgoing call (a key of `ScenarioDefinition.calls`). */
  callId?: string;
  /** The action can be used once. */
  once?: boolean;
  /** The action is listed only while these hold (a step of a page that appears after the one before). */
  visibleWhen?: Condition[];
  effects?: Effect[];
}
/**
 * The four kinds of money an online platform page tells apart:
 * `real` is Alex's cash in the bank (always read live), `shown` is the balance the page displays and
 * is not money, `withdrawable` is what can actually leave the platform, `locked` is money Alex sent
 * that the platform keeps.
 */
export type PlatformFigureKind = "real" | "shown" | "withdrawable" | "locked";

/** Figures of a platform page. The first block whose `when` holds is shown (a block with no `when` is the fallback). */
export interface PlatformFiguresDef {
  when?: Condition[];
  rows: Array<{ kind: PlatformFigureKind; amountVnd?: number }>;
}

/** An email, chat, contact, listing, file, place, appointment or payee on a device. */
export interface DeviceItemDef {
  id: string;
  app: DeviceAppId;
  /** Devices that show it. Defaults to the app's devices. */
  devices?: DeviceKind[];
  title: string;
  /** Sender, contact, place or listing name. Plain text, never a link. */
  from?: string;
  /** Address, number or another plain-text detail. Reserved domains only. */
  detail?: string;
  body: string;
  /** Mail folder (`university`, `recruitment`, `other`) or file folder. */
  folder?: string;
  /** When it arrives. Absent: it is there from the start. */
  arrives?: WorldTrigger;
  /** Explicit work-session interruption policy; absence means the item does not interrupt writing. */
  thesisInterruption?: ThesisInterruptionMetadata;
  /** Appointments: start and end, minutes since the chapter started. */
  startsAtMinute?: number;
  endsAtMinute?: number;
  /** Listings and payees: an amount in VND. */
  amount?: number;
  /** Applied the first time the item is opened. */
  onOpen?: Effect[];
  /** Money figures of a platform page (job or investment). Simulated amounts only. */
  figures?: PlatformFiguresDef[];
  actions?: DeviceItemActionDef[];
}
/** One way to handle a thesis review: how long it takes, what it gains and what it leaves behind. */
export interface ThesisApproachDef {
  id: string;
  label: string;
  description?: string;
  /** Simulated minutes. Falls back to the task's own time cost. */
  timeCostMinutes?: number;
  /** Percent added to the thesis progress. Falls back to the task's own gain. */
  progressGain?: number;
  effects?: Effect[];
}
/**
 * A piece of thesis work that moves the thesis forward by what it achieves, not by waiting. The brief
 * lists them: interviews, editing, document checks, the supervisor's confirmation and the final submission.
 * Each task can be done once. A task with `approaches` is resolved by choosing one of them.
 */
export interface ThesisTaskDef {
  id: string;
  label: string;
  description?: string;
  requires?: Condition[];
  /** Simulated minutes the task takes. */
  timeCostMinutes?: number;
  /** Percent added to the thesis progress. */
  progressGain: number;
  effects?: Effect[];
  /** Ways to handle the task. When present, `COMPLETE_THESIS_TASK` must name one. */
  approaches?: ThesisApproachDef[];
}
/** Pacing values the brief does not state. Placeholders, configurable per scenario. */
export interface GameplayConfig {
  /** Thesis work: this many minutes give 1 percent. */
  thesisMinutesPerPercent: number;
  /** Length of one "work on the thesis" session offered by the UI. */
  thesisSessionMinutes: number;
  /** Real milliseconds for one simulated minute while the player explores. */
  msPerGameMinute: number;
  /** Free thesis work (`WORK_ON_THESIS`) stops here. Further progress needs thesis tasks. */
  thesisFreeWorkMaxPercent: number;
  /** Simulated minutes added to the clock per tick. */
  tickMinutes: number;
  /** True when time passes by itself during free roam. Off for scenarios without a world clock. */
  clockRuns: boolean;
  /** Fatigue rules (`fatigue.ts`). Off unless the scenario enables them. */
  fatigue: FatigueConfig;
}
export interface ScenarioDefinition {
  id: "chapter-1";
  title: string;
  subtitle: string;
  /** Start resources and persistent flags. Defaults to `CHAPTER_1_INITIAL_STATE`. */
  initial?: ChapterInitialState;
  /** Scheduled events. Absent in scenarios without a world clock. */
  events?: GameEventDef[];
  /** Missions. Absent in scenarios without a world clock. */
  missions?: MissionDef[];
  /** Thesis tasks: progress by achievement. */
  thesisTasks?: ThesisTaskDef[];
  /** Phone and laptop content (email, chats, contacts, bank payees, places, appointments, listings, files). */
  deviceItems?: DeviceItemDef[];
  /** Ledger line texts by key, so bank lines can be translated. */
  ledgerLabels?: Record<string, string>;
  /** Overrides `DEFAULT_GAMEPLAY_CONFIG`. */
  gameplay?: Partial<Omit<GameplayConfig, "fatigue">> & { fatigue?: Partial<FatigueConfig> };
  objectives: Record<ObjectiveId, Objective>;
  interactables: Record<InteractableId, InteractableDef>;
  claims: Record<ClaimId, Claim>;
  evidence: Record<EvidenceId, EvidenceItem>;
  warningSigns: Record<WarningSignId, WarningSignDef>;
  journalNotes: JournalNote[];
  calls: Record<CallId, CallDef>;
  npcs: Record<NpcId, NpcDef>;
  dialogues: Record<DialogueGraphId, DialogueGraph>;
  phone: PhoneContent;
  decisions: Record<DecisionId, DecisionDef>;
  endings: Record<OutcomeId, EndingDef>;
  debrief: DebriefContent;
  acts: ActDef[];
  /** Provenance sources by ID. */
  sources: Record<SourceId, SourceDef>;
  /** Deductions by ID. */
  deductions: Record<DeductionId, DeductionDef>;
  /** Laptop and phone actions by ID. */
  deviceActions: Record<DeviceActionId, DeviceActionDef>;
  /** Scripted beats, applied once in order. */
  beats: BeatDef[];
}

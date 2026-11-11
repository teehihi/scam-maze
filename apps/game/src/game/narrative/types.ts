// Core and scenario types for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Data Models".

import type {
  CallId,
  ClaimId,
  DecisionId,
  DialogueGraphId,
  EvidenceId,
  FlagId,
  IncomingCallId,
  InteractableId,
  MessageId,
  NpcId,
  ObjectiveId,
  OutcomeId,
  VerifyMethod,
  WarningSignId,
} from "./chapter1/ids";

// ---------------------------------------------------------------------------
// Core actions and results
// ---------------------------------------------------------------------------

export type RingReason = "first-interaction" | "exploration-timer" | "re-ring" | "callback";

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
  | { type: "FINISH_CHAPTER" };

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
  flags: Record<FlagId, boolean>;
  pressure: PressureLevel;
  outcome: OutcomeId | null;
  events: EventLogEntry[];
}

export interface EventLogEntry {
  /** 0-based, contiguous. */
  seq: number;
  action: CoreAction;
  derived: {
    evidence: EvidenceId[];
    flags: FlagId[];
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
  | { kind: "claimStatus"; claimId: ClaimId; status: ClaimStatus };

export type Effect =
  | { kind: "setFlag"; flag: FlagId }
  | { kind: "discoverEvidence"; evidenceId: EvidenceId }
  /** Adds pressure, capped at 3. Defaults to 1. */
  | { kind: "addPressure"; amount?: number }
  /** Allowed only in graphs with `independentChannel: true` (enforced by the validator). */
  | { kind: "setClaimStatus"; claimId: ClaimId; status: ClaimStatus }
  | { kind: "recordDecision"; decision: DecisionId }
  | { kind: "deliverMessage"; messageId: MessageId };

export type DiscoveryCondition =
  | { via: "interact"; objectId: InteractableId }
  | { via: "inspect"; requires: Condition[] }
  | { via: "dialogue-node"; nodeId: string }
  | { via: "verify"; method: VerifyMethod };

export type DiscoveryVia = DiscoveryCondition["via"];

// ---------------------------------------------------------------------------
// Scenario content
// ---------------------------------------------------------------------------

export interface Claim {
  id: ClaimId;
  text: string;
}

/** Objective text. Activation and completion predicates live in `narrative/objectives.ts`. */
export interface Objective {
  id: ObjectiveId;
  text: string;
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
  persona: { name: string; role: string; honesty: "scammer" | "trusted" | "neutral" };
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
  debriefTag?: string;
}

export interface EndingDef {
  id: OutcomeId;
  title: string;
  /** First variant whose conditions all hold is shown. The last variant should have no conditions. */
  variants: Array<{ id: string; when: Condition[]; text: string }>;
  /** "Simulation: nothing real happened." */
  simulationLabel: string;
}

export interface DebriefContent {
  /** What the scammer did. */
  mechanism: string;
  /** What the player can do instead. */
  saferAlternatives: string[];
  outcomeSummaries: Record<OutcomeId, string>;
  /** Debrief tag → decision note text. */
  decisionNotes: Record<string, string>;
}

export interface ScenarioDefinition {
  id: "chapter-1";
  title: string;
  subtitle: string;
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
}

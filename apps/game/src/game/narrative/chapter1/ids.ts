// Chapter 1 "The Urgent Call": string-literal IDs.
// Each list is the single source of truth for its ID union, so the core can build
// initial records (claims, flags, NPCs) and the validator can check references.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.

export const OBJECTIVE_IDS = [
  "obj.look-around",
  "obj.answer-call",
  "obj.check-claims",
  "obj.decide",
  "obj.review",
] as const;
export type ObjectiveId = (typeof OBJECTIVE_IDS)[number];

export const INTERACTABLE_IDS = [
  "obj.wallet",
  "obj.mailbox",
  "obj.shop-poster",
  "obj.shopkeeper",
  "obj.notice-board",
] as const;
export type InteractableId = (typeof INTERACTABLE_IDS)[number];

export const EVIDENCE_IDS = [
  "ev.sms-alert",
  "ev.otp-sms",
  "ev.caller-number",
  "ev.bank-card",
  "ev.bank-letter",
  "ev.bank-app",
  "ev.shop-poster",
  "ev.community-alert",
  "ev.partial-info",
  "ev.sam-testimony",
  "ev.official-confirmation",
] as const;
export type EvidenceId = (typeof EVIDENCE_IDS)[number];

export const CLAIM_IDS = [
  "claim.caller-identity",
  "claim.account-suspended",
  "claim.code-needed",
  "claim.protected-account",
] as const;
export type ClaimId = (typeof CLAIM_IDS)[number];

export const CALL_IDS = ["call.scam-1", "call.callback", "call.official"] as const;
export type CallId = (typeof CALL_IDS)[number];

/** Calls that ring on the player's phone (RING_CALL). The official line is outgoing only. */
export type IncomingCallId = Exclude<CallId, "call.official">;

export const NPC_IDS = ["npc.sam"] as const;
export type NpcId = (typeof NPC_IDS)[number];

export const DIALOGUE_GRAPH_IDS = [
  "dlg.scam-call",
  "dlg.callback",
  "dlg.shopkeeper",
  "dlg.official-line",
] as const;
export type DialogueGraphId = (typeof DIALOGUE_GRAPH_IDS)[number];

export const MESSAGE_IDS = ["msg.sms-alert", "msg.otp-sms"] as const;
export type MessageId = (typeof MESSAGE_IDS)[number];

export const FLAG_IDS = [
  /** The first scam call has rung at least once (makes `ev.caller-number` available). */
  "scam1_rang",
  /** The scam call reached `scam.code-request` (makes `ev.otp-sms` available). */
  "otp_sent",
  /** The player read the one-time code to the caller. */
  "code_shared",
  /** The player moved money as the caller instructed. */
  "money_moved",
  /** The player ended the scam call to verify with the bank. */
  "scam1_hung_up_to_verify",
  /** The player challenged the caller about the number on the card. */
  "number_challenged",
  /** The official line locked the simulated account after the code was shared. */
  "account_locked",
] as const;
export type FlagId = (typeof FLAG_IDS)[number];

export const DECISION_IDS = ["follow-request", "verify-independently", "stop-and-wait"] as const;
export type DecisionId = (typeof DECISION_IDS)[number];

export const OUTCOME_IDS = ["verified", "risky", "uncertain"] as const;
export type OutcomeId = (typeof OUTCOME_IDS)[number];

export const WARNING_SIGN_IDS = [
  "ws.urgency",
  "ws.look-alike-link",
  "ws.code-request",
  "ws.unknown-number",
  "ws.move-money",
  "ws.partial-details",
  "ws.emotional-pressure",
] as const;
export type WarningSignId = (typeof WARNING_SIGN_IDS)[number];

export const VERIFY_METHODS = ["official-line", "bank-app"] as const;
export type VerifyMethod = (typeof VERIFY_METHODS)[number];

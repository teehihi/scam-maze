// Unit tests for the evidence registry: every discovery route, and duplicate and unavailable
// rejection (Requirements 11.3, 11.4, 11.5, 12.4, 12.5, 18.1).

import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type { EvidenceId, InteractableId } from "./chapter1/ids";
import { canDiscover, discover, evidenceForClaim } from "./evidence";
import { chapterReducer, createInitialState, REASONS } from "./reducer";
import type { ChapterState, CoreAction } from "./types";

function play(state: ChapterState, actions: readonly CoreAction[]): ChapterState {
  let current = state;
  for (const action of actions) {
    const result = chapterReducer(current, action);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    current = result.state;
  }
  return current;
}

const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
const inspect = (evidenceId: EvidenceId): CoreAction => ({ type: "INSPECT_EVIDENCE", evidenceId });
const started = (): ChapterState => play(createInitialState(), [{ type: "START_CHAPTER" }]);

/** Evidence IDs discovered by the last accepted action. */
const lastDerived = (state: ChapterState): EvidenceId[] => state.events.at(-1)?.derived.evidence ?? [];

describe("discovery routes", () => {
  it.each<[InteractableId, EvidenceId]>([
    ["obj.wallet", "ev.bank-card"],
    ["obj.mailbox", "ev.bank-letter"],
    ["obj.shop-poster", "ev.shop-poster"],
    ["obj.notice-board", "ev.community-alert"],
  ])("interact: %s reveals %s", (objectId, evidenceId) => {
    const state = play(started(), [{ type: "INTERACT_OBJECT", objectId }]);
    expect(state.discovered).toEqual([evidenceId]);
    expect(lastDerived(state)).toEqual([evidenceId]);
  });

  it("inspect: the urgent text is available from the start", () => {
    const state = play(started(), [inspect("ev.sms-alert")]);
    expect(state.discovered).toEqual(["ev.sms-alert"]);
  });

  it("inspect: the caller's number is available once the scam call has rung", () => {
    const state = play(started(), [
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "END_CALL" },
      inspect("ev.caller-number"),
    ]);
    expect(state.discovered).toEqual(["ev.caller-number"]);
  });

  it("inspect: the one-time-code text is available once the caller requested the code", () => {
    const state = play(started(), [
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "ANSWER_CALL" },
      option("opt.scam.open.yes-what"),
      option("opt.scam.code.hang-up"),
      inspect("ev.otp-sms"),
    ]);
    expect(state.discovered).toEqual(["ev.otp-sms"]);
    expect(state.phone.unread).toEqual(["msg.sms-alert"]);
  });

  it("dialogue-node: the caller's partial details at scam.knows-details", () => {
    const state = play(started(), [
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "ANSWER_CALL" },
      option("opt.scam.open.ask-proof"),
    ]);
    expect(state.discovered).toEqual(["ev.partial-info"]);
    expect(lastDerived(state)).toEqual(["ev.partial-info"]);
  });

  it("dialogue-node: Sam's story after the call", () => {
    const state = play(started(), [
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "ANSWER_CALL" },
      { type: "END_CALL" },
      { type: "TALK_TO_NPC", npcId: "npc.sam" },
      option("opt.sam.ask.yes-called"),
    ]);
    expect(state.discovered).toEqual(["ev.sam-testimony"]);
  });

  it("dialogue-node: the official confirmation on the official line", () => {
    const state = play(started(), [
      { type: "INTERACT_OBJECT", objectId: "obj.mailbox" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "END_CALL" },
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
    ]);
    expect(state.discovered).toEqual(["ev.bank-letter", "ev.official-confirmation"]);
    expect(lastDerived(state)).toEqual(["ev.official-confirmation"]);
    expect(state.claims["claim.caller-identity"]).toBe("contradicted");
  });

  it("verify: the bank app evidence through VERIFY_CLAIM bank-app", () => {
    const state = play(started(), [
      { type: "OPEN_PHONE" },
      { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" },
    ]);
    expect(state.discovered).toEqual(["ev.bank-app"]);
  });

  it("keeps discovery order", () => {
    const state = play(started(), [
      { type: "INTERACT_OBJECT", objectId: "obj.notice-board" },
      inspect("ev.sms-alert"),
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
    ]);
    expect(state.discovered).toEqual(["ev.community-alert", "ev.sms-alert", "ev.bank-card"]);
  });
});

describe("INSPECT_EVIDENCE rejection", () => {
  it.each<EvidenceId>([
    "ev.otp-sms",
    "ev.caller-number",
    "ev.bank-card",
    "ev.bank-app",
    "ev.partial-info",
    "ev.official-confirmation",
  ])('rejects %s with "Evidence not available yet." when its condition is not met', (evidenceId) => {
    const state = started();
    const result = chapterReducer(state, inspect(evidenceId));
    expect(result).toEqual({ state, accepted: false, reason: "Evidence not available yet." });
    expect(result.state).toBe(state);
  });

  it('rejects already discovered evidence with "Evidence already recorded." and keeps the state', () => {
    const read = play(started(), [inspect("ev.sms-alert")]);
    const result = chapterReducer(read, inspect("ev.sms-alert"));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("Evidence already recorded.");
    expect(result.state).toBe(read);

    const withCard = play(started(), [{ type: "INTERACT_OBJECT", objectId: "obj.wallet" }]);
    const again = chapterReducer(withCard, inspect("ev.bank-card"));
    expect(again.reason).toBe(REASONS.evidenceAlreadyRecorded);
    expect(again.state).toBe(withCard);
  });
});

describe("registry functions", () => {
  it("canDiscover checks the route, the trigger and the condition", () => {
    const state = started();
    const s = CHAPTER_1_SCENARIO;
    expect(canDiscover(state, "ev.sms-alert", "inspect", s)).toBe(true);
    expect(canDiscover(state, "ev.sms-alert", "interact", s)).toBe(false);
    expect(canDiscover(state, "ev.otp-sms", "inspect", s)).toBe(false);
    expect(canDiscover(state, "ev.bank-card", { via: "interact", objectId: "obj.wallet" }, s)).toBe(true);
    expect(canDiscover(state, "ev.bank-card", { via: "interact", objectId: "obj.mailbox" }, s)).toBe(false);
    expect(canDiscover(state, "ev.bank-card", "interact", s)).toBe(false);
    expect(canDiscover(state, "ev.bank-app", { via: "verify", method: "bank-app" }, s)).toBe(true);
    expect(canDiscover(state, "ev.bank-app", { via: "verify", method: "official-line" }, s)).toBe(false);
    expect(canDiscover(state, "ev.unknown" as EvidenceId, "inspect", s)).toBe(false);
    expect(canDiscover(discover(state, "ev.sms-alert"), "ev.sms-alert", "inspect", s)).toBe(false);
  });

  it("discover is an idempotent append that never mutates its input", () => {
    const state = started();
    const once = discover(state, "ev.bank-card");
    expect(once).not.toBe(state);
    expect(state.discovered).toEqual([]);
    expect(once.discovered).toEqual(["ev.bank-card"]);
    expect(discover(once, "ev.bank-card")).toBe(once);
  });

  it("evidenceForClaim returns only discovered evidence, in discovery order, with stances", () => {
    const state = play(started(), [
      { type: "INTERACT_OBJECT", objectId: "obj.notice-board" },
      { type: "INTERACT_OBJECT", objectId: "obj.shop-poster" },
    ]);
    const entries = evidenceForClaim(state, "claim.protected-account", CHAPTER_1_SCENARIO);
    expect(entries.map((entry) => [entry.evidence.id, entry.stance])).toEqual([
      ["ev.community-alert", "contradicts"],
      ["ev.shop-poster", "contradicts"],
    ]);
    expect(evidenceForClaim(state, "claim.caller-identity", CHAPTER_1_SCENARIO)).toEqual([]);
  });
});

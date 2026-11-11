// Unit tests for the chapter reducer: one transition test per Core_Action and every rejection
// reason named in the requirements (Requirements 5.3, 5.4, 5.9, 6.8, 8.6, 8.8, 9.6, 11.4, 11.5,
// 12.2, 12.3, 12.5, 13.4, 13.5, 13.8, 18.1).

import { describe, expect, it } from "vitest";

import { OPTION_NOT_AVAILABLE } from "./dialogueEngine";
import { OBJECTIVE_CONDITION_NOT_MET } from "./objectives";
import { chapterReducer, createInitialState, isCoreAction, REASONS } from "./reducer";
import type { ChapterState, CoreAction } from "./types";

/** Applies the actions in order and fails the test on the first rejection. */
function play(state: ChapterState, actions: readonly CoreAction[]): ChapterState {
  let current = state;
  for (const action of actions) {
    const result = chapterReducer(current, action);
    if (!result.accepted) {
      throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    }
    current = result.state;
  }
  return current;
}

/** Dispatches one action and expects a rejection with `reason` that leaves the state unchanged. */
function expectRejected(state: ChapterState, action: unknown, reason: string): void {
  const snapshot = JSON.stringify(state);
  const result = chapterReducer(state, action);
  expect(result.accepted).toBe(false);
  expect(result.reason).toBe(reason);
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(snapshot);
}

const START: CoreAction = { type: "START_CHAPTER" };
const RING_SCAM: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" };
const RE_RING_SCAM: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "re-ring" };
const RING_CALLBACK: CoreAction = { type: "RING_CALL", callId: "call.callback", reason: "callback" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const WALLET: CoreAction = { type: "INTERACT_OBJECT", objectId: "obj.wallet" };
const OFFICIAL: CoreAction = { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" };
const BANK_APP: CoreAction = { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" };
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

const started = (): ChapterState => play(createInitialState(), [START]);
/** Card found, scam call answered and ended right away to verify. */
const afterScamCall = (): ChapterState =>
  play(started(), [WALLET, RING_SCAM, ANSWER, option("opt.scam.open.verify")]);
/** Official line completed after the scam call; no Decision yet. */
const afterOfficialLine = (): ChapterState =>
  play(afterScamCall(), [
    OFFICIAL,
    option("opt.official.greeting.wait"),
    option("opt.official.agent.report"),
    option("opt.official.confirm.block"),
  ]);
const ended = (): ChapterState => play(afterScamCall(), [{ type: "MAKE_DECISION", decision: "stop-and-wait" }]);

describe("isCoreAction", () => {
  it("accepts every well-formed action with known IDs", () => {
    expect(isCoreAction(START)).toBe(true);
    expect(isCoreAction(WALLET)).toBe(true);
    expect(isCoreAction(RING_CALLBACK)).toBe(true);
    expect(isCoreAction(option("opt.scam.open.verify"))).toBe(true);
    expect(isCoreAction(OFFICIAL)).toBe(true);
    expect(isCoreAction({ type: "MAKE_DECISION", decision: "stop-and-wait" })).toBe(true);
    expect(isCoreAction({ type: "COMPLETE_OBJECTIVE", objectiveId: "obj.decide" })).toBe(true);
  });

  it("rejects unknown shapes and unknown IDs", () => {
    for (const value of [
      null,
      undefined,
      "START_CHAPTER",
      42,
      [],
      {},
      { type: "JUMP" },
      { type: "INTERACT_OBJECT", objectId: "obj.car" },
      { type: "INSPECT_EVIDENCE" },
      { type: "RING_CALL", callId: "call.official", reason: "callback" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "because" },
      { type: "TALK_TO_NPC", npcId: "npc.nobody" },
      { type: "SELECT_DIALOGUE_OPTION", optionId: "" },
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "guess" },
      { type: "MAKE_DECISION", decision: "panic" },
      { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.nothing" },
    ]) {
      expect(isCoreAction(value)).toBe(false);
    }
  });
});

describe("chapterReducer transitions", () => {
  it("creates an initial state with every claim unverified and every flag false", () => {
    const state = createInitialState();
    expect(state.status).toBe("not-started");
    expect(Object.values(state.claims).every((status) => status === "unverified")).toBe(true);
    expect(Object.values(state.flags).every((flag) => flag === false)).toBe(true);
    expect(state.pressure).toBe(0);
    expect(state.events).toEqual([]);
  });

  it("START_CHAPTER starts play, delivers the urgent text and logs one event", () => {
    const state = started();
    expect(state.status).toBe("playing");
    expect(state.phone.messages).toEqual(["msg.sms-alert"]);
    expect(state.phone.unread).toEqual(["msg.sms-alert"]);
    expect(state.objectives.active).toEqual(["obj.look-around"]);
    expect(Object.values(state.claims).every((status) => status === "unverified")).toBe(true);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]).toMatchObject({ seq: 0, action: START });
  });

  it("does not mutate the input state", () => {
    const before = started();
    const snapshot = JSON.stringify(before);
    const result = chapterReducer(before, WALLET);
    expect(result.accepted).toBe(true);
    expect(result.state).not.toBe(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("INTERACT_OBJECT records the object and its evidence once", () => {
    const once = play(started(), [WALLET]);
    expect(once.interacted).toEqual(["obj.wallet"]);
    expect(once.discovered).toEqual(["ev.bank-card"]);
    expect(once.events[1].derived.evidence).toEqual(["ev.bank-card"]);
    const twice = play(once, [WALLET]);
    expect(twice.interacted).toEqual(["obj.wallet"]);
    expect(twice.discovered).toEqual(["ev.bank-card"]);
    expect(twice.events).toHaveLength(3);
    expect(twice.events[2].derived.evidence).toEqual([]);
  });

  it("INSPECT_EVIDENCE discovers the message evidence and marks the message read", () => {
    const state = play(started(), [{ type: "INSPECT_EVIDENCE", evidenceId: "ev.sms-alert" }]);
    expect(state.discovered).toEqual(["ev.sms-alert"]);
    expect(state.phone.unread).toEqual([]);
    expect(state.phone.messages).toEqual(["msg.sms-alert"]);
  });

  it("OPEN_PHONE and CLOSE_PHONE toggle the phone", () => {
    const open = play(started(), [{ type: "OPEN_PHONE" }]);
    expect(open.phone.open).toBe(true);
    const closed = play(open, [{ type: "CLOSE_PHONE" }]);
    expect(closed.phone.open).toBe(false);
  });

  it("RING_CALL rings the scam call and records it in the call log", () => {
    const state = play(started(), [RING_SCAM]);
    expect(state.call.current).toBe("call.scam-1");
    expect(state.call.status).toBe("ringing");
    expect(state.flags.scam1_rang).toBe(true);
    expect(state.call.log).toEqual([
      {
        callId: "call.scam-1",
        direction: "incoming",
        displayName: "Northgate Bank Security",
        number: "+000 555 0142",
        status: "ringing",
        ringCount: 1,
      },
    ]);
  });

  it("END_CALL declines a ringing call, and the scam call can ring again", () => {
    const declined = play(started(), [RING_SCAM, END_CALL]);
    expect(declined.call.current).toBeNull();
    expect(declined.call.status).toBe("declined");
    expect(declined.call.log[0].status).toBe("declined");
    expect(declined.conversation).toBeNull();

    const reRung = play(declined, [RE_RING_SCAM, END_CALL, RE_RING_SCAM]);
    expect(reRung.call.log).toHaveLength(1);
    expect(reRung.call.log[0]).toMatchObject({ status: "ringing", ringCount: 3 });
  });

  it("ANSWER_CALL starts the scam conversation linked to the call", () => {
    const state = play(started(), [RING_SCAM, ANSWER]);
    expect(state.call.status).toBe("active");
    expect(state.call.log[0].status).toBe("answered");
    expect(state.conversation).toEqual({
      graphId: "dlg.scam-call",
      nodeId: "scam.open",
      callId: "call.scam-1",
      history: [],
    });
  });

  it("END_CALL hangs up an active call, archives the conversation and records hung-up", () => {
    const state = play(started(), [RING_SCAM, ANSWER, END_CALL]);
    expect(state.call.current).toBeNull();
    expect(state.call.status).toBe("ended");
    expect(state.call.log[0].status).toBe("ended");
    expect(state.conversation).toBeNull();
    expect(state.conversationHistory).toEqual([{ graphId: "dlg.scam-call", history: [], endNodeId: null }]);
    expect(state.events.at(-1)?.derived.debriefTags).toEqual(["hung-up"]);
  });

  it("TALK_TO_NPC starts Sam's conversation and counts the talk", () => {
    const state = play(started(), [{ type: "TALK_TO_NPC", npcId: "npc.sam" }]);
    expect(state.npc["npc.sam"].timesTalked).toBe(1);
    expect(state.conversation).toMatchObject({ graphId: "dlg.shopkeeper", callId: null });
  });

  it("SELECT_DIALOGUE_OPTION applies effects, ends the call at an end node and records tags", () => {
    const state = afterScamCall();
    expect(state.flags.scam1_hung_up_to_verify).toBe(true);
    expect(state.conversation).toBeNull();
    expect(state.call.status).toBe("ended");
    expect(state.conversationHistory[0]).toEqual({
      graphId: "dlg.scam-call",
      history: [{ nodeId: "scam.open", optionId: "opt.scam.open.verify" }],
      endNodeId: "scam.end.verify",
    });
    expect(state.events.at(-1)?.derived.debriefTags).toEqual(["hung-up-to-verify"]);
  });

  it("VERIFY_CLAIM official-line starts the official line as an outgoing call", () => {
    const state = play(afterScamCall(), [OFFICIAL]);
    expect(state.call.current).toBe("call.official");
    expect(state.call.status).toBe("active");
    expect(state.call.log.at(-1)).toMatchObject({
      callId: "call.official",
      direction: "outgoing",
      number: "+000 555 0100",
      status: "answered",
    });
    expect(state.conversation).toMatchObject({
      graphId: "dlg.official-line",
      nodeId: "official.greeting",
      callId: "call.official",
    });
  });

  it("the official line confirmation contradicts the caller identity claim", () => {
    const state = afterOfficialLine();
    expect(state.discovered).toContain("ev.official-confirmation");
    expect(state.claims["claim.caller-identity"]).toBe("contradicted");
    expect(state.call.current).toBeNull();
  });

  it("VERIFY_CLAIM bank-app discovers the app evidence and sets the claim to inconclusive", () => {
    const state = play(started(), [{ type: "OPEN_PHONE" }, BANK_APP]);
    expect(state.discovered).toEqual(["ev.bank-app"]);
    expect(state.claims["claim.account-suspended"]).toBe("inconclusive");
  });

  it("VERIFY_CLAIM bank-app keeps a contradicted status from the official line", () => {
    const state = play(afterOfficialLine(), [{ type: "OPEN_PHONE" }, BANK_APP]);
    expect(state.claims["claim.account-suspended"]).toBe("contradicted");
  });

  it("MAKE_DECISION records the decision and sets the outcome", () => {
    const state = play(afterOfficialLine(), [{ type: "MAKE_DECISION", decision: "verify-independently" }]);
    expect(state.decision).toBe("verify-independently");
    expect(state.outcome).toBe("verified");
    expect(state.status).toBe("ended");
    expect(state.events.at(-1)?.derived.debriefTags).toEqual(["chose-verify-independently"]);
  });

  it("MAKE_DECISION follow-request from the panel sets money_moved", () => {
    const state = play(afterScamCall(), [{ type: "MAKE_DECISION", decision: "follow-request" }]);
    expect(state.flags.money_moved).toBe(true);
    expect(state.outcome).toBe("risky");
  });

  it("FINISH_CHAPTER finishes an ended chapter and completes the review objective", () => {
    const state = play(ended(), [{ type: "FINISH_CHAPTER" }]);
    expect(state.status).toBe("finished");
    expect(state.objectives.completed).toContain("obj.review");
  });

  it("appends one contiguous Event_Log entry per accepted action", () => {
    const state = afterOfficialLine();
    expect(state.events.map((entry) => entry.seq)).toEqual(state.events.map((_, i) => i));
  });
});

describe("chapterReducer rejection reasons", () => {
  it('rejects malformed values with "Unknown action."', () => {
    expect(REASONS.unknownAction).toBe("Unknown action.");
    for (const value of [null, {}, { type: "JUMP" }, { type: "INTERACT_OBJECT", objectId: "obj.car" }]) {
      expectRejected(started(), value, "Unknown action.");
    }
  });

  it("rejects gameplay actions before START_CHAPTER, and a second START_CHAPTER", () => {
    const initial = createInitialState();
    expectRejected(initial, WALLET, REASONS.notStarted);
    expectRejected(initial, { type: "OPEN_PHONE" }, REASONS.notStarted);
    expectRejected(initial, RING_SCAM, REASONS.notStarted);
    expectRejected(initial, { type: "FINISH_CHAPTER" }, REASONS.chapterNotEnded);
    expectRejected(started(), START, REASONS.alreadyStarted);
  });

  it("rejects INTERACT_OBJECT on an NPC object", () => {
    expectRejected(started(), { type: "INTERACT_OBJECT", objectId: "obj.shopkeeper" }, REASONS.wrongObjectAction);
  });

  it("rejects world actions while a call rings or a conversation runs", () => {
    const ringing = play(started(), [{ type: "OPEN_PHONE" }, RING_SCAM]);
    expectRejected(ringing, WALLET, REASONS.callInProgress);
    expectRejected(ringing, { type: "TALK_TO_NPC", npcId: "npc.sam" }, REASONS.callInProgress);
    expectRejected(ringing, { type: "CLOSE_PHONE" }, REASONS.callInProgress);
    expectRejected(ringing, BANK_APP, REASONS.callInProgress);

    const talking = play(started(), [{ type: "TALK_TO_NPC", npcId: "npc.sam" }]);
    expectRejected(talking, WALLET, REASONS.conversationInProgress);
    expectRejected(talking, { type: "TALK_TO_NPC", npcId: "npc.sam" }, REASONS.conversationInProgress);
    expectRejected(talking, RING_SCAM, REASONS.conversationInProgress);
  });

  it("rejects INSPECT_EVIDENCE for unavailable and already recorded evidence", () => {
    expectRejected(started(), { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" }, "Evidence not available yet.");
    const read = play(started(), [{ type: "INSPECT_EVIDENCE", evidenceId: "ev.sms-alert" }]);
    expectRejected(read, { type: "INSPECT_EVIDENCE", evidenceId: "ev.sms-alert" }, "Evidence already recorded.");
  });

  it("rejects opening an open phone and closing a closed phone", () => {
    expectRejected(play(started(), [{ type: "OPEN_PHONE" }]), { type: "OPEN_PHONE" }, REASONS.phoneAlreadyOpen);
    expectRejected(started(), { type: "CLOSE_PHONE" }, REASONS.phoneAlreadyClosed);
  });

  it("rejects RING_CALL while ringing, during a call, and after the scam call was answered", () => {
    const ringing = play(started(), [RING_SCAM]);
    expectRejected(ringing, RE_RING_SCAM, REASONS.callAlreadyRinging);
    const active = play(ringing, [ANSWER]);
    expectRejected(active, RE_RING_SCAM, REASONS.callInProgress);
    expectRejected(afterScamCall(), RE_RING_SCAM, REASONS.scamCallAlreadyAnswered);
  });

  it("rejects the callback before the scam call ended after being answered", () => {
    expectRejected(started(), RING_CALLBACK, REASONS.callbackNotYet);
    expectRejected(play(started(), [RING_SCAM, END_CALL]), RING_CALLBACK, REASONS.callbackNotYet);
  });

  it("rejects the callback once it has rung (Requirement 8.6)", () => {
    const rang = play(afterScamCall(), [RING_CALLBACK]);
    expect(rang.call.current).toBe("call.callback");
    const declined = play(rang, [END_CALL]);
    expectRejected(declined, RING_CALLBACK, REASONS.callbackAlreadyRang);
    const answered = play(afterScamCall(), [RING_CALLBACK, ANSWER, option("opt.callback.open.hang-up")]);
    expectRejected(answered, RING_CALLBACK, REASONS.callbackAlreadyRang);
  });

  it('rejects ANSWER_CALL with "No call is ringing." and END_CALL with no call', () => {
    expectRejected(started(), ANSWER, "No call is ringing.");
    expectRejected(play(started(), [RING_SCAM, ANSWER]), ANSWER, "No call is ringing.");
    expectRejected(started(), END_CALL, REASONS.noCallToEnd);
  });

  it('rejects an unavailable dialogue option with "Option not available."', () => {
    expect(OPTION_NOT_AVAILABLE).toBe("Option not available.");
    expectRejected(started(), option("opt.scam.open.verify"), "Option not available.");
    const inCall = play(started(), [RING_SCAM, ANSWER]);
    expectRejected(inCall, option("opt.official.agent.report"), "Option not available.");
  });

  it("rejects VERIFY_CLAIM official-line without the official number, before the call, and during a call", () => {
    expectRejected(play(started(), [RING_SCAM, END_CALL]), OFFICIAL, "You need the bank's official number first.");
    expectRejected(play(started(), [WALLET]), OFFICIAL, REASONS.noCallToVerify);
    expectRejected(play(started(), [WALLET, RING_SCAM]), OFFICIAL, REASONS.callInProgress);
    const talking = play(started(), [WALLET, RING_SCAM, END_CALL, { type: "TALK_TO_NPC", npcId: "npc.sam" }]);
    expectRejected(talking, OFFICIAL, REASONS.conversationInProgress);
  });

  it("rejects VERIFY_CLAIM bank-app with the phone closed, and a repeat", () => {
    expectRejected(started(), BANK_APP, REASONS.phoneClosed);
    const checked = play(started(), [{ type: "OPEN_PHONE" }, BANK_APP]);
    expectRejected(checked, BANK_APP, REASONS.evidenceAlreadyRecorded);
  });

  it("rejects verify-independently before the official confirmation (Requirement 13.4)", () => {
    const result = chapterReducer(afterScamCall(), { type: "MAKE_DECISION", decision: "verify-independently" });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("Call Northgate on the official number first.");
  });

  it('rejects MAKE_DECISION when a Decision exists with "A decision has already been made."', () => {
    // A reachable Decision always sets the Outcome, so the outcome lock answers first in play.
    // This crafted state checks the guard itself.
    const decided: ChapterState = { ...afterOfficialLine(), decision: "stop-and-wait" };
    expectRejected(decided, { type: "MAKE_DECISION", decision: "verify-independently" }, "A decision has already been made.");
    expectRejected(decided, OFFICIAL, REASONS.decisionAlreadyMade);
    expectRejected(decided, RING_CALLBACK, REASONS.decisionAlreadyMade);
  });

  it("rejects MAKE_DECISION during a conversation or a ringing call", () => {
    const inCall = play(afterScamCall(), [OFFICIAL]);
    expectRejected(inCall, { type: "MAKE_DECISION", decision: "stop-and-wait" }, REASONS.conversationInProgress);
    const ringing = play(afterScamCall(), [RING_CALLBACK]);
    expectRejected(ringing, { type: "MAKE_DECISION", decision: "stop-and-wait" }, REASONS.callInProgress);
  });

  it('rejects COMPLETE_OBJECTIVE with "Objective condition not met."', () => {
    expect(OBJECTIVE_CONDITION_NOT_MET).toBe("Objective condition not met.");
    expectRejected(started(), { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.look-around" }, "Objective condition not met.");
    expectRejected(started(), { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.decide" }, "Objective condition not met.");
    expectRejected(afterScamCall(), { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.check-claims" }, "Objective condition not met.");
  });

  it("accepts COMPLETE_OBJECTIVE when the objective is active and its condition holds", () => {
    // Crafted: the claim-related evidence is present but the manager has not run since.
    const base = afterScamCall();
    const crafted: ChapterState = { ...base, discovered: [...base.discovered, "ev.shop-poster"] };
    const result = chapterReducer(crafted, { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.check-claims" });
    expect(result.accepted).toBe(true);
    expect(result.state.objectives.completed).toContain("obj.check-claims");
    expect(result.state.objectives.active).not.toContain("obj.check-claims");
    expect(result.state.events.at(-1)?.derived.objectivesCompleted).toEqual(["obj.check-claims"]);
  });

  it("rejects FINISH_CHAPTER before the Outcome and after finishing", () => {
    expectRejected(afterScamCall(), { type: "FINISH_CHAPTER" }, REASONS.chapterNotEnded);
    const finished = play(ended(), [{ type: "FINISH_CHAPTER" }]);
    expectRejected(finished, { type: "FINISH_CHAPTER" }, REASONS.chapterAlreadyFinished);
  });

  it("rejects every action except FINISH_CHAPTER once the Outcome is set (Requirement 5.9)", () => {
    const state = ended();
    expect(state.outcome).toBe("uncertain");
    const actions: CoreAction[] = [
      START,
      WALLET,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
      { type: "OPEN_PHONE" },
      RING_CALLBACK,
      ANSWER,
      END_CALL,
      { type: "TALK_TO_NPC", npcId: "npc.sam" },
      option("opt.sam.ask.bye"),
      OFFICIAL,
      { type: "MAKE_DECISION", decision: "verify-independently" },
      { type: "COMPLETE_OBJECTIVE", objectiveId: "obj.review" },
    ];
    for (const action of actions) expectRejected(state, action, REASONS.chapterEnded);
    expect(chapterReducer(state, { type: "FINISH_CHAPTER" }).accepted).toBe(true);
  });
});

// Unit tests for the objective manager: the objective order through a full run, and phone
// neutrality (Requirements 6.1-6.9, 18.1).

import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type { ObjectiveId } from "./chapter1/ids";
import {
  canCompleteObjective,
  claimRelatedEvidenceCount,
  OBJECTIVE_NEUTRAL_ACTIONS,
  runObjectiveManager,
} from "./objectives";
import { chapterReducer, createInitialState } from "./reducer";
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

/** Objective changes per event, as "+id" for activation and "-id" for completion. */
function objectiveTimeline(state: ChapterState): string[][] {
  return state.events.map((entry) => [
    ...entry.derived.objectivesActivated.map((id) => `+${id}`),
    ...entry.derived.objectivesCompleted.map((id) => `-${id}`),
  ]);
}

const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

describe("objective order", () => {
  it("follows what the player did through a verified run", () => {
    const actions: CoreAction[] = [
      { type: "START_CHAPTER" },
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      { type: "ANSWER_CALL" },
      option("opt.scam.open.verify"),
      { type: "INTERACT_OBJECT", objectId: "obj.shop-poster" },
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.block"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      { type: "FINISH_CHAPTER" },
    ];
    const state = play(createInitialState(), actions);

    expect(objectiveTimeline(state)).toEqual([
      ["+obj.look-around"],
      ["-obj.look-around"],
      ["+obj.answer-call"],
      ["-obj.answer-call"],
      ["+obj.check-claims", "+obj.decide", "+obj.call-bank"],
      ["-obj.check-claims"],
      [],
      [],
      ["+obj.file-report", "-obj.call-bank"],
      [],
      ["+obj.review", "-obj.decide"],
      ["-obj.review"],
    ]);
    expect(state.objectives.active).toEqual(["obj.file-report"]);
    expect(state.objectives.completed).toEqual([
      "obj.look-around",
      "obj.answer-call",
      "obj.check-claims",
      "obj.decide",
      "obj.review",
      "obj.call-bank",
    ]);
  });

  it("activates the ringing objective on RING_CALL even before any interaction", () => {
    const state = play(createInitialState(), [
      { type: "START_CHAPTER" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
    ]);
    expect(state.objectives.active).toEqual(["obj.look-around", "obj.answer-call"]);
  });

  it("does not activate the check and decide objectives when the call is only declined", () => {
    const state = play(createInitialState(), [
      { type: "START_CHAPTER" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "END_CALL" },
    ]);
    expect(state.objectives.active).toEqual(["obj.look-around", "obj.answer-call"]);
  });

  it("completes the check objective with two claim-related items, not counting the urgent text", () => {
    const afterCall = play(createInitialState(), [
      { type: "START_CHAPTER" },
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.sms-alert" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "ANSWER_CALL" },
      option("opt.scam.open.verify"),
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
    ]);
    expect(claimRelatedEvidenceCount(afterCall, CHAPTER_1_SCENARIO)).toBe(1);
    expect(afterCall.objectives.active).toContain("obj.check-claims");

    const checked = play(afterCall, [{ type: "INTERACT_OBJECT", objectId: "obj.notice-board" }]);
    expect(claimRelatedEvidenceCount(checked, CHAPTER_1_SCENARIO)).toBe(2);
    expect(checked.objectives.completed).toContain("obj.check-claims");
  });

  it("activates and completes the decision objective when money moves inside the call", () => {
    const state = play(createInitialState(), [
      { type: "START_CHAPTER" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "ANSWER_CALL" },
      option("opt.scam.open.yes-what"),
      option("opt.scam.code.read-code"),
      option("opt.scam.move.move-money"),
    ]);
    expect(state.objectives.completed).toContain("obj.decide");
    expect(state.objectives.active).toContain("obj.review");
  });
});

describe("phone neutrality (Requirement 6.9)", () => {
  it("lists only OPEN_PHONE and CLOSE_PHONE as neutral actions", () => {
    expect([...OBJECTIVE_NEUTRAL_ACTIONS].sort()).toEqual(["CLOSE_PHONE", "OPEN_PHONE"]);
  });

  it("never changes objectives on OPEN_PHONE or CLOSE_PHONE in play", () => {
    let state = play(createInitialState(), [
      { type: "START_CHAPTER" },
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
    ]);
    for (const action of [{ type: "OPEN_PHONE" }, { type: "CLOSE_PHONE" }] as CoreAction[]) {
      const result = chapterReducer(state, action);
      expect(result.accepted).toBe(true);
      expect(result.state.objectives).toBe(state.objectives);
      expect(result.state.events.at(-1)?.derived.objectivesActivated).toEqual([]);
      expect(result.state.events.at(-1)?.derived.objectivesCompleted).toEqual([]);
      state = result.state;
    }
  });

  it("ignores phone actions even when another objective predicate would hold", () => {
    // Crafted pair: `next` has an interaction, which would complete "Look around your street."
    const prev = play(createInitialState(), [{ type: "START_CHAPTER" }]);
    const next: ChapterState = { ...prev, interacted: ["obj.wallet"] };
    for (const action of [{ type: "OPEN_PHONE" }, { type: "CLOSE_PHONE" }] as CoreAction[]) {
      const result = runObjectiveManager(prev, next, action, CHAPTER_1_SCENARIO);
      expect(result.state).toBe(next);
      expect(result.activated).toEqual([]);
      expect(result.completed).toEqual([]);
    }
    const counted = runObjectiveManager(prev, next, { type: "INTERACT_OBJECT", objectId: "obj.wallet" });
    expect(counted.completed).toEqual(["obj.look-around"]);
  });
});

describe("canCompleteObjective", () => {
  it("requires the objective to be active", () => {
    const state = play(createInitialState(), [{ type: "START_CHAPTER" }]);
    const crafted: ChapterState = { ...state, interacted: ["obj.wallet"] };
    expect(canCompleteObjective(crafted, "obj.look-around")).toBe(true);
    const inactive: ObjectiveId[] = ["obj.answer-call", "obj.check-claims", "obj.decide", "obj.review"];
    for (const id of inactive) expect(canCompleteObjective(crafted, id)).toBe(false);
  });
});

describe("call-bank, hold-firm and file-report objectives", () => {
  const afterVerifyCall = (): ChapterState =>
    play(createInitialState(), [
      { type: "START_CHAPTER" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "ANSWER_CALL" },
      option("opt.scam.open.verify"),
    ]);

  it("activates call-bank when the scam call ends after being answered, not when only declined", () => {
    expect(afterVerifyCall().objectives.active).toContain("obj.call-bank");
    const declined = play(createInitialState(), [
      { type: "START_CHAPTER" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      { type: "END_CALL" },
    ]);
    expect(declined.objectives.active).not.toContain("obj.call-bank");
  });

  it("completes call-bank only when the official confirmation is discovered", () => {
    const state = afterVerifyCall();
    expect(canCompleteObjective(state, "obj.call-bank")).toBe(false);
    const confirmed: ChapterState = { ...state, discovered: [...state.discovered, "ev.official-confirmation"] };
    expect(canCompleteObjective(confirmed, "obj.call-bank")).toBe(true);
  });

  it("activates hold-firm when the callback has a log record and completes it when the call is closed", () => {
    const before = afterVerifyCall();
    expect(before.objectives.active).not.toContain("obj.hold-firm");
    const ringing = play(before, [{ type: "RING_CALL", callId: "call.callback", reason: "callback" }]);
    expect(ringing.objectives.active).toContain("obj.hold-firm");
    expect(canCompleteObjective(ringing, "obj.hold-firm")).toBe(false);
    const closed = play(ringing, [{ type: "END_CALL" }]);
    expect(closed.objectives.completed).toContain("obj.hold-firm");
    expect(closed.objectives.active).not.toContain("obj.hold-firm");
  });

  it("does not complete hold-firm after a code was shared or money moved", () => {
    const ringing = play(afterVerifyCall(), [{ type: "RING_CALL", callId: "call.callback", reason: "callback" }]);
    const closedLog = ringing.call.log.map((record) =>
      record.callId === "call.callback" ? { ...record, status: "ended" as const } : record,
    );
    const closedState: ChapterState = { ...ringing, call: { ...ringing.call, current: null, log: closedLog } };
    expect(canCompleteObjective(closedState, "obj.hold-firm")).toBe(true);
    for (const flag of ["code_shared", "money_moved"] as const) {
      const risky: ChapterState = { ...closedState, flags: { ...closedState.flags, [flag]: true } };
      expect(canCompleteObjective(risky, "obj.hold-firm")).toBe(false);
    }
  });

  it("activates file-report with the official confirmation and completes it with the report_filed flag", () => {
    const base = afterVerifyCall();
    expect(base.objectives.active).not.toContain("obj.file-report");
    const prev = base;
    const next: ChapterState = { ...base, discovered: [...base.discovered, "ev.official-confirmation"] };
    const activated = runObjectiveManager(prev, next, { type: "INSPECT_EVIDENCE", evidenceId: "ev.official-confirmation" });
    expect(activated.activated).toContain("obj.file-report");
    expect(canCompleteObjective(activated.state, "obj.file-report")).toBe(false);
    const filed: ChapterState = { ...activated.state, flags: { ...activated.state.flags, report_filed: true } };
    expect(canCompleteObjective(filed, "obj.file-report")).toBe(true);
  });
});
// Unit tests for the follow-up ring (`call.followup`): its three guards, the `followup_rang` flag,
// the hang-up debrief tag and the evidence that appears after the ring (Requirements 2.5, 10.7).

import { describe, expect, it } from "vitest";

import { chapterReducer, createInitialState, REASONS } from "./reducer";
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
function expectRejected(state: ChapterState, action: CoreAction, reason: string): void {
  const snapshot = JSON.stringify(state);
  const result = chapterReducer(state, action);
  expect(result.accepted).toBe(false);
  expect(result.reason).toBe(reason);
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(snapshot);
}

const START: CoreAction = { type: "START_CHAPTER" };
const WALLET: CoreAction = { type: "INTERACT_OBJECT", objectId: "obj.wallet" };
const RING_SCAM: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" };
const RING_CALLBACK: CoreAction = { type: "RING_CALL", callId: "call.callback", reason: "callback" };
const RING_FOLLOWUP: CoreAction = { type: "RING_CALL", callId: "call.followup", reason: "follow-up" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

/** First call ended by verifying, callback not rung yet. */
const afterScamCall = (): ChapterState =>
  play(createInitialState(), [START, WALLET, RING_SCAM, ANSWER, option("opt.scam.open.verify")]);
/** Callback rung, answered and hung up: the callback call is closed. */
const afterCallback = (): ChapterState =>
  play(afterScamCall(), [RING_CALLBACK, ANSWER, option("opt.callback.open.hang-up")]);

describe("RING_CALL for call.followup", () => {
  it("is rejected before the callback call has closed", () => {
    expectRejected(afterScamCall(), RING_FOLLOWUP, REASONS.followupNotYet);
    // A callback that is still ringing or in progress is not closed either.
    const ringing = play(afterScamCall(), [RING_CALLBACK]);
    expect(chapterReducer(ringing, RING_FOLLOWUP).accepted).toBe(false);
  });

  it("is rejected after a decision was made", () => {
    // A state with a decision but no outcome reaches the ring guard (same approach as reducer.test.ts).
    const decided: ChapterState = { ...afterCallback(), decision: "stop-and-wait" };
    expectRejected(decided, RING_FOLLOWUP, REASONS.decisionAlreadyMade);
    // After a real decision the outcome lock rejects every action first.
    const finished = play(afterCallback(), [{ type: "MAKE_DECISION", decision: "stop-and-wait" }]);
    expectRejected(finished, RING_FOLLOWUP, REASONS.chapterEnded);
  });

  it("is rejected when the follow-up call already rang", () => {
    const declined = play(afterCallback(), [RING_FOLLOWUP, END_CALL]);
    expectRejected(declined, RING_FOLLOWUP, REASONS.followupAlreadyRang);
    const hungUp = play(afterCallback(), [RING_FOLLOWUP, ANSWER, END_CALL]);
    expectRejected(hungUp, RING_FOLLOWUP, REASONS.followupAlreadyRang);
  });

  it("is accepted once the callback closed, and sets the followup_rang flag", () => {
    const before = afterCallback();
    expect(before.flags.followup_rang).not.toBe(true);
    const result = chapterReducer(before, RING_FOLLOWUP);
    expect(result.accepted).toBe(true);
    expect(result.state.call.current).toBe("call.followup");
    expect(result.state.call.status).toBe("ringing");
    expect(result.state.flags.followup_rang).toBe(true);
    const last = result.state.events[result.state.events.length - 1];
    expect(last.derived.flags).toContain("followup_rang");
  });

  it("is accepted when the callback was declined", () => {
    const declined = play(afterScamCall(), [RING_CALLBACK, END_CALL]);
    expect(chapterReducer(declined, RING_FOLLOWUP).accepted).toBe(true);
  });
});

describe("hanging up the follow-up call", () => {
  it("records the hung-up-on-followup debrief tag", () => {
    const answered = play(afterCallback(), [RING_FOLLOWUP, ANSWER]);
    const result = chapterReducer(answered, END_CALL);
    expect(result.accepted).toBe(true);
    const last = result.state.events[result.state.events.length - 1];
    expect(last.derived.debriefTags).toEqual(["hung-up-on-followup"]);
    expect(result.state.call.current).toBeNull();
    expect(result.state.call.status).toBe("ended");
  });
});

describe("ev.second-number", () => {
  it("cannot be inspected before the follow-up call rings", () => {
    const state = afterCallback();
    const result = chapterReducer(state, { type: "INSPECT_EVIDENCE", evidenceId: "ev.second-number" });
    expect(result.accepted).toBe(false);
    expect(result.state.discovered).not.toContain("ev.second-number");
  });

  it("can be inspected after the ring", () => {
    const rang = play(afterCallback(), [RING_FOLLOWUP, END_CALL]);
    const result = chapterReducer(rang, { type: "INSPECT_EVIDENCE", evidenceId: "ev.second-number" });
    expect(result.accepted).toBe(true);
    expect(result.state.discovered).toContain("ev.second-number");
  });
});

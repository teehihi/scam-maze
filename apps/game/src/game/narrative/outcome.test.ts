// Unit tests for the outcome function, the consequence variants and decision gating
// (Requirements 13.4-13.10, 18.1).

import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import type { DecisionId, FlagId } from "./chapter1/ids";
import { selectConsequenceVariant, selectOutcome } from "./outcome";
import { chapterReducer, createInitialState, REASONS } from "./reducer";
import type { ChapterState, ClaimStatus, CoreAction } from "./types";

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
const decide = (decision: DecisionId): CoreAction => ({ type: "MAKE_DECISION", decision });
const RING: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" };
const OFFICIAL: CoreAction = { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" };
const OFFICIAL_TO_CONFIRM: CoreAction[] = [
  OFFICIAL,
  option("opt.official.greeting.wait"),
  option("opt.official.agent.report"),
];

const started = (): ChapterState => play(createInitialState(), [{ type: "START_CHAPTER" }]);
/** Card found, scam call answered and ended to verify; no flags beyond the ring. */
const afterScamCall = (): ChapterState =>
  play(started(), [
    { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
    RING,
    { type: "ANSWER_CALL" },
    option("opt.scam.open.verify"),
  ]);
/** Card found, code read to the caller, then the player hung up at the guilt node. */
const afterCodeShared = (): ChapterState =>
  play(started(), [
    { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
    RING,
    { type: "ANSWER_CALL" },
    option("opt.scam.open.yes-what"),
    option("opt.scam.code.read-code"),
    option("opt.scam.move.stop"),
    option("opt.scam.guilt.hang-up"),
  ]);

/** Crafted state for the pure outcome function. */
function crafted(
  decision: DecisionId | null,
  flags: FlagId[],
  identity: ClaimStatus = "unverified",
): ChapterState {
  const base = createInitialState();
  const next: ChapterState = {
    ...base,
    decision,
    flags: { ...base.flags },
    claims: { ...base.claims, "claim.caller-identity": identity },
  };
  for (const flag of flags) next.flags[flag] = true;
  return next;
}

describe("selectOutcome (Requirements 13.7, 13.9, 13.10)", () => {
  it("returns null without a Decision, even with a risky flag", () => {
    expect(selectOutcome(crafted(null, []))).toBeNull();
    expect(selectOutcome(crafted(null, ["code_shared"]))).toBeNull();
    expect(selectOutcome(crafted(null, ["money_moved"], "contradicted"))).toBeNull();
  });

  it("returns risky for any Decision with code_shared or money_moved", () => {
    for (const decision of ["follow-request", "verify-independently", "stop-and-wait"] as DecisionId[]) {
      expect(selectOutcome(crafted(decision, ["code_shared"], "contradicted"))).toBe("risky");
      expect(selectOutcome(crafted(decision, ["money_moved"]))).toBe("risky");
    }
  });

  it("returns verified for verify-independently with the identity claim contradicted", () => {
    expect(selectOutcome(crafted("verify-independently", [], "contradicted"))).toBe("verified");
    expect(selectOutcome(crafted("verify-independently", [], "inconclusive"))).toBeNull();
  });

  it("returns uncertain for stop-and-wait without a risky flag", () => {
    expect(selectOutcome(crafted("stop-and-wait", []))).toBe("uncertain");
    expect(selectOutcome(crafted("stop-and-wait", ["number_challenged"], "contradicted"))).toBe("uncertain");
  });
});

describe("consequence variants through play", () => {
  it("verified: official line, then verify-independently", () => {
    const state = play(afterScamCall(), [...OFFICIAL_TO_CONFIRM, option("opt.official.confirm.block"), decide("verify-independently")]);
    expect(state.outcome).toBe("verified");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("verified.reported");
  });

  it("risky.money-moved: money moved inside the scam call", () => {
    const state = play(started(), [
      RING,
      { type: "ANSWER_CALL" },
      option("opt.scam.open.yes-what"),
      option("opt.scam.code.read-code"),
      option("opt.scam.move.move-money"),
    ]);
    expect(state.decision).toBe("follow-request");
    expect(state.outcome).toBe("risky");
    expect(state.status).toBe("ended");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("risky.money-moved");
  });

  it("risky.money-moved: follow-request from the decision panel (Requirement 13.8)", () => {
    const state = play(afterScamCall(), [decide("follow-request")]);
    expect(state.flags.money_moved).toBe(true);
    expect(state.outcome).toBe("risky");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("risky.money-moved");
  });

  it("risky.code-shared-locked: code shared, then reported on the official line", () => {
    const state = play(afterCodeShared(), [
      ...OFFICIAL_TO_CONFIRM,
      option("opt.official.confirm.code-shared"),
      option("opt.official.locked.block"),
      decide("verify-independently"),
    ]);
    expect(state.flags.account_locked).toBe(true);
    expect(state.claims["claim.caller-identity"]).toBe("contradicted");
    expect(state.outcome).toBe("risky");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("risky.code-shared-locked");
  });

  it("risky.code-shared: code shared and never reported", () => {
    const state = play(afterCodeShared(), [decide("stop-and-wait")]);
    expect(state.outcome).toBe("risky");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("risky.code-shared");
  });

  it("uncertain: decline, re-ring, hang up, stop-and-wait", () => {
    const state = play(started(), [
      RING,
      { type: "END_CALL" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "re-ring" },
      { type: "ANSWER_CALL" },
      { type: "END_CALL" },
      decide("stop-and-wait"),
    ]);
    expect(state.outcome).toBe("uncertain");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("uncertain.stopped");
  });

  it("returns no variant without an Outcome", () => {
    expect(selectConsequenceVariant(afterScamCall(), CHAPTER_1_SCENARIO)).toBeNull();
  });

  it("sets the Outcome on every accepted MAKE_DECISION (Requirement 13.6)", () => {
    for (const decision of ["follow-request", "stop-and-wait"] as DecisionId[]) {
      const state = play(afterScamCall(), [decide(decision)]);
      expect(state.outcome).toBe(selectOutcome(state));
      expect(state.outcome).not.toBeNull();
    }
  });
});

describe("decision gating", () => {
  it("rejects follow-request and stop-and-wait before the first call ends", () => {
    const state = play(started(), [RING, { type: "END_CALL" }]);
    for (const decision of ["follow-request", "stop-and-wait"] as DecisionId[]) {
      const result = chapterReducer(state, decide(decision));
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("This option is available after the first call ends.");
      expect(result.state).toBe(state);
    }
  });

  it("rejects verify-independently until the official confirmation is discovered (Requirement 13.4)", () => {
    const state = afterScamCall();
    const result = chapterReducer(state, decide("verify-independently"));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("Call Northgate on the official number first.");
    expect(result.state).toBe(state);
    expect(state.outcome).toBeNull();
  });

  it("rejects MAKE_DECISION during the official call, before the call is finished", () => {
    const inCall = play(afterScamCall(), OFFICIAL_TO_CONFIRM);
    expect(inCall.discovered).toContain("ev.official-confirmation");
    const result = chapterReducer(inCall, decide("verify-independently"));
    expect(result.reason).toBe(REASONS.conversationInProgress);
  });

  it("rejects a second decision once the Outcome is set", () => {
    const state = play(afterScamCall(), [decide("stop-and-wait")]);
    const result = chapterReducer(state, decide("follow-request"));
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe(REASONS.chapterEnded);
    expect(result.state).toBe(state);
  });
});

// Saved paths still replay (chapter-01-voice-narrative, task 20.5; Requirements 13.4, 13.7).
// The four action logs of `playthroughs.test.ts` are copied here as frozen fixtures. Content stayed
// append-only, so each log must still be fully accepted by the current scenario with no trimming.
//
// Module boundary: files under `game/narrative/` may not import `game/saves/`. The replay below
// therefore uses `chapterReducer` directly, which is the exact loop `restoreProgress` runs
// (`game/saves/chapterProgress.ts`): replay from `createInitialState`, stop at the first rejected
// action. "Restored with trimmed: false" is checked as "every action accepted, none dropped".

import { describe, expect, it } from "vitest";

import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction } from "../types";
import { CHAPTER_1_SCENARIO } from "./scenario";

const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

const START: CoreAction = { type: "START_CHAPTER" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const OPEN_PHONE: CoreAction = { type: "OPEN_PHONE" };
const CLOSE_PHONE: CoreAction = { type: "CLOSE_PHONE" };
const FINISH: CoreAction = { type: "FINISH_CHAPTER" };

interface SavedPath {
  readonly name: string;
  readonly outcome: "verified" | "risky" | "uncertain";
  readonly actions: readonly CoreAction[];
}

/** Frozen copies of the action logs in `playthroughs.test.ts`. Do not edit when content changes. */
const SAVED_PATHS: readonly SavedPath[] = [
  {
    name: "verified: contradiction chain, then the official line",
    outcome: "verified",
    actions: [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      ANSWER,
      option("opt.scam.open.ask-proof"),
      option("opt.scam.knows.challenge"),
      option("opt.scam.challenged.call-card"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
      { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" },
      CLOSE_PHONE,
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.block"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ],
  },
  {
    name: "risky: the code is shared and money is moved during the call",
    outcome: "risky",
    actions: [
      START,
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      ANSWER,
      option("opt.scam.open.yes-what"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
      option("opt.scam.code.read-code"),
      option("opt.scam.move.move-money"),
      FINISH,
    ],
  },
  {
    name: "risky: the code is shared, then reported on the official line (account locked)",
    outcome: "risky",
    actions: [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.mailbox" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      ANSWER,
      option("opt.scam.open.yes-what"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
      option("opt.scam.code.read-code"),
      option("opt.scam.move.stop"),
      option("opt.scam.guilt.hang-up"),
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.code-shared"),
      option("opt.official.locked.block"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ],
  },
  {
    name: "uncertain: decline, re-ring, hang up, then stop and wait",
    outcome: "uncertain",
    actions: [
      START,
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      END_CALL,
      { type: "RING_CALL", callId: "call.scam-1", reason: "re-ring" },
      ANSWER,
      END_CALL,
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
      CLOSE_PHONE,
      { type: "MAKE_DECISION", decision: "stop-and-wait" },
      FINISH,
    ],
  },
];

/** Same loop as `restoreProgress`: replay in order and stop at the first rejected action. */
function replay(actions: readonly CoreAction[]): { state: ChapterState; acceptedActions: number } {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  let acceptedActions = 0;
  for (const action of actions) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    if (!result.accepted) break;
    state = result.state;
    acceptedActions += 1;
  }
  return { state, acceptedActions };
}

describe("saved Chapter 1 paths still replay", () => {
  it("keeps four frozen action logs", () => {
    expect(SAVED_PATHS).toHaveLength(4);
  });

  for (const path of SAVED_PATHS) {
    it(`${path.name}: fully accepted, nothing trimmed`, () => {
      const { state, acceptedActions } = replay(path.actions);
      const trimmed = acceptedActions < path.actions.length;
      expect(trimmed).toBe(false);
      expect(acceptedActions).toBe(path.actions.length);
      expect(state.events).toHaveLength(path.actions.length);
      expect(state.status).toBe("finished");
      expect(state.outcome).toBe(path.outcome);
    });
  }
});

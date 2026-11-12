import { describe, expect, it } from "vitest";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import type { ChapterState, CoreAction } from "../narrative/types";
import { STREET_PLAY_BOUNDS } from "../scenes/MainMenuScene/streetPlayArea";
import { encodeProgress, RESTORE_REASONS, restoreProgress } from "./chapterProgress";
import { SAVE_MAX_ACTIONS, START_CHECKPOINT_ID, type ChapterProgressV2 } from "./saveGame";

const IN_BOUNDS: [number, number, number] = [188.6, -92.7, -88.89];

/** START_CHAPTER followed by alternating OPEN_PHONE / CLOSE_PHONE, all accepted by the core. */
function acceptedActions(count: number): CoreAction[] {
  const actions: CoreAction[] = [{ type: "START_CHAPTER" }];
  while (actions.length < count) {
    actions.push(actions.length % 2 === 1 ? { type: "OPEN_PHONE" } : { type: "CLOSE_PHONE" });
  }
  return actions.slice(0, count);
}

function replay(actions: readonly CoreAction[]): ChapterState {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  for (const action of actions) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    if (!result.accepted) throw new Error(`Test setup action rejected: ${action.type}`);
    state = result.state;
  }
  return state;
}

function progress(overrides: Partial<ChapterProgressV2> = {}): ChapterProgressV2 {
  return {
    checkpointId: START_CHECKPOINT_ID,
    actions: acceptedActions(3),
    playerPose: { position: IN_BOUNDS, yaw: 1 },
    ...overrides,
  };
}

describe("encodeProgress", () => {
  it("stores the accepted actions from the Event_Log and the checkpoint ID", () => {
    const actions = acceptedActions(3);
    const encoded = encodeProgress(replay(actions), { position: IN_BOUNDS, yaw: 0.5 }, "obj.test");
    expect(encoded).toEqual({ checkpointId: "obj.test", actions, playerPose: { position: IN_BOUNDS, yaw: 0.5 } });
  });

  it("clamps an out-of-bounds pose and stores a non-finite pose as null", () => {
    const state = replay(acceptedActions(1));
    const far = encodeProgress(state, { position: [1000, -500, -1000], yaw: 0 }, "start");
    expect(far?.playerPose?.position).toEqual([STREET_PLAY_BOUNDS.maxX, STREET_PLAY_BOUNDS.groundY, STREET_PLAY_BOUNDS.minZ]);
    expect(encodeProgress(state, { position: [Number.NaN, 0, 0], yaw: 0 }, "start")?.playerPose).toBeNull();
  });

  it("accepts exactly the cap and returns null above it", () => {
    expect(encodeProgress(replay(acceptedActions(SAVE_MAX_ACTIONS)), null, "start")?.actions).toHaveLength(
      SAVE_MAX_ACTIONS,
    );
    expect(encodeProgress(replay(acceptedActions(SAVE_MAX_ACTIONS + 1)), null, "start")).toBeNull();
  });
});

describe("encodeProgress shape", () => {
  it("has exactly checkpointId, actions and playerPose (no audio, duration, caption or locale)", () => {
    const encoded = encodeProgress(replay(acceptedActions(3)), { position: IN_BOUNDS, yaw: 0 }, "start");
    expect(Object.keys(encoded ?? {}).sort()).toEqual(["actions", "checkpointId", "playerPose"]);
    const json = JSON.stringify(encoded);
    for (const word of ["audio", "duration", "caption", "locale"]) expect(json).not.toContain(word);
  });
});

const opt = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
const START: CoreAction = { type: "START_CHAPTER" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const OPEN_PHONE: CoreAction = { type: "OPEN_PHONE" };
const CLOSE_PHONE: CoreAction = { type: "CLOSE_PHONE" };
const FINISH: CoreAction = { type: "FINISH_CHAPTER" };

/** Frozen copies of the four action logs in `playthroughs.test.ts`. Do not edit when content changes. */
const FROZEN_LOGS: ReadonlyArray<readonly [string, readonly CoreAction[]]> = [
  [
    "verified",
    [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      ANSWER,
      opt("opt.scam.open.ask-proof"),
      opt("opt.scam.knows.challenge"),
      opt("opt.scam.challenged.call-card"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
      { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" },
      CLOSE_PHONE,
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      opt("opt.official.greeting.wait"),
      opt("opt.official.agent.report"),
      opt("opt.official.confirm.block"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ],
  ],
  [
    "risky: money moved",
    [
      START,
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      ANSWER,
      opt("opt.scam.open.yes-what"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
      opt("opt.scam.code.read-code"),
      opt("opt.scam.move.move-money"),
      FINISH,
    ],
  ],
  [
    "risky: code shared then reported",
    [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.mailbox" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      ANSWER,
      opt("opt.scam.open.yes-what"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
      opt("opt.scam.code.read-code"),
      opt("opt.scam.move.stop"),
      opt("opt.scam.guilt.hang-up"),
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      opt("opt.official.greeting.wait"),
      opt("opt.official.agent.report"),
      opt("opt.official.confirm.code-shared"),
      opt("opt.official.locked.block"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ],
  ],
  [
    "uncertain",
    [
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
  ],
];

describe("restoreProgress (lenient)", () => {
  const lenient = (p: ChapterProgressV2) => restoreProgress(p, CHAPTER_1_SCENARIO, { lenient: true });

  it("returns the accepted prefix with trimmed true and acceptedActions", () => {
    // START_CHAPTER, OPEN_PHONE, then a second OPEN_PHONE (rejected) and one more action after it.
    const tampered = [...acceptedActions(2), { type: "OPEN_PHONE" } as CoreAction, { type: "CLOSE_PHONE" } as CoreAction];
    const result = lenient(progress({ actions: tampered }));
    expect(result).toEqual({
      ok: true,
      state: replay(acceptedActions(2)),
      pose: { position: IN_BOUNDS, yaw: 1 },
      trimmed: true,
      acceptedActions: 2,
    });
  });

  it("returns trimmed false when every action is accepted", () => {
    const result = lenient(progress());
    expect(result.ok && result.trimmed).toBe(false);
    expect(result.ok && result.acceptedActions).toBe(3);
  });

  it("returns the initial state with zero accepted actions when the first action is rejected", () => {
    const result = lenient(progress({ actions: [{ type: "OPEN_PHONE" }] }));
    expect(result).toMatchObject({ ok: true, trimmed: true, acceptedActions: 0 });
    expect(result.ok && result.state).toEqual(createInitialState(CHAPTER_1_SCENARIO));
  });

  it("keeps too many actions and a non-finite pose as hard failures", () => {
    expect(lenient(progress({ actions: acceptedActions(SAVE_MAX_ACTIONS + 1) }))).toEqual({
      ok: false,
      reason: RESTORE_REASONS.tooManyActions,
    });
    expect(lenient(progress({ playerPose: { position: [Number.NaN, 0, 0], yaw: 0 } }))).toEqual({
      ok: false,
      reason: RESTORE_REASONS.invalidPose,
    });
  });

  it.each(FROZEN_LOGS)("restores the frozen %s playthrough log with trimmed false", (_name, actions) => {
    const result = lenient(progress({ actions: [...actions], playerPose: null }));
    expect(result).toMatchObject({ ok: true, trimmed: false, acceptedActions: actions.length });
    expect(result.ok && result.state.status).toBe("finished");
  });
});

describe("restoreProgress", () => {
  it("replays valid progress to the same state", () => {
    const result = restoreProgress(progress(), CHAPTER_1_SCENARIO);
    expect(result).toEqual({ ok: true, state: replay(acceptedActions(3)), pose: { position: IN_BOUNDS, yaw: 1 } });
  });

  it("returns a null pose unchanged", () => {
    const result = restoreProgress(progress({ playerPose: null }));
    expect(result.ok && result.pose).toBeNull();
  });

  it.each([
    ["NaN x", { position: [Number.NaN, -92.7, 0] as [number, number, number], yaw: 0 }],
    ["Infinity z", { position: [188, -92.7, Number.POSITIVE_INFINITY] as [number, number, number], yaw: 0 }],
    ["non-finite yaw", { position: IN_BOUNDS, yaw: Number.NEGATIVE_INFINITY }],
  ])("rejects a pose with %s", (_label, playerPose) => {
    expect(restoreProgress(progress({ playerPose }))).toEqual({ ok: false, reason: RESTORE_REASONS.invalidPose });
  });

  it("clamps an out-of-bounds pose to the Play_Area", () => {
    const result = restoreProgress(progress({ playerPose: { position: [0, -1000, 500], yaw: 2 } }));
    expect(result.ok && result.pose).toEqual({
      position: [STREET_PLAY_BOUNDS.minX, STREET_PLAY_BOUNDS.groundY, STREET_PLAY_BOUNDS.maxZ],
      yaw: 2,
    });
  });

  it("accepts exactly the cap and rejects progress above it", () => {
    expect(restoreProgress(progress({ actions: acceptedActions(SAVE_MAX_ACTIONS) })).ok).toBe(true);
    expect(restoreProgress(progress({ actions: acceptedActions(SAVE_MAX_ACTIONS + 1) }))).toEqual({
      ok: false,
      reason: RESTORE_REASONS.tooManyActions,
    });
  });

  it("rejects progress when any replayed action is rejected", () => {
    const tampered = [...acceptedActions(2), { type: "OPEN_PHONE" } as CoreAction];
    expect(restoreProgress(progress({ actions: tampered }))).toEqual({
      ok: false,
      reason: RESTORE_REASONS.actionRejected,
    });
    // An action before START_CHAPTER is rejected too.
    expect(restoreProgress(progress({ actions: [{ type: "OPEN_PHONE" }] })).ok).toBe(false);
  });
});

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

// Chapter progress encode and restore for save format version 2.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Saves" and "Error Handling", and
// Requirements 15.3, 15.5, 15.6 and 15.7.
//
// A save stores only the accepted Core_Actions. Restore replays them through the chapter core
// from the initial Chapter_State, so a save is valid exactly when the core accepts every action.

import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import type { ChapterState, ScenarioDefinition } from "../narrative/types";
import { clampToPlayArea } from "../scenes/MainMenuScene/streetPlayArea";
import { SAVE_MAX_ACTIONS, type ChapterProgressV2, type SavedPlayerPose } from "./saveGame";

export type RestoreProgressResult =
  | { ok: true; state: ChapterState; pose: SavedPlayerPose | null }
  | { ok: false; reason: string };

/** Result of a lenient restore: the state after the last accepted action, plus a trimmed flag. */
export type LenientRestoreProgressResult =
  | { ok: true; state: ChapterState; pose: SavedPlayerPose | null; trimmed: boolean; acceptedActions: number }
  | { ok: false; reason: string };

export interface RestoreProgressOptions {
  /** Stop at the first rejected action instead of failing the whole save. */
  readonly lenient?: boolean;
}

export const RESTORE_REASONS = {
  tooManyActions: "Saved data has too many actions.",
  actionRejected: "Saved progress could not be replayed.",
  invalidPose: "Saved data has an invalid player position.",
} as const;

function isFinitePose(pose: SavedPlayerPose): boolean {
  return pose.position.length === 3 && pose.position.every(Number.isFinite) && Number.isFinite(pose.yaw);
}

/** Returns a copy of the pose with the position clamped to the Play_Area bounds. */
function clampPose(pose: SavedPlayerPose): SavedPlayerPose {
  return { position: clampToPlayArea(pose.position), yaw: pose.yaw };
}

/**
 * Builds the progress part of a Checkpoint from the Event_Log (Requirement 15.3). Every Event_Log
 * entry is an accepted Core_Action, because the reducer appends entries only on acceptance.
 *
 * Returns `null` when the log holds more than `SAVE_MAX_ACTIONS` actions: the caller must skip the
 * write so the last valid Checkpoint stays in storage (design, "Error Handling"). A truncated
 * action list would replay to a different state, so it is never written.
 *
 * A non-finite pose is stored as `null` (the chapter spawn point) so the encoder never writes a
 * save that restore would reject. A finite pose is clamped to the Play_Area bounds.
 */
export function encodeProgress(
  state: ChapterState,
  playerPose: SavedPlayerPose | null,
  checkpointId: string,
): ChapterProgressV2 | null {
  if (state.events.length > SAVE_MAX_ACTIONS) return null;
  return {
    checkpointId,
    actions: state.events.map((entry) => entry.action),
    playerPose: playerPose !== null && isFinitePose(playerPose) ? clampPose(playerPose) : null,
  };
}

/**
 * Rebuilds the Chapter_State by replaying the saved actions from the initial Chapter_State
 * (Requirement 15.5). By default any rejected action makes the save invalid (Requirement 15.6).
 * With `{ lenient: true }` replay stops at the first rejected action and returns the state after
 * the last accepted action with `trimmed: true` and `acceptedActions`; a fully accepted log
 * returns `trimmed: false`. More than `SAVE_MAX_ACTIONS` actions or a non-finite pose stay hard
 * failures in both modes (Requirement 15.7); a finite pose is clamped to the Play_Area bounds.
 */
export function restoreProgress(
  progress: ChapterProgressV2,
  scenario?: ScenarioDefinition,
  options?: { readonly lenient?: false },
): RestoreProgressResult;
export function restoreProgress(
  progress: ChapterProgressV2,
  scenario: ScenarioDefinition | undefined,
  options: { readonly lenient: true },
): LenientRestoreProgressResult;
export function restoreProgress(
  progress: ChapterProgressV2,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
  options: RestoreProgressOptions = {},
): RestoreProgressResult | LenientRestoreProgressResult {
  if (progress.actions.length > SAVE_MAX_ACTIONS) {
    return { ok: false, reason: RESTORE_REASONS.tooManyActions };
  }

  const pose = progress.playerPose;
  if (pose !== null && !isFinitePose(pose)) {
    return { ok: false, reason: RESTORE_REASONS.invalidPose };
  }
  const restoredPose = pose === null ? null : clampPose(pose);

  let state = createInitialState(scenario);
  let accepted = 0;
  for (const action of progress.actions) {
    const result = chapterReducer(state, action, scenario);
    if (!result.accepted) {
      if (options.lenient === true) {
        return { ok: true, state, pose: restoredPose, trimmed: true, acceptedActions: accepted };
      }
      return { ok: false, reason: RESTORE_REASONS.actionRejected };
    }
    state = result.state;
    accepted += 1;
  }

  if (options.lenient === true) {
    return { ok: true, state, pose: restoredPose, trimmed: false, acceptedActions: accepted };
  }
  return { ok: true, state, pose: restoredPose };
}
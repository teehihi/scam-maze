// Checkpoint_Saver: decides when the chapter writes a Checkpoint.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Saves" (Checkpoint policy) and
// "Error Handling", and Requirements 15.1, 15.2 and 15.14.
//
// Policy:
// - Write when the active or completed objectives differ from the last saved ones and no Call is
//   ringing or active (Requirement 15.1).
// - A change during a Call is not saved yet. The difference stays pending, so the first store
//   update after the Call ends writes it (Requirement 15.2).
// - Write once after FINISH_CHAPTER, with checkpoint ID "debrief".
// - Never write before START_CHAPTER. A `replace` back to the initial state (restart, replay)
//   resets the baseline, so the next START_CHAPTER writes a fresh Checkpoint.
// - If the Event_Log is over the action cap, `encodeProgress` returns null and the write is
//   skipped, so the last valid Checkpoint stays in storage.
// - A failed write is reported once per failure streak (Requirement 15.14). Gameplay continues.
// - `saveNow()` forces a write of the current state and pose ("Save and return to menu"), under
//   the same rule: only while playing and with no Call ringing or active.

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import type { SceneId } from "@scammaze/shared-types";
import type { ChapterStore } from "../../game/narrative/store";
import type { ChapterState } from "../../game/narrative/types";
import { encodeProgress } from "../../game/saves/chapterProgress";
import {
  SAVE_FORMAT_VERSION_V2,
  START_CHECKPOINT_ID,
  type SaveGameSource,
  type SavedGameV2,
  type SavedPlayerPose,
} from "../../game/saves/saveGame";

/** Checkpoint ID written after FINISH_CHAPTER. */
export const DEBRIEF_CHECKPOINT_ID = "debrief";

export interface CheckpointSaverOptions {
  store: ChapterStore;
  saveSource: SaveGameSource;
  /** Reads the current player pose on demand; `null` (or a null getter) saves the spawn point. */
  poseGetterRef: RefObject<(() => SavedPlayerPose) | null>;
  chapterId: string;
  sceneId: SceneId;
  /** Called once when a write fails after the last write succeeded (or after mount). */
  onWriteFailure?: () => void;
}

/** Stable comparison key for the objective sets. */
function objectivesKey(state: ChapterState): string {
  return JSON.stringify(state.objectives);
}

/** True while a Call is ringing or active, so a Checkpoint must wait. */
function callInProgress(state: ChapterState): boolean {
  return state.call.status === "ringing" || state.call.status === "active";
}

/** The most recently activated objective, else the most recently completed one, else "start". */
export function objectiveCheckpointId(state: ChapterState): string {
  const { active, completed } = state.objectives;
  return active[active.length - 1] ?? completed[completed.length - 1] ?? START_CHECKPOINT_ID;
}

export interface CheckpointSaver {
  /**
   * Writes a Checkpoint for the current state now, with the current player pose (for example
   * "Save and return to menu"). Writes only while the chapter is playing and no Call is ringing
   * or active. Returns true when the Checkpoint was written.
   */
  saveNow: () => boolean;
}

export function useCheckpointSaver({
  store,
  saveSource,
  poseGetterRef,
  chapterId,
  sceneId,
  onWriteFailure,
}: CheckpointSaverOptions): CheckpointSaver {
  // Latest values, read by the store listener without resubscribing.
  const latest = useRef({ saveSource, chapterId, sceneId, onWriteFailure });
  useEffect(() => {
    latest.current = { saveSource, chapterId, sceneId, onWriteFailure };
  }, [saveSource, chapterId, sceneId, onWriteFailure]);

  // True after a failed write until the next successful one, so a failure streak is reported once.
  const failingRef = useRef(false);

  // Baseline taken at the first render for this store, before any child or sibling effect can
  // dispatch. A restored Checkpoint therefore does not write again on mount.
  const initial = useMemo(() => {
    const state = store.getState();
    return { key: objectivesKey(state), finished: state.status === "finished" };
  }, [store]);

  /** Encodes and writes one Checkpoint. Returns true when it was written. */
  const write = useCallback(
    (state: ChapterState, checkpointId: string): boolean => {
      const pose = poseGetterRef.current?.() ?? null;
      const progress = encodeProgress(state, pose, checkpointId);
      // Over the action cap: keep the last valid Checkpoint.
      if (progress === null) return false;

      const { saveSource: source, chapterId: id, sceneId: scene, onWriteFailure: onFailure } =
        latest.current;
      const save: SavedGameV2 = {
        formatVersion: SAVE_FORMAT_VERSION_V2,
        chapterId: id,
        sceneId: scene,
        savedAt: new Date().toISOString(),
        progress,
      };
      // A source without `write` cannot save on this device either.
      const ok = source.write ? source.write(save) : false;
      if (ok) {
        failingRef.current = false;
      } else if (!failingRef.current) {
        failingRef.current = true;
        onFailure?.();
      }
      return ok;
    },
    [poseGetterRef],
  );

  const saveNow = useCallback((): boolean => {
    const state = store.getState();
    if (state.status !== "playing" || callInProgress(state)) return false;
    return write(state, objectiveCheckpointId(state));
  }, [store, write]);

  useEffect(() => {
    let savedKey = initial.key;
    let savedFinished = initial.finished;

    const check = (): void => {
      const state = store.getState();

      if (state.status === "not-started") {
        // Before START_CHAPTER, or after a restart: reset so the next start writes.
        savedKey = objectivesKey(state);
        savedFinished = false;
        return;
      }

      if (state.status === "finished") {
        if (!savedFinished) {
          savedFinished = true;
          savedKey = objectivesKey(state);
          write(state, DEBRIEF_CHECKPOINT_ID);
        }
        return;
      }
      savedFinished = false;

      const key = objectivesKey(state);
      if (key === savedKey || callInProgress(state)) return;
      savedKey = key;
      write(state, objectiveCheckpointId(state));
    };

    const unsubscribe = store.subscribe(check);
    // Catch any change between the first render and this subscription.
    check();
    return unsubscribe;
  }, [store, initial, write]);

  return useMemo(() => ({ saveNow }), [saveNow]);
}

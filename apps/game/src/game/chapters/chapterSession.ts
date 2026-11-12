import type { SceneId } from "@scammaze/shared-types";
import type { ChapterDefinition } from "./chapterRegistry";
import type { ChapterState, ScenarioDefinition } from "../narrative/types";
import { restoreProgress } from "../saves/chapterProgress";
import type { ChapterProgressV2, SavedGame, SavedPlayerPose } from "../saves/saveGame";

/** Chapter_State and player pose rebuilt by replaying a saved Checkpoint. */
export interface RestoredChapterProgress {
  state: ChapterState;
  /** Clamped to the Play_Area bounds; null means the chapter spawn point. */
  pose: SavedPlayerPose | null;
}

/** Deterministic starting point of a chapter, handed to gameplay once loading completes. */
export interface ChapterSession {
  chapterId: string;
  chapterNumber: number;
  sceneId: SceneId;
  origin: "new-game" | "saved-game";
  /** Saved Checkpoint progress, copied from a version 2 save (design, "Saves"). */
  progress?: ChapterProgressV2;
  /**
   * Result of replaying `progress` through the chapter core. The loader sets it after the replay
   * succeeds, so the Chapter_Page can start from it without replaying again.
   */
  restored?: RestoredChapterProgress;
  /**
   * True when a lenient restore stopped at the first rejected action, so the player resumes from
   * an earlier point than the one saved. The page shows the `hud.saveTrimmed.*` notice.
   */
  saveTrimmed?: boolean;
}

export type ApplyProgressResult =
  | { ok: true; session: ChapterSession }
  | { ok: false; reason: string };

/**
 * Replays the session's saved progress leniently (Req. 13.5). A trimmed restore is a success that
 * carries `saveTrimmed`. Zero accepted actions starts at the chapter beginning with the same flag.
 * Only damaged data (too many actions, non-finite pose) fails.
 */
export function applyRestoredProgress(session: ChapterSession, scenario?: ScenarioDefinition): ApplyProgressResult {
  if (session.progress === undefined) return { ok: true, session };
  const replayed = restoreProgress(session.progress, scenario, { lenient: true });
  if (!replayed.ok) return { ok: false, reason: replayed.reason };
  const { state, pose, trimmed, acceptedActions } = replayed;
  const next: ChapterSession = {
    ...session,
    restored: { state, pose: trimmed && acceptedActions === 0 ? null : pose },
  };
  if (trimmed) next.saveTrimmed = true;
  return { ok: true, session: next };
}

export function createNewChapterSession(chapter: ChapterDefinition): ChapterSession {
  return {
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    sceneId: chapter.startSceneId,
    origin: "new-game",
  };
}

export type RestoreResult =
  | { ok: true; session: ChapterSession }
  | { ok: false; reason: string };

/** Checks a structurally valid save against the chapter's rules before gameplay can use it. */
export function restoreChapterSession(chapter: ChapterDefinition, save: SavedGame): RestoreResult {
  if (save.chapterId !== chapter.id) {
    return { ok: false, reason: "Saved chapter does not match the loaded chapter." };
  }
  if (!chapter.sceneIds.includes(save.sceneId)) {
    return { ok: false, reason: "Saved scene does not belong to this chapter." };
  }
  const session: ChapterSession = {
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    sceneId: save.sceneId,
    origin: "saved-game",
  };
  if (save.progress !== undefined) session.progress = save.progress;
  return { ok: true, session };
}

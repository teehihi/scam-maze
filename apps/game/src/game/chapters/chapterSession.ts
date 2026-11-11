import type { SceneId } from "@scammaze/shared-types";
import type { ChapterDefinition } from "./chapterRegistry";
import type { ChapterState } from "../narrative/types";
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

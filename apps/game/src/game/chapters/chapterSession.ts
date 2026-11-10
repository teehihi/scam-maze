import type { SceneId } from "@scammaze/shared-types";
import type { ChapterDefinition } from "./chapterRegistry";
import type { SavedGame } from "../saves/saveGame";

/** Deterministic starting point of a chapter, handed to gameplay once loading completes. */
export interface ChapterSession {
  chapterId: string;
  chapterNumber: number;
  sceneId: SceneId;
  origin: "new-game" | "saved-game";
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
  return {
    ok: true,
    session: {
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      sceneId: save.sceneId,
      origin: "saved-game",
    },
  };
}

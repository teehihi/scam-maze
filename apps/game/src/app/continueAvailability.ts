// Decides whether the main menu enables Continue (Requirements 15.6 and 15.11).
// Continue is enabled only when the save names a known chapter and, for a version 2 save, its
// progress replays through the chapter core.

import type { ContinueAvailability } from "../features/menu/MainMenuOverlay";
import { getChapter } from "../game/chapters/chapterRegistry";
import { restoreProgress } from "../game/saves/chapterProgress";
import type { SaveGameSource } from "../game/saves/saveGame";

export const CONTINUE_REASONS = {
  none: "No saved game found.",
  invalid: "Your saved game could not be read. Start a new game instead.",
} as const;

export function readContinueAvailability(source: SaveGameSource): ContinueAvailability {
  const result = source.read();
  if (result.status === "none") {
    return { available: false, reason: CONTINUE_REASONS.none };
  }
  if (result.status === "invalid" || !getChapter(result.save.chapterId)) {
    return { available: false, reason: CONTINUE_REASONS.invalid };
  }
  const { progress } = result.save;
  if (progress !== undefined && !restoreProgress(progress).ok) {
    return { available: false, reason: CONTINUE_REASONS.invalid };
  }
  return { available: true };
}

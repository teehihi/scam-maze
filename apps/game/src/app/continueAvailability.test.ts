import { describe, expect, it } from "vitest";
import type { CoreAction } from "../game/narrative/types";
import {
  SAVE_FORMAT_VERSION,
  SAVE_FORMAT_VERSION_V2,
  START_CHECKPOINT_ID,
  type SaveGameSource,
  type SaveReadResult,
  type SavedGame,
} from "../game/saves/saveGame";
import { CONTINUE_REASONS, readContinueAvailability } from "./continueAvailability";

function sourceOf(result: SaveReadResult): SaveGameSource {
  return { read: () => result };
}

function v2Save(actions: CoreAction[], chapterId = "chapter-1"): SavedGame {
  return {
    formatVersion: SAVE_FORMAT_VERSION_V2,
    chapterId,
    sceneId: "street",
    savedAt: "2026-11-08T08:00:00.000Z",
    progress: { checkpointId: START_CHECKPOINT_ID, actions, playerPose: null },
  };
}

describe("readContinueAvailability", () => {
  it("reports that no saved game exists", () => {
    expect(readContinueAvailability(sourceOf({ status: "none" }))).toEqual({
      available: false,
      reasonCode: "none",
      reason: "No saved game found.",
    });
  });

  it("reports an unreadable save", () => {
    expect(readContinueAvailability(sourceOf({ status: "invalid", reason: "Saved data is not valid JSON." }))).toEqual({
      available: false,
      reasonCode: "invalid",
      reason: "Your saved game could not be read. Start a new game instead.",
    });
  });

  it("treats a save for an unknown chapter as unreadable", () => {
    const save = v2Save([{ type: "START_CHAPTER" }], "chapter-99");
    expect(readContinueAvailability(sourceOf({ status: "valid", save }))).toEqual({
      available: false,
      reasonCode: "invalid",
      reason: CONTINUE_REASONS.invalid,
    });
  });

  it("treats v2 progress that does not replay as unreadable", () => {
    // OPEN_PHONE twice in a row: the second one is rejected by the chapter core.
    const save = v2Save([{ type: "START_CHAPTER" }, { type: "OPEN_PHONE" }, { type: "OPEN_PHONE" }]);
    expect(readContinueAvailability(sourceOf({ status: "valid", save }))).toEqual({
      available: false,
      reasonCode: "invalid",
      reason: CONTINUE_REASONS.invalid,
    });
  });

  it("enables Continue for valid v2 progress", () => {
    const save = v2Save([{ type: "START_CHAPTER" }, { type: "OPEN_PHONE" }, { type: "CLOSE_PHONE" }]);
    expect(readContinueAvailability(sourceOf({ status: "valid", save }))).toEqual({ available: true });
  });

  it("enables Continue for a v1 save of a known chapter", () => {
    const save: SavedGame = {
      formatVersion: SAVE_FORMAT_VERSION,
      chapterId: "chapter-1",
      sceneId: "street",
      savedAt: "2026-11-08T08:00:00.000Z",
    };
    expect(readContinueAvailability(sourceOf({ status: "valid", save }))).toEqual({ available: true });
  });
});

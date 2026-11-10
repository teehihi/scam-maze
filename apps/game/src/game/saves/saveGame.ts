import type { SceneId } from "@scammaze/shared-types";

/**
 * Local saved-game access, kept behind a small interface so the storage technology can change
 * (IndexedDB via Dexie is the planned implementation) without touching the loading flow.
 * Nothing writes saves yet: saving starts once Chapter 1 gameplay exists.
 */

export const SAVE_STORAGE_KEY = "scammaze_save_v1";
export const SAVE_FORMAT_VERSION = 1;

const KNOWN_SCENE_IDS: readonly SceneId[] = ["main-menu", "intro-prologue", "apartment", "street"];

export interface SavedGame {
  formatVersion: typeof SAVE_FORMAT_VERSION;
  chapterId: string;
  sceneId: SceneId;
  /** ISO 8601 timestamp. */
  savedAt: string;
}

export type SaveReadResult =
  | { status: "none" }
  | { status: "valid"; save: SavedGame }
  | { status: "invalid"; reason: string };

export interface SaveGameSource {
  read(): SaveReadResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural validation of untrusted saved data. Chapter rules are checked by the loader. */
export function parseSavedGame(raw: unknown): SaveReadResult {
  if (!isRecord(raw)) {
    return { status: "invalid", reason: "Saved data is not an object." };
  }
  if (raw.formatVersion !== SAVE_FORMAT_VERSION) {
    return { status: "invalid", reason: "Unsupported save format version." };
  }
  if (typeof raw.chapterId !== "string" || raw.chapterId.length === 0) {
    return { status: "invalid", reason: "Saved data has no chapter." };
  }
  if (typeof raw.sceneId !== "string" || !KNOWN_SCENE_IDS.includes(raw.sceneId as SceneId)) {
    return { status: "invalid", reason: "Saved data has an unknown scene." };
  }
  if (typeof raw.savedAt !== "string" || Number.isNaN(Date.parse(raw.savedAt))) {
    return { status: "invalid", reason: "Saved data has an invalid date." };
  }
  return {
    status: "valid",
    save: {
      formatVersion: SAVE_FORMAT_VERSION,
      chapterId: raw.chapterId,
      sceneId: raw.sceneId as SceneId,
      savedAt: raw.savedAt,
    },
  };
}

export function createLocalStorageSaveSource(
  getStorage: () => Storage | undefined = () =>
    typeof window === "undefined" ? undefined : window.localStorage,
): SaveGameSource {
  return {
    read() {
      let text: string | null;
      try {
        text = getStorage()?.getItem(SAVE_STORAGE_KEY) ?? null;
      } catch {
        // Storage can be blocked (privacy mode, disabled cookies). Treat as no save.
        return { status: "none" };
      }
      if (text === null) return { status: "none" };
      try {
        return parseSavedGame(JSON.parse(text));
      } catch {
        return { status: "invalid", reason: "Saved data is not valid JSON." };
      }
    },
  };
}

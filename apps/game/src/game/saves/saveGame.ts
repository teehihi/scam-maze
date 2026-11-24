import type { SceneId } from "@scammaze/shared-types";
import { isCoreAction } from "../narrative/reducer";
import type { CoreAction } from "../narrative/types";

/**
 * Local saved-game access, kept behind a small interface so the storage technology can change
 * (IndexedDB via Dexie is the planned implementation) without touching the loading flow.
 *
 * Only format version 3 is readable (spec chapter-01-double-deception, design D6). Version 1 and 2
 * keys hold action logs of an older scenario, so they are reported as `incompatible`. They are
 * never migrated and never deleted by `read()`. Validation here is structural only: replaying the
 * actions through the chapter core happens in `chapterProgress.ts`.
 */

/** Legacy keys. Only used to detect an old save and to clear it. */
export const SAVE_STORAGE_KEY = "scammaze_save_v1";
export const SAVE_FORMAT_VERSION = 1;

export const SAVE_STORAGE_KEY_V2 = "scammaze_save_v2";
export const SAVE_FORMAT_VERSION_V2 = 2;

export const SAVE_STORAGE_KEY_V3 = "scammaze_save_v3";
export const SAVE_FORMAT_VERSION_V3 = 3;

/**
 * Identifies the scenario content a v3 action log was recorded against. `-3`: free thesis work
 * changed from 60 to 30 minutes per percent, so older logs replay to other results.
 */
export const SAVE_CONTENT_VERSION = "ch1-last-submission-3";

/** Upper bound on saved Core_Actions, so a save stays small (design: < 50 KB). */
export const SAVE_MAX_ACTIONS = 1000;

/** Checkpoint ID used for a chapter-start Checkpoint. */
export const START_CHECKPOINT_ID = "start";

const KNOWN_SCENE_IDS: readonly SceneId[] = ["main-menu", "intro-prologue", "apartment", "street"];

/** Position and yaw. Room chapter saves store `null` (the room has no saved pose). */
export interface SavedPlayerPose {
  position: [number, number, number];
  yaw: number;
}

export interface ChapterProgressV3 {
  /** Objective ID, "start" or "debrief". */
  checkpointId: string;
  /** Accepted Core_Actions only, at most `SAVE_MAX_ACTIONS`. */
  actions: CoreAction[];
  playerPose: SavedPlayerPose | null;
}

/** Version 3 save envelope. Contains no names, no free text and no device identifiers. */
export interface SavedGameV3 {
  formatVersion: typeof SAVE_FORMAT_VERSION_V3;
  contentVersion: string;
  chapterId: string;
  sceneId: SceneId;
  /** ISO 8601 timestamp. */
  savedAt: string;
  progress: ChapterProgressV3;
}

/** The save shape the game reads. `chapterLoader` and `restoreChapterSession` consume it. */
export type SavedGame = SavedGameV3;

/** `incompatible`: an older format or other scenario content. `damaged`: unreadable data. */
export type SaveInvalidCode = "incompatible" | "damaged";

export type SaveReadResult =
  | { status: "none" }
  | { status: "valid"; save: SavedGame }
  | { status: "invalid"; reason: string; code?: SaveInvalidCode };

export interface SaveGameSource {
  read(): SaveReadResult;
  /** Writes a v3 save. Returns `false` when storage is unavailable or the write fails. */
  write?(save: SavedGameV3): boolean;
  /** Deletes all chapter progress, including old format keys. Returns `false` when storage is unavailable. */
  clear?(): boolean;
}

export type SaveEnvelopeV3Result =
  | { status: "valid"; save: SavedGameV3 }
  | { status: "invalid"; reason: string; code: SaveInvalidCode };

const INCOMPATIBLE_REASON = "Saved data comes from an older version of the game.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function damaged(reason: string): SaveEnvelopeV3Result {
  return { status: "invalid", reason, code: "damaged" };
}

function parsePlayerPose(raw: unknown): SavedPlayerPose | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw) || !Array.isArray(raw.position) || raw.position.length !== 3) return undefined;
  const [x, y, z] = raw.position as unknown[];
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return undefined;
  if (typeof raw.yaw !== "number") return undefined;
  // Finite checks belong to `restoreProgress`.
  return { position: [x, y, z], yaw: raw.yaw };
}

/**
 * Structural validation of an untrusted v3 envelope. Total: never throws. The result is rebuilt
 * from known fields, so unknown top-level or progress fields are dropped. An older
 * `formatVersion` or a different `contentVersion` is `incompatible`; anything else wrong is
 * `damaged`. Replay validation lives in `chapterProgress.ts`.
 */
export function parseSaveEnvelopeV3(raw: unknown): SaveEnvelopeV3Result {
  if (!isRecord(raw)) return damaged("Saved data is not an object.");
  if (raw.formatVersion !== SAVE_FORMAT_VERSION_V3) {
    return { status: "invalid", reason: INCOMPATIBLE_REASON, code: "incompatible" };
  }
  if (typeof raw.contentVersion !== "string") return damaged("Saved data has no content version.");
  if (raw.contentVersion !== SAVE_CONTENT_VERSION) {
    return { status: "invalid", reason: INCOMPATIBLE_REASON, code: "incompatible" };
  }
  if (typeof raw.chapterId !== "string" || raw.chapterId.length === 0) return damaged("Saved data has no chapter.");
  if (typeof raw.sceneId !== "string" || !KNOWN_SCENE_IDS.includes(raw.sceneId as SceneId)) {
    return damaged("Saved data has an unknown scene.");
  }
  if (typeof raw.savedAt !== "string" || Number.isNaN(Date.parse(raw.savedAt))) {
    return damaged("Saved data has an invalid date.");
  }

  const progress = raw.progress;
  if (!isRecord(progress)) return damaged("Saved data has no chapter progress.");
  if (typeof progress.checkpointId !== "string" || progress.checkpointId.length === 0) {
    return damaged("Saved data has no checkpoint.");
  }
  if (!Array.isArray(progress.actions)) return damaged("Saved data has no action list.");
  if (progress.actions.length > SAVE_MAX_ACTIONS) return damaged("Saved data has too many actions.");
  if (!progress.actions.every((action) => isCoreAction(action))) return damaged("Saved data has an unknown action.");
  const playerPose = parsePlayerPose(progress.playerPose);
  if (playerPose === undefined) return damaged("Saved data has an invalid player position.");

  return {
    status: "valid",
    save: {
      formatVersion: SAVE_FORMAT_VERSION_V3,
      contentVersion: raw.contentVersion,
      chapterId: raw.chapterId,
      sceneId: raw.sceneId as SceneId,
      savedAt: raw.savedAt,
      progress: {
        checkpointId: progress.checkpointId,
        actions: [...(progress.actions as CoreAction[])],
        playerPose,
      },
    },
  };
}

function parseJson(text: string): SaveEnvelopeV3Result {
  try {
    return parseSaveEnvelopeV3(JSON.parse(text));
  } catch {
    return damaged("Saved data is not valid JSON.");
  }
}

export function createLocalStorageSaveSource(
  getStorage: () => Storage | undefined = () =>
    typeof window === "undefined" ? undefined : window.localStorage,
): SaveGameSource {
  return {
    read() {
      try {
        const storage = getStorage();
        const v3 = storage?.getItem(SAVE_STORAGE_KEY_V3) ?? null;
        if (v3 !== null) return parseJson(v3);
        // Old keys are only detected, never read, migrated or deleted.
        if (storage?.getItem(SAVE_STORAGE_KEY_V2) != null || storage?.getItem(SAVE_STORAGE_KEY) != null) {
          return { status: "invalid", reason: INCOMPATIBLE_REASON, code: "incompatible" };
        }
        return { status: "none" };
      } catch {
        // Storage can be blocked (privacy mode, disabled cookies). Treat as no save.
        return { status: "none" };
      }
    },
    write(save) {
      try {
        const storage = getStorage();
        if (!storage) return false;
        storage.setItem(SAVE_STORAGE_KEY_V3, JSON.stringify(save));
        return true;
      } catch {
        // Blocked storage or quota exceeded: gameplay continues without saving.
        return false;
      }
    },
    clear() {
      try {
        const storage = getStorage();
        if (!storage) return false;
        storage.removeItem(SAVE_STORAGE_KEY_V3);
        storage.removeItem(SAVE_STORAGE_KEY_V2);
        storage.removeItem(SAVE_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}

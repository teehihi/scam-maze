import type { SceneId } from "@scammaze/shared-types";
import { isCoreAction } from "../narrative/reducer";
import type { CoreAction } from "../narrative/types";

/**
 * Local saved-game access, kept behind a small interface so the storage technology can change
 * (IndexedDB via Dexie is the planned implementation) without touching the loading flow.
 *
 * Format version 1 holds only a chapter and a scene. Format version 2 adds the chapter progress
 * (accepted Core_Actions, checkpoint ID and player pose). Validation here is structural only:
 * replaying the actions through the chapter core happens in `chapterProgress.ts`.
 */

export const SAVE_STORAGE_KEY = "scammaze_save_v1";
export const SAVE_FORMAT_VERSION = 1;

export const SAVE_STORAGE_KEY_V2 = "scammaze_save_v2";
export const SAVE_FORMAT_VERSION_V2 = 2;

/** Upper bound on saved Core_Actions, so a save stays small (design: < 50 KB). */
export const SAVE_MAX_ACTIONS = 1000;

/** Checkpoint ID used for a chapter-start Checkpoint, including migrated v1 saves. */
export const START_CHECKPOINT_ID = "start";

const KNOWN_SCENE_IDS: readonly SceneId[] = ["main-menu", "intro-prologue", "apartment", "street"];

export interface SavedPlayerPose {
  position: [number, number, number];
  yaw: number;
}

export interface ChapterProgressV2 {
  /** Objective ID, "start" or "debrief". */
  checkpointId: string;
  /** Accepted Core_Actions only, at most `SAVE_MAX_ACTIONS`. */
  actions: CoreAction[];
  playerPose: SavedPlayerPose | null;
}

/**
 * Shape shared by every supported format version. `chapterLoader` and `restoreChapterSession`
 * only read `chapterId`, `sceneId` and `savedAt`.
 */
export interface SavedGame {
  formatVersion: typeof SAVE_FORMAT_VERSION | typeof SAVE_FORMAT_VERSION_V2;
  chapterId: string;
  sceneId: SceneId;
  /** ISO 8601 timestamp. */
  savedAt: string;
  progress?: ChapterProgressV2;
}

/** Version 2 save envelope. Contains no names, no free text and no device identifiers. */
export interface SavedGameV2 extends SavedGame {
  formatVersion: typeof SAVE_FORMAT_VERSION_V2;
  progress: ChapterProgressV2;
}

export type SaveReadResult =
  | { status: "none" }
  | { status: "valid"; save: SavedGame }
  | { status: "invalid"; reason: string };

export interface SaveGameSource {
  read(): SaveReadResult;
  /** Writes a v2 save. Returns `false` when storage is unavailable or the write fails. */
  write?(save: SavedGameV2): boolean;
  /** Deletes all chapter progress. Returns `false` when storage is unavailable. */
  clear?(): boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type HeaderResult =
  | { ok: true; chapterId: string; sceneId: SceneId; savedAt: string }
  | { ok: false; reason: string };

/** Checks the fields shared by all format versions. */
function parseHeader(raw: Record<string, unknown>): HeaderResult {
  if (typeof raw.chapterId !== "string" || raw.chapterId.length === 0) {
    return { ok: false, reason: "Saved data has no chapter." };
  }
  if (typeof raw.sceneId !== "string" || !KNOWN_SCENE_IDS.includes(raw.sceneId as SceneId)) {
    return { ok: false, reason: "Saved data has an unknown scene." };
  }
  if (typeof raw.savedAt !== "string" || Number.isNaN(Date.parse(raw.savedAt))) {
    return { ok: false, reason: "Saved data has an invalid date." };
  }
  return { ok: true, chapterId: raw.chapterId, sceneId: raw.sceneId as SceneId, savedAt: raw.savedAt };
}

/** Structural validation of untrusted v1 saved data. Chapter rules are checked by the loader. */
export function parseSavedGame(raw: unknown): SaveReadResult {
  if (!isRecord(raw)) {
    return { status: "invalid", reason: "Saved data is not an object." };
  }
  if (raw.formatVersion !== SAVE_FORMAT_VERSION) {
    return { status: "invalid", reason: "Unsupported save format version." };
  }
  const header = parseHeader(raw);
  if (!header.ok) return { status: "invalid", reason: header.reason };
  return {
    status: "valid",
    save: {
      formatVersion: SAVE_FORMAT_VERSION,
      chapterId: header.chapterId,
      sceneId: header.sceneId,
      savedAt: header.savedAt,
    },
  };
}

function parsePlayerPose(raw: unknown): SavedPlayerPose | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw) || !Array.isArray(raw.position) || raw.position.length !== 3) return undefined;
  const [x, y, z] = raw.position as unknown[];
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return undefined;
  if (typeof raw.yaw !== "number") return undefined;
  // Finite checks and clamping to the Play_Area belong to `restoreProgress` (Requirement 15.7).
  return { position: [x, y, z], yaw: raw.yaw };
}

export type SaveEnvelopeV2Result =
  | { status: "valid"; save: SavedGameV2 }
  | { status: "invalid"; reason: string };

/**
 * Structural validation of an untrusted v2 envelope. The result is rebuilt from known fields, so
 * unknown top-level or progress fields are dropped. Replay validation lives in `chapterProgress.ts`.
 */
export function parseSaveEnvelopeV2(raw: unknown): SaveEnvelopeV2Result {
  if (!isRecord(raw)) {
    return { status: "invalid", reason: "Saved data is not an object." };
  }
  if (raw.formatVersion !== SAVE_FORMAT_VERSION_V2) {
    return { status: "invalid", reason: "Unsupported save format version." };
  }
  const header = parseHeader(raw);
  if (!header.ok) return { status: "invalid", reason: header.reason };

  const progress = raw.progress;
  if (!isRecord(progress)) {
    return { status: "invalid", reason: "Saved data has no chapter progress." };
  }
  if (typeof progress.checkpointId !== "string" || progress.checkpointId.length === 0) {
    return { status: "invalid", reason: "Saved data has no checkpoint." };
  }
  if (!Array.isArray(progress.actions)) {
    return { status: "invalid", reason: "Saved data has no action list." };
  }
  if (progress.actions.length > SAVE_MAX_ACTIONS) {
    return { status: "invalid", reason: "Saved data has too many actions." };
  }
  if (!progress.actions.every((action) => isCoreAction(action))) {
    return { status: "invalid", reason: "Saved data has an unknown action." };
  }
  const playerPose = parsePlayerPose(progress.playerPose);
  if (playerPose === undefined) {
    return { status: "invalid", reason: "Saved data has an invalid player position." };
  }

  return {
    status: "valid",
    save: {
      formatVersion: SAVE_FORMAT_VERSION_V2,
      chapterId: header.chapterId,
      sceneId: header.sceneId,
      savedAt: header.savedAt,
      progress: {
        checkpointId: progress.checkpointId,
        actions: [...(progress.actions as CoreAction[])],
        playerPose,
      },
    },
  };
}

/** Converts a v1 save into a v2 Checkpoint at the chapter start (Requirement 15.9). */
function migrateV1ToV2(save: SavedGame): SavedGameV2 {
  return {
    formatVersion: SAVE_FORMAT_VERSION_V2,
    chapterId: save.chapterId,
    sceneId: save.sceneId,
    savedAt: save.savedAt,
    progress: { checkpointId: START_CHECKPOINT_ID, actions: [], playerPose: null },
  };
}

/** Reads, parses and validates one key. `undefined` means the key is absent. */
function readKey(
  storage: Storage | undefined,
  key: string,
  parse: (raw: unknown) => SaveReadResult,
): SaveReadResult | undefined {
  const text = storage?.getItem(key) ?? null;
  if (text === null) return undefined;
  try {
    return parse(JSON.parse(text));
  } catch {
    return { status: "invalid", reason: "Saved data is not valid JSON." };
  }
}

export function createLocalStorageSaveSource(
  getStorage: () => Storage | undefined = () =>
    typeof window === "undefined" ? undefined : window.localStorage,
): SaveGameSource {
  const write = (save: SavedGameV2): boolean => {
    try {
      const storage = getStorage();
      if (!storage) return false;
      storage.setItem(SAVE_STORAGE_KEY_V2, JSON.stringify(save));
      return true;
    } catch {
      // Blocked storage or quota exceeded: gameplay continues without saving (Requirement 15.14).
      return false;
    }
  };

  return {
    read() {
      let storage: Storage | undefined;
      let v2: SaveReadResult | undefined;
      let v1: SaveReadResult | undefined;
      try {
        storage = getStorage();
        v2 = readKey(storage, SAVE_STORAGE_KEY_V2, parseSaveEnvelopeV2);
        if (v2 === undefined) v1 = readKey(storage, SAVE_STORAGE_KEY, parseSavedGame);
      } catch {
        // Storage can be blocked (privacy mode, disabled cookies). Treat as no save.
        return { status: "none" };
      }
      if (v2 !== undefined) return v2;
      if (v1 === undefined) return { status: "none" };
      if (v1.status !== "valid") return v1;

      const migrated = migrateV1ToV2(v1.save);
      if (write(migrated)) {
        try {
          storage?.removeItem(SAVE_STORAGE_KEY);
        } catch {
          // The v2 save already exists and is read first, so a leftover v1 key is harmless.
        }
      }
      // If the write failed, the v1 key stays and the migrated value is still returned.
      return { status: "valid", save: migrated };
    },
    write,
    clear() {
      try {
        const storage = getStorage();
        if (!storage) return false;
        storage.removeItem(SAVE_STORAGE_KEY_V2);
        storage.removeItem(SAVE_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}

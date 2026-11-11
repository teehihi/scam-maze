import { describe, expect, it } from "vitest";
import {
  createLocalStorageSaveSource,
  parseSaveEnvelopeV2,
  parseSavedGame,
  SAVE_MAX_ACTIONS,
  SAVE_STORAGE_KEY,
  SAVE_STORAGE_KEY_V2,
  START_CHECKPOINT_ID,
  type SavedGameV2,
} from "./saveGame";

const VALID = { formatVersion: 1, chapterId: "chapter-1", sceneId: "street", savedAt: "2026-11-10T08:00:00.000Z" };

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("parseSavedGame", () => {
  it("accepts a well-formed save", () => {
    expect(parseSavedGame(VALID)).toEqual({ status: "valid", save: VALID });
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a wrong version", { ...VALID, formatVersion: 2 }],
    ["an empty chapter", { ...VALID, chapterId: "" }],
    ["an unknown scene", { ...VALID, sceneId: "rooftop" }],
    ["an invalid date", { ...VALID, savedAt: "yesterday" }],
  ])("rejects %s", (_label, raw) => {
    expect(parseSavedGame(raw).status).toBe("invalid");
  });
});

describe("createLocalStorageSaveSource", () => {
  it("reports no save when the key is absent", () => {
    expect(createLocalStorageSaveSource(() => memoryStorage()).read()).toEqual({ status: "none" });
  });

  it("reports invalid JSON as an invalid save", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{not json" });
    expect(createLocalStorageSaveSource(() => storage).read().status).toBe("invalid");
  });

  it("treats blocked storage as no save", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    expect(createLocalStorageSaveSource(blocked).read()).toEqual({ status: "none" });
  });

  it("reads a valid save", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(VALID) });
    expect(createLocalStorageSaveSource(() => storage).read().status).toBe("valid");
  });
});

const VALID_V2: SavedGameV2 = {
  formatVersion: 2,
  chapterId: "chapter-1",
  sceneId: "street",
  savedAt: "2026-11-10T08:00:00.000Z",
  progress: {
    checkpointId: "obj.answer-call",
    actions: [{ type: "START_CHAPTER" }, { type: "OPEN_PHONE" }],
    playerPose: { position: [188.6, -92.7, -88.89], yaw: 3.14 },
  },
};

/** Memory storage whose writes always fail, like a full quota. */
function readOnlyStorage(initial: Record<string, string>): Storage {
  const storage = memoryStorage(initial);
  return {
    ...storage,
    getItem: storage.getItem,
    removeItem: storage.removeItem,
    setItem: () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    },
  };
}

describe("parseSaveEnvelopeV2", () => {
  it("accepts a well-formed v2 save and drops unknown fields", () => {
    const raw = { ...VALID_V2, extra: "x", progress: { ...VALID_V2.progress, note: "y" } };
    expect(parseSaveEnvelopeV2(raw)).toEqual({ status: "valid", save: VALID_V2 });
  });

  it("accepts a null player pose", () => {
    const raw = { ...VALID_V2, progress: { ...VALID_V2.progress, playerPose: null } };
    expect(parseSaveEnvelopeV2(raw).status).toBe("valid");
  });

  it.each([
    ["null", null],
    ["version 1", { ...VALID_V2, formatVersion: 1 }],
    ["an unknown version", { ...VALID_V2, formatVersion: 3 }],
    ["no progress", { ...VALID_V2, progress: undefined }],
    ["an empty checkpoint", { ...VALID_V2, progress: { ...VALID_V2.progress, checkpointId: "" } }],
    ["a non-array action list", { ...VALID_V2, progress: { ...VALID_V2.progress, actions: {} } }],
    ["an unknown action", { ...VALID_V2, progress: { ...VALID_V2.progress, actions: [{ type: "PAY" }] } }],
    [
      "too many actions",
      { ...VALID_V2, progress: { ...VALID_V2.progress, actions: Array(SAVE_MAX_ACTIONS + 1).fill({ type: "OPEN_PHONE" }) } },
    ],
    ["a malformed pose", { ...VALID_V2, progress: { ...VALID_V2.progress, playerPose: { position: [1, 2], yaw: 0 } } }],
    ["an unknown scene", { ...VALID_V2, sceneId: "rooftop" }],
  ])("rejects %s", (_label, raw) => {
    expect(parseSaveEnvelopeV2(raw).status).toBe("invalid");
  });
});

describe("createLocalStorageSaveSource (version 2)", () => {
  it("reads a valid v2 save", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY_V2]: JSON.stringify(VALID_V2) });
    expect(createLocalStorageSaveSource(() => storage).read()).toEqual({ status: "valid", save: VALID_V2 });
  });

  it("reports an unknown version under the v2 key as invalid", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY_V2]: JSON.stringify({ ...VALID_V2, formatVersion: 3 }) });
    expect(createLocalStorageSaveSource(() => storage).read().status).toBe("invalid");
  });

  it("prefers the v2 key over a leftover v1 key", () => {
    const storage = memoryStorage({
      [SAVE_STORAGE_KEY_V2]: JSON.stringify(VALID_V2),
      [SAVE_STORAGE_KEY]: JSON.stringify(VALID),
    });
    expect(createLocalStorageSaveSource(() => storage).read()).toEqual({ status: "valid", save: VALID_V2 });
  });

  it("migrates v1 to a start Checkpoint, writes v2 and removes the v1 key", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(VALID) });
    const result = createLocalStorageSaveSource(() => storage).read();
    const expected = {
      ...VALID,
      formatVersion: 2,
      progress: { checkpointId: START_CHECKPOINT_ID, actions: [], playerPose: null },
    };
    expect(result).toEqual({ status: "valid", save: expected });
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY_V2) ?? "null")).toEqual(expected);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();
  });

  it("keeps the v1 key and still returns the migrated save when the write fails", () => {
    const storage = readOnlyStorage({ [SAVE_STORAGE_KEY]: JSON.stringify(VALID) });
    const result = createLocalStorageSaveSource(() => storage).read();
    expect(result.status).toBe("valid");
    expect(result.status === "valid" && result.save.progress?.checkpointId).toBe(START_CHECKPOINT_ID);
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(SAVE_STORAGE_KEY_V2)).toBeNull();
  });

  it("does not migrate an invalid v1 save", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: JSON.stringify({ ...VALID, sceneId: "rooftop" }) });
    expect(createLocalStorageSaveSource(() => storage).read().status).toBe("invalid");
    expect(storage.getItem(SAVE_STORAGE_KEY_V2)).toBeNull();
  });

  it("writes a v2 save that reads back unchanged", () => {
    const storage = memoryStorage();
    const source = createLocalStorageSaveSource(() => storage);
    expect(source.write?.(VALID_V2)).toBe(true);
    expect(source.read()).toEqual({ status: "valid", save: VALID_V2 });
  });

  it("returns false when the write fails", () => {
    expect(createLocalStorageSaveSource(() => readOnlyStorage({})).write?.(VALID_V2)).toBe(false);
    expect(createLocalStorageSaveSource(() => undefined).write?.(VALID_V2)).toBe(false);
  });

  it("clear removes both keys", () => {
    const storage = memoryStorage({
      [SAVE_STORAGE_KEY_V2]: JSON.stringify(VALID_V2),
      [SAVE_STORAGE_KEY]: JSON.stringify(VALID),
      other: "kept",
    });
    const source = createLocalStorageSaveSource(() => storage);
    expect(source.clear?.()).toBe(true);
    expect(storage.getItem(SAVE_STORAGE_KEY_V2)).toBeNull();
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("other")).toBe("kept");
    expect(source.read()).toEqual({ status: "none" });
  });

  it("handles blocked storage without throwing", () => {
    const source = createLocalStorageSaveSource(() => {
      throw new Error("SecurityError");
    });
    expect(source.read()).toEqual({ status: "none" });
    expect(source.write?.(VALID_V2)).toBe(false);
    expect(source.clear?.()).toBe(false);
  });

  it("treats storage that throws on getItem as no save", () => {
    const storage = memoryStorage();
    const throwing: Storage = {
      ...storage,
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(createLocalStorageSaveSource(() => throwing).read()).toEqual({ status: "none" });
  });
});

import { describe, expect, it } from "vitest";
import { createLocalStorageSaveSource, parseSavedGame, SAVE_STORAGE_KEY } from "./saveGame";

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

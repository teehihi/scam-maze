import { describe, expect, it } from "vitest";
import {
  caseSeed,
  CORE_PROPERTY_RUNS,
  CORE_SEQUENCE_MAX_LENGTH,
  generateActionSequence,
  runSequence,
} from "../../test/chapterRuns";
import { createLcg, randomInt } from "../../test/seededRandom";
import { clampToPlayArea, STREET_PLAY_BOUNDS } from "../scenes/MainMenuScene/streetPlayArea";
import { encodeProgress, restoreProgress } from "./chapterProgress";
import {
  createLocalStorageSaveSource,
  parseSaveEnvelopeV2,
  SAVE_FORMAT_VERSION_V2,
  type SavedGameV2,
  type SavedPlayerPose,
} from "./saveGame";

const SEED = 0x5a7e0c12;

/** Minimal in-memory Storage for the localStorage save source. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

/** Uniform float in [min, max). */
function randomFloat(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

/**
 * A finite pose: inside the Play_Area bounds, or outside them on one or more axes. Values are
 * offset away from zero so `-0` never appears (JSON writes `-0` as `0`).
 */
function randomPose(next: () => number): SavedPlayerPose {
  const b = STREET_PLAY_BOUNDS;
  const inside = next() < 0.5;
  const axis = (min: number, max: number) =>
    inside || next() < 0.5 ? randomFloat(next, min, max) : next() < 0.5 ? min - randomFloat(next, 0.5, 500) : max + randomFloat(next, 0.5, 500);
  const x = axis(b.minX, b.maxX);
  const y = inside || next() < 0.5 ? b.groundY + randomFloat(next, 0, 5) : b.groundY - randomFloat(next, 0.5, 200);
  const z = axis(b.minZ, b.maxZ);
  const yaw = randomFloat(next, 0.001, Math.PI) * (next() < 0.5 ? -1 : 1);
  return { position: [x, y, z], yaw };
}

describe("chapter progress save round trip", () => {
  it("restores the same Chapter_State and the clamped pose after encode, JSON and parse", () => {
    // Feature: chapter-01-the-urgent-call, Property 12: Save round trip
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const next = createLcg(seed);
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      const state = runSequence(generateActionSequence(seed, length)).final;
      const pose = next() < 0.1 ? null : randomPose(next);
      const label = `seed ${seed} (case ${index}), length ${length}, pose ${JSON.stringify(pose)}`;

      const progress = encodeProgress(state, pose, "start");
      expect(progress, label).not.toBeNull();
      if (progress === null) continue;

      const save: SavedGameV2 = {
        formatVersion: SAVE_FORMAT_VERSION_V2,
        chapterId: state.chapterId,
        sceneId: "street",
        savedAt: "2026-11-08T12:00:00.000Z",
        progress,
      };
      const expectedPose = pose === null ? null : { position: clampToPlayArea(pose.position), yaw: pose.yaw };

      // Path 1: JSON text → structural parse → replay.
      const parsed = parseSaveEnvelopeV2(JSON.parse(JSON.stringify(save)));
      expect(parsed.status, label).toBe("valid");
      if (parsed.status !== "valid") continue;
      const restored = restoreProgress(parsed.save.progress);
      expect(restored.ok, label).toBe(true);
      if (!restored.ok) continue;
      expect(restored.state, label).toEqual(state);
      expect(restored.pose, label).toEqual(expectedPose);

      // Path 2: write and read through the localStorage save source with in-memory storage.
      const storage = memoryStorage();
      const source = createLocalStorageSaveSource(() => storage);
      expect(source.write?.(save), label).toBe(true);
      const read = source.read();
      expect(read.status, label).toBe("valid");
      expect(read.status === "valid" ? read.save.progress : undefined, label).toBeDefined();
      if (read.status !== "valid" || read.save.progress === undefined) continue;
      const fromStorage = restoreProgress(read.save.progress);
      expect(fromStorage.ok, label).toBe(true);
      if (!fromStorage.ok) continue;
      expect(fromStorage.state, label).toEqual(state);
      expect(fromStorage.pose, label).toEqual(expectedPose);
    }
  });
});

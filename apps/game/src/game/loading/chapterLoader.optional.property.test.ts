import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChapterAsset, ChapterAssetKind, ChapterDefinition } from "../chapters/chapterRegistry";
import { createChapterLoader, type ChapterLoader } from "./chapterLoader";
import { createFakeFetch, createTestDeps, makeGlb, makePng, TEST_CHAPTER } from "../../test/fakeAssets";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/** File-specific base seed, derived from the shared core seed. */
const OPTIONAL_ASSETS_SEED = (CORE_PROPERTY_SEED + 0x10) >>> 0;

const STALL_TIMEOUT_MS = 1000;
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;
const KINDS: readonly ChapterAssetKind[] = ["gltf", "image"];
const OUTCOMES = ["success", "http-404", "invalid", "stall"] as const;
type Outcome = (typeof OUTCOMES)[number];

interface AssetCase {
  asset: ChapterAsset;
  outcome: Outcome;
  /** For a stall: bytes pushed before the body stops (0 means no response headers at all). */
  stallBytes: number;
}

interface ManifestCase {
  seed: number;
  assets: AssetCase[];
}

function describeCase(index: number, testCase: ManifestCase): string {
  const parts = testCase.assets.map(
    ({ asset, outcome, stallBytes }) =>
      `${asset.id}(${asset.kind}, ${asset.optional ? "optional" : "required"}, ${outcome}${outcome === "stall" ? ` ${stallBytes} B` : ""})`,
  );
  return `seed 0x${testCase.seed.toString(16)} case ${index}: ${parts.join(", ")}`;
}

function generateCase(seed: number): ManifestCase {
  const next = createLcg(seed);
  const requiredCount = randomInt(next, 0, 3);
  const optionalCount = randomInt(next, requiredCount === 0 ? 1 : 0, 3);
  const flags = [...Array<boolean>(requiredCount).fill(false), ...Array<boolean>(optionalCount).fill(true)];
  // Shuffle so optional assets are not always last in the manifest.
  for (let i = flags.length - 1; i > 0; i -= 1) {
    const j = randomInt(next, 0, i);
    [flags[i], flags[j]] = [flags[j], flags[i]];
  }
  const assets = flags.map((optional, index): AssetCase => {
    const kind = pick(next, KINDS);
    const extension = kind === "gltf" ? "glb" : "png";
    const asset: ChapterAsset = {
      id: `asset-${index}`,
      url: `/test/property/asset-${index}.${extension}`,
      kind,
      loadingText: `Loading asset ${index}`,
      ...(optional ? { optional: true } : {}),
    };
    // Weight success higher so "every required asset succeeds" is common enough.
    const outcome = pick(next, ["success", "success", ...OUTCOMES] as const);
    return { asset, outcome, stallBytes: outcome === "stall" ? pick(next, [0, 0, 16, 64]) : 0 };
  });
  return { seed, assets };
}

function validBytes(kind: ChapterAssetKind): Uint8Array<ArrayBuffer> {
  return kind === "gltf" ? makeGlb(undefined, 32) : makePng(96);
}

function setUpLoader(testCase: ManifestCase): { loader: ChapterLoader; startStalls: () => void } {
  const chapter: ChapterDefinition = { ...TEST_CHAPTER, assets: testCase.assets.map(({ asset }) => asset) };
  const fake = createFakeFetch();
  const stallStarts: Array<() => void> = [];
  for (const { asset, outcome, stallBytes } of testCase.assets) {
    if (outcome === "success") {
      fake.serve(asset.url, validBytes(asset.kind));
    } else if (outcome === "invalid") {
      // The SPA fallback page answered with HTTP 200 in place of the file.
      fake.serve(asset.url, new TextEncoder().encode("<!doctype html><html></html>"), { contentType: "text/html" });
    } else if (outcome === "stall") {
      const manual = fake.manual(asset.url);
      if (stallBytes > 0) {
        // Once the request is attached: send headers and a few bytes, then stop sending data.
        stallStarts.push(() => {
          if (manual.signal === null || manual.signal.aborted) return;
          manual.respond({ contentLength: 4096 });
          manual.push(new Uint8Array(stallBytes));
        });
      }
    }
    // "http-404": the URL is not registered, so the fake answers 404.
  }
  const loader = createChapterLoader(
    { kind: "new-game", chapterId: chapter.id },
    createTestDeps(fake.fetchImpl, {
      getChapter: (id) => (id === chapter.id ? chapter : undefined),
      stallTimeoutMs: STALL_TIMEOUT_MS,
    }),
  );
  return { loader, startStalls: () => stallStarts.forEach((start) => start()) };
}

function isTerminal(loader: ChapterLoader): boolean {
  const { stage } = loader.getSnapshot();
  return stage === "ready" || stage === "error";
}

/** Flushes pending work; if the loader is still waiting, lets the stall timer fire once. */
async function runToEnd(loader: ChapterLoader): Promise<void> {
  for (let i = 0; i < 20 && !isTerminal(loader); i += 1) await vi.advanceTimersByTimeAsync(0);
  if (!isTerminal(loader)) await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS + 5);
  for (let i = 0; i < 20 && !isTerminal(loader); i += 1) await vi.advanceTimersByTimeAsync(0);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("chapterLoader optional asset properties", () => {
  // Feature: game-3d-phone-call-ui, Property 10: Optional assets never block the chapter
  it(
    "Property 10: the chapter is ready exactly when every required asset succeeds (Requirements 9.12)",
    async () => {
      vi.useFakeTimers();
      const spies = CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
      const seenOutcomes = new Set<string>();
      let readyCases = 0;
      let errorCases = 0;
      let skippedCases = 0;

      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const testCase = generateCase(caseSeed(OPTIONAL_ASSETS_SEED, index));
        const label = describeCase(index, testCase);
        testCase.assets.forEach(({ asset, outcome }) =>
          seenOutcomes.add(`${asset.optional ? "optional" : "required"}:${outcome}`),
        );
        spies.forEach((spy) => spy.mockClear());

        const { loader, startStalls } = setUpLoader(testCase);
        loader.start();
        await vi.advanceTimersByTimeAsync(0);
        startStalls();
        await runToEnd(loader);
        const snapshot = loader.getSnapshot();
        loader.cancel();

        const requiredAllSucceed = testCase.assets.every(({ asset, outcome }) => asset.optional || outcome === "success");
        if (requiredAllSucceed) {
          readyCases += 1;
          expect(snapshot.stage, label).toBe("ready");
          expect(snapshot.error, label).toBeNull();
          expect(snapshot.session, label).not.toBeNull();
          expect(snapshot.filesTotal, label).toBe(testCase.assets.length);
          expect(snapshot.filesCompleted, label).toBe(snapshot.filesTotal);
          const skipped = testCase.assets.some(({ outcome }) => outcome !== "success");
          if (skipped) {
            skippedCases += 1;
            spies.forEach((spy, spyIndex) =>
              expect(spy, `${label}: console.${CONSOLE_METHODS[spyIndex]}`).not.toHaveBeenCalled(),
            );
          }
        } else {
          errorCases += 1;
          expect(snapshot.stage, label).toBe("error");
          expect(snapshot.error, label).not.toBeNull();
          expect(snapshot.session, label).toBeNull();
        }
      }

      // Every failure kind was exercised for both required and optional assets, and both
      // results (ready with skipped optional assets, and error) occurred.
      for (const optionality of ["required", "optional"]) {
        for (const outcome of OUTCOMES) expect(seenOutcomes).toContain(`${optionality}:${outcome}`);
      }
      expect(readyCases).toBeGreaterThan(0);
      expect(skippedCases).toBeGreaterThan(0);
      expect(errorCases).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

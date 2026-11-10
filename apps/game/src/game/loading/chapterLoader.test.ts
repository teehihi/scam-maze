import { afterEach, describe, expect, it, vi } from "vitest";
import { createChapterLoader, type ChapterLoadSnapshot } from "./chapterLoader";
import { createFakeFetch, createTestDeps, makeGlb, makePng, TEST_CHAPTER } from "../../test/fakeAssets";

const NEW_GAME = { kind: "new-game", chapterId: TEST_CHAPTER.id } as const;
const [MODEL, TEXTURE] = TEST_CHAPTER.assets;

function record(loader: ReturnType<typeof createChapterLoader>): ChapterLoadSnapshot[] {
  const seen: ChapterLoadSnapshot[] = [];
  loader.subscribe(() => seen.push(loader.getSnapshot()));
  return seen;
}

async function waitForStage(loader: ReturnType<typeof createChapterLoader>, stage: ChapterLoadSnapshot["stage"]) {
  await vi.waitFor(() => expect(loader.getSnapshot().stage).toBe(stage));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createChapterLoader", () => {
  it("starts in an indeterminate initial state and does nothing before start()", () => {
    const fake = createFakeFetch();
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    const snapshot = loader.getSnapshot();
    expect(snapshot.stage).toBe("starting");
    expect(snapshot.progress).toBeNull();
    expect(snapshot.session).toBeNull();
    expect(fake.calls).toHaveLength(0);
  });

  it("reports progress measured from real bytes once every file size is known", async () => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    const texture = fake.manual(TEXTURE.url);
    const glb = makeGlb(undefined, 300);
    const png = makePng(100);
    const total = glb.byteLength + png.byteLength;
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    loader.start();
    await waitForStage(loader, "loading-assets");

    model.respond({ contentLength: glb.byteLength });
    // Texture size still unknown: no percentage may be shown yet.
    await vi.waitFor(() => expect(loader.getSnapshot().progress).toBeNull());

    texture.respond({ contentLength: png.byteLength });
    await vi.waitFor(() => expect(loader.getSnapshot().progress).toBe(0));

    model.push(glb.slice(0, 100));
    await vi.waitFor(() => expect(loader.getSnapshot().progress).toBeCloseTo(100 / total));
    expect(loader.getSnapshot().currentAssetText).toBe(MODEL.loadingText);

    model.push(glb.slice(100));
    model.finish();
    await vi.waitFor(() => expect(loader.getSnapshot().filesCompleted).toBe(1));
    expect(loader.getSnapshot().progress).toBeCloseTo(glb.byteLength / total);
    expect(loader.getSnapshot().currentAssetText).toBe(TEXTURE.loadingText);

    texture.push(png);
    texture.finish();
    await waitForStage(loader, "ready");
    expect(loader.getSnapshot().progress).toBe(1);
  });

  it("stays indeterminate when the server does not report file sizes", async () => {
    const fake = createFakeFetch();
    fake.serve(TEXTURE.url, makePng(), { contentLength: null });
    const model = fake.manual(MODEL.url);
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    const seen = record(loader);
    loader.start();
    await waitForStage(loader, "loading-assets");
    model.respond({ contentLength: null });
    model.push(makeGlb());
    await vi.waitFor(() => expect(loader.getSnapshot().filesCompleted).toBe(1));
    expect(loader.getSnapshot().progress).toBeNull();
    expect(loader.getSnapshot().filesTotal).toBe(2);
    // While the model's size is unknown, no snapshot may carry a percentage.
    const beforeFinish = seen.filter((s) => s.stage === "loading-assets");
    expect(beforeFinish.length).toBeGreaterThan(0);
    expect(beforeFinish.every((s) => s.progress === null)).toBe(true);
    model.finish();
    await waitForStage(loader, "ready");
  });

  it("completes with a new-game session and progress never decreases", async () => {
    const fake = createFakeFetch();
    fake.serve(MODEL.url, makeGlb());
    fake.serve(TEXTURE.url, makePng());
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    const seen = record(loader);
    loader.start();
    await waitForStage(loader, "ready");

    expect(loader.getSnapshot().session).toEqual({
      chapterId: TEST_CHAPTER.id,
      chapterNumber: TEST_CHAPTER.number,
      sceneId: TEST_CHAPTER.startSceneId,
      origin: "new-game",
    });
    expect(seen.filter((s) => s.stage === "ready")).toHaveLength(1);
    const values = seen.map((s) => s.progress).filter((p): p is number => p !== null);
    values.forEach((value, index) => expect(value).toBeGreaterThanOrEqual(values[index - 1] ?? 0));
    expect(seen.map((s) => s.stage)).toEqual(
      expect.arrayContaining(["checking-device", "loading-assets", "initializing-state", "ready"]),
    );
  });

  it("finishes cached assets without waiting on any timer", async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch();
    fake.serve(MODEL.url, makeGlb());
    fake.serve(TEXTURE.url, makePng());
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    loader.start();
    // Only microtasks are flushed here; no fake time is advanced.
    for (let i = 0; i < 50 && loader.getSnapshot().stage !== "ready"; i++) await Promise.resolve();
    expect(loader.getSnapshot().stage).toBe("ready");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a missing asset and aborts the other downloads", async () => {
    const fake = createFakeFetch();
    const texture = fake.manual(TEXTURE.url);
    // MODEL.url is not registered, so the fake answers 404.
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    loader.start();
    await waitForStage(loader, "error");
    const { error, session } = loader.getSnapshot();
    expect(error?.code).toBe("asset-missing");
    expect(error?.retryable).toBe(true);
    expect(session).toBeNull();
    expect(texture.signal?.aborted).toBe(true);
  });

  it("rejects an HTML fallback page served in place of a GLB", async () => {
    const fake = createFakeFetch();
    fake.serve(MODEL.url, new TextEncoder().encode("<!doctype html><html></html>"), { contentType: "text/html" });
    fake.serve(TEXTURE.url, makePng());
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    loader.start();
    await waitForStage(loader, "error");
    expect(loader.getSnapshot().error?.code).toBe("asset-invalid");
  });

  it("classifies network failures", async () => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    fake.serve(TEXTURE.url, makePng());
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    loader.start();
    await waitForStage(loader, "loading-assets");
    await vi.waitFor(() => expect(model.signal).not.toBeNull());
    model.reject(new TypeError("Failed to fetch"));
    await waitForStage(loader, "error");
    expect(loader.getSnapshot().error?.code).toBe("network");
  });

  it("rejects an unknown chapter id without downloading anything", async () => {
    const fake = createFakeFetch();
    const loader = createChapterLoader({ kind: "new-game", chapterId: "chapter-99" }, createTestDeps(fake.fetchImpl));
    loader.start();
    await waitForStage(loader, "error");
    expect(loader.getSnapshot().error).toMatchObject({ code: "invalid-chapter", retryable: false });
    expect(fake.calls).toHaveLength(0);
  });

  it("stops on unsupported devices before downloading", async () => {
    const fake = createFakeFetch();
    const deps = createTestDeps(fake.fetchImpl, {
      probeDevice: () => ({ ok: false, code: "unsupported-device", detail: "no WebGL 2" }),
    });
    const loader = createChapterLoader(NEW_GAME, deps);
    loader.start();
    await waitForStage(loader, "error");
    expect(loader.getSnapshot().error?.code).toBe("unsupported-device");
    expect(fake.calls).toHaveLength(0);
  });

  it("reports a stalled download instead of loading forever", async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl, { stallTimeoutMs: 1000 }));
    loader.start();
    await vi.advanceTimersByTimeAsync(0);
    model.respond({ contentLength: 1000 });
    await vi.advanceTimersByTimeAsync(999);
    expect(loader.getSnapshot().stage).toBe("loading-assets");
    await vi.advanceTimersByTimeAsync(5);
    expect(loader.getSnapshot().stage).toBe("error");
    expect(loader.getSnapshot().error?.code).toBe("stalled");
    expect(model.signal?.aborted).toBe(true);
  });

  it("aborts downloads and stays silent after cancel()", async () => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    const listener = vi.fn();
    loader.subscribe(listener);
    loader.start();
    await waitForStage(loader, "loading-assets");
    await vi.waitFor(() => expect(model.signal).not.toBeNull());
    const callsBefore = listener.mock.calls.length;

    loader.cancel();
    expect(model.signal?.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(listener.mock.calls.length).toBe(callsBefore);
    expect(loader.getSnapshot().stage).toBe("loading-assets");
  });

  it("ignores repeated start() calls", async () => {
    const fake = createFakeFetch();
    fake.serve(MODEL.url, makeGlb());
    fake.serve(TEXTURE.url, makePng());
    const loader = createChapterLoader(NEW_GAME, createTestDeps(fake.fetchImpl));
    loader.start();
    loader.start();
    await waitForStage(loader, "ready");
    loader.start();
    expect(fake.calls).toEqual([MODEL.url, TEXTURE.url]);
  });

  describe("continue", () => {
    const validSave = {
      status: "valid",
      save: { formatVersion: 1, chapterId: TEST_CHAPTER.id, sceneId: "street", savedAt: "2026-11-10T08:00:00.000Z" },
    } as const;

    it("fails clearly when there is no save", async () => {
      const fake = createFakeFetch();
      const loader = createChapterLoader({ kind: "continue" }, createTestDeps(fake.fetchImpl));
      loader.start();
      await waitForStage(loader, "error");
      expect(loader.getSnapshot().error).toMatchObject({ code: "invalid-save", retryable: false });
      expect(fake.calls).toHaveLength(0);
    });

    it("rejects structurally invalid save data", async () => {
      const fake = createFakeFetch();
      const deps = createTestDeps(fake.fetchImpl, { save: { status: "invalid", reason: "bad json" } });
      const loader = createChapterLoader({ kind: "continue" }, deps);
      loader.start();
      await waitForStage(loader, "error");
      expect(loader.getSnapshot().error?.code).toBe("invalid-save");
    });

    it("restores a valid save, loads its assets and validates the restored state", async () => {
      const fake = createFakeFetch();
      fake.serve(MODEL.url, makeGlb());
      fake.serve(TEXTURE.url, makePng());
      const loader = createChapterLoader({ kind: "continue" }, createTestDeps(fake.fetchImpl, { save: validSave }));
      const seen = record(loader);
      loader.start();
      await waitForStage(loader, "ready");
      const stages = seen.map((s) => s.stage);
      expect(stages.indexOf("restoring-save")).toBeLessThan(stages.indexOf("loading-assets"));
      expect(stages.indexOf("loading-assets")).toBeLessThan(stages.indexOf("validating-save"));
      expect(loader.getSnapshot().session).toMatchObject({ origin: "saved-game", sceneId: "street" });
    });

    it("rejects a save whose scene does not belong to the chapter", async () => {
      const fake = createFakeFetch();
      fake.serve(MODEL.url, makeGlb());
      fake.serve(TEXTURE.url, makePng());
      const save = { status: "valid", save: { ...validSave.save, sceneId: "apartment" } } as const;
      const loader = createChapterLoader({ kind: "continue" }, createTestDeps(fake.fetchImpl, { save }));
      loader.start();
      await waitForStage(loader, "error");
      expect(loader.getSnapshot().error?.code).toBe("invalid-save");
      expect(loader.getSnapshot().session).toBeNull();
    });
  });
});

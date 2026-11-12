import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_LOADING_MIN_DISPLAY_MS, ChapterLoadingFlow } from "./ChapterLoadingFlow";
import { createFakeFetch, createTestDeps, makeGlb, makePng, TEST_CHAPTER } from "../../test/fakeAssets";
import type { ChapterLoadRequest } from "../../game/loading/chapterLoader";
import type { FetchLike } from "../../game/loading/assetFetcher";
import { getChapter } from "../../game/chapters/chapterRegistry";
import { applyLocale } from "../../i18n";
import {
  collectPropertyFailures,
  createClock,
  createLcg,
  describeRun,
  FADE_MS,
  generateBugConditionRuns,
  pick,
  PROPERTY_RUNS,
  PROPERTY_SEED,
  randomInt,
  visibleCheckpoints,
  type LoadingRun,
} from "../../test/loadingRuns";

const REQUEST: ChapterLoadRequest = { kind: "new-game", chapterId: TEST_CHAPTER.id };
const [MODEL, TEXTURE] = TEST_CHAPTER.assets;

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

function renderFlow(deps: ReturnType<typeof createTestDeps>, request: ChapterLoadRequest = REQUEST) {
  const onEnterChapter = vi.fn();
  const onBackToMenu = vi.fn();
  const utils = render(
    <StrictMode>
      <ChapterLoadingFlow request={request} deps={deps} onEnterChapter={onEnterChapter} onBackToMenu={onBackToMenu} />
    </StrictMode>,
  );
  return { ...utils, onEnterChapter, onBackToMenu };
}

beforeEach(() => mockReducedMotion(true));
afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error remove the test double so other suites see jsdom's default
  delete window.matchMedia;
});

describe("ChapterLoadingFlow", () => {
  it("shows the chapter and an indeterminate bar before sizes are known", async () => {
    const fake = createFakeFetch();
    fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    renderFlow(createTestDeps(fake.fetchImpl));

    expect(screen.getByRole("heading", { name: TEST_CHAPTER.title })).toBeTruthy();
    expect(screen.getByText("Chapter 7")).toBeTruthy();
    expect(screen.getByText(TEST_CHAPTER.subtitle)).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("data-state")).toBe("indeterminate");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(await screen.findByText(MODEL.loadingText)).toBeTruthy();
    expect(screen.queryByLabelText("Awareness tip")).toBeNull();
  });

  it("shows a measured percentage once every size is known", async () => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    const texture = fake.manual(TEXTURE.url);
    const glb = makeGlb(undefined, 1000);
    renderFlow(createTestDeps(fake.fetchImpl));
    await vi.waitFor(() => expect(model.signal).not.toBeNull());
    await vi.waitFor(() => expect(texture.signal).not.toBeNull());

    act(() => {
      model.respond({ contentLength: glb.byteLength });
      texture.respond({ contentLength: glb.byteLength });
    });
    await act(async () => model.push(glb.slice(0, glb.byteLength / 2)));

    await vi.waitFor(() => {
      const bar = screen.getByRole("progressbar");
      expect(bar.getAttribute("data-state")).toBe("determinate");
      expect(bar.getAttribute("aria-valuenow")).toBe("25");
    });
    expect(screen.getByText("25%")).toBeTruthy();
  });

  it("enters the chapter exactly once when loading succeeds", async () => {
    vi.useFakeTimers();
    const clock = createClock();
    const fake = createFakeFetch();
    fake.serve(MODEL.url, makeGlb());
    fake.serve(TEXTURE.url, makePng());
    const { onEnterChapter, onBackToMenu, rerender } = renderFlow(createTestDeps(fake.fetchImpl));

    // The files arrive at once; the screen is still held for the minimum display time.
    await clock.advanceTo(CHAPTER_LOADING_MIN_DISPLAY_MS - 1);
    expect(onEnterChapter).not.toHaveBeenCalled();
    // Reduced motion (set in beforeEach): no fade, so the chapter starts when the hold ends.
    await clock.advanceTo(CHAPTER_LOADING_MIN_DISPLAY_MS);
    expect(onEnterChapter).toHaveBeenCalledTimes(1);
    expect(onEnterChapter.mock.calls[0][0]).toMatchObject({ chapterId: TEST_CHAPTER.id, origin: "new-game" });

    // Re-rendering after completion must not trigger a second transition.
    rerender(
      <StrictMode>
        <ChapterLoadingFlow request={REQUEST} deps={createTestDeps(fake.fetchImpl)} onEnterChapter={onEnterChapter} onBackToMenu={onBackToMenu} />
      </StrictMode>,
    );
    await clock.advanceTo(clock.now + CHAPTER_LOADING_MIN_DISPLAY_MS + FADE_MS);
    expect(onEnterChapter).toHaveBeenCalledTimes(1);
    expect(onBackToMenu).not.toHaveBeenCalled();
  });

  it("waits for the fade-out before entering when motion is allowed", async () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const clock = createClock();
    const fake = createFakeFetch();
    fake.serve(MODEL.url, makeGlb());
    fake.serve(TEXTURE.url, makePng());
    const { onEnterChapter } = renderFlow(createTestDeps(fake.fetchImpl));

    const layer = screen.getByTestId("scene-transition");
    expect(layer.style.transitionDuration).toBe(`${FADE_MS}ms`);
    await clock.advanceTo(CHAPTER_LOADING_MIN_DISPLAY_MS - 1);
    expect(layer.getAttribute("data-state")).toBe("visible");
    await clock.advanceTo(CHAPTER_LOADING_MIN_DISPLAY_MS);
    expect(layer.getAttribute("data-state")).toBe("hidden");
    expect(onEnterChapter).not.toHaveBeenCalled();
    await clock.advanceTo(CHAPTER_LOADING_MIN_DISPLAY_MS + FADE_MS - 1);
    expect(onEnterChapter).not.toHaveBeenCalled();
    await clock.advanceTo(CHAPTER_LOADING_MIN_DISPLAY_MS + FADE_MS);
    expect(onEnterChapter).toHaveBeenCalledTimes(1);
  });

  it("uses instant transitions when the player prefers reduced motion", () => {
    const fake = createFakeFetch();
    fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    renderFlow(createTestDeps(fake.fetchImpl));
    expect(screen.getByTestId("scene-transition").style.transitionDuration).toBe("0ms");
  });

  it("shows a recoverable error for a missing asset and retries", async () => {
    const fake = createFakeFetch();
    fake.serve(TEXTURE.url, makePng());
    // MODEL.url is unregistered: 404.
    vi.useFakeTimers();
    const clock = createClock();
    const { onEnterChapter } = renderFlow(createTestDeps(fake.fetchImpl));

    await clock.advanceTo(0);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Game files are missing");
    expect(document.activeElement?.textContent).toBe("Game files are missing");

    // The error screen stays past the hold until the player acts.
    await clock.advanceTo(2 * CHAPTER_LOADING_MIN_DISPLAY_MS);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onEnterChapter).not.toHaveBeenCalled();

    fake.serve(MODEL.url, makeGlb());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    const retryAt = clock.now;
    // Retry restarts the hold.
    await clock.advanceTo(retryAt + CHAPTER_LOADING_MIN_DISPLAY_MS - 1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onEnterChapter).not.toHaveBeenCalled();
    await clock.advanceTo(retryAt + CHAPTER_LOADING_MIN_DISPLAY_MS);
    expect(onEnterChapter).toHaveBeenCalledTimes(1);
  });

  it("hides Retry when trying again cannot help", async () => {
    const fake = createFakeFetch();
    const { onBackToMenu } = renderFlow(createTestDeps(fake.fetchImpl), { kind: "new-game", chapterId: "nope" });
    await screen.findByRole("alert");
    expect(screen.getByText("Chapter not found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Return to menu" }));
    await vi.waitFor(() => expect(onBackToMenu).toHaveBeenCalledTimes(1));
  });

  it("cancels pending downloads when the player returns to the menu", async () => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    const { onBackToMenu, onEnterChapter } = renderFlow(createTestDeps(fake.fetchImpl));
    await vi.waitFor(() => expect(model.signal).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(model.signal?.aborted).toBe(true);
    await vi.waitFor(() => expect(onBackToMenu).toHaveBeenCalledTimes(1));
    expect(onEnterChapter).not.toHaveBeenCalled();
  });

  it("supports Escape to cancel loading", async () => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    const { onBackToMenu } = renderFlow(createTestDeps(fake.fetchImpl));
    await vi.waitFor(() => expect(model.signal).not.toBeNull());
    fireEvent.keyDown(window, { key: "Escape" });
    await vi.waitFor(() => expect(onBackToMenu).toHaveBeenCalledTimes(1));
  });

  it("aborts downloads on unmount and never calls back afterwards", async () => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    fake.serve(TEXTURE.url, makePng());
    const { unmount, onEnterChapter, onBackToMenu } = renderFlow(createTestDeps(fake.fetchImpl));
    await vi.waitFor(() => expect(model.signal).not.toBeNull());
    const errorSpy = vi.spyOn(console, "error");

    unmount();
    expect(fake.signals.every((signal) => signal.aborted)).toBe(true);
    model.respond({ contentLength: 10 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onEnterChapter).not.toHaveBeenCalled();
    expect(onBackToMenu).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

const CHAPTER_ONE = getChapter("chapter-1")!;
const CHAPTER_ONE_REQUEST: ChapterLoadRequest = { kind: "new-game", chapterId: "chapter-1" };
const [STREET, SKY, PHONE] = CHAPTER_ONE.assets;

/** Test deps that resolve the real Chapter 1 definition; its files are driven by the fake fetch. */
function chapterOneDeps(fetchImpl: FetchLike) {
  return createTestDeps(fetchImpl, { getChapter });
}

describe("ChapterLoadingFlow in Vietnamese", () => {
  it("shows the Chapter 1 title, label, subtitle, asset text and file count in Vietnamese", async () => {
    applyLocale("vi");
    const fake = createFakeFetch();
    fake.manual(STREET.url);
    fake.manual(SKY.url);
    fake.manual(PHONE.url);
    renderFlow(chapterOneDeps(fake.fetchImpl), CHAPTER_ONE_REQUEST);

    expect(screen.getByRole("heading", { name: "Cuộc gọi khẩn cấp" })).toBeTruthy();
    expect(screen.getByText("Chương 1")).toBeTruthy();
    expect(screen.getByText("Thông báo đến trước cả bữa sáng.")).toBeTruthy();
    // Asset text by asset ID; the first pending file is the street.
    expect(await screen.findByText("Đang tải con phố")).toBeTruthy();
    expect(screen.getByText(/0 \/ 3 tệp/)).toBeTruthy();
    expect(screen.queryByText(/of 3 files/)).toBeNull();
    expect(screen.queryByText(STREET.loadingText)).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Tiến trình tải" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeTruthy();
  });

  it("shows the Vietnamese loading text for the optional phone once the street and sky are done", async () => {
    applyLocale("vi");
    const fake = createFakeFetch();
    fake.serve(STREET.url, makeGlb());
    fake.serve(SKY.url, makePng());
    const phone = fake.manual(PHONE.url);
    renderFlow(chapterOneDeps(fake.fetchImpl), CHAPTER_ONE_REQUEST);
    await vi.waitFor(() => expect(phone.signal).not.toBeNull());

    expect(PHONE.id).toBe("call-phone");
    expect(await screen.findByText("Đang tải điện thoại")).toBeTruthy();
    expect(screen.getByText(/2 \/ 3 tệp/)).toBeTruthy();
    expect(screen.queryByText(PHONE.loadingText)).toBeNull();
  });

  it("shows a translated stage, the fallback chapter text and an Intl vi percentage", async () => {
    applyLocale("vi");
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    const texture = fake.manual(TEXTURE.url);
    const glb = makeGlb(undefined, 1000);
    renderFlow(createTestDeps(fake.fetchImpl));

    // The test chapter has no dictionary entry: the registry's English text is the fallback.
    expect(screen.getByRole("heading", { name: TEST_CHAPTER.title })).toBeTruthy();
    expect(screen.getByText("Chương 7")).toBeTruthy();
    await vi.waitFor(() => expect(model.signal).not.toBeNull());
    await vi.waitFor(() => expect(texture.signal).not.toBeNull());

    act(() => {
      model.respond({ contentLength: glb.byteLength });
      texture.respond({ contentLength: glb.byteLength });
    });
    await act(async () => model.push(glb.slice(0, glb.byteLength / 2)));

    const expectedPercent = new Intl.NumberFormat("vi", { style: "percent", maximumFractionDigits: 0 }).format(0.25);
    await vi.waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuetext")).toBe(expectedPercent));
    expect(screen.getByText(expectedPercent)).toBeTruthy();
  });

  it("shows the Vietnamese missing-file error with Thử lại and Về menu chính, and retries", async () => {
    applyLocale("vi");
    const fake = createFakeFetch();
    fake.serve(TEXTURE.url, makePng());
    vi.useFakeTimers();
    const clock = createClock();
    const { onEnterChapter } = renderFlow(createTestDeps(fake.fetchImpl));

    await clock.advanceTo(0);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Thiếu tệp trò chơi");
    expect(alert.textContent).toContain("Máy chủ không có một tệp mà chương này cần.");
    expect(document.activeElement?.textContent).toBe("Thiếu tệp trò chơi");
    expect(screen.getByRole("button", { name: "Về menu chính" })).toBeTruthy();

    fake.serve(MODEL.url, makeGlb());
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    const retryAt = clock.now;
    await clock.advanceTo(retryAt + CHAPTER_LOADING_MIN_DISPLAY_MS);
    expect(onEnterChapter).toHaveBeenCalledTimes(1);
  });

  it("hides Thử lại for an unknown chapter and returns with Về menu chính", async () => {
    applyLocale("vi");
    const fake = createFakeFetch();
    const { onBackToMenu } = renderFlow(createTestDeps(fake.fetchImpl), { kind: "new-game", chapterId: "nope" });
    await screen.findByRole("alert");
    expect(screen.getByText("Không tìm thấy chương")).toBeTruthy();
    expect(screen.getByText("Chương này không tồn tại hoặc chưa có. Hãy về menu chính để chọn lại.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Về menu chính" }));
    await vi.waitFor(() => expect(onBackToMenu).toHaveBeenCalledTimes(1));
  });

  it("switches the text to Vietnamese at runtime without restarting the load", async () => {
    const fake = createFakeFetch();
    const street = fake.manual(STREET.url);
    fake.manual(SKY.url);
    fake.manual(PHONE.url);
    const { onBackToMenu, onEnterChapter } = renderFlow(chapterOneDeps(fake.fetchImpl), CHAPTER_ONE_REQUEST);
    expect(await screen.findByText(STREET.loadingText)).toBeTruthy();
    await vi.waitFor(() => expect(street.signal).not.toBeNull());
    const heading = screen.getByRole("heading", { name: "The Urgent Call" });
    const bar = screen.getByRole("progressbar");
    const callsBefore = fake.calls.length;

    act(() => applyLocale("vi"));

    // Same DOM nodes, new text: the screen was not remounted.
    expect(heading.textContent).toBe("Cuộc gọi khẩn cấp");
    expect(screen.getByRole("progressbar")).toBe(bar);
    expect(screen.getByText("Chương 1")).toBeTruthy();
    expect(screen.getByText("Đang tải con phố")).toBeTruthy();
    expect(screen.getByText(/0 \/ 3 tệp/)).toBeTruthy();
    // The loader kept its downloads: no new requests, nothing aborted, no callback.
    expect(fake.calls.length).toBe(callsBefore);
    expect(street.signal?.aborted).toBe(false);
    expect(onBackToMenu).not.toHaveBeenCalled();
    expect(onEnterChapter).not.toHaveBeenCalled();
  });
});

/**
 * Runs one chapter loading run on the fake clock and returns the first broken expectation,
 * or null when the run behaves as expected. Both chapter files are served at once by the fake
 * fetch (like an HTTP cache hit); the requests are only answered at run.doneAtMs.
 */
async function runChapterLoading(run: LoadingRun): Promise<string | null> {
  mockReducedMotion(run.reducedMotion);
  vi.useFakeTimers();
  const clock = createClock();
  const fake = createFakeFetch();
  fake.serve(MODEL.url, makeGlb());
  fake.serve(TEXTURE.url, makePng());
  const delayedFetch: FetchLike = (url, init) =>
    new Promise<void>((resolve) => setTimeout(resolve, run.doneAtMs)).then(() => fake.fetchImpl(url, init));

  const { onEnterChapter, unmount } = renderFlow(createTestDeps(delayedFetch));
  const holdEndMs = Math.max(run.doneAtMs, CHAPTER_LOADING_MIN_DISPLAY_MS);
  const fadeMs = run.reducedMotion ? 0 : FADE_MS;
  const layerState = () => screen.getByTestId("scene-transition").getAttribute("data-state");
  try {
    if (layerState() !== "visible") return `t=0 (first render): data-state is "${layerState()}", expected "visible"`;
    for (const t of visibleCheckpoints(run.doneAtMs, holdEndMs)) {
      await clock.advanceTo(t);
      if (layerState() !== "visible") {
        return `t=${t}: data-state is "${layerState()}", expected "visible" until ${holdEndMs} ms`;
      }
    }
    await clock.advanceTo(holdEndMs);
    if (layerState() !== "hidden") return `t=${holdEndMs}: data-state is "${layerState()}", expected "hidden"`;
    await clock.advanceTo(holdEndMs + fadeMs);
    const calls = onEnterChapter.mock.calls.length;
    if (calls !== 1) return `t=${holdEndMs + fadeMs}: onEnterChapter called ${calls} times, expected 1`;
    return null;
  } finally {
    unmount();
    vi.useRealTimers();
  }
}

async function collectFailures(runs: LoadingRun[]): Promise<string[]> {
  const failures: string[] = [];
  for (const run of runs) {
    const failure = await runChapterLoading(run);
    if (failure) failures.push(`${describeRun(run)} -> ${failure}`);
  }
  return failures;
}

/*
 * Property 1: Bug Condition (task 1 of the loading-screen-not-visible bugfix spec).
 * Encodes the expected behavior; it FAILS on the unfixed code, which confirms the bug.
 * Counterexamples observed on the unfixed code (seed 0x5ca33a2e, 25 of 25 chapter runs failed):
 * - reducedMotion=false, any doneAtMs: data-state is "hidden" on the first render
 *   (SceneTransition starts at opacity 0 and fades in).
 * - reducedMotion=true, doneAtMs=0 / 16 / 50: data-state is "hidden" at t=doneAtMs, long before
 *   1500 ms (visibility follows the loader directly; there is no minimum display time).
 */
describe("Property 1: Bug Condition - chapter loading screen is opaque from the first frame and held", () => {
  it("cached chapter, ready after about 0 to 50 ms", async () => {
    const runs: LoadingRun[] = [0, 16, 50].flatMap((doneAtMs) => [
      { id: `cached-${doneAtMs}ms-motion`, screen: "chapter", reducedMotion: false, doneAtMs },
      { id: `cached-${doneAtMs}ms-reduced`, screen: "chapter", reducedMotion: true, doneAtMs },
    ]);
    const failures = await collectFailures(runs);
    expect(failures, `Counterexamples:\n${failures.join("\n")}`).toEqual([]);
  }, 30_000);

  it("holds for generated done times below the minimum display time (seeded runs)", async () => {
    const runs = generateBugConditionRuns().filter((run) => run.screen === "chapter");
    expect(runs.length).toBeGreaterThan(0);
    const failures = await collectFailures(runs);
    expect(failures, `Counterexamples (${failures.length} of ${runs.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 60_000);
});

/* ------------------------------------------------------------------------------------------ */
/* Property 2: Preservation                                                                    */
/* ------------------------------------------------------------------------------------------ */

const layerState = () => screen.getByTestId("scene-transition").getAttribute("data-state");
const layerDuration = () => screen.getByTestId("scene-transition").style.transitionDuration;

/** Reads the chapter bar: null for indeterminate, otherwise the aria-valuenow percentage. */
function readBar(): { state: string | null; valueNow: string | null } {
  const bar = screen.getByRole("progressbar");
  return { state: bar.getAttribute("data-state"), valueNow: bar.getAttribute("aria-valuenow") };
}

function expectBar(expectedPercent: number | null): string | null {
  const { state, valueNow } = readBar();
  if (expectedPercent === null) {
    if (state !== "indeterminate" || valueNow !== null) {
      return `bar is {state: ${state}, aria-valuenow: ${valueNow}}, expected indeterminate without aria-valuenow`;
    }
    return null;
  }
  if (state !== "determinate" || valueNow !== String(expectedPercent)) {
    return `bar is {state: ${state}, aria-valuenow: ${valueNow}}, expected determinate ${expectedPercent}`;
  }
  return null;
}

/** Wraps one generated run: motion preference, fake timers, cleanup. */
async function withFakeClock(reducedMotion: boolean, body: (clock: ReturnType<typeof createClock>) => Promise<string | null>) {
  mockReducedMotion(reducedMotion);
  vi.useFakeTimers();
  try {
    return await body(createClock());
  } finally {
    vi.useRealTimers();
  }
}

// Slow load: the loader reaches "ready" at or after the minimum display time.
interface SlowLoadCase {
  id: string;
  reducedMotion: boolean;
  doneAtMs: number;
}

function generateSlowLoadCases(): SlowLoadCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x10);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => ({
    id: `#${i}`,
    reducedMotion: next() < 0.5,
    doneAtMs: randomInt(next, CHAPTER_LOADING_MIN_DISPLAY_MS, 2 * CHAPTER_LOADING_MIN_DISPLAY_MS + 1000),
  }));
}

function runSlowLoad(item: SlowLoadCase): Promise<string | null> {
  return withFakeClock(item.reducedMotion, async (clock) => {
    const fake = createFakeFetch();
    fake.serve(MODEL.url, makeGlb());
    fake.serve(TEXTURE.url, makePng());
    const delayedFetch: FetchLike = (url, init) =>
      new Promise<void>((resolve) => setTimeout(resolve, item.doneAtMs)).then(() => fake.fetchImpl(url, init));
    const { onEnterChapter, onBackToMenu, unmount } = renderFlow(createTestDeps(delayedFetch));
    const fadeMs = item.reducedMotion ? 0 : FADE_MS;
    try {
      if (layerDuration() !== `${fadeMs}ms`) return `transitionDuration is "${layerDuration()}", expected "${fadeMs}ms"`;
      // Only the switch to hidden is asserted; the first frame belongs to Property 1.
      await clock.advanceTo(item.doneAtMs - 1);
      if (layerState() !== "visible") return `t=${item.doneAtMs - 1}: data-state is "${layerState()}", expected "visible" while loading`;
      await clock.advanceTo(item.doneAtMs);
      if (layerState() !== "hidden") return `t=${item.doneAtMs}: data-state is "${layerState()}", expected "hidden" at doneAtMs (no extra delay)`;
      if (fadeMs > 0) {
        await clock.advanceTo(item.doneAtMs + fadeMs - 1);
        if (onEnterChapter.mock.calls.length !== 0) return `t=${clock.now}: onEnterChapter called before the fade-out finished`;
      }
      await clock.advanceTo(item.doneAtMs + fadeMs);
      if (onEnterChapter.mock.calls.length !== 1) return `t=${clock.now}: onEnterChapter called ${onEnterChapter.mock.calls.length} times, expected 1`;
      await clock.advanceTo(item.doneAtMs + fadeMs + 1000);
      if (onEnterChapter.mock.calls.length !== 1) return `t=${clock.now}: onEnterChapter called ${onEnterChapter.mock.calls.length} times, expected 1`;
      if (onBackToMenu.mock.calls.length !== 0) return `onBackToMenu called ${onBackToMenu.mock.calls.length} times, expected 0`;
      return null;
    } finally {
      unmount();
    }
  });
}

// Progress honesty: byte chunks arrive; the bar must show exactly the measured value.
interface ProgressCase {
  id: string;
  reducedMotion: boolean;
  modelBytes: number;
  textureBytes: number;
  /** Which file reports no size (indeterminate bar), or null when both sizes are known. */
  unknownSize: "model" | "texture" | null;
  steps: Array<{ file: 0 | 1; bytes: number; waitMs: number }>;
}

function generateProgressCases(): ProgressCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x20);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => {
    const sizes = [randomInt(next, 300, 5000), randomInt(next, 300, 5000)];
    const unknownSize = next() < 0.25 ? pick(next, ["model", "texture"] as const) : null;
    const loaded = [0, 0];
    const steps: ProgressCase["steps"] = [];
    const count = randomInt(next, 1, 6);
    for (let j = 0; j < count; j += 1) {
      const file = (next() < 0.5 ? 0 : 1) as 0 | 1;
      // Keep every file below its size so no file completes (no GLB/PNG verification needed).
      const remaining = sizes[file] - loaded[file] - 1;
      if (remaining < 1) continue;
      const bytes = randomInt(next, 1, Math.max(1, Math.floor(remaining / 2)));
      loaded[file] += bytes;
      steps.push({ file, bytes, waitMs: randomInt(next, 0, 5000) });
    }
    return { id: `#${i}`, reducedMotion: next() < 0.5, modelBytes: sizes[0], textureBytes: sizes[1], unknownSize, steps };
  });
}

function describeProgressCase(item: ProgressCase): string {
  const steps = item.steps.map((step) => `${step.file === 0 ? "model" : "texture"}+${step.bytes}/wait ${step.waitMs}`).join(", ");
  return `case ${item.id} {reducedMotion: ${item.reducedMotion}, modelBytes: ${item.modelBytes}, textureBytes: ${item.textureBytes}, unknownSize: ${item.unknownSize}, steps: [${steps}]}`;
}

function runProgress(item: ProgressCase): Promise<string | null> {
  return withFakeClock(item.reducedMotion, async (clock) => {
    const fake = createFakeFetch();
    const assets = [fake.manual(MODEL.url), fake.manual(TEXTURE.url)];
    const { unmount } = renderFlow(createTestDeps(fake.fetchImpl));
    try {
      await clock.advanceTo(0);
      let failure = expectBar(null);
      if (failure) return `before any response: ${failure}`;

      assets[0].respond({ contentLength: item.unknownSize === "model" ? null : item.modelBytes });
      await clock.advanceTo(clock.now);
      // One size is still unknown here, so the bar must stay indeterminate.
      failure = expectBar(null);
      if (failure) return `after the model response only: ${failure}`;
      assets[1].respond({ contentLength: item.unknownSize === "texture" ? null : item.textureBytes });
      await clock.advanceTo(clock.now);

      const total = item.modelBytes + item.textureBytes;
      let loaded = 0;
      const expected = () => (item.unknownSize ? null : Math.round(Math.min(1, loaded / total) * 100));
      failure = expectBar(expected());
      if (failure) return `after both responses: ${failure}`;

      for (const [index, step] of item.steps.entries()) {
        assets[step.file].push(new Uint8Array(step.bytes));
        loaded += step.bytes;
        await clock.advanceTo(clock.now);
        failure = expectBar(expected());
        if (failure) return `step ${index} (t=${clock.now}): ${failure}`;
        // Time passing without new bytes never changes the value.
        await clock.advanceTo(clock.now + step.waitMs);
        failure = expectBar(expected());
        if (failure) return `step ${index}, after waiting ${step.waitMs} ms (t=${clock.now}): ${failure}`;
      }
      return null;
    } finally {
      unmount();
    }
  });
}

// Stall: no bytes for the stall timeout.
interface StallCase {
  id: string;
  reducedMotion: boolean;
  stallTimeoutMs: number;
  waitAfterMs: number;
}

function generateStallCases(): StallCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x30);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => ({
    id: `#${i}`,
    reducedMotion: next() < 0.5,
    stallTimeoutMs: randomInt(next, 1000, 20_000),
    waitAfterMs: randomInt(next, 1000, 60_000),
  }));
}

function runStall(item: StallCase): Promise<string | null> {
  return withFakeClock(item.reducedMotion, async (clock) => {
    const fake = createFakeFetch();
    fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    const { onEnterChapter, onBackToMenu, unmount } = renderFlow(
      createTestDeps(fake.fetchImpl, { stallTimeoutMs: item.stallTimeoutMs }),
    );
    try {
      await clock.advanceTo(item.stallTimeoutMs - 1);
      if (screen.queryByRole("alert")) return `t=${clock.now}: error shown before the stall timeout`;
      await clock.advanceTo(item.stallTimeoutMs);
      const alert = screen.queryByRole("alert");
      if (!alert?.textContent?.includes("Loading stopped")) return `t=${clock.now}: "stalled" error not shown at the stall timeout`;
      if (!fake.signals.every((signal) => signal.aborted)) return `t=${clock.now}: downloads were not aborted on stall`;
      if (!screen.queryByRole("button", { name: "Try again" })) return `t=${clock.now}: Retry button missing`;
      if (!screen.queryByRole("button", { name: "Return to menu" })) return `t=${clock.now}: Back to menu button missing`;

      // The error stays until the player acts.
      await clock.advanceTo(item.stallTimeoutMs + item.waitAfterMs);
      if (!screen.queryByRole("alert")?.textContent?.includes("Loading stopped")) return `t=${clock.now}: error disappeared without a player action`;
      if (layerState() !== "visible") return `t=${clock.now}: data-state is "${layerState()}", expected "visible" while the error is shown`;
      if (onEnterChapter.mock.calls.length + onBackToMenu.mock.calls.length !== 0) return `t=${clock.now}: a handler was called without a player action`;
      return null;
    } finally {
      unmount();
    }
  });
}

// Retry: a failed attempt is replaced by a new one; the old attempt's events are ignored.
interface RetryCase {
  id: string;
  reducedMotion: boolean;
  retryAtMs: number;
  glbExtraBytes: number;
  textureBytes: number;
  /** Fraction of the model pushed before checking progress, in (0, 1). */
  firstChunkRatio: number;
}

function generateRetryCases(): RetryCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x40);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => ({
    id: `#${i}`,
    reducedMotion: next() < 0.5,
    retryAtMs: randomInt(next, 0, 3000),
    glbExtraBytes: randomInt(next, 200, 4000),
    textureBytes: randomInt(next, 64, 4000),
    firstChunkRatio: 0.05 + next() * 0.9,
  }));
}

function runRetry(item: RetryCase): Promise<string | null> {
  return withFakeClock(item.reducedMotion, async (clock) => {
    // Attempt 1: the model is missing (HTTP 404) and the texture never answers.
    const first = createFakeFetch();
    const oldTexture = first.manual(TEXTURE.url);
    const second = createFakeFetch();
    const model = second.manual(MODEL.url);
    const texture = second.manual(TEXTURE.url);
    let current = first.fetchImpl;
    const switchingFetch: FetchLike = (url, init) => current(url, init);
    const { onEnterChapter, onBackToMenu, unmount } = renderFlow(createTestDeps(switchingFetch));
    const fadeMs = item.reducedMotion ? 0 : FADE_MS;
    try {
      await clock.advanceTo(item.retryAtMs);
      if (!screen.queryByRole("alert")?.textContent?.includes("Game files are missing")) return `t=${clock.now}: first attempt did not show the missing-file error`;

      current = second.fetchImpl;
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await clock.advanceTo(item.retryAtMs);
      if (screen.queryByRole("alert")) return `t=${clock.now}: error still shown after Retry`;
      if (!second.calls.includes(MODEL.url) || !second.calls.includes(TEXTURE.url)) return `t=${clock.now}: Retry did not start a new attempt`;
      if (!first.signals.every((signal) => signal.aborted)) return `t=${clock.now}: old attempt downloads were not aborted`;

      // Late events from the old attempt are ignored.
      oldTexture.respond({ contentLength: 10 });
      oldTexture.push(new Uint8Array(5));
      oldTexture.reject(new Error("late failure from the old attempt"));
      await clock.advanceTo(clock.now);
      if (screen.queryByRole("alert")) return `t=${clock.now}: old attempt event showed an error`;
      let failure = expectBar(null);
      if (failure) return `t=${clock.now}, after old attempt events: ${failure}`;

      // The new attempt reports its own measured progress.
      const glb = makeGlb(undefined, item.glbExtraBytes);
      const png = makePng(item.textureBytes);
      const total = glb.byteLength + png.byteLength;
      const firstChunk = Math.max(1, Math.min(glb.byteLength - 1, Math.floor(glb.byteLength * item.firstChunkRatio)));
      model.respond({ contentLength: glb.byteLength });
      texture.respond({ contentLength: png.byteLength });
      model.push(glb.slice(0, firstChunk));
      await clock.advanceTo(clock.now);
      failure = expectBar(Math.round((firstChunk / total) * 100));
      if (failure) return `t=${clock.now}, new attempt: ${failure}`;
      oldTexture.push(new Uint8Array(5));
      await clock.advanceTo(clock.now);
      failure = expectBar(Math.round((firstChunk / total) * 100));
      if (failure) return `t=${clock.now}, after a late old attempt chunk: ${failure}`;

      model.push(glb.slice(firstChunk));
      model.finish();
      texture.push(png);
      texture.finish();
      // Wait long enough for any presentation delay plus the fade-out.
      const end = clock.now + 2 * CHAPTER_LOADING_MIN_DISPLAY_MS + fadeMs;
      await clock.advanceTo(end);
      if (onEnterChapter.mock.calls.length !== 1) return `t=${end}: onEnterChapter called ${onEnterChapter.mock.calls.length} times, expected 1`;
      if (onBackToMenu.mock.calls.length !== 0) return `t=${end}: onBackToMenu called ${onBackToMenu.mock.calls.length} times, expected 0`;
      return null;
    } finally {
      unmount();
    }
  });
}

// Bypass: Cancel, Escape or "Return to menu" at a generated time.
type BypassAction = "cancel" | "escape" | "return-to-menu";

interface BypassCase {
  id: string;
  reducedMotion: boolean;
  bypassAtMs: number;
  action: BypassAction;
}

function generateBypassCases(): BypassCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x50);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => ({
    id: `#${i}`,
    reducedMotion: next() < 0.5,
    bypassAtMs: randomInt(next, 0, 2 * CHAPTER_LOADING_MIN_DISPLAY_MS),
    action: pick(next, ["cancel", "escape", "return-to-menu"] as const),
  }));
}

function runBypass(item: BypassCase): Promise<string | null> {
  return withFakeClock(item.reducedMotion, async (clock) => {
    const fake = createFakeFetch();
    // "Return to menu" is offered on the error screen: the model is missing (HTTP 404).
    if (item.action !== "return-to-menu") fake.manual(MODEL.url);
    fake.manual(TEXTURE.url);
    const { onEnterChapter, onBackToMenu, unmount } = renderFlow(createTestDeps(fake.fetchImpl));
    const fadeMs = item.reducedMotion ? 0 : FADE_MS;
    try {
      if (layerDuration() !== `${fadeMs}ms`) return `transitionDuration is "${layerDuration()}", expected "${fadeMs}ms"`;
      await clock.advanceTo(item.bypassAtMs);
      if (item.action === "cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      else if (item.action === "escape") fireEvent.keyDown(window, { key: "Escape" });
      else {
        if (!screen.queryByRole("alert")) return `t=${clock.now}: error screen not shown`;
        fireEvent.click(screen.getByRole("button", { name: "Return to menu" }));
      }
      if (!fake.signals.every((signal) => signal.aborted)) return `t=${clock.now}: downloads not aborted at once`;
      await clock.advanceTo(item.bypassAtMs);
      if (layerState() !== "hidden") return `t=${item.bypassAtMs}: data-state is "${layerState()}", expected "hidden" at bypassAtMs`;
      if (fadeMs > 0) {
        await clock.advanceTo(item.bypassAtMs + fadeMs - 1);
        if (onBackToMenu.mock.calls.length !== 0) return `t=${clock.now}: onBackToMenu called before the fade-out finished`;
      }
      await clock.advanceTo(item.bypassAtMs + fadeMs);
      if (onBackToMenu.mock.calls.length !== 1) return `t=${clock.now}: onBackToMenu called ${onBackToMenu.mock.calls.length} times, expected 1`;
      await clock.advanceTo(item.bypassAtMs + fadeMs + 2 * CHAPTER_LOADING_MIN_DISPLAY_MS);
      if (onBackToMenu.mock.calls.length !== 1) return `t=${clock.now}: onBackToMenu called ${onBackToMenu.mock.calls.length} times, expected 1`;
      if (onEnterChapter.mock.calls.length !== 0) return `t=${clock.now}: onEnterChapter called ${onEnterChapter.mock.calls.length} times, expected 0`;
      return null;
    } finally {
      unmount();
    }
  });
}

// Unmount during loading.
interface UnmountCase {
  id: string;
  reducedMotion: boolean;
  unmountAtMs: number;
  modelResponded: boolean;
}

function generateUnmountCases(): UnmountCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x60);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => ({
    id: `#${i}`,
    reducedMotion: next() < 0.5,
    unmountAtMs: randomInt(next, 0, 2 * CHAPTER_LOADING_MIN_DISPLAY_MS),
    modelResponded: next() < 0.5,
  }));
}

function runUnmount(item: UnmountCase): Promise<string | null> {
  return withFakeClock(item.reducedMotion, async (clock) => {
    const fake = createFakeFetch();
    const model = fake.manual(MODEL.url);
    fake.serve(TEXTURE.url, makePng());
    const { onEnterChapter, onBackToMenu, unmount } = renderFlow(createTestDeps(fake.fetchImpl));
    let mounted = true;
    const errorSpy = vi.spyOn(console, "error");
    try {
      if (item.modelResponded) {
        model.respond({ contentLength: 100 });
        model.push(new Uint8Array(10));
      }
      await clock.advanceTo(item.unmountAtMs);
      errorSpy.mockClear();
      unmount();
      mounted = false;
      if (!fake.signals.every((signal) => signal.aborted)) return `t=${clock.now}: downloads not aborted on unmount`;
      if (vi.getTimerCount() !== 0) return `t=${clock.now}: ${vi.getTimerCount()} timers still pending after unmount`;

      // Late events after unmount send no updates. respond() opens a fresh stream, because the
      // first one was closed by the abort.
      model.respond({ contentLength: 10 });
      model.push(new Uint8Array(5));
      await clock.advanceTo(clock.now + 2 * CHAPTER_LOADING_MIN_DISPLAY_MS + FADE_MS);
      if (onEnterChapter.mock.calls.length + onBackToMenu.mock.calls.length !== 0) return `t=${clock.now}: a handler was called after unmount`;
      if (errorSpy.mock.calls.length !== 0) return `console.error called: ${String(errorSpy.mock.calls[0]?.[0])}`;
      return null;
    } finally {
      errorSpy.mockRestore();
      if (mounted) unmount();
    }
  });
}

function assertNoFailures(failures: string[], total: number) {
  expect(failures, `Counterexamples (${failures.length} of ${total} runs):\n${failures.join("\n")}`).toEqual([]);
}

/*
 * Property 2: Preservation (task 2 of the loading-screen-not-visible bugfix spec).
 * Baseline observed on the unfixed code (seed 0x5ca33a2e); these tests pass before the fix and
 * must keep passing after it. They never assert the first frame or the hold (Property 1).
 */
describe("Property 2: Preservation - chapter loading behavior outside the bug condition", () => {
  it("slow load: hidden exactly at doneAtMs, onEnterChapter once after the fade (seeded runs)", async () => {
    const cases = generateSlowLoadCases();
    const failures = await collectPropertyFailures(cases, (c) => `case ${c.id} {reducedMotion: ${c.reducedMotion}, doneAtMs: ${c.doneAtMs}}`, runSlowLoad);
    assertNoFailures(failures, cases.length);
  }, 60_000);

  it("progress honesty: the bar shows only measured byte progress (seeded runs)", async () => {
    const cases = generateProgressCases();
    const failures = await collectPropertyFailures(cases, describeProgressCase, runProgress);
    assertNoFailures(failures, cases.length);
  }, 60_000);

  it("stall: shows the stalled error with Retry and Back to menu until the player acts (seeded runs)", async () => {
    const cases = generateStallCases();
    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} {reducedMotion: ${c.reducedMotion}, stallTimeoutMs: ${c.stallTimeoutMs}, waitAfterMs: ${c.waitAfterMs}}`,
      runStall,
    );
    assertNoFailures(failures, cases.length);
  }, 60_000);

  it("retry: starts a new attempt and ignores the old attempt's events (seeded runs)", async () => {
    const cases = generateRetryCases();
    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} {reducedMotion: ${c.reducedMotion}, retryAtMs: ${c.retryAtMs}, glbExtraBytes: ${c.glbExtraBytes}, textureBytes: ${c.textureBytes}, firstChunkRatio: ${c.firstChunkRatio.toFixed(3)}}`,
      runRetry,
    );
    assertNoFailures(failures, cases.length);
  }, 60_000);

  it("bypass: Cancel, Escape or Return to menu aborts at once and returns to the menu once (seeded runs)", async () => {
    const cases = generateBypassCases();
    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} {reducedMotion: ${c.reducedMotion}, bypassAtMs: ${c.bypassAtMs}, action: ${c.action}}`,
      runBypass,
    );
    assertNoFailures(failures, cases.length);
  }, 60_000);

  it("unmount: aborts downloads, clears every timer and calls nothing (seeded runs)", async () => {
    const cases = generateUnmountCases();
    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} {reducedMotion: ${c.reducedMotion}, unmountAtMs: ${c.unmountAtMs}, modelResponded: ${c.modelResponded}}`,
      runUnmount,
    );
    assertNoFailures(failures, cases.length);
  }, 60_000);
});

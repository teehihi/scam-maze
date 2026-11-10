import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const progressState = { active: false, loaded: 0, total: 0, errors: [] as string[], item: "", progress: 0 };
vi.mock("@react-three/drei", () => ({ useProgress: () => progressState }));

import { MenuStartupLoading, STARTUP_LOADING_MIN_DISPLAY_MS, STARTUP_SLOW_NOTICE_MS } from "./MenuStartupLoading";
import {
  collectPropertyFailures,
  createClock,
  createLcg,
  describeRun,
  FADE_MS,
  generateBugConditionRuns,
  mockReducedMotion,
  PROPERTY_RUNS,
  PROPERTY_SEED,
  randomInt,
  restoreMatchMedia,
  visibleCheckpoints,
  type LoadingRun,
} from "../../test/loadingRuns";
import { formatFileCount, LOADING_TEXT } from "../../game/loading/loadingStrings";

function setProgress(patch: Partial<typeof progressState>) {
  Object.assign(progressState, patch);
}

beforeEach(() => {
  setProgress({ active: false, loaded: 0, total: 0, errors: [] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MenuStartupLoading", () => {
  it("shows an indeterminate bar with the real file count", () => {
    setProgress({ active: true, loaded: 1, total: 3 });
    render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={() => {}} />);
    expect(screen.getByRole("progressbar").getAttribute("data-state")).toBe("indeterminate");
    expect(screen.getByText("Loading the street scene")).toBeTruthy();
    expect(screen.getByText(/1 of 3 files/)).toBeTruthy();
  });

  it("finishes only when the scene reports ready", async () => {
    vi.useFakeTimers();
    const clock = createClock();
    setProgress({ loaded: 3, total: 3 });
    const onFinished = vi.fn();
    const { rerender } = render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={onFinished} />);
    expect(screen.getByText("Preparing the street scene")).toBeTruthy();
    // The hold alone never finishes the screen: the scene must report ready.
    await clock.advanceTo(2 * STARTUP_LOADING_MIN_DISPLAY_MS);
    expect(onFinished).not.toHaveBeenCalled();
    expect(screen.getByTestId("scene-transition").getAttribute("data-state")).toBe("visible");

    rerender(<MenuStartupLoading sceneReady sceneError={null} onFinished={onFinished} />);
    const readyAt = clock.now;
    // The hold has passed, so the fade-out starts at once (motion allowed: jsdom has no matchMedia).
    expect(screen.getByTestId("scene-transition").getAttribute("data-state")).toBe("hidden");
    await clock.advanceTo(readyAt + FADE_MS - 1);
    expect(onFinished).not.toHaveBeenCalled();
    await clock.advanceTo(readyAt + FADE_MS);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("shows Ready while the screen is held after the scene reports ready", async () => {
    vi.useFakeTimers();
    const clock = createClock();
    setProgress({ loaded: 3, total: 3 });
    const onFinished = vi.fn();
    const { rerender } = render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={onFinished} />);
    rerender(<MenuStartupLoading sceneReady sceneError={null} onFinished={onFinished} />);

    const layer = screen.getByTestId("scene-transition");
    expect(layer.getAttribute("data-state")).toBe("visible");
    expect(screen.getByText(LOADING_TEXT.menuStartup.ready)).toBeTruthy();
    expect(screen.queryByText(/of 3 files/)).toBeNull();
    await clock.advanceTo(STARTUP_LOADING_MIN_DISPLAY_MS - 1);
    expect(layer.getAttribute("data-state")).toBe("visible");
    expect(screen.getByText(LOADING_TEXT.menuStartup.ready)).toBeTruthy();
    // The hold never invents progress: the bar stays indeterminate.
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("data-state")).toBe("indeterminate");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(onFinished).not.toHaveBeenCalled();

    await clock.advanceTo(STARTUP_LOADING_MIN_DISPLAY_MS);
    expect(layer.getAttribute("data-state")).toBe("hidden");
    await clock.advanceTo(STARTUP_LOADING_MIN_DISPLAY_MS + FADE_MS);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("shows a recovery path when a file fails", async () => {
    vi.useFakeTimers();
    const clock = createClock();
    setProgress({ loaded: 1, total: 2, errors: ["/assets/missing.glb"] });
    const onFinished = vi.fn();
    render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={onFinished} />);
    expect(screen.getByRole("alert").textContent).toContain("/assets/missing.glb");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue to menu" }));
    // "Continue to menu" skips the hold: only the fade-out remains.
    expect(screen.getByTestId("scene-transition").getAttribute("data-state")).toBe("hidden");
    await clock.advanceTo(FADE_MS - 1);
    expect(onFinished).not.toHaveBeenCalled();
    await clock.advanceTo(FADE_MS);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("offers a way out when nothing changes for a long time", () => {
    vi.useFakeTimers();
    setProgress({ active: true, loaded: 0, total: 2 });
    render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={() => {}} />);
    expect(screen.queryByText(/longer than usual/)).toBeNull();
    act(() => vi.advanceTimersByTime(STARTUP_SLOW_NOTICE_MS - 1));
    expect(screen.queryByText(/longer than usual/)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/longer than usual/)).toBeTruthy();
    // The watchdog never invents progress.
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuenow")).toBe(false);
  });
});

/**
 * Runs one startup loading run on the fake clock and returns the first broken expectation, or
 * null when the run behaves as expected. The menu scene reports ready (sceneReady={true}) at
 * run.doneAtMs; useProgress stays mocked with every file loaded.
 */
async function runStartupLoading(run: LoadingRun): Promise<string | null> {
  mockReducedMotion(run.reducedMotion);
  vi.useFakeTimers();
  setProgress({ active: false, loaded: 3, total: 3, errors: [] });
  const clock = createClock();
  const onFinished = vi.fn();
  const { rerender, unmount } = render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={onFinished} />);
  let ready = false;
  const markReady = () => {
    if (ready) return;
    ready = true;
    rerender(<MenuStartupLoading sceneReady sceneError={null} onFinished={onFinished} />);
  };
  const holdEndMs = Math.max(run.doneAtMs, STARTUP_LOADING_MIN_DISPLAY_MS);
  const fadeMs = run.reducedMotion ? 0 : FADE_MS;
  const layerState = () => screen.getByTestId("scene-transition").getAttribute("data-state");
  try {
    if (layerState() !== "visible") return `t=0 (first render): data-state is "${layerState()}", expected "visible"`;
    for (const t of visibleCheckpoints(run.doneAtMs, holdEndMs)) {
      await clock.advanceTo(t);
      if (t >= run.doneAtMs) markReady();
      await clock.advanceTo(t);
      if (layerState() !== "visible") {
        return `t=${t}: data-state is "${layerState()}", expected "visible" until ${holdEndMs} ms`;
      }
    }
    await clock.advanceTo(holdEndMs);
    markReady();
    await clock.advanceTo(holdEndMs);
    if (layerState() !== "hidden") return `t=${holdEndMs}: data-state is "${layerState()}", expected "hidden"`;
    await clock.advanceTo(holdEndMs + fadeMs);
    const calls = onFinished.mock.calls.length;
    if (calls !== 1) return `t=${holdEndMs + fadeMs}: onFinished called ${calls} times, expected 1`;
    return null;
  } finally {
    unmount();
    vi.useRealTimers();
    restoreMatchMedia();
  }
}

async function collectStartupFailures(runs: LoadingRun[]): Promise<string[]> {
  const failures: string[] = [];
  for (const run of runs) {
    const failure = await runStartupLoading(run);
    if (failure) failures.push(`${describeRun(run)} -> ${failure}`);
  }
  return failures;
}

/*
 * Property 1: Bug Condition (task 1 of the loading-screen-not-visible bugfix spec).
 * Encodes the expected behavior; it FAILS on the unfixed code, which confirms the bug.
 * Counterexamples observed on the unfixed code (seed 0x5ca33a2e, 25 of 25 startup runs failed):
 * - reducedMotion=false, any doneAtMs: data-state is "hidden" on the first render
 *   (SceneTransition starts at opacity 0 and fades in).
 * - reducedMotion=true, sceneReady at 0 ms: data-state is "hidden" at t=0; for example
 *   doneAtMs=1 is "hidden" at t=1, far below 1200 ms (no minimum display time).
 */
describe("Property 1: Bug Condition - startup loading screen is opaque from the first frame and held", () => {
  it("sceneReady true at 0 ms", async () => {
    const runs: LoadingRun[] = [
      { id: "ready-0ms-motion", screen: "startup", reducedMotion: false, doneAtMs: 0 },
      { id: "ready-0ms-reduced", screen: "startup", reducedMotion: true, doneAtMs: 0 },
    ];
    const failures = await collectStartupFailures(runs);
    expect(failures, `Counterexamples:\n${failures.join("\n")}`).toEqual([]);
  }, 30_000);

  it("holds for generated scene-ready times below the minimum display time (seeded runs)", async () => {
    const runs = generateBugConditionRuns().filter((run) => run.screen === "startup");
    expect(runs.length).toBeGreaterThan(0);
    const failures = await collectStartupFailures(runs);
    expect(failures, `Counterexamples (${failures.length} of ${runs.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 60_000);
});

/* ------------------------------------------------------------------------------------------ */
/* Property 2: Preservation                                                                    */
/* ------------------------------------------------------------------------------------------ */

async function withStartupClock(reducedMotion: boolean, body: (clock: ReturnType<typeof createClock>) => Promise<string | null>) {
  mockReducedMotion(reducedMotion);
  vi.useFakeTimers();
  try {
    return await body(createClock());
  } finally {
    vi.useRealTimers();
    restoreMatchMedia();
  }
}

// Progress honesty: the startup bar is always indeterminate and shows the real file count.
interface StartupProgressCase {
  id: string;
  reducedMotion: boolean;
  steps: Array<{ loaded: number; total: number; waitMs: number }>;
}

function generateStartupProgressCases(): StartupProgressCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x70);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => {
    const steps: StartupProgressCase["steps"] = [];
    const count = randomInt(next, 1, 5);
    for (let j = 0; j < count; j += 1) {
      const total = next() < 0.15 ? 0 : randomInt(next, 1, 40);
      // Stays below the 30-second slow notice even if nothing changes between steps.
      steps.push({ loaded: randomInt(next, 0, total), total, waitMs: randomInt(next, 0, 5000) });
    }
    return { id: `#${i}`, reducedMotion: next() < 0.5, steps };
  });
}

function expectedStartupStatus(loaded: number, total: number): { status: string; detail: string | null } {
  if (total > 0 && loaded < total) return { status: LOADING_TEXT.menuStartup.loadingFiles, detail: formatFileCount(loaded, total) };
  if (total > 0) return { status: LOADING_TEXT.menuStartup.preparingScene, detail: null };
  return { status: LOADING_TEXT.menuStartup.startingEngine, detail: null };
}

function checkStartupBar(loaded: number, total: number): string | null {
  const bar = screen.getByRole("progressbar");
  if (bar.hasAttribute("aria-valuenow")) return `bar has aria-valuenow="${bar.getAttribute("aria-valuenow")}", expected none`;
  if (bar.getAttribute("data-state") !== "indeterminate") return `bar data-state is "${bar.getAttribute("data-state")}", expected "indeterminate"`;
  const { status, detail } = expectedStartupStatus(loaded, total);
  const line = bar.parentElement?.querySelector('[aria-live="polite"]')?.textContent ?? "";
  const expectedLine = detail ? `${status}· ${detail}` : status;
  if (line !== expectedLine) return `status line is "${line}", expected "${expectedLine}"`;
  return null;
}

function runStartupProgress(item: StartupProgressCase): Promise<string | null> {
  return withStartupClock(item.reducedMotion, async (clock) => {
    setProgress({ active: true, loaded: 0, total: 0, errors: [] });
    const onFinished = vi.fn();
    const ui = () => <MenuStartupLoading sceneReady={false} sceneError={null} onFinished={onFinished} />;
    const { rerender, unmount } = render(ui());
    try {
      for (const [index, step] of item.steps.entries()) {
        setProgress({ loaded: step.loaded, total: step.total });
        rerender(ui());
        await clock.advanceTo(clock.now);
        let failure = checkStartupBar(step.loaded, step.total);
        if (failure) return `step ${index} (t=${clock.now}): ${failure}`;
        // Time passing never changes the bar or the file count.
        await clock.advanceTo(clock.now + step.waitMs);
        failure = checkStartupBar(step.loaded, step.total);
        if (failure) return `step ${index}, after waiting ${step.waitMs} ms (t=${clock.now}): ${failure}`;
      }
      if (onFinished.mock.calls.length !== 0) return `onFinished called while the scene is not ready`;
      return null;
    } finally {
      unmount();
    }
  });
}

// Continue to menu: from a file error or from the slow notice.
interface ContinueCase {
  id: string;
  reducedMotion: boolean;
  variant: "file-error" | "slow-notice";
  bypassAtMs: number;
}

function generateContinueCases(): ContinueCase[] {
  const next = createLcg(PROPERTY_SEED ^ 0x80);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => {
    const variant = next() < 0.5 ? "file-error" : "slow-notice";
    const bypassAtMs =
      variant === "file-error"
        ? randomInt(next, 0, 2 * STARTUP_LOADING_MIN_DISPLAY_MS)
        : STARTUP_SLOW_NOTICE_MS + randomInt(next, 0, 5000);
    return { id: `#${i}`, reducedMotion: next() < 0.5, variant, bypassAtMs };
  });
}

function runContinue(item: ContinueCase): Promise<string | null> {
  return withStartupClock(item.reducedMotion, async (clock) => {
    if (item.variant === "file-error") setProgress({ active: false, loaded: 1, total: 2, errors: ["/assets/missing.glb"] });
    else setProgress({ active: true, loaded: 0, total: 2, errors: [] });
    const onFinished = vi.fn();
    const { unmount } = render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={onFinished} />);
    const fadeMs = item.reducedMotion ? 0 : FADE_MS;
    const finishedCalls = () => onFinished.mock.calls.length;
    const layer = () => screen.getByTestId("scene-transition");
    try {
      if (layer().style.transitionDuration !== `${fadeMs}ms`) return `transitionDuration is "${layer().style.transitionDuration}", expected "${fadeMs}ms"`;
      await clock.advanceTo(item.bypassAtMs);
      if (item.variant === "file-error" && !screen.queryByRole("alert")) return `t=${clock.now}: file error not shown`;
      if (item.variant === "slow-notice" && !screen.queryByText(/longer than usual/)) return `t=${clock.now}: slow notice not shown`;
      if (finishedCalls() !== 0) return `t=${clock.now}: onFinished called before the player acted`;

      fireEvent.click(screen.getByRole("button", { name: LOADING_TEXT.continueToMenu }));
      await clock.advanceTo(item.bypassAtMs);
      if (layer().getAttribute("data-state") !== "hidden") return `t=${item.bypassAtMs}: data-state is "${layer().getAttribute("data-state")}", expected "hidden" at once`;
      if (fadeMs > 0) {
        await clock.advanceTo(item.bypassAtMs + fadeMs - 1);
        if (finishedCalls() !== 0) return `t=${clock.now}: onFinished called before the fade-out finished`;
      }
      await clock.advanceTo(item.bypassAtMs + fadeMs);
      if (finishedCalls() !== 1) return `t=${clock.now}: onFinished called ${finishedCalls()} times, expected 1`;
      await clock.advanceTo(item.bypassAtMs + fadeMs + 2 * STARTUP_LOADING_MIN_DISPLAY_MS);
      if (finishedCalls() !== 1) return `t=${clock.now}: onFinished called ${finishedCalls()} times, expected 1`;
      return null;
    } finally {
      unmount();
    }
  });
}

/*
 * Property 2: Preservation (task 2 of the loading-screen-not-visible bugfix spec).
 * Baseline observed on the unfixed code (seed 0x5ca33a2e); these tests pass before the fix and
 * must keep passing after it. They never assert the first frame or the hold (Property 1).
 */
describe("Property 2: Preservation - startup loading behavior outside the bug condition", () => {
  it("progress honesty: indeterminate bar with the real file count, unchanged by time (seeded runs)", async () => {
    const cases = generateStartupProgressCases();
    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} {reducedMotion: ${c.reducedMotion}, steps: [${c.steps.map((s) => `${s.loaded}/${s.total} wait ${s.waitMs}`).join(", ")}]}`,
      runStartupProgress,
    );
    expect(failures, `Counterexamples (${failures.length} of ${cases.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 60_000);

  it("Continue to menu: hidden at once, onFinished once after the fade (seeded runs)", async () => {
    const cases = generateContinueCases();
    const failures = await collectPropertyFailures(
      cases,
      (c) => `case ${c.id} {reducedMotion: ${c.reducedMotion}, variant: ${c.variant}, bypassAtMs: ${c.bypassAtMs}}`,
      runContinue,
    );
    expect(failures, `Counterexamples (${failures.length} of ${cases.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 60_000);
});

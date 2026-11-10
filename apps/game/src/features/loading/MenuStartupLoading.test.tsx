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
import { menuAssetProgress, type ByteProgressEvent } from "../../game/loading/menuAssetProgress";

function setProgress(patch: Partial<typeof progressState>) {
  Object.assign(progressState, patch);
}

/** Sends a byte progress report to the real store; subscribers re-render inside act. */
function reportBytes(event: ByteProgressEvent) {
  act(() => menuAssetProgress.report(event));
}

function markBytesComplete() {
  act(() => menuAssetProgress.markComplete());
}

beforeEach(() => {
  setProgress({ active: false, loaded: 0, total: 0, errors: [] });
  menuAssetProgress.reset();
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

  it("shows the measured percentage when the download size is known", () => {
    setProgress({ active: true, loaded: 1, total: 3 });
    render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={() => {}} />);
    reportBytes({ loaded: 42, total: 100, lengthComputable: true });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("data-state")).toBe("determinate");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByText(LOADING_TEXT.menuStartup.loadingFiles)).toBeTruthy();
    // The Drei file count would contradict the byte percent, so it is omitted.
    expect(screen.queryByText(/of 3 files/)).toBeNull();
  });

  it("stays indeterminate with the file count when the download size is unknown", () => {
    setProgress({ active: true, loaded: 1, total: 3 });
    render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={() => {}} />);
    reportBytes({ loaded: 5000, total: 0, lengthComputable: false });
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("data-state")).toBe("indeterminate");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(screen.getByText(LOADING_TEXT.menuStartup.loadingFiles)).toBeTruthy();
    expect(screen.getByText(/1 of 3 files/)).toBeTruthy();
  });

  it("shows a full bar with Preparing the street scene once all bytes are in", () => {
    setProgress({ active: true, loaded: 1, total: 3 });
    render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={() => {}} />);
    reportBytes({ loaded: 60, total: 100, lengthComputable: true });
    markBytesComplete();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("data-state")).toBe("determinate");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText(LOADING_TEXT.menuStartup.preparingScene)).toBeTruthy();
    expect(screen.queryByText(/of 3 files/)).toBeNull();
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
    // Loading has really finished, so the bar is full; it stays full for the whole hold.
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("data-state")).toBe("determinate");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
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

  it("restarts the slow-notice watchdog when byte progress changes", () => {
    vi.useFakeTimers();
    setProgress({ active: true, loaded: 0, total: 2 });
    render(<MenuStartupLoading sceneReady={false} sceneError={null} onFinished={() => {}} />);
    act(() => vi.advanceTimersByTime(STARTUP_SLOW_NOTICE_MS - 1000));
    reportBytes({ loaded: 10, total: 100, lengthComputable: true });
    // Only the byte percent changed; the watchdog starts again from this point.
    act(() => vi.advanceTimersByTime(STARTUP_SLOW_NOTICE_MS - 1));
    expect(screen.queryByText(/longer than usual/)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/longer than usual/)).toBeTruthy();
    // The watchdog never changes the measured value.
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("10");
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

/*
 * Display runs (startup-loading-percentage, design section 4). Each generated step changes the
 * byte progress store, the mocked Drei loaded/total values, or switches Scene_Ready on (at most
 * once), and is followed by a wait below the slow-notice time. The screen is observed right
 * after each step and after each wait, and compared with a reference model of the display
 * mapping table.
 */
type DisplayStep =
  | { kind: "bytes"; event: ByteProgressEvent; waitMs: number }
  | { kind: "complete"; waitMs: number }
  | { kind: "files"; loaded: number; total: number; waitMs: number }
  | { kind: "ready"; waitMs: number };

interface StartupDisplayCase {
  id: string;
  reducedMotion: boolean;
  steps: DisplayStep[];
}

function generateStartupDisplayCases(seed: number): StartupDisplayCase[] {
  const next = createLcg(seed);
  return Array.from({ length: PROPERTY_RUNS }, (_, i) => {
    const steps: DisplayStep[] = [];
    let ready = false;
    const count = randomInt(next, 1, 5);
    for (let j = 0; j < count; j += 1) {
      // At most 5 waits of at most 5000 ms stay below the 30-second slow notice.
      const waitMs = randomInt(next, 0, 5000);
      const roll = next();
      if (roll < 0.45) {
        const total = next() < 0.2 ? 0 : randomInt(next, 1, 30_000_000);
        const lengthComputable = total > 0 && next() < 0.85;
        // Up to 20% above the total, as with a compressed transfer.
        const loaded = randomInt(next, 0, total > 0 ? Math.floor(total * 1.2) : 5000);
        steps.push({ kind: "bytes", event: { loaded, total, lengthComputable }, waitMs });
      } else if (roll < 0.55) {
        steps.push({ kind: "complete", waitMs });
      } else if (roll < 0.85 || ready) {
        const total = next() < 0.15 ? 0 : randomInt(next, 1, 40);
        steps.push({ kind: "files", loaded: randomInt(next, 0, total), total, waitMs });
      } else {
        ready = true;
        steps.push({ kind: "ready", waitMs });
      }
    }
    return { id: `#${i}`, reducedMotion: next() < 0.5, steps };
  });
}

function describeStep(step: DisplayStep): string {
  switch (step.kind) {
    case "bytes": {
      const { loaded, total, lengthComputable } = step.event;
      return `bytes ${loaded}/${total}${lengthComputable ? "" : " (unknown)"} wait ${step.waitMs}`;
    }
    case "complete":
      return `complete wait ${step.waitMs}`;
    case "files":
      return `files ${step.loaded}/${step.total} wait ${step.waitMs}`;
    case "ready":
      return `ready wait ${step.waitMs}`;
  }
}

function describeDisplayCase(item: StartupDisplayCase): string {
  return `case ${item.id} {reducedMotion: ${item.reducedMotion}, steps: [${item.steps.map(describeStep).join(", ")}]}`;
}

interface DisplayModel {
  bytePercent: number | null;
  loaded: number;
  total: number;
  sceneReady: boolean;
}

/** Reference model of the store: running maximum of the event percents, 100 on completion. */
function applyStep(model: DisplayModel, step: DisplayStep): DisplayModel {
  switch (step.kind) {
    case "bytes": {
      const { loaded, total, lengthComputable } = step.event;
      if (!lengthComputable || total <= 0 || loaded < 0) return model;
      const candidate = Math.min(99, Math.floor((loaded / total) * 100));
      if (model.bytePercent !== null && candidate <= model.bytePercent) return model;
      return { ...model, bytePercent: candidate };
    }
    case "complete":
      return { ...model, bytePercent: 100 };
    case "files":
      return { ...model, loaded: step.loaded, total: step.total };
    case "ready":
      return { ...model, sceneReady: true };
  }
}

interface ShownDisplay {
  /** aria-valuenow, or null when the bar is indeterminate. */
  valueNow: number | null;
  line: string;
}

function expectedFileStatus(loaded: number, total: number): { status: string; detail: string | null } {
  if (total > 0 && loaded < total) return { status: LOADING_TEXT.menuStartup.loadingFiles, detail: formatFileCount(loaded, total) };
  if (total > 0) return { status: LOADING_TEXT.menuStartup.preparingScene, detail: null };
  return { status: LOADING_TEXT.menuStartup.startingEngine, detail: null };
}

/** The display mapping table from the design (no error shown). */
function expectedDisplay(model: DisplayModel): ShownDisplay {
  if (model.sceneReady) return { valueNow: 100, line: LOADING_TEXT.menuStartup.ready };
  if (model.bytePercent === 100) return { valueNow: 100, line: LOADING_TEXT.menuStartup.preparingScene };
  if (model.bytePercent !== null) return { valueNow: model.bytePercent, line: LOADING_TEXT.menuStartup.loadingFiles };
  const { status, detail } = expectedFileStatus(model.loaded, model.total);
  return { valueNow: null, line: detail ? `${status}· ${detail}` : status };
}

/** Reads the bar; returns a description of an inconsistent bar instead of a display. */
function readDisplay(): ShownDisplay | string {
  const bar = screen.getByRole("progressbar");
  const dataState = bar.getAttribute("data-state");
  const raw = bar.getAttribute("aria-valuenow");
  const line = bar.parentElement?.querySelector('[aria-live="polite"]')?.textContent ?? "";
  if (raw === null) {
    if (dataState !== "indeterminate") return `bar has no aria-valuenow but data-state is "${dataState}"`;
    return { valueNow: null, line };
  }
  if (dataState !== "determinate") return `bar has aria-valuenow="${raw}" but data-state is "${dataState}"`;
  return { valueNow: Number(raw), line };
}

interface DisplayObservation {
  /** Where in the run the screen was read, for counterexample messages. */
  at: string;
  /** True for the reading after a wait; the previous reading is the one right after the step. */
  afterWait: boolean;
  expected: ShownDisplay;
  shown: ShownDisplay;
}

interface DisplayRunResult {
  observations: DisplayObservation[];
  /** A broken expectation that is not about the display model, or null. */
  failure: string | null;
}

function showDisplay(display: ShownDisplay): string {
  return `{aria-valuenow: ${display.valueNow ?? "none"}, status: "${display.line}"}`;
}

async function observeStartupDisplay(item: StartupDisplayCase): Promise<DisplayRunResult> {
  const observations: DisplayObservation[] = [];
  const failure = await withStartupClock(item.reducedMotion, async (clock) => {
    menuAssetProgress.reset();
    setProgress({ active: true, loaded: 0, total: 0, errors: [] });
    let model: DisplayModel = { bytePercent: null, loaded: 0, total: 0, sceneReady: false };
    const onFinished = vi.fn();
    const ui = () => <MenuStartupLoading sceneReady={model.sceneReady} sceneError={null} onFinished={onFinished} />;
    const { rerender, unmount } = render(ui());
    const observe = (at: string, afterWait: boolean): string | null => {
      const shown = readDisplay();
      if (typeof shown === "string") return `${at}: ${shown}`;
      observations.push({ at, afterWait, expected: expectedDisplay(model), shown });
      return null;
    };
    try {
      for (const [index, step] of item.steps.entries()) {
        model = applyStep(model, step);
        if (step.kind === "bytes") reportBytes(step.event);
        else if (step.kind === "complete") markBytesComplete();
        else if (step.kind === "files") setProgress({ loaded: step.loaded, total: step.total });
        rerender(ui());
        await clock.advanceTo(clock.now);
        let broken = observe(`step ${index} (t=${clock.now})`, false);
        if (broken) return broken;
        await clock.advanceTo(clock.now + step.waitMs);
        broken = observe(`step ${index}, after waiting ${step.waitMs} ms (t=${clock.now})`, true);
        if (broken) return broken;
      }
      if (!model.sceneReady && onFinished.mock.calls.length !== 0) return `onFinished called while the scene is not ready`;
      return null;
    } finally {
      unmount();
    }
  });
  return { observations, failure };
}

/** First reading that differs from the display mapping, or null. */
function firstModelMismatch(observations: DisplayObservation[]): string | null {
  for (const o of observations) {
    if (o.shown.valueNow !== o.expected.valueNow || o.shown.line !== o.expected.line) {
      return `${o.at}: shown ${showDisplay(o.shown)}, expected ${showDisplay(o.expected)}`;
    }
  }
  return null;
}

/** First wait that changed the bar or the status line, or null. */
function firstChangeOverTime(observations: DisplayObservation[]): string | null {
  for (let i = 1; i < observations.length; i += 1) {
    const before = observations[i - 1];
    const after = observations[i];
    if (!after.afterWait) continue;
    if (after.shown.valueNow !== before.shown.valueNow || after.shown.line !== before.shown.line) {
      return `${after.at}: time changed the display from ${showDisplay(before.shown)} to ${showDisplay(after.shown)}`;
    }
  }
  return null;
}

/** First determinate value lower than an earlier one, or null. Indeterminate readings are skipped. */
function firstDecrease(observations: DisplayObservation[]): string | null {
  let highest: { value: number; at: string } | null = null;
  for (const o of observations) {
    if (o.shown.valueNow === null) continue;
    if (highest && o.shown.valueNow < highest.value) {
      return `${o.at}: aria-valuenow ${o.shown.valueNow} is below ${highest.value} shown at ${highest.at}`;
    }
    if (!highest || o.shown.valueNow > highest.value) highest = { value: o.shown.valueNow, at: o.at };
  }
  return null;
}

async function collectDisplayFailures(
  cases: StartupDisplayCase[],
  check: (observations: DisplayObservation[]) => string | null,
): Promise<string[]> {
  return collectPropertyFailures(cases, describeDisplayCase, async (item) => {
    const { observations, failure } = await observeStartupDisplay(item);
    return failure ?? check(observations);
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
 * The progress honesty run was reworked by the startup-loading-percentage spec: its steps now
 * include byte progress and Scene_Ready, and the bar follows the display mapping table.
 */
describe("Property 2: Preservation - startup loading behavior outside the bug condition", () => {
  it("progress honesty: the bar follows the display mapping and is unchanged by time (seeded runs)", async () => {
    const cases = generateStartupDisplayCases(PROPERTY_SEED ^ 0x70);
    const failures = await collectDisplayFailures(cases, (o) => firstModelMismatch(o) ?? firstChangeOverTime(o));
    expect(failures, `Counterexamples (${failures.length} of ${cases.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 120_000);

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

describe("Feature: startup-loading-percentage, Property 3: Startup screen matches the display model", () => {
  /** **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6, 3.7** */
  it("bar state, aria-valuenow and status line equal the display mapping after each step and wait (seeded runs)", async () => {
    const cases = generateStartupDisplayCases(PROPERTY_SEED ^ 0x93);
    const failures = await collectDisplayFailures(cases, firstModelMismatch);
    expect(failures, `Counterexamples (${failures.length} of ${cases.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 120_000);
});

describe("Feature: startup-loading-percentage, Property 4: The shown percentage never decreases", () => {
  /** **Validates: Requirements 3.5** */
  it("aria-valuenow is non-decreasing across a run, ignoring indeterminate readings (seeded runs)", async () => {
    const cases = generateStartupDisplayCases(PROPERTY_SEED ^ 0xa4);
    const failures = await collectDisplayFailures(cases, firstDecrease);
    expect(failures, `Counterexamples (${failures.length} of ${cases.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 120_000);
});

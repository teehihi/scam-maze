import { act } from "@testing-library/react";
import { vi } from "vitest";
import { CHAPTER_LOADING_MIN_DISPLAY_MS, STARTUP_LOADING_MIN_DISPLAY_MS } from "../features/loading/loadingHold";

/**
 * Test helpers for the loading screen property tests. No property-based testing library is
 * installed, so runs come from a small fixed-seed linear congruential generator (LCG). The same
 * seed always yields the same runs, so a failing run can be reproduced from its printed values.
 */

export type LoadingScreenKind = "startup" | "chapter";

export interface LoadingRun {
  /** Index in the generated list, or a name for hand-written cases. */
  id: string;
  screen: LoadingScreenKind;
  reducedMotion: boolean;
  /** Fake-clock time (ms after mount) when the loading source reports done. */
  doneAtMs: number;
}

/**
 * Minimum display time per screen, taken from the production constants (re-exported by
 * MenuStartupLoading and ChapterLoadingFlow). Imported from the dependency-free loadingHold
 * module so this helper does not pull React components or Drei into every test file.
 */
export const EXPECTED_MIN_DISPLAY_MS: Record<LoadingScreenKind, number> = {
  startup: STARTUP_LOADING_MIN_DISPLAY_MS,
  chapter: CHAPTER_LOADING_MIN_DISPLAY_MS,
};

/** Fade duration of SceneTransition when motion is allowed. */
export const FADE_MS = 500;

export const PROPERTY_SEED = 0x5ca33a2e;
export const PROPERTY_RUNS = 50;

/** Numerical Recipes LCG. Returns numbers in [0, 1). */
export function createLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * Generates bug-condition runs: both screens, both reduced-motion values, and a done time in
 * [0, minDisplayMs(screen)). No run contains a bypass action.
 */
export function generateBugConditionRuns(seed = PROPERTY_SEED, count = PROPERTY_RUNS): LoadingRun[] {
  const next = createLcg(seed);
  const runs: LoadingRun[] = [];
  for (let i = 0; i < count; i += 1) {
    const screen: LoadingScreenKind = next() < 0.5 ? "startup" : "chapter";
    const reducedMotion = next() < 0.5;
    const doneAtMs = Math.floor(next() * EXPECTED_MIN_DISPLAY_MS[screen]);
    runs.push({ id: `#${i}`, screen, reducedMotion, doneAtMs });
  }
  return runs;
}

export function describeRun(run: LoadingRun): string {
  return `run ${run.id} {screen: ${run.screen}, reducedMotion: ${run.reducedMotion}, doneAtMs: ${run.doneAtMs}}`;
}

/**
 * Times at which the layer must still be visible: the first render, the done time, a regular
 * grid, and the last millisecond before the hold ends. All values are below holdEndMs.
 */
export function visibleCheckpoints(doneAtMs: number, holdEndMs: number): number[] {
  const points = new Set<number>([0, doneAtMs, doneAtMs + 1, holdEndMs - 1]);
  for (let t = 100; t < holdEndMs; t += 250) points.add(t);
  return [...points].filter((t) => t >= 0 && t < holdEndMs).sort((a, b) => a - b);
}

/** Replaces window.matchMedia so usePrefersReducedMotion reports the given value. */
export function mockReducedMotion(reduce: boolean) {
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

export function restoreMatchMedia() {
  // @ts-expect-error remove the test double so other suites see jsdom's default
  delete window.matchMedia;
}

/** Largest single fake-time step taken by createClock().advanceTo. */
export const CLOCK_STEP_MS = 50;

/**
 * Fake clock driver. Advances timers and flushes pending promises inside act().
 *
 * Time advances in steps of at most CLOCK_STEP_MS, each in its own act(). React commits state
 * updates only when an act() ends, so a timer scheduled by a commit (for example the fade-out
 * timer that starts when the hold ends) is scheduled at the end of the step. With one large
 * step, the rest of the requested time would already be consumed and that timer would never
 * get its time. Small steps keep such timers at most CLOCK_STEP_MS late, and a call that
 * stops exactly at a timer's due time commits at that time.
 */
export function createClock() {
  let now = 0;
  return {
    get now() {
      return now;
    },
    async advanceTo(target: number) {
      let remaining = Math.max(0, target - now);
      do {
        const step = Math.min(remaining, CLOCK_STEP_MS);
        remaining -= step;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(step);
        });
      } while (remaining > 0);
      // Extra flushes so promise chains (fetch body, loader stages) settle at this time.
      for (let i = 0; i < 3; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
      }
      now = Math.max(now, target);
    },
  };
}

/** Integer in [min, max] (both inclusive) from an LCG produced by createLcg. */
export function randomInt(next: () => number, min: number, max: number): number {
  return min + Math.floor(next() * (max - min + 1));
}

/** One element of a non-empty list, chosen by an LCG produced by createLcg. */
export function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)];
}

/**
 * Runs every generated case and collects "<case> -> <first broken expectation>" lines.
 * A run returns null when it behaves as expected.
 */
export async function collectPropertyFailures<T>(
  cases: readonly T[],
  describeCase: (item: T) => string,
  runCase: (item: T) => Promise<string | null>,
): Promise<string[]> {
  const failures: string[] = [];
  for (const item of cases) {
    const failure = await runCase(item);
    if (failure) failures.push(`${describeCase(item)} -> ${failure}`);
  }
  return failures;
}

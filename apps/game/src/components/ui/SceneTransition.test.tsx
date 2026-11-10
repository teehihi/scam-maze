import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SceneTransition } from "./SceneTransition";
import {
  collectPropertyFailures,
  createClock,
  createLcg,
  FADE_MS,
  mockReducedMotion,
  PROPERTY_RUNS,
  PROPERTY_SEED,
  randomInt,
  restoreMatchMedia,
} from "../../test/loadingRuns";

interface ToggleStep {
  visible: boolean;
  /** How long this value is kept before the next step. */
  holdMs: number;
}

interface ToggleCase {
  id: string;
  reducedMotion: boolean;
  /** How long the layer stays visible after mount, before the first step. */
  initialHoldMs: number;
  /** Alternates hidden / visible, starting with hidden and ending with a long hidden step. */
  steps: ToggleStep[];
}

function generateToggleCases(seed = PROPERTY_SEED, count = PROPERTY_RUNS): ToggleCase[] {
  const next = createLcg(seed ^ 0x2);
  const cases: ToggleCase[] = [];
  for (let i = 0; i < count; i += 1) {
    const reducedMotion = next() < 0.5;
    const toggles = randomInt(next, 1, 4);
    const steps: ToggleStep[] = [];
    for (let j = 0; j < toggles; j += 1) {
      steps.push({ visible: false, holdMs: randomInt(next, 1, 900) });
      steps.push({ visible: true, holdMs: randomInt(next, 1, 900) });
    }
    // The last hidden step is long enough for the fade-out to finish.
    steps.push({ visible: false, holdMs: FADE_MS + randomInt(next, 1, 500) });
    cases.push({ id: `#${i}`, reducedMotion, initialHoldMs: randomInt(next, 50, 900), steps });
  }
  return cases;
}

function describeToggleCase(item: ToggleCase): string {
  const steps = item.steps.map((step) => `${step.visible ? "show" : "hide"}:${step.holdMs}`).join(",");
  return `case ${item.id} {reducedMotion: ${item.reducedMotion}, initialHoldMs: ${item.initialHoldMs}, steps: [${steps}]}`;
}

/**
 * Drives SceneTransition (default props, no fadeIn prop) through a generated show/hide sequence
 * on the fake clock and compares data-state and onHidden calls with the observed baseline.
 */
async function runToggleCase(item: ToggleCase): Promise<string | null> {
  mockReducedMotion(item.reducedMotion);
  vi.useFakeTimers();
  const clock = createClock();
  const onHidden = vi.fn();
  const duration = item.reducedMotion ? 0 : FADE_MS;
  const ui = (visible: boolean) => (
    <SceneTransition visible={visible} onHidden={onHidden}>
      <p>content</p>
    </SceneTransition>
  );
  const { rerender, unmount } = render(ui(true));
  const layerState = () => screen.getByTestId("scene-transition").getAttribute("data-state");
  const calls = () => onHidden.mock.calls.length;
  try {
    const transition = screen.getByTestId("scene-transition").style.transitionDuration;
    if (transition !== `${duration}ms`) return `transitionDuration is "${transition}", expected "${duration}ms"`;

    // Default fade-in: hidden on the first render, visible after the animation frame.
    // Reduced motion: shown at once.
    const firstState = layerState();
    const expectedFirst = item.reducedMotion ? "visible" : "hidden";
    if (firstState !== expectedFirst) return `t=0 (first render): data-state is "${firstState}", expected "${expectedFirst}"`;
    await clock.advanceTo(item.initialHoldMs);
    if (layerState() !== "visible") return `t=${clock.now}: data-state is "${layerState()}", expected "visible" after the animation frame`;

    let fired = false;
    for (const step of item.steps) {
      const start = clock.now;
      rerender(ui(step.visible));
      await clock.advanceTo(start);
      const expectedState = step.visible ? "visible" : "hidden";
      if (layerState() !== expectedState) return `t=${start}: data-state is "${layerState()}", expected "${expectedState}"`;

      if (!step.visible && !fired && step.holdMs >= duration) {
        if (duration > 0) {
          await clock.advanceTo(start + duration - 1);
          if (calls() !== 0) return `t=${clock.now}: onHidden called ${calls()} times before the fade-out finished`;
          await clock.advanceTo(start + duration);
        }
        fired = true;
        if (calls() !== 1) return `t=${clock.now}: onHidden called ${calls()} times, expected 1 after the fade-out`;
      }
      await clock.advanceTo(start + step.holdMs);
      const expectedCalls = fired ? 1 : 0;
      if (calls() !== expectedCalls) return `t=${clock.now}: onHidden called ${calls()} times, expected ${expectedCalls}`;
    }

    // Toggling again after the callback never fires it a second time.
    const end = clock.now;
    rerender(ui(true));
    await clock.advanceTo(end + 100);
    rerender(ui(false));
    await clock.advanceTo(end + 100 + duration + 1000);
    if (calls() !== 1) return `t=${clock.now}: onHidden called ${calls()} times after toggling again, expected 1`;
    return null;
  } finally {
    unmount();
    vi.useRealTimers();
    restoreMatchMedia();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

/*
 * Property 2: Preservation (task 2 of the loading-screen-not-visible bugfix spec).
 * Baseline observed on the unfixed code: SceneTransition without a fadeIn prop is "hidden" on
 * the first render and "visible" after the animation frame (instant under reduced motion), and
 * onHidden fires exactly once, after the full fade, however often `visible` toggles.
 */
describe("Property 2: Preservation - SceneTransition default fade-in and single onHidden", () => {
  it("fades in by default and calls onHidden exactly once for generated show/hide sequences (seeded runs)", async () => {
    const cases = generateToggleCases();
    const failures = await collectPropertyFailures(cases, describeToggleCase, runToggleCase);
    expect(failures, `Counterexamples (${failures.length} of ${cases.length} runs):\n${failures.join("\n")}`).toEqual([]);
  }, 60_000);
});

describe("SceneTransition fadeIn option", () => {
  it("is visible and opaque on the first render when fadeIn is false, and still calls onHidden once", () => {
    mockReducedMotion(false);
    vi.useFakeTimers();
    const onHidden = vi.fn();
    const { rerender, unmount } = render(
      <SceneTransition visible fadeIn={false} onHidden={onHidden}>
        <p>content</p>
      </SceneTransition>,
    );
    try {
      const layer = screen.getByTestId("scene-transition");
      expect(layer.getAttribute("data-state")).toBe("visible");
      expect(layer.className).toContain("opacity-100");

      rerender(
        <SceneTransition visible={false} fadeIn={false} onHidden={onHidden}>
          <p>content</p>
        </SceneTransition>,
      );
      expect(screen.getByTestId("scene-transition").getAttribute("data-state")).toBe("hidden");
      vi.advanceTimersByTime(FADE_MS - 1);
      expect(onHidden).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onHidden).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
      vi.useRealTimers();
      restoreMatchMedia();
    }
  });
});

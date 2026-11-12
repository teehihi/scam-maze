// Feature: game-3d-phone-call-ui, Property 4: Fallback parity
// Feature: game-phone-call-ui-redesign, Property 5: Presentation equivalence across modes
//
// For any generated call state (src/test/callStates.ts) and any seeded sequence of mode switches
// between `pending`, `model` and `fallback`, `CallPresentation` keeps the same screen host and
// `PhoneCallScreen` DOM nodes, the same screen text, the same subtitle text and the same button
// names in the same order, and the same focused control across each switch; and activating the same call button or option gives
// the same dispatched action in every mode.
//
// Model mode is simulated without WebGL by publishing rectangles on the screen sink, the way
// `PhoneModel3D` does. `pending` is only reachable as the first mode (the component never goes
// back to it), so each case starts in one of the three modes and then switches between `model`
// and `fallback` through every path the component supports: a sink rectangle, a `null`
// rectangle, the 200 ms pending timer and `modelAllowed` turning off and on.
//
// **Validates: Requirements 5.8, 8.4, 8.6**
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import { describeCallState, generateCallState, type GeneratedCallState } from "../../../test/callStates";
import { caseSeed } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import type { Rect } from "./callLayout";
import { CallPresentation, type PresentationMode } from "./CallPresentation";
import { createPhoneScreenSink, type PhoneScreenSink } from "./phoneScreenSink";

const SEED = 0x3d9c_0004;
const CASES = 120;
/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;
/** Grace period of `CallPresentation` before `pending` becomes `fallback`. */
const PENDING_GRACE_MS = 200;
const MAX_SWITCHES = 6;
const MODES: readonly PresentationMode[] = ["pending", "model", "fallback"];

interface Harness {
  sink: PhoneScreenSink;
  dispatched: CoreAction[];
  setModelAllowed(allowed: boolean): void;
  modelAllowed(): boolean;
  unmount(): void;
}

/** Mounts `CallPresentation` for the generated state. Handlers only record the action. */
function mount(generated: GeneratedCallState, modelAllowed: boolean, sink: PhoneScreenSink): Harness {
  const store = createChapterStore(generated.state);
  const scenario = getDisplayScenario(generated.locale);
  const dispatched: CoreAction[] = [];
  let allowed = modelAllowed;
  const element = () => (
    <CallPresentation
      store={store}
      scenario={scenario}
      paused={false}
      modelAllowed={allowed}
      screenSink={sink}
      onAnswer={() => dispatched.push({ type: "ANSWER_CALL" })}
      onEnd={() => dispatched.push({ type: "END_CALL" })}
      onSelectOption={(optionId) => dispatched.push({ type: "SELECT_DIALOGUE_OPTION", optionId })}
    />
  );
  const utils = render(element());
  return {
    sink,
    dispatched,
    setModelAllowed(next) {
      allowed = next;
      utils.rerender(element());
    },
    modelAllowed: () => allowed,
    unmount: utils.unmount,
  };
}

function hostElement(): HTMLElement {
  return screen.getByTestId("phone-screen-host");
}

function currentMode(): string | undefined {
  return hostElement().dataset.mode;
}

/** The `PhoneCallScreen` root (`section`), the only child of the host. */
function screenElement(): Element {
  const section = hostElement().firstElementChild;
  expect(section?.tagName).toBe("SECTION");
  return section!;
}

/**
 * Visible text of the screen. `<style>` elements are removed first: the fallback icon wobble adds
 * a keyframes rule, which is CSS and not screen text.
 */
function screenText(): string {
  const clone = screenElement().cloneNode(true) as Element;
  for (const style of clone.querySelectorAll("style")) style.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Text of the caller subtitle overlay (speaker name, line, connecting text and notice). It lives
 * outside the phone host, so it is read separately and must not depend on the mode.
 */
function subtitleText(): string {
  const overlay = screen.queryByTestId("call-subtitle-overlay");
  return (overlay?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Names of the screen buttons, in DOM order (icons are `aria-hidden` and carry no text). */
function screenButtonNames(): string[] {
  return [...screenElement().querySelectorAll("button")].map((button) =>
    (button.getAttribute("aria-label") ?? button.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

/** Call buttons and option buttons of the dialog, in DOM order (screen first, then options). */
function controls(): HTMLButtonElement[] {
  return [...screen.getByTestId("call-presentation").querySelectorAll("button")];
}

/** A rectangle that differs from the previous one by much more than the sink tolerance. */
function randomRect(next: () => number): Rect {
  const width = randomInt(next, 160, 420);
  return {
    left: randomInt(next, 0, 1200) + 0.5,
    top: randomInt(next, 0, 300),
    width,
    height: Math.round(width * 2.1),
  };
}

/** Puts a freshly mounted harness into `mode`. Returns the mounted harness. */
function mountInMode(generated: GeneratedCallState, mode: PresentationMode, next: () => number): Harness {
  const sink = createPhoneScreenSink();
  if (mode === "model") sink.publish(randomRect(next));
  let harness!: Harness;
  act(() => {
    harness = mount(generated, mode !== "fallback", sink);
  });
  return harness;
}

/** Switches to `model` or `fallback` through a seeded path; returns a short description. */
function switchMode(harness: Harness, target: "model" | "fallback", next: () => number): string {
  if (target === "model") {
    let description = "publish rect";
    if (!harness.modelAllowed()) {
      act(() => harness.setModelAllowed(true));
      description = "allow model, publish rect";
    }
    act(() => harness.sink.publish(randomRect(next)));
    return description;
  }
  const from = currentMode();
  const paths =
    from === "pending" ? (["timer", "disallow"] as const) : (["publish null", "disallow"] as const);
  const path = pick(next, paths);
  act(() => {
    if (path === "timer") vi.advanceTimersByTime(PENDING_GRACE_MS);
    else if (path === "publish null") harness.sink.publish(null);
    else harness.setModelAllowed(false);
  });
  return path;
}

interface Snapshot {
  host: HTMLElement;
  screen: Element;
  text: string;
  subtitle: string;
  buttons: string[];
}

function snapshot(): Snapshot {
  return { host: hostElement(), screen: screenElement(), text: screenText(), subtitle: subtitleText(), buttons: screenButtonNames() };
}

beforeEach(() => {
  // Only the pending timer is faked, so it fires exactly when a case asks for it.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CallPresentation fallback parity", () => {
  it(
    "keeps the screen, its text, its buttons, focus and dispatched actions the same in every mode",
    () => {
      const seen = { pending: 0, model: 0, fallback: 0, switches: 0, options: 0, callButtons: 0 };

      for (let index = 0; index < CASES; index += 1) {
        const seed = caseSeed(SEED, index);
        const generated = generateCallState(seed);
        const next = createLcg(seed ^ 0x5a5a_5a5a);
        act(() => applyLocale(generated.locale));
        const label = `seed ${SEED}, case ${index}: ${describeCallState(generated)}`;

        // --- Part 1: one instance, a seeded sequence of mode switches -------------------------
        const startMode = pick(next, MODES);
        const harness = mountInMode(generated, startMode, next);
        expect(currentMode(), `${label} (start mode)`).toBe(startMode);
        seen[startMode] += 1;

        const first = snapshot();
        const steps: string[] = [`start ${startMode}`];
        const switchCount = randomInt(next, 1, MAX_SWITCHES);
        for (let s = 0; s < switchCount; s += 1) {
          const from = currentMode();
          const target: "model" | "fallback" =
            from === "model" ? "fallback" : from === "fallback" ? "model" : pick(next, ["model", "fallback"] as const);

          // Move focus to a seeded control some of the time (otherwise keep the initial focus).
          const buttons = controls();
          if (buttons.length > 0 && next() < 0.5) {
            const button = pick(next, buttons);
            act(() => button.focus());
          }
          const focused = document.activeElement;

          const path = switchMode(harness, target, next);
          steps.push(`${from} -> ${target} (${path})`);
          const where = `${label}; switches: ${steps.join("; ")}`;

          expect(currentMode(), `${where} (mode)`).toBe(target);
          const after = snapshot();
          expect(after.host, `${where} (same host node)`).toBe(first.host);
          expect(after.screen, `${where} (same PhoneCallScreen node)`).toBe(first.screen);
          expect(after.text, `${where} (screen text)`).toBe(first.text);
          expect(after.subtitle, `${where} (subtitle text)`).toBe(first.subtitle);
          expect(after.buttons, `${where} (screen buttons)`).toEqual(first.buttons);
          expect(document.activeElement, `${where} (focus kept)`).toBe(focused);
          seen[target] += 1;
          seen.switches += 1;
        }
        act(() => harness.unmount());

        // --- Part 2: the same activation in each mode gives the same action -------------------
        // The single dispatch guard ignores a second press of a call button in the same status,
        // so each mode gets its own fresh instance with the same state and locale.
        let controlIndex = -1;
        let reference: CoreAction[] | null = null;
        for (const mode of MODES) {
          const modeHarness = mountInMode(generated, mode, next);
          const where = `${label} (activation in ${mode})`;
          expect(currentMode(), `${where} (mode)`).toBe(mode);
          const buttons = controls();
          expect(buttons.length, `${where} (controls)`).toBeGreaterThan(0);
          if (controlIndex < 0) controlIndex = randomInt(next, 0, buttons.length - 1);
          const button = buttons[controlIndex];
          expect(button, `${where} (control ${controlIndex})`).toBeDefined();
          act(() => {
            fireEvent.click(button);
          });
          expect(modeHarness.dispatched, `${where} (one action)`).toHaveLength(1);
          if (reference === null) reference = [...modeHarness.dispatched];
          else expect(modeHarness.dispatched, `${where} (same action)`).toEqual(reference);
          act(() => modeHarness.unmount());
        }
        if (reference?.[0]?.type === "SELECT_DIALOGUE_OPTION") seen.options += 1;
        else seen.callButtons += 1;
      }

      // Guard against a vacuous pass: every mode, both switch targets and both kinds of
      // activation were exercised.
      expect(seen.pending).toBeGreaterThan(0);
      expect(seen.model).toBeGreaterThan(0);
      expect(seen.fallback).toBeGreaterThan(0);
      expect(seen.switches).toBeGreaterThanOrEqual(CASES);
      expect(seen.options).toBeGreaterThan(0);
      expect(seen.callButtons).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

// Feature: game-3d-phone-call-ui, Property 1: Presentation does not change game state
// Feature: game-phone-call-ui-redesign, Property 5: Presentation equivalence across modes
//
// **Validates: Requirements 4.1, 4.6, 4.8, 11.8, 13.3, 13.10**
//
// For any Chapter 1 call (scam call, callback, official line) from src/test/callStates.ts, for
// any seeded sequence of option positions and activation methods (pointer click, Enter, Space,
// number key), in both locales and in both presentation modes (model and fallback, simulated
// through the PhoneScreenSink), selecting the options through `CallPresentation` and its
// Choice_Overlay produces the same Narrative_Core state as dispatching the same actions directly
// on the reducer. After every step the rendered option IDs, order and text equal
// `selectDialogueView(state).options`, every activation dispatches exactly one action, and every
// dispatched action type is ANSWER_CALL, SELECT_DIALOGUE_OPTION or END_CALL.
//
// The handlers are the same as the page's `handleAnswerCall`, `handleEndCall` and
// `handleSelectOption`: one store dispatch each. jsdom does not turn Enter or Space on a native
// button into a click, so the test sends the key events, checks that no handler cancels the
// default activation and that nothing is dispatched by the key itself, and then sends the click
// as a browser would (same pattern as SettingsModal.test.tsx).
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { GameLocale } from "@scammaze/shared-types";
import { describe, expect, it } from "vitest";
import { selectDialogueView } from "../../../game/narrative/selectors";
import { createChapterStore } from "../../../game/narrative/store";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ActionResult, ChapterState, CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import { applyLocale, i18n } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import { CALL_STATE_SEED, describeCallState, generateCallStates, GENERATED_CALLS } from "../../../test/callStates";
import { describeAction, runSequence } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CallPresentation } from "./CallPresentation";
import { createPhoneScreenSink } from "./phoneScreenSink";

const SEED = (CALL_STATE_SEED ^ 0x0000_0001) >>> 0;
const CASES = 150;
const PROPERTY_TIMEOUT_MS = 60_000;
/** Extra option steps taken through the overlay after the generated walk. */
const MAX_EXTRA_OPTIONS = 4;

type OptionMethod = "click" | "enter" | "space" | "number-key";
type ButtonMethod = Exclude<OptionMethod, "number-key">;
/** model: rect published; sink-null: rect then null (model -> fallback); no-model: modelAllowed false. */
type ModeVariant = "model" | "sink-null" | "no-model";

const OPTION_METHODS: readonly OptionMethod[] = ["click", "enter", "space", "number-key"];
const BUTTON_METHODS: readonly ButtonMethod[] = ["click", "enter", "space"];
const MODE_VARIANTS: readonly ModeVariant[] = ["model", "sink-null", "no-model"];
const ALLOWED_TYPES = new Set<CoreAction["type"]>(["ANSWER_CALL", "SELECT_DIALOGUE_OPTION", "END_CALL"]);
const SCREEN_RECT = { left: 400, top: 120, width: 300, height: 600 };

interface RenderedOption {
  id: string;
  text: string;
  button: HTMLButtonElement;
}

interface ExpectedOption {
  id: string;
  text: string;
}

/** Store wrapper that records every dispatched action and its result. */
function recordingStore(initial: ChapterState): {
  store: ChapterStore;
  dispatched: CoreAction[];
  results: ActionResult[];
} {
  const inner = createChapterStore(initial);
  const dispatched: CoreAction[] = [];
  const results: ActionResult[] = [];
  const store: ChapterStore = {
    getState: inner.getState,
    subscribe: inner.subscribe,
    replace: inner.replace,
    dispatch(action) {
      dispatched.push(action);
      const result = inner.dispatch(action);
      results.push(result);
      return result;
    },
  };
  return { store, dispatched, results };
}

/** Options the overlay must show for `state`: the linked view's options, or none. */
function expectedOptions(state: ChapterState, scenario: ScenarioDefinition, locale: GameLocale): ExpectedOption[] {
  const view = selectDialogueView(state, scenario);
  if (state.call.status !== "active" || view === null || view.callId !== state.call.current) return [];
  const fallbackText = i18n.getFixedT(locale, "chapter1")("dialogue.fallbackOption");
  return view.options.map((option) => ({ id: option.id, text: option.fallback ? fallbackText : option.text }));
}

/** Option buttons in the Choice_Overlay, in DOM order (`ol > li > button`). */
function renderedOptions(): RenderedOption[] {
  const overlay = screen.queryByTestId("player-choice-overlay");
  if (overlay === null) return [];
  return Array.from(overlay.querySelectorAll<HTMLButtonElement>("ol > li > button")).map((button) => {
    const testId = button.dataset.testid ?? "";
    const label = button.querySelector("span:last-child");
    return {
      id: testId.replace(/^dialogue-option-/, ""),
      text: label?.textContent ?? "",
      button,
    };
  });
}

function comparable(options: readonly { id: string; text: string }[]): ExpectedOption[] {
  return options.map(({ id, text }) => ({ id, text }));
}

/** Activates a native button as a browser would for `method`. Returns nothing; the caller counts dispatches. */
function activateButton(button: HTMLButtonElement, method: ButtonMethod, dispatched: CoreAction[]): void {
  if (method === "click") {
    fireEvent.click(button);
    return;
  }
  act(() => button.focus());
  expect(document.activeElement).toBe(button);
  const before = dispatched.length;
  if (method === "enter") {
    // No handler may cancel the default activation, and the key itself dispatches nothing.
    expect(fireEvent.keyDown(button, { key: "Enter", code: "Enter" })).toBe(true);
  } else {
    expect(fireEvent.keyDown(button, { key: " ", code: "Space" })).toBe(true);
    expect(fireEvent.keyUp(button, { key: " ", code: "Space" })).toBe(true);
  }
  expect(dispatched.length).toBe(before);
  // jsdom does not synthesize the activation click.
  fireEvent.click(button);
}

/** Activates option `index` with `method`; number keys go to the focused element and bubble to window. */
function activateOption(option: RenderedOption, index: number, method: OptionMethod, dispatched: CoreAction[]): void {
  if (method !== "number-key") {
    activateButton(option.button, method, dispatched);
    return;
  }
  const target = document.activeElement ?? document.body;
  // The window listener calls preventDefault when it selects an option.
  expect(fireEvent.keyDown(target, { key: String(index + 1), code: `Digit${index + 1}` })).toBe(false);
}

describe("CallPresentation equivalence (Property 1)", () => {
  it(
    "selecting options through the presentation equals dispatching the same actions on the reducer",
    () => {
      const generated = generateCallStates(CASES, SEED);
      const next = createLcg(SEED);
      const optionSelections: Record<GameLocale, Record<OptionMethod, number>> = {
        en: { click: 0, enter: 0, space: 0, "number-key": 0 },
        vi: { click: 0, enter: 0, space: 0, "number-key": 0 },
      };
      const callsSeen = new Set<string>();
      const modesSeen = new Set<ModeVariant>();
      let answers = 0;
      let endCalls = 0;

      generated.forEach((callState, caseIndex) => {
        const variant = pick(next, MODE_VARIANTS);
        const log: string[] = [];
        try {
          const { locale } = callState;
          applyLocale(locale);
          const scenario = getDisplayScenario(locale);
          const initial = callState.run.states[callState.setup.length];
          const { store, dispatched, results } = recordingStore(initial);
          const intended: CoreAction[] = [];

          const sink = createPhoneScreenSink();
          if (variant !== "no-model") sink.publish(SCREEN_RECT);
          const { unmount } = render(
            <CallPresentation
              store={store}
              scenario={scenario}
              paused={false}
              modelAllowed={variant !== "no-model"}
              screenSink={sink}
              onAnswer={() => store.dispatch({ type: "ANSWER_CALL" })}
              onEnd={() => store.dispatch({ type: "END_CALL" })}
              onSelectOption={(optionId) => store.dispatch({ type: "SELECT_DIALOGUE_OPTION", optionId })}
            />,
          );
          if (variant === "sink-null") act(() => sink.publish(null));
          const expectedMode = variant === "model" ? "model" : "fallback";
          expect(screen.getByTestId("call-presentation").dataset.mode).toBe(expectedMode);
          modesSeen.add(variant);
          callsSeen.add(callState.callId);

          /** Rendered options equal the selector after every state change (Req 4.8). */
          const checkOptions = (): RenderedOption[] => {
            const rendered = renderedOptions();
            expect(comparable(rendered)).toEqual(expectedOptions(store.getState(), scenario, locale));
            return rendered;
          };

          /** Runs one activation and checks it dispatched exactly `action`, accepted. */
          const step = (action: CoreAction, activate: () => void): void => {
            log.push(describeAction(action));
            const before = dispatched.length;
            activate();
            expect(dispatched.length - before).toBe(1);
            expect(dispatched[before]).toEqual(action);
            expect(ALLOWED_TYPES.has(dispatched[before].type)).toBe(true);
            expect(results[before].accepted).toBe(true);
            intended.push(action);
            if (store.getState().call.current !== null) {
              expect(screen.getByTestId("call-presentation").dataset.mode).toBe(expectedMode);
            }
          };

          const answer = (): void => {
            const method = pick(next, BUTTON_METHODS);
            log.push(`answer by ${method}`);
            step({ type: "ANSWER_CALL" }, () =>
              activateButton(screen.getByTestId<HTMLButtonElement>("incoming-call-accept"), method, dispatched),
            );
            answers += 1;
          };

          const selectAt = (index: number): void => {
            const rendered = checkOptions();
            const option = rendered[index];
            const method = index < 9 ? pick(next, OPTION_METHODS) : pick(next, BUTTON_METHODS);
            log.push(`option ${index + 1} by ${method}`);
            step({ type: "SELECT_DIALOGUE_OPTION", optionId: option.id }, () =>
              activateOption(option, index, method, dispatched),
            );
            optionSelections[locale][method] += 1;
          };

          checkOptions();

          // 1. Replay the generated walk through the presentation.
          for (const action of callState.walk) {
            if (action.type === "ANSWER_CALL") {
              answer();
            } else if (action.type === "SELECT_DIALOGUE_OPTION") {
              const index = checkOptions().findIndex((option) => option.id === action.optionId);
              expect(index).toBeGreaterThanOrEqual(0);
              selectAt(index);
            } else {
              throw new Error(`unexpected walk action ${describeAction(action)}`);
            }
            checkOptions();
          }
          // The UI walk reaches the same state as the generator's direct reducer run.
          expect(store.getState()).toEqual(callState.state);

          // 2. Extra seeded steps: answer a ringing call, random option positions, maybe hang up.
          if (store.getState().call.status === "ringing" && next() < 0.6) {
            answer();
            checkOptions();
          }
          const extra = randomInt(next, 0, MAX_EXTRA_OPTIONS);
          for (let i = 0; i < extra; i += 1) {
            const rendered = checkOptions();
            if (rendered.length === 0) break;
            selectAt(randomInt(next, 0, rendered.length - 1));
            checkOptions();
          }
          const status = store.getState().call.status;
          if ((status === "ringing" || status === "active") && next() < 0.3) {
            const testId = status === "ringing" ? "incoming-call-decline" : "call-screen-hang-up";
            const method = pick(next, BUTTON_METHODS);
            log.push(`end call by ${method}`);
            step({ type: "END_CALL" }, () =>
              activateButton(screen.getByTestId<HTMLButtonElement>(testId), method, dispatched),
            );
            endCalls += 1;
            checkOptions();
          }

          // 3. Same actions, same state as direct reducer dispatches.
          expect(dispatched).toEqual(intended);
          expect(store.getState()).toEqual(runSequence(intended, initial).final);
          expect(runSequence(dispatched, initial).results.every((result) => result.accepted)).toBe(true);
          unmount();
        } catch (error) {
          throw new Error(
            `Property 1 failed for case ${caseIndex} (${variant}): ${describeCallState(callState)}\nsteps: ${log.join(
              " | ",
            )}\n${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });

      // Coverage: every call, every mode variant, and option selection by every method in both locales.
      expect([...callsSeen].sort()).toEqual([...GENERATED_CALLS].sort());
      expect([...modesSeen].sort()).toEqual([...MODE_VARIANTS].sort());
      for (const locale of ["en", "vi"] as const) {
        for (const method of OPTION_METHODS) {
          expect(optionSelections[locale][method], `${locale} ${method}`).toBeGreaterThan(0);
        }
      }
      expect(answers).toBeGreaterThan(0);
      expect(endCalls).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

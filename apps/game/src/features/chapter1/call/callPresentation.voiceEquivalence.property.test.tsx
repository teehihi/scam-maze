// Feature: chapter-01-voice-narrative, Property 7: Presentation equivalence
// Feature: game-phone-call-ui-redesign, Property 5: Presentation equivalence across modes
//
// **Validates: Requirements 8.1, 8.4, 8.8**
//
// For any Chapter 1 call (scam call, callback, official line) from src/test/callStates.ts and any
// seeded sequence of option choices, Answer and Hang up, driving the dialogue through
// `CallPresentation` WITH voice props (a fake voice controller in random waiting, skip, muted and
// notice states) produces the same Chapter_State, including the event log, as dispatching the same
// actions directly on the reducer. The rendered option IDs and text equal the selector view, at most
// one action is dispatched per activation, and the voice controls (skip wait, mute, replay) never
// dispatch anything. The existing callPresentation.equivalence.property.test.tsx stays untouched.
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { GameLocale } from "@scammaze/shared-types";
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { selectDialogueView } from "../../../game/narrative/selectors";
import { createChapterStore } from "../../../game/narrative/store";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import type { VoiceSnapshot } from "../../../game/voice/VoiceDialoguePlayer";
import { applyLocale, i18n } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import { CALL_STATE_SEED, describeCallState, generateCallStates, GENERATED_CALLS } from "../../../test/callStates";
import { describeAction, runSequence } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CallPresentation } from "./CallPresentation";
import type { CallVoiceProps } from "./CallPresentation";
import { createPhoneScreenSink } from "./phoneScreenSink";

const SEED = (CALL_STATE_SEED ^ 0x0000_0007) >>> 0;
const CASES = 150;
const PROPERTY_TIMEOUT_MS = 60_000;
const MAX_EXTRA_OPTIONS = 4;
const SCREEN_RECT = { left: 400, top: 120, width: 300, height: 600 };
const ALLOWED_TYPES = new Set<CoreAction["type"]>(["ANSWER_CALL", "SELECT_DIALOGUE_OPTION", "END_CALL"]);

type NoticeCase = Pick<VoiceSnapshot, "phase" | "source" | "label" | "reason">;
const NOTICE_CASES: readonly NoticeCase[] = [
  { phase: "playing", source: "clip", label: "none", reason: null },
  { phase: "blocked", source: "clip", label: "none", reason: "autoplay-blocked" },
  { phase: "playing", source: "dev-preview", label: "dev-preview", reason: null },
  { phase: "playing", source: "clip", label: "english-voice", reason: null },
  { phase: "unavailable", source: "none", label: "none", reason: "missing" },
  { phase: "failed", source: "none", label: "none", reason: "load-failed" },
] as unknown as readonly NoticeCase[];

interface VoiceState {
  notice: NoticeCase;
  waiting: boolean;
  muted: boolean;
  audible: boolean;
}

interface VoiceCalls {
  unlock: number;
  replay: number;
  setMuted: number;
  skipWait: number;
}

interface Harness {
  setVoice: (next: VoiceState) => void;
}

function randomVoiceState(next: () => number): VoiceState {
  return {
    notice: pick(next, NOTICE_CASES),
    waiting: next() < 0.5,
    muted: next() < 0.3,
    audible: next() < 0.6,
  };
}

function snapshotOf(voice: VoiceState): VoiceSnapshot {
  return {
    ...voice.notice,
    targetKey: null,
    muted: voice.muted,
    audible: voice.audible,
    durationMs: null,
    endedCount: 0,
  } as VoiceSnapshot;
}

/** Holds the fake voice controller state; skip wait and mute change only this state. */
const VoiceHarness: React.FC<{
  store: ChapterStore;
  scenario: ScenarioDefinition;
  sink: ReturnType<typeof createPhoneScreenSink>;
  modelAllowed: boolean;
  initial: VoiceState;
  subtitles: boolean;
  calls: VoiceCalls;
  harness: Harness;
}> = ({ store, scenario, sink, modelAllowed, initial, subtitles, calls, harness }) => {
  const [voice, setVoice] = useState(initial);
  harness.setVoice = setVoice;
  const voiceProps: CallVoiceProps = {
    snapshot: snapshotOf(voice),
    muted: voice.muted,
    unlock: () => {
      calls.unlock += 1;
      return Promise.resolve();
    },
    replay: () => {
      calls.replay += 1;
    },
    setMuted: (muted) => {
      calls.setMuted += 1;
      setVoice((current) => ({ ...current, muted }));
    },
    optionsWaiting: voice.waiting,
    skipWait: () => {
      calls.skipWait += 1;
      setVoice((current) => ({ ...current, waiting: false }));
    },
  };
  return (
    <CallPresentation
      store={store}
      scenario={scenario}
      paused={false}
      modelAllowed={modelAllowed}
      screenSink={sink}
      onAnswer={() => store.dispatch({ type: "ANSWER_CALL" })}
      onEnd={() => store.dispatch({ type: "END_CALL" })}
      onSelectOption={(optionId) => store.dispatch({ type: "SELECT_DIALOGUE_OPTION", optionId })}
      voice={voiceProps}
      durationSeconds={7}
      subtitlesEnabled={subtitles}
    />
  );
};

function expectedOptions(state: ChapterState, scenario: ScenarioDefinition, locale: GameLocale) {
  const view = selectDialogueView(state, scenario);
  if (state.call.status !== "active" || view === null || view.callId !== state.call.current) return [];
  const fallbackText = i18n.getFixedT(locale, "chapter1")("dialogue.fallbackOption");
  return view.options.map((option) => ({ id: option.id, text: option.fallback ? fallbackText : option.text }));
}

function renderedOptions(): { id: string; text: string; button: HTMLButtonElement }[] {
  const overlay = screen.queryByTestId("player-choice-overlay");
  if (overlay === null) return [];
  return Array.from(overlay.querySelectorAll<HTMLButtonElement>("ol > li > button")).map((button) => ({
    id: (button.dataset.testid ?? "").replace(/^dialogue-option-/, ""),
    text: button.querySelector("span:last-child")?.textContent ?? "",
    button,
  }));
}

describe("CallPresentation with voice props, equivalence (Property 7)", () => {
  it(
    "driving the call through the presentation with a voice controller equals dispatching on the reducer",
    () => {
      const generated = generateCallStates(CASES, SEED);
      const next = createLcg(SEED);
      const callsSeen = new Set<string>();
      let waitingSkipped = 0;
      let answers = 0;
      let endCalls = 0;
      let optionSteps = 0;

      generated.forEach((callState, caseIndex) => {
        const log: string[] = [];
        try {
          const { locale } = callState;
          applyLocale(locale);
          const scenario = getDisplayScenario(locale);
          const initial = callState.run.states[callState.setup.length];

          // Recording store: every dispatch is captured; the voice controller has no access to it.
          const inner = createChapterStore(initial);
          const dispatched: CoreAction[] = [];
          const store: ChapterStore = {
            getState: inner.getState,
            subscribe: inner.subscribe,
            replace: inner.replace,
            dispatch(action) {
              dispatched.push(action);
              return inner.dispatch(action);
            },
          };
          const intended: CoreAction[] = [];
          const calls: VoiceCalls = { unlock: 0, replay: 0, setMuted: 0, skipWait: 0 };
          const harness: Harness = { setVoice: () => undefined };
          const sink = createPhoneScreenSink();
          const modelAllowed = next() < 0.5;
          if (modelAllowed) sink.publish(SCREEN_RECT);
          const { unmount } = render(
            <VoiceHarness
              store={store}
              scenario={scenario}
              sink={sink}
              modelAllowed={modelAllowed}
              initial={randomVoiceState(next)}
              subtitles={next() < 0.5}
              calls={calls}
              harness={harness}
            />,
          );
          callsSeen.add(callState.callId);

          const checkOptions = () => {
            const rendered = renderedOptions();
            const waiting = screen.queryByTestId("choice-waiting") !== null;
            if (waiting) {
              // Replies are hidden only while waiting; the state still has them.
              expect(rendered).toEqual([]);
            } else {
              expect(rendered.map(({ id, text }) => ({ id, text }))).toEqual(
                expectedOptions(store.getState(), scenario, locale),
              );
              expect(new Set(rendered.map((option) => option.id)).size).toBe(rendered.length);
            }
          };

          /** Random voice state, voice control clicks and wait skipping. None may dispatch. */
          const settleVoice = (): void => {
            const before = dispatched.length;
            act(() => harness.setVoice(randomVoiceState(next)));
            if (store.getState().call.status === "active") {
              for (const testId of ["call-screen-mute", "call-screen-speaker", "call-screen-replay"]) {
                const button = screen.queryByTestId<HTMLButtonElement>(testId);
                if (button !== null && !button.disabled && next() < 0.4) fireEvent.click(button);
              }
            }
            checkOptions();
            const skip = screen.queryByTestId<HTMLButtonElement>("choice-skip-wait");
            if (skip !== null) {
              fireEvent.click(skip);
              waitingSkipped += 1;
              expect(screen.queryByTestId("choice-waiting")).toBeNull();
            }
            expect(dispatched.length).toBe(before);
            checkOptions();
          };

          const step = (action: CoreAction, activate: () => void): void => {
            log.push(describeAction(action));
            const before = dispatched.length;
            activate();
            expect(dispatched.length - before).toBe(1);
            expect(dispatched[before]).toEqual(action);
            expect(ALLOWED_TYPES.has(dispatched[before].type)).toBe(true);
            intended.push(action);
          };

          const answer = (): void => {
            const unlocks = calls.unlock;
            step({ type: "ANSWER_CALL" }, () => {
              fireEvent.click(screen.getByTestId("incoming-call-accept"));
              // A second press while the button is still shown must not dispatch again.
              const again = screen.queryByTestId("incoming-call-accept");
              if (again !== null) fireEvent.click(again);
            });
            expect(calls.unlock).toBe(unlocks + 1);
            answers += 1;
          };

          const selectOption = (optionId: string): void => {
            settleVoice();
            const rendered = renderedOptions();
            const index = rendered.findIndex((option) => option.id === optionId);
            expect(index).toBeGreaterThanOrEqual(0);
            step({ type: "SELECT_DIALOGUE_OPTION", optionId }, () => {
              if (index < 9 && next() < 0.3) {
                const target = document.activeElement ?? document.body;
                expect(fireEvent.keyDown(target, { key: String(index + 1), code: `Digit${index + 1}` })).toBe(false);
              } else {
                fireEvent.click(rendered[index].button);
              }
            });
            optionSteps += 1;
          };

          checkOptions();
          for (const action of callState.walk) {
            if (action.type === "ANSWER_CALL") {
              answer();
            } else if (action.type === "SELECT_DIALOGUE_OPTION") {
              selectOption(action.optionId);
            } else {
              throw new Error(`unexpected walk action ${describeAction(action)}`);
            }
            checkOptions();
          }
          expect(store.getState()).toEqual(callState.state);

          if (store.getState().call.status === "ringing" && next() < 0.6) {
            answer();
            checkOptions();
          }
          const extra = randomInt(next, 0, MAX_EXTRA_OPTIONS);
          for (let i = 0; i < extra; i += 1) {
            settleVoice();
            const rendered = renderedOptions();
            if (rendered.length === 0) break;
            selectOption(rendered[randomInt(next, 0, rendered.length - 1)].id);
          }
          const status = store.getState().call.status;
          if ((status === "ringing" || status === "active") && next() < 0.3) {
            if (status === "active") settleVoice();
            const testId = status === "ringing" ? "incoming-call-decline" : "call-screen-hang-up";
            step({ type: "END_CALL" }, () => fireEvent.click(screen.getByTestId(testId)));
            endCalls += 1;
          }

          expect(dispatched).toEqual(intended);
          expect(store.getState()).toEqual(runSequence(intended, initial).final);
          expect(runSequence(dispatched, initial).results.every((result) => result.accepted)).toBe(true);
          unmount();
        } catch (error) {
          throw new Error(
            `Property 7 failed for case ${caseIndex}: ${describeCallState(callState)}\nsteps: ${log.join(
              " | ",
            )}\n${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });

      expect([...callsSeen].sort()).toEqual([...GENERATED_CALLS].sort());
      expect(waitingSkipped).toBeGreaterThan(0);
      expect(answers).toBeGreaterThan(0);
      expect(endCalls).toBeGreaterThan(0);
      expect(optionSteps).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

// Feature: game-3d-phone-call-ui, Property 9: Call buttons dispatch once and always end the call
// (Phone_Call_Screen redesign: the Hang up button is now labeled "End call", key phone.call.hangUp.)
//
// **Validates: Requirements 5.3, 5.7**
//
// For any generated call state (src/test/callStates.ts) and any number k from 1 to 5 of
// activations of the same call button, `CallPresentation` dispatches at most one ANSWER_CALL or
// END_CALL for that call status, and the resulting state equals the state after one direct
// dispatch. Activating Hang up from any active state (any node, with or without options, or no
// linked node) leaves the call status outside `ringing` and `active` or sets an Outcome. While
// the page is paused, no activation dispatches anything and the state does not change (Req 5.6).
//
// The activations are sent either inside one React batch (one `act`) or as separate events. The
// handlers are the same as the page's `handleAnswerCall` and `handleEndCall`: one store dispatch.
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { availableOptions } from "../../../game/narrative/dialogueEngine";
import { chapterReducer } from "../../../game/narrative/reducer";
import { createChapterStore } from "../../../game/narrative/store";
import type { ChapterState, CoreAction } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import { CALL_STATE_SEED, describeCallState, generateCallStates } from "../../../test/callStates";
import { assertInvariants } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CallPresentation } from "./CallPresentation";
import { createPhoneScreenSink } from "./phoneScreenSink";

const SEED = CALL_STATE_SEED ^ 0x0000_0009;
const CASES = 150;
const PROPERTY_TIMEOUT_MS = 60_000;
const MAX_ACTIVATIONS = 5;

type CallButton = "accept" | "decline" | "hang-up";
type Batching = "one-batch" | "separate-events";
type Mode = "model" | "fallback";

const BUTTON_TEST_ID: Record<CallButton, string> = {
  accept: "incoming-call-accept",
  decline: "incoming-call-decline",
  "hang-up": "call-screen-hang-up",
};

const BUTTON_ACTION: Record<CallButton, CoreAction> = {
  accept: { type: "ANSWER_CALL" },
  decline: { type: "END_CALL" },
  "hang-up": { type: "END_CALL" },
};

const SCREEN_RECT = { left: 400, top: 120, width: 300, height: 600 };

interface ButtonCase {
  button: CallButton;
  activations: number;
  batching: Batching;
  paused: boolean;
  mode: Mode;
}

function generateButtonCase(next: () => number, state: ChapterState): ButtonCase {
  const button: CallButton =
    state.call.status === "ringing" ? pick(next, ["accept", "decline"] as const) : "hang-up";
  return {
    button,
    activations: randomInt(next, 1, MAX_ACTIVATIONS),
    batching: pick(next, ["one-batch", "separate-events"] as const),
    paused: next() < 0.25,
    mode: pick(next, ["model", "fallback"] as const),
  };
}

describe("CallPresentation call buttons (Property 9)", () => {
  it(
    "dispatch at most once per call status, match one direct dispatch, and End call ends the call",
    () => {
      const generated = generateCallStates(CASES, SEED);
      const next = createLcg(SEED);
      const coverage = { ringing: 0, activeWithOptions: 0, activeWithoutOptions: 0, paused: 0, repeated: 0 };

      generated.forEach((callState, caseIndex) => {
        // The generator always ends on a linked node with options. Half of the active official
        // line cases drop the conversation, which is the "no linked node" state the official
        // line can be in (the only call allowed to be active without one, see assertInvariants).
        const unlinked =
          callState.callId === "call.official" &&
          callState.state.call.status === "active" &&
          next() < 0.5;
        const start: ChapterState = unlinked ? { ...callState.state, conversation: null } : callState.state;
        expect(assertInvariants(start)).toEqual([]);
        const c = generateButtonCase(next, start);
        applyLocale(callState.locale);
        const scenario = getDisplayScenario(callState.locale);
        const store = createChapterStore(start);
        const sink = createPhoneScreenSink();
        if (c.mode === "model") sink.publish(SCREEN_RECT);

        const dispatched: CoreAction[] = [];
        const onAnswer = () => {
          const action: CoreAction = { type: "ANSWER_CALL" };
          dispatched.push(action);
          store.dispatch(action);
        };
        const onEnd = () => {
          const action: CoreAction = { type: "END_CALL" };
          dispatched.push(action);
          store.dispatch(action);
        };

        const view = render(
          <CallPresentation
            store={store}
            scenario={scenario}
            paused={c.paused}
            modelAllowed={c.mode === "model"}
            screenSink={sink}
            onAnswer={onAnswer}
            onEnd={onEnd}
            onSelectOption={() => {
              throw new Error("no option is selected in this property");
            }}
          />,
        );
        try {
          const button = view.getByTestId(BUTTON_TEST_ID[c.button]) as HTMLButtonElement;
          expect(button.disabled).toBe(c.paused);
          if (c.button !== "accept") {
            // Decline uses phone.incomingCall.decline; End call uses phone.call.hangUp.
            const isDecline = c.button === "decline";
            const expectedLabel =
              callState.locale === "vi"
                ? isDecline ? "Từ chối" : "Kết thúc cuộc gọi"
                : isDecline ? "Decline" : "End call";
            expect(button.textContent?.trim()).toBe(expectedLabel);
          }

          if (c.batching === "one-batch") {
            act(() => {
              for (let i = 0; i < c.activations; i += 1) fireEvent.click(button);
            });
          } else {
            for (let i = 0; i < c.activations; i += 1) {
              fireEvent.click(button);
              if (c.paused) {
                fireEvent.keyDown(button, { key: "Enter" });
                fireEvent.keyDown(button, { key: " " });
              }
            }
          }

          if (c.paused) {
            coverage.paused += 1;
            expect(dispatched).toEqual([]);
            expect(store.getState()).toBe(start);
            return;
          }

          if (c.activations > 1) coverage.repeated += 1;
          // Exactly one dispatch (Req 5.1 to 5.3), and never more than one (Req 5.7).
          expect(dispatched).toEqual([BUTTON_ACTION[c.button]]);
          const direct = chapterReducer(start, BUTTON_ACTION[c.button]);
          expect(direct.accepted).toBe(true);
          expect(store.getState()).toEqual(direct.state);

          if (c.button === "hang-up") {
            const { status } = store.getState().call;
            const ended = status !== "ringing" && status !== "active";
            expect(ended || store.getState().outcome !== null).toBe(true);
            const linked = start.conversation !== null && start.conversation.callId === start.call.current;
            if (linked && availableOptions(start, CHAPTER_1_SCENARIO).length > 0) {
              coverage.activeWithOptions += 1;
            } else {
              coverage.activeWithoutOptions += 1;
            }
          } else {
            coverage.ringing += 1;
          }
        } catch (error) {
          throw new Error(
            `Property 9 failed (seed ${SEED}, case ${caseIndex}): ${JSON.stringify({ ...c, unlinked })} from ${describeCallState(callState)}\n${String(error)}`,
          );
        } finally {
          view.unmount();
        }
      });

      // The generated cases reach every branch the property names.
      expect(coverage.ringing).toBeGreaterThan(0);
      expect(coverage.activeWithOptions).toBeGreaterThan(0);
      expect(coverage.activeWithoutOptions).toBeGreaterThan(0);
      expect(coverage.paused).toBeGreaterThan(0);
      expect(coverage.repeated).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

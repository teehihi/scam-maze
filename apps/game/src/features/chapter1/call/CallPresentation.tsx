// Call presentation wiring for the `call` overlay (design.md, "`CallPresentation.tsx` (wiring)").
// DOM only: no three, React Three Fiber or Drei imports. The 3D phone is rendered by
// `ChapterOneCanvas`; this component reads its projected screen rectangle through the
// `PhoneScreenSink` and places the single `PhoneScreenUI` instance in `PhoneScreenHost`.
//
// - Reads `state.call` and `selectDialogueView(state, scenario)` through `useChapterState`. It
//   creates no store and holds no dialogue state (Req 4.8, 11.8); every change goes through the
//   page handlers.
// - Mode: `pending` -> `model` on the first non-null sink rectangle, `pending` -> `fallback`
//   after 200 ms, `model` -> `fallback` when the sink publishes `null` or `modelAllowed` turns
//   false. A rectangle received later moves `fallback` back to `model` while the model is allowed.
// - Single dispatch guard keyed on `${call.current}:${call.status}` (Req 5.7).
// - `paused` disables every control and turns off number keys; initial focus is Accept while
//   ringing, the first option while active with options (from `PlayerChoiceOverlay`), Hang up
//   otherwise; no focus change while paused. No Escape handling (the page owns it, Req 7.5).
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { selectDialogueView } from "../../../game/narrative/selectors";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, ScenarioDefinition } from "../../../game/narrative/types";
import { useChapterState } from "../useChapterState";
import { computeCallLayout } from "./callLayout";
import type { Rect } from "./callLayout";
import { PhoneScreenHost } from "./PhoneScreenHost";
import { PhoneScreenUI } from "./PhoneScreenUI";
import type { CallScreenView } from "./PhoneScreenUI";
import type { PhoneScreenSink } from "./phoneScreenSink";
import { PlayerChoiceOverlay } from "./PlayerChoiceOverlay";
import { useViewport } from "./useViewport";

export type PresentationMode = "pending" | "model" | "fallback";

export interface CallPresentationProps {
  store: ChapterStore;
  /** Display scenario from `useDisplayScenario`. */
  scenario: ScenarioDefinition;
  paused: boolean;
  /** WebGL available, no context loss, model not failed. */
  modelAllowed: boolean;
  screenSink: PhoneScreenSink;
  /** The page's `handleAnswerCall`. */
  onAnswer: () => void;
  /** The page's `handleEndCall`. */
  onEnd: () => void;
  /** The page's `handleSelectOption`. */
  onSelectOption: (optionId: string) => void;
}

/** Time to wait for the first projected rectangle before showing the 2D fallback. */
const PENDING_GRACE_MS = 200;

const callSelector = (state: ChapterState) => state.call;

export const CallPresentation: React.FC<CallPresentationProps> = ({
  store,
  scenario,
  paused,
  modelAllowed,
  screenSink,
  onAnswer,
  onEnd,
  onSelectOption,
}) => {
  const { t } = useTranslation("chapter1");
  const call = useChapterState(store, callSelector);
  const dialogueSelector = useCallback(
    (state: ChapterState) => selectDialogueView(state, scenario),
    [scenario],
  );
  const dialogueView = useChapterState(store, dialogueSelector);

  // Memoized on the viewport identity so `PhoneScreenHost` does not resubscribe every render.
  const viewport = useViewport();
  const layout = useMemo(() => computeCallLayout(viewport), [viewport]);

  // --- Presentation mode ---------------------------------------------------------------------
  const [mode, setMode] = useState<PresentationMode>(() =>
    modelAllowed ? (screenSink.current() !== null ? "model" : "pending") : "fallback",
  );
  const modeRef = useRef(mode);
  useLayoutEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (!modelAllowed) {
      setMode("fallback");
      return undefined;
    }
    const apply = (rect: Rect | null) => {
      // The sink publishes every frame; skip the state update when nothing changes.
      if (rect !== null) {
        if (modeRef.current !== "model") setMode("model");
      } else if (modeRef.current === "model") {
        setMode("fallback");
      }
    };
    apply(screenSink.current());
    return screenSink.subscribe(apply);
  }, [modelAllowed, screenSink]);

  useEffect(() => {
    if (mode !== "pending") return undefined;
    const timer = window.setTimeout(() => {
      setMode((current) => (current === "pending" ? "fallback" : current));
    }, PENDING_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [mode]);

  // --- Derived view --------------------------------------------------------------------------
  const callDef = call.current !== null ? scenario.calls[call.current] : undefined;
  const linkedView =
    dialogueView !== null && call.current !== null && dialogueView.callId === call.current
      ? dialogueView
      : null;
  const callerLine =
    linkedView !== null && (linkedView.speaker === "caller" || linkedView.speaker === "npc");
  const narration = linkedView !== null && !callerLine ? linkedView.line : null;

  let screenView: CallScreenView | null = null;
  if (callDef !== undefined && call.status === "ringing") {
    screenView = { status: "ringing", callerName: callDef.displayName, number: callDef.number };
  } else if (callDef !== undefined && call.status === "active") {
    screenView = {
      status: "active",
      callerName: callDef.displayName,
      number: callDef.number,
      line:
        linkedView === null
          ? "connecting"
          : callerLine
            ? { speakerName: linkedView.speakerName ?? callDef.displayName, text: linkedView.line }
            : null,
    };
  }

  // --- Single dispatch guard -----------------------------------------------------------------
  const callKey = `${call.current}:${call.status}`;
  const handledRef = useRef<string | null>(null);
  useEffect(() => {
    // A new call or status allows the next button press (for example a call that rings again).
    if (handledRef.current !== callKey) handledRef.current = null;
  }, [callKey]);

  const guarded = (handler: () => void) => () => {
    if (paused || call.current === null) return;
    if (handledRef.current === callKey) return;
    handledRef.current = callKey;
    handler();
  };

  // --- Initial focus -------------------------------------------------------------------------
  const acceptRef = useRef<HTMLButtonElement>(null);
  const hangUpRef = useRef<HTMLButtonElement>(null);
  const hasOptions = linkedView !== null && linkedView.options.length > 0;
  useEffect(() => {
    if (paused) return;
    if (call.status === "ringing") {
      acceptRef.current?.focus();
    } else if (call.status === "active" && !hasOptions) {
      // With options, `PlayerChoiceOverlay` focuses the first option itself.
      hangUpRef.current?.focus();
    }
  }, [call.status, linkedView?.graphId, linkedView?.nodeId, hasOptions, paused]);

  if (screenView === null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("phone.callPresentation.name")}
      className="fixed inset-0 z-40"
      data-testid="call-presentation"
      data-mode={mode}
    >
      {mode !== "model" && <div className="absolute inset-0 bg-[#171521]/70" aria-hidden="true" />}
      <PhoneScreenHost mode={mode} layout={layout} screenSink={screenSink}>
        <PhoneScreenUI
          view={screenView}
          disabled={paused}
          vibrateIcon={mode === "fallback"}
          onAccept={guarded(onAnswer)}
          onDecline={guarded(onEnd)}
          onHangUp={guarded(onEnd)}
          acceptRef={acceptRef}
          hangUpRef={hangUpRef}
        />
      </PhoneScreenHost>
      {call.status === "active" && linkedView !== null ? (
        <PlayerChoiceOverlay
          view={linkedView}
          narration={narration}
          disabled={paused}
          onSelectOption={onSelectOption}
          region={layout.choice}
        />
      ) : null}
    </div>
  );
};

// Call presentation wiring for the `call` overlay (design.md, "`CallPresentation.tsx` (wiring)").
// DOM only: no three, React Three Fiber or Drei imports. The 3D phone is rendered by
// `ChapterOneCanvas`; this component reads its projected screen rectangle through the
// `PhoneScreenSink` and places the single `PhoneCallScreen` instance in `PhoneScreenHost`.
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
import type { VoiceSnapshot } from "../../../game/voice/VoiceDialoguePlayer";
import { useChapterState } from "../useChapterState";
import { deriveCallDialogueView, isSubtitleVisible } from "./callDialogueView";
import { computeCallLayout } from "./callLayout";
import type { Rect } from "./callLayout";
import { CallSubtitleOverlay } from "./CallSubtitleOverlay";
import { PhoneCallScreen } from "./PhoneCallScreen";
import type { CallControlsView } from "./PhoneCallScreen";
import { PhoneScreenHost } from "./PhoneScreenHost";
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
  /**
   * Optional voice state from `useVoicePlayback` (the page owns the hook). Absent: the call
   * screen renders exactly as before. This component only reads it; it holds no voice state.
   */
  voice?: CallVoiceProps;
  /** Whole seconds of the active call from `useCallDuration`. Default 0. */
  durationSeconds?: number;
  /** The Subtitles setting. Captions also show whenever nothing is audible. */
  subtitlesEnabled?: boolean;
  /** Speaker toggle state. Absent: the Speaker button is off and does nothing. */
  speaker?: { on: boolean; onToggle: () => void };
}

/** The pieces of the `VoiceController` this component needs. */
export interface CallVoiceProps {
  snapshot: VoiceSnapshot;
  muted: boolean;
  /** Called inside the Answer click, a user gesture. */
  unlock: () => Promise<void>;
  replay: () => void;
  setMuted: (muted: boolean) => void;
  optionsWaiting: boolean;
  skipWait: () => void;
}

/** Height below which the phone screen uses the compact layout (design.md, section 6). */
const COMPACT_SCREEN_HEIGHT = 360;

type VoiceNotice = "none" | "autoplay-blocked" | "dev-preview" | "english-voice" | "no-audio";

function voiceNotice(snapshot: VoiceSnapshot): VoiceNotice {
  if (snapshot.reason === "autoplay-blocked" || snapshot.phase === "blocked") return "autoplay-blocked";
  if (snapshot.label === "dev-preview") return "dev-preview";
  if (snapshot.label === "english-voice") return "english-voice";
  if (snapshot.source === "none" && (snapshot.phase === "unavailable" || snapshot.phase === "failed")) {
    return "no-audio";
  }
  return "none";
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
  voice,
  durationSeconds = 0,
  subtitlesEnabled = true,
  speaker,
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
  const { screen: screenView, subtitle, narration } = deriveCallDialogueView({
    call,
    callDef,
    dialogueView,
  });
  const linkedView =
    dialogueView !== null && call.current !== null && dialogueView.callId === call.current
      ? dialogueView
      : null;

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

  const controls: CallControlsView | undefined =
    voice !== undefined && call.status === "active"
      ? {
          durationSeconds,
          muted: voice.muted,
          replayEnabled: voice.snapshot.source !== "none",
          speakerOn: speaker?.on ?? false,
          compact: layout.screen.height < COMPACT_SCREEN_HEIGHT,
        }
      : undefined;

  const subtitleVisible = isSubtitleVisible({
    subtitlesEnabled,
    audible: voice?.snapshot.audible,
  });

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
        <PhoneCallScreen
          view={screenView}
          disabled={paused}
          vibrateIcon={mode === "fallback"}
          controls={controls}
          onToggleMute={voice ? () => voice.setMuted(!voice.muted) : undefined}
          onToggleSpeaker={speaker?.onToggle}
          onReplay={voice ? voice.replay : undefined}
          onAccept={guarded(() => {
            // Unlock audio inside the click gesture; failure never blocks the call.
            if (voice !== undefined) void voice.unlock().catch(() => undefined);
            onAnswer();
          })}
          onDecline={guarded(onEnd)}
          onHangUp={guarded(onEnd)}
          acceptRef={acceptRef}
          hangUpRef={hangUpRef}
        />
      </PhoneScreenHost>
      {call.status === "active" ? (
        <CallSubtitleOverlay
          content={subtitle}
          visible={subtitleVisible}
          notice={voice !== undefined ? voiceNotice(voice.snapshot) : "none"}
          region={layout.subtitle}
        />
      ) : null}
      {call.status === "active" && linkedView !== null ? (
        <PlayerChoiceOverlay
          view={linkedView}
          narration={narration}
          disabled={paused}
          onSelectOption={onSelectOption}
          waiting={voice?.optionsWaiting ?? false}
          onSkipWait={voice?.skipWait}
          region={layout.choice}
        />
      ) : null}
    </div>
  );
};

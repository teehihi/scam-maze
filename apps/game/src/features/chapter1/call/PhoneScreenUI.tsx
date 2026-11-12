// Phone-owned content of the 3D phone call screen (Requirement 2). DOM only: no three, React
// Three Fiber or Drei imports. The same instance is shown on the 3D phone model and on the 2D
// fallback screen (PhoneScreenHost keeps it mounted across modes, Requirement 8.6).
//
// Ringing: incoming-call label, avatar, caller name, number, Decline and Accept.
// Active: avatar, caller name, number, call status, Caller_Line (or the connecting text) and
// Hang up. Player choices are never shown here; they live in PlayerChoiceOverlay (Requirement 3).
// The number is plain text (no link, no `tel:`, no tab stop) and there is no trust badge.
import React from "react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { UI } from "../theme";

export type CallScreenView =
  | { status: "ringing"; callerName: string; number: string }
  | {
      status: "active";
      callerName: string;
      number: string;
      // "connecting": no dialogue node linked yet (Req 2.10); null: the current line is not a
      // Caller_Line, so the line area stays empty (Req 2.4).
      line: { speakerName: string; text: string } | "connecting" | null;
    };

/** Voice and caption state for the active call (voice narrative design, section 6). */
export interface CallControlsView {
  durationSeconds: number;
  muted: boolean;
  /** False when sound is off, volume is 0 or there is no clip and no preview. */
  replayEnabled: boolean;
  /** subtitlesEnabled || nothing is audible. When false the caption region stays empty. */
  captionVisible: boolean;
  notice: "none" | "autoplay-blocked" | "dev-preview" | "english-voice" | "no-audio";
  /** True when the screen is short: the avatar is hidden and gaps are tighter. */
  compact: boolean;
}

const NOTICE_KEYS = {
  "autoplay-blocked": "phone.call.notice.autoplayBlocked",
  "dev-preview": "phone.call.notice.devPreview",
  "english-voice": "phone.call.notice.englishVoice",
  "no-audio": "phone.call.notice.noAudio",
} as const;

function formatDuration(totalSeconds: number): { text: string; iso: string } {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return {
    text: `${minutes}:${String(seconds).padStart(2, "0")}`,
    iso: `PT${minutes}M${seconds}S`,
  };
}

export interface PhoneScreenUIProps {
  view: CallScreenView;
  /** Optional voice controls. Absent: the active screen renders exactly as before. */
  controls?: CallControlsView;
  onToggleMute?: () => void;
  onReplay?: () => void;
  /** True while the page is paused; disables every call button (Requirement 5.6). */
  disabled: boolean;
  /** 2D icon wobble; true only in fallback mode while ringing. Reduced motion turns it off. */
  vibrateIcon: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  acceptRef?: Ref<HTMLButtonElement>;
  hangUpRef?: Ref<HTMLButtonElement>;
}

const VIBRATE_ANIMATION = "scammaze-call-screen-vibrate 1.4s ease-in-out infinite";
// A small rotation wobble with a rest between bursts, so it stays subtle.
const VIBRATE_KEYFRAMES = `@keyframes scammaze-call-screen-vibrate {
  0%, 40%, 100% { transform: rotate(0deg); }
  5%, 15%, 25% { transform: rotate(-8deg); }
  10%, 20%, 30% { transform: rotate(8deg); }
}`;

// Text classes. Every text is at least `text-sm` (14 CSS px, Requirement 1.5); `UI.label` uses
// `text-xs`, so the caption has its own class string with the same color and weight.
const CAPTION_CLASS =
  "flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-[#b9a5f5]";
const NAME_CLASS = "text-lg font-bold break-words text-[#f7f5ff]";
const NUMBER_CLASS = "whitespace-nowrap text-sm leading-relaxed text-[#a9a4c4]";
const AVATAR_CLASS =
  "flex shrink-0 items-center justify-center rounded-full border border-[#7654d6]/50 bg-[#171521] text-[#b9a5f5]";

export const PhoneScreenUI: React.FC<PhoneScreenUIProps> = ({
  view,
  controls,
  onToggleMute,
  onReplay,
  disabled,
  vibrateIcon,
  onAccept,
  onDecline,
  onHangUp,
  acceptRef,
  hangUpRef,
}) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = usePrefersReducedMotion();
  const vibrating = view.status === "ringing" && vibrateIcon && !reducedMotion;
  const compact = controls?.compact === true;
  const duration = controls ? formatDuration(controls.durationSeconds) : null;

  return (
    <section
      aria-label={t("phone.callPresentation.screenLabel")}
      data-testid={view.status === "ringing" ? "incoming-call-screen" : "call-screen"}
      className="flex h-full w-full flex-col gap-4 overflow-hidden px-4 py-5 text-center text-[#f7f5ff]"
    >
      {vibrating ? <style>{VIBRATE_KEYFRAMES}</style> : null}

      {view.status === "ringing" ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
            <p className={CAPTION_CLASS}>
              <PhoneIncoming className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("phone.incomingCall.caption")}</span>
            </p>
            <div
              data-testid="incoming-call-icon"
              data-vibrating={vibrating ? "true" : "false"}
              className={`${AVATAR_CLASS} h-20 w-20`}
              style={vibrating ? { animation: VIBRATE_ANIMATION } : undefined}
              aria-hidden="true"
            >
              <Phone className="h-9 w-9" aria-hidden="true" />
            </div>
            <div className="min-w-0 max-w-full">
              <p className={NAME_CLASS} data-testid="incoming-call-name">
                {view.callerName}
              </p>
              <p className={`${NUMBER_CLASS} mt-1`} dir="ltr" data-testid="incoming-call-number">
                {view.number}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 @min-[220px]:flex-row">
            <button
              type="button"
              className={`${UI.buttonWarning} flex-1`}
              onClick={onDecline}
              disabled={disabled}
              data-testid="incoming-call-decline"
            >
              <PhoneOff className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("phone.incomingCall.decline")}</span>
            </button>
            <button
              ref={acceptRef}
              type="button"
              className={`${UI.buttonAccept} flex-1`}
              onClick={onAccept}
              disabled={disabled}
              data-testid="incoming-call-accept"
            >
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("phone.incomingCall.accept")}</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <header className="flex shrink-0 flex-col items-center gap-2">
            {compact ? null : (
              <div className={`${AVATAR_CLASS} h-14 w-14`} aria-hidden="true">
                <PhoneCall className="h-7 w-7" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 max-w-full">
              <p className={NAME_CLASS}>{view.callerName}</p>
              <p className={NUMBER_CLASS} dir="ltr" data-testid="call-screen-number">
                {view.number}
              </p>
              <p className={`text-sm font-semibold ${UI.textPositive}`}>{t("phone.call.status")}</p>
              {controls && duration ? (
                <time
                  role="timer"
                  aria-label={t("phone.call.duration")}
                  dateTime={duration.iso}
                  data-testid="call-duration"
                  className="block text-sm tabular-nums text-[#a9a4c4]"
                >
                  {duration.text}
                </time>
              ) : null}
            </div>
          </header>

          {controls ? (
            <p
              aria-live="polite"
              data-testid="call-notice"
              className="shrink-0 text-sm leading-relaxed text-[#a9a4c4]"
            >
              {controls.notice === "none" ? null : t(NOTICE_KEYS[controls.notice])}
            </p>
          ) : null}

          {/* One stable polite live region for the Caller_Line and the connecting text, so a
              re-render with the same line makes no new announcement (Req 2.9, 2.10). It scrolls
              for long lines and is not a Tab stop (tabIndex -1 stops browsers from making the
              scroll container focusable). */}
          <div
            aria-live="polite"
            aria-atomic="true"
            tabIndex={-1}
            data-testid="call-line-region"
            className="min-h-0 flex-1 overflow-y-auto text-left outline-none"
          >
            {controls && !controls.captionVisible ? null : view.line === "connecting" ? (
              <p className="text-sm leading-relaxed text-[#a9a4c4]">{t("phone.call.connecting")}</p>
            ) : view.line ? (
              <div className={UI.card} data-testid="dialogue-line">
                <p className="text-sm font-semibold text-[#b9a5f5]">{view.line.speakerName}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#f7f5ff] break-words">
                  {view.line.text}
                </p>
              </div>
            ) : null}
          </div>

          {controls ? (
            <div className="flex w-full shrink-0 gap-2">
              <button
                type="button"
                className={`${UI.buttonSecondary} flex-1`}
                onClick={onToggleMute}
                disabled={disabled}
                aria-pressed={controls.muted}
                data-testid="call-screen-mute"
              >
                {controls.muted ? (
                  <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{controls.muted ? t("phone.call.unmute") : t("phone.call.mute")}</span>
              </button>
              <button
                type="button"
                className={`${UI.buttonSecondary} flex-1`}
                onClick={onReplay}
                disabled={disabled || !controls.replayEnabled}
                data-testid="call-screen-replay"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t("phone.call.replay")}</span>
              </button>
            </div>
          ) : null}

          <button
            ref={hangUpRef}
            type="button"
            className={`${UI.buttonWarning} w-full shrink-0`}
            onClick={onHangUp}
            disabled={disabled}
            data-testid="call-screen-hang-up"
          >
            <PhoneOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("phone.call.hangUp")}</span>
          </button>
        </>
      )}
    </section>
  );
};

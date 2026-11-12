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
import { Phone, PhoneCall, PhoneIncoming, PhoneOff } from "lucide-react";
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

export interface PhoneScreenUIProps {
  view: CallScreenView;
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
            <div className={`${AVATAR_CLASS} h-14 w-14`} aria-hidden="true">
              <PhoneCall className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0 max-w-full">
              <p className={NAME_CLASS}>{view.callerName}</p>
              <p className={NUMBER_CLASS} dir="ltr" data-testid="call-screen-number">
                {view.number}
              </p>
              <p className={`text-sm font-semibold ${UI.textPositive}`}>{t("phone.call.status")}</p>
            </div>
          </header>

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
            {view.line === "connecting" ? (
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

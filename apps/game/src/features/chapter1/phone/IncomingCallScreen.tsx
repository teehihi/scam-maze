// Incoming call screen inside the phone overlay (Requirements 8.3, 8.7).
// Shows the caller name and number from Scenario_Data as plain text (never a link), the visible
// "Incoming call" caption, and Accept and Decline buttons. The phone icon vibrates gently, only
// when the user allows motion. Presentational only: the page dispatches ANSWER_CALL and END_CALL.
import React from "react";
import { useTranslation } from "react-i18next";
import { Phone, PhoneIncoming, PhoneOff } from "lucide-react";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { UI } from "../theme";

export interface IncomingCallScreenProps {
  /** Caller display name from the Call definition, for example "Northgate Bank Security". */
  callerName: string;
  /** Fictional_Phone_Number from the Call definition, for example "+000 555 0142". */
  number: string;
  /** Dispatches ANSWER_CALL. */
  onAccept: () => void;
  /** Dispatches END_CALL while the Call is ringing. */
  onDecline: () => void;
  /** Disables both buttons, for example while the page is paused. */
  disabled?: boolean;
}

const VIBRATE_ANIMATION = "scammaze-call-vibrate 1.4s ease-in-out infinite";
// A small rotation wobble with a rest between bursts, so it stays subtle.
const VIBRATE_KEYFRAMES = `@keyframes scammaze-call-vibrate {
  0%, 40%, 100% { transform: rotate(0deg); }
  5%, 15%, 25% { transform: rotate(-8deg); }
  10%, 20%, 30% { transform: rotate(8deg); }
}`;

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  callerName,
  number,
  onAccept,
  onDecline,
  disabled = false,
}) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = usePrefersReducedMotion();

  return (
    <section
      data-testid="incoming-call-screen"
      aria-labelledby="incoming-call-caption"
      className="flex h-full flex-col items-center justify-between gap-6 px-4 py-8 text-center"
    >
      {reducedMotion ? null : <style>{VIBRATE_KEYFRAMES}</style>}

      <div className="flex flex-col items-center gap-4">
        <p id="incoming-call-caption" className={`${UI.label} flex items-center gap-1.5`}>
          <PhoneIncoming className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("phone.incomingCall.caption")}</span>
        </p>
        <div
          data-testid="incoming-call-icon"
          data-vibrating={reducedMotion ? "false" : "true"}
          className="flex h-20 w-20 items-center justify-center rounded-full border border-[#7654d6]/50 bg-[#171521] text-[#b9a5f5]"
          style={reducedMotion ? undefined : { animation: VIBRATE_ANIMATION }}
          aria-hidden="true"
        >
          <Phone className="h-9 w-9" />
        </div>
        <div>
          <p className="text-xl font-bold text-[#f7f5ff]" data-testid="incoming-call-name">
            {callerName}
          </p>
          <p className={`${UI.body} mt-1 whitespace-nowrap`} dir="ltr" data-testid="incoming-call-number">
            {number}
          </p>
        </div>
      </div>

      <div className="flex w-full gap-3">
        <button
          type="button"
          className={`${UI.buttonWarning} flex-1`}
          onClick={onDecline}
          disabled={disabled}
          data-testid="incoming-call-decline"
        >
          <PhoneOff className="h-4 w-4" aria-hidden="true" />
          <span>{t("phone.incomingCall.decline")}</span>
        </button>
        <button
          type="button"
          className={`${UI.buttonAccept} flex-1`}
          onClick={onAccept}
          disabled={disabled}
          data-testid="incoming-call-accept"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          <span>{t("phone.incomingCall.accept")}</span>
        </button>
      </div>
    </section>
  );
};

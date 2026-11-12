// Active call screen inside the phone overlay (Requirements 9.3-9.5).
// A call header (caller name, number as plain text, status), the shared dialogue panel and a
// Hang up button. Presentational only: the page dispatches SELECT_DIALOGUE_OPTION and END_CALL.
import React from "react";
import { useTranslation } from "react-i18next";
import { PhoneCall, PhoneOff } from "lucide-react";
import type { DialogueView } from "../../../game/narrative/selectors";
import { DialoguePanel } from "../dialogue/DialoguePanel";
import { UI } from "../theme";

export interface CallScreenProps {
  /** Caller display name from the Call definition. */
  callerName: string;
  /** Fictional_Phone_Number from the Call definition. */
  number: string;
  /** Current conversation from `selectDialogueView`, or `null` when none is linked yet. */
  dialogue: DialogueView | null;
  /** Dispatches SELECT_DIALOGUE_OPTION. */
  onSelectOption: (optionId: string) => void;
  /** Dispatches END_CALL. */
  onHangUp: () => void;
  /** Disables the options and Hang up, for example while the page is paused. */
  disabled?: boolean;
}

export const CallScreen: React.FC<CallScreenProps> = ({
  callerName,
  number,
  dialogue,
  onSelectOption,
  onHangUp,
  disabled = false,
}) => {
  const { t } = useTranslation("chapter1");
  return (
    <section
      data-testid="call-screen"
      aria-labelledby="call-screen-name"
      className="flex h-full flex-col gap-4 px-4 py-5"
    >
      <header className="flex items-center gap-3 border-b border-[#38344f] pb-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#171521] text-[#4fd1b5]"
          aria-hidden="true"
        >
          <PhoneCall className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p id="call-screen-name" className="truncate font-bold text-[#f7f5ff]">
            {callerName}
          </p>
          <p className={`${UI.body} whitespace-nowrap`} dir="ltr" data-testid="call-screen-number">
            {number}
          </p>
          <p className={`text-xs ${UI.textPositive}`}>{t("phone.call.status")}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {dialogue ? (
          <DialoguePanel view={dialogue} onSelectOption={onSelectOption} disabled={disabled} />
        ) : (
          <p className={UI.body} aria-live="polite">
            {t("phone.call.connecting")}
          </p>
        )}
      </div>

      <button
        type="button"
        className={`${UI.buttonWarning} w-full`}
        onClick={onHangUp}
        disabled={disabled}
        data-testid="call-screen-hang-up"
      >
        <PhoneOff className="h-4 w-4" aria-hidden="true" />
        <span>{t("phone.call.hangUp")}</span>
      </button>
    </section>
  );
};

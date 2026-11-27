// The keypad of the Calls app. The player types a number with the keys and presses Call. A number
// that matches a saved contact places the call to that contact; any other number cannot be
// reached, and nothing in the game changes. Only digits are accepted, so the game never has to
// understand free text.
import React from "react";
import { Delete, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Tx } from "../../device/deviceFormat";
import { PHONE_COLORS } from "../phoneTheme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"] as const;
/** Longest number the keypad takes. */
export const MAX_DIGITS = 16;

export interface DialerProps {
  value: string;
  onChange: (value: string) => void;
  onCall: () => void;
  /** Shown after a call to a number that cannot be reached. */
  notice: string | null;
}

export const Dialer: React.FC<DialerProps> = ({ value, onChange, onCall, notice }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const press = (key: string) => {
    if (value.length < MAX_DIGITS) onChange(value + key);
  };
  return (
    <div className="space-y-3" data-testid="dialer">
      <p
        className="min-h-9 break-all rounded-xl border px-3 py-1.5 text-center text-xl tabular-nums"
        style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.12)", color: value === "" ? PHONE_COLORS.textMuted : PHONE_COLORS.text }}
        role="status"
        aria-label={t("phone.dialer.numberLabel")}
        data-testid="dial-display"
      >
        {value === "" ? t("phone.dialer.enterNumber") : value}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            data-testid={`dial-key-${key}`}
            className="flex h-11 items-center justify-center rounded-full border text-lg font-semibold motion-safe:transition-colors cursor-pointer hover:bg-white/15 active:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8]"
            style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.14)", color: PHONE_COLORS.text }}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <span />
        <button
          type="button"
          onClick={onCall}
          disabled={value === ""}
          data-testid="dial-call"
          aria-label={t("phone.dialer.callButton")}
          className="flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-[#0f1b0b] motion-safe:transition-colors cursor-pointer hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "#7ad04f" }}
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          <span aria-hidden="true">{t("phone.dialer.callButton")}</span>
        </button>
        <button
          type="button"
          onClick={() => onChange(value.slice(0, -1))}
          disabled={value === ""}
          data-testid="dial-backspace"
          aria-label={t("phone.dialer.backspace")}
          className="flex h-11 items-center justify-center rounded-full motion-safe:transition-colors cursor-pointer hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fe0e8] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: PHONE_COLORS.text }}
        >
          <Delete className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {notice !== null && (
        <p className="text-center text-[13px] leading-snug" style={{ color: PHONE_COLORS.notice }} role="status" data-testid="dial-notice">
          {notice}
        </p>
      )}
    </div>
  );
};

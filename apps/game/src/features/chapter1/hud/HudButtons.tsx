// On-screen Phone and Journal buttons (Requirement 4.10). They work with mouse and keyboard; the
// page also binds the P and J keys. Icons are decorative; every button has visible text.

import React from "react";
import { NotebookText, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../../i18n/format";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { UI } from "../theme";

export interface HudButtonsProps {
  onPhone: () => void;
  onJournal: () => void;
  phoneOpen?: boolean;
  journalOpen?: boolean;
  /** Unread phone messages. The badge is hidden at 0. */
  phoneUnread?: number;
  /** New journal entries since the journal was last opened. The badge is hidden at 0. */
  journalUnread?: number;
  disabled?: boolean;
}

/** Keyboard keys are literal text in every language. */
const PHONE_KEY = "P";
const JOURNAL_KEY = "J";

interface HudButtonProps {
  label: string;
  keyHint: string;
  icon: React.ReactNode;
  count: number;
  countText: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}

const HudButton: React.FC<HudButtonProps> = ({ label, keyHint, icon, count, countText, pressed, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={pressed}
    aria-keyshortcuts={keyHint}
    className={`${UI.buttonSecondary} relative`}
  >
    {icon}
    <span>{label}</span>
    <kbd
      aria-hidden="true"
      className="rounded border border-[#38344f] px-1.5 font-mono text-xs text-[#a9a4c4]"
    >
      {keyHint}
    </kbd>
    {count > 0 && (
      <>
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[#f2b24b] px-1.5 text-center text-xs font-bold leading-5 text-[#171521]"
        >
          {count}
        </span>
        <span className="sr-only">{countText}</span>
      </>
    )}
  </button>
);

export const HudButtons: React.FC<HudButtonsProps> = ({
  onPhone,
  onJournal,
  phoneOpen = false,
  journalOpen = false,
  phoneUnread = 0,
  journalUnread = 0,
  disabled = false,
}) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  return (
    <div className="flex gap-3">
      <HudButton
        label={t("hud.phone")}
        keyHint={PHONE_KEY}
        icon={<Smartphone className="h-4 w-4" aria-hidden="true" />}
        count={phoneUnread}
        countText={t("hud.unreadMessages", { count: phoneUnread, number: formatNumber(locale, phoneUnread) })}
        pressed={phoneOpen}
        disabled={disabled}
        onClick={onPhone}
      />
      <HudButton
        label={t("hud.journal")}
        keyHint={JOURNAL_KEY}
        icon={<NotebookText className="h-4 w-4" aria-hidden="true" />}
        count={journalUnread}
        countText={t("hud.newEntries", { count: journalUnread, number: formatNumber(locale, journalUnread) })}
        pressed={journalOpen}
        disabled={disabled}
        onClick={onJournal}
      />
    </div>
  );
};

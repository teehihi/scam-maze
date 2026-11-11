// On-screen Phone and Journal buttons (Requirement 4.10). They work with mouse and keyboard; the
// page also binds the P and J keys. Icons are decorative; every button has visible text.

import React from "react";
import { NotebookText, Smartphone } from "lucide-react";
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

export const HUD_BUTTON_TEXT = {
  phone: "Phone",
  journal: "Journal",
  phoneKey: "P",
  journalKey: "J",
} as const;

/** Full screen-reader text for the phone badge, one sentence per plural form. */
export function unreadMessagesText(count: number): string {
  return count === 1 ? "1 unread message" : `${count} unread messages`;
}

/** Full screen-reader text for the journal badge, one sentence per plural form. */
export function newEntriesText(count: number): string {
  return count === 1 ? "1 new entry" : `${count} new entries`;
}

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
}) => (
  <div className="flex gap-3">
    <HudButton
      label={HUD_BUTTON_TEXT.phone}
      keyHint={HUD_BUTTON_TEXT.phoneKey}
      icon={<Smartphone className="h-4 w-4" aria-hidden="true" />}
      count={phoneUnread}
      countText={unreadMessagesText(phoneUnread)}
      pressed={phoneOpen}
      disabled={disabled}
      onClick={onPhone}
    />
    <HudButton
      label={HUD_BUTTON_TEXT.journal}
      keyHint={HUD_BUTTON_TEXT.journalKey}
      icon={<NotebookText className="h-4 w-4" aria-hidden="true" />}
      count={journalUnread}
      countText={newEntriesText(journalUnread)}
      pressed={journalOpen}
      disabled={disabled}
      onClick={onJournal}
    />
  </div>
);

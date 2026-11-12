// Phone home screen with the three apps: Messages, Calls and Northgate Bank (Requirement 7.1).
// Each app is a button with an icon and visible text, so it works with mouse and keyboard.

import React from "react";
import { useTranslation } from "react-i18next";
import { Landmark, MessageSquare, Phone } from "lucide-react";
import { formatNumber } from "../../../i18n/format";
import { useGameLocale } from "../../../i18n/useGameLocale";

export type PhoneAppId = "messages" | "calls" | "bank";

export interface PhoneHomeProps {
  /** Number of unread messages; shown as text on the Messages app. */
  unreadCount: number;
  /** Bank app title from Scenario_Data (for example "Northgate Bank"). */
  bankAppTitle: string;
  onOpenApp: (app: PhoneAppId) => void;
}

const APP_BUTTON =
  "flex w-full items-center gap-3 rounded-xl border border-[#38344f] bg-[#171521] px-4 py-3 text-left text-sm font-medium text-[#f7f5ff] motion-safe:transition-colors hover:border-[#7654d6] hover:bg-[#26233a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer";

const APP_ICON = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7654d6] text-white";

export const PhoneHome: React.FC<PhoneHomeProps> = ({ unreadCount, bankAppTitle, onOpenApp }) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  return (
    <div className="space-y-3">
      <h3 className="sr-only">{t("phone.home.heading")}</h3>
      <ul className="space-y-2">
        <li>
          <button type="button" className={APP_BUTTON} onClick={() => onOpenApp("messages")}>
            <span className={APP_ICON}>
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">{t("phone.home.messages")}</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#f2b24b] px-2 py-0.5 text-xs font-bold text-[#171521]">
                {t("phone.home.unread", { count: unreadCount, number: formatNumber(locale, unreadCount) })}
              </span>
            )}
          </button>
        </li>
        <li>
          <button type="button" className={APP_BUTTON} onClick={() => onOpenApp("calls")}>
            <span className={APP_ICON}>
              <Phone className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">{t("phone.home.calls")}</span>
          </button>
        </li>
        <li>
          <button type="button" className={APP_BUTTON} onClick={() => onOpenApp("bank")}>
            <span className={APP_ICON}>
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex-1">{bankAppTitle}</span>
          </button>
        </li>
      </ul>
    </div>
  );
};

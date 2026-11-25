// Small notice that an event arrived. It never takes focus or blocks play; the live region of the
// layer announces the same text once.
import React, { useEffect } from "react";
import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CINE, CINE_KEYCAP_STYLE } from "../theme";

export interface EventArrivalNoticeProps {
  title: string;
  onDismiss: () => void;
  /** Milliseconds before it dismisses itself. */
  durationMs?: number;
  /** The key that brings up the device it arrived on (P for the carried phone), shown as a key cap. */
  keyHint?: { key: string; label: string };
  /** The whole sentence to show instead of "New: <title>" (for example "Minh is calling"). */
  text?: string;
  /** Icon of the notice. Default: a bell. */
  icon?: React.ReactNode;
}

export const EventArrivalNotice: React.FC<EventArrivalNoticeProps> = ({ title, onDismiss, durationMs = 6000, keyHint, text, icon }) => {
  const { t } = useTranslation("chapter1");
  useEffect(() => {
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [onDismiss, durationMs, title]);
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl border border-white/15 bg-[#12111d]/82 px-3.5 py-2 text-[#f3efe4] shadow-[0_10px_32px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      style={{ fontSize: CINE.fontPx.body, maxWidth: CINE.widthPx.toast + 48 }}
      data-testid="event-arrival-notice"
    >
      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/35">
        {icon ?? <BellRing className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-[#f3efe4]">
        {text ?? t("planner.arrival", { title })}
      </span>
      {keyHint && (
        <span className="ml-1 flex shrink-0 items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.06] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-200" data-testid="event-arrival-key">
          <kbd aria-hidden="true" className="inline-flex items-center justify-center font-mono" style={CINE_KEYCAP_STYLE}>
            {keyHint.key}
          </kbd>
          <span>{keyHint.label}</span>
        </span>
      )}
    </div>
  );
};
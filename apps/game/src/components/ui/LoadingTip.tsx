import React, { useEffect, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LoadingTipProps {
  /** Tip text, already in the current locale (for example `t("loading:tips.<id>")`). */
  tips: readonly string[];
  /** Milliseconds between automatic tip changes. */
  intervalMs?: number;
  initialIndex?: number;
}

export const LoadingTip: React.FC<LoadingTipProps> = ({ tips, intervalMs = 8000, initialIndex = 0 }) => {
  const [index, setIndex] = useState(() => (tips.length ? initialIndex % tips.length : 0));
  const [paused, setPaused] = useState(false);
  const { t } = useTranslation("loading");

  // Rotation pauses while the player hovers or focuses the tip, so it can be read in full.
  useEffect(() => {
    if (paused || tips.length < 2) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % tips.length), intervalMs);
    return () => clearInterval(timer);
  }, [paused, tips.length, intervalMs]);

  if (tips.length === 0) return null;

  return (
    <aside
      aria-label={t("tipLabel")}
      className="w-full rounded-xl border border-[#38344f] bg-[#1d1b2b]/85 p-4 sm:p-5"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#b9a5f5]">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t("tipLabel")}
        </span>
        {tips.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((value) => (value + 1) % tips.length)}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-[#a9a4c4] transition-colors hover:bg-white/5 hover:text-[#f7f5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b9a5f5] cursor-pointer"
          >
            {t("nextTip")}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
      {/* Keyed so the fade restarts per tip; motion-reduce users get an instant swap. */}
      <p
        key={index}
        className="min-h-[3.75rem] text-sm leading-relaxed text-[#f7f5ff]/90 motion-safe:animate-fade-in"
        data-testid="loading-tip-text"
      >
        {tips[index]}
      </p>
    </aside>
  );
};

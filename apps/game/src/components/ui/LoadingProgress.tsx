import React from "react";
import { useTranslation } from "react-i18next";
import { formatPercent, useGameLocale } from "../../i18n";

interface LoadingProgressProps {
  /** 0..1 for measured progress; null shows an indeterminate bar. */
  progress: number | null;
  /** What is happening now. Announced politely to screen readers when it changes. */
  status: string;
  /** Optional secondary detail, for example a file count. */
  detail?: string;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({ progress, status, detail }) => {
  const determinate = progress !== null && Number.isFinite(progress);
  const percent = determinate ? Math.round(Math.min(Math.max(progress, 0), 1) * 100) : null;
  const { t } = useTranslation("loading");
  const locale = useGameLocale();
  const percentText = percent === null ? null : formatPercent(locale, percent / 100);

  return (
    <div className="w-full space-y-2.5">
      <div
        role="progressbar"
        aria-label={t("progressLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percentText ?? status}
        aria-busy={percent === null || percent < 100}
        data-state={determinate ? "determinate" : "indeterminate"}
        className="relative h-[3px] w-full overflow-hidden rounded-full bg-[#f7f5ff]/12"
      >
        {determinate ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7654d6] to-[#b9a5f5] motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <>
            {/* Moving segment for motion-tolerant users; a static dim bar otherwise. */}
            <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#b9a5f5] to-transparent motion-safe:animate-loading-sweep motion-reduce:hidden" />
            <div className="absolute inset-0 hidden rounded-full bg-[#7654d6]/45 motion-reduce:block" />
          </>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-4 font-mono text-[11px] sm:text-xs">
        <p className="min-w-0 truncate text-[#f7f5ff]" aria-live="polite">
          {status}
          {detail && <span className="ml-2 text-[#a9a4c4]">· {detail}</span>}
        </p>
        {percentText !== null && (
          <span className="shrink-0 font-semibold tabular-nums text-[#b9a5f5]" aria-hidden="true">
            {percentText}
          </span>
        )}
      </div>
    </div>
  );
};

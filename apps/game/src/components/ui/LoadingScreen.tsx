import React, { useEffect } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { LoadingProgress } from "./LoadingProgress";
import { LoadingTip } from "./LoadingTip";
import { LoadingErrorState } from "./LoadingErrorState";
import { useTranslation } from "react-i18next";
import type { LoadingError } from "../../game/loading/loadingErrors";
import { LOADING_BACKGROUND_JPG, LOADING_BACKGROUND_WEBP } from "../../config/assetPaths";

export interface LoadingNotice {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface LoadingScreenProps {
  /** Small label above the title, for example "Chapter 1". */
  eyebrow: string;
  chapterId?: string;
  chapterTitle: string;
  subtitle?: string;
  /** Human-readable description of the current loading step. */
  loadingStage: string;
  /** 0..1 when measured, null for indeterminate. */
  progress: number | null;
  progressDetail?: string;
  notice?: LoadingNotice | null;
  error?: LoadingError | null;
  onRetry?: () => void;
  onBackToMenu?: () => void;
  /** Shown as a quiet button while loading; Escape triggers it too. */
  onCancel?: () => void;
  retryLabel?: string;
  backLabel?: string;
  tips?: readonly string[];
  initialTipIndex?: number;
}

/** Presentational loading screen. Owns no loading logic; render it from any orchestrator. */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  eyebrow,
  chapterId,
  chapterTitle,
  subtitle,
  loadingStage,
  progress,
  progressDetail,
  notice,
  error,
  onRetry,
  onBackToMenu,
  onCancel,
  retryLabel,
  backLabel,
  tips,
  initialTipIndex,
}) => {
  const { t } = useTranslation("common");
  const escapeAction = error ? onBackToMenu : onCancel;

  useEffect(() => {
    if (!escapeAction) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") escapeAction();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [escapeAction]);

  return (
    <section
      aria-labelledby="loading-screen-title"
      aria-busy={!error}
      data-chapter-id={chapterId}
      className="relative flex h-full w-full flex-col overflow-hidden bg-[#171521] text-[#f7f5ff] select-none"
    >
      {/* Static artwork: no 3D rendering while loading. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <picture>
          <source srcSet={LOADING_BACKGROUND_WEBP} type="image/webp" />
          <img
            src={LOADING_BACKGROUND_JPG}
            alt=""
            width={1920}
            height={1080}
            decoding="async"
            className="h-full w-full object-cover object-center brightness-[0.62] contrast-[1.05]"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-[#171521] via-[#171521]/55 to-[#171521]/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#171521]/80 via-transparent to-transparent" />
      </div>

      <header className="relative z-10 flex items-center p-6 sm:p-10">
        <BrandLogo size="sm" />
      </header>

      <div className="relative z-10 mt-auto flex w-full flex-col gap-6 px-6 pb-7 sm:px-10 sm:pb-10">
        <div className="w-full max-w-2xl space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b9a5f5]">{eyebrow}</p>
          <h2
            id="loading-screen-title"
            className="font-display text-4xl leading-[1.05] text-[#f7f5ff] sm:text-5xl lg:text-6xl"
            style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}
          >
            {chapterTitle}
          </h2>
          {subtitle && <p className="pt-1 text-base text-[#a9a4c4] sm:text-lg">{subtitle}</p>}
        </div>

        {error ? (
          <div className="w-full max-w-2xl">
            <LoadingErrorState
              error={error}
              onRetry={onRetry}
              onBackToMenu={onBackToMenu}
              retryLabel={retryLabel}
              backLabel={backLabel}
            />
          </div>
        ) : (
          <div className="w-full space-y-4">
            <LoadingProgress progress={progress} status={loadingStage} detail={progressDetail} />

            {notice && (
              <div className="flex flex-col gap-2 rounded-lg border border-[#f2b24b]/30 bg-[#1d1b2b]/85 p-3 text-xs text-[#f7f5ff]/90 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f2b24b]" aria-hidden="true" />
                  {notice.message}
                </span>
                {notice.actionLabel && notice.onAction && (
                  <button
                    type="button"
                    onClick={notice.onAction}
                    className="shrink-0 rounded-md border border-[#38344f] px-3 py-1.5 font-medium text-[#f7f5ff] hover:border-[#7654d6] hover:bg-[#26233a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b9a5f5] cursor-pointer"
                  >
                    {notice.actionLabel}
                  </button>
                )}
              </div>
            )}

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="-ml-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#a9a4c4] transition-colors hover:text-[#f7f5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b9a5f5] cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {t("actions.cancel")}
              </button>
            )}
          </div>
        )}

        {tips && tips.length > 0 && (
          <div className="w-full max-w-md">
            <LoadingTip tips={tips} initialIndex={initialTipIndex} />
          </div>
        )}
      </div>
    </section>
  );
};

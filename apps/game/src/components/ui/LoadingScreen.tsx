import React, { useEffect } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { LoadingProgress } from "./LoadingProgress";
import { LoadingTip } from "./LoadingTip";
import { LoadingErrorState } from "./LoadingErrorState";
import { useTranslation } from "react-i18next";
import type { LoadingError } from "../../game/loading/loadingErrors";
import {
  BRAND_LOGO_PNG as LOGO_PNG,
  BRAND_LOGO_WEBP as LOGO_WEBP,
  LOADING_BACKGROUND_JPG,
  LOADING_BACKGROUND_WEBP,
} from "../../config/assetPaths";

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
        {/* Same readability layers as the main menu: bottom and left fades plus fine grain. */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c14] via-[#0d0c14]/45 to-[#0d0c14]/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0c14]/90 via-[#0d0c14]/30 to-transparent" />
        <div className="menu-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
      </div>

      <header className="relative z-10 flex items-center px-[clamp(1.5rem,6vw,6rem)] pt-[clamp(1.5rem,6vh,3.5rem)]">
        <picture className="block">
          <source srcSet={LOGO_WEBP} type="image/webp" />
          <img
            src={LOGO_PNG}
            alt=""
            width={1400}
            height={439}
            draggable={false}
            className="h-auto w-[clamp(10rem,16vw,15rem)] drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]"
          />
        </picture>
        <span className="sr-only">SCAMMAZE</span>
      </header>

      <div className="relative z-10 mt-auto flex w-full flex-col gap-7 px-[clamp(1.5rem,6vw,6rem)] pb-[clamp(1.75rem,6vh,3.5rem)]">
        <div className="menu-rise w-full max-w-3xl">
          <p className="flex items-center gap-3 font-menu text-sm font-semibold uppercase tracking-[0.3em] text-[#c9bbf7]">
            <span className="inline-block h-4 w-1.5 -skew-x-[18deg] bg-[#7654d6]" aria-hidden="true" />
            {eyebrow}
          </p>
          <h2
            id="loading-screen-title"
            className="mt-2 font-menu text-5xl font-bold uppercase leading-[0.95] tracking-[0.01em] text-[#f3efe4] sm:text-6xl lg:text-7xl"
            style={{ textShadow: "0 4px 24px rgba(0,0,0,0.7)" }}
          >
            {chapterTitle}
          </h2>
          {subtitle && <p className="mt-3 text-base text-zinc-300 sm:text-lg">{subtitle}</p>}
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

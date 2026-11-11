import React, { useEffect, useRef } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LoadingError } from "../../game/loading/loadingErrors";

interface LoadingErrorStateProps {
  error: LoadingError;
  onRetry?: () => void;
  onBackToMenu?: () => void;
  /** Already translated. Defaults to `common:actions.retry`. */
  retryLabel?: string;
  /** Already translated. Defaults to `common:actions.returnToMenu`. */
  backLabel?: string;
}

export const LoadingErrorState: React.FC<LoadingErrorStateProps> = ({
  error,
  onRetry,
  onBackToMenu,
  retryLabel,
  backLabel,
}) => {
  const { t } = useTranslation(["loading", "common"]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Title and message come from the error code; `detail` stays technical plain text.
  const title = t(`loading:errors.${error.code}.title`);
  const message = t(`loading:errors.${error.code}.message`);

  // Move focus to the message so keyboard and screen reader users land on it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [error]);

  const showRetry = error.retryable && onRetry;

  return (
    <div
      role="alert"
      className="w-full rounded-xl border border-[#ff7a85]/35 bg-[#1d1b2b]/92 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ff7a85]" aria-hidden="true" />
        <div className="min-w-0 space-y-1.5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-lg font-bold tracking-wide text-[#f7f5ff] outline-none"
          >
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-[#a9a4c4]">{message}</p>
          {error.detail && (
            <p className="break-all pt-1 font-mono text-[11px] text-[#a9a4c4]/75">{error.detail}</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        {onBackToMenu && (
          <button
            type="button"
            onClick={onBackToMenu}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#38344f] bg-[#171521] px-4 py-2.5 text-sm font-medium text-[#f7f5ff] transition-colors hover:border-[#7654d6] hover:bg-[#26233a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel ?? t("common:actions.returnToMenu")}
          </button>
        )}
        {showRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#7654d6] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#8b6be8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {retryLabel ?? t("common:actions.retry")}
          </button>
        )}
      </div>
    </div>
  );
};

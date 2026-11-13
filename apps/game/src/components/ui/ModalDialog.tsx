import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** "wide" is a landscape panel for two-column content (settings, credits). */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "wide";
}

/**
 * Menu-style dialog: square dark panel, slanted purple accent, condensed caps title and a
 * key-cap close button, matching the main menu and its footer hints.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "lg",
}) => {
  const { t } = useTranslation("common");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
    wide: "max-w-[min(72rem,94vw)]",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-text pointer-events-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#08070e]/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`menu-rise relative flex max-h-[88vh] w-full flex-col overflow-hidden border border-white/10 bg-[#0d0c14]/95 shadow-[0_24px_80px_rgba(0,0,0,0.7)] ${maxWidthClasses[maxWidth]}`}
      >
        {/* Purple top edge, like the menu divider */}
        <div
          aria-hidden="true"
          className="h-[2px] w-full bg-[linear-gradient(90deg,#7654d6,rgba(185,165,245,0.35)_55%,rgba(185,165,245,0))]"
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 inline-block h-6 w-2 shrink-0 -skew-x-12 bg-[#7654d6]" />
            <div>
              <h2
                id="modal-title"
                className="font-menu text-2xl font-bold uppercase leading-none tracking-[0.04em] text-[#f3efe4] sm:text-[1.75rem]"
              >
                {title}
              </h2>
              {subtitle && <p className="mt-1.5 text-xs leading-snug text-zinc-400">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("actions.close")}
            className="group flex shrink-0 items-center gap-1.5 font-menu text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400 outline-none transition-colors hover:text-zinc-100 focus-visible:text-zinc-100 cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="border border-white/20 bg-black/40 px-1.5 py-0.5 text-zinc-200 transition-colors group-hover:border-white/50 group-focus-visible:border-[#f3efe4]"
            >
              Esc
            </span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 overflow-y-auto px-5 py-5 text-sm text-zinc-200 sm:px-7 sm:py-6">{children}</div>
      </div>
    </div>
  );
};

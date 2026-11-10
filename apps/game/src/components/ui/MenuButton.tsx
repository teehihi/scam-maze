import React from "react";
import type { LucideIcon } from "lucide-react";

interface MenuButtonProps {
  label: string;
  sublabel?: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  onHover?: () => void;
  className?: string;
}

export const MenuButton: React.FC<MenuButtonProps> = ({
  label,
  sublabel,
  icon: Icon,
  variant = "secondary",
  disabled = false,
  disabledReason,
  onClick,
  onHover,
  className = "",
}) => {
  const isPrimary = variant === "primary";

  return (
    <div className="relative group w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        onPointerEnter={() => {
          if (!disabled) onHover?.();
        }}
        className={`w-full text-left transition-all duration-200 flex items-center justify-between border-0 outline-none select-none ${
          isPrimary
            ? "py-3 px-5 sm:px-6 min-h-[64px] sm:min-h-[66px]"
            : "py-2.5 px-4.5 sm:px-5 min-h-[46px] sm:min-h-[48px]"
        } ${
          disabled
            ? "opacity-50 grayscale-[0.6] cursor-not-allowed filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            : isPrimary
              ? "cursor-pointer transform hover:-translate-y-0.5 hover:brightness-110 filter drop-shadow-[0_6px_20px_rgba(118,84,214,0.45)] hover:drop-shadow-[0_8px_28px_rgba(118,84,214,0.75)]"
              : "cursor-pointer transform hover:-translate-y-0.5 hover:brightness-125 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] hover:drop-shadow-[0_4px_16px_rgba(118,84,214,0.3)]"
        } ${className}`}
        style={{
          backgroundImage: isPrimary
            ? "url('/assets/ui/btn_primary.webp')"
            : "url('/assets/ui/btn_secondary.webp')",
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <Icon
              className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                isPrimary
                  ? "w-6 h-6 text-white"
                  : disabled
                    ? "w-5 h-5 text-zinc-600"
                    : "w-5 h-5 text-[#b9a5f5]"
              }`}
            />
          )}
          <div className="flex flex-col min-w-0">
            <span
              className={`font-semibold tracking-wide ${
                isPrimary ? "text-base sm:text-lg font-bold text-white" : "text-xs sm:text-sm text-zinc-100"
              }`}
            >
              {label}
            </span>
            {sublabel && (
              <span
                className={`font-mono truncate ${
                  isPrimary
                    ? "text-xs text-purple-200 group-hover:text-white"
                    : "text-[10.5px] sm:text-[11px] text-zinc-400 group-hover:text-zinc-300"
                }`}
              >
                {sublabel}
              </span>
            )}
          </div>
        </div>

        {/* Visual indicator / accent pill for disabled state */}
        {disabled && (
          <div className="shrink-0 flex items-center gap-2 ml-1">
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
              Unavailable
            </span>
          </div>
        )}
      </button>

      {/* Tooltip for disabled reason */}
      {disabled && disabledReason && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30 w-56 p-2 rounded-lg bg-[#14121d] border border-[#38344f] text-xs text-zinc-300 shadow-xl backdrop-blur-md">
          {disabledReason}
        </div>
      )}
    </div>
  );
};

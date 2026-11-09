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
  className = "",
}) => {
  const isPrimary = variant === "primary";

  return (
    <div className="relative group w-full max-w-sm">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-full text-left py-3.5 px-5 rounded-xl transition-all duration-200 flex items-center justify-between border ${
          disabled
            ? "bg-[#181622]/60 border-[#2d293d]/50 text-zinc-500 cursor-not-allowed opacity-60"
            : isPrimary
              ? "bg-gradient-to-r from-[#7654d6] to-[#5b3eb3] hover:from-[#8b6be8] hover:to-[#6a4ac4] text-white border-[#9c7bf5]/50 shadow-[0_0_24px_rgba(118,84,214,0.35)] hover:shadow-[0_0_32px_rgba(118,84,214,0.55)] cursor-pointer transform hover:-translate-y-0.5"
              : "bg-[#171521]/80 hover:bg-[#201d2e] border-[#38344f] hover:border-[#7654d6]/60 text-zinc-200 hover:text-white shadow-lg backdrop-blur-md cursor-pointer transform hover:-translate-y-0.5"
        } ${className}`}
      >
        <div className="flex items-center gap-3.5">
          {Icon && (
            <Icon
              className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                isPrimary ? "text-white" : disabled ? "text-zinc-600" : "text-[#b9a5f5]"
              }`}
            />
          )}
          <div className="flex flex-col">
            <span
              className={`font-semibold tracking-wide ${
                isPrimary ? "text-base text-white" : "text-sm text-zinc-100"
              }`}
            >
              {label}
            </span>
            {sublabel && (
              <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300 font-mono">
                {sublabel}
              </span>
            )}
          </div>
        </div>

        {/* Visual indicator / accent pill */}
        <div className="flex items-center gap-2">
          {disabled ? (
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
              Unavailable
            </span>
          ) : isPrimary ? (
            <span className="text-xs uppercase font-mono tracking-widest text-[#e9e2ff] bg-white/15 px-2 py-0.5 rounded-md font-bold">
              START
            </span>
          ) : null}
        </div>
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

import React from "react";
import { useReducedMotion } from "./useReducedMotion";
import { playUiHoverSound } from "./hoverSound";

/** Chat bubble icon shared by every dialogue reply pill. */
export const CHOICE_ICON_CHAT = "/assets/ui/hud/scammaze-chat-icon-512.png";

export interface ChoicePillProps {
  /** Highlighted reply: light pill, sweep highlight, inverted icon. */
  selected: boolean;
  /** Key hint shown on the right of the pill (for example "1"). */
  keyHint?: string;
  /** Dims a reply the player already asked. */
  dimmed?: boolean;
  /** Small cue before the text, for example a tone dot. Decorative. */
  cue?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  onPointerEnter?: () => void;
  onFocus?: () => void;
  children: React.ReactNode;
}

/**
 * Genshin-style reply pill: rounded, chat icon on the left, a white highlight that sweeps in from
 * the left when selected. Presentational only; the caller owns selection and key handling.
 */
export const ChoicePill: React.FC<ChoicePillProps> = ({ selected, keyHint, dimmed = false, cue, disabled, onClick, onPointerEnter, onFocus, children }) => {
  const reducedMotion = useReducedMotion();
  const tone = selected ? "border-white/80 text-[#171521]" : dimmed ? "border-white/20 bg-black/45 text-zinc-300/70" : "border-white/30 bg-black/55 text-zinc-100";
  return (
    <button
      type="button"
      data-testid="choice-pill"
      aria-current={selected ? "true" : undefined}
      data-selected={selected ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={() => {
        if (!selected && !disabled) playUiHoverSound();
        onPointerEnter?.();
      }}
      onFocus={onFocus}
      className={`relative flex w-full min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-full border px-4 py-2 text-left text-[15px] font-medium leading-snug whitespace-normal break-words outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-lavender disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 origin-left bg-white/90"
        style={{
          transform: selected ? "scaleX(1)" : "scaleX(0)",
          opacity: selected ? 1 : 0,
          transition: reducedMotion ? "none" : selected ? "transform 380ms cubic-bezier(0.22,1,0.36,1), opacity 120ms" : "opacity 220ms ease-out, transform 0s linear 220ms",
        }}
      />
      <img data-testid="choice-icon" src={CHOICE_ICON_CHAT} alt="" aria-hidden="true" width={22} height={22} draggable={false} className={`relative h-[22px] w-[22px] shrink-0 transition-[filter] duration-300 ${selected ? "invert" : ""}`} />
      {cue}
      <span className="relative min-w-0 flex-1">{children}</span>
      {keyHint && (
        <kbd className={`relative inline-flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-[4px] border px-1 font-mono text-[11px] font-bold ${selected ? "border-[#171521]/40 bg-[#171521]/10 text-[#171521]" : "border-white/30 bg-black/50 text-lavender"}`}>
          {keyHint}
        </kbd>
      )}
    </button>
  );
};

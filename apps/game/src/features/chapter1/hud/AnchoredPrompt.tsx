// Interaction prompt drawn next to the aimed prop: a key-cap pill with the key and the verb label.
// The engine projects the prop's world point to container pixels (`UIState.anchor`); this
// component only places a small box beside it (`placePrompt`, pure). Presentation only.
import React from "react";
import { placePrompt } from "../../roomv2/game/screenProjection";
import { CINE } from "../theme";
import { useViewport } from "../call/useViewport";

export interface AnchoredPromptProps {
  /** Verb label of the aimed prop, for example "Use the laptop". Already translated. */
  label: string;
  /** Projected world point of the prop, in pixels from the top-left of the room view. */
  anchor: { x: number; y: number };
  /** The key that runs the interaction. */
  keyLabel?: string;
}

export const AnchoredPrompt: React.FC<AnchoredPromptProps> = ({ label, anchor, keyLabel = "E" }) => {
  const viewport = useViewport();
  const { offsetPx, marginPx, boxWidthPx, boxHeightPx } = CINE.prompt;
  const { left, top } = placePrompt(anchor.x, anchor.y, viewport.width, viewport.height, boxWidthPx, boxHeightPx, offsetPx, marginPx);
  return (
    <div
      data-testid="anchored-prompt"
      className="pointer-events-none absolute flex items-center gap-2 whitespace-nowrap rounded-md border border-white/15 bg-[#100f18]/75 px-2.5 py-1.5 text-[#f3efe4] shadow-[0_8px_24px_rgba(0,0,0,0.55)] backdrop-blur-md"
      style={{
        fontSize: CINE.fontPx.small,
        left,
        top,
        maxWidth: boxWidthPx,
      }}
    >
      <kbd
        aria-hidden="true"
        className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-amber-300/55 bg-amber-300/15 px-1 font-mono text-[11px] font-bold leading-none text-amber-200"
      >
        {keyLabel}
      </kbd>
      <span className="font-menu text-[14px] font-semibold tracking-[0.04em]">{label}</span>
    </div>
  );
};

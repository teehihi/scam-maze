// Ending transition, shown when an Outcome is set and before the Debrief_Screen.
// Presentational: the page passes the outcome data and handles Continue (FINISH_CHAPTER).
// See design.md, "UI components", and Requirements 13.11, 14.1.

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CircleCheck, CircleHelp, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import type { DebriefView } from "../../../game/narrative/debrief";
import type { OutcomeId } from "../../../game/narrative/chapter1/ids";
import { UI } from "../theme";

/** The outcome data the transition needs. `DebriefView["outcome"]` can be passed directly. */
export type EndingTransitionOutcome = Pick<
  DebriefView["outcome"],
  "id" | "title" | "consequence" | "simulationLabel"
>;

export interface EndingTransitionProps {
  outcome: EndingTransitionOutcome;
  onContinue: () => void;
}

export const ENDING_TEXT = {
  eyebrow: "Chapter ending",
  continue: "Continue",
} as const;

/** Fade-in duration when motion is allowed. Reduced motion shows the screen at once. */
export const ENDING_FADE_MS = 600;

/**
 * Accent per Outcome. The color is decoration only: the title and consequence text carry the
 * meaning (icons.md, "Never rely on an icon or its color alone").
 */
const ACCENTS: Record<OutcomeId, { icon: LucideIcon; text: string; border: string }> = {
  verified: { icon: CircleCheck, text: UI.textPositive, border: "border-[#4fd1b5]/50" },
  risky: { icon: AlertTriangle, text: UI.textWarning, border: "border-[#f2b24b]/50" },
  uncertain: { icon: CircleHelp, text: "text-[#b9a5f5]", border: "border-[#b9a5f5]/50" },
};

export const EndingTransition: React.FC<EndingTransitionProps> = ({ outcome, onContinue }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [entered, setEntered] = useState(reducedMotion);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const accent = ACCENTS[outcome.id];
  const Icon = accent.icon;

  useEffect(() => {
    headingRef.current?.focus();
    if (reducedMotion) {
      setEntered(true);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const duration = reducedMotion ? 0 : ENDING_FADE_MS;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="ending-transition-heading"
      data-testid="ending-transition"
      data-outcome={outcome.id}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#171521]/95 p-4 sm:p-8"
      style={{
        opacity: entered ? 1 : 0,
        transitionProperty: "opacity",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "ease-out",
      }}
    >
      <div className={`${UI.panel} ${accent.border} max-w-xl space-y-5`}>
        <p className={`flex items-center gap-2 ${UI.label}`}>
          <Icon className={`h-4 w-4 ${accent.text}`} aria-hidden="true" />
          {ENDING_TEXT.eyebrow}
        </p>
        <h2
          id="ending-transition-heading"
          ref={headingRef}
          tabIndex={-1}
          className={`font-display text-3xl leading-tight outline-none sm:text-4xl ${accent.text}`}
        >
          {outcome.title}
        </h2>
        {outcome.consequence && (
          <p className="text-base leading-relaxed text-[#f7f5ff]" data-variant={outcome.consequence.id}>
            {outcome.consequence.text}
          </p>
        )}
        <p className={`flex items-center gap-2 ${UI.card} text-sm font-semibold text-[#f7f5ff]`}>
          <Info className="h-4 w-4 shrink-0 text-[#b9a5f5]" aria-hidden="true" />
          {outcome.simulationLabel}
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onContinue} className={UI.buttonPrimary}>
            {ENDING_TEXT.continue}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};

// Ending transition, shown when an Outcome is set and before the Debrief_Screen.
// Presentational: the page passes the outcome data and handles Continue (FINISH_CHAPTER).
// See design.md, "UI components", and Requirements 13.11, 14.1.

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

/** Authored aftermath text of the ending (from the localized scenario). */
export interface EndingTransitionAftermath {
  consequence: string;
  phone: string;
  laptop: string;
  evidenceSummary: string;
}

/** The current narration line (from `useNarrationPlayback`). `null` text: nothing to show. */
export interface EndingTransitionNarration {
  speakerName: string | null;
  text: string | null;
  /** False hides the text when the clip is audible and subtitles are off. */
  visible: boolean;
  finished: boolean;
  onAdvance: () => void;
}

export interface EndingTransitionProps {
  outcome: EndingTransitionOutcome;
  aftermath?: EndingTransitionAftermath;
  narration?: EndingTransitionNarration;
  onContinue: () => void;
}

/** English source text; the rendered text comes from `chapter1:ending.*`. */
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
  "break-the-chain": { icon: CircleCheck, text: UI.textPositive, border: "border-[#4fd1b5]/50" },
  "perfect-chain": { icon: AlertTriangle, text: UI.textWarning, border: "border-[#b9a5f5]/50" },
  "false-victory": { icon: AlertTriangle, text: UI.textWarning, border: "border-[#b9a5f5]/50" },
  "unfinished-case": { icon: CircleHelp, text: "text-[#b9a5f5]", border: "border-[#b9a5f5]/50" },
};

export const EndingTransition: React.FC<EndingTransitionProps> = ({ outcome, aftermath, narration, onContinue }) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as (key: string) => string;
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
      className="fixed inset-0 z-50 flex overflow-y-auto bg-[#171521]/95 p-4 sm:p-8"
      style={{
        opacity: entered ? 1 : 0,
        transitionProperty: "opacity",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "ease-out",
      }}
    >
      <div className={`${UI.panel} ${accent.border} m-auto max-w-xl space-y-5`}>
        <p className={`flex items-center gap-2 ${UI.label}`}>
          <Icon className={`h-4 w-4 ${accent.text}`} aria-hidden="true" />
          {t("ending.eyebrow")}
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
        {aftermath && (
          <div className="space-y-3" data-testid="ending-aftermath">
            <p className={UI.body} data-testid="ending-aftermath-consequence">
              {aftermath.consequence}
            </p>
            <section aria-labelledby="ending-phone-heading" className={`${UI.card} space-y-1`}>
              <h3 id="ending-phone-heading" className={UI.label}>
                {text("debriefForensic.ending.phone")}
              </h3>
              <p className="text-sm leading-relaxed text-[#f7f5ff]">{aftermath.phone}</p>
            </section>
            <section aria-labelledby="ending-laptop-heading" className={`${UI.card} space-y-1`}>
              <h3 id="ending-laptop-heading" className={UI.label}>
                {text("debriefForensic.ending.laptop")}
              </h3>
              <p className="text-sm leading-relaxed text-[#f7f5ff]">{aftermath.laptop}</p>
            </section>
            <section aria-labelledby="ending-evidence-heading" className={`${UI.card} space-y-1`}>
              <h3 id="ending-evidence-heading" className={UI.label}>
                {text("debriefForensic.ending.evidence")}
              </h3>
              <p className="text-sm leading-relaxed text-[#f7f5ff]">{aftermath.evidenceSummary}</p>
            </section>
          </div>
        )}
        {narration && !narration.finished && narration.text !== null && (
          <section aria-label={text("debriefForensic.ending.narration")} className="space-y-2" data-testid="ending-narration">
            {narration.visible && (
              <p className="text-sm italic leading-relaxed text-[#a9a4c4]" aria-live="polite">
                {narration.text}
              </p>
            )}
            <button type="button" onClick={narration.onAdvance} className={UI.buttonSecondary}>
              {text("debriefForensic.ending.next")}
            </button>
          </section>
        )}
        <p className={`flex items-center gap-2 ${UI.card} text-sm font-semibold text-[#f7f5ff]`}>
          <Info className="h-4 w-4 shrink-0 text-[#b9a5f5]" aria-hidden="true" />
          {outcome.simulationLabel}
        </p>
        <div className="flex justify-end">
          <button type="button" onClick={onContinue} className={UI.buttonPrimary}>
            {t("ending.continue")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};

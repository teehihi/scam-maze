// Debrief screen, shown after the ending transition. Renders a DebriefView from `buildDebrief`.
// Presentational: the page passes the view and handles Replay and Return to menu.
// See design.md, "Debrief builder" and "UI components", and Requirements 13.11, 14.1, 14.3.
//
// Wording rules: never call anything "safe" (safety.md), and never blame the player
// (audience.md). Missed clues are framed as things to look for next time.

import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Eye,
  Flag,
  Footprints,
  Home,
  Info,
  Lightbulb,
  RotateCcw,
  Search,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DebriefView } from "../../../game/narrative/debrief";
import { UI } from "../theme";

export interface DebriefScreenProps {
  view: DebriefView;
  onReplay: () => void;
  onReturnToMenu: () => void;
}

/** English source text; the rendered text comes from `chapter1:debrief.*`. */
export const DEBRIEF_TEXT = {
  eyebrow: "Debrief",
  outcome: "Your outcome",
  decisions: "Your key decisions",
  decisionsEmpty: "No key decisions were recorded in this run.",
  evidenceFound: "Evidence you found",
  evidenceFoundEmpty: "No evidence was recorded in this run.",
  warningSigns: "Warning signs you noticed",
  warningSignsEmpty: "No warning signs were recorded in this run.",
  cluesMissed: "Clues to look for next time",
  cluesMissedEmpty: "You found every clue in this chapter.",
  mechanism: "How this scam works",
  saferAlternatives: "Better choices next time",
  replay: "Replay chapter",
  returnToMenu: "Return to menu",
} as const;

interface SectionProps {
  id: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

const DebriefSection: React.FC<SectionProps> = ({ id, title, icon: Icon, children }) => (
  <section aria-labelledby={id} className="space-y-3">
    <h3 id={id} className="flex items-center gap-2 text-base font-bold text-[#f7f5ff]">
      <Icon className="h-4 w-4 text-[#b9a5f5]" aria-hidden="true" />
      {title}
    </h3>
    {children}
  </section>
);

const EmptyNote: React.FC<{ text: string }> = ({ text }) => <p className={UI.body}>{text}</p>;

export const DebriefScreen: React.FC<DebriefScreenProps> = ({ view, onReplay, onReturnToMenu }) => {
  const { t } = useTranslation("chapter1");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { outcome } = view;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="debrief-heading"
      data-testid="debrief-screen"
      data-outcome={outcome.id}
      className="fixed inset-0 z-50 overflow-y-auto bg-[#171521] p-4 text-[#f7f5ff] sm:p-8"
    >
      <article aria-labelledby="debrief-heading" className="mx-auto w-full max-w-2xl space-y-8 pb-8">
        <header className="space-y-3">
          <p className={UI.label}>{t("debrief.eyebrow")}</p>
          <h2
            id="debrief-heading"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-3xl leading-tight outline-none sm:text-4xl"
          >
            {outcome.title}
          </h2>
          <p className={`flex items-center gap-2 ${UI.card} text-sm font-semibold`}>
            <Info className="h-4 w-4 shrink-0 text-[#b9a5f5]" aria-hidden="true" />
            {outcome.simulationLabel}
          </p>
        </header>

        <DebriefSection id="debrief-outcome" title={t("debrief.outcome")} icon={Flag}>
          {outcome.summary && <p className={UI.body}>{outcome.summary}</p>}
          {outcome.consequence && (
            <p className={`${UI.card} text-sm leading-relaxed`} data-variant={outcome.consequence.id}>
              {outcome.consequence.text}
            </p>
          )}
        </DebriefSection>

        <DebriefSection id="debrief-decisions" title={t("debrief.decisions")} icon={Footprints}>
          {view.decisions.length === 0 ? (
            <EmptyNote text={t("debrief.decisionsEmpty")} />
          ) : (
            <ol className="space-y-2">
              {view.decisions.map((decision) => (
                <li key={`${decision.seq}-${decision.tag}`} className={`${UI.card} text-sm leading-relaxed`}>
                  {decision.text}
                </li>
              ))}
            </ol>
          )}
        </DebriefSection>

        <DebriefSection id="debrief-evidence" title={t("debrief.evidenceFound")} icon={Search}>
          {view.evidenceFound.length === 0 ? (
            <EmptyNote text={t("debrief.evidenceFoundEmpty")} />
          ) : (
            <ul className="space-y-2">
              {view.evidenceFound.map((item) => (
                <li key={item.id} className={`${UI.card} text-sm`}>
                  {item.title}
                </li>
              ))}
            </ul>
          )}
        </DebriefSection>

        <DebriefSection id="debrief-warning-signs" title={t("debrief.warningSigns")} icon={Eye}>
          {view.warningSignsNoticed.length === 0 ? (
            <EmptyNote text={t("debrief.warningSignsEmpty")} />
          ) : (
            <ul className="space-y-2">
              {view.warningSignsNoticed.map((sign) => (
                <li key={sign.id} className={`${UI.card} text-sm`}>
                  {sign.label}
                </li>
              ))}
            </ul>
          )}
        </DebriefSection>

        <DebriefSection id="debrief-clues-missed" title={t("debrief.cluesMissed")} icon={Lightbulb}>
          {view.cluesMissed.length === 0 ? (
            <EmptyNote text={t("debrief.cluesMissedEmpty")} />
          ) : (
            <ul className="space-y-2">
              {view.cluesMissed.map((clue) => (
                <li key={clue.id} className={`${UI.card} space-y-1`}>
                  <p className="text-sm font-semibold">{clue.title}</p>
                  <p className={UI.body}>{clue.hint}</p>
                </li>
              ))}
            </ul>
          )}
        </DebriefSection>

        <DebriefSection id="debrief-mechanism" title={t("debrief.mechanism")} icon={Workflow}>
          <p className={UI.body}>{view.mechanism}</p>
        </DebriefSection>

        <DebriefSection id="debrief-better-choices" title={t("debrief.saferAlternatives")} icon={BookOpen}>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#a9a4c4] marker:text-[#b9a5f5]">
            {view.saferAlternatives.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </DebriefSection>

        <div className="flex flex-col gap-3 border-t border-[#38344f] pt-6 sm:flex-row sm:justify-end">
          <button type="button" onClick={onReturnToMenu} className={UI.buttonSecondary}>
            <Home className="h-4 w-4" aria-hidden="true" />
            {t("debrief.returnToMenu")}
          </button>
          <button type="button" onClick={onReplay} className={UI.buttonPrimary}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t("debrief.replay")}
          </button>
        </div>
      </article>
    </div>
  );
};

// Citation Detective: the introduction review as an inspection task. The player opens the claim,
// picks the wording that outruns the evidence, and reads the source cards. Nothing is highlighted
// beforehand: the same three sources are shown as plain, closed cards. Only after that work does the
// desk offer the authored approaches, and only an approach the player picks reaches the reducer.
import React, { useState } from "react";
import { AlertTriangle, ChevronRight, MousePointer2, Search } from "lucide-react";
import { ChoiceList, MINI, TOOL, type CitationInvestigationState, type ReviewProps } from "./thesisDeskChrome";

/** The claim the scenario puts in the draft, with the terms a reviewer can point at. */
const TERMS = ["always", "peer forums", "on time"] as const;

export const CitationDetective: React.FC<ReviewProps> = (props) => {
  const { t, investigation, onInvestigationChange } = props;
  const [localState, setLocalState] = useState<CitationInvestigationState>({ claimInspected: false, selectedTerm: null, openSources: new Set<number>() });
  const state = investigation?.citation ?? localState;
  const claimInspected = state.claimInspected;
  const selectedTerm = state.selectedTerm;
  const openSources = state.openSources;
  const update = (next: Partial<typeof state>) => {
    if (onInvestigationChange) onInvestigationChange({ citation: { ...state, ...next } });
    else setLocalState((current) => ({ ...current, ...next }));
  };
  const sources = [
    t("laptop.thesisDesk.introReview.sourceOne"),
    t("laptop.thesisDesk.introReview.sourceTwo"),
    t("laptop.thesisDesk.introReview.sourceThree"),
  ];
  // At least two sources must be read, so a choice is made after comparing evidence, not before.
  const ready = claimInspected && selectedTerm !== null && openSources.size >= 2;
  const toggleSource = (index: number) => {
    const next = new Set(openSources);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    update({ openSources: next });
  };
  return (
    <>
      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-lg border border-[#c9d3e6] bg-[#fbfcff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{t("laptop.thesisDesk.introReview.claimLabel")}</p>
            <button type="button" className={TOOL} data-testid="citation-inspect-claim" onClick={() => update({ claimInspected: true })}>
              <MousePointer2 className="h-3.5 w-3.5 text-[#3a63c2]" aria-hidden="true" />
              {t("laptop.thesisDesk.interactive.inspect")}
            </button>
          </div>
          <p
            className={`mt-3 rounded-md border p-3 text-sm leading-relaxed ${
              claimInspected ? "border-[#9db9ef] bg-white text-[#1f2937]" : "border-[#e7ebf3] bg-[#f5f7fb] text-[#4b5563]"
            }`}
            data-testid="citation-claim"
            data-inspected={claimInspected ? "true" : undefined}
          >
            {t("laptop.thesisDesk.introReview.claim")}
          </p>
          <p className="mt-4 text-xs font-semibold text-[#6b7280]">{t("laptop.thesisDesk.interactive.inspectTerm")}</p>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="citation-terms" role="group" aria-label={t("laptop.thesisDesk.interactive.inspectTerm")}>
            {TERMS.map((term) => (
              <button
                key={term}
                type="button"
                className={`${MINI} ${selectedTerm === term ? "border-[#3a63c2] bg-[#e4edfd] text-[#1f3f86]" : ""}`}
                aria-pressed={selectedTerm === term}
                data-testid={`citation-term-${term.replaceAll(" ", "-")}`}
                onClick={() => update({ selectedTerm: term })}
              >
                {term}
              </button>
            ))}
          </div>
          {selectedTerm !== null && (
            <p className="mt-2 text-xs leading-relaxed text-[#4b5563]" data-testid="citation-selected">
              {t("laptop.thesisDesk.interactive.selectedTerm", { term: selectedTerm })}
            </p>
          )}
        </article>
        <aside className="rounded-lg border border-[#e7d8a6] bg-[#fff7df] p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-[#a16207]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {t("laptop.thesisDesk.introReview.noteLabel")}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#6b4c13]">{t("laptop.thesisDesk.introReview.note")}</p>
        </aside>
      </div>
      <section className="mt-4 rounded-lg border border-[#c9d3e6] bg-white p-4" aria-label={t("laptop.thesisDesk.interactive.sourceTray")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {t("laptop.thesisDesk.interactive.sourceTray")}
          </p>
          <span className="text-xs tabular-nums text-[#6b7280]" data-testid="citation-source-count">
            {openSources.size}/3 {t("laptop.thesisDesk.interactive.opened")}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {sources.map((source, index) => {
            const opened = openSources.has(index);
            return (
              <button
                key={source}
                type="button"
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  opened ? "border-[#9db9ef] bg-[#f4f7ff] text-[#1f2937]" : "border-[#e4e9f2] bg-[#fbfcff] text-[#4b5563] hover:border-[#9db9ef]"
                }`}
                data-testid={`citation-source-${index}`}
                aria-expanded={opened}
                onClick={() => toggleSource(index)}
              >
                <span className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 font-mono text-[10px] text-[#3a63c2]">SRC {index + 1}</span>
                  <span className="leading-relaxed">{source}</span>
                  <ChevronRight className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform ${opened ? "rotate-90" : ""}`} aria-hidden="true" />
                </span>
                {opened && (
                  <span className="mt-2 block border-t border-[#dce5f6] pt-2 leading-relaxed text-[#4b5563]">
                    <span className="mb-1 inline-flex rounded-full border border-[#c9d3e6] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#3a63c2]">
                      {t(`laptop.thesisDesk.interactive.${index === 0 ? "methodCorrelation" : index === 1 ? "methodInterview" : "methodNoTiming"}`)}
                    </span>
                    <span className="block">{t("laptop.thesisDesk.interactive.sourceOpened")}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      <div className="mt-5">
        <ChoiceList {...props} ready={ready} readyHint={t("laptop.thesisDesk.interactive.citationReady")} />
      </div>
    </>
  );
};

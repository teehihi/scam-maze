// Data Forensics: the findings review as a data check. The source excerpt says six participants; the
// chart adds up to eight. The player reads both, picks a participant card, and adjusts the chart until
// the total agrees with the source record, then compares. The canonical numbers of the scenario are
// never rewritten here: the counters only change what the desk shows, and the outcome still comes from
// the authored approaches in the reducer.
import React, { useState } from "react";
import { Database, FileText, ScanSearch, Search, Table2 } from "lucide-react";
import { ChoiceList, MINI, TOOL, type FindingsInvestigationState, type ReviewProps } from "./thesisDeskChrome";

/** The source record of the scenario: six participants. */
const SOURCE_TOTAL = 6;
/** What the authored chart prints today: 4 + 4. */
const CHART_START = { business: 4, economics: 4 } as const;

export const DataForensics: React.FC<ReviewProps> = (props) => {
  const { t, investigation, onInvestigationChange } = props;
  const [localState, setLocalState] = useState<FindingsInvestigationState>({ inspectedExcerpt: false, inspectedChart: false, selectedParticipant: null, counts: { ...CHART_START }, compared: false });
  const state = investigation?.findings ?? localState;
  const { inspectedExcerpt, inspectedChart, selectedParticipant, counts, compared } = state;
  const duplicatesScanned = state.duplicatesScanned === true;
  const update = (next: Partial<typeof state>) => {
    if (onInvestigationChange) onInvestigationChange({ findings: { ...state, ...next } });
    else setLocalState((current) => ({ ...current, ...next }));
  };
  const total = counts.business + counts.economics;
  // The reviewer must see the mismatch first and then leave the chart reconciled with the source.
  // The steppers stay live the whole time, so a wrong adjustment is never a dead end.
  const matches = total === SOURCE_TOTAL;
  // The duplicate scan is part of the work: it is how the player learns the excerpt carries no
  // participant identifiers, so a reconciled total is the only honest answer available.
  const ready = inspectedExcerpt && inspectedChart && selectedParticipant !== null && duplicatesScanned && compared && matches;
  const updateCount = (group: "business" | "economics", delta: number) => {
    const value = Math.max(0, Math.min(SOURCE_TOTAL, counts[group] + delta));
    const nextCounts = group === "business" ? { ...counts, business: value } : { ...counts, economics: value };
    // Any chart adjustment requires a fresh comparison before the approach can be chosen.
    update({ counts: nextCounts, compared: false });
  };
  return (
    <>
      <div className="grid gap-3 xl:grid-cols-2">
        <article className={`rounded-lg border p-4 ${inspectedExcerpt ? "border-[#9db9ef] bg-white" : "border-[#c9d3e6] bg-[#fbfcff]"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{t("laptop.thesisDesk.findingsReview.excerptLabel")}</p>
            <button type="button" className={TOOL} data-testid="findings-inspect-excerpt" onClick={() => update({ inspectedExcerpt: true })}>
              <FileText className="h-3.5 w-3.5 text-[#3a63c2]" aria-hidden="true" />
              {t("laptop.thesisDesk.interactive.inspect")}
            </button>
          </div>
          <blockquote className="mt-3 border-l-2 border-[#3a63c2] pl-3 text-sm leading-relaxed text-[#1f2937]">
            {t("laptop.thesisDesk.findingsReview.excerpt")}
          </blockquote>
          <p className="mt-3 text-xs text-[#6b7280]" data-testid="findings-source-total">
            {t("laptop.thesisDesk.interactive.sourceTotal", { count: SOURCE_TOTAL })}
          </p>
        </article>
        <article className={`rounded-lg border p-4 ${inspectedChart ? "border-[#9db9ef] bg-white" : "border-[#c9d3e6] bg-[#fbfcff]"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{t("laptop.thesisDesk.findingsReview.chartLabel")}</p>
            <button type="button" className={TOOL} data-testid="findings-inspect-chart" onClick={() => update({ inspectedChart: true })}>
              <Table2 className="h-3.5 w-3.5 text-[#3a63c2]" aria-hidden="true" />
              {t("laptop.thesisDesk.interactive.inspect")}
            </button>
          </div>
          <div className="mt-3 space-y-3" data-testid="findings-chart">
            {(["business", "economics"] as const).map((group) => (
              <div key={group}>
                <div className="flex items-center justify-between gap-2 text-xs text-[#4b5563]">
                  <span>{t(`laptop.thesisDesk.findingsReview.chart${group === "business" ? "Business" : "Economics"}`)}</span>
                  <span className="flex items-center gap-1">
                    <button type="button" className={MINI} aria-label={t("laptop.thesisDesk.interactive.decrease")} data-testid={`findings-chart-minus-${group}`} onClick={() => updateCount(group, -1)}>
                      −
                    </button>
                    <strong className="w-5 text-center tabular-nums text-[#1f2937]" data-testid={`findings-chart-count-${group}`}>
                      {counts[group]}
                    </strong>
                    <button type="button" className={MINI} aria-label={t("laptop.thesisDesk.interactive.increase")} data-testid={`findings-chart-plus-${group}`} onClick={() => updateCount(group, 1)}>
                      +
                    </button>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e5eaf3]">
                  <div className="h-full rounded-full bg-[#6b8edb] transition-[width]" style={{ width: `${Math.min(100, (counts[group] / SOURCE_TOTAL) * 100)}%` }} />
                </div>
              </div>
            ))}
            <div
              className={`flex items-center justify-between border-t pt-2 text-xs font-semibold ${
                matches ? "border-[#b9dec9] text-[#17624a]" : "border-[#e7d8a6] text-[#a16207]"
              }`}
              data-testid="findings-total"
            >
              <span>{t("laptop.thesisDesk.findingsReview.chartTotal")}</span>
              <span className="tabular-nums" data-testid="findings-total-value">
                {total}
              </span>
            </div>
          </div>
        </article>
      </div>
      <section className="mt-4 rounded-lg border border-[#c9d3e6] bg-[#fbfcff] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            {t("laptop.thesisDesk.interactive.participants")}
          </p>
          <span className="text-xs text-[#6b7280]">{t("laptop.thesisDesk.interactive.selectOne")}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: SOURCE_TOTAL }, (_, index) => {
            const selected = selectedParticipant === index;
            return (
              <button
                key={index}
                type="button"
                className={`rounded-md border px-2 py-2 text-center text-[11px] font-semibold transition-colors ${
                  selected ? "border-[#3a63c2] bg-[#e4edfd] text-[#1f3f86]" : "border-[#c9d3e6] bg-white text-[#4b5563] hover:border-[#9db9ef]"
                }`}
                aria-pressed={selected}
                data-testid={`findings-participant-${index}`}
                onClick={() => update({ selectedParticipant: index })}
              >
                {t("laptop.thesisDesk.interactive.participant", { number: String(index + 1).padStart(2, "0") })}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={TOOL}
            disabled={!inspectedExcerpt || !inspectedChart}
            data-testid="findings-compare"
            onClick={() => update({ compared: true })}
          >
            <Search className="h-3.5 w-3.5 text-[#3a63c2]" aria-hidden="true" />
            {t("laptop.thesisDesk.interactive.compareTotals")}
          </button>
          <button
            type="button"
            className={TOOL}
            disabled={!inspectedExcerpt || !inspectedChart}
            data-testid="findings-scan-duplicates"
            aria-pressed={duplicatesScanned}
            onClick={() => update({ duplicatesScanned: true })}
          >
            <ScanSearch className="h-3.5 w-3.5 text-[#3a63c2]" aria-hidden="true" />
            {t("laptop.thesisDesk.interactive.scanDuplicates")}
          </button>
        </div>
        {duplicatesScanned && (
          <p className="mt-2 rounded-md border border-[#c9d3e6] bg-white p-3 text-xs leading-relaxed text-[#4b5563]" data-testid="findings-duplicate-feedback" role="status">
            {t("laptop.thesisDesk.interactive.noDuplicateData")}
          </p>
        )}
        {compared && (
          <p
            className={`mt-3 rounded-md border p-3 text-xs leading-relaxed ${
              matches ? "border-[#b9dec9] bg-[#e8f5ef] text-[#17624a]" : "border-[#e7d8a6] bg-[#fff7df] text-[#6b4c13]"
            }`}
            data-testid="findings-mismatch-feedback"
            data-state={matches ? "matched" : "mismatch"}
            role="status"
          >
            {matches ? t("laptop.thesisDesk.interactive.totalMatches") : t("laptop.thesisDesk.findingsReview.mismatchDetail")}
          </p>
        )}
      </section>
      <div className="mt-5">
        <ChoiceList {...props} ready={ready} readyHint={t("laptop.thesisDesk.interactive.findingsReady")} />
      </div>
    </>
  );
};

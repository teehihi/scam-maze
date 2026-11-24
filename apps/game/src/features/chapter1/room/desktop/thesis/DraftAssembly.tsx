// Final Draft Assembly: the last review before the draft goes to the supervisor. The player opens the
// three page previews and marks each check after reading, so "reviewed" means work was done. This is
// still Mission 01: the outcome is a draft ready for the supervisor's review, never a final submission.
import React, { useState } from "react";
import { Check, CheckCircle2, FileText } from "lucide-react";
import { ChoiceList, type FinalInvestigationState, type ReviewProps } from "./thesisDeskChrome";

/** The checks of the authored final review, in scenario order. */
const FINAL_CHECKS = ["unsourced", "figures", "terms", "claims", "supervisor"] as const;
/** Page previews of the draft; each one points at a different class of problem. */
const FINAL_PAGES = ["intro", "findings", "submission"] as const;
/** Which page each check reviews: a check cannot be marked before its page has been read. */
const CHECK_PAGE: Record<(typeof FINAL_CHECKS)[number], (typeof FINAL_PAGES)[number]> = {
  unsourced: "intro",
  terms: "intro",
  claims: "intro",
  figures: "findings",
  supervisor: "submission",
};

export const DraftAssembly: React.FC<ReviewProps> = (props) => {
  const { t, investigation, onInvestigationChange } = props;
  const [localState, setLocalState] = useState<FinalInvestigationState>({ pages: new Set<string>(), checks: new Set<string>() });
  const state = investigation?.final ?? localState;
  const { pages, checks } = state;
  const update = (next: Partial<typeof state>) => {
    if (onInvestigationChange) onInvestigationChange({ final: { ...state, ...next } });
    else setLocalState((current) => ({ ...current, ...next }));
  };
  const ready = pages.size === FINAL_PAGES.length && checks.size === FINAL_CHECKS.length;
  const inspectPage = (page: string) => update({ pages: new Set(pages).add(page) });
  const toggleCheck = (check: string) => {
    const next = new Set(checks);
    if (next.has(check)) next.delete(check);
    else next.add(check);
    update({ checks: next });
  };
  return (
    <>
      <section className="rounded-lg border border-[#c9d3e6] bg-[#fbfcff] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{t("laptop.thesisDesk.finalReview.pagesHeading")}</p>
          <span className="text-xs tabular-nums text-[#6b7280]" data-testid="final-page-count">
            {pages.size}/{FINAL_PAGES.length} {t("laptop.thesisDesk.interactive.inspected")}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {FINAL_PAGES.map((page) => {
            const inspected = pages.has(page);
            // Each page names a real problem: the source gap, the count that must match, the claim.
            const flagged = page !== "submission";
            return (
              <button
                key={page}
                type="button"
                className={`min-h-24 rounded-md border p-3 text-left transition-colors ${
                  inspected ? "border-[#9db9ef] bg-white" : "border-[#c9d3e6] bg-white hover:border-[#9db9ef]"
                }`}
                data-testid={`final-page-${page}`}
                data-marker={inspected ? (flagged ? (page === "findings" ? "amber" : "red") : "clear") : "unread"}
                data-inspected={inspected ? "true" : undefined}
                aria-pressed={inspected}
                onClick={() => inspectPage(page)}
              >
                <span className="flex items-center justify-between gap-2 text-xs font-semibold text-[#1f2937]">
                  <span>{t(`laptop.thesisDesk.finalReview.pages.${page}.label`)}</span>
                  {inspected ? (
                    <CheckCircle2 className="h-4 w-4 text-[#17624a]" aria-hidden="true" />
                  ) : (
                    <FileText className="h-4 w-4 text-[#6b7280]" aria-hidden="true" />
                  )}
                </span>
                <span className="mt-2 block text-[11px] leading-relaxed text-[#6b7280]">
                  {inspected ? t(`laptop.thesisDesk.finalReview.pages.${page}.detail`) : t("laptop.thesisDesk.interactive.inspectToReveal")}
                </span>
                {inspected && flagged && (
                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      page === "findings"
                        ? "border-[#e7d8a6] bg-[#fff7df] text-[#a16207]"
                        : "border-[#efb0b0] bg-[#fff1f1] text-[#b42318]"
                    }`}
                    data-marker={page === "findings" ? "amber" : "red"}
                  >
                    {t(`laptop.thesisDesk.finalReview.pages.${page}.marker`)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[#6b7280]" data-testid="final-consistency-note">
          {t("laptop.thesisDesk.finalReview.pendingMarker")}
        </p>
      </section>
      <section className="mt-4 rounded-lg border border-[#c9d3e6] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{t("laptop.thesisDesk.finalReview.checklistLabel")}</p>
          <span className="text-xs tabular-nums text-[#6b7280]" data-testid="final-check-count">
            {checks.size}/{FINAL_CHECKS.length} {t("laptop.thesisDesk.interactive.checked")}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {FINAL_CHECKS.map((item) => {
            const checked = checks.has(item);
            const page = CHECK_PAGE[item];
            // Each check belongs to a page: it opens once that page has been read.
            const pageRead = pages.has(page);
            return (
              <button
                key={item}
                type="button"
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed ${
                  checked
                    ? "border-[#b9dec9] bg-[#e8f5ef] text-[#17624a]"
                    : pageRead
                      ? "border-[#e4e9f2] bg-[#fbfcff] text-[#4b5563] hover:border-[#9db9ef]"
                      : "border-[#e4e9f2] bg-[#f5f7fb] text-[#8a94a6]"
                }`}
                data-testid={`final-check-${item}`}
                data-page={page}
                aria-pressed={checked}
                disabled={!pageRead}
                title={pageRead ? t(`laptop.thesisDesk.finalReview.pages.${page}.label`) : t("laptop.thesisDesk.interactive.reviewPageFirst")}
                onClick={() => toggleCheck(item)}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-[#58a984] bg-white" : "border-[#c9d3e6] bg-white"}`}>
                  {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block">{t(`laptop.thesisDesk.finalReview.${item}`)}</span>
                  {!pageRead && <span className="mt-0.5 block text-[10px] text-[#8a94a6]">{t("laptop.thesisDesk.finalReview.pagePending", { page: t(`laptop.thesisDesk.finalReview.pages.${page}.label`) })}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="mt-5">
        <ChoiceList {...props} ready={ready} readyHint={t("laptop.thesisDesk.interactive.finalReady")} />
      </div>
    </>
  );
};

// Evidence journal: discovered evidence in discovery order, the claim list with status text and a
// "Decide" button while the decision panel is offered.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Rendering layer", and Requirements
// 11.7-11.9, 13.1 and 17.6. Props only: the page passes selector output and callbacks.
// Escape is handled by the page through the overlay stack; this panel only offers Close.
// Chrome comes from `chapter1:journal.*`. Stance, claim status and source are rendered by their
// codes, not by the core's English `stanceText` / `statusText`; narrative text (titles, notes,
// claims) comes from the scenario the page passes to the selectors.

import React, { useEffect, useRef } from "react";
import { Scale, NotebookText, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClaimStatusView, JournalEntry } from "../../../game/narrative/selectors";
import type { ClaimStatus, EvidenceItem, Stance } from "../../../game/narrative/types";
import enStory from "../../../i18n/locales/en/chapter1/story";
import { UI } from "../theme";

export interface EvidenceJournalProps {
  /** From `selectJournalEntries(state)`: discovered evidence in discovery order. */
  entries: readonly JournalEntry[];
  /** From `selectClaimStatuses(state)`: every Claim with its status text. */
  claims: readonly ClaimStatusView[];
  /** From `selectDecisionPanel(state).offered`. */
  decisionOffered: boolean;
  onDecide: () => void;
  onClose: () => void;
}

/**
 * English source text of the journal chrome (`chapter1:journal.*`). The panel renders through
 * `t`; this export stays for tests and callers that compare against the English text.
 */
export const EVIDENCE_JOURNAL_TEXT = enStory.journal;

/** English source text for each Evidence_Item source (`chapter1:journal.source.*`). */
export const EVIDENCE_SOURCE_TEXT: Record<EvidenceItem["source"], string> = enStory.journal.source;

/** Text color per Stance. Always shown with the stance text, never alone. */
const STANCE_CLASS: Record<Stance, string> = {
  supports: UI.textMuted,
  contradicts: UI.textWarning,
  inconclusive: UI.textMuted,
  "needs-verification": UI.textWarning,
};

/** Text color per Claim status. Always shown with the status text, never alone. */
const CLAIM_STATUS_CLASS: Record<ClaimStatus, string> = {
  unverified: UI.textMuted,
  supported: UI.textMuted,
  contradicted: UI.textWarning,
  inconclusive: UI.textMuted,
};

export const EvidenceJournal: React.FC<EvidenceJournalProps> = ({
  entries,
  claims,
  decisionOffered,
  onDecide,
  onClose,
}) => {
  const { t } = useTranslation("chapter1");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={UI.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-journal-heading"
        className={`${UI.panel} flex max-h-[90vh] max-w-2xl flex-col gap-4`}
      >
        <h2
          id="evidence-journal-heading"
          ref={headingRef}
          tabIndex={-1}
          className={`${UI.heading} flex items-center gap-2`}
        >
          <NotebookText className="h-5 w-5 text-[#b9a5f5]" aria-hidden="true" />
          {t("journal.title")}
        </h2>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <section aria-labelledby="evidence-journal-evidence-heading" className="space-y-2">
            <h3 id="evidence-journal-evidence-heading" className={UI.label}>
              {t("journal.evidenceHeading")}
            </h3>
            {entries.length === 0 ? (
              <p className={UI.body}>{t("journal.emptyState")}</p>
            ) : (
              <ol className="space-y-3">
                {entries.map((entry) => (
                  <li key={entry.id} className={`${UI.card} space-y-2`}>
                    <h4 className="text-sm font-bold text-[#f7f5ff]">{entry.title}</h4>
                    <p className={UI.body}>{entry.description}</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="font-semibold text-[#b9a5f5]">{t("journal.sourceLabel")}</dt>
                      <dd className="text-[#f7f5ff]">{t(`journal.source.${entry.source}`)}</dd>
                      <dt className="font-semibold text-[#b9a5f5]">{t("journal.locationLabel")}</dt>
                      <dd className="text-[#f7f5ff]">{entry.location}</dd>
                    </dl>
                    {entry.stances.length > 0 && (
                      <ul className="space-y-1.5">
                        {entry.stances.map((stance) => (
                          <li key={stance.claimId} className="text-xs leading-relaxed">
                            <span className="text-[#a9a4c4]">{stance.claimText}</span>{" "}
                            <span className={`font-semibold ${STANCE_CLASS[stance.stance]}`}>
                              {t(`journal.stance.${stance.stance}`)}.
                            </span>{" "}
                            {stance.note && <span className="text-[#a9a4c4]">{stance.note}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {entry.notes.length > 0 && (
                      <div className="space-y-1 border-t border-[#38344f] pt-2">
                        <h5 className={UI.label}>{t("journal.notesHeading")}</h5>
                        <ul className="space-y-1">
                          {entry.notes.map((note) => (
                            <li key={note} className="text-xs leading-relaxed text-[#f7f5ff]">
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="evidence-journal-claims-heading" className="space-y-2">
            <h3 id="evidence-journal-claims-heading" className={UI.label}>
              {t("journal.claimsHeading")}
            </h3>
            <ul className="space-y-2">
              {claims.map((claim) => (
                <li key={claim.id} className={`${UI.card} space-y-1`}>
                  <h4 className="text-sm font-semibold text-[#f7f5ff]">{claim.text}</h4>
                  <p className="text-xs">
                    <span className="font-semibold text-[#b9a5f5]">{t("journal.statusLabel")}: </span>
                    <span className={`font-semibold ${CLAIM_STATUS_CLASS[claim.status]}`}>{t(`journal.claimStatus.${claim.status}`)}</span>
                  </p>
                  {claim.evidence.length === 0 ? (
                    <p className="text-xs text-[#a9a4c4]">{t("journal.noClaimEvidence")}</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {claim.evidence.map((item) => (
                        <li key={item.evidenceId} className="text-xs text-[#a9a4c4]">
                          {item.title}:{" "}
                          <span className={`font-semibold ${STANCE_CLASS[item.stance]}`}>{t(`journal.stance.${item.stance}`)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {decisionOffered && (
            <>
              <p className={`${UI.body} mr-auto`}>{t("journal.decidePrompt")}</p>
              <button type="button" onClick={onDecide} className={UI.buttonPrimary}>
                <Scale className="h-4 w-4" aria-hidden="true" />
                {t("journal.decide")}
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className={UI.buttonSecondary}>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("journal.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

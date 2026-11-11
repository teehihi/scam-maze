// Call history app (Requirements 7.3, 7.4, 7.5, 11.10).
// Lists calls with the caller name as shown, the fictional number as plain text, and the status.
// "Inspect number" records the caller-number evidence when the core would accept it.

import React from "react";
import { ArrowLeft, Check, Search } from "lucide-react";
import type { EvidenceId } from "../../../game/narrative/chapter1/ids";
import type { CallLogEntryView } from "../../../game/narrative/selectors";
import { UI } from "../theme";

export interface CallHistoryAppProps {
  calls: readonly CallLogEntryView[];
  onInspectEvidence: (evidenceId: EvidenceId) => void;
  /** Return to the phone home screen. */
  onBack: () => void;
}

export const CALL_HISTORY_TEXT = {
  heading: "Calls",
  back: "Back",
  empty: "No calls yet.",
  inspectNumber: "Inspect number",
  recorded: "Recorded in your journal",
  incoming: "Incoming",
  outgoing: "Outgoing",
  status: {
    ringing: "Ringing",
    answered: "Answered",
    ended: "Answered",
    declined: "Declined",
    missed: "Missed",
  } satisfies Record<CallLogEntryView["status"], string>,
} as const;

export const CallHistoryApp: React.FC<CallHistoryAppProps> = ({ calls, onInspectEvidence, onBack }) => {
  // Newest first, like a real phone. The selector returns oldest first.
  const entries = [...calls].reverse();

  return (
    <div className="space-y-3">
      <button type="button" className={UI.buttonSecondary} onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {CALL_HISTORY_TEXT.back}
      </button>
      <h3 className={UI.label}>{CALL_HISTORY_TEXT.heading}</h3>
      {entries.length === 0 ? (
        <p className={UI.body}>{CALL_HISTORY_TEXT.empty}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const evidenceId = entry.evidenceId;
            return (
              <li key={entry.callId} className={`${UI.card} space-y-2`}>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-[#f7f5ff]">{entry.displayName}</p>
                  {/* Plain text only: phone numbers are never links. */}
                  <p className="text-sm text-[#f7f5ff]">{entry.number}</p>
                  <p className={`text-xs ${entry.status === "missed" || entry.status === "declined" ? UI.textWarning : UI.textMuted}`}>
                    {entry.direction === "outgoing" ? CALL_HISTORY_TEXT.outgoing : CALL_HISTORY_TEXT.incoming}
                    {" · "}
                    {CALL_HISTORY_TEXT.status[entry.status]}
                  </p>
                </div>
                {evidenceId !== null && entry.evidenceRecorded && (
                  <p className={`flex items-center gap-1.5 text-xs font-semibold ${UI.textPositive}`}>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {CALL_HISTORY_TEXT.recorded}
                  </p>
                )}
                {evidenceId !== null && !entry.evidenceRecorded && entry.evidenceAvailable && (
                  <button
                    type="button"
                    className={UI.buttonSecondary}
                    onClick={() => onInspectEvidence(evidenceId)}
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {CALL_HISTORY_TEXT.inspectNumber}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

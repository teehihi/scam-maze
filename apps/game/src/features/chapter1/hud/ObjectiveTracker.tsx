// Persistent list of active objectives, inside a polite live region (Requirement 6.10).
// New list items are announced when objectives activate. Completions remove items, which live
// regions do not announce, so the page passes the completion text as `announcement`.

import React from "react";
import type { Objective } from "../../../game/narrative/types";
import { UI } from "../theme";

export interface ObjectiveTrackerProps {
  /** Active objectives in objective order, for example from `selectActiveObjectives`. */
  objectives: readonly Objective[];
  /** Screen-reader-only text for the latest change that the list itself does not show. */
  announcement?: string | null;
}

export const OBJECTIVE_TRACKER_TEXT = {
  heading: "Objectives",
  empty: "No active objectives",
} as const;

export const ObjectiveTracker: React.FC<ObjectiveTrackerProps> = ({ objectives, announcement }) => (
  <section aria-labelledby="objective-tracker-heading" className={`${UI.hudPanel} max-w-xs`}>
    <h2 id="objective-tracker-heading" className={UI.label}>
      {OBJECTIVE_TRACKER_TEXT.heading}
    </h2>
    <div aria-live="polite" aria-atomic="false">
      {objectives.length === 0 ? (
        <p className={`mt-1 ${UI.textMuted}`}>{OBJECTIVE_TRACKER_TEXT.empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {objectives.map((objective) => (
            <li key={objective.id} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#b9a5f5]" />
              <span>{objective.text}</span>
            </li>
          ))}
        </ul>
      )}
      {announcement && <p className="sr-only">{announcement}</p>}
    </div>
  </section>
);

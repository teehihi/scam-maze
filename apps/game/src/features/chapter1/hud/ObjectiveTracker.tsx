// Persistent list of active objectives, inside a polite live region (Requirement 6.10).
// New list items are announced when objectives activate. Completions remove items, which live
// regions do not announce, so the page passes the completion text as `announcement`.

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { selectCurrentAct } from "../../../game/narrative/selectors";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, Objective, ScenarioDefinition } from "../../../game/narrative/types";
import { UI } from "../theme";
import { useChapterState } from "../useChapterState";

export interface ObjectiveTrackerProps {
  /** Active objectives in objective order, for example from `selectActiveObjectives`. */
  objectives: readonly Objective[];
  /** Screen-reader-only text for the latest change that the list itself does not show. */
  announcement?: string | null;
  /** Chapter store. With `scenario`, the tracker shows the current act label. */
  store?: ChapterStore;
  /** Display scenario from `useDisplayScenario`, so the act title is localized. */
  scenario?: ScenarioDefinition;
}

const ActLabel: React.FC<{ store: ChapterStore; scenario: ScenarioDefinition }> = ({ store, scenario }) => {
  const { t } = useTranslation("chapter1");
  const act = useChapterState(
    store,
    useCallback((state: ChapterState) => selectCurrentAct(state, scenario), [scenario]),
  );
  const number = scenario.acts.findIndex((a) => a.id === act.id) + 1;
  return <p className={`mt-1 ${UI.textMuted}`}>{t("hud.act.label", { number, title: act.title })}</p>;
};

export const ObjectiveTracker: React.FC<ObjectiveTrackerProps> = ({ objectives, announcement, store, scenario }) => {
  const { t } = useTranslation("chapter1");
  return (
    <section aria-labelledby="objective-tracker-heading" className={`${UI.hudPanel} max-w-xs`}>
      <h2 id="objective-tracker-heading" className={UI.label}>
        {t("objectives.heading")}
      </h2>
      {store && scenario && <ActLabel store={store} scenario={scenario} />}
      <div aria-live="polite" aria-atomic="false">
        {objectives.length === 0 ? (
          <p className={`mt-1 ${UI.textMuted}`}>{t("objectives.empty")}</p>
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
};

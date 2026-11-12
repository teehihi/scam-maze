// Dismissible panel with an object's authored inspection text (Requirement 3.6).
// Escape is handled by the page through the overlay stack; this panel only offers Close.
// Chrome comes from `chapter1:inspection.*`; label, text and evidence titles come from the caller.

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import enStory from "../../../i18n/locales/en/chapter1/story";
import { UI } from "../theme";

export interface InspectionPanelProps {
  /** Interactable label. Starts lowercase in the data; the heading shows it with a capital. */
  label: string;
  inspectionText: string;
  /** Evidence recorded by this interaction (titles from the scenario). */
  evidence?: ReadonlyArray<{ id: string; title: string }>;
  onClose: () => void;
}

/** English source text of the panel chrome (`chapter1:inspection.*`), kept for tests. */
export const INSPECTION_PANEL_TEXT = enStory.inspection;

export const InspectionPanel: React.FC<InspectionPanelProps> = ({ label, inspectionText, evidence = [], onClose }) => {
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
        aria-labelledby="inspection-panel-heading"
        className={`${UI.panel} max-w-md space-y-4`}
      >
        <h2
          id="inspection-panel-heading"
          ref={headingRef}
          tabIndex={-1}
          className={`${UI.heading} first-letter:uppercase`}
        >
          {label}
        </h2>
        <p className={UI.body}>{inspectionText}</p>

        {evidence.length > 0 && (
          <div className="space-y-2">
            <h3 className={UI.label}>{t("inspection.evidenceHeading")}</h3>
            <ul className="space-y-2">
              {evidence.map((item) => (
                <li key={item.id} className={`${UI.card} text-sm text-[#f7f5ff]`}>
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={UI.buttonSecondary}>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("inspection.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

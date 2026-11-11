// Dismissible panel with an object's authored inspection text (Requirement 3.6).
// Escape is handled by the page through the overlay stack; this panel only offers Close.

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { UI } from "../theme";

export interface InspectionPanelProps {
  /** Interactable label. Starts lowercase in the data; the heading shows it with a capital. */
  label: string;
  inspectionText: string;
  /** Evidence recorded by this interaction (titles from the scenario). */
  evidence?: ReadonlyArray<{ id: string; title: string }>;
  onClose: () => void;
}

export const INSPECTION_PANEL_TEXT = {
  evidenceHeading: "Recorded in your journal",
  close: "Close",
} as const;

export const InspectionPanel: React.FC<InspectionPanelProps> = ({ label, inspectionText, evidence = [], onClose }) => {
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
            <h3 className={UI.label}>{INSPECTION_PANEL_TEXT.evidenceHeading}</h3>
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
            {INSPECTION_PANEL_TEXT.close}
          </button>
        </div>
      </div>
    </div>
  );
};

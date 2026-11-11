// Temporary overlay panel for the Chapter_Page (task 8.4).
// The pause menu (task 12.2) replaces it. The phone placeholder was replaced by
// `phone/PhoneOverlay.tsx` in task 9.3, and the journal placeholder by
// `journal/EvidenceJournal.tsx` in task 10.3.
// Escape is handled by the page through the overlay stack; the panel also offers buttons.

import React, { useEffect, useRef } from "react";
import { DoorOpen, Play } from "lucide-react";
import { UI } from "../theme";

interface PlaceholderPanelProps {
  headingId: string;
  heading: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  actions: React.ReactNode;
}

const PlaceholderPanel: React.FC<PlaceholderPanelProps> = ({ headingId, heading, icon, children, actions }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div className={UI.backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby={headingId} className={`${UI.panel} max-w-md space-y-4`}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={`${UI.heading} flex items-center gap-2`}>
          {icon}
          {heading}
        </h2>
        {children}
        <div className="flex flex-wrap justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
};

export const PLACEHOLDER_TEXT = {
  pauseHeading: "Paused",
  resume: "Resume",
  returnToMenu: "Return to menu",
} as const;

export const PausePlaceholder: React.FC<{ onResume: () => void; onReturnToMenu: () => void }> = ({
  onResume,
  onReturnToMenu,
}) => (
  <PlaceholderPanel
    headingId="pause-panel-heading"
    heading={PLACEHOLDER_TEXT.pauseHeading}
    icon={null}
    actions={
      <>
        <button type="button" onClick={onReturnToMenu} className={UI.buttonSecondary}>
          <DoorOpen className="h-4 w-4" aria-hidden="true" />
          {PLACEHOLDER_TEXT.returnToMenu}
        </button>
        <button type="button" onClick={onResume} className={UI.buttonPrimary}>
          <Play className="h-4 w-4" aria-hidden="true" />
          {PLACEHOLDER_TEXT.resume}
        </button>
      </>
    }
  />
);

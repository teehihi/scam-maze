// Pause menu for the Chapter_Page (task 12.2, Requirements 4.7, 15.13).
// Presentational: the page handles Resume, Restart and Save and return to menu.
// Restart asks for confirmation first, because it deletes the chapter progress.
// Escape is handled by the page through the overlay stack (it closes this menu).

import React, { useEffect, useRef, useState } from "react";
import { DoorOpen, Play, RotateCcw, Undo2 } from "lucide-react";
import { UI } from "../theme";

export interface PauseMenuProps {
  chapterNumber: number;
  onResume: () => void;
  /** Called only after the player confirms the restart. */
  onRestart: () => void;
  onSaveAndReturn: () => void;
}

export const PAUSE_MENU_TEXT = {
  heading: "Paused",
  resume: "Resume",
  restart: "Restart chapter",
  saveAndReturn: "Save and return to menu",
  confirmHeading: "Restart chapter",
  confirmRestart: "Restart",
  cancel: "Cancel",
} as const;

/** Confirmation text for Restart. One function so the full sentence can be translated later. */
export function restartConfirmText(chapterNumber: number): string {
  return `Restart Chapter ${chapterNumber}? Your progress in this chapter will be lost.`;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ chapterNumber, onResume, onRestart, onSaveAndReturn }) => {
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the heading when the menu opens and when the view changes.
  useEffect(() => {
    headingRef.current?.focus();
  }, [confirming]);

  return (
    <div className={UI.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-menu-heading"
        aria-describedby={confirming ? "pause-menu-confirm-text" : undefined}
        className={`${UI.panel} max-w-md space-y-4`}
      >
        <h2 id="pause-menu-heading" ref={headingRef} tabIndex={-1} className={UI.heading}>
          {confirming ? PAUSE_MENU_TEXT.confirmHeading : PAUSE_MENU_TEXT.heading}
        </h2>

        {confirming ? (
          <>
            <p id="pause-menu-confirm-text" className={UI.body}>
              {restartConfirmText(chapterNumber)}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setConfirming(false)} className={UI.buttonSecondary}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                {PAUSE_MENU_TEXT.cancel}
              </button>
              <button type="button" onClick={onRestart} className={UI.buttonWarning}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {PAUSE_MENU_TEXT.confirmRestart}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={onResume} className={UI.buttonPrimary}>
              <Play className="h-4 w-4" aria-hidden="true" />
              {PAUSE_MENU_TEXT.resume}
            </button>
            <button type="button" onClick={() => setConfirming(true)} className={UI.buttonSecondary}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {PAUSE_MENU_TEXT.restart}
            </button>
            <button type="button" onClick={onSaveAndReturn} className={UI.buttonSecondary}>
              <DoorOpen className="h-4 w-4" aria-hidden="true" />
              {PAUSE_MENU_TEXT.saveAndReturn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

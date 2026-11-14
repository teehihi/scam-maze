import React from "react";
import { useTranslation } from "react-i18next";
import { DoorOpen, House, Play } from "lucide-react";
import { UI } from "../chapter1/theme";
import { ResumePrompt } from "../chapter1/hud/ResumePrompt";

/** Keyboard keys are literal text in every language. */
export const GO_HOME_KEY = "H";

export interface PrologueHudProps {
  /** Objective line, already translated; null hides the tracker. */
  objective: string | null;
  /** Interaction prompt from the world, already translated. */
  prompt: string | null;
  /** The pointer was released while playing: "click to resume". */
  showResume: boolean;
  /** Shows the go-home button (neighborhood only). */
  onGoHome?: () => void;
}

/** Story HUD in the chapter's style: objective, crosshair, prompt, resume hint, one action. */
export const PrologueHud: React.FC<PrologueHudProps> = ({ objective, prompt, showResume, onGoHome }) => {
  const { t } = useTranslation(["chapter1", "worlds"]);
  return (
    <>
      {objective && (
        <div className="pointer-events-none absolute left-4 top-4 z-10">
          <section aria-labelledby="prologue-objective-heading" className={`${UI.hudPanel} max-w-xs`}>
            <h2 id="prologue-objective-heading" className={UI.label}>
              {t("chapter1:objectives.heading")}
            </h2>
            <p className="mt-1 flex items-start gap-2" aria-live="polite">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#b9a5f5]" />
              <span>{objective}</span>
            </p>
          </section>
        </div>
      )}
      {!showResume && (
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f7f5ff]/80" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-2 px-4">
        <ResumePrompt visible={showResume} />
        {!showResume && prompt && (
          <p className={`${UI.hudPanel} flex items-center gap-2`}>
            <kbd aria-hidden="true" className="rounded border border-[#38344f] px-1.5 font-mono text-xs text-[#a9a4c4]">
              E
            </kbd>
            {prompt}
          </p>
        )}
      </div>
      {onGoHome && (
        <div className="absolute bottom-4 right-4 z-10" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={onGoHome} aria-keyshortcuts={GO_HOME_KEY} className={UI.buttonSecondary}>
            <House className="h-4 w-4" aria-hidden="true" />
            <span>{t("worlds:khupho.game.story.goHome")}</span>
            <kbd aria-hidden="true" className="rounded border border-[#38344f] px-1.5 font-mono text-xs text-[#a9a4c4]">
              {GO_HOME_KEY}
            </kbd>
          </button>
        </div>
      )}
    </>
  );
};

export interface ProloguePauseMenuProps {
  onResume: () => void;
  onReturnToMenu: () => void;
}

/** Pause menu in the chapter's style. The prologue has no save yet, so it offers resume and leave. */
export const ProloguePauseMenu: React.FC<ProloguePauseMenuProps> = ({ onResume, onReturnToMenu }) => {
  const { t } = useTranslation(["chapter1", "worlds"]);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <div className={`${UI.backdrop} z-[65]`} onMouseDown={(event) => event.stopPropagation()}>
      <div role="dialog" aria-modal="true" aria-labelledby="prologue-pause-heading" className={`${UI.panel} max-w-md space-y-4`}>
        <h2 id="prologue-pause-heading" ref={headingRef} tabIndex={-1} className={UI.heading}>
          {t("chapter1:pause.heading")}
        </h2>
        <p className={UI.body}>{t("worlds:khupho.game.story.pauseNote")}</p>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={onResume} className={UI.buttonPrimary}>
            <Play className="h-4 w-4" aria-hidden="true" />
            {t("chapter1:pause.resume")}
          </button>
          <button type="button" onClick={onReturnToMenu} className={UI.buttonSecondary}>
            <DoorOpen className="h-4 w-4" aria-hidden="true" />
            {t("worlds:khupho.game.story.returnToMenu")}
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CloudRain, DoorOpen, House, MousePointerClick, Play, Settings, SlidersHorizontal, Volume2, VolumeX } from "lucide-react";

/** Keyboard keys are literal text in every language. */
export const GO_HOME_KEY = "H";

// The in-game HUD uses the main menu's language: Barlow Condensed uppercase labels, key-cap boxes,
// the slanted purple accent and ivory text with a soft shadow, straight on the 3D view (no panels).
const SHADOW = "[text-shadow:0_1px_8px_rgba(0,0,0,0.85)]";
const KEYCAP = "flex min-w-[1.6rem] items-center justify-center border border-white/25 bg-black/45 px-1.5 py-[0.2rem] font-menu text-xs font-semibold text-zinc-100";
const MENU_BUTTON = `group flex items-center gap-2 font-menu text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200 ${SHADOW} outline-none transition-colors hover:text-[#f3efe4] focus-visible:text-[#f3efe4] cursor-pointer`;
const KEYCAP_HOVER = "transition-colors group-hover:border-white/60 group-focus-visible:border-[#f3efe4]";

/** Stops a HUD click from also reaching the 3D view (which would interact or take the pointer). */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

export interface PrologueTopBarProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
}

/** Top-right controls, the same on every in-game screen: sound and the settings/pause menu. */
export const PrologueTopBar: React.FC<PrologueTopBarProps> = ({ soundEnabled, onToggleSound, onOpenSettings }) => {
  const { t } = useTranslation(["common", "worlds"]);
  return (
    <header className="absolute right-[clamp(1rem,3vw,2.5rem)] top-4 z-20 flex items-center gap-5" onMouseDown={stop} onClick={stop}>
      <button
        type="button"
        onClick={onToggleSound}
        className={MENU_BUTTON}
        title={soundEnabled ? t("common:audio.muteTitle") : t("common:audio.unmuteTitle")}
        aria-pressed={!soundEnabled}
      >
        <span aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER}`}>
          {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5 text-zinc-500" />}
        </span>
        <span className="grid text-left">
          <span className={`col-start-1 row-start-1 ${soundEnabled ? "" : "invisible"}`} aria-hidden={!soundEnabled}>
            {t("common:audio.on")}
          </span>
          <span className={`col-start-1 row-start-1 ${soundEnabled ? "invisible" : ""}`} aria-hidden={soundEnabled}>
            {t("common:audio.muted")}
          </span>
        </span>
      </button>
      <button type="button" onClick={onOpenSettings} className={MENU_BUTTON} aria-keyshortcuts="Escape">
        <span aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER}`}>
          <Settings className="h-3.5 w-3.5" />
        </span>
        <span>{t("worlds:khupho.game.story.settings")}</span>
      </button>
    </header>
  );
};

/** Slanted purple accent used before every HUD label (as on the loading screen and the menu). */
const Accent: React.FC = () => <span aria-hidden="true" className="inline-block h-3.5 w-1.5 -skew-x-[18deg] bg-[#7654d6]" />;

export interface PrologueHudProps {
  /** Objective line, already translated; null hides it. */
  objective: string | null;
  /** Interaction prompt from the world, already translated. */
  prompt: string | null;
  /** The pointer was released while playing (and the cursor was not shown with Ctrl): "click to resume". */
  showResume: boolean;
  /** Ctrl is showing the cursor. */
  cursorMode: boolean;
  /** In-world clock and weather (neighborhood only). */
  clock?: { time: string; detail: string; raining: boolean } | null;
  /** Shows the go-home action (neighborhood only). */
  onGoHome?: () => void;
  /** Draw the center dot (the room draws its own). */
  crosshair?: boolean;
}

/** Story HUD in the game's style: clock, objective, crosshair, prompt, resume hint, key hints. */
export const PrologueHud: React.FC<PrologueHudProps> = ({ objective, prompt, showResume, cursorMode, clock, onGoHome, crosshair = true }) => {
  const { t } = useTranslation(["chapter1", "worlds"]);
  return (
    <>
      <div className={`pointer-events-none absolute left-[clamp(1rem,3vw,2.5rem)] top-4 z-10 max-w-sm space-y-4 ${SHADOW}`}>
        {clock && (
          <div aria-label={t("worlds:khupho.game.story.clock")}>
            <p className="font-menu text-4xl font-bold leading-none tracking-[0.04em] text-[#f3efe4] tabular-nums">{clock.time}</p>
            <p className="mt-1 flex items-center gap-1.5 font-menu text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {clock.raining && <CloudRain className="h-3.5 w-3.5 text-[#b9a5f5]" aria-hidden="true" />}
              {clock.detail}
            </p>
          </div>
        )}
        {objective && (
          <section aria-labelledby="prologue-objective-heading">
            <h2 id="prologue-objective-heading" className="flex items-center gap-2.5 font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#c9bbf7]">
              <Accent />
              {t("worlds:khupho.game.story.objective")}
            </h2>
            <p className="mt-1.5 font-menu text-xl font-semibold uppercase leading-tight tracking-[0.03em] text-[#f3efe4]" aria-live="polite">
              {objective}
            </p>
          </section>
        )}
      </div>

      {crosshair && !showResume && !cursorMode && (
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f3efe4]/85 shadow-[0_0_4px_rgba(0,0,0,0.8)]" />
      )}

      <div className={`pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-2 px-4 ${SHADOW}`}>
        {showResume && (
          <p data-testid="resume-prompt" className="flex items-center gap-2 font-menu text-base font-semibold uppercase tracking-[0.14em] text-[#f3efe4]">
            <MousePointerClick className="h-4 w-4 text-[#b9a5f5]" aria-hidden="true" />
            {t("chapter1:resume.prompt")}
          </p>
        )}
        {!showResume && prompt && (
          <p className="flex items-center gap-2.5 font-menu text-base font-semibold uppercase tracking-[0.1em] text-[#f3efe4]">
            <kbd aria-hidden="true" className={KEYCAP}>
              E
            </kbd>
            {prompt}
          </p>
        )}
      </div>

      <div className="absolute bottom-4 left-[clamp(1rem,3vw,2.5rem)] right-[clamp(1rem,3vw,2.5rem)] z-10 flex items-end justify-between gap-4">
        <div className={`pointer-events-none flex flex-wrap items-center gap-x-5 gap-y-2 font-menu text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300 ${SHADOW}`}>
          <span className="flex items-center gap-1.5">
            <kbd className={KEYCAP}>Ctrl</kbd>
            {cursorMode ? t("worlds:khupho.game.story.hideCursor") : t("worlds:khupho.game.story.showCursor")}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className={KEYCAP}>Esc</kbd>
            {t("worlds:khupho.game.story.pause")}
          </span>
        </div>
        {onGoHome && (
          <button type="button" onMouseDown={stop} onClick={onGoHome} aria-keyshortcuts={GO_HOME_KEY} className={MENU_BUTTON}>
            <span aria-hidden="true" className={`${KEYCAP} ${KEYCAP_HOVER}`}>
              {GO_HOME_KEY}
            </span>
            <House className="h-4 w-4 text-[#b9a5f5]" aria-hidden="true" />
            <span className="text-base">{t("worlds:khupho.game.story.goHome")}</span>
          </button>
        )}
      </div>
    </>
  );
};

export interface ProloguePauseMenuProps {
  onResume: () => void;
  onOpenSettings: () => void;
  onReturnToMenu: () => void;
}

/** Pause menu in the main menu's style. The prologue has no save yet, so leaving restarts the evening. */
export const ProloguePauseMenu: React.FC<ProloguePauseMenuProps> = ({ onResume, onOpenSettings, onReturnToMenu }) => {
  const { t } = useTranslation(["chapter1", "worlds"]);
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  const entries = [
    { id: "resume", icon: Play, label: t("chapter1:pause.resume"), onClick: onResume },
    { id: "settings", icon: SlidersHorizontal, label: t("worlds:khupho.game.story.settings"), onClick: onOpenSettings },
    { id: "menu", icon: DoorOpen, label: t("worlds:khupho.game.story.returnToMenu"), onClick: onReturnToMenu },
  ];
  return (
    <div className="absolute inset-0 z-[65] select-none" onMouseDown={stop} onClick={stop}>
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,14,0.94)_0%,rgba(8,7,14,0.8)_30%,rgba(8,7,14,0.35)_60%,rgba(8,7,14,0.15)_100%)]" />
      <div aria-hidden="true" className="menu-grain pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay" />
      <div role="dialog" aria-modal="true" aria-labelledby="prologue-pause-heading" className="absolute inset-y-0 left-0 flex w-full max-w-[560px] flex-col justify-center pl-[clamp(1.5rem,6vw,6rem)] pr-6">
        <p className="flex items-center gap-3 font-menu text-sm font-semibold uppercase tracking-[0.3em] text-[#c9bbf7]">
          <Accent />
          SCAMMAZE
        </p>
        <h2 id="prologue-pause-heading" className="mt-2 font-menu text-6xl font-bold uppercase leading-none tracking-[0.01em] text-[#f3efe4] [text-shadow:0_4px_24px_rgba(0,0,0,0.7)]">
          {t("chapter1:pause.heading")}
        </h2>
        <ul className="mt-8 w-[min(24rem,100%)] space-y-1">
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            return (
              <li key={entry.id}>
                <button
                  ref={index === 0 ? firstRef : undefined}
                  type="button"
                  onClick={entry.onClick}
                  className="group relative flex w-full items-center gap-3 px-4 py-2.5 text-left font-menu text-2xl font-semibold uppercase leading-none tracking-[0.04em] text-zinc-200 outline-none transition-colors hover:text-[#171521] focus-visible:text-[#171521] cursor-pointer"
                >
                  <span aria-hidden="true" className="absolute inset-0 origin-left scale-x-0 bg-[#f3efe4] transition-transform duration-200 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100" />
                  <span aria-hidden="true" className="absolute -left-1 bottom-0 top-0 w-2 -skew-x-12 bg-[#7654d6] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  <Icon className="relative h-[0.75em] w-[0.75em] shrink-0" aria-hidden="true" />
                  <span className="relative">{entry.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 max-w-sm text-sm leading-relaxed text-zinc-400">{t("worlds:khupho.game.story.pauseNote")}</p>
      </div>
    </div>
  );
};

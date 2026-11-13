import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Volume2, VolumeX } from "lucide-react";
import type { GameSettings } from "@scammaze/shared-types";
import { SettingsModal } from "./SettingsModal";
import { CreditsModal } from "./CreditsModal";
import { BRAND_LOGO_PNG as LOGO_PNG, BRAND_LOGO_WEBP as LOGO_WEBP } from "../../config/assetPaths";

export type ContinueAvailability =
  | { available: true }
  | {
      available: false;
      /** Selects the translated reason `menu:continueReasons.<reasonCode>`. */
      reasonCode: "none" | "invalid";
      /** English source text of the reason. */
      reason: string;
    };

interface MainMenuOverlayProps {
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onToggleSound?: () => void;
  onHoverSound?: () => void;
  /** Starts loading the first chapter. */
  onStartNewGame: () => void;
  onContinue: () => void;
  continueAvailability: ContinueAvailability;
}


interface MenuEntry {
  id: "newGame" | "continue" | "settings" | "credits";
  group: "primary" | "secondary";
  label: string;
  description: string;
  disabled: boolean;
  onSelect?: () => void;
}

/**
 * Title-screen menu over the live street scene (Insurgency / Portal 2 style): wordmark, chapter
 * kicker, a text menu with a highlighted current item, keyboard navigation and a sound toggle.
 */
export const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
  settings,
  onUpdateSettings,
  onToggleSound,
  onHoverSound,
  onStartNewGame,
  onContinue,
  continueAvailability,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const { t } = useTranslation(["menu", "common"]);

  const entries: MenuEntry[] = [
    {
      id: "newGame",
      group: "primary",
      label: t("menu:buttons.newGame.label"),
      description: t("menu:buttons.newGame.sublabel"),
      disabled: false,
      onSelect: onStartNewGame,
    },
    {
      id: "continue",
      group: "primary",
      label: t("menu:buttons.continue.label"),
      description: continueAvailability.available
        ? t("menu:buttons.continue.sublabel")
        : t(`menu:continueReasons.${continueAvailability.reasonCode}`),
      disabled: !continueAvailability.available,
      onSelect: continueAvailability.available ? onContinue : undefined,
    },
    {
      id: "settings",
      group: "secondary",
      label: t("menu:buttons.settings.label"),
      description: t("menu:buttons.settings.sublabel"),
      disabled: false,
      onSelect: () => setSettingsOpen(true),
    },
    {
      id: "credits",
      group: "secondary",
      label: t("menu:buttons.credits.label"),
      description: t("menu:buttons.credits.sublabel"),
      disabled: false,
      onSelect: () => setCreditsOpen(true),
    },
  ];

  // The highlighted item follows the mouse and the keyboard; it starts on NEW GAME.
  const [activeId, setActiveId] = useState<MenuEntry["id"]>("newGame");
  // Mirror of `activeId` for event handlers. Side effects (sound, focus) run in the handlers, never
  // inside a state updater: React may call updaters twice (StrictMode), and focus() inside one
  // fired onFocus mid-update, so one ArrowDown moved two items in development.
  const activeRef = useRef<MenuEntry["id"]>("newGame");
  const buttonRefs = useRef(new Map<MenuEntry["id"], HTMLButtonElement>());
  const modalOpen = settingsOpen || creditsOpen;

  const activate = useCallback(
    (id: MenuEntry["id"], withSound = true) => {
      if (activeRef.current === id) return;
      activeRef.current = id;
      if (withSound) onHoverSound?.();
      setActiveId(id);
    },
    [onHoverSound],
  );

  // Arrow keys / W S move through the enabled items; Enter and Space use the native button.
  const enabledIds = entries.filter((e) => !e.disabled).map((e) => e.id);
  const enabledKey = enabledIds.join(",");
  useEffect(() => {
    if (modalOpen) return;
    const ids = enabledKey.split(",") as MenuEntry["id"][];
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const down = e.key === "ArrowDown" || e.code === "KeyS";
      const up = e.key === "ArrowUp" || e.code === "KeyW";
      if (!down && !up) return;
      e.preventDefault();
      const prev = activeRef.current;
      const i = Math.max(0, ids.indexOf(prev));
      const next = ids[(i + (down ? 1 : ids.length - 1)) % ids.length];
      if (next === prev) return;
      activeRef.current = next;
      onHoverSound?.();
      setActiveId(next);
      // Focus last: its onFocus sees activeRef already on `next` and does nothing.
      buttonRefs.current.get(next)?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabledKey, modalOpen, onHoverSound]);

  const renderEntry = (entry: MenuEntry, index: number) => {
    const active = entry.id === activeId;
    const primary = entry.group === "primary";
    const descId = `menu-desc-${entry.id}`;
    return (
      <li
        key={entry.id}
        className="menu-rise"
        style={{ animationDelay: `${0.35 + index * 0.07}s` }}
        onPointerEnter={() => {
          activate(entry.id);
          // Focus follows the highlight, so Enter always opens the highlighted item.
          if (!entry.disabled && !modalOpen) buttonRefs.current.get(entry.id)?.focus({ preventScroll: true });
        }}
      >
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set(entry.id, el);
            else buttonRefs.current.delete(entry.id);
          }}
          type="button"
          disabled={entry.disabled}
          aria-describedby={descId}
          aria-current={active ? "true" : undefined}
          onClick={entry.onSelect}
          onFocus={() => activate(entry.id, false)}
          className={`group relative flex w-full items-center gap-3 text-left font-menu uppercase leading-none outline-none transition-colors duration-150 ${
            primary ? "py-2.5 pl-5 pr-4 text-[clamp(1.6rem,2.5vw,2.4rem)] font-bold" : "py-1.5 pl-5 pr-4 text-[clamp(1.15rem,1.6vw,1.55rem)] font-semibold"
          } ${
            entry.disabled
              ? "cursor-not-allowed text-white/35"
              : active
                ? "cursor-pointer text-[#171521]"
                : "cursor-pointer text-white/90 hover:text-white"
          }`}
        >
          {/* Highlight bar: ivory slab with a slanted purple brush accent, like the logo banner */}
          <span
            aria-hidden="true"
            className={`absolute inset-0 origin-left bg-[#f3efe4] shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-transform duration-200 ease-out ${
              active && !entry.disabled ? "scale-x-100" : "scale-x-0"
            }`}
          />
          <span
            aria-hidden="true"
            className={`absolute -left-1 top-0 bottom-0 w-2 -skew-x-12 bg-[#7654d6] transition-opacity duration-200 ${
              active ? "opacity-100" : "opacity-0"
            }`}
          />
          {entry.disabled && <Lock className="relative h-[0.6em] w-[0.6em] shrink-0" aria-hidden="true" />}
          <span className="relative tracking-[0.04em]">{entry.label}</span>
        </button>
        {/* Not shown on screen; screen readers read it through aria-describedby. */}
        <p id={descId} className="sr-only">
          {entry.description}
        </p>
      </li>
    );
  };

  const primaryEntries = entries.filter((e) => e.group === "primary");
  const secondaryEntries = entries.filter((e) => e.group === "secondary");

  return (
    <div className="absolute inset-0 z-20 select-none">
      {/* Readability: dark falloff from the left edge and the bottom, plus fine film grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,14,0.92)_0%,rgba(8,7,14,0.78)_26%,rgba(8,7,14,0.32)_50%,rgba(8,7,14,0)_68%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,rgba(8,7,14,0.7),rgba(8,7,14,0))]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-48 w-[28rem] max-w-full bg-[radial-gradient(ellipse_at_top_right,rgba(8,7,14,0.6),rgba(8,7,14,0)_70%)]"
      />
      <div aria-hidden="true" className="menu-grain pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay" />

      {/* Top right: sound */}
      <header className="absolute right-[clamp(1.5rem,6vw,6rem)] top-5 sm:top-7">
        <button
          type="button"
          onClick={onToggleSound || (() => onUpdateSettings({ soundEnabled: !settings.soundEnabled }))}
          className="group flex items-center gap-1.5 font-menu text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] outline-none transition-colors hover:text-zinc-100 focus-visible:text-zinc-100 cursor-pointer"
          title={settings.soundEnabled ? t("common:audio.muteTitle") : t("common:audio.unmuteTitle")}
        >
          {/* Same key-cap box as the hints in the footer */}
          <span
            aria-hidden="true"
            className="flex items-center border border-white/20 bg-black/40 px-1.5 py-[0.3rem] text-zinc-200 transition-colors group-hover:border-white/50 group-focus-visible:border-[#f3efe4]"
          >
            {settings.soundEnabled ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </span>
          {/* Both labels share one grid cell, so the width fits the longer one in any language and
              the icon does not move when the label changes; the hidden label is aria-hidden. */}
          <span className="grid text-left">
            <span className={`col-start-1 row-start-1 ${settings.soundEnabled ? "" : "invisible"}`} aria-hidden={!settings.soundEnabled}>
              {t("common:audio.on")}
            </span>
            <span className={`col-start-1 row-start-1 ${settings.soundEnabled ? "invisible" : ""}`} aria-hidden={settings.soundEnabled}>
              {t("common:audio.muted")}
            </span>
          </span>
        </button>
      </header>

      {/* Left column: wordmark, chapter kicker, menu */}
      <div className="absolute inset-y-0 left-0 flex w-full max-w-[640px] flex-col justify-center pl-[clamp(1.5rem,6vw,6rem)] pr-6">
        <h1 className="sr-only">{t("common:appName")}</h1>
        <picture className="menu-rise block" style={{ animationDelay: "0.05s" }}>
          <source srcSet={LOGO_WEBP} type="image/webp" />
          <img
            src={LOGO_PNG}
            alt=""
            width={1400}
            height={439}
            draggable={false}
            className="h-auto w-[clamp(18rem,34vw,34rem)] max-w-full -translate-x-[3%] drop-shadow-[0_10px_30px_rgba(0,0,0,0.65)]"
          />
        </picture>

        <p
          className="menu-rise mt-3 flex items-center gap-2.5 font-menu text-[15px] font-semibold uppercase tracking-[0.22em] text-zinc-300"
          style={{ animationDelay: "0.2s" }}
        >
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="menu-ping absolute inline-flex h-full w-full rounded-full bg-red-500/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          {t("menu:kicker")}
        </p>

        <nav aria-label={t("menu:nav.label")} className="mt-[clamp(1.5rem,5vh,3rem)] w-[min(26rem,100%)]">
          <ul className="space-y-1">{primaryEntries.map((e, i) => renderEntry(e, i))}</ul>
          <div
            aria-hidden="true"
            className="menu-rise my-4 h-px w-4/5 bg-[linear-gradient(90deg,#7654d6,rgba(185,165,245,0.35)_45%,rgba(185,165,245,0))]"
            style={{ animationDelay: "0.5s" }}
          />
          <ul className="space-y-0.5">{secondaryEntries.map((e, i) => renderEntry(e, primaryEntries.length + i))}</ul>
        </nav>
      </div>

      {/* Bottom: keyboard hints */}
      <footer
        className="menu-rise absolute bottom-5 left-[clamp(1.5rem,6vw,6rem)] flex items-center gap-4 font-menu text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400 sm:bottom-7"
        style={{ animationDelay: "0.8s" }}
      >
        <span className="flex items-center gap-1.5">
          <kbd className="border border-white/20 bg-black/40 px-1.5 py-0.5 text-zinc-200">↑</kbd>
          <kbd className="border border-white/20 bg-black/40 px-1.5 py-0.5 text-zinc-200">↓</kbd>
          {t("menu:hints.navigate")}
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="border border-white/20 bg-black/40 px-1.5 py-0.5 text-zinc-200">Enter</kbd>
          {t("menu:hints.select")}
        </span>
      </footer>

      {/* Modals */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
      <CreditsModal isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </div>
  );
};

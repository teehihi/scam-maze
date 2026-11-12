import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuButton } from "../../components/ui/MenuButton";
import { useDisplayScenario } from "../../i18n/narrative";
import { DEFAULT_CHAPTER_ID, getChapter } from "../../game/chapters/chapterRegistry";
import { SettingsModal } from "./SettingsModal";
import { CreditsModal } from "./CreditsModal";
import { IntroPrologueModal } from "./IntroPrologueModal";
import type { GameSettings } from "@scammaze/shared-types";
import {
  Play,
  RotateCcw,
  Sliders,
  Award,
  Volume2,
  VolumeX,
} from "lucide-react";

export type ContinueAvailability =
  | { available: true }
  | {
      available: false;
      /** Selects the translated reason `menu:continueReasons.<reasonCode>`. */
      reasonCode: "none" | "invalid";
      /** English source text of the reason. */
      reason: string;
    };

const FIRST_CHAPTER_NUMBER = getChapter(DEFAULT_CHAPTER_ID)?.number ?? 1;

interface MainMenuOverlayProps {
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onToggleSound?: () => void;
  onHoverSound?: () => void;
  onOpenHCM?: () => void;
  /** Starts loading the first chapter (after the prologue is confirmed). */
  onStartNewGame: () => void;
  onContinue: () => void;
  continueAvailability: ContinueAvailability;
}

export const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
  settings,
  onUpdateSettings,
  onToggleSound,
  onHoverSound,
  onStartNewGame,
  onContinue,
  continueAvailability,
}) => {
  const [introOpen, setIntroOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const { t } = useTranslation(["menu", "common"]);
  // Chapter title in the UI language, from the narrative overlay ("Cuộc gọi khẩn cấp" in vi).
  const chapterTitle = useDisplayScenario().title;

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-end w-full">
        <button
          type="button"
          onClick={onToggleSound || (() => onUpdateSettings({ soundEnabled: !settings.soundEnabled }))}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1b172b]/85 hover:bg-[#252237] border border-[#3b3452] text-xs font-medium text-zinc-300 transition-all shadow-lg hover:border-[#7654d6] cursor-pointer"
          title={settings.soundEnabled ? t("common:audio.muteTitle") : t("common:audio.unmuteTitle")}
        >
          {settings.soundEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="font-mono text-[11px] text-zinc-300">{t("common:audio.on")}</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
              <span className="font-mono text-[11px] text-zinc-400">{t("common:audio.muted")}</span>
            </>
          )}
        </button>
      </header>

      {/* Main Content / Menu Column */}
      <main className="my-auto w-full max-w-[480px] sm:max-w-[500px] py-4 flex flex-col justify-center">
        <div
          className="relative px-10 sm:px-12 pt-7 sm:pt-8 pb-14 sm:pb-16 space-y-2 filter drop-shadow-[0_16px_40px_rgba(0,0,0,0.9)]"
          style={{
            backgroundImage: "url('/assets/ui/menu_panel_frame.webp')",
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Custom Hand-Crafted Title Logo (Centered inside panel) */}
          <div className="pt-0.5 pb-0.5 flex justify-center items-center w-full">
            <h1 className="sr-only">{t("common:appName")}</h1>
            <picture>
              <source srcSet="/assets/branding/game-title-logo.webp" type="image/webp" />
              <img
                src="/assets/branding/game-title-logo.png"
                alt={t("common:appName")}
                className="w-full max-w-[300px] sm:max-w-[340px] h-auto object-contain filter drop-shadow-[0_4px_20px_rgba(234,179,8,0.22)] select-none pointer-events-none mx-auto"
                width={340}
                height={130}
              />
            </picture>
          </div>

          {/* Action Button Stack (Balanced width matching logo & neatly contained inside panel) */}
          <nav aria-label={t("menu:nav.label")} className="space-y-2.5 pointer-events-auto w-full max-w-[325px] sm:max-w-[335px] mx-auto flex flex-col items-center">
            <MenuButton
              label={t("menu:buttons.newGame.label")}
              sublabel={t("menu:buttons.newGame.sublabel", { number: FIRST_CHAPTER_NUMBER, title: chapterTitle })}
              icon={Play}
              variant="primary"
              onClick={() => setIntroOpen(true)}
              onHover={onHoverSound}
            />

            <MenuButton
              label={t("menu:buttons.continue.label")}
              sublabel={t("menu:buttons.continue.sublabel")}
              icon={RotateCcw}
              disabled={!continueAvailability.available}
              disabledReason={
                continueAvailability.available
                  ? undefined
                  : t(`menu:continueReasons.${continueAvailability.reasonCode}`)
              }
              onClick={continueAvailability.available ? onContinue : undefined}
              onHover={onHoverSound}
            />

            <MenuButton
              label={t("menu:buttons.settings.label")}
              sublabel={t("menu:buttons.settings.sublabel")}
              icon={Sliders}
              variant="secondary"
              onClick={() => setSettingsOpen(true)}
              onHover={onHoverSound}
            />

            <MenuButton
              label={t("menu:buttons.credits.label")}
              sublabel={t("menu:buttons.credits.sublabel")}
              icon={Award}
              variant="secondary"
              onClick={() => setCreditsOpen(true)}
              onHover={onHoverSound}
            />
          </nav>
        </div>
      </main>

      {/* Modals */}
      <IntroPrologueModal
        isOpen={introOpen}
        onClose={() => setIntroOpen(false)}
        onBegin={() => {
          setIntroOpen(false);
          onStartNewGame();
        }}
      />
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

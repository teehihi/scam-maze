import React, { useState } from "react";
import { BrandLogo } from "../../components/ui/BrandLogo";
import { MenuButton } from "../../components/ui/MenuButton";
import { SettingsModal } from "./SettingsModal";
import { CreditsModal } from "./CreditsModal";
import { IntroPrologueModal } from "./IntroPrologueModal";
import type { GameSettings } from "@scammaze/shared-types";
import {
  Play,
  RotateCcw,
  Sliders,
  Award,
  MapPin,
} from "lucide-react";

interface MainMenuOverlayProps {
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
  onOpenHCM?: () => void;
}

export const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
  settings,
  onUpdateSettings,
  onOpenHCM,
}) => {
  const [introOpen, setIntroOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between w-full">
        <BrandLogo size="md" />
      </header>

      {/* Main Content / Menu Column */}
      <main className="my-auto w-full max-w-md py-4 flex flex-col justify-center">
        <div className="p-6 sm:p-7 rounded-2xl bg-[#12101e]/85 border border-[#3b3452]/80 backdrop-blur-xl shadow-2xl space-y-6">
          {/* Atmospheric Header & Story Tagline */}
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#b9a5f5] uppercase bg-[#1a1729] border border-[#3b3452] px-2.5 py-0.5 rounded-md w-fit">
              <span>District 4</span>
              <span className="text-zinc-500">·</span>
              <span>Everyday Life Simulation</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-['Bricolage_Grotesque_Variable',sans-serif]">
              SCAMMAZE
            </h1>

            <p className="text-sm sm:text-base font-medium text-[#e9e2ff] italic tracking-wide">
              "Every scam starts on an ordinary day."
            </p>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Step into an ordinary neighborhood. Explore your surroundings, question digital messages, and uncover deceptive traps through your own decisions.
            </p>
          </div>

          {/* Action Button Stack */}
          <nav aria-label="Game Main Menu" className="space-y-2.5 pointer-events-auto">
            <MenuButton
              label="NEW GAME"
              sublabel="Begin Chapter 1: The Urgent Call"
              icon={Play}
              variant="primary"
              onClick={() => setIntroOpen(true)}
            />

            <MenuButton
              label="CONTINUE"
              sublabel="Resume saved progress"
              icon={RotateCcw}
              disabled={true}
              disabledReason="No save game found. Save functionality activates after completing Chapter 1."
            />

            <MenuButton
              label="SETTINGS"
              sublabel="Graphics quality, camera FOV & audio"
              icon={Sliders}
              variant="secondary"
              onClick={() => setSettingsOpen(true)}
            />

            <MenuButton
              label="CREDITS & LICENSES"
              sublabel="3D city & vehicle pack attribution"
              icon={Award}
              variant="secondary"
              onClick={() => setCreditsOpen(true)}
            />

            {onOpenHCM && (
              <MenuButton
                label="BẢN ĐỒ TP. HỒ CHÍ MINH 3D"
                sublabel="Mô hình 3D trung tâm Sài Gòn có màu sắc"
                icon={MapPin}
                variant="secondary"
                onClick={onOpenHCM}
              />
            )}
          </nav>
        </div>
      </main>

      {/* Modals */}
      <IntroPrologueModal isOpen={introOpen} onClose={() => setIntroOpen(false)} />
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

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
  Volume2,
  VolumeX,
  ExternalLink,
  Compass,
} from "lucide-react";

interface MainMenuOverlayProps {
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
}

export const MainMenuOverlay: React.FC<MainMenuOverlayProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [introOpen, setIntroOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const landingUrl = import.meta.env.VITE_LANDING_URL ?? "http://localhost:5173";

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <BrandLogo size="md" />
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest uppercase bg-[#1d1b2b]/90 border border-[#38344f] px-2.5 py-1 rounded-full text-[#b9a5f5] backdrop-blur-md">
              FIRST-PERSON NARRATIVE GAME
            </span>
            <span className="text-[10px] font-mono tracking-wider uppercase bg-emerald-950/70 border border-emerald-800/40 px-2 py-0.5 rounded-full text-emerald-400 backdrop-blur-md">
              3D PREVIEW
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Quick Sound Mute Toggle */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            aria-label={settings.soundEnabled ? "Mute audio" : "Unmute audio"}
            className="p-2.5 rounded-xl bg-[#171521]/80 hover:bg-[#221e33] border border-[#38344f] text-zinc-300 hover:text-white backdrop-blur-md transition-colors cursor-pointer shadow-lg"
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-zinc-500" />
            )}
          </button>

          {/* Return to Landing Page */}
          <a
            href={landingUrl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#171521]/80 hover:bg-[#221e33] border border-[#38344f] text-xs font-medium text-zinc-300 hover:text-white backdrop-blur-md transition-colors cursor-pointer shadow-lg"
          >
            <Compass className="w-3.5 h-3.5 text-[#b9a5f5]" />
            <span className="hidden md:inline">Portal & Knowledge Hub</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </header>

      {/* Main Content / Menu Column */}
      <main className="my-auto w-full max-w-xl py-6 flex flex-col justify-center">
        {/* Atmospheric Header & Story Tagline */}
        <div className="space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-[#b9a5f5] uppercase bg-[#181625]/90 border border-[#3b3452] px-3 py-1 rounded-lg backdrop-blur-md w-fit">
            <span>District 4</span>
            <span className="text-zinc-600">·</span>
            <span>Everyday Life Simulation</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.8)] font-['Bricolage_Grotesque_Variable',sans-serif]">
            SCAMMAZE
          </h1>

          <p className="text-lg sm:text-xl font-medium text-[#e9e2ff] italic tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            "Every scam starts on an ordinary day."
          </p>

          <p className="text-xs sm:text-sm text-zinc-300/90 leading-relaxed max-w-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            Step into a quiet low-poly neighborhood. Explore your surroundings, investigate digital
            messages and suspicious calls, and learn how to uncover deceptive traps through your own
            decisions.
          </p>
        </div>

        {/* Action Button Stack */}
        <nav aria-label="Game Main Menu" className="space-y-3 pointer-events-auto">
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
        </nav>
      </main>

      {/* Bottom Bar: Environmental Info & Controls Reminder */}
      <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Cinematic Camera: Mouse Parallax & Breathing Motion active</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <span>Three.js r174 · R3F · WebGL 2.0</span>
          <span>© 2026 SCAMMAZE</span>
        </div>
      </footer>

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

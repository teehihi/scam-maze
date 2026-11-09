import React from "react";
import { ModalDialog } from "../../components/ui/ModalDialog";
import type { GameSettings, GraphicsQuality } from "@scammaze/shared-types";
import { Volume2, VolumeX, Eye, Sparkles } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Display & Audio Settings"
      subtitle="Configure 3D rendering performance and sound settings"
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Graphics Quality */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#b9a5f5]" /> Graphics Quality
            </span>
            <span className="text-xs font-mono uppercase text-[#b9a5f5] bg-[#7654d6]/20 px-2 py-0.5 rounded border border-[#7654d6]/40">
              {settings.graphicsQuality}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as GraphicsQuality[]).map((quality) => (
              <button
                key={quality}
                type="button"
                onClick={() => onUpdateSettings({ graphicsQuality: quality })}
                className={`py-2 px-3 rounded-lg text-xs font-medium capitalize border transition-all cursor-pointer ${
                  settings.graphicsQuality === quality
                    ? "bg-[#7654d6] text-white border-[#b9a5f5] shadow-md shadow-[#7654d6]/30 font-bold"
                    : "bg-[#1d1a2b] hover:bg-[#252237] text-zinc-300 border-[#38344f]"
                }`}
              >
                {quality}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400">
            {settings.graphicsQuality === "low" && "Lower resolution scale (0.75x) for smoother performance on integrated GPUs."}
            {settings.graphicsQuality === "medium" && "Native resolution scale (1.0x) with balanced environmental lighting."}
            {settings.graphicsQuality === "high" && "High-DPI rendering (up to 1.5x) with enhanced shadows and depth."}
          </p>
        </div>

        {/* Field of View (FOV) */}
        <div className="space-y-2 pt-2 border-t border-[#2d293d]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#b9a5f5]" /> Field of View (FOV)
            </span>
            <span className="text-xs font-mono text-[#b9a5f5]">{settings.fov}°</span>
          </div>
          <input
            type="range"
            min={60}
            max={85}
            step={1}
            value={settings.fov}
            onChange={(e) => onUpdateSettings({ fov: Number(e.target.value) })}
            className="w-full accent-[#7654d6] bg-zinc-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>60° (Cinematic)</span>
            <span>72° (Default)</span>
            <span>85° (Wide)</span>
          </div>
        </div>

        {/* Audio Toggle & Volume */}
        <div className="space-y-4 pt-2 border-t border-[#2d293d]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              )}
              Sound & Ambience
            </span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`py-1 px-3 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                settings.soundEnabled
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              {settings.soundEnabled ? "ENABLED" : "MUTED"}
            </button>
          </div>

          {settings.soundEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Master Volume</span>
                <span className="font-mono text-zinc-300">
                  {Math.round(settings.musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) =>
                  onUpdateSettings({
                    musicVolume: Number(e.target.value),
                    sfxVolume: Number(e.target.value),
                  })
                }
                className="w-full accent-[#7654d6] bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>
    </ModalDialog>
  );
};

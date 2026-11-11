import React from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ui/ModalDialog";
import type { GameSettings, GraphicsQuality } from "@scammaze/shared-types";
import { Volume2, VolumeX, Eye, Sparkles, Languages } from "lucide-react";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  formatNumber,
  formatPercent,
  useGameLocale,
} from "../../i18n";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (settings: Partial<GameSettings>) => void;
}

const GRAPHICS_QUALITIES: GraphicsQuality[] = ["low", "medium", "high"];

const OPTION_BASE_CLASSES =
  "py-2 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer";
const OPTION_SELECTED_CLASSES =
  "bg-[#7654d6] text-white border-[#b9a5f5] shadow-md shadow-[#7654d6]/30 font-bold";
const OPTION_UNSELECTED_CLASSES = "bg-[#1d1a2b] hover:bg-[#252237] text-zinc-300 border-[#38344f]";

function optionClasses(selected: boolean): string {
  return `${OPTION_BASE_CLASSES} ${selected ? OPTION_SELECTED_CLASSES : OPTION_UNSELECTED_CLASSES}`;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const { t } = useTranslation("settings");
  const locale = useGameLocale();
  const degrees = (value: number) => `${formatNumber(locale, value)}°`;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("title")}
      subtitle={t("subtitle")}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Language */}
        <div className="space-y-3">
          <span
            id="settings-language-heading"
            className="text-sm font-semibold text-white flex items-center gap-2"
          >
            <Languages className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
            {t("language.heading")}
          </span>
          <div
            role="radiogroup"
            aria-labelledby="settings-language-heading"
            className="grid grid-cols-2 gap-2"
          >
            {SUPPORTED_LOCALES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={settings.language === option}
                lang={option}
                onClick={() => onUpdateSettings({ language: option })}
                className={optionClasses(settings.language === option)}
              >
                {LOCALE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {/* Graphics Quality */}
        <div className="space-y-3 pt-2 border-t border-[#2d293d]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
              {t("graphics.heading")}
            </span>
            <span className="text-xs font-mono uppercase text-[#b9a5f5] bg-[#7654d6]/20 px-2 py-0.5 rounded border border-[#7654d6]/40">
              {t(`graphics.quality.${settings.graphicsQuality}`)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {GRAPHICS_QUALITIES.map((quality) => (
              <button
                key={quality}
                type="button"
                onClick={() => onUpdateSettings({ graphicsQuality: quality })}
                className={optionClasses(settings.graphicsQuality === quality)}
              >
                {t(`graphics.quality.${quality}`)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400">
            {t(`graphics.description.${settings.graphicsQuality}`)}
          </p>
        </div>

        {/* Field of View (FOV) */}
        <div className="space-y-2 pt-2 border-t border-[#2d293d]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
              {t("fov.heading")}
            </span>
            <span className="text-xs font-mono text-[#b9a5f5]">{degrees(settings.fov)}</span>
          </div>
          <input
            type="range"
            min={60}
            max={85}
            step={1}
            value={settings.fov}
            aria-label={t("fov.heading")}
            onChange={(e) => onUpdateSettings({ fov: Number(e.target.value) })}
            className="w-full accent-[#7654d6] bg-zinc-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>{t("fov.cinematic", { value: degrees(60) })}</span>
            <span>{t("fov.default", { value: degrees(72) })}</span>
            <span>{t("fov.wide", { value: degrees(85) })}</span>
          </div>
        </div>

        {/* Audio Toggle & Volume */}
        <div className="space-y-4 pt-2 border-t border-[#2d293d]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500" aria-hidden="true" />
              )}
              {t("sound.heading")}
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
              {settings.soundEnabled ? t("sound.enabled") : t("sound.muted")}
            </button>
          </div>

          {settings.soundEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{t("sound.masterVolume")}</span>
                <span className="font-mono text-zinc-300">
                  {formatPercent(locale, settings.musicVolume)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                aria-label={t("sound.masterVolume")}
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

import React from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ui/ModalDialog";
import type { GameSettings, GraphicsQuality, ReducedMotionSetting } from "@scammaze/shared-types";
import {
  Volume2,
  VolumeX,
  Eye,
  Sparkles,
  Languages,
  Mic,
  Captions,
  Phone,
  Wind,
  Move,
} from "lucide-react";
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

const REDUCED_MOTION_OPTIONS: ReducedMotionSetting[] = ["system", "on", "off"];

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

        {/* Voice and comfort */}
        <div className="space-y-4 pt-2 border-t border-[#2d293d]">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Mic className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
            {t("voice.heading")}
          </span>

          {settings.soundEnabled && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <label htmlFor="settings-voice-volume">{t("voice.volume")}</label>
                <span className="font-mono text-zinc-300">
                  {formatPercent(locale, settings.voiceVolume)}
                </span>
              </div>
              <input
                id="settings-voice-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.voiceVolume}
                onChange={(e) => onUpdateSettings({ voiceVolume: Number(e.target.value) })}
                className="w-full accent-[#7654d6] bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
          )}

          <SettingsToggle
            id="settings-captions"
            icon={<Captions className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />}
            label={t("voice.captions")}
            checked={settings.subtitlesEnabled}
            stateText={settings.subtitlesEnabled ? t("toggle.on") : t("toggle.off")}
            onChange={(checked) => onUpdateSettings({ subtitlesEnabled: checked })}
          />

          <SettingsToggle
            id="settings-phone-filter"
            icon={<Phone className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />}
            label={t("voice.phoneFilter")}
            checked={settings.phoneVoiceFilter}
            stateText={settings.phoneVoiceFilter ? t("toggle.on") : t("toggle.off")}
            onChange={(checked) => onUpdateSettings({ phoneVoiceFilter: checked })}
          />

          {settings.language === "vi" && (
            <SettingsToggle
              id="settings-english-fallback"
              icon={<Languages className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />}
              label={t("voice.englishFallback")}
              checked={settings.englishVoiceFallback}
              stateText={settings.englishVoiceFallback ? t("toggle.on") : t("toggle.off")}
              onChange={(checked) => onUpdateSettings({ englishVoiceFallback: checked })}
            />
          )}

          <div className="space-y-1">
            <SettingsToggle
              id="settings-reduced-stress"
              icon={<Wind className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />}
              label={t("comfort.reducedStress")}
              checked={settings.reducedStress}
              stateText={settings.reducedStress ? t("toggle.on") : t("toggle.off")}
              describedBy="settings-reduced-stress-hint"
              onChange={(checked) => onUpdateSettings({ reducedStress: checked })}
            />
            <p id="settings-reduced-stress-hint" className="text-[11px] text-zinc-400">
              {t("comfort.reducedStressHint")}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
              <Move className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
              {t("comfort.motion.heading")}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {REDUCED_MOTION_OPTIONS.map((option) => (
                <label
                  key={option}
                  className={`${optionClasses(settings.reducedMotion === option)} text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#b9a5f5]`}
                >
                  <input
                    type="radio"
                    name="settings-reduced-motion"
                    value={option}
                    checked={settings.reducedMotion === option}
                    onChange={() => onUpdateSettings({ reducedMotion: option })}
                    className="sr-only"
                  />
                  {t(`comfort.motion.${option}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </ModalDialog>
  );
};

interface SettingsToggleProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  stateText: string;
  describedBy?: string;
  onChange: (checked: boolean) => void;
}

/** Native checkbox with a visible label and a text state, styled like the sound toggle. */
const SettingsToggle: React.FC<SettingsToggleProps> = ({
  id,
  icon,
  label,
  checked,
  stateText,
  describedBy,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-3">
    <label htmlFor={id} className="text-xs text-zinc-300 flex items-center gap-2">
      {icon}
      {label}
    </label>
    <label
      className={`relative py-1 px-3 rounded-full text-xs font-semibold border transition-all cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#b9a5f5] ${
        checked
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          : "bg-zinc-800 text-zinc-400 border-zinc-700"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      />
      {stateText}
    </label>
  </div>
);

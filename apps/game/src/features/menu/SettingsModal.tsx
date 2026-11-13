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

// Same visual language as the main menu: square options, the selected one is the ivory slab with a
// purple accent; keyboard focus gets an ivory outline.
const OPTION_BASE_CLASSES =
  "py-2 px-3 border font-menu text-sm font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3efe4]";
const OPTION_SELECTED_CLASSES =
  "bg-[#f3efe4] text-[#171521] border-[#f3efe4] shadow-[inset_4px_0_0_#7654d6] font-bold";
const OPTION_UNSELECTED_CLASSES = "bg-black/30 text-zinc-300 border-white/15 hover:border-white/40 hover:text-white";

const SECTION_HEADING_CLASSES =
  "font-menu text-base font-semibold uppercase tracking-[0.12em] text-zinc-100 flex items-center gap-2";
const VALUE_CLASSES = "font-menu text-base font-bold tabular-nums text-[#f3efe4]";
const KEYCAP_BASE_CLASSES =
  "relative min-w-[3.75rem] border px-2.5 py-0.5 text-center font-menu text-sm font-bold uppercase tracking-[0.12em] transition-colors cursor-pointer";

const RANGE_CLASSES = "menu-range w-full";

/** Fill amount for `.menu-range` (purple track up to the thumb). */
function rangeFill(value: number, min: number, max: number): React.CSSProperties {
  return { "--fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties;
}

function keycapClasses(on: boolean): string {
  return `${KEYCAP_BASE_CLASSES} ${
    on ? "bg-[#f3efe4] text-[#171521] border-[#f3efe4]" : "bg-black/30 text-zinc-400 border-white/20 hover:border-white/40"
  }`;
}

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
      maxWidth="wide"
    >
      {/* Landscape layout: display settings on the left, audio and comfort on the right
          (one column on narrow screens). */}
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Language */}
          <div className="space-y-3">
            <span
              id="settings-language-heading"
              className={SECTION_HEADING_CLASSES}
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
          <div className="space-y-3 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className={SECTION_HEADING_CLASSES}>
                <Sparkles className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
                {t("graphics.heading")}
              </span>
              <span className={`${VALUE_CLASSES} uppercase tracking-[0.1em]`}>
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
            <p className="text-xs text-zinc-400">
              {t(`graphics.description.${settings.graphicsQuality}`)}
            </p>
          </div>

          {/* Field of View (FOV) */}
          <div className="space-y-2 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className={SECTION_HEADING_CLASSES}>
                <Eye className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
                {t("fov.heading")}
              </span>
              <span className={VALUE_CLASSES}>{degrees(settings.fov)}</span>
            </div>
            <input
              type="range"
              min={60}
              max={85}
              step={1}
              value={settings.fov}
              aria-label={t("fov.heading")}
              onChange={(e) => onUpdateSettings({ fov: Number(e.target.value) })}
              className={RANGE_CLASSES}
              style={rangeFill(settings.fov, 60, 85)}
            />
            <div className="flex justify-between font-menu text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">
              <span>{t("fov.cinematic", { value: degrees(60) })}</span>
              <span>{t("fov.default", { value: degrees(72) })}</span>
              <span>{t("fov.wide", { value: degrees(85) })}</span>
            </div>
          </div>

        </div>

        <div className="space-y-6 lg:border-l lg:border-white/10 lg:pl-10">
          {/* Audio Toggle & Volume */}
          <div className="space-y-4 pt-5 border-t border-white/10 lg:border-t-0 lg:pt-0">
            <div className="flex items-center justify-between">
              <span className={SECTION_HEADING_CLASSES}>
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
                ) : (
                  <VolumeX className="w-4 h-4 text-zinc-500" aria-hidden="true" />
                )}
                {t("sound.heading")}
              </span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                className={`${keycapClasses(settings.soundEnabled)} outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3efe4]`}
              >
                {settings.soundEnabled ? t("sound.enabled") : t("sound.muted")}
              </button>
            </div>

            {settings.soundEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{t("sound.masterVolume")}</span>
                  <span className="font-menu text-sm font-bold tabular-nums text-[#f3efe4]">
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
                  className={RANGE_CLASSES}
                  style={rangeFill(settings.musicVolume, 0, 1)}
                />
              </div>
            )}
          </div>

          {/* Voice and comfort */}
          <div className="space-y-4 pt-5 border-t border-white/10">
            <span className={SECTION_HEADING_CLASSES}>
              <Mic className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
              {t("voice.heading")}
            </span>

            {settings.soundEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <label htmlFor="settings-voice-volume">{t("voice.volume")}</label>
                  <span className="font-menu text-sm font-bold tabular-nums text-[#f3efe4]">
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
                  className={RANGE_CLASSES}
                  style={rangeFill(settings.voiceVolume, 0, 1)}
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
              <legend className={`${SECTION_HEADING_CLASSES} mb-2`}>
                <Move className="w-4 h-4 text-[#b9a5f5]" aria-hidden="true" />
                {t("comfort.motion.heading")}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {REDUCED_MOTION_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`${optionClasses(settings.reducedMotion === option)} flex items-center justify-center text-center leading-tight has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#f3efe4]`}
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

/** Native checkbox with a visible label and a text state, styled as a key-cap like the sound toggle. */
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
    <label htmlFor={id} className="text-[13px] text-zinc-300 flex items-center gap-2">
      {icon}
      {label}
    </label>
    <label
      className={`${keycapClasses(checked)} has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#f3efe4]`}
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

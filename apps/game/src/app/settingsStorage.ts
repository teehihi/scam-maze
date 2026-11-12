import type { GameSettings } from "@scammaze/shared-types";
import { DEFAULT_LOCALE, isSupportedLocale } from "../i18n/locales";

/** The game's own settings key. Not shared with the landing app. */
export const SETTINGS_STORAGE_KEY = "scammaze_settings_v1";

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: "medium",
  soundEnabled: true,
  musicVolume: 1.0,
  sfxVolume: 1.0,
  fov: 72,
  language: "en",
  voiceVolume: 1.0,
  subtitlesEnabled: true,
  reducedStress: false,
  reducedMotion: "system",
  phoneVoiceFilter: true,
  englishVoiceFallback: false,
};

const REDUCED_MOTION_VALUES: readonly string[] = ["system", "on", "off"];

/** Validates the six voice and accessibility fields; any old or invalid value gives its default. */
function sanitizeNewFields(merged: GameSettings): GameSettings {
  const d = DEFAULT_SETTINGS;
  const bool = (value: unknown, fallback: boolean): boolean =>
    typeof value === "boolean" ? value : fallback;
  const volume = merged.voiceVolume as unknown;
  return {
    ...merged,
    voiceVolume:
      typeof volume === "number" && Number.isFinite(volume)
        ? Math.min(1, Math.max(0, volume))
        : d.voiceVolume,
    subtitlesEnabled: bool(merged.subtitlesEnabled, d.subtitlesEnabled),
    reducedStress: bool(merged.reducedStress, d.reducedStress),
    reducedMotion: REDUCED_MOTION_VALUES.includes(merged.reducedMotion as string)
      ? merged.reducedMotion
      : d.reducedMotion,
    phoneVoiceFilter: bool(merged.phoneVoiceFilter, d.phoneVoiceFilter),
    englishVoiceFallback: bool(merged.englishVoiceFallback, d.englishVoiceFallback),
  };
}

/**
 * Same merge as the previous inline reader in `App.tsx`, plus a validated `language`.
 * The other five fields keep the legacy, unvalidated merge on purpose (Requirement 2.7).
 * Absent values, non-JSON text, JSON primitives, `null` and arrays give the defaults.
 */
export function parseStoredSettings(raw: string | null): GameSettings {
  if (raw === null) return { ...DEFAULT_SETTINGS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_SETTINGS };
  }
  const merged = { ...DEFAULT_SETTINGS, ...(parsed as Partial<GameSettings>) };
  return sanitizeNewFields({
    ...merged,
    language: isSupportedLocale(merged.language) ? merged.language : DEFAULT_LOCALE,
  });
}

/** Reads the stored settings. Storage access errors (for example a blocked `localStorage`) give the defaults. */
export function loadSettings(storage: Pick<Storage, "getItem"> | undefined): GameSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  let raw: string | null;
  try {
    raw = storage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  return parseStoredSettings(raw);
}

/** Writes the complete settings. Returns `false` when there is no storage or the write fails (for example a full quota). */
export function saveSettings(
  storage: Pick<Storage, "setItem"> | undefined,
  settings: GameSettings,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

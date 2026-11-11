import type { GameLocale } from "@scammaze/shared-types";

/** Every UI language the game ships. English is the source and the fallback. */
export const SUPPORTED_LOCALES = ["en", "vi"] as const satisfies readonly GameLocale[];

export const DEFAULT_LOCALE: GameLocale = "en";

export function isSupportedLocale(value: unknown): value is GameLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Each label in its own language. Not translated. */
export const LOCALE_LABELS: Record<GameLocale, string> = { en: "English", vi: "Tiếng Việt" };

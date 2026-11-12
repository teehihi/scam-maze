import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import type { GameLocale } from "@scammaze/shared-types";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./locales";
import { NAMESPACES, resources } from "./resources";

/** The game's own i18next instance. No backend and no language detector are registered. */
export const i18n = i18next.createInstance();

/**
 * Initializes i18n synchronously with the bundled dictionaries and applies `locale`.
 * Safe to call more than once: later calls only apply the locale.
 */
export function initI18n(locale: GameLocale): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      ns: [...NAMESPACES],
      defaultNS: "common",
      initAsync: false,
      interpolation: { escapeValue: false }, // React escapes rendered text.
      react: { useSuspense: false },
      returnNull: false,
    });
  }
  applyLocale(locale);
  return i18n;
}

/** Switches the UI language and keeps `<html lang>` in step. Display only. */
export function applyLocale(locale: GameLocale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

export { DEFAULT_LOCALE, LOCALE_LABELS, SUPPORTED_LOCALES, isSupportedLocale } from "./locales";
export { NAMESPACES, resources } from "./resources";
export type { Namespace } from "./resources";
export type { LocaleShape } from "./types";
export { formatDate, formatNumber, formatPercent } from "./format";
export { useGameLocale } from "./useGameLocale";

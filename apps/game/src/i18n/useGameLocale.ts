import { useTranslation } from "react-i18next";
import type { GameLocale } from "@scammaze/shared-types";
import { DEFAULT_LOCALE, isSupportedLocale } from "./locales";

/** Current UI language. Components using it re-render when the language changes. */
export function useGameLocale(): GameLocale {
  const { i18n } = useTranslation();
  const resolved = i18n.resolvedLanguage;
  return isSupportedLocale(resolved) ? resolved : DEFAULT_LOCALE;
}

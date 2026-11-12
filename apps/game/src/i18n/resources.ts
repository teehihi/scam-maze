import enCommon from "./locales/en/common";
import enMenu from "./locales/en/menu";
import enSettings from "./locales/en/settings";
import enLoading from "./locales/en/loading";
import enCredits from "./locales/en/credits";
import enChapters from "./locales/en/chapters";
import enChapter1 from "./locales/en/chapter1";
import enWorlds from "./locales/en/worlds";
import viCommon from "./locales/vi/common";
import viMenu from "./locales/vi/menu";
import viSettings from "./locales/vi/settings";
import viLoading from "./locales/vi/loading";
import viCredits from "./locales/vi/credits";
import viChapters from "./locales/vi/chapters";
import viChapter1 from "./locales/vi/chapter1";
import viWorlds from "./locales/vi/worlds";
import type { GameLocale } from "@scammaze/shared-types";
import type { LocaleShape } from "./types";

export const NAMESPACES = [
  "common",
  "menu",
  "settings",
  "loading",
  "credits",
  "chapters",
  "chapter1",
  "worlds",
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/** English dictionaries: the source text and the type of every other locale. */
export const enResources = {
  common: enCommon,
  menu: enMenu,
  settings: enSettings,
  loading: enLoading,
  credits: enCredits,
  chapters: enChapters,
  chapter1: enChapter1,
  worlds: enWorlds,
} satisfies Record<Namespace, object>;

export type EnResources = typeof enResources;

export const viResources: { [N in Namespace]: LocaleShape<EnResources[N]> } = {
  common: viCommon,
  menu: viMenu,
  settings: viSettings,
  loading: viLoading,
  credits: viCredits,
  chapters: viChapters,
  chapter1: viChapter1,
  worlds: viWorlds,
};

/** All dictionaries, bundled with the app. No backend loads translations at runtime. */
export const resources = {
  en: enResources,
  vi: viResources,
} satisfies Record<GameLocale, Record<Namespace, object>>;

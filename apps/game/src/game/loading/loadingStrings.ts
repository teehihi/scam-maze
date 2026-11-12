import type { TFunction } from "i18next";
import type { GameLocale } from "@scammaze/shared-types";
import type { ChapterLoadSnapshot, LoadingStage } from "./chapterLoader";
import enCommon from "../../i18n/locales/en/common";
import enLoading from "../../i18n/locales/en/loading";
import { formatNumber } from "../../i18n/format";

/**
 * Translation function and locale for the loading helpers. Components pass the `t` from
 * `useTranslation(["loading", "common"])` and the value of `useGameLocale()`. This module stays
 * free of React and of the i18next instance: it only uses the `TFunction` type.
 */
export interface LoadingTextContext {
  t: TFunction<["loading", "common"]>;
  locale: GameLocale;
}

// Every loader stage has a text in the dictionary.
const STAGE_TEXT: Record<LoadingStage, string> = enLoading.stage;

/**
 * English loading text. Alias of the English dictionaries (`loading` and `common`), kept for
 * code and tests that read the English source directly. UI code translates by key instead.
 */
export const LOADING_TEXT = {
  stage: STAGE_TEXT,
  menuStartup: { ...enLoading.menuStartup, slowNotice: enLoading.slowNotice },
  continueEyebrow: enLoading.continueEyebrow,
  continueTitle: enLoading.continueTitle,
  continueSubtitle: enLoading.continueSubtitle,
  tipLabel: enLoading.tipLabel,
  nextTip: enLoading.nextTip,
  cancel: enCommon.actions.cancel,
  retry: enCommon.actions.retry,
  reload: enCommon.actions.reload,
  backToMenu: enCommon.actions.returnToMenu,
  continueToMenu: enLoading.continueToMenu,
  progressLabel: enLoading.progressLabel,
} as const;

/** Replaces `{{name}}` placeholders in an English template (fallback when no `t` is given). */
function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => values[name] ?? match);
}

/** "Chapter 1". Without a context, returns the English text. */
export function formatChapterLabel(chapterNumber: number, context?: LoadingTextContext): string {
  if (!context) return fillTemplate(enCommon.chapterLabel, { number: formatNumber("en", chapterNumber) });
  return context.t("common:chapterLabel", { number: formatNumber(context.locale, chapterNumber) });
}

/** "1 of 3 files", with counts formatted for the locale. Without a context, returns English. */
export function formatFileCount(completed: number, total: number, context?: LoadingTextContext): string {
  const locale = context?.locale ?? "en";
  const values = { completed: formatNumber(locale, completed), total: formatNumber(locale, total) };
  if (!context) {
    return fillTemplate(total === 1 ? enLoading.fileCount_one : enLoading.fileCount_other, values);
  }
  return context.t("loading:fileCount", { count: total, ...values });
}

/** Text for a loader stage. Without a context, returns English. */
export function describeLoadingStage(stage: LoadingStage, context?: LoadingTextContext): string {
  if (!context) return STAGE_TEXT[stage];
  return context.t(`loading:stage.${stage}`);
}

/** Main status line for a chapter loader snapshot. */
export function describeChapterStage(snapshot: ChapterLoadSnapshot, context?: LoadingTextContext): string {
  if (snapshot.stage === "loading-assets" && snapshot.currentAssetText) {
    // Asset text is chapter data; it is translated by asset ID in the chapter text task.
    return snapshot.currentAssetText;
  }
  return describeLoadingStage(snapshot.stage, context);
}

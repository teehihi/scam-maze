// Opening narration of Chapter 1: one paragraph per recorded voice clip.
// English has three clips, Vietnamese four, so the script is per language instead of shared keys.

import type { GameLocale } from "@scammaze/shared-types";
import { CHAPTER1_VOICE_BASE } from "../../../config/assetPaths";

/** Translation keys (namespace `chapter1`) of the intro lines. */
export type IntroTextKey =
  | "intro.welcome.p1"
  | "intro.welcome.p2"
  | "intro.welcome.p3"
  | "intro.welcome.p4"
  | "intro.resume";

export interface IntroLine {
  textKey: IntroTextKey;
  /** Voice clip, or null when the line has no recording (it is then typed at a fixed speed). */
  src: string | null;
}

/** `public/audio/chapter01/<locale>/chapter1_voice<n>start_<locale>.mp3` */
export function introClipSrc(locale: GameLocale, number: number): string {
  return `${CHAPTER1_VOICE_BASE}/${locale}/chapter1_voice${number}start_${locale}.mp3`;
}

const PARAGRAPHS: Record<GameLocale, readonly IntroTextKey[]> = {
  en: ["intro.welcome.p1", "intro.welcome.p2", "intro.welcome.p3"],
  vi: ["intro.welcome.p1", "intro.welcome.p2", "intro.welcome.p3", "intro.welcome.p4"],
};

/** The welcome lines for a new game, in order, each with its clip. */
export function welcomeScript(locale: GameLocale): IntroLine[] {
  return PARAGRAPHS[locale].map((textKey, index) => ({ textKey, src: introClipSrc(locale, index + 1) }));
}

/** A restored run has one short line and no recording. */
export const RESUME_SCRIPT: readonly IntroLine[] = [{ textKey: "intro.resume", src: null }];

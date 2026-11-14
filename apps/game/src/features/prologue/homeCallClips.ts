import { PROLOGUE_VOICE_BASE } from "../../config/assetPaths";

/** Path of one call-home narration clip, e.g. `/audio/prologue/en/prologue_home1_en.mp3`. */
export function homeCallClipPath(locale: string, index: number): string {
  return `${PROLOGUE_VOICE_BASE}/${locale}/prologue_home${index + 1}_${locale}.mp3`;
}

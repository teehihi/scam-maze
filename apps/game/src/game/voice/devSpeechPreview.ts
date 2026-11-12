// Developer-only speech preview over `speechSynthesis`. Off by default: the factory returns null
// unless this is a development build or VITE_DEV_VOICE_PREVIEW is "true". It is never shown in
// Settings, never counts as a present clip, and stays silent when no voice matches the locale.

import type { GameLocale } from "@scammaze/shared-types";
import type { PreviewPort } from "./audioPort";

/** The subset of `SpeechSynthesisVoice` this module reads. */
export interface PreviewVoiceLike {
  readonly lang: string;
}

function normalizeTag(tag: string): string {
  return tag.replace(/_/g, "-").toLowerCase();
}

/** Returns the first voice whose `lang` starts with the locale tag, or null. Pure. */
export function pickPreviewVoice<T extends PreviewVoiceLike>(
  voices: readonly T[],
  locale: GameLocale,
): T | null {
  const tag = normalizeTag(locale);
  for (const voice of voices) {
    const lang = normalizeTag(voice.lang);
    if (lang === tag || lang.startsWith(`${tag}-`)) return voice;
  }
  return null;
}

function previewEnabled(): boolean {
  const env = import.meta.env;
  return env.DEV === true || env.VITE_DEV_VOICE_PREVIEW === "true";
}

/** Creates the preview port, or null when disabled or when `speechSynthesis` is missing. */
export function createDevSpeechPreview(): PreviewPort | null {
  if (!previewEnabled()) return null;
  if (typeof window === "undefined") return null;
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return null;

  let gain = 1;
  let current: SpeechSynthesisUtterance | null = null;
  let disposed = false;

  function clear(): void {
    if (current) {
      current.onend = null;
      current.onerror = null;
      current = null;
    }
  }

  const port: PreviewPort = {
    speak(text, locale, o) {
      if (disposed) return false;
      port.stop();
      if (gain <= 0) return false;
      const voice = pickPreviewVoice(synth.getVoices(), locale);
      if (!voice) return false;
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.volume = Math.min(1, Math.max(0, o.gain * gain));
      const done = (): void => {
        if (current !== utterance) return;
        clear();
        o.onEnded();
      };
      utterance.onend = done;
      utterance.onerror = done;
      current = utterance;
      synth.speak(utterance);
      return true;
    },
    setGain(v) {
      gain = Math.min(1, Math.max(0, v));
      if (gain <= 0) port.stop();
      else if (current) current.volume = gain;
    },
    pause() {
      if (!disposed) synth.pause();
    },
    resume() {
      if (!disposed) synth.resume();
    },
    stop() {
      clear();
      synth.cancel();
    },
    dispose() {
      if (disposed) return;
      port.stop();
      disposed = true;
    },
  };
  return port;
}

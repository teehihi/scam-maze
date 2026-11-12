// Mix plan of the Chapter 1 voice and sound layers. Pure numbers and pure functions: no React,
// no Three.js, no i18n and no audio API. All values are PROPOSED and not tuned by ear.

import type { Tone } from "../narrative/chapter1/ids";

/** Pause before a line, per tone, in milliseconds. */
export const DEFAULT_PAUSE_MS: Readonly<Record<Tone, number>> = {
  professional: 350,
  reassuring: 450,
  defensive: 300,
  impatient: 150,
  pressuring: 100,
};

/** Extra pause for impatient and pressuring lines when reduced stress is on. */
export const REDUCED_STRESS_EXTRA_PAUSE_MS = 1200;
/** A clip that is not ready after this many milliseconds is skipped. */
export const LATE_CLIP_MS = 1500;
/** The choice gate opens this long after a line ends. */
export const GATE_AFTER_END_MS = 300;
/** The choice gate opens at the latest this long after the expected end. */
export const GATE_TIMEOUT_EXTRA_MS = 1500;

/** Linear peak cap for ringtone, click, ambience and tension. */
export const PEAK_CAP = 0.2;

export const RINGTONE_GAIN = 0.15;
export const RINGTONE_REDUCED_STRESS_FACTOR = 0.5;

/** Tension gain for pressure levels 1, 2 and 3 (index 0 is level 0, silent). */
export const TENSION_GAIN_BY_LEVEL: ReadonlyArray<number> = [0, 0.015, 0.03, 0.045];
export const TENSION_REDUCED_STRESS_FACTOR = 0.4;
export const TENSION_FADE_SECONDS = 1.5;

export const AMBIENCE_GAIN = 0.12;
export const AMBIENCE_CALL_GAIN = 0.04;

/** Phone voice filter: high-pass 300 Hz, low-pass 3400 Hz, Q 0.707. */
export const PHONE_FILTER = {
  highPassHz: 300,
  lowPassHz: 3400,
  q: 0.707,
} as const;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function capped(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > PEAK_CAP ? PEAK_CAP : v;
}

/** Gain of a spoken line: 0 when sound is off or muted, otherwise voice volume times master volume. */
export function voiceGain(
  settings: { soundEnabled: boolean; masterVolume: number; voiceVolume: number },
  muted: boolean,
): number {
  if (!settings.soundEnabled || muted) return 0;
  return clamp01(settings.voiceVolume) * clamp01(settings.masterVolume);
}

/** Pause before a line in milliseconds, longer for impatient and pressuring tones under reduced stress. */
export function effectivePauseMs(tone: Tone, reducedStress: boolean): number {
  const base = DEFAULT_PAUSE_MS[tone];
  const extra =
    reducedStress && (tone === "impatient" || tone === "pressuring")
      ? REDUCED_STRESS_EXTRA_PAUSE_MS
      : 0;
  return base + extra;
}

/** Tension bed gain for a pressure level (0 to 3). Never above the peak cap. */
export function tensionGain(pressureLevel: number, reducedStress: boolean): number {
  const level = Number.isFinite(pressureLevel)
    ? Math.min(3, Math.max(0, Math.trunc(pressureLevel)))
    : 0;
  const base = TENSION_GAIN_BY_LEVEL[level] ?? 0;
  return capped(reducedStress ? base * TENSION_REDUCED_STRESS_FACTOR : base);
}

/** Ringtone gain. Never above the peak cap. */
export function ringtoneGain(reducedStress: boolean): number {
  return capped(reducedStress ? RINGTONE_GAIN * RINGTONE_REDUCED_STRESS_FACTOR : RINGTONE_GAIN);
}

/** Ambience gain, lower during a call. Never above the peak cap. */
export function ambienceGain(inCall: boolean): number {
  return capped(inCall ? AMBIENCE_CALL_GAIN : AMBIENCE_GAIN);
}

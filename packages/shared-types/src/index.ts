/**
 * SCAMMAZE Shared Types & Contracts
 * Pure TypeScript definitions shared between apps and packages.
 * No framework dependencies (no React, no Three.js).
 */

export type SceneId = 'main-menu' | 'intro-prologue' | 'apartment' | 'street';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type GameLocale = 'en' | 'vi';

/** Reduced motion preference: follow the operating system, or force on or off. */
export type ReducedMotionSetting = 'system' | 'on' | 'off';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  soundEnabled: boolean;
  musicVolume: number; // 0.0 to 1.0
  sfxVolume: number;   // 0.0 to 1.0
  fov: number;         // Field of View, e.g. 65 - 85
  /** UI language. Display only; never affects game state. */
  language: GameLocale;
  /** Voice volume for spoken lines, 0.0 to 1.0. Default 1.0. Multiplied by the master volume. */
  voiceVolume: number;
  /** Show captions (subtitles) for spoken and non-speech sounds. Default true. */
  subtitlesEnabled: boolean;
  /** Softer sound and calmer presentation of tense moments. Default false. */
  reducedStress: boolean;
  /** Reduced motion preference. Default 'system'. */
  reducedMotion: ReducedMotionSetting;
  /** Apply the phone speaker filter to voices heard on a call. Default true. */
  phoneVoiceFilter: boolean;
  /** Use English voice clips when Vietnamese clips are missing. Default false. */
  englishVoiceFallback: boolean;
}

export interface CreditEntry {
  category: string;
  items: {
    title: string;
    author: string;
    license: string;
    sourceUrl?: string;
    notes?: string;
  }[];
}

export type ScamThreatCategory =
  | 'urgency-impersonation'
  | 'smishing-otp'
  | 'marketplace-advance-fee'
  | 'fake-job-deposit'
  | 'qr-code-tamper';

export interface ScenarioMeta {
  id: string;
  title: string;
  chapter: number;
  category: ScamThreatCategory;
  description: string;
  learningGoal: string;
}

// Audio port contracts for the Chapter 1 voice player. Types only: no React, no Three.js, no
// i18n and no audio API. The real implementation is `webAudioEngine.ts`; tests use a fake port.

import type { GameLocale } from "@scammaze/shared-types";

/** A decoded clip that a port can start. */
export interface LoadedClip {
  readonly id: string;
  readonly durationMs: number;
}

/** A running playback. `stop` is synchronous and safe to call more than once. */
export interface PlaybackHandle {
  stop(): void;
  setGain(v: number): void;
  positionMs(): number;
}

export interface AudioPort {
  readonly supported: boolean;
  resume(): Promise<"running" | "suspended">;
  /** Fetch and decode. Rejects on error. */
  load(url: string): Promise<LoadedClip>;
  start(
    clip: LoadedClip,
    o: { offsetMs: number; gain: number; phoneFilter: boolean; onEnded: () => void },
  ): PlaybackHandle;
  dispose(): void;
}

/** Developer-only speech preview over `speechSynthesis`. Never exposed in Settings. */
export interface PreviewPort {
  /** Speaks `text` only with a voice that matches `locale`. Returns false when it stays silent. */
  speak(text: string, locale: GameLocale, o: { gain: number; onEnded: () => void }): boolean;
  setGain(v: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  dispose(): void;
}

/** Why the player stopped the current line. */
export type StopReason =
  | "node-changed"
  | "call-ended"
  | "hang-up"
  | "page-hidden"
  | "settings-changed"
  | "dispose";

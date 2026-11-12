// Contract of the Chapter 1 voice manifest. Pure types and one constant: no React, no Three.js,
// no i18n and no audio API. Only types are imported from the narrative core.

import type { GameLocale } from "@scammaze/shared-types";

import type { DialogueGraphId, SpeakerId, Tone } from "../narrative/chapter1/ids";

export const VOICE_MANIFEST_SCHEMA_VERSION = 1;

/** `placeholder-tts` is reserved and unused. */
export type ClipStatus = "present" | "missing" | "placeholder-tts";

export interface VoiceClipEntry {
  /** Equals `nodeId`. */
  clipId: string;
  nodeId: string;
  graphId: DialogueGraphId;
  speakerId: SpeakerId;
  locale: GameLocale;
  status: ClipStatus;
  /** Empty when the clip is missing. */
  sources: ReadonlyArray<{ src: string; type: "audio/mpeg" }>;
  /** Measured from the source WAV; absent when missing. */
  durationMs?: number;
  bytes?: number;
  tone: Tone;
  /** Character description for a voice actor or an engine. */
  voiceNote: string;
  origin: "tts-generated" | "human-recorded" | "none";
  /** "not provided" when `origin` is "none". */
  credit: string;
  /** `fnv1a32` of the line text the clip was made from. */
  sourceTextHash: string;
}

export interface VoiceManifest {
  schemaVersion: typeof VOICE_MANIFEST_SCHEMA_VERSION;
  chapterId: "chapter-1";
  /** Sorted by `clipId`, then `locale`. */
  clips: ReadonlyArray<VoiceClipEntry>;
}

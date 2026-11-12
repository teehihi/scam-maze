// Pure derivation of the Chapter 1 voice generation jobs (design section 10, steps 2 and 3).
// No React, no Three.js, no i18n runtime, no audio API and no Node API. The generator script
// serializes the jobs to a JSON job file for the PowerShell worker and reads a `VoiceJobResult`
// list back.
//
// English text comes from the canonical scenario. Vietnamese text comes only from the Vietnamese
// narrative overlay. A Vietnamese line that has no overlay text produces no job, so the clip stays
// `missing`. English text is never used for a `vi` job.

import type { GameLocale } from "@scammaze/shared-types";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import type { DialogueGraphId, SpeakerId, Tone } from "../narrative/chapter1/ids";
import type { NarrativeOverlay } from "../narrative/localize";
import type { DialogueGraph, DialogueNode, ScenarioDefinition } from "../narrative/types";
import { fnv1a32 } from "./hash";

/** Speech API speaking-rate range (`SpeechSynthesizer.Options.SpeakingRate`). */
const MIN_RATE = 0.5;
const MAX_RATE = 6.0;
/** Speech API audio-pitch range (`SpeechSynthesizer.Options.AudioPitch`). */
const MIN_PITCH = 0;
const MAX_PITCH = 2;

/** Locales that have generated audio, in output order. */
export const VOICE_LOCALES: ReadonlyArray<GameLocale> = ["en", "vi"];

export interface VoiceCastLocaleEntry {
  /** Display name of the installed speech voice. */
  voice: string;
  /** Base speaking rate before the tone multiplier. */
  rate: number;
  pitch: number;
}

export interface VoiceCastEntry {
  /** Phone voice filter applied at playback; false for face-to-face speech. */
  phoneFilter: boolean;
  locales: Readonly<Record<GameLocale, VoiceCastLocaleEntry>>;
}

export type VoiceCast = Readonly<Record<SpeakerId, VoiceCastEntry>>;

/** Voice cast of design section 10 (PROPOSED; pitch effects are unverified). */
export const CHAPTER1_VOICE_CAST: VoiceCast = {
  "spk.alex": {
    phoneFilter: true,
    locales: {
      en: { voice: "Microsoft David", rate: 1.0, pitch: 1.0 },
      vi: { voice: "Microsoft An", rate: 1.0, pitch: 1.0 },
    },
  },
  "spk.case-officer": {
    phoneFilter: true,
    locales: {
      en: { voice: "Microsoft Mark", rate: 0.95, pitch: 0.9 },
      vi: { voice: "Microsoft An", rate: 0.95, pitch: 0.8 },
    },
  },
  "spk.northgate-agent": {
    phoneFilter: true,
    locales: {
      en: { voice: "Microsoft Zira", rate: 1.0, pitch: 1.0 },
      vi: { voice: "Microsoft An", rate: 1.0, pitch: 1.2 },
    },
  },
  "spk.sam": {
    phoneFilter: false,
    locales: {
      en: { voice: "Microsoft Mark", rate: 0.95, pitch: 1.0 },
      vi: { voice: "Microsoft An", rate: 0.95, pitch: 0.9 },
    },
  },
};

/** Tone rate multipliers of design section 10. No other tone processing exists. */
export const TONE_RATE_MULTIPLIER: Readonly<Record<Tone, number>> = {
  professional: 1.0,
  reassuring: 0.95,
  defensive: 1.0,
  impatient: 1.1,
  pressuring: 1.05,
};

/** One synthesis job. This is the JSON object the PowerShell worker reads from the job file. */
export interface VoiceJob {
  /** Equals the dialogue node ID. */
  clipId: string;
  graphId: DialogueGraphId;
  speakerId: SpeakerId;
  tone: Tone;
  locale: GameLocale;
  /** English line or Vietnamese overlay text. */
  text: string;
  /** `fnv1a32` of `text`. */
  textHash: string;
  /** Display name of the speech voice. */
  voice: string;
  /** Final speaking rate: cast rate times tone multiplier, clamped to the API range. */
  rate: number;
  pitch: number;
  /** Working WAV path, relative to `apps/game` (git-ignored cache, never in `public/`). */
  outWav: string;
  /** MP3 path, relative to `apps/game`: `public/audio/chapter01/<locale>/<clipId>.mp3`. */
  outMp3: string;
}

/** One result the PowerShell worker writes for a job. Failed jobs carry `ok: false` and `error`. */
export interface VoiceJobResult {
  clipId: string;
  locale: GameLocale;
  ok: boolean;
  /** Measured from the WAV, in milliseconds. */
  durationMs?: number;
  /** Size of the written MP3 in bytes. */
  bytes?: number;
  /** Measured RMS of the normalized WAV in dBFS. */
  rmsDbfs?: number;
  /** Peak of the normalized WAV in dBFS. */
  peakDbfs?: number;
  /** Failure reason; absent when `ok` is true. */
  error?: string;
}

/** Overlays by locale. The `en` entry is ignored: English text is always the canonical line. */
export type VoiceOverlays = Readonly<Partial<Record<GameLocale, NarrativeOverlay>>>;

/** A Spoken_Node is a node whose speaker is `caller` or `npc` (design decision D6). */
export function isSpokenNode(node: DialogueNode): boolean {
  return node.speaker === "caller" || node.speaker === "npc";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rounds to 3 decimals so job files and hashes of cast values stay stable. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function overlayLineKey(graphId: string, lineId: string): string {
  return `dialogues/${graphId}/lines/${lineId}`;
}

/** Text of a line for a locale, or `undefined` when none exists. Never falls back to English for `vi`. */
function lineText(
  graph: DialogueGraph,
  lineId: string,
  locale: GameLocale,
  overlays: VoiceOverlays,
): string | undefined {
  if (locale === "en") {
    const text = graph.lines[lineId];
    return typeof text === "string" && text.length > 0 ? text : undefined;
  }
  const overlay = overlays[locale];
  if (overlay === undefined) return undefined;
  const key = overlayLineKey(graph.id, lineId);
  if (!Object.prototype.hasOwnProperty.call(overlay, key)) return undefined;
  const text = overlay[key];
  return typeof text === "string" && text.length > 0 ? text : undefined;
}

/**
 * Returns one job per Spoken_Node and locale, in graph order, node order, then `en` before `vi`.
 * A Vietnamese job exists only when the overlay has text for the line; use
 * `listUntranslatedSpokenLines` to name the lines that were left out.
 * Throws when a Spoken_Node has no tone or no speaker (the content validator reports the same).
 */
export function buildVoiceJobs(
  scenario: ScenarioDefinition,
  overlays: VoiceOverlays,
  cast: VoiceCast = CHAPTER1_VOICE_CAST,
): VoiceJob[] {
  const jobs: VoiceJob[] = [];
  for (const graph of Object.values(scenario.dialogues)) {
    for (const node of Object.values(graph.nodes)) {
      if (!isSpokenNode(node)) continue;
      const speakerId = node.speakerId ?? graph.persona.speakerId;
      if (speakerId === undefined) {
        throw new Error(`Spoken node "${node.id}" in "${graph.id}" has no speaker.`);
      }
      if (node.tone === undefined) {
        throw new Error(`Spoken node "${node.id}" in "${graph.id}" has no tone.`);
      }
      const castEntry = cast[speakerId];
      if (castEntry === undefined) {
        throw new Error(`Speaker "${speakerId}" of node "${node.id}" is not in the voice cast.`);
      }
      for (const locale of VOICE_LOCALES) {
        const text = lineText(graph, node.lineId, locale, overlays);
        if (text === undefined) continue;
        const voice = castEntry.locales[locale];
        jobs.push({
          clipId: node.id,
          graphId: graph.id,
          speakerId,
          tone: node.tone,
          locale,
          text,
          textHash: fnv1a32(text),
          voice: voice.voice,
          rate: round3(clamp(voice.rate * TONE_RATE_MULTIPLIER[node.tone], MIN_RATE, MAX_RATE)),
          pitch: round3(clamp(voice.pitch, MIN_PITCH, MAX_PITCH)),
          outWav: `.voice-cache/${locale}/${node.id}.wav`,
          outMp3: `public${CHAPTER1_VOICE_BASE}/${locale}/${node.id}.mp3`,
        });
      }
    }
  }
  return jobs;
}

/** Spoken_Nodes that have no usable text in a locale, so `buildVoiceJobs` made no job for them. */
export function listUntranslatedSpokenLines(
  scenario: ScenarioDefinition,
  overlays: VoiceOverlays,
  locale: GameLocale,
): Array<{ clipId: string; graphId: DialogueGraphId; lineId: string }> {
  const result: Array<{ clipId: string; graphId: DialogueGraphId; lineId: string }> = [];
  for (const graph of Object.values(scenario.dialogues)) {
    for (const node of Object.values(graph.nodes)) {
      if (!isSpokenNode(node)) continue;
      if (lineText(graph, node.lineId, locale, overlays) === undefined) {
        result.push({ clipId: node.id, graphId: graph.id, lineId: node.lineId });
      }
    }
  }
  return result;
}

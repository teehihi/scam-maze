// Content validator for Chapter 1 subtitles, voice manifest and clip files (checks V5, V6, V7).
//
// Pure TypeScript: no Node API, no React, no Three.js, no audio API. The manifest and the file
// lookup are parameters, so the module works before the generated manifest exists and the test
// wrapper can supply `fileInfo` from `node:fs`.

import type { GameLocale } from "@scammaze/shared-types";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import type { NarrativeOverlay } from "../narrative/localize";
import type { ScenarioDefinition } from "../narrative/types";
import {
  VOICE_LOCALES,
  isSpokenNode,
  overlayLineKey,
  type VoiceOverlays,
} from "../voice/buildVoiceJobs";
import { fnv1a32 } from "../voice/hash";
import {
  VOICE_MANIFEST_SCHEMA_VERSION,
  type ClipStatus,
  type VoiceManifest,
} from "../voice/manifestTypes";

export type ContentCheckId = "V5" | "V6" | "V7";

export interface ContentIssue {
  check: ContentCheckId;
  /** Names the failing item, for example `dlg.sam/n.sam.greet (vi)`. */
  where: string;
  message: string;
}

/** What the injected file lookup reports for a public path such as `/audio/chapter01/en/x.mp3`. */
export interface ClipFileInfo {
  exists: boolean;
  bytes: number;
  /** MIME type of the file, for example `audio/mpeg`. */
  mime: string;
  /** Measured duration in milliseconds, when the lookup can measure it. */
  durationMs?: number;
}

/** Returns `undefined` or `exists: false` when the file is absent. */
export type FileInfoLookup = (publicPath: string) => ClipFileInfo | undefined;

export interface ChapterContentInputs {
  scenario: ScenarioDefinition;
  /** Overlays by locale. Only the `vi` entry is read; English is the scenario text. */
  overlays: VoiceOverlays;
  manifest: VoiceManifest;
  /** When omitted, V7 is skipped. */
  fileInfo?: FileInfoLookup;
}

export const MAX_CLIP_BYTES = 150 * 1024;
export const MAX_LOCALE_BYTES = 6 * 1024 * 1024;
export const MIN_CLIP_MS = 500;
export const MAX_CLIP_MS = 25_000;
export const CLIP_MIME = "audio/mpeg";

const KNOWN_STATUSES: ReadonlySet<ClipStatus> = new Set<ClipStatus>([
  "present",
  "missing",
  "placeholder-tts",
]);

interface SpokenLine {
  nodeId: string;
  graphId: string;
  lineId: string;
  speakerId: string | undefined;
}

function listSpokenLines(scenario: ScenarioDefinition): SpokenLine[] {
  const result: SpokenLine[] = [];
  for (const graph of Object.values(scenario.dialogues)) {
    for (const node of Object.values(graph.nodes)) {
      if (!isSpokenNode(node)) continue;
      result.push({
        nodeId: node.id,
        graphId: graph.id,
        lineId: node.lineId,
        speakerId: node.speakerId ?? graph.persona.speakerId,
      });
    }
  }
  return result;
}

/** Display text of a line: English from the scenario, other locales from their overlay only. */
function displayText(
  scenario: ScenarioDefinition,
  overlays: VoiceOverlays,
  line: SpokenLine,
  locale: GameLocale,
): string | undefined {
  if (locale === "en") {
    const graph = scenario.dialogues[line.graphId as keyof typeof scenario.dialogues];
    const text = graph?.lines[line.lineId];
    return typeof text === "string" ? text : undefined;
  }
  const overlay: NarrativeOverlay | undefined = overlays[locale];
  if (overlay === undefined) return undefined;
  const key = overlayLineKey(line.graphId, line.lineId);
  if (!Object.prototype.hasOwnProperty.call(overlay, key)) return undefined;
  const text = overlay[key];
  return typeof text === "string" ? text : undefined;
}

function isNonEmpty(text: string | undefined): text is string {
  return text !== undefined && text.trim().length > 0;
}

/** V5: every Spoken_Node has a non-empty English line and a non-empty Vietnamese overlay text. */
export function validateSubtitles(
  scenario: ScenarioDefinition,
  overlays: VoiceOverlays,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const line of listSpokenLines(scenario)) {
    for (const locale of VOICE_LOCALES) {
      if (!isNonEmpty(displayText(scenario, overlays, line, locale))) {
        issues.push({
          check: "V5",
          where: `${line.graphId}/${line.nodeId} (${locale})`,
          message:
            locale === "en"
              ? `Spoken node "${line.nodeId}" has no English line "${line.lineId}".`
              : `Spoken node "${line.nodeId}" has no ${locale} overlay text for line "${line.lineId}".`,
        });
      }
    }
  }
  return issues;
}

/** V6: manifest coverage and consistency with the scenario and the display text. */
export function validateManifest(
  scenario: ScenarioDefinition,
  overlays: VoiceOverlays,
  manifest: VoiceManifest,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (where: string, message: string): void => {
    issues.push({ check: "V6", where, message });
  };

  if ((manifest.schemaVersion as number) !== VOICE_MANIFEST_SCHEMA_VERSION) {
    add(
      "manifest",
      `Unsupported schemaVersion ${String(manifest.schemaVersion)}; expected ${VOICE_MANIFEST_SCHEMA_VERSION}.`,
    );
  }

  const lines = listSpokenLines(scenario);
  const lineByNode = new Map(lines.map((line) => [line.nodeId, line]));
  const seen = new Map<string, number>();

  for (const entry of manifest.clips) {
    const where = `${entry.nodeId} (${entry.locale})`;
    const key = `${entry.nodeId}|${entry.locale}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);

    if (entry.clipId !== entry.nodeId) {
      add(where, `clipId "${entry.clipId}" must equal nodeId "${entry.nodeId}".`);
    }
    if (!VOICE_LOCALES.includes(entry.locale)) {
      add(where, `Locale "${String(entry.locale)}" has no generated audio.`);
    }
    const line = lineByNode.get(entry.nodeId);
    if (line === undefined) {
      add(where, `Manifest entry "${entry.nodeId}" is not a Spoken_Node of the scenario.`);
    } else {
      if (entry.graphId !== line.graphId) {
        add(where, `graphId "${entry.graphId}" does not match graph "${line.graphId}".`);
      }
      if (entry.speakerId !== line.speakerId) {
        add(
          where,
          `speakerId "${entry.speakerId}" does not match the node speaker "${String(line.speakerId)}".`,
        );
      }
    }

    if (!KNOWN_STATUSES.has(entry.status)) {
      add(where, `Unknown status "${String(entry.status)}".`);
    }
    if (entry.status === "present") {
      if (entry.sources.length === 0) add(where, "A present clip has no sources.");
      if (entry.durationMs === undefined) add(where, "A present clip has no durationMs.");
      if (entry.bytes === undefined) add(where, "A present clip has no bytes.");
      // Stale clip check: the clip must come from the text that is shown now.
      if (line !== undefined) {
        const text = displayText(scenario, overlays, line, entry.locale);
        if (text !== undefined && fnv1a32(text) !== entry.sourceTextHash) {
          add(where, "sourceTextHash does not match the current line text (stale clip).");
        }
      }
    } else if (entry.status === "missing") {
      if (entry.sources.length > 0) add(where, "A missing clip must have no sources.");
      if (entry.durationMs !== undefined) add(where, "A missing clip must have no durationMs.");
      if (entry.bytes !== undefined) add(where, "A missing clip must have no bytes.");
    }
  }

  for (const [key, count] of seen) {
    if (count > 1) {
      const [nodeId, locale] = key.split("|");
      add(`${nodeId} (${locale})`, `Manifest has ${count} entries for this node and locale.`);
    }
  }

  for (const line of lines) {
    for (const locale of VOICE_LOCALES) {
      if (!seen.has(`${line.nodeId}|${locale}`)) {
        add(`${line.nodeId} (${locale})`, "Spoken_Node has no manifest entry for this locale.");
      }
    }
  }

  return issues;
}

/** V7: files named by `present` entries exist and respect format and size limits. */
export function validateClipFiles(manifest: VoiceManifest, fileInfo: FileInfoLookup): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const localeBytes = new Map<string, number>();

  for (const entry of manifest.clips) {
    if (entry.status !== "present") continue;
    const where = `${entry.nodeId} (${entry.locale})`;
    const add = (message: string): void => {
      issues.push({ check: "V7", where, message });
    };

    const prefix = `${CHAPTER1_VOICE_BASE}/${entry.locale}/`;
    for (const source of entry.sources) {
      if (!source.src.startsWith(prefix) || source.src.includes("..")) {
        add(`Source "${source.src}" is not under ${prefix}.`);
      }
      if (source.type !== CLIP_MIME) {
        add(`Source "${source.src}" declares type "${String(source.type)}"; expected ${CLIP_MIME}.`);
      }
    }

    const first = entry.sources[0];
    const info = first === undefined ? undefined : fileInfo(first.src);
    if (first !== undefined && (info === undefined || !info.exists)) {
      add(`File "${first.src}" does not exist.`);
    }

    let realBytes = entry.bytes ?? 0;
    if (info !== undefined && info.exists) {
      realBytes = info.bytes;
      if (info.mime !== CLIP_MIME) add(`File MIME is "${info.mime}"; expected ${CLIP_MIME}.`);
      if (info.bytes <= 0) add("File is empty.");
      if (entry.bytes !== undefined && entry.bytes !== info.bytes) {
        add(`Manifest bytes ${entry.bytes} differ from the file size ${info.bytes}.`);
      }
      if (info.durationMs !== undefined && (info.durationMs < MIN_CLIP_MS || info.durationMs > MAX_CLIP_MS)) {
        add(`File duration ${info.durationMs} ms is outside ${MIN_CLIP_MS} to ${MAX_CLIP_MS} ms.`);
      }
    }
    if (realBytes > MAX_CLIP_BYTES) {
      add(`Clip is ${realBytes} bytes; the limit is ${MAX_CLIP_BYTES}.`);
    }
    if (entry.durationMs !== undefined && (entry.durationMs < MIN_CLIP_MS || entry.durationMs > MAX_CLIP_MS)) {
      add(`Duration ${entry.durationMs} ms is outside ${MIN_CLIP_MS} to ${MAX_CLIP_MS} ms.`);
    }
    localeBytes.set(entry.locale, (localeBytes.get(entry.locale) ?? 0) + realBytes);
  }

  for (const [locale, total] of localeBytes) {
    if (total > MAX_LOCALE_BYTES) {
      issues.push({
        check: "V7",
        where: `locale ${locale}`,
        message: `Clips for "${locale}" total ${total} bytes; the limit is ${MAX_LOCALE_BYTES}.`,
      });
    }
  }
  return issues;
}

/** Runs V5, V6 and (when `fileInfo` is given) V7. An empty result means no issue was found. */
export function validateChapterContent(inputs: ChapterContentInputs): ContentIssue[] {
  const { scenario, overlays, manifest, fileInfo } = inputs;
  const issues = [
    ...validateSubtitles(scenario, overlays),
    ...validateManifest(scenario, overlays, manifest),
  ];
  if (fileInfo !== undefined) issues.push(...validateClipFiles(manifest, fileInfo));
  return issues;
}

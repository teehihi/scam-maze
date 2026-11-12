// Missing-clip report for the Chapter 1 voice manifest. Pure TypeScript: no React, no Three.js,
// no i18n, no audio API and no Node API.

import type { GameLocale } from "@scammaze/shared-types";

import type { SpeakerId } from "../narrative/chapter1/ids";
import type { ClipStatus, VoiceClipEntry, VoiceManifest } from "./manifestTypes";

export type ClipOrigin = VoiceClipEntry["origin"];

export interface MissingClipReportEntry {
  clipId: string;
  locale: GameLocale;
  speakerId: SpeakerId;
  /** Line text from `lineTextFor`. */
  text: string;
}

export interface VoiceReport {
  total: number;
  /** Number of entries per locale. */
  byLocale: Record<string, number>;
  /** Number of entries per status. */
  byStatus: Record<string, number>;
  /** Number of entries per origin. */
  byOrigin: Record<string, number>;
  /** Number of entries per locale and status. */
  byLocaleStatus: Record<string, Record<string, number>>;
  /** Number of entries per locale, status and origin. */
  byLocaleStatusOrigin: Record<string, Record<string, Record<string, number>>>;
  /** Entries with status `missing`, in manifest order. */
  missing: ReadonlyArray<MissingClipReportEntry>;
}

function bump(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

/**
 * Counts manifest entries per locale, status and origin and lists the `missing` ones.
 * Only status `present` counts as present: a `placeholder-tts` (development preview) entry keeps
 * its own status key and is never added to `present`.
 */
export function buildVoiceReport(
  manifest: VoiceManifest,
  lineTextFor: (entry: VoiceClipEntry) => string,
): VoiceReport {
  const byLocale: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byOrigin: Record<string, number> = {};
  const byLocaleStatus: Record<string, Record<string, number>> = {};
  const byLocaleStatusOrigin: Record<string, Record<string, Record<string, number>>> = {};
  const missing: MissingClipReportEntry[] = [];

  for (const entry of manifest.clips) {
    const status: ClipStatus = entry.status;
    bump(byLocale, entry.locale);
    bump(byStatus, status);
    bump(byOrigin, entry.origin);
    bump((byLocaleStatus[entry.locale] ??= {}), status);
    const statusMap = (byLocaleStatusOrigin[entry.locale] ??= {});
    bump((statusMap[status] ??= {}), entry.origin);

    if (status === "missing") {
      missing.push({
        clipId: entry.clipId,
        locale: entry.locale,
        speakerId: entry.speakerId,
        text: lineTextFor(entry),
      });
    }
  }

  return {
    total: manifest.clips.length,
    byLocale,
    byStatus,
    byOrigin,
    byLocaleStatus,
    byLocaleStatusOrigin,
    missing,
  };
}

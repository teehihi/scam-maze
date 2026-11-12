import { describe, expect, it } from "vitest";

import type { GameLocale } from "@scammaze/shared-types";

import { DIALOGUE_GRAPH_IDS, SPEAKER_IDS, TONE_IDS } from "../narrative/chapter1/ids";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  caseSeed,
  shrinkFailingPrefix,
} from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import {
  VOICE_MANIFEST_SCHEMA_VERSION,
  type ClipStatus,
  type VoiceClipEntry,
  type VoiceManifest,
} from "./manifestTypes";
import { buildVoiceReport } from "./voiceReport";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/** File-specific base seed, derived from the shared core seed. */
const VOICE_REPORT_SEED = (CORE_PROPERTY_SEED ^ 0x17) >>> 0;

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const STATUSES: readonly ClipStatus[] = ["present", "missing", "placeholder-tts"];
const ORIGINS: readonly VoiceClipEntry["origin"][] = ["tts-generated", "human-recorded", "none"];

/** Deterministic line text for an entry, so the report text can be checked exactly. */
function lineTextFor(entry: VoiceClipEntry): string {
  return `line[${entry.locale}] ${entry.clipId}`;
}

function generateEntry(next: () => number, index: number): VoiceClipEntry {
  const status = pick(next, STATUSES);
  const origin = pick(next, ORIGINS);
  const clipId = `node.${index}.${randomInt(next, 0, 9999)}`;
  return {
    clipId,
    nodeId: clipId,
    graphId: pick(next, DIALOGUE_GRAPH_IDS),
    speakerId: pick(next, SPEAKER_IDS),
    locale: pick(next, LOCALES),
    status,
    sources: status === "missing" ? [] : [{ src: `/audio/chapter01/${clipId}.mp3`, type: "audio/mpeg" }],
    tone: pick(next, TONE_IDS),
    voiceNote: "test voice",
    origin,
    credit: origin === "none" ? "not provided" : "test credit",
    sourceTextHash: randomInt(next, 0, 0xffff).toString(16).padStart(8, "0"),
  };
}

/** Manifests of 0 to 40 entries; an empty one appears in roughly one case in twenty. */
function generateManifest(seed: number): VoiceManifest {
  const next = createLcg(seed);
  const size = next() < 0.05 ? 0 : randomInt(next, 1, 40);
  const clips: VoiceClipEntry[] = [];
  for (let index = 0; index < size; index += 1) clips.push(generateEntry(next, index));
  return { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips };
}

function tally<T extends string>(values: readonly T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function sumOf(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

/** Violations of Property 17 for `clips`. An empty list means the property holds. */
function violationsFor(clips: readonly VoiceClipEntry[]): string[] {
  const manifest: VoiceManifest = {
    schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION,
    chapterId: "chapter-1",
    clips,
  };
  const report = buildVoiceReport(manifest, lineTextFor);
  const violations: string[] = [];

  // The missing list is exactly the missing entries, in manifest order, with all four fields.
  const expectedMissing = clips
    .filter((entry) => entry.status === "missing")
    .map((entry) => ({
      clipId: entry.clipId,
      locale: entry.locale,
      speakerId: entry.speakerId,
      text: lineTextFor(entry),
    }));
  if (JSON.stringify(report.missing) !== JSON.stringify(expectedMissing)) {
    violations.push(
      `missing list differs: expected ${expectedMissing.length} entries, got ${report.missing.length}`,
    );
  }

  // Counts per locale, status and origin equal the entry counts.
  if (report.total !== clips.length) violations.push(`total ${report.total} != ${clips.length}`);
  const expectedByLocale = tally(clips.map((entry) => entry.locale));
  const expectedByStatus = tally(clips.map((entry) => entry.status));
  const expectedByOrigin = tally(clips.map((entry) => entry.origin));
  if (JSON.stringify(report.byLocale) !== JSON.stringify(expectedByLocale)) violations.push("byLocale differs");
  if (JSON.stringify(report.byStatus) !== JSON.stringify(expectedByStatus)) violations.push("byStatus differs");
  if (JSON.stringify(report.byOrigin) !== JSON.stringify(expectedByOrigin)) violations.push("byOrigin differs");

  // Counts add up.
  for (const [name, record] of [
    ["byLocale", report.byLocale],
    ["byStatus", report.byStatus],
    ["byOrigin", report.byOrigin],
  ] as const) {
    if (sumOf(record) !== clips.length) violations.push(`${name} sums to ${sumOf(record)}, not ${clips.length}`);
  }

  for (const locale of LOCALES) {
    const inLocale = clips.filter((entry) => entry.locale === locale);
    const perStatus = report.byLocaleStatus[locale] ?? {};
    if (JSON.stringify(perStatus) !== JSON.stringify(tally(inLocale.map((entry) => entry.status)))) {
      violations.push(`byLocaleStatus[${locale}] differs`);
    }
    if (sumOf(perStatus) !== inLocale.length) violations.push(`byLocaleStatus[${locale}] does not add up`);
    for (const status of STATUSES) {
      const inStatus = inLocale.filter((entry) => entry.status === status);
      const perOrigin = report.byLocaleStatusOrigin[locale]?.[status] ?? {};
      if (JSON.stringify(perOrigin) !== JSON.stringify(tally(inStatus.map((entry) => entry.origin)))) {
        violations.push(`byLocaleStatusOrigin[${locale}][${status}] differs`);
      }
      if (sumOf(perOrigin) !== inStatus.length) {
        violations.push(`byLocaleStatusOrigin[${locale}][${status}] does not add up`);
      }
    }
  }

  // A dev preview line is never counted as present.
  const presentCount = clips.filter((entry) => entry.status === "present").length;
  const placeholderCount = clips.filter((entry) => entry.status === "placeholder-tts").length;
  if ((report.byStatus["present"] ?? 0) !== presentCount) {
    violations.push(`present counted as ${report.byStatus["present"] ?? 0}, expected ${presentCount}`);
  }
  if ((report.byStatus["placeholder-tts"] ?? 0) !== placeholderCount) {
    violations.push("placeholder-tts is not counted under its own status");
  }
  for (const locale of LOCALES) {
    const present = clips.filter((entry) => entry.locale === locale && entry.status === "present").length;
    if ((report.byLocaleStatus[locale]?.["present"] ?? 0) !== present) {
      violations.push(`present for ${locale} includes a non-present entry`);
    }
  }

  return violations;
}

describe("voice report properties", () => {
  // Feature: chapter-01-voice-narrative, Property 17: The missing-clip report is exact
  it("lists exactly the missing clips and counts every status and origin", () => {
    // **Validates: Requirements 4.8, 6.7, 6.8**
    let missingCases = 0;
    let placeholderCases = 0;
    let emptyCases = 0;
    const failures: string[] = [];

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(VOICE_REPORT_SEED, index);
      const manifest = generateManifest(seed);
      const violations = violationsFor(manifest.clips);

      if (manifest.clips.length === 0) emptyCases += 1;
      if (manifest.clips.some((entry) => entry.status === "missing")) missingCases += 1;
      if (manifest.clips.some((entry) => entry.status === "placeholder-tts")) placeholderCases += 1;

      if (violations.length > 0) {
        const prefix = shrinkFailingPrefix(manifest.clips, (candidate) => violationsFor(candidate).length > 0);
        failures.push(
          `seed ${seed} (case ${index}): ${violations.join("; ")}; shortest failing prefix: ${
            prefix === null ? "none" : `${prefix.length} entries, last ${JSON.stringify(prefix.at(-1))}`
          }`,
        );
      }
    }

    expect(failures).toEqual([]);
    // Every input class was exercised.
    expect(missingCases).toBeGreaterThan(0);
    expect(placeholderCases).toBeGreaterThan(0);
    expect(emptyCases).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});

import { describe, expect, it } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";

import { DIALOGUE_GRAPH_IDS, SPEAKER_IDS, TONE_IDS } from "../narrative/chapter1/ids";
import { caseSeed, CORE_PROPERTY_RUNS } from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { fnv1a32 } from "./hash";
import {
  VOICE_MANIFEST_SCHEMA_VERSION,
  type ClipStatus,
  type VoiceClipEntry,
  type VoiceManifest,
} from "./manifestTypes";
import { MANIFEST_HEADER, parseManifestSource, renderManifest } from "./renderManifest";

const PROPERTY_TIMEOUT_MS = 60_000;
const MANIFEST_SEED = 0x20a0c1e5;

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const STATUSES: readonly ClipStatus[] = ["present", "missing", "placeholder-tts"];
const ORIGINS: readonly VoiceClipEntry["origin"][] = ["tts-generated", "human-recorded", "none"];

// Text pieces that stress the literal: quotes, backslashes, newlines, separators, template and
// comment markers, semicolons, braces and non-ASCII text.
const TEXT_PIECES: readonly string[] = [
  "plain",
  'quote " here',
  "single ' here",
  "back\\slash",
  "line\nbreak",
  "tab\tstop",
  "semi; colon;",
  "export const x = 1;",
  "{ } [ ]",
  "${not.a.template}",
  "`tick`",
  "// not a comment",
  "/* nor this */",
  "\u2028\u2029",
  "Xin chào, đây là một dòng tiếng Việt.",
  "caf\u00e9 \u00fc\u00f1",
  "",
];

function randomText(next: () => number): string {
  const parts = randomInt(next, 0, 3);
  let text = "";
  for (let i = 0; i < parts; i += 1) text += pick(next, TEXT_PIECES);
  return text;
}

function randomEntry(next: () => number, clipId: string, locale: GameLocale): VoiceClipEntry {
  const status = pick(next, STATUSES);
  const sources: VoiceClipEntry["sources"] =
    status === "missing"
      ? []
      : Array.from({ length: randomInt(next, 1, 2) }, () => ({
          src: `/audio/chapter01/${locale}/${clipId}-${randomInt(next, 0, 99)}.mp3`,
          type: "audio/mpeg" as const,
        }));
  const entry: VoiceClipEntry = {
    clipId,
    nodeId: clipId,
    graphId: pick(next, DIALOGUE_GRAPH_IDS),
    speakerId: pick(next, SPEAKER_IDS),
    locale,
    status,
    sources,
    tone: pick(next, TONE_IDS),
    voiceNote: randomText(next),
    origin: pick(next, ORIGINS),
    credit: randomText(next),
    sourceTextHash: fnv1a32(randomText(next)),
  };
  // Optional fields are present on some entries and absent on others.
  if (next() < 0.5) entry.durationMs = randomInt(next, 0, 600_000);
  if (next() < 0.5) entry.bytes = randomInt(next, 0, 5_000_000);
  return entry;
}

function randomManifest(next: () => number): VoiceManifest {
  const nodeCount = randomInt(next, 0, 8);
  const clips: VoiceClipEntry[] = [];
  for (let n = 0; n < nodeCount; n += 1) {
    const clipId = `${pick(next, ["scam", "cb", "shop", "official", "fu"])}.${randomText(next)}${n}`;
    for (const locale of LOCALES) {
      if (next() < 0.8) clips.push(randomEntry(next, clipId, locale));
    }
  }
  return { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips };
}

function shuffled<T>(next: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(next, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** The documented order: by clipId, then locale, by code point. */
function sortedClips(clips: ReadonlyArray<VoiceClipEntry>): VoiceClipEntry[] {
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return [...clips].sort((a, b) => cmp(a.clipId, b.clipId) || cmp(a.locale, b.locale));
}

describe("renderManifest properties", () => {
  // Feature: chapter-01-voice-narrative, Property 20: Manifest source round trip
  // **Validates: Requirements 4.1, 4.2**
  it(
    "Property 20: parsing the rendered source gives back an equal manifest and rendering is deterministic",
    () => {
      let nonEmptyCases = 0;
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(MANIFEST_SEED, index);
        const next = createLcg(seed);
        const manifest = randomManifest(next);
        const context = `seed ${seed} (case ${index}, ${manifest.clips.length} clips)`;
        if (manifest.clips.length > 0) nonEmptyCases += 1;

        const source = renderManifest(manifest);
        const expected: VoiceManifest = { ...manifest, clips: sortedClips(manifest.clips) };

        // Round trip: parse(render(m)) equals m (clips in the documented order).
        expect(parseManifestSource(source), context).toEqual(expected);

        // Deterministic text: same value twice, and a differently ordered input.
        expect(renderManifest(manifest), context).toBe(source);
        const reordered: VoiceManifest = { ...manifest, clips: shuffled(next, manifest.clips) };
        expect(renderManifest(reordered), context).toBe(source);

        // Re-rendering the parsed value is a fixed point.
        expect(renderManifest(parseManifestSource(source)), context).toBe(source);

        // Source shape: header first, LF line ends only, trailing newline.
        expect(source.startsWith(`${MANIFEST_HEADER}\n`), context).toBe(true);
        expect(source.includes("\r"), context).toBe(false);
        expect(source.endsWith("\n"), context).toBe(true);

        // Order in the text: clip entries appear sorted by clipId, then locale.
        const parsed = parseManifestSource(source);
        const keys = parsed.clips.map((clip) => `${clip.clipId}\u0000${clip.locale}`);
        expect(keys, context).toEqual([...keys].sort());
      }
      expect(nonEmptyCases).toBeGreaterThan(CORE_PROPERTY_RUNS / 2);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

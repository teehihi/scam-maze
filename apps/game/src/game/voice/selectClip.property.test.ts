import type { GameLocale } from "@scammaze/shared-types";
import { describe, expect, it } from "vitest";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { DIALOGUE_GRAPH_IDS, SPEAKER_IDS, TONE_IDS } from "../narrative/chapter1/ids";
import type { DialogueGraphId } from "../narrative/chapter1/ids";
import type { ClipStatus, VoiceClipEntry, VoiceManifest } from "./manifestTypes";
import { VOICE_MANIFEST_SCHEMA_VERSION } from "./manifestTypes";
import { selectClip } from "./selectClip";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const STATUSES: readonly ClipStatus[] = ["present", "missing", "placeholder-tts"];
/** A small node pool so that generated manifests collide on nodes, locales and graphs. */
const NODE_IDS = ["n.a", "n.b", "n.c", "n.d"] as const;
const SRC_PATTERN = /^\/audio\/chapter01\/(en|vi)\/[^/]+\.mp3$/;

/** Base seed for this file, derived from the shared core seed. */
const FILE_SEED = (CORE_PROPERTY_SEED ^ 0x5e1ec7c1) >>> 0;

function makeEntry(
  next: () => number,
  graphId: DialogueGraphId,
  nodeId: string,
  locale: GameLocale,
  status: ClipStatus,
): VoiceClipEntry {
  const hasSource = status === "present" ? next() < 0.9 : next() < 0.3;
  return {
    clipId: nodeId,
    nodeId,
    graphId,
    speakerId: pick(next, SPEAKER_IDS),
    locale,
    status,
    sources: hasSource ? [{ src: `${CHAPTER1_VOICE_BASE}/${locale}/${nodeId}.mp3`, type: "audio/mpeg" }] : [],
    tone: pick(next, TONE_IDS),
    voiceNote: "test",
    origin: status === "present" ? "tts-generated" : "none",
    credit: "test",
    sourceTextHash: "00000000",
  };
}

function makeManifest(next: () => number): VoiceManifest {
  const clips: VoiceClipEntry[] = [];
  const count = randomInt(next, 0, 24);
  for (let i = 0; i < count; i += 1) {
    clips.push(
      makeEntry(
        next,
        pick(next, DIALOGUE_GRAPH_IDS),
        pick(next, NODE_IDS),
        pick(next, LOCALES),
        pick(next, STATUSES),
      ),
    );
  }
  return { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips };
}

/** Independent reference: is there a usable present entry for this key? */
function hasUsable(manifest: VoiceManifest, graphId: string, nodeId: string, locale: GameLocale): boolean {
  return manifest.clips.some(
    (c) =>
      c.status === "present" &&
      c.sources.length > 0 &&
      c.graphId === graphId &&
      c.nodeId === nodeId &&
      c.locale === locale,
  );
}

describe("clip selection properties", () => {
  // Feature: chapter-01-voice-narrative, Property 9: Clip selection respects availability and labels
  it(
    "returns only present clips of the requested locale, or an English clip carrying the english-voice label",
    () => {
      for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
        const seed = caseSeed(FILE_SEED, run);
        const next = createLcg(seed);
        const manifest = makeManifest(next);
        const graphId = pick(next, DIALOGUE_GRAPH_IDS);
        const nodeId = pick(next, NODE_IDS);
        const locale = pick(next, LOCALES);
        const fallback = next() < 0.5;
        const context = `seed=${seed} case=${run} graph=${graphId} node=${nodeId} locale=${locale} fallback=${fallback} manifest=${JSON.stringify(
          manifest.clips.map((c) => [c.graphId, c.nodeId, c.locale, c.status, c.sources.length]),
        )}`;

        const choice = selectClip(manifest, graphId, nodeId, locale, fallback);

        if (choice.kind === "none") {
          const ownUsable = hasUsable(manifest, graphId, nodeId, locale);
          const englishUsable = locale !== "en" && fallback && hasUsable(manifest, graphId, nodeId, "en");
          expect(ownUsable || englishUsable, `no clip returned although one was usable: ${context}`).toBe(false);
          continue;
        }

        const { entry, label } = choice;
        expect(entry.status, `status: ${context}`).toBe("present");
        expect(entry.nodeId, `node: ${context}`).toBe(nodeId);
        expect(entry.graphId, `graph: ${context}`).toBe(graphId);
        expect(entry.sources.length, `sources: ${context}`).toBeGreaterThan(0);
        for (const source of entry.sources) {
          expect(source.src, `src: ${context}`).toMatch(SRC_PATTERN);
          expect(source.src, `src: ${context}`).toBe(`${CHAPTER1_VOICE_BASE}/${entry.locale}/${nodeId}.mp3`);
        }

        if (entry.locale === locale) {
          expect(label, `own-locale label: ${context}`).toBe("none");
        } else {
          // Only English audio, only for a non-English locale, only labelled, only with the setting on.
          expect(entry.locale, `fallback locale: ${context}`).toBe("en");
          expect(locale, `fallback for en: ${context}`).not.toBe("en");
          expect(label, `unlabelled English audio: ${context}`).toBe("english-voice");
          expect(fallback, `fallback while setting off: ${context}`).toBe(true);
          expect(hasUsable(manifest, graphId, nodeId, locale), `own clip was usable: ${context}`).toBe(false);
        }

        // English audio never reaches a non-English locale without the explicit label.
        if (locale !== "en" && entry.locale === "en") {
          expect(label, `English audio without label: ${context}`).toBe("english-voice");
        }
        if (label === "english-voice") {
          expect(entry.locale, `label on non-English audio: ${context}`).toBe("en");
        }
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});

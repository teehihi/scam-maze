// Property test for the Chapter 1 content validator (V5, V6, V7) with injected faults.
// The real generated manifest does not exist yet, so a valid scenario, overlay and manifest are
// built here from the real scenario and overlay, and one fault is injected per case.

import { describe, expect, it } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import { CHAPTER_1_NARRATIVE_VI } from "../../i18n/narrative/chapter1.vi";
import { caseSeed, CORE_PROPERTY_RUNS } from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import type { ScenarioDefinition } from "../narrative/types";
import { buildVoiceJobs, isSpokenNode, overlayLineKey } from "../voice/buildVoiceJobs";
import { fnv1a32 } from "../voice/hash";
import type { VoiceClipEntry, VoiceManifest } from "../voice/manifestTypes";
import {
  MAX_CLIP_BYTES,
  validateChapterContent,
  type ClipFileInfo,
  type ContentCheckId,
} from "./validateChapterContent";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const FAULTS_SEED = 0x2b0c0a11;

type MutableClip = { -readonly [K in keyof VoiceClipEntry]: VoiceClipEntry[K] };

interface Inputs {
  scenario: ScenarioDefinition;
  overlay: Record<string, string>;
  manifest: { schemaVersion: number; chapterId: "chapter-1"; clips: MutableClip[] };
  files: Map<string, ClipFileInfo>;
}

interface Target {
  nodeId: string;
  graphId: string;
  lineId: string;
  locale: GameLocale;
  clip: MutableClip;
}

interface Fault {
  name: string;
  check: ContentCheckId;
  /** Which clips can be the target. */
  needs: "any" | "present" | "missing" | "en" | "vi" | "presentVi";
  /** Injects the fault. Returns the text that the issue must name. */
  inject(inputs: Inputs, target: Target, next: () => number): string;
}

/** Builds a valid, fully consistent set of inputs. Mixes present and missing clips. */
function buildValidInputs(next: () => number): Inputs {
  const scenario = structuredClone(CHAPTER_1_SCENARIO);
  const overlay: Record<string, string> = { ...CHAPTER_1_NARRATIVE_VI };
  const jobs = buildVoiceJobs(scenario, { vi: overlay });
  const offset = randomInt(next, 0, 3);
  const files = new Map<string, ClipFileInfo>();
  const clips: MutableClip[] = jobs.map((job, index) => {
    const base = {
      clipId: job.clipId,
      nodeId: job.clipId,
      graphId: job.graphId,
      speakerId: job.speakerId,
      locale: job.locale,
      tone: job.tone,
      voiceNote: "test",
      sourceTextHash: job.textHash,
    };
    if ((index + offset) % 4 === 3) {
      return { ...base, status: "missing", sources: [], origin: "none", credit: "not provided" };
    }
    const src = `${CHAPTER1_VOICE_BASE}/${job.locale}/${job.clipId}.mp3`;
    const bytes = randomInt(next, 1000, MAX_CLIP_BYTES - 1000);
    const durationMs = randomInt(next, 600, 24_000);
    files.set(src, { exists: true, bytes, mime: "audio/mpeg", durationMs });
    return {
      ...base,
      status: "present",
      sources: [{ src, type: "audio/mpeg" }],
      durationMs,
      bytes,
      origin: "tts-generated",
      credit: "test",
    };
  });
  return { scenario, overlay, manifest: { schemaVersion: 1, chapterId: "chapter-1", clips }, files };
}

function run(inputs: Inputs) {
  return validateChapterContent({
    scenario: inputs.scenario,
    overlays: { vi: inputs.overlay },
    manifest: inputs.manifest as unknown as VoiceManifest,
    fileInfo: (path) => inputs.files.get(path),
  });
}

function sourceOf(target: Target): string {
  return target.clip.sources[0].src;
}

function graphOf(inputs: Inputs, target: Target) {
  return inputs.scenario.dialogues[target.graphId as keyof typeof inputs.scenario.dialogues];
}

function fileOf(inputs: Inputs, target: Target): ClipFileInfo {
  const info = inputs.files.get(sourceOf(target));
  if (info === undefined) throw new Error(`No file info for ${sourceOf(target)}`);
  return info;
}

const FAULTS: readonly Fault[] = [
  // V5: subtitles
  {
    name: "remove the English line",
    check: "V5",
    needs: "en",
    inject(inputs, target) {
      delete (graphOf(inputs, target).lines as Record<string, string>)[target.lineId];
      return target.nodeId;
    },
  },
  {
    name: "blank the English line",
    check: "V5",
    needs: "en",
    inject(inputs, target) {
      (graphOf(inputs, target).lines as Record<string, string>)[target.lineId] = "   ";
      return target.nodeId;
    },
  },
  {
    name: "remove the Vietnamese overlay text",
    check: "V5",
    needs: "vi",
    inject(inputs, target) {
      delete inputs.overlay[overlayLineKey(target.graphId, target.lineId)];
      return target.nodeId;
    },
  },
  {
    name: "blank the Vietnamese overlay text",
    check: "V5",
    needs: "vi",
    inject(inputs, target) {
      inputs.overlay[overlayLineKey(target.graphId, target.lineId)] = "";
      return target.nodeId;
    },
  },
  // V6: manifest
  {
    name: "unsupported schemaVersion",
    check: "V6",
    needs: "any",
    inject(inputs) {
      inputs.manifest.schemaVersion = 2;
      return "schemaVersion";
    },
  },
  {
    name: "drop a manifest entry",
    check: "V6",
    needs: "any",
    inject(inputs, target) {
      inputs.manifest.clips.splice(inputs.manifest.clips.indexOf(target.clip), 1);
      return target.nodeId;
    },
  },
  {
    name: "add an extra manifest entry",
    check: "V6",
    needs: "any",
    inject(inputs, target) {
      inputs.manifest.clips.push({
        ...target.clip,
        clipId: "n.ghost.extra",
        nodeId: "n.ghost.extra",
        status: "missing",
        sources: [],
        durationMs: undefined,
        bytes: undefined,
        origin: "none",
      });
      return "n.ghost.extra";
    },
  },
  {
    name: "duplicate a manifest entry",
    check: "V6",
    needs: "any",
    inject(inputs, target) {
      inputs.manifest.clips.push({ ...target.clip });
      return target.nodeId;
    },
  },
  {
    name: "clipId differs from nodeId",
    check: "V6",
    needs: "any",
    inject(_inputs, target) {
      target.clip.clipId = `${target.nodeId}.other`;
      return target.nodeId;
    },
  },
  {
    name: "wrong speakerId",
    check: "V6",
    needs: "any",
    inject(_inputs, target) {
      target.clip.speakerId =
        target.clip.speakerId === "spk.sam" ? "spk.alex" : "spk.sam";
      return target.nodeId;
    },
  },
  {
    name: "wrong graphId",
    check: "V6",
    needs: "any",
    inject(_inputs, target) {
      target.clip.graphId =
        target.clip.graphId === "dlg.shopkeeper" ? "dlg.scam-call" : "dlg.shopkeeper";
      return target.nodeId;
    },
  },
  {
    name: "stale sourceTextHash",
    check: "V6",
    needs: "present",
    inject(_inputs, target, next) {
      target.clip.sourceTextHash = fnv1a32(`stale ${randomInt(next, 0, 1_000_000)}`);
      return target.nodeId;
    },
  },
  {
    name: "Vietnamese text changed after the clip was made",
    check: "V6",
    needs: "presentVi",
    inject(inputs, target) {
      // Only a present clip carries a hash that can go stale.
      const key = overlayLineKey(target.graphId, target.lineId);
      inputs.overlay[key] = `${inputs.overlay[key]} (edited)`;
      return target.nodeId;
    },
  },
  {
    name: "unknown status",
    check: "V6",
    needs: "any",
    inject(_inputs, target) {
      (target.clip as { status: string }).status = "ready";
      return target.nodeId;
    },
  },
  {
    name: "present entry without sources",
    check: "V6",
    needs: "present",
    inject(_inputs, target) {
      target.clip.sources = [];
      return target.nodeId;
    },
  },
  {
    name: "present entry without duration",
    check: "V6",
    needs: "present",
    inject(_inputs, target) {
      delete target.clip.durationMs;
      return target.nodeId;
    },
  },
  {
    name: "present entry without bytes",
    check: "V6",
    needs: "present",
    inject(_inputs, target) {
      delete target.clip.bytes;
      return target.nodeId;
    },
  },
  {
    name: "missing entry with sources",
    check: "V6",
    needs: "missing",
    inject(_inputs, target) {
      target.clip.sources = [
        { src: `${CHAPTER1_VOICE_BASE}/${target.locale}/${target.nodeId}.mp3`, type: "audio/mpeg" },
      ];
      return target.nodeId;
    },
  },
  {
    name: "missing entry with duration",
    check: "V6",
    needs: "missing",
    inject(_inputs, target) {
      target.clip.durationMs = 1000;
      return target.nodeId;
    },
  },
  {
    name: "missing entry with bytes",
    check: "V6",
    needs: "missing",
    inject(_inputs, target) {
      target.clip.bytes = 1000;
      return target.nodeId;
    },
  },
  // V7: files
  {
    name: "present entry whose file is missing",
    check: "V7",
    needs: "present",
    inject(inputs, target) {
      inputs.files.delete(sourceOf(target));
      return target.nodeId;
    },
  },
  {
    name: "file reported as not existing",
    check: "V7",
    needs: "present",
    inject(inputs, target) {
      fileOf(inputs, target).exists = false;
      return target.nodeId;
    },
  },
  {
    name: "source outside the locale folder",
    check: "V7",
    needs: "present",
    inject(inputs, target) {
      const src = `${CHAPTER1_VOICE_BASE}/${target.locale === "en" ? "vi" : "en"}/${target.nodeId}.mp3`;
      inputs.files.set(src, fileOf(inputs, target));
      target.clip.sources = [{ src, type: "audio/mpeg" }];
      return target.nodeId;
    },
  },
  {
    name: "source with a parent path segment",
    check: "V7",
    needs: "present",
    inject(inputs, target) {
      const src = `${CHAPTER1_VOICE_BASE}/${target.locale}/../${target.locale}/${target.nodeId}.mp3`;
      inputs.files.set(src, fileOf(inputs, target));
      target.clip.sources = [{ src, type: "audio/mpeg" }];
      return target.nodeId;
    },
  },
  {
    name: "source declares a wrong type",
    check: "V7",
    needs: "present",
    inject(_inputs, target) {
      target.clip.sources = [
        { src: sourceOf(target), type: "audio/wav" as unknown as "audio/mpeg" },
      ];
      return target.nodeId;
    },
  },
  {
    name: "file has a wrong MIME type",
    check: "V7",
    needs: "present",
    inject(inputs, target) {
      fileOf(inputs, target).mime = "audio/wav";
      return target.nodeId;
    },
  },
  {
    name: "manifest bytes differ from the file size",
    check: "V7",
    needs: "present",
    inject(inputs, target, next) {
      fileOf(inputs, target).bytes += randomInt(next, 1, 500);
      return target.nodeId;
    },
  },
  {
    name: "clip larger than 150 KB",
    check: "V7",
    needs: "present",
    inject(inputs, target, next) {
      const bytes = MAX_CLIP_BYTES + randomInt(next, 1, 100_000);
      fileOf(inputs, target).bytes = bytes;
      target.clip.bytes = bytes;
      return target.nodeId;
    },
  },
  {
    name: "empty file",
    check: "V7",
    needs: "present",
    inject(inputs, target) {
      fileOf(inputs, target).bytes = 0;
      target.clip.bytes = 0;
      return target.nodeId;
    },
  },
  {
    name: "file duration too short",
    check: "V7",
    needs: "present",
    inject(inputs, target, next) {
      fileOf(inputs, target).durationMs = randomInt(next, 0, 499);
      return target.nodeId;
    },
  },
  {
    name: "file duration too long",
    check: "V7",
    needs: "present",
    inject(inputs, target, next) {
      fileOf(inputs, target).durationMs = randomInt(next, 25_001, 90_000);
      return target.nodeId;
    },
  },
  {
    name: "manifest duration out of range",
    check: "V7",
    needs: "present",
    inject(_inputs, target, next) {
      target.clip.durationMs = pick(next, [randomInt(next, 0, 499), randomInt(next, 25_001, 90_000)]);
      return target.nodeId;
    },
  },
];

function candidates(inputs: Inputs, fault: Fault): Target[] {
  const spoken = new Map<string, { graphId: string; lineId: string }>();
  for (const graph of Object.values(inputs.scenario.dialogues)) {
    for (const node of Object.values(graph.nodes)) {
      if (isSpokenNode(node)) spoken.set(node.id, { graphId: graph.id, lineId: node.lineId });
    }
  }
  const result: Target[] = [];
  for (const clip of inputs.manifest.clips) {
    const info = spoken.get(clip.nodeId);
    if (info === undefined) continue;
    if (fault.needs === "present" && clip.status !== "present") continue;
    if (fault.needs === "missing" && clip.status !== "missing") continue;
    if (fault.needs === "en" && clip.locale !== "en") continue;
    if (fault.needs === "vi" && clip.locale !== "vi") continue;
    if (fault.needs === "presentVi" && (clip.locale !== "vi" || clip.status !== "present")) continue;
    result.push({ nodeId: clip.nodeId, locale: clip.locale, clip, ...info });
  }
  return result;
}

describe("validateChapterContent fault injection", () => {
  // Feature: chapter-01-voice-narrative, Property 2: The content validator detects injected faults
  // **Validates: Requirements 4.2, 4.6, 9.2, 11.7, 13.1**
  it(
    "reports each injected fault with the right check code, naming the mutated item",
    () => {
      expect(CORE_PROPERTY_RUNS).toBeGreaterThanOrEqual(100);
      const usedFaults = new Set<string>();
      const failures: string[] = [];

      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(FAULTS_SEED, index);
        const next = createLcg(seed);
        const label = `seed ${seed} (case ${index})`;

        // The unmutated inputs return no issue.
        const baseline = run(buildValidInputs(createLcg(seed)));
        if (baseline.length > 0) {
          failures.push(`${label}: valid inputs reported ${JSON.stringify(baseline.slice(0, 3))}`);
          continue;
        }

        // Cycle through the catalogue so every fault is used, then vary the target.
        const fault = FAULTS[index % FAULTS.length];
        const inputs = buildValidInputs(next);
        const options = candidates(inputs, fault);
        if (options.length === 0) {
          failures.push(`${label}: no target for fault "${fault.name}"`);
          continue;
        }
        const target = pick(next, options);
        const needle = fault.inject(inputs, target, next);
        usedFaults.add(fault.name);

        const issues = run(inputs);
        const named = issues.filter(
          (issue) => issue.check === fault.check && `${issue.where} ${issue.message}`.includes(needle),
        );
        if (named.length === 0) {
          failures.push(
            `${label}: fault "${fault.name}" on ${target.nodeId} (${target.locale}) expected ${fault.check} naming "${needle}"; got ${JSON.stringify(issues.slice(0, 4))}`,
          );
        }
      }

      expect(failures).toEqual([]);
      expect([...usedFaults].sort()).toEqual(FAULTS.map((fault) => fault.name).sort());
    },
    PROPERTY_TIMEOUT_MS,
  );
});

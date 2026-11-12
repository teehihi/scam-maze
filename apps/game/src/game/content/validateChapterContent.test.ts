// Example tests for the Chapter 1 content validator (V5, V6, V7) on the real scenario, the real
// Vietnamese overlay and the committed generated voice manifest. `fileInfo` reads the real files
// under `apps/game/public` with node:fs.

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CHAPTER_1_NARRATIVE_VI } from "../../i18n/narrative/chapter1.vi";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import { overlayLineKey } from "../voice/buildVoiceJobs";
import { chapter1VoiceManifest } from "../voice/chapter1.manifest";
import type { VoiceManifest } from "../voice/manifestTypes";
import {
  CLIP_MIME,
  validateChapterContent,
  type ClipFileInfo,
  type FileInfoLookup,
} from "./validateChapterContent";

const PUBLIC_DIR = path.resolve(__dirname, "../../../public");

/** MIME type from the extension and the MP3 header (ID3 tag or MPEG frame sync). */
function detectMime(file: string, buffer: Buffer): string {
  if (path.extname(file).toLowerCase() !== ".mp3") return "application/octet-stream";
  const hasId3 = buffer.length >= 3 && buffer.toString("latin1", 0, 3) === "ID3";
  const hasSync = buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return hasId3 || hasSync ? CLIP_MIME : "application/octet-stream";
}

const realFileInfo: FileInfoLookup = (publicPath): ClipFileInfo | undefined => {
  const file = path.join(PUBLIC_DIR, ...publicPath.split("/").filter((part) => part.length > 0));
  if (!existsSync(file) || !statSync(file).isFile()) return { exists: false, bytes: 0, mime: "" };
  const buffer = readFileSync(file);
  return { exists: true, bytes: buffer.length, mime: detectMime(file, buffer) };
};

const overlays = { vi: CHAPTER_1_NARRATIVE_VI };

function run(
  options: {
    scenario?: typeof CHAPTER_1_SCENARIO;
    overlay?: Record<string, string>;
    manifest?: VoiceManifest;
    fileInfo?: FileInfoLookup;
  } = {},
) {
  return validateChapterContent({
    scenario: options.scenario ?? CHAPTER_1_SCENARIO,
    overlays: { vi: options.overlay ?? CHAPTER_1_NARRATIVE_VI },
    manifest: options.manifest ?? chapter1VoiceManifest,
    fileInfo: options.fileInfo ?? realFileInfo,
  });
}

function firstPresent() {
  const clip = chapter1VoiceManifest.clips.find((entry) => entry.status === "present");
  if (clip === undefined) throw new Error("No present clip in the manifest.");
  return clip;
}

describe("validateChapterContent on the real Chapter 1 content", () => {
  it("has 108 present clips in the committed manifest", () => {
    const present = chapter1VoiceManifest.clips.filter((entry) => entry.status === "present");
    expect(present).toHaveLength(108);
  });

  it("reports no issue for the real scenario, overlay, manifest and files", () => {
    expect(run()).toEqual([]);
  });

  it("reads real files: the MIME and size match for a present clip", () => {
    const clip = firstPresent();
    const info = realFileInfo(clip.sources[0].src);
    expect(info?.exists).toBe(true);
    expect(info?.mime).toBe(CLIP_MIME);
    expect(info?.bytes).toBe(clip.bytes);
  });

  it("without fileInfo, still checks V5 and V6 and reports nothing", () => {
    expect(
      validateChapterContent({
        scenario: CHAPTER_1_SCENARIO,
        overlays,
        manifest: chapter1VoiceManifest,
      }),
    ).toEqual([]);
  });
});

describe("validateChapterContent broken fixtures", () => {
  it("V5: reports a Vietnamese overlay text that is removed", () => {
    const clip = chapter1VoiceManifest.clips.find((entry) => entry.locale === "vi");
    if (clip === undefined) throw new Error("No vi clip in the manifest.");
    const overlay = { ...CHAPTER_1_NARRATIVE_VI };
    delete overlay[overlayLineKey(clip.graphId, lineIdOf(clip.nodeId))];
    const issues = run({ overlay });
    expect(issues.some((issue) => issue.check === "V5" && issue.where.includes(clip.nodeId))).toBe(true);
  });

  it("V6: reports a manifest that lacks an entry", () => {
    const dropped = chapter1VoiceManifest.clips[0];
    const manifest = { ...chapter1VoiceManifest, clips: chapter1VoiceManifest.clips.slice(1) };
    const issues = run({ manifest });
    expect(issues.some((issue) => issue.check === "V6" && issue.where.includes(dropped.nodeId))).toBe(true);
  });

  it("V6: reports a stale sourceTextHash", () => {
    const target = firstPresent();
    const manifest = {
      ...chapter1VoiceManifest,
      clips: chapter1VoiceManifest.clips.map((entry) =>
        entry === target ? { ...entry, sourceTextHash: "00000000" } : entry,
      ),
    };
    const issues = run({ manifest });
    expect(issues.some((issue) => issue.check === "V6" && issue.where.includes(target.nodeId))).toBe(true);
  });

  it("V7: reports a present clip whose file is missing", () => {
    const target = firstPresent();
    const fileInfo: FileInfoLookup = (publicPath) =>
      publicPath === target.sources[0].src ? undefined : realFileInfo(publicPath);
    const issues = run({ fileInfo });
    expect(issues.some((issue) => issue.check === "V7" && issue.where.includes(target.nodeId))).toBe(true);
  });

  it("V7: reports a wrong MIME type and a size that differs from the manifest", () => {
    const target = firstPresent();
    const fileInfo: FileInfoLookup = (publicPath) => {
      const info = realFileInfo(publicPath);
      if (info === undefined || publicPath !== target.sources[0].src) return info;
      return { ...info, mime: "audio/wav", bytes: info.bytes + 1 };
    };
    const issues = run({ fileInfo }).filter(
      (issue) => issue.check === "V7" && issue.where.includes(target.nodeId),
    );
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

/** The line id of a Spoken_Node, read from the real scenario. */
function lineIdOf(nodeId: string): string {
  for (const graph of Object.values(CHAPTER_1_SCENARIO.dialogues)) {
    const node = graph.nodes[nodeId as keyof typeof graph.nodes] as { lineId?: string } | undefined;
    if (node?.lineId !== undefined) return node.lineId;
  }
  throw new Error(`No line for node ${nodeId}`);
}

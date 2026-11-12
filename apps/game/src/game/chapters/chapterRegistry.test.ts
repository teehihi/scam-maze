import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAPTERS, DEFAULT_CHAPTER_ID, getChapter } from "./chapterRegistry";
import { verifyAsset } from "../loading/assetVerification";

const PUBLIC_DIR = resolve(import.meta.dirname, "../../../public");

describe("chapter registry", () => {
  it("contains the default chapter", () => {
    expect(getChapter(DEFAULT_CHAPTER_ID)).toBeDefined();
    expect(getChapter("does-not-exist")).toBeUndefined();
  });

  it("marks Chapter 1 as playable", () => {
    expect(getChapter(DEFAULT_CHAPTER_ID)?.gameplayAvailable).toBe(true);
  });

  it.each(CHAPTERS.map((chapter) => [chapter.id, chapter] as const))("%s starts in one of its own scenes", (_id, chapter) => {
    expect(chapter.sceneIds).toContain(chapter.startSceneId);
    expect(new Set(chapter.assets.map((asset) => asset.id)).size).toBe(chapter.assets.length);
  });

  it.each(CHAPTERS.flatMap((chapter) => chapter.assets.map((asset) => [asset.url, asset] as const)))(
    "%s exists in public/ and passes verification",
    (url, asset) => {
      const file = readFileSync(resolve(PUBLIC_DIR, `.${url}`));
      const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
      expect(verifyAsset(asset.kind, buffer)).toEqual({ ok: true });
    },
  );
});

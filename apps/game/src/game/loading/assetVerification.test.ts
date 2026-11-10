import { describe, expect, it } from "vitest";
import { verifyGlb, verifyImage } from "./assetVerification";
import { makeGlb, makePng } from "../../test/fakeAssets";

describe("verifyGlb", () => {
  it("accepts a valid GLB with supported required extensions", () => {
    const glb = makeGlb({
      asset: { version: "2.0" },
      extensionsRequired: ["EXT_meshopt_compression", "EXT_texture_webp", "KHR_mesh_quantization"],
    });
    expect(verifyGlb(glb.buffer)).toEqual({ ok: true });
  });

  it("rejects HTML served instead of a GLB", () => {
    const html = new TextEncoder().encode("<!doctype html><html><body></body></html>");
    expect(verifyGlb(html.buffer).ok).toBe(false);
  });

  it("rejects a truncated download", () => {
    const glb = makeGlb(undefined, 64);
    const result = verifyGlb(glb.slice(0, glb.byteLength - 10).buffer);
    expect(result.ok).toBe(false);
  });

  it("rejects unsupported required extensions", () => {
    const glb = makeGlb({ asset: { version: "2.0" }, extensionsRequired: ["KHR_texture_basisu"] });
    const result = verifyGlb(glb.buffer);
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.reason).toContain("KHR_texture_basisu");
  });

  it("rejects glTF 1.0", () => {
    expect(verifyGlb(makeGlb({ asset: { version: "1.0" } }).buffer).ok).toBe(false);
  });
});

describe("verifyImage", () => {
  it("accepts PNG, JPEG and WebP signatures", () => {
    expect(verifyImage(makePng().buffer).ok).toBe(true);
    expect(verifyImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]).buffer).ok).toBe(true);
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(verifyImage(webp.buffer).ok).toBe(true);
  });

  it("rejects other content", () => {
    expect(verifyImage(new TextEncoder().encode("<html>").buffer).ok).toBe(false);
  });
});

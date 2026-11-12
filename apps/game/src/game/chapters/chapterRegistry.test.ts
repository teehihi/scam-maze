import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAPTERS, DEFAULT_CHAPTER_ID, getChapter } from "./chapterRegistry";
import { verifyAsset } from "../loading/assetVerification";
import { CALL_PHONE_GLB } from "../../config/assetPaths";
import { SCREEN_HEIGHT_M, SCREEN_WIDTH_M } from "../../features/chapter1/call/callLayout";

const PUBLIC_DIR = resolve(import.meta.dirname, "../../../public");

/** Maximum Phone_Model file size (Req 9.2, 13.6): 5 MB. */
const MAX_PHONE_MODEL_BYTES = 5_242_880;
/** Allowed difference between the OLED bounds and the screen constants: 0.5 mm. */
const SCREEN_TOLERANCE_M = 0.0005;
/** Real brand and product names of the source candidates (lowercase), used only as detection data. */
const REAL_BRAND_AND_PRODUCT_NAMES = ["apple", "iphone", "phone-17", "phone 17", "17-pro", "17 pro", "pro-max", "pro max"];

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

interface GltfJson {
  nodes?: { name?: string; mesh?: number; translation?: Vec3; rotation?: Quat; scale?: Vec3 }[];
  meshes?: { name?: string; primitives: { material?: number; attributes: Record<string, number> }[] }[];
  materials?: { name?: string }[];
  images?: { name?: string }[];
  accessors?: { componentType: number; normalized?: boolean; min?: number[]; max?: number[] }[];
}

function readPublicFile(url: string): Buffer {
  return readFileSync(resolve(PUBLIC_DIR, `.${url}`));
}

/** Reads the JSON chunk of a binary glTF file. */
function readGlbJson(file: Buffer): GltfJson {
  const jsonLength = file.readUInt32LE(12);
  return JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8")) as GltfJson;
}

/** Converts a stored accessor bound to a float, following the glTF rules for normalized integers. */
function decodeComponent(value: number, componentType: number, normalized: boolean): number {
  if (!normalized) return value;
  switch (componentType) {
    case 5120:
      return Math.max(value / 127, -1);
    case 5121:
      return value / 255;
    case 5122:
      return Math.max(value / 32767, -1);
    case 5123:
      return value / 65535;
    default:
      return value;
  }
}

function rotate([x, y, z]: Vec3, [qx, qy, qz, qw]: Quat): Vec3 {
  // v' = v + 2w(q × v) + 2 q × (q × v)
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
}

/** Size of the axis-aligned box of the OLED primitive after the node transform (scale, rotation, translation). */
function oledWorldSize(gltf: GltfJson): Vec3 {
  for (const node of gltf.nodes ?? []) {
    if (node.mesh === undefined) continue;
    for (const primitive of gltf.meshes?.[node.mesh]?.primitives ?? []) {
      if (primitive.material === undefined || gltf.materials?.[primitive.material]?.name !== "OLED") continue;
      const accessor = gltf.accessors?.[primitive.attributes.POSITION];
      if (!accessor?.min || !accessor.max) throw new Error("OLED POSITION accessor has no min/max");
      const decode = (bound: number[]) =>
        bound.map((value) => decodeComponent(value, accessor.componentType, accessor.normalized === true)) as Vec3;
      const min = decode(accessor.min);
      const max = decode(accessor.max);
      const scale = node.scale ?? [1, 1, 1];
      const rotation = node.rotation ?? [0, 0, 0, 1];
      const translation = node.translation ?? [0, 0, 0];
      const lo: Vec3 = [Infinity, Infinity, Infinity];
      const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (let corner = 0; corner < 8; corner += 1) {
        const local: Vec3 = [
          (corner & 1 ? max[0] : min[0]) * scale[0],
          (corner & 2 ? max[1] : min[1]) * scale[1],
          (corner & 4 ? max[2] : min[2]) * scale[2],
        ];
        const world = rotate(local, rotation).map((value, axis) => value + translation[axis]) as Vec3;
        for (let axis = 0; axis < 3; axis += 1) {
          lo[axis] = Math.min(lo[axis], world[axis]);
          hi[axis] = Math.max(hi[axis], world[axis]);
        }
      }
      return [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    }
  }
  throw new Error("No OLED primitive found");
}

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

  describe("call phone model (Req 9.2, 9.3, 9.7, 10.1, 13.6)", () => {
    const chapterOneAssets = getChapter(DEFAULT_CHAPTER_ID)?.assets ?? [];

    it("appears exactly once in the Chapter 1 assets and is optional", () => {
      const matches = chapterOneAssets.filter((asset) => asset.url === CALL_PHONE_GLB);
      expect(matches).toHaveLength(1);
      expect(matches[0]?.optional).toBe(true);
    });

    it("exists under public/, is at most 5 MB and passes verification", () => {
      const path = resolve(PUBLIC_DIR, `.${CALL_PHONE_GLB}`);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeLessThanOrEqual(MAX_PHONE_MODEL_BYTES);
      const file = readPublicFile(CALL_PHONE_GLB);
      const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
      expect(verifyAsset("gltf", buffer)).toEqual({ ok: true });
    });

    it("has a file name without a real brand or product name", () => {
      const fileName = basename(CALL_PHONE_GLB).toLowerCase();
      for (const name of REAL_BRAND_AND_PRODUCT_NAMES) expect(fileName).not.toContain(name);
    });

    it("has no wallpaper image and no node or mesh named after the product", () => {
      const gltf = readGlbJson(readPublicFile(CALL_PHONE_GLB));
      expect((gltf.images ?? []).map((image) => image.name)).not.toContain("wallpaper");
      const names = [...(gltf.nodes ?? []), ...(gltf.meshes ?? [])].map((item) => (item.name ?? "").toLowerCase());
      for (const name of names) {
        for (const realName of REAL_BRAND_AND_PRODUCT_NAMES) expect(name).not.toContain(realName);
      }
    });

    it("has an OLED screen that matches SCREEN_WIDTH_M and SCREEN_HEIGHT_M within 0.5 mm", () => {
      const [width, height] = oledWorldSize(readGlbJson(readPublicFile(CALL_PHONE_GLB)));
      expect(Math.abs(width - SCREEN_WIDTH_M)).toBeLessThanOrEqual(SCREEN_TOLERANCE_M);
      expect(Math.abs(height - SCREEN_HEIGHT_M)).toBeLessThanOrEqual(SCREEN_TOLERANCE_M);
    });
  });
});

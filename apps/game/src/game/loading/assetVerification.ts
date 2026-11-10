import type { ChapterAssetKind } from "../chapters/chapterRegistry";

/**
 * Lightweight checks that a downloaded file really is what the manifest expects, without
 * decoding geometry or uploading to the GPU. This catches the common deployment failure where
 * a missing file is answered with the SPA fallback page (HTTP 200, text/html).
 */

export type VerificationResult = { ok: true } | { ok: false; reason: string };

const GLB_MAGIC = 0x46546c67; // "glTF"
const GLB_CHUNK_JSON = 0x4e4f534a; // "JSON"

/** Extensions that Three.js GLTFLoader, as configured by Drei's useGLTF, can decode. */
export const SUPPORTED_GLTF_EXTENSIONS: ReadonlySet<string> = new Set([
  "EXT_meshopt_compression",
  "EXT_texture_webp",
  "EXT_texture_avif",
  "EXT_mesh_gpu_instancing",
  "KHR_draco_mesh_compression",
  "KHR_lights_punctual",
  "KHR_materials_clearcoat",
  "KHR_materials_emissive_strength",
  "KHR_materials_ior",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_unlit",
  "KHR_materials_volume",
  "KHR_mesh_quantization",
  "KHR_texture_transform",
]);

export function verifyGlb(buffer: ArrayBuffer): VerificationResult {
  if (buffer.byteLength < 20) {
    return { ok: false, reason: "File is too small to be a GLB." };
  }
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    return { ok: false, reason: "File is not a GLB (missing glTF header)." };
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    return { ok: false, reason: `Unsupported GLB version ${version}.` };
  }
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== buffer.byteLength) {
    return {
      ok: false,
      reason: `GLB is truncated (${buffer.byteLength} of ${declaredLength} bytes).`,
    };
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== GLB_CHUNK_JSON || 20 + jsonLength > buffer.byteLength) {
    return { ok: false, reason: "GLB has no valid JSON chunk." };
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  } catch {
    return { ok: false, reason: "GLB JSON chunk could not be parsed." };
  }
  if (typeof json !== "object" || json === null) {
    return { ok: false, reason: "GLB JSON chunk is empty." };
  }
  const gltf = json as { asset?: { version?: unknown }; extensionsRequired?: unknown };
  if (typeof gltf.asset?.version !== "string" || !gltf.asset.version.startsWith("2.")) {
    return { ok: false, reason: "GLB does not declare glTF 2.0." };
  }
  if (Array.isArray(gltf.extensionsRequired)) {
    const unsupported = gltf.extensionsRequired.filter(
      (name) => typeof name !== "string" || !SUPPORTED_GLTF_EXTENSIONS.has(name),
    );
    if (unsupported.length > 0) {
      return { ok: false, reason: `GLB requires unsupported extensions: ${unsupported.join(", ")}.` };
    }
  }
  return { ok: true };
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

export function verifyImage(buffer: ArrayBuffer): VerificationResult {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16));
  const isPng = startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = startsWith(bytes, [0xff, 0xd8, 0xff]);
  const isWebp = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  return isPng || isJpeg || isWebp
    ? { ok: true }
    : { ok: false, reason: "File is not a PNG, JPEG or WebP image." };
}

export function verifyAsset(kind: ChapterAssetKind, buffer: ArrayBuffer): VerificationResult {
  return kind === "gltf" ? verifyGlb(buffer) : verifyImage(buffer);
}

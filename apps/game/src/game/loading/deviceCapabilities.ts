import type { LoadingErrorCode } from "./loadingErrors";

export type CapabilityResult =
  | { ok: true }
  | { ok: false; code: Extract<LoadingErrorCode, "unsupported-device" | "webgl-init">; detail: string };

/** Cheap check that does not allocate a GPU context. */
export function checkBasicWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.WebGLRenderingContext || window.WebGL2RenderingContext);
}

/**
 * Creates a throwaway WebGL 2 context (required by Three.js r163+) and releases it at once.
 * Distinguishes "browser has no WebGL 2" from "WebGL 2 exists but failed to start".
 */
export function probeWebGL2(): CapabilityResult {
  if (typeof window === "undefined" || typeof document === "undefined" || !window.WebGL2RenderingContext) {
    return { ok: false, code: "unsupported-device", detail: "WebGL2RenderingContext is not available." };
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      return { ok: false, code: "webgl-init", detail: "canvas.getContext('webgl2') returned null." };
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: "webgl-init",
      detail: error instanceof Error ? error.message : "WebGL 2 context creation threw.",
    };
  }
}

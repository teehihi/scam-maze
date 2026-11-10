import type { ChapterDefinition } from "../game/chapters/chapterRegistry";
import type { ChapterLoaderDeps } from "../game/loading/chapterLoader";
import type { FetchLike } from "../game/loading/assetFetcher";
import type { SaveReadResult } from "../game/saves/saveGame";

/** Builds a minimal, valid GLB container (header + JSON chunk + optional padding bytes). */
export function makeGlb(
  json: object = { asset: { version: "2.0" } },
  extraBytes = 0,
): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(encoded.length / 4) * 4;
  const total = 12 + 8 + jsonLength + extraBytes;
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(encoded, 20);
  return bytes;
}

export function makePng(size = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

export const TEST_CHAPTER: ChapterDefinition = {
  id: "test-chapter",
  number: 7,
  title: "The Test Chapter",
  subtitle: "A fictional chapter used by tests.",
  startSceneId: "street",
  sceneIds: ["street"],
  assets: [
    { id: "model", url: "/test/model.glb", kind: "gltf", loadingText: "Loading the model" },
    { id: "texture", url: "/test/texture.png", kind: "image", loadingText: "Loading the texture" },
  ],
  gameplayAvailable: false,
};

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

export interface ManualAsset {
  /** Resolves the request with headers; the body is streamed with push()/finish(). */
  respond(options?: { contentLength?: number | null; status?: number }): void;
  push(bytes: Uint8Array): void;
  finish(): void;
  reject(error: unknown): void;
  readonly signal: AbortSignal | null;
}

/**
 * Fetch double. URLs registered with `serve` answer immediately (like an HTTP cache hit);
 * URLs registered with `manual` wait for the test to drive headers and body chunks.
 */
export function createFakeFetch() {
  const immediate = new Map<string, () => Response>();
  const manual = new Map<string, ManualAsset & { attach(signal: AbortSignal, resolve: (r: Response) => void, reject: (e: unknown) => void): void }>();
  const calls: string[] = [];
  const signals: AbortSignal[] = [];

  const fetchImpl: FetchLike = (url, { signal }) => {
    calls.push(url);
    signals.push(signal);
    if (signal.aborted) return Promise.reject(abortError());
    const serve = immediate.get(url);
    if (serve) return Promise.resolve(serve());
    const pending = manual.get(url);
    if (!pending) return Promise.resolve(new Response("not found", { status: 404 }));
    return new Promise((resolve, reject) => pending.attach(signal, resolve, reject));
  };

  return {
    fetchImpl,
    calls,
    signals,
    serve(url: string, bytes: Uint8Array<ArrayBuffer>, options: { contentLength?: number | null; status?: number; contentType?: string } = {}) {
      immediate.set(url, () => {
        const headers = new Headers();
        const length = options.contentLength === undefined ? bytes.byteLength : options.contentLength;
        if (length !== null) headers.set("content-length", String(length));
        if (options.contentType) headers.set("content-type", options.contentType);
        return new Response(bytes, { status: options.status ?? 200, headers });
      });
    },
    manual(url: string): ManualAsset {
      let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
      let resolveFn: ((r: Response) => void) | null = null;
      let rejectFn: ((e: unknown) => void) | null = null;
      let signal: AbortSignal | null = null;
      const asset = {
        get signal() {
          return signal;
        },
        attach(s: AbortSignal, resolve: (r: Response) => void, reject: (e: unknown) => void) {
          signal = s;
          resolveFn = resolve;
          rejectFn = reject;
          s.addEventListener("abort", () => {
            rejectFn?.(abortError());
            try {
              controller?.error(abortError());
            } catch {
              // Stream already closed.
            }
          });
        },
        respond(options: { contentLength?: number | null; status?: number } = {}) {
          const stream = new ReadableStream<Uint8Array>({
            start(c) {
              controller = c;
            },
          });
          const headers = new Headers();
          if (options.contentLength != null) headers.set("content-length", String(options.contentLength));
          resolveFn?.(new Response(stream, { status: options.status ?? 200, headers }));
        },
        push(bytes: Uint8Array) {
          controller?.enqueue(bytes);
        },
        finish() {
          controller?.close();
        },
        reject(error: unknown) {
          rejectFn?.(error);
        },
      };
      manual.set(url, asset);
      return asset;
    },
  };
}

export function createTestDeps(
  fetchImpl: FetchLike,
  overrides: Partial<ChapterLoaderDeps> & { save?: SaveReadResult } = {},
): ChapterLoaderDeps {
  const { save, ...rest } = overrides;
  return {
    fetchImpl,
    saveSource: { read: () => save ?? { status: "none" } },
    probeDevice: () => ({ ok: true }),
    getChapter: (id) => (id === TEST_CHAPTER.id ? TEST_CHAPTER : undefined),
    stallTimeoutMs: 30_000,
    ...rest,
  };
}

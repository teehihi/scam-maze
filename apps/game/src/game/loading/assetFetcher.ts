import { AssetLoadError } from "./loadingErrors";

export type FetchLike = (url: string, init: { signal: AbortSignal }) => Promise<Response>;

export interface ByteProgress {
  loadedBytes: number;
  /** Null when the server does not report a usable size. */
  totalBytes: number | null;
}

/**
 * Reads the size the response body will have once decoded, or null if it cannot be known.
 * Content-Length describes the encoded size, so it is ignored for compressed responses.
 */
function readDecodedLength(response: Response): number | null {
  const encoding = response.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") return null;
  const header = response.headers.get("content-length");
  if (header === null) return null;
  const length = Number(header);
  return Number.isFinite(length) && length >= 0 ? length : null;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

/**
 * Downloads a file and reports real byte progress from the response stream.
 * Uses the normal HTTP cache, so files the browser already has resolve quickly and later
 * loaders (for example GLTFLoader) requesting the same URL can be served from cache.
 */
export async function fetchAssetBytes(
  url: string,
  options: {
    fetchImpl: FetchLike;
    signal: AbortSignal;
    onProgress: (progress: ByteProgress) => void;
  },
): Promise<ArrayBuffer> {
  const { fetchImpl, signal, onProgress } = options;

  let response: Response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new AssetLoadError("network", `Request failed for ${url}.`);
  }

  if (response.status === 404 || response.status === 410) {
    throw new AssetLoadError("asset-missing", `${url} returned HTTP ${response.status}.`);
  }
  if (!response.ok) {
    throw new AssetLoadError("network", `${url} returned HTTP ${response.status}.`);
  }

  const totalBytes = readDecodedLength(response);
  onProgress({ loadedBytes: 0, totalBytes });

  try {
    if (!response.body) {
      const buffer = await response.arrayBuffer();
      onProgress({ loadedBytes: buffer.byteLength, totalBytes: totalBytes ?? buffer.byteLength });
      return buffer;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loadedBytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loadedBytes += value.byteLength;
      onProgress({ loadedBytes, totalBytes });
    }

    const bytes = new Uint8Array(loadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    // Report the final size so progress reaches exactly 100% for this file.
    onProgress({ loadedBytes, totalBytes: loadedBytes });
    return bytes.buffer;
  } catch (error) {
    if (isAbortError(error) || signal.aborted) throw error;
    throw new AssetLoadError("network", `Download of ${url} was interrupted.`);
  }
}

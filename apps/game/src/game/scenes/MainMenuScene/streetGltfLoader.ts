/**
 * Loader for the main menu street file (Street_GLB) that reports byte download progress.
 *
 * Why a dedicated class instead of passing `onProgress` to a hook:
 * - React Three Fiber memoizes one loader instance per class and caches results per
 *   `[class, url]`. The module-level `useLoader.preload(StreetGLTFLoader, url, ext)` and the
 *   component's `useLoader(StreetGLTFLoader, url, ext)` therefore share one cache entry, so the
 *   file is downloaded exactly once.
 * - `useLoader.preload` has no `onProgress` parameter, and the preload is the call that
 *   actually starts the download. Wrapping `load` here reports progress from that call.
 * - A separate class keeps every other GLTF load (for example Drei `useGLTF`) out of the
 *   street progress store.
 */
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { menuAssetProgress, type ByteProgressStore } from "../../loading/menuAssetProgress";

/** GLTFLoader that reports Street_GLB byte progress to a store. Used only for the street file. */
export class StreetGLTFLoader extends GLTFLoader {
  /** Store that receives progress; replaceable in tests. */
  progressStore: ByteProgressStore = menuAssetProgress;

  override load(
    url: string,
    onLoad: (data: GLTF) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void {
    super.load(
      url,
      (gltf) => {
        // Mark complete before the caller resolves, so the screen never sees a loaded
        // scene with a byte percent below 100.
        this.progressStore.markComplete();
        onLoad(gltf);
      },
      (event) => {
        this.progressStore.report(event);
        onProgress?.(event);
      },
      onError,
    );
  }
}

/** R3F loader extensions: Meshopt decoding, as Drei's useGLTF configured for this file. */
export const streetLoaderExtensions = (loader: GLTFLoader): void => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

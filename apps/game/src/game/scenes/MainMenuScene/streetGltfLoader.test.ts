import { afterEach, describe, expect, it, vi } from "vitest";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createByteProgressStore } from "../../loading/menuAssetProgress";
import { StreetGLTFLoader, streetLoaderExtensions } from "./streetGltfLoader";

type LoadArgs = Parameters<GLTFLoader["load"]>;

/** Fictional reserved-domain style path; no request is ever made because `load` is spied. */
const STREET_URL = "/assets/3d/optimized/street.test.glb";

function progressEvent(loaded: number, total: number): ProgressEvent {
  return { loaded, total, lengthComputable: true } as ProgressEvent;
}

/** Creates a loader with an injected store and captures the callbacks passed to `super.load`. */
function setup() {
  const captured: { args?: LoadArgs } = {};
  const spy = vi.spyOn(GLTFLoader.prototype, "load").mockImplementation(function (...args: LoadArgs) {
    captured.args = args;
  });
  const store = createByteProgressStore();
  const loader = new StreetGLTFLoader();
  loader.progressStore = store;
  const onLoad = vi.fn<(data: GLTF) => void>();
  const onProgress = vi.fn<(event: ProgressEvent) => void>();
  const onError = vi.fn<(err: unknown) => void>();
  loader.load(STREET_URL, onLoad, onProgress, onError);
  const args = captured.args;
  if (!args) throw new Error("GLTFLoader.prototype.load was not called");
  const [url, wrappedLoad, wrappedProgress, wrappedError] = args;
  return { spy, store, onLoad, onProgress, onError, url, wrappedLoad, wrappedProgress, wrappedError };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StreetGLTFLoader", () => {
  it("passes the same URL to GLTFLoader.load once", () => {
    const { spy, url } = setup();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(url).toBe(STREET_URL);
  });

  it("reports progress events to the injected store and forwards them to the caller", () => {
    const { store, onProgress, wrappedProgress } = setup();
    expect(store.getPercent()).toBeNull();

    const first = progressEvent(250, 1000);
    wrappedProgress?.(first);
    expect(store.getPercent()).toBe(25);
    expect(onProgress).toHaveBeenLastCalledWith(first);

    const second = progressEvent(600, 1000);
    wrappedProgress?.(second);
    expect(store.getPercent()).toBe(60);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith(second);
  });

  it("marks the store complete before forwarding to the caller's onLoad", () => {
    const { store, onLoad, wrappedProgress, wrappedLoad } = setup();
    wrappedProgress?.(progressEvent(900, 1000));
    expect(store.getPercent()).toBe(90);

    let percentSeenByCaller: number | null = null;
    onLoad.mockImplementation(() => {
      percentSeenByCaller = store.getPercent();
    });
    const gltf = { scene: {} } as unknown as GLTF;
    wrappedLoad(gltf);

    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(gltf);
    expect(percentSeenByCaller).toBe(100);
    expect(store.getPercent()).toBe(100);
  });

  it("forwards errors to the caller's onError without completing the store", () => {
    const { store, onError, onLoad, wrappedError } = setup();
    const error = new Error("network failure");
    wrappedError?.(error);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onLoad).not.toHaveBeenCalled();
    expect(store.getPercent()).toBeNull();
  });

  it("works when the caller passes no onProgress", () => {
    const captured: { args?: LoadArgs } = {};
    vi.spyOn(GLTFLoader.prototype, "load").mockImplementation(function (...args: LoadArgs) {
      captured.args = args;
    });
    const store = createByteProgressStore();
    const loader = new StreetGLTFLoader();
    loader.progressStore = store;
    loader.load(STREET_URL, () => {});
    const wrappedProgress = captured.args?.[2];
    expect(() => wrappedProgress?.(progressEvent(1, 2))).not.toThrow();
    expect(store.getPercent()).toBe(50);
  });
});

describe("streetLoaderExtensions", () => {
  it("sets the Meshopt decoder on the loader", () => {
    const loader = new GLTFLoader();
    const spy = vi.spyOn(loader, "setMeshoptDecoder");
    streetLoaderExtensions(loader);
    expect(spy).toHaveBeenCalledWith(MeshoptDecoder);
  });
});

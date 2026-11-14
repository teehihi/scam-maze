import * as THREE from 'three';

/**
 * Shared teardown primitives for the imperative engines (Hue, Mekong), which own their resources
 * directly instead of through React/R3F. None of this should be used to dispose objects an R3F
 * canvas created from JSX: the reconciler owns those and frees them itself on unmount.
 */

/**
 * Tracks every listener added through it, so `removeAll()` can remove exactly those listeners
 * once, in any order, without hunting down each handler reference by hand. Typed overloads match
 * `Window`/`Document`/`HTMLElement`'s own event maps, so a listener's event type is still
 * inferred at the call site (no casts to `EventListener` needed).
 */
export class ListenerBag {
  private entries: Array<{
    target: EventTarget;
    type: string;
    listener: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  }> = [];

  add<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  add<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  add<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  add(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  add(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.entries.push({ target, type, listener, options });
  }

  /** Removes every listener added through this bag. Safe to call more than once. */
  removeAll(): void {
    for (const entry of this.entries) {
      entry.target.removeEventListener(entry.type, entry.listener, entry.options);
    }
    this.entries = [];
  }

  /** Number of listeners currently tracked (for tests and diagnostics). */
  get size(): number {
    return this.entries.length;
  }
}

function disposeTexture(value: unknown): void {
  if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
}

/**
 * Disposes every geometry, material and the material's texture-valued properties reachable from
 * `root`, each exactly once even if more than one object shares it. Does not remove objects from
 * the scene graph or dispose the renderer itself; call `root.clear()` and `renderer.dispose()`
 * separately if that is also wanted. Safe to call more than once: already-disposed geometries,
 * materials and textures are simply disposed again, which three.js tolerates, but a resource
 * freed and not re-added to the scene is not re-freed by a second call (the `Set`s are per-call).
 */
export function disposeObjectTree(root: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  root.traverse((object) => {
    const withGeometry = object as THREE.Object3D & { geometry?: THREE.BufferGeometry };
    if (withGeometry.geometry && !disposedGeometries.has(withGeometry.geometry)) {
      disposedGeometries.add(withGeometry.geometry);
      withGeometry.geometry.dispose();
    }
    const withMaterial = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    const materials = Array.isArray(withMaterial.material)
      ? withMaterial.material
      : withMaterial.material
        ? [withMaterial.material]
        : [];
    for (const material of materials) {
      if (disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        disposeTexture(value);
      }
      material.dispose();
    }
  });
}

export interface ContextLossHandlers {
  /** Fired on `webglcontextlost`, after `preventDefault()` so the browser may restore it. */
  onLost?: () => void;
  /** Fired on `webglcontextrestored`. three.js's `WebGLRenderer` re-initializes its own state. */
  onRestored?: () => void;
}

/**
 * Watches a canvas for GPU context loss. Returns an unsubscribe function; call it before
 * `renderer.forceContextLoss()` during disposal, which itself fires `webglcontextlost` and would
 * otherwise invoke `onLost` during teardown.
 */
export function watchContextLoss(canvas: HTMLCanvasElement, handlers: ContextLossHandlers): () => void {
  const onLost = (event: Event) => {
    event.preventDefault();
    handlers.onLost?.();
  };
  const onRestored = () => {
    handlers.onRestored?.();
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);
  return () => {
    canvas.removeEventListener('webglcontextlost', onLost, false);
    canvas.removeEventListener('webglcontextrestored', onRestored, false);
  };
}

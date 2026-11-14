import * as THREE from 'three';
import type { House } from './house';

/**
 * Dev-only measurement helper for the neighborhood (called from the browser console through the
 * engine's dev handle). Read-only: it counts what the camera would draw and times the frame
 * phases; it changes nothing in the scene.
 */
export interface ProbeTarget {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  root: THREE.Object3D;
  houses: House[];
  update(dt: number): void;
  renderFrame(): void;
}

export function probeDrawCategories(t: ProbeTarget): Record<string, number> {
  const cam = t.camera;
  cam.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
  );
  const houseOf = new Map<THREE.Object3D, House>();
  t.houses.forEach((h) => houseOf.set(h.group, h));
  const out: Record<string, number> = {};
  const add = (k: string) => (out[k] = (out[k] ?? 0) + 1);
  const visit = (o: THREE.Object3D, top: THREE.Object3D | null) => {
    if (!o.visible) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && o.layers.test(cam.layers)) {
      const m = mesh.material as THREE.Material;
      if (m.visible !== false && (!mesh.frustumCulled || frustum.intersectsObject(mesh))) {
        let cat = 'other';
        if (top === null) cat = o.name.startsWith('ShadowProxy') ? 'shadowProxy' : 'street';
        else if (houseOf.has(top)) {
          const h = houseOf.get(top)!;
          const inside = h.contains(cam.position.x, cam.position.z);
          const shell = o.parent === top && !o.matrixAutoUpdate;
          cat = `house-${shell ? 'shell' : 'device'}${inside ? '-in' : ''}`;
        } else {
          let n = 0;
          top.traverse(() => n++);
          cat = n > 20 && n < 80 ? 'person' : top.name || 'group';
        }
        add(cat);
      }
    }
    for (const c of o.children) visit(c, top ?? (o === t.root ? null : o.parent === t.root ? o : top));
  };
  for (const c of t.root.children) visit(c, c.children.length ? c : null);
  return out;
}

export function probeTimings(t: ProbeTarget, frames = 20): { update: number; render: number } {
  let u = 0;
  let r = 0;
  for (let i = 0; i < frames; i++) {
    const a = performance.now();
    t.update(1 / 60);
    const b = performance.now();
    t.renderFrame();
    // Force the GL command stream to flush so the render time is not hidden.
    t.renderer.getContext().finish();
    const c = performance.now();
    u += b - a;
    r += c - b;
  }
  return { update: +(u / frames).toFixed(2), render: +(r / frames).toFixed(2) };
}

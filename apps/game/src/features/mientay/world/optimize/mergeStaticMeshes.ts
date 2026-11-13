import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Draw-call reduction for static architecture, with no change to what is drawn.
 *
 * Every mesh that shares a material (and the same shadow flags and vertex layout) inside one
 * square cell of the ground is baked into a single mesh. Cells keep frustum culling effective, so
 * a landmark that is only partly in view is still culled piece by piece. The saving matters most
 * because each draw call is repeated for the three shadow cascades and the water reflection.
 *
 * Flags on scene objects:
 *  - `userData.dynamic`: animated piece by piece every frame; the whole subtree is left alone.
 *  - `userData.rigid`: moves as one unit (a boat, a floating plant). Its children are merged
 *    relative to it, so the unit still moves as before but costs a few draw calls instead of many.
 *
 * Meshes are also left alone when they use a material array or a custom shader, are transparent,
 * instanced (including instanced geometry) or skinned, have morph targets, are hidden, or have a
 * custom render order or layer.
 */
export interface MergeResult {
  /** Meshes removed from the scene graph. */
  removed: number;
  /** Merged meshes added in their place. */
  created: number;
}

function isPlainSurfaceMaterial(material: THREE.Material): boolean {
  const m = material as THREE.Material & Record<string, unknown>;
  return Boolean(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial);
}

function isMergeable(mesh: THREE.Mesh): boolean {
  if ((mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return false;
  if ((mesh.geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry) return false;
  if (!mesh.visible || mesh.renderOrder !== 0 || mesh.layers.mask !== 1 || !mesh.frustumCulled) return false;
  if (mesh.userData.keep === true) return false;
  const material = mesh.material;
  if (Array.isArray(material) || !material) return false;
  if (material.transparent || material.visible === false || !isPlainSurfaceMaterial(material)) return false;
  const geometry = mesh.geometry;
  if (!geometry.getAttribute('position')) return false;
  if (Object.keys(geometry.morphAttributes).length > 0) return false;
  return true;
}

function attributeSignature(geometry: THREE.BufferGeometry): string {
  const names = Object.keys(geometry.attributes).sort();
  const parts = names.map((name) => {
    const attribute = geometry.attributes[name];
    return `${name}:${attribute.itemSize}${attribute.normalized ? 'n' : ''}`;
  });
  return `${geometry.index ? 'i' : 'n'}|${parts.join(',')}`;
}

/** Swaps two indices per triangle, so a mirrored (negative-determinant) mesh keeps its facing. */
function flipWinding(geometry: THREE.BufferGeometry): void {
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      index.setX(i + 1, c);
      index.setX(i + 2, b);
    }
    index.needsUpdate = true;
    return;
  }
  for (const attribute of Object.values(geometry.attributes)) {
    const size = attribute.itemSize;
    for (let i = 0; i + 2 < attribute.count; i += 3) {
      for (let k = 0; k < size; k++) {
        const b = attribute.getComponent(i + 1, k);
        const c = attribute.getComponent(i + 2, k);
        attribute.setComponent(i + 1, k, c);
        attribute.setComponent(i + 2, k, b);
      }
    }
    attribute.needsUpdate = true;
  }
}

export function mergeStaticMeshes(root: THREE.Object3D, cellSize = 28): MergeResult {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const candidates: THREE.Mesh[] = [];
  const rigidUnits: THREE.Object3D[] = [];
  const visit = (object: THREE.Object3D) => {
    if (object.userData.dynamic === true) return;
    if (object !== root && object.userData.rigid === true) {
      rigidUnits.push(object);
      return;
    }
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && isMergeable(mesh)) candidates.push(mesh);
    for (const child of object.children) visit(child);
  };
  visit(root);

  // Units that move as one are merged inside themselves, with a cell large enough to keep each
  // unit in one piece (a boat or a plant is far smaller than the cell).
  let removed = 0;
  let created = 0;
  for (const unit of rigidUnits) {
    const inner = mergeStaticMeshes(unit, 1e6);
    removed += inner.removed;
    created += inner.created;
  }
  if (candidates.length < 2) return { removed, created };

  interface Entry {
    mesh: THREE.Mesh;
    geometry: THREE.BufferGeometry;
  }
  const buckets = new Map<string, Entry[]>();
  const relative = new THREE.Matrix4();
  const box = new THREE.Box3();
  const center = new THREE.Vector3();

  for (const mesh of candidates) {
    relative.multiplyMatrices(rootInverse, mesh.matrixWorld);
    const geometry = mesh.geometry.clone();
    geometry.clearGroups(); // Only meaningful for material arrays, which are never merged.
    geometry.applyMatrix4(relative);
    if (relative.determinant() < 0) flipWinding(geometry);
    geometry.computeBoundingBox();
    box.copy(geometry.boundingBox as THREE.Box3).getCenter(center);
    const material = mesh.material as THREE.Material;
    const key = [
      material.uuid,
      mesh.castShadow ? 1 : 0,
      mesh.receiveShadow ? 1 : 0,
      attributeSignature(geometry),
      cellSize >= 1e5 ? 0 : Math.floor(center.x / cellSize),
      cellSize >= 1e5 ? 0 : Math.floor(center.z / cellSize),
    ].join('|');
    const list = buckets.get(key);
    if (list) list.push({ mesh, geometry });
    else buckets.set(key, [{ mesh, geometry }]);
  }

  for (const entries of buckets.values()) {
    if (entries.length < 2) {
      entries.forEach((entry) => entry.geometry.dispose());
      continue;
    }
    const merged = mergeGeometries(entries.map((entry) => entry.geometry), false);
    entries.forEach((entry) => entry.geometry.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const first = entries[0].mesh;
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.name = `${first.name || 'static'}-merged`;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    root.add(mesh);
    created++;
    for (const { mesh: source } of entries) {
      source.removeFromParent();
      // The source geometry is no longer referenced by any mesh that is drawn.
      source.geometry.dispose();
      removed++;
    }
  }
  return { removed, created };
}

/**
 * Stops per-frame matrix recomputation for everything that never moves. Objects flagged
 * `userData.dynamic` (and their children) keep updating, and so do ancestors of those.
 */
export function freezeStaticTransforms(root: THREE.Object3D): void {
  const hasDynamic = (object: THREE.Object3D): boolean => {
    if (object.userData.dynamic === true) return true;
    return object.children.some(hasDynamic);
  };
  const freeze = (object: THREE.Object3D, underDynamic: boolean) => {
    const dynamic = underDynamic || object.userData.dynamic === true;
    if (!dynamic && !hasDynamic(object)) {
      object.traverse((node) => {
        node.updateMatrix();
        node.matrixAutoUpdate = false;
      });
      return;
    }
    for (const child of object.children) freeze(child, dynamic);
  };
  root.updateMatrixWorld(true);
  freeze(root, false);
}

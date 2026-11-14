import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { House } from './house';

/**
 * Draw-call reduction for the neighborhood.
 *
 * Measured at the spawn point and in the alley (dev probe, `renderer.info`): the camera submitted
 * 1,100-2,700 draws per frame, of which 530-1,080 were house shells (each house is one mesh per
 * material key, 30-40 per house) and 160-345 were people (about 30 meshes each). On a laptop the
 * WebGL cost per draw, not the GPU, set the frame rate. Two merges cut those numbers:
 *
 * - `mergeHouseShells`: the static shell pieces of all houses are merged per material and per
 *   24 m ground cell. Materials come from a shared cache (`mat(key)`), so many houses use the
 *   same instance, and the world-space weathering shader looks identical after the merge.
 * - `mergeRigidParts`: inside each person, leaf meshes that share a parent bone group and a
 *   material are merged in that group's space. Posing rotates the groups, never the leaf meshes,
 *   so the animation is unchanged.
 *
 * Transparent materials (glass) are left alone, because they are sorted per object.
 */
const CELL = 24;

function mergeable(mesh: THREE.Mesh): boolean {
  const material = mesh.material as THREE.Material | THREE.Material[];
  if (Array.isArray(material) || material.transparent || material.visible === false) return false;
  const g = mesh.geometry;
  return !!g.index && !!g.attributes.position && !!g.attributes.normal && !!g.attributes.uv && !g.morphAttributes.position;
}

/** Copy holding only the attributes every builder mesh has, so all pieces can be merged. */
function strip(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const copy = new THREE.BufferGeometry();
  copy.setAttribute('position', geometry.attributes.position.clone());
  copy.setAttribute('normal', geometry.attributes.normal.clone());
  copy.setAttribute('uv', geometry.attributes.uv.clone());
  copy.setIndex(geometry.index!.clone());
  copy.applyMatrix4(matrix);
  return copy;
}

interface Bucket {
  material: THREE.Material;
  renderOrder: number;
  receiveShadow: boolean;
  castShadow: boolean;
  parts: THREE.BufferGeometry[];
  sources: THREE.Mesh[];
}

function flush(buckets: Map<string, Bucket>, parent: THREE.Object3D, name: string): number {
  let made = 0;
  buckets.forEach((b) => {
    if (b.sources.length < 2) return;
    const geometry = mergeGeometries(b.parts, false);
    b.parts.forEach((g) => g.dispose());
    if (!geometry) return;
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, b.material);
    mesh.name = name;
    mesh.renderOrder = b.renderOrder;
    mesh.receiveShadow = b.receiveShadow;
    mesh.castShadow = b.castShadow;
    for (const src of b.sources) {
      src.removeFromParent();
      src.geometry.dispose();
    }
    parent.add(mesh);
    made++;
  });
  return made;
}

/** Merges the static shell meshes of every house (direct, non-animated children of the house group). */
export function mergeHouseShells(houses: readonly House[], root: THREE.Object3D): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, Bucket>();
  const center = new THREE.Vector3();
  let before = 0;
  for (const h of houses) {
    for (const child of [...h.group.children]) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || mesh.matrixAutoUpdate || mesh.children.length || !mergeable(mesh)) continue;
      const g = mesh.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      center.copy(g.boundingSphere!.center).applyMatrix4(mesh.matrixWorld);
      const key = `${(mesh.material as THREE.Material).uuid}:${Math.floor(center.x / CELL)}:${Math.floor(center.z / CELL)}:${mesh.renderOrder}:${mesh.receiveShadow}:${mesh.castShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: mesh.material as THREE.Material, renderOrder: mesh.renderOrder, receiveShadow: mesh.receiveShadow, castShadow: mesh.castShadow, parts: [], sources: [] }));
      b.parts.push(strip(g, mesh.matrixWorld));
      b.sources.push(mesh);
      before++;
    }
  }
  buckets.forEach((b, k) => { if (b.sources.length < 2) { b.parts.forEach((g) => g.dispose()); buckets.delete(k); } });
  const after = flush(buckets, root, 'MergedShell');
  root.children.forEach((c) => { if (c.name === 'MergedShell') { c.matrixAutoUpdate = false; c.updateMatrix(); c.updateMatrixWorld(true); } });
  return { before, after };
}

/**
 * Merges, inside `group`, the leaf meshes that share a parent and a material (in the parent's
 * space). Meshes kept by reference elsewhere must not be passed here.
 */
export function mergeRigidParts(group: THREE.Object3D): void {
  const parents: THREE.Object3D[] = [];
  group.traverse((o) => { if (o.children.length) parents.push(o); });
  for (const parent of parents) {
    const buckets = new Map<string, Bucket>();
    for (const child of parent.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || mesh.children.length || !mesh.visible || !mergeable(mesh)) continue;
      mesh.updateMatrix();
      const key = `${(mesh.material as THREE.Material).uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: mesh.material as THREE.Material, renderOrder: mesh.renderOrder, receiveShadow: mesh.receiveShadow, castShadow: mesh.castShadow, parts: [], sources: [] }));
      b.parts.push(strip(mesh.geometry, mesh.matrix));
      b.sources.push(mesh);
    }
    buckets.forEach((b, k) => { if (b.sources.length < 2) { b.parts.forEach((g) => g.dispose()); buckets.delete(k); } });
    // Shared geometries (people reuse one set of body-part geometries) must not be disposed.
    buckets.forEach((b) => { for (const src of b.sources) src.geometry = new THREE.BufferGeometry(); });
    flush(buckets, parent, 'MergedPart');
  }
}

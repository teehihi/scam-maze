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

/** Invisible stand-in kept where a merged part was a raycast target for an interaction. */
const PROXY_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });
/** Parts under this radius are interior fittings: the culler hides their merged mesh from outside the house. */
const FITTING_RADIUS = 0.3;

function isStaticDevice(mesh: THREE.Object3D, house: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = mesh; o && o !== house; o = o.parent) if (o.userData.staticDevice) return true;
  return false;
}

/** True when the mesh is (part of) the object an interaction raycasts against. */
function isInteractionTarget(mesh: THREE.Object3D, house: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = mesh; o && o !== house; o = o.parent) if (o.userData.interactable) return true;
  return false;
}

/**
 * Merges the device parts marked static in devices.ts (`userData.staticDevice`), per house, per
 * floor, per size class and per material, into meshes held by the house group (house-local
 * geometry, so the house transform still applies). Parts that an interaction raycasts against are
 * kept as invisible stand-ins, so prompts and clicks behave as before; the others are removed.
 * Small parts are flagged `interiorFitting` so the culler still hides them from outside the house.
 */
export function mergeDevices(houses: readonly House[]): { before: number; after: number; proxies: number } {
  let before = 0;
  let after = 0;
  let proxies = 0;
  const local = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  for (const h of houses) {
    h.group.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(h.group.matrixWorld).invert();
    const buckets = new Map<string, Bucket & { fitting: boolean }>();
    h.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.parent === h.group && !mesh.matrixAutoUpdate) return; // house shell pieces
      if (!isStaticDevice(mesh, h.group) || !mergeable(mesh) || mesh.children.length || !mesh.visible) return;
      const g = mesh.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      mesh.matrixWorld.decompose(pos, quat, scale);
      const radius = g.boundingSphere!.radius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
      local.multiplyMatrices(inverse, mesh.matrixWorld);
      const centerY = new THREE.Vector3().copy(g.boundingSphere!.center).applyMatrix4(local).y;
      const floor = Math.max(0, Math.floor((centerY - h.F(0) + 0.3) / h.FH));
      const fitting = radius < FITTING_RADIUS;
      const m = mesh.material as THREE.Material;
      const key = `${floor}:${fitting}:${m.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: m, renderOrder: mesh.renderOrder, receiveShadow: mesh.receiveShadow, castShadow: mesh.castShadow, parts: [], sources: [], fitting }));
      b.parts.push(strip(g, local));
      b.sources.push(mesh);
    });
    buckets.forEach((b) => {
      if (b.sources.length < 2) { b.parts.forEach((g) => g.dispose()); return; }
      const geometry = mergeGeometries(b.parts, false);
      b.parts.forEach((g) => g.dispose());
      if (!geometry) return;
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
      const merged = new THREE.Mesh(geometry, b.material);
      merged.name = 'MergedDevices';
      merged.renderOrder = b.renderOrder;
      merged.castShadow = b.castShadow;
      merged.receiveShadow = b.receiveShadow;
      merged.matrixAutoUpdate = false;
      if (b.fitting) merged.userData.interiorFitting = true;
      h.group.add(merged);
      merged.updateMatrixWorld(true);
      before += b.sources.length;
      after++;
      for (const src of b.sources) {
        if (isInteractionTarget(src, h.group)) {
          // Raycasts ignore `visible` on the material, the renderer skips it: no draw, same hit.
          src.material = PROXY_MATERIAL;
          src.castShadow = false;
          proxies++;
        } else {
          src.removeFromParent();
        }
      }
    });
  }
  return { before, after, proxies };
}

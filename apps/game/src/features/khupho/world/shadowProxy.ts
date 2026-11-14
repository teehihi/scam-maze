import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Shadow proxies for the static architecture.
 *
 * Every house is built as one mesh per material (often 30–40 per house). The sun's shadow pass
 * does not care about materials, yet it drew each of those pieces separately: about 3,000 extra
 * draw calls per shadow update. Here the static pieces are merged, per 24 m ground cell, into a
 * position-only mesh that only the shadow pass can see, and the originals stop casting.
 *
 * The proxy is invisible in the main pass: it writes neither color nor depth and its depth test
 * always fails, so the GPU rejects its fragments early. The shadow pass uses its own depth
 * material and draws it normally.
 */
const CELL = 24;
/** Ground plates and roads are far larger than a cell and only receive shadows. */
const MAX_RADIUS = 40;

const proxyMaterial = (side: THREE.Side) =>
  new THREE.MeshBasicMaterial({ side, colorWrite: false, depthWrite: false, depthFunc: THREE.NeverDepth });

/** Static: built by `Builder.build` (matrixAutoUpdate off) and not inside an animated group. */
function isStatic(mesh: THREE.Mesh, root: THREE.Object3D): boolean {
  if (mesh.matrixAutoUpdate) return false;
  for (let p = mesh.parent; p && p !== root; p = p.parent) if (p.matrixAutoUpdate && p.type !== 'Group') return false;
  return true;
}

export function buildShadowProxies(root: THREE.Object3D): { proxies: number; merged: number } {
  root.updateMatrixWorld(true);
  const cells = new Map<string, THREE.BufferGeometry[]>();
  const center = new THREE.Vector3();
  let merged = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as unknown as THREE.InstancedMesh).isInstancedMesh || !mesh.castShadow) return;
    if (!isStatic(mesh, root)) return;
    const material = mesh.material as THREE.Material;
    if (Array.isArray(material) || material.transparent || material.alphaTest > 0 || !material.visible) return;
    const geometry = mesh.geometry;
    if (!geometry.index || !geometry.attributes.position) return;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    if (!geometry.boundingSphere || geometry.boundingSphere.radius > MAX_RADIUS) return;
    center.copy(geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld);
    const side = material.side === THREE.DoubleSide ? 'd' : 'f';
    const key = `${Math.floor(center.x / CELL)}:${Math.floor(center.z / CELL)}:${side}`;
    const copy = new THREE.BufferGeometry();
    copy.setAttribute('position', geometry.attributes.position.clone());
    copy.setIndex(geometry.index.clone());
    copy.applyMatrix4(mesh.matrixWorld);
    let list = cells.get(key);
    if (!list) cells.set(key, (list = []));
    list.push(copy);
    mesh.castShadow = false;
    merged++;
  });
  let proxies = 0;
  cells.forEach((list, key) => {
    const geometry = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!geometry) return;
    geometry.computeBoundingSphere();
    const proxy = new THREE.Mesh(geometry, proxyMaterial(key.endsWith(':d') ? THREE.DoubleSide : THREE.FrontSide));
    proxy.name = `ShadowProxy_${key}`;
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    proxy.matrixAutoUpdate = false;
    proxy.renderOrder = -1;
    root.add(proxy);
    proxies++;
  });
  return { proxies, merged };
}

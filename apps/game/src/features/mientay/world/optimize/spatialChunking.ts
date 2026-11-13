import * as THREE from 'three';

/**
 * Spatial chunking: splits big, world-sized draw calls into ground cells that share the same
 * geometry buffers and materials. Nothing changes in what is drawn, but each cell has tight
 * bounds, so frustum culling (for the camera, the three shadow cascades and the water
 * reflection) can skip the cells that are not in view. A single InstancedMesh that spans the whole
 * world is otherwise always drawn in full.
 */

function cellKey(x: number, z: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)}:${Math.floor(z / cellSize)}`;
}

function copyObjectState(from: THREE.Object3D, to: THREE.Object3D): void {
  to.name = from.name;
  to.castShadow = from.castShadow;
  to.receiveShadow = from.receiveShadow;
  to.renderOrder = from.renderOrder;
  to.layers.mask = from.layers.mask;
  to.frustumCulled = from.frustumCulled;
  to.userData = { ...from.userData };
  to.matrixAutoUpdate = from.matrixAutoUpdate;
  to.position.copy(from.position);
  to.quaternion.copy(from.quaternion);
  to.scale.copy(from.scale);
  to.updateMatrix();
}

/**
 * Splits an InstancedMesh into one InstancedMesh per ground cell. Geometry and material are
 * shared, so GPU memory does not grow. Returns the new meshes, or the original when every
 * instance falls in one cell.
 */
export function splitInstancedMesh(mesh: THREE.InstancedMesh, cellSize: number): THREE.InstancedMesh[] {
  const source = mesh.instanceMatrix.array as Float32Array;
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < mesh.count; i++) {
    const key = cellKey(source[i * 16 + 12], source[i * 16 + 14], cellSize);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  if (buckets.size <= 1) return [mesh];

  const colors = mesh.instanceColor ? (mesh.instanceColor.array as Float32Array) : null;
  const parts: THREE.InstancedMesh[] = [];
  for (const indices of buckets.values()) {
    const part = new THREE.InstancedMesh(mesh.geometry, mesh.material, indices.length);
    copyObjectState(mesh, part);
    const matrices = part.instanceMatrix.array as Float32Array;
    indices.forEach((from, to) => matrices.set(source.subarray(from * 16, from * 16 + 16), to * 16));
    part.instanceMatrix.needsUpdate = true;
    if (colors) {
      const target = new Float32Array(indices.length * 3);
      indices.forEach((from, to) => target.set(colors.subarray(from * 3, from * 3 + 3), to * 3));
      part.instanceColor = new THREE.InstancedBufferAttribute(target, 3);
    }
    parts.push(part);
  }
  return parts;
}

/** Replaces every InstancedMesh below `root` by its per-cell parts. Returns how many it split. */
export function chunkInstancedMeshes(root: THREE.Object3D, cellSize: number): { split: number; created: number } {
  const targets: THREE.InstancedMesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.InstancedMesh).isInstancedMesh && object.userData.dynamic !== true) {
      targets.push(object as THREE.InstancedMesh);
    }
  });
  let split = 0;
  let created = 0;
  for (const mesh of targets) {
    const parts = splitInstancedMesh(mesh, cellSize);
    if (parts.length === 1 && parts[0] === mesh) continue;
    const parent = mesh.parent;
    if (!parent) continue;
    parent.add(...parts);
    mesh.removeFromParent();
    mesh.dispose();
    split++;
    created += parts.length;
  }
  return { split, created };
}

/**
 * Splits an indexed mesh (terrain, water) into tiles. Every tile shares the original vertex
 * buffers and has its own index list and tight bounds. `boundsMargin` covers anything a vertex
 * shader moves, such as water waves.
 */
export function splitIndexedMeshIntoTiles(mesh: THREE.Mesh, tileSize: number, boundsMargin = 0): THREE.Mesh[] {
  const geometry = mesh.geometry;
  const index = geometry.index;
  const position = geometry.getAttribute('position');
  if (!index || !position) return [mesh];

  const buckets = new Map<string, number[]>();
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    const cx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const cz = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    const key = cellKey(cx, cz, tileSize);
    const list = buckets.get(key);
    if (list) list.push(a, b, c);
    else buckets.set(key, [a, b, c]);
  }
  if (buckets.size <= 1) return [mesh];

  const tiles: THREE.Mesh[] = [];
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const triangles of buckets.values()) {
    const tileGeometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) tileGeometry.setAttribute(name, attribute);
    const indexArray = position.count > 65535 ? new Uint32Array(triangles) : new Uint16Array(triangles);
    tileGeometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

    box.makeEmpty();
    for (const vertex of triangles) box.expandByPoint(point.fromBufferAttribute(position, vertex));
    box.expandByScalar(boundsMargin);
    tileGeometry.boundingBox = box.clone();
    tileGeometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());

    const tile = new THREE.Mesh(tileGeometry, mesh.material);
    copyObjectState(mesh, tile);
    tiles.push(tile);
  }
  return tiles;
}

/**
 * Splits a Mesh drawn with an InstancedBufferGeometry (the grass field) into one mesh per cell.
 * `positionAttribute` is the per-instance attribute whose xyz is the instance position;
 * `boundsMargin` covers blade height and wind sway.
 */
export function splitInstancedGeometryMesh(
  mesh: THREE.Mesh,
  cellSize: number,
  positionAttribute: string,
  boundsMargin: number,
): THREE.Mesh[] {
  const source = mesh.geometry as THREE.InstancedBufferGeometry;
  const positions = source.getAttribute(positionAttribute);
  const total = source.instanceCount;
  if (!positions) return [mesh];

  const buckets = new Map<string, number[]>();
  for (let i = 0; i < total; i++) {
    const key = cellKey(positions.getX(i), positions.getZ(i), cellSize);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  if (buckets.size <= 1) return [mesh];

  const perInstance: Array<[string, THREE.InstancedBufferAttribute]> = [];
  const shared: Array<[string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute]> = [];
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if ((attribute as THREE.InstancedBufferAttribute).isInstancedBufferAttribute) {
      perInstance.push([name, attribute as THREE.InstancedBufferAttribute]);
    } else {
      shared.push([name, attribute]);
    }
  }

  const parts: THREE.Mesh[] = [];
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const indices of buckets.values()) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = source.index;
    for (const [name, attribute] of shared) geometry.setAttribute(name, attribute);
    for (const [name, attribute] of perInstance) {
      const size = attribute.itemSize;
      const data = new Float32Array(indices.length * size);
      indices.forEach((from, to) => {
        for (let k = 0; k < size; k++) data[to * size + k] = attribute.array[from * size + k];
      });
      geometry.setAttribute(name, new THREE.InstancedBufferAttribute(data, size, attribute.normalized, attribute.meshPerAttribute));
    }
    geometry.instanceCount = indices.length;

    box.makeEmpty();
    for (const i of indices) box.expandByPoint(point.set(positions.getX(i), positions.getY(i), positions.getZ(i)));
    box.expandByScalar(boundsMargin);
    geometry.boundingBox = box.clone();
    geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());

    const part = new THREE.Mesh(geometry, mesh.material);
    copyObjectState(mesh, part);
    part.frustumCulled = true;
    parts.push(part);
  }
  return parts;
}

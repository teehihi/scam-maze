import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  chunkInstancedMeshes,
  splitIndexedMeshIntoTiles,
  splitInstancedGeometryMesh,
  splitInstancedMesh,
} from './spatialChunking';

const material = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });

function instancedAt(positions: Array<[number, number, number]>): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, positions.length);
  const matrix = new THREE.Matrix4();
  positions.forEach(([x, y, z], i) => {
    matrix.setPosition(x, y, z);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.castShadow = true;
  mesh.userData.label = 'flora';
  return mesh;
}

describe('splitInstancedMesh', () => {
  it('keeps every instance and returns the original mesh when all instances share one cell', () => {
    const mesh = instancedAt([
      [1, 0, 1],
      [2, 0, 2],
      [3, 0, 3],
    ]);
    const parts = splitInstancedMesh(mesh, 80);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe(mesh);
  });

  it('splits far-apart instances into separate cells without losing any instance', () => {
    const mesh = instancedAt([
      [1, 0, 1],
      [2, 0, 2],
      [100, 0, 100],
      [101, 0, 101],
      [-200, 0, 5],
    ]);
    const parts = splitInstancedMesh(mesh, 50);
    const totalInstances = parts.reduce((sum, part) => sum + part.count, 0);
    expect(totalInstances).toBe(5);
    expect(parts.length).toBeGreaterThan(1);
    // Geometry and material are shared, not duplicated, so GPU memory does not grow.
    for (const part of parts) {
      expect(part.geometry).toBe(mesh.geometry);
      expect(part.material).toBe(mesh.material);
      expect(part.castShadow).toBe(true);
      expect(part.userData.label).toBe('flora');
    }
  });

  it('preserves each instance matrix after splitting', () => {
    const positions: Array<[number, number, number]> = [
      [5, 0, 5],
      [500, 0, 500],
    ];
    const mesh = instancedAt(positions);
    const parts = splitInstancedMesh(mesh, 50);
    const found = new Set<string>();
    for (const part of parts) {
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < part.count; i++) {
        part.getMatrixAt(i, matrix);
        const position = new THREE.Vector3();
        matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
        found.add(`${position.x},${position.z}`);
      }
    }
    expect(found).toEqual(new Set(['5,5', '500,500']));
  });

  it('preserves per-instance colors after splitting', () => {
    const mesh = instancedAt([
      [1, 0, 1],
      [500, 0, 500],
    ]);
    const colors = new Float32Array([1, 0, 0, 0, 1, 0]);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    const parts = splitInstancedMesh(mesh, 50);
    expect(parts.length).toBe(2);
    for (const part of parts) {
      expect(part.instanceColor).not.toBeNull();
      expect(part.instanceColor?.count).toBe(part.count);
    }
  });
});

describe('chunkInstancedMeshes', () => {
  it('replaces a spread-out InstancedMesh with per-cell parts under the same parent', () => {
    const root = new THREE.Group();
    const mesh = instancedAt([
      [1, 0, 1],
      [300, 0, 300],
    ]);
    root.add(mesh);

    const result = chunkInstancedMeshes(root, 50);

    expect(result).toEqual({ split: 1, created: 2 });
    const remaining: THREE.InstancedMesh[] = [];
    root.traverse((object) => {
      if ((object as THREE.InstancedMesh).isInstancedMesh) remaining.push(object as THREE.InstancedMesh);
    });
    expect(remaining).toHaveLength(2);
    expect(remaining.reduce((sum, m) => sum + m.count, 0)).toBe(2);
  });

  it('skips instanced meshes marked as dynamic', () => {
    const root = new THREE.Group();
    const mesh = instancedAt([
      [1, 0, 1],
      [300, 0, 300],
    ]);
    mesh.userData.dynamic = true;
    root.add(mesh);

    const result = chunkInstancedMeshes(root, 50);
    expect(result).toEqual({ split: 0, created: 0 });
    const remaining: THREE.InstancedMesh[] = [];
    root.traverse((object) => {
      if ((object as THREE.InstancedMesh).isInstancedMesh) remaining.push(object as THREE.InstancedMesh);
    });
    expect(remaining).toEqual([mesh]);
  });

  it('leaves a mesh untouched when every instance falls in one cell', () => {
    const root = new THREE.Group();
    const mesh = instancedAt([
      [1, 0, 1],
      [2, 0, 2],
    ]);
    root.add(mesh);
    const result = chunkInstancedMeshes(root, 500);
    expect(result).toEqual({ split: 0, created: 0 });
  });
});

describe('splitIndexedMeshIntoTiles', () => {
  function plane(width: number, depth: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, depth, Math.round(width), Math.round(depth));
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  function totalTriangles(meshes: THREE.Mesh[]): number {
    return meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? 0) / 3, 0);
  }

  it('splits a large indexed plane into tiles while preserving every triangle', () => {
    const mesh = plane(200, 200);
    const before = (mesh.geometry.index?.count ?? 0) / 3;

    const tiles = splitIndexedMeshIntoTiles(mesh, 64);

    expect(tiles.length).toBeGreaterThan(1);
    expect(totalTriangles(tiles)).toBe(before);
    for (const tile of tiles) {
      expect(tile.geometry.attributes.position).toBe(mesh.geometry.attributes.position);
      expect(tile.material).toBe(mesh.material);
      expect(tile.receiveShadow).toBe(true);
      expect(tile.geometry.boundingBox).not.toBeNull();
    }
  });

  it('expands tile bounds by the given margin', () => {
    const mesh = plane(200, 200);
    const noMargin = splitIndexedMeshIntoTiles(mesh, 64, 0);
    const margin = splitIndexedMeshIntoTiles(plane(200, 200), 64, 5);
    const sizeOf = (tile: THREE.Mesh) => {
      const size = new THREE.Vector3();
      (tile.geometry.boundingBox as THREE.Box3).getSize(size);
      return size.x;
    };
    // Every margin-expanded tile should be larger than its no-margin counterpart.
    expect(Math.min(...margin.map(sizeOf))).toBeGreaterThan(Math.min(...noMargin.map(sizeOf)));
  });

  it('returns the original mesh when it fits in a single tile', () => {
    const mesh = plane(2, 2);
    mesh.geometry.translate(100, 0, 100);
    const tiles = splitIndexedMeshIntoTiles(mesh, 500);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toBe(mesh);
  });

  it('returns the original mesh when the geometry has no index', () => {
    const geometry = new THREE.PlaneGeometry(10, 10);
    geometry.setIndex(null);
    const mesh = new THREE.Mesh(geometry, material);
    const tiles = splitIndexedMeshIntoTiles(mesh, 1);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toBe(mesh);
  });
});

describe('splitInstancedGeometryMesh', () => {
  function grassField(positions: Array<[number, number, number]>): THREE.Mesh {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 0, 1, 0, 0]), 3));
    const offsets = new Float32Array(positions.length * 3);
    positions.forEach(([x, y, z], i) => offsets.set([x, y, z], i * 3));
    geometry.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.instanceCount = positions.length;
    return new THREE.Mesh(geometry, material);
  }

  it('splits grass instances into per-cell meshes while keeping shared attributes', () => {
    const mesh = grassField([
      [1, 0, 1],
      [2, 0, 2],
      [200, 0, 200],
    ]);
    const parts = splitInstancedGeometryMesh(mesh, 50, 'instanceOffset', 1.5);

    expect(parts.length).toBeGreaterThan(1);
    const totalInstances = parts.reduce((sum, part) => sum + (part.geometry as THREE.InstancedBufferGeometry).instanceCount, 0);
    expect(totalInstances).toBe(3);
    for (const part of parts) {
      const geometry = part.geometry as THREE.InstancedBufferGeometry;
      expect(geometry.getAttribute('position')).toBe(mesh.geometry.getAttribute('position'));
      expect(part.frustumCulled).toBe(true);
      expect(geometry.boundingBox).not.toBeNull();
    }
  });

  it('preserves per-instance offset values after splitting', () => {
    const mesh = grassField([
      [5, 0, 5],
      [500, 0, 500],
    ]);
    const parts = splitInstancedGeometryMesh(mesh, 50, 'instanceOffset', 0);
    const found = new Set<string>();
    for (const part of parts) {
      const geometry = part.geometry as THREE.InstancedBufferGeometry;
      const attribute = geometry.getAttribute('instanceOffset');
      for (let i = 0; i < geometry.instanceCount; i++) {
        found.add(`${attribute.getX(i)},${attribute.getZ(i)}`);
      }
    }
    expect(found).toEqual(new Set(['5,5', '500,500']));
  });

  it('returns the original mesh when every instance falls in one cell', () => {
    const mesh = grassField([
      [1, 0, 1],
      [2, 0, 2],
    ]);
    const parts = splitInstancedGeometryMesh(mesh, 500, 'instanceOffset', 0);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe(mesh);
  });

  it('returns the original mesh when the position attribute is missing', () => {
    const mesh = grassField([[1, 0, 1]]);
    const parts = splitInstancedGeometryMesh(mesh, 10, 'missingAttribute', 0);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe(mesh);
  });
});

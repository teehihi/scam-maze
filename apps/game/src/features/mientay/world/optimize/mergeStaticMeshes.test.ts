import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { freezeStaticTransforms, mergeStaticMeshes } from './mergeStaticMeshes';

const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
const stone = new THREE.MeshStandardMaterial({ color: 0x777777 });

function box(material: THREE.Material, x: number, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function drawn(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
  });
  return meshes;
}

function triangles(meshes: THREE.Mesh[]): number {
  return meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
}

describe('mergeStaticMeshes', () => {
  it('merges meshes that share a material and keeps every triangle and position', () => {
    const root = new THREE.Group();
    const parent = new THREE.Group();
    parent.position.set(5, 0, 0);
    parent.add(box(wood, 0), box(wood, 2), box(wood, 4));
    root.add(parent);
    const before = triangles(drawn(root));

    const result = mergeStaticMeshes(root);

    const after = drawn(root);
    expect(result).toEqual({ removed: 3, created: 1 });
    expect(after).toHaveLength(1);
    expect(triangles(after)).toBe(before);
    // The parent's offset is baked in: the merged mesh spans x = 4.5 .. 9.5 in root space.
    after[0].geometry.computeBoundingBox();
    expect(after[0].geometry.boundingBox?.min.x).toBeCloseTo(4.5);
    expect(after[0].geometry.boundingBox?.max.x).toBeCloseTo(9.5);
  });

  it('keeps different materials apart and leaves a lone mesh alone', () => {
    const root = new THREE.Group();
    root.add(box(wood, 0), box(wood, 1), box(stone, 2));
    const result = mergeStaticMeshes(root);
    expect(result.created).toBe(1);
    expect(drawn(root)).toHaveLength(2);
  });

  it('does not touch dynamic subtrees, transparent meshes or instanced meshes', () => {
    const root = new THREE.Group();
    const dynamic = new THREE.Group();
    dynamic.userData.dynamic = true;
    dynamic.add(box(wood, 0), box(wood, 1));
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 });
    root.add(dynamic, box(glass, 2), box(glass, 3));
    root.add(new THREE.InstancedMesh(new THREE.BoxGeometry(), wood, 4));
    expect(mergeStaticMeshes(root)).toEqual({ removed: 0, created: 0 });
    expect(drawn(root)).toHaveLength(5);
  });

  it('merges a rigid unit inside itself, so the unit still moves as one', () => {
    const root = new THREE.Group();
    const boat = new THREE.Group();
    boat.userData.rigid = true;
    boat.position.set(-40, 0, 12);
    boat.rotation.y = 0.7;
    boat.add(box(wood, 0), box(wood, 1), box(wood, 2));
    root.add(boat, box(wood, 20), box(wood, 21));

    mergeStaticMeshes(root);

    // The boat keeps its own merged mesh (a child of the boat), separate from the rest of the root.
    const boatMeshes = drawn(boat);
    expect(boatMeshes).toHaveLength(1);
    expect(boat.position.x).toBe(-40);
    boatMeshes[0].geometry.computeBoundingBox();
    expect(boatMeshes[0].geometry.boundingBox?.min.x).toBeCloseTo(-0.5);
    expect(boatMeshes[0].geometry.boundingBox?.max.x).toBeCloseTo(2.5);
    expect(drawn(root)).toHaveLength(2);
  });

  it('keeps the facing of mirrored meshes', () => {
    const root = new THREE.Group();
    const mirrored = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wood);
    mirrored.scale.x = -1;
    const normal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wood);
    normal.position.x = 3;
    root.add(mirrored, normal);
    mergeStaticMeshes(root);

    const [merged] = drawn(root);
    const position = merged.geometry.attributes.position;
    const index = merged.geometry.index as THREE.BufferAttribute;
    // Every triangle must face +z, whether its source mesh was mirrored or not.
    for (let i = 0; i < index.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, index.getX(i));
      const b = new THREE.Vector3().fromBufferAttribute(position, index.getX(i + 1));
      const c = new THREE.Vector3().fromBufferAttribute(position, index.getX(i + 2));
      const faceNormal = b.sub(a).cross(c.sub(a));
      expect(faceNormal.z).toBeGreaterThan(0);
    }
  });

  it('freezes static transforms but not animated ones', () => {
    const root = new THREE.Group();
    const still = box(wood, 0);
    const moving = box(wood, 1);
    moving.userData.dynamic = true;
    root.add(still, moving);
    freezeStaticTransforms(root);
    expect(still.matrixAutoUpdate).toBe(false);
    expect(moving.matrixAutoUpdate).toBe(true);
  });
});

import * as THREE from 'three';

/**
 * Read-only measurements of the Mekong scene, exposed through `window.__MEKONG_DEBUG__` for
 * profiling. Nothing here runs during normal play.
 */

export interface GroupAudit {
  name: string;
  meshes: number;
  instancedMeshes: number;
  instances: number;
  /** Triangles in one pass, counting every instance. */
  triangles: number;
  shadowCasterTriangles: number;
  materials: number;
  uniqueGeometries: number;
  /** Largest bounding-sphere radius among instanced meshes (a huge one cannot be frustum culled). */
  maxInstancedRadius: number;
}

export interface TextureAudit {
  textures: number;
  uniqueSources: number;
  /** Approximate GPU memory with mipmaps, in MB. */
  megabytes: number;
  largest: Array<{ name: string; size: string; users: number }>;
}

function meshTriangles(mesh: THREE.Mesh): { triangles: number; instances: number } {
  const geometry = mesh.geometry;
  const base = (geometry.index ? geometry.index.count : (geometry.attributes.position?.count ?? 0)) / 3;
  if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
    const count = (mesh as THREE.InstancedMesh).count;
    return { triangles: base * count, instances: count };
  }
  const instanceCount = (geometry as THREE.InstancedBufferGeometry).isInstancedBufferGeometry
    ? (geometry as THREE.InstancedBufferGeometry).instanceCount
    : 0;
  if (instanceCount > 0 && Number.isFinite(instanceCount)) return { triangles: base * instanceCount, instances: instanceCount };
  return { triangles: base, instances: 1 };
}

export function auditGroups(scene: THREE.Scene): GroupAudit[] {
  const result: GroupAudit[] = [];
  for (const child of scene.children) {
    const audit: GroupAudit = {
      name: child.name || child.type,
      meshes: 0,
      instancedMeshes: 0,
      instances: 0,
      triangles: 0,
      shadowCasterTriangles: 0,
      materials: 0,
      uniqueGeometries: 0,
      maxInstancedRadius: 0,
    };
    const materials = new Set<THREE.Material>();
    const geometries = new Set<THREE.BufferGeometry>();
    child.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      audit.meshes++;
      const { triangles, instances } = meshTriangles(mesh);
      audit.triangles += triangles;
      if (mesh.castShadow) audit.shadowCasterTriangles += triangles;
      if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
        audit.instancedMeshes++;
        audit.instances += instances;
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        audit.maxInstancedRadius = Math.max(audit.maxInstancedRadius, mesh.geometry.boundingSphere?.radius ?? 0);
      }
      geometries.add(mesh.geometry);
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m && materials.add(m));
    });
    audit.materials = materials.size;
    audit.uniqueGeometries = geometries.size;
    if (audit.meshes > 0) result.push(audit);
  }
  return result;
}

export function auditTextures(scene: THREE.Scene): TextureAudit {
  const bySource = new Map<unknown, { name: string; w: number; h: number; users: number; bytes: number }>();
  const visit = (texture: THREE.Texture | null | undefined, label: string) => {
    if (!texture || !texture.isTexture) return;
    const image = texture.image as { width?: number; height?: number } | undefined;
    const w = image?.width ?? 0;
    const h = image?.height ?? 0;
    const key = texture.source ?? texture;
    const existing = bySource.get(key);
    if (existing) {
      existing.users++;
      return;
    }
    const mips = texture.generateMipmaps ? 4 / 3 : 1;
    bySource.set(key, { name: label, w, h, users: 1, bytes: w * h * 4 * mips });
  };
  let textures = 0;
  const seen = new Set<THREE.Material>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material || seen.has(material)) continue;
      seen.add(material);
      for (const [key, value] of Object.entries(material)) {
        if (value && (value as THREE.Texture).isTexture) {
          textures++;
          visit(value as THREE.Texture, `${material.name || material.type}.${key}`);
        }
      }
    }
  });
  const entries = [...bySource.values()];
  return {
    textures,
    uniqueSources: entries.length,
    megabytes: Math.round((entries.reduce((sum, e) => sum + e.bytes, 0) / 1048576) * 10) / 10,
    largest: entries
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map((e) => ({ name: e.name, size: `${e.w}x${e.h}`, users: e.users })),
  };
}

export function auditLights(scene: THREE.Scene): Record<string, number> {
  const counts: Record<string, number> = {};
  scene.traverse((object) => {
    const light = object as THREE.Light;
    if (!light.isLight) return;
    const key = `${light.type}${light.castShadow ? '+shadow' : ''}${light.visible ? '' : ' (hidden)'}`;
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
}

export interface MeshAudit {
  name: string;
  material: string;
  triangles: number;
  instances: number;
  trianglesPerInstance: number;
  castShadow: boolean;
  frustumCulled: boolean;
  /** World-space radius of the bounds the renderer culls with. */
  cullRadius: number;
}

export function topMeshes(scene: THREE.Scene, count = 14): MeshAudit[] {
  const list: MeshAudit[] = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const { triangles, instances } = meshTriangles(mesh);
    const instanced = mesh as THREE.InstancedMesh;
    let radius = 0;
    if (instanced.isInstancedMesh) {
      if (!instanced.boundingSphere) instanced.computeBoundingSphere();
      radius = instanced.boundingSphere?.radius ?? 0;
    } else {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      radius = mesh.geometry.boundingSphere?.radius ?? 0;
    }
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    list.push({
      name: mesh.name || mesh.parent?.name || mesh.geometry.type,
      material: material?.name || material?.type || '',
      triangles: Math.round(triangles),
      instances,
      trianglesPerInstance: Math.round(triangles / Math.max(1, instances)),
      castShadow: mesh.castShadow,
      frustumCulled: mesh.frustumCulled,
      cullRadius: Math.round(radius),
    });
  });
  return list.sort((a, b) => b.triangles - a.triangles).slice(0, count);
}

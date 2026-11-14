import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { STREET_PROPS_GLB } from '../../../config/assetPaths';
import type { Ctx } from './types';

/**
 * The street props that start the story: the banh mi cart, the battery-swap station and the
 * penguin trash bin. They come from the street environment the owner authored, cut out into a
 * small file, and are stood on the north sidewalk of the neighborhood street.
 */
export interface PropPlacement {
  /** Wrapper node name inside `street-props.optimized.glb`. */
  node: 'Prop_BanhMi' | 'Prop_BatterySwap' | 'Prop_TrashBin';
  x: number;
  z: number;
  /** Rotation around Y, in radians. */
  yaw: number;
  /** Uniform scale applied to the authored size. */
  scale?: number;
}

/** Sidewalk spots (north side of the street, z from -6 to -3.6). */
export const STREET_PROP_PLACEMENTS: readonly PropPlacement[] = [
  // Scales bring the authored sizes (cart 4.3 m tall, lockers 2.6 m, bin 1.7 m) to real-world ones.
  { node: 'Prop_BanhMi', x: -3.0, z: -4.7, yaw: 0, scale: 0.48 },
  { node: 'Prop_TrashBin', x: -5.6, z: -4.4, yaw: 0, scale: 0.62 },
  // Authored with its doors toward -Z; turned so the doors face the street, not the wall.
  { node: 'Prop_BatterySwap', x: 3.0, z: -5.45, yaw: Math.PI, scale: 0.74 },
];

/** Where the player stands when the story begins, and the direction they face. */
export const STORY_SPAWN = { x: -1.2, z: -1.4, yaw: 0.35 } as const;

export interface PlacedProp {
  node: string;
  group: THREE.Group;
  size: THREE.Vector3;
}

/**
 * Loads the props and adds them (with simple box colliders) to the world. Failure is not fatal:
 * the neighborhood stays walkable without them.
 */
export async function loadStreetProps(
  ctx: Ctx,
  placements: readonly PropPlacement[] = STREET_PROP_PLACEMENTS,
): Promise<PlacedProp[]> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(STREET_PROPS_GLB);
  const placed: PlacedProp[] = [];
  for (const placement of placements) {
    const holder = gltf.scene.getObjectByName(placement.node);
    if (!holder) {
      console.warn(`[khupho] street prop "${placement.node}" not found in ${STREET_PROPS_GLB}`);
      continue;
    }
    holder.removeFromParent();
    holder.position.set(0, 0, 0);
    holder.updateMatrixWorld(true);
    holder.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material as THREE.MeshStandardMaterial;
      // The street scene was authored for a flat, bright look; keep the surfaces from turning into mirrors in the rain.
      if (material && material.roughness !== undefined) material.roughness = Math.max(material.roughness, 0.45);
      if (material && 'metalness' in material) material.metalness = Math.min(material.metalness, 0.6);
    });
    // Stand the prop on the ground with its footprint centered on the pivot.
    const box = new THREE.Box3().setFromObject(holder);
    const center = box.getCenter(new THREE.Vector3());
    holder.position.set(-center.x, -box.min.y, -center.z);
    const pivot = new THREE.Group();
    pivot.name = placement.node;
    pivot.add(holder);
    pivot.scale.setScalar(placement.scale ?? 1);
    pivot.rotation.y = placement.yaw;
    pivot.position.set(placement.x, ctx.phys.floorAt(placement.x, placement.z, 1, 1).y, placement.z);
    ctx.root.add(pivot);
    pivot.updateMatrixWorld(true);
    const world = new THREE.Box3().setFromObject(pivot);
    const size = world.getSize(new THREE.Vector3());
    ctx.phys.addCol({ x0: world.min.x, x1: world.max.x, y0: world.min.y, y1: world.max.y, z0: world.min.z, z1: world.max.z, enabled: true });
    placed.push({ node: placement.node, group: pivot, size });
  }
  return placed;
}

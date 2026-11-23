import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { STREET_PROPS_GLB } from "../../../../config/assetPaths";

/**
 * The owner's street props (the same file and scales as the neighborhood, `khupho/world/streetProps.ts`):
 * the banh mi cart, the battery-swap station and the penguin trash bin. Each placement stands a copy on the
 * ground at (x, z) in the street's frame. Their colliders are added by the caller when the street is built.
 */
export type StreetPropNode = "Prop_BanhMi" | "Prop_BatterySwap" | "Prop_TrashBin";

export interface StreetPropPlacement {
  node: StreetPropNode;
  x: number;
  z: number;
  /** Ground height (sidewalk top). */
  y: number;
  /** Rotation around Y (radians). */
  yaw: number;
}

/** Brings the authored sizes (cart 4.3 m tall, lockers 2.6 m, bin 1.7 m) to real-world ones (as in the neighborhood). */
const SCALE: Record<StreetPropNode, number> = { Prop_BanhMi: 0.48, Prop_TrashBin: 0.62, Prop_BatterySwap: 0.74 };

/** Loads the props once and places a copy at every placement. Failure is not fatal: the street works without them. */
export async function placeStreetProps(
  parent: T.Object3D,
  placements: readonly StreetPropPlacement[],
  onAssetLoaded?: (obj: T.Object3D) => void,
): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
  try {
    gltf = await loader.loadAsync(STREET_PROPS_GLB);
  } catch (error) {
    console.warn("[openworld] street props failed to load", error);
    return;
  }
  const templates = new Map<StreetPropNode, T.Object3D>();
  for (const node of Object.keys(SCALE) as StreetPropNode[]) {
    const holder = gltf.scene.getObjectByName(node);
    if (!holder) {
      console.warn(`[openworld] street prop "${node}" not found in ${STREET_PROPS_GLB}`);
      continue;
    }
    holder.removeFromParent();
    holder.position.set(0, 0, 0);
    holder.updateMatrixWorld(true);
    holder.traverse((o) => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material as T.MeshStandardMaterial;
      // Authored for a flat, bright look: keep the surfaces from turning into mirrors on the wet street.
      if (material && material.roughness !== undefined) material.roughness = Math.max(material.roughness, 0.45);
      if (material && "metalness" in material) material.metalness = Math.min(material.metalness, 0.6);
    });
    // Footprint centred on the pivot, standing on the ground.
    const box = new T.Box3().setFromObject(holder);
    const center = box.getCenter(new T.Vector3());
    holder.position.set(-center.x, -box.min.y, -center.z);
    const pivot = new T.Group();
    pivot.add(holder);
    pivot.scale.setScalar(SCALE[node]);
    templates.set(node, pivot);
  }
  for (const p of placements) {
    const template = templates.get(p.node);
    if (!template) continue;
    const copy = template.clone(true);
    copy.name = p.node;
    copy.position.set(p.x, p.y, p.z);
    copy.rotation.y = p.yaw;
    parent.add(copy);
    onAssetLoaded?.(copy);
  }
}

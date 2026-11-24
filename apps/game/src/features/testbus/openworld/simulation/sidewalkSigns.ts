import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { STREET_PROPS_MODELS_BASE } from "../../../../config/assetPaths";
import { rect, type Solid } from "./boarding";

/**
 * Standing A-board signs (`bienhieu1.glb`, scripts/optimize-street-props.cjs) along the east sidewalk, in front of the
 * shops. The model has one printed face (+Z) and a plain back, so each sign is turned about 35 degrees from the
 * road, alternating left and right, so people walking either way along the pavement see the face.
 */
export const SIGN_FILE = `${STREET_PROPS_MODELS_BASE}/bienhieu1.optimized.glb`;
/** Real-world height of the sign (m); the source is authored 1.01 m. */
const SIGN_HEIGHT = 1.0;
/** Footprint used for the collider and for the overlap test (m). */
const FOOTPRINT = { width: 0.62, depth: 0.5 };
/** Free space (m) kept around a sign, so it never sits against a parked scooter, stool or tree. */
const CLEARANCE = 0.2;

export interface SignSpot { x: number; z: number }

const overlaps = (a: Solid, b: Solid, margin: number) => a.x0 - margin < b.x1 && a.x1 + margin > b.x0 && a.z0 - margin < b.z1 && a.z1 + margin > b.z0;

/**
 * The candidates that do not touch an existing collider. Each accepted sign is added to `solids` (so the player and the
 * next candidates see it).
 */
export function freeSignSpots(candidates: readonly SignSpot[], solids: Solid[]): SignSpot[] {
  const accepted: SignSpot[] = [];
  for (const c of candidates) {
    const box = rect(c.x, c.z, FOOTPRINT.width, FOOTPRINT.depth);
    if (solids.some((s) => overlaps(box, s, CLEARANCE))) continue;
    solids.push(rect(c.x, c.z, 0.5, 0.2));
    accepted.push(c);
  }
  return accepted;
}

/** Loads the sign once and stands a copy on each spot (`y` = sidewalk top). A failed load only leaves the street without signs. */
export async function placeSidewalkSigns(parent: T.Object3D, spots: readonly SignSpot[], y: number, onAssetLoaded?: (obj: T.Object3D) => void): Promise<void> {
  if (!spots.length) return;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
  try {
    gltf = await loader.loadAsync(SIGN_FILE);
  } catch (error) {
    console.warn("[openworld] sidewalk sign failed to load", error);
    return;
  }
  const holder = gltf.scene;
  holder.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const material = mesh.material as T.MeshStandardMaterial;
    // The scan carries metallic = roughness = 1 factors for its packed texture: keep the print from turning dark and mirror-like.
    if (material && "metalness" in material) { material.metalness = Math.min(material.metalness, 0.15); material.roughness = Math.max(material.roughness, 0.6); }
  });
  // Footprint centred on the pivot, standing on the ground.
  const box = new T.Box3().setFromObject(holder);
  const center = box.getCenter(new T.Vector3());
  holder.position.set(-center.x, -box.min.y, -center.z);
  const pivot = new T.Group();
  pivot.add(holder);
  pivot.scale.setScalar(SIGN_HEIGHT / Math.max(0.01, box.max.y - box.min.y));
  spots.forEach((spot, i) => {
    const copy = pivot.clone(true);
    copy.name = "Prop_SidewalkSign";
    copy.position.set(spot.x, y, spot.z);
    copy.rotation.y = -Math.PI / 2 + (i % 2 ? 0.6 : -0.6);
    parent.add(copy);
    onAssetLoaded?.(copy);
  });
}

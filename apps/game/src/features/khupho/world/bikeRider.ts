import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BIKE_RIDER_GLB } from '../../../config/assetPaths';

/**
 * Scooter-and-rider model for the street traffic (scripts/optimize-bike-rider.cjs). Every bike
 * is a THREE.LOD that clones the shared levels (geometry and material are shared, not copied):
 * LOD0 close up, LOD1 at mid range, LOD2 (one merged mesh) far away, nothing past HIDE_DISTANCE.
 */
export interface BikeRiderTemplate {
  levels: THREE.Object3D[];
}

/** The source bike is ~0.97 m long with ~0.14 m wheels; this brings it to a real scooter (~1.85 m). */
export const BIKE_RIDER_SCALE = 1.9;
/** Rim radius in model units (the tyre stays with the chassis, see the optimizer script). */
const WHEEL_RADIUS = 0.14;
/** Camera distance (m) where LOD1 and LOD2 take over. */
const LOD_DISTANCES = [0, 6, 16];
/** Beyond this distance (m) a bike is a few pixels tall and is not drawn at all. */
const HIDE_DISTANCE = 60;
/** Largest head turn toward the player while stopped (radians). */
const HEAD_TURN_MAX = 0.9;

export async function loadBikeRider(): Promise<BikeRiderTemplate> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(BIKE_RIDER_GLB);
  const levels = ['BikeRider_LOD0', 'BikeRider_LOD1', 'BikeRider_LOD2'].map((name) => {
    const level = gltf.scene.getObjectByName(name);
    if (!level) throw new Error(`[khupho] "${name}" missing in ${BIKE_RIDER_GLB}`);
    level.removeFromParent();
    level.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = name !== 'BikeRider_LOD2';
    });
    return level;
  });
  return { levels };
}

/** One bike instance: the LOD object plus the parts the game turns. */
export class BikeRiderInstance {
  readonly object: THREE.LOD;
  private readonly wheels: THREE.Object3D[] = [];
  private readonly heads: THREE.Object3D[] = [];
  private wheelAngle = 0;
  private headYaw = 0;

  constructor(template: BikeRiderTemplate) {
    this.object = new THREE.LOD();
    template.levels.forEach((level, i) => {
      const copy = level.clone();
      copy.traverse((o) => {
        if (o.name === 'FrontWheel' || o.name === 'RearWheel') this.wheels.push(o);
        else if (o.name === 'Head') this.heads.push(o);
      });
      this.object.addLevel(copy, LOD_DISTANCES[i], 0.1);
    });
    this.object.addLevel(new THREE.Object3D(), HIDE_DISTANCE, 0.05);
    this.object.scale.setScalar(BIKE_RIDER_SCALE);
  }

  /**
   * Turns the wheels for `speed` (m/s) and, while stopped, the rider's head toward `look`
   * (local yaw, radians, 0 = straight ahead), otherwise back to the road.
   */
  update(dt: number, speed: number, look: number | null) {
    this.wheelAngle = (this.wheelAngle + (speed * dt) / (WHEEL_RADIUS * BIKE_RIDER_SCALE)) % (Math.PI * 2);
    for (const w of this.wheels) w.rotation.x = this.wheelAngle;
    const target = look === null ? 0 : THREE.MathUtils.clamp(look, -HEAD_TURN_MAX, HEAD_TURN_MAX);
    this.headYaw += (target - this.headYaw) * Math.min(1, dt * 2.5);
    for (const h of this.heads) h.rotation.y = this.headYaw;
  }
}

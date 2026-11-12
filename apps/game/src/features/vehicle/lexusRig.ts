import * as THREE from "three";

/** Standalone Lexus GX 550 model, extracted from the street GLB (Meshopt + WebP). */
export const LEXUS_MODEL_PATH = "/assets/3d/vehicles/lexus-gx550.glb";

/** Steering wheel hub centre in car-local, left-hand-drive space. */
const WHEEL_CENTER = new THREE.Vector3(0.493, 1.565, 0.363);

/** Materials whose textures were authored upside down (badge, instrument cluster, touchscreen). */
const isFlippedMaterial = (name: string) => {
  const lower = name.toLowerCase();
  return lower.includes("llogo") || lower.includes("81481") || lower.includes("zk_obj007");
};

const enableDynamicMatrix = (obj: THREE.Object3D) => {
  obj.matrixAutoUpdate = true;
  obj.children.forEach(enableDynamicMatrix);
};

/** First node whose name contains "lexus" (case-insensitive). */
export function findLexusNode(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (!found && obj.name.toLowerCase().includes("lexus")) found = obj;
  });
  return found;
}

/**
 * Wraps the Lexus model in a drivable pivot group.
 *
 * The pivot sits at the car's original world position with zero rotation; the model keeps its
 * world orientation and scale as a child. The steering-wheel parts are re-parented to
 * `pivot.userData.steeringPivot` so they can turn around the steering column.
 * The caller adds the returned pivot to its scene.
 */
export function buildLexusPivot(lexusObj: THREE.Object3D): THREE.Group {
  enableDynamicMatrix(lexusObj);
  lexusObj.updateWorldMatrix(true, true);

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  lexusObj.getWorldPosition(worldPos);
  lexusObj.getWorldQuaternion(worldQuat);
  lexusObj.getWorldScale(worldScale);

  const carPivot = new THREE.Group();
  carPivot.name = "LexusCarPivot";
  carPivot.position.copy(worldPos);

  // Original left-hand-drive geometry, no mirroring.
  carPivot.add(lexusObj);
  lexusObj.position.set(0, 0, 0);
  lexusObj.quaternion.copy(worldQuat);
  lexusObj.scale.copy(worldScale);

  lexusObj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      m.side = THREE.DoubleSide;
      const map = (m as THREE.MeshStandardMaterial).map;
      if (isFlippedMaterial(m.name || "") && map && !map.userData.invertedY) {
        map.userData.invertedY = true;
        map.repeat.y = -1;
        map.offset.y = 1;
        map.updateMatrix();
        map.needsUpdate = true;
      }
    }
  });

  // Steering wheel (NS_ZK_OBJ031): direct children of RootNode, so rim, spokes and logo move together.
  const steerParts: THREE.Object3D[] = [];
  lexusObj.traverse((child) => {
    if (child.name?.includes("NS_ZK_OBJ031") && child.parent?.name?.includes("RootNode")) {
      steerParts.push(child);
    }
  });
  if (steerParts.length > 0) {
    const steeringPivot = new THREE.Group();
    steeringPivot.name = "LexusSteeringPivot";
    steeringPivot.position.copy(WHEEL_CENTER);
    carPivot.add(steeringPivot);
    carPivot.updateMatrixWorld(true);
    steerParts.forEach((part) => steeringPivot.attach(part));
    carPivot.userData.steeringPivot = steeringPivot;
  }

  return carPivot;
}

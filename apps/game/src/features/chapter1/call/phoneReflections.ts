/**
 * Studio reflections for the call phone only.
 *
 * Metal and glass look flat black without something to reflect, and the chapter street has no
 * environment map. This builds a small studio reflection map from three's procedural
 * `RoomEnvironment` (no file, no network) and assigns it to the phone's own materials. It never
 * sets `scene.environment`, adds no light and does not change how the street is lit.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Blur of the prefiltered map; a little softness hides the low-poly studio boxes. */
const REFLECTION_SIGMA = 0.04;

/** Creates the prefiltered reflection texture. The caller disposes it. */
export function createPhoneReflectionMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = generator.fromScene(room, REFLECTION_SIGMA);
  room.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
  generator.dispose();
  return target.texture;
}

/** How strongly each phone material reflects the studio map, by material name. */
function reflectionIntensity(name: string): number {
  if (/glass|sapphire|mirror|lens/i.test(name)) return 1.6;
  if (/alumin|metal|screw|frame/i.test(name)) return 1.25;
  return 0.8;
}

/**
 * Clones every material of the phone (so the cached model is never changed) and gives it the
 * reflection map. Returns the cloned materials so the caller can dispose them.
 */
export function applyPhoneReflections(root: THREE.Object3D, envMap: THREE.Texture): THREE.Material[] {
  const cloned: THREE.Material[] = [];
  const cloneOne = (material: THREE.Material): THREE.Material => {
    const copy = material.clone();
    if (copy instanceof THREE.MeshStandardMaterial) {
      copy.envMap = envMap;
      copy.envMapIntensity = reflectionIntensity(copy.name);
    }
    cloned.push(copy);
    return copy;
  };
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneOne) : cloneOne(mesh.material);
  });
  return cloned;
}
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { LEXUS_MODEL_PATH, buildLexusPivot, findLexusNode } from "./lexusRig";

const meshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

interface LexusVehicleProps {
  /** Where the car is parked: ground position under the car origin. */
  position: [number, number, number];
  /** Heading in radians; 0 faces +Z, matching the vehicle physics. */
  yaw?: number;
  castShadow?: boolean;
  /** Receives the drivable pivot; pass it to FirstPersonPlayer as `carPivotRef`. */
  onCarLoaded?: (carPivot: THREE.Group) => void;
}

/**
 * Places the standalone Lexus GX 550 in any map. The pivot is reset to `position`/`yaw`
 * every time the component mounts, so a car driven earlier starts parked again.
 */
export const LexusVehicle: React.FC<LexusVehicleProps> = ({ position, yaw = 0, castShadow = false, onCarLoaded }) => {
  const gltf = useLoader(GLTFLoader, LEXUS_MODEL_PATH, meshopt);

  const pivot = useMemo(() => {
    const cached = gltf.scene.userData.carPivot as THREE.Group | undefined;
    if (cached) return cached;
    const lexus = findLexusNode(gltf.scene);
    if (!lexus) return null;
    const built = buildLexusPivot(lexus);
    gltf.scene.userData.carPivot = built;
    return built;
  }, [gltf]);

  const [x, y, z] = position;
  useEffect(() => {
    if (!pivot) return;
    pivot.position.set(x, y, z);
    pivot.rotation.set(0, yaw, 0, "YXZ");
    (pivot.userData.steeringPivot as THREE.Group | undefined)?.quaternion.identity();
    pivot.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = castShadow;
        mesh.receiveShadow = castShadow;
      }
    });
    onCarLoaded?.(pivot);
  }, [pivot, x, y, z, yaw, castShadow, onCarLoaded]);

  return pivot ? <primitive object={pivot} /> : null;
};

useLoader.preload(GLTFLoader, LEXUS_MODEL_PATH, meshopt);

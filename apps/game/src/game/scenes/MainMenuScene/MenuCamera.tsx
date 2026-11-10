import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STREET_CONFIG } from "./StreetComposition";

interface MenuCameraProps {
  fov: number;
}

export const MenuCamera: React.FC<MenuCameraProps> = ({ fov }) => {
  const { camera } = useThree();
  const currentLookAt = useRef(new THREE.Vector3(...STREET_CONFIG.camera.targetPosition));

  const [baseX, baseY, baseZ] = STREET_CONFIG.camera.defaultPosition;
  const [targetX, targetY, targetZ] = STREET_CONFIG.camera.targetPosition;

  useFrame((state, delta) => {
    // Dynamic FOV update
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const time = state.clock.getElapsedTime();

    // Subtle breathing idle motion (gentle human eye-level presence)
    const breathY = Math.sin(time * 1.1) * 0.012 + Math.cos(time * 0.6) * 0.008;
    const swayX = Math.sin(time * 0.45) * 0.012;

    // Restrained mouse parallax: keeps framing locked to the authored scene while adding life
    const mouseShiftX = state.pointer.x * 0.35;
    const mouseShiftY = state.pointer.y * 0.18;

    const desiredCamX = baseX + swayX + state.pointer.x * 0.04;
    const desiredCamY = baseY + breathY + state.pointer.y * 0.03;
    const desiredCamZ = baseZ;

    // Smooth lerp camera position
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredCamX, delta * 3.0);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredCamY, delta * 3.0);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredCamZ, delta * 3.0);

    // Target look-at calculation
    const desiredTarget = new THREE.Vector3(
      targetX + mouseShiftX,
      targetY + mouseShiftY + breathY * 0.3,
      targetZ
    );

    currentLookAt.current.lerp(desiredTarget, delta * 3.5);
    camera.lookAt(currentLookAt.current);
  });

  return null;
};

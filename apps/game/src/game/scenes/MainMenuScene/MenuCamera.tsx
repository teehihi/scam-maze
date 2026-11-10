import React, { useRef, useLayoutEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { STREET_CONFIG } from "./StreetComposition";

interface MenuCameraProps {
  fov: number;
}

export const MenuCamera: React.FC<MenuCameraProps> = ({ fov }) => {
  const { camera } = useThree();
  const currentLookAt = useRef(new THREE.Vector3(...STREET_CONFIG.camera.targetPosition));
  const desiredTarget = useRef(new THREE.Vector3(...STREET_CONFIG.camera.targetPosition));
  const isInitialized = useRef(false);

  const [baseX, baseY, baseZ] = STREET_CONFIG.camera.defaultPosition;
  const [targetX, targetY, targetZ] = STREET_CONFIG.camera.targetPosition;

  // Immediately lock camera position and look-at so there is never an unoriented initial frame
  useLayoutEffect(() => {
    camera.position.set(baseX, baseY, baseZ);
    camera.lookAt(targetX, targetY, targetZ);
    currentLookAt.current.set(targetX, targetY, targetZ);
    desiredTarget.current.set(targetX, targetY, targetZ);
    camera.updateMatrixWorld(true);
  }, [camera, baseX, baseY, baseZ, targetX, targetY, targetZ]);

  useFrame((state, delta) => {
    // Dynamic FOV update
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Guard against delta spikes (e.g. background tab or heavy model parsing)
    const dt = Math.min(delta, 0.05);
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

    // Zero-allocation target vector reuse
    desiredTarget.current.set(
      targetX + mouseShiftX,
      targetY + mouseShiftY + breathY * 0.3,
      targetZ
    );

    // If first frame, snap directly to eliminate any lerp swing from a cold start
    if (!isInitialized.current) {
      camera.position.set(desiredCamX, desiredCamY, desiredCamZ);
      currentLookAt.current.copy(desiredTarget.current);
      camera.lookAt(currentLookAt.current);
      isInitialized.current = true;
      return;
    }

    // Smooth lerp camera position
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredCamX, dt * 3.0);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredCamY, dt * 3.0);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredCamZ, dt * 3.0);

    currentLookAt.current.lerp(desiredTarget.current, dt * 3.5);
    camera.lookAt(currentLookAt.current);
  });

  return null;
};

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { STREET_CONFIG } from "./StreetComposition";

const SKY_TEXTURE_PATH = "/assets/3d/textures/sky.png";
useTexture.preload(SKY_TEXTURE_PATH);

export const SkyDome: React.FC = () => {
  const texture = useTexture(SKY_TEXTURE_PATH);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const skyRef = useRef<THREE.Mesh>(null);

  // Gentle atmospheric cloud drift across the city skyline
  useFrame((_, delta) => {
    if (skyRef.current) {
      skyRef.current.rotation.y += delta * 0.006;
    }
  });

  const [camX, , camZ] = STREET_CONFIG.camera.defaultPosition;

  return (
    <mesh
      ref={skyRef}
      position={[camX, -135, camZ]}
      rotation={[0, Math.PI / 3, 0]}
    >
      <sphereGeometry args={[380, 64, 40]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
};

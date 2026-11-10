import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { HCMThemeId } from "./types";

const SKY_TEXTURE_PATH = "/assets/3d/textures/saigon_sky.png";
useTexture.preload(SKY_TEXTURE_PATH);

interface HCMSkyProps {
  theme: HCMThemeId;
}

export const HCMSky: React.FC<HCMSkyProps> = ({ theme }) => {
  const texture = useTexture(SKY_TEXTURE_PATH);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(2.5, 1);

  const skyRef = useRef<THREE.Mesh>(null);

  // Gentle atmospheric cloud drift across the Saigon skyline
  useFrame((_, delta) => {
    if (skyRef.current) {
      skyRef.current.rotation.y += delta * 0.003;
    }
  });

  // Theme-specific sky tint
  let tintColor = "#ffffff";
  if (theme === "sunset") {
    tintColor = "#fca5a5"; // Golden rose sunset tint
  } else if (theme === "cyberpunk") {
    tintColor = "#1e1b4b"; // Deep midnight indigo
  } else if (theme === "blueprint") {
    tintColor = "#1e293b";
  }

  return (
    <mesh
      ref={skyRef}
      position={[0, -12, 0]}
      rotation={[0, Math.PI / 3, 0]}
    >
      {/* 360-degree expansive sky dome spanning over 500m */}
      <sphereGeometry args={[260, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      <meshBasicMaterial
        map={texture}
        color={tintColor}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
};

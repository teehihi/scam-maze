import React from "react";
import { STREET_CONFIG } from "./StreetComposition";
import type { GraphicsQuality } from "@scammaze/shared-types";

interface EnvironmentLightingProps {
  graphicsQuality: GraphicsQuality;
}

export const EnvironmentLighting: React.FC<EnvironmentLightingProps> = ({
  graphicsQuality,
}) => {
  const isHigh = graphicsQuality === "high";
  const isLow = graphicsQuality === "low";

  return (
    <>
      {/* Ambient Skylight (Soft, clean daytime illumination - no washed out glare) */}
      <ambientLight color="#f0f5fa" intensity={0.7} />

      {/* Natural Hemisphere Light (Sky bounce from above, soft warm ground bounce from below) */}
      <hemisphereLight
        color="#c8e2fb"
        groundColor="#4a443a"
        intensity={0.55}
      />

      {/* Main Directional Sun (Crisp angled sunlight, realistic natural contrast without overexposing) */}
      <directionalLight
        position={[160, -40, -110]}
        color="#fffaf0"
        intensity={1.45}
        castShadow={isHigh}
        shadow-mapSize-width={isHigh ? 2048 : 1024}
        shadow-mapSize-height={isHigh ? 2048 : 1024}
        shadow-camera-near={1.0}
        shadow-camera-far={200}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0002}
      />

      {/* Warm Street Lamp Point Lights along sidewalks (omitted on Low to save mobile/integrated GPU fillrate) */}
      {!isLow &&
        STREET_CONFIG.streetLights.map((light, index) => (
          <group key={`streetlight-${index}`} position={light.position}>
            <pointLight
              color={light.color}
              intensity={light.intensity}
              distance={light.distance}
              decay={2}
            />
            {/* Glowing lantern bulb marker */}
            <mesh>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshBasicMaterial color="#ffe399" />
            </mesh>
          </group>
        ))}
    </>
  );
};

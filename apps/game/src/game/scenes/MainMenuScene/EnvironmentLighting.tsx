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

  return (
    <>
      {/* Clear natural sky color (Crisp afternoon daylight) */}
      <color attach="background" args={["#86a9d2"]} />

      {/* Subtle distant horizon fog - pushed far back so street & buildings stay razor sharp */}
      <fog attach="fog" args={["#86a9d2", 220, 520]} />

      {/* Ambient Skylight (Soft sky illumination so shadows are clean and never pitch black) */}
      <ambientLight color="#dbe7f7" intensity={1.2} />

      {/* Natural Hemisphere Light (Sky bounce from above, warm pavement bounce from below) */}
      <hemisphereLight
        color="#a5c9f0"
        groundColor="#5c5344"
        intensity={1.0}
      />

      {/* Main Directional Sun (Crisp angled sunlight illuminating the avenue) */}
      <directionalLight
        position={[35, 65, -15]}
        color="#fff8ed"
        intensity={2.8}
        castShadow={isHigh}
        shadow-mapSize-width={isHigh ? 2048 : 1024}
        shadow-mapSize-height={isHigh ? 2048 : 1024}
        shadow-camera-near={1.0}
        shadow-camera-far={220}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-bias={-0.0003}
      />

      {/* Warm Street Lamp Point Lights along sidewalks */}
      {STREET_CONFIG.streetLights.map((light, index) => (
        <group key={`streetlight-${index}`} position={light.position}>
          <pointLight
            color={light.color}
            intensity={light.intensity}
            distance={light.distance}
            decay={2}
          />
          {/* Glowing lantern bulb marker */}
          <mesh>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshBasicMaterial color="#ffe399" />
          </mesh>
        </group>
      ))}
    </>
  );
};

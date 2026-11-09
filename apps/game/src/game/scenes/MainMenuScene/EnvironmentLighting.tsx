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

      {/* Atmospheric distance fog matching sky */}
      <fog attach="fog" args={["#86a9d2", 55, 175]} />

      {/* Ambient Skylight (Soft sky illumination so shadows are never pitch black) */}
      <ambientLight color="#dbe7f7" intensity={1.15} />

      {/* Natural Hemisphere Light (Sky bounce from above, warm pavement bounce from below) */}
      <hemisphereLight
        color="#a5c9f0"
        groundColor="#5c5344"
        intensity={0.95}
      />

      {/* Main Directional Sun (Crisp angled sunlight creating depth and architectural shadows) */}
      <directionalLight
        position={[38, 52, 28]}
        color="#fff7eb"
        intensity={2.5}
        castShadow={isHigh}
        shadow-mapSize-width={isHigh ? 2048 : 1024}
        shadow-mapSize-height={isHigh ? 2048 : 1024}
        shadow-camera-near={1.0}
        shadow-camera-far={160}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0004}
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

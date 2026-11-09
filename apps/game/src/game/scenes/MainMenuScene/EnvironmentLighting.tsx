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
      {/* Background color matching dark palette */}
      <color attach="background" args={["#13111f"]} />

      {/* Atmospheric distance fog fading street into the horizon */}
      <fog attach="fog" args={["#151324", 25, 105]} />

      {/* Ambient Fill */}
      <ambientLight color="#36314f" intensity={0.7} />

      {/* Soft Hemisphere sky/ground gradient */}
      <hemisphereLight
        color="#8372aa"
        groundColor="#231d2e"
        intensity={0.55}
      />

      {/* Directional Sunlight (Warm Morning / Golden Hour Sun) */}
      <directionalLight
        position={[28, 35, 20]}
        color="#ffeed8"
        intensity={1.5}
        castShadow={isHigh}
        shadow-mapSize-width={isHigh ? 2048 : 1024}
        shadow-mapSize-height={isHigh ? 2048 : 1024}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-bias={-0.0005}
      />

      {/* Street Lantern Point Lights & Glow Bulbs */}
      {STREET_CONFIG.streetLights.map((light, index) => (
        <group key={`streetlight-${index}`} position={light.position}>
          <pointLight
            color={light.color}
            intensity={light.intensity}
            distance={light.distance}
            decay={2}
          />
          {/* Subtle glowing bulb sphere */}
          <mesh>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshBasicMaterial color="#ffe8aa" />
          </mesh>
        </group>
      ))}
    </>
  );
};

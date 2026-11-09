import React, { Suspense } from "react";
import { EnvironmentLighting } from "./EnvironmentLighting";
import { MenuCamera } from "./MenuCamera";
import { StreetEnvironment } from "./StreetEnvironment";
import type { GameSettings } from "@scammaze/shared-types";

interface MainMenuSceneProps {
  settings: GameSettings;
}

export const MainMenuScene: React.FC<MainMenuSceneProps> = ({ settings }) => {
  const isHighQuality = settings.graphicsQuality === "high";

  return (
    <>
      <MenuCamera fov={settings.fov} />
      <EnvironmentLighting graphicsQuality={settings.graphicsQuality} />

      <Suspense fallback={<SceneLoadingPlaceholder />}>
        <StreetEnvironment shadows={isHighQuality} />
      </Suspense>
    </>
  );
};

const SceneLoadingPlaceholder: React.FC = () => {
  return (
    <group position={[0, 0, 0]}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1827" />
      </mesh>
    </group>
  );
};

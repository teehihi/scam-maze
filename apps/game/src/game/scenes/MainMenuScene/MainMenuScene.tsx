import React, { Suspense } from "react";
import { EnvironmentLighting } from "./EnvironmentLighting";
import { MenuCamera } from "./MenuCamera";
import { SkyDome } from "./SkyDome";
import { StreetEnvironment } from "./StreetEnvironment";
import type { GameSettings } from "@scammaze/shared-types";

interface MainMenuSceneProps {
  settings: GameSettings;
  onSceneReady?: () => void;
}

export const MainMenuScene: React.FC<MainMenuSceneProps> = ({
  settings,
  onSceneReady,
}) => {
  const isHighQuality = settings.graphicsQuality === "high";

  return (
    <>
      <MenuCamera fov={settings.fov} />
      <EnvironmentLighting graphicsQuality={settings.graphicsQuality} />

      <Suspense fallback={null}>
        <SkyDome />
        <StreetEnvironment shadows={isHighQuality} onReady={onSceneReady} />
      </Suspense>
    </>
  );
};

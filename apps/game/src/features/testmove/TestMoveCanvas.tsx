import React, { Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { EnvironmentLighting } from "../../game/scenes/MainMenuScene/EnvironmentLighting";
import { SkyDome } from "../../game/scenes/MainMenuScene/SkyDome";
import { StreetEnvironment } from "../../game/scenes/MainMenuScene/StreetEnvironment";
import { FirstPersonPlayer, type PlayerControlsState, type PlayerStats } from "../player";
import type { GameSettings } from "@scammaze/shared-types";

interface TestMoveCanvasProps {
  settings: GameSettings;
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
  keysRef: React.MutableRefObject<PlayerControlsState>;
  onStatsUpdate: (stats: PlayerStats) => void;
  onSceneReady?: () => void;
}

const STREET_SPAWN: [number, number, number] = [188.6, -92.70, -88.89];

const STREET_BOUNDS = {
  minX: 180.0,
  maxX: 198.5,
  minZ: -92.0,
  maxZ: 52.0,
  groundY: -92.70,
};

export const TestMoveCanvas: React.FC<TestMoveCanvasProps> = ({
  settings,
  consumeMovement,
  consumePunchTrigger,
  consumeInspectTrigger,
  consumeInteractTrigger,
  keysRef,
  onStatsUpdate,
  onSceneReady,
}) => {
  const carPivotRef = useRef<THREE.Group | null>(null);

  return (
    <Canvas
      shadows={settings.graphicsQuality === "high"}
      gl={{
        antialias: settings.graphicsQuality !== "low",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        powerPreference: "high-performance",
      }}
      camera={{
        fov: 70,
        near: 0.05,
        far: 1200,
      }}
      className="w-full h-full"
    >
      {/* Sky Dome with drifting clouds */}
      <Suspense fallback={null}>
        <SkyDome />
      </Suspense>

      {/* Ambient & Directional Sunlight */}
      <EnvironmentLighting graphicsQuality={settings.graphicsQuality} />

      {/* 3D Vietnamese Urban Street Environment */}
      <Suspense fallback={null}>
        <StreetEnvironment
          shadows={settings.graphicsQuality === "high"}
          onReady={onSceneReady}
          onCarLoaded={(pivot) => {
            carPivotRef.current = pivot;
          }}
        />
      </Suspense>

      {/* Shared Unified First Person Player with Animated Arms and Locomotion */}
      <Suspense fallback={null}>
        <FirstPersonPlayer
          spawnPosition={STREET_SPAWN}
          spawnYaw={Math.PI}
          bounds={STREET_BOUNDS}
          consumeMovement={consumeMovement}
          consumePunchTrigger={consumePunchTrigger}
          consumeInspectTrigger={consumeInspectTrigger}
          consumeInteractTrigger={consumeInteractTrigger}
          keysRef={keysRef}
          onStatsUpdate={onStatsUpdate}
          soundEnabled={settings.soundEnabled}
          sfxVolume={settings.sfxVolume}
          carPivotRef={carPivotRef}
        />
      </Suspense>
    </Canvas>
  );
};

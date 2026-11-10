import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { EnvironmentLighting } from "../../game/scenes/MainMenuScene/EnvironmentLighting";
import { SkyDome } from "../../game/scenes/MainMenuScene/SkyDome";
import { StreetEnvironment } from "../../game/scenes/MainMenuScene/StreetEnvironment";
import { TestMovePlayer } from "./TestMovePlayer";
import type { GameSettings } from "@scammaze/shared-types";

interface TestMoveCanvasProps {
  settings: GameSettings;
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  keysRef: React.MutableRefObject<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    sprint: boolean;
    jump: boolean;
    punch: boolean;
    inspect: boolean;
  }>;
  onStatsUpdate: (stats: {
    position: [number, number, number];
    speed: number;
    isSprinting: boolean;
    isGrounded: boolean;
  }) => void;
  onSceneReady?: () => void;
}

export const TestMoveCanvas: React.FC<TestMoveCanvasProps> = ({
  settings,
  consumeMovement,
  consumePunchTrigger,
  consumeInspectTrigger,
  keysRef,
  onStatsUpdate,
  onSceneReady,
}) => {
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
        near: 0.05, // Critical: low near clipping plane so first-person arms don't clip
        far: 1200,
      }}
      className="w-full h-full"
    >
      {/* Sky Dome with drifting clouds (renders immediately) */}
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
        />
      </Suspense>

      {/* First Person Player with Animated Arms and WASD + Mouse Look */}
      <Suspense fallback={null}>
        <TestMovePlayer
          consumeMovement={consumeMovement}
          consumePunchTrigger={consumePunchTrigger}
          consumeInspectTrigger={consumeInspectTrigger}
          keysRef={keysRef}
          onStatsUpdate={onStatsUpdate}
          soundEnabled={settings.soundEnabled}
          sfxVolume={settings.sfxVolume}
        />
      </Suspense>
    </Canvas>
  );
};

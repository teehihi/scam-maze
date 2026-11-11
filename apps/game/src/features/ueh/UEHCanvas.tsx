import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { UEHWorld } from "./worlds/UEH";
import { FirstPersonPlayer, type PlayerControlsState, type PlayerStats } from "../player";
import type { GameSettings } from "@scammaze/shared-types";

interface UEHCanvasProps {
  settings: GameSettings;
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
  keysRef: React.MutableRefObject<PlayerControlsState>;
  onStatsUpdate: (stats: PlayerStats) => void;
  onInteract?: (position: [number, number, number]) => void;
}

const UEH_SPAWN: [number, number, number] = [0, 1.85, 28];

const UEH_BOUNDS = {
  maxRadius: 57.0, // Courtyard perimeter clamp
  groundY: 1.85,   // Adult human standing eye level matching testmove (1.81m above ground)
};

export const UEHCanvas: React.FC<UEHCanvasProps> = ({
  settings,
  consumeMovement,
  consumePunchTrigger,
  consumeInspectTrigger,
  consumeInteractTrigger,
  keysRef,
  onStatsUpdate,
  onInteract,
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
        near: 0.05,
        far: 1200,
      }}
      className="w-full h-full"
    >
      {/* UEH Ambient Sunlight */}
      <ambientLight intensity={0.65} color="#fff4eb" />
      <directionalLight
        position={[-35, 45, -45]}
        intensity={1.6}
        color="#fff1db"
        castShadow={settings.graphicsQuality === "high"}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-camera-bottom={-65}
        shadow-bias={-0.0003}
      />

      {/* Procedural 3D UEH Campus World */}
      <Suspense fallback={null}>
        <UEHWorld />
      </Suspense>

      {/* Shared Unified First Person Player with Animated Arms Viewmodel */}
      <Suspense fallback={null}>
        <FirstPersonPlayer
          spawnPosition={UEH_SPAWN}
          spawnYaw={0}
          bounds={UEH_BOUNDS}
          consumeMovement={consumeMovement}
          consumePunchTrigger={consumePunchTrigger}
          consumeInspectTrigger={consumeInspectTrigger}
          consumeInteractTrigger={consumeInteractTrigger}
          keysRef={keysRef}
          onStatsUpdate={onStatsUpdate}
          onInteract={onInteract}
          soundEnabled={settings.soundEnabled}
          sfxVolume={settings.sfxVolume}
        />
      </Suspense>
    </Canvas>
  );
};

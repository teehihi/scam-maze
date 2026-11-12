import React, { Suspense, useCallback, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { UEHWorld } from "./worlds/UEH";
import { FirstPersonPlayer, type PlayerControlsState, type PlayerStats } from "../player";
import { DEFAULT_VEHICLE_CONFIG, LexusVehicle, type VehiclePhysicsConfig } from "../vehicle";
import { UEH_FURNITURE_COLLIDERS, UEH_SEATS } from "./seats";
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

/** Lexus parking spot: behind the spawn point, between the Signal Beacon and the Product Lab. */
const UEH_CAR_POSITION: [number, number, number] = [0, 0, 42];
const UEH_CAR_YAW = Math.PI; // facing the courtyard centre (-Z)
/** The courtyard is a disc (radius 60); keep the whole car body inside the walkable area. */
const UEH_VEHICLE_CONFIG: VehiclePhysicsConfig = {
  ...DEFAULT_VEHICLE_CONFIG,
  roadBounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
  roundBounds: { centerX: 0, centerZ: 0, radius: 54 },
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
  const carPivotRef = useRef<THREE.Group | null>(null);
  const handleCarLoaded = useCallback((pivot: THREE.Group) => {
    carPivotRef.current = pivot;
  }, []);
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
      {/* Drivable Lexus GX 550 (standalone model, ~2.6 MB) */}
      <Suspense fallback={null}>
        <LexusVehicle
          position={UEH_CAR_POSITION}
          yaw={UEH_CAR_YAW}
          castShadow={settings.graphicsQuality === "high"}
          onCarLoaded={handleCarLoaded}
        />
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
          carPivotRef={carPivotRef}
          vehicleConfig={UEH_VEHICLE_CONFIG}
          seats={UEH_SEATS}
          obstacles={UEH_FURNITURE_COLLIDERS}
        />
      </Suspense>
    </Canvas>
  );
};

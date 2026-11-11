import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CharacterRuntime } from "./runtime/CharacterRuntime";
import { SimpleBoundsAdapter, type GameWorldAdapter } from "./adapters/GameWorldAdapter";
import type { FirstPersonPlayerProps } from "./types";

export interface UnifiedPlayerProps extends Omit<FirstPersonPlayerProps, "bounds"> {
  bounds?: FirstPersonPlayerProps["bounds"];
  adapter?: GameWorldAdapter;
}

export const FirstPersonPlayer: React.FC<UnifiedPlayerProps> = ({
  spawnPosition,
  spawnYaw = 0,
  bounds,
  adapter,
  consumeMovement,
  consumePunchTrigger,
  consumeInspectTrigger,
  consumeInteractTrigger,
  keysRef,
  onStatsUpdate,
  onInteract,
  soundEnabled = true,
  sfxVolume = 1.0,
}) => {
  const { camera } = useThree();
  const runtimeRef = useRef<CharacterRuntime | null>(null);

  // Initialize unified CharacterRuntime once on mount
  useEffect(() => {
    // Resolve adapter: use provided GameWorldAdapter or construct SimpleBoundsAdapter from bounds
    const effectiveAdapter =
      adapter ??
      new SimpleBoundsAdapter({
        minX: bounds?.minX,
        maxX: bounds?.maxX,
        minZ: bounds?.minZ,
        maxZ: bounds?.maxZ,
        maxRadius: bounds?.maxRadius,
        groundY: bounds?.groundY ?? 0,
        eyeHeight: 1.85,
      });

    const controls = {
      keysRef,
      consumeMovement,
      consumePunchTrigger,
      consumeInspectTrigger,
      consumeInteractTrigger,
    };

    const runtime = new CharacterRuntime({
      camera,
      adapter: effectiveAdapter,
      controls,
      spawnPosition,
      spawnYaw,
      soundEnabled,
      sfxVolume,
      onStatsUpdate,
      onInteract,
    });

    runtimeRef.current = runtime;

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [camera, adapter, bounds, keysRef, consumeMovement, consumePunchTrigger, consumeInspectTrigger, consumeInteractTrigger, spawnPosition, spawnYaw, soundEnabled, sfxVolume, onStatsUpdate, onInteract]);

  // Drive unified physics & animation loop in R3F frame cycle
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);
    runtimeRef.current?.update(dt);
  });

  return null;
};

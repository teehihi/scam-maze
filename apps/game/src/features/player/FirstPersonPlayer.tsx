import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CharacterRuntime } from "./runtime/CharacterRuntime";
import type { GameWorldAdapter } from "./adapters/GameWorldAdapter";
import type { FirstPersonPlayerProps, PlayerControlsState } from "./types";

// Read-only idle input the runtime sees while the player is disabled (the runtime never writes keys)
const IDLE_KEYS_REF: { readonly current: PlayerControlsState } = {
  current: Object.freeze({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    punch: false,
    block: false,
    inspect: false,
    interact: false,
  }),
};

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
  enabled = true,
}) => {
  const { camera } = useThree();
  const runtimeRef = useRef<CharacterRuntime | null>(null);

  // Keep a stable ref to latest props to prevent recreating runtime on parent re-renders
  const propsRef = useRef({
    adapter,
    bounds,
    keysRef,
    consumeMovement,
    consumePunchTrigger,
    consumeInspectTrigger,
    consumeInteractTrigger,
    onStatsUpdate,
    onInteract,
    soundEnabled,
    sfxVolume,
    enabled,
  });

  propsRef.current = {
    adapter,
    bounds,
    keysRef,
    consumeMovement,
    consumePunchTrigger,
    consumeInspectTrigger,
    consumeInteractTrigger,
    onStatsUpdate,
    onInteract,
    soundEnabled,
    sfxVolume,
    enabled,
  };

  // Initialize unified CharacterRuntime ONCE on mount
  useEffect(() => {
    // Dynamic adapter proxy forwarding calls to current props without tearing down runtime
    const adapterProxy: GameWorldAdapter = {
      get eyeHeight() {
        return propsRef.current.adapter?.eyeHeight ?? 0;
      },
      get gravity() {
        return propsRef.current.adapter?.gravity ?? -22.0;
      },
      get jumpForce() {
        return propsRef.current.adapter?.jumpForce ?? 7.0;
      },
      getGroundHeight(x, z) {
        if (propsRef.current.adapter) {
          return propsRef.current.adapter.getGroundHeight(x, z);
        }
        return propsRef.current.bounds?.groundY ?? 0;
      },
      resolveMovement(currX, currZ, targetX, targetZ, footY, radius, height) {
        if (propsRef.current.adapter?.resolveMovement) {
          return propsRef.current.adapter.resolveMovement(
            currX,
            currZ,
            targetX,
            targetZ,
            footY,
            radius,
            height
          );
        }
        return {
          newX: targetX,
          newZ: targetZ,
          collided: false,
          hitNormalX: 0,
          hitNormalZ: 0,
        };
      },
      clampPosition(pos) {
        if (propsRef.current.adapter?.clampPosition) {
          propsRef.current.adapter.clampPosition(pos);
          return;
        }
        const b = propsRef.current.bounds;
        if (!b) return;
        if (b.minX !== undefined && pos.x < b.minX) pos.x = b.minX;
        if (b.maxX !== undefined && pos.x > b.maxX) pos.x = b.maxX;
        if (b.minZ !== undefined && pos.z < b.minZ) pos.z = b.minZ;
        if (b.maxZ !== undefined && pos.z > b.maxZ) pos.z = b.maxZ;
        if (b.maxRadius !== undefined) {
          const dist = Math.hypot(pos.x, pos.z);
          if (dist > b.maxRadius) {
            const angle = Math.atan2(pos.z, pos.x);
            pos.x = Math.cos(angle) * b.maxRadius;
            pos.z = Math.sin(angle) * b.maxRadius;
          }
        }
      },
      get raycastPunch() {
        return propsRef.current.adapter?.raycastPunch
          ? (origin: import('three').Vector3, direction: import('three').Vector3, maxDistance: number) =>
              propsRef.current.adapter!.raycastPunch!(origin, direction, maxDistance)
          : undefined;
      },
      getInteractionTargets() {
        const custom = propsRef.current.adapter?.getInteractionTargets?.();
        if (custom && custom.length > 0) return custom;
        if (camera.parent) {
          let root: import('three').Object3D = camera.parent;
          while (root.parent) root = root.parent;
          return root.children;
        }
        return [];
      },
    };

    // While disabled, the runtime keeps ticking (gravity, deceleration, idle arms) but sees idle
    // keys, zero look delta and no triggers. Real sources are still drained every frame so
    // accumulated mouse movement or a queued trigger does not fire on resume.
    const isEnabled = () => propsRef.current.enabled !== false;
    const controls = {
      get keysRef() {
        return isEnabled() ? propsRef.current.keysRef : IDLE_KEYS_REF;
      },
      consumeMovement: () => {
        const delta = propsRef.current.consumeMovement();
        return isEnabled() ? delta : { x: 0, y: 0 };
      },
      consumePunchTrigger: () => propsRef.current.consumePunchTrigger() && isEnabled(),
      consumeInspectTrigger: () => propsRef.current.consumeInspectTrigger() && isEnabled(),
      consumeInteractTrigger: () => propsRef.current.consumeInteractTrigger() && isEnabled(),
    };

    const runtime = new CharacterRuntime({
      camera,
      adapter: adapterProxy,
      controls,
      spawnPosition,
      spawnYaw,
      soundEnabled,
      sfxVolume,
      onStatsUpdate: (stats) => propsRef.current.onStatsUpdate?.(stats),
      onInteract: (pos) => propsRef.current.onInteract?.(pos),
    });

    runtimeRef.current = runtime;

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [camera, spawnPosition, spawnYaw, soundEnabled, sfxVolume]);

  // Drive unified physics & animation loop in R3F frame cycle
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);
    runtimeRef.current?.update(dt);
  });

  // Adding camera to R3F scene graph is essential for Three.js to render camera children (arms viewmodel)
  return <primitive object={camera} />;
};

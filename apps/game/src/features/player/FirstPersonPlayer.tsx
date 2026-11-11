import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CharacterRuntime } from "./runtime/CharacterRuntime";
import type { GameWorldAdapter } from "./adapters/GameWorldAdapter";
import type { FirstPersonPlayerProps, PlayerStats } from "./types";
import {
  type BoxCollider,
  type VehicleState,
  DEFAULT_VEHICLE_CONFIG,
  resolveBoxCollision,
  checkProximityToCar,
  stepVehiclePhysics,
  useVehicleAudio,
} from "../vehicle";

/** Car collider half extents (Lexus GX 550) and player radius used against it. */
const CAR_HALF_WIDTH = 1.28;
const CAR_HALF_LENGTH = 2.85;
const PLAYER_CAR_RADIUS = 0.45;
/** Steering column axis in car-local space. */
const STEERING_AXIS = new THREE.Vector3(0, 0.233, -0.972).normalize();
/** Driver eye position in car-local space (commanding SUV eye height). */
const SEAT_OFFSET = new THREE.Vector3(0.493, 1.86, -0.24);
/** Fallback if the engine-start sound never reports completion. */
const ENGINE_START_FALLBACK_MS = 11300;
/** Driver seat / headrest meshes hidden while driving so they never block the cockpit view. */
const isDriverSeatMesh = (name: string) => name.includes("016_") || name.includes("017") || name.includes("ZY");

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
  carPivotRef,
}) => {
  const { camera } = useThree();
  const runtimeRef = useRef<CharacterRuntime | null>(null);

  // ==========================================
  // VEHICLE LAYER (active only when a carPivotRef is supplied, e.g. /testmove)
  // ==========================================
  const hasVehicle = Boolean(carPivotRef);
  const carStateRef = useRef<VehicleState>({
    position: [186.29, -94.92, -68.75],
    yaw: 0,
    speed: 0,
    steering: 0,
    gear: "P",
    isDriving: false,
    isNearCar: false,
    steeringWheelRotation: 0,
    pitch: 0,
    roll: 0,
  });
  const isNearCarRef = useRef(false);
  const cockpitYawRef = useRef(0);
  const cockpitPitchRef = useRef(0);
  const wasAcceleratingRef = useRef(false);
  const canDriveRef = useRef(false);
  const engineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDrivingStatsRef = useRef(0);
  const seatScratch = useRef(new THREE.Vector3());
  const carEulerScratch = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  const { playDoorSound, playDriveSound, playStopSound, playStopCarSound, stopAll } = useVehicleAudio({
    enabled: soundEnabled,
    volume: sfxVolume,
  });

  const setDriverSeatVisible = useCallback(
    (visible: boolean) => {
      carPivotRef?.current?.traverse((child: THREE.Object3D) => {
        if (child.name && isDriverSeatMesh(child.name)) child.visible = visible;
      });
    },
    [carPivotRef],
  );

  const enableDriving = useCallback(() => {
    canDriveRef.current = true;
    if (carStateRef.current.gear === "P") carStateRef.current.gear = "D";
  }, []);

  const enterCar = useCallback(() => {
    const car = carStateRef.current;
    car.isDriving = true;
    car.gear = "P";
    cockpitYawRef.current = 0;
    cockpitPitchRef.current = 0;
    wasAcceleratingRef.current = false;
    canDriveRef.current = false;
    // Door + engine-start sound; driving is unlocked when it finishes (or by the fallback timer).
    playDoorSound(enableDriving);
    if (engineTimerRef.current) clearTimeout(engineTimerRef.current);
    engineTimerRef.current = setTimeout(enableDriving, ENGINE_START_FALLBACK_MS);
    if (runtimeRef.current) runtimeRef.current.arms.group.visible = false;
    setDriverSeatVisible(false);
  }, [playDoorSound, enableDriving, setDriverSeatVisible]);

  const exitCar = useCallback(() => {
    const car = carStateRef.current;
    car.isDriving = false;
    car.speed = 0;
    wasAcceleratingRef.current = false;
    canDriveRef.current = false;
    if (engineTimerRef.current) {
      clearTimeout(engineTimerRef.current);
      engineTimerRef.current = null;
    }
    stopAll();
    playStopCarSound();
    setDriverSeatVisible(true);
    const steeringPivot = carPivotRef?.current?.userData?.steeringPivot as THREE.Group | undefined;
    steeringPivot?.quaternion.identity();

    // Step out beside the driver door (+1.5m X, -0.2m Z in car-local space).
    const cosY = Math.cos(car.yaw);
    const sinY = Math.sin(car.yaw);
    const x = car.position[0] + (1.5 * cosY - -0.2 * sinY);
    const z = car.position[2] + (1.5 * sinY + -0.2 * cosY);
    const runtime = runtimeRef.current;
    if (runtime) {
      const ground = runtime.adapter.getGroundHeight(x, z) ?? propsRef.current.bounds?.groundY ?? 0;
      runtime.teleport([x, ground + (runtime.adapter.eyeHeight ?? 0), z], car.yaw + Math.PI * 0.45);
      runtime.arms.group.visible = true;
    }
  }, [stopAll, playStopCarSound, setDriverSeatVisible, carPivotRef]);

  useEffect(
    () => () => {
      if (engineTimerRef.current) clearTimeout(engineTimerRef.current);
    },
    [],
  );

  // Latest vehicle handlers for the runtime proxies (which are created once).
  const vehicleRef = useRef({ hasVehicle, enterCar });
  vehicleRef.current = { hasVehicle, enterCar };

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
        const base = propsRef.current.adapter?.resolveMovement
          ? propsRef.current.adapter.resolveMovement(currX, currZ, targetX, targetZ, footY, radius, height)
          : { newX: targetX, newZ: targetZ, collided: false, hitNormalX: 0, hitNormalZ: 0 };
        if (!vehicleRef.current.hasVehicle) return base;

        // Solid car body: the player cannot walk through the Lexus.
        const car = carStateRef.current;
        const carBox: BoxCollider = {
          x: car.position[0],
          z: car.position[2],
          halfWidth: CAR_HALF_WIDTH,
          halfLength: CAR_HALF_LENGTH,
          yaw: car.yaw,
        };
        const hit = resolveBoxCollision(base.newX, base.newZ, PLAYER_CAR_RADIUS, carBox);
        if (!hit.collided) return base;
        const nx = hit.x - base.newX;
        const nz = hit.z - base.newZ;
        const len = Math.hypot(nx, nz) || 1;
        return { newX: hit.x, newZ: hit.z, collided: true, hitNormalX: nx / len, hitNormalZ: nz / len };
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

    const controls = {
      get keysRef() {
        return propsRef.current.keysRef;
      },
      consumeMovement: () => propsRef.current.consumeMovement(),
      consumePunchTrigger: () => propsRef.current.consumePunchTrigger(),
      consumeInspectTrigger: () => propsRef.current.consumeInspectTrigger(),
      consumeInteractTrigger: () => {
        const triggered = propsRef.current.consumeInteractTrigger();
        // E next to the car enters it instead of the normal interact gesture.
        if (triggered && vehicleRef.current.hasVehicle && isNearCarRef.current) {
          vehicleRef.current.enterCar();
          return false;
        }
        return triggered;
      },
    };

    const runtime = new CharacterRuntime({
      camera,
      adapter: adapterProxy,
      controls,
      spawnPosition,
      spawnYaw,
      soundEnabled,
      sfxVolume,
      onStatsUpdate: (stats) => {
        if (!vehicleRef.current.hasVehicle) {
          propsRef.current.onStatsUpdate?.(stats);
          return;
        }
        const car = carStateRef.current;
        propsRef.current.onStatsUpdate?.({
          ...stats,
          isDriving: false,
          isNearCar: isNearCarRef.current,
          carSpeed: 0,
          carGear: car.gear,
          carPosition: car.position,
        });
      },
      onInteract: (pos) => propsRef.current.onInteract?.(pos),
    });

    runtimeRef.current = runtime;
    // Runtime can be recreated (e.g. sound settings change) while seated: keep arms hidden.
    if (carStateRef.current.isDriving) runtime.arms.group.visible = false;

    return () => {
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [camera, spawnPosition, spawnYaw, soundEnabled, sfxVolume]);

  // Drive unified physics & animation loop in R3F frame cycle
  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05);
    const runtime = runtimeRef.current;
    if (!runtime) return;

    if (!carStateRef.current.isDriving) {
      runtime.update(dt);
      if (hasVehicle) {
        const p = camera.position;
        const car = carStateRef.current;
        isNearCarRef.current = checkProximityToCar(p.x, p.y, p.z, car.position, car.yaw);
      }
      return;
    }
    stepDriving(dt);
  });

  /** Driving mode: vehicle physics, cockpit camera, audio and HUD. Runtime is paused. */
  function stepDriving(dt: number) {
    const keys = keysRef.current;

    // Cockpit glance, bounded to the side mirrors and the windshield/dashboard.
    const mouse = consumeMovement();
    const SENS = 0.002;
    cockpitYawRef.current = Math.max(-0.95, Math.min(0.95, cockpitYawRef.current - mouse.x * SENS));
    cockpitPitchRef.current = Math.max(-0.28, Math.min(0.22, cockpitPitchRef.current - mouse.y * SENS));

    // Consume the other triggers so they don't fire when the player steps out.
    consumePunchTrigger();
    consumeInspectTrigger();
    if (consumeInteractTrigger() && Math.abs(carStateRef.current.speed) < 2.5) {
      exitCar();
      return;
    }

    // The car can only move once the engine-start sound has finished.
    const engineStarting = !canDriveRef.current;
    const inputs = {
      forward: !engineStarting && Boolean(keys.forward),
      backward: !engineStarting && Boolean(keys.backward),
      left: !engineStarting && Boolean(keys.left),
      right: !engineStarting && Boolean(keys.right),
      handbrake: Boolean(keys.jump) || engineStarting,
    };
    const next = stepVehiclePhysics(carStateRef.current, inputs, DEFAULT_VEHICLE_CONFIG, dt);
    if (engineStarting) {
      next.gear = "P";
      next.speed = 0;
    }
    carStateRef.current = next;

    if (!engineStarting) {
      const accelerating = inputs.forward || inputs.backward;
      if (accelerating) {
        wasAcceleratingRef.current = true;
        playDriveSound(next.speed);
      } else if (wasAcceleratingRef.current) {
        wasAcceleratingRef.current = false;
        playStopSound();
      }
    }

    // Move the car model and turn its steering wheel.
    const pivot = carPivotRef?.current;
    if (pivot) {
      pivot.position.set(next.position[0], next.position[1], next.position[2]);
      pivot.rotation.set(next.pitch, next.yaw, next.roll, "YXZ");
      const steeringPivot = pivot.userData?.steeringPivot as THREE.Group | undefined;
      steeringPivot?.quaternion.setFromAxisAngle(STEERING_AXIS, next.steeringWheelRotation);
    }

    // Driver-seat camera.
    carEulerScratch.current.set(next.pitch, next.yaw, next.roll, "YXZ");
    const seat = seatScratch.current.copy(SEAT_OFFSET).applyEuler(carEulerScratch.current);
    camera.position.set(next.position[0] + seat.x, next.position[1] + seat.y, next.position[2] + seat.z);
    camera.rotation.set(
      -0.1 + cockpitPitchRef.current + next.pitch * 0.5,
      next.yaw + Math.PI + cockpitYawRef.current,
      next.roll * 0.5,
      "YXZ",
    );

    const now = performance.now();
    if (now - lastDrivingStatsRef.current > 100) {
      lastDrivingStatsRef.current = now;
      const stats: PlayerStats = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        speed: Math.abs(next.speed),
        isSprinting: false,
        isGrounded: true,
        isBlocking: false,
        isDriving: true,
        isNearCar: false,
        carSpeed: Math.abs(next.speed),
        carGear: engineStarting ? "P" : next.gear,
        carPosition: next.position,
        isEngineStarting: engineStarting,
      };
      onStatsUpdate?.(stats);
    }
  }

  // Adding camera to R3F scene graph is essential for Three.js to render camera children (arms viewmodel)
  return <primitive object={camera} />;
};

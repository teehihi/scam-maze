import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CharacterRuntime } from "./runtime/CharacterRuntime";
import type { GameWorldAdapter } from "./adapters/GameWorldAdapter";
import type { FirstPersonPlayerProps, PlayerControlsState, PlayerStats } from "./types";
import {
  type Seat,
  clampSeatedLook,
  findNearestSeat,
  seatedEyePosition,
  standUpPoint,
} from "./seating";
import {
  type BoxCollider,
  type VehicleState,
  DEFAULT_VEHICLE_CONFIG,
  resolveBoxCollision,
  checkProximityToCar,
  stepVehiclePhysics,
  stepTurnSignal,
  INITIAL_TURN_SIGNAL,
  type TurnSignalState,
  useVehicleAudio,
} from "../vehicle";

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
/** How close (horizontal metres) the player must be to a seat to sit with E. */
const SEAT_REACH = 1.3;
/** Duration of the ease into a seat and back up. */
const SIT_TRANSITION = 0.35;
const STAND_TRANSITION = 0.4;
const SEATED_MOUSE_SENSITIVITY = 0.0022;

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
  enabled = true,
  carPivotRef,
  vehicleConfig = DEFAULT_VEHICLE_CONFIG,
  seats,
  obstacles,
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
  /** Pivot the car state was last synced from (the parked position comes from the map). */
  const syncedPivotRef = useRef<THREE.Object3D | null>(null);
  const cockpitYawRef = useRef(0);
  const cockpitPitchRef = useRef(0);
  const wasAcceleratingRef = useRef(false);
  const canDriveRef = useRef(false);
  const engineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDrivingStatsRef = useRef(0);
  const seatScratch = useRef(new THREE.Vector3());
  const carEulerScratch = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  const turnSignalRef = useRef<TurnSignalState>(INITIAL_TURN_SIGNAL);
  const { playDoorSound, playDriveSound, playStopSound, playStopCarSound, setIndicator, stopAll } = useVehicleAudio({
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
    turnSignalRef.current = INITIAL_TURN_SIGNAL;
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
    turnSignalRef.current = INITIAL_TURN_SIGNAL;
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
  // ==========================================
  // SEATING LAYER (active only when `seats` are supplied, e.g. /ueh)
  // ==========================================
  const nearSeatRef = useRef<Seat | null>(null);
  const sittingRef = useRef<{
    seat: Seat;
    yawOffset: number;
    pitch: number;
    t: number;
    from: THREE.Vector3;
    fromQuat: THREE.Quaternion;
  } | null>(null);
  /** Easing back up from a seat; the runtime resumes when it finishes. */
  const standingRef = useRef<{
    t: number;
    from: THREE.Vector3;
    fromQuat: THREE.Quaternion;
    to: THREE.Vector3;
    toQuat: THREE.Quaternion;
    yaw: number;
  } | null>(null);
  const seatTargetScratch = useRef(new THREE.Vector3());
  const seatQuatScratch = useRef(new THREE.Quaternion());
  const seatEulerScratch = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const lastSeatStatsRef = useRef(0);
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const obstaclesRef = useRef(obstacles);
  obstaclesRef.current = obstacles;

  const sitDown = useCallback(
    (seat: Seat) => {
      sittingRef.current = {
        seat,
        yawOffset: 0,
        pitch: -0.08,
        t: 0,
        from: camera.position.clone(),
        fromQuat: camera.quaternion.clone(),
      };
      nearSeatRef.current = null;
      if (runtimeRef.current) runtimeRef.current.arms.group.visible = false;
    },
    [camera],
  );

  const standUp = useCallback(() => {
    const sitting = sittingRef.current;
    sittingRef.current = null;
    const runtime = runtimeRef.current;
    if (!sitting || !runtime) return;
    const [x, z] = standUpPoint(sitting.seat);
    const ground = runtime.adapter.getGroundHeight(x, z) ?? propsRef.current.bounds?.groundY ?? 0;
    const yaw = sitting.seat.facingYaw + sitting.yawOffset;
    // Ease up to the standing pose (level gaze, same heading) instead of snapping there.
    standingRef.current = {
      t: 0,
      from: camera.position.clone(),
      fromQuat: camera.quaternion.clone(),
      to: new THREE.Vector3(x, ground + (runtime.adapter.eyeHeight ?? 0), z),
      toQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, "YXZ")),
      yaw,
    };
  }, [camera]);

  // Latest vehicle/seat handlers for the runtime proxies (which are created once).
  const vehicleRef = useRef({ hasVehicle, enterCar, sitDown });
  vehicleRef.current = { hasVehicle, enterCar, sitDown };

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
        const base = propsRef.current.adapter?.resolveMovement
          ? propsRef.current.adapter.resolveMovement(currX, currZ, targetX, targetZ, footY, radius, height)
          : { newX: targetX, newZ: targetZ, collided: false, hitNormalX: 0, hitNormalZ: 0 };
        const extra = obstaclesRef.current;
        if (!vehicleRef.current.hasVehicle && !extra?.length) return base;

        // Push the player out of every solid box (car body, furniture), sliding along its sides.
        let x = base.newX;
        let z = base.newZ;
        let collided = base.collided;
        let normalX = base.hitNormalX;
        let normalZ = base.hitNormalZ;
        const push = (box: BoxCollider, r: number) => {
          const hit = resolveBoxCollision(x, z, r, box);
          if (!hit.collided) return;
          const nx = hit.x - x;
          const nz = hit.z - z;
          const len = Math.hypot(nx, nz) || 1;
          x = hit.x;
          z = hit.z;
          collided = true;
          normalX = nx / len;
          normalZ = nz / len;
        };
        if (vehicleRef.current.hasVehicle) {
          // Solid car body: the player cannot walk through the Lexus.
          const car = carStateRef.current;
          push(
            // BoxCollider.yaw is the opposite sign of the car's Three.js Y rotation.
            { x: car.position[0], z: car.position[2], halfWidth: CAR_HALF_WIDTH, halfLength: CAR_HALF_LENGTH, yaw: -car.yaw },
            PLAYER_CAR_RADIUS,
          );
        }
        if (extra) for (const box of extra) push(box, radius);
        return { newX: x, newZ: z, collided, hitNormalX: normalX, hitNormalZ: normalZ };
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
      consumeInteractTrigger: () => {
        const triggered = propsRef.current.consumeInteractTrigger() && isEnabled();
        // E next to the car enters it instead of the normal interact gesture.
        if (triggered && vehicleRef.current.hasVehicle && isNearCarRef.current) {
          vehicleRef.current.enterCar();
          return false;
        }
        // E next to a seat sits down (the car takes priority).
        if (triggered && nearSeatRef.current) {
          vehicleRef.current.sitDown(nearSeatRef.current);
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
        const seatStats = seatsRef.current ? { isNearSeat: nearSeatRef.current !== null, isSitting: false } : {};
        if (!vehicleRef.current.hasVehicle) {
          propsRef.current.onStatsUpdate?.({ ...stats, ...seatStats });
          return;
        }
        const car = carStateRef.current;
        propsRef.current.onStatsUpdate?.({
          ...stats,
          ...seatStats,
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
    if (carStateRef.current.isDriving || sittingRef.current || standingRef.current) runtime.arms.group.visible = false;

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

    // Start the simulation from wherever the map parked the car.
    const pivot = carPivotRef?.current as THREE.Object3D | null | undefined;
    if (pivot && syncedPivotRef.current !== pivot && !carStateRef.current.isDriving) {
      syncedPivotRef.current = pivot;
      const car = carStateRef.current;
      car.position = [pivot.position.x, pivot.position.y, pivot.position.z];
      car.yaw = pivot.rotation.y;
      car.speed = 0;
      car.pitch = 0;
      car.roll = 0;
    }

    if (sittingRef.current) {
      stepSitting(dt);
      return;
    }
    if (standingRef.current) {
      stepStanding(dt);
      return;
    }

    if (!carStateRef.current.isDriving) {
      runtime.update(dt);
      if (hasVehicle) {
        const p = camera.position;
        const car = carStateRef.current;
        isNearCarRef.current = checkProximityToCar(p.x, p.y, p.z, car.position, car.yaw);
      }
      if (seats && seats.length > 0) {
        // The car wins when both are in reach.
        nearSeatRef.current = isNearCarRef.current
          ? null
          : findNearestSeat(seats, camera.position.x, camera.position.z, SEAT_REACH);
      }
      return;
    }
    stepDriving(dt);
  });

  /** Seated: head look within limits, E stands up. Runtime is paused. */
  function stepSitting(dt: number) {
    const sitting = sittingRef.current;
    if (!sitting) return;
    // While disabled (pause menu etc.), sources are drained but ignored.
    const inputEnabled = enabled !== false;
    const rawMouse = consumeMovement();
    const mouse = inputEnabled ? rawMouse : { x: 0, y: 0 };
    [sitting.yawOffset, sitting.pitch] = clampSeatedLook(
      sitting.yawOffset - mouse.x * SEATED_MOUSE_SENSITIVITY,
      sitting.pitch - mouse.y * SEATED_MOUSE_SENSITIVITY,
    );
    consumePunchTrigger();
    consumeInspectTrigger();
    if (consumeInteractTrigger() && inputEnabled) {
      standUp();
      return;
    }

    // Ease from where the player stood into the seat, then follow the head look.
    sitting.t = Math.min(1, sitting.t + dt / SIT_TRANSITION);
    const k = sitting.t * sitting.t * (3 - 2 * sitting.t);
    const target = seatTargetScratch.current.set(...seatedEyePosition(sitting.seat));
    seatEulerScratch.current.set(sitting.pitch, sitting.seat.facingYaw + sitting.yawOffset, 0, "YXZ");
    const targetQuat = seatQuatScratch.current.setFromEuler(seatEulerScratch.current);
    camera.position.lerpVectors(sitting.from, target, k);
    camera.quaternion.slerpQuaternions(sitting.fromQuat, targetQuat, k);

    const now = performance.now();
    if (now - lastSeatStatsRef.current > 120) {
      lastSeatStatsRef.current = now;
      onStatsUpdate?.({
        position: [camera.position.x, camera.position.y, camera.position.z],
        speed: 0,
        isSprinting: false,
        isGrounded: true,
        isBlocking: false,
        isNearSeat: false,
        isSitting: true,
      });
    }
  }

  /** Getting up: ease to the standing pose, then hand control back to the runtime. */
  function stepStanding(dt: number) {
    const standing = standingRef.current;
    const runtime = runtimeRef.current;
    if (!standing || !runtime) return;
    // Drain input so nothing queued during the transition fires afterwards.
    consumeMovement();
    consumePunchTrigger();
    consumeInspectTrigger();
    consumeInteractTrigger();

    standing.t = Math.min(1, standing.t + dt / STAND_TRANSITION);
    const k = standing.t * standing.t * (3 - 2 * standing.t);
    camera.position.lerpVectors(standing.from, standing.to, k);
    camera.quaternion.slerpQuaternions(standing.fromQuat, standing.toQuat, k);
    if (standing.t < 1) return;

    standingRef.current = null;
    runtime.teleport([standing.to.x, standing.to.y, standing.to.z], standing.yaw);
    runtime.arms.group.visible = true;
  }

  /** Driving mode: vehicle physics, cockpit camera, audio and HUD. Runtime is paused. */
  function stepDriving(dt: number) {
    // While disabled, driving sees idle keys and no look or triggers (sources are still drained).
    const inputEnabled = enabled !== false;
    const keys = inputEnabled ? keysRef.current : IDLE_KEYS_REF.current;

    // Cockpit glance, bounded to the side mirrors and the windshield/dashboard.
    const rawMouse = consumeMovement();
    const mouse = inputEnabled ? rawMouse : { x: 0, y: 0 };
    const SENS = 0.002;
    cockpitYawRef.current = Math.max(-0.95, Math.min(0.95, cockpitYawRef.current - mouse.x * SENS));
    cockpitPitchRef.current = Math.max(-0.28, Math.min(0.22, cockpitPitchRef.current - mouse.y * SENS));

    // Consume the other triggers so they don't fire when the player steps out.
    consumePunchTrigger();
    consumeInspectTrigger();
    if (consumeInteractTrigger() && inputEnabled && Math.abs(carStateRef.current.speed) < 2.5) {
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
    const next = stepVehiclePhysics(carStateRef.current, inputs, vehicleConfig, dt);
    if (engineStarting) {
      next.gear = "P";
      next.speed = 0;
    }
    carStateRef.current = next;

    // Automatic turn signal: on after steering for a moment, off 1.5 s after steering stops.
    const steer = inputs.left === inputs.right ? 0 : inputs.left ? -1 : 1;
    const prevSignal = turnSignalRef.current.active;
    turnSignalRef.current = stepTurnSignal(turnSignalRef.current, steer, dt);
    const signal = turnSignalRef.current.active;
    if ((signal !== 0) !== (prevSignal !== 0)) setIndicator(signal !== 0);

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

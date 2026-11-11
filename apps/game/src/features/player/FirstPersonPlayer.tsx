import React, { useRef, useState, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FirstPersonArms } from "./FirstPersonArms";
import type { FirstPersonPlayerProps } from "./types";
import {
  type BoxCollider,
  type VehicleState,
  DEFAULT_VEHICLE_CONFIG,
  resolveBoxCollision,
  checkProximityToCar,
  stepVehiclePhysics,
  useVehicleAudio,
} from "../vehicle";

export const FirstPersonPlayer: React.FC<FirstPersonPlayerProps> = ({
  spawnPosition,
  spawnYaw = 0,
  bounds,
  consumeMovement,
  consumePunchTrigger,
  consumeInspectTrigger,
  consumeInteractTrigger,
  keysRef,
  onStatsUpdate,
  onInteract,
  soundEnabled = true,
  sfxVolume = 1.0,
  hitSoundPath = "/assets/audio/hit_punch.mp3",
  missSoundPath = "/assets/audio/miss_punch.mp3",
  carPivotRef,
}) => {
  const { camera, scene } = useThree();

  // Audio system for hit_punch & miss_punch with zero-latency pre-decoding
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hitBufferRef = useRef<AudioBuffer | null>(null);
  const missBufferRef = useRef<AudioBuffer | null>(null);

  // Melee punch raycaster and aim direction
  const raycasterRef = useRef(new THREE.Raycaster());
  const aimDirRef = useRef(new THREE.Vector3());

  useEffect(() => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    fetch(hitSoundPath)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        hitBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load hit sound:", err));

    fetch(missSoundPath)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        missBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load miss sound:", err));

    return () => {
      ctx.close().catch(() => {});
    };
  }, [hitSoundPath, missSoundPath]);

  const playPunchSound = useCallback(
    (type: "hit" | "miss") => {
      if (!soundEnabled) return;
      const ctx = audioCtxRef.current;
      const buffer = type === "hit" ? hitBufferRef.current : missBufferRef.current;
      if (!ctx || !buffer) return;

      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 0.94 + Math.random() * 0.12;

      const gain = ctx.createGain();
      gain.gain.value =
        type === "hit" ? Math.min(1.0, 0.9 * sfxVolume) : Math.min(1.0, 0.65 * sfxVolume);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    },
    [soundEnabled, sfxVolume]
  );

  // First-person locomotion state
  const posRef = useRef(new THREE.Vector3(...spawnPosition));
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);

  // Vehicle driving and proximity state
  const [isDriving, setIsDriving] = useState(false);
  const [isNearCar, setIsNearCar] = useState(false);

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

  const {
    playDoorSound,
    playDriveSound,
    playStopSound,
    playStopCarSound,
    stopAll,
  } = useVehicleAudio({
    enabled: soundEnabled,
    volume: sfxVolume,
  });

  const cockpitYawRef = useRef(0);
  const cockpitPitchRef = useRef(0);
  const wasAcceleratingRef = useRef(false);
  const isStartingEngineRef = useRef(false);
  const canDriveRef = useRef(false);

  const enterCar = useCallback(() => {
    setIsDriving(true);
    carStateRef.current.isDriving = true;
    carStateRef.current.gear = "P";
    cockpitYawRef.current = 0;
    cockpitPitchRef.current = 0;
    wasAcceleratingRef.current = false;
    isStartingEngineRef.current = true;
    canDriveRef.current = false;

    // Phát sound closedoorlx khi lên xe; sau khi xong sound start thì cho phép lái xe
    playDoorSound(() => {
      isStartingEngineRef.current = false;
      canDriveRef.current = true;
      carStateRef.current.gear = "D";
    });

    // Fallback timer matching duration (~11.3s) so player is never prematurely able to drive while start sound is playing
    setTimeout(() => {
      isStartingEngineRef.current = false;
      canDriveRef.current = true;
      if (carStateRef.current.gear === "P") {
        carStateRef.current.gear = "D";
      }
    }, 11300);

    // Hide driver seat & headrest meshes so they never block cockpit view
    if (carPivotRef?.current) {
      carPivotRef.current.traverse((child: THREE.Object3D) => {
        if (child.name && (child.name.includes("016_") || child.name.includes("017") || child.name.includes("ZY"))) {
          child.visible = false;
        }
      });
    }
  }, [playDoorSound, carPivotRef]);

  const exitCar = useCallback(() => {
    setIsDriving(false);
    carStateRef.current.isDriving = false;
    carStateRef.current.speed = 0;
    wasAcceleratingRef.current = false;
    isStartingEngineRef.current = false;
    canDriveRef.current = false;

    stopAll(); // Dừng toàn bộ âm thanh lái
    playStopCarSound(); // Phát duy nhất sound stopCar cho hành động xuống xe (không phát closedoorlx!)

    // Restore driver seat visibility
    if (carPivotRef?.current) {
      carPivotRef.current.traverse((child: THREE.Object3D) => {
        if (child.name && (child.name.includes("016_") || child.name.includes("017") || child.name.includes("ZY"))) {
          child.visible = true;
        }
      });
      // Reset steering wheel rotation to neutral
      const steeringPivot = carPivotRef.current.userData?.steeringPivot as THREE.Group | undefined;
      if (steeringPivot) {
        steeringPivot.quaternion.identity();
      }
    }

    const carPos = carStateRef.current.position;
    const carYaw = carStateRef.current.yaw;
    const cosY = Math.cos(carYaw);
    const sinY = Math.sin(carYaw);

    // Spawn beside the left driver door (+1.5m X, -0.2m Z in authentic LHD space)
    posRef.current.x = carPos[0] + (1.5 * cosY - (-0.2) * sinY);
    posRef.current.y = bounds.groundY;
    posRef.current.z = carPos[2] + (1.5 * sinY + (-0.2) * cosY);
    velocityRef.current.set(0, 0, 0);

    yawRef.current = carYaw + Math.PI * 0.45;
    targetYawRef.current = yawRef.current;
    pitchRef.current = 0;
    targetPitchRef.current = 0;
  }, [bounds.groundY, stopAll, playStopCarSound, carPivotRef]);

  // Camera orientation
  const yawRef = useRef(spawnYaw);
  const pitchRef = useRef(0);
  const targetYawRef = useRef(spawnYaw);
  const targetPitchRef = useRef(0);

  // Animation and action states
  const [isMoving, setIsMoving] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);

  const handlePunchFinished = useCallback(() => {
    setIsPunching(false);
  }, []);

  const handleInspectFinished = useCallback(() => {
    setIsInspecting(false);
  }, []);

  const handleInteractFinished = useCallback(() => {
    setIsInteracting(false);
  }, []);

  // Raycast melee reach & audio feedback on each punch strike
  const performPunchRaycastAndAudio = useCallback(() => {
    camera.getWorldDirection(aimDirRef.current);
    raycasterRef.current.set(camera.position, aimDirRef.current);
    raycasterRef.current.near = 0.1;
    raycasterRef.current.far = 2.4;

    const intersects = raycasterRef.current.intersectObjects(scene.children, true);
    const hit = intersects.find((i) => {
      let parent: THREE.Object3D | null = i.object;
      while (parent) {
        if (parent === camera || parent.name === "FirstPersonArms" || !parent.visible) {
          return false;
        }
        parent = parent.parent;
      }
      return true;
    });

    if (hit) {
      playPunchSound("hit");
    } else {
      playPunchSound("miss");
    }
  }, [camera, scene, playPunchSound]);

  // Initialize camera position and orientation ONLY ONCE on mount
  const isInitializedRef = useRef(false);
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    posRef.current.set(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
    yawRef.current = spawnYaw;
    pitchRef.current = 0;
    targetYawRef.current = spawnYaw;
    targetPitchRef.current = 0;

    camera.position.set(spawnPosition[0], spawnPosition[1], spawnPosition[2]);
    camera.rotation.set(0, spawnYaw, 0, "YXZ");
  }, [camera, spawnPosition, spawnYaw]);

  const lastStatsTimeRef = useRef(0);

  // Cached vector objects to eliminate GC allocations in 60 FPS animation loop
  const forwardVecRef = useRef(new THREE.Vector3());
  const rightVecRef = useRef(new THREE.Vector3());
  const wishDirRef = useRef(new THREE.Vector3());
  const upAxisRef = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05); // Guard against frame drops / backgrounding spikes
    const keys = keysRef.current;

    // 1. Mouse Look with silky interpolation (separated for walking vs driving)
    const mouseDelta = consumeMovement();

    if (!isDriving) {
      const MOUSE_SENSITIVITY = 0.0022;
      targetYawRef.current -= mouseDelta.x * MOUSE_SENSITIVITY;
      targetPitchRef.current -= mouseDelta.y * MOUSE_SENSITIVITY;

      const PITCH_LIMIT = (85 * Math.PI) / 180;
      targetPitchRef.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, targetPitchRef.current));

      const ROT_SMOOTH = 1 - Math.exp(-25 * dt);
      yawRef.current += (targetYawRef.current - yawRef.current) * ROT_SMOOTH;
      pitchRef.current += (targetPitchRef.current - pitchRef.current) * ROT_SMOOTH;
    } else {
      // Driver head glance inside cockpit: natural glance bounded to side mirrors and windshield
      const MOUSE_SENSITIVITY = 0.0020;
      // Mouse right -> glance right; Mouse left -> glance left
      cockpitYawRef.current -= mouseDelta.x * MOUSE_SENSITIVITY;
      cockpitPitchRef.current -= mouseDelta.y * MOUSE_SENSITIVITY;

      // Limit horizontal glance to passenger mirror (right) and driver mirror (left) as requested
      cockpitYawRef.current = Math.max(-0.95, Math.min(0.95, cockpitYawRef.current));
      // Limit vertical pitch to windshield/rearview mirror and dashboard gauges
      cockpitPitchRef.current = Math.max(-0.28, Math.min(0.22, cockpitPitchRef.current));
    }

    // 2. Action Triggers
    // Defensive Block / Guard: Right Click hold
    const blocking = Boolean(keys.block);
    setIsBlocking((prev) => (prev !== blocking ? blocking : prev));

    // Punch Trigger: Left Click / F
    const punchTriggered = consumePunchTrigger();
    const isHoldingPunch = keys.punch;
    if ((punchTriggered || isHoldingPunch) && !isPunching && !blocking && !isDriving) {
      setIsPunching(true);
    }

    // Interact Trigger: Key E (Enter / Exit vehicle, or object interact)
    const interactTriggered = consumeInteractTrigger();
    if (interactTriggered) {
      if (isDriving) {
        if (Math.abs(carStateRef.current.speed) < 2.5) {
          exitCar();
          return;
        }
      } else if (isNearCar) {
        enterCar();
        return;
      } else if (!isInteracting && !isPunching) {
        setIsInteracting(true);
        onInteract?.([posRef.current.x, posRef.current.y, posRef.current.z]);
      }
    }

    // Inspect Trigger: Keys T / I
    const inspectTriggered = consumeInspectTrigger();
    if (inspectTriggered && !isInspecting && !isPunching && !blocking && !isDriving) {
      setIsInspecting(true);
    }

    // ==========================================
    // DRIVING MODE PHYSICS & COCKPIT CAMERA
    // ==========================================
    if (isDriving) {
      // 2. Step vehicle physics simulation
      // Xe chỉ có thể lái khi kết thúc sound start (isEngineStarting = false)
      const isEngineStarting = isStartingEngineRef.current || !canDriveRef.current;
      const vehicleInputs = {
        forward: !isEngineStarting && Boolean(keys.forward),
        backward: !isEngineStarting && Boolean(keys.backward),
        left: !isEngineStarting && Boolean(keys.left),
        right: !isEngineStarting && Boolean(keys.right),
        handbrake: Boolean(keys.jump) || isEngineStarting,
      };

      const nextCar = stepVehiclePhysics(carStateRef.current, vehicleInputs, DEFAULT_VEHICLE_CONFIG, dt);
      if (isEngineStarting) {
        nextCar.gear = "P";
        nextCar.speed = 0;
      }
      carStateRef.current = nextCar;

      // Vehicle audio triggers:
      // - Khi đã nổ máy xong và bắt đầu nhấn ga (W/S): phát drive sound
      // - Khi nhả ga (không còn nhấn ga): phát stop sound
      if (!isEngineStarting) {
        const isAccelerating = Boolean(vehicleInputs.forward || vehicleInputs.backward);
        if (isAccelerating) {
          if (!wasAcceleratingRef.current) {
            wasAcceleratingRef.current = true;
          }
          playDriveSound(nextCar.speed);
        } else if (wasAcceleratingRef.current) {
          wasAcceleratingRef.current = false;
          playStopSound();
        }
      }

      // 3. Update 3D car pivot in world
      if (carPivotRef?.current) {
        carPivotRef.current.position.set(
          nextCar.position[0],
          nextCar.position[1],
          nextCar.position[2]
        );
        carPivotRef.current.rotation.set(
          nextCar.pitch,
          nextCar.yaw,
          nextCar.roll,
          "YXZ"
        );

        // Rotate the model's authentic steering wheel around steering column axis
        const steeringPivot = carPivotRef.current.userData?.steeringPivot as THREE.Group | undefined;
        if (steeringPivot) {
          const steeringAxis = new THREE.Vector3(0, 0.233, -0.972).normalize();
          steeringPivot.quaternion.setFromAxisAngle(
            steeringAxis,
            nextCar.steeringWheelRotation
          );
        }
      }

      // 4. Position camera in driver's seat looking forward through the windshield
      // Local seat offset: X = +0.493 (alignment with steering wheel), Y = +1.86 (commanding Lexus SUV eye height), Z = -0.24 (headrest/seat back)
      const seatOffset = new THREE.Vector3(0.493, 1.86, -0.24);
      seatOffset.applyEuler(new THREE.Euler(nextCar.pitch, nextCar.yaw, nextCar.roll, "YXZ"));
      const seatWorldX = nextCar.position[0] + seatOffset.x;
      const seatWorldY = nextCar.position[1] + seatOffset.y;
      const seatWorldZ = nextCar.position[2] + seatOffset.z;

      camera.position.set(seatWorldX, seatWorldY, seatWorldZ);
      camera.rotation.set(
        -0.10 + cockpitPitchRef.current + nextCar.pitch * 0.5,
        nextCar.yaw + Math.PI + cockpitYawRef.current,
        nextCar.roll * 0.5,
        "YXZ"
      );

      posRef.current.set(seatWorldX, seatWorldY, seatWorldZ);

      // Throttled HUD update
      const now = performance.now();
      if (now - lastStatsTimeRef.current > 100) {
        lastStatsTimeRef.current = now;
        onStatsUpdate?.({
          position: [seatWorldX, seatWorldY, seatWorldZ],
          speed: Math.abs(nextCar.speed),
          isSprinting: false,
          isGrounded: true,
          isBlocking: false,
          isDriving: true,
          isNearCar: false,
          carSpeed: Math.abs(nextCar.speed),
          carGear: isEngineStarting ? "P" : nextCar.gear,
          carPosition: nextCar.position,
          isEngineStarting,
        });
      }
      return;
    }

    // ==========================================
    // ON-FOOT LOCOMOTION & COLLISION
    // ==========================================
    // 3. Locomotion Movement Direction (relative to camera yaw)
    const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const moveZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
    const hasInput = moveX !== 0 || moveZ !== 0;

    const sprinting = hasInput && keys.sprint && isGroundedRef.current && !blocking && moveZ > 0;

    // Update React animation states only when they change to prevent re-render stutter
    setIsMoving((prev) => (prev !== hasInput ? hasInput : prev));
    setIsSprinting((prev) => (prev !== sprinting ? sprinting : prev));

    // Three.js camera forward is -Z, right is +X
    forwardVecRef.current.set(0, 0, -1).applyAxisAngle(upAxisRef.current, yawRef.current);
    rightVecRef.current.set(1, 0, 0).applyAxisAngle(upAxisRef.current, yawRef.current);

    wishDirRef.current.set(0, 0, 0);
    if (hasInput) {
      wishDirRef.current.addScaledVector(forwardVecRef.current, moveZ);
      wishDirRef.current.addScaledVector(rightVecRef.current, moveX);
      wishDirRef.current.normalize();
    }

    // Locomotion Speeds: Walk = 4.2 m/s, Sprint = 8.2 m/s, Block = 2.0 m/s
    const targetSpeed = blocking ? 2.0 : (sprinting ? 8.2 : 4.2);
    const currentSpeedTarget = hasInput ? targetSpeed : 0;

    // Acceleration & Friction
    const accel = isGroundedRef.current ? (hasInput ? 18.0 : 12.0) : 4.0;
    const targetVelX = wishDirRef.current.x * currentSpeedTarget;
    const targetVelZ = wishDirRef.current.z * currentSpeedTarget;

    velocityRef.current.x += (targetVelX - velocityRef.current.x) * Math.min(1, accel * dt);
    velocityRef.current.z += (targetVelZ - velocityRef.current.z) * Math.min(1, accel * dt);

    // 4. Jump & Gravity physics
    const GRAVITY = -22.0;
    const JUMP_FORCE = 7.0;

    if (keys.jump && isGroundedRef.current && !blocking) {
      velocityRef.current.y = JUMP_FORCE;
      isGroundedRef.current = false;
    }

    if (!isGroundedRef.current) {
      velocityRef.current.y += GRAVITY * dt;
    }

    // 5. Integrate position & apply map boundaries
    posRef.current.x += velocityRef.current.x * dt;
    posRef.current.y += velocityRef.current.y * dt;
    posRef.current.z += velocityRef.current.z * dt;

    // Ground clamp
    if (posRef.current.y <= bounds.groundY) {
      posRef.current.y = bounds.groundY;
      velocityRef.current.y = 0;
      isGroundedRef.current = true;
    }

    // Box bounds clamp
    if (bounds.minX !== undefined && posRef.current.x < bounds.minX) posRef.current.x = bounds.minX;
    if (bounds.maxX !== undefined && posRef.current.x > bounds.maxX) posRef.current.x = bounds.maxX;
    if (bounds.minZ !== undefined && posRef.current.z < bounds.minZ) posRef.current.z = bounds.minZ;
    if (bounds.maxZ !== undefined && posRef.current.z > bounds.maxZ) posRef.current.z = bounds.maxZ;

    // Obstacle collision: Lexus car collider box (cannot walk through car!)
    const carBox: BoxCollider = {
      x: carStateRef.current.position[0],
      z: carStateRef.current.position[2],
      halfWidth: 1.28,
      halfLength: 2.85,
      yaw: carStateRef.current.yaw,
    };
    const resolved = resolveBoxCollision(posRef.current.x, posRef.current.z, 0.45, carBox);
    if (resolved.collided) {
      posRef.current.x = resolved.x;
      posRef.current.z = resolved.z;
    }

    // Proximity check for car interaction prompt
    const near = checkProximityToCar(
      posRef.current.x,
      posRef.current.y,
      posRef.current.z,
      carStateRef.current.position,
      carStateRef.current.yaw
    );
    if (near !== isNearCar) {
      setIsNearCar(near);
    }

    // Circular radius clamp (e.g. UEH campus courtyard)
    if (bounds.maxRadius !== undefined) {
      const distFromCenter = Math.hypot(posRef.current.x, posRef.current.z);
      if (distFromCenter > bounds.maxRadius) {
        const angle = Math.atan2(posRef.current.z, posRef.current.x);
        posRef.current.x = Math.cos(angle) * bounds.maxRadius;
        posRef.current.z = Math.sin(angle) * bounds.maxRadius;
      }
    }

    // Update camera world position and orientation ('YXZ' Euler order prevents horizon tilt)
    camera.position.copy(posRef.current);
    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");

    // Throttled stats callback for HUD (120ms throttle)
    const now = performance.now();
    if (now - lastStatsTimeRef.current > 120) {
      lastStatsTimeRef.current = now;
      const horizontalSpeed = Math.hypot(velocityRef.current.x, velocityRef.current.z);
      onStatsUpdate?.({
        position: [posRef.current.x, posRef.current.y, posRef.current.z],
        speed: horizontalSpeed,
        isSprinting: sprinting,
        isGrounded: isGroundedRef.current,
        isBlocking: blocking,
        isDriving: false,
        isNearCar: near,
        carSpeed: 0,
        carGear: carStateRef.current.gear,
        carPosition: carStateRef.current.position,
      });
    }
  });

  return (
    <>
      <primitive object={camera}>
        {!isDriving && (
          <FirstPersonArms
            isMoving={isMoving}
            isSprinting={isSprinting}
            isPunching={isPunching}
            isBlocking={isBlocking}
            isInteracting={isInteracting}
            isInspecting={isInspecting}
            keysRef={keysRef}
            consumePunchTrigger={consumePunchTrigger}
            onPunchStrike={performPunchRaycastAndAudio}
            onPunchFinished={handlePunchFinished}
            onInspectFinished={handleInspectFinished}
            onInteractFinished={handleInteractFinished}
          />
        )}
      </primitive>
    </>
  );
};

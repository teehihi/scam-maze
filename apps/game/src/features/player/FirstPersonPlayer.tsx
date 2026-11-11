import React, { useRef, useState, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FirstPersonArms } from "./FirstPersonArms";
import type { FirstPersonPlayerProps } from "./types";

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

    // 1. Mouse Look with silky interpolation
    const mouseDelta = consumeMovement();
    const MOUSE_SENSITIVITY = 0.0022;
    targetYawRef.current -= mouseDelta.x * MOUSE_SENSITIVITY;
    targetPitchRef.current -= mouseDelta.y * MOUSE_SENSITIVITY;

    const PITCH_LIMIT = (85 * Math.PI) / 180;
    targetPitchRef.current = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, targetPitchRef.current));

    const ROT_SMOOTH = 1 - Math.exp(-25 * dt);
    yawRef.current += (targetYawRef.current - yawRef.current) * ROT_SMOOTH;
    pitchRef.current += (targetPitchRef.current - pitchRef.current) * ROT_SMOOTH;

    // 2. Action Triggers
    // Defensive Block / Guard: Right Click hold
    const blocking = Boolean(keys.block);
    setIsBlocking((prev) => (prev !== blocking ? blocking : prev));

    // Punch Trigger: Left Click / F
    const punchTriggered = consumePunchTrigger();
    const isHoldingPunch = keys.punch;
    if ((punchTriggered || isHoldingPunch) && !isPunching && !blocking) {
      setIsPunching(true);
    }

    // Interact Trigger: Key E
    const interactTriggered = consumeInteractTrigger();
    if (interactTriggered && !isInteracting && !isPunching) {
      setIsInteracting(true);
      onInteract?.([posRef.current.x, posRef.current.y, posRef.current.z]);
    }

    // Inspect Trigger: Keys T / I
    const inspectTriggered = consumeInspectTrigger();
    if (inspectTriggered && !isInspecting && !isPunching && !blocking) {
      setIsInspecting(true);
    }

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
      });
    }
  });

  return (
    <primitive object={camera}>
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
    </primitive>
  );
};

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FirstPersonArms } from "./FirstPersonArms";
import { STREET_CONFIG } from "../../game/scenes/MainMenuScene/StreetComposition";

interface TestMovePlayerProps {
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
  onStatsUpdate?: (stats: {
    position: [number, number, number];
    speed: number;
    isSprinting: boolean;
    isGrounded: boolean;
  }) => void;
  soundEnabled?: boolean;
  sfxVolume?: number;
}

// Street navigation boundaries matching Unity Saigon District 4 road
// Sidewalk level = -94.48m; Pedestrian eye level = -92.65m to -92.75m.
// Realistic adult human eye height standing eye-to-eye with pedestrians = -92.70m
const BOUNDS = {
  minX: 180.0,
  maxX: 198.5,
  minZ: -92.0,
  maxZ: 52.0,
  groundY: -92.70, // Natural human eye height looking pedestrians directly in the eyes
};

export const TestMovePlayer: React.FC<TestMovePlayerProps> = ({
  consumeMovement,
  consumePunchTrigger,
  consumeInspectTrigger,
  keysRef,
  onStatsUpdate,
  soundEnabled = true,
  sfxVolume = 1.0,
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
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    fetch("/assets/audio/hit_punch.mp3")
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        hitBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load hit_punch.mp3:", err));

    fetch("/assets/audio/miss_punch.mp3")
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        missBufferRef.current = decoded;
      })
      .catch((err) => console.warn("Failed to load miss_punch.mp3:", err));

    return () => {
      ctx.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const playPunchSound = React.useCallback(
    (type: "hit" | "miss") => {
      if (!soundEnabled) return;
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const buffer = type === "hit" ? hitBufferRef.current : missBufferRef.current;
      if (!buffer) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1, sfxVolume));
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
    },
    [soundEnabled, sfxVolume]
  );

  // Internal player state - initialize at natural human eye level
  const posRef = useRef(new THREE.Vector3(STREET_CONFIG.camera.defaultPosition[0], BOUNDS.groundY, STREET_CONFIG.camera.defaultPosition[2]));
  const velocityRef = useRef(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef(true);

  // Camera angles (yaw = horizontal, pitch = vertical)
  // Street view runs forward along +Z; in Three.js forward is -Z, so Math.PI faces down +Z into the street
  const yawRef = useRef(Math.PI);
  const pitchRef = useRef(0);

  // Smooth mouse look targets (damping for buttery Mac Trackpad feel)
  const targetYawRef = useRef(Math.PI);
  const targetPitchRef = useRef(0);

  // Animation states
  const [isMoving, setIsMoving] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [isPunching, setIsPunching] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);

  const handlePunchFinished = React.useCallback(() => {
    setIsPunching(false);
  }, []);

  const handleInspectFinished = React.useCallback(() => {
    setIsInspecting(false);
  }, []);

  // Raycast melee reach & audio feedback on each punch strike
  const performPunchRaycastAndAudio = useCallback(() => {
    camera.getWorldDirection(aimDirRef.current);
    raycasterRef.current.set(camera.position, aimDirRef.current);
    raycasterRef.current.near = 0.1;
    raycasterRef.current.far = 2.2;

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

  // Initialize camera position and orientation facing down the street
  useEffect(() => {
    posRef.current.set(STREET_CONFIG.camera.defaultPosition[0], BOUNDS.groundY, STREET_CONFIG.camera.defaultPosition[2]);
    yawRef.current = Math.PI;
    pitchRef.current = 0;
    targetYawRef.current = Math.PI;
    targetPitchRef.current = 0;
    camera.position.set(STREET_CONFIG.camera.defaultPosition[0], BOUNDS.groundY, STREET_CONFIG.camera.defaultPosition[2]);
    camera.rotation.set(0, Math.PI, 0, "YXZ");
  }, [camera]);

  const lastStatsTimeRef = useRef(0);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.05); // Guard against frame spikes
    const keys = keysRef.current;

    // 1. Process Mouse / Trackpad Movement
    const mouseDelta = consumeMovement();
    // Calibrated sensitivity: 0.0022 radians per pixel
    const sensitivity = 0.0022;

    targetYawRef.current -= mouseDelta.x * sensitivity;
    targetPitchRef.current -= mouseDelta.y * sensitivity;

    // Clamp pitch between -85 and +85 degrees to prevent camera backflips
    const maxPitch = (85 * Math.PI) / 180;
    targetPitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, targetPitchRef.current));

    // Smooth lerp damping (crucial for Mac trackpad without jagged stops)
    const damping = 1 - Math.exp(-25 * dt);
    yawRef.current += (targetYawRef.current - yawRef.current) * damping;
    pitchRef.current += (targetPitchRef.current - pitchRef.current) * damping;

    // 2. Action Triggers (Punch & Inspect)
    const wantsPunch = consumePunchTrigger() || keys.punch;
    if (wantsPunch && !isPunching) {
      setIsPunching(true);
    }
    if (consumeInspectTrigger() && !isInspecting && !isPunching) {
      setIsInspecting(true);
    }

    // 3. Movement Direction Calculation
    const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const moveZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);

    const hasInput = moveX !== 0 || moveZ !== 0;
    const sprinting = hasInput && keys.sprint && isGroundedRef.current;

    setIsMoving(hasInput);
    setIsSprinting(sprinting);

    // Speed: Walk = 4.2 m/s, Sprint = 8.5 m/s
    const targetSpeed = sprinting ? 8.5 : 4.2;

    // Direction vector relative to yaw angle (Three.js camera forward is -Z, right is +X)
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

    const wishDir = new THREE.Vector3(0, 0, 0);
    if (hasInput) {
      wishDir.addScaledVector(forward, moveZ);
      wishDir.addScaledVector(right, moveX);
      wishDir.normalize();
    }

    // Horizontal acceleration & friction
    const accel = isGroundedRef.current ? (hasInput ? 18.0 : 12.0) : 4.0;
    const targetVelX = wishDir.x * targetSpeed;
    const targetVelZ = wishDir.z * targetSpeed;

    velocityRef.current.x += (targetVelX - velocityRef.current.x) * Math.min(1, accel * dt);
    velocityRef.current.z += (targetVelZ - velocityRef.current.z) * Math.min(1, accel * dt);

    // 4. Vertical Jump & Gravity Physics
    const gravity = -22.0; // Snappy responsive fall
    const jumpStrength = 7.0;

    if (keys.jump && isGroundedRef.current) {
      velocityRef.current.y = jumpStrength;
      isGroundedRef.current = false;
    }

    if (!isGroundedRef.current) {
      velocityRef.current.y += gravity * dt;
    }

    // 5. Integrate Position
    posRef.current.x += velocityRef.current.x * dt;
    posRef.current.y += velocityRef.current.y * dt;
    posRef.current.z += velocityRef.current.z * dt;

    // Ground collision clamp
    if (posRef.current.y <= BOUNDS.groundY) {
      posRef.current.y = BOUNDS.groundY;
      velocityRef.current.y = 0;
      isGroundedRef.current = true;
    }

    // Street boundaries clamp
    posRef.current.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, posRef.current.x));
    posRef.current.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, posRef.current.z));

    // Update camera world position and orientation (Euler order 'YXZ' prevents horizon roll/tilt)
    camera.position.copy(posRef.current);
    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");

    // Throttled stats callback for HUD (prevents 60 FPS React re-render churn and micro-stutter)
    const now = performance.now();
    if (now - lastStatsTimeRef.current > 120) {
      lastStatsTimeRef.current = now;
      onStatsUpdate?.({
        position: [posRef.current.x, posRef.current.y, posRef.current.z],
        speed: Math.hypot(velocityRef.current.x, velocityRef.current.z),
        isSprinting: sprinting,
        isGrounded: isGroundedRef.current,
      });
    }
  });

  return (
    <primitive object={camera}>
      {/* 
        First-person arms attached as direct child of camera in the scene graph.
        Guarantees zero-latency viewpoint tracking, eliminates floating point precision jitter,
        and ensures Three.js renders the arms inside the camera view frustum.
      */}
      <FirstPersonArms
        isMoving={isMoving}
        isSprinting={isSprinting}
        isPunching={isPunching}
        isInspecting={isInspecting}
        keysRef={keysRef}
        consumePunchTrigger={consumePunchTrigger}
        onPunchStrike={performPunchRaycastAndAudio}
        onPunchFinished={handlePunchFinished}
        onInspectFinished={handleInspectFinished}
      />
    </primitive>
  );
};

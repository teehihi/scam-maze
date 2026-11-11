import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import type { PlayerControlsState } from "./types";

export const ARMS_MODEL_PATH = "/assets/3d/characters/first_person_animations.glb";

// Preload the first-person arms model
useGLTF.preload(ARMS_MODEL_PATH);

interface FirstPersonArmsProps {
  isMoving: boolean;
  isSprinting: boolean;
  isPunching: boolean;
  isBlocking: boolean;
  isInteracting: boolean;
  isInspecting: boolean;
  keysRef?: React.RefObject<PlayerControlsState>;
  consumePunchTrigger?: () => boolean;
  onPunchStrike?: () => void;
  onPunchFinished?: () => void;
  onInspectFinished?: () => void;
  onInteractFinished?: () => void;
}

export const FirstPersonArms: React.FC<FirstPersonArmsProps> = ({
  isMoving: _isMoving,
  isSprinting,
  isPunching,
  isBlocking,
  isInteracting,
  isInspecting,
  keysRef,
  consumePunchTrigger,
  onPunchStrike,
  onPunchFinished,
  onInspectFinished,
  onInteractFinished,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(ARMS_MODEL_PATH);
  const { actions } = useAnimations(gltf.animations, groupRef);

  const punchHandRef = useRef<"R" | "L">("R");
  const currentLocomotionActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentPunchActionRef = useRef<THREE.AnimationAction | null>(null);

  // Stable callback refs
  const onPunchStrikeRef = useRef(onPunchStrike);
  onPunchStrikeRef.current = onPunchStrike;
  const onPunchFinishedRef = useRef(onPunchFinished);
  onPunchFinishedRef.current = onPunchFinished;
  const onInspectFinishedRef = useRef(onInspectFinished);
  onInspectFinishedRef.current = onInspectFinished;
  const onInteractFinishedRef = useRef(onInteractFinished);
  onInteractFinishedRef.current = onInteractFinished;
  const consumePunchTriggerRef = useRef(consumePunchTrigger);
  consumePunchTriggerRef.current = consumePunchTrigger;

  const isPunchingActiveRef = useRef(false);
  const isBlockingActiveRef = useRef(false);
  const isInteractingActiveRef = useRef(false);
  const isInspectingActiveRef = useRef(false);

  // Track if arms are currently raised/engaged or stowed/unequipped
  const isHandsActive = isSprinting || isPunching || isBlocking || isInteracting || isInspecting;
  const wasHandsActiveRef = useRef(false);

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Configure materials, textures, shadows, and renderOrder on GLTF scene
  useEffect(() => {
    gltf.scene.traverse((child) => {
      const name = child.name || "";
      if (name.includes("Background")) {
        child.visible = false;
      }
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
        child.renderOrder = 999;
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.depthTest = true;
          mat.depthWrite = true;
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }
          if (mat.normalMap) {
            mat.normalScale.set(1.0, 1.0);
          }
          mat.roughness = 0.55;
          mat.metalness = 0.0;
          mat.needsUpdate = true;
        }
      }
    });
  }, [gltf.scene]);

  // Smooth vertical position interpolation (stowed off-screen when idle/walking, raised during sprint/combat)
  const currentYRef = useRef(-1.55);
  // Post-combat readiness window: keeps hands at combat height for 650ms so rapid follow-up punches have 0ms delay
  const combatReadyUntilRef = useRef(0);

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const now = performance.now();

    const isCombatReady = now < combatReadyUntilRef.current;

    // Instant zero-latency snap on punch strike
    if (isPunching) {
      currentYRef.current = -1.08;
      groupRef.current.position.y = -1.08;
      return;
    }

    // Target Y:
    // Stowed / unequipped: -1.55 (completely below viewport)
    // Raised:
    // - Blocking: -0.98 (raised guard)
    // - Sprinting: -1.10 (athletic arm swing)
    // - Combat Ready / Interacting / Inspecting: -1.08
    let targetY = -1.55;
    if (isBlocking) {
      targetY = -0.98;
    } else if (isCombatReady || isInteracting || isInspecting) {
      targetY = -1.08;
    } else if (isSprinting) {
      targetY = -1.10;
    } else {
      targetY = -1.55; // Idle or normal walk: hands tucked away out of sight
    }

    // Snappy raise (speed 22), smooth natural tuck away (speed 9)
    const lerpSpeed = targetY > currentYRef.current ? 22 : 9;
    currentYRef.current += (targetY - currentYRef.current) * (1 - Math.exp(-lerpSpeed * dt));
    groupRef.current.position.y = currentYRef.current;
  });

  // 1. Unequip State Management: When leaving sprint/combat/inspect into idle/walk
  useEffect(() => {
    if (!actions) return;

    if (isHandsActive) {
      wasHandsActiveRef.current = true;
      if (actions["rig|Unequip"]?.isRunning()) {
        actions["rig|Unequip"].fadeOut(0.08);
      }
    } else if (wasHandsActiveRef.current) {
      wasHandsActiveRef.current = false;

      // Stop any active locomotion or combat animation
      if (currentLocomotionActionRef.current && currentLocomotionActionRef.current.isRunning()) {
        currentLocomotionActionRef.current.fadeOut(0.12);
        currentLocomotionActionRef.current = null;
      }

      // Play author's rig|Unequip to smoothly tuck arms away out of view
      const unequipAction = actions["rig|Unequip"];
      if (unequipAction) {
        unequipAction.reset();
        unequipAction.timeScale = 1.35;
        unequipAction.setLoop(THREE.LoopOnce, 1);
        unequipAction.clampWhenFinished = true;
        unequipAction.fadeIn(0.06).play();

        const unequipDuration = Math.round((unequipAction.getClip().duration / 1.35) * 1000);
        const timer = setTimeout(() => {
          unequipAction.fadeOut(0.15);
        }, unequipDuration);

        return () => clearTimeout(timer);
      }
    }
  }, [isHandsActive, actions]);

  // 2. Sprint Arm Locomotion (Only when running fast: Shift + WASD)
  useEffect(() => {
    if (!actions || !isSprinting || isPunching || isBlocking || isInteracting || isInspecting) {
      if (currentLocomotionActionRef.current && !isSprinting) {
        currentLocomotionActionRef.current.fadeOut(0.12);
        currentLocomotionActionRef.current = null;
      }
      return;
    }

    const sprintAction = actions["rig|Sprint_Type_1"];
    if (!sprintAction) return;

    sprintAction.timeScale = 1.25; // Athletic forward pumping arm stride

    if (currentLocomotionActionRef.current !== sprintAction) {
      if (currentLocomotionActionRef.current) {
        currentLocomotionActionRef.current.fadeOut(0.12);
      }
      sprintAction.reset();
      sprintAction.setLoop(THREE.LoopRepeat, Infinity);
      sprintAction.fadeIn(0.15).play();
      currentLocomotionActionRef.current = sprintAction;
    } else if (!sprintAction.isRunning()) {
      sprintAction.play();
    }
  }, [isSprinting, isPunching, isBlocking, isInteracting, isInspecting, actions]);

  // 3. Punch Logic: Instant on-click + Continuous 1-2 Combo while holding
  useEffect(() => {
    if (!isPunching) {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      isPunchingActiveRef.current = false;
      return;
    }

    if (isPunchingActiveRef.current) return;
    isPunchingActiveRef.current = true;

    if (isInspectingActiveRef.current && actions?.["rig|Inspect"]) {
      actions["rig|Inspect"].stop();
      isInspectingActiveRef.current = false;
    }
    if (isInteractingActiveRef.current && actions?.["rig|Take_Start"]) {
      actions["rig|Take_Start"].stop();
      isInteractingActiveRef.current = false;
    }

    if (!actions) {
      isPunchingActiveRef.current = false;
      onPunchFinishedRef.current?.();
      return;
    }

    const firePunchStrike = (hand: "R" | "L") => {
      const punchClip = hand === "R" ? "rig|Punch_R" : "rig|Punch_L";
      const punchAction = actions[punchClip];
      if (!punchAction) {
        isPunchingActiveRef.current = false;
        onPunchFinishedRef.current?.();
        return;
      }

      // Immediately trigger raycast & sound (0ms latency feedback)
      onPunchStrikeRef.current?.();

      // Zero-latency position snap directly to combat height so strike lands on screen on frame 0
      currentYRef.current = -1.08;
      if (groupRef.current) {
        groupRef.current.position.y = -1.08;
      }
      combatReadyUntilRef.current = performance.now() + 650;

      // Suppress active locomotion or unequip animation so punch is clean
      if (actions["rig|Unequip"]?.isRunning()) {
        actions["rig|Unequip"].stop();
      }
      if (currentLocomotionActionRef.current && currentLocomotionActionRef.current.isRunning()) {
        currentLocomotionActionRef.current.fadeOut(0.04);
      }

      if (currentPunchActionRef.current && currentPunchActionRef.current !== punchAction) {
        currentPunchActionRef.current.fadeOut(0.06);
      }
      currentPunchActionRef.current = punchAction;

      punchAction.reset();
      // Ultra-snappy boxing speed (2.15x = 0.46s duration, impact peak lands at ~140ms)
      punchAction.timeScale = 2.15;
      punchAction.setLoop(THREE.LoopOnce, 1);
      punchAction.clampWhenFinished = false;
      punchAction.fadeIn(0.01);
      punchAction.play();

      const COMBO_CHAIN_DELAY_MS = 330;
      const FULL_RECOVERY_MS = Math.round((punchAction.getClip().duration / punchAction.timeScale) * 1000);

      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);

      comboTimerRef.current = setTimeout(() => {
        const isStillHolding = Boolean(keysRef?.current?.punch);
        const hasQueuedClick = Boolean(consumePunchTriggerRef.current?.());

        if (isStillHolding || hasQueuedClick) {
          const nextHand = hand === "R" ? "L" : "R";
          punchHandRef.current = nextHand;
          firePunchStrike(nextHand);
        }
      }, COMBO_CHAIN_DELAY_MS);

      watchdogTimerRef.current = setTimeout(() => {
        const isStillHolding = Boolean(keysRef?.current?.punch);
        if (isStillHolding) {
          const nextHand = hand === "R" ? "L" : "R";
          punchHandRef.current = nextHand;
          firePunchStrike(nextHand);
          return;
        }

        punchAction.fadeOut(0.12);
        isPunchingActiveRef.current = false;
        onPunchFinishedRef.current?.();

        if (currentLocomotionActionRef.current && isSprinting) {
          currentLocomotionActionRef.current.reset().fadeIn(0.18).play();
        }
      }, FULL_RECOVERY_MS + 20);
    };

    firePunchStrike(punchHandRef.current);

    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    };
  }, [isPunching, actions, keysRef, isSprinting]);

  // 4. Defensive Block / Guard: Right Click hold (rig|Block_Start -> rig|Block_Loop -> rig|Block_Stop)
  useEffect(() => {
    if (!actions || isPunching) return;

    const blockStart = actions["rig|Block_Start"];
    const blockLoop = actions["rig|Block_Loop"];
    const blockStop = actions["rig|Block_Stop"];

    if (!blockStart || !blockLoop || !blockStop) return;

    if (isBlocking) {
      if (isBlockingActiveRef.current) return;
      isBlockingActiveRef.current = true;

      if (actions["rig|Unequip"]?.isRunning()) {
        actions["rig|Unequip"].stop();
      }
      if (currentLocomotionActionRef.current && currentLocomotionActionRef.current.isRunning()) {
        currentLocomotionActionRef.current.fadeOut(0.08);
      }

      blockStart.reset();
      blockStart.timeScale = 1.6;
      blockStart.setLoop(THREE.LoopOnce, 1);
      blockStart.clampWhenFinished = true;
      blockStart.fadeIn(0.04).play();

      const startDurationMs = Math.round((blockStart.getClip().duration / blockStart.timeScale) * 1000);
      const timer = setTimeout(() => {
        if (!isBlockingActiveRef.current) return;
        blockStart.fadeOut(0.1);
        blockLoop.reset().fadeIn(0.1);
        blockLoop.setLoop(THREE.LoopRepeat, Infinity);
        blockLoop.play();
      }, startDurationMs);

      return () => clearTimeout(timer);
    } else if (isBlockingActiveRef.current) {
      isBlockingActiveRef.current = false;
      blockLoop.fadeOut(0.08);
      blockStart.fadeOut(0.08);

      blockStop.reset();
      blockStop.timeScale = 1.6;
      blockStop.setLoop(THREE.LoopOnce, 1);
      blockStop.clampWhenFinished = false;
      blockStop.fadeIn(0.04).play();

      const stopDurationMs = Math.round((blockStop.getClip().duration / blockStop.timeScale) * 1000);
      const timer = setTimeout(() => {
        blockStop.fadeOut(0.12);
        if (currentLocomotionActionRef.current && isSprinting) {
          currentLocomotionActionRef.current.reset().fadeIn(0.15).play();
        }
      }, stopDurationMs);

      return () => clearTimeout(timer);
    }
  }, [isBlocking, isPunching, actions, isSprinting]);

  // 5. Interaction Hand Reach / Take: Key E (rig|Take_Start -> rig|Take_Stop)
  useEffect(() => {
    if (!isInteracting || isPunching || isBlocking || !actions) {
      return;
    }
    if (isInteractingActiveRef.current) return;
    isInteractingActiveRef.current = true;

    const takeStart = actions["rig|Take_Start"];
    const takeStop = actions["rig|Take_Stop"];
    if (!takeStart) {
      isInteractingActiveRef.current = false;
      onInteractFinishedRef.current?.();
      return;
    }

    if (actions["rig|Unequip"]?.isRunning()) {
      actions["rig|Unequip"].stop();
    }
    if (currentLocomotionActionRef.current && currentLocomotionActionRef.current.isRunning()) {
      currentLocomotionActionRef.current.fadeOut(0.1);
    }

    takeStart.reset();
    takeStart.timeScale = 1.35;
    takeStart.setLoop(THREE.LoopOnce, 1);
    takeStart.clampWhenFinished = false;
    takeStart.fadeIn(0.06).play();

    const startMs = Math.round((takeStart.getClip().duration / takeStart.timeScale) * 1000);
    const timer = setTimeout(() => {
      takeStart.fadeOut(0.1);
      if (takeStop) {
        takeStop.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.08).play();
        const stopMs = Math.round((takeStop.getClip().duration / 1.35) * 1000);
        setTimeout(() => {
          takeStop.fadeOut(0.15);
          isInteractingActiveRef.current = false;
          onInteractFinishedRef.current?.();
          if (currentLocomotionActionRef.current && isSprinting) {
            currentLocomotionActionRef.current.reset().fadeIn(0.15).play();
          }
        }, stopMs);
      } else {
        isInteractingActiveRef.current = false;
        onInteractFinishedRef.current?.();
        if (currentLocomotionActionRef.current && isSprinting) {
          currentLocomotionActionRef.current.reset().fadeIn(0.15).play();
        }
      }
    }, startMs);

    return () => clearTimeout(timer);
  }, [isInteracting, isPunching, isBlocking, actions, isSprinting]);

  // 6. Inspect Animation: Keys T or I (rig|Inspect)
  useEffect(() => {
    if (!isInspecting) {
      isInspectingActiveRef.current = false;
      return;
    }
    if (isInspectingActiveRef.current) return;
    isInspectingActiveRef.current = true;

    if (!actions) {
      onInspectFinishedRef.current?.();
      return;
    }

    const inspectAction = actions["rig|Inspect"];
    if (!inspectAction) {
      onInspectFinishedRef.current?.();
      return;
    }

    if (actions["rig|Unequip"]?.isRunning()) {
      actions["rig|Unequip"].stop();
    }
    if (currentLocomotionActionRef.current && currentLocomotionActionRef.current.isRunning()) {
      currentLocomotionActionRef.current.fadeOut(0.12);
    }

    inspectAction.reset();
    inspectAction.timeScale = 1.0;
    inspectAction.setLoop(THREE.LoopOnce, 1);
    inspectAction.clampWhenFinished = false;
    inspectAction.fadeIn(0.12);
    inspectAction.play();

    let isDone = false;
    const finishInspect = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(watchdogTimer);
      inspectAction.fadeOut(0.2);
      isInspectingActiveRef.current = false;
      onInspectFinishedRef.current?.();

      if (currentLocomotionActionRef.current && isSprinting) {
        currentLocomotionActionRef.current.reset().fadeIn(0.2).play();
      }
    };

    const clipDuration = inspectAction.getClip().duration || 6.0;
    const watchdogTimer = setTimeout(finishInspect, Math.round(clipDuration * 1000) + 50);

    return () => {
      clearTimeout(watchdogTimer);
    };
  }, [isInspecting, actions, isSprinting]);

  return (
    <group
      ref={groupRef}
      // Natural hidden start position (-1.55m is completely below camera view frustum)
      position={[0, -1.55, 0.06]}
      rotation={[-0.05, Math.PI, 0]}
      scale={[0.72, 0.72, 0.72]}
    >
      <primitive object={gltf.scene} />
    </group>
  );
};

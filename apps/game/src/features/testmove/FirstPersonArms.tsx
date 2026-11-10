import React, { useEffect, useRef, useState } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import type { PlayerControlsState } from "./usePlayerControls";

export const ARMS_MODEL_PATH = "/assets/3d/characters/first_person_animations.glb";

// Preload the first-person arms model
useGLTF.preload(ARMS_MODEL_PATH);

interface FirstPersonArmsProps {
  isMoving: boolean;
  isSprinting: boolean;
  isPunching: boolean;
  isInspecting: boolean;
  keysRef?: React.RefObject<PlayerControlsState>;
  consumePunchTrigger?: () => boolean;
  onPunchStrike?: () => void;
  onPunchFinished?: () => void;
  onInspectFinished?: () => void;
}

export const FirstPersonArms: React.FC<FirstPersonArmsProps> = ({
  isMoving,
  isSprinting,
  isPunching,
  isInspecting,
  keysRef,
  consumePunchTrigger,
  onPunchStrike,
  onPunchFinished,
  onInspectFinished,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(ARMS_MODEL_PATH);
  const { actions, mixer } = useAnimations(gltf.animations, groupRef);

  const [isEquipped, setIsEquipped] = useState(false);
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
  const consumePunchTriggerRef = useRef(consumePunchTrigger);
  consumePunchTriggerRef.current = consumePunchTrigger;

  const isPunchingActiveRef = useRef(false);
  const isInspectingActiveRef = useRef(false);
  const isEquippingActiveRef = useRef(true);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Configure materials, textures, shadows, and renderOrder on gltf scene
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

  // 1. Initial Equip Animation (Author's rig|Equip on entry)
  useEffect(() => {
    if (!actions) return;
    const equipAction = actions["rig|Equip"];
    if (!equipAction) {
      setIsEquipped(true);
      isEquippingActiveRef.current = false;
      return;
    }

    isEquippingActiveRef.current = true;
    equipAction.reset();
    equipAction.setLoop(THREE.LoopOnce, 1);
    equipAction.clampWhenFinished = false;
    equipAction.fadeIn(0.08);
    equipAction.play();

    let isDone = false;
    const finishEquip = () => {
      if (isDone) return;
      isDone = true;
      mixer.removeEventListener("finished", handleFinished);
      clearTimeout(watchdogTimer);
      equipAction.fadeOut(0.18);
      isEquippingActiveRef.current = false;
      setIsEquipped(true);
    };

    const handleFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === equipAction) {
        finishEquip();
      }
    };

    const duration = equipAction.getClip().duration || 0.73;
    const watchdogTimer = setTimeout(finishEquip, Math.round(duration * 1000) + 50);

    mixer.addEventListener("finished", handleFinished);
    return () => {
      mixer.removeEventListener("finished", handleFinished);
      clearTimeout(watchdogTimer);
    };
  }, [actions, mixer]);

  // 2. Punch Logic: Instant on-click + Continuous 1-2 Combo while holding
  useEffect(() => {
    if (!isPunching) {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      isPunchingActiveRef.current = false;
      return;
    }

    if (isPunchingActiveRef.current) return;
    isPunchingActiveRef.current = true;

    // Interrupt equip or inspect if punching
    if (isEquippingActiveRef.current && actions?.["rig|Equip"]) {
      actions["rig|Equip"].stop();
      isEquippingActiveRef.current = false;
      setIsEquipped(true);
    }
    if (isInspectingActiveRef.current && actions?.["rig|Inspect"]) {
      actions["rig|Inspect"].stop();
      isInspectingActiveRef.current = false;
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

      // Immediately play punch raycast & sound (0ms perceptual delay)
      onPunchStrikeRef.current?.();

      // Suppress active locomotion animation so punch is 100% clean
      if (currentLocomotionActionRef.current && currentLocomotionActionRef.current.isRunning()) {
        currentLocomotionActionRef.current.fadeOut(0.04);
      }

      // If previous punch was still blending, crossfade out
      if (currentPunchActionRef.current && currentPunchActionRef.current !== punchAction) {
        currentPunchActionRef.current.fadeOut(0.06);
      }
      currentPunchActionRef.current = punchAction;

      punchAction.reset();
      // Fast, snappy punch speed (1.85x = 0.54s duration, hit lands at ~180ms)
      punchAction.timeScale = 1.85;
      punchAction.setLoop(THREE.LoopOnce, 1);
      punchAction.clampWhenFinished = false;
      // Instant snap on frame 0
      punchAction.fadeIn(0.01);
      punchAction.play();

      // Combo transition window: at 380ms the fist has struck and retracted 70%.
      // If user is holding mouse/key or clicked again, chain the next punch seamlessly!
      const COMBO_CHAIN_DELAY_MS = 380;
      const FULL_RECOVERY_MS = Math.round((punchAction.getClip().duration / punchAction.timeScale) * 1000);

      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);

      comboTimerRef.current = setTimeout(() => {
        const isStillHolding = Boolean(keysRef?.current?.punch);
        const hasQueuedClick = Boolean(consumePunchTriggerRef.current?.());

        if (isStillHolding || hasQueuedClick) {
          // Chain into next punch with opposite hand
          const nextHand = hand === "R" ? "L" : "R";
          punchHandRef.current = nextHand;
          firePunchStrike(nextHand);
        }
      }, COMBO_CHAIN_DELAY_MS);

      // Watchdog: when the punch is fully finished and not chained
      watchdogTimerRef.current = setTimeout(() => {
        const isStillHolding = Boolean(keysRef?.current?.punch);
        if (isStillHolding) {
          const nextHand = hand === "R" ? "L" : "R";
          punchHandRef.current = nextHand;
          firePunchStrike(nextHand);
          return;
        }

        punchAction.fadeOut(0.12);
        currentPunchActionRef.current = null;
        isPunchingActiveRef.current = false;
        onPunchFinishedRef.current?.();

        // Restore locomotion animation
        if (currentLocomotionActionRef.current) {
          currentLocomotionActionRef.current.reset().fadeIn(0.18).play();
        }
      }, FULL_RECOVERY_MS + 20);
    };

    // Execute first punch immediately
    firePunchStrike(punchHandRef.current);

    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    };
  }, [isPunching, actions, keysRef]);

  // 3. Inspect Animation (Author's rig|Inspect)
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
      mixer.removeEventListener("finished", handleFinished);
      clearTimeout(watchdogTimer);
      inspectAction.fadeOut(0.2);
      isInspectingActiveRef.current = false;
      onInspectFinishedRef.current?.();

      if (currentLocomotionActionRef.current) {
        currentLocomotionActionRef.current.reset().fadeIn(0.2).play();
      }
    };

    const handleFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === inspectAction) {
        finishInspect();
      }
    };

    const clipDuration = inspectAction.getClip().duration || 6.0;
    const watchdogTimer = setTimeout(finishInspect, Math.round(clipDuration * 1000) + 50);

    mixer.addEventListener("finished", handleFinished);
    return () => {
      mixer.removeEventListener("finished", handleFinished);
      clearTimeout(watchdogTimer);
    };
  }, [isInspecting, actions, mixer]);

  // 4. Locomotion State Machine (Author's rig|Idle -> rig|Walk -> rig|Sprint_Type_1)
  useEffect(() => {
    if (!actions || !isEquipped || isPunching || isInspecting || isEquippingActiveRef.current) {
      return;
    }

    let targetClipName = "rig|Idle";
    let targetTimeScale = 1.0;

    if (isMoving) {
      if (isSprinting) {
        targetClipName = "rig|Sprint_Type_1";
        targetTimeScale = 1.05;
      } else {
        targetClipName = "rig|Walk";
        targetTimeScale = 1.0;
      }
    } else {
      targetClipName = "rig|Idle";
      targetTimeScale = 1.0;
    }

    const targetAction = actions[targetClipName];
    if (!targetAction) return;

    targetAction.timeScale = targetTimeScale;

    if (currentLocomotionActionRef.current !== targetAction) {
      if (currentLocomotionActionRef.current) {
        currentLocomotionActionRef.current.fadeOut(0.2);
      }
      targetAction.reset();
      targetAction.setLoop(THREE.LoopRepeat, Infinity);
      targetAction.fadeIn(0.2);
      targetAction.play();
      currentLocomotionActionRef.current = targetAction;
    } else if (!targetAction.isRunning()) {
      targetAction.play();
    }
  }, [isMoving, isSprinting, isPunching, isInspecting, isEquipped, actions]);

  return (
    <group
      ref={groupRef}
      position={[0, -1.1, 0.05]}
      rotation={[-0.05, Math.PI, 0]}
      scale={[0.72, 0.72, 0.72]}
    >
      <primitive object={gltf.scene} />
    </group>
  );
};

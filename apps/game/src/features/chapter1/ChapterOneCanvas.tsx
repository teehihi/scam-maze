/**
 * 3D canvas for Chapter 1 "The Urgent Call" (Requirements 2.1 to 2.5).
 *
 * Composes the existing street scene (sky, lighting, MenuBG street) with the shared first-person
 * player, the five procedural Interactables and the per-frame focus probe. It follows the pattern
 * of `features/testmove/TestMoveCanvas.tsx`, which stays unchanged.
 *
 * The canvas owns no gameplay state. Controls come from `usePlayerControls` in the page and are
 * passed in as `keysRef` and `consume*` functions. Focus and interaction are reported through
 * callbacks; the page decides what they mean.
 */

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { GameSettings } from "@scammaze/shared-types";
import { EnvironmentLighting } from "../../game/scenes/MainMenuScene/EnvironmentLighting";
import { SkyDome } from "../../game/scenes/MainMenuScene/SkyDome";
import { StreetEnvironment } from "../../game/scenes/MainMenuScene/StreetEnvironment";
import {
  STREET_PLAY_BOUNDS,
  STREET_PLAY_SPAWN,
  STREET_PLAY_SPAWN_YAW,
} from "../../game/scenes/MainMenuScene/streetPlayArea";
import { FirstPersonPlayer, type PlayerControlsState, type PlayerStats } from "../player";
import type { InteractableId } from "../../game/narrative/chapter1/ids";
import { InteractableProps } from "./world/InteractableProps";
import { InteractionProbe } from "./world/InteractionProbe";
import { PhoneModel3D, PhoneModelBoundary, PhoneModelWarmup } from "./call/PhoneModel3D";
import type { PhoneScreenSink } from "./call/phoneScreenSink";

/** Props of the 3D call phone while it is shown. */
export interface ChapterOneCallPhone {
  ringing: boolean;
  reducedMotion: boolean;
  /** `performance.now()` when the call overlay opened. */
  openedAt: number;
  screenSink: PhoneScreenSink;
}

/** Camera pose used by saves: eye position and yaw in radians. */
export interface ChapterOnePlayerPose {
  position: [number, number, number];
  yaw: number;
}

export interface ChapterOneCanvasProps {
  settings: GameSettings;
  /** When false, player input and the focus probe are off (for example while an overlay is open). */
  enabled: boolean;
  /** The focused Interactable, used for the highlight. */
  focusedId: InteractableId | null;
  onFocusChange: (id: InteractableId | null) => void;
  /** Called when the player presses the interact key. */
  onInteract?: (playerPosition: [number, number, number]) => void;
  onSceneReady?: () => void;
  /**
   * Spawn eye position, for example a restored save pose. Must be referentially stable: a new
   * array re-creates the player runtime. Defaults to `STREET_PLAY_SPAWN`.
   */
  spawnPosition?: [number, number, number];
  /** Spawn yaw in radians. Defaults to `STREET_PLAY_SPAWN_YAW`. */
  spawnYaw?: number;
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
  keysRef: React.MutableRefObject<PlayerControlsState>;
  onStatsUpdate?: (stats: PlayerStats) => void;
  /**
   * Filled with a function that reads the current camera pose, so the page can save it without
   * a per-frame React update. Reset to `null` on unmount.
   */
  poseGetterRef?: React.MutableRefObject<(() => ChapterOnePlayerPose) | null>;
  /** Set while the call overlay is open and the 3D phone is allowed; null otherwise. */
  callPhone?: ChapterOneCallPhone | null;
  /** False once the phone model failed in this session; no warmup or model is mounted then. */
  phoneModelEnabled?: boolean;
  onPhoneModelError?: (error: unknown) => void;
  /** Called with true on webglcontextlost and false on webglcontextrestored. */
  onWebGLContextChange?: (lost: boolean) => void;
}

/** Keeps the camera field of view in sync with the settings after the canvas is created. */
const CameraFov: React.FC<{ fov: number }> = ({ fov }) => {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, fov]);
  return null;
};

/** Exposes a pose getter that reads the camera on demand. */
const PoseGetter: React.FC<{
  getterRef: React.MutableRefObject<(() => ChapterOnePlayerPose) | null>;
}> = ({ getterRef }) => {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    // The player runtime sets rotation as (pitch, yaw, 0); read it back in YXZ order.
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    getterRef.current = () => {
      euler.setFromQuaternion(camera.quaternion, "YXZ");
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        yaw: euler.y,
      };
    };
    return () => {
      getterRef.current = null;
    };
  }, [camera, getterRef]);
  return null;
};

export const ChapterOneCanvas: React.FC<ChapterOneCanvasProps> = ({
  settings,
  enabled,
  focusedId,
  onFocusChange,
  onInteract,
  onSceneReady,
  spawnPosition = STREET_PLAY_SPAWN,
  spawnYaw = STREET_PLAY_SPAWN_YAW,
  consumeMovement,
  consumePunchTrigger,
  consumeInspectTrigger,
  consumeInteractTrigger,
  keysRef,
  onStatsUpdate,
  poseGetterRef,
  callPhone = null,
  phoneModelEnabled = false,
  onPhoneModelError,
  onWebGLContextChange,
}) => {
  // Latest callback props, read by stable wrappers so listeners and effects are not re-created.
  const onSceneReadyRef = useRef(onSceneReady);
  onSceneReadyRef.current = onSceneReady;
  const onPhoneModelErrorRef = useRef(onPhoneModelError);
  onPhoneModelErrorRef.current = onPhoneModelError;
  const onWebGLContextChangeRef = useRef(onWebGLContextChange);
  onWebGLContextChangeRef.current = onWebGLContextChange;

  // The phone warmup waits for the street, so the street loads first.
  const [sceneReady, setSceneReady] = useState(false);
  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
    onSceneReadyRef.current?.();
  }, []);
  const handlePhoneModelError = useCallback((error: unknown) => {
    onPhoneModelErrorRef.current?.(error);
  }, []);

  const shadows = settings.graphicsQuality === "high";
  const maxDpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const dpr =
    settings.graphicsQuality === "low"
      ? 1.0
      : settings.graphicsQuality === "medium"
        ? Math.min(maxDpr, 1.25)
        : Math.min(maxDpr, 1.5);

  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      gl={{
        antialias: settings.graphicsQuality !== "low",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
        powerPreference: "high-performance",
      }}
      camera={{
        fov: settings.fov,
        near: 0.05,
        far: 1200,
        position: spawnPosition,
      }}
      onCreated={({ gl }) => {
        // Prevent context loss from crashing the page; the browser may restore the GPU context.
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            console.warn("WebGL context temporarily lost. Waiting for browser GPU restoration...");
            onWebGLContextChangeRef.current?.(true);
          },
          false,
        );
        gl.domElement.addEventListener(
          "webglcontextrestored",
          () => {
            console.info("WebGL context restored successfully.");
            onWebGLContextChangeRef.current?.(false);
          },
          false,
        );
      }}
      className="w-full h-full"
      aria-hidden="true"
    >
      <CameraFov fov={settings.fov} />
      {poseGetterRef && <PoseGetter getterRef={poseGetterRef} />}

      <Suspense fallback={null}>
        <SkyDome />
      </Suspense>

      <EnvironmentLighting graphicsQuality={settings.graphicsQuality} />

      <Suspense fallback={null}>
        <StreetEnvironment shadows={shadows} onReady={handleSceneReady} />
      </Suspense>

      <InteractableProps focusedId={focusedId} />
      <InteractionProbe enabled={enabled} onFocusChange={onFocusChange} />

      <Suspense fallback={null}>
        <FirstPersonPlayer
          enabled={enabled}
          spawnPosition={spawnPosition}
          spawnYaw={spawnYaw}
          bounds={STREET_PLAY_BOUNDS}
          consumeMovement={consumeMovement}
          consumePunchTrigger={consumePunchTrigger}
          consumeInspectTrigger={consumeInspectTrigger}
          consumeInteractTrigger={consumeInteractTrigger}
          keysRef={keysRef}
          onStatsUpdate={onStatsUpdate}
          onInteract={onInteract}
          soundEnabled={settings.soundEnabled}
          sfxVolume={settings.sfxVolume}
        />
      </Suspense>

      {sceneReady && phoneModelEnabled && (
        <PhoneModelBoundary onError={handlePhoneModelError}>
          <Suspense fallback={null}>
            <PhoneModelWarmup />
          </Suspense>
        </PhoneModelBoundary>
      )}

      {/* Mounted at the scene root after the player, so its frame callback reads the camera
          pose the player set in the same frame. Its Suspense wraps only the phone. */}
      {callPhone && phoneModelEnabled && (
        <PhoneModelBoundary onError={handlePhoneModelError}>
          <Suspense fallback={null}>
            <PhoneModel3D
              ringing={callPhone.ringing}
              reducedMotion={callPhone.reducedMotion}
              openedAt={callPhone.openedAt}
              screenSink={callPhone.screenSink}
            />
          </Suspense>
        </PhoneModelBoundary>
      )}
    </Canvas>
  );
};

/**
 * The 3D call phone inside the chapter canvas.
 *
 * `PhoneModel3D` draws the optimized phone model in front of the camera and publishes the
 * projected screen rectangle to the page's `PhoneScreenSink`, so the DOM screen content
 * (`PhoneScreenHost` in model mode) follows exactly what is drawn. It reads the camera pose and
 * field of view but never writes to the camera. It adds no light, environment map,
 * post-processing or second canvas.
 *
 * This file imports nothing from the narrative store, the selectors or `useChapterState`: the
 * call status reaches it only as the `ringing` prop.
 */
import { Component, useEffect, useMemo, useRef, type ErrorInfo, type FC, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CALL_PHONE_GLB } from "../../../config/assetPaths";
import { BRAND } from "../theme";
import {
  SCREEN_HEIGHT_M,
  SCREEN_WIDTH_M,
  computeCallLayout,
  solveScreenPose,
  type Rect,
} from "./callLayout";
import { phoneMotionOffset } from "./phoneMotion";
import type { PhoneScreenSink } from "./phoneScreenSink";

/**
 * Loads the call phone. Draco is off (the file uses Meshopt, and Drei would otherwise point the
 * Draco decoder at a remote URL); Meshopt decoding is on. The model and the warmup use the same
 * arguments so they share one cache entry.
 */
function useCallPhoneGLTF() {
  return useGLTF(CALL_PHONE_GLB, false, true);
}

/**
 * Distance (meters) of the screen center in front of the model origin after the inner group's
 * rotation by π about Y. The `OLED` primitive lies in the plane z = −0.00343 facing −Z.
 */
const SCREEN_FRONT_OFFSET_M = 0.00343;
/** The dimming plane sits this far behind the screen (meters). */
const DIMMING_DISTANCE_BEHIND_M = 0.1;
/** Extra size so the dimming plane covers the frustum edges at any aspect ratio. */
const DIMMING_COVER_MARGIN = 1.2;
const DIMMING_OPACITY = 0.6;
/** The first rectangle must be published within this time for the entry slide to play. */
const ENTRY_ANIMATION_WINDOW_MS = 150;
/** Fallback vertical field of view (degrees) if the camera is not a perspective camera. */
const DEFAULT_FOV_DEG = 70;

export interface PhoneModel3DProps {
  /** Call status from the page, as a prop. */
  ringing: boolean;
  reducedMotion: boolean;
  /** `performance.now()` when the call overlay opened. */
  openedAt: number;
  screenSink: PhoneScreenSink;
}

/** Screen anchor corners in anchor-local space (the anchor sits on the screen center). */
const SCREEN_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-SCREEN_WIDTH_M / 2, SCREEN_HEIGHT_M / 2],
  [SCREEN_WIDTH_M / 2, SCREEN_HEIGHT_M / 2],
  [SCREEN_WIDTH_M / 2, -SCREEN_HEIGHT_M / 2],
  [-SCREEN_WIDTH_M / 2, -SCREEN_HEIGHT_M / 2],
];

export const PhoneModel3D: FC<PhoneModel3DProps> = ({ ringing, reducedMotion, openedAt, screenSink }) => {
  const { scene } = useCallPhoneGLTF();
  const size = useThree((state) => state.size);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
    });
    return clone;
  }, [scene]);

  const dimmingMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BRAND.graphite,
        transparent: true,
        opacity: DIMMING_OPACITY,
        depthWrite: false,
      }),
    [],
  );
  const dimmingGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useEffect(
    () => () => {
      dimmingMaterial.dispose();
      dimmingGeometry.dispose();
    },
    [dimmingMaterial, dimmingGeometry],
  );

  const rigRef = useRef<THREE.Group>(null);
  const anchorRef = useRef<THREE.Group>(null);
  const dimmingRef = useRef<THREE.Mesh>(null);
  const cornerScratch = useRef(new THREE.Vector3());
  /** Time of the first publication; `null` until the first frame. */
  const firstFrameAtRef = useRef<number | null>(null);
  const animateEntryRef = useRef(true);

  // Latest props for the frame callback without re-subscribing it.
  const propsRef = useRef({ ringing, reducedMotion, openedAt, screenSink });
  propsRef.current = { ringing, reducedMotion, openedAt, screenSink };

  useEffect(() => {
    return () => {
      screenSink.publish(null);
    };
  }, [screenSink]);

  // Default priority (0): R3F keeps rendering. Mounted after the player, so this runs after the
  // player runtime has moved the camera in the same frame.
  useFrame(({ camera }) => {
    const rig = rigRef.current;
    const anchor = anchorRef.current;
    const dimming = dimmingRef.current;
    if (!rig || !anchor || !dimming) return;
    const props = propsRef.current;

    const now = performance.now();
    if (firstFrameAtRef.current === null) {
      firstFrameAtRef.current = now;
      animateEntryRef.current = now - props.openedAt <= ENTRY_ANIMATION_WINDOW_MS;
    }

    const viewport = { width: size.width, height: size.height };
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : DEFAULT_FOV_DEG;

    const layout = computeCallLayout(viewport);
    const offset = phoneMotionOffset({
      elapsedMs: now - firstFrameAtRef.current,
      animateEntry: animateEntryRef.current,
      ringing: props.ringing,
      reducedMotion: props.reducedMotion,
      layout,
      viewport,
    });
    const target: Rect = { ...layout.screen, left: layout.screen.left + offset };
    const pose = solveScreenPose(target, viewport, fov);

    // Copy the camera pose (read only) into the rig, then move along the camera axes.
    rig.position.copy(camera.position);
    rig.quaternion.copy(camera.quaternion);
    rig.translateX(pose.x);
    rig.translateY(pose.y);
    rig.translateZ(pose.z - SCREEN_FRONT_OFFSET_M);

    // Dimming plane: centered on the camera axis, behind the screen, covering the frustum.
    const dimmingDistance = -pose.z + DIMMING_DISTANCE_BEHIND_M;
    const dimmingHeight =
      2 * dimmingDistance * Math.tan((fov * Math.PI) / 360) * DIMMING_COVER_MARGIN;
    const dimmingWidth = dimmingHeight * (viewport.width / viewport.height);
    dimming.position.set(
      -pose.x,
      -pose.y,
      SCREEN_FRONT_OFFSET_M - DIMMING_DISTANCE_BEHIND_M,
    );
    dimming.scale.set(dimmingWidth, dimmingHeight, 1);

    // Project the four anchor corners with the current camera matrices and publish the
    // bounding rectangle in CSS px.
    rig.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const corner = cornerScratch.current;
    for (const [x, y] of SCREEN_CORNERS) {
      corner.set(x, y, 0);
      anchor.localToWorld(corner);
      corner.project(camera);
      const px = ((corner.x + 1) / 2) * viewport.width;
      const py = ((1 - corner.y) / 2) * viewport.height;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;
    props.screenSink.publish({ left: minX, top: minY, width: maxX - minX, height: maxY - minY });
  });

  return (
    <group ref={rigRef}>
      <group rotation={[0, Math.PI, 0]}>
        <primitive object={model} />
      </group>
      <group ref={anchorRef} position={[0, 0, SCREEN_FRONT_OFFSET_M]} />
      <mesh
        ref={dimmingRef}
        geometry={dimmingGeometry}
        material={dimmingMaterial}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
    </group>
  );
};

/** Parses the phone model ahead of a call (from the HTTP cache the chapter loader filled). */
export const PhoneModelWarmup: FC = () => {
  useCallPhoneGLTF();
  return null;
};

interface PhoneModelBoundaryProps {
  onError: (error: unknown) => void;
  children: ReactNode;
}

interface PhoneModelBoundaryState {
  failed: boolean;
}

/** Catches phone model load and decode errors inside the canvas; renders nothing after one. */
export class PhoneModelBoundary extends Component<PhoneModelBoundaryProps, PhoneModelBoundaryState> {
  state: PhoneModelBoundaryState = { failed: false };

  static getDerivedStateFromError(): PhoneModelBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

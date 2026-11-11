/**
 * Per-frame focus probe for Chapter 1 Interactables (Requirements 3.1, 3.2).
 *
 * Every frame it reads the camera's world position and forward direction, runs the pure
 * `findFocusedInteractable` test and calls `onFocusChange` only when the focused ID changes. It
 * renders nothing and never sets React state itself, so a still camera causes no re-renders.
 *
 * When `enabled` is false (for example while an Overlay is open), the probe reports `null` once
 * and then stops testing until it is enabled again.
 */

import React, { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { InteractableId } from "../../../game/narrative/chapter1/ids";
import {
  MAX_INTERACT_DISTANCE,
  findFocusedInteractable,
} from "../interaction/findFocusedInteractable";
import type { InteractableSphere } from "../interaction/findFocusedInteractable";
import { INTERACTABLE_SPHERES } from "./propLayout";

export interface InteractionProbeProps {
  /** Called with the new focused ID (or `null`) only when it differs from the last report. */
  onFocusChange: (id: InteractableId | null) => void;
  /** When false, focus is cleared and no tests run. Defaults to true. */
  enabled?: boolean;
  /** Focus spheres to test. Defaults to `INTERACTABLE_SPHERES`. */
  spheres?: readonly InteractableSphere<InteractableId>[];
  /** Maximum ray-entry distance in metres. Defaults to `MAX_INTERACT_DISTANCE`. */
  maxDistance?: number;
}

export const InteractionProbe: React.FC<InteractionProbeProps> = ({
  onFocusChange,
  enabled = true,
  spheres = INTERACTABLE_SPHERES,
  maxDistance = MAX_INTERACT_DISTANCE,
}) => {
  const camera = useThree((state) => state.camera);
  const position = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const lastReported = useRef<InteractableId | null>(null);
  const onFocusChangeRef = useRef(onFocusChange);

  useEffect(() => {
    onFocusChangeRef.current = onFocusChange;
  }, [onFocusChange]);

  const report = (id: InteractableId | null) => {
    if (id === lastReported.current) return;
    lastReported.current = id;
    onFocusChangeRef.current(id);
  };

  // Clear focus when the probe unmounts so the page does not keep a stale prompt.
  useEffect(
    () => () => {
      if (lastReported.current !== null) {
        lastReported.current = null;
        onFocusChangeRef.current(null);
      }
    },
    [],
  );

  useFrame(() => {
    if (!enabled) {
      report(null);
      return;
    }
    camera.getWorldPosition(position.current);
    camera.getWorldDirection(direction.current);
    const p = position.current;
    const d = direction.current;
    report(findFocusedInteractable([p.x, p.y, p.z], [d.x, d.y, d.z], spheres, maxDistance));
  });

  return null;
};

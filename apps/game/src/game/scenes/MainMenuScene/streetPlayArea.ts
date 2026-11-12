/**
 * Walkable street play area shared by the Chapter 1 canvas and the save system.
 *
 * Values are copied from `features/testmove/TestMoveCanvas.tsx`, which is left unchanged.
 * This module has no React or Three.js imports so pure code (for example save restore) can
 * use it.
 */

export type PlayAreaPosition = readonly [number, number, number];

export interface StreetPlayBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly groundY: number;
}

export const STREET_PLAY_SPAWN: [number, number, number] = [188.6, -92.7, -88.89];

export const STREET_PLAY_SPAWN_YAW = Math.PI;

export const STREET_PLAY_BOUNDS: StreetPlayBounds = Object.freeze({
  minX: 180,
  maxX: 198.5,
  minZ: -92,
  maxZ: 52,
  groundY: -92.7,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Returns a new position with X and Z clamped to the play-area rectangle and Y raised to at
 * least the ground height. The input is not mutated. Callers must reject non-finite values
 * before calling; this function does not repair NaN.
 */
export function clampToPlayArea(
  position: PlayAreaPosition,
  bounds: StreetPlayBounds = STREET_PLAY_BOUNDS,
): [number, number, number] {
  const [x, y, z] = position;
  return [
    clamp(x, bounds.minX, bounds.maxX),
    Math.max(y, bounds.groundY),
    clamp(z, bounds.minZ, bounds.maxZ),
  ];
}

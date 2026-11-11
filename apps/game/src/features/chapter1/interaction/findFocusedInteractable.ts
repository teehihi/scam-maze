/**
 * Focus detection for Chapter 1 interactables (Requirements 3.1, 3.2).
 *
 * A pure ray–sphere test with no Three.js dependency, so it can be property-tested
 * (design Property 9). Vectors are plain `[x, y, z]` tuples in world units (metres).
 */

export type Vec3 = readonly [number, number, number];

/** Maximum distance, in metres, from the camera to the point where the view ray enters a sphere. */
export const MAX_INTERACT_DISTANCE = 3.0;

export interface InteractableSphere<Id extends string = string> {
  readonly id: Id;
  readonly center: Vec3;
  readonly radius: number;
}

/**
 * Returns the distance along a ray from `origin` (with unit direction `dir`) to the point where
 * it enters the sphere, or `null` when the ray misses it. The value can be zero or negative when
 * the origin is on or inside the sphere.
 */
function rayEntryDistance(origin: Vec3, dir: Vec3, center: Vec3, radius: number): number | null {
  const ox = center[0] - origin[0];
  const oy = center[1] - origin[1];
  const oz = center[2] - origin[2];
  const tca = ox * dir[0] + oy * dir[1] + oz * dir[2];
  const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
  const r2 = radius * radius;
  if (d2 > r2) return null;
  return tca - Math.sqrt(r2 - d2);
}

/**
 * Returns the ID of the interactable whose sphere the camera view ray enters first, at a positive
 * distance not greater than `maxDistance`. Returns `null` when no sphere qualifies, when the
 * direction is zero-length or when any input is not finite.
 *
 * Tie-break: when two spheres have exactly the same entry distance, the one that appears first in
 * `interactables` wins.
 */
export function findFocusedInteractable<Id extends string>(
  origin: Vec3,
  direction: Vec3,
  interactables: readonly InteractableSphere<Id>[],
  maxDistance: number = MAX_INTERACT_DISTANCE,
): Id | null {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (!Number.isFinite(length) || length === 0) return null;
  const dir: Vec3 = [direction[0] / length, direction[1] / length, direction[2] / length];

  let bestId: Id | null = null;
  let bestDistance = Infinity;
  for (const item of interactables) {
    if (!(item.radius > 0)) continue;
    const t = rayEntryDistance(origin, dir, item.center, item.radius);
    if (t === null || !Number.isFinite(t)) continue;
    if (t > 0 && t <= maxDistance && t < bestDistance) {
      bestDistance = t;
      bestId = item.id;
    }
  }
  return bestId;
}

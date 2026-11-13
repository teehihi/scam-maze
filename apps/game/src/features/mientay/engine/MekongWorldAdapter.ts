import type { Vector3 } from "three";
import type { GameWorldAdapter, MovementResolution } from "../../player";
import {
  raycastSolidColliders,
  resolveHorizontalCollision,
  sampleWalkableHeight,
} from "../world/terrain/MekongHeightfield";

/** Deep water that the player cannot wade into (a pier, deck or bridge still counts as ground). */
const DEEP_WATER_Y = -0.05;

/**
 * Connects the shared `CharacterRuntime` (look, run, jump, arms) to the Mekong world's height
 * field, wooden decks and solid colliders. Same rules as the original explorer: stairs, piers
 * and bridges can be climbed, the river and canals cannot be entered on foot.
 */
export class MekongWorldAdapter implements GameWorldAdapter {
  public readonly eyeHeight: number = 1.7;
  public readonly gravity: number = -24.0;
  public readonly jumpForce: number = 7.0;

  /** Current foot height, so a deck is only used when the feet are at or near its level. */
  private footY = 2;

  public setFootY(footY: number): void {
    this.footY = footY;
  }

  public getGroundHeight(x: number, z: number): number {
    return Math.max(sampleWalkableHeight(x, z, this.footY).y, 0);
  }

  public resolveMovement(
    currX: number,
    currZ: number,
    targetX: number,
    targetZ: number,
    footY: number,
    radius: number,
  ): MovementResolution {
    this.footY = footY;
    const attempt = (x: number, z: number): { x: number; z: number } | null => {
      const surface = sampleWalkableHeight(x, z, footY);
      if (surface.y < DEEP_WATER_Y && !surface.onStructure) return null;
      return resolveHorizontalCollision(x, z, radius, footY);
    };

    let resolved = attempt(targetX, targetZ);
    if (!resolved) {
      // Blocked by water: slide along the bank on whichever axis is still dry.
      resolved = attempt(targetX, currZ) ?? attempt(currX, targetZ) ?? { x: currX, z: currZ };
    }

    const moveX = targetX - currX;
    const moveZ = targetZ - currZ;
    const offX = resolved.x - targetX;
    const offZ = resolved.z - targetZ;
    const collided = Math.hypot(offX, offZ) > 1e-4;
    if (!collided) {
      return { newX: resolved.x, newZ: resolved.z, collided: false, hitNormalX: 0, hitNormalZ: 0 };
    }
    // The surface normal points back against the blocked part of the movement.
    let nx = offX;
    let nz = offZ;
    let length = Math.hypot(nx, nz);
    if (length < 1e-6) {
      nx = -moveX;
      nz = -moveZ;
      length = Math.hypot(nx, nz) || 1;
    }
    return { newX: resolved.x, newZ: resolved.z, collided: true, hitNormalX: nx / length, hitNormalZ: nz / length };
  }

  public raycastPunch(origin: Vector3, direction: Vector3, maxDistance: number): boolean {
    return (
      raycastSolidColliders(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, maxDistance) !== null
    );
  }
}

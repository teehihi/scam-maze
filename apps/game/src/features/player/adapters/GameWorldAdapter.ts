import * as THREE from 'three';

export interface MovementResolution {
  newX: number;
  newZ: number;
  collided: boolean;
  hitNormalX: number;
  hitNormalZ: number;
}

export interface GameWorldAdapter {
  /**
   * Return ground height (walkable surface elevation) at world coordinates (x, z).
   * Returns null if unconstrained or outside world.
   */
  getGroundHeight(x: number, z: number): number | null;

  /**
   * Resolve spatial collision for horizontal movement from (currX, currZ) to (targetX, targetZ).
   * If not implemented, displacement is applied unconstrained.
   */
  resolveMovement?(
    currX: number,
    currZ: number,
    targetX: number,
    targetZ: number,
    footY: number,
    radius: number,
    height: number,
  ): MovementResolution;

  /**
   * Clamp or constrain position to map boundaries (e.g. radius or box bounds).
   */
  clampPosition?(position: THREE.Vector3): void;

  /**
   * Return candidate 3D objects for melee or interaction raycasting (optional).
   */
  getInteractionTargets?(): THREE.Object3D[];

  /**
   * Map-specific adult eye height offset in meters (defaults to 1.85m).
   */
  eyeHeight?: number;

  /**
   * Map-specific gravity constant in m/s² (defaults to -24.0).
   */
  gravity?: number;

  /**
   * Map-specific jump force in m/s (defaults to 7.2).
   */
  jumpForce?: number;
}

export interface SimpleBoundsOptions {
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
  maxRadius?: number;
  groundY: number;
  eyeHeight?: number;
  gravity?: number;
  jumpForce?: number;
}

/**
 * Universal adapter for flat or simply-bounded environments (e.g. UEH, TestMove, Street scenes).
 */
export class SimpleBoundsAdapter implements GameWorldAdapter {
  private options: SimpleBoundsOptions;
  public readonly eyeHeight: number;
  public readonly gravity: number;
  public readonly jumpForce: number;

  constructor(options: SimpleBoundsOptions) {
    this.options = options;
    this.eyeHeight = options.eyeHeight ?? 0;
    this.gravity = options.gravity ?? -22.0;
    this.jumpForce = options.jumpForce ?? 7.0;
  }

  public getGroundHeight(_x: number, _z: number): number {
    return this.options.groundY;
  }

  public clampPosition(pos: THREE.Vector3): void {
    const { minX, maxX, minZ, maxZ, maxRadius } = this.options;

    if (minX !== undefined && pos.x < minX) pos.x = minX;
    if (maxX !== undefined && pos.x > maxX) pos.x = maxX;
    if (minZ !== undefined && pos.z < minZ) pos.z = minZ;
    if (maxZ !== undefined && pos.z > maxZ) pos.z = maxZ;

    if (maxRadius !== undefined) {
      const dist = Math.hypot(pos.x, pos.z);
      if (dist > maxRadius) {
        const angle = Math.atan2(pos.z, pos.x);
        pos.x = Math.cos(angle) * maxRadius;
        pos.z = Math.sin(angle) * maxRadius;
      }
    }
  }
}

import type { GameWorldAdapter, MovementResolution } from '../../player';
import { getWalkableHeight } from '../world/hueWorldConfig';
import type { HueCollisionSystem } from './collision/HueCollisionSystem';

export class HueWorldAdapter implements GameWorldAdapter {
  public readonly eyeHeight: number = 1.85;
  public readonly gravity: number = -24.0;
  public readonly jumpForce: number = 7.2;
  private collision: HueCollisionSystem;

  constructor(collision: HueCollisionSystem) {
    this.collision = collision;
  }

  public getGroundHeight(x: number, z: number): number {
    return getWalkableHeight(x, z);
  }

  public resolveMovement(
    currX: number,
    currZ: number,
    targetX: number,
    targetZ: number,
    footY: number,
    radius: number,
    height: number,
  ): MovementResolution {
    return this.collision.resolveMovement(
      currX,
      currZ,
      targetX,
      targetZ,
      footY,
      radius,
      height,
    );
  }

  public raycastPunch(
    origin: import('three').Vector3,
    direction: import('three').Vector3,
    maxDistance: number,
  ): boolean {
    const hit = this.collision.raycast(origin, direction, maxDistance);
    return hit.hit;
  }
}

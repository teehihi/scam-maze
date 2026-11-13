import { beforeEach, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import {
  clearWorldCollisionRegistry,
  registerSolidCollider,
  registerWalkableBox,
  sampleTerrainHeight,
} from '../world/terrain/MekongHeightfield';
import { MekongWorldAdapter } from './MekongWorldAdapter';

/** Finds a point in the main river (deep water) and a dry point beside it on the same row. */
function findBank(): { water: [number, number]; land: [number, number] } {
  const z = -118;
  let water: [number, number] | null = null;
  for (let x = -60; x <= 60; x += 0.5) {
    if (sampleTerrainHeight(x, z) < -0.6) {
      water = [x, z];
      break;
    }
  }
  if (!water) throw new Error('no river found on the test row');
  for (let x = water[0] - 0.5; x > water[0] - 60; x -= 0.5) {
    if (sampleTerrainHeight(x, z) > 0.2) return { water, land: [x, z] };
  }
  throw new Error('no bank found on the test row');
}

describe('MekongWorldAdapter', () => {
  beforeEach(() => clearWorldCollisionRegistry());

  it('stops the player at the river bank', () => {
    const adapter = new MekongWorldAdapter();
    const { water, land } = findBank();
    const result = adapter.resolveMovement(land[0], land[1], water[0], water[1], 2, 0.35);
    expect(result.collided).toBe(true);
    // Never ends up in deep water.
    expect(sampleTerrainHeight(result.newX, result.newZ)).toBeGreaterThan(-0.06);
  });

  it('lets the player walk onto a pier built over the water', () => {
    const adapter = new MekongWorldAdapter();
    const { water, land } = findBank();
    registerWalkableBox('test-pier', water[0] - 1, water[0] + 1, water[1] - 1, water[1] + 1, 1.2);
    const result = adapter.resolveMovement(land[0], land[1], water[0], water[1], 1.2, 0.35);
    expect(result.newX).toBeCloseTo(water[0]);
    expect(result.collided).toBe(false);
    expect(adapter.getGroundHeight(water[0], water[1])).toBeCloseTo(1.2);
  });

  it('pushes the player out of solid colliders and reports the surface normal', () => {
    const adapter = new MekongWorldAdapter();
    const { land } = findBank();
    registerSolidCollider(land[0] - 6, land[0] - 4, land[1] - 3, land[1] + 3);
    const result = adapter.resolveMovement(land[0], land[1], land[0] - 4.2, land[1], 2, 0.35);
    expect(result.collided).toBe(true);
    expect(result.newX).toBeGreaterThanOrEqual(land[0] - 4 + 0.35 - 1e-6);
    expect(result.hitNormalX).toBeGreaterThan(0.5);
  });

  it('detects solid colliders with a punch ray', () => {
    const adapter = new MekongWorldAdapter();
    registerSolidCollider(10, 12, -1, 1);
    expect(adapter.raycastPunch(new Vector3(8, 1.5, 0), new Vector3(1, 0, 0), 2.5)).toBe(true);
    expect(adapter.raycastPunch(new Vector3(8, 1.5, 0), new Vector3(1, 0, 0), 1.5)).toBe(false);
    expect(adapter.raycastPunch(new Vector3(8, 1.5, 5), new Vector3(1, 0, 0), 5)).toBe(false);
  });
});

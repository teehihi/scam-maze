import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HueCollisionSystem } from './HueCollisionSystem';
import { populateHueWorldColliders } from './HueWorldColliders';

describe('HueCollisionSystem', () => {
  it('correctly hashes spatial cells and retrieves nearby colliders', () => {
    const colSystem = new HueCollisionSystem();
    colSystem.addCylinder('col_1', 10, 10, 1.0, 0, 5);
    colSystem.addCylinder('col_2', 100, 100, 1.0, 0, 5);

    const nearFirst = colSystem.getCollidersNear(10, 10, 5);
    expect(nearFirst.length).toBe(1);
    expect(nearFirst[0].id).toBe('col_1');

    const nearSecond = colSystem.getCollidersNear(100, 100, 5);
    expect(nearSecond.length).toBe(1);
    expect(nearSecond[0].id).toBe('col_2');

    const nearNone = colSystem.getCollidersNear(50, 50, 5);
    expect(nearNone.length).toBe(0);
  });

  it('detects and resolves cylinder vs cylinder penetration', () => {
    const colSystem = new HueCollisionSystem();
    // Pillar at (0, 0) with radius 1.0m, height 0 to 4m
    colSystem.addCylinder('pillar', 0, 0, 1.0, 0, 4);

    const playerRadius = 0.35;
    const playerFootY = 0;

    // Target position is at (1.1, 0) -> distance is 1.1, but minDist is 1.0 + 0.35 = 1.35
    const result = colSystem.resolveMovement(
      2.0, 0,
      1.1, 0,
      playerFootY,
      playerRadius,
    );

    expect(result.collided).toBe(true);
    expect(result.newX).toBeCloseTo(1.35, 2);
    expect(result.newZ).toBeCloseTo(0, 2);
    expect(result.hitNormalX).toBeCloseTo(1.0, 2);
  });

  it('detects and resolves cylinder vs AABB box penetration with wall sliding', () => {
    const colSystem = new HueCollisionSystem();
    // Wall from X = 5 to 6, Z from -10 to +10, height 0 to 4m
    colSystem.addBox('wall', 5, 6, -10, 10, 0, 4);

    const playerRadius = 0.35;
    const playerFootY = 0;

    // Player attempts to move diagonally from (4.5, 0) to (5.2, 5.0)
    const result = colSystem.resolveMovement(
      4.5, 0,
      5.2, 5.0,
      playerFootY,
      playerRadius,
    );

    expect(result.collided).toBe(true);
    // Player should be pushed back along X to 5.0 - 0.35 = 4.65
    expect(result.newX).toBeCloseTo(4.65, 2);
    // Z movement along the wall is preserved (wall sliding!)
    expect(result.newZ).toBeCloseTo(5.0, 2);
    expect(result.hitNormalX).toBeCloseTo(-1.0, 2);
  });

  it('allows stepping over low obstacles <= 0.45m', () => {
    const colSystem = new HueCollisionSystem();
    // Low curb/step with maxY = 0.35m
    colSystem.addBox('low_step', 2, 4, 2, 4, 0, 0.35);
    // High barrier with maxY = 1.2m
    colSystem.addBox('high_barrier', 10, 12, 10, 12, 0, 1.2);

    const playerFootY = 0;
    const playerRadius = 0.35;

    // Moving through the low step: should not be blocked horizontally!
    const stepResult = colSystem.resolveMovement(1.5, 3.0, 2.5, 3.0, playerFootY, playerRadius);
    expect(stepResult.collided).toBe(false);
    expect(stepResult.newX).toBe(2.5);

    // Moving through the high barrier: should be blocked horizontally!
    const barrierResult = colSystem.resolveMovement(9.5, 11.0, 10.2, 11.0, playerFootY, playerRadius);
    expect(barrierResult.collided).toBe(true);
    expect(barrierResult.newX).toBeCloseTo(10.0 - 0.35, 2);
  });

  it('performs accurate melee raycast against colliders', () => {
    const colSystem = new HueCollisionSystem();
    colSystem.addCylinder('target_dummy', 0, 2.0, 0.4, 0, 2.0);

    const rayOrigin = new THREE.Vector3(0, 1.0, 0);
    const forwardDir = new THREE.Vector3(0, 0, 1);

    const hit = colSystem.raycast(rayOrigin, forwardDir, 2.5);
    expect(hit.hit).toBe(true);
    // Distance should be 2.0 - 0.4 = 1.6m
    expect(hit.distance).toBeCloseTo(1.6, 2);
    expect(hit.collider?.id).toBe('target_dummy');

    // Raycast in opposite direction should miss
    const backwardDir = new THREE.Vector3(0, 0, -1);
    const miss = colSystem.raycast(rayOrigin, backwardDir, 2.5);
    expect(miss.hit).toBe(false);
  });

  it('verifies solid architecture and open doorways in world colliders', () => {
    const colSystem = new HueCollisionSystem();
    populateHueWorldColliders(colSystem);

    expect(colSystem.getColliderCount()).toBeGreaterThan(50);

    const playerRadius = 0.35;

    // 1. Tháp Phước Duyên solid pagoda core (-210, 9.5, -104) blocks player
    const pagodaHit = colSystem.resolveMovement(
      -210, -98,
      -210, -102,
      9.5,
      playerRadius,
    );
    expect(pagodaHit.collided).toBe(true);
    // Cylinder radius is 4.8m centered at -104, so edge is at -99.2m - 0.35m = -98.85m
    expect(pagodaHit.newZ).toBeGreaterThan(-100.0);

    // 2. Chùa Thiên Mụ Inner Tam Quan doorway at (-210, 9.5, -129) is traversable
    const gatePass = colSystem.resolveMovement(
      -210, -127,
      -210, -131,
      9.5,
      playerRadius,
    );
    expect(gatePass.collided).toBe(false);
    expect(gatePass.newZ).toBe(-131);

    // 3. Cung Thiên Định entrance at (40, 22.1, 344.5) is traversable
    const palaceEntry = colSystem.resolveMovement(
      40, 342,
      40, 346,
      22.1,
      playerRadius,
    );
    expect(palaceEntry.collided).toBe(false);
    expect(palaceEntry.newZ).toBe(346);

    // 4. Cầu Trường Tiền side railing (CX = 195, rail at 190.65) blocks falling off
    const bridgeSide = colSystem.resolveMovement(
      193, 0,
      190.5, 0,
      6.85,
      playerRadius,
    );
    expect(bridgeSide.collided).toBe(true);
    expect(bridgeSide.newX).toBeGreaterThanOrEqual(190.8);
  });
});

import { describe, expect, it } from 'vitest';
import { MAX_DRIVABLE_SLOPE, SLOPE_LOOKAHEAD, canDriveTo, carGroundPose, isHueWater } from './hueDriving';
import { HUE_CAR_PARKING } from './HueVehicle';
import { getRiverCenterZ, getWalkableHeight } from '../../world/hueWorldConfig';

describe('Huế driving rules', () => {
  it('treats the middle of the Perfume River as water and the riverside lane as land', () => {
    expect(isHueWater(-100, getRiverCenterZ(-100))).toBe(true);
    expect(isHueWater(-100, -65 - 5 * Math.sin(0.014 * -100))).toBe(false);
  });

  it('keeps Trường Tiền bridge deck drivable over the river', () => {
    expect(isHueWater(195, getRiverCenterZ(195))).toBe(false);
  });

  it('blocks driving into the river', () => {
    const x = -100;
    const bank = -65 - 5 * Math.sin(0.014 * x);
    expect(canDriveTo(x, bank, x, getRiverCenterZ(x))).toBe(false);
  });

  it('parks the car on dry, gentle ground', () => {
    const { x, z, yaw } = HUE_CAR_PARKING;
    expect(isHueWater(x, z)).toBe(false);
    const pose = carGroundPose(x, z, yaw);
    expect(Math.abs(pose.pitch)).toBeLessThan(0.12);
    expect(Math.abs(pose.roll)).toBeLessThan(0.12);
    expect(pose.y).toBeCloseTo(getWalkableHeight(x, z), 0);
    // a few metres along the lane are drivable too
    const ahead = { x: x + Math.sin(yaw) * 4, z: z + Math.cos(yaw) * 4 };
    expect(canDriveTo(x, z, ahead.x, ahead.z)).toBe(true);
  });

  it('cannot creep up a steep bank at crawl speed, but can always roll back down', () => {
    // find a spot whose slope over the lookahead is well above the limit
    let found = false;
    for (let x = -300; x < 300 && !found; x += 3) {
      for (let z = -300; z < 300 && !found; z += 3) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (isHueWater(x, z) || isHueWater(x + dx, z + dz)) continue;
          const rise = getWalkableHeight(x + dx * SLOPE_LOOKAHEAD, z + dz * SLOPE_LOOKAHEAD) - getWalkableHeight(x, z);
          if (rise / SLOPE_LOOKAHEAD < MAX_DRIVABLE_SLOPE * 1.5 || rise < 0.3) continue;
          // a 5 mm step (very slow speed) uphill is refused, like a fast one
          expect(canDriveTo(x, z, x + dx * 0.005, z + dz * 0.005)).toBe(false);
          expect(canDriveTo(x, z, x + dx * 0.3, z + dz * 0.3)).toBe(false);
          // reversing downhill from the top of it is allowed
          const tx = x + dx * SLOPE_LOOKAHEAD;
          const tz = z + dz * SLOPE_LOOKAHEAD;
          expect(canDriveTo(tx, tz, tx - dx * 0.3, tz - dz * 0.3)).toBe(true);
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('tilts the nose up on an upward slope', () => {
    // find a sloped spot along the lane by scanning; compare front/back heights with the pitch sign
    for (let x = -240; x < 220; x += 7) {
      const z = -65 - 5 * Math.sin(0.014 * x);
      const yaw = Math.PI / 2; // facing +X
      const front = getWalkableHeight(x + 1.35, z);
      const back = getWalkableHeight(x - 1.35, z);
      if (Math.abs(front - back) < 0.05) continue;
      const pose = carGroundPose(x, z, yaw);
      expect(Math.sign(pose.pitch)).toBe(front > back ? -1 : 1);
      return;
    }
  });
});

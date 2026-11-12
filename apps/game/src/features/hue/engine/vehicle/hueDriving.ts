/**
 * Pure driving rules for the Huế heightfield (no three.js, no DOM): where the car may go and how it
 * sits on the terrain. Kept separate from HueVehicle so it can be unit tested.
 */
import {
  WATER_LEVEL_RIVER,
  WATER_LEVEL_TU_DUC,
  getCanalCenterX,
  getCanalHalfWidth,
  getRiverCenterZ,
  getRiverHalfWidth,
  getTuDucLakeFactor,
  getWalkableHeight,
} from '../../world/hueWorldConfig';

/** Mercedes-Benz A45 footprint (metres): half wheelbase and half track, used to sample the ground. */
export const CAR_HALF_WHEELBASE = 1.35;
export const CAR_HALF_TRACK = 0.78;
/** Steepest slope the car can climb (rise over run); stairs and terrace walls are steeper. */
export const MAX_DRIVABLE_SLOPE = 0.55;

/**
 * True over open water: the river and the canal (bridge decks are higher and stay drivable) and
 * the Tự Đức lake basin.
 */
export function isHueWater(x: number, z: number): boolean {
  const h = getWalkableHeight(x, z);
  const inRiver = Math.abs(z - getRiverCenterZ(x)) < getRiverHalfWidth(x);
  const inCanal = z > getRiverCenterZ(x) + 12 && Math.abs(x - getCanalCenterX(z)) < getCanalHalfWidth();
  if ((inRiver || inCanal) && h < WATER_LEVEL_RIVER + 0.6) return true;
  return getTuDucLakeFactor(x, z) > 0.4 && h < WATER_LEVEL_TU_DUC + 0.4;
}

export interface CarGroundPose {
  y: number;
  /** Euler X (YXZ order): positive lowers the nose. */
  pitch: number;
  /** Euler Z (YXZ order): positive raises the car's left (+X) side. */
  roll: number;
}

/**
 * Height and tilt of a car centred at (x, z) facing `yaw` (0 faces +Z), from the ground under its
 * four wheels.
 */
export function carGroundPose(x: number, z: number, yaw: number): CarGroundPose {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const lx = Math.cos(yaw);
  const lz = -Math.sin(yaw);
  const L = CAR_HALF_WHEELBASE;
  const T = CAR_HALF_TRACK;
  const h = (ox: number, oz: number) => getWalkableHeight(x + ox, z + oz);
  const fl = h(fx * L + lx * T, fz * L + lz * T);
  const fr = h(fx * L - lx * T, fz * L - lz * T);
  const bl = h(-fx * L + lx * T, -fz * L + lz * T);
  const br = h(-fx * L - lx * T, -fz * L - lz * T);
  const front = (fl + fr) / 2;
  const back = (bl + br) / 2;
  const left = (fl + bl) / 2;
  const right = (fr + br) / 2;
  return {
    y: (fl + fr + bl + br) / 4,
    pitch: -Math.atan2(front - back, 2 * L),
    roll: Math.atan2(left - right, 2 * T),
  };
}

/** Distance over which the slope ahead is measured, independent of speed and frame rate. */
export const SLOPE_LOOKAHEAD = 1.0;
/** Single kerb / bridge-joint height the car can roll over. */
export const MAX_STEP = 0.08;

/**
 * Whether the car may move from (x0, z0) to (x1, z1): dry land and not too steep.
 * The slope is measured over SLOPE_LOOKAHEAD metres in the direction of travel, so creeping
 * forward a few millimetres per frame cannot climb a wall. Downhill is always allowed, so a car
 * that ended up on a steep bank can always roll back off it.
 */
export function canDriveTo(x0: number, z0: number, x1: number, z1: number): boolean {
  if (isHueWater(x1, z1)) return false;
  const run = Math.hypot(x1 - x0, z1 - z0);
  if (run < 1e-6) return true;
  const dx = (x1 - x0) / run;
  const dz = (z1 - z0) / run;
  const h0 = getWalkableHeight(x0, z0);
  const hAhead = getWalkableHeight(x0 + dx * SLOPE_LOOKAHEAD, z0 + dz * SLOPE_LOOKAHEAD);
  const rise = hAhead - h0;
  if (rise <= 0) return true;
  return rise <= MAX_STEP || rise / SLOPE_LOOKAHEAD <= MAX_DRIVABLE_SLOPE;
}

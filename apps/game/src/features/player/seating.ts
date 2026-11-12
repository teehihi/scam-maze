/**
 * Sit-down interaction: pure helpers shared by any map that defines seats.
 * Yaw follows the camera convention: yaw 0 looks along -Z, positive yaw turns left.
 */

export interface Seat {
  id: string;
  /** Centre of the seat surface in world space. */
  position: [number, number, number];
  /** Camera yaw when looking straight ahead from the seat. */
  facingYaw: number;
  /**
   * Where the player stands after getting up: "front" for benches with a backrest,
   * "back" for seats facing a table (stepping forward would land inside the table).
   */
  standUp?: "front" | "back";
}

/** Eye height above the seat surface for a seated adult. */
export const SEATED_EYE_HEIGHT = 0.76;
/** Head sits slightly behind the seat centre (towards the backrest). */
const SEATED_HEAD_BACK = 0.06;
/** How far from the seat centre the player stands after getting up. */
const STAND_DISTANCE = 0.75;
/** How far the player may look around while seated. */
export const SEATED_YAW_LIMIT = 1.75;
export const SEATED_PITCH_MIN = -0.9;
export const SEATED_PITCH_MAX = 0.7;

/** Horizontal look direction for a yaw. */
function forwardOf(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)];
}

/** Nearest seat within `reach` metres (horizontal distance), or null. */
export function findNearestSeat(
  seats: readonly Seat[],
  x: number,
  z: number,
  reach: number,
): Seat | null {
  let best: Seat | null = null;
  let bestDist = reach;
  for (const seat of seats) {
    const d = Math.hypot(seat.position[0] - x, seat.position[2] - z);
    if (d <= bestDist) {
      best = seat;
      bestDist = d;
    }
  }
  return best;
}

/** Camera position for a seated player. */
export function seatedEyePosition(seat: Seat): [number, number, number] {
  const [fx, fz] = forwardOf(seat.facingYaw);
  return [
    seat.position[0] - fx * SEATED_HEAD_BACK,
    seat.position[1] + SEATED_EYE_HEIGHT,
    seat.position[2] - fz * SEATED_HEAD_BACK,
  ];
}

/** Ground point where the player stands up: in front of the seat, or behind it for table seats. */
export function standUpPoint(seat: Seat): [number, number] {
  const [fx, fz] = forwardOf(seat.facingYaw);
  const d = seat.standUp === "back" ? -STAND_DISTANCE : STAND_DISTANCE;
  return [seat.position[0] + fx * d, seat.position[2] + fz * d];
}

export function clampSeatedLook(yawOffset: number, pitch: number): [number, number] {
  return [
    Math.max(-SEATED_YAW_LIMIT, Math.min(SEATED_YAW_LIMIT, yawOffset)),
    Math.max(SEATED_PITCH_MIN, Math.min(SEATED_PITCH_MAX, pitch)),
  ];
}

/** Camera yaw that looks along a world-space horizontal direction. */
export function yawFacing(dirX: number, dirZ: number): number {
  return Math.atan2(-dirX, -dirZ);
}

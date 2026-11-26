// The two benches under each bus shelter (Trạm Lý Thái Tổ and Trạm Chợ Lớn) as places the player can sit. Pure data and
// helpers: the shelter geometry in street.ts is built from the same constants, so the seats stay on the benches.
import { ROUTE } from "./transit";

/** Bench centre lines along the stop (z, relative to the stop) and the bench's x (the middle of its three boards). */
export const BENCH_LOCAL_Z = [0.27, 2.0] as const;
export const BENCH_X = 3.45;
/** Board centres sit at x = 3.27 .. 3.59; the seat surface is the top of the boards. */
export const BENCH_SEAT_X = 3.43;
export const BENCH_SEAT_TOP = 0.666;
/** Where on each bench a person sits (z offset from the bench centre): one place near each end. */
export const BENCH_PLACES = [-0.45, 0.45] as const;
/** How near to a seat (m, on the ground plane) the player has to be to sit down. */
export const BENCH_REACH = 1.7;
/** Eye height above the seat surface of a seated person (m). */
export const SEATED_EYE_ABOVE_SEAT = 0.78;
/** The player's yaw when sitting: looking across the shelter's open side onto the road (towards -X). */
export const BENCH_SEATED_YAW = Math.PI / 2;
/** How far in front of the bench (toward the road) the player stands up to. */
export const BENCH_STAND_OFFSET = 1.0;

export interface BenchSeat {
  id: string;
  x: number;
  z: number;
  /** Seat surface height (m). */
  top: number;
  stopZ: number;
}

/** Every bench seat of the route's stops, in world coordinates. */
export function buildBenchSeats(stopZs: readonly number[] = [ROUTE.originZ, ROUTE.destinationZ]): BenchSeat[] {
  const seats: BenchSeat[] = [];
  for (const stopZ of stopZs) {
    BENCH_LOCAL_Z.forEach((bench, b) => {
      BENCH_PLACES.forEach((place, p) => {
        seats.push({ id: `bench-${stopZ}-${b}-${p}`, x: BENCH_SEAT_X, z: stopZ + bench + place, top: BENCH_SEAT_TOP, stopZ });
      });
    });
  }
  return seats;
}

/** The nearest seat within reach of a standing person, or null (a seat is out of reach when the player is not at ground level). */
export function nearestBenchSeat(
  x: number,
  z: number,
  feetY: number,
  seats: readonly BenchSeat[],
  reach = BENCH_REACH,
): BenchSeat | null {
  if (feetY > 1.2) return null;
  let best: BenchSeat | null = null;
  let bestD = reach;
  for (const seat of seats) {
    const d = Math.hypot(seat.x - x, seat.z - z);
    if (d < bestD) {
      bestD = d;
      best = seat;
    }
  }
  return best;
}

/** Feet height that puts the eyes of a seated player at the right height (the camera is feet + eye height). */
export function seatedFeetY(seat: BenchSeat, eyeHeight: number): number {
  return seat.top + SEATED_EYE_ABOVE_SEAT - eyeHeight;
}

/** Where the player stands when getting up: in front of the bench, on the pavement side of the road. */
export function benchStandPosition(seat: BenchSeat): { x: number; z: number } {
  return { x: seat.x - BENCH_STAND_OFFSET, z: seat.z };
}

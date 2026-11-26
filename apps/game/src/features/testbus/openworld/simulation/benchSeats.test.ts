// Benches under the Bus 06 shelters can be sat on: the seats sit on the bench geometry, are reachable from the
// pavement, and standing up puts the player back on the pavement clear of the shelter.
import { describe, expect, it } from "vitest";
import { benchStandPosition, buildBenchSeats, nearestBenchSeat, seatedFeetY, BENCH_LOCAL_Z, BENCH_X, SEATED_EYE_ABOVE_SEAT } from "./benchSeats";
import { rect } from "./boarding";
import { ROUTE } from "./transit";

describe("bus shelter benches", () => {
  const seats = buildBenchSeats();

  it("has two places on each of the two benches at both stops", () => {
    expect(seats).toHaveLength(8);
    for (const stopZ of [ROUTE.originZ, ROUTE.destinationZ]) {
      expect(seats.filter((s) => s.stopZ === stopZ)).toHaveLength(4);
    }
  });

  it("puts every seat on a bench board (inside the bench collider, at board height)", () => {
    for (const seat of seats) {
      expect(Math.abs(seat.x - BENCH_X)).toBeLessThan(0.27);
      const local = seat.z - seat.stopZ;
      expect(BENCH_LOCAL_Z.some((z) => Math.abs(local - z) < 0.74)).toBe(true);
      expect(seat.top).toBeGreaterThan(0.6);
      expect(seat.top).toBeLessThan(0.75);
    }
  });

  it("is reachable from the pavement in front of the bench, not from far away or from upstairs", () => {
    const seat = seats[0];
    expect(nearestBenchSeat(seat.x - 1.1, seat.z, 0.16, seats)).toBe(seat);
    expect(nearestBenchSeat(seat.x - 4, seat.z, 0.16, seats)).toBeNull();
    expect(nearestBenchSeat(seat.x - 1.1, seat.z, 3.2, seats)).toBeNull();
  });

  it("seats the eye just above the bench and stands the player up under the shelter, clear of the benches", () => {
    const eyeHeight = 1.62;
    // The same bench colliders street.ts builds for each shelter
    const solids = [ROUTE.originZ, ROUTE.destinationZ].flatMap((stopZ) => BENCH_LOCAL_Z.map((z) => rect(BENCH_X, z + stopZ, 0.54, 1.48)));
    for (const seat of seats) {
      expect(seatedFeetY(seat, eyeHeight) + eyeHeight).toBeCloseTo(seat.top + SEATED_EYE_ABOVE_SEAT, 6);
      const out = benchStandPosition(seat);
      // On the pavement between the shelter's front posts (x = 1.91) and its back wall (x = 4.0)
      expect(out.x).toBeGreaterThan(1.91 + 0.3);
      expect(out.x).toBeLessThan(4.0 - 0.3);
      const r = 0.3;
      const blocked = solids.some((s) => out.x + r > s.x0 && out.x - r < s.x1 && out.z + r > s.z0 && out.z - r < s.z1);
      expect(blocked, `stand-up spot of ${seat.id}`).toBe(false);
    }
  });
});

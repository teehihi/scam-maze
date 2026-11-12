import { describe, expect, it } from "vitest";
import {
  clampSeatedLook,
  findNearestSeat,
  seatedEyePosition,
  standUpPoint,
  yawFacing,
  SEATED_YAW_LIMIT,
  type Seat,
} from "./seating";
import { UEH_FURNITURE_COLLIDERS, UEH_SEATS } from "../ueh/seats";
import { resolveBoxCollision } from "../vehicle/vehiclePhysics";

const seat = (id: string, x: number, z: number, facingYaw = 0): Seat => ({ id, position: [x, 0.45, z], facingYaw });

describe("seating", () => {
  it("finds the nearest seat within reach only", () => {
    const seats = [seat("a", 0, 0), seat("b", 3, 0)];
    expect(findNearestSeat(seats, 2.4, 0, 1.4)?.id).toBe("b");
    expect(findNearestSeat(seats, 0.5, 0, 1.4)?.id).toBe("a");
    expect(findNearestSeat(seats, 1.5, 5, 1.4)).toBeNull();
  });

  it("puts the eye above the seat and the stand-up point in front of it", () => {
    // facingYaw 0 looks along -Z
    const s = seat("a", 2, 3, 0);
    const [ex, ey, ez] = seatedEyePosition(s);
    expect(ex).toBeCloseTo(2);
    expect(ey).toBeGreaterThan(1.1);
    expect(ez).toBeGreaterThan(3); // head slightly behind, towards +Z
    const [sx, sz] = standUpPoint(s);
    expect(sx).toBeCloseTo(2);
    expect(sz).toBeLessThan(3); // in front, towards -Z
  });

  it("stands up behind table seats", () => {
    const s: Seat = { ...seat("t", 2, 3, 0), standUp: "back" };
    const [sx, sz] = standUpPoint(s);
    expect(sx).toBeCloseTo(2);
    expect(sz).toBeGreaterThan(3); // behind the seat, away from the table at -Z
  });

  it("converts directions to camera yaw", () => {
    expect(yawFacing(0, -1)).toBeCloseTo(0);
    expect(Math.abs(yawFacing(0, 1))).toBeCloseTo(Math.PI);
    expect(yawFacing(-1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it("clamps the seated look", () => {
    const [y, p] = clampSeatedLook(10, -10);
    expect(y).toBe(SEATED_YAW_LIMIT);
    expect(p).toBeLessThan(0);
    expect(p).toBeGreaterThan(-10);
  });

  it("UEH seats are on the courtyard, distinct, and not on the guitar bench", () => {
    expect(UEH_SEATS.length).toBe(14);
    expect(new Set(UEH_SEATS.map((s) => s.id)).size).toBe(UEH_SEATS.length);
    for (const s of UEH_SEATS) {
      expect(Math.hypot(s.position[0], s.position[2])).toBeLessThan(57);
      expect(Number.isFinite(s.facingYaw)).toBe(true);
      // guitar bench at (-1.94, 5.68): its E strums the guitar instead
      expect(Math.hypot(s.position[0] + 1.94, s.position[2] - 5.68)).toBeGreaterThan(2);
    }
    // picnic seats stand up away from their table: clear of the table top (half depth 0.525 m)
    const cornerRot = -0.45;
    for (const s of UEH_SEATS.filter((x) => x.id.startsWith("picnic"))) {
      const [x, z] = standUpPoint(s);
      const dx = x - 22;
      const dz = z - 31;
      // inverse of seats.ts rotateY: localZ = x·sin(r) + z·cos(r)
      const localZ = dx * Math.sin(cornerRot) + dz * Math.cos(cornerRot);
      expect(Math.abs(localZ)).toBeGreaterThan(1.3);
    }
    // stand-up points are outside every furniture collider (player radius 0.35 m), so getting up
    // never leaves the player inside a table or bench
    for (const s of UEH_SEATS) {
      const [x, z] = standUpPoint(s);
      for (const box of UEH_FURNITURE_COLLIDERS) {
        expect(resolveBoxCollision(x, z, 0.35, box).collided, s.id).toBe(false);
      }
    }
    // every seat is inside its own furniture collider and still within sitting reach from outside it
    for (const s of UEH_SEATS) {
      expect(UEH_FURNITURE_COLLIDERS.some((b) => resolveBoxCollision(s.position[0], s.position[2], 0, b).collided)).toBe(true);
      const [x, z] = standUpPoint(s);
      expect(Math.hypot(x - s.position[0], z - s.position[2])).toBeLessThan(1.3);
    }
    // stone bench sitters face away from the central tree
    for (const s of UEH_SEATS.filter((x) => x.id.startsWith("stone"))) {
      const fx = -Math.sin(s.facingYaw);
      const fz = -Math.cos(s.facingYaw);
      expect(fx * s.position[0] + fz * s.position[2]).toBeGreaterThan(0);
    }
  });
});

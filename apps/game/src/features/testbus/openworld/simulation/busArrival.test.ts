// Bus 06 staged arrival (Chapter 1): the bus waits up the road, comes only when called, physically drives in while
// slowing down, opens for boarding, and the stand-alone street keeps its old behaviour.
import { describe, expect, it } from "vitest";
import { BUS_CALL_SECONDS } from "./busCall";
import { BusRouteController, ROUTE } from "./transit";

const NONE = { front: false, rear: false } as const;
/** Steps the controller at 60 fps for `seconds`, returning the z of every frame. */
function drive(route: BusRouteController, seconds: number): number[] {
  const zs: number[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    route.update(1 / 60, NONE, false);
    zs.push(route.z);
  }
  return zs;
}

describe("staged Bus 06", () => {
  it("waits up the road with its doors shut and never comes on its own timer", () => {
    const route = new BusRouteController();
    expect(route.stageAway()).toBe(true);
    expect(route.staged).toBe(true);
    expect(route.z).toBeGreaterThan(30);
    drive(route, 120);
    expect(route.phase).toBe("waiting");
    expect(route.doors.front.amount).toBe(0);
  });

  it("drives into the stop when called, slowing down progressively, then opens for boarding", () => {
    const route = new BusRouteController();
    route.stageAway();
    const from = route.z;
    expect(route.callBus(BUS_CALL_SECONDS["driver-declined"])).toBe(true);
    expect(route.staged).toBe(false);
    const zs = drive(route, BUS_CALL_SECONDS["driver-declined"] + 0.5);
    // It moves every frame toward the stop (no teleport) and never overshoots it.
    for (let i = 1; i < zs.length; i += 1) {
      expect(zs[i]).toBeLessThanOrEqual(zs[i - 1] + 1e-9);
      expect(zs[i - 1] - zs[i]).toBeLessThan(0.6);
    }
    expect(zs[0]).toBeLessThan(from);
    // Faster at the start than at the end: it brakes into the stop.
    const early = zs[0] - zs[60];
    const late = zs[zs.length - 120] - zs[zs.length - 60];
    expect(early).toBeGreaterThan(late * 3);
    expect(route.phase).toBe("boarding");
    expect(route.z).toBeCloseTo(0, 5);
  });

  it("is still on its way during the first seconds of the driver's goodbye", () => {
    const route = new BusRouteController();
    route.stageAway();
    route.callBus(BUS_CALL_SECONDS["driver-declined"]);
    drive(route, 3);
    expect(route.phase).toBe("approaching");
    expect(route.distanceToStop).toBeGreaterThan(3);
  });

  it("cannot be called twice, nor while at the stop", () => {
    const route = new BusRouteController();
    route.stageAway();
    expect(route.callBus(7)).toBe(true);
    expect(route.callBus(7)).toBe(false);
    drive(route, 8);
    expect(route.phase).toBe("boarding");
    expect(route.callBus(7)).toBe(false);
  });

  it("does not leave without the passenger: it waits at the stop until boarding", () => {
    const route = new BusRouteController();
    route.stageAway();
    route.callBus(7);
    drive(route, 200);
    expect(route.phase).toBe("boarding");
    // Only a paid, boarded passenger makes it depart.
    expect(route.depart(false, false)).toBe(false);
    expect(route.pay(true)).toBe(true);
    expect(route.depart(true, false)).toBe(true);
  });

  it("keeps the stand-alone street's behaviour: wait() still brings the bus from the old approach point", () => {
    const route = new BusRouteController();
    expect(route.staged).toBe(false);
    expect(route.z).toBe(ROUTE.approachZ);
    route.wait();
    drive(route, 7);
    expect(route.phase).toBe("boarding");
  });
});

// Bus 06 timetable and boarding: one bus every 15 game minutes at Trạm Lý Thái Tổ, a missed bus means waiting for the
// next one, and sitting down on board closes the doors and sends the bus on its way at once.
import { describe, expect, it } from "vitest";
import { BusRouteController, ROUTE, type TransitEvent } from "./transit";

const NONE = { front: false, rear: false } as const;
const DT = 1 / 20;

function run(route: BusRouteController, seconds: number, hold = false, until?: () => boolean) {
  for (let t = 0; t < seconds; t += DT) {
    route.update(DT, NONE, false, undefined, { hold });
    if (until?.()) return;
  }
}

/** A chapter-style host (story clock and wallet), as Chapter 1 passes it. */
function chapterRoute(events: TransitEvent[]) {
  let cash = 50_000;
  const story = { seconds: 9 * 3600 };
  const route = new BusRouteController({
    chapterSeconds: () => story.seconds,
    wallet: { read: () => cash, debit: (n) => (cash >= n ? ((cash -= n), true) : false) },
    onEvent: (e) => events.push(e),
  });
  return { route, story };
}

describe("Bus 06 timetable at Trạm Lý Thái Tổ", () => {
  it("arrives every 15 game minutes once the first bus has called, also when nobody boards", () => {
    const events: TransitEvent[] = [];
    const { route } = chapterRoute(events);
    route.stageAway();
    expect(route.callBus(8)).toBe(true);
    const arrivals: number[] = [];
    let prev = "";
    for (let t = 0; t < 1300; t += DT) {
      route.update(DT, NONE, false);
      if (route.phase === "boarding" && prev !== "boarding") arrivals.push(route.timetableSeconds);
      prev = route.phase;
    }
    expect(arrivals.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < arrivals.length; i++) {
      expect(arrivals[i] - arrivals[i - 1]).toBeCloseTo(ROUTE.headwayMinutes * 60, -1);
    }
    // Every bus left without a passenger after its dwell and went round the loop
    expect(events.filter((e) => e.type === "left-empty").length).toBeGreaterThanOrEqual(arrivals.length - 1);
  });

  it("a missed bus is gone: the player waits for the next slot, asking for it does not bring it early", () => {
    const events: TransitEvent[] = [];
    const { route } = chapterRoute(events);
    route.stageAway();
    route.callBus(8);
    run(route, 10, false, () => route.phase === "boarding");
    expect(route.phase).toBe("boarding");
    const firstAt = route.timetableSeconds;
    // The player is not at the doors: the bus leaves after its dwell
    run(route, ROUTE.dwellSeconds + 3);
    expect(route.phase === "departing" || route.phase === "driving").toBe(true);
    expect(events.some((e) => e.type === "left-empty")).toBe(true);
    // It drives its lap and waits out of sight; while it is not due, calling it does nothing
    run(route, 400, false, () => route.phase === "waiting");
    expect(route.phase).toBe("waiting");
    expect(route.staged).toBe(true);
    expect(route.nextArrivalIn).toBeGreaterThan(0);
    expect(route.callBus(7)).toBe(false);
    // The next one comes in for its slot, by itself
    run(route, 400, false, () => route.phase === "boarding");
    expect(route.phase).toBe("boarding");
    expect(route.timetableSeconds - firstAt).toBeCloseTo(ROUTE.headwayMinutes * 60, -1);
  });

  it("keeps its doors open while the player is at the doors or aboard", () => {
    const { route } = chapterRoute([]);
    route.stageAway();
    route.callBus(8);
    run(route, 10);
    run(route, ROUTE.dwellSeconds * 4, true);
    expect(route.phase).toBe("boarding");
  });

  it("the stand-alone street skips its clock to the next bus when the player waits for it", () => {
    const route = new BusRouteController();
    route.stageAway();
    route.callBus(8);
    run(route, 10);
    run(route, 400, false, () => route.phase === "waiting");
    const before = route.clock;
    const due = route.nextArrivalIn;
    expect(route.callBus(8)).toBe(true);
    expect(route.clock - before).toBeCloseTo(Math.max(0, due - 8 * ROUTE.timetableRate), 3);
  });
});

describe("boarding Bus 06", () => {
  it("sitting down pays the fare, closes the doors and the bus pulls away at once", () => {
    const events: TransitEvent[] = [];
    const { route } = chapterRoute(events);
    route.stageAway();
    route.callBus(8);
    run(route, 10);
    expect(route.phase).toBe("boarding");
    route.doors.front.target = 1;
    run(route, 1.2, true);
    expect(route.doors.front.passable).toBe(true);
    route.passengerCrossed(true);
    expect(route.seated(true)).toBe(true);
    expect(route.paid).toBe(true);
    expect(route.doors.front.target).toBe(0);
    expect(route.doors.rear.target).toBe(0);
    // Doors shut in about a second, then it drives off: no extra confirmation
    run(route, 1.5, true);
    expect(route.phase).toBe("driving");
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["fare-paid", "departed"]));
    run(route, 2, true);
    expect(route.speed).toBeGreaterThan(1);
  });

  it("carries the passenger to Trạm Chợ Lớn, opens there, and drives on around the loop after they get off", () => {
    const events: TransitEvent[] = [];
    const { route } = chapterRoute(events);
    route.stageAway();
    route.callBus(8);
    run(route, 10);
    route.passengerCrossed(true);
    route.seated(true);
    run(route, 120, true, () => route.phase === "arrived");
    expect(route.phase).toBe("arrived");
    expect(route.z).toBeCloseTo(ROUTE.destinationZ, 6);
    expect(route.x).toBeCloseTo(ROUTE.curbX, 6);
    expect(route.doors.rear.target).toBe(1);
    route.passengerCrossed(false, true);
    expect(route.phase).toBe("complete");
    // No longer parked at Chợ Lớn for ever: off again after a short linger
    run(route, ROUTE.terminusLingerSeconds + 5);
    expect(route.phase).toBe("driving");
    expect(route.rideActive).toBe(false);
    run(route, 400, false, () => route.phase === "waiting");
    expect(route.phase).toBe("waiting");
  });

  it("cannot be ridden without paying (no cash: sitting down does not send the bus off)", () => {
    const route = new BusRouteController({ wallet: { read: () => 0, debit: () => false } });
    route.stageAway();
    route.callBus(8);
    run(route, 10);
    route.passengerCrossed(true);
    expect(route.seated(true)).toBe(false);
    expect(route.phase).toBe("boarding");
  });
});

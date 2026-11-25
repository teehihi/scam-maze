import { describe, expect, it } from "vitest";
import { SaigonTrafficManager } from "../index";
import type { VehicleAgent } from "../types";

const DT = 0.05;
// The player stands above the road (ignored as a hazard) but close enough that every vehicle runs at full detail.
const input = { dt: DT, playerX: 20, playerY: 5, playerZ: -20, playerYaw: 0, wetness: 0 };
const EDGE = "LTT_S_NB";

type Internals = { behaviourRng: { s: number }; pedestrians: { update: () => never[] } };

function newMgr(seed = 1): SaigonTrafficManager {
  const mgr = new SaigonTrafficManager();
  const m = mgr as unknown as Internals;
  m.behaviourRng.s = seed * 7919;
  m.pedestrians.update = () => [];
  // Keep the signals out of the way: the tests run mid-block, far from every stop line.
  return mgr;
}

/** A parked obstacle that never moves (externally controlled vehicles are skipped by the stepper). */
function blocker(mgr: SaigonTrafficManager, id: string, s: number, lat: number, category: "car" | "van" = "car") {
  const b = mgr.spawnVehicle({
    id,
    category,
    edgeId: EDGE,
    s,
    latOffset: lat,
    halfWidth: 0.92,
    halfLength: 2.24,
    speed: 0,
  });
  b.externalControl = true;
  b.speed = 0;
  return b;
}

/** True once `v` has driven past the rear-to-front extent of `o` on the test edge (or left the edge forward). */
function isPast(v: VehicleAgent, o: VehicleAgent): boolean {
  return v.onTurn || v.edgeId !== EDGE || v.s - v.halfLength > o.s + o.halfLength;
}

/** Step until `done` holds or `maxSteps` run out; returns whether `done` held. */
function runUntil(mgr: SaigonTrafficManager, maxSteps: number, done: () => boolean, onTick?: () => void): boolean {
  for (let i = 0; i < maxSteps; i++) {
    mgr.step(input);
    onTick?.();
    if (done()) return true;
  }
  return false;
}

function overlapDepth(a: VehicleAgent, b: VehicleAgent): number {
  // Both travel along the same edge, so s and latOffset are a straight (s, lat) frame.
  const ds = Math.abs(a.s - b.s) - (a.halfLength + b.halfLength);
  const dl = Math.abs(a.latOffset - b.latOffset) - (a.halfWidth + b.halfWidth);
  return Math.max(ds, dl);
}

/** Seconds a follower needs to get past a double-parked car (Infinity if it never does within 30 s). */
function passTime(category: "car" | "moto", seed: number): number {
  const mgr = newMgr(seed);
  // A car stopped at the right edge of the outer lane (double parked), leaving the inner lane free.
  const b = blocker(mgr, "block", 62, 1.2);
  const f = mgr.spawnVehicle({
    id: "f",
    category,
    edgeId: EDGE,
    s: 18,
    laneIndex: 1,
    latOffset: category === "car" ? 0.45 : 0.9,
    halfWidth: category === "car" ? 0.92 : 0.35,
    halfLength: category === "car" ? 2.24 : 0.9,
    speed: 8,
  });
  let steps = 0;
  const passed = runUntil(mgr, 600, () => isPast(f, b), () => steps++);
  return passed ? steps * DT : Infinity;
}

describe("Vietnamese traffic behaviour", () => {
  it("a motorbike fills the gap between two standing cars, never overlapping them", () => {
    const mgr = newMgr();
    const a = blocker(mgr, "A", 60, -1.8);
    const c = blocker(mgr, "B", 60, 1.4);
    const m = mgr.spawnVehicle({
      id: "m",
      category: "moto",
      edgeId: EDGE,
      s: 30,
      latOffset: -0.2,
      halfWidth: 0.35,
      halfLength: 0.9,
      speed: 3,
    });
    let worst = Infinity;
    const passed = runUntil(
      mgr,
      500,
      () => isPast(m, a),
      () => {
        worst = Math.min(worst, overlapDepth(m, a), overlapDepth(m, c));
      },
    );
    expect(passed).toBe(true);
    // Never inside either car: the side or longitudinal separation stayed positive while squeezing through.
    expect(worst).toBeGreaterThan(0);
  });

  it("a motorbike keeps creeping instead of standing still behind a slow queue", () => {
    const mgr = newMgr();
    blocker(mgr, "A", 70, -1.8);
    blocker(mgr, "B", 70, 1.4);
    const m = mgr.spawnVehicle({
      id: "m",
      category: "moto",
      edgeId: EDGE,
      s: 40,
      latOffset: -0.2,
      halfWidth: 0.35,
      halfLength: 0.9,
      speed: 0,
    });
    let stillRun = 0;
    let longestStill = 0;
    const passed = runUntil(
      mgr,
      400,
      () => isPast(m, mgr.vehicles[0]),
      () => {
        stillRun = m.speed < 0.05 ? stillRun + DT : 0;
        longestStill = Math.max(longestStill, stillRun);
      },
    );
    expect(passed).toBe(true);
    expect(longestStill).toBeLessThan(1);
  });

  it("cars swerve around a blocker less readily than motorbikes", () => {
    const trials = 16;
    const car: number[] = [];
    const moto: number[] = [];
    for (let seed = 1; seed <= trials; seed++) {
      car.push(passTime("car", seed));
      moto.push(passTime("moto", seed));
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    // Every rider squeezes past straight away; cars mostly wait behind first and only some swerve out early.
    expect(moto.every((t) => Number.isFinite(t))).toBe(true);
    expect(mean(car)).toBeGreaterThan(mean(moto) + 2);
    const slowestMoto = Math.max(...moto);
    expect(car.filter((t) => t > slowestMoto + 1).length).toBeGreaterThanOrEqual(trials / 2);
  });

  it("a bus pulls in at the stop, dwells with its indicator, signals left and pulls back out", () => {
    const mgr = newMgr();
    const edge = mgr.graph.edges.get(EDGE)!;
    const bus = mgr.spawnVehicle({
      id: "bus1",
      category: "bus",
      edgeId: EDGE,
      s: 10,
      laneIndex: 0,
      latOffset: edge.carLaneOffsets[0],
      halfWidth: 1.32,
      halfLength: 5.55,
      speed: 6,
    });
    const phases: string[] = ["cruise"];
    const blinkerIn: number[] = [];
    const blinkerOut: number[] = [];
    let dwellStopped = true;
    let curbLat = -Infinity;
    const done = runUntil(mgr, 1400, () => phases.length >= 6, () => {
      const st = bus.busStop;
      if (!st) return;
      if (st.phase === "dwell") curbLat = Math.max(curbLat, bus.latOffset);
      if (phases[phases.length - 1] !== st.phase) phases.push(st.phase);
      if (st.phase === "pullIn") blinkerIn.push(bus.blinker);
      if (st.phase === "signalOut" || st.phase === "pullOut") blinkerOut.push(bus.blinker);
      if (st.phase === "dwell" && bus.speed > 0.5) dwellStopped = false;
    });
    expect(done).toBe(true);
    expect(phases).toEqual(["cruise", "pullIn", "dwell", "signalOut", "pullOut", "cruise"]);
    expect(blinkerIn.every((b) => b === 1)).toBe(true);
    expect(blinkerOut.length).toBeGreaterThan(0);
    expect(blinkerOut.every((b) => b === -1)).toBe(true);
    expect(dwellStopped).toBe(true);
    // It stood at the curb, outside the outer car lane, and stopped close to the stop point.
    expect(curbLat).toBeGreaterThan(edge.carLaneOffsets[1] + 0.4);
    expect(bus.busStop!.indicator).toBe(0);
    expect(bus.busStop!.servedEdgeId).toBe(EDGE);
    expect(bus.latOffset).toBeCloseTo(edge.carLaneOffsets[0], 0);
    expect(bus.s).toBeGreaterThan(edge.busStopS! + 3);
  });

  it("cars and motorbikes swerve out and pass a bus standing at the stop", () => {
    const mgr = newMgr();
    const edge = mgr.graph.edges.get(EDGE)!;
    const bus = mgr.spawnVehicle({
      id: "bus1",
      category: "bus",
      edgeId: EDGE,
      s: 24,
      laneIndex: 1,
      latOffset: 1.3, // at the curb, as the stop routine leaves it
      halfWidth: 1.32,
      halfLength: 5.55,
      speed: 0,
    });
    // Keep the bus standing for the whole test.
    bus.busStop = { phase: "dwell", timer: 1e6, servedEdgeId: null, indicator: 0 };
    const car = mgr.spawnVehicle({
      id: "car",
      category: "car",
      edgeId: EDGE,
      s: 2,
      laneIndex: 1,
      latOffset: edge.carLaneOffsets[1],
      halfWidth: 0.92,
      halfLength: 2.24,
      speed: 8,
    });
    const moto = mgr.spawnVehicle({
      id: "moto",
      category: "moto",
      edgeId: EDGE,
      s: 0.5,
      laneIndex: 1,
      latOffset: 1.0,
      halfWidth: 0.35,
      halfLength: 0.9,
      speed: 8,
    });
    let worst = Infinity;
    const passed = runUntil(
      mgr,
      700,
      () => isPast(car, bus) && isPast(moto, bus),
      () => {
        if (!car.onTurn && car.edgeId === EDGE) worst = Math.min(worst, overlapDepth(car, bus));
        if (!moto.onTurn && moto.edgeId === EDGE) worst = Math.min(worst, overlapDepth(moto, bus));
      },
    );
    expect(passed).toBe(true);
    expect(bus.s).toBeCloseTo(24, 3);
    expect(worst).toBeGreaterThan(0);
  });

  it("a bus waits at the curb while a vehicle is alongside in the lane it wants", () => {
    const mgr = newMgr();
    const edge = mgr.graph.edges.get(EDGE)!;
    const bus = mgr.spawnVehicle({
      id: "bus1",
      category: "bus",
      edgeId: EDGE,
      s: 30,
      laneIndex: 1,
      latOffset: edge.carLaneOffsets[1] + 0.85,
      halfWidth: 1.32,
      halfLength: 5.55,
      speed: 0,
    });
    bus.busStop = { phase: "signalOut", timer: 0, servedEdgeId: EDGE, indicator: -1 };
    const other = blocker(mgr, "other", 30, edge.carLaneOffsets[0]);
    for (let i = 0; i < 60; i++) mgr.step(input);
    expect(bus.busStop!.phase).toBe("signalOut");
    expect(bus.blinker).toBe(-1);
    other.s = 90;
    for (let i = 0; i < 400; i++) mgr.step(input);
    expect(bus.busStop!.phase).not.toBe("signalOut");
  });
});

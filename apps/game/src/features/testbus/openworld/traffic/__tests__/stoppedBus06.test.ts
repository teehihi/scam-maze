import { describe, expect, it } from "vitest";
import { SaigonTrafficManager } from "../index";
import type { VehicleAgent } from "../types";

const DT = 0.05;
// The player stands above the road (ignored as a hazard) but close enough that every vehicle runs at full detail.
const input = { dt: DT, playerX: 20, playerY: 5, playerZ: -20, playerYaw: 0, wetness: 0 };
const EDGE = "LTT_S_NB";
// Bus 06 standing at Tram Ly Thai To: BusRouteController keeps it at ROUTE.curbX (x = -2.3), z = 0 while boarding.
const BUS_X = -2.3;
const BUS_Z = 0;

type Internals = { behaviourRng: { s: number }; pedestrians: { update: () => never[] } };
type Category = "car" | "van" | "moto";

// Sizes used by the street spawner (simulation/street.ts).
const SIZE: Record<Category, { halfWidth: number; halfLength: number }> = {
  car: { halfWidth: 0.92, halfLength: 2.24 },
  van: { halfWidth: 0.98, halfLength: 2.7 },
  moto: { halfWidth: 0.35, halfLength: 0.9 },
};

// A taxi and white vans queued nose to tail behind the bus in its lane, and a rider at the back.
const QUEUE: { id: string; category: Category; s: number; lat: number }[] = [
  { id: "van1", category: "van", s: 37, lat: 0.45 },
  { id: "taxi", category: "car", s: 31, lat: 0.45 },
  { id: "van2", category: "van", s: 25, lat: 0.45 },
  { id: "van3", category: "van", s: 19, lat: 0.45 },
  { id: "moto1", category: "moto", s: 14, lat: 0.9 },
];

function setup(seed: number, queue = QUEUE) {
  const mgr = new SaigonTrafficManager();
  const m = mgr as unknown as Internals;
  m.behaviourRng.s = seed * 7919;
  m.pedestrians.update = () => [];
  mgr.registerBus06(BUS_X, BUS_Z, Math.PI);
  const bus = mgr.vehicles.find((v) => v.id === "BUS_06")!;
  const agents = queue.map((q) =>
    mgr.spawnVehicle({
      id: q.id,
      category: q.category,
      edgeId: EDGE,
      s: q.s,
      laneIndex: 1,
      latOffset: q.lat,
      ...SIZE[q.category],
      speed: 0,
    }),
  );
  return { mgr, bus, agents };
}

function isPast(v: VehicleAgent, bus: VehicleAgent): boolean {
  return v.onTurn || v.edgeId !== EDGE || v.s - v.halfLength > bus.s + bus.halfLength;
}

function overlapDepth(a: VehicleAgent, b: VehicleAgent): number {
  // Both travel along the same straight edge, so s and latOffset are a straight (s, lat) frame.
  const ds = Math.abs(a.s - b.s) - (a.halfLength + b.halfLength);
  const dl = Math.abs(a.latOffset - b.latOffset) - (a.halfWidth + b.halfWidth);
  return Math.max(ds, dl);
}

describe("traffic behind a stopped Bus 06", () => {
  it("a queue of vans, a taxi and a motorbike stuck behind the standing bus all swerve out and pass it", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { mgr, bus, agents } = setup(seed);
      const passedAt = new Map<string, number>();
      let worst = Infinity;
      for (let i = 1; i <= 40 / DT && passedAt.size < agents.length; i++) {
        // BusRouteController re-syncs the standing bus every frame
        mgr.syncBus06(BUS_X, BUS_Z, Math.PI, 0, 0);
        mgr.step(input);
        expect(bus.s).toBeCloseTo(46, 3);
        const onEdge = agents.filter((a) => !a.onTurn && a.edgeId === EDGE);
        for (const a of agents) {
          if (!passedAt.has(a.id) && isPast(a, bus)) passedAt.set(a.id, i * DT);
        }
        for (const a of onEdge) {
          worst = Math.min(worst, overlapDepth(a, bus));
          for (const b of onEdge) if (a.id < b.id) worst = Math.min(worst, overlapDepth(a, b));
        }
      }
      const label = `seed ${seed}: ${JSON.stringify([...passedAt])}`;
      // Nobody queues behind the bus forever
      expect(passedAt.size, label).toBe(agents.length);
      // The front van noses out after a short wait; the rest follow one after another
      expect(passedAt.get("van1")!, label).toBeLessThan(12);
      expect(Math.max(...passedAt.values()), label).toBeLessThan(32);
      // Never inside the bus or another vehicle while squeezing past
      expect(worst, label).toBeGreaterThan(0);
    }
  });

  it("a rider right behind the bus filters past at once and a car follows after a short wait", () => {
    const { mgr, bus, agents } = setup(1, [
      { id: "moto1", category: "moto", s: 37.5, lat: 0.9 },
      { id: "car1", category: "car", s: 31, lat: 0.45 },
    ]);
    const passedAt = new Map<string, number>();
    for (let i = 1; i <= 20 / DT && passedAt.size < agents.length; i++) {
      mgr.syncBus06(BUS_X, BUS_Z, Math.PI, 0, 0);
      mgr.step(input);
      for (const a of agents) if (!passedAt.has(a.id) && isPast(a, bus)) passedAt.set(a.id, i * DT);
    }
    // Standing start: about 2.5 m sideways at the blocked-rider rate, then 14 m along the bus
    expect(passedAt.get("moto1")).toBeLessThan(9);
    expect(passedAt.get("car1")).toBeLessThan(11);
  });
});

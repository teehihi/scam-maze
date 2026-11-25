import { describe, expect, it } from "vitest";
import { SaigonTrafficManager } from "../index";
import { VN_TRAFFIC_TUNING } from "../driverModels";
import type { VehicleAgent } from "../types";

const DT = 0.05;
// Real end-of-map geometry: Bus 06 terminates at Tram Cho Lon on LTT_M2_NB (z = -128, s = 27.4), a 5.8 m wide
// carriageway with two lanes, a median fence on the left and the kerb on the right, ending at the J_LTT_DBP junction.
const EDGE = "LTT_M2_NB";
const BUS_X = -2.3;
const BUS_Z = -128;
const input = { dt: DT, playerX: -20, playerY: 5, playerZ: -128, playerYaw: 0, wetness: 0 };

type Internals = { behaviourRng: { s: number }; pedestrians: { update: () => never[] } };
type Category = "car" | "van";
const SIZE: Record<Category, { halfWidth: number; halfLength: number }> = {
  car: { halfWidth: 0.92, halfLength: 2.24 },
  van: { halfWidth: 0.98, halfLength: 2.7 },
};

function setup(seed: number, queue: { id: string; category: Category; s: number; lane: 0 | 1 }[]) {
  const mgr = new SaigonTrafficManager();
  const m = mgr as unknown as Internals;
  m.behaviourRng.s = seed * 7919;
  m.pedestrians.update = () => [];
  mgr.registerBus06(BUS_X, BUS_Z, Math.PI);
  mgr.syncBus06(BUS_X, BUS_Z, Math.PI, 0, 0);
  const edge = mgr.graph.edges.get(EDGE)!;
  const agents = queue.map((q) =>
    mgr.spawnVehicle({
      id: q.id,
      category: q.category,
      edgeId: EDGE,
      s: q.s,
      laneIndex: q.lane,
      latOffset: edge.carLaneOffsets[q.lane],
      ...SIZE[q.category],
      speed: 0,
    }),
  );
  return { mgr, edge, bus: mgr.vehicles.find((v) => v.id === "BUS_06")!, agents };
}

const isBeside = (v: VehicleAgent, bus: VehicleAgent) => v.onTurn || v.edgeId !== EDGE || v.s >= bus.s + 1;

function overlapDepth(a: VehicleAgent, b: VehicleAgent): number {
  const ds = Math.abs(a.s - b.s) - (a.halfLength + b.halfLength);
  const dl = Math.abs(a.latOffset - b.latOffset) - (a.halfWidth + b.halfWidth);
  return Math.max(ds, dl);
}

describe("traffic behind Bus 06 on the narrow end-of-map road (LTT_M2_NB)", () => {
  it("the edge is too narrow to pass a bus at the usual 0.4 m clearance without shifting out of the lane", () => {
    const { edge, bus } = setup(1, []);
    expect(bus.edgeId).toBe(EDGE);
    expect(bus.s).toBeCloseTo(edge.busStopS!, 3);
    expect(edge.width).toBeCloseTo(5.8, 3);
    // inner lane centre -1.45 vs bus at +0.9: a car's side gap is well under the pass clearance
    const gap = bus.latOffset - edge.carLaneOffsets[0] - bus.halfWidth - SIZE.car.halfWidth;
    expect(gap).toBeLessThan(VN_TRAFFIC_TUNING.busPassClearance);
  });

  it("a taxi behind the bus swings out to the free lane once, passes, and never touches the kerb, median or bus", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { mgr, edge, bus, agents } = setup(seed, [
        { id: "taxi", category: "car", s: 17, lane: 1 },
        { id: "van", category: "van", s: 9, lane: 1 },
      ]);
      const lanes = new Map(agents.map((a) => [a.id, [a.laneIndex]]));
      const besideAt = new Map<string, number>();
      let worst = Infinity;
      let kerb = Infinity;
      for (let i = 1; i <= 50 / DT && besideAt.size < agents.length; i++) {
        mgr.syncBus06(BUS_X, BUS_Z, Math.PI, 0, 0);
        mgr.step(input);
        for (const a of agents) {
          if (!besideAt.has(a.id) && isBeside(a, bus)) besideAt.set(a.id, i * DT);
          const seq = lanes.get(a.id)!;
          if (seq[seq.length - 1] !== a.laneIndex) seq.push(a.laneIndex);
          if (!a.onTurn && a.edgeId === EDGE) {
            worst = Math.min(worst, overlapDepth(a, bus));
            kerb = Math.min(kerb, edge.width / 2 - a.halfWidth - Math.abs(a.latOffset));
          }
        }
        worst = Math.min(worst, overlapDepth(agents[0], agents[1]));
      }
      const label = `seed ${seed}: ${JSON.stringify([...besideAt])} lanes ${JSON.stringify([...lanes])}`;
      expect(besideAt.size, label).toBe(agents.length);
      expect(Math.max(...besideAt.values()), label).toBeLessThan(45); // the van may wait for the J_LTT_DBP signal behind the taxi
      // One decisive swing out (lane 1 -> 0), no weaving back and forth in front of the bus
      for (const seq of lanes.values()) expect(seq.length, label).toBeLessThanOrEqual(2);
      expect(worst, label).toBeGreaterThan(0);
      expect(kerb, label).toBeGreaterThan(0);
    }
  });

  it("a queue stuck behind the bus with the inner lane occupied does not dither between lanes", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { mgr, bus, agents } = setup(seed, [
        { id: "taxi", category: "car", s: 19, lane: 1 },
        { id: "c2", category: "car", s: 13, lane: 1 },
        { id: "c3", category: "car", s: 6, lane: 1 },
        { id: "lead1", category: "car", s: 35, lane: 0 },
        { id: "lead2", category: "car", s: 29, lane: 0 },
      ]);
      const c3 = agents[2];
      const flips: number[] = [];
      let last = c3.laneIndex;
      let beside = false;
      for (let i = 1; i <= 70 / DT && !beside; i++) {
        mgr.syncBus06(BUS_X, BUS_Z, Math.PI, 0, 0);
        mgr.step(input);
        if (c3.laneIndex !== last) {
          flips.push(i * DT);
          last = c3.laneIndex;
        }
        beside = isBeside(c3, bus);
      }
      const label = `seed ${seed}: flips ${JSON.stringify(flips)} c3 s=${c3.s.toFixed(1)}`;
      // The last car in the queue must get past the bus within a minute (it used to flip lanes every ~3 s forever)
      expect(beside, label).toBe(true);
      expect(flips.length, label).toBeLessThanOrEqual(2);
    }
  });
});

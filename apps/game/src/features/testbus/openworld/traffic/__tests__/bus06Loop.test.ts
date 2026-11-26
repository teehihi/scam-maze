// Bus 06 on its loop around the whole map: the circuit comes from the road graph, the bus completes laps through
// traffic and signals without locking up, and it drives like a Saigon city bus (honks, squeezes riders, grabs lanes).
import { describe, expect, it, vi } from "vitest";
import { BusRouteController, ROUTE, type TransitEvent } from "../../simulation/transit";
import { SaigonTrafficManager } from "../index";
import { BUS06_EDGES_FOR_TEST } from "./busLoopHelpers";
import { testOBBvsOBB, vehicleToOBB } from "../collisionSystem";
import { VN_TRAFFIC_TUNING } from "../driverModels";

const DT = 0.05;
const NONE = { front: false, rear: false } as const;
const input = { dt: DT, playerX: 20, playerY: 5, playerZ: -20, playerYaw: 0, wetness: 0 };

type Internals = { behaviourRng: { s: number }; pedestrians: { update: () => never[] } };

function makeWorld(seed: number, withTraffic: boolean) {
  const mgr = new SaigonTrafficManager();
  const m = mgr as unknown as Internals;
  m.behaviourRng.s = seed * 7919;
  m.pedestrians.update = () => [];
  const events: TransitEvent[] = [];
  const route = new BusRouteController({ circuit: mgr.busCircuit, onEvent: (e) => events.push(e) });
  if (withTraffic) {
    // A car and two motorbikes on every longer stretch of the loop. Short junction links stay empty, and the seeds are
    // ones where this traffic flows without the bus: denser starts (or seed 2) jam Hai Trieu x 3/2 on their own, a
    // limitation of the traffic sim that exists without Bus 06 (checked on the base commit).
    let n = 0;
    for (const edgeId of BUS06_EDGES_FOR_TEST) {
      const edge = mgr.graph.edges.get(edgeId)!;
      if (edge.length < 30) continue;
      for (const [category, f] of [["car", 0.3], ["moto", 0.6], ["moto", 0.85]] as const) {
        const size = category === "moto" ? { halfWidth: 0.35, halfLength: 0.9 } : { halfWidth: 0.92, halfLength: 2.24 };
        mgr.spawnVehicle({ id: `${category}-${n++}`, category, edgeId, s: edge.length * f, ...size, speed: 4 });
      }
    }
  }
  return { mgr, route, events };
}

function tick(mgr: SaigonTrafficManager, route: BusRouteController, hold = false) {
  mgr.step(input);
  const staged = route.phase === "waiting" && route.staged;
  if (staged && mgr.bus06Registered) mgr.unregisterBus06();
  else if (!staged && !mgr.bus06Registered) mgr.registerBus06(route.x, route.z, Math.PI + route.yaw);
  const plan = mgr.planBus06(route.x, route.z, 12, { yaw: Math.PI + route.yaw, aggressive: route.phase === "driving" });
  route.update(DT, NONE, false, plan.speed, { lat: plan.lat, hold });
  if (mgr.bus06Registered) mgr.syncBus06(route.x, route.z, Math.PI + route.yaw, route.speed, route.accel);
  return plan;
}

describe("Bus 06 circuit", () => {
  it("is a closed loop built from the road graph, through both stops and every junction arc", () => {
    const { mgr } = makeWorld(1, false);
    const c = mgr.busCircuit;
    expect(c.length).toBeGreaterThan(700);
    // Segments are contiguous and the last one ends where the first begins
    for (let i = 1; i < c.segments.length; i++) {
      expect(c.segments[i].start).toBeCloseTo(c.segments[i - 1].start + c.segments[i - 1].length, 6);
    }
    for (let i = 0; i < c.segments.length; i++) {
      const a = c.poseAt(c.segments[i].start + c.segments[i].length - 0.01, 0);
      const b = c.poseAt(c.segments[(i + 1) % c.segments.length].start + 0.01, 0);
      expect(Math.hypot(a.x - b.x, a.z - b.z), `joint ${i}`).toBeLessThan(0.5);
    }
    // Stops come from the graph's busStopS and match the route constants (z = 0 and z = -128 at the kerb)
    const origin = c.poseAt(c.stopD("LTT_S_NB")!);
    const dest = c.poseAt(c.stopD("LTT_M2_NB")!);
    expect(origin.z).toBeCloseTo(ROUTE.originZ, 6);
    expect(origin.x).toBeCloseTo(ROUTE.curbX, 6);
    expect(dest.z).toBeCloseTo(ROUTE.destinationZ, 6);
    // Every signalized junction on the loop has a stop line
    expect(c.stopLines.filter((s) => s.signalized).length).toBeGreaterThanOrEqual(7);
  });

  it("completes laps through traffic and signals without locking up, and never runs a red light", () => {
    for (const seed of [1, 3]) {
      const { mgr, route, events } = makeWorld(seed, true);
      route.stageAway();
      route.callBus(8);
      let t = 0;
      let stillFor = 0;
      let longestStill = 0;
      const visited = new Set<number>();
      let redRuns = 0;
      let prevFront: number | null = null;
      let worstOverlap = 0;
      let laps = 0;
      let wasDriving = false;
      let ghostNearPlayer = 0;
      while (t < 1100 && laps < 2) {
        tick(mgr, route);
        if (mgr.bus06Ghosted && Math.hypot(route.x - input.playerX, route.z - input.playerZ) < VN_TRAFFIC_TUNING.busAggression.ghostMinPlayerDistance) {
          ghostNearPlayer++;
        }
        t += DT;
        if (route.phase === "driving") {
          visited.add(mgr.busCircuit.segmentAt(route.d).index);
          stillFor = route.speed < 0.3 ? stillFor + DT : 0;
          longestStill = Math.max(longestStill, stillFor);
          // Crossing a stop line on red = running the light
          const front = route.d + 5.55;
          if (prevFront !== null) {
            for (const sl of mgr.busCircuit.stopLines) {
              if (!sl.signalized) continue;
              const before = mgr.busCircuit.delta(prevFront, sl.d);
              const after = mgr.busCircuit.delta(front, sl.d);
              if (before > 0.2 && after <= 0.2 && mgr.signals.getAxisState(sl.intersectionId, sl.axis).lamp === "red") redRuns++;
            }
          }
          prevFront = front;
          const bus = mgr.vehicles.find((v) => v.id === "BUS_06");
          if (bus) {
            const ob = vehicleToOBB(bus);
            for (const v of mgr.vehicles) {
              if (v.id === bus.id || Math.hypot(v.x - bus.x, v.z - bus.z) > 14) continue;
              const sat = testOBBvsOBB(ob, vehicleToOBB(v));
              if (sat.hit && sat.depth > worstOverlap) {
                worstOverlap = sat.depth;
              }
            }
          }
        } else {
          prevFront = null;
        }
        if (wasDriving && route.phase === "waiting") laps++;
        wasDriving = route.phase === "driving";
        // Nobody boards: the bus leaves empty after its dwell and goes round
      }
      const label = `seed ${seed} t=${t.toFixed(0)}`;
      expect(laps, label).toBe(2);
      expect(visited.size, label).toBe(mgr.busCircuit.segments.length);
      expect(redRuns, label).toBe(0);
      expect(longestStill, label).toBeLessThan(40);
      expect(worstOverlap, label).toBeLessThan(0.35);
      expect(events.filter((e) => e.type === "left-empty").length, label).toBeGreaterThanOrEqual(2);
      // The traffic sim can jam a junction on its own at this density (it does so on the base commit without Bus 06);
      // the bus then passes the jam detached from the traffic, but only out of the player's sight
      expect(ghostNearPlayer, label).toBe(0);
    }
  }, 60_000);
});

describe("Bus 06 drives like a Saigon city bus", () => {
  function scene(seed: number) {
    const w = makeWorld(seed, false);
    // The bus is out on Lý Thái Tổ heading north with a motorbike dawdling ahead in its lane.
    const { route, mgr } = w;
    route.stageAway();
    route.callBus(8);
    for (let i = 0; i < 12 / DT; i++) tick(mgr, route);
    expect(route.phase).toBe("boarding");
    // Leave empty
    for (let i = 0; i < 30 / DT && route.phase !== "driving"; i++) tick(mgr, route);
    expect(route.phase).toBe("driving");
    return w;
  }

  it("honks at a dawdling motorbike in its lane and the rider swerves out of the bus' way without touching it", () => {
    for (const seed of [1, 2, 3]) {
      const { mgr, route } = scene(seed);
      const horn = vi.spyOn(mgr.audio, "playHorn");
      const bus = mgr.vehicles.find((v) => v.id === "BUS_06")!;
      // Let the bus get going, then a rider dawdles (at most 3 m/s) right in its path
      for (let i = 0; i < 4 / DT; i++) tick(mgr, route);
      const moto = mgr.spawnVehicle({
        id: "rider",
        category: "moto",
        edgeId: "LTT_S_NB",
        s: bus.s + 16,
        latOffset: bus.latOffset,
        halfWidth: 0.35,
        halfLength: 0.9,
        speed: 2.5,
      });
      const honks0 = mgr.bus06Honks;
      const start = moto.latOffset;
      let swerved = 0;
      let worst = Infinity;
      let passed = false;
      for (let i = 0; i < 12 / DT; i++) {
        tick(mgr, route);
        moto.speed = Math.min(moto.speed, 3);
        if (moto.edgeId !== "LTT_S_NB" || moto.onTurn || bus.edgeId !== "LTT_S_NB" || bus.onTurn) break;
        swerved = Math.max(swerved, Math.abs(moto.latOffset - start));
        const ds = Math.abs(moto.s - bus.s) - (moto.halfLength + bus.halfLength);
        const dl = Math.abs(moto.latOffset - bus.latOffset) - (moto.halfWidth + bus.halfWidth);
        worst = Math.min(worst, Math.max(ds, dl));
        if (bus.s - bus.halfLength > moto.s + moto.halfLength) passed = true;
      }
      const label = `seed ${seed}`;
      expect(mgr.bus06Honks - honks0, label).toBeGreaterThan(0);
      expect(horn.mock.calls.some((c) => c[5] === "bus"), label).toBe(true);
      // The rider moved sideways out of the bus' strip, the bus got by, and they never touched
      expect(swerved, label).toBeGreaterThan(0.8);
      expect(passed, label).toBe(true);
      expect(worst, label).toBeGreaterThan(0);
    }
  });

  it("leans on a rider it overtakes: the side gap shrinks to the squeeze gap and the rider has to stop or swerve", () => {
    const { mgr, route } = scene(1);
    const bus = mgr.vehicles.find((v) => v.id === "BUS_06")!;
    const edge = mgr.graph.edges.get("LTT_S_NB")!;
    // A rider alongside the bus' flank, just ahead, beside the bus' lane
    const moto = mgr.spawnVehicle({
      id: "flank",
      category: "moto",
      edgeId: "LTT_S_NB",
      s: Math.min(edge.length - 5, bus.s + 12),
      latOffset: bus.latOffset - 2.0,
      halfWidth: 0.35,
      halfLength: 0.9,
      speed: 5,
    });
    let minGap = Infinity;
    let braked = false;
    for (let i = 0; i < 10 / DT; i++) {
      tick(mgr, route);
      if (moto.edgeId !== "LTT_S_NB" || bus.edgeId !== "LTT_S_NB") break;
      if (Math.abs(moto.s - bus.s) < bus.halfLength + moto.halfLength) {
        minGap = Math.min(minGap, Math.abs(moto.latOffset - bus.latOffset) - bus.halfWidth - moto.halfWidth);
      }
      if (moto.accel < -3) braked = true;
    }
    // Never through each other
    expect(minGap).toBeGreaterThan(-0.05);
    expect(braked || minGap < 0.9).toBe(true);
  });

  it("riders and cars do not give way for ever: pressure lapses after maxYield so nothing deadlocks", () => {
    const { mgr } = makeWorld(1, false);
    mgr.registerBus06(-2.3, -40, Math.PI);
    // A rider pinned in front of a bus that keeps pushing (it cannot get out of the way: put back every frame)
    const rider = mgr.spawnVehicle({ id: "r", category: "moto", edgeId: "LTT_S_NB", s: 93, latOffset: 0.9, halfWidth: 0.35, halfLength: 0.9, speed: 0 });
    let pressedFor = 0;
    let lapsed = false;
    for (let i = 0; i < 12 / DT && !lapsed; i++) {
      mgr.syncBus06(-2.3, -40, Math.PI, 8, 0);
      rider.latOffset = 0.9;
      rider.s = 93;
      mgr.step(input);
      if (rider.busYield && rider.busYield.t > 0) pressedFor += DT;
      if (rider.busYield && rider.busYield.cool > 0) lapsed = true;
    }
    expect(pressedFor).toBeGreaterThan(3);
    expect(lapsed).toBe(true);
  });
});

describe("Bus 06 halted at a red light is not a bus at its stop", () => {
  it("only counts as halted (to be overtaken) at one of its stops", () => {
    const mgr = new SaigonTrafficManager();
    const halted = (mgr as unknown as { isHaltedBus: (v: unknown) => boolean }).isHaltedBus.bind(mgr);
    mgr.registerBus06(-2.3, 0, Math.PI);
    const bus = mgr.vehicles.find((v) => v.id === "BUS_06")!;
    mgr.syncBus06(-2.3, 0, Math.PI, 0, 0);
    expect(halted(bus)).toBe(true);
    // Standing at the J_LTT_32 stop line (front at the line), well away from both stops
    mgr.syncBus06(-2.3, -61.05, Math.PI, 0, 0);
    expect(bus.edgeId).toBe("LTT_S_NB");
    expect(halted(bus)).toBe(false);
  });
});

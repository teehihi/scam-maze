import { describe, expect, it } from "vitest";
import { SaigonTrafficManager } from "../index";
import type { RoadEdge, SignalAxis, VehicleAgent } from "../types";

const DT = 0.05;
const input = { dt: DT, playerX: 5000, playerY: 0, playerZ: 5000, playerYaw: 0, wetness: 0 };

function approaches() {
  const graph = new SaigonTrafficManager().graph;
  return [...graph.edges.values()].filter((e) => graph.intersections.get(e.toNode)?.signalized);
}

/** Sim times at which `axis` turns green, and the time that green ends. */
function greenWindows(mgr: SaigonTrafficManager, interId: string, axis: SignalAxis, until: number) {
  const out: { start: number; end: number }[] = [];
  let prev = "";
  let start = 0;
  for (let t = 0.05; t < until; t += 0.05) {
    mgr.signals.update(t);
    const lamp = mgr.signals.getAxisState(interId, axis).lamp;
    if (lamp === "green" && prev !== "green") start = t;
    if (lamp !== "green" && prev === "green") out.push({ start, end: t });
    prev = lamp;
  }
  return out;
}

const passed = (car: VehicleAgent, edge: RoadEdge) => car.onTurn || car.edgeId !== edge.id;

/**
 * Queue `count` stopped vehicles bumper to bumper at the stop line of `edge` during red, then run the
 * sim through the next green. Returns a description of every vehicle that did not cross.
 */
function runQueue(edge: RoadEdge, count: number, withPeds: boolean): string[] {
  const probe = new SaigonTrafficManager();
  const wins = greenWindows(probe, edge.toNode, edge.axis, 400);
  const win = wins.find((w) => w.start > 40)!;
  const t0 = win.start - 12;
  const mgr = new SaigonTrafficManager();
  (mgr as unknown as { simTime: number }).simTime = t0;
  mgr.signals.update(t0);
  const cars: VehicleAgent[] = [];
  const kinds = ["car", "moto", "car", "car"] as const;
  let tail = edge.length - 1.2;
  for (let i = 0; i < count; i++) {
    const cat = kinds[i % kinds.length];
    const hl = cat === "car" ? 2.24 : 0.9;
    cars.push(
      mgr.spawnVehicle({
        id: `q${i}`,
        category: cat,
        edgeId: edge.id,
        s: Math.max(1, tail - hl),
        laneIndex: 0,
        halfWidth: cat === "car" ? 0.92 : 0.35,
        halfLength: hl,
        speed: 0,
      }),
    );
    tail -= hl * 2 + 1.0;
  }
  if (!withPeds) (mgr as unknown as { pedestrians: { update: () => never[] } }).pedestrians.update = () => [];
  const steps = Math.round((win.end - t0) / DT);
  for (let i = 0; i < steps; i++) {
    mgr.step(input);
  }
  const failures: string[] = [];
  for (const c of cars) {
    if (!passed(c, edge)) {
      failures.push(`${edge.id} ${c.id}(${c.category}) s=${c.s.toFixed(1)}/${edge.length.toFixed(1)} wait=${c.waitTime.toFixed(1)} v=${c.speed.toFixed(2)}`);
    }
  }
  return failures;
}

describe("queued vehicles move on green", () => {
  const list = approaches();
  it("every queued vehicle in a mixed queue of two crosses during the green", () => {
    const failures: string[] = [];
    for (const edge of list) failures.push(...runQueue(edge, 2, false));
    expect(failures).toEqual([]);
  });
  it("the head of a queue crosses with pedestrians around", () => {
    const failures: string[] = [];
    for (const edge of list) failures.push(...runQueue(edge, 1, true));
    expect(failures).toEqual([]);
  });
});

describe("junction box never locks up", () => {
  it("no vehicle stands still inside a junction for minutes while every approach is loaded", () => {
    const mgr = new SaigonTrafficManager();
    let n = 0;
    for (const e of mgr.graph.edges.values()) {
      for (let k = 0; k < 2; k++) {
        const cat = k === 1 ? "moto" : "car";
        mgr.spawnVehicle({
          id: `v${n++}`,
          category: cat,
          edgeId: e.id,
          s: 5 + k * 25 + (n % 7),
          laneIndex: k as 0 | 1,
          halfWidth: cat === "car" ? 0.92 : 0.4,
          halfLength: cat === "car" ? 2.2 : 1.0,
        });
      }
    }
    const still = new Map<string, number>();
    let worst = { id: "", sec: 0 };
    for (let i = 0; i < 600 / DT; i++) {
      mgr.step(input);
      for (const v of mgr.vehicles) {
        if (!v.onTurn || v.speed > 0.1) {
          still.set(v.id, 0);
          continue;
        }
        const sec = (still.get(v.id) ?? 0) + DT;
        still.set(v.id, sec);
        if (sec > worst.sec) worst = { id: `${v.id} on ${v.turnId}`, sec };
      }
    }
    // Two vehicles blocking each other inside the box stayed there for the whole run (about 570 s).
    // A queue spilling back from a red light downstream may hold a vehicle for part of a signal cycle only.
    expect(worst.sec, worst.id).toBeLessThan(100);
  });
});

import { describe, expect, it } from "vitest";
import { SaigonTrafficManager } from "../index";
import type { RoadEdge, SignalAxis } from "../types";

const DT = 0.05;
const input = { dt: DT, playerX: 5000, playerY: 0, playerZ: 5000, playerYaw: 0, wetness: 0 };

/** A fresh manager whose clock sits at `time`, with one car (at rest unless `speed` is given) 25 m before the stop line of `edge`. */
function setup(edge: RoadEdge, time: number, speed = 0) {
  const mgr = new SaigonTrafficManager();
  (mgr as unknown as { simTime: number }).simTime = time;
  mgr.signals.update(time);
  const car = mgr.spawnVehicle({
    id: "probe",
    category: "car",
    edgeId: edge.id,
    s: Math.max(1, edge.length - 25),
    laneIndex: 0,
    halfWidth: 0.92,
    halfLength: 2.24,
    speed,
  });
  return { mgr, car };
}

const passed = (car: { edgeId: string; onTurn: boolean }, edge: RoadEdge) => car.onTurn || car.edgeId !== edge.id;

/** First sim time at which `axis` of `interId` turns green after a red phase, and how long it stays green. */
function findGreenStart(mgr: SaigonTrafficManager, interId: string, axis: SignalAxis) {
  let prev = mgr.signals.getAxisState(interId, axis).lamp;
  for (let t = 0.05; t < 400; t += 0.05) {
    mgr.signals.update(t);
    const lamp = mgr.signals.getAxisState(interId, axis).lamp;
    if (lamp === "green" && prev !== "green") return t;
    prev = lamp;
  }
  throw new Error(`${interId} ${axis} never turns green`);
}

function signalizedApproaches() {
  const graph = new SaigonTrafficManager().graph;
  return [...graph.edges.values()].filter((e) => graph.intersections.get(e.toNode)?.signalized);
}

describe("vehicles obey the displayed signal", () => {
  const approaches = signalizedApproaches();

  it("has signalized approaches to test", () => {
    expect(approaches.length).toBeGreaterThan(4);
  });

  it("a car waiting on a green axis crosses the stop line", () => {
    const failures: string[] = [];
    for (const edge of approaches) {
      const probe = new SaigonTrafficManager();
      const start = findGreenStart(probe, edge.toNode, edge.axis);
      const { mgr, car } = setup(edge, start);
      let crossed = false;
      for (let i = 0; i < 20 / DT && !crossed; i++) {
        mgr.step(input);
        crossed = passed(car, edge);
      }
      if (!crossed) failures.push(`${edge.id} (${edge.toNode}/${edge.axis}) stayed at s=${car.s.toFixed(1)}/${edge.length.toFixed(1)}`);
    }
    expect(failures).toEqual([]);
  });

  it("a car is held at the stop line while its axis is red", () => {
    const failures: string[] = [];
    for (const edge of approaches) {
      const probe = new SaigonTrafficManager();
      const green = findGreenStart(probe, edge.toNode, edge.axis);
      // Just after the axis turned red: probe from the first red instant that follows this green.
      let t = green;
      while (probe.signals.getAxisState(edge.toNode, edge.axis).lamp !== "red") {
        t += 0.05;
        probe.signals.update(t);
      }
      const redFor = probe.signals.getAxisState(edge.toNode, edge.axis).countdown;
      const { mgr, car } = setup(edge, t, 8);
      let crossed = false;
      for (let i = 0; i < Math.max(1, redFor - 1.5) / DT && !crossed; i++) {
        mgr.step(input);
        crossed = passed(car, edge);
      }
      if (crossed) failures.push(`${edge.id} (${edge.toNode}/${edge.axis}) ran the red light`);
    }
    expect(failures).toEqual([]);
  });
});

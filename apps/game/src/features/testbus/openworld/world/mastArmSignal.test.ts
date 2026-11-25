import { beforeEach, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { SaigonRoadGraph } from "../traffic";
import { createMastArmSignal } from "./mastArmSignal";
import {
  EASTBOUND,
  NORTHBOUND,
  deriveSignalApproaches,
  SOUTHBOUND,
  WESTBOUND,
  rightOf,
  signalBasePosition,
  signalYaw,
  type Heading,
} from "./signalPlacement";

const headings: [string, Heading, { x: number; z: number }][] = [
  ["northbound", NORTHBOUND, { x: 1, z: 0 }],
  ["southbound", SOUTHBOUND, { x: -1, z: 0 }],
  ["eastbound", EASTBOUND, { x: 0, z: 1 }],
  ["westbound", WESTBOUND, { x: 0, z: -1 }],
];

const SIGNAL_APPROACHES = deriveSignalApproaches(new SaigonRoadGraph());

describe("signal placement maths", () => {
  it.each(headings)("puts the %s driver's right-hand side where Vietnam traffic expects it", (_n, h, right) => {
    const r = rightOf(h);
    expect(r.x).toBeCloseTo(right.x);
    expect(r.z).toBeCloseTo(right.z);
  });

  it("points the arm over the road and the heads at the approaching driver for every heading", () => {
    for (const [, h, right] of headings) {
      const g = new T.Group();
      g.rotation.y = signalYaw(h);
      g.updateMatrixWorld(true);
      const arm = new T.Vector3(1, 0, 0).applyMatrix4(g.matrixWorld);
      const face = new T.Vector3(0, 0, -1).applyMatrix4(g.matrixWorld);
      expect(arm.x).toBeCloseTo(-right.x);
      expect(arm.z).toBeCloseTo(-right.z);
      expect(face.x).toBeCloseTo(-h.dx);
      expect(face.z).toBeCloseTo(-h.dz);
    }
  });

  it("yields one signal per approach edge arriving at each intersection", () => {
    const graph = new SaigonRoadGraph();
    for (const id of ["J_LTT_32", "J_LTT_PED", "J_LTT_DBP", "J_HT_32", "J_HT_DBP"]) {
      const arriving = [...graph.edges.values()].filter((e) => e.toNode === id).map((e) => e.id).sort();
      const placed = SIGNAL_APPROACHES.filter((a) => a.intersectionId === id).map((a) => a.edgeId).sort();
      expect(placed, id).toEqual(arriving);
    }
    expect(SIGNAL_APPROACHES.filter((a) => a.intersectionId === "J_HT_DBP")).toHaveLength(4);
  });

  it("stands every pole on the driver's right of its lane, off the asphalt, behind the junction", () => {
    const graph = new SaigonRoadGraph();
    for (const a of SIGNAL_APPROACHES) {
      const edge = graph.edges.get(a.edgeId)!;
      const len = Math.hypot(edge.end.x - edge.start.x, edge.end.z - edge.start.z);
      const dir = { dx: (edge.end.x - edge.start.x) / len, dz: (edge.end.z - edge.start.z) / len };
      expect(dir.dx).toBeCloseTo(a.heading.dx, 1);
      expect(dir.dz).toBeCloseTo(a.heading.dz, 1);
      const pos = signalBasePosition(a);
      const r = rightOf(a.heading);
      const lateralFromLane = (pos.x - edge.end.x) * r.x + (pos.z - edge.end.z) * r.z;
      expect(lateralFromLane, a.edgeId).toBeCloseTo(a.poleLateral);
      expect(lateralFromLane, a.edgeId).toBeGreaterThan(a.kerbDistance);
      const along = (a.stopLine.x - pos.x) * a.heading.dx + (a.stopLine.z - pos.z) * a.heading.dz;
      expect(along, a.edgeId).toBeGreaterThan(0);
    }
  });
});

describe("mast-arm signal model", () => {
  beforeEach(() => {
    // jsdom has no canvas backend; the countdown panel only needs a context object at build time.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
  });

  it("builds a pole, an arm, three heads and countdowns that share one lamp set", () => {
    const counts: unknown[] = [];
    const sig = createMastArmSignal({ x: 0, y: 0, z: 0, heading: NORTHBOUND, onCountdown: (c, l) => counts.push([c, l]) });
    expect(sig.pole).toBeTruthy();
    expect(sig.arm).toBeTruthy();
    expect(sig.heads.length).toBeGreaterThanOrEqual(2);
    expect(sig.countdownPanels.length).toBe(sig.heads.length);
    expect(counts).toHaveLength(1);
    for (const entry of counts as [unknown, typeof sig.lamps][]) expect(entry[1]).toBe(sig.lamps);
    const lensMats = new Set<unknown>();
    sig.group.traverse((o) => {
      const m = o as T.Mesh;
      if (m.isMesh && [sig.lamps.r, sig.lamps.y, sig.lamps.g].includes(m.material as T.MeshStandardMaterial)) lensMats.add(m.material);
    });
    expect(lensMats.size).toBe(3);
  });
});

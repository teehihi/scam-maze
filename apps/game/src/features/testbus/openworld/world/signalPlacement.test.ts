import { beforeEach, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { SaigonRoadGraph, TrafficSignalController, createDriverPersonality } from "../traffic";
import { IntersectionManager } from "../traffic/intersectionMgr";
import type { RoadEdge, VehicleAgent } from "../traffic/types";
import { createMastArmSignal } from "./mastArmSignal";
import { buildIntersectionSignals } from "./signalBuilder";
import { createSignalDebugOverlay, isSignalDebugEnabled, validateApproach } from "./signalDebug";
import {
  deriveSignalApproaches,
  distanceToSegment,
  rightOf,
  signalBasePosition,
  type Heading,
  type SignalApproach,
} from "./signalPlacement";
import { WorldStreamer } from "./WorldStreamer";

const graph = new SaigonRoadGraph();
const approaches = deriveSignalApproaches(graph);
const SIGNALIZED = [...graph.intersections.values()].filter((i) => i.signalized).map((i) => i.id);

const EXPECTED_COUNTS: Record<string, number> = { J_HT_DBP: 4, J_LTT_32: 3, J_LTT_DBP: 3, J_HT_32: 3, J_LTT_PED: 2 };

function world(a: SignalApproach, heading: Heading = a.heading) {
  const sig = createMastArmSignal({
    x: 0,
    y: 0,
    z: 0,
    heading,
    armLength: a.armLength,
    laneCentres: a.laneCentres,
  });
  sig.group.updateMatrixWorld(true);
  return sig;
}

function worldDir(sig: ReturnType<typeof createMastArmSignal>, local: T.Vector3) {
  return local.clone().transformDirection(sig.group.matrixWorld);
}

beforeEach(() => {
  // jsdom has no canvas backend; countdown panels only need a context object at build time.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(new Proxy({}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 0 }) : () => undefined), set: () => true }) as never);
});

describe("derived approaches", () => {
  it("has exactly one approach per edge arriving at a signalized intersection, and nothing else", () => {
    const expected = [...graph.edges.values()].filter((e) => SIGNALIZED.includes(e.toNode)).map((e) => `${e.toNode}:${e.id}`).sort();
    expect(approaches.map((a) => a.id).sort()).toEqual(expected);
    for (const a of approaches) expect(graph.edges.get(a.edgeId)!.toNode).toBe(a.intersectionId);
    expect(approaches).toHaveLength(15);
  });

  it("gives no approach to outgoing legs, J_LTT_VH, END nodes or missing legs", () => {
    for (const a of approaches) {
      expect(a.intersectionId).not.toBe("J_LTT_VH");
      expect(a.intersectionId.startsWith("END_")).toBe(false);
      const edge = graph.edges.get(a.edgeId)!;
      expect(edge.fromNode).not.toBe(a.intersectionId);
    }
    for (const e of graph.edges.values()) {
      if (e.toNode === "J_LTT_VH" || e.toNode.startsWith("END_")) {
        expect(approaches.find((a) => a.edgeId === e.id)).toBeUndefined();
      }
    }
    expect(approaches.filter((a) => a.intersectionId === "J_LTT_VH")).toHaveLength(0);
  });

  it("matches the leg count of every intersection, with J_HT_DBP having one per heading", () => {
    for (const [id, n] of Object.entries(EXPECTED_COUNTS)) {
      expect(approaches.filter((a) => a.intersectionId === id), id).toHaveLength(n);
    }
    const dirs = approaches
      .filter((a) => a.intersectionId === "J_HT_DBP")
      .map((a) => `${Math.round(a.heading.dx)},${Math.round(a.heading.dz)}`)
      .sort();
    expect(dirs).toEqual(["-1,0", "0,-1", "0,1", "1,0"]);
  });

  it("has unique approach ids and edge ids and poles at least 3 m apart", () => {
    expect(new Set(approaches.map((a) => a.id)).size).toBe(approaches.length);
    expect(new Set(approaches.map((a) => a.edgeId)).size).toBe(approaches.length);
    const poles = approaches.map(signalBasePosition);
    for (let i = 0; i < poles.length; i++) {
      for (let j = i + 1; j < poles.length; j++) {
        expect(Math.hypot(poles[i].x - poles[j].x, poles[i].z - poles[j].z), `${approaches[i].id} vs ${approaches[j].id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("signal geometry", () => {
  const diag = (deg: number): Heading => ({ dx: Math.cos((deg * Math.PI) / 180), dz: Math.sin((deg * Math.PI) / 180) });

  it("faces the oncoming driver for every edge heading and a synthetic diagonal", () => {
    const base = approaches[0];
    const headings: Heading[] = [...approaches.map((a) => a.heading), diag(30), diag(-120)];
    for (const h of headings) {
      const sig = world(base, h);
      const normal = worldDir(sig, new T.Vector3(0, 0, -1));
      expect(normal.x).toBeCloseTo(-h.dx, 5);
      expect(normal.z).toBeCloseTo(-h.dz, 5);
      // Direction from the head to a driver 30 m back along the approach.
      const head = sig.heads[0].getWorldPosition(new T.Vector3());
      const driver = new T.Vector3(-h.dx * 30, head.y, -h.dz * 30);
      const toDriver = driver.sub(head).setY(0).normalize();
      expect(normal.dot(toDriver)).toBeGreaterThan(0.95);
    }
  });

  it("stands the pole outside the carriageway and clear of the opposite carriageway", () => {
    for (const a of approaches) {
      const edge = graph.edges.get(a.edgeId)!;
      const pole = signalBasePosition(a);
      const r = rightOf(a.heading);
      const lateral = (pole.x - edge.end.x) * r.x + (pole.z - edge.end.z) * r.z;
      expect(lateral, a.id).toBeGreaterThan(a.kerbDistance);
      expect(a.kerbDistance, a.id).toBeCloseTo(edge.width / 2 + 0.3);
      for (const o of graph.edges.values()) {
        if (o.fromNode !== edge.toNode || o.toNode !== edge.fromNode) continue;
        expect(distanceToSegment(pole, o.start, o.end), `${a.id} vs ${o.id}`).toBeGreaterThan(o.width / 2);
      }
    }
  });

  it("puts the pole behind the stop line and outside every crosswalk of its intersection", () => {
    for (const a of approaches) {
      const pole = signalBasePosition(a);
      const behind = (a.stopLine.x - pole.x) * a.heading.dx + (a.stopLine.z - pole.z) * a.heading.dz;
      expect(behind, a.id).toBeGreaterThanOrEqual(0.5);
      for (const id of graph.intersections.get(a.intersectionId)!.crosswalkIds) {
        const cw = graph.crosswalks.get(id)!;
        expect(distanceToSegment(pole, cw.a, cw.b), `${a.id} vs ${id}`).toBeGreaterThan(cw.halfWidth + 0.3);
      }
    }
  });

  it("extends the arm past the far lane centre, perpendicular to travel and toward the median", () => {
    for (const a of approaches) {
      const edge = graph.edges.get(a.edgeId)!;
      const sig = world(a);
      const dir = worldDir(sig, new T.Vector3(1, 0, 0));
      const r = rightOf(a.heading);
      expect(dir.x * a.heading.dx + dir.z * a.heading.dz, a.id).toBeCloseTo(0, 5);
      expect(dir.x * r.x + dir.z * r.z, a.id).toBeCloseTo(-1, 5);
      const pole = signalBasePosition(a);
      const end = { x: pole.x + dir.x * a.armLength, z: pole.z + dir.z * a.armLength };
      const farLane = Math.min(...edge.carLaneOffsets);
      const endLateral = (end.x - edge.end.x) * r.x + (end.z - edge.end.z) * r.z;
      expect(endLateral, a.id).toBeLessThan(farLane);
      // every lane centre has an overhead head at its lateral position
      for (const offset of edge.carLaneOffsets) {
        const headX = a.poleLateral - offset;
        expect(sig.heads.some((h) => Math.abs(h.position.x - headX) < 1e-6), `${a.id} lane ${offset}`).toBe(true);
      }
    }
  });
});

interface Stub {
  calls: { intersectionId: string; axis: string; redMat: T.MeshStandardMaterial; amberMat: T.MeshStandardMaterial; greenMat: T.MeshStandardMaterial }[];
  graph: SaigonRoadGraph;
  bindSignalVisual: (b: never) => void;
}

function makeStub(onBind?: (b: never) => void): Stub {
  const stub: Stub = {
    calls: [],
    graph,
    bindSignalVisual: (b) => {
      stub.calls.push(b);
      onBind?.(b);
    },
  };
  return stub;
}

function build(stub: Stub, streamer = new WorldStreamer()) {
  const parent = new T.Group();
  const built = buildIntersectionSignals({ graph, trafficMgr: stub as never, streamer, solids: [], parent });
  return { built, streamer, parent };
}

describe("binding", () => {
  it("binds each signal once, with its edge's toNode and axis", () => {
    const stub = makeStub();
    build(stub);
    expect(stub.calls).toHaveLength(15);
    const got = stub.calls.map((c) => `${c.intersectionId}/${c.axis}`).sort();
    const want = approaches.map((a) => `${graph.edges.get(a.edgeId)!.toNode}/${graph.edges.get(a.edgeId)!.axis}`).sort();
    expect(got).toEqual(want);
  });
});

describe("streaming", () => {
  it("shows and hides each intersection as a whole and never splits or duplicates signals", () => {
    const stub = makeStub();
    const { built, streamer } = build(stub);
    const countSignals = (g: T.Group) => g.children.length;
    const total = () => [...built.groups.values()].reduce((n, g) => n + countSignals(g), 0);
    expect(built.groups.size).toBe(5);
    expect(total()).toBe(15);
    for (const [id, n] of Object.entries(EXPECTED_COUNTS)) expect(built.groups.get(id)!.children).toHaveLength(n);

    const c = graph.intersections.get("J_HT_DBP")!.center;
    streamer.update(c.x, 0, c.z, false);
    expect(built.groups.get("J_HT_DBP")!.visible).toBe(true);
    streamer.update(c.x + 5000, 0, c.z + 5000, false);
    for (const g of built.groups.values()) expect(g.visible).toBe(false);
    streamer.update(c.x, 0, c.z, false);
    expect(built.groups.get("J_HT_DBP")!.visible).toBe(true);
    // groups far away stay hidden while the near one is visible
    for (const [id, g] of built.groups) {
      const ic = graph.intersections.get(id)!.center;
      const near = Math.hypot(ic.x - c.x, ic.z - c.z) < 140;
      expect(g.visible, id).toBe(near);
    }

    expect(total()).toBe(15);
    const seen = new Set<T.Object3D>();
    for (const g of built.groups.values()) for (const child of g.children) {
      expect(seen.has(child)).toBe(false);
      seen.add(child);
    }
    expect(seen.size).toBe(15);
  });
});

describe("signal state agreement", () => {
  function setup() {
    const ctrl = new TrafficSignalController(graph.intersections.values());
    const stub = makeStub((b) => ctrl.bindVisual(b as never));
    build(stub);
    return { ctrl, stub, mgr: new IntersectionManager(graph, ctrl) };
  }

  function vehicle(edge: RoadEdge): VehicleAgent {
    return {
      id: "probe",
      category: "car",
      halfWidth: 0.9,
      halfLength: 2.2,
      wheelBase: 2.7,
      personality: createDriverPersonality("car", 1),
      onTurn: false,
      edgeId: edge.id,
      turnId: null,
      nextTurnId: null,
      s: edge.length - 2.5,
      laneIndex: 0,
      latOffset: 0,
      targetLatOffset: 0,
      latVel: 0,
      x: edge.end.x,
      z: edge.end.z,
      yaw: edge.yaw,
      yawRate: 0,
      speed: 0,
      accel: 0,
      steerAngle: 0,
      pitch: 0,
      pitchVel: 0,
      roll: 0,
      rollVel: 0,
      collisionPause: 0,
      blinker: 0,
      brakeLevel: 0,
      committedJunctionId: null,
      waitTime: 0,
      hornCooldown: 0,
      laneChangeCooldown: 0,
      lodTier: 0,
    } as VehicleAgent;
  }

  it("lights exactly the lamp of the controller state, and red/green match the intersection manager", () => {
    const { ctrl, stub, mgr } = setup();
    expect(stub.calls).toHaveLength(15);
    let sawRed = 0;
    let sawGreen = 0;
    for (const id of SIGNALIZED) {
      const spec = graph.intersections.get(id)!;
      const cycle = spec.nsGreenSec + spec.ewGreenSec + 2 * spec.amberSec + 2 * spec.allRedSec;
      const binds = stub.calls.filter((c) => c.intersectionId === id);
      expect(binds.length).toBe(EXPECTED_COUNTS[id]);
      for (let t = 0; t <= cycle + 0.01; t += 0.5) {
        ctrl.update(t);
        for (const b of binds) {
          const st = ctrl.getAxisState(id, b.axis as "ns" | "ew");
          const on = { red: b.redMat, amber: b.amberMat, green: b.greenMat };
          for (const [lamp, mat] of Object.entries(on)) {
            if (lamp === st.lamp) expect(mat.emissiveIntensity, `${id} ${b.axis} t=${t}`).toBeGreaterThan(1);
            else expect(mat.emissiveIntensity, `${id} ${b.axis} t=${t}`).toBeLessThan(0.5);
          }
        }
        // conflicting axes never both green
        const ns = ctrl.getAxisState(id, "ns").lamp;
        const ew = ctrl.getAxisState(id, "ew").lamp;
        expect(ns === "green" && ew === "green", `${id} t=${t}`).toBe(false);
      }
    }
    // vehicle decisions follow the same state as the lamps
    for (const a of approaches) {
      const edge = graph.edges.get(a.edgeId)!;
      const turns = [...graph.turns.values()].filter((tr) => tr.fromEdgeId === edge.id);
      expect(turns.length, a.id).toBeGreaterThan(0);
      const spec = graph.intersections.get(a.intersectionId)!;
      const cycle = spec.nsGreenSec + spec.ewGreenSec + 2 * spec.amberSec + 2 * spec.allRedSec;
      for (let t = 0; t < cycle; t += 0.5) {
        ctrl.update(t);
        const lamp = ctrl.getAxisState(a.intersectionId, a.axis).lamp;
        if (lamp === "amber") continue;
        for (const turn of turns) {
          const d = mgr.evaluateEntry(vehicle(edge), turn, 2.5, 1, [], []);
          if (lamp === "red") {
            sawRed++;
            expect(d.allowed, `${turn.id} red t=${t}`).toBe(false);
            expect(d.reason).toBe("red");
          } else {
            sawGreen++;
            expect(d.allowed, `${turn.id} green t=${t} ${d.reason}`).toBe(true);
          }
        }
      }
    }
    expect(sawRed).toBeGreaterThan(0);
    expect(sawGreen).toBeGreaterThan(0);
  });
});

describe("validateApproach and debug overlay", () => {
  it("accepts all 15 derived approaches", () => {
    for (const a of approaches) expect(validateApproach(a, graph), a.id).toEqual({ ok: true, problems: [] });
  });

  it("rejects a pole inside the road, in front of the stop line, or an arm that is too short", () => {
    const a = approaches[0];
    const edge = graph.edges.get(a.edgeId)!;
    const inRoad = validateApproach({ ...a, poleLateral: 0.5 * edge.width / 2 }, graph);
    expect(inRoad.ok).toBe(false);
    expect(inRoad.problems.join(" ")).toMatch(/kerb/);
    expect(validateApproach({ ...a, poleBehindStop: -1 }, graph).ok).toBe(false);
    expect(validateApproach({ ...a, armLength: 1 }, graph).ok).toBe(false);
  });

  it("builds an overlay with one line draw call", () => {
    const g = createSignalDebugOverlay(approaches, graph, graph.intersections.values());
    expect(g.children.filter((c) => (c as T.LineSegments).isLineSegments)).toHaveLength(1);
  });

  it("is disabled unless DEV is true and ?signalDebug=1 or the global flag is set", () => {
    vi.stubEnv("DEV", false);
    window.__SIGNAL_DEBUG__ = true;
    expect(isSignalDebugEnabled()).toBe(false);
    vi.stubEnv("DEV", true);
    expect(isSignalDebugEnabled()).toBe(true);
    window.__SIGNAL_DEBUG__ = false;
    expect(isSignalDebugEnabled()).toBe(false);
    window.history.pushState({}, "", "/?signalDebug=1");
    expect(isSignalDebugEnabled()).toBe(true);
    vi.stubEnv("DEV", false);
    expect(isSignalDebugEnabled()).toBe(false);
    window.history.pushState({}, "", "/");
    vi.unstubAllEnvs();
  });

  it("does not create the overlay from the builder when disabled", () => {
    vi.stubEnv("DEV", false);
    window.history.pushState({}, "", "/?signalDebug=1");
    const { parent } = build(makeStub());
    expect(parent.children.some((c) => c.name === "signal-debug")).toBe(false);
    vi.stubEnv("DEV", true);
    const on = build(makeStub());
    expect(on.parent.children.some((c) => c.name === "signal-debug")).toBe(true);
    window.history.pushState({}, "", "/");
    vi.unstubAllEnvs();
  });
});

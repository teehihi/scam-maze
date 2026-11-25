import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import * as T from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrafficSignalController } from "../traffic/signalController";
import { signalLampMaterial, type LampSet } from "./mastArmSignal";
import { NORTHBOUND, signalYaw } from "./signalPlacement";
import { createGlbMastArmSignal, HEAD_PARTS, LENS_PUSH, prepareTemplate, SIGNAL_NODES, type TrafficSignalTemplate } from "./trafficSignalModel";

const NATIVE_ARM = 8.5553;
const bodyMaterial = new T.MeshStandardMaterial({ color: 0x333333 });

function named<T3 extends T.Object3D>(o: T3, name: string): T3 {
  o.name = name;
  return o;
}

function syntheticTemplate(): TrafficSignalTemplate {
  const root = new T.Group();
  const mesh = (name: string, g: T.BufferGeometry) => named(new T.Mesh(g, bodyMaterial), name);
  root.add(mesh(SIGNAL_NODES.pole, new T.BoxGeometry(0.2, 6.6, 0.2)));
  const arm = mesh(SIGNAL_NODES.arm, new T.BoxGeometry(NATIVE_ARM, 0.3, 0.1));
  arm.userData.length = NATIVE_ARM;
  arm.position.set(NATIVE_ARM / 2, 5.75, 0); // quantised leaf transform, like the real file
  root.add(arm);
  const head = (name: string, x: number, y: number, countdown: boolean) => {
    const g = named(new T.Group(), name);
    g.position.set(x, y, -0.2);
    g.add(mesh(`${name}_body`, new T.BoxGeometry(0.4, 1.2, 0.3)));
    ["red", "amber", "green"].forEach((c, i) => {
      const lens = mesh(`${name}_${c}`, new T.CircleGeometry(0.1, 8));
      lens.position.set(0, -0.3 - i * 0.3, -0.15);
      g.add(lens);
    });
    if (countdown) {
      const box = mesh(`${name}_${HEAD_PARTS.countdown}`, new T.BoxGeometry(1, 0.6, 0.2));
      box.userData = { faceCenter: [-0.85, -0.7, -0.145], faceSize: [0.99, 0.6] };
      g.add(box);
    }
    root.add(g);
  };
  head(SIGNAL_NODES.headLow, 0.05, 3.86, false);
  head(SIGNAL_NODES.headA, 3.87, 6.46, true);
  head(SIGNAL_NODES.headB, 8.32, 6.46, true);
  return prepareTemplate(root);
}

const worldBox = (o: T.Object3D) => {
  o.updateWorldMatrix(true, true);
  return new T.Box3().setFromObject(o);
};
const lampSet = (): LampSet => ({ r: signalLampMaterial(0xff0000), y: signalLampMaterial(0xffff00), g: signalLampMaterial(0x00ff00) });

describe("createGlbMastArmSignal", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
  });

  const build = (template: TrafficSignalTemplate, lanes: number[], armLength = 6.5, lamps = lampSet()) => {
    const countdown = TrafficSignalController.createSharedCountdown();
    return { countdown, lamps, signal: createGlbMastArmSignal(template, { lamps, countdown, armLength, laneCentres: lanes }) };
  };

  it.each([[[2.5]], [[1.6, 4.8]], [[1.2, 3.4, 5.6]]])("hangs one overhead head over each lane centre %j", (lanes) => {
    const { signal } = build(syntheticTemplate(), lanes);
    expect(signal.heads).toHaveLength(lanes.length + 1);
    expect(signal.heads.slice(1).map((h) => h.position.x)).toEqual([...lanes].sort((a, b) => a - b));
    expect(signal.countdownPanels).toHaveLength(lanes.length);
  });

  it("stretches the arm so its tip reaches the requested length", () => {
    const { signal } = build(syntheticTemplate(), [2, 5], 6.5);
    expect(worldBox(signal.arm).max.x).toBeCloseTo(6.5, 3);
    expect(worldBox(signal.arm).min.x).toBeCloseTo(0, 3);
  });

  it("puts the signal's own lamp materials on every lens", () => {
    const { signal, lamps } = build(syntheticTemplate(), [2, 5]);
    for (const head of signal.heads) {
      const name = head.name;
      expect((head.getObjectByName(`${name}_red`) as T.Mesh).material).toBe(lamps.r);
      expect((head.getObjectByName(`${name}_amber`) as T.Mesh).material).toBe(lamps.y);
      expect((head.getObjectByName(`${name}_green`) as T.Mesh).material).toBe(lamps.g);
    }
  });

  it("moves every lens toward -Z so it stands proud of the housing, without touching the template", () => {
    const template = syntheticTemplate();
    const { signal } = build(template, [2, 5]);
    for (const head of signal.heads) {
      for (const part of ["red", "amber", "green"]) {
        const lens = head.getObjectByName(`${head.name}_${part}`)!;
        expect(lens.position.z).toBeCloseTo(-0.15 - LENS_PUSH, 6);
      }
    }
    expect(template.root.getObjectByName("head_a_red")!.position.z).toBeCloseTo(-0.15, 6);
  });

  it("shares geometry and body material between signals but not lens materials", () => {
    const template = syntheticTemplate();
    const a = build(template, [2, 5]).signal;
    const b = build(template, [2, 5]).signal;
    const geometries = (s: T.Object3D) => {
      const set = new Set<T.BufferGeometry>();
      s.traverse((o) => {
        const m = o as T.Mesh;
        if (m.isMesh && !(m.material instanceof T.MeshBasicMaterial)) set.add(m.geometry);
      });
      return set;
    };
    const ga = geometries(a.group), gb = geometries(b.group);
    expect(ga.size).toBeGreaterThan(5);
    for (const g of ga) expect(gb.has(g)).toBe(true);
    expect((a.pole as T.Mesh).material).toBe((b.pole as T.Mesh).material);
    expect(a.lamps.r).not.toBe(b.lamps.r);
  });

  it("shows one shared countdown texture on every panel, in front of the box and facing -Z", () => {
    const { signal, countdown } = build(syntheticTemplate(), [2, 5]);
    const materials = new Set(signal.countdownPanels.map((p) => (p.material as T.MeshBasicMaterial).map));
    expect(materials.size).toBe(1);
    expect([...materials][0]).toBe(countdown.handle.texture);
    for (const panel of signal.countdownPanels) {
      expect(panel.rotation.y).toBeCloseTo(Math.PI);
      expect(panel.position.z).toBeLessThan(-0.145);
      expect(panel.parent!.name).toMatch(/^head_[ab]$/);
    }
  });

  it("points the heads at the approaching driver once the container is yawed", () => {
    const { signal } = build(syntheticTemplate(), [2, 5]);
    const container = new T.Group();
    container.rotation.y = signalYaw(NORTHBOUND);
    container.add(signal.group);
    container.updateMatrixWorld(true);
    for (const panel of signal.countdownPanels) {
      const normal = new T.Vector3(0, 0, 1).transformDirection(panel.matrixWorld);
      // The plane's front (+Z, rotated by PI) must look back at the driver travelling along the heading.
      expect(normal.x * NORTHBOUND.dx + normal.z * NORTHBOUND.dz).toBeCloseTo(-1);
    }
    const lens = worldBox(signal.heads[1].getObjectByName("head_a_red")!);
    const body = worldBox(signal.heads[1].getObjectByName("head_a_body")!);
    const towardDriver = (c: T.Vector3) => -(c.x * NORTHBOUND.dx + c.z * NORTHBOUND.dz);
    expect(towardDriver(lens.getCenter(new T.Vector3()))).toBeGreaterThan(towardDriver(body.getCenter(new T.Vector3())));
  });

  it("casts shadows only from the pole, arm and bodies", () => {
    const { signal } = build(syntheticTemplate(), [2, 5]);
    signal.group.traverse((o) => {
      const m = o as T.Mesh;
      if (!m.isMesh || m.material instanceof T.MeshBasicMaterial) return;
      const expected = m.name === "pole" || m.name === "arm" || m.name.endsWith("_body");
      expect(m.castShadow, m.name).toBe(expected);
    });
  });
});

describe("node names", () => {
  it("match the optimized model", async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const file = resolve(__dirname, "../../../../../public/assets/3d/optimized/props/traffic-signal.optimized.glb");
    const doc = await io.readBinary(new Uint8Array(readFileSync(file)));
    const names = new Set(doc.getRoot().listNodes().map((n) => n.getName()));
    const want: string[] = [SIGNAL_NODES.pole, SIGNAL_NODES.arm];
    for (const head of [SIGNAL_NODES.headLow, SIGNAL_NODES.headA, SIGNAL_NODES.headB]) {
      want.push(head, `${head}_${HEAD_PARTS.body}`, `${head}_${HEAD_PARTS.red}`, `${head}_${HEAD_PARTS.amber}`, `${head}_${HEAD_PARTS.green}`);
    }
    want.push(`head_a_${HEAD_PARTS.countdown}`, `head_b_${HEAD_PARTS.countdown}`);
    for (const n of want) expect(names.has(n), n).toBe(true);
  });
});

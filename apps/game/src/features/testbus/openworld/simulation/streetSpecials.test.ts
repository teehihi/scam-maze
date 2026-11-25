import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { Matrix4, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { GRAB_CRUISE_SPEED, GRAB_FAST_SPEED, pickGrabClip } from "./grabDriver";
import {
  LONG_Q9_CHEER_SECONDS,
  LONG_Q9_CLIPS,
  LONG_Q9_FILE,
  LONG_Q9_WALK_SPEED,
  LONG_Q9_WORK_SECONDS,
  WAVE_LONGQ9_FILE,
  createLongQ9State,
  stepLongQ9,
  type LongQ9Clip,
  type LongQ9Spot,
} from "./longQ9";

const spots: LongQ9Spot[] = [
  { x: 0, z: 0, yaw: Math.PI, task: "Crouch_Repair" },
  { x: 6, z: 0, yaw: Math.PI, task: "Kneel_Pump" },
];

describe("pickGrabClip", () => {
  it("idles when stopped and plays the clip at the no-slip rate", () => {
    expect(pickGrabClip(0).clip).toBe("Idle_TrafficLight");
    const cruise = pickGrabClip(GRAB_CRUISE_SPEED);
    expect(cruise).toEqual({ clip: "Drive_Cruise", timeScale: 1 });
    const fast = pickGrabClip(GRAB_FAST_SPEED);
    expect(fast).toEqual({ clip: "Drive_Fast", timeScale: 1 });
  });
  it("uses the turn clip while steering at moderate speed", () => {
    expect(pickGrabClip(3, 0.3).clip).toBe("Drive_Turn");
  });
});

/** Steps in 0.05 s frames, like the render loop, until the phase is `phase`. */
function runUntil(state: ReturnType<typeof createLongQ9State>, phase: string) {
  let frame = stepLongQ9(state, 0.05, spots);
  for (let i = 0; i < 4000 && state.phase !== phase; i++) frame = stepLongQ9(state, 0.05, spots);
  return frame;
}

describe("Long Q9 routine", () => {
  it("works at the first bike with its task clip, cheers, walks to the next bike and works there", () => {
    const state = createLongQ9State(spots);
    let frame = stepLongQ9(state, 2, spots);
    expect(frame.clip).toBe("Crouch_Repair");
    expect(frame.x).toBe(0);
    frame = runUntil(state, "cheer");
    expect(state.t).toBeLessThan(LONG_Q9_CHEER_SECONDS);
    expect(frame.clip).toBe("Wave_Hand");
    frame = runUntil(state, "walk");
    expect(state.spot).toBe(1);
    frame = stepLongQ9(state, 0.1, spots);
    expect(frame.clip).toBe("Walk");
    const walkSeconds = 6 / LONG_Q9_WALK_SPEED;
    for (let t = 0; t < walkSeconds + 1; t += 0.1) frame = stepLongQ9(state, 0.1, spots);
    expect(state.phase).toBe("work");
    expect(frame.clip).toBe("Kneel_Pump");
    expect(frame.x).toBeCloseTo(6, 5);
  });
  it("stands still while working and cheering, and walks toward the target", () => {
    const state = createLongQ9State(spots);
    runUntil(state, "cheer");
    expect(stepLongQ9(state, 0.5, spots).x).toBe(0);
    runUntil(state, "walk");
    const frame = stepLongQ9(state, 0.5, spots);
    expect(frame.yaw).toBeCloseTo(Math.PI / 2, 5);
    expect(frame.x).toBeGreaterThan(0);
  });
  it("works for the full work time before cheering", () => {
    const state = createLongQ9State(spots);
    stepLongQ9(state, LONG_Q9_WORK_SECONDS - 0.5, spots);
    expect(state.phase).toBe("work");
    stepLongQ9(state, 0.6, spots);
    expect(state.phase).toBe("cheer");
  });
});

/** Loop length of every clip in seconds, as chosen by build-longq9.cjs. */
const LOOP_SECONDS: Record<LongQ9Clip, number> = {
  Walk: 5.5,
  Ride: 8.375,
  Greet_Seated: 8.9583,
  Crouch_Repair: 9.25,
  Wave_Hand: 7.9167,
  Kneel_Pump: 6,
};
const MODELS = resolve(__dirname, "../../../../../public/assets/testbus/ow/models");

async function readModel(file: string) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(readFileSync(resolve(MODELS, file))));
  await doc.transform(dequantize()); // positions are stored as quantized integers
  return doc;
}

describe("longq9.optimized.glb", () => {
  it("is one rig of 17 bones, 1.70 m tall, with exactly the clips the routine plays", async () => {
    const doc = await readModel(LONG_Q9_FILE);
    const root = doc.getRoot();
    expect(root.listSkins()).toHaveLength(1);
    expect(root.listSkins()[0].listJoints()).toHaveLength(17);
    expect(root.listAnimations().map((a) => a.getName()).sort()).toEqual([...LONG_Q9_CLIPS].sort());
    // Quantization folds the mesh scale into the inverse bind matrices: inverse(IBM) scales by 1 / halfHeight, and the
    // normalized y range of the mesh spans the full height.
    const ibm = root.listSkins()[0].getInverseBindMatrices()!.getArray()!;
    const k = new Vector3().setFromMatrixScale(new Matrix4().fromArray(ibm, 0).invert()).y;
    const pos = root.listMeshes()[0].listPrimitives()[0].getAttribute("POSITION")!;
    const height = (pos.getMax([0, 0, 0])[1] - pos.getMin([0, 0, 0])[1]) / k;
    expect(height).toBeGreaterThan(1.69);
    expect(height).toBeLessThan(1.72);
  });

  it("drives the pelvis and both thighs in every clip, loops at its set length and ends on its first pose", async () => {
    const doc = await readModel(LONG_Q9_FILE);
    for (const anim of doc.getRoot().listAnimations()) {
      const name = anim.getName() as LongQ9Clip;
      const driven = (joint: string, path: string) => anim.listChannels().some((c) => c.getTargetNode()?.getName() === joint && c.getTargetPath() === path);
      expect(driven("Pelvis", "translation"), `${name} pelvis translation`).toBe(true);
      expect(driven("Pelvis", "rotation"), `${name} pelvis rotation`).toBe(true);
      expect(driven("Thigh_L", "rotation"), `${name} left thigh`).toBe(true);
      expect(driven("Thigh_R", "rotation"), `${name} right thigh`).toBe(true);
      for (const ch of anim.listChannels()) {
        const sampler = ch.getSampler()!;
        const times = sampler.getInput()!;
        expect(times.getElement(times.getCount() - 1, [0])[0]).toBeCloseTo(LOOP_SECONDS[name], 2);
        const out = sampler.getOutput()!;
        const first = out.getElement(0, new Array(out.getElementSize()).fill(0));
        const last = out.getElement(out.getCount() - 1, new Array(out.getElementSize()).fill(0));
        // Quaternions are compared up to sign.
        const sign = ch.getTargetPath() === "rotation" && first.reduce((s, v, i) => s + v * last[i], 0) < 0 ? -1 : 1;
        first.forEach((v, i) => expect(Math.abs(v - sign * last[i]), `${name} ${ch.getTargetNode()?.getName()}`).toBeLessThan(2e-3));
      }
    }
  });
});

describe("wave-longq9.optimized.glb", () => {
  const SOURCE_TRIANGLES = 56996;

  async function load() {
    const doc = await readModel(WAVE_LONGQ9_FILE);
    const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
    return { doc, nodes };
  }

  it("has the documented hierarchy and anchors", async () => {
    const { nodes } = await load();
    for (const name of [
      "Wave_Root", "Wave_Chassis", "Wave_Steering", "Wave_FrontWheel", "Wave_RearWheel", "Wave_Kickstand",
      "Wave_HeadLamp", "Wave_TailLamp", "Wave_SignalFL", "Wave_SignalFR", "Wave_SignalRL", "Wave_SignalRR", "Wave_Rider",
    ]) {
      expect(nodes.has(name), name).toBe(true);
    }
    const parent = (n: string) => nodes.get(n)!.getParentNode()?.getName();
    expect(parent("Wave_FrontWheel")).toBe("Wave_Steering");
    expect(parent("Wave_HeadLamp")).toBe("Wave_Steering");
    expect(parent("Wave_RearWheel")).toBe("Wave_Root");
    expect(parent("Wave_Kickstand")).toBe("Wave_Root");
    const kick = nodes.get("Wave_Kickstand")!.getExtras() as { foldedDeg: number; deployedDeg: number };
    expect(kick.foldedDeg).toBeGreaterThan(kick.deployedDeg);
    expect(nodes.get("Wave_Rider")!.getTranslation()[2]).toBeCloseTo(-0.16, 2);
  });

  it("puts the wheels on their hubs, faces +Z and keeps every triangle", async () => {
    const { doc, nodes } = await load();
    const rear = nodes.get("Wave_RearWheel")!.getTranslation();
    expect(rear[1]).toBeCloseTo(0.262, 2);
    expect(rear[2]).toBeCloseTo(-0.5877, 2);
    const front = nodes.get("Wave_FrontWheel")!;
    const steering = nodes.get("Wave_Steering")!;
    // The front hub in the bike frame is the steering origin plus the rotated local offset.
    const hub = new Vector3(...front.getTranslation()).applyQuaternion(new Quaternion(...steering.getRotation())).add(new Vector3(...steering.getTranslation()));
    expect(hub.x).toBeCloseTo(0, 2);
    expect(hub.y).toBeCloseTo(0.2732, 1);
    expect(hub.z).toBeCloseTo(0.6087, 2);

    let triangles = 0;
    for (const mesh of doc.getRoot().listMeshes()) {
      if (mesh.getName() === "Wave_KickstandRod") continue;
      for (const prim of mesh.listPrimitives()) triangles += prim.getIndices()!.getCount() / 3;
    }
    expect(triangles).toBe(SOURCE_TRIANGLES);

    // Mesh nodes carry the quantization scale and offset (uniform scale, no rotation) relative to their pivot.
    const localBounds = (pivot: string) => {
      const meshNode = nodes.get(pivot)!.listChildren()[0];
      const [sx] = meshNode.getScale();
      const t = meshNode.getTranslation();
      const pos = meshNode.getMesh()!.listPrimitives()[0].getAttribute("POSITION")!;
      const v = [0, 0, 0];
      let maxR = 0, minY = Infinity;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        maxR = Math.max(maxR, Math.hypot(v[1] * sx + t[1], v[2] * sx + t[2]));
        minY = Math.min(minY, v[1] * sx + t[1]);
      }
      return { count: pos.getCount(), maxR, minY };
    };
    const frontWheel = localBounds("Wave_FrontWheel");
    expect(frontWheel.count).toBeGreaterThan(1000);
    expect(frontWheel.maxR).toBeLessThan(0.3);
    expect(frontWheel.maxR).toBeGreaterThan(0.25);

    // The bike stands on y = 0 and faces +Z (the front hub is ahead of the rear hub).
    expect(Math.abs(rear[1] + localBounds("Wave_RearWheel").minY)).toBeLessThan(0.03);
    expect(hub.z).toBeGreaterThan(rear[2]);
  });
});

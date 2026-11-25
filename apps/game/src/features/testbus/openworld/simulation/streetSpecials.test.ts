import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { describe, expect, it } from "vitest";
import { GRAB_CRUISE_SPEED, GRAB_FAST_SPEED, pickGrabClip } from "./grabDriver";
import {
  LONG_Q9_CHEER_SECONDS,
  LONG_Q9_FILE,
  LONG_Q9_WALK_SPEED,
  LONG_Q9_WORK_SECONDS,
  createLongQ9State,
  stepLongQ9,
  type LongQ9Clip,
  type LongQ9Spot,
} from "./longQ9";

const spots: LongQ9Spot[] = [
  { x: 0, z: 0, yaw: Math.PI, task: "Crouch_Tire" },
  { x: 6, z: 0, yaw: Math.PI, task: "Sit_Wrench" },
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
    expect(frame.clip).toBe("Crouch_Tire");
    expect(frame.x).toBe(0);
    frame = runUntil(state, "cheer");
    expect(state.t).toBeLessThan(LONG_Q9_CHEER_SECONDS);
    expect(frame.clip).toBe("Thumbs_Up");
    frame = runUntil(state, "walk");
    expect(state.spot).toBe(1);
    frame = stepLongQ9(state, 0.1, spots);
    expect(frame.clip).toBe("Walk");
    const walkSeconds = 6 / LONG_Q9_WALK_SPEED;
    for (let t = 0; t < walkSeconds + 1; t += 0.1) frame = stepLongQ9(state, 0.1, spots);
    expect(state.phase).toBe("work");
    expect(frame.clip).toBe("Sit_Wrench");
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

describe("longq9.optimized.glb", () => {
  it("is one rig of 17 bones with the clips the routine plays, all looping to their first pose", async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
    const doc = await io.readBinary(new Uint8Array(readFileSync(resolve(__dirname, `../../../../../public/assets/testbus/ow/models/${LONG_Q9_FILE}`))));
    const root = doc.getRoot();
    expect(root.listSkins()).toHaveLength(1);
    expect(root.listSkins()[0].listJoints()).toHaveLength(17);
    const names = root.listAnimations().map((a) => a.getName()).sort();
    const wanted: LongQ9Clip[] = ["Crouch_Tire", "Sit_Wrench", "Thumbs_Up", "Walk"];
    expect(names).toEqual(wanted);
    // Every clip the routine can ask for exists, and a pelvis rotation key at the end matches the first key (seamless loop).
    for (const anim of root.listAnimations()) {
      const ch = anim.listChannels().find((c) => c.getTargetNode()?.getName() === "Pelvis" && c.getTargetPath() === "rotation")!;
      const out = ch.getSampler()!.getOutput()!;
      const first = out.getElement(0, [0, 0, 0, 0]);
      const last = out.getElement(out.getCount() - 1, [0, 0, 0, 0]);
      const dot = Math.abs(first.reduce((s, v, i) => s + v * last[i], 0));
      expect(dot).toBeGreaterThan(0.999);
    }
  });
});

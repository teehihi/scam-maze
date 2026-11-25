import { describe, expect, it } from "vitest";
import { GRAB_CRUISE_SPEED, GRAB_FAST_SPEED, pickGrabClip } from "./grabDriver";
import {
  LONG_Q9_WALK_SPEED,
  LONG_Q9_WORK_SECONDS,
  createLongQ9State,
  stepLongQ9,
  type LongQ9Spot,
} from "./longQ9";

const spots: LongQ9Spot[] = [
  { x: 0, z: 0, yaw: Math.PI },
  { x: 6, z: 0, yaw: Math.PI },
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

/** Steps in 0.05 s frames, like the render loop, until the phase changes. */
function runUntilWalk(state: ReturnType<typeof createLongQ9State>) {
  let pose = stepLongQ9(state, 0.05, spots);
  for (let i = 0; i < 2000 && state.phase === "work"; i++) pose = stepLongQ9(state, 0.05, spots);
  return pose;
}

describe("Long Q9 work loop", () => {
  it("leans over the bike while working, then walks to the next spot and works there", () => {
    const state = createLongQ9State(spots);
    let pose = stepLongQ9(state, 2, spots);
    expect(pose.lean).toBeGreaterThan(0.2);
    expect(pose.x).toBe(0);
    pose = runUntilWalk(state);
    expect(state.t).toBeLessThan(LONG_Q9_WORK_SECONDS);
    expect(state.phase).toBe("walk");
    pose = stepLongQ9(state, 0.1, spots);
    expect(pose.bob).toBeGreaterThan(0);
    const walkSeconds = 6 / LONG_Q9_WALK_SPEED;
    for (let t = 0; t < walkSeconds + 1; t += 0.1) pose = stepLongQ9(state, 0.1, spots);
    expect(state.phase).toBe("work");
    expect(state.spot).toBe(1);
    expect(pose.x).toBeCloseTo(6, 5);
  });
  it("heads toward the target while walking", () => {
    const state = createLongQ9State(spots);
    runUntilWalk(state);
    const pose = stepLongQ9(state, 0.5, spots);
    expect(pose.yaw).toBeCloseTo(Math.PI / 2, 5);
    expect(pose.x).toBeGreaterThan(0);
  });
});

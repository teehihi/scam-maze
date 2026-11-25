// The street driver who notices Alex and walks up to him, then back to his spot.
import { describe, expect, it } from "vitest";
import { conversationSpot, initialApproachState, stepApproach, type ApproachConfig, type ApproachInput, type ApproachState } from "./approachBehavior";

const CONFIG: ApproachConfig = {
  homeX: 3.25,
  homeZ: 7.6,
  homeYaw: -2.35,
  noticeRadius: 9,
  stopDistance: 1.75,
  leash: 7,
  walkSpeed: 1.35,
  turnSeconds: 0.9,
  giveUpRadius: 16,
  cooldownSeconds: 35,
  farewellSeconds: 1.4,
  minX: 0.6,
  maxX: 6.2,
};
const DT = 1 / 60;

/** Runs the behavior for `seconds`; `input` may change over time. Returns every frame's state and speed. */
function run(state: ApproachState, seconds: number, input: (t: number) => Partial<ApproachInput>, start = 0) {
  let s = state;
  const frames: { state: ApproachState; speed: number }[] = [];
  for (let t = 0; t < seconds; t += DT) {
    const out = stepApproach(s, CONFIG, { dt: DT, time: start + t, playerX: 3.4, playerZ: 1, playerAvailable: true, conversing: false, ...input(t) });
    s = out.state;
    frames.push({ state: s, speed: out.speed });
  }
  return { state: s, frames };
}
const dist = (s: ApproachState, x: number, z: number) => Math.hypot(s.x - x, s.z - z);

describe("street driver approach", () => {
  it("stays at his spot while Alex is far away", () => {
    const { state } = run(initialApproachState(CONFIG), 5, () => ({ playerX: 3.4, playerZ: -20 }));
    expect(state.phase).toBe("home");
    expect(dist(state, CONFIG.homeX, CONFIG.homeZ)).toBe(0);
  });

  it("notices Alex, turns first, then walks up and stops at conversation distance without touching him", () => {
    const { state, frames } = run(initialApproachState(CONFIG), 10, () => ({}));
    expect(frames[1].state.phase).toBe("noticed");
    // No step during the turn-and-call-out beat.
    const turning = frames.filter((f) => f.state.phase === "noticed");
    expect(turning.every((f) => f.speed === 0)).toBe(true);
    expect(state.phase).toBe("engaged");
    const d = dist(state, 3.4, 1);
    expect(d).toBeGreaterThan(CONFIG.stopDistance - 0.05);
    expect(d).toBeLessThan(CONFIG.stopDistance + 0.1);
    // He walks at the walk clip's speed (no faster: the feet would slide), and never closer than the stop distance.
    for (const f of frames) {
      expect(f.speed).toBeLessThanOrEqual(CONFIG.walkSpeed + 1e-6);
      expect(dist(f.state, 3.4, 1)).toBeGreaterThan(CONFIG.stopDistance - 0.05);
    }
    // He faces Alex once he is there (heading from him to Alex).
    const facing = Math.atan2(3.4 - state.x, 1 - state.z);
    expect(Math.abs(Math.atan2(Math.sin(state.yaw - facing), Math.cos(state.yaw - facing)))).toBeLessThan(0.1);
  });

  it("keeps to the sidewalk band and to his leash", () => {
    // Alex stands in the road, far from the spot: the driver stops at the leash, on the sidewalk.
    const { frames } = run(initialApproachState(CONFIG), 12, () => ({ playerX: -3, playerZ: 2 }));
    for (const f of frames) {
      expect(f.state.x).toBeGreaterThanOrEqual(CONFIG.minX - 1e-9);
      expect(f.state.x).toBeLessThanOrEqual(CONFIG.maxX + 1e-9);
      expect(dist(f.state, CONFIG.homeX, CONFIG.homeZ)).toBeLessThanOrEqual(CONFIG.leash + 1e-6);
    }
    const spot = conversationSpot(CONFIG, { x: CONFIG.homeX, z: CONFIG.homeZ }, -3, 2);
    expect(spot.x).toBe(CONFIG.minX);
  });

  it("walks back after the talk, after a short goodbye beat, and does not approach again at once", () => {
    let { state } = run(initialApproachState(CONFIG), 10, () => ({}));
    ({ state } = run(state, 3, () => ({ conversing: true }), 10));
    expect(state.phase).toBe("engaged");
    const after = run(state, 1.0, () => ({}), 13);
    expect(after.state.phase).toBe("engaged");
    const back = run(after.state, 12, () => ({}), 14);
    expect(back.frames.some((f) => f.state.phase === "returning" && f.speed > 0)).toBe(true);
    expect(back.state.phase).toBe("home");
    expect(dist(back.state, CONFIG.homeX, CONFIG.homeZ)).toBe(0);
    // Alex is still near: no second approach during the cooldown.
    const later = run(back.state, 10, () => ({}), 26);
    expect(later.state.phase).toBe("home");
  });

  it("gives up and walks back when Alex walks away or boards the bus, never freezing mid-walk", () => {
    const mid = run(initialApproachState(CONFIG), 2.2, () => ({})).state;
    expect(mid.phase).toBe("approaching");
    const away = run(mid, 15, () => ({ playerAvailable: false }), 3);
    expect(away.state.phase).toBe("home");
    const walkedOff = run(mid, 15, () => ({ playerX: 3.4, playerZ: -30 }), 3);
    expect(walkedOff.state.phase).toBe("home");
  });

  it("can be talked to at his spot before he moves", () => {
    const { state } = run(initialApproachState(CONFIG), 0.5, () => ({ playerX: 3.4, playerZ: 6, conversing: true }));
    expect(state.phase).toBe("engaged");
    expect(dist(state, CONFIG.homeX, CONFIG.homeZ)).toBe(0);
  });
});

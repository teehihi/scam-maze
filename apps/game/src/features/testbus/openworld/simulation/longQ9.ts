/**
 * Long Q9, the one-of-a-kind street mechanic of the Saigon open world.
 *
 * The model (`longq9.optimized.glb`) is rigged with the author's 17-bone skeleton and carries the clips of LONG_Q9_CLIPS, built
 * by `apps/game/scripts/longq9/build-longq9.cjs` from the author's animated export. This module is the routine that
 * picks the clip: he works at one bike (crouching at its tire, or kneeling at a pump), waves when the
 * job is done, walks to the next bike and repeats. The caller moves the root and plays the clip; the clips carry no
 * root motion. He is spawned exactly once per world (a guard in `saigonDistricts.ts`) and his file is in no shared
 * model list.
 */

export const LONG_Q9_FILE = "longq9.optimized.glb";
/** The yellow Honda Wave he rides (`apps/game/scripts/longq9/build-wave.cjs`), in the same model folder. */
export const WAVE_LONGQ9_FILE = "wave-longq9.optimized.glb";
/** Height of the rigged model at rest in metres (the T-pose is 1.704 m tall). */
export const LONG_Q9_RIG_HEIGHT = 1.704;
/** Height he is shown at in the street. */
export const LONG_Q9_HEIGHT = 1.66;

/** Every clip baked into the file, in the order the build writes them. */
export const LONG_Q9_CLIPS = ["Walk", "Ride", "Greet_Seated", "Crouch_Repair", "Wave_Hand", "Kneel_Pump"] as const;
export type LongQ9Clip = (typeof LONG_Q9_CLIPS)[number];

export interface LongQ9Spot {
  /** Where he stands next to the bike. */
  x: number;
  z: number;
  /** Heading (rotation.y, +Z forward) while working: faces the bike. */
  yaw: number;
  /** The work clip played at this bike. */
  task: "Crouch_Repair" | "Kneel_Pump";
}

export type LongQ9Phase = "work" | "cheer" | "walk";

export interface LongQ9State {
  spot: number;
  phase: LongQ9Phase;
  /** Seconds spent in the current phase. */
  t: number;
  x: number;
  z: number;
  yaw: number;
}

export interface LongQ9Frame {
  x: number;
  z: number;
  yaw: number;
  clip: LongQ9Clip;
}

export const LONG_Q9_WORK_SECONDS = 14;
export const LONG_Q9_CHEER_SECONDS = 3.5;
/**
 * Ground speed (m/s) of his stroll. The clip plays at its own rate; the pace is tuned by eye.
 */
export const LONG_Q9_WALK_SPEED = 1.0;

export function createLongQ9State(spots: readonly LongQ9Spot[]): LongQ9State {
  const s = spots[0];
  return { spot: 0, phase: "work", t: 0, x: s.x, z: s.z, yaw: s.yaw };
}

/** Advances the work, cheer and walk loop by `dt` seconds and returns where he is and which clip plays. */
export function stepLongQ9(state: LongQ9State, dt: number, spots: readonly LongQ9Spot[]): LongQ9Frame {
  state.t += dt;
  const here = spots[state.spot];
  if (state.phase === "work") {
    if (state.t >= LONG_Q9_WORK_SECONDS) {
      state.phase = "cheer";
      state.t = 0;
    } else {
      state.x = here.x;
      state.z = here.z;
      state.yaw = here.yaw;
      return { x: state.x, z: state.z, yaw: state.yaw, clip: here.task };
    }
  }
  if (state.phase === "cheer") {
    if (state.t >= LONG_Q9_CHEER_SECONDS) {
      if (spots.length > 1) {
        state.spot = (state.spot + 1) % spots.length;
        state.phase = "walk";
      } else {
        state.phase = "work";
      }
      state.t = 0;
    } else {
      return { x: state.x, z: state.z, yaw: state.yaw, clip: "Wave_Hand" };
    }
  }
  // Walk toward the next spot.
  const target = spots[state.spot];
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const dist = Math.hypot(dx, dz);
  const step = LONG_Q9_WALK_SPEED * dt;
  if (dist <= step) {
    state.x = target.x;
    state.z = target.z;
    state.yaw = target.yaw;
    state.phase = "work";
    state.t = 0;
    return { x: state.x, z: state.z, yaw: state.yaw, clip: target.task };
  }
  state.x += (dx / dist) * step;
  state.z += (dz / dist) * step;
  state.yaw = Math.atan2(dx, dz);
  return { x: state.x, z: state.z, yaw: state.yaw, clip: "Walk" };
}

/**
 * Long Q9, the one-of-a-kind street mechanic of the Saigon open world.
 *
 * The model (`longq9.optimized.glb`) is a posed scan with no skeleton and no clips, so his work is animated on the
 * whole body: he leans over a customer's motorbike, jiggles as he turns the wrench, then walks to the next bike.
 * He is spawned exactly once per world (a guard in `saigonDistricts.ts`) and his file is in no shared model list.
 */

export const LONG_Q9_FILE = "longq9.optimized.glb";
/** Real height of the scan in metres (bounding box y 0.057 .. 1.714 m). */
export const LONG_Q9_HEIGHT = 1.66;

export interface LongQ9Spot {
  /** Where he stands next to the bike. */
  x: number;
  z: number;
  /** Heading (rotation.y, +Z forward) while working: faces the bike. */
  yaw: number;
}

export interface LongQ9State {
  spot: number;
  phase: "work" | "walk";
  /** Seconds spent in the current phase. */
  t: number;
  x: number;
  z: number;
  yaw: number;
}

export interface LongQ9Pose {
  x: number;
  z: number;
  yaw: number;
  /** Forward lean about the feet (radians, positive leans toward +Z). */
  lean: number;
  /** Sideways sway (radians). */
  sway: number;
  /** Vertical bob in metres. */
  bob: number;
}

export const LONG_Q9_WORK_SECONDS = 12;
export const LONG_Q9_WALK_SPEED = 0.95;
const WORK_LEAN = 0.34;

export function createLongQ9State(spots: readonly LongQ9Spot[]): LongQ9State {
  const s = spots[0];
  return { spot: 0, phase: "work", t: 0, x: s.x, z: s.z, yaw: s.yaw };
}

/** Advances the work/walk loop by `dt` seconds and returns the body pose for this frame. */
export function stepLongQ9(state: LongQ9State, dt: number, spots: readonly LongQ9Spot[]): LongQ9Pose {
  state.t += dt;
  const here = spots[state.spot];
  if (state.phase === "work") {
    if (state.t >= LONG_Q9_WORK_SECONDS && spots.length > 1) {
      state.spot = (state.spot + 1) % spots.length;
      state.phase = "walk";
      state.t = 0;
    } else {
      state.x = here.x;
      state.z = here.z;
      state.yaw = here.yaw;
      // Eases into the lean over the first second, then works the wrench with a small quick jiggle.
      const ease = Math.min(1, state.t / 1);
      const jiggle = Math.sin(state.t * 13) * 0.025 + Math.sin(state.t * 2.1) * 0.03;
      return {
        x: state.x,
        z: state.z,
        yaw: state.yaw,
        lean: WORK_LEAN * ease + jiggle * ease,
        sway: Math.sin(state.t * 5.3) * 0.02 * ease,
        bob: 0,
      };
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
    return { x: state.x, z: state.z, yaw: state.yaw, lean: 0, sway: 0, bob: 0 };
  }
  state.x += (dx / dist) * step;
  state.z += (dz / dist) * step;
  state.yaw = Math.atan2(dx, dz);
  return {
    x: state.x,
    z: state.z,
    yaw: state.yaw,
    lean: 0.05,
    sway: Math.sin(state.t * 6.2) * 0.045,
    bob: Math.abs(Math.sin(state.t * 6.2)) * 0.035,
  };
}

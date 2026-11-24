/**
 * Drives the typing clip from keystrokes. Each keystroke moves the clip forward by `KEY_STEP_S`;
 * the clip time follows that target at no more than `MAX_SPEED` times real time, so a burst of keys
 * plays quickly and smoothly, and with no keys the hands hold their last pose. Pure and
 * deterministic: it takes the frame time, never reads a clock.
 */
export const KEY_STEP_S = 0.16;
export const MAX_SPEED = 3;
/** The target never runs further than this ahead of the clip time, so a long burst cannot queue seconds of motion. */
export const MAX_LEAD_S = 1.2;

export interface TypingClock {
  /** Clip time that has been played (seconds, grows without bound; the player wraps it). */
  time: number;
  /** Clip time the keystrokes asked for. */
  target: number;
}

export function createTypingClock(): TypingClock {
  return { time: 0, target: 0 };
}

/** Registers `count` keystrokes. */
export function typingKey(clock: TypingClock, count = 1): TypingClock {
  const keys = Number.isFinite(count) && count > 0 ? count : 0;
  return { time: clock.time, target: Math.min(clock.time + MAX_LEAD_S, clock.target + keys * KEY_STEP_S) };
}

/** Moves the clip time toward the target over `dt` seconds. */
export function stepTypingClock(clock: TypingClock, dt: number): TypingClock {
  if (!(dt > 0)) return clock;
  const gap = clock.target - clock.time;
  if (gap <= 0) return clock;
  const move = Math.min(gap, MAX_SPEED * dt);
  return { time: clock.time + move, target: clock.target };
}

/** True while the clip still has motion to play. */
export function isTypingMoving(clock: TypingClock): boolean {
  return clock.target - clock.time > 1e-6;
}

/** The time inside a loop of `duration` seconds. */
export function wrapTypingTime(time: number, duration: number): number {
  return duration > 0 ? ((time % duration) + duration) % duration : 0;
}

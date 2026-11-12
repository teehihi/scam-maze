import { useEffect, useRef, useState } from "react";

/**
 * Call duration for the phone screen. Presentation only: it reads a clock,
 * never touches the chapter store or saves, and never feeds game state.
 */

export type DurationClock = () => number;

const TICK_MS = 250;

const defaultClock: DurationClock = () => performance.now();

/** Whole seconds for an unpaused elapsed time in milliseconds. */
export function wholeSeconds(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / 1000);
}

/**
 * Whole seconds since the call became active.
 *
 * - `active`: true while the call status is `active`.
 * - `paused`: true while the chapter is paused; the value is frozen.
 * - `callKey`: identifies the call; a new key (or `active` turning false)
 *   resets the duration to 0.
 * - `clock`: injectable presentation clock, `performance.now()` by default.
 */
export function useCallDuration(
  active: boolean,
  paused: boolean,
  callKey: string | null = null,
  clock: DurationClock = defaultClock,
): number {
  const [seconds, setSeconds] = useState(0);
  const accumulatedMs = useRef(0);
  const clockRef = useRef(clock);
  clockRef.current = clock;

  // Reset per call. Cleanups of the running effect below run first, so the
  // accumulated time of the previous call is zeroed here.
  useEffect(() => {
    accumulatedMs.current = 0;
    setSeconds(0);
  }, [callKey, active]);

  const running = active && !paused;
  useEffect(() => {
    if (!running) return undefined;
    const now = clockRef.current;
    const segmentStart = now();
    const update = () => {
      const next = wholeSeconds(accumulatedMs.current + (now() - segmentStart));
      setSeconds((previous) => (next > previous ? next : previous));
    };
    const timer = setInterval(update, TICK_MS);
    return () => {
      clearInterval(timer);
      update();
      accumulatedMs.current += Math.max(0, now() - segmentStart);
    };
  }, [running, callKey]);

  return active ? seconds : 0;
}

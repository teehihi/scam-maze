// Feature: chapter-01-voice-narrative, Property 21: The call duration is whole seconds and presentation only
//
// **Validates: Requirements 7.5**
//
// For any sequence of clock readings while a call is active (with pauses), the displayed duration
// equals the floor of the unpaused elapsed seconds, never decreases within one call, resets for a
// new call, and the chapter state and the saved progress are unchanged by it.
//
// The hook is driven through renderHook with an injected clock. The clock and the fake timers
// advance together. While running, the value may lag the exact value by less than one 250 ms tick;
// every pause, new call and end of call flushes it, so the end of each case is checked exactly.
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { createChapterStore } from "../../../game/narrative/store";
import { createInitialState } from "../../../game/narrative/reducer";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { useCallDuration } from "./useCallDuration";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const SEED = (CORE_PROPERTY_SEED ^ 0x0021_0021) >>> 0;
const MAX_OPS = 30;
const TICK_MS = 250;

type Op =
  | { kind: "advance"; ms: number }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "newCall" }
  | { kind: "endCall" }
  | { kind: "startCall" };

function generateOps(next: () => number): Op[] {
  const length = randomInt(next, 1, MAX_OPS);
  const ops: Op[] = [];
  for (let i = 0; i < length; i += 1) {
    const roll = next();
    if (roll < 0.5) {
      // Mix of small steps (inside one tick) and large steps (many seconds).
      const ms = pick(next, [randomInt(next, 0, 249), randomInt(next, 250, 1999), randomInt(next, 2000, 9000)]);
      ops.push({ kind: "advance", ms });
    } else if (roll < 0.65) ops.push({ kind: "pause" });
    else if (roll < 0.8) ops.push({ kind: "resume" });
    else if (roll < 0.88) ops.push({ kind: "newCall" });
    else if (roll < 0.94) ops.push({ kind: "endCall" });
    else ops.push({ kind: "startCall" });
  }
  return ops;
}

function format(seed: number, index: number, ops: readonly Op[], upTo: number): string {
  return `seed=${seed} case=${index} prefix=${JSON.stringify(ops.slice(0, upTo + 1))}`;
}

describe("useCallDuration properties", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "shows whole unpaused seconds, never decreases within a call, resets per call and touches no state",
    () => {
      const next = createLcg(SEED);
      const store = createChapterStore(createInitialState(), CHAPTER_1_SCENARIO);
      const stateBefore = JSON.stringify(store.getState());
      const storageBefore = JSON.stringify({ ...window.localStorage });
      let resets = 0;
      let pauses = 0;
      let longRuns = 0;

      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const ops = generateOps(next);
        let clockNow = randomInt(next, 0, 1_000_000);
        const clock = () => clockNow;
        const startsPaused = next() < 0.2;

        let active = true;
        let paused = startsPaused;
        let callKey = "call-0";
        let callCounter = 0;
        let accMs = 0;
        let previous = 0;

        const { result, rerender, unmount } = renderHook(
          (props: { active: boolean; paused: boolean; callKey: string }) =>
            useCallDuration(props.active, props.paused, props.callKey, clock),
          { initialProps: { active, paused, callKey } },
        );
        expect(result.current, format(SEED, index, ops, -1)).toBe(0);

        const apply = () => act(() => rerender({ active, paused, callKey }));

        for (let step = 0; step < ops.length; step += 1) {
          const op = ops[step];
          const label = format(SEED, index, ops, step);
          let reset = false;
          let flushed = false;

          switch (op.kind) {
            case "advance": {
              const running = active && !paused;
              clockNow += op.ms;
              act(() => {
                vi.advanceTimersByTime(op.ms);
              });
              if (running) accMs += op.ms;
              break;
            }
            case "pause":
              if (!paused) pauses += 1;
              paused = true;
              apply();
              flushed = true;
              break;
            case "resume":
              paused = false;
              apply();
              break;
            case "newCall":
              callCounter += 1;
              callKey = `call-${callCounter}`;
              accMs = 0;
              reset = true;
              apply();
              break;
            case "endCall":
              active = false;
              accMs = 0;
              reset = true;
              apply();
              break;
            case "startCall":
              if (!active) {
                active = true;
                callCounter += 1;
                callKey = `call-${callCounter}`;
                accMs = 0;
                reset = true;
                apply();
              }
              break;
          }

          const value = result.current;
          const exactSeconds = Math.floor(accMs / 1000);
          expect(Number.isInteger(value), `${label} value=${value}`).toBe(true);
          expect(value, label).toBeGreaterThanOrEqual(0);
          if (!active) {
            expect(value, `${label} inactive`).toBe(0);
          } else {
            // Never ahead of the exact unpaused seconds, and behind by less than one tick.
            expect(value, `${label} ahead of exact ${exactSeconds}`).toBeLessThanOrEqual(exactSeconds);
            const lowerBound = Math.floor(Math.max(0, accMs - TICK_MS) / 1000);
            expect(value, `${label} behind lower bound ${lowerBound}`).toBeGreaterThanOrEqual(lowerBound);
            if (paused || flushed || reset) {
              expect(value, `${label} frozen/flushed expected ${exactSeconds}`).toBe(exactSeconds);
            }
          }
          if (reset) {
            resets += 1;
            expect(value, `${label} reset`).toBe(0);
            previous = 0;
          } else {
            expect(value, `${label} decreased from ${previous}`).toBeGreaterThanOrEqual(previous);
            previous = value;
          }
        }

        // Final exact check: pausing flushes the pending tick, so the value is exact.
        if (active) {
          paused = true;
          apply();
          const label = format(SEED, index, ops, ops.length - 1);
          expect(result.current, `${label} final`).toBe(Math.floor(accMs / 1000));
          if (accMs >= 1000) longRuns += 1;
          // A frozen value stays frozen while the clock keeps moving.
          clockNow += 5000;
          act(() => {
            vi.advanceTimersByTime(5000);
          });
          expect(result.current, `${label} frozen`).toBe(Math.floor(accMs / 1000));
        }
        unmount();
      }

      // Presentation only: neither the chapter state nor the saved progress changed.
      expect(JSON.stringify(store.getState())).toBe(stateBefore);
      expect(JSON.stringify({ ...window.localStorage })).toBe(storageBefore);
      // The generated cases exercised resets, pauses and multi-second calls.
      expect(resets).toBeGreaterThan(0);
      expect(pauses).toBeGreaterThan(0);
      expect(longRuns).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

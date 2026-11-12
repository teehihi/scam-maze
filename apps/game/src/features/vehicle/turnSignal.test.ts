import { describe, expect, it } from "vitest";
import {
  DEFAULT_TURN_SIGNAL_CONFIG,
  INITIAL_TURN_SIGNAL,
  stepTurnSignal,
  type SteerDirection,
  type TurnSignalState,
} from "./turnSignal";

const DT = 1 / 60;

/** Runs the signal for `seconds` with a constant steering input. */
function run(state: TurnSignalState, steer: SteerDirection, seconds: number): TurnSignalState {
  let s = state;
  for (let t = 0; t < seconds - 1e-9; t += DT) s = stepTurnSignal(s, steer, DT);
  return s;
}

describe("turn signal", () => {
  const { armDelay, offDelay } = DEFAULT_TURN_SIGNAL_CONFIG;

  it("stays off for a short tap", () => {
    const s = run(INITIAL_TURN_SIGNAL, -1, armDelay * 0.5);
    expect(s.active).toBe(0);
    expect(run(s, 0, 3).active).toBe(0);
  });

  it("switches on after holding a steering key for the arm delay", () => {
    expect(run(INITIAL_TURN_SIGNAL, 1, armDelay + 0.05).active).toBe(1);
    expect(run(INITIAL_TURN_SIGNAL, -1, armDelay + 0.05).active).toBe(-1);
  });

  it("stays on while steering, then switches off after the off delay", () => {
    let s = run(INITIAL_TURN_SIGNAL, -1, 2);
    expect(s.active).toBe(-1);
    s = run(s, 0, offDelay - 0.1);
    expect(s.active).toBe(-1);
    s = run(s, 0, 0.2);
    expect(s.active).toBe(0);
  });

  it("restarts the off delay when steering resumes", () => {
    let s = run(INITIAL_TURN_SIGNAL, 1, 1);
    s = run(s, 0, offDelay - 0.2);
    s = run(s, 1, 0.1);
    s = run(s, 0, offDelay - 0.2);
    expect(s.active).toBe(1);
  });

  it("moves to the other side only after holding it for the arm delay", () => {
    let s = run(INITIAL_TURN_SIGNAL, -1, 1);
    s = run(s, 1, armDelay * 0.5);
    expect(s.active).toBe(-1);
    s = run(s, 1, armDelay);
    expect(s.active).toBe(1);
  });
});

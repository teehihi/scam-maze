import { describe, expect, it } from "vitest";
import {
  KEY_STEP_S,
  MAX_LEAD_S,
  MAX_SPEED,
  createTypingClock,
  isTypingMoving,
  stepTypingClock,
  typingKey,
  wrapTypingTime,
} from "./typingClock";

describe("typingClock", () => {
  it("holds still without keystrokes", () => {
    const clock = createTypingClock();
    expect(stepTypingClock(clock, 1)).toEqual(clock);
    expect(isTypingMoving(clock)).toBe(false);
  });

  it("plays one step per keystroke, then stops", () => {
    let clock = typingKey(createTypingClock());
    expect(isTypingMoving(clock)).toBe(true);
    for (let i = 0; i < 60; i += 1) clock = stepTypingClock(clock, 1 / 60);
    expect(clock.time).toBeCloseTo(KEY_STEP_S, 6);
    expect(isTypingMoving(clock)).toBe(false);
  });

  it("never plays faster than MAX_SPEED times real time", () => {
    const clock = stepTypingClock(typingKey(createTypingClock(), 5), 0.1);
    expect(clock.time).toBeCloseTo(MAX_SPEED * 0.1, 6);
  });

  it("caps how far a burst of keys can run ahead", () => {
    const clock = typingKey(createTypingClock(), 1000);
    expect(clock.target).toBeCloseTo(MAX_LEAD_S, 6);
  });

  it("ignores bad input and does not mutate the clock", () => {
    const clock = createTypingClock();
    expect(typingKey(clock, Number.NaN).target).toBe(0);
    expect(typingKey(clock, -3).target).toBe(0);
    expect(stepTypingClock(typingKey(clock), Number.NaN).time).toBe(0);
    typingKey(clock, 2);
    expect(clock).toEqual({ time: 0, target: 0 });
  });

  it("wraps the time into the clip", () => {
    expect(wrapTypingTime(17, 16)).toBeCloseTo(1, 6);
    expect(wrapTypingTime(-1, 16)).toBeCloseTo(15, 6);
    expect(wrapTypingTime(3, 0)).toBe(0);
  });
});

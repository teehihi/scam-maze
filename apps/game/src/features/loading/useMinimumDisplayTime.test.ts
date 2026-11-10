import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldShowLoadingScreen, useMinimumDisplayTime } from "./useMinimumDisplayTime";

describe("shouldShowLoadingScreen", () => {
  const cases: Array<[done: boolean, minElapsed: boolean, bypassed: boolean, expected: boolean]> = [
    [false, false, false, true],
    [false, true, false, true],
    [true, false, false, true],
    [true, true, false, false],
    [false, false, true, false],
    [false, true, true, false],
    [true, false, true, false],
    [true, true, true, false],
  ];

  it.each(cases)("done=%s minElapsed=%s bypassed=%s -> %s", (done, minElapsed, bypassed, expected) => {
    expect(shouldShowLoadingScreen({ done, minElapsed, bypassed })).toBe(expected);
  });
});

describe("useMinimumDisplayTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false before minMs and true at minMs", () => {
    const { result } = renderHook(() => useMinimumDisplayTime(1000));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("restarts the hold when resetKey changes", () => {
    const { result, rerender } = renderHook(({ key }) => useMinimumDisplayTime(1000, key), {
      initialProps: { key: 0 },
    });

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);

    rerender({ key: 1 });
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("leaves no pending timer after unmount", () => {
    const { unmount } = renderHook(() => useMinimumDisplayTime(1000));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

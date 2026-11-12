// Unit tests for the phone screen sink (Requirements 8.5, 8.8).
import { describe, expect, it, vi } from "vitest";
import type { Rect } from "./callLayout";
import { createPhoneScreenSink } from "./phoneScreenSink";

const BASE: Rect = { left: 100, top: 50, width: 200, height: 400 };

describe("createPhoneScreenSink", () => {
  it("forwards the first rectangle and stores a copy", () => {
    const sink = createPhoneScreenSink();
    const listener = vi.fn();
    sink.subscribe(listener);

    const rect = { ...BASE };
    sink.publish(rect);
    rect.left = 999;

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(BASE);
    expect(sink.current()).toEqual(BASE);
  });

  it("ignores changes smaller than 0.25 px on every edge", () => {
    const sink = createPhoneScreenSink();
    const listener = vi.fn();
    sink.subscribe(listener);
    sink.publish(BASE);

    sink.publish({ left: 100.2, top: 49.8, width: 200, height: 400.2 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(sink.current()).toEqual(BASE);
  });

  it("forwards a change of at least 0.25 px on one edge", () => {
    const sink = createPhoneScreenSink();
    const listener = vi.fn();
    sink.subscribe(listener);
    sink.publish(BASE);

    const moved: Rect = { ...BASE, width: BASE.width + 0.3 };
    sink.publish(moved);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(moved);
    expect(sink.current()).toEqual(moved);
  });

  it("always forwards null, including repeated nulls", () => {
    const sink = createPhoneScreenSink();
    const listener = vi.fn();
    sink.subscribe(listener);

    sink.publish(null);
    sink.publish(BASE);
    sink.publish(null);
    sink.publish(null);

    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener.mock.calls.map(([value]) => value)).toEqual([null, BASE, null, null]);
    expect(sink.current()).toBeNull();
  });

  it("forwards a rectangle after null even if it equals the previous one", () => {
    const sink = createPhoneScreenSink();
    const listener = vi.fn();
    sink.subscribe(listener);

    sink.publish(BASE);
    sink.publish(null);
    sink.publish(BASE);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(sink.current()).toEqual(BASE);
  });

  it("stops delivery after unsubscribe and keeps other listeners", () => {
    const sink = createPhoneScreenSink();
    const removed = vi.fn();
    const kept = vi.fn();
    const unsubscribe = sink.subscribe(removed);
    sink.subscribe(kept);

    sink.publish(BASE);
    unsubscribe();
    sink.publish({ ...BASE, left: BASE.left + 10 });
    sink.publish(null);

    expect(removed).toHaveBeenCalledTimes(1);
    expect(kept).toHaveBeenCalledTimes(3);
  });
});

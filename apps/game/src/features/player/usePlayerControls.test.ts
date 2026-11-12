import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerControls, type PlayerControlsOptions } from "./usePlayerControls";

// Requirements 4.2, 4.3, 18.1: the controls hook pauses input while `enabled` is false.

let lockedElement: Element | null = null;
const requestPointerLock = vi.fn(() => {
  lockedElement = document.body;
});
const exitPointerLock = vi.fn(() => {
  lockedElement = null;
});

function pressKey(code: string, key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code, key }));
  });
}

function mouseDown(button = 0) {
  act(() => {
    window.dispatchEvent(new MouseEvent("mousedown", { button }));
  });
}

function renderControls(initial: PlayerControlsOptions) {
  return renderHook((props: PlayerControlsOptions) => usePlayerControls(undefined, props), {
    initialProps: initial,
  });
}

beforeEach(() => {
  lockedElement = null;
  requestPointerLock.mockClear();
  exitPointerLock.mockClear();
  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    get: () => lockedElement,
  });
  Object.defineProperty(document.body, "requestPointerLock", {
    configurable: true,
    writable: true,
    value: requestPointerLock,
  });
  Object.defineProperty(document, "exitPointerLock", {
    configurable: true,
    writable: true,
    value: exitPointerLock,
  });
});

afterEach(() => {
  // Remove own-property stubs so other tests see the default jsdom document
  delete (document as unknown as Record<string, unknown>).pointerLockElement;
  delete (document as unknown as Record<string, unknown>).exitPointerLock;
  delete (document.body as unknown as Record<string, unknown>).requestPointerLock;
});

describe("usePlayerControls when disabled", () => {
  it("ignores keydown", () => {
    const { result } = renderControls({ enabled: false });
    pressKey("KeyW", "w");
    pressKey("KeyE", "e");
    expect(result.current.keysRef.current.forward).toBe(false);
    expect(result.current.keysRef.current.interact).toBe(false);
    expect(result.current.consumeInteractTrigger()).toBe(false);
  });

  it("does not request pointer lock on mousedown or Ctrl", () => {
    renderControls({ enabled: false });
    mouseDown();
    pressKey("ControlLeft", "Control");
    expect(requestPointerLock).not.toHaveBeenCalled();
  });

  it("clears held keys, pending triggers and pointer lock when it becomes disabled", () => {
    const { result, rerender } = renderControls({ enabled: true });
    pressKey("KeyW", "w");
    pressKey("KeyE", "e");
    mouseDown(); // acquires the lock
    expect(lockedElement).toBe(document.body);
    expect(result.current.keysRef.current.forward).toBe(true);

    rerender({ enabled: false });

    const keys = result.current.keysRef.current;
    expect(Object.values(keys).every((v) => v === false)).toBe(true);
    expect(result.current.consumeInteractTrigger()).toBe(false);
    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(lockedElement).toBeNull();
  });
});

describe("usePlayerControls when enabled", () => {
  it("sets forward on W keydown", () => {
    const { result } = renderControls({});
    pressKey("KeyW", "w");
    expect(result.current.keysRef.current.forward).toBe(true);
  });

  it("makes the E interact trigger consumable once", () => {
    const { result } = renderControls({ enabled: true });
    pressKey("KeyE", "e");
    expect(result.current.keysRef.current.interact).toBe(true);
    expect(result.current.consumeInteractTrigger()).toBe(true);
    expect(result.current.consumeInteractTrigger()).toBe(false);
  });

  it("requests pointer lock on mousedown without a lock", () => {
    const { result } = renderControls({ enabled: true });
    mouseDown();
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
    expect(result.current.keysRef.current.punch).toBe(false);
  });

  it("resumes input after being re-enabled", () => {
    const { result, rerender } = renderControls({ enabled: false });
    rerender({ enabled: true });
    pressKey("KeyW", "w");
    expect(result.current.keysRef.current.forward).toBe(true);
  });
});

// Tests for the Call_Trigger clock (Requirements 8.1, 8.2, 8.4, 8.5 and 18.6).
// Uses fake timers (including Date, which the hook reads for elapsed time) and a real Chapter_Store.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../game/narrative/store";
import type { IncomingCallId } from "../../game/narrative/chapter1/ids";
import {
  CALLBACK_DELAY_MS,
  CALL_TRIGGER_TICK_MS,
  EXPLORATION_FALLBACK_MS,
  FIRST_INTERACTION_RING_DELAY_MS,
  RE_RING_DELAY_MS,
  useCallTriggers,
} from "./useCallTriggers";

const TICK = CALL_TRIGGER_TICK_MS;

function ringCount(store: ChapterStore, callId: IncomingCallId): number {
  return store.getState().call.log.find((record) => record.callId === callId)?.ringCount ?? 0;
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function dispatchOk(store: ChapterStore, action: Parameters<ChapterStore["dispatch"]>[0]): void {
  expect(store.dispatch(action).accepted).toBe(true);
}

function setup(overlayOpen = false) {
  const store = createChapterStore(createInitialState());
  const hook = renderHook(({ open }) => useCallTriggers(store, open), {
    initialProps: { open: overlayOpen },
  });
  return { store, ...hook };
}

function startedSetup(overlayOpen = false) {
  const result = setup(overlayOpen);
  dispatchOk(result.store, { type: "START_CHAPTER" });
  return result;
}

/** Starts the chapter and lets the fallback ring the first scam Call. */
function ringFirstCall() {
  const result = startedSetup();
  advance(EXPLORATION_FALLBACK_MS + TICK);
  expect(result.store.getState().call.status).toBe("ringing");
  return result;
}

/** Rings, answers and hangs up the first scam Call, so it ends with no Decision. */
function endFirstCallWithoutDecision() {
  const result = ringFirstCall();
  dispatchOk(result.store, { type: "ANSWER_CALL" });
  dispatchOk(result.store, { type: "END_CALL" });
  const state = result.store.getState();
  expect(state.call.log.find((record) => record.callId === "call.scam-1")?.status).toBe("ended");
  expect(state.decision).toBeNull();
  return result;
}

function setVisibility(value: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
}

describe("useCallTriggers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  });

  afterEach(() => {
    // Remove the instance override so the prototype getter applies again.
    delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
    vi.useRealTimers();
  });

  it("rings the first scam Call about 3 s after the first interaction", () => {
    const { store } = startedSetup();
    advance(5_000);
    dispatchOk(store, { type: "INTERACT_OBJECT", objectId: "obj.wallet" });

    advance(FIRST_INTERACTION_RING_DELAY_MS - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(0);

    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(1);
    expect(store.getState().call.current).toBe("call.scam-1");
    expect(store.getState().call.status).toBe("ringing");
  });

  it("rings the first scam Call after 60 s of exploration with no interaction", () => {
    const { store } = startedSetup();
    advance(EXPLORATION_FALLBACK_MS - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(0);

    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(1);
  });

  it("rings the first scam Call again 20 s after a decline", () => {
    const { store } = ringFirstCall();
    dispatchOk(store, { type: "END_CALL" });
    expect(store.getState().call.status).toBe("declined");

    advance(RE_RING_DELAY_MS - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(1);

    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(2);
    expect(store.getState().call.status).toBe("ringing");

    // A second decline starts a fresh 20 s wait.
    dispatchOk(store, { type: "END_CALL" });
    advance(RE_RING_DELAY_MS - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(2);
    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(3);
  });

  it("rings the callback 90 s after the first scam Call ends with no Decision", () => {
    const { store } = endFirstCallWithoutDecision();

    advance(CALLBACK_DELAY_MS - 2 * TICK);
    expect(ringCount(store, "call.callback")).toBe(0);

    advance(3 * TICK);
    expect(ringCount(store, "call.callback")).toBe(1);
    expect(store.getState().call.current).toBe("call.callback");
  });

  it("rings the callback at most once", () => {
    const { store } = endFirstCallWithoutDecision();
    advance(CALLBACK_DELAY_MS + TICK);
    expect(ringCount(store, "call.callback")).toBe(1);

    dispatchOk(store, { type: "END_CALL" });
    advance(10 * CALLBACK_DELAY_MS);
    expect(ringCount(store, "call.callback")).toBe(1);
    expect(store.getState().call.current).toBeNull();
  });

  it("pauses every timer while an Overlay is open", () => {
    const { store, rerender } = startedSetup();
    advance(30_000);

    rerender({ open: true });
    advance(5 * EXPLORATION_FALLBACK_MS);
    expect(ringCount(store, "call.scam-1")).toBe(0);

    // The 30 s already counted are kept; the rest runs only once the Overlay closes.
    rerender({ open: false });
    advance(EXPLORATION_FALLBACK_MS - 30_000 - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(0);
    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(1);
  });

  it("pauses the callback timer while an Overlay is open", () => {
    const { store, rerender } = endFirstCallWithoutDecision();
    rerender({ open: true });
    advance(3 * CALLBACK_DELAY_MS);
    expect(ringCount(store, "call.callback")).toBe(0);

    rerender({ open: false });
    advance(CALLBACK_DELAY_MS + TICK);
    expect(ringCount(store, "call.callback")).toBe(1);
  });

  it("pauses every timer while the tab is hidden", () => {
    const { store } = startedSetup();
    setVisibility("hidden");
    advance(5 * EXPLORATION_FALLBACK_MS);
    expect(ringCount(store, "call.scam-1")).toBe(0);

    setVisibility("visible");
    advance(EXPLORATION_FALLBACK_MS - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(0);
    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(1);
  });

  it("never rings before START_CHAPTER and counts exploration only from the start", () => {
    const { store } = setup();
    advance(5 * EXPLORATION_FALLBACK_MS);
    expect(store.getState().call.log).toHaveLength(0);

    dispatchOk(store, { type: "START_CHAPTER" });
    advance(EXPLORATION_FALLBACK_MS - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(0);
    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(1);
  });

  it("starts every timer again from zero after a restart (store.replace to the initial state)", () => {
    const { store } = startedSetup();
    advance(50_000);
    act(() => store.replace(createInitialState()));
    advance(TICK);

    dispatchOk(store, { type: "START_CHAPTER" });
    advance(EXPLORATION_FALLBACK_MS - 2 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(0);
    advance(3 * TICK);
    expect(ringCount(store, "call.scam-1")).toBe(1);
  });

  it("leaves no timers after unmount", () => {
    const { store, unmount } = startedSetup();
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
    advance(5 * EXPLORATION_FALLBACK_MS);
    expect(store.getState().call.log).toHaveLength(0);
  });
});

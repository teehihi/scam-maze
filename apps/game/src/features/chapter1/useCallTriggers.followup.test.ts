// Tests for the follow-up call trigger (Requirement 2.5).
// Pure `stepFollowupTrigger` cases use real Chapter_Store states; hook cases use fake timers
// (including Date, which the hook reads for elapsed time).

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../game/narrative/store";
import type { IncomingCallId } from "../../game/narrative/chapter1/ids";
import type { ChapterState } from "../../game/narrative/types";
import {
  CALLBACK_DELAY_MS,
  CALL_TRIGGER_TICK_MS,
  EXPLORATION_FALLBACK_MS,
  FOLLOWUP_DELAY_MS,
  stepFollowupTrigger,
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

function setVisibility(value: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
}

/** Plays the store up to the moment the callback has ended (`decline` ends it by declining). */
function storeWithCallbackClosed(decline: boolean): ChapterStore {
  const store = createChapterStore(createInitialState());
  dispatchOk(store, { type: "START_CHAPTER" });
  dispatchOk(store, { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" });
  dispatchOk(store, { type: "ANSWER_CALL" });
  dispatchOk(store, { type: "END_CALL" });
  dispatchOk(store, { type: "RING_CALL", callId: "call.callback", reason: "callback" });
  if (!decline) dispatchOk(store, { type: "ANSWER_CALL" });
  dispatchOk(store, { type: "END_CALL" });
  const status = store.getState().call.log.find((record) => record.callId === "call.callback")?.status;
  expect(status).toBe(decline ? "declined" : "ended");
  return store;
}

function closedState(decline = false): ChapterState {
  return storeWithCallbackClosed(decline).getState();
}

describe("stepFollowupTrigger", () => {
  it("does not ring or count before the chapter starts", () => {
    const result = stepFollowupTrigger(createInitialState(), 10_000, 250, true);
    expect(result).toEqual({ elapsedMs: 0, ring: null });
  });

  it("does not count while the callback has not closed", () => {
    const store = createChapterStore(createInitialState());
    dispatchOk(store, { type: "START_CHAPTER" });
    dispatchOk(store, { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" });
    dispatchOk(store, { type: "ANSWER_CALL" });
    dispatchOk(store, { type: "END_CALL" });
    expect(stepFollowupTrigger(store.getState(), 0, 1_000, true)).toEqual({ elapsedMs: 0, ring: null });
  });

  it.each([false, true])("rings once the delay is reached (callback declined: %s)", (decline) => {
    const state = closedState(decline);
    const before = stepFollowupTrigger(state, 0, FOLLOWUP_DELAY_MS - 1, true);
    expect(before.elapsedMs).toBe(FOLLOWUP_DELAY_MS - 1);
    expect(before.ring).toBeNull();

    const due = stepFollowupTrigger(state, before.elapsedMs, 1, true);
    expect(due.elapsedMs).toBe(FOLLOWUP_DELAY_MS);
    expect(due.ring).toEqual({ callId: "call.followup", reason: "follow-up" });
  });

  it("keeps time but does not count while not allowed (overlay or hidden tab)", () => {
    const state = closedState();
    expect(stepFollowupTrigger(state, 1_000, 5_000, false)).toEqual({ elapsedMs: 1_000, ring: null });
    expect(stepFollowupTrigger(state, FOLLOWUP_DELAY_MS, 250, false).ring).toBeNull();
  });

  it("ignores a negative delta", () => {
    expect(stepFollowupTrigger(closedState(), 500, -300, true).elapsedMs).toBe(500);
  });

  it("resets and never rings once a Decision exists", () => {
    const state: ChapterState = { ...closedState(), decision: "follow-request" };
    expect(stepFollowupTrigger(state, FOLLOWUP_DELAY_MS, 250, true)).toEqual({ elapsedMs: 0, ring: null });
  });

  it("resets and never rings again after the follow-up has rung", () => {
    const store = storeWithCallbackClosed(false);
    dispatchOk(store, { type: "RING_CALL", callId: "call.followup", reason: "follow-up" });
    dispatchOk(store, { type: "END_CALL" });
    expect(stepFollowupTrigger(store.getState(), FOLLOWUP_DELAY_MS, 250, true)).toEqual({
      elapsedMs: 0,
      ring: null,
    });
  });

  it("waits with the time kept while a call is ringing or active", () => {
    const state = closedState();
    for (const status of ["ringing", "active"] as const) {
      const busy: ChapterState = { ...state, call: { ...state.call, current: "call.scam-1", status } };
      const result = stepFollowupTrigger(busy, FOLLOWUP_DELAY_MS, 250, true);
      expect(result.ring).toBeNull();
      expect(result.elapsedMs).toBe(FOLLOWUP_DELAY_MS + 250);
    }
  });

  it("waits with the time kept while a conversation is open, then rings when it ends", () => {
    const state = closedState();
    const talking: ChapterState = {
      ...state,
      conversation: { graphId: "dlg.neighbor", nodeId: "start" } as unknown as ChapterState["conversation"],
    };
    const waiting = stepFollowupTrigger(talking, FOLLOWUP_DELAY_MS, 250, true);
    expect(waiting.ring).toBeNull();
    expect(waiting.elapsedMs).toBe(FOLLOWUP_DELAY_MS + 250);

    const free = stepFollowupTrigger(state, waiting.elapsedMs, 250, true);
    expect(free.ring).toEqual({ callId: "call.followup", reason: "follow-up" });
  });
});

describe("useCallTriggers follow-up", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  });

  afterEach(() => {
    delete (document as { visibilityState?: DocumentVisibilityState }).visibilityState;
    vi.useRealTimers();
  });

  /** Mounts the hook, lets the clock ring the callback, then answers and hangs it up. */
  function callbackClosedSetup(decline = false) {
    const store = createChapterStore(createInitialState());
    const hook = renderHook(({ open }) => useCallTriggers(store, open), { initialProps: { open: false } });
    dispatchOk(store, { type: "START_CHAPTER" });
    advance(EXPLORATION_FALLBACK_MS + TICK);
    dispatchOk(store, { type: "ANSWER_CALL" });
    dispatchOk(store, { type: "END_CALL" });
    advance(CALLBACK_DELAY_MS + TICK);
    expect(store.getState().call.current).toBe("call.callback");
    if (!decline) dispatchOk(store, { type: "ANSWER_CALL" });
    dispatchOk(store, { type: "END_CALL" });
    return { store, ...hook };
  }

  it.each([false, true])("rings the follow-up once at 45 s (callback declined: %s)", (decline) => {
    const { store } = callbackClosedSetup(decline);
    advance(FOLLOWUP_DELAY_MS - 2 * TICK);
    expect(ringCount(store, "call.followup")).toBe(0);

    advance(3 * TICK);
    expect(ringCount(store, "call.followup")).toBe(1);
    expect(store.getState().call.current).toBe("call.followup");
    expect(store.getState().call.status).toBe("ringing");
  });

  it("never rings the follow-up twice", () => {
    const { store } = callbackClosedSetup();
    advance(FOLLOWUP_DELAY_MS + TICK);
    expect(ringCount(store, "call.followup")).toBe(1);

    dispatchOk(store, { type: "END_CALL" });
    advance(10 * FOLLOWUP_DELAY_MS);
    expect(ringCount(store, "call.followup")).toBe(1);
  });

  it("pauses under an Overlay and keeps the time already counted", () => {
    const { store, rerender } = callbackClosedSetup();
    advance(20_000);
    rerender({ open: true });
    advance(5 * FOLLOWUP_DELAY_MS);
    expect(ringCount(store, "call.followup")).toBe(0);

    rerender({ open: false });
    advance(FOLLOWUP_DELAY_MS - 20_000 - 2 * TICK);
    expect(ringCount(store, "call.followup")).toBe(0);
    advance(3 * TICK);
    expect(ringCount(store, "call.followup")).toBe(1);
  });

  it("pauses while the tab is hidden", () => {
    const { store } = callbackClosedSetup();
    setVisibility("hidden");
    advance(5 * FOLLOWUP_DELAY_MS);
    expect(ringCount(store, "call.followup")).toBe(0);

    setVisibility("visible");
    advance(FOLLOWUP_DELAY_MS - 2 * TICK);
    expect(ringCount(store, "call.followup")).toBe(0);
    advance(3 * TICK);
    expect(ringCount(store, "call.followup")).toBe(1);
  });

  it("never rings after a Decision", () => {
    const { store } = callbackClosedSetup();
    advance(10_000);
    act(() => store.replace({ ...store.getState(), decision: "stop-and-wait" }));
    advance(10 * FOLLOWUP_DELAY_MS);
    expect(ringCount(store, "call.followup")).toBe(0);
  });

  it("waits while the phone is busy and rings once it is free", () => {
    const { store } = callbackClosedSetup();
    const free = store.getState();
    act(() =>
      store.replace({ ...free, call: { ...free.call, current: "call.scam-1", status: "active" } }),
    );
    advance(2 * FOLLOWUP_DELAY_MS);
    expect(ringCount(store, "call.followup")).toBe(0);

    act(() => store.replace(free));
    advance(2 * TICK);
    expect(ringCount(store, "call.followup")).toBe(1);
  });
});

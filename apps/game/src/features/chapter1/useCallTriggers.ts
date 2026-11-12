// Call_Trigger: UI-layer timers that decide when to dispatch RING_CALL.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Call timing" and `useCallTriggers.ts`,
// and Requirements 8.1, 8.2, 8.4 and 8.5.
//
// The Chapter_Core has no clock. This hook keeps one: a fixed interval adds elapsed time to the
// timers only while the chapter is playing, no Overlay is open and the tab is visible, so pausing
// (pause menu, phone, journal, hidden tab) stops every timer. The hook checks the state before
// dispatching, so it never sends a RING_CALL the core would reject.

import { useEffect, useRef } from "react";
import type { ChapterStore } from "../../game/narrative/store";
import type { IncomingCallId } from "../../game/narrative/chapter1/ids";
import type { ChapterState, RingReason } from "../../game/narrative/types";

/** Ring the first scam Call this long after the first interaction (Requirement 8.1: within 4 s). */
export const FIRST_INTERACTION_RING_DELAY_MS = 3_000;
/** Ring the first scam Call after this much exploration without an interaction (Requirement 8.2). */
export const EXPLORATION_FALLBACK_MS = 60_000;
/** Ring the first scam Call again this long after the player declines it (Requirement 8.4). */
export const RE_RING_DELAY_MS = 20_000;
/** Ring the callback this long after the first scam Call ends with no Decision (Requirement 8.5). */
export const CALLBACK_DELAY_MS = 90_000;
/** Interval between clock ticks. */
export const CALL_TRIGGER_TICK_MS = 250;
/** Largest time step added by one tick, so a stalled or throttled timer cannot jump ahead. */
export const MAX_TICK_DELTA_MS = 1_000;

/** Accumulated allowed time, in milliseconds, for each trigger rule. */
export interface CallTriggerTimers {
  /** Exploration time since the chapter started playing. */
  exploration: number;
  /** Time since the first interaction was seen. */
  sinceFirstInteraction: number;
  /** Time since the first scam Call was declined. */
  sinceDecline: number;
  /** Time since the first scam Call ended with no Decision. */
  sinceScamCallEnded: number;
}

export interface CallTriggerRing {
  callId: IncomingCallId;
  reason: RingReason;
}

export const INITIAL_CALL_TRIGGER_TIMERS: CallTriggerTimers = {
  exploration: 0,
  sinceFirstInteraction: 0,
  sinceDecline: 0,
  sinceScamCallEnded: 0,
};

function findRecord(state: ChapterState, callId: IncomingCallId) {
  return state.call.log.find((record) => record.callId === callId);
}

function hasInteracted(state: ChapterState): boolean {
  if (state.interacted.length > 0) return true;
  return Object.values(state.npc).some((npc) => npc.timesTalked > 0);
}

/** True when nothing in the state blocks a RING_CALL (mirrors the reducer's checks). */
function phoneIsFree(state: ChapterState): boolean {
  return (
    state.status === "playing" &&
    state.call.status !== "ringing" &&
    state.call.current === null &&
    state.conversation === null
  );
}

/**
 * One clock step. Pure: returns the next timers and the ring to dispatch, if any.
 *
 * `deltaMs` is added only when `allowed` is true. Each timer counts only while its rule applies
 * and resets to zero when the rule stops applying, so a new decline starts a fresh 20 s wait.
 * A due ring waits (timer kept) while another call or conversation blocks it.
 */
export function stepCallTriggers(
  state: ChapterState,
  timers: CallTriggerTimers,
  deltaMs: number,
  allowed: boolean,
): { timers: CallTriggerTimers; ring: CallTriggerRing | null } {
  // Before START_CHAPTER, including after a restart or replay (`store.replace` back to the
  // initial state): every timer starts again from zero.
  if (state.status === "not-started") return { timers: INITIAL_CALL_TRIGGER_TIMERS, ring: null };
  const add = allowed && state.status === "playing" ? Math.max(0, deltaMs) : 0;
  const scam1 = findRecord(state, "call.scam-1");
  const scam1Rang = scam1 !== undefined;
  const scam1Declined = scam1?.status === "declined" && state.call.current === null;
  const callbackDue =
    scam1?.status === "ended" && state.decision === null && findRecord(state, "call.callback") === undefined;

  const next: CallTriggerTimers = {
    exploration: scam1Rang ? timers.exploration : timers.exploration + add,
    sinceFirstInteraction: !scam1Rang && hasInteracted(state) ? timers.sinceFirstInteraction + add : 0,
    sinceDecline: scam1Declined ? timers.sinceDecline + add : 0,
    sinceScamCallEnded: callbackDue ? timers.sinceScamCallEnded + add : 0,
  };

  if (!allowed || !phoneIsFree(state)) return { timers: next, ring: null };

  let ring: CallTriggerRing | null = null;
  if (!scam1Rang) {
    if (hasInteracted(state) && next.sinceFirstInteraction >= FIRST_INTERACTION_RING_DELAY_MS) {
      ring = { callId: "call.scam-1", reason: "first-interaction" };
    } else if (next.exploration >= EXPLORATION_FALLBACK_MS) {
      ring = { callId: "call.scam-1", reason: "exploration-timer" };
    }
  } else if (scam1Declined && next.sinceDecline >= RE_RING_DELAY_MS) {
    ring = { callId: "call.scam-1", reason: "re-ring" };
  } else if (callbackDue && next.sinceScamCallEnded >= CALLBACK_DELAY_MS) {
    ring = { callId: "call.callback", reason: "callback" };
  }
  return { timers: next, ring };
}

function tabVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

/**
 * Runs the Call_Trigger clock for the chapter. Dispatches RING_CALL on the store; returns nothing.
 * `overlayOpen` pauses the clock while any Overlay is shown.
 */
export function useCallTriggers(store: ChapterStore, overlayOpen: boolean): void {
  const overlayOpenRef = useRef(overlayOpen);
  useEffect(() => {
    overlayOpenRef.current = overlayOpen;
  }, [overlayOpen]);

  useEffect(() => {
    let timers = INITIAL_CALL_TRIGGER_TIMERS;
    let last = Date.now();

    const id = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(Math.max(0, now - last), MAX_TICK_DELTA_MS);
      last = now;
      const allowed = !overlayOpenRef.current && tabVisible();
      const step = stepCallTriggers(store.getState(), timers, delta, allowed);
      timers = step.timers;
      if (step.ring) {
        // The state was checked above; a rejection would be a no-op anyway.
        store.dispatch({ type: "RING_CALL", callId: step.ring.callId, reason: step.ring.reason });
      }
    }, CALL_TRIGGER_TICK_MS);

    return () => clearInterval(id);
  }, [store]);
}

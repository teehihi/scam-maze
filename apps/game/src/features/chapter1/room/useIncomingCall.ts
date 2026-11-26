// The ringing of an incoming device call (see `incomingCall.ts`). Presentation only: it decides when the
// phone rings and when a call that nobody picked up becomes a missed call. It never dispatches: the
// game state changes when the player answers (the call screen does the caller's `call` action) or
// declines (the layer does `decline`). A missed call stays pending, so the player can call back from
// Calls; after a reload a call that is still pending rings again.
import { useCallback, useEffect, useState } from "react";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ScenarioDefinition } from "../../../game/narrative/types";
import { useChapterState } from "../useChapterState";
import { pendingIncomingCaller } from "./incomingCall";

/** Pause between the moment the caller becomes pending and the first ring (the "draft saved" notice shows first). */
export const INCOMING_RING_DELAY_MS = 2500;
/** How long the phone rings before the call counts as missed. */
export const INCOMING_RING_TIMEOUT_MS = 30_000;

export type IncomingCallPhase = "idle" | "waiting" | "ringing" | "answered" | "missed";

export interface IncomingCallState {
  callerId: string | null;
  phase: IncomingCallPhase;
  /** The player picked up: the ringing stops while the call screen connects. */
  answer: () => void;
}

export function useIncomingCall(options: {
  store: ChapterStore;
  scenario: ScenarioDefinition;
  /** False while the phone cannot ring (the intro, a story call in progress). Ringing waits. */
  enabled: boolean;
  delayMs?: number;
  timeoutMs?: number;
}): IncomingCallState {
  const { store, scenario, enabled, delayMs = INCOMING_RING_DELAY_MS, timeoutMs = INCOMING_RING_TIMEOUT_MS } = options;
  const callerId = useChapterState(store, (state) => pendingIncomingCaller(state, scenario));
  const [phase, setPhase] = useState<IncomingCallPhase>("idle");
  const [phaseOf, setPhaseOf] = useState<string | null>(null);

  // A new caller (or none) starts over.
  if (phaseOf !== callerId) {
    setPhaseOf(callerId);
    setPhase(callerId === null ? "idle" : "waiting");
  }

  useEffect(() => {
    if (callerId === null || !enabled) return undefined;
    if (phase === "waiting") {
      const id = window.setTimeout(() => setPhase("ringing"), delayMs);
      return () => window.clearTimeout(id);
    }
    if (phase === "ringing") {
      const id = window.setTimeout(() => setPhase("missed"), timeoutMs);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [callerId, enabled, phase, delayMs, timeoutMs]);

  const answer = useCallback(() => setPhase((current) => (current === "ringing" ? "answered" : current)), []);
  // While ringing is not allowed (a story call, the intro) the phone does not ring; it resumes after.
  const shown: IncomingCallPhase = !enabled && phase === "ringing" ? "waiting" : phase;
  return { callerId, phase: shown, answer };
}

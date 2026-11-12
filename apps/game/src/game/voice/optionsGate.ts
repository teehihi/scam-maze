// Pure choice gate for the Chapter 1 voice layer (design.md section 5, requirements 5.9 and 5.10).
// No React, no Three.js, no i18n and no audio API. It defines its own minimal input type so it does
// not import the voice player.
//
// The gate only decides whether the player's options are visible. It never selects an option and
// never starts a dialogue transition: playback ending alone does not advance the dialogue.

/** Playback phases the gate understands. Mirrors the player phases without importing them. */
export type GatePhase = "idle" | "loading" | "playing" | "ended" | "blocked" | "failed" | "unavailable";

/** Options appear this long after the clip ends. */
export const GATE_AFTER_END_MS = 300;
/** Options appear this long after `durationMs` has passed since the node started. */
export const GATE_TIMEOUT_EXTRA_MS = 1500;

export interface OptionsGateInput {
  /** Authored `waitForVoice` flag of the current node. */
  waitForVoice: boolean;
  phase: GatePhase;
  /** True only when the clip is actually audible (not muted, gain above 0). */
  audible: boolean;
  /** Clip duration in ms, or null when unknown. */
  durationMs: number | null;
  /** Milliseconds since the node started, or null when it has not started. */
  elapsedSinceStartMs: number | null;
  /** Milliseconds since the clip ended, or null when it has not ended. */
  elapsedSinceEndMs: number | null;
  /** True once the player activated "Show replies now". */
  skipped: boolean;
}

function finiteOrNull(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Returns true when the player's options must be visible.
 *
 * Options are hidden only when the node authors `waitForVoice`, audio is audible, the phase is
 * `loading` or `playing` (or `ended` less than `GATE_AFTER_END_MS` ago), the player has not skipped,
 * and `durationMs + GATE_TIMEOUT_EXTRA_MS` has not passed since the node started. Every other case,
 * including `blocked`, `failed`, `unavailable`, `idle`, silent playback and a missing clip, shows
 * the options at once.
 */
export function areOptionsVisible(input: OptionsGateInput): boolean {
  if (!input.waitForVoice) return true;
  if (input.skipped) return true;
  if (!input.audible) return true;

  if (input.phase !== "loading" && input.phase !== "playing" && input.phase !== "ended") {
    return true;
  }

  // Timeout: an unknown duration counts as 0 so the gate fails open.
  const elapsedStart = finiteOrNull(input.elapsedSinceStartMs);
  const duration = finiteOrNull(input.durationMs) ?? 0;
  if (elapsedStart !== null && elapsedStart >= Math.max(0, duration) + GATE_TIMEOUT_EXTRA_MS) {
    return true;
  }

  if (input.phase === "ended") {
    const sinceEnd = finiteOrNull(input.elapsedSinceEndMs);
    // An ended clip with no usable end time must not keep the options hidden.
    return sinceEnd === null || sinceEnd >= GATE_AFTER_END_MS;
  }

  return false;
}

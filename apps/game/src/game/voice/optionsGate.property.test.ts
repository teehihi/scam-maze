import { describe, expect, it } from "vitest";

import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { GATE_AFTER_END_MS, GATE_TIMEOUT_EXTRA_MS, areOptionsVisible } from "./optionsGate";
import type { GatePhase, OptionsGateInput } from "./optionsGate";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const PHASES: readonly GatePhase[] = ["idle", "loading", "playing", "ended", "blocked", "failed", "unavailable"];
const WAITING_PHASES: readonly GatePhase[] = ["loading", "playing", "ended"];

/** Base seed for this file, derived from the shared core seed. */
const FILE_SEED = (CORE_PROPERTY_SEED ^ 0x0971a7e5) >>> 0;
const RUNS = Math.max(100, CORE_PROPERTY_RUNS);

function maybeNull(next: () => number, value: number): number | null {
  return next() < 0.15 ? null : value;
}

function makeInput(next: () => number): OptionsGateInput {
  return {
    waitForVoice: next() < 0.8,
    phase: pick(next, PHASES),
    audible: next() < 0.8,
    durationMs: maybeNull(next, randomInt(next, 0, 20_000)),
    elapsedSinceStartMs: maybeNull(next, randomInt(next, 0, 25_000)),
    elapsedSinceEndMs: maybeNull(next, randomInt(next, 0, 1_000)),
    skipped: next() < 0.2,
  };
}

/** Reasons the options must already be visible, written independently of the implementation. */
function mustBeVisible(input: OptionsGateInput): boolean {
  if (!input.waitForVoice || input.skipped || !input.audible) return true;
  if (!WAITING_PHASES.includes(input.phase)) return true;
  const duration = input.durationMs ?? 0;
  if (input.elapsedSinceStartMs !== null && input.elapsedSinceStartMs >= duration + GATE_TIMEOUT_EXTRA_MS) {
    return true;
  }
  if (input.phase === "ended") {
    return input.elapsedSinceEndMs === null || input.elapsedSinceEndMs >= GATE_AFTER_END_MS;
  }
  return false;
}

describe("optionsGate property", () => {
  // Feature: chapter-01-voice-narrative, Property 14: The choice gate always opens
  it(
    "opens no later than clip end + 300 ms, skip, or durationMs + 1500 ms, and never delays nodes without waitForVoice",
    () => {
      for (let run = 0; run < RUNS; run += 1) {
        const seed = caseSeed(FILE_SEED, run);
        const next = createLcg(seed);
        const input = makeInput(next);
        const label = `seed=${seed} case=${run} input=${JSON.stringify(input)}`;

        const visible = areOptionsVisible(input);
        expect(visible, label).toBe(mustBeVisible(input));

        // Nodes without waitForVoice are never delayed.
        expect(areOptionsVisible({ ...input, waitForVoice: false }), label).toBe(true);
        // Skip always opens the gate.
        expect(areOptionsVisible({ ...input, skipped: true }), label).toBe(true);
        // Inaudible audio opens the gate at once.
        expect(areOptionsVisible({ ...input, audible: false }), label).toBe(true);
        // The timeout bound opens the gate whatever the phase.
        const duration = input.durationMs ?? 0;
        expect(
          areOptionsVisible({ ...input, elapsedSinceStartMs: duration + GATE_TIMEOUT_EXTRA_MS }),
          label,
        ).toBe(true);
        // The gate never closes again as time passes.
        if (visible) {
          const later: OptionsGateInput = {
            ...input,
            elapsedSinceStartMs:
              input.elapsedSinceStartMs === null ? null : input.elapsedSinceStartMs + randomInt(next, 0, 5_000),
            elapsedSinceEndMs:
              input.elapsedSinceEndMs === null ? null : input.elapsedSinceEndMs + randomInt(next, 0, 5_000),
          };
          expect(areOptionsVisible(later), label).toBe(true);
        }
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});

import { describe, expect, it } from "vitest";

import { TONE_IDS } from "../narrative/chapter1/ids";
import type { PressureLevel } from "../narrative/types";
import { generateCallState } from "../../test/callStates";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import {
  AMBIENCE_CALL_GAIN,
  AMBIENCE_GAIN,
  DEFAULT_PAUSE_MS,
  PEAK_CAP,
  REDUCED_STRESS_EXTRA_PAUSE_MS,
  RINGTONE_GAIN,
  TENSION_FADE_SECONDS,
  ambienceGain,
  effectivePauseMs,
  ringtoneGain,
  tensionGain,
} from "./mixPlan";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/** File-specific base seed, derived from the shared core seed. */
const MIX_PLAN_SEED = (CORE_PROPERTY_SEED ^ 0x19) >>> 0;

/** Largest allowed pause before a line, in milliseconds (design Property 19). */
const MAX_PAUSE_MS = 4200;

/** Largest allowed change of the tension gain per second: a full peak cap over one fade. */
const FADE_SLOPE_PER_SECOND = PEAK_CAP / TENSION_FADE_SECONDS;

const LEVELS: readonly PressureLevel[] = [0, 1, 2, 3];

/**
 * Tension target as the call layer drives it: the level of `state.pressure` while a call is live
 * (ringing or active) and 0 when there is no call. `tensionGain` itself takes only a level.
 */
function tensionTarget(level: number, reducedStress: boolean, callActive: boolean): number {
  return callActive ? tensionGain(level, reducedStress) : 0;
}

// Feature: chapter-01-voice-narrative, Property 19: The mix plan stays inside its caps
describe("mix plan caps", () => {
  it(
    "keeps tension, ringtone, click and ambience gains within the cap and the pause within bounds",
    () => {
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(MIX_PLAN_SEED, index);
        const next = createLcg(seed);
        const where = `seed ${seed}, case ${index}`;

        // Call state generated from the real reducer; pressure is read from it.
        const generated = generateCallState(seed);
        const callActive =
          generated.state.call.status === "ringing" || generated.state.call.status === "active";
        const level = callActive ? generated.state.pressure : pick(next, LEVELS);
        const reducedStress = next() < 0.5;
        const inCall = next() < 0.5;

        // Tension: 0 without a call, never above the cap, 0 at level 0.
        const tension = tensionTarget(level, reducedStress, callActive);
        expect(tension, `${where}: tension in range`).toBeGreaterThanOrEqual(0);
        expect(tension, `${where}: tension cap`).toBeLessThanOrEqual(PEAK_CAP);
        expect(tensionTarget(level, reducedStress, false), `${where}: no call`).toBe(0);
        expect(tensionGain(0, reducedStress), `${where}: level 0`).toBe(0);

        // Tension moves one fade (1.5 s) per level step, so the slope between any two levels
        // and any reduced-stress value stays under the allowed slope.
        const other = pick(next, LEVELS);
        const delta = Math.abs(tensionGain(level, reducedStress) - tensionGain(other, reducedStress));
        expect(delta / TENSION_FADE_SECONDS, `${where}: fade slope ${level}->${other}`).toBeLessThanOrEqual(
          FADE_SLOPE_PER_SECOND + 1e-12,
        );
        // Tension never grows with reduced stress.
        expect(tensionGain(level, true), `${where}: reduced stress`).toBeLessThanOrEqual(
          tensionGain(level, false),
        );

        // Ringtone, click (no click gain function exists; it shares the cap) and ambience.
        expect(ringtoneGain(reducedStress), `${where}: ringtone`).toBeLessThanOrEqual(PEAK_CAP);
        expect(ringtoneGain(reducedStress), `${where}: ringtone positive`).toBeGreaterThan(0);
        expect(ringtoneGain(true), `${where}: ringtone reduced`).toBeLessThanOrEqual(RINGTONE_GAIN);
        expect(ambienceGain(inCall), `${where}: ambience`).toBeLessThanOrEqual(PEAK_CAP);
        expect(ambienceGain(inCall), `${where}: ambience value`).toBe(
          inCall ? AMBIENCE_CALL_GAIN : AMBIENCE_GAIN,
        );

        // Pause: tone default, plus the extra only for impatient and pressuring under reduced stress.
        const tone = pick(next, TONE_IDS);
        const pause = effectivePauseMs(tone, reducedStress);
        const extra =
          reducedStress && (tone === "impatient" || tone === "pressuring")
            ? REDUCED_STRESS_EXTRA_PAUSE_MS
            : 0;
        expect(pause, `${where}: pause ${tone}`).toBe(DEFAULT_PAUSE_MS[tone] + extra);
        expect(pause, `${where}: pause range`).toBeGreaterThanOrEqual(0);
        expect(pause, `${where}: pause range`).toBeLessThanOrEqual(MAX_PAUSE_MS);
      }
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    "keeps tension within the cap for every level, including out-of-range input",
    () => {
      const next = createLcg(MIX_PLAN_SEED);
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const raw = randomInt(next, -10, 10) + next();
        const reducedStress = next() < 0.5;
        const gain = tensionGain(raw, reducedStress);
        expect(gain, `case ${index}: level ${raw}`).toBeGreaterThanOrEqual(0);
        expect(gain, `case ${index}: level ${raw}`).toBeLessThanOrEqual(PEAK_CAP);
      }
      expect(tensionGain(Number.NaN, false)).toBe(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

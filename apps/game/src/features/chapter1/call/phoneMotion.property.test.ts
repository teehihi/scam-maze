// Feature: game-3d-phone-call-ui, Property 7: Motion stays within bounds
import { describe, expect, it } from "vitest";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { computeCallLayout, type Viewport } from "./callLayout";
import { ENTRY_DURATION_MS, phoneMotionOffset, type MotionInput } from "./phoneMotion";

const SEED = 0x7a11_0007;
const CASES = 300;
/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;
/** Floating-point tolerance in CSS px. */
const EPSILON = 1e-9;
const MAX_ELAPSED_MS = 10_000;

function randomViewport(next: () => number): Viewport {
  return { width: randomInt(next, 320, 2560), height: randomInt(next, 480, 1600) };
}

/** Elapsed time from 0 to 10 s, with the entry boundaries chosen on purpose some of the time. */
function randomElapsed(next: () => number): number {
  const kind = pick(next, ["zero", "entryEnd", "duringEntry", "any"] as const);
  if (kind === "zero") return 0;
  if (kind === "entryEnd") return ENTRY_DURATION_MS;
  if (kind === "duringEntry") return next() * ENTRY_DURATION_MS;
  return next() * MAX_ELAPSED_MS;
}

describe("phoneMotionOffset properties", () => {
  it("keeps the motion within bounds", () => {
    expect(ENTRY_DURATION_MS).toBeGreaterThanOrEqual(200);
    expect(ENTRY_DURATION_MS).toBeLessThanOrEqual(600);

    const next = createLcg(SEED);
    let afterEntryRinging = 0;
    let afterEntryNotRinging = 0;
    let nonZeroVibration = 0;

    for (let index = 0; index < CASES; index += 1) {
      const viewport = randomViewport(next);
      const layout = computeCallLayout(viewport);
      const elapsedMs = randomElapsed(next);
      const ringing = next() < 0.5;
      const animateEntry = next() < 0.5;
      const base: MotionInput = {
        elapsedMs,
        animateEntry,
        ringing,
        reducedMotion: false,
        layout,
        viewport,
      };
      const label = `seed ${SEED}, case ${index}: ${JSON.stringify({
        viewport,
        elapsedMs,
        ringing,
        animateEntry,
      })}`;

      // Reduced motion: no offset at all, in every combination.
      for (const entry of [true, false]) {
        for (const ring of [true, false]) {
          const offset = phoneMotionOffset({
            ...base,
            animateEntry: entry,
            ringing: ring,
            reducedMotion: true,
          });
          expect(offset, `${label} (reduced, entry ${entry}, ringing ${ring})`).toBe(0);
        }
      }

      // Entry at time 0: the screen starts fully outside the viewport (left edge at or past
      // the right edge of the viewport), whether or not the phone is ringing.
      const startOffset = phoneMotionOffset({ ...base, elapsedMs: 0, animateEntry: true });
      expect(layout.screen.left + startOffset, `${label} (start)`).toBeGreaterThanOrEqual(
        viewport.width - EPSILON,
      );

      const offset = phoneMotionOffset(base);
      expect(Number.isFinite(offset), `${label} (finite)`).toBe(true);

      if (!animateEntry || elapsedMs >= ENTRY_DURATION_MS) {
        // The entry part is 0 from ENTRY_DURATION_MS on: the offset equals the one without entry.
        const withoutEntry = phoneMotionOffset({ ...base, animateEntry: false });
        expect(offset, `${label} (entry part after entry)`).toBe(withoutEntry);

        if (ringing) {
          afterEntryRinging += 1;
          if (offset !== 0) nonZeroVibration += 1;
          expect(Math.abs(offset), `${label} (vibration amplitude)`).toBeLessThanOrEqual(
            0.02 * layout.screen.height + EPSILON,
          );
        } else {
          afterEntryNotRinging += 1;
          expect(offset, `${label} (not ringing)`).toBe(0);
        }
      }
    }

    // Guard against a vacuous pass: both post-entry branches ran and vibration was seen.
    expect(afterEntryRinging).toBeGreaterThan(0);
    expect(afterEntryNotRinging).toBeGreaterThan(0);
    expect(nonZeroVibration).toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);
});

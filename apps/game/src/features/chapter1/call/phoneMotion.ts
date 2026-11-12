/**
 * Entry and ringing vibration offsets for the 3D call phone.
 *
 * Pure TypeScript: no imports from three, React or i18n. The result is a horizontal offset in
 * CSS pixels that the phone model adds to `layout.screen.left` before solving its pose, so the
 * projected screen rectangle and the HTML screen content move together.
 */
import type { CallLayout, Viewport } from "./callLayout";

/** Duration of the entry slide, in milliseconds (within 200 to 600 ms, Requirement 6.3). */
export const ENTRY_DURATION_MS = 400;
/** Vibration amplitude as a fraction of the screen height (below 2%, Requirement 6.5). */
export const VIBRATION_AMPLITUDE_RATIO = 0.015;
/** One vibration burst starts every period, matching the old 2D icon. */
export const VIBRATION_PERIOD_MS = 1400;
/** Length of each vibration burst at the start of a period. */
export const VIBRATION_BURST_MS = 450;
/** Oscillation frequency inside a burst. */
export const VIBRATION_FREQUENCY_HZ = 12;

export interface MotionInput {
  /** Milliseconds since the presentation opened in model mode. */
  elapsedMs: number;
  /** False when the model framed late (switch from fallback); the phone then appears in place. */
  animateEntry: boolean;
  ringing: boolean;
  reducedMotion: boolean;
  layout: CallLayout;
  viewport: Viewport;
}

function easeOutCubic(progress: number): number {
  const inverse = 1 - progress;
  return 1 - inverse * inverse * inverse;
}

/** Horizontal offset in CSS px to add to `layout.screen.left` this frame. */
export function phoneMotionOffset(input: MotionInput): number {
  if (input.reducedMotion) return 0;

  const elapsed = Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : 0;

  // Entry: slide in from the right, starting fully outside the viewport.
  if (input.animateEntry && elapsed < ENTRY_DURATION_MS) {
    const start = input.viewport.width - input.layout.screen.left;
    return start * (1 - easeOutCubic(elapsed / ENTRY_DURATION_MS));
  }

  if (!input.ringing) return 0;

  // Vibration: short bursts at the start of each period, only while ringing.
  const phase = elapsed % VIBRATION_PERIOD_MS;
  if (phase >= VIBRATION_BURST_MS) return 0;
  const amplitude = VIBRATION_AMPLITUDE_RATIO * input.layout.screen.height;
  return amplitude * Math.sin(2 * Math.PI * VIBRATION_FREQUENCY_HZ * (elapsed / 1000));
}

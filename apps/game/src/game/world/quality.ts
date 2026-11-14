/**
 * Adaptive render-scale mechanism, shared by the imperative engines (Hue, Mekong). Decides when
 * to lower or raise a pixel ratio from windowed average frame time; it never touches a renderer
 * itself. The owning engine supplies the current ratio, the policy (thresholds, step, streaks)
 * and an `onChange` callback that applies the new ratio however and whenever that engine needs
 * to (immediately, like Hue, or deferred to just before the next draw, like Mekong's black-flash
 * fix). Map-specific thresholds, the floor/ceiling and the deferred-apply choice stay in the
 * engine; this module is only the mechanism.
 */

export interface AdaptiveQualityPolicy {
  /** Starting (and initial ceiling) pixel ratio. */
  initial: number;
  /** Never returns a ratio below this. */
  min: number;
  /** Never returns a ratio above this; changeable at runtime via `setCeiling`. */
  max: number;
  /** How much one step changes the ratio. */
  step: number;
  /** Measurement window, in seconds. Mirrors both engines' 2-second windows. */
  windowSeconds: number;
  /** Average frame time (seconds) above which a window counts as slow. */
  slowFrameSeconds: number;
  /** Average frame time (seconds) below which a window counts as fast. */
  fastFrameSeconds: number;
  /** Consecutive slow windows needed before dropping a step. 1 reacts on the first slow window. */
  dropStreak: number;
  /** Consecutive fast windows needed before rising a step. 1 reacts on the first fast window. */
  riseStreak: number;
  /**
   * After a rise is immediately followed by a drop, stop trying to rise again until the ceiling
   * or floor changes (`setCeiling`) or `reset()` is called. Keeps the ratio from oscillating at a
   * borderline frame rate. Hue's original code has no such ratchet; Mekong's does.
   */
  lockUpgradesAfterRevert: boolean;
  /** Smallest change worth acting on (avoids float-noise churn at the ceiling/floor). */
  epsilon: number;
  onChange: (ratio: number) => void;
}

/** Read-only snapshot for debug/diagnostic inspection. */
export interface AdaptiveQualityState {
  current: number;
  pending: number;
  min: number;
  max: number;
  slowWindows: number;
  fastWindows: number;
  upgradesLocked: boolean;
  lastMove: 'none' | 'down' | 'up';
}

export class AdaptiveQuality {
  private policy: AdaptiveQualityPolicy;
  private current: number;
  private pending: number;
  private windowAcc = 0;
  private windowFrames = 0;
  private windowTimer = 0;
  private slowWindows = 0;
  private fastWindows = 0;
  private upgradesLocked = false;
  private lastMove: 'none' | 'down' | 'up' = 'none';

  constructor(policy: AdaptiveQualityPolicy) {
    this.policy = policy;
    this.current = policy.initial;
    this.pending = policy.initial;
  }

  /** Feeds one frame's time (seconds) and updates the pending ratio when a window closes. */
  update(frameSeconds: number): void {
    const policy = this.policy;
    this.windowAcc += frameSeconds;
    this.windowFrames++;
    this.windowTimer += frameSeconds;
    if (this.windowTimer < policy.windowSeconds) return;

    const average = this.windowAcc / Math.max(1, this.windowFrames);
    this.windowAcc = 0;
    this.windowFrames = 0;
    this.windowTimer = 0;

    if (average > policy.slowFrameSeconds) {
      this.slowWindows++;
      this.fastWindows = 0;
    } else if (average < policy.fastFrameSeconds) {
      this.fastWindows++;
      this.slowWindows = 0;
    } else {
      this.slowWindows = 0;
      this.fastWindows = 0;
    }

    if (this.slowWindows >= policy.dropStreak) {
      this.slowWindows = 0;
      if (this.pending > policy.min + policy.epsilon) {
        this.pending = Math.max(policy.min, this.pending - policy.step);
        if (policy.lockUpgradesAfterRevert && this.lastMove === 'up') this.upgradesLocked = true;
        this.lastMove = 'down';
      }
    } else if (this.fastWindows >= policy.riseStreak && !this.upgradesLocked) {
      this.fastWindows = 0;
      if (this.pending < policy.max - policy.epsilon) {
        this.pending = Math.min(policy.max, this.pending + policy.step);
        this.lastMove = 'up';
      }
    }
  }

  /**
   * Fires `onChange` if the pending ratio differs from the current one by more than `epsilon`,
   * and remembers the new current ratio. Mekong calls this right before drawing (a resize clears
   * the canvas, so changing it after a frame and waiting for the next one would show a blank
   * frame in between); Hue calls it right after `update()`, in the same place it always set the
   * ratio. Calling it more than once per frame is harmless (idempotent once applied).
   */
  commit(): void {
    if (Math.abs(this.pending - this.current) <= this.policy.epsilon) return;
    this.current = this.pending;
    this.policy.onChange(this.current);
  }

  /** The ratio currently applied (after the last `commit()`), not the pending one. */
  getCurrent(): number {
    return this.current;
  }

  /**
   * Changes the ceiling (for example entering/leaving a performance mode). `jumpTo` snaps the
   * pending ratio straight to the new ceiling with no step, matching Mekong's `setPerformanceMode`;
   * omit it to only change the ceiling for future steps. Resets the streak counters either way;
   * `lockUpgradesAfterRevert`'s lock itself is left alone unless `unlock` is also passed, so a
   * ratchet from before the mode change still holds afterwards.
   */
  setCeiling(max: number, options: { jumpTo?: boolean; unlock?: boolean } = {}): void {
    this.policy.max = max;
    this.slowWindows = 0;
    this.fastWindows = 0;
    if (options.unlock) this.upgradesLocked = false;
    if (options.jumpTo) this.pending = max;
    else if (this.pending > max) this.pending = max;
  }

  /** Full reset: streaks, ratchet and move history, without changing the current ratio. */
  reset(): void {
    this.slowWindows = 0;
    this.fastWindows = 0;
    this.upgradesLocked = false;
    this.lastMove = 'none';
    this.windowAcc = 0;
    this.windowFrames = 0;
    this.windowTimer = 0;
  }

  getState(): AdaptiveQualityState {
    return {
      current: this.current,
      pending: this.pending,
      min: this.policy.min,
      max: this.policy.max,
      slowWindows: this.slowWindows,
      fastWindows: this.fastWindows,
      upgradesLocked: this.upgradesLocked,
      lastMove: this.lastMove,
    };
  }
}

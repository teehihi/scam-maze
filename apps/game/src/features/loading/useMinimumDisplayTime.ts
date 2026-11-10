import { useEffect, useState } from "react";

/**
 * Minimum display time ("hold") for a loading screen.
 *
 * Returns `false` until `minMs` milliseconds have passed since the hook
 * mounted, then `true`. Changing `resetKey` (for example a retry attempt
 * counter) clears the running timer and starts a new hold. The timer is
 * cleared on unmount.
 *
 * This hook is presentation-only. It receives no progress and returns no
 * progress, and it must never decide whether loading succeeded. Progress,
 * stages and errors always come from the real loading source.
 */
export function useMinimumDisplayTime(minMs: number, resetKey?: unknown): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    setElapsed(false);
    const timer = setTimeout(() => setElapsed(true), minMs);
    return () => clearTimeout(timer);
  }, [minMs, resetKey]);

  return elapsed;
}

export interface LoadingScreenVisibilityInput {
  /** The real loading source has finished (for example the chapter session exists). */
  done: boolean;
  /** The minimum display time from `useMinimumDisplayTime` has passed. */
  minElapsed: boolean;
  /** The player chose to leave (Cancel, Back to menu, Continue to menu); skips the hold. */
  bypassed: boolean;
}

/**
 * Visibility rule for loading screens: the screen stays visible until loading
 * is done and the minimum display time has passed, or until the player
 * bypasses it. Presentation-only; it never affects loading results.
 */
export function shouldShowLoadingScreen({ done, minElapsed, bypassed }: LoadingScreenVisibilityInput): boolean {
  return !bypassed && !(done && minElapsed);
}

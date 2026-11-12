/**
 * Per-page channel from the canvas to the DOM for the projected phone screen rectangle.
 *
 * The 3D phone publishes a rectangle every frame; the DOM screen host subscribes and writes
 * the style directly, so the per-frame rectangle never goes through React state. Pure
 * TypeScript: no React, three or i18n imports.
 */
import type { Rect } from "./callLayout";

export interface PhoneScreenSink {
  /** Publishes a rectangle, or `null` when the 3D phone unmounts or loses the model. */
  publish(rect: Rect | null): void;
  /** The last forwarded rectangle, or `null`. */
  current(): Rect | null;
  /** Adds a listener; returns a function that removes it. */
  subscribe(listener: (rect: Rect | null) => void): () => void;
}

/** Changes smaller than this on every edge (CSS px) are ignored. */
const EDGE_TOLERANCE_PX = 0.25;

function edges(rect: Rect): [number, number, number, number] {
  return [rect.left, rect.top, rect.left + rect.width, rect.top + rect.height];
}

function isNegligibleChange(previous: Rect, next: Rect): boolean {
  const a = edges(previous);
  const b = edges(next);
  return a.every((value, index) => Math.abs(value - b[index]) < EDGE_TOLERANCE_PX);
}

export function createPhoneScreenSink(): PhoneScreenSink {
  let last: Rect | null = null;
  const listeners = new Set<(rect: Rect | null) => void>();

  return {
    publish(rect) {
      if (rect !== null && last !== null && isNegligibleChange(last, rect)) return;
      last = rect === null ? null : { ...rect };
      for (const listener of [...listeners]) listener(last);
    },
    current() {
      return last;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

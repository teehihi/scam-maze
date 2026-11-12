/**
 * Per-page channel from the canvas to the DOM for the projected phone screen rectangle.
 *
 * The 3D phone publishes a rectangle every frame; the DOM screen host subscribes and writes
 * the style directly, so the per-frame rectangle never goes through React state. Pure
 * TypeScript: no React, three or i18n imports.
 */
import type { Rect } from "./callLayout";
import type { ScreenQuad } from "./screenQuad";

/**
 * Where the screen is drawn: the bounding rectangle, plus the projected corners when the 3D
 * phone is tilted (the host then maps the DOM screen onto that quad).
 */
export interface ScreenPlacement extends Rect {
  quad?: ScreenQuad;
}

export interface PhoneScreenSink {
  /** Publishes a rectangle, or `null` when the 3D phone unmounts or loses the model. */
  publish(rect: ScreenPlacement | null): void;
  /** The last forwarded rectangle, or `null`. */
  current(): ScreenPlacement | null;
  /** Adds a listener; returns a function that removes it. */
  subscribe(listener: (rect: ScreenPlacement | null) => void): () => void;
}

/** Changes smaller than this on every edge (CSS px) are ignored. */
const EDGE_TOLERANCE_PX = 0.25;

function edges(rect: ScreenPlacement): number[] {
  const values = [rect.left, rect.top, rect.left + rect.width, rect.top + rect.height];
  for (const point of rect.quad ?? []) values.push(point.x, point.y);
  return values;
}

function isNegligibleChange(previous: ScreenPlacement, next: ScreenPlacement): boolean {
  const a = edges(previous);
  const b = edges(next);
  if (a.length !== b.length) return false;
  return a.every((value, index) => Math.abs(value - b[index]) < EDGE_TOLERANCE_PX);
}

export function createPhoneScreenSink(): PhoneScreenSink {
  let last: ScreenPlacement | null = null;
  const listeners = new Set<(rect: ScreenPlacement | null) => void>();

  return {
    publish(rect) {
      if (rect !== null && last !== null && isNegligibleChange(last, rect)) return;
      last = rect === null ? null : { ...rect, ...(rect.quad ? { quad: [...rect.quad] as unknown as ScreenQuad } : null) };
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

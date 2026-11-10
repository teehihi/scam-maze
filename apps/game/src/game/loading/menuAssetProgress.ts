/**
 * Byte download progress for the main menu street file (Street_GLB).
 *
 * Framework-free: no React, three.js or timers. The value only changes in response to
 * progress events, download completion or a reset, so the startup screen can show an
 * honest percentage that never goes backwards.
 */

/** A download progress report, shaped like the DOM `ProgressEvent` emitted by three's FileLoader. */
export interface ByteProgressEvent {
  loaded: number;
  total: number;
  lengthComputable: boolean;
}

export interface ByteProgressStore {
  /** Byte_Percent: null while unknown, otherwise an integer 0..100. */
  getPercent(): number | null;
  subscribe(listener: () => void): () => void;
  report(event: ByteProgressEvent): void;
  markComplete(): void;
  reset(): void;
}

/** Highest percent a progress event may produce; 100 is reserved for Download_Complete. */
const MAX_EVENT_PERCENT = 99;

/** Candidate percent for one event, or null when the event has no known total. */
export function percentFromEvent(event: ByteProgressEvent): number | null {
  const { loaded, total, lengthComputable } = event;
  if (lengthComputable !== true) return null;
  if (!Number.isFinite(total) || total <= 0) return null;
  if (!Number.isFinite(loaded) || loaded < 0) return null;
  // The cap also absorbs `loaded > total`, which can happen with compressed responses.
  return Math.min(MAX_EVENT_PERCENT, Math.floor((loaded / total) * 100));
}

/** Highest download percent for one file. Never decreases until reset. */
export function createByteProgressStore(): ByteProgressStore {
  let percent: number | null = null;
  const listeners = new Set<() => void>();

  const setPercent = (next: number | null): void => {
    if (next === percent) return;
    percent = next;
    // Copy so that listeners can unsubscribe while being notified.
    for (const listener of [...listeners]) listener();
  };

  const getPercent = (): number | null => percent;

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const report = (event: ByteProgressEvent): void => {
    const candidate = percentFromEvent(event);
    if (candidate === null) return;
    if (percent !== null && candidate <= percent) return;
    setPercent(candidate);
  };

  const markComplete = (): void => {
    setPercent(100);
  };

  const reset = (): void => {
    setPercent(null);
  };

  return { getPercent, subscribe, report, markComplete, reset };
}

/** Singleton for the main menu Street_GLB. */
export const menuAssetProgress: ByteProgressStore = createByteProgressStore();

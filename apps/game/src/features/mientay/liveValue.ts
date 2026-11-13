import { useSyncExternalStore } from 'react';

/**
 * A value that changes many times a second (speed, position, FPS) and is shown in a tiny part of
 * the screen. Only the component that reads it re-renders; the page and the rest of the HUD do not.
 */
export interface LiveValue<T> {
  get: () => T;
  set: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createLiveValue<T>(initial: T): LiveValue<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (value) => {
      if (Object.is(value, current)) return;
      current = value;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useLiveValue<T>(source: LiveValue<T>): T {
  return useSyncExternalStore(source.subscribe, source.get, source.get);
}

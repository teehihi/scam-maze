// React binding for the Chapter_Store.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Store (`store.ts`)".
//
// `useSyncExternalStore` compares snapshots with Object.is, so the selector must return a
// stable reference for the same state: a state slice, a primitive, or a selector from
// `game/narrative/selectors.ts` (those are memoized by state identity).

import { useCallback, useSyncExternalStore } from "react";
import type { ChapterStore } from "../../game/narrative/store";
import type { ChapterState } from "../../game/narrative/types";

export function useChapterState(store: ChapterStore): ChapterState;
export function useChapterState<T>(store: ChapterStore, selector: (state: ChapterState) => T): T;
export function useChapterState<T>(
  store: ChapterStore,
  selector?: (state: ChapterState) => T,
): T | ChapterState {
  const getSnapshot = useCallback(
    () => (selector ? selector(store.getState()) : store.getState()),
    [store, selector],
  );
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

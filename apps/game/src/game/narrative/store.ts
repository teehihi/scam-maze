// Chapter_Store: a small framework-free store for the Chapter_State.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Store (`store.ts`)", and Requirement 5.8.
//
// The methods are closures over local variables, so they can be passed around unbound
// (for example `useSyncExternalStore(store.subscribe, store.getState)`).

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { chapterReducer } from "./reducer";
import type { ActionResult, ChapterState, CoreAction, ScenarioDefinition } from "./types";

export interface ChapterStore {
  getState(): ChapterState;
  dispatch(action: CoreAction): ActionResult;
  subscribe(listener: () => void): () => void;
  /** Used by restore and restart; notifies once. */
  replace(state: ChapterState): void;
}

export function createChapterStore(
  initial: ChapterState,
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): ChapterStore {
  let state = initial;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    // Copy first, so a listener that subscribes or unsubscribes does not change this pass.
    for (const listener of [...listeners]) listener();
  };

  const getState = (): ChapterState => state;

  const dispatch = (action: CoreAction): ActionResult => {
    const result = chapterReducer(state, action, scenario);
    // Requirement 5.8: notify only when the action is accepted.
    if (result.accepted) {
      state = result.state;
      notify();
    }
    return result;
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const replace = (next: ChapterState): void => {
    state = next;
    notify();
  };

  return { getState, dispatch, subscribe, replace };
}

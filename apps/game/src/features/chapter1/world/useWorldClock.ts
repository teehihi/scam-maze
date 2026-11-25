// Free-roam clock: while the player explores, simulated time passes by itself. It dispatches
// `ADVANCE_TIME`; the reducer decides what is due. Quiet ticks merge into one saved action, so
// this adds no growth to the save while nothing happens.
import { useEffect } from "react";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ScenarioDefinition } from "../../../game/narrative/types";
import { gameplayConfig } from "../../../game/narrative/world";

export interface WorldClockOptions {
  store: ChapterStore;
  scenario: ScenarioDefinition;
  /** True only while the player is free in the room: no intro, overlay, call, pause or ending. */
  running: boolean;
  isPaused?: () => boolean;
}

export function useWorldClock({ store, scenario, running, isPaused }: WorldClockOptions): void {
  const config = gameplayConfig(scenario);
  useEffect(() => {
    if (!running || !config.clockRuns) return undefined;
    const id = window.setInterval(() => {
      // A hidden tab does not advance the story.
      if (document.hidden || isPaused?.()) return;
      store.dispatch({ type: "ADVANCE_TIME", minutes: config.tickMinutes });
    }, config.tickMinutes * config.msPerGameMinute);
    return () => window.clearInterval(id);
  }, [store, running, isPaused, config.clockRuns, config.tickMinutes, config.msPerGameMinute]);
}
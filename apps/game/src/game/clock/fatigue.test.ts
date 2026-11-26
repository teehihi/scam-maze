// Fatigue: a persistent, bounded resource that slows thesis work and never ends the chapter.
import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO, FOUNDATION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { MISSION_01_CONFIG } from "../narrative/chapter1/mission01";
import { DEFAULT_FATIGUE_CONFIG, effectiveWorkMinutes, fatigueLevel, workSlowdown } from "../narrative/fatigue";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import { CHAPTER_DURATION_MINUTES, minutesFromStart } from "../narrative/resources";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../narrative/types";
import { gameplayConfig, selectThesisView } from "../narrative/world";

const S = LAST_SUBMISSION_SCENARIO;
const CFG = gameplayConfig(S).fatigue;
/** Minutes of free work per thesis percent in the playable chapter. */
const MPP = gameplayConfig(S).thesisMinutesPerPercent;
const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const work = (minutes: number): CoreAction => ({ type: "WORK_ON_THESIS", minutes });
const rest = (mode: "nap" | "sleep"): CoreAction => ({ type: "REST", mode });
const task = (taskId: string): CoreAction => ({ type: "COMPLETE_THESIS_TASK", taskId });

function step(state: ChapterState, action: CoreAction, scenario: ScenarioDefinition = S): ChapterState {
  const result = chapterReducer(state, action, scenario);
  expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
  return result.state;
}
const run = (actions: CoreAction[], from: ChapterState = createInitialState(S), scenario: ScenarioDefinition = S) =>
  actions.reduce((state, action) => step(state, action, scenario), from);
const withFatigue = (state: ChapterState, fatigue: number): ChapterState => ({ ...state, resources: { ...state.resources, fatigue } });

describe("fatigue rules", () => {
  it("are on in the playable chapter and off in the bare foundation", () => {
    expect(CFG.enabled).toBe(true);
    expect(gameplayConfig(FOUNDATION_SCENARIO).fatigue.enabled).toBe(false);
  });

  it("start at a configured level and the HUD level is derived from the number", () => {
    const state = run([START]);
    expect(state.resources.fatigue).toBe(20);
    expect(fatigueLevel(20, CFG)).toBe("rested");
    expect(fatigueLevel(CFG.tiredAt, CFG)).toBe("tired");
    expect(fatigueLevel(CFG.exhaustedAt, CFG)).toBe("exhausted");
  });

  it("rise with thesis work in proportion to its length", () => {
    const state = run([START, work(60), work(60)]);
    expect(state.resources.fatigue).toBe(20 + 2 * CFG.perThesisHour);
    expect(state.resources.thesisProgress).toBe(60 + 2 * (60 / MPP));
  });

  it("rise with thesis tasks by their time", () => {
    const state = run([START, task("draft.final")]);
    expect(state.resources.fatigue).toBe(20 + Math.round((60 * CFG.perThesisHour) / 60));
  });

  it("slow thesis work down once Alex is tired, up to the configured limit", () => {
    expect(workSlowdown(CFG.tiredAt, CFG)).toBe(1);
    expect(workSlowdown(100, CFG)).toBeCloseTo(1 + CFG.maxSlowdown);
    expect(effectiveWorkMinutes(60, 100, CFG)).toBe(Math.ceil(60 * (1 + CFG.maxSlowdown)));
    const tired = withFatigue(run([START]), 100);
    // A task shows and costs the longer time, but gives the same progress.
    const view = selectThesisView(tired, S).tasks.find((item) => item.id === "draft.final")!;
    expect(view.timeCostMinutes).toBe(Math.ceil(60 * (1 + CFG.maxSlowdown)));
    expect(view.progressGain).toBe(7);
    const after = step(tired, task("draft.final"));
    expect(tired.resources.timeMinutes - after.resources.timeMinutes).toBe(view.timeCostMinutes);
    expect(after.resources.thesisProgress).toBe(tired.resources.thesisProgress + 7);
  });

  it("make a free work session shorter in percent when the time given is the rested one", () => {
    const tired = withFatigue(run([START]), 100);
    const perPercent = effectiveWorkMinutes(MPP, 100, CFG);
    expect(chapterReducer(tired, work(MPP), S).reason).toBe("That is too little time to make progress.");
    const worked = step(tired, work(perPercent));
    expect(worked.resources.thesisProgress).toBe(tired.resources.thesisProgress + 1);
    expect(tired.resources.timeMinutes - worked.resources.timeMinutes).toBe(perPercent);
  });

  it("never end the chapter and never go outside 0 to 100", () => {
    let state = withFatigue(run([START]), 100);
    state = step(state, work(effectiveWorkMinutes(60, 100, CFG) * 3));
    expect(state.resources.fatigue).toBe(100);
    expect(state.status).toBe("playing");
    expect(state.outcome).toBeNull();
    const rested = run([rest("sleep"), rest("sleep"), rest("sleep")], withFatigue(state, 10));
    expect(rested.resources.fatigue).toBe(0);
  });

  it("go down with a short break and more with sleep, and both cost time", () => {
    const tired = withFatigue(run([START]), 60);
    const napped = step(tired, rest("nap"));
    expect(napped.resources.fatigue).toBe(60 - CFG.nap.recovery);
    expect(tired.resources.timeMinutes - napped.resources.timeMinutes).toBe(CFG.nap.minutes);
    const slept = step(tired, rest("sleep"));
    expect(slept.resources.fatigue).toBe(60 - CFG.sleep.recovery);
    expect(tired.resources.timeMinutes - slept.resources.timeMinutes).toBe(CFG.sleep.minutes);
  });

  it("cannot rest when there is no time left or when the scenario has no fatigue", () => {
    const over = run([START, advance(CHAPTER_DURATION_MINUTES)]);
    expect(chapterReducer(over, rest("nap"), S).reason).toBe("The deadline has passed.");
    const bare = createInitialState(FOUNDATION_SCENARIO);
    const started = step(bare, START, FOUNDATION_SCENARIO);
    expect(chapterReducer(started, rest("nap"), FOUNDATION_SCENARIO).reason).toBe("Resting is not part of this scenario.");
  });

  it("add missed sleep to a night without enough sleep, once", () => {
    const [first, second] = CFG.nightChecksAtMinute;
    const before = run([START, advance(first - 1)]);
    expect(before.resources.fatigue).toBe(20);
    const after = step(before, advance(1));
    expect(after.resources.fatigue).toBe(20 + CFG.missedSleepPenalty);
    // The same night is never counted twice.
    // The draft misses its internal deadline (Wednesday 06:00) in between: that night of work adds its own fatigue.
    const later = step(after, advance(second - first - 1));
    const overnight = MISSION_01_CONFIG.overnightFatigue;
    expect(later.resources.fatigue).toBe(20 + CFG.missedSleepPenalty + overnight);
    expect(step(later, advance(1)).resources.fatigue).toBe(20 + 2 * CFG.missedSleepPenalty + overnight);
  });

  it("add no missed sleep when Alex slept enough that night", () => {
    const [first] = CFG.nightChecksAtMinute;
    const state = run([START, advance(first - 400), rest("sleep"), advance(100)]);
    expect(state.resources.timeMinutes).toBeLessThan(CHAPTER_DURATION_MINUTES - first);
    expect(state.resources.fatigue).toBe(20 - CFG.sleep.recovery < 0 ? 0 : 20 - CFG.sleep.recovery);
  });

  it("add the cost of working through the night when the draft misses its internal deadline", () => {
    const late = run([START, advance(minutesFromStart(3, 6, 0))]);
    expect(late.persistent.overnightWork).toBe(true);
    // Missed sleep for the first night, and the night of work itself.
    expect(late.resources.fatigue).toBeGreaterThanOrEqual(20 + CFG.missedSleepPenalty);
    expect(late.status).toBe("playing");
  });

  it("stay across a save and restore", () => {
    const state = run([START, work(60), rest("nap"), advance(minutesFromStart(3, 4, 0))]);
    const restored = restoreProgress(JSON.parse(JSON.stringify(encodeProgress(state, null, "start"))), S);
    expect(restored.ok && restored.state).toEqual(state);
    expect(restored.ok && restored.state.resources.fatigue).toBe(state.resources.fatigue);
  });

  it("can be tuned in one place", () => {
    const custom: ScenarioDefinition = { ...S, gameplay: { ...S.gameplay, fatigue: { ...S.gameplay?.fatigue, perThesisHour: 12, missedSleepPenalty: 0 } } };
    const state = run([START, work(60)], createInitialState(custom), custom);
    expect(state.resources.fatigue).toBe(20 + 12);
    expect(gameplayConfig(custom).fatigue.tiredAt).toBe(DEFAULT_FATIGUE_CONFIG.tiredAt);
  });
});

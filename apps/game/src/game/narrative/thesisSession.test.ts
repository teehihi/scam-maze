import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "./chapter1/lastSubmission";
import { DEFAULT_FATIGUE_CONFIG } from "./fatigue";
import { chapterReducer, createInitialState } from "./reducer";
import {
  circadianAt,
  findSessionInterruptions,
  pickSessionMicroDecision,
  sessionCurveAt,
  simulateThesisSession,
} from "./thesisSession";

describe("thesisSession deep-work model", () => {
  it("follows a realistic Warm-up -> Peak Flow -> Burnout curve", () => {
    const warmup = sessionCurveAt(5, "normal");
    const peakFlow = sessionCurveAt(60, "normal");
    const burnout = sessionCurveAt(180, "normal");

    expect(warmup.phase).toBe("warmup");
    expect(peakFlow.phase).toBe("flow");
    expect(burnout.phase).toBe("burnout");
    expect(peakFlow.rate).toBeGreaterThan(warmup.rate);
    expect(peakFlow.rate).toBeGreaterThan(burnout.rate);
    expect(burnout.extraFatigueMult).toBeGreaterThan(1.2);
  });

  it("differentiates Normal, Deep Focus (DND), and Sprint modes meaningfully", () => {
    const base = {
      startElapsedMinutes: 0,
      plannedMinutes: 90,
      startFatigue: 10,
      startProgress: 60,
      freeWorkMaxPercent: 95,
      baseMinutesPerPercent: 12,
      fatigueConfig: { ...DEFAULT_FATIGUE_CONFIG, enabled: true },
    };
    const normal = simulateThesisSession({ ...base, mode: "normal" });
    const deep = simulateThesisSession({ ...base, mode: "deep" });
    const rush = simulateThesisSession({ ...base, mode: "rush" });

    expect(deep.progressGain).toBeGreaterThanOrEqual(normal.progressGain);
    expect(rush.fatigueGain).toBeGreaterThan(normal.fatigueGain);
    expect(rush.burnoutMinutes).toBeGreaterThan(deep.burnoutMinutes);
  });

  it("applies circadian slowdown between 01:00 and 05:00 AM", () => {
    // Story starts at 17:00; +8h (480m) is 01:00 AM.
    const evening = circadianAt(30);
    const lateNight = circadianAt(9 * 60); // 02:00 AM

    expect(evening.isLateNight).toBe(false);
    expect(lateNight.isLateNight).toBe(true);
    expect(lateNight.outputMult).toBeLessThan(evening.outputMult);
    expect(lateNight.fatigueMult).toBeGreaterThan(evening.fatigueMult);
  });

  it("predicts real Mission 01 scheduled interruptions inside a writing block", () => {
    const state = createInitialState(LAST_SUBMISSION_SCENARIO);
    // Starting at Tue 17:00 (elapsed 0), planning a 180m block covers 17:10 Clearance email & 19:30 Linh!
    const normalInterrupts = findSessionInterruptions(state, LAST_SUBMISSION_SCENARIO, 180, "normal");
    const deepInterrupts = findSessionInterruptions(state, LAST_SUBMISSION_SCENARIO, 180, "deep");

    expect(normalInterrupts.length).toBeGreaterThan(0);
    // Deep Focus suppresses non-urgent routine pings, so it has fewer interruptions than normal.
    expect(deepInterrupts.length).toBeLessThanOrEqual(normalInterrupts.length);
  });

  it("integrates deterministically with chapterReducer WORK_ON_THESIS focusMode", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;

    const r1 = chapterReducer(
      state,
      { type: "WORK_ON_THESIS", minutes: 90, focusMode: "deep" },
      LAST_SUBMISSION_SCENARIO,
    );
    const r2 = chapterReducer(
      state,
      { type: "WORK_ON_THESIS", minutes: 90, focusMode: "deep" },
      LAST_SUBMISSION_SCENARIO,
    );

    expect(r1.accepted).toBe(true);
    expect(r1.state.resources.thesisProgress).toBeGreaterThan(state.resources.thesisProgress);
    expect(r1.state.resources.fatigue).toBeGreaterThan(state.resources.fatigue);
    expect(r1.state.resources).toEqual(r2.state.resources);
  });

  it("picks section-appropriate 3-choice inline academic micro-decisions", () => {
    const early = pickSessionMicroDecision(40);
    const mid = pickSessionMicroDecision(75);
    const late = pickSessionMicroDecision(90);

    expect(early.id).not.toBe(mid.id);
    expect(mid.id).not.toBe(late.id);
    for (const d of [early, mid, late]) {
      expect(d.options).toHaveLength(3);
      expect(d.prompt.vi.length).toBeGreaterThan(10);
      expect(d.options.map((o) => o.effect)).toEqual(["flow_boost", "sprint_burst", "clear_strain"]);
    }
  });
});

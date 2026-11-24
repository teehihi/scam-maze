import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "./chapter1/lastSubmission";
import { DEFAULT_FATIGUE_CONFIG } from "./fatigue";
import { chapterReducer, createInitialState } from "./reducer";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
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

  it("picks section-appropriate 3-choice inline academic micro-decisions", () => {
    const early = pickSessionMicroDecision(40);
    const mid = pickSessionMicroDecision(75);
    const late = pickSessionMicroDecision(90);

    expect(early.id).not.toBe(mid.id);
    expect(mid.id).not.toBe(late.id);
    for (const decision of [early, mid, late]) {
      expect(decision.options).toHaveLength(3);
      expect(decision.prompt.vi.length).toBeGreaterThan(10);
      expect(decision.options.map((option) => option.effect)).toEqual(["flow_boost", "sprint_burst", "clear_strain"]);
    }
  });

  it("retains sub-percent work across short actions and resumes the same session curve", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;
    const first = chapterReducer(state, { type: "WORK_ON_THESIS", minutes: 1, focusMode: "normal" }, LAST_SUBMISSION_SCENARIO);
    const second = chapterReducer(first.state, { type: "WORK_ON_THESIS", minutes: 1, focusMode: "normal", sessionElapsedMinutes: 1 }, LAST_SUBMISSION_SCENARIO);

    expect(first.accepted).toBe(true);
    expect(first.state.resources.thesisProgress).toBe(60);
    expect(first.state.world.thesisWorkRemainderUnits).toBeGreaterThan(0);
    expect(second.accepted).toBe(true);
    expect(second.state.resources.thesisProgress).toBe(60);
    expect(second.state.world.thesisWorkRemainderUnits).toBeGreaterThan(first.state.world.thesisWorkRemainderUnits);
    expect(second.state.resources.timeMinutes).toBe(72 * 60 - 2);

    const continued = simulateThesisSession({
      startElapsedMinutes: 10,
      sessionElapsedMinutes: 20,
      plannedMinutes: 1,
      startFatigue: 20,
      startProgress: 60,
      freeWorkMaxPercent: 90,
      baseMinutesPerPercent: 60,
      mode: "normal",
    });
    expect(continued.samples[0]?.phase).toBe("flow");
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

  it("lets a long block break on fatigue, recover while paused, and retain its work remainder", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;
    state = chapterReducer(state, { type: "ADVANCE_TIME", minutes: 10 }, LAST_SUBMISSION_SCENARIO).state;
    state = {
      ...state,
      resources: { ...state.resources, fatigue: 39 },
      world: {
        ...state.world,
        events: Object.fromEntries((LAST_SUBMISSION_SCENARIO.events ?? []).map((event) => [event.id, { status: "resolved" as const, firedAtMinute: 0, resolvedAtMinute: 0, postponed: 0, response: null }])),
      },
      device: {
        ...state.device,
        items: Object.fromEntries((LAST_SUBMISSION_SCENARIO.deviceItems ?? []).map((item) => [item.id, { arrivedAtMinute: 0, read: true, readAtMinute: 0, done: [] }])),
      },
    };
    const interruption = findSessionInterruptions(state, LAST_SUBMISSION_SCENARIO, 120, "deep");
    expect(interruption[0]?.kind).toBe("eye_strain");

    const started = chapterReducer(state, { type: "START_THESIS_SESSION", minutes: 120, mode: "deep" }, LAST_SUBMISSION_SCENARIO);
    expect(started.accepted).toBe(true);
    expect(started.state.world.thesisWorkSession?.interruption.kind).toBe("eye_strain");
    const pausedTime = started.state.resources.timeMinutes;
    const pausedRemainder = started.state.world.thesisWorkSession!.remainingMinutes;
    const rested = chapterReducer(started.state, { type: "REST", mode: "nap" }, LAST_SUBMISSION_SCENARIO);
    expect(rested.accepted).toBe(true);
    expect(rested.state.world.thesisWorkSession?.remainingMinutes).toBe(pausedRemainder);
    expect(rested.state.resources.fatigue).toBeLessThan(started.state.resources.fatigue);
    expect(rested.state.resources.timeMinutes).toBe(pausedTime - DEFAULT_FATIGUE_CONFIG.nap.minutes);
    const resumed = chapterReducer(rested.state, { type: "RESUME_THESIS_SESSION" }, LAST_SUBMISSION_SCENARIO);
    expect(resumed.accepted).toBe(true);
    expect(resumed.state.world.thesisWorkSession).toBeNull();
    expect(resumed.state.resources.thesisProgress).toBeGreaterThan(60);
  });

  it("keeps an interruption remainder through save replay and resumes it without restarting the curve", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;
    const started = chapterReducer(state, { type: "START_THESIS_SESSION", minutes: 30, mode: "normal" }, LAST_SUBMISSION_SCENARIO);
    expect(started.accepted).toBe(true);
    expect(started.state.resources.timeMinutes).toBe(72 * 60 - 10);
    expect(started.state.world.thesisWorkSession).toMatchObject({ remainingMinutes: 20, elapsedMinutes: 10, mode: "normal" });
    expect(started.state.world.thesisWorkSession?.interruption.id).toMatch(/^(ev|item):/);

    const progress = encodeProgress(started.state, null, "autosave");
    expect(progress).not.toBeNull();
    const restored = restoreProgress(progress!, LAST_SUBMISSION_SCENARIO);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.state.world.thesisWorkSession).toEqual(started.state.world.thesisWorkSession);
    expect(restored.state.world.thesisWorkRemainderUnits).toBe(started.state.world.thesisWorkRemainderUnits);

    const resumed = chapterReducer(restored.state, { type: "RESUME_THESIS_SESSION" }, LAST_SUBMISSION_SCENARIO);
    expect(resumed.accepted).toBe(true);
    expect(resumed.state.resources.timeMinutes).toBe(72 * 60 - 30);
    expect(resumed.state.world.thesisWorkSession).toBeNull();
  });

});

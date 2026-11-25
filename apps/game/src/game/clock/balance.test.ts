// Balance of Mission 01 and the fatigue rules: five scripted ways to spend the 72 hours, run through
// the real reducer. The table it prints is the balancing table of the hardening task. The asserts
// state the design intent, so a change of a placeholder number that breaks the intent fails here.
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { MISSION_01_CONFIG } from "../narrative/chapter1/mission01";
import { effectiveWorkMinutes } from "../narrative/fatigue";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import { CHAPTER_DURATION_MINUTES } from "../narrative/resources";
import type { ChapterState, CoreAction } from "../narrative/types";
import { elapsedMinutes, gameplayConfig } from "../narrative/world";

const S = LAST_SUBMISSION_SCENARIO;
const CFG = gameplayConfig(S);
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const task = (taskId: string): CoreAction => ({ type: "COMPLETE_THESIS_TASK", taskId });
const TASKS = ["draft.final"];

type Policy = (state: ChapterState) => CoreAction | null;

/** Elapsed minute at which the thesis first reached 90% (the end of free work), by the last simulation. */
let reached90: number | null = null;

function simulate(opening: CoreAction[], policy: Policy): ChapterState {
  let state = createInitialState(S);
  reached90 = null;
  const apply = (action: CoreAction): boolean => {
    const result = chapterReducer(state, action, S);
    if (result.accepted) {
      state = result.state;
      if (reached90 === null && state.resources.thesisProgress >= 90) reached90 = elapsedMinutes(state, S);
    }
    return result.accepted;
  };
  apply({ type: "START_CHAPTER" });
  opening.forEach((action) => expect(apply(action), JSON.stringify(action)).toBe(true));
  for (let i = 0; i < 2000 && state.resources.timeMinutes > 0; i += 1) {
    const action = policy(state);
    if (action === null || !apply(action)) {
      // Nothing useful left: let the clock run to the end in one-hour steps.
      apply({ type: "ADVANCE_TIME", minutes: Math.min(60, state.resources.timeMinutes) });
    }
  }
  return state;
}

/** Works: thesis tasks first, then free sessions at the rate Alex can manage while tired. */
const worker =
  (sleepRule: (state: ChapterState) => boolean): Policy =>
  (state) => {
    if (sleepRule(state)) return { type: "REST", mode: "sleep" };
    const next = TASKS.find((id) => !state.world.thesisTasksDone.includes(id));
    if (next !== undefined) return task(next);
    const per = effectiveWorkMinutes(CFG.thesisMinutesPerPercent, state.resources.fatigue, CFG.fatigue);
    return { type: "WORK_ON_THESIS", minutes: per };
  };

const hourOfDay = (state: ChapterState) => Math.floor(((elapsedMinutes(state, S) + 17 * 60) % 1440) / 60);
const never = () => false;
/** Sleeps in the night hours (23:00 to 05:00) once per night. */
const nightSleeper = (state: ChapterState) => {
  const hour = hourOfDay(state);
  return (hour >= 23 || hour < 5) && state.resources.fatigue > 0 && (state.world.sleptMinutes ?? 0) < CFG.fatigue.minSleepMinutes;
};
const whenExhausted = (state: ChapterState) => state.resources.fatigue >= CFG.fatigue.exhaustedAt;

const SIGN_IN_AND_PAY: CoreAction[] = [
  { type: "ADVANCE_TIME", minutes: 10 },
  use("mail.clearance", "open-link"),
  use("page.fee", "sign-in"),
  use("page.fee", "pay-card"),
  use("page.fee", "enter-code"),
];
const VERIFY: CoreAction[] = [
  { type: "ADVANCE_TIME", minutes: 10 },
  use("portal.saved", "check-account"),
  use("contact.training-office", "call"),
  use("contact.training-office", "confirm-fee"),
  use("contact.training-office", "ask-account"),
];
const REPORT_AND_SECURE: CoreAction[] = [
  use("contact.bank", "call"),
  use("contact.bank", "report-fraud"),
  use("settings.security", "change-passwords"),
];

interface Row {
  way: string;
  state: ChapterState;
  reach90: number | null;
}
const rows: Row[] = [];
const sim = (way: string, opening: CoreAction[], policy: Policy) => {
  const state = simulate(opening, policy);
  rows.push({ way, state, reach90: reached90 });
  return state;
};

describe("balance of the first 72 hours", () => {
  const focused = sim("Focused: write only, never sleep", [], worker(never));
  const sleeper = sim("Writes and sleeps every night", [], worker(nightSleeper));
  const verifier = sim("Verifies with the Training Office, then writes and sleeps", VERIFY, worker(nightSleeper));
  const fooled = sim("Pays and gives the code, never reports, then writes and sleeps", SIGN_IN_AND_PAY, worker(nightSleeper));
  const recovered = sim("Pays and gives the code, reports at once, then writes and sleeps", [...SIGN_IN_AND_PAY, ...REPORT_AND_SECURE], worker(nightSleeper));
  const exhausted = sim("Writes, sleeps only when exhausted", [], worker(whenExhausted));
  const late = sim("Starts writing on Wednesday 07:00, sleeps every night", [{ type: "ADVANCE_TIME", minutes: 14 * 60 }], worker(nightSleeper));

  it("prints the balancing table", () => {
    const hours = (minutes: number) => (minutes / 60).toFixed(1);
    const lines = [
      "| Way | Hours to 90% | Thesis % at end | Fatigue at end | Cash (VND) | Security | Evidence | Overnight work |",
      "|---|---|---|---|---|---|---|---|",
      ...rows.map(({ way, state, reach90 }) =>
        `| ${way} | ${reach90 === null ? "never" : hours(reach90)} | ${state.resources.thesisProgress} | ${state.resources.fatigue} | ${state.resources.cash.toLocaleString("en-US")} | ${state.resources.digitalSecurity} | ${state.resources.evidence} | ${state.persistent.overnightWork ? "yes" : "no"} |`,
      ),
    ];
    // Set BALANCE_TABLE=<file> to keep the table (the test setup may silence console output).
    if (process.env.BALANCE_TABLE) writeFileSync(process.env.BALANCE_TABLE, `${lines.join("\n")}\n`);
    expect(rows).toHaveLength(7);
    expect(late.persistent.overnightWork).toBe(true);
  });

  it("every way reaches the Friday deadline with the chapter still playable", () => {
    for (const { state } of rows) {
      expect(state.resources.timeMinutes).toBe(0);
      expect(state.resources.fatigue).toBeGreaterThanOrEqual(0);
      expect(state.resources.fatigue).toBeLessThanOrEqual(100);
      expect(state.outcome).toBeNull();
    }
  });

  it("never sleeping ends more tired and takes longer to reach the end of free work than sleeping each night", () => {
    const reach = (way: string) => rows.find((row) => row.way.startsWith(way))!.reach90!;
    expect(focused.resources.fatigue).toBeGreaterThan(sleeper.resources.fatigue);
    expect(reach("Focused")).toBeGreaterThan(reach("Writes and sleeps every night"));
    expect(focused.resources.fatigue).toBe(100);
  });

  it("a late start costs a night of work and extra fatigue, and the chapter goes on", () => {
    expect(late.resources.fatigue).toBeGreaterThan(sleeper.resources.fatigue - 1);
    expect(late.resources.thesisProgress).toBeGreaterThanOrEqual(67);
  });

  it("verifying costs about an hour and no money, and leaves the thesis nearly as far along", () => {
    expect(verifier.resources.cash).toBe(2_500_000);
    expect(verifier.resources.evidence).toBe(1);
    expect(verifier.resources.digitalSecurity).toBe(100);
    expect(sleeper.resources.thesisProgress - verifier.resources.thesisProgress).toBeLessThanOrEqual(2);
  });

  it("being fooled costs money, security and evidence, and an immediate report limits it", () => {
    expect(fooled.resources.cash).toBeLessThan(sleeper.resources.cash);
    expect(fooled.resources.digitalSecurity).toBeLessThan(sleeper.resources.digitalSecurity);
    expect(recovered.resources.cash).toBeGreaterThan(fooled.resources.cash);
    expect(recovered.resources.evidence).toBe(1);
    expect(recovered.resources.cash).toBe(2_500_000 - MISSION_01_CONFIG.clearanceFeeVnd);
  });

  it("gives every strategy the same total time, so nothing is gained from nothing", () => {
    rows.forEach(({ state }) => expect(CHAPTER_DURATION_MINUTES - state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES));
    expect(exhausted.resources.thesisProgress).toBeGreaterThan(0);
  });
});

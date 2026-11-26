// Alex's Mission 02 story lines: when each one is reached (real reducer, real mission content), that a
// restored state never replays them, that every line has EN and VI captions, and that placeholders
// load nothing until their recordings exist.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../../../game/narrative/chapter1/lastSubmission";
import { MISSION_02_CONFIG, MISSION_02_EVENTS, MISSION_02_MISSIONS } from "../../../game/narrative/chapter1/mission02";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import enVoice from "../../../i18n/locales/en/chapter1/voice";
import viVoice from "../../../i18n/locales/vi/chapter1/voice";
import {
  mission02AlexClipPath,
  mission02AlexVoiceUrl,
  MISSION02_ALEX_CUES,
  MISSION02_ALEX_RECORDED,
  MISSION02_ALEX_STEMS,
  MISSION02_ALEX_SUPERSEDES,
  MISSION02_ALEX_VOICE_IDS,
  passedMission02AlexCues,
  reachedMission02AlexCues,
  type Mission02AlexCue,
} from "./mission02AlexVoice";
import { MISSION02_VOICE_PLACEHOLDERS, MISSION02_VOICE_STEMS } from "./mission02Voice";

const S = LAST_SUBMISSION_SCENARIO;
/** Mission 02 on its own (see `game/clock/mission02.test.ts`: the Mission 01 deadline would move the clock). */
const M02: ScenarioDefinition = {
  ...S,
  events: (S.events ?? []).filter((event) => MISSION_02_EVENTS.some((def) => def.id === event.id)),
  missions: (S.missions ?? []).filter((mission) => MISSION_02_MISSIONS.some((def) => def.id === mission.id)),
};
const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const OPEN_AT = advance(MISSION_02_CONFIG.opensAtMinute + 5);
const LATE = advance(MISSION_02_CONFIG.interviewEndMinute + 1);
const BUS = [use("travel.bus06", "pay-fare"), use("travel.bus06", "arrive")];

function run(actions: CoreAction[]): ChapterState {
  return actions.reduce((state, action) => {
    const result = chapterReducer(state, action, M02);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    return result.state;
  }, createInitialState(M02));
}
const reached = (actions: CoreAction[]): Mission02AlexCue[] => reachedMission02AlexCues(run(actions));

describe("Mission 02 Alex lines: triggers", () => {
  it("realises what Section 3.3 still needs after Minh's call, or after his message when the call was declined", () => {
    const DRAFT: CoreAction = { type: "COMPLETE_THESIS_TASK", taskId: "draft.final" };
    expect(reached([START, DRAFT])).toEqual([]);
    expect(reached([START, DRAFT, use("contact.minh", "call")])).toEqual(["m02Briefed"]);
    // Declining alone is not hearing it: the line waits until Minh's message is read.
    expect(reached([START, DRAFT, use("contact.minh", "decline")])).toEqual([]);
    expect(reached([START, DRAFT, use("contact.minh", "decline"), open("msg.m02-minh-reminder")])).toEqual(["m02Briefed"]);
    // Once Alex is at the market office the reminder no longer fits.
    expect(reached([START, DRAFT, use("contact.minh", "call"), OPEN_AT, ...BUS])).not.toContain("m02Briefed");
  });
  it("says nothing before the mission opens, then marks the mission's start", () => {
    expect(reached([START])).toEqual([]);
    expect(reached([START, OPEN_AT])).toEqual(["m02Open"]);
  });

  it("reacts to what the player prepares before leaving", () => {
    expect(reached([START, open("cal.m02-interview")])).toEqual(["m02Prepare"]);
    expect(reached([START, OPEN_AT, use("map.bus06-stop", "ask-driver")])).toContain("m02DriverOffer");
    expect(reached([START, OPEN_AT, use("map.bus06-stop", "read-board")])).toContain("m02RouteChecked");
    expect(reached([START, OPEN_AT, use("contact.coba", "confirm")])).toContain("m02Confirmed");
  });

  it("follows the Bus 06 trip and an on-time arrival", () => {
    expect(reached([START, OPEN_AT, BUS[0]])).toContain("m02OnBus");
    const arrived = reached([START, OPEN_AT, open("cal.m02-interview"), ...BUS]);
    expect(arrived).toContain("m02Arrived");
    // The getting-there lines no longer fit once Alex is at the market office.
    expect(arrived).not.toContain("m02OnBus");
    expect(arrived).not.toContain("m02Prepare");
    expect(arrived).not.toContain("m02ArrivedLate");
  });

  it("follows the cash ride to the wrong corner", () => {
    const met = [START, OPEN_AT, use("map.bus06-stop", "ask-driver"), use("contact.driver", "save-number")];
    expect(reached([...met, use("ride.off-platform", "take-ride")])).toContain("m02WrongStop");
    const walked = reached([...met, use("ride.off-platform", "take-ride"), use("ride.wrong-stop", "walk")]);
    expect(walked).not.toContain("m02WrongStop");
  });

  it("marks a late arrival, then the reschedule or leaving without it", () => {
    const late = reached([START, LATE, ...BUS]);
    expect(late).toContain("m02ArrivedLate");
    expect(late).not.toContain("m02Arrived");
    const rescheduled = reached([START, LATE, ...BUS, use("interview.coba", "reschedule")]);
    expect(rescheduled).toContain("m02Rescheduled");
    expect(rescheduled).not.toContain("m02ArrivedLate");
    const left = reached([START, LATE, ...BUS, use("interview.coba", "decline-reschedule")]);
    expect(left).toContain("m02LeftWithout");
    expect(left).not.toContain("m02ArrivedLate");
  });

  it("marks the success, on time or after a reschedule", () => {
    const onTime = reached([START, OPEN_AT, ...BUS, use("interview.coba", "start"), use("interview.coba", "ask-transfer")]);
    expect(onTime).toContain("m02InterviewDone");
    expect(onTime).not.toContain("m02Failed");
    const recovered = reached([
      START,
      LATE,
      ...BUS,
      use("interview.coba", "reschedule"),
      use("interview.coba", "start-rescheduled"),
      use("interview.coba", "ask-exception"),
    ]);
    expect(recovered).toContain("m02InterviewDone");
    expect(recovered).not.toContain("m02Rescheduled");
  });

  it("marks the failure at the deadline, but not after leaving on purpose", () => {
    const failed = reached([START, advance(MISSION_02_CONFIG.missionDeadlineMinute + 1)]);
    expect(failed).toContain("m02Failed");
    const leftThenDeadline = reached([
      START,
      LATE,
      ...BUS,
      use("interview.coba", "decline-reschedule"),
      advance(MISSION_02_CONFIG.missionDeadlineMinute - MISSION_02_CONFIG.interviewEndMinute),
    ]);
    expect(leftThenDeadline).toContain("m02LeftWithout");
    expect(leftThenDeadline).not.toContain("m02Failed");
  });

  it("gives the same cues for the same state (deterministic)", () => {
    const actions = [START, OPEN_AT, use("map.bus06-stop", "ask-driver"), ...BUS];
    expect(reached(actions)).toEqual(reached(actions));
  });
});

describe("Mission 02 Alex lines: save and load", () => {
  it("treats every line already reached in a restored state as played", () => {
    // Replaying the saved action log gives the same state, so `passed` is exactly what was reached:
    // nothing reached before the save is queued again after a load.
    const actions = [START, OPEN_AT, open("cal.m02-interview"), use("contact.coba", "confirm"), ...BUS, use("interview.coba", "start"), use("interview.coba", "ask-process")];
    const restored = run(actions);
    expect(passedMission02AlexCues(restored)).toEqual(reachedMission02AlexCues(restored));
    expect(passedMission02AlexCues(restored)).toEqual(expect.arrayContaining(["m02Open", "m02Arrived", "m02InterviewDone"]));
  });
});

describe("Mission 02 Alex lines: content", () => {
  it("has a stable, unique dialogue ID and file stem per cue", () => {
    const ids = MISSION02_ALEX_CUES.map((cue) => MISSION02_ALEX_VOICE_IDS[cue]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^m02\.alex\.[a-z_]+$/);
    const stems = MISSION02_ALEX_CUES.map((cue) => MISSION02_ALEX_STEMS[cue]);
    expect(new Set(stems).size).toBe(stems.length);
    // New IDs never reuse an existing Mission 02 voice ID.
    for (const id of ids) {
      expect(Object.hasOwn(MISSION02_VOICE_STEMS, id)).toBe(false);
      expect(Object.hasOwn(MISSION02_VOICE_PLACEHOLDERS, id)).toBe(false);
    }
  });

  it("has an English and a Vietnamese caption for every cue", () => {
    const en = enVoice.voice.alex as Record<string, string>;
    const vi = viVoice.voice.alex as Record<string, string>;
    for (const cue of MISSION02_ALEX_CUES) {
      expect(en[cue]?.trim(), cue).toBeTruthy();
      expect(vi[cue]?.trim(), cue).toBeTruthy();
      // At most two lines on screen at a time: two short sentences per line.
      expect(en[cue].split("\n").length, cue).toBeLessThanOrEqual(2);
      expect(vi[cue].split("\n").length, cue).toBeLessThanOrEqual(2);
    }
  });

  it("loads nothing for a placeholder and lists a cue as recorded only when both files exist", () => {
    // Not `new URL(template, import.meta.url)`: Vite rewrites that as an asset import and the path is lost.
    const publicDir = (path: string) => resolve(__dirname, "../../../../public", path.slice(1));
    for (const cue of MISSION02_ALEX_CUES) {
      const files = (["en", "vi"] as const).map((locale) => existsSync(publicDir(mission02AlexClipPath(cue, locale))));
      if (MISSION02_ALEX_RECORDED.has(cue)) {
        expect(files, `${cue} is listed as recorded`).toEqual([true, true]);
        expect(mission02AlexVoiceUrl(cue, "vi")).toBe(mission02AlexClipPath(cue, "vi"));
      } else {
        expect(mission02AlexVoiceUrl(cue, "en"), cue).toBeNull();
        expect(files, `${cue}: the recording exists, add it to MISSION02_ALEX_RECORDED`).toEqual([false, false]);
      }
    }
    expect(mission02AlexClipPath("m02Open", "vi")).toBe("/audio/mission02/vi/alex_m02_open_vi.mp3");
  });

  it("supersedes only later moments with earlier ones, never itself", () => {
    const order = (cue: Mission02AlexCue) => MISSION02_ALEX_CUES.indexOf(cue);
    for (const [cue, stale] of Object.entries(MISSION02_ALEX_SUPERSEDES) as [Mission02AlexCue, readonly Mission02AlexCue[]][]) {
      for (const old of stale) {
        expect(old).not.toBe(cue);
        expect(order(old)).toBeLessThan(order(cue));
      }
    }
  });
});

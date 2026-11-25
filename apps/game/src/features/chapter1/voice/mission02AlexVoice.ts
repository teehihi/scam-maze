// Alex's spoken story lines of Mission 02 "THE RIDE" (inner voice, English and Vietnamese). Pure data
// and rules: no React, no audio API. They play through the same Alex voice queue as Mission 01
// (`useMission01Voice`), so they never overlap another Alex line, a call or a recorded street line.
//
// Each cue reacts to a moment of the mission that the player reached, read from the chapter state:
//   briefed        Minh's call after the draft (or his message, when the call was declined): Section 3.3
//                  still needs Cô Ba's data
//   open           Mission 02 opens (Wednesday 11:00 on the story clock), the hour before the interview
//   prepare        the player opens the interview appointment in the calendar, before arriving
//   driverOffer    the player heard the street driver's cash offer (on the street or on the phone)
//   routeChecked   the player read the Bus 06 route board and its fare
//   confirmed      the confirmation call to Cô Ba through the number in the notes is done
//   onBus          the Bus 06 fare was paid at the validator
//   wrongStop      the cash ride ended at the wrong corner, three blocks short
//   arrived        Alex reached the market office while the appointment window was still open
//   arrivedLate    Alex is at the market office and the 11:30 slot was missed
//   rescheduled    Cô Ba agreed to do the interview late
//   leftWithout    the player left without rescheduling
//   interviewDone  the interview is complete (the mission's success)
//   failed         the mission failed at its deadline without an interview (not after leaving on purpose)
// The cues are level based: what already holds when the layer starts (a continued save) counts as
// played, so a restored game never replays a line. A line that is still waiting is dropped when a
// later moment makes it wrong (see `MISSION02_ALEX_SUPERSEDES`).
//
// Recordings: `<MISSION02_VOICE_BASE>/<locale>/alex_m02_<stem>_<locale>.mp3`. Until a clip is
// listed in `MISSION02_ALEX_RECORDED` it is a placeholder: nothing is loaded and the line shows as a
// caption only (silent fallback). The captions are `voice.alex.<cue>` in the chapter1 texts.
import type { GameLocale } from "@scammaze/shared-types";
import { MISSION02_VOICE_BASE } from "../../../config/assetPaths";
import type { ChapterState } from "../../../game/narrative/types";

export const MISSION02_ALEX_CUES = [
  "m02Briefed",
  "m02Open",
  "m02Prepare",
  "m02DriverOffer",
  "m02RouteChecked",
  "m02Confirmed",
  "m02OnBus",
  "m02WrongStop",
  "m02Arrived",
  "m02ArrivedLate",
  "m02Rescheduled",
  "m02LeftWithout",
  "m02InterviewDone",
  "m02Failed",
] as const;
export type Mission02AlexCue = (typeof MISSION02_ALEX_CUES)[number];

/** The stable dialogue ID of each cue (recording script, subtitles and tests use it). */
export const MISSION02_ALEX_VOICE_IDS: Readonly<Record<Mission02AlexCue, string>> = {
  m02Briefed: "m02.alex.briefed",
  m02Open: "m02.alex.open",
  m02Prepare: "m02.alex.prepare",
  m02DriverOffer: "m02.alex.driver_offer",
  m02RouteChecked: "m02.alex.route_checked",
  m02Confirmed: "m02.alex.confirmed",
  m02OnBus: "m02.alex.on_bus",
  m02WrongStop: "m02.alex.wrong_stop",
  m02Arrived: "m02.alex.arrived",
  m02ArrivedLate: "m02.alex.arrived_late",
  m02Rescheduled: "m02.alex.rescheduled",
  m02LeftWithout: "m02.alex.left_without",
  m02InterviewDone: "m02.alex.interview_done",
  m02Failed: "m02.alex.failed",
};

/** File stem of each cue: `alex_m02_<stem>_<locale>.mp3`, the same shape as Mission 01 (`alex_<stem>_<locale>.mp3`). */
export const MISSION02_ALEX_STEMS: Readonly<Record<Mission02AlexCue, string>> = {
  m02Briefed: "briefed",
  m02Open: "open",
  m02Prepare: "prepare",
  m02DriverOffer: "driver_offer",
  m02RouteChecked: "route_checked",
  m02Confirmed: "confirmed",
  m02OnBus: "on_bus",
  m02WrongStop: "wrong_stop",
  m02Arrived: "arrived",
  m02ArrivedLate: "arrived_late",
  m02Rescheduled: "rescheduled",
  m02LeftWithout: "left_without",
  m02InterviewDone: "interview_done",
  m02Failed: "failed",
};

/**
 * Cues whose clips exist in both languages: add a cue here when its two files are in
 * `public/audio/mission02/<locale>/` (a test checks the files).
 */
export const MISSION02_ALEX_RECORDED: ReadonlySet<Mission02AlexCue> = new Set<Mission02AlexCue>(["m02Open", "m02Prepare", "m02DriverOffer", "m02RouteChecked"]);

export function isMission02AlexCue(cue: string): cue is Mission02AlexCue {
  return (MISSION02_ALEX_CUES as readonly string[]).includes(cue);
}

/** The expected file of a cue in one language (also for a placeholder). */
export function mission02AlexClipPath(cue: Mission02AlexCue, locale: GameLocale): string {
  return `${MISSION02_VOICE_BASE}/${locale}/alex_m02_${MISSION02_ALEX_STEMS[cue]}_${locale}.mp3`;
}

/** The clip to play, or null for a placeholder (the line is shown as a caption only). */
export function mission02AlexVoiceUrl(cue: Mission02AlexCue, locale: GameLocale): string | null {
  return MISSION02_ALEX_RECORDED.has(cue) ? mission02AlexClipPath(cue, locale) : null;
}

/**
 * A waiting line that a later moment makes wrong: when the key cue is reached, the listed cues that
 * have not started are dropped and never played. Arriving, being late and asking for another slot are
 * all behind the player once the interview is done or abandoned.
 */
export const MISSION02_ALEX_SUPERSEDES: Readonly<Partial<Record<Mission02AlexCue, readonly Mission02AlexCue[]>>> = {
  m02Rescheduled: ["m02Arrived", "m02ArrivedLate"],
  m02LeftWithout: ["m02Arrived", "m02ArrivedLate"],
  m02InterviewDone: ["m02Arrived", "m02ArrivedLate", "m02Rescheduled"],
  m02Failed: ["m02Arrived", "m02ArrivedLate", "m02Rescheduled"],
};

const done = (state: ChapterState, itemId: string, actionId: string): boolean =>
  Object.hasOwn(state.device.items, itemId) && state.device.items[itemId].done.includes(actionId);
const opened = (state: ChapterState, itemId: string): boolean => Object.hasOwn(state.device.items, itemId) && state.device.items[itemId].read;
const arrivedItem = (state: ChapterState, itemId: string): boolean => Object.hasOwn(state.device.items, itemId);
const missionStatus = (state: ChapterState, missionId: string) =>
  Object.hasOwn(state.world.missions, missionId) ? state.world.missions[missionId].status : "locked";

/**
 * The Mission 02 cues reached in this state (all of them, not only new ones), in list order. Every
 * rule reads the core state only, so the same state always gives the same cues.
 */
export function reachedMission02AlexCues(state: ChapterState): Mission02AlexCue[] {
  const f = state.persistent;
  const status = missionStatus(state, "m02.the-ride");
  const leftWithout = done(state, "interview.coba", "decline-reschedule");
  // Lines about getting there only fit while Alex has not reached the market office yet.
  const beforeArrival = !f.interviewArrived;
  // Minh's reminder reached Alex: the call he took, or the message left when he declined it.
  const briefed = done(state, "contact.minh", "call") || opened(state, "msg.m02-minh-reminder");
  const reached: Record<Mission02AlexCue, boolean> = {
    m02Briefed: briefed && beforeArrival && !f.interviewCompleted,
    m02Open: status !== "locked",
    m02Prepare: opened(state, "cal.m02-interview") && beforeArrival && !f.interviewCompleted,
    m02DriverOffer: done(state, "map.bus06-stop", "ask-driver") && beforeArrival,
    m02RouteChecked: done(state, "map.bus06-stop", "read-board") && beforeArrival,
    m02Confirmed: f.rideVerifiedIndependently && beforeArrival,
    m02OnBus: done(state, "travel.bus06", "pay-fare") && beforeArrival,
    m02WrongStop: arrivedItem(state, "ride.wrong-stop") && beforeArrival,
    m02Arrived: f.interviewArrived && !f.interviewMissed && !f.interviewRescheduled && !leftWithout,
    m02ArrivedLate: f.interviewArrived && f.interviewMissed && !f.interviewStarted && !leftWithout,
    m02Rescheduled: f.interviewRescheduled && !f.interviewCompleted,
    m02LeftWithout: leftWithout,
    m02InterviewDone: f.interviewCompleted,
    m02Failed: status === "failed" && !f.interviewCompleted && !leftWithout,
  };
  return MISSION02_ALEX_CUES.filter((cue) => reached[cue]);
}

/** The cues already behind the player in this state: a run started from a save marks them as played. */
export function passedMission02AlexCues(state: ChapterState): Mission02AlexCue[] {
  return reachedMission02AlexCues(state);
}

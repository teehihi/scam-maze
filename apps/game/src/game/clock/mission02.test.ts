// Mission 02 "THE RIDE": the tracked trip, the unregistered fare, independent confirmation and
// the appointment window. Runs the real reducer on the real mission content.
import { describe, expect, it, vi } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import {
  MISSION_02_CONFIG,
  MISSION_02_DEVICE_ITEMS,
  MISSION_02_EVENTS,
  MISSION_02_LEDGER_LABELS,
  MISSION_02_MISSIONS,
} from "../narrative/chapter1/mission02";
import { localizeScenario, narrativeTextEntries } from "../narrative/localize";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import { selectDeviceView, validateDeviceContent } from "../narrative/device";
import { selectClosedMissions, selectOpenMissions, validateWorldContent } from "../narrative/world";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../narrative/types";
import { LAST_SUBMISSION_NARRATIVE_VI } from "../../i18n/narrative/lastSubmission.vi";

// The suite-wide setup replaces the Vietnamese overlay with a fixture; this file checks the real one.
vi.mock("../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const S = LAST_SUBMISSION_SCENARIO;
/**
 * Mission 02 on its own. The full chapter is validated below, but its Mission 01 deadline
 * (Wednesday 06:00) deducts overnight-work time before Mission 02 opens, which would move the
 * wall clock this suite reasons about. These tests are about the ride, so they run the mission's
 * own events and missions against the real device items and flags.
 */
const M02: ScenarioDefinition = {
  ...S,
  events: (S.events ?? []).filter((event) => MISSION_02_EVENTS.some((def) => def.id === event.id)),
  missions: (S.missions ?? []).filter((mission) => MISSION_02_MISSIONS.some((def) => def.id === mission.id)),
};

const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
/** Wednesday 11:05: the mission is open and the stop is reachable. */
const OPEN_AT = advance(MISSION_02_CONFIG.opensAtMinute + 5);

function run(actions: CoreAction[], scenario: ScenarioDefinition = M02): ChapterState {
  return actions.reduce((state, action) => {
    const result = chapterReducer(state, action, scenario);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    return result.state;
  }, createInitialState(scenario));
}

const mission = (state: ChapterState, scenario: ScenarioDefinition = M02) =>
  selectOpenMissions(state, scenario).find((view) => view.id === "m02.the-ride");

/** Wednesday 11:09: the offer has been heard and the driver's number kept, no money spent yet. */
const MET_DRIVER = [START, OPEN_AT, use("map.bus06-stop", "ask-driver"), use("contact.driver", "save-number")] as const;

describe("Mission 02 content", () => {
  it("is valid world and device content", () => {
    expect(validateWorldContent(S)).toEqual([]);
    expect(validateDeviceContent(S)).toEqual([]);
  });

  it("opens on Wednesday morning with the interview on the calendar", () => {
    const state = run([START, OPEN_AT]);
    const view = mission(state);
    expect(view?.path).toBe("default");
    const calendar = selectDeviceView(state, M02, "phone").apps.calendar;
    expect(calendar.map((item) => item.id)).toContain("cal.m02-interview");
  });

  it("leaves the fare facts and the offer on the phone before any decision", () => {
    const state = run([START, OPEN_AT, open("map.bus06-stop")]);
    const map = selectDeviceView(state, M02, "phone").apps.map;
    expect(map.map((item) => item.id)).toContain("map.bus06-stop");
    // The ride offer only exists after the player asks the driver, never by itself.
    expect(map.map((item) => item.id)).not.toContain("ride.off-platform");
  });

  it("records the offer and the save as evidence only when the player saves them", () => {
    const before = run([START, OPEN_AT, use("map.bus06-stop", "ask-driver")]);
    expect(before.persistent.rideEvidenceSaved).toBe(false);
    const after = run([START, OPEN_AT, use("map.bus06-stop", "ask-driver"), use("msg.m02-driver-offer", "save-offer")]);
    expect(after.persistent.rideEvidenceSaved).toBe(true);
    expect(selectDeviceView(after, M02, "phone").apps.files.map((item) => item.id)).toContain("file.m02-ride-record");
  });

  it("confirms the appointment through the number already in the notes", () => {
    const state = run([START, OPEN_AT, use("contact.coba", "confirm")]);
    expect(state.persistent.rideVerifiedIndependently).toBe(true);
    expect(mission(state)?.path).toBe("verified");
    // Confirming is done; reaching the market office is the step left.
    expect(mission(state)?.current?.id).toBe("arrive");
  });

  it("does not let the player travel before the mission opens", () => {
    const state = run([START, advance(MISSION_02_CONFIG.travelFromMinute - 10), use("map.bus06-stop", "read-board")]);
    const result = chapterReducer(state, use("travel.bus06", "pay-fare"), M02);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("This action is not available now.");
    // The early attempt changes nothing.
    expect(result.state).toBe(state);
  });

  it("completes the interview on the tracked bus for the printed fare and 34 minutes", () => {
    const actions = [START, OPEN_AT, use("map.bus06-stop", "read-board")];
    const base = run(actions);
    const timeBefore = base.resources.timeMinutes;
    const cashBefore = base.resources.cash;
    const paid = run([...actions, use("travel.bus06", "pay-fare")]);
    const state = run([...actions, use("travel.bus06", "pay-fare"), use("travel.bus06", "arrive")]);
    expect(paid.persistent.interviewCompleted).toBe(false);
    expect(state.persistent.interviewCompleted).toBe(true);
    expect(state.resources.timeMinutes).toBe(timeBefore - MISSION_02_CONFIG.busRideMinutes);
    expect(state.resources.cash).toBe(cashBefore - MISSION_02_CONFIG.busFareVnd);
    expect(state.device.location).toBe("district5");
    expect(selectClosedMissions(state, M02)).toContainEqual({
      id: "m02.the-ride",
      title: "THE RIDE",
      optional: false,
      status: "completed",
    });
  });

  it("charges the unregistered ride in cash, loses more time and ends away from the meeting point", () => {
    const base = run([...MET_DRIVER]);
    const cashBefore = base.resources.cash;
    const timeBefore = base.resources.timeMinutes;
    const state = run([...MET_DRIVER, use("ride.off-platform", "take-ride")]);
    expect(state.persistent.ridePaidOffPlatform).toBe(true);
    expect(state.resources.cash).toBe(cashBefore - MISSION_02_CONFIG.unofficialFareVnd);
    expect(state.resources.timeMinutes).toBe(timeBefore - MISSION_02_CONFIG.unofficialRideMinutes);
    // The trip is not finished: the driver stopped short of the office.
    expect(state.persistent.interviewCompleted).toBe(false);
    expect(mission(state)?.path).toBe("off-platform");
  });

  it("reaches the interview on foot after the wrong stop, and the ledger keeps the cash fare", () => {
    const state = run([...MET_DRIVER, use("ride.off-platform", "take-ride"), use("ride.wrong-stop", "walk")]);
    expect(state.persistent.interviewCompleted).toBe(true);
    const ledger = selectDeviceView(state, M02, "phone").bank.ledger;
    expect(ledger.map((entry) => entry.label)).toContain(MISSION_02_LEDGER_LABELS["ledger.unofficial-ride"]);
    expect(ledger.every((entry) => entry.counterparty !== "")).toBe(true);
  });

  it("marks the appointment missed when the window closes without an interview", () => {
    const state = run([START, advance(MISSION_02_CONFIG.interviewEndMinute + 1)]);
    expect(state.persistent.interviewMissed).toBe(true);
    expect(selectClosedMissions(state, M02)).toContainEqual({
      id: "m02.the-ride",
      title: "THE RIDE",
      optional: false,
      status: "completed",
    });
  });

  it("never forces a fare: opening, reading and confirming cost no cash", () => {
    const state = run([
      START,
      OPEN_AT,
      use("map.bus06-stop", "read-board"),
      use("map.bus06-stop", "ask-driver"),
      use("msg.m02-driver-offer", "save-offer"),
      use("contact.coba", "confirm"),
    ]);
    expect(state.resources.cash).toBe(S.initial?.resources.cash);
    expect(state.persistent.ridePaidOffPlatform).toBe(false);
  });

  it("never calls a ride safe or unsafe and shows no score", () => {
    const state = run([START, OPEN_AT, use("map.bus06-stop", "ask-driver"), use("msg.m02-driver-offer", "save-offer")]);
    // Only Mission 02's own text: Mission 01 and the legacy chapter keep their own wording.
    const ids = new Set(MISSION_02_DEVICE_ITEMS.map((item) => item.id));
    const phone = selectDeviceView(state, M02, "phone");
    const items = Object.values(phone.apps)
      .flat()
      .filter((item) => ids.has(item.id));
    const views = JSON.stringify([
      items,
      selectOpenMissions(state, M02).filter((view) => view.id === "m02.the-ride"),
      MISSION_02_LEDGER_LABELS,
    ]);
    expect(items.length).toBeGreaterThan(0);
    expect(views).not.toMatch(/\b(safe|unsafe|scam|phish|fake|good|bad|score|risk|verdict)\b/i);
  });

  it("has Vietnamese text for every text key of the mission", () => {
    const keys = narrativeTextEntries(S, {} as Parameters<typeof narrativeTextEntries>[1])
      .map(({ key }) => key)
      .filter((key) => key.includes("m02") || key.includes("ride."));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(LAST_SUBMISSION_NARRATIVE_VI[key], key).toBeTruthy();
    const vi = localizeScenario(M02, LAST_SUBMISSION_NARRATIVE_VI);
    expect(mission(run([START, OPEN_AT], vi), vi)?.title).toBe("CHUYẾN ĐI");
  });
});

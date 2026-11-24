// Chapter 1 foundation: "LAST SUBMISSION: 72 GIỜ CUỐI".
// Checks the start state, the resource and persistent-flag effects, the event history and
// save/load. The suite setup maps `ACTIVE_SCENARIO` to the parked story, so the real routing is
// loaded here with `vi.importActual`.
import { describe, expect, it, vi } from "vitest";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
import { parseSaveEnvelopeV3, SAVE_CONTENT_VERSION, SAVE_FORMAT_VERSION_V3 } from "../saves/saveGame";
import { FOUNDATION_SCENARIO, LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import { evaluateCondition } from "../narrative/conditions";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import {
  CHAPTER_1_INITIAL_STATE,
  CHAPTER_DURATION_MINUTES,
  PERSISTENT_FLAG_IDS,
  RESOURCE_IDS,
  simulatedClock,
} from "../narrative/resources";
import type { ChapterState, CoreAction, DeviceActionDef, ScenarioDefinition } from "../narrative/types";

const { ACTIVE_SCENARIO } = await vi.importActual<typeof import("../narrative/activeScenario")>("../narrative/activeScenario");

const REVIEW = "dev.review-security";
const OPEN_CALL = "dev.open-call-details";

function deviceAction(id: DeviceActionDef["id"], def: Partial<DeviceActionDef>): DeviceActionDef {
  return { id, device: "laptop", label: id, requires: [], effects: [], reveals: [], once: false, ...def };
}

/** The real foundation scenario plus two test-only device actions that stand in for mission decisions. */
function fixture(actions: Partial<ScenarioDefinition["deviceActions"]>): ScenarioDefinition {
  return { ...FOUNDATION_SCENARIO, deviceActions: actions as ScenarioDefinition["deviceActions"] };
}

function run(scenario: ScenarioDefinition, actions: CoreAction[]): ChapterState {
  let state = createInitialState(scenario);
  for (const action of actions) {
    const result = chapterReducer(state, action, scenario);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    state = result.state;
  }
  return state;
}

const START: CoreAction = { type: "START_CHAPTER" };
const doAction = (id: "dev.review-security" | "dev.open-call-details"): CoreAction => ({
  type: "DEVICE_ACTION",
  deviceActionId: id,
});

describe("routing", () => {
  it("routes the game to LAST SUBMISSION and not to the parked story", () => {
    expect(ACTIVE_SCENARIO).toBe(LAST_SUBMISSION_SCENARIO);
    expect(ACTIVE_SCENARIO.title).toBe("LAST SUBMISSION: 72 GIỜ CUỐI");
    expect(ACTIVE_SCENARIO).not.toBe(CHAPTER_1_SCENARIO);
  });

  it("defines no story mission yet", () => {
    for (const key of ["objectives", "interactables", "evidence", "calls", "dialogues", "decisions", "endings", "deviceActions"] as const) {
      expect(Object.keys(ACTIVE_SCENARIO[key]), key).toEqual([]);
    }
    expect(ACTIVE_SCENARIO.beats).toEqual([]);
    expect(ACTIVE_SCENARIO.phone.messages).toEqual({});
  });
});

describe("a new game", () => {
  it("starts with 72 hours, 60% thesis progress and 2,500,000 VND", () => {
    const state = createInitialState(ACTIVE_SCENARIO);
    expect(state.status).toBe("not-started");
    expect(state.resources.timeMinutes).toBe(72 * 60);
    expect(state.resources.thesisProgress).toBe(60);
    expect(state.resources.cash).toBe(2_500_000);
    expect(Object.keys(state.resources).sort()).toEqual([...RESOURCE_IDS].sort());
    expect(Object.keys(state.persistent).sort()).toEqual([...PERSISTENT_FLAG_IDS].sort());
  });

  it("starts with no compromise, backup, housing or exposure, and Minh trusting Alex", () => {
    const { persistent } = createInitialState(ACTIVE_SCENARIO);
    expect(persistent).toEqual({
      accountCompromised: false,
      backupSecured: false,
      safeHousing: false,
      identityDocumentsExposed: false,
      housingDepositLost: false,
      minhTrustsAlex: true,
      schoolAccessVerified: false,
      loginCredentialsExposed: false,
      verificationCodeExposed: false,
      accountEverCompromised: false,
      overnightWork: false,
      lostMoneyToScam: false,
      easyMoneyDeposited: false,
      investmentFundsLocked: false,
      debtFromScam: false,
      scamEvidenceSaved: false,
      recoveryOfferEligible: false,
      bankReported: false,
      easyMoneyJoined: false,
      easyMoneyStopped: false,
      goldenPlatformJoined: false,
      goldenFeesPaid: false,
      draftFinished: false,
      researchSavedChannelIncluded: false,
      schoolFeeClaimContradicted: false,
      submissionDeadlineMissed: false,
      draftSourcesChecked: false,
      findingsReconciled: false,
      finalDraftReviewed: false,
      supervisorFeedbackRequested: false,
      rideVerifiedIndependently: false,
      ridePaidOffPlatform: false,
      rideLostTime: false,
      interviewCompleted: false,
      interviewMissed: false,
      rideEvidenceSaved: false,
      driverContactShared: false,
      minhWarnedAboutRide: false,
    });
  });

  it("does not share objects between games or with the config", () => {
    const a = createInitialState(ACTIVE_SCENARIO);
    const b = createInitialState(ACTIVE_SCENARIO);
    expect(a.resources).not.toBe(b.resources);
    expect(a.resources).not.toBe(CHAPTER_1_INITIAL_STATE.resources);
    expect(a.persistent).not.toBe(CHAPTER_1_INITIAL_STATE.persistent);
  });

  it("can start the chapter and records the start in the event history", () => {
    const state = run(ACTIVE_SCENARIO, [START]);
    expect(state.status).toBe("playing");
    expect(state.events).toHaveLength(1);
    expect(state.events[0].derived.resources).toEqual({});
    expect(state.events[0].derived.persistent).toEqual([]);
    expect(state.resources).toEqual(CHAPTER_1_INITIAL_STATE.resources);
  });

  it("lets a scenario override the unstated start values", () => {
    const custom = { ...FOUNDATION_SCENARIO, initial: { ...CHAPTER_1_INITIAL_STATE, resources: { ...CHAPTER_1_INITIAL_STATE.resources, supportNetwork: 70 } } };
    expect(createInitialState(custom).resources.supportNetwork).toBe(70);
  });
});

describe("the simulated clock", () => {
  const at = (remaining: number) => {
    const { isoWeekday, hour, minute } = simulatedClock(remaining);
    return `${isoWeekday} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  it("runs from Tuesday 17:00 to the Friday 17:00 deadline", () => {
    expect(at(CHAPTER_DURATION_MINUTES)).toBe("2 17:00");
    expect(at(0)).toBe("5 17:00");
  });

  it("matches the mission times of the design brief", () => {
    expect(at(CHAPTER_DURATION_MINUTES - 15 * 60)).toBe("3 08:00"); // Mission 02, Wednesday 08:00
    expect(at(CHAPTER_DURATION_MINUTES - 39 * 60)).toBe("4 08:00"); // Mission 03, Thursday 08:00
    expect(at(CHAPTER_DURATION_MINUTES - 51 * 60)).toBe("4 20:00"); // Mission 04, Thursday 20:00
    expect(at(3 * 60)).toBe("5 14:00"); // Mission 05, Friday 14:00, three hours left
    expect(at(28)).toBe("5 16:32"); // the 16:32 message, 28 minutes left
  });

  it("is total for out-of-range values", () => {
    expect(at(-5)).toBe("5 17:00");
    expect(at(CHAPTER_DURATION_MINUTES + 500)).toBe("2 17:00");
  });
});

describe("resource and persistent effects", () => {
  const scenario = fixture({
    [REVIEW]: deviceAction(REVIEW, {
      effects: [
        { kind: "adjustResource", resource: "cash", delta: -3_000_000 },
        { kind: "adjustResource", resource: "timeMinutes", delta: -90 },
        { kind: "adjustResource", resource: "digitalSecurity", delta: -250 },
        { kind: "setPersistent", flag: "housingDepositLost", value: true },
        { kind: "setPersistent", flag: "minhTrustsAlex", value: true },
      ],
    }),
  });

  it("applies the immediate consequence and lists it in the event history", () => {
    const state = run(scenario, [START, doAction(REVIEW)]);
    expect(state.resources.cash).toBe(-500_000); // debt is allowed
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 90);
    expect(state.resources.digitalSecurity).toBe(0); // clamped
    expect(state.persistent.housingDepositLost).toBe(true);
    const entry = state.events[1];
    expect(entry.derived.resources).toEqual({ cash: -3_000_000, timeMinutes: -90, digitalSecurity: -100 });
    expect(entry.derived.persistent).toEqual(["housingDepositLost"]);
  });

  it("does not mutate the previous state", () => {
    const before = run(scenario, [START]);
    const snapshot = JSON.stringify(before);
    chapterReducer(before, doAction(REVIEW), scenario);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("clamps time to the range 0 to 72 hours and thesis progress to 0 to 100", () => {
    const s = fixture({
      [REVIEW]: deviceAction(REVIEW, {
        effects: [
          { kind: "adjustResource", resource: "timeMinutes", delta: -1e9 },
          { kind: "adjustResource", resource: "thesisProgress", delta: 1e9 },
        ],
      }),
    });
    const state = run(s, [START, doAction(REVIEW)]);
    expect(state.resources.timeMinutes).toBe(0);
    expect(state.resources.thesisProgress).toBe(100);
  });

  it("ignores non-finite deltas and unknown resources or flags", () => {
    const s = fixture({
      [REVIEW]: deviceAction(REVIEW, {
        effects: [
          { kind: "adjustResource", resource: "cash", delta: Number.NaN },
          { kind: "adjustResource", resource: "__proto__" as never, delta: 5 },
          { kind: "setPersistent", flag: "__proto__" as never, value: true },
        ],
      }),
    });
    const state = run(s, [START, doAction(REVIEW)]);
    expect(state.resources).toEqual(CHAPTER_1_INITIAL_STATE.resources);
    expect(state.persistent).toEqual(CHAPTER_1_INITIAL_STATE.persistent);
  });

  it("keeps a persistent consequence for later missions, which read it through conditions", () => {
    const later = fixture({
      [REVIEW]: deviceAction(REVIEW, {
        once: true,
        effects: [
          { kind: "adjustResource", resource: "cash", delta: -3_000_000 },
          { kind: "setPersistent", flag: "housingDepositLost", value: true },
        ],
      }),
      // A later mission that is only available after the deposit was lost, and costs more time then.
      [OPEN_CALL]: deviceAction(OPEN_CALL, {
        requires: [{ kind: "persistent", flag: "housingDepositLost", value: true }],
        effects: [
          { kind: "adjustResource", resource: "timeMinutes", delta: -120 },
          { kind: "setPersistent", flag: "safeHousing", value: false },
        ],
      }),
    });
    const fresh = run(later, [START]);
    expect(chapterReducer(fresh, doAction(OPEN_CALL), later).accepted).toBe(false);
    const after = run(later, [START, doAction(REVIEW), doAction(OPEN_CALL)]);
    expect(after.persistent.housingDepositLost).toBe(true);
    expect(after.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 120);
    expect(evaluateCondition({ kind: "resourceAtMost", resource: "cash", value: 0 }, after)).toBe(true);
    expect(evaluateCondition({ kind: "resourceAtLeast", resource: "cash", value: 0 }, after)).toBe(false);
  });
});

describe("determinism, save and load", () => {
  const scenario = fixture({
    [REVIEW]: deviceAction(REVIEW, {
      effects: [
        { kind: "adjustResource", resource: "cash", delta: -22_000 },
        { kind: "adjustResource", resource: "supportNetwork", delta: 10 },
        { kind: "setPersistent", flag: "backupSecured", value: true },
      ],
    }),
  });
  const actions: CoreAction[] = [START, { type: "OPEN_PHONE" }, doAction(REVIEW), { type: "CLOSE_PHONE" }];

  it("gives the same state for the same actions", () => {
    expect(run(scenario, actions)).toEqual(run(scenario, actions));
  });

  it("restores resources, persistent flags and event history from a save", () => {
    const state = run(scenario, actions);
    const progress = encodeProgress(state, null, "start");
    expect(progress).not.toBeNull();
    const roundTrip = JSON.parse(JSON.stringify(progress)) as NonNullable<typeof progress>;
    const restored = restoreProgress(roundTrip, scenario);
    expect(restored.ok).toBe(true);
    if (restored.ok) {
      expect(restored.state).toEqual(state);
      expect(restored.state.resources.cash).toBe(2_478_000);
      expect(restored.state.persistent.backupSecured).toBe(true);
      expect(restored.state.events.map((entry) => entry.derived.resources)).toEqual([{}, {}, { cash: -22_000, supportNetwork: 10 }, {}]);
    }
  });

  it("restores a new game with no actions to the initial resources", () => {
    const restored = restoreProgress({ checkpointId: "start", actions: [], playerPose: null }, ACTIVE_SCENARIO);
    expect(restored.ok && restored.state).toEqual(createInitialState(ACTIVE_SCENARIO));
  });

  it("reports a save of the parked story as incompatible", () => {
    const parsed = parseSaveEnvelopeV3({
      formatVersion: SAVE_FORMAT_VERSION_V3,
      contentVersion: "ch1-double-deception-1",
      chapterId: "chapter-1",
      sceneId: "apartment",
      savedAt: "2026-11-10T08:00:00.000Z",
      progress: { checkpointId: "start", actions: [], playerPose: null },
    });
    expect(parsed).toMatchObject({ status: "invalid", code: "incompatible" });
    expect(SAVE_CONTENT_VERSION).toBe("ch1-last-submission-3");
  });
});

// World clock: time progression, scheduled events, deadlines, optional tasks, responses and
// adaptive mission paths. The fixtures below are test content, not Mission 01.
import { describe, expect, it } from "vitest";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
import { FOUNDATION_SCENARIO, LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { chapterReducer, createInitialState, isCoreAction } from "../narrative/reducer";
import { CHAPTER_DURATION_MINUTES, minutesFromStart } from "../narrative/resources";
import type { ChapterState, CoreAction, GameEventDef, MissionDef, ScenarioDefinition } from "../narrative/types";
import { selectOpenMissions, selectPendingEvents, selectThesisQuality, selectThesisView, settleWorld, validateWorldContent } from "../narrative/world";

const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const respond = (eventId: string, response: string): CoreAction => ({ type: "RESPOND_EVENT", eventId, response });

function scenarioWith(events: GameEventDef[], missions: MissionDef[] = [], gameplay?: ScenarioDefinition["gameplay"]): ScenarioDefinition {
  return { ...FOUNDATION_SCENARIO, events, missions, ...(gameplay ? { gameplay } : {}) };
}

function event(id: string, def: Partial<GameEventDef> = {}): GameEventDef {
  return {
    id,
    title: id,
    body: `${id} body`,
    channel: "message",
    trigger: { atMinute: 60 },
    optional: false,
    responses: [
      { id: "act", label: "Act", kind: "respond" },
      { id: "later", label: "Later", kind: "postpone" },
      { id: "skip", label: "Skip", kind: "ignore" },
    ],
    ...def,
  };
}

function mission(id: string, def: Partial<MissionDef> = {}): MissionDef {
  return {
    id,
    title: id,
    optional: false,
    opensWhen: { atMinute: 0 },
    completeWhen: [{ kind: "persistent", flag: "backupSecured", value: true }],
    paths: [{ id: "default", when: [], objective: `${id} objective` }],
    ...def,
  };
}

function step(state: ChapterState, action: CoreAction, scenario: ScenarioDefinition): ChapterState {
  const result = chapterReducer(state, action, scenario);
  expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
  return result.state;
}

function run(scenario: ScenarioDefinition, actions: CoreAction[]): ChapterState {
  return actions.reduce((state, action) => step(state, action, scenario), createInitialState(scenario));
}

const status = (state: ChapterState, id: string) => (Object.hasOwn(state.world.events, id) ? state.world.events[id].status : "not-arrived");

describe("time progression", () => {
  const scenario = scenarioWith([]);

  it("lets simulated time pass and keeps the clock inside 0 to 72 hours", () => {
    let state = run(scenario, [START, advance(90)]);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 90);
    state = step(state, advance(72 * 60), scenario);
    expect(state.resources.timeMinutes).toBe(0);
    expect(chapterReducer(state, advance(1), scenario)).toMatchObject({ accepted: false, reason: "The deadline has passed." });
  });

  it("rejects malformed time actions", () => {
    for (const minutes of [0, -5, 1.5, Number.NaN, 4321, "10", null]) expect(isCoreAction({ type: "ADVANCE_TIME", minutes })).toBe(false);
    expect(isCoreAction({ type: "WORK_ON_THESIS", minutes: 0 })).toBe(false);
    expect(isCoreAction({ type: "RESPOND_EVENT", eventId: "", response: "x" })).toBe(false);
    expect(isCoreAction({ type: "ADVANCE_TIME", minutes: 5 })).toBe(true);
  });

  it("merges quiet ticks into one event-log entry that replays to the same state", () => {
    const ticks = Array.from({ length: 200 }, () => advance(5));
    const state = run(scenario, [START, ...ticks]);
    expect(state.events).toHaveLength(2);
    expect(state.events[1].action).toEqual(advance(1000));
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 1000);
    expect(run(scenario, [START, advance(1000)])).toEqual(state);
  });

  it("does not merge a tick that changed something", () => {
    const withEvent = scenarioWith([event("a", { trigger: { atMinute: 12 } })]);
    const state = run(withEvent, [START, advance(5), advance(5), advance(5), advance(5)]);
    // Ticks 1 and 2 are quiet and merge; tick 3 brings the event and stays separate.
    expect(state.events.map((entry) => entry.action)).toEqual([START, advance(10), advance(5), advance(5)]);
    expect(state.events[2].derived.debriefTags).toEqual(["world:event:a:arrived"]);
  });

  it("settles idempotently", () => {
    const withEvent = scenarioWith([event("a")], [mission("m")]);
    const state = run(withEvent, [START, advance(120)]);
    expect(settleWorld(state, withEvent).tags).toEqual([]);
  });
});

describe("scheduled events", () => {
  it("arrive at their time and not before", () => {
    const scenario = scenarioWith([event("a", { trigger: { atMinute: minutesFromStart(3, 8, 0) } })]);
    let state = run(scenario, [START, advance(minutesFromStart(3, 8, 0) - 1)]);
    expect(status(state, "a")).toBe("not-arrived");
    state = step(state, advance(1), scenario);
    expect(status(state, "a")).toBe("pending");
    expect(selectPendingEvents(state, scenario).map((view) => view.id)).toEqual(["a"]);
  });

  it("record their scheduled time even when time jumps past it", () => {
    const scenario = scenarioWith([event("a", { trigger: { atMinute: 100 } })]);
    const state = run(scenario, [START, advance(400)]);
    expect(state.world.events.a.firedAtMinute).toBe(100);
  });

  it("run in time order inside one jump, so an earlier event can change a later one", () => {
    const scenario = scenarioWith([
      event("late", {
        trigger: { atMinute: 200, when: [{ kind: "persistent", flag: "accountCompromised", value: true }] },
      }),
      event("early", {
        trigger: { atMinute: 100 },
        onFire: [{ kind: "setPersistent", flag: "accountCompromised", value: true }],
      }),
    ]);
    const state = run(scenario, [START, advance(300)]);
    expect(status(state, "early")).toBe("pending");
    expect(status(state, "late")).toBe("pending");
    expect(state.world.events.late.firedAtMinute).toBe(200);
  });

  it("do not arrive when their condition does not hold, and arrive when a decision makes it hold", () => {
    const scenario = scenarioWith([
      event("trigger", { trigger: { atMinute: 10 } }),
      event("follow-up", {
        trigger: { when: [{ kind: "eventResponse", eventId: "trigger", response: "act" }] },
      }),
    ]);
    let state = run(scenario, [START, advance(50)]);
    expect(status(state, "follow-up")).toBe("not-arrived");
    state = step(state, respond("trigger", "skip"), scenario);
    expect(status(state, "follow-up")).toBe("not-arrived");

    const other = run(scenario, [START, advance(50), respond("trigger", "act")]);
    expect(status(other, "follow-up")).toBe("pending");
  });

  it("expire after their deadline and apply their expiry effects", () => {
    const scenario = scenarioWith([
      event("offer", {
        trigger: { atMinute: 30 },
        deadlineAfterMinutes: 60,
        onExpire: [{ kind: "adjustResource", resource: "supportNetwork", delta: -10 }],
      }),
    ]);
    let state = run(scenario, [START, advance(80)]);
    expect(status(state, "offer")).toBe("pending");
    expect(selectPendingEvents(state, scenario)[0].minutesLeft).toBe(10);
    state = step(state, advance(10), scenario);
    expect(status(state, "offer")).toBe("expired");
    expect(state.resources.supportNetwork).toBe(40);
    expect(selectPendingEvents(state, scenario)).toEqual([]);
  });
});

describe("responses", () => {
  const scenario = scenarioWith([
    event("a", {
      deadlineAfterMinutes: 120,
      responses: [
        { id: "act", label: "Act", kind: "respond", timeCostMinutes: 30, effects: [{ kind: "adjustResource", resource: "cash", delta: -22_000 }] },
        { id: "later", label: "Later", kind: "postpone" },
        { id: "skip", label: "Skip", kind: "ignore", effects: [{ kind: "setPersistent", flag: "minhTrustsAlex", value: false }] },
        {
          id: "gated",
          label: "Gated",
          kind: "respond",
          requires: [{ kind: "persistent", flag: "backupSecured", value: true }],
        },
      ],
    }),
  ]);
  const pending = (): ChapterState => run(scenario, [START, advance(60)]);

  it("respond now: costs time, applies effects, resolves the event", () => {
    const state = step(pending(), respond("a", "act"), scenario);
    expect(status(state, "a")).toBe("resolved");
    expect(state.world.events.a.response).toBe("act");
    expect(state.resources.cash).toBe(2_478_000);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 60 - 30);
  });

  it("postpone: keeps it pending, can be answered later, and the deadline keeps running", () => {
    let state = step(pending(), respond("a", "later"), scenario);
    expect(status(state, "a")).toBe("pending");
    expect(state.world.events.a.postponed).toBe(1);
    state = step(state, advance(100), scenario);
    expect(status(state, "a")).toBe("pending");
    state = step(state, respond("a", "act"), scenario);
    expect(status(state, "a")).toBe("resolved");
    // Postponing again after the deadline is not possible: the event expired at minute 180.
    const late = run(scenario, [START, advance(60), respond("a", "later"), advance(130)]);
    expect(status(late, "a")).toBe("expired");
    expect(chapterReducer(late, respond("a", "act"), scenario).accepted).toBe(false);
  });

  it("ignore: closes it and its effects stay", () => {
    const state = step(pending(), respond("a", "skip"), scenario);
    expect(status(state, "a")).toBe("ignored");
    expect(state.persistent.minhTrustsAlex).toBe(false);
  });

  it("rejects unknown, unavailable and repeated responses", () => {
    expect(chapterReducer(pending(), respond("a", "nope"), scenario).reason).toBe("This response does not exist.");
    expect(chapterReducer(pending(), respond("a", "gated"), scenario).reason).toBe("This response is not available now.");
    expect(chapterReducer(pending(), respond("missing", "act"), scenario).reason).toBe("This event does not exist.");
    const done = step(pending(), respond("a", "act"), scenario);
    expect(chapterReducer(done, respond("a", "act"), scenario).reason).toBe("This event is not waiting for an answer.");
    const early = run(scenario, [START]);
    expect(chapterReducer(early, respond("a", "act"), scenario).reason).toBe("This event does not exist.");
  });

  it("only offers the responses whose conditions hold", () => {
    const view = selectPendingEvents(pending(), scenario)[0];
    expect(view.responses.map((response) => response.id)).toEqual(["act", "later", "skip"]);
  });
});

describe("thesis work and running deadlines", () => {
  const scenario = scenarioWith(
    [],
    [
      mission("graduation-check", {
        deadlineAtMinute: 300,
        completeWhen: [{ kind: "resourceAtLeast", resource: "thesisProgress", value: 100 }],
        onFail: [
          { kind: "setPersistent", flag: "minhTrustsAlex", value: false },
          { kind: "openMission", missionId: "extension" },
        ],
      }),
      mission("extension", { opensWhen: { when: [{ kind: "elapsedAtLeast", minutes: 100000 }] }, optional: false }),
    ],
  );

  it("converts working time into progress at the configured rate", () => {
    const state = run(scenario, [START, { type: "WORK_ON_THESIS", minutes: 180 }]);
    expect(state.resources.thesisProgress).toBe(63);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 180);
    const slow = run({ ...scenario, gameplay: { thesisMinutesPerPercent: 30 } }, [START, { type: "WORK_ON_THESIS", minutes: 180 }]);
    expect(slow.resources.thesisProgress).toBe(66);
  });

  it("rejects work that is too short, and work on a finished thesis", () => {
    const started = run(scenario, [START]);
    expect(chapterReducer(started, { type: "WORK_ON_THESIS", minutes: 30 }, scenario).reason).toBe("That is too little time to make progress.");
    const nearlyDone = { ...started, resources: { ...started.resources, thesisProgress: 100 } };
    expect(chapterReducer(nearlyDone, { type: "WORK_ON_THESIS", minutes: 60 }, scenario).reason).toBe("The thesis is already complete.");
  });

  it("lets a mission deadline pass while the player works, and failing opens the alternative", () => {
    // 6 hours of work crosses the minute-300 deadline. Thesis progress is 66, not 100.
    let state = run(scenario, [START, { type: "WORK_ON_THESIS", minutes: 360 }]);
    expect(state.world.missions["graduation-check"].status).toBe("failed");
    expect(state.world.missions["graduation-check"].closedAtMinute).toBe(300);
    expect(state.persistent.minhTrustsAlex).toBe(false);
    expect(state.world.missions.extension.status).toBe("open");
    // The work still counts, and nothing is reset by the failure.
    expect(state.resources.thesisProgress).toBe(66);
    state = step(state, advance(10), scenario);
    expect(state.world.missions["graduation-check"].status).toBe("failed");
    expect(state.persistent.minhTrustsAlex).toBe(false);
  });

  it("completes a mission before its deadline when its condition holds", () => {
    const finish = { ...scenario, gameplay: { thesisFreeWorkMaxPercent: 100 }, initial: { ...(scenario.initial ?? LAST_SUBMISSION_SCENARIO.initial!), resources: { ...FOUNDATION_SCENARIO.initial!.resources, thesisProgress: 98 } } };
    const state = run(finish, [START, advance(10), { type: "WORK_ON_THESIS", minutes: 120 }, advance(400)]);
    expect(state.world.missions["graduation-check"].status).toBe("completed");
    expect(state.persistent.minhTrustsAlex).toBe(true);
    expect(state.world.missions.extension.status).toBe("locked");
  });
});

describe("adaptive missions", () => {
  const housing = mission("housing", {
    opensWhen: { atMinute: 100 },
    completeWhen: [{ kind: "persistent", flag: "safeHousing", value: true }],
    paths: [
      {
        id: "lost-deposit",
        when: [{ kind: "persistent", flag: "housingDepositLost", value: true }],
        objective: "Find a place with less money",
        onEnter: [{ kind: "adjustResource", resource: "timeMinutes", delta: -60 }],
      },
      { id: "verified", when: [{ kind: "persistent", flag: "backupSecured", value: true }], objective: "Check the listing" },
      { id: "default", when: [], objective: "Look for a room" },
    ],
  });
  const scenario = scenarioWith(
    [
      event("deposit-offer", {
        trigger: { atMinute: 10 },
        responses: [
          { id: "pay", label: "Pay", kind: "respond", effects: [{ kind: "setPersistent", flag: "housingDepositLost", value: true }] },
          { id: "check", label: "Check", kind: "respond", effects: [{ kind: "setPersistent", flag: "backupSecured", value: true }] },
          { id: "skip", label: "Skip", kind: "ignore" },
        ],
      }),
    ],
    [housing],
  );

  it("takes the path that earlier decisions lead to", () => {
    const paid = run(scenario, [START, advance(20), respond("deposit-offer", "pay"), advance(100)]);
    expect(paid.world.missions.housing.path).toBe("lost-deposit");
    expect(selectOpenMissions(paid, scenario)[0].objective).toBe("Find a place with less money");
    // The path's entry cost was applied once.
    expect(paid.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 120 - 60);

    const checked = run(scenario, [START, advance(20), respond("deposit-offer", "check"), advance(100)]);
    expect(checked.world.missions.housing.path).toBe("verified");

    const ignored = run(scenario, [START, advance(20), respond("deposit-offer", "skip"), advance(100)]);
    expect(ignored.world.missions.housing.path).toBe("default");
  });

  it("changes path when a later event changes the state, without resetting what happened", () => {
    const later = scenarioWith(
      [
        event("scam-notice", {
          trigger: { atMinute: 200 },
          onFire: [{ kind: "setPersistent", flag: "housingDepositLost", value: true }],
        }),
      ],
      [housing],
    );
    let state = run(later, [START, advance(150)]);
    expect(state.world.missions.housing.path).toBe("default");
    state = step(state, advance(100), later);
    expect(state.world.missions.housing.path).toBe("lost-deposit");
    expect(state.world.missions.housing.pathHistory).toEqual(["default", "lost-deposit"]);
    expect(state.world.missions.housing.status).toBe("open");
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 250 - 60);
  });

  it("locks and opens missions through effects without touching state that exists", () => {
    const withLock = scenarioWith(
      [
        event("cancel", {
          trigger: { atMinute: 150 },
          onFire: [{ kind: "lockMission", missionId: "housing" }, { kind: "setPersistent", flag: "housingDepositLost", value: true }],
        }),
      ],
      [housing],
    );
    const state = run(withLock, [START, advance(200)]);
    expect(state.world.missions.housing.status).toBe("locked");
    expect(state.persistent.housingDepositLost).toBe(true);
  });
});

describe("optional tasks", () => {
  it("can be ignored without any effect on the rest of the state", () => {
    const scenario = scenarioWith(
      [event("side-job", { optional: true, trigger: { atMinute: 30 }, responses: [{ id: "skip", label: "Skip", kind: "ignore" }] })],
      [mission("side-mission", { optional: true, completeWhen: [{ kind: "eventResponse", eventId: "side-job", response: "act" }] })],
    );
    const before = run(scenario, [START]);
    const state = run(scenario, [START, advance(60), respond("side-job", "skip")]);
    expect(state.resources.cash).toBe(before.resources.cash);
    expect(state.persistent).toEqual(before.persistent);
    expect(selectOpenMissions(state, scenario)[0].optional).toBe(true);
  });
});

describe("persistence across save and load", () => {
  const scenario = scenarioWith(
    [
      event("a", {
        trigger: { atMinute: 30 },
        responses: [{ id: "act", label: "Act", kind: "respond", effects: [{ kind: "setPersistent", flag: "backupSecured", value: true }] }],
      }),
    ],
    [mission("m", { completeWhen: [{ kind: "persistent", flag: "safeHousing", value: true }] })],
  );
  const actions: CoreAction[] = [START, advance(5), advance(5), advance(40), respond("a", "act"), { type: "WORK_ON_THESIS", minutes: 120 }, advance(30)];

  it("restores events, missions and the clock from the action log", () => {
    const state = run(scenario, actions);
    const progress = encodeProgress(state, null, "start");
    expect(progress).not.toBeNull();
    const restored = restoreProgress(JSON.parse(JSON.stringify(progress)), scenario);
    expect(restored.ok && restored.state).toEqual(state);
    expect(state.world.events.a.status).toBe("resolved");
    expect(state.world.missions.m.status).toBe("open");
  });

  it("gives the same state for the same actions", () => {
    expect(run(scenario, actions)).toEqual(run(scenario, actions));
  });
});

describe("world content validation", () => {
  it("accepts consistent content", () => {
    expect(validateWorldContent(scenarioWith([event("a")], [mission("m")]))).toEqual([]);
    expect(validateWorldContent(LAST_SUBMISSION_SCENARIO)).toEqual([]);
  });

  it("reports duplicates, missing triggers, missing responses, missing default paths and unknown references", () => {
    const bad = scenarioWith(
      [
        event("a", { trigger: {}, responses: [] }),
        event("a", { onFire: [{ kind: "openMission", missionId: "ghost" }], trigger: { atMinute: 99999 } }),
      ],
      [
        mission("m", {
          paths: [{ id: "only", when: [{ kind: "eventStatus", eventId: "ghost", status: "pending" }], objective: "x" }],
          completeWhen: [],
        }),
      ],
    );
    const problems = validateWorldContent(bad).join("\n");
    expect(problems).toContain('Event "a" is defined twice.');
    expect(problems).toContain("has no trigger");
    expect(problems).toContain("has no response");
    expect(problems).toContain("outside the chapter");
    expect(problems).toContain('unknown mission "ghost"');
    expect(problems).toContain("no default path");
    expect(problems).toContain('unknown event "ghost"');
    expect(problems).toContain("no completion condition");
  });
});

describe("no visible scoring", () => {
  it("has no score, good or bad field in the event, response or mission shapes", () => {
    const shapes = JSON.stringify([event("a"), mission("m")]);
    expect(shapes).not.toMatch(/score|good|bad|correct|points/i);
  });
});

describe("thesis tasks", () => {
  const withTasks = {
    ...scenarioWith([], []),
    thesisTasks: [
      { id: "interview", label: "Finish the last interview", timeCostMinutes: 120, progressGain: 10 },
      {
        id: "supervisor",
        label: "Get the supervisor's confirmation",
        requires: [{ kind: "thesisTaskDone" as const, taskId: "interview" }],
        timeCostMinutes: 30,
        progressGain: 5,
        effects: [{ kind: "adjustResource" as const, resource: "supportNetwork" as const, delta: 5 }],
      },
    ],
  } satisfies ScenarioDefinition;

  it("stops free work at the configured limit and asks for tasks after that", () => {
    const nearLimit: ChapterState = { ...run(withTasks, [START]), resources: { ...run(withTasks, [START]).resources, thesisProgress: 89 } };
    const worked = chapterReducer(nearLimit, { type: "WORK_ON_THESIS", minutes: 600 }, withTasks).state;
    // Only the one percent below the limit is paid for.
    expect(worked.resources.thesisProgress).toBe(90);
    expect(worked.resources.timeMinutes).toBe(nearLimit.resources.timeMinutes - 60);
    expect(chapterReducer(worked, { type: "WORK_ON_THESIS", minutes: 60 }, withTasks).reason).toBe(
      "More progress needs a thesis task, such as the supervisor's confirmation.",
    );
    expect(chapterReducer(nearLimit, { type: "WORK_ON_THESIS", minutes: 60 }, { ...withTasks, gameplay: { thesisFreeWorkMaxPercent: 100 } }).accepted).toBe(true);
  });

  it("moves the thesis forward by completing tasks, with their time cost and effects", () => {
    let state = run(withTasks, [START]);
    expect(chapterReducer(state, { type: "COMPLETE_THESIS_TASK", taskId: "supervisor" }, withTasks).reason).toBe(
      "This thesis task is not available now.",
    );
    state = step(state, { type: "COMPLETE_THESIS_TASK", taskId: "interview" }, withTasks);
    expect(state.resources.thesisProgress).toBe(70);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 120);
    state = step(state, { type: "COMPLETE_THESIS_TASK", taskId: "supervisor" }, withTasks);
    expect(state.resources.thesisProgress).toBe(75);
    expect(state.resources.supportNetwork).toBe(55);
    expect(state.world.thesisTasksDone).toEqual(["interview", "supervisor"]);
    expect(chapterReducer(state, { type: "COMPLETE_THESIS_TASK", taskId: "interview" }, withTasks).reason).toBe("This thesis task is already done.");
    expect(chapterReducer(state, { type: "COMPLETE_THESIS_TASK", taskId: "missing" }, withTasks).reason).toBe("This thesis task does not exist.");
  });

  it("can finish the thesis with tasks even when no time is spent waiting", () => {
    const big = {
      ...withTasks,
      thesisTasks: [...withTasks.thesisTasks, { id: "final", label: "Hand in the final version", progressGain: 100 }],
    } satisfies ScenarioDefinition;
    const state = run(big, [START, { type: "COMPLETE_THESIS_TASK", taskId: "final" }]);
    expect(state.resources.thesisProgress).toBe(100);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES);
  });

  it("lists the tasks with why one is blocked, and replays from a save", () => {
    const state = run(withTasks, [START, { type: "COMPLETE_THESIS_TASK", taskId: "interview" }]);
    const view = selectThesisView(state, withTasks);
    expect(view.freeWorkMaxPercent).toBe(90);
    expect(view.tasks.map((task) => [task.id, task.blocked])).toEqual([
      ["interview", "done"],
      ["supervisor", null],
    ]);
    const progress = encodeProgress(state, null, "start");
    const restored = restoreProgress(JSON.parse(JSON.stringify(progress)), withTasks);
    expect(restored.ok && restored.state).toEqual(state);
  });

  it("validates thesis tasks", () => {
    const bad = {
      ...withTasks,
      thesisTasks: [
        { id: "a", label: "A", progressGain: 0 },
        { id: "a", label: "B", progressGain: 5, timeCostMinutes: -1, requires: [{ kind: "thesisTaskDone" as const, taskId: "ghost" }] },
      ],
    } satisfies ScenarioDefinition;
    const problems = validateWorldContent(bad).join("\n");
    expect(problems).toContain('Thesis task "a" is defined twice.');
    expect(problems).toContain("invalid progress gain");
    expect(problems).toContain("invalid time cost");
    expect(problems).toContain('unknown thesis task "ghost"');
  });
});

describe("thesis review approaches", () => {
  const withApproaches = {
    ...scenarioWith([], []),
    thesisTasks: [
      {
        id: "draft.intro",
        label: "Edit the introduction",
        timeCostMinutes: 90,
        progressGain: 2,
        effects: [{ kind: "setPersistent" as const, flag: "draftSourcesChecked" as const, value: true }],
        approaches: [
          { id: "careful", label: "Careful", timeCostMinutes: 30, progressGain: 1 },
          { id: "swap", label: "Swap", timeCostMinutes: 60, progressGain: 3, effects: [{ kind: "adjustResource" as const, resource: "supportNetwork" as const, delta: 4 }] },
        ],
      },
    ],
  } satisfies ScenarioDefinition;

  it("uses the chosen approach's time and progress instead of the task's own", () => {
    let state = run(withApproaches, [START]);
    state = step(state, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro", approachId: "careful" }, withApproaches);
    expect(state.resources.thesisProgress).toBe(61);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 30);
  });

  it("applies the task effects and the approach effects together", () => {
    const before = run(withApproaches, [START]);
    const state = step(before, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro", approachId: "swap" }, withApproaches);
    expect(state.resources.thesisProgress).toBe(63);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 60);
    expect(state.persistent.draftSourcesChecked).toBe(true);
    expect(state.resources.supportNetwork).toBe(before.resources.supportNetwork + 4);
    expect(state.events.at(-1)?.derived.debriefTags).toContain("world:thesis:draft.intro:swap");
  });

  it("keeps the legacy task-level path when no approach is named", () => {
    const state = run(withApproaches, [START, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro" }]);
    expect(state.resources.thesisProgress).toBe(62);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 90);
  });

  it("rejects an approach the task does not define", () => {
    const state = run(withApproaches, [START]);
    const result = chapterReducer(state, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro", approachId: "ghost" }, withApproaches);
    expect(result).toMatchObject({ accepted: false, reason: "That review approach does not exist." });
    expect(result.state).toBe(state);
    expect(chapterReducer(state, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro", approachId: "" }, withApproaches).accepted).toBe(false);
  });

  it("publishes the approaches with their own time and progress, and derives the draft quality", () => {
    const state = run(withApproaches, [START, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro", approachId: "careful" }]);
    const view = selectThesisView(state, withApproaches);
    expect(view.quality).toBe("reviewed");
    expect(view.tasks[0].approaches.map((approach) => [approach.id, approach.timeCostMinutes, approach.progressGain])).toEqual([
      ["careful", 30, 1],
      ["swap", 60, 3],
    ]);
    expect(selectThesisQuality(run(withApproaches, [START]))).toBe("rough");
    const ready = { ...state, persistent: { ...state.persistent, finalDraftReviewed: true } };
    expect(selectThesisQuality(ready)).toBe("ready");
  });

  it("uses fatigue-adjusted approach time while keeping its authored gain", () => {
    const tiredScenario = { ...withApproaches, gameplay: { fatigue: { enabled: true } } } satisfies ScenarioDefinition;
    const start = run(tiredScenario, [START]);
    const tired = { ...start, resources: { ...start.resources, fatigue: 100 } };
    const view = selectThesisView(tired, tiredScenario).tasks[0];
    expect(view.approaches[0].timeCostMinutes).toBeGreaterThan(30);
    const after = step(tired, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro", approachId: "careful" }, tiredScenario);
    expect(tired.resources.timeMinutes - after.resources.timeMinutes).toBe(view.approaches[0].timeCostMinutes);
    expect(after.resources.thesisProgress).toBe(61);
  });

  it("validates approaches: duplicate ids and invalid time or progress", () => {
    const bad = {
      ...withApproaches,
      thesisTasks: [
        {
          id: "a",
          label: "A",
          progressGain: 5,
          approaches: [
            { id: "same", label: "One", timeCostMinutes: -1, progressGain: 0 },
            { id: "same", label: "Two" },
          ],
        },
      ],
    } satisfies ScenarioDefinition;
    const problems = validateWorldContent(bad).join("\n");
    expect(problems).toContain('Thesis task "a", approach "same" is defined twice.');
    expect(problems).toContain('Thesis task "a", approach "same" has an invalid progress gain.');
    expect(problems).toContain('Thesis task "a", approach "same" has an invalid time cost.');
  });
});
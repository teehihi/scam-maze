// World clock for "LAST SUBMISSION: 72 GIỜ CUỐI": scheduled events, optional tasks, mission
// deadlines and adaptive mission paths. Pure TypeScript: no React, Three.js, R3F, Drei, Rapier,
// Zustand or Dexie imports. No clock, randomness or I/O: time passes only through actions.
//
// `settleWorld` runs after every accepted action. It applies what is due, one item at a time in
// time order, so an event that arrives at minute 100 can change the state that an event at minute
// 200 or a deadline at minute 150 reads. It never resets state: it only moves events and missions
// forward and applies their data-defined effects.
import { applyEffects, evaluateConditions } from "./conditions";
import { DEFAULT_FATIGUE_CONFIG, effectiveWorkMinutes } from "./fatigue";
import { CHAPTER_1_INITIAL_STATE } from "./resources";
import type {
  ChapterState,
  Condition,
  EventResponseDef,
  EventState,
  GameEventDef,
  GameplayConfig,
  MissionDef,
  MissionPathDef,
  MissionState,
  MissionStepApp,
  MissionStepDef,
  MissionStepTarget,
  ScenarioDefinition,
  WorldState,
  WorldTrigger,
} from "./types";

/**
 * Placeholders: the brief gives no pacing numbers. Override with `ScenarioDefinition.gameplay`.
 * One real second is one simulated minute (`msPerGameMinute`), as the owner decided.
 */
export const DEFAULT_GAMEPLAY_CONFIG: GameplayConfig = {
  thesisMinutesPerPercent: 60,
  thesisSessionMinutes: 60,
  thesisFreeWorkMaxPercent: 90,
  msPerGameMinute: 1000,
  // One tick per real second, so the HUD clock moves every second.
  tickMinutes: 1,
  clockRuns: false,
  fatigue: DEFAULT_FATIGUE_CONFIG,
};

export function gameplayConfig(scenario: ScenarioDefinition): GameplayConfig {
  const merged = { ...DEFAULT_GAMEPLAY_CONFIG, ...scenario.gameplay };
  return { ...merged, fatigue: { ...DEFAULT_FATIGUE_CONFIG, ...scenario.gameplay?.fatigue } };
}

/** Upper bound of settle steps per action: a guard against data that keeps re-triggering itself. */
export const MAX_WORLD_STEPS = 200;

/** Debrief-tag prefix that marks a world change in an event-log entry. */
export const WORLD_TAG_PREFIX = "world:";

export function createInitialWorld(scenario: ScenarioDefinition): WorldState {
  const missions: Record<string, MissionState> = {};
  for (const mission of scenario.missions ?? []) {
    missions[mission.id] = { status: "locked", path: null, pathHistory: [], openedAtMinute: null, closedAtMinute: null };
  }
  return { events: {}, thesisTasksDone: [], thesisWorkRemainderUnits: 0, thesisWorkSession: null, thesisDraft: {}, missions };
}

/** Minutes since the chapter started: start time left minus time left now. */
export function elapsedMinutes(state: ChapterState, scenario: ScenarioDefinition): number {
  const start = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
  return Math.max(0, start - state.resources.timeMinutes);
}

export function eventDef(scenario: ScenarioDefinition, id: string): GameEventDef | undefined {
  return scenario.events?.find((event) => event.id === id);
}

function has<T>(record: Record<string, T>, key: string): boolean {
  return Object.hasOwn(record, key);
}

/** True when the trigger's time has come (or it has none) and its conditions hold. */
function triggerHolds(trigger: WorldTrigger, state: ChapterState, scenario: ScenarioDefinition, now: number): boolean {
  return triggerFiresAt(trigger, state, scenario, now) !== null;
}

function doneAtOf(state: ChapterState, itemId: string, actionId: string): number | undefined {
  if (!has(state.device.items, itemId)) return undefined;
  const record = state.device.items[itemId].doneAt;
  return record !== undefined && has(record, actionId) ? record[actionId] : undefined;
}

/**
 * The simulated minute at which a trigger fires, or null when it does not hold yet. With
 * `afterAction` that is the scheduled minute, which may be earlier than `now` after a long action.
 */
export function triggerFiresAt(trigger: WorldTrigger, state: ChapterState, scenario: ScenarioDefinition, now: number): number | null {
  let at = trigger.atMinute ?? null;
  if (at !== null && at > now) return null;
  if (trigger.afterAction !== undefined) {
    const done = doneAtOf(state, trigger.afterAction.itemId, trigger.afterAction.actionId);
    if (done === undefined) return null;
    const due = done + trigger.afterAction.minutes;
    if (due > now) return null;
    at = Math.max(at ?? 0, due);
  }
  const firesAt = at ?? now;
  for (const stop of trigger.cancelledBy ?? []) {
    const stoppedAt = doneAtOf(state, stop.itemId, stop.actionId);
    if (stoppedAt !== undefined && stoppedAt <= firesAt) return null;
  }
  if (!evaluateConditions(trigger.when, state, scenario)) return null;
  return firesAt;
}

/**
 * Applies effects as if they happened at `minute` (ledger lines, mission opening and item arrival
 * read the clock), then puts the clock back, keeping any change the effects made to the time itself.
 */
function applyEffectsAt(state: ChapterState, effects: Parameters<typeof applyEffects>[1], scenario: ScenarioDefinition, minute: number): ChapterState {
  const start = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.timeMinutes;
  const real = state.resources.timeMinutes;
  const rewound = Math.min(start, Math.max(real, start - minute));
  if (rewound === real) return applyEffects(state, effects, scenario);
  const after = applyEffects({ ...state, resources: { ...state.resources, timeMinutes: rewound } }, effects, scenario);
  const spent = after.resources.timeMinutes - rewound;
  return { ...after, resources: { ...after.resources, timeMinutes: Math.max(0, real + spent) } };
}

/** The first path whose conditions hold, or null. */
export function selectMissionPath(mission: MissionDef, state: ChapterState, scenario: ScenarioDefinition): MissionPathDef | null {
  return mission.paths.find((path) => evaluateConditions(path.when, state, scenario)) ?? null;
}

type Step = {
  dueAt: number;
  rank: number;
  key: string;
  apply: (state: ChapterState) => { state: ChapterState; tag: string };
};

// Same minute: finish missions first, then open and enter, then arrivals, then path changes,
// and only then expiries and failed deadlines.
const RANK = { complete: 0, open: 1, enter: 2, fire: 3, path: 4, expire: 5, fail: 6 } as const;

function withMission(state: ChapterState, id: string, next: MissionState): ChapterState {
  return { ...state, world: { ...state.world, missions: { ...state.world.missions, [id]: next } } };
}

function withEvent(state: ChapterState, id: string, next: EventState): ChapterState {
  return { ...state, world: { ...state.world, events: { ...state.world.events, [id]: next } } };
}

function collectSteps(state: ChapterState, scenario: ScenarioDefinition, now: number): Step[] {
  const steps: Step[] = [];

  for (const event of scenario.events ?? []) {
    const current = has(state.world.events, event.id) ? state.world.events[event.id] : null;
    if (current === null) {
      const firedAt = triggerFiresAt(event.trigger, state, scenario, now);
      if (firedAt === null) continue;
      steps.push({
        dueAt: firedAt,
        rank: RANK.fire,
        key: event.id,
        apply: (s) => ({
          state: applyEffectsAt(
            withEvent(s, event.id, {
              status: event.autoResolve === true ? "resolved" : "pending",
              firedAtMinute: firedAt,
              resolvedAtMinute: event.autoResolve === true ? firedAt : null,
              postponed: 0,
              response: null,
            }),
            event.onFire,
            scenario,
            firedAt,
          ),
          tag: `${WORLD_TAG_PREFIX}event:${event.id}:arrived`,
        }),
      });
    } else if (current.status === "pending" && event.deadlineAfterMinutes !== undefined) {
      const deadline = current.firedAtMinute + event.deadlineAfterMinutes;
      if (deadline > now) continue;
      steps.push({
        dueAt: deadline,
        rank: RANK.expire,
        key: event.id,
        apply: (s) => ({
          state: applyEffects(withEvent(s, event.id, { ...current, status: "expired", resolvedAtMinute: deadline }), event.onExpire, scenario),
          tag: `${WORLD_TAG_PREFIX}event:${event.id}:expired`,
        }),
      });
    }
  }

  for (const item of scenario.deviceItems ?? []) {
    if (item.arrives === undefined || has(state.device.items, item.id)) continue;
    const arrivedAt = triggerFiresAt(item.arrives, state, scenario, now);
    if (arrivedAt === null) continue;
    steps.push({
      dueAt: arrivedAt,
      rank: RANK.fire,
      key: item.id,
      apply: (s) => ({
        state: {
          ...s,
          device: {
            ...s.device,
            items: { ...s.device.items, [item.id]: { arrivedAtMinute: arrivedAt, read: false, readAtMinute: null, done: [] } },
          },
        },
        tag: `${WORLD_TAG_PREFIX}item:${item.id}:arrived`,
      }),
    });
  }

  for (const mission of scenario.missions ?? []) {
    if (!has(state.world.missions, mission.id)) continue;
    const current = state.world.missions[mission.id];
    if (current.status === "locked") {
      // A mission that was opened once and then locked stays locked until an effect opens it again.
      if (current.openedAtMinute !== null) continue;
      if (!triggerHolds(mission.opensWhen, state, scenario, now)) continue;
      const openedAt = mission.opensWhen.atMinute ?? now;
      steps.push({
        dueAt: openedAt,
        rank: RANK.open,
        key: mission.id,
        apply: (s) => ({
          state: withMission(s, mission.id, { ...current, status: "open", openedAtMinute: openedAt }),
          tag: `${WORLD_TAG_PREFIX}mission:${mission.id}:opened`,
        }),
      });
      continue;
    }
    if (current.status !== "open") continue;

    if (current.path === null) {
      // First time in: apply `onOpen`, then take the first matching path.
      const path = selectMissionPath(mission, state, scenario);
      steps.push({
        dueAt: now,
        rank: RANK.enter,
        key: mission.id,
        apply: (s) => {
          let next = applyEffects(s, mission.onOpen, scenario);
          const chosen = selectMissionPath(mission, next, scenario) ?? path;
          if (chosen === null) return { state: next, tag: `${WORLD_TAG_PREFIX}mission:${mission.id}:entered` };
          next = withMission(next, mission.id, { ...next.world.missions[mission.id], path: chosen.id, pathHistory: [chosen.id] });
          next = applyEffects(next, chosen.onEnter, scenario);
          return { state: next, tag: `${WORLD_TAG_PREFIX}mission:${mission.id}:path:${chosen.id}` };
        },
      });
      continue;
    }

    if (mission.completeWhen.length > 0 && evaluateConditions(mission.completeWhen, state, scenario)) {
      steps.push({
        dueAt: now,
        rank: RANK.complete,
        key: mission.id,
        apply: (s) => ({
          state: applyEffects(withMission(s, mission.id, { ...current, status: "completed", closedAtMinute: now }), mission.onComplete, scenario),
          tag: `${WORLD_TAG_PREFIX}mission:${mission.id}:completed`,
        }),
      });
      continue;
    }
    if (mission.deadlineAtMinute !== undefined && mission.deadlineAtMinute <= now) {
      const deadline = mission.deadlineAtMinute;
      steps.push({
        dueAt: deadline,
        rank: RANK.fail,
        key: mission.id,
        apply: (s) => ({
          state: applyEffects(withMission(s, mission.id, { ...current, status: "failed", closedAtMinute: deadline }), mission.onFail, scenario),
          tag: `${WORLD_TAG_PREFIX}mission:${mission.id}:failed`,
        }),
      });
      continue;
    }
    const next = selectMissionPath(mission, state, scenario);
    if (next !== null && next.id !== current.path) {
      steps.push({
        dueAt: now,
        rank: RANK.path,
        key: mission.id,
        apply: (s) => {
          const seen = current.pathHistory.includes(next.id);
          let after = withMission(s, mission.id, {
            ...current,
            path: next.id,
            pathHistory: seen ? current.pathHistory : [...current.pathHistory, next.id],
          });
          if (!seen) after = applyEffects(after, next.onEnter, scenario);
          return { state: after, tag: `${WORLD_TAG_PREFIX}mission:${mission.id}:path:${next.id}` };
        },
      });
    }
  }
  return steps;
}

export interface SettleResult {
  state: ChapterState;
  /** One tag per change, in the order applied, for the event-log entry. */
  tags: string[];
}

/**
 * Applies everything that is due at the current simulated time, earliest first. Idempotent: a
 * second call with no new action changes nothing. Never mutates `state`.
 */
export function settleWorld(state: ChapterState, scenario: ScenarioDefinition): SettleResult {
  const hasWorld = (scenario.events?.length ?? 0) > 0 || (scenario.missions?.length ?? 0) > 0 || (scenario.deviceItems?.length ?? 0) > 0;
  if (!hasWorld) return { state, tags: [] };
  const now = elapsedMinutes(state, scenario);
  let current = state;
  const tags: string[] = [];
  for (let i = 0; i < MAX_WORLD_STEPS; i += 1) {
    const steps = collectSteps(current, scenario, now);
    if (steps.length === 0) break;
    steps.sort((a, b) => a.dueAt - b.dueAt || a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const result = steps[0].apply(current);
    current = result.state;
    tags.push(result.tag);
  }
  return { state: current, tags };
}

/** The response of an event with this id, or undefined. */
export function responseFor(def: GameEventDef | undefined, responseId: string): EventResponseDef | undefined {
  return def?.responses.find((response) => response.id === responseId);
}

// ---------------------------------------------------------------------------
// Selectors (memoized by state and scenario, so `useSyncExternalStore` gets stable references)
// ---------------------------------------------------------------------------

export interface PendingEventView {
  id: string;
  title: string;
  body: string;
  channel: GameEventDef["channel"];
  optional: boolean;
  postponed: number;
  /** Minutes until it expires, or null when it does not expire. */
  minutesLeft: number | null;
  responses: Array<{ id: string; label: string; kind: EventResponseDef["kind"]; timeCostMinutes: number }>;
}

export interface MissionView {
  id: string;
  title: string;
  optional: boolean;
  /** Objective text of the current path. */
  objective: string;
  path: string | null;
  /** Minutes until the deadline, or null when it has none. */
  minutesLeft: number | null;
  /** Visible steps of the current path, in order (empty when the path has none). */
  steps: MissionStepView[];
  /** The first visible, required step that is not done; null when there is none. */
  current: MissionStepView | null;
}

export interface MissionStepView {
  id: string;
  label: string;
  target: MissionStepTarget | null;
  app: MissionStepApp | null;
  optional: boolean;
  done: boolean;
}

/** A mission that ended, for the "completed" part of the task list. */
export interface ClosedMissionView {
  id: string;
  title: string;
  optional: boolean;
  status: "completed" | "failed";
}

export interface ThesisApproachView {
  id: string;
  label: string;
  description: string | null;
  timeCostMinutes: number;
  progressGain: number;
}

export interface ThesisTaskView {
  id: string;
  label: string;
  description: string | null;
  timeCostMinutes: number;
  progressGain: number;
  approaches: ThesisApproachView[];
  done: boolean;
  /** Why it cannot be done now. Null when it can. */
  blocked: "done" | "locked" | "time" | "complete" | null;
}

export type ThesisQuality = "rough" | "reviewed" | "ready";

export function selectThesisQuality(state: ChapterState): ThesisQuality {
  if (state.persistent.finalDraftReviewed || state.persistent.draftFinished) return "ready";
  if (state.persistent.draftSourcesChecked || state.persistent.findingsReconciled) return "reviewed";
  return "rough";
}

export interface ThesisView {
  progress: number;
  /** Display-only draft state derived from the deterministic review flags. */
  quality: ThesisQuality;
  /** Free work (`WORK_ON_THESIS`) stops at this percent. */
  freeWorkMaxPercent: number;
  tasks: ThesisTaskView[];
}

function memo<R>(compute: (state: ChapterState, scenario: ScenarioDefinition) => R): (state: ChapterState, scenario: ScenarioDefinition) => R {
  const cache = new WeakMap<ChapterState, WeakMap<ScenarioDefinition, { value: R }>>();
  return (state, scenario) => {
    let byScenario = cache.get(state);
    if (!byScenario) {
      byScenario = new WeakMap();
      cache.set(state, byScenario);
    }
    const hit = byScenario.get(scenario);
    if (hit) return hit.value;
    const value = compute(state, scenario);
    byScenario.set(scenario, { value });
    return value;
  };
}

/** Pending events in arrival order, with the responses that are available now. */
export const selectPendingEvents = memo((state, scenario): PendingEventView[] => {
  const now = elapsedMinutes(state, scenario);
  const views: PendingEventView[] = [];
  for (const event of scenario.events ?? []) {
    if (!has(state.world.events, event.id)) continue;
    const current = state.world.events[event.id];
    if (current.status !== "pending") continue;
    views.push({
      id: event.id,
      title: event.title,
      body: event.body,
      channel: event.channel,
      optional: event.optional,
      postponed: current.postponed,
      minutesLeft: event.deadlineAfterMinutes === undefined ? null : Math.max(0, current.firedAtMinute + event.deadlineAfterMinutes - now),
      responses: event.responses
        .filter((response) => evaluateConditions(response.requires, state, scenario))
        .map((response) => ({ id: response.id, label: response.label, kind: response.kind, timeCostMinutes: response.timeCostMinutes ?? 0 })),
    });
  }
  return views.sort((a, b) => state.world.events[a.id].firedAtMinute - state.world.events[b.id].firedAtMinute);
});

/** Open missions, with the objective of their current path and the time left. */
export const selectOpenMissions = memo((state, scenario): MissionView[] => {
  const now = elapsedMinutes(state, scenario);
  const views: MissionView[] = [];
  for (const mission of scenario.missions ?? []) {
    if (!has(state.world.missions, mission.id)) continue;
    const current = state.world.missions[mission.id];
    if (current.status !== "open") continue;
    const path = mission.paths.find((candidate) => candidate.id === current.path);
    const steps = missionSteps(path?.steps ?? [], state, scenario);
    views.push({
      id: mission.id,
      title: mission.title,
      optional: mission.optional,
      objective: path?.objective ?? "",
      path: current.path,
      minutesLeft: mission.deadlineAtMinute === undefined ? null : Math.max(0, mission.deadlineAtMinute - now),
      steps,
      current: steps.find((step) => !step.done && !step.optional) ?? null,
    });
  }
  return views;
});

/** Steps of a path as the player sees them now: hidden ones are left out, done ones stay listed. */
function missionSteps(defs: readonly MissionStepDef[], state: ChapterState, scenario: ScenarioDefinition): MissionStepView[] {
  const views: MissionStepView[] = [];
  for (const def of defs) {
    const done = def.doneWhen !== undefined && def.doneWhen.length > 0 && evaluateConditions(def.doneWhen, state, scenario);
    if (!done && def.visibleWhen !== undefined && !evaluateConditions(def.visibleWhen, state, scenario)) continue;
    views.push({ id: def.id, label: def.label, target: def.target ?? null, app: def.app ?? null, optional: def.optional === true, done });
  }
  return views;
}

/** Missions that ended (completed or failed), in scenario order. */
export const selectClosedMissions = memo((state, scenario): ClosedMissionView[] => {
  const views: ClosedMissionView[] = [];
  for (const mission of scenario.missions ?? []) {
    if (!has(state.world.missions, mission.id)) continue;
    const status = state.world.missions[mission.id].status;
    if (status !== "completed" && status !== "failed") continue;
    views.push({ id: mission.id, title: mission.title, optional: mission.optional, status });
  }
  return views;
});

/** The thesis: progress, the limit of free work and the thesis tasks with why a task is blocked. */
export const selectThesisView = memo((state, scenario): ThesisView => {
  const config = gameplayConfig(scenario);
  const complete = state.resources.thesisProgress >= 100;
  return {
    progress: state.resources.thesisProgress,
    quality: selectThesisQuality(state),
    freeWorkMaxPercent: config.thesisFreeWorkMaxPercent,
    tasks: (scenario.thesisTasks ?? []).map((task): ThesisTaskView => {
      const done = state.world.thesisTasksDone.includes(task.id);
      const timeCost = effectiveWorkMinutes(task.timeCostMinutes ?? 0, state.resources.fatigue, config.fatigue);
      const blocked: ThesisTaskView["blocked"] = done
        ? "done"
        : complete
          ? "complete"
          : !evaluateConditions(task.requires, state, scenario)
            ? "locked"
            : timeCost > 0 && state.resources.timeMinutes <= 0
              ? "time"
              : null;
      return {
        id: task.id,
        label: task.label,
        description: task.description ?? null,
        timeCostMinutes: timeCost,
        progressGain: task.progressGain,
        approaches: (task.approaches ?? []).map((approach) => ({
          id: approach.id,
          label: approach.label,
          description: approach.description ?? null,
          timeCostMinutes: effectiveWorkMinutes(approach.timeCostMinutes ?? task.timeCostMinutes ?? 0, state.resources.fatigue, config.fatigue),
          progressGain: approach.progressGain ?? task.progressGain,
        })),
        done,
        blocked,
      };
    }),
  };
});

// ---------------------------------------------------------------------------
// Content validation
// ---------------------------------------------------------------------------

/** Chapter length in minutes: the latest time an event or deadline can be scheduled. */
const CHAPTER_MINUTES = 72 * 60;

/**
 * Checks the world content: unique IDs, a way to start, at least one response per event, a default
 * path per mission, times inside the chapter, valid thesis tasks and references to events and
 * missions that exist. Returns plain messages; an empty list means the content is consistent.
 */
export function validateWorldContent(scenario: ScenarioDefinition): string[] {
  const problems: string[] = [];
  // Untrusted input: the caller validates the rest of the shape.
  if (typeof scenario !== "object" || scenario === null) return problems;
  if (scenario.events !== undefined && !Array.isArray(scenario.events)) return ["Scenario events must be a list."];
  if (scenario.missions !== undefined && !Array.isArray(scenario.missions)) return ["Scenario missions must be a list."];
  if (scenario.thesisTasks !== undefined && !Array.isArray(scenario.thesisTasks)) return ["Scenario thesis tasks must be a list."];
  const events = scenario.events ?? [];
  const missions = scenario.missions ?? [];
  const eventIds = new Set<string>();
  const missionIds = new Set<string>();
  for (const event of events) {
    if (eventIds.has(event.id)) problems.push(`Event "${event.id}" is defined twice.`);
    eventIds.add(event.id);
  }
  for (const mission of missions) {
    if (missionIds.has(mission.id)) problems.push(`Mission "${mission.id}" is defined twice.`);
    missionIds.add(mission.id);
  }
  const taskIds = new Set<string>();
  for (const task of scenario.thesisTasks ?? []) {
    if (taskIds.has(task.id)) problems.push(`Thesis task "${task.id}" is defined twice.`);
    taskIds.add(task.id);
    if (!Number.isInteger(task.progressGain) || task.progressGain < 1 || task.progressGain > 100) {
      problems.push(`Thesis task "${task.id}" has an invalid progress gain.`);
    }
    if (task.timeCostMinutes !== undefined && (!Number.isInteger(task.timeCostMinutes) || task.timeCostMinutes < 0)) {
      problems.push(`Thesis task "${task.id}" has an invalid time cost.`);
    }
    const approachIds = new Set<string>();
    for (const approach of task.approaches ?? []) {
      if (approach.id.length === 0) {
        problems.push(`Thesis task "${task.id}" has an approach with an empty id.`);
        continue;
      }
      const where = `Thesis task "${task.id}", approach "${approach.id}"`;
      if (approachIds.has(approach.id)) problems.push(`${where} is defined twice.`);
      approachIds.add(approach.id);
      if (approach.progressGain !== undefined && (!Number.isInteger(approach.progressGain) || approach.progressGain < 1 || approach.progressGain > 100)) {
        problems.push(`${where} has an invalid progress gain.`);
      }
      if (approach.timeCostMinutes !== undefined && (!Number.isInteger(approach.timeCostMinutes) || approach.timeCostMinutes < 0)) {
        problems.push(`${where} has an invalid time cost.`);
      }
    }
  }
  const checkTime = (where: string, minutes: number | undefined): void => {
    if (minutes === undefined) return;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > CHAPTER_MINUTES) {
      problems.push(`${where} has a time outside the chapter (${minutes}).`);
    }
  };
  const checkTrigger = (where: string, trigger: WorldTrigger): void => {
    if (trigger.atMinute === undefined && trigger.afterAction === undefined && (trigger.when === undefined || trigger.when.length === 0)) {
      problems.push(`${where} has no trigger: it needs a time or a condition.`);
    }
    checkTime(where, trigger.atMinute);
  };
  const checkConditions = (where: string, conditions: readonly Condition[] | undefined): void => {
    for (const condition of conditions ?? []) {
      if ((condition.kind === "eventStatus" || condition.kind === "eventResponse") && !eventIds.has(condition.eventId)) {
        problems.push(`${where} reads the unknown event "${condition.eventId}".`);
      }
      if ((condition.kind === "missionStatus" || condition.kind === "missionPath") && !missionIds.has(condition.missionId)) {
        problems.push(`${where} reads the unknown mission "${condition.missionId}".`);
      }
      if (condition.kind === "thesisTaskDone" && !taskIds.has(condition.taskId)) {
        problems.push(`${where} reads the unknown thesis task "${condition.taskId}".`);
      }
    }
  };
  const checkEffects = (where: string, effects: ReadonlyArray<{ kind: string; missionId?: string }> | undefined): void => {
    for (const effect of effects ?? []) {
      if ((effect.kind === "openMission" || effect.kind === "lockMission") && !missionIds.has(effect.missionId ?? "")) {
        problems.push(`${where} changes the unknown mission "${effect.missionId}".`);
      }
    }
  };
  for (const task of scenario.thesisTasks ?? []) {
    checkConditions(`Thesis task "${task.id}"`, task.requires);
    checkEffects(`Thesis task "${task.id}"`, task.effects);
    for (const approach of task.approaches ?? []) {
      checkEffects(`Thesis task "${task.id}", approach "${approach.id}"`, approach.effects);
    }
  }
  for (const event of events) {
    const where = `Event "${event.id}"`;
    checkTrigger(where, event.trigger);
    checkConditions(where, event.trigger.when);
    checkEffects(where, event.onFire);
    checkEffects(where, event.onExpire);
    if (event.deadlineAfterMinutes !== undefined && (!Number.isInteger(event.deadlineAfterMinutes) || event.deadlineAfterMinutes < 1)) {
      problems.push(`${where} has an invalid deadline.`);
    }
    if (event.responses.length === 0 && event.autoResolve !== true) problems.push(`${where} has no response.`);
    const responseIds = new Set<string>();
    for (const response of event.responses) {
      if (responseIds.has(response.id)) problems.push(`${where} has two responses named "${response.id}".`);
      responseIds.add(response.id);
      checkConditions(`${where}, response "${response.id}"`, response.requires);
      checkEffects(`${where}, response "${response.id}"`, response.effects);
    }
  }
  for (const mission of missions) {
    const where = `Mission "${mission.id}"`;
    checkTrigger(where, mission.opensWhen);
    checkConditions(where, mission.opensWhen.when);
    checkConditions(where, mission.completeWhen);
    checkTime(where, mission.deadlineAtMinute);
    checkEffects(where, mission.onOpen);
    checkEffects(where, mission.onComplete);
    checkEffects(where, mission.onFail);
    if (mission.completeWhen.length === 0) problems.push(`${where} has no completion condition.`);
    if (mission.paths.length === 0) problems.push(`${where} has no path.`);
    else if (mission.paths.every((path) => path.when.length > 0)) problems.push(`${where} has no default path (a path without conditions).`);
    const pathIds = new Set<string>();
    for (const path of mission.paths) {
      if (pathIds.has(path.id)) problems.push(`${where} has two paths named "${path.id}".`);
      pathIds.add(path.id);
      checkConditions(`${where}, path "${path.id}"`, path.when);
      checkEffects(`${where}, path "${path.id}"`, path.onEnter);
      const stepIds = new Set<string>();
      for (const step of path.steps ?? []) {
        const stepWhere = `${where}, path "${path.id}", step "${step.id}"`;
        if (stepIds.has(step.id)) problems.push(`${where}, path "${path.id}" has two steps named "${step.id}".`);
        stepIds.add(step.id);
        if (step.label.trim() === "") problems.push(`${stepWhere} has no label.`);
        checkConditions(stepWhere, step.visibleWhen);
        checkConditions(stepWhere, step.doneWhen);
      }
    }
  }
  return problems;
}

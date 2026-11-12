/**
 * Property 8: The core is independent of audio, locale and settings (design.md,
 * "Correctness Properties").
 *
 * For any seeded sequence of Core_Actions interleaved with arbitrary player events (clip ended,
 * clip error, autoplay blocked, replay, mute, pause, volume change) and arbitrary language
 * switches, the resulting Chapter_State equals the state from the actions alone; a clip ending
 * never selects an option or advances a node; replay leaves the state unchanged; and the state
 * (the source of what a save stores) carries no audio, duration, caption or locale field.
 *
 * The narrative boundary forbids importing `game/voice`, `game/saves` or `fakeAudioPort`, so the
 * player events are modelled here by a small local player model, and each event is also offered to
 * the reducer as a dispatched value. The exact key set of `encodeProgress(state)` lives in
 * `game/saves` and is asserted by `chapterProgress.test.ts` (task 20.4), not here.
 *
 * **Validates: Requirements 5.8, 5.10, 7.7, 8.5, 12.6, 13.6**
 */

import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { INTERACTABLE_IDS, type InteractableId } from "../chapter1/ids";
import { availableOptions } from "../dialogueEngine";
import { localizeScenario, narrativeTextEntries } from "../localize";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, ScenarioDefinition } from "../types";

/** Offset so this file's cases do not reuse another property file's sequences. */
const PROPERTY_SEED = (CORE_PROPERTY_SEED + 8) >>> 0;

/** 200 cases of up to 80 actions, each run twice with deep comparisons, exceed Vitest's 5 s default. */
const PROPERTY_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Player events and a local player model
// ---------------------------------------------------------------------------

type PlayerEvent =
  | { type: "CLIP_ENDED" }
  | { type: "CLIP_ERROR" }
  | { type: "AUTOPLAY_BLOCKED" }
  | { type: "REPLAY" }
  | { type: "MUTE"; muted: boolean }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "VOLUME"; volume: number }
  | { type: "SWITCH_LOCALE"; variant: number };

const PLAYER_EVENT_KINDS = 9;

function randomPlayerEvent(next: () => number): PlayerEvent {
  switch (randomInt(next, 0, PLAYER_EVENT_KINDS - 1)) {
    case 0:
      return { type: "CLIP_ENDED" };
    case 1:
      return { type: "CLIP_ERROR" };
    case 2:
      return { type: "AUTOPLAY_BLOCKED" };
    case 3:
      return { type: "REPLAY" };
    case 4:
      return { type: "MUTE", muted: next() < 0.5 };
    case 5:
      return { type: "PAUSE" };
    case 6:
      return { type: "RESUME" };
    case 7:
      return { type: "VOLUME", volume: next() };
    default:
      return { type: "SWITCH_LOCALE", variant: randomInt(next, 0, 2) };
  }
}

/** Audio and locale settings. Only player events touch it; the core never reads it. */
interface PlayerModel {
  muted: boolean;
  paused: boolean;
  volume: number;
  blocked: boolean;
  clipFailed: boolean;
  replays: number;
  locale: number;
}

function applyPlayerEvent(model: PlayerModel, event: PlayerEvent): PlayerModel {
  switch (event.type) {
    case "CLIP_ENDED":
      return model;
    case "CLIP_ERROR":
      return { ...model, clipFailed: true };
    case "AUTOPLAY_BLOCKED":
      return { ...model, blocked: true };
    case "REPLAY":
      return { ...model, replays: model.replays + 1, clipFailed: false };
    case "MUTE":
      return { ...model, muted: event.muted };
    case "PAUSE":
      return { ...model, paused: true };
    case "RESUME":
      return { ...model, paused: false };
    case "VOLUME":
      return { ...model, volume: event.volume };
    case "SWITCH_LOCALE":
      return { ...model, locale: event.variant };
  }
}

// ---------------------------------------------------------------------------
// Locale variants: display text changes, nothing else
// ---------------------------------------------------------------------------

const NO_PROMPTS = Object.fromEntries(INTERACTABLE_IDS.map((id) => [id, "prompt"])) as Record<
  InteractableId,
  string
>;

/** Variant 0 is the English source; variants 1 and 2 replace every translatable text field. */
const LOCALE_VARIANTS: readonly ScenarioDefinition[] = [
  CHAPTER_1_SCENARIO,
  ...["[xx] ", "[yy] "].map((prefix) =>
    localizeScenario(
      CHAPTER_1_SCENARIO,
      Object.fromEntries(narrativeTextEntries(CHAPTER_1_SCENARIO, NO_PROMPTS).map((e) => [e.key, `${prefix}${e.text}`])),
    ),
  ),
];

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/** Keys that must never appear anywhere in Chapter_State (Requirements 13.6, 12.6). */
const FORBIDDEN_KEY = /audio|clip|duration|caption|locale|language|volume|muted/i;

function forbiddenKeys(value: unknown, path = "state"): string[] {
  if (value === null || typeof value !== "object") return [];
  const found: string[] = [];
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);
  for (const [key, child] of entries) {
    if (!Array.isArray(value) && FORBIDDEN_KEY.test(key)) found.push(`${path}.${key}`);
    found.push(...forbiddenKeys(child, `${path}.${key}`));
  }
  return found;
}

/**
 * `call.log[].displayName` is a display copy of the caller name taken from the scenario when the
 * record is created. `selectCallLog` re-resolves it by call ID from the active (localized)
 * scenario, so it is the one display-only field excluded from the comparison. Every other field,
 * including IDs, status, flags, evidence and the event log, must match exactly.
 */
function withoutCallerCopy(state: ChapterState): ChapterState {
  return { ...state, call: { ...state.call, log: state.call.log.map(({ displayName: _name, ...rest }) => rest as never) } };
}

/** Path and values of the first difference between two JSON-like values, for failure messages. */
function firstDifference(expected: unknown, actual: unknown, path = "state"): string {
  if (typeof expected === "object" && expected !== null && typeof actual === "object" && actual !== null) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of keys) {
      const found = firstDifference(
        (expected as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
      if (found !== "") return found;
    }
    return "";
  }
  return Object.is(expected, actual) ? "" : `${path} (${JSON.stringify(expected)} vs ${JSON.stringify(actual)})`;
}

/** Player events before each action (plan[i] runs before actions[i]); one extra list at the end. */
type EventPlan = PlayerEvent[][];

function makePlan(seed: number, length: number): EventPlan {
  const next = createLcg((seed ^ 0x5bd1e995) >>> 0);
  return Array.from({ length: length + 1 }, () =>
    next() < 0.5 ? [] : Array.from({ length: randomInt(next, 1, 3) }, () => randomPlayerEvent(next)),
  );
}

/**
 * Runs `actions` with `plan` interleaved and compares with the actions-only run. Returns the first
 * problem found, or null when the property holds.
 */
function findViolation(actions: readonly unknown[], plan: EventPlan): string | null {
  const baseline = runSequence(actions);
  let state: ChapterState = createInitialState();
  let model: PlayerModel = { muted: false, paused: false, volume: 1, blocked: false, clipFailed: false, replays: 0, locale: 0 };

  const interleave = (events: readonly PlayerEvent[], step: number): string | null => {
    for (const event of events) {
      const before = state;
      const optionsBefore = availableOptions(before, LOCALE_VARIANTS[model.locale]).map((o) => o.id);
      model = applyPlayerEvent(model, event);
      // The same event, offered to the core as a dispatched value, is not a Core_Action.
      const offered = chapterReducer(state, event, LOCALE_VARIANTS[model.locale]);
      if (offered.accepted || offered.state !== before) return `step ${step}: ${event.type} reached the core`;
      const optionsAfter = availableOptions(state, LOCALE_VARIANTS[model.locale]).map((o) => o.id);
      if (JSON.stringify(optionsAfter) !== JSON.stringify(optionsBefore)) return `step ${step}: ${event.type} changed the options`;
      if (state.conversation?.nodeId !== before.conversation?.nodeId) return `step ${step}: ${event.type} moved the node`;
    }
    return null;
  };

  for (let i = 0; i < actions.length; i += 1) {
    const problem = interleave(plan[i] ?? [], i);
    if (problem) return problem;
    const result = chapterReducer(state, actions[i], LOCALE_VARIANTS[model.locale]);
    state = result.state;
    if (result.accepted !== baseline.results[i].accepted) return `step ${i}: acceptance differs`;
    const difference = firstDifference(withoutCallerCopy(baseline.states[i + 1]), withoutCallerCopy(state));
    if (difference !== "") return `step ${i}: state differs from actions-only run at ${difference}`;
  }
  const tail = interleave(plan[actions.length] ?? [], actions.length);
  if (tail) return tail;

  // Replay at the end leaves the state unchanged; the final state equals the baseline.
  if (firstDifference(withoutCallerCopy(baseline.final), withoutCallerCopy(state)) !== "") {
    return "final state differs from actions-only run";
  }
  const leaks = forbiddenKeys(state);
  if (leaks.length > 0) return `state carries audio or locale fields: ${leaks.join(", ")}`;
  return null;
}

describe("Chapter 1 audio, locale and settings independence", () => {
  // Feature: chapter-01-voice-narrative, Property 8: The core is independent of audio, locale and settings
  it("gives the same Chapter_State with or without player events and language switches", () => {
    let interleavedCases = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(PROPERTY_SEED, index);
      const length = randomInt(createLcg(seed), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const plan = makePlan(seed, length);
      if (plan.some((events) => events.length > 0)) interleavedCases += 1;

      const violation = findViolation(actions, plan);
      if (violation !== null) {
        const prefix = shrinkFailingPrefix(actions, (candidate) => findViolation(candidate, plan) !== null);
        expect.fail(
          `seed ${seed} (case ${index}, length ${length}): ${violation}; shortest failing prefix: ${JSON.stringify(prefix)}`,
        );
      }
    }
    // The generator really interleaves events in (almost) every case.
    expect(interleavedCases).toBeGreaterThanOrEqual(CORE_PROPERTY_RUNS * 0.95);
  }, PROPERTY_TIMEOUT_MS);

  it("generates every kind of player event", () => {
    const next = createLcg(PROPERTY_SEED);
    const kinds = new Set(Array.from({ length: 200 }, () => randomPlayerEvent(next).type));
    expect(kinds.size).toBe(PLAYER_EVENT_KINDS);
  });
});

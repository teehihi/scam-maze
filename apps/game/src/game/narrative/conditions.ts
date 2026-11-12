// Conditions and effects for the deterministic chapter core.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Dialogue engine" and "Evidence registry".
//
// Every function here is pure. `applyEffect` never mutates its input: it returns a new
// ChapterState when the effect changes something, and the same object when the effect is a
// no-op (already set, unknown ID, already recorded). Callers can compare by identity.

import type { CallId } from "./chapter1/ids";
import { discover } from "./evidence";
import type { ChapterState, Condition, Effect, PressureLevel, ScenarioDefinition } from "./types";

/** Highest pressure level (Requirement 10.6). */
export const MAX_PRESSURE: PressureLevel = 3;

/** True when the call was answered and has since ended (a declined call does not count). */
function hasCallEnded(state: ChapterState, callId: CallId): boolean {
  return state.call.log.some((record) => record.callId === callId && record.status === "ended");
}

/**
 * Evaluates one data-defined condition against the state.
 * `scenario` is accepted for symmetry with `applyEffect`; the current condition kinds only read
 * Chapter_State.
 */
export function evaluateCondition(
  condition: Condition,
  state: ChapterState,
  _scenario?: ScenarioDefinition,
): boolean {
  switch (condition.kind) {
    case "hasEvidence":
      return state.discovered.includes(condition.evidenceId);
    case "hasAnyEvidence":
      return condition.evidenceIds.some((id) => state.discovered.includes(id));
    case "flag":
      return state.flags[condition.flag] === true;
    case "notFlag":
      return state.flags[condition.flag] !== true;
    case "callEnded":
      return hasCallEnded(state, condition.callId);
    case "claimStatus":
      return state.claims[condition.claimId] === condition.status;
    case "callRang":
      return state.call.log.some((record) => record.callId === condition.callId);
    case "objectiveCompleted":
      return state.objectives.completed.includes(condition.objectiveId);
    case "outcomeSet":
      return state.outcome !== null;
    case "evidenceCountAtLeast": {
      const found = condition.evidenceIds.filter((id) => state.discovered.includes(id)).length;
      return found >= condition.count;
    }
    default:
      return assertNever(condition);
  }
}

/** True when every condition holds. An empty or missing list holds. */
export function evaluateConditions(
  conditions: readonly Condition[] | undefined,
  state: ChapterState,
  scenario?: ScenarioDefinition,
): boolean {
  if (!conditions) return true;
  return conditions.every((condition) => evaluateCondition(condition, state, scenario));
}

function clampPressure(value: number): PressureLevel {
  return Math.min(MAX_PRESSURE, Math.max(0, value)) as PressureLevel;
}

/**
 * Applies one data-defined effect and returns the resulting state. Never mutates `state`.
 *
 * - `setFlag`: sets the flag to true.
 * - `discoverEvidence`: idempotent append to `discovered` (unknown evidence IDs are ignored).
 * - `addPressure`: adds `amount` (default 1, whole numbers), clamped to 0..3.
 * - `setClaimStatus`: sets the Claim status. Only independent-channel graphs may author this
 *   effect; `validateScenario` enforces that rule (Requirement 12.6).
 * - `recordDecision`: records the Decision only if none is recorded yet.
 * - `deliverMessage`: appends a known message to the phone inbox and marks it unread, once.
 */
export function applyEffect(
  state: ChapterState,
  effect: Effect,
  scenario: ScenarioDefinition,
): ChapterState {
  switch (effect.kind) {
    case "setFlag": {
      if (state.flags[effect.flag] === true) return state;
      return { ...state, flags: { ...state.flags, [effect.flag]: true } };
    }
    case "discoverEvidence": {
      if (!Object.hasOwn(scenario.evidence, effect.evidenceId)) return state;
      return discover(state, effect.evidenceId);
    }
    case "addPressure": {
      const amount = effect.amount ?? 1;
      if (!Number.isFinite(amount)) return state;
      const next = clampPressure(state.pressure + Math.trunc(amount));
      if (next === state.pressure) return state;
      return { ...state, pressure: next };
    }
    case "setClaimStatus": {
      if (!Object.hasOwn(scenario.claims, effect.claimId)) return state;
      if (state.claims[effect.claimId] === effect.status) return state;
      return { ...state, claims: { ...state.claims, [effect.claimId]: effect.status } };
    }
    case "recordDecision": {
      if (state.decision !== null) return state;
      if (!Object.hasOwn(scenario.decisions, effect.decision)) return state;
      return { ...state, decision: effect.decision };
    }
    case "deliverMessage": {
      if (!Object.hasOwn(scenario.phone.messages, effect.messageId)) return state;
      if (state.phone.messages.includes(effect.messageId)) return state;
      return {
        ...state,
        phone: {
          ...state.phone,
          messages: [...state.phone.messages, effect.messageId],
          unread: state.phone.unread.includes(effect.messageId)
            ? state.phone.unread
            : [...state.phone.unread, effect.messageId],
        },
      };
    }
    default:
      return assertNever(effect);
  }
}

/** Applies effects in order. Returns the input object when no effect changed anything. */
export function applyEffects(
  state: ChapterState,
  effects: readonly Effect[] | undefined,
  scenario: ScenarioDefinition,
): ChapterState {
  if (!effects) return state;
  return effects.reduce((current, effect) => applyEffect(current, effect, scenario), state);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}

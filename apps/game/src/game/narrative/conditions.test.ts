// Example tests for the call, objective, outcome and evidence-count conditions.

import { describe, expect, it } from "vitest";

import { evaluateCondition } from "./conditions";
import { createInitialState } from "./reducer";
import type { CallRecord, ChapterState, Condition } from "./types";

const record = (callId: CallRecord["callId"], status: CallRecord["status"]): CallRecord => ({
  callId,
  direction: "incoming",
  displayName: "Test caller",
  number: "+000 555 0100",
  status,
  ringCount: 1,
});

const withLog = (log: CallRecord[]): ChapterState => {
  const base = createInitialState();
  return { ...base, call: { ...base.call, log } };
};

describe("callRang", () => {
  const condition = { kind: "callRang", callId: "call.followup" } as const;

  it("is false when the call has no log record", () => {
    expect(evaluateCondition(condition, createInitialState())).toBe(false);
    expect(evaluateCondition(condition, withLog([record("call.scam-1", "ended")]))).toBe(false);
  });

  it("is true for any status once a record exists", () => {
    for (const status of ["ringing", "answered", "declined", "missed", "ended"] as const) {
      expect(evaluateCondition(condition, withLog([record("call.followup", status)]))).toBe(true);
    }
  });
});

describe("objectiveCompleted", () => {
  const condition = { kind: "objectiveCompleted", objectiveId: "obj.decide" } as const;

  it("is false when the objective is not completed, even if active", () => {
    const base = createInitialState();
    expect(evaluateCondition(condition, base)).toBe(false);
    expect(
      evaluateCondition(condition, { ...base, objectives: { active: ["obj.decide"], completed: [] } }),
    ).toBe(false);
  });

  it("is true when the objective is in the completed list", () => {
    const base = createInitialState();
    const state = { ...base, objectives: { active: [], completed: ["obj.decide" as const] } };
    expect(evaluateCondition(condition, state)).toBe(true);
  });
});

describe("outcomeSet", () => {
  const condition = { kind: "outcomeSet" } as const;

  it("is false while the outcome is null", () => {
    expect(evaluateCondition(condition, createInitialState())).toBe(false);
  });

  it("is true once any outcome is set", () => {
    expect(evaluateCondition(condition, { ...createInitialState(), outcome: "verified" })).toBe(true);
  });
});

describe("evidenceCountAtLeast", () => {
  const condition: Extract<Condition, { kind: "evidenceCountAtLeast" }> = {
    kind: "evidenceCountAtLeast",
    evidenceIds: ["ev.bank-card", "ev.sms-alert"],
    count: 2,
  };

  it("is false below the count", () => {
    const base = createInitialState();
    expect(evaluateCondition(condition, base)).toBe(false);
    expect(evaluateCondition(condition, { ...base, discovered: ["ev.bank-card"] })).toBe(false);
  });

  it("is true exactly at the count and above it", () => {
    const base = createInitialState();
    expect(evaluateCondition(condition, { ...base, discovered: ["ev.bank-card", "ev.sms-alert"] })).toBe(true);
    expect(evaluateCondition({ ...condition, count: 1 }, { ...base, discovered: ["ev.sms-alert"] })).toBe(true);
  });

  it("ignores discovered items that are not in the list", () => {
    const state = { ...createInitialState(), discovered: ["ev.bank-card" as const] };
    expect(evaluateCondition({ ...condition, evidenceIds: ["ev.sms-alert"], count: 1 }, state)).toBe(false);
  });
});

// Scripted end-to-end playthroughs of Chapter 1 through the pure chapter core
// (design.md, "Testing Strategy", scripted end-to-end runs). Every run dispatches real
// Core_Actions with real dialogue option IDs through the Chapter_Store, expects every action to be
// accepted, and checks the objective order, the claim statuses, the Outcome, the consequence
// variant and the debrief sections.
// Requirements 10.1, 11.10, 13.7, 13.9, 13.10, 14.3, 18.2.

import { describe, expect, it } from "vitest";

import { buildDebrief, type DebriefView } from "../debrief";
import { selectConsequenceVariant } from "../outcome";
import { createInitialState } from "../reducer";
import { createChapterStore } from "../store";
import type { ChapterState, ClaimStatus, CoreAction } from "../types";
import type { ClaimId, EvidenceId } from "./ids";
import { CHAPTER_1_SCENARIO } from "./scenario";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dispatches every action through a fresh Chapter_Store and fails on the first rejection. */
function playthrough(actions: readonly CoreAction[]): ChapterState {
  const store = createChapterStore(createInitialState(), CHAPTER_1_SCENARIO);
  actions.forEach((action, index) => {
    const result = store.dispatch(action);
    expect(result.accepted, `action ${index} ${JSON.stringify(action)} rejected: ${result.reason ?? ""}`).toBe(
      true,
    );
  });
  expect(store.getState().events).toHaveLength(actions.length);
  return store.getState();
}

/**
 * Objective activation and completion sequence derived from the Event_Log.
 * Within one step, activations come before completions (the objective manager's order).
 */
function objectiveTimeline(state: ChapterState): string[] {
  return state.events.flatMap((entry) => [
    ...entry.derived.objectivesActivated.map((id) => `activate ${id}`),
    ...entry.derived.objectivesCompleted.map((id) => `complete ${id}`),
  ]);
}

function eventTags(state: ChapterState): string[] {
  return state.events.flatMap((entry) => entry.derived.debriefTags);
}

function requireDebrief(state: ChapterState): DebriefView {
  const debrief = buildDebrief(state, CHAPTER_1_SCENARIO);
  expect(debrief).not.toBeNull();
  return debrief as DebriefView;
}

/** Every Event_Log debrief tag appears in the debrief decisions, in log order. */
function expectDecisionsMatchLog(state: ChapterState, debrief: DebriefView): void {
  expect(debrief.decisions.map((decision) => decision.tag)).toEqual(eventTags(state));
  for (const decision of debrief.decisions) {
    expect(decision.text).toBe(CHAPTER_1_SCENARIO.debrief.decisionNotes[decision.tag]);
  }
}

function claims(statuses: Partial<Record<ClaimId, ClaimStatus>>): Record<ClaimId, ClaimStatus> {
  return {
    "claim.caller-identity": "unverified",
    "claim.account-suspended": "unverified",
    "claim.code-needed": "unverified",
    "claim.protected-account": "unverified",
    ...statuses,
  };
}

/** Evidence with a debrief hint, in scenario order, minus the discovered items. */
function hintedEvidenceExcept(found: readonly EvidenceId[]): EvidenceId[] {
  return (Object.keys(CHAPTER_1_SCENARIO.evidence) as EvidenceId[]).filter(
    (id) => CHAPTER_1_SCENARIO.evidence[id].debriefHint !== undefined && !found.includes(id),
  );
}

const SIMULATION_LABEL = "Simulation: nothing real happened.";

const START: CoreAction = { type: "START_CHAPTER" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const OPEN_PHONE: CoreAction = { type: "OPEN_PHONE" };
const CLOSE_PHONE: CoreAction = { type: "CLOSE_PHONE" };
const FINISH: CoreAction = { type: "FINISH_CHAPTER" };

function option(optionId: string): CoreAction {
  return { type: "SELECT_DIALOGUE_OPTION", optionId };
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

describe("Chapter 1 scripted playthroughs", () => {
  it("verified: contradiction chain, then the official line", () => {
    const actions: CoreAction[] = [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      ANSWER,
      option("opt.scam.open.ask-proof"),
      option("opt.scam.knows.challenge"),
      option("opt.scam.challenged.call-card"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
      { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" },
      CLOSE_PHONE,
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.block"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ];
    const state = playthrough(actions);

    // Contradiction chain (Requirement 11.10): the caller's number differs from the card's number,
    // and the journal note for the mismatch is unlocked by the discovered evidence.
    const callerRecord = state.call.log.find((record) => record.callId === "call.scam-1");
    expect(callerRecord?.number).toBe("+000 555 0142");
    expect(CHAPTER_1_SCENARIO.evidence["ev.bank-card"].description).toContain("+000 555 0100");
    expect(callerRecord?.number).not.toBe(CHAPTER_1_SCENARIO.calls["call.official"].number);
    const mismatch = CHAPTER_1_SCENARIO.journalNotes.find((note) => note.id === "note.number-mismatch");
    expect(mismatch?.requires.every((id) => state.discovered.includes(id))).toBe(true);

    // The bank app alone left the suspension claim inconclusive; the official line contradicted it.
    const afterApp = state.events[9];
    expect(afterApp.action).toEqual(actions[9]);
    expect(afterApp.derived.evidence).toEqual(["ev.bank-app"]);
    expect(state.flags.number_challenged).toBe(true);
    expect(state.flags.scam1_hung_up_to_verify).toBe(true);

    expect(objectiveTimeline(state)).toEqual([
      "activate obj.look-around",
      "complete obj.look-around",
      "activate obj.answer-call",
      "complete obj.answer-call",
      "activate obj.check-claims",
      "activate obj.decide",
      "activate obj.call-bank",
      "complete obj.check-claims",
      "activate obj.file-report",
      "complete obj.call-bank",
      "activate obj.review",
      "complete obj.decide",
      "complete obj.review",
    ]);
    // obj.file-report is optional and stays active: the flag report_filed is not set in this run.
    expect(state.objectives.active).toEqual(["obj.file-report"]);

    expect(state.claims).toEqual(
      claims({
        "claim.caller-identity": "contradicted",
        "claim.account-suspended": "contradicted",
        "claim.code-needed": "contradicted",
      }),
    );
    expect(state.flags.code_shared).toBe(false);
    expect(state.flags.money_moved).toBe(false);
    expect(state.decision).toBe("verify-independently");
    expect(state.outcome).toBe("verified");
    expect(state.status).toBe("finished");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("verified.reported");

    const debrief = requireDebrief(state);
    expect(debrief.outcome.id).toBe("verified");
    expect(debrief.outcome.consequence?.id).toBe("verified.reported");
    expect(debrief.outcome.simulationLabel).toBe(SIMULATION_LABEL);
    expect(debrief.outcome.summary).toBe(CHAPTER_1_SCENARIO.debrief.outcomeSummaries.verified);
    expect(debrief.decisions.map((decision) => decision.tag)).toEqual([
      "asked-for-proof",
      "challenged-number",
      "hung-up-to-verify",
      "reported-to-bank",
      "blocked-number",
      "chose-verify-independently",
    ]);
    expectDecisionsMatchLog(state, debrief);
    const found: EvidenceId[] = [
      "ev.bank-card",
      "ev.partial-info",
      "ev.caller-number",
      "ev.bank-app",
      "ev.official-confirmation",
    ];
    expect(debrief.evidenceFound.map((item) => item.id)).toEqual(found);
    expect(debrief.warningSignsNoticed.map((sign) => sign.id)).toEqual(["ws.partial-details", "ws.unknown-number"]);
    expect(debrief.cluesMissed.map((clue) => clue.id)).toEqual(hintedEvidenceExcept(found));
    expect(debrief.mechanism).toBe(CHAPTER_1_SCENARIO.debrief.mechanism);
    expect(debrief.saferAlternatives.length).toBeGreaterThan(0);
  });

  it("risky: the code is shared and money is moved during the call", () => {
    const actions: CoreAction[] = [
      START,
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      ANSWER,
      option("opt.scam.open.yes-what"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
      option("opt.scam.code.read-code"),
      option("opt.scam.move.move-money"),
      FINISH,
    ];
    const state = playthrough(actions);

    expect(objectiveTimeline(state)).toEqual([
      "activate obj.look-around",
      "activate obj.answer-call",
      "complete obj.answer-call",
      "activate obj.check-claims",
      "activate obj.decide",
      "activate obj.review",
      "activate obj.call-bank",
      "complete obj.decide",
      "complete obj.review",
    ]);
    // The player never looked around or checked the claims.
    expect(state.objectives.active).toEqual(["obj.look-around", "obj.check-claims", "obj.call-bank"]);

    expect(state.claims).toEqual(claims({}));
    expect(state.flags.code_shared).toBe(true);
    expect(state.flags.money_moved).toBe(true);
    expect(state.pressure).toBe(2);
    // The Decision is recorded inside the call, so the Outcome is set in the same step.
    expect(state.events[7].derived.debriefTags).toEqual(["moved-money"]);
    expect(state.decision).toBe("follow-request");
    expect(state.outcome).toBe("risky");
    expect(state.status).toBe("finished");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("risky.money-moved");

    const debrief = requireDebrief(state);
    expect(debrief.outcome.id).toBe("risky");
    expect(debrief.outcome.consequence?.id).toBe("risky.money-moved");
    expect(debrief.outcome.simulationLabel).toBe(SIMULATION_LABEL);
    expect(debrief.decisions.map((decision) => decision.tag)).toEqual(["shared-code", "moved-money"]);
    expectDecisionsMatchLog(state, debrief);
    expect(debrief.evidenceFound.map((item) => item.id)).toEqual(["ev.otp-sms"]);
    expect(debrief.warningSignsNoticed.map((sign) => sign.id)).toEqual(["ws.code-request"]);
    const missed = debrief.cluesMissed.map((clue) => clue.id);
    expect(missed).toEqual(hintedEvidenceExcept(["ev.otp-sms"]));
    expect(missed).toEqual(expect.arrayContaining(["ev.bank-card", "ev.shop-poster", "ev.official-confirmation"]));
  });

  it("risky: the code is shared, then the player reports it on the official line (account locked)", () => {
    const actions: CoreAction[] = [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.mailbox" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      ANSWER,
      option("opt.scam.open.yes-what"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
      option("opt.scam.code.read-code"),
      option("opt.scam.move.stop"),
      option("opt.scam.guilt.hang-up"),
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.code-shared"),
      option("opt.official.locked.block"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ];
    const state = playthrough(actions);

    expect(objectiveTimeline(state)).toEqual([
      "activate obj.look-around",
      "complete obj.look-around",
      "activate obj.answer-call",
      "complete obj.answer-call",
      "activate obj.check-claims",
      "activate obj.decide",
      "activate obj.call-bank",
      "complete obj.check-claims",
      "activate obj.file-report",
      "complete obj.call-bank",
      "activate obj.review",
      "complete obj.decide",
      "complete obj.review",
    ]);

    expect(state.claims).toEqual(
      claims({
        "claim.caller-identity": "contradicted",
        "claim.account-suspended": "contradicted",
        "claim.code-needed": "contradicted",
      }),
    );
    expect(state.flags.code_shared).toBe(true);
    expect(state.flags.money_moved).toBe(false);
    expect(state.flags.account_locked).toBe(true);
    expect(state.pressure).toBe(3);
    // A shared code makes the Outcome risky even after an independent check (Requirement 13.7).
    expect(state.decision).toBe("verify-independently");
    expect(state.outcome).toBe("risky");
    expect(state.status).toBe("finished");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("risky.code-shared-locked");

    const debrief = requireDebrief(state);
    expect(debrief.outcome.id).toBe("risky");
    expect(debrief.outcome.consequence?.id).toBe("risky.code-shared-locked");
    expect(debrief.outcome.simulationLabel).toBe(SIMULATION_LABEL);
    expect(debrief.decisions.map((decision) => decision.tag)).toEqual([
      "shared-code",
      "said-stop",
      "hung-up",
      "reported-to-bank",
      "told-bank-about-code",
      "blocked-number",
      "chose-verify-independently",
    ]);
    expectDecisionsMatchLog(state, debrief);
    const found: EvidenceId[] = ["ev.bank-letter", "ev.otp-sms", "ev.official-confirmation"];
    expect(debrief.evidenceFound.map((item) => item.id)).toEqual(found);
    expect(debrief.warningSignsNoticed.map((sign) => sign.id)).toEqual(["ws.code-request"]);
    const missed = debrief.cluesMissed.map((clue) => clue.id);
    expect(missed).toEqual(hintedEvidenceExcept(found));
    expect(missed.length).toBeGreaterThan(0);
  });

  it("uncertain: decline, re-ring, hang up, then stop and wait", () => {
    const actions: CoreAction[] = [
      START,
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      END_CALL, // decline
      { type: "RING_CALL", callId: "call.scam-1", reason: "re-ring" },
      ANSWER,
      END_CALL, // hang up immediately
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
      CLOSE_PHONE,
      { type: "MAKE_DECISION", decision: "stop-and-wait" },
      FINISH,
    ];
    const state = playthrough(actions);

    const scamRecords = state.call.log.filter((record) => record.callId === "call.scam-1");
    expect(scamRecords).toHaveLength(1);
    expect(scamRecords[0].ringCount).toBe(2);
    expect(scamRecords[0].status).toBe("ended");
    // Declining does not end the call for the objectives; hanging up after answering does.
    expect(state.events[2].derived.objectivesActivated).toEqual([]);
    expect(state.events[5].derived.objectivesActivated).toEqual(["obj.check-claims", "obj.decide", "obj.call-bank"]);

    expect(objectiveTimeline(state)).toEqual([
      "activate obj.look-around",
      "activate obj.answer-call",
      "complete obj.answer-call",
      "activate obj.check-claims",
      "activate obj.decide",
      "activate obj.call-bank",
      "activate obj.review",
      "complete obj.decide",
      "complete obj.review",
    ]);
    expect(state.objectives.active).toEqual(["obj.look-around", "obj.check-claims", "obj.call-bank"]);

    expect(state.claims).toEqual(claims({}));
    expect(state.flags.code_shared).toBe(false);
    expect(state.flags.money_moved).toBe(false);
    expect(state.decision).toBe("stop-and-wait");
    expect(state.outcome).toBe("uncertain");
    expect(state.status).toBe("finished");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("uncertain.stopped");

    const debrief = requireDebrief(state);
    expect(debrief.outcome.id).toBe("uncertain");
    expect(debrief.outcome.consequence?.id).toBe("uncertain.stopped");
    expect(debrief.outcome.simulationLabel).toBe(SIMULATION_LABEL);
    expect(debrief.decisions.map((decision) => decision.tag)).toEqual(["hung-up", "chose-stop-and-wait"]);
    expectDecisionsMatchLog(state, debrief);
    expect(debrief.evidenceFound.map((item) => item.id)).toEqual(["ev.caller-number"]);
    expect(debrief.warningSignsNoticed.map((sign) => sign.id)).toEqual(["ws.unknown-number"]);
    const missed = debrief.cluesMissed.map((clue) => clue.id);
    expect(missed).toEqual(hintedEvidenceExcept(["ev.caller-number"]));
    expect(missed).toEqual(expect.arrayContaining(["ev.bank-card", "ev.official-confirmation"]));
  });

  it("investigator: checks, collects evidence and files a report", () => {
    const actions: CoreAction[] = [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
      { type: "INTERACT_OBJECT", objectId: "obj.mailbox" },
      { type: "INTERACT_OBJECT", objectId: "obj.shop-poster" },
      { type: "INTERACT_OBJECT", objectId: "obj.notice-board" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
      ANSWER,
      option("opt.scam.open.ask-proof"),
      option("opt.scam.knows.verify"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
      { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" },
      CLOSE_PHONE,
      { type: "TALK_TO_NPC", npcId: "npc.sam" },
      option("opt.sam.ask.yes-called"),
      option("opt.sam.story.what-did-you-do"),
      option("opt.sam.advice.bye"),
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.anything-else"),
      option("opt.official.hub.transfer"),
      option("opt.official.transfer.back"),
      option("opt.official.hub.report"),
      option("opt.official.report-intro.number"),
      option("opt.official.report-filed.back"),
      option("opt.official.hub.all-done"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ];
    const state = playthrough(actions);

    expect(state.flags.report_filed).toBe(true);
    expect(state.flags.code_shared).toBe(false);
    expect(state.flags.money_moved).toBe(false);
    // 10 of the 11 listed items (all but ev.second-number): at least the 8 the ending needs.
    const listed: EvidenceId[] = [
      "ev.caller-number",
      "ev.bank-card",
      "ev.bank-letter",
      "ev.bank-app",
      "ev.shop-poster",
      "ev.community-alert",
      "ev.sam-testimony",
      "ev.official-confirmation",
      "ev.transfer-check",
      "ev.second-number",
      "ev.partial-info",
    ];
    expect(listed.filter((id) => state.discovered.includes(id)).length).toBeGreaterThanOrEqual(8);
    expect(state.claims["claim.caller-identity"]).toBe("contradicted");
    expect(state.decision).toBe("verify-independently");
    expect(state.outcome).toBe("investigator");
    expect(state.status).toBe("finished");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("investigator.report");

    const debrief = requireDebrief(state);
    expect(debrief.outcome.id).toBe("investigator");
    expect(debrief.outcome.simulationLabel).toBe(SIMULATION_LABEL);
    expectDecisionsMatchLog(state, debrief);
    expect(debrief.decisions.map((decision) => decision.tag)).toContain("reported-details");
  });

  it("callback exposed: the player tells the caller the bank said no after the official line", () => {
    const actions: CoreAction[] = [
      START,
      { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      ANSWER,
      option("opt.scam.open.verify"),
      { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
      option("opt.official.greeting.wait"),
      option("opt.official.agent.report"),
      option("opt.official.confirm.block"),
      { type: "RING_CALL", callId: "call.callback", reason: "callback" },
      ANSWER,
      option("opt.callback.open.i-called-bank"),
      option("opt.callback.exposed.hang-up"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
      FINISH,
    ];
    const state = playthrough(actions);

    const callbackRecord = state.call.log.find((record) => record.callId === "call.callback");
    expect(callbackRecord?.status).toBe("ended");
    expect(state.flags.secrecy_heard).toBe(true);
    expect(state.flags.code_shared).toBe(false);
    expect(state.flags.money_moved).toBe(false);
    expect(state.discovered).toContain("ev.official-confirmation");
    expect(state.outcome).toBe("verified");
    expect(state.status).toBe("finished");

    const debrief = requireDebrief(state);
    expect(debrief.decisions.map((decision) => decision.tag)).toEqual(
      expect.arrayContaining(["told-caller-bank-said-no", "hung-up-on-callback"]),
    );
    expectDecisionsMatchLog(state, debrief);
  });

  it("follow-up: money is moved on the case desk call (risky)", () => {
    const actions: CoreAction[] = [
      START,
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      ANSWER,
      END_CALL,
      { type: "RING_CALL", callId: "call.callback", reason: "callback" },
      END_CALL, // decline: the callback is closed, so the follow-up may ring
      { type: "RING_CALL", callId: "call.followup", reason: "follow-up" },
      ANSWER,
      option("opt.followup.open.who"),
      option("opt.followup.badge.callback-number"),
      option("opt.followup.case-details.okay"),
      option("opt.followup.final.move-money"),
      FINISH,
    ];
    const state = playthrough(actions);

    expect(state.flags.followup_rang).toBe(true);
    expect(state.flags.case_sms_sent).toBe(true);
    expect(state.flags.money_moved).toBe(true);
    expect(state.decision).toBe("follow-request");
    expect(state.outcome).toBe("risky");
    expect(state.status).toBe("finished");
    expect(selectConsequenceVariant(state, CHAPTER_1_SCENARIO)?.id).toBe("risky.money-moved");

    const debrief = requireDebrief(state);
    expect(debrief.outcome.id).toBe("risky");
    expect(debrief.outcome.simulationLabel).toBe(SIMULATION_LABEL);
    expect(debrief.decisions.map((decision) => decision.tag)).toContain("moved-money");
    expectDecisionsMatchLog(state, debrief);
  });

  it("follow-up: the player hangs up on the case desk", () => {
    const actions: CoreAction[] = [
      START,
      { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
      ANSWER,
      END_CALL,
      { type: "RING_CALL", callId: "call.callback", reason: "callback" },
      END_CALL,
      { type: "RING_CALL", callId: "call.followup", reason: "follow-up" },
      ANSWER,
      option("opt.followup.open.hang-up"),
      OPEN_PHONE,
      { type: "INSPECT_EVIDENCE", evidenceId: "ev.second-number" },
      CLOSE_PHONE,
      { type: "MAKE_DECISION", decision: "stop-and-wait" },
      FINISH,
    ];
    const state = playthrough(actions);

    const record = state.call.log.find((entry) => entry.callId === "call.followup");
    expect(record?.status).toBe("ended");
    expect(record?.number).toBe("+000 555 0177");
    expect(state.flags.followup_rang).toBe(true);
    expect(state.flags.money_moved).toBe(false);
    expect(state.flags.code_shared).toBe(false);
    expect(state.discovered).toContain("ev.second-number");
    expect(state.decision).toBe("stop-and-wait");
    expect(state.outcome).toBe("uncertain");
    expect(state.status).toBe("finished");

    const debrief = requireDebrief(state);
    expect(debrief.decisions.map((decision) => decision.tag)).toContain("hung-up-on-followup");
    expectDecisionsMatchLog(state, debrief);
  });
});

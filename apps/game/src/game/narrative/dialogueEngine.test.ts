// Unit tests for the dialogue engine: Sam's start node before and after the call, the challenge
// option gated by the card, the one-time-code delivery, the pressure cap and the fallback option
// (Requirements 9.2-9.7, 10.2-10.7, 18.1).

import { describe, expect, it } from "vitest";

import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { applyEffect, MAX_PRESSURE } from "./conditions";
import {
  availableOptions,
  FALLBACK_OPTION_ID,
  FALLBACK_OPTION_TEXT,
  OPTION_NOT_AVAILABLE,
  resolveStartNode,
  selectOption,
  startConversation,
} from "./dialogueEngine";
import { chapterReducer, createInitialState } from "./reducer";
import type { ChapterState, CoreAction, ScenarioDefinition } from "./types";

function play(
  state: ChapterState,
  actions: readonly CoreAction[],
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): ChapterState {
  let current = state;
  for (const action of actions) {
    const result = chapterReducer(current, action, scenario);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    current = result.state;
  }
  return current;
}

const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
const optionIds = (state: ChapterState, scenario = CHAPTER_1_SCENARIO): string[] =>
  availableOptions(state, scenario).map((view) => view.id);
const started = (): ChapterState => play(createInitialState(), [{ type: "START_CHAPTER" }]);
const TALK_TO_SAM: CoreAction = { type: "TALK_TO_NPC", npcId: "npc.sam" };
const RING: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" };

describe("Sam's start node (Requirements 9.2, 10.7)", () => {
  it("starts at the greeting before the scam call", () => {
    const state = play(started(), [TALK_TO_SAM]);
    expect(state.conversation?.nodeId).toBe("sam.before.greet");
    expect(optionIds(state)).toEqual([
      "opt.sam.greet.ask-notice",
      "opt.sam.greet.bye",
      "opt.sam.greet.chat",
    ]);
  });

  it("still starts at the greeting when the call was only declined", () => {
    const state = play(started(), [RING, { type: "END_CALL" }, TALK_TO_SAM]);
    expect(state.conversation?.nodeId).toBe("sam.before.greet");
  });

  it("starts at the after-call node once the scam call has ended", () => {
    const state = play(started(), [RING, { type: "ANSWER_CALL" }, { type: "END_CALL" }, TALK_TO_SAM]);
    expect(state.conversation?.nodeId).toBe("sam.after-call.ask");
  });

  it("resolveStartNode picks the first matching startNodeWhen entry, otherwise startNodeId", () => {
    const graph = CHAPTER_1_SCENARIO.dialogues["dlg.shopkeeper"];
    const before = started();
    expect(resolveStartNode(before, graph, CHAPTER_1_SCENARIO)).toBe("sam.before.greet");
    const after = play(before, [RING, { type: "ANSWER_CALL" }, { type: "END_CALL" }]);
    expect(resolveStartNode(after, graph, CHAPTER_1_SCENARIO)).toBe("sam.after-call.ask");
  });

  it("each visit runs to an end node and is archived with its history", () => {
    const state = play(started(), [TALK_TO_SAM, option("opt.sam.greet.ask-notice"), option("opt.sam.notice.bye")]);
    expect(state.conversation).toBeNull();
    expect(state.conversationHistory).toEqual([
      {
        graphId: "dlg.shopkeeper",
        history: [
          { nodeId: "sam.before.greet", optionId: "opt.sam.greet.ask-notice" },
          { nodeId: "sam.before.notice", optionId: "opt.sam.notice.bye" },
        ],
        endNodeId: "sam.end",
      },
    ]);
    expect(state.events.at(-1)?.derived.debriefTags).toEqual(["talked-to-sam"]);
  });
});

describe("challenge option gated by the official number (Requirement 10.2)", () => {
  const atKnowsDetails = (before: CoreAction[]): ChapterState =>
    play(started(), [...before, RING, { type: "ANSWER_CALL" }, option("opt.scam.open.ask-proof")]);

  it("is not offered without the bank card or letter, and selecting it is rejected", () => {
    const state = atKnowsDetails([]);
    expect(state.conversation?.nodeId).toBe("scam.knows-details");
    expect(optionIds(state)).not.toContain("opt.scam.knows.challenge");
    const result = chapterReducer(state, option("opt.scam.knows.challenge"));
    expect(result).toEqual({ state, accepted: false, reason: "Option not available." });
  });

  it("is offered with the bank card", () => {
    const state = atKnowsDetails([{ type: "INTERACT_OBJECT", objectId: "obj.wallet" }]);
    expect(optionIds(state)).toContain("opt.scam.knows.challenge");
  });

  it("is offered with the bank letter, and selecting it challenges the caller", () => {
    const state = atKnowsDetails([{ type: "INTERACT_OBJECT", objectId: "obj.mailbox" }]);
    const challenged = play(state, [option("opt.scam.knows.challenge")]);
    expect(challenged.flags.number_challenged).toBe(true);
    expect(challenged.conversation?.nodeId).toBe("scam.challenged");
    expect(challenged.conversation?.history.at(-1)).toEqual({
      nodeId: "scam.knows-details",
      optionId: "opt.scam.knows.challenge",
    });
    expect(challenged.pressure).toBe(1);
    expect(challenged.events.at(-1)?.derived.debriefTags).toEqual(["challenged-number"]);
  });
});

describe("one-time-code delivery (Requirements 10.3, 10.4)", () => {
  it("delivers the code message when the caller reaches the code request", () => {
    const before = play(started(), [RING, { type: "ANSWER_CALL" }]);
    expect(before.phone.messages).toEqual(["msg.sms-alert"]);
    const state = play(before, [option("opt.scam.open.yes-what")]);
    expect(state.conversation?.nodeId).toBe("scam.code-request");
    expect(state.flags.otp_sent).toBe(true);
    expect(state.phone.messages).toEqual(["msg.sms-alert", "msg.otp-sms"]);
    expect(state.phone.unread).toContain("msg.otp-sms");
    expect(chapterReducer(state, { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" }).accepted).toBe(true);
  });

  it("does not deliver the message twice when the callback reaches its code request", () => {
    const afterCall = play(started(), [
      RING,
      { type: "ANSWER_CALL" },
      option("opt.scam.open.yes-what"),
      option("opt.scam.code.hang-up"),
      { type: "RING_CALL", callId: "call.callback", reason: "callback" },
      { type: "ANSWER_CALL" },
    ]);
    expect(optionIds(afterCall)).toEqual(["opt.callback.open.read-code", "opt.callback.open.hang-up"]);
    expect(afterCall.phone.messages).toEqual(["msg.sms-alert", "msg.otp-sms"]);
  });

  it("sets code_shared when the player reads the code", () => {
    const state = play(started(), [
      RING,
      { type: "ANSWER_CALL" },
      option("opt.scam.open.yes-what"),
      option("opt.scam.code.read-code"),
    ]);
    expect(state.flags.code_shared).toBe(true);
    expect(state.conversation?.nodeId).toBe("scam.move-money");
    expect(state.events.at(-1)?.derived.debriefTags).toEqual(["shared-code"]);
  });
});

describe("pressure (Requirement 10.6)", () => {
  it("adds 1 per pressure node and stops at 3", () => {
    let state = play(started(), [RING, { type: "ANSWER_CALL" }]);
    expect(state.pressure).toBe(0);
    const steps: Array<[string, string, number]> = [
      ["opt.scam.open.yes-what", "scam.code-request", 1],
      ["opt.scam.code.why-code", "scam.deflect", 2],
      ["opt.scam.deflect.read-code", "scam.move-money", 3],
      ["opt.scam.move.stop", "scam.guilt", 3],
    ];
    for (const [optionId, nodeId, pressure] of steps) {
      state = play(state, [option(optionId)]);
      expect(state.conversation?.nodeId).toBe(nodeId);
      expect(state.pressure).toBe(pressure);
    }
  });

  it("caps addPressure effects at MAX_PRESSURE", () => {
    expect(MAX_PRESSURE).toBe(3);
    const state = applyEffect(started(), { kind: "addPressure", amount: 10 }, CHAPTER_1_SCENARIO);
    expect(state.pressure).toBe(3);
    expect(applyEffect(state, { kind: "addPressure" }, CHAPTER_1_SCENARIO)).toBe(state);
  });
});

describe("options and selection (Requirements 9.3, 9.5, 9.6, 9.7)", () => {
  it("returns option text from the graph's approved lines", () => {
    const state = play(started(), [RING, { type: "ANSWER_CALL" }]);
    const lines = CHAPTER_1_SCENARIO.dialogues["dlg.scam-call"].lines;
    for (const view of availableOptions(state, CHAPTER_1_SCENARIO)) {
      expect(view.fallback).toBe(false);
      expect(view.text).toBe(lines[view.lineId]);
    }
  });

  it("returns no options when there is no conversation", () => {
    expect(availableOptions(started(), CHAPTER_1_SCENARIO)).toEqual([]);
    expect(selectOption(started(), "opt.scam.open.verify", CHAPTER_1_SCENARIO)).toEqual({
      ok: false,
      reason: OPTION_NOT_AVAILABLE,
    });
  });

  it("applies option effects in authored order and records the decision", () => {
    const state = play(started(), [
      RING,
      { type: "ANSWER_CALL" },
      option("opt.scam.open.yes-what"),
      option("opt.scam.code.read-code"),
      option("opt.scam.move.move-money"),
    ]);
    expect(state.flags.money_moved).toBe(true);
    expect(state.decision).toBe("follow-request");
    expect(state.conversation).toBeNull();
    expect(state.conversationHistory[0].endNodeId).toBe("scam.end.money-moved");
  });

  it("startConversation does nothing while another conversation runs", () => {
    const talking = play(started(), [TALK_TO_SAM]);
    expect(startConversation(talking, "dlg.scam-call", CHAPTER_1_SCENARIO)).toBe(talking);
  });
});

describe("fallback option (Requirement 9.4)", () => {
  /** Scenario clone where no authored option at Sam's greeting is available. */
  function scenarioWithBlockedGreeting(): ScenarioDefinition {
    const s = JSON.parse(JSON.stringify(CHAPTER_1_SCENARIO)) as ScenarioDefinition;
    for (const opt of s.dialogues["dlg.shopkeeper"].nodes["sam.before.greet"].options) {
      opt.conditions = [{ kind: "flag", flag: "money_moved" }];
    }
    return s;
  }

  it("is the only option when no authored option is available", () => {
    const scenario = scenarioWithBlockedGreeting();
    const state = play(createInitialState(scenario), [{ type: "START_CHAPTER" }, TALK_TO_SAM], scenario);
    expect(availableOptions(state, scenario)).toEqual([
      { id: FALLBACK_OPTION_ID, lineId: "__fallback.end", text: FALLBACK_OPTION_TEXT, fallback: true },
    ]);
    expect(FALLBACK_OPTION_TEXT).toBe("End the conversation");
    expect(chapterReducer(state, option("opt.sam.greet.bye"), scenario).reason).toBe("Option not available.");
  });

  it("ends the conversation when selected", () => {
    const scenario = scenarioWithBlockedGreeting();
    const state = play(
      createInitialState(scenario),
      [{ type: "START_CHAPTER" }, TALK_TO_SAM, option(FALLBACK_OPTION_ID)],
      scenario,
    );
    expect(state.conversation).toBeNull();
    expect(state.conversationHistory).toEqual([
      {
        graphId: "dlg.shopkeeper",
        history: [{ nodeId: "sam.before.greet", optionId: FALLBACK_OPTION_ID }],
        endNodeId: null,
      },
    ]);
  });

  it("is not available when an authored option is available", () => {
    const state = play(started(), [TALK_TO_SAM]);
    expect(optionIds(state)).not.toContain(FALLBACK_OPTION_ID);
    expect(chapterReducer(state, option(FALLBACK_OPTION_ID)).reason).toBe("Option not available.");
  });
});

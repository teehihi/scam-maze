// Chapter 1 "The Urgent Call": the scammer's callback (`dlg.callback`, call `call.callback`).
// Rings at most once, after the first call ends with no decision (the ring rule lives in the core).
// Nodes with `pressure: true` add 1 pressure when entered (capped at 3 by the dialogue engine).
// Pure TypeScript data. See design.md, "Dialogue graphs", and Requirements 9.1, 9.10, 10.3-10.6, 10.9.
//
// Paths from `callback.open` to an end node:
// - code not sent yet:  open → code-request → read code → move-money → end.money-moved / end.hung-up
// - code sent, unread:  open → read code → move-money → end.money-moved / end.hung-up
// - code already read:  open → move-money → end.money-moved / end.hung-up
// - refuse:             open (or any later node) → end.hung-up
//
// Debrief tags used here: shared-code, moved-money, hung-up-on-callback.
//
// No real codes, account details or payment steps appear in this file (Requirement 10.9).

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Caller lines
  "line.callback.open":
    "Why did you hang up? This is Alex from Northgate Bank security again. The transfer completes in two minutes.",
  "line.callback.code-request":
    "I am sending you a one-time code now. Read it to me and I can still stop the transfer.",
  "line.callback.move-money":
    "Your account is still at risk. Move your savings to the protected holding account now, before it is too late. I will wait.",
  // Player option lines
  "line.callback.opt.read-code": "Read the code to the caller.",
  "line.callback.opt.what-need": "What do you need from me?",
  "line.callback.opt.what-now": "What do I need to do now?",
  "line.callback.opt.move-money": "Move the money as instructed.",
  "line.callback.opt.hang-up": "I am hanging up.",
  // End lines
  "line.callback.end.hung-up": "You end the call.",
  "line.callback.end.money-moved":
    "You do what the caller asks. The caller thanks you and ends the call.",
};

const nodes: Record<string, DialogueNode> = {
  "callback.open": {
    id: "callback.open",
    speaker: "caller",
    lineId: "line.callback.open",
    pressure: true,
    options: [
      {
        id: "opt.callback.open.read-code",
        lineId: "line.callback.opt.read-code",
        conditions: [
          { kind: "flag", flag: "otp_sent" },
          { kind: "notFlag", flag: "code_shared" },
        ],
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "callback.move-money",
        debriefTag: "shared-code",
      },
      {
        id: "opt.callback.open.what-need",
        lineId: "line.callback.opt.what-need",
        conditions: [{ kind: "notFlag", flag: "otp_sent" }],
        next: "callback.code-request",
      },
      {
        id: "opt.callback.open.what-now",
        lineId: "line.callback.opt.what-now",
        conditions: [{ kind: "flag", flag: "code_shared" }],
        next: "callback.move-money",
      },
      {
        id: "opt.callback.open.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
    ],
  },
  "callback.code-request": {
    id: "callback.code-request",
    speaker: "caller",
    lineId: "line.callback.code-request",
    pressure: true,
    onEnter: [
      { kind: "setFlag", flag: "otp_sent" },
      { kind: "deliverMessage", messageId: "msg.otp-sms" },
    ],
    options: [
      {
        id: "opt.callback.code.read-code",
        lineId: "line.callback.opt.read-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "callback.move-money",
        debriefTag: "shared-code",
      },
      {
        id: "opt.callback.code.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
    ],
  },
  "callback.move-money": {
    id: "callback.move-money",
    speaker: "caller",
    lineId: "line.callback.move-money",
    pressure: true,
    options: [
      {
        id: "opt.callback.move.move-money",
        lineId: "line.callback.opt.move-money",
        effects: [
          { kind: "setFlag", flag: "money_moved" },
          { kind: "recordDecision", decision: "follow-request" },
        ],
        next: "callback.end.money-moved",
      },
      {
        id: "opt.callback.move.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
    ],
  },
  // End nodes
  "callback.end.hung-up": {
    id: "callback.end.hung-up",
    speaker: "system",
    lineId: "line.callback.end.hung-up",
    options: [],
    end: { kind: "hung-up", debriefTag: "hung-up-on-callback" },
  },
  "callback.end.money-moved": {
    id: "callback.end.money-moved",
    speaker: "system",
    lineId: "line.callback.end.money-moved",
    options: [],
    end: { kind: "completed", debriefTag: "moved-money" },
  },
};

export const CALLBACK_DIALOGUE: DialogueGraph = {
  id: "dlg.callback",
  persona: {
    name: "Alex",
    role: "Says he is from Northgate Bank security",
    honesty: "scammer",
  },
  channel: "phone",
  independentChannel: false,
  startNodeId: "callback.open",
  lines,
  nodes,
};

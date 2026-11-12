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
  // New caller lines
  "line.callback.time-up":
    "You asked for time, and time is running out. I need an answer now, or the transfer completes.",
  "line.callback.exposed":
    "You called the bank? Then you have made a mistake. The bank is part of this review. Do not talk to them again, and do not tell anyone.",
  "line.callback.story-slip":
    "I said a few minutes, and I said two minutes. It is the same thing. Our system updates the timer all the time.",
  "line.callback.number-again":
    "Numbers get changed by our system. The number on your card is the old one. Mine is the live one.",
  "line.callback.threat":
    "If you keep stalling, your account will be closed for good. You will lose access to everything in it.",
  "line.callback.sms-case":
    "I am sending you a case message now. It has the reference and the review page. Look at it, then we can finish.",
  "line.callback.final-call":
    "This is the last call. After this, the account is closed. Give me the code now.",
  // New player option lines
  "line.callback.opt.i-called-bank":
    "I called Northgate on the number on my card. They did not mention this call.",
  "line.callback.opt.story-changed":
    "Before, you said a few minutes. Now you say two minutes. Why did it change?",
  "line.callback.opt.prove-it": "Then prove who you are.",
  "line.callback.opt.why-changing": "Why does your story keep changing?",
  "line.callback.opt.go-on": "Go on. What do you need?",
  "line.callback.opt.send-proof": "Send me proof in writing.",
  "line.callback.opt.okay": "Okay. I will look at it.",
  // End lines
  "line.callback.end.hung-up": "You end the call.",
  "line.callback.end.money-moved":
    "You do what the caller asks. The caller thanks you and ends the call.",
};

const nodes: Record<string, DialogueNode> = {
  "callback.open": {
    id: "callback.open",
    speaker: "caller",
    tone: "impatient",
    waitForVoice: true,
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
      {
        id: "opt.callback.open.i-called-bank",
        lineId: "line.callback.opt.i-called-bank",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.official-confirmation" }],
        next: "callback.exposed",
        debriefTag: "told-caller-bank-said-no",
      },
      {
        id: "opt.callback.open.story-changed",
        lineId: "line.callback.opt.story-changed",
        conditions: [{ kind: "flag", flag: "heard_deadline" }],
        next: "callback.story-slip",
        debriefTag: "challenged-story",
      },
    ],
  },
  "callback.code-request": {
    id: "callback.code-request",
    speaker: "caller",
    tone: "pressuring",
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
    tone: "pressuring",
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
  "callback.time-up": {
    id: "callback.time-up",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "impatient",
    lineId: "line.callback.time-up",
    pressure: true,
    options: [
      {
        id: "opt.callback.time-up.what-need",
        lineId: "line.callback.opt.what-need",
        conditions: [{ kind: "notFlag", flag: "code_shared" }],
        next: "callback.code-request",
      },
      {
        id: "opt.callback.time-up.what-now",
        lineId: "line.callback.opt.what-now",
        conditions: [{ kind: "flag", flag: "code_shared" }],
        next: "callback.move-money",
      },
      {
        id: "opt.callback.time-up.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
    ],
  },
  "callback.exposed": {
    id: "callback.exposed",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.callback.exposed",
    pressure: true,
    onEnter: [{ kind: "setFlag", flag: "secrecy_heard" }],
    options: [
      {
        id: "opt.callback.exposed.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
      {
        id: "opt.callback.exposed.prove-it",
        lineId: "line.callback.opt.prove-it",
        next: "callback.number-again",
      },
      {
        id: "opt.callback.exposed.what-need",
        lineId: "line.callback.opt.what-need",
        next: "callback.code-request",
      },
    ],
  },
  "callback.story-slip": {
    id: "callback.story-slip",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.callback.story-slip",
    pressure: true,
    onEnter: [{ kind: "discoverEvidence", evidenceId: "ev.shifting-story" }],
    options: [
      {
        id: "opt.callback.slip.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
      {
        id: "opt.callback.slip.why-changing",
        lineId: "line.callback.opt.why-changing",
        next: "callback.threat",
      },
      {
        id: "opt.callback.slip.go-on",
        lineId: "line.callback.opt.go-on",
        next: "callback.code-request",
      },
    ],
  },
  "callback.number-again": {
    id: "callback.number-again",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "defensive",
    lineId: "line.callback.number-again",
    options: [
      {
        id: "opt.callback.number.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
      {
        id: "opt.callback.number.go-on",
        lineId: "line.callback.opt.go-on",
        next: "callback.code-request",
      },
    ],
  },
  "callback.threat": {
    id: "callback.threat",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.callback.threat",
    pressure: true,
    options: [
      {
        id: "opt.callback.threat.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
      {
        id: "opt.callback.threat.send-proof",
        lineId: "line.callback.opt.send-proof",
        next: "callback.sms-case",
      },
      {
        id: "opt.callback.threat.go-on",
        lineId: "line.callback.opt.go-on",
        next: "callback.code-request",
      },
    ],
  },
  "callback.sms-case": {
    id: "callback.sms-case",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "reassuring",
    lineId: "line.callback.sms-case",
    onEnter: [
      { kind: "deliverMessage", messageId: "msg.case-sms" },
      { kind: "setFlag", flag: "case_sms_sent" },
    ],
    options: [
      {
        id: "opt.callback.sms-case.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
      {
        id: "opt.callback.sms-case.okay",
        lineId: "line.callback.opt.okay",
        next: "callback.final-call",
      },
    ],
  },
  "callback.final-call": {
    id: "callback.final-call",
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "pressuring",
    lineId: "line.callback.final-call",
    pressure: true,
    options: [
      {
        id: "opt.callback.final.hang-up",
        lineId: "line.callback.opt.hang-up",
        next: "callback.end.hung-up",
      },
      {
        id: "opt.callback.final.read-code",
        lineId: "line.callback.opt.read-code",
        conditions: [
          { kind: "flag", flag: "otp_sent" },
          { kind: "notFlag", flag: "code_shared" },
        ],
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "callback.move-money",
        debriefTag: "shared-code",
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
    speakerId: "spk.alex",
    name: "Alex",
    role: "Says he is from Northgate Bank security",
    honesty: "scammer",
  },
  channel: "phone",
  independentChannel: false,
  startNodeId: "callback.open",
  startNodeWhen: [{ when: [{ kind: "flag", flag: "asked_time" }], nodeId: "callback.time-up" }],
  lines,
  nodes,
};

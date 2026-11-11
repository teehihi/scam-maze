// Chapter 1 "The Urgent Call": the first scam call (`dlg.scam-call`, call `call.scam-1`).
// The caller pretends to be Northgate Bank security. Nodes with `pressure: true` add 1 pressure
// when entered (capped at 3 by the dialogue engine).
// Pure TypeScript data. See design.md, "Dialogue graphs", and Requirements 9.1, 9.10, 10.1-10.6, 10.9.
//
// Paths from `scam.open` to an end node (Requirement 10.1):
// - share the code and move money:  open → code-request → move-money → end.money-moved
// - ask for proof, then challenge:  open → knows-details → challenged → end.hung-up / end.verify
// - verify independently:           open → end.verify (or via knows-details, deflect, challenged)
// - refuse:                         knows-details / code-request / guilt → end.hung-up
//
// Debrief tags used here: asked-for-proof, challenged-number, asked-why-code, shared-code,
// said-stop, moved-money, hung-up, hung-up-to-verify.
//
// No real codes, account details or payment steps appear in this file (Requirement 10.9).

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Caller lines
  "line.scam.open":
    "Hello, this is Alex from Northgate Bank security. We just detected a large transfer leaving your account. Are you the account holder?",
  "line.scam.knows-details":
    "I understand you want to be careful. I can see your full name and the last four digits of your card on my screen. Would a stranger know that?",
  "line.scam.challenged":
    "That number is for general questions. I am calling from the security team's direct line. If you hang up now, I cannot stop the transfer.",
  "line.scam.code-request":
    "To stop the transfer, I am sending a one-time code to your phone right now. Please read it to me so I can cancel the payment.",
  "line.scam.deflect":
    "It is a normal security check. The code proves you are the real account holder. Please hurry, the transfer completes in a few minutes.",
  "line.scam.move-money":
    "Thank you. Your account is still at risk. To protect your savings, you need to move them to a protected holding account today. I will stay on the line with you.",
  "line.scam.guilt":
    "If you stop now and the transfer goes through, I cannot help you. I am only trying to protect your money. Please trust me.",
  // Player option lines
  "line.scam.opt.yes-what": "Yes, that is me. What is happening?",
  "line.scam.opt.ask-proof": "How do I know you are from the bank?",
  "line.scam.opt.verify": "I will call the bank on the official number.",
  "line.scam.opt.okay-what": "Okay, what do you need?",
  "line.scam.opt.challenge": "Your number is not the one on my card.",
  "line.scam.opt.hang-up": "I am hanging up.",
  "line.scam.opt.read-code": "Read the code to the caller.",
  "line.scam.opt.why-code": "Why do you need my code?",
  "line.scam.opt.call-myself": "I will call the bank myself.",
  "line.scam.opt.call-card": "I will call the number on my card.",
  "line.scam.opt.fine-what": "Fine, what do you need?",
  "line.scam.opt.move-money": "Move the money as instructed.",
  "line.scam.opt.stop": "Stop. This does not feel right.",
  // End lines
  "line.scam.end.hung-up": "You end the call.",
  "line.scam.end.verify": "You end the call so you can check with Northgate yourself.",
  "line.scam.end.money-moved": "You do what the caller asks. The caller thanks you and ends the call.",
};

const nodes: Record<string, DialogueNode> = {
  "scam.open": {
    id: "scam.open",
    speaker: "caller",
    lineId: "line.scam.open",
    options: [
      { id: "opt.scam.open.yes-what", lineId: "line.scam.opt.yes-what", next: "scam.code-request" },
      {
        id: "opt.scam.open.ask-proof",
        lineId: "line.scam.opt.ask-proof",
        next: "scam.knows-details",
        debriefTag: "asked-for-proof",
      },
      {
        id: "opt.scam.open.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
    ],
  },
  "scam.knows-details": {
    id: "scam.knows-details",
    speaker: "caller",
    lineId: "line.scam.knows-details",
    onEnter: [{ kind: "discoverEvidence", evidenceId: "ev.partial-info" }],
    options: [
      {
        id: "opt.scam.knows.okay-what",
        lineId: "line.scam.opt.okay-what",
        next: "scam.code-request",
      },
      {
        id: "opt.scam.knows.challenge",
        lineId: "line.scam.opt.challenge",
        conditions: [{ kind: "hasAnyEvidence", evidenceIds: ["ev.bank-card", "ev.bank-letter"] }],
        effects: [{ kind: "setFlag", flag: "number_challenged" }],
        next: "scam.challenged",
        debriefTag: "challenged-number",
      },
      {
        id: "opt.scam.knows.verify",
        lineId: "line.scam.opt.verify",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      { id: "opt.scam.knows.hang-up", lineId: "line.scam.opt.hang-up", next: "scam.end.hung-up" },
    ],
  },
  "scam.challenged": {
    id: "scam.challenged",
    speaker: "caller",
    lineId: "line.scam.challenged",
    pressure: true,
    options: [
      {
        id: "opt.scam.challenged.call-card",
        lineId: "line.scam.opt.call-card",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
      {
        id: "opt.scam.challenged.hang-up",
        lineId: "line.scam.opt.hang-up",
        next: "scam.end.hung-up",
      },
      {
        id: "opt.scam.challenged.fine-what",
        lineId: "line.scam.opt.fine-what",
        next: "scam.code-request",
      },
    ],
  },
  "scam.code-request": {
    id: "scam.code-request",
    speaker: "caller",
    lineId: "line.scam.code-request",
    pressure: true,
    onEnter: [
      { kind: "setFlag", flag: "otp_sent" },
      { kind: "deliverMessage", messageId: "msg.otp-sms" },
    ],
    options: [
      {
        id: "opt.scam.code.read-code",
        lineId: "line.scam.opt.read-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "scam.move-money",
        debriefTag: "shared-code",
      },
      {
        id: "opt.scam.code.why-code",
        lineId: "line.scam.opt.why-code",
        next: "scam.deflect",
        debriefTag: "asked-why-code",
      },
      { id: "opt.scam.code.hang-up", lineId: "line.scam.opt.hang-up", next: "scam.end.hung-up" },
    ],
  },
  "scam.deflect": {
    id: "scam.deflect",
    speaker: "caller",
    lineId: "line.scam.deflect",
    pressure: true,
    options: [
      {
        id: "opt.scam.deflect.read-code",
        lineId: "line.scam.opt.read-code",
        effects: [{ kind: "setFlag", flag: "code_shared" }],
        next: "scam.move-money",
        debriefTag: "shared-code",
      },
      {
        id: "opt.scam.deflect.call-myself",
        lineId: "line.scam.opt.call-myself",
        effects: [{ kind: "setFlag", flag: "scam1_hung_up_to_verify" }],
        next: "scam.end.verify",
      },
    ],
  },
  "scam.move-money": {
    id: "scam.move-money",
    speaker: "caller",
    lineId: "line.scam.move-money",
    pressure: true,
    options: [
      {
        id: "opt.scam.move.move-money",
        lineId: "line.scam.opt.move-money",
        effects: [
          { kind: "setFlag", flag: "money_moved" },
          { kind: "recordDecision", decision: "follow-request" },
        ],
        next: "scam.end.money-moved",
      },
      {
        id: "opt.scam.move.stop",
        lineId: "line.scam.opt.stop",
        next: "scam.guilt",
        debriefTag: "said-stop",
      },
    ],
  },
  "scam.guilt": {
    id: "scam.guilt",
    speaker: "caller",
    lineId: "line.scam.guilt",
    pressure: true,
    options: [
      {
        id: "opt.scam.guilt.move-money",
        lineId: "line.scam.opt.move-money",
        effects: [
          { kind: "setFlag", flag: "money_moved" },
          { kind: "recordDecision", decision: "follow-request" },
        ],
        next: "scam.end.money-moved",
      },
      { id: "opt.scam.guilt.hang-up", lineId: "line.scam.opt.hang-up", next: "scam.end.hung-up" },
    ],
  },
  // End nodes
  "scam.end.hung-up": {
    id: "scam.end.hung-up",
    speaker: "system",
    lineId: "line.scam.end.hung-up",
    options: [],
    end: { kind: "hung-up", debriefTag: "hung-up" },
  },
  "scam.end.verify": {
    id: "scam.end.verify",
    speaker: "system",
    lineId: "line.scam.end.verify",
    options: [],
    end: { kind: "hung-up", debriefTag: "hung-up-to-verify" },
  },
  "scam.end.money-moved": {
    id: "scam.end.money-moved",
    speaker: "system",
    lineId: "line.scam.end.money-moved",
    options: [],
    end: { kind: "completed", debriefTag: "moved-money" },
  },
};

export const SCAM_CALL_DIALOGUE: DialogueGraph = {
  id: "dlg.scam-call",
  persona: {
    name: "Alex",
    role: "Says he is from Northgate Bank security",
    honesty: "scammer",
  },
  channel: "phone",
  independentChannel: false,
  startNodeId: "scam.open",
  lines,
  nodes,
};

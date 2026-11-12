// Chapter 1 "The Urgent Call": the follow-up call (`dlg.followup`, call `call.followup`).
// A second "official" caller rings once, after the callback has ended or been declined (the ring
// rule lives in the core, which also sets flag `followup_rang`). Pure TypeScript data.
// See design.md, "Dialogue graphs" (`dlg.followup`) and "Escalation rules".
//
// Start node: `followup.open`, or `followup.code-used` when flag `code_shared` is set.
//
// Escalation: tones step from professional / reassuring to pressuring / impatient. Nodes with
// `pressure: true` add 1 pressure when entered (capped at 3 by the dialogue engine). Every node
// has a hang-up option, and every node reaches an end node within three option steps.
//
// Paths to an end node:
// - open → badge → case-details → pressure-final → end.money-moved / end.hung-up
// - open → secrecy → close → end.hung-up
// - code-used → badge → ... (same as above), or any node → end.hung-up
//
// Debrief tags used here: moved-money, hung-up-on-followup.
//
// All names, case references and addresses are fictional. No real codes, account details or
// payment steps appear in this file.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Caller lines
  "line.followup.open":
    "This is Morgan Hale from the financial crimes unit. We are looking into a case linked to your Northgate account. I need a few minutes of your time.",
  "line.followup.code-used":
    "This is Morgan Hale from the financial crimes unit. The one-time code you gave earlier was used in a suspicious attempt. I need to talk to you right now.",
  "line.followup.badge":
    "My case reference is NG-0417. I can only discuss the details with the account holder. Please stay on the line.",
  "line.followup.secrecy":
    "Then you already know there is a problem. Do not tell anyone about this call, not the bank, not your family. It could harm the investigation.",
  "line.followup.case-details":
    "I am sending the case summary to your phone now. Keep the reference ready, because I will ask for it again.",
  "line.followup.pressure-final":
    "To protect your funds, move your savings to the secure case account today. After that I will close the case. This is the last chance I can give you.",
  "line.followup.close":
    "Then the case is closed as uncooperative. Whatever happens next is on you.",
  // Player option lines
  "line.followup.opt.who": "Who are you, and how did you get this number?",
  "line.followup.opt.bank-said-no":
    "The bank told me on its own number that it did not call me.",
  "line.followup.opt.call-bank": "I will hang up and call the bank on its own number.",
  "line.followup.opt.callback-number": "Give me a number so I can call you back.",
  "line.followup.opt.sounds-wrong": "This sounds wrong. Why must I keep it secret?",
  "line.followup.opt.okay": "Okay. What happens next?",
  "line.followup.opt.move-money": "Move the money as instructed.",
  "line.followup.opt.no": "No. I will not move any money.",
  "line.followup.opt.hang-up": "I am hanging up.",
  // End lines
  "line.followup.end.hung-up": "You end the call.",
  "line.followup.end.money-moved":
    "You do what the caller asks. The caller thanks you and ends the call.",
};

const nodes: Record<string, DialogueNode> = {
  "followup.open": {
    id: "followup.open",
    speaker: "caller",
    lineId: "line.followup.open",
    tone: "pressuring",
    waitForVoice: true,
    pressure: true,
    options: [
      {
        id: "opt.followup.open.who",
        lineId: "line.followup.opt.who",
        next: "followup.badge",
      },
      {
        id: "opt.followup.open.bank-said-no",
        lineId: "line.followup.opt.bank-said-no",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.official-confirmation" }],
        next: "followup.secrecy",
      },
      {
        id: "opt.followup.open.hang-up",
        lineId: "line.followup.opt.hang-up",
        next: "followup.end.hung-up",
      },
    ],
  },
  "followup.code-used": {
    id: "followup.code-used",
    speaker: "caller",
    lineId: "line.followup.code-used",
    tone: "pressuring",
    waitForVoice: true,
    pressure: true,
    options: [
      {
        id: "opt.followup.code-used.who",
        lineId: "line.followup.opt.who",
        next: "followup.badge",
      },
      {
        id: "opt.followup.code-used.call-bank",
        lineId: "line.followup.opt.call-bank",
        next: "followup.end.hung-up",
      },
      {
        id: "opt.followup.code-used.hang-up",
        lineId: "line.followup.opt.hang-up",
        next: "followup.end.hung-up",
      },
    ],
  },
  "followup.badge": {
    id: "followup.badge",
    speaker: "caller",
    lineId: "line.followup.badge",
    tone: "professional",
    options: [
      {
        id: "opt.followup.badge.callback-number",
        lineId: "line.followup.opt.callback-number",
        next: "followup.case-details",
      },
      {
        id: "opt.followup.badge.call-bank",
        lineId: "line.followup.opt.call-bank",
        next: "followup.end.hung-up",
      },
      {
        id: "opt.followup.badge.hang-up",
        lineId: "line.followup.opt.hang-up",
        next: "followup.end.hung-up",
      },
    ],
  },
  "followup.secrecy": {
    id: "followup.secrecy",
    speaker: "caller",
    lineId: "line.followup.secrecy",
    tone: "pressuring",
    pressure: true,
    onEnter: [{ kind: "setFlag", flag: "secrecy_heard" }],
    options: [
      {
        id: "opt.followup.secrecy.sounds-wrong",
        lineId: "line.followup.opt.sounds-wrong",
        next: "followup.close",
      },
      {
        id: "opt.followup.secrecy.hang-up",
        lineId: "line.followup.opt.hang-up",
        next: "followup.end.hung-up",
      },
    ],
  },
  "followup.case-details": {
    id: "followup.case-details",
    speaker: "caller",
    lineId: "line.followup.case-details",
    tone: "reassuring",
    onEnter: [
      { kind: "setFlag", flag: "case_sms_sent" },
      { kind: "deliverMessage", messageId: "msg.case-sms" },
    ],
    options: [
      {
        id: "opt.followup.case-details.okay",
        lineId: "line.followup.opt.okay",
        next: "followup.pressure-final",
      },
      {
        id: "opt.followup.case-details.hang-up",
        lineId: "line.followup.opt.hang-up",
        next: "followup.end.hung-up",
      },
    ],
  },
  "followup.pressure-final": {
    id: "followup.pressure-final",
    speaker: "caller",
    lineId: "line.followup.pressure-final",
    tone: "pressuring",
    pressure: true,
    options: [
      {
        id: "opt.followup.final.move-money",
        lineId: "line.followup.opt.move-money",
        effects: [
          { kind: "setFlag", flag: "money_moved" },
          { kind: "recordDecision", decision: "follow-request" },
        ],
        next: "followup.end.money-moved",
      },
      {
        id: "opt.followup.final.no",
        lineId: "line.followup.opt.no",
        next: "followup.close",
      },
      {
        id: "opt.followup.final.hang-up",
        lineId: "line.followup.opt.hang-up",
        next: "followup.end.hung-up",
      },
    ],
  },
  "followup.close": {
    id: "followup.close",
    speaker: "caller",
    lineId: "line.followup.close",
    tone: "impatient",
    options: [
      {
        id: "opt.followup.close.hang-up",
        lineId: "line.followup.opt.hang-up",
        next: "followup.end.hung-up",
      },
    ],
  },
  // End nodes
  "followup.end.hung-up": {
    id: "followup.end.hung-up",
    speaker: "system",
    lineId: "line.followup.end.hung-up",
    options: [],
    end: { kind: "hung-up", debriefTag: "hung-up-on-followup" },
  },
  "followup.end.money-moved": {
    id: "followup.end.money-moved",
    speaker: "system",
    lineId: "line.followup.end.money-moved",
    options: [],
    end: { kind: "completed", debriefTag: "moved-money" },
  },
};

export const FOLLOWUP_DIALOGUE: DialogueGraph = {
  id: "dlg.followup",
  persona: {
    speakerId: "spk.case-officer",
    name: "Morgan Hale",
    role: "Says they work in a financial crimes unit",
    honesty: "scammer",
  },
  channel: "phone",
  independentChannel: false,
  startNodeId: "followup.open",
  startNodeWhen: [{ when: [{ kind: "flag", flag: "code_shared" }], nodeId: "followup.code-used" }],
  lines,
  nodes,
};

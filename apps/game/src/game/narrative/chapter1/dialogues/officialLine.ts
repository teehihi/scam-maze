// Chapter 1 "The Urgent Call": the official Northgate Bank line (`dlg.official-line`,
// call `call.official`), reached when the player calls the number on the card or the letter.
// This is the only independent channel (`independentChannel: true`), so it is the only graph
// allowed to set claim statuses (Requirement 12.4, 12.6).
// Pure TypeScript data. See design.md, "Dialogue graphs", and Requirements 9.1, 9.10, 12.4.
//
// Paths:
// - code not shared: greeting → agent → confirm → end
// - code shared:     greeting → agent → confirm → locked (sets `account_locked`) → end
//
// Debrief tags used here: reported-to-bank, told-bank-about-code, blocked-number.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Support lines
  "line.official.greeting":
    "Thank you for calling Northgate Bank customer support. Please hold while we connect you to an agent.",
  "line.official.agent": "Hello, this is Northgate customer support. How can I help you today?",
  "line.official.confirm":
    "We have no record of a call to you today. Your account is active. We never ask for one-time codes or ask you to move money.",
  "line.official.locked":
    "Thank you for telling us. To protect you, we have locked your account and a new card is on its way. Nobody can sign in with that code now.",
  // Player option lines
  "line.official.opt.wait": "Wait for an agent.",
  "line.official.opt.report": "Someone called saying they were from your security team.",
  "line.official.opt.code-shared": "I read a code from a text message to the caller.",
  "line.official.opt.block": "Thank you. I will block that number.",
  // End line
  "line.official.end": "You end the call with Northgate.",
  // Hub, transfer, numbers, advice and report lines
  "line.official.hub": "Is there anything else I can check for you?",
  "line.official.transfer":
    "I checked your account. There is no pending transfer and nothing is held on it. That does not match what the caller told you.",
  "line.official.numbers":
    "We only call customers from our listed numbers. Our listed numbers are printed on your card and on your statement.",
  "line.official.numbers-match":
    "I looked at the number you read out. It is not a Northgate number. It does not match our official record.",
  "line.official.advice":
    "Never share a one-time code with anyone who calls you. If you are unsure, end the call and phone the number printed on your card.",
  "line.official.report-intro":
    "You can report the call to us. What details do you have?",
  "line.official.report-filed":
    "Thank you. We have added the number and the details to your report. Our fraud team will review it.",
  "line.official.report-basic":
    "Thank you. We have noted that someone pretended to be from Northgate. You can send us the number later if you find it.",
  // Hub, transfer, numbers, advice and report option lines
  "line.official.opt.anything-else": "I have another question.",
  "line.official.opt.transfer": "Is there a large transfer or a hold on my account?",
  "line.official.opt.numbers": "Which numbers does Northgate call from?",
  "line.official.opt.report-call": "I would like to report the call.",
  "line.official.opt.all-done": "No, that is all. Thank you.",
  "line.official.opt.advice": "What should I do if someone calls me like this again?",
  "line.official.opt.back": "I have another question.",
  "line.official.opt.read-number": "Read out the number from my call log.",
  "line.official.opt.report-number": "I can give you the caller's number.",
  "line.official.opt.report-code": "I received a code by text message.",
  "line.official.opt.report-none": "I have no other details.",
};

const nodes: Record<string, DialogueNode> = {
  "official.greeting": {
    id: "official.greeting",
    speaker: "system",
    lineId: "line.official.greeting",
    options: [{ id: "opt.official.greeting.wait", lineId: "line.official.opt.wait", next: "official.agent" }],
  },
  "official.agent": {
    id: "official.agent",
    speaker: "npc",
    tone: "professional",
    lineId: "line.official.agent",
    options: [
      {
        id: "opt.official.agent.report",
        lineId: "line.official.opt.report",
        next: "official.confirm",
        debriefTag: "reported-to-bank",
      },
    ],
  },
  "official.confirm": {
    id: "official.confirm",
    speaker: "npc",
    tone: "professional",
    lineId: "line.official.confirm",
    onEnter: [
      { kind: "discoverEvidence", evidenceId: "ev.official-confirmation" },
      { kind: "setClaimStatus", claimId: "claim.caller-identity", status: "contradicted" },
      { kind: "setClaimStatus", claimId: "claim.account-suspended", status: "contradicted" },
      { kind: "setClaimStatus", claimId: "claim.code-needed", status: "contradicted" },
    ],
    options: [
      {
        id: "opt.official.confirm.code-shared",
        lineId: "line.official.opt.code-shared",
        conditions: [{ kind: "flag", flag: "code_shared" }],
        next: "official.locked",
        debriefTag: "told-bank-about-code",
      },
      {
        id: "opt.official.confirm.block",
        lineId: "line.official.opt.block",
        conditions: [{ kind: "notFlag", flag: "code_shared" }],
        next: "official.end",
      },
      { id: "opt.official.confirm.anything-else", lineId: "line.official.opt.anything-else", next: "official.hub" },
    ],
  },
  "official.locked": {
    id: "official.locked",
    speaker: "npc",
    tone: "reassuring",
    lineId: "line.official.locked",
    onEnter: [{ kind: "setFlag", flag: "account_locked" }],
    options: [
      { id: "opt.official.locked.block", lineId: "line.official.opt.block", next: "official.end" },
      { id: "opt.official.locked.anything-else", lineId: "line.official.opt.anything-else", next: "official.hub" },
    ],
  },
  "official.hub": {
    id: "official.hub",
    speaker: "npc",
    tone: "reassuring",
    lineId: "line.official.hub",
    options: [
      { id: "opt.official.hub.transfer", lineId: "line.official.opt.transfer", next: "official.transfer" },
      { id: "opt.official.hub.numbers", lineId: "line.official.opt.numbers", next: "official.numbers" },
      { id: "opt.official.hub.report", lineId: "line.official.opt.report-call", next: "official.report-intro" },
      { id: "opt.official.hub.all-done", lineId: "line.official.opt.all-done", next: "official.end" },
    ],
  },
  "official.transfer": {
    id: "official.transfer",
    speaker: "npc",
    tone: "professional",
    lineId: "line.official.transfer",
    onEnter: [
      { kind: "discoverEvidence", evidenceId: "ev.transfer-check" },
      { kind: "setClaimStatus", claimId: "claim.protected-account", status: "contradicted" },
    ],
    options: [
      { id: "opt.official.transfer.advice", lineId: "line.official.opt.advice", next: "official.advice" },
      { id: "opt.official.transfer.back", lineId: "line.official.opt.back", next: "official.hub" },
    ],
  },
  "official.numbers": {
    id: "official.numbers",
    speaker: "npc",
    tone: "professional",
    lineId: "line.official.numbers",
    options: [
      {
        id: "opt.official.numbers.read-number",
        lineId: "line.official.opt.read-number",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.caller-number" }],
        next: "official.numbers-match",
      },
      { id: "opt.official.numbers.advice", lineId: "line.official.opt.advice", next: "official.advice" },
      { id: "opt.official.numbers.back", lineId: "line.official.opt.back", next: "official.hub" },
    ],
  },
  "official.numbers-match": {
    id: "official.numbers-match",
    speaker: "npc",
    tone: "professional",
    lineId: "line.official.numbers-match",
    options: [{ id: "opt.official.numbers-match.back", lineId: "line.official.opt.back", next: "official.hub" }],
  },
  "official.advice": {
    id: "official.advice",
    speaker: "npc",
    tone: "reassuring",
    lineId: "line.official.advice",
    options: [{ id: "opt.official.advice.back", lineId: "line.official.opt.back", next: "official.hub" }],
  },
  "official.report-intro": {
    id: "official.report-intro",
    speaker: "npc",
    tone: "professional",
    lineId: "line.official.report-intro",
    options: [
      {
        id: "opt.official.report-intro.number",
        lineId: "line.official.opt.report-number",
        conditions: [{ kind: "hasEvidence", evidenceId: "ev.caller-number" }],
        next: "official.report-filed",
        debriefTag: "reported-details",
      },
      {
        id: "opt.official.report-intro.code",
        lineId: "line.official.opt.report-code",
        conditions: [{ kind: "flag", flag: "otp_sent" }],
        next: "official.report-filed",
        debriefTag: "reported-details",
      },
      {
        id: "opt.official.report-intro.no-details",
        lineId: "line.official.opt.report-none",
        next: "official.report-basic",
      },
    ],
  },
  "official.report-filed": {
    id: "official.report-filed",
    speaker: "npc",
    tone: "reassuring",
    lineId: "line.official.report-filed",
    onEnter: [{ kind: "setFlag", flag: "report_filed" }],
    options: [{ id: "opt.official.report-filed.back", lineId: "line.official.opt.back", next: "official.hub" }],
  },
  "official.report-basic": {
    id: "official.report-basic",
    speaker: "npc",
    tone: "professional",
    lineId: "line.official.report-basic",
    onEnter: [{ kind: "setFlag", flag: "report_filed" }],
    options: [
      {
        id: "opt.official.report-basic.back",
        lineId: "line.official.opt.back",
        next: "official.hub",
        debriefTag: "reported-basic",
      },
    ],
  },
  // End node
  "official.end": {
    id: "official.end",
    speaker: "system",
    lineId: "line.official.end",
    options: [],
    end: { kind: "completed", debriefTag: "blocked-number" },
  },
};

export const OFFICIAL_LINE_DIALOGUE: DialogueGraph = {
  id: "dlg.official-line",
  persona: {
    speakerId: "spk.northgate-agent",
    name: "Northgate customer support",
    role: "Northgate Bank's official support line",
    honesty: "trusted",
  },
  channel: "phone",
  independentChannel: true,
  startNodeId: "official.greeting",
  lines,
  nodes,
};

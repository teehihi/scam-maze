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
    ],
  },
  "official.locked": {
    id: "official.locked",
    speaker: "npc",
    lineId: "line.official.locked",
    onEnter: [{ kind: "setFlag", flag: "account_locked" }],
    options: [{ id: "opt.official.locked.block", lineId: "line.official.opt.block", next: "official.end" }],
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

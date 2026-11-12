// Chapter 1 "The Urgent Call": Sam at the corner shop (`dlg.shopkeeper`, NPC `npc.sam`).
// Face to face. The start node depends on whether the first scam call has ended
// (Requirement 10.7). Every path ends with the player saying "See you later, Sam."
// Pure TypeScript data. See design.md, "Dialogue graphs", and Requirements 9.1, 9.10, 10.7.
//
// Paths:
// - before the call: before.greet → (before.notice) → end
// - after the call:  after-call.ask → after-call.story (discovers `ev.sam-testimony`)
//                    → after-call.advice → end, or after-call.ask → end
//
// Debrief tags used here: talked-to-sam.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Sam's lines
  "line.sam.before.greet": "Good morning! Quiet day on the street so far. How are you?",
  "line.sam.before.notice":
    "Yes. Northgate put a notice in my window last month. It is about people who call and pretend to be the bank. It is worth a read.",
  "line.sam.after-call.ask":
    "You look worried. Did someone just call you about your bank? Did they ask for a code?",
  "line.sam.after-call.story":
    "The same thing happened to me last month. The caller knew my name and sounded so worried for me. I almost read out my code.",
  "line.sam.after-call.advice":
    "I hung up and called the number on my card, not the one that called me. The bank told me they never called. Call the number on your card, not the one that called you.",
  // Player option lines
  "line.sam.opt.ask-notice": "Is that a Northgate notice in your window?",
  "line.sam.opt.yes-called": "Yes. They said they were from Northgate.",
  "line.sam.opt.what-did-you-do": "What did you do?",
  "line.sam.opt.bye": "See you later, Sam.",
  // End line
  "line.sam.end": "Sam waves and goes back to the counter.",
};

const nodes: Record<string, DialogueNode> = {
  "sam.before.greet": {
    id: "sam.before.greet",
    speaker: "npc",
    lineId: "line.sam.before.greet",
    options: [
      { id: "opt.sam.greet.ask-notice", lineId: "line.sam.opt.ask-notice", next: "sam.before.notice" },
      { id: "opt.sam.greet.bye", lineId: "line.sam.opt.bye", next: "sam.end" },
    ],
  },
  "sam.before.notice": {
    id: "sam.before.notice",
    speaker: "npc",
    lineId: "line.sam.before.notice",
    options: [{ id: "opt.sam.notice.bye", lineId: "line.sam.opt.bye", next: "sam.end" }],
  },
  "sam.after-call.ask": {
    id: "sam.after-call.ask",
    speaker: "npc",
    lineId: "line.sam.after-call.ask",
    options: [
      {
        id: "opt.sam.ask.yes-called",
        lineId: "line.sam.opt.yes-called",
        next: "sam.after-call.story",
      },
      { id: "opt.sam.ask.bye", lineId: "line.sam.opt.bye", next: "sam.end" },
    ],
  },
  "sam.after-call.story": {
    id: "sam.after-call.story",
    speaker: "npc",
    lineId: "line.sam.after-call.story",
    onEnter: [{ kind: "discoverEvidence", evidenceId: "ev.sam-testimony" }],
    options: [
      {
        id: "opt.sam.story.what-did-you-do",
        lineId: "line.sam.opt.what-did-you-do",
        next: "sam.after-call.advice",
      },
    ],
  },
  "sam.after-call.advice": {
    id: "sam.after-call.advice",
    speaker: "npc",
    lineId: "line.sam.after-call.advice",
    options: [{ id: "opt.sam.advice.bye", lineId: "line.sam.opt.bye", next: "sam.end" }],
  },
  // End node
  "sam.end": {
    id: "sam.end",
    speaker: "system",
    lineId: "line.sam.end",
    options: [],
    end: { kind: "completed", debriefTag: "talked-to-sam" },
  },
};

export const SHOPKEEPER_DIALOGUE: DialogueGraph = {
  id: "dlg.shopkeeper",
  persona: { name: "Sam", role: "Owner of the corner shop", honesty: "trusted" },
  channel: "face-to-face",
  independentChannel: false,
  startNodeId: "sam.before.greet",
  startNodeWhen: [
    { when: [{ kind: "callEnded", callId: "call.scam-1" }], nodeId: "sam.after-call.ask" },
  ],
  lines,
  nodes,
};

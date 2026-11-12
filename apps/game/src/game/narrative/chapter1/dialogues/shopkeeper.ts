// Chapter 1 "The Urgent Call": Sam at the corner shop (`dlg.shopkeeper`, NPC `npc.sam`).
// Face to face. The start node depends on whether the first scam call has ended
// (Requirement 10.7). Every path ends with the player saying "See you later, Sam."
// Pure TypeScript data. See design.md, "Dialogue graphs", and Requirements 9.1, 9.10, 10.7.
//
// Paths:
// - before the call: before.greet → (before.notice) → end
//                    before.greet → before.coffee → (before.phones) → end
// - after the call:  after-call.ask → after-call.story (discovers `ev.sam-testimony`)
//                    → after-call.advice → (after-call.numbers) → end, or after-call.ask → end
//
// Debrief tags used here: talked-to-sam.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Sam's lines
  "line.sam.before.greet": "Good morning! Quiet day on the street so far. How are you?",
  "line.sam.before.notice":
    "Yes. Northgate put a notice in my window last month. It is about people who call and pretend to be the bank. It is worth a read.",
  "line.sam.before.coffee":
    "Fresh coffee is on. It is a slow morning, so I can chat. Anything on your mind?",
  "line.sam.before.phones":
    "Funny you ask. A few of my customers got calls from numbers they did not know this week. It is a good habit to stop and check before you answer questions.",
  "line.sam.after-call.ask":
    "You look worried. Did someone just call you about your bank? Did they ask for a code?",
  "line.sam.after-call.story":
    "The same thing happened to me last month. The caller knew my name and sounded so worried for me. I almost read out my code.",
  "line.sam.after-call.advice":
    "I hung up and called the number on my card, not the one that called me. The bank told me they never called. Call the number on your card, not the one that called you.",
  "line.sam.after-call.numbers":
    "Good question. If a number is new to you, compare it with the one printed on your card or in your bank letter. If it does not match, it is fine to hang up. Calling the bank yourself is always allowed.",
  // Player option lines
  "line.sam.opt.ask-notice": "Is that a Northgate notice in your window?",
  "line.sam.opt.yes-called": "Yes. They said they were from Northgate.",
  "line.sam.opt.what-did-you-do": "What did you do?",
  "line.sam.opt.bye": "See you later, Sam.",
  "line.sam.opt.chat": "Do you have a minute to chat?",
  "line.sam.opt.anything-new": "Anything new on the street?",
  "line.sam.opt.other-numbers": "What about numbers I do not know?",
  // End line
  "line.sam.end": "Sam waves and goes back to the counter.",
};

const nodes: Record<string, DialogueNode> = {
  "sam.before.greet": {
    id: "sam.before.greet",
    speaker: "npc",
    speakerId: "spk.sam",
    tone: "reassuring",
    lineId: "line.sam.before.greet",
    options: [
      { id: "opt.sam.greet.ask-notice", lineId: "line.sam.opt.ask-notice", next: "sam.before.notice" },
      { id: "opt.sam.greet.bye", lineId: "line.sam.opt.bye", next: "sam.end" },
      { id: "opt.sam.greet.chat", lineId: "line.sam.opt.chat", next: "sam.before.coffee" },
    ],
  },
  "sam.before.notice": {
    id: "sam.before.notice",
    speaker: "npc",
    speakerId: "spk.sam",
    tone: "reassuring",
    lineId: "line.sam.before.notice",
    options: [{ id: "opt.sam.notice.bye", lineId: "line.sam.opt.bye", next: "sam.end" }],
  },
  "sam.before.coffee": {
    id: "sam.before.coffee",
    speaker: "npc",
    speakerId: "spk.sam",
    tone: "reassuring",
    lineId: "line.sam.before.coffee",
    options: [
      {
        id: "opt.sam.coffee.anything-new",
        lineId: "line.sam.opt.anything-new",
        next: "sam.before.phones",
      },
      { id: "opt.sam.coffee.bye", lineId: "line.sam.opt.bye", next: "sam.end" },
    ],
  },
  "sam.before.phones": {
    id: "sam.before.phones",
    speaker: "npc",
    speakerId: "spk.sam",
    tone: "reassuring",
    lineId: "line.sam.before.phones",
    options: [{ id: "opt.sam.phones.bye", lineId: "line.sam.opt.bye", next: "sam.end" }],
  },
  "sam.after-call.ask": {
    id: "sam.after-call.ask",
    speaker: "npc",
    speakerId: "spk.sam",
    tone: "reassuring",
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
    speakerId: "spk.sam",
    tone: "reassuring",
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
    speakerId: "spk.sam",
    tone: "reassuring",
    lineId: "line.sam.after-call.advice",
    options: [
      { id: "opt.sam.advice.bye", lineId: "line.sam.opt.bye", next: "sam.end" },
      {
        id: "opt.sam.advice.other-numbers",
        lineId: "line.sam.opt.other-numbers",
        next: "sam.after-call.numbers",
      },
    ],
  },
  "sam.after-call.numbers": {
    id: "sam.after-call.numbers",
    speaker: "npc",
    speakerId: "spk.sam",
    tone: "reassuring",
    lineId: "line.sam.after-call.numbers",
    options: [{ id: "opt.sam.numbers.bye", lineId: "line.sam.opt.bye", next: "sam.end" }],
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
  persona: {
    speakerId: "spk.sam",
    name: "Sam",
    role: "Owner of the corner shop",
    honesty: "trusted",
  },
  channel: "face-to-face",
  independentChannel: false,
  startNodeId: "sam.before.greet",
  startNodeWhen: [
    { when: [{ kind: "callEnded", callId: "call.scam-1" }], nodeId: "sam.after-call.ask" },
  ],
  lines,
  nodes,
};

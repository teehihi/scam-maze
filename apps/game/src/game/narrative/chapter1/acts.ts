// Chapter 1 "The Urgent Call": the six acts, as derived data.
// The current act is a pure selector (`selectCurrentAct`): the last act whose `enterWhen` holds.
// Each act's `exitWhen` equals the next act's `enterWhen`. Acts 4 and 5 can be entered in either
// order, and the player can decide before Act 4, so Act 4 may never appear.
// Each objective belongs to exactly one act.
// Pure TypeScript data: no React, Three.js, i18n or audio imports. See design.md, "Acts".

import type { ActDef } from "../types";

export const CHAPTER_1_ACTS: ActDef[] = [
  {
    id: "act.1",
    title: "An ordinary morning",
    enterWhen: [],
    exitWhen: [{ kind: "flag", flag: "scam1_rang" }],
    objectives: ["obj.look-around"],
  },
  {
    id: "act.2",
    title: "The first call",
    enterWhen: [{ kind: "flag", flag: "scam1_rang" }],
    exitWhen: [{ kind: "callEnded", callId: "call.scam-1" }],
    objectives: ["obj.answer-call"],
  },
  {
    id: "act.3",
    title: "Investigation",
    enterWhen: [{ kind: "callEnded", callId: "call.scam-1" }],
    exitWhen: [{ kind: "callRang", callId: "call.callback" }],
    objectives: ["obj.check-claims", "obj.call-bank"],
  },
  {
    id: "act.4",
    title: "Escalating pressure",
    enterWhen: [{ kind: "callRang", callId: "call.callback" }],
    exitWhen: [{ kind: "objectiveCompleted", objectiveId: "obj.call-bank" }],
    objectives: ["obj.hold-firm"],
  },
  {
    id: "act.5",
    title: "The decision",
    enterWhen: [{ kind: "objectiveCompleted", objectiveId: "obj.call-bank" }],
    exitWhen: [{ kind: "outcomeSet" }],
    objectives: ["obj.decide", "obj.file-report"],
  },
  {
    id: "act.6",
    title: "Aftermath",
    enterWhen: [{ kind: "outcomeSet" }],
    exitWhen: [],
    objectives: ["obj.review"],
  },
];

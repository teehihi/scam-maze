// Chapter 1 "The Urgent Call": objective text.
// Activation and completion predicates live in `narrative/objectives.ts` (task 3.3).
// Pure TypeScript data. See design.md, "Objective manager".

import type { Objective } from "../types";
import type { ObjectiveId } from "./ids";

export const CHAPTER_1_OBJECTIVES: Record<ObjectiveId, Objective> = {
  "obj.look-around": {
    id: "obj.look-around",
    text: "Look around your street.",
  },
  "obj.answer-call": {
    id: "obj.answer-call",
    text: "Your phone is ringing. Answer it or decline it.",
  },
  "obj.check-claims": {
    id: "obj.check-claims",
    text: "Check what the caller told you.",
  },
  "obj.decide": {
    id: "obj.decide",
    text: "Decide what to do about the caller's request.",
  },
  "obj.review": {
    id: "obj.review",
    text: "Review what happened.",
  },
};

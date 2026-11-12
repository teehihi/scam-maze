// Chapter 1 "The Urgent Call": the complete Scenario_Data.
// Pure TypeScript data. See design.md, "Scenario data".

import type { NpcDef, ScenarioDefinition } from "../types";
import { CHAPTER_1_ACTS } from "./acts";
import { CHAPTER_1_CLAIMS } from "./claims";
import { CHAPTER_1_DEBRIEF } from "./debrief";
import { CHAPTER_1_DECISIONS } from "./decisions";
import { CALLBACK_DIALOGUE } from "./dialogues/callback";
import { FOLLOWUP_DIALOGUE } from "./dialogues/followup";
import { OFFICIAL_LINE_DIALOGUE } from "./dialogues/officialLine";
import { SCAM_CALL_DIALOGUE } from "./dialogues/scamCall";
import { SHOPKEEPER_DIALOGUE } from "./dialogues/shopkeeper";
import { CHAPTER_1_ENDINGS } from "./endings";
import { CHAPTER_1_EVIDENCE, CHAPTER_1_JOURNAL_NOTES, CHAPTER_1_WARNING_SIGNS } from "./evidence";
import type { NpcId } from "./ids";
import { CHAPTER_1_INTERACTABLES } from "./interactables";
import { CHAPTER_1_OBJECTIVES } from "./objectives";
import { CHAPTER_1_CALLS, CHAPTER_1_PHONE } from "./phone";

export const CHAPTER_1_NPCS: Record<NpcId, NpcDef> = {
  "npc.sam": {
    id: "npc.sam",
    name: "Sam",
    interactableId: "obj.shopkeeper",
    graphId: "dlg.shopkeeper",
  },
};

export const CHAPTER_1_SCENARIO: ScenarioDefinition = {
  id: "chapter-1",
  title: "The Urgent Call",
  subtitle: "The notification arrives before breakfast.",
  objectives: CHAPTER_1_OBJECTIVES,
  interactables: CHAPTER_1_INTERACTABLES,
  claims: CHAPTER_1_CLAIMS,
  evidence: CHAPTER_1_EVIDENCE,
  warningSigns: CHAPTER_1_WARNING_SIGNS,
  journalNotes: CHAPTER_1_JOURNAL_NOTES,
  calls: CHAPTER_1_CALLS,
  npcs: CHAPTER_1_NPCS,
  dialogues: {
    "dlg.scam-call": SCAM_CALL_DIALOGUE,
    "dlg.callback": CALLBACK_DIALOGUE,
    "dlg.shopkeeper": SHOPKEEPER_DIALOGUE,
    "dlg.official-line": OFFICIAL_LINE_DIALOGUE,
    "dlg.followup": FOLLOWUP_DIALOGUE,
  },
  phone: CHAPTER_1_PHONE,
  decisions: CHAPTER_1_DECISIONS,
  endings: CHAPTER_1_ENDINGS,
  debrief: CHAPTER_1_DEBRIEF,
  acts: CHAPTER_1_ACTS,
};

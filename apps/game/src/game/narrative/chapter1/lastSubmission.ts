// Chapter 1 "LAST SUBMISSION: 72 GIỜ CUỐI": the Scenario_Data of the new chapter foundation.
// Pure TypeScript data.
//
// The foundation (character, 72-hour clock, resources and persistent flags, see `../resources.ts`)
// plus Mission 01 (`./mission01.ts`). Calls, dialogue, decisions and endings are still empty: the
// later missions add them. The empty records are typed with the legacy ID unions until then.
import type { NpcDef, ScenarioDefinition } from "../types";
import { CHAPTER_1_INITIAL_STATE } from "../resources";
import {
  MISSION_01_DEVICE_ITEMS,
  MISSION_01_EVENTS,
  MISSION_01_LATE_RECOVERY_EVENT,
  MISSION_01_LEDGER_LABELS,
  MISSION_01_MISSIONS,
  MISSION_01_THESIS_TASKS,
} from "./mission01";
import {
  MISSION_02_DEVICE_ITEMS,
  MISSION_02_EVENTS,
  MISSION_02_LEDGER_LABELS,
  MISSION_02_MISSIONS,
} from "./mission02";
import {
  MISSION_01_OFFERS_DEVICE_ITEMS,
  MISSION_01_OFFERS_EVENTS,
  MISSION_01_OFFERS_LEDGER_LABELS,
  MISSION_01_OFFERS_MISSIONS,
} from "./mission01Offers";
import type { NpcId } from "./ids";

/** English title and subtitle. The Vietnamese text lives in `i18n/narrative/lastSubmission.vi.ts`. */
export const LAST_SUBMISSION_TITLE = "LAST SUBMISSION: 72 GIỜ CUỐI";
export const LAST_SUBMISSION_SUBTITLE = "Submit the thesis by Friday, 17:00.";

/** The chapter without mission content: character, clock, resources and flags (and the tests' fixture base). */
export const FOUNDATION_SCENARIO: ScenarioDefinition = {
  id: "chapter-1",
  title: LAST_SUBMISSION_TITLE,
  subtitle: LAST_SUBMISSION_SUBTITLE,
  initial: CHAPTER_1_INITIAL_STATE,
  gameplay: { clockRuns: true },
  events: [],
  missions: [],
  objectives: {} as ScenarioDefinition["objectives"],
  interactables: {} as ScenarioDefinition["interactables"],
  claims: {} as ScenarioDefinition["claims"],
  evidence: {} as ScenarioDefinition["evidence"],
  warningSigns: {} as ScenarioDefinition["warningSigns"],
  journalNotes: [],
  calls: {} as ScenarioDefinition["calls"],
  npcs: {} as Record<NpcId, NpcDef>,
  dialogues: {} as ScenarioDefinition["dialogues"],
  phone: {
    messages: {} as ScenarioDefinition["phone"]["messages"],
    contacts: [],
    officialWebsite: "",
    bankApp: { title: "", screens: [] },
  },
  decisions: {} as ScenarioDefinition["decisions"],
  endings: {} as ScenarioDefinition["endings"],
  debrief: {
    mechanism: "",
    saferAlternatives: [],
    outcomeSummaries: {} as ScenarioDefinition["debrief"]["outcomeSummaries"],
    decisionNotes: {},
    analysis: {
      pressureBuilt: "",
      whyWarningLooked: "",
      thirdCallerNote: "",
      trapNotes: { none: "", first: "", second: "", both: "" },
      verifyNextTime: [],
    },
  },
  acts: [],
  sources: {} as ScenarioDefinition["sources"],
  deductions: {} as ScenarioDefinition["deductions"],
  deviceActions: {} as ScenarioDefinition["deviceActions"],
  beats: [],
};

/** The scenario the game routes to: the foundation plus Mission 01 "THE MISSING ACCESS". */
export const LAST_SUBMISSION_SCENARIO: ScenarioDefinition = {
  ...FOUNDATION_SCENARIO,
  // Fatigue rules are on for the playable chapter; the numbers are in `game/narrative/fatigue.ts`.
  // Free thesis work: 30 minutes per percent, so one 60-minute session (one writing sprint) adds 2%.
  // Faster rates break the balance intent in `clock/balance.test.ts` (at 20 minutes per percent,
  // writing through the night reaches 90% before sleeping does); 30 keeps every assert there.
  gameplay: { ...FOUNDATION_SCENARIO.gameplay, fatigue: { enabled: true }, thesisMinutesPerPercent: 30 },
  events: [...MISSION_01_EVENTS, MISSION_01_LATE_RECOVERY_EVENT, ...MISSION_01_OFFERS_EVENTS, ...MISSION_02_EVENTS],
  missions: [...MISSION_01_MISSIONS, ...MISSION_01_OFFERS_MISSIONS, ...MISSION_02_MISSIONS],
  thesisTasks: MISSION_01_THESIS_TASKS,
  deviceItems: [...MISSION_01_DEVICE_ITEMS, ...MISSION_01_OFFERS_DEVICE_ITEMS, ...MISSION_02_DEVICE_ITEMS],
  ledgerLabels: { ...MISSION_01_LEDGER_LABELS, ...MISSION_01_OFFERS_LEDGER_LABELS, ...MISSION_02_LEDGER_LABELS },
};

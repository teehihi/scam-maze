// Chapter 1 "The Urgent Call": the three Outcomes and their consequence variants.
// The first variant whose conditions all hold is shown; the last variant of each Outcome has no
// conditions. Every consequence is labelled as a simulation (Requirement 13.11).
// Pure TypeScript data. See design.md, "Endings", and Requirements 13.11, 13.12.
//
// Variants from the design: verified, risky with money moved, risky with the code shared (and the
// account locked by the official line), and uncertain. `risky.code-shared` is the no-condition
// fallback for a shared code that was never reported to Northgate, so the text stays accurate.

import type { EndingDef } from "../types";
import type { OutcomeId } from "./ids";

export const SIMULATION_LABEL = "Simulation: nothing real happened.";

export const CHAPTER_1_ENDINGS: Record<OutcomeId, EndingDef> = {
  verified: {
    id: "verified",
    title: "Checked through a trusted channel",
    variants: [
      {
        id: "verified.reported",
        when: [],
        text: "Northgate confirmed they did not call you. You blocked the number and reported it. Your simulated account stays active.",
      },
    ],
    simulationLabel: SIMULATION_LABEL,
  },
  investigator: {
    id: "investigator",
    title: "Checked, reported and documented",
    variants: [
      {
        id: "investigator.report",
        when: [],
        text: "You checked the story through channels you already trusted, kept the evidence together and filed a report. Northgate has the details of the call and can warn other customers. Your simulated account stays active.",
      },
    ],
    // Only reachable with a report on file and at least 8 of these 11 items. The set leaves out
    // items that need a long exchange with the caller, so staying on a suspicious call earns nothing.
    unlockWhen: [
      { kind: "flag", flag: "report_filed" },
      {
        kind: "evidenceCountAtLeast",
        count: 8,
        evidenceIds: [
          "ev.caller-number",
          "ev.bank-card",
          "ev.bank-letter",
          "ev.bank-app",
          "ev.shop-poster",
          "ev.community-alert",
          "ev.sam-testimony",
          "ev.official-confirmation",
          "ev.transfer-check",
          "ev.second-number",
          "ev.partial-info",
        ],
      },
    ],
    simulationLabel: SIMULATION_LABEL,
  },
  risky: {
    id: "risky",
    title: "Followed the caller's request",
    variants: [
      {
        id: "risky.money-moved",
        when: [{ kind: "flag", flag: "money_moved" }],
        text: "The simulated savings balance now reads zero. The \"protected holding account\" belonged to the caller.",
      },
      {
        id: "risky.code-shared-locked",
        when: [
          { kind: "flag", flag: "code_shared" },
          { kind: "flag", flag: "account_locked" },
        ],
        text: "The caller used your code to sign in to your simulated account. Northgate locked it after you called, but the account was compromised.",
      },
      {
        id: "risky.code-shared",
        when: [],
        text: "The caller used your code to sign in to your simulated account. The account was compromised, and Northgate did not know yet because nobody had told them.",
      },
    ],
    simulationLabel: SIMULATION_LABEL,
  },
  uncertain: {
    id: "uncertain",
    title: "Stopped, but did not confirm",
    variants: [
      {
        id: "uncertain.stopped",
        when: [],
        text: "You ended the immediate risk, but you did not check with Northgate. If the alert had been real, you would not know. Next time, confirm through the number on your card.",
      },
    ],
    simulationLabel: SIMULATION_LABEL,
  },
};

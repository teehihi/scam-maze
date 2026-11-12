// Chapter 1 "The Urgent Call": decision panel options.
// Pure TypeScript data. See design.md, "Decisions", and Requirements 13.2, 13.3.

import type { DecisionDef } from "../types";
import type { DecisionId } from "./ids";

export const CHAPTER_1_DECISIONS: Record<DecisionId, DecisionDef> = {
  "follow-request": {
    id: "follow-request",
    label: "Call the number back and do what the caller asks",
    requires: [{ kind: "callEnded", callId: "call.scam-1" }],
    unavailableHint: "This option is available after the first call ends.",
    debriefTag: "chose-follow-request",
  },
  "verify-independently": {
    id: "verify-independently",
    label: "Report the call and block the number",
    requires: [{ kind: "hasEvidence", evidenceId: "ev.official-confirmation" }],
    unavailableHint: "Call Northgate on the official number first.",
    preStep: {
      label: "Call Northgate on the official number",
      method: "official-line",
      claimId: "claim.caller-identity",
      requires: [{ kind: "hasAnyEvidence", evidenceIds: ["ev.bank-card", "ev.bank-letter"] }],
      unavailableHint: "You need the bank's official number. Where might you find it?",
    },
    debriefTag: "chose-verify-independently",
  },
  "stop-and-wait": {
    id: "stop-and-wait",
    label: "Block the number and leave it for now",
    requires: [{ kind: "callEnded", callId: "call.scam-1" }],
    unavailableHint: "This option is available after the first call ends.",
    debriefTag: "chose-stop-and-wait",
  },
};

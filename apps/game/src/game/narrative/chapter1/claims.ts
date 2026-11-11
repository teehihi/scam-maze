// Chapter 1 "The Urgent Call": the four Claims the caller makes.
// Pure TypeScript data. See design.md, "Claims", and Requirement 12.1.

import type { Claim } from "../types";
import type { ClaimId } from "./ids";

export const CHAPTER_1_CLAIMS: Record<ClaimId, Claim> = {
  "claim.caller-identity": {
    id: "claim.caller-identity",
    text: "The caller works for Northgate Bank.",
  },
  "claim.account-suspended": {
    id: "claim.account-suspended",
    text: "Your account is suspended.",
  },
  "claim.code-needed": {
    id: "claim.code-needed",
    text: "The bank needs your one-time code to stop a transfer.",
  },
  "claim.protected-account": {
    id: "claim.protected-account",
    text: "Moving your money to a protected holding account protects it.",
  },
};

// Chapter 1 "The Urgent Call": smartphone content and call definitions.
// Domains and numbers are plain text; the Phone_UI must never render them as links
// (Requirement 7.3). The one-time code itself is never written out.
// Pure TypeScript data. See design.md, "Story", and Requirements 7.2, 16.2, 16.3.

import type { CallDef, PhoneContent } from "../types";
import type { CallId } from "./ids";

/** Number the scam caller uses (shown as "Northgate Bank Security"). */
export const SCAM_CALLER_NUMBER = "+000 555 0142";
/** Official Northgate Bank number printed on the card and the letter. */
export const OFFICIAL_BANK_NUMBER = "+000 555 0100";
/** Official website printed on the letter. */
export const OFFICIAL_BANK_WEBSITE = "northgate.example";
/** Look-alike address in the urgent text. */
export const LOOK_ALIKE_DOMAIN = "northgate-secure-verify.invalid";

export const CHAPTER_1_PHONE: PhoneContent = {
  messages: {
    "msg.sms-alert": {
      id: "msg.sms-alert",
      from: "Northgate Bank",
      body: "Northgate Bank: Account ending 9284 is suspended due to unusual overseas activity. Confirm your identity within 15 minutes at northgate-secure-verify.invalid to avoid a permanent freeze.",
      evidenceId: "ev.sms-alert",
      deliveredAtStart: true,
    },
    "msg.otp-sms": {
      id: "msg.otp-sms",
      from: "Northgate Bank",
      body: "Northgate Bank: Here is your one-time code to approve a sign-in on a new device. It expires in 5 minutes. Never share this code with anyone, including bank staff.",
      evidenceId: "ev.otp-sms",
      deliveredAtStart: false,
    },
  },
  contacts: [
    { name: "Northgate Bank Security", number: SCAM_CALLER_NUMBER },
    { name: "Northgate Bank customer support", number: OFFICIAL_BANK_NUMBER },
  ],
  officialWebsite: OFFICIAL_BANK_WEBSITE,
  bankApp: {
    title: "Northgate Bank",
    screens: [
      {
        id: "bank.account",
        title: "Your account",
        body: "Account ending 9284 is active. There are no alerts on your account.",
      },
      {
        id: "bank.activity",
        title: "Recent activity",
        body: "There are no pending transfers. Your last activity was a card payment at the corner shop yesterday.",
      },
      {
        id: "bank.help",
        title: "Help and contact",
        body: "Call customer support on +000 555 0100 or visit northgate.example. Northgate Bank will never ask for your one-time code or ask you to move money to another account.",
      },
    ],
  },
};

export const CHAPTER_1_CALLS: Record<CallId, CallDef> = {
  "call.scam-1": {
    id: "call.scam-1",
    direction: "incoming",
    displayName: "Northgate Bank Security",
    number: SCAM_CALLER_NUMBER,
    graphId: "dlg.scam-call",
  },
  "call.callback": {
    id: "call.callback",
    direction: "incoming",
    displayName: "Northgate Bank Security",
    number: SCAM_CALLER_NUMBER,
    graphId: "dlg.callback",
  },
  "call.official": {
    id: "call.official",
    direction: "outgoing",
    displayName: "Northgate Bank customer support",
    number: OFFICIAL_BANK_NUMBER,
    graphId: "dlg.official-line",
  },
};

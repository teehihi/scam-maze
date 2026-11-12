// Chapter 1 "The Urgent Call": warning signs, the eleven Evidence_Items and journal notes.
// Stances never prove a claim on their own; only the official line (an independent channel)
// can set a claim to `contradicted`.
// Pure TypeScript data. See design.md, "Evidence", and Requirements 11.1, 11.2, 11.10.

import type { EvidenceItem, JournalNote, WarningSignDef } from "../types";
import type { EvidenceId, WarningSignId } from "./ids";

export const CHAPTER_1_WARNING_SIGNS: Record<WarningSignId, WarningSignDef> = {
  "ws.urgency": {
    id: "ws.urgency",
    label: "Urgency",
    description:
      "The message gives you very little time. Scammers rush people so they do not stop to check.",
  },
  "ws.look-alike-link": {
    id: "ws.look-alike-link",
    label: "Look-alike link",
    description:
      "The link uses the bank's name, but it is not the bank's official website. Anyone can put a bank's name in a web address.",
  },
  "ws.code-request": {
    id: "ws.code-request",
    label: "Request for a one-time code",
    description:
      "A one-time code lets someone sign in or approve a payment as you. A real bank does not ask you to read it out.",
  },
  "ws.unknown-number": {
    id: "ws.unknown-number",
    label: "Number you do not know",
    description:
      "The call came from a number that is not the bank's official number. Caller ID can also be faked, so the number alone proves nothing.",
  },
  "ws.move-money": {
    id: "ws.move-money",
    label: "Request to move money",
    description:
      "The caller asks you to move your money to another account to protect it. A real bank does not ask this.",
  },
  "ws.partial-details": {
    id: "ws.partial-details",
    label: "Knowing a few personal details",
    description:
      "The caller knows your name and part of your account number. These details can come from leaked data, so they do not prove who the caller is.",
  },
  "ws.emotional-pressure": {
    id: "ws.emotional-pressure",
    label: "Emotional pressure",
    description:
      "The caller makes you feel worried or guilty so that you act before you think.",
  },
  "ws.secrecy": {
    id: "ws.secrecy",
    label: "Request for secrecy",
    description:
      "The caller tells you not to talk to anyone about the call. Scammers do this so that nobody can help you check the story.",
  },
  "ws.inconsistent-story": {
    id: "ws.inconsistent-story",
    label: "Story that does not match",
    description:
      "What the caller says does not match what you can check on a channel you trust. A real account problem would match the bank's own record.",
  },
  "ws.changing-numbers": {
    id: "ws.changing-numbers",
    label: "Different numbers, same name",
    description:
      "Calls and texts that all claim to be the bank come from different numbers. A bank does not need many numbers to reach you, and a name on a screen can be faked.",
  },
};

export const CHAPTER_1_EVIDENCE: Record<EvidenceId, EvidenceItem> = {
  "ev.sms-alert": {
    id: "ev.sms-alert",
    title: "Urgent text message",
    description:
      "A text that says your Northgate Bank account is suspended and asks you to confirm your identity within 15 minutes at northgate-secure-verify.invalid.",
    source: "device",
    location: "Phone · Messages",
    discovery: { via: "inspect", requires: [] },
    relations: [
      {
        claimId: "claim.account-suspended",
        stance: "needs-verification",
        note: "The text says the account is suspended, but a text alone does not show that this is true.",
      },
    ],
    warningSigns: ["ws.urgency", "ws.look-alike-link"],
    relevance:
      "Scam messages often create a short deadline and include a link that looks like the bank's website.",
    debriefHint:
      "The urgent text used a 15-minute deadline and a web address that is not the bank's official website.",
  },
  "ev.otp-sms": {
    id: "ev.otp-sms",
    title: "One-time code message",
    description:
      "A text with a one-time code from Northgate Bank. It says: \"Never share this code with anyone, including bank staff.\"",
    source: "device",
    location: "Phone · Messages",
    discovery: { via: "inspect", requires: [{ kind: "flag", flag: "otp_sent" }] },
    relations: [
      {
        claimId: "claim.code-needed",
        stance: "contradicts",
        note: "The bank's own message says never to share the code, not even with bank staff.",
      },
    ],
    warningSigns: ["ws.code-request"],
    relevance:
      "A one-time code is meant only for you. When someone asks for it, they may be trying to sign in as you.",
    debriefHint:
      "The one-time code message said never to share the code with anyone, including bank staff.",
  },
  "ev.caller-number": {
    id: "ev.caller-number",
    title: "Caller's number",
    description: "The call history shows that \"Northgate Bank Security\" called from +000 555 0142.",
    source: "device",
    location: "Phone · Calls",
    discovery: { via: "inspect", requires: [{ kind: "flag", flag: "scam1_rang" }] },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "needs-verification",
        note: "The name on the screen comes from the caller. Compare the number with one you already trust.",
      },
    ],
    warningSigns: ["ws.unknown-number"],
    relevance:
      "The name and number on an incoming call can be faked. Check them against a number from your card or a bank letter.",
    debriefHint: "The call history showed the number the caller used: +000 555 0142.",
  },
  "ev.bank-card": {
    id: "ev.bank-card",
    title: "Number on your bank card",
    description: "The back of your Northgate Bank card shows the official number +000 555 0100.",
    source: "physical",
    location: "Café table · wallet",
    discovery: { via: "interact", objectId: "obj.wallet" },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "needs-verification",
        note: "This is the bank's official number. Use it to check who really called.",
      },
    ],
    warningSigns: [],
    relevance:
      "Your card gives you a number you can trust because you did not get it from the caller.",
    debriefHint:
      "Your wallet on the café table held your bank card with the official number +000 555 0100.",
  },
  "ev.bank-letter": {
    id: "ev.bank-letter",
    title: "Letter from Northgate Bank",
    description:
      "A yearly statement letter that lists the support number +000 555 0100 and the website northgate.example. It says nothing about a problem with your account.",
    source: "physical",
    location: "Mailbox",
    discovery: { via: "interact", objectId: "obj.mailbox" },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "needs-verification",
        note: "The letter gives the bank's official number. Use it to check who really called.",
      },
      {
        claimId: "claim.account-suspended",
        stance: "needs-verification",
        note: "The letter does not mention a suspension, but it is older than the text, so check with the bank.",
      },
    ],
    warningSigns: [],
    relevance:
      "Letters you already have give you the bank's real contact details. Compare them with the ones in a message or call.",
    debriefHint:
      "The letter in your mailbox showed the official number and the official website northgate.example.",
  },
  "ev.bank-app": {
    id: "ev.bank-app",
    title: "Northgate Bank app",
    description:
      "The Northgate Bank app on your phone shows your account as active, with no alerts and no pending transfers.",
    source: "device",
    location: "Phone · Northgate Bank",
    discovery: { via: "verify", method: "bank-app" },
    relations: [
      {
        claimId: "claim.account-suspended",
        stance: "contradicts",
        note: "The app you installed yourself shows no suspension.",
      },
    ],
    warningSigns: [],
    relevance:
      "Opening the bank's app yourself, without using a link from a message, is a way to check an alert.",
    debriefHint:
      "The Northgate Bank app on your phone showed your account as active with no alerts.",
  },
  "ev.shop-poster": {
    id: "ev.shop-poster",
    title: "Northgate notice in the shop window",
    description:
      "A Northgate Bank notice says the bank will never ask for your one-time code and will never ask you to move money to another account to protect it.",
    source: "physical",
    location: "Corner shop window",
    discovery: { via: "interact", objectId: "obj.shop-poster" },
    relations: [
      {
        claimId: "claim.code-needed",
        stance: "contradicts",
        note: "The bank says it never asks for one-time codes.",
      },
      {
        claimId: "claim.protected-account",
        stance: "contradicts",
        note: "The bank says it never asks you to move money to protect it.",
      },
    ],
    warningSigns: ["ws.code-request", "ws.move-money"],
    relevance:
      "Banks publish what they will never ask you to do. A request that goes against this is a strong warning sign.",
    debriefHint:
      "The notice in the shop window said Northgate never asks for codes or asks you to move money.",
  },
  "ev.community-alert": {
    id: "ev.community-alert",
    title: "Neighbourhood alert",
    description:
      "An alert on the notice board says several neighbours got calls from people who said they were from a bank and asked them to move their savings to a \"protected account\".",
    source: "physical",
    location: "Notice board",
    discovery: { via: "interact", objectId: "obj.notice-board" },
    relations: [
      {
        claimId: "claim.protected-account",
        stance: "contradicts",
        note: "Neighbours got the same request from callers who were not from a bank.",
      },
    ],
    warningSigns: ["ws.move-money"],
    relevance:
      "The same story often reaches many people. Hearing it from others helps you spot the pattern.",
    debriefHint:
      "The community notice board described calls asking neighbours to move their savings to a \"protected account\".",
  },
  "ev.partial-info": {
    id: "ev.partial-info",
    title: "What the caller knew",
    description:
      "The caller knew your name and the last four digits of your account number.",
    source: "dialogue",
    location: "Scam call",
    discovery: { via: "dialogue-node", nodeId: "scam.knows-details" },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "inconclusive",
        note: "These details can come from leaked data, so they do not show who the caller is.",
      },
    ],
    warningSigns: ["ws.partial-details"],
    relevance:
      "Knowing a few personal details makes a caller sound real, but it does not prove that they work for your bank.",
    debriefHint:
      "Asking the caller how you could know they were from the bank would have shown that they only knew a few details.",
  },
  "ev.sam-testimony": {
    id: "ev.sam-testimony",
    title: "Sam's story",
    description:
      "Sam says a caller once told a friend that their account was in danger, asked for a code and then asked them to move money. Sam's advice is to call the number on your card, not the one that called you.",
    source: "npc",
    location: "Corner shop",
    discovery: { via: "dialogue-node", nodeId: "sam.after-call.story" },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "inconclusive",
        note: "Sam's story matches this call, but it does not show who called you.",
      },
    ],
    warningSigns: ["ws.emotional-pressure"],
    relevance:
      "Talking to someone you trust gives you time to think and often shows that the story is a known pattern.",
    debriefHint: "Sam at the corner shop had heard of the same kind of call.",
  },
  "ev.official-confirmation": {
    id: "ev.official-confirmation",
    title: "Northgate official line",
    description:
      "You called Northgate on +000 555 0100. They have no record of a call to you today, your account is active, and they never ask for one-time codes or ask you to move money.",
    source: "verification",
    location: "Phone · official call",
    discovery: { via: "dialogue-node", nodeId: "official.confirm" },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "contradicts",
        note: "The bank, reached on its official number, has no record of calling you.",
      },
      {
        claimId: "claim.account-suspended",
        stance: "contradicts",
        note: "The bank says your account is active.",
      },
      {
        claimId: "claim.code-needed",
        stance: "contradicts",
        note: "The bank says it never asks for one-time codes.",
      },
    ],
    warningSigns: [],
    relevance:
      "Calling the bank yourself on a number you already trust is the most reliable way to check a call or message.",
    debriefHint:
      "Calling Northgate on the number from your card or letter would have confirmed that the bank did not call you.",
  },
  "ev.transfer-check": {
    id: "ev.transfer-check",
    title: "No pending transfer on the account",
    description:
      "You asked the official line about the large transfer the caller mentioned. Northgate says there is no pending transfer and nothing is held on your account. This does not match the caller's story.",
    source: "verification",
    location: "Phone · official call",
    discovery: { via: "dialogue-node", nodeId: "official.transfer" },
    relations: [
      {
        claimId: "claim.account-suspended",
        stance: "contradicts",
        note: "The bank's own record shows no transfer and no hold, which does not match what the caller said.",
      },
    ],
    warningSigns: ["ws.inconsistent-story"],
    relevance:
      "Asking a follow-up question on a channel you trust can show whether the caller's details match the official record.",
    debriefHint:
      "Asking Northgate about the transfer showed that the bank had no record of it, so the caller's story did not match.",
  },
  "ev.second-number": {
    id: "ev.second-number",
    title: "A third number that says \"Northgate\"",
    description:
      "The call history shows \"Northgate Case Desk\" calling from +000 555 0177. This is a different number from the first caller (+000 555 0142) and from the official number (+000 555 0100).",
    source: "device",
    location: "Phone · Calls",
    discovery: { via: "inspect", requires: [{ kind: "flag", flag: "followup_rang" }] },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "contradicts",
        note: "The number does not match the official number on your card or letter.",
      },
    ],
    warningSigns: ["ws.unknown-number", "ws.changing-numbers"],
    relevance:
      "When a new number uses the bank's name, compare it with a number you already trust. You do not need to answer the call to do this.",
    debriefHint:
      "The follow-up call came from +000 555 0177, a third number that did not match the official number +000 555 0100.",
  },
  "ev.case-sms": {
    id: "ev.case-sms",
    title: "Case text with a look-alike address",
    description:
      "A text from \"Northgate Bank\" gives a case reference and asks you to review the case at northgate-case-review.invalid. This address does not match the official website northgate.example.",
    source: "device",
    location: "Phone · Messages",
    discovery: { via: "inspect", requires: [{ kind: "flag", flag: "case_sms_sent" }] },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "contradicts",
        note: "The link does not match the bank's official website.",
      },
    ],
    warningSigns: ["ws.look-alike-link", "ws.changing-numbers"],
    relevance:
      "A case reference makes a text look official, but the web address still has to match the bank's real website. Do not open links from a caller.",
    debriefHint:
      "The case text pointed to northgate-case-review.invalid, which does not match the official website northgate.example.",
  },
  "ev.shifting-story": {
    id: "ev.shifting-story",
    title: "The deadline changed",
    description:
      "In the first call the caller said you had a few minutes. When the caller called back, the story about the deadline was different. The two accounts do not match.",
    source: "dialogue",
    location: "Callback",
    discovery: { via: "dialogue-node", nodeId: "callback.story-slip" },
    relations: [
      {
        claimId: "claim.caller-identity",
        stance: "contradicts",
        note: "A real account problem has one clear record. A story that changes between calls is a warning sign.",
      },
    ],
    warningSigns: ["ws.inconsistent-story", "ws.urgency"],
    relevance:
      "Remember what a caller said earlier. When the details change, ask about the difference or end the call and check on your own.",
    debriefHint:
      "Pointing out the earlier \"few minutes\" line showed that the caller's story about the deadline had changed.",
  },
};

/**
 * Contradiction chain (Requirement 11.10): the caller's number (+000 555 0142) differs from the
 * official number on the card and the letter (+000 555 0100). `JournalNote.requires` is an
 * all-of list, so the note is tied to the card; the letter carries the same number.
 */
export const CHAPTER_1_JOURNAL_NOTES: JournalNote[] = [
  {
    id: "note.number-mismatch",
    requires: ["ev.caller-number", "ev.bank-card"],
    text: "The numbers are different. That is a warning sign, but caller ID can be faked, so a matching number would not prove anything either.",
  },
];

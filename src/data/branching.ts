/**
 * Landing-page branching preview. This is a short, hand-written illustration of
 * the idea "one decision, a different story". It is NOT the mission engine and
 * every outcome is simulated. All people and numbers are fictional.
 */

export type BranchStatus = "trapped" | "unresolved" | "contained";

export interface BranchChoice {
  id: string;
  label: string;
  status: BranchStatus;
  /** Plain-text status shown next to the icon, so colour is never the only signal. */
  statusLabel: string;
  outcomeTitle: string;
  outcome: string;
  missedOrNoticed: string[];
  /** One line shown when this path was NOT taken. */
  teaser: string;
}

export const branchPrompt = {
  from: "Ari · new number",
  message:
    "Hi, it’s Ari. I lost my phone, this is my new number. I’m stuck and need a transfer right now. I’ll explain later. Please don’t call.",
};

export const branchChoices: BranchChoice[] = [
  {
    id: "trust",
    label: "Trust the message immediately",
    status: "trapped",
    statusLabel: "Trapped",
    outcomeTitle: "The story closes in on you",
    outcome:
      "You send the transfer. An hour later, the real Ari replies from the number you have always used: nothing was lost, and no one asked for help. In this simulated story, the transfer cannot be taken back.",
    missedOrNoticed: ["A new number with no way to confirm it", "“Right now” and “don’t call”", "A request that skips every normal step"],
    teaser: "Acting at once ends in a dead end.",
  },
  {
    id: "investigate",
    label: "Investigate the sender",
    status: "unresolved",
    statusLabel: "Unresolved",
    outcomeTitle: "Doubt grows, but nothing is confirmed",
    outcome:
      "The profile photo is a stock image and the number is not in your contacts. Something is off, yet you still cannot say who is writing. The sender pushes harder: “Please hurry.” The story waits for your next move.",
    missedOrNoticed: ["The photo appears on unrelated pages", "The number has no history with you", "Pressure rises when you hesitate"],
    teaser: "Looking closer reveals doubt, not an answer.",
  },
  {
    id: "verify",
    label: "Verify through an independent channel",
    status: "contained",
    statusLabel: "Contained",
    outcomeTitle: "The story diverges",
    outcome:
      "You call the number you have always had for Ari. Ari answers, puzzled, phone in hand. The new number goes silent. In this simulated story, the request never turns into a transfer.",
    missedOrNoticed: ["You left the channel the sender controlled", "You used a contact you already trusted", "You asked before acting"],
    teaser: "Stepping outside the conversation changes the ending.",
  },
];

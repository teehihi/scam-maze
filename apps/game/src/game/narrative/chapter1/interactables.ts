// Chapter 1 "The Urgent Call": narrative side of the five Interactables.
// Positions live in the rendering layer (`features/chapter1/world/propLayout.ts`).
// Pure TypeScript data. See design.md, "Interactables", and Requirement 3.7.

import type { InteractableDef } from "../types";
import type { InteractableId } from "./ids";

export const CHAPTER_1_INTERACTABLES: Record<InteractableId, InteractableDef> = {
  "obj.wallet": {
    id: "obj.wallet",
    label: "your wallet on the café table",
    actionLabel: "check",
    inspectionText:
      "Your Northgate Bank card is in your wallet. The back of the card shows the bank's official number: +000 555 0100.",
    produces: { type: "INTERACT_OBJECT" },
    reveals: ["ev.bank-card"],
  },
  "obj.mailbox": {
    id: "obj.mailbox",
    label: "your mailbox",
    actionLabel: "open",
    inspectionText:
      "There is a letter from Northgate Bank about your yearly statement. It lists the customer support number +000 555 0100 and the website northgate.example. It says nothing about a problem with your account.",
    produces: { type: "INTERACT_OBJECT" },
    reveals: ["ev.bank-letter"],
  },
  "obj.shop-poster": {
    id: "obj.shop-poster",
    label: "the Northgate notice in the shop window",
    actionLabel: "read",
    inspectionText:
      "The notice says: \"Northgate Bank will never ask for your one-time code. We will never ask you to move your money to another account to protect it.\"",
    produces: { type: "INTERACT_OBJECT" },
    reveals: ["ev.shop-poster"],
  },
  "obj.shopkeeper": {
    id: "obj.shopkeeper",
    label: "Sam at the shop counter",
    actionLabel: "talk to",
    inspectionText: "Sam runs the corner shop and knows most people on the street.",
    produces: { type: "TALK_TO_NPC", npcId: "npc.sam" },
    reveals: [],
  },
  "obj.notice-board": {
    id: "obj.notice-board",
    label: "the community notice board",
    actionLabel: "read",
    inspectionText:
      "A neighbourhood alert is pinned to the board: \"Several neighbours got calls from people who said they were from a bank. The callers asked them to move their savings to a 'protected account'. Do not move money because a caller asks. Call your bank on the number you already know.\"",
    produces: { type: "INTERACT_OBJECT" },
    reveals: ["ev.community-alert"],
  },
};

/**
 * Full interaction prompt per Interactable, shown while it is focused (Requirement 3.3:
 * "Press E to <action label> <object label>"). Authored as complete sentences, not built from
 * `actionLabel` and `label`, so translations can use their own word order. Keep each sentence in
 * line with the object's `actionLabel` and `label` above.
 */
export const CHAPTER_1_INTERACTION_PROMPTS: Record<InteractableId, string> = {
  "obj.wallet": "Press E to check your wallet on the café table",
  "obj.mailbox": "Press E to open your mailbox",
  "obj.shop-poster": "Press E to read the Northgate notice in the shop window",
  "obj.shopkeeper": "Press E to talk to Sam at the shop counter",
  "obj.notice-board": "Press E to read the community notice board",
};

/**
 * Maps the focused Interactable to the core action it produces (Requirements 3.4, 3.5, 3.7).
 *
 * The action type comes from scenario data (`CHAPTER_1_INTERACTABLES[id].produces`), so the
 * rendering layer never decides what an object does. Pure TypeScript: no React or Three.js.
 */

import { CHAPTER_1_INTERACTABLES } from "../../../game/narrative/chapter1/interactables";
import type { InteractableId } from "../../../game/narrative/chapter1/ids";
import type { CoreAction } from "../../../game/narrative/types";

export type InteractionAction = Extract<CoreAction, { type: "INTERACT_OBJECT" | "TALK_TO_NPC" }>;

/** Returns the core action for the focused Interactable, or null when nothing is focused. */
export function interactionToAction(focus: InteractableId | null): InteractionAction | null {
  if (focus === null) return null;
  const produces = CHAPTER_1_INTERACTABLES[focus].produces;
  if (produces.type === "TALK_TO_NPC") {
    return { type: "TALK_TO_NPC", npcId: produces.npcId };
  }
  return { type: "INTERACT_OBJECT", objectId: focus };
}

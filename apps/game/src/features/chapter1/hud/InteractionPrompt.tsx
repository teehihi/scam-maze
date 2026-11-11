// Prompt shown while an Interactable is focused (Requirement 3.3).
// The sentence is authored per object in `CHAPTER_1_INTERACTION_PROMPTS`, not concatenated here.

import React from "react";
import type { InteractableId } from "../../../game/narrative/chapter1/ids";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../../../game/narrative/chapter1/interactables";
import { UI } from "../theme";

export interface InteractionPromptProps {
  /** Focused Interactable, or `null` to render nothing. */
  objectId: InteractableId | null;
  /** Overrides the authored prompt table (tests, other chapters). */
  prompts?: Readonly<Record<InteractableId, string>>;
}

export const InteractionPrompt: React.FC<InteractionPromptProps> = ({
  objectId,
  prompts = CHAPTER_1_INTERACTION_PROMPTS,
}) => {
  if (objectId === null || !Object.hasOwn(prompts, objectId)) return null;
  return (
    <p data-testid="interaction-prompt" className={`${UI.hudPanel} pointer-events-none`}>
      {prompts[objectId]}
    </p>
  );
};

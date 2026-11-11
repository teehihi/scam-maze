// Prompt shown while an Interactable is focused (Requirement 3.3).
// The sentence is authored per object in `CHAPTER_1_INTERACTION_PROMPTS` (and its translations
// in the narrative overlay), not concatenated here. This component has no UI chrome text.

import React from "react";
import type { InteractableId } from "../../../game/narrative/chapter1/ids";
import { getDisplayPrompts } from "../../../i18n/narrative";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { UI } from "../theme";

export interface InteractionPromptProps {
  /** Focused Interactable, or `null` to render nothing. */
  objectId: InteractableId | null;
  /**
   * Overrides the prompt table (tests, other chapters). Defaults to the Chapter 1 prompts in the
   * current UI language (`getDisplayPrompts`); English is the authored table itself.
   */
  prompts?: Readonly<Record<InteractableId, string>>;
}

export const InteractionPrompt: React.FC<InteractionPromptProps> = ({ objectId, prompts: promptsProp }) => {
  const locale = useGameLocale();
  const prompts = promptsProp ?? getDisplayPrompts(locale);
  if (objectId === null || !Object.hasOwn(prompts, objectId)) return null;
  return (
    <p data-testid="interaction-prompt" className={`${UI.hudPanel} pointer-events-none`}>
      {prompts[objectId]}
    </p>
  );
};

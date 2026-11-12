// Choice_Overlay for an active call: the player's reply options, shown outside the phone screen.
// Pure DOM (no three, React Three Fiber or Drei imports). It is rendered by `CallPresentation` as
// a sibling of `PhoneScreenHost`, never inside it (Requirement 3.2).
// See design.md, "`PlayerChoiceOverlay.tsx` (DOM only)", and Requirements 3, 4 and 7.10.
//
// - Root: fixed at `region` (from `computeCallLayout`), `maxHeight: region.height`, vertical
//   scroll only, on the opaque `UI.choicePanel` surface (owner decision, 2026-11-13).
// - A visible label from `dialogue.optionsLabel` names the option list (`aria-labelledby`).
// - Optional narration paragraph (a non-caller line, labeled with `dialogue.systemSpeaker`).
// - `ol > li > button` per option, with an `aria-hidden` 1-9 key hint and wrapped text;
//   `dialogue.fallbackOption` for fallback options; `dialogue.noOptions` and no list when empty.
// - Keyboard logic comes from `useDialogueOptionKeys` (number keys and auto focus on, disabled
//   while paused). The overlay holds no dialogue state and only reports the chosen option ID.
import React, { useId } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DialogueView } from "../../../game/narrative/selectors";
import { UI } from "../theme";
import { useDialogueOptionKeys } from "../dialogue/useDialogueOptionKeys";
import type { Rect } from "./callLayout";

export interface PlayerChoiceOverlayProps {
  /** Call-linked view from `selectDialogueView`. */
  view: DialogueView;
  /** Non-caller line text shown above the options, or null. */
  narration: string | null;
  /** True while the page is paused: every option is disabled. */
  disabled: boolean;
  /** The page's `handleSelectOption`. */
  onSelectOption: (optionId: string) => void;
  /** Region from `computeCallLayout` (`layout.choice`); its height is the maximum height. */
  region: Rect;
}

export const PlayerChoiceOverlay: React.FC<PlayerChoiceOverlayProps> = ({
  view,
  narration,
  disabled,
  onSelectOption,
  region,
}) => {
  const { t } = useTranslation("chapter1");
  const labelId = useId();
  const options = view.options;
  const { setOptionRef, onOptionKeyDown } = useDialogueOptionKeys({
    options,
    onSelectOption,
    disabled,
    numberKeys: true,
    autoFocus: true,
    nodeKey: `${view.graphId}:${view.nodeId}`,
  });

  return (
    <div
      data-testid="player-choice-overlay"
      className={`${UI.choicePanel} flex flex-col gap-3`}
      style={{
        position: "fixed",
        left: region.left,
        top: region.top,
        width: region.width,
        maxHeight: region.height,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* Persistent polite region, so a new narration line is announced once. */}
      <div aria-live="polite" aria-atomic="true" data-testid="choice-narration">
        {narration ? (
          <div>
            <p className={`${UI.label} flex items-center gap-1.5`}>
              <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t("dialogue.systemSpeaker")}</span>
            </p>
            <p className="mt-1.5 whitespace-normal break-words text-sm leading-relaxed text-[#f7f5ff]">
              {narration}
            </p>
          </div>
        ) : null}
      </div>

      <p id={labelId} className={UI.label}>
        {t("dialogue.optionsLabel")}
      </p>

      {options.length === 0 ? (
        <p className={UI.body}>{t("dialogue.noOptions")}</p>
      ) : (
        <ol aria-labelledby={labelId} className="flex flex-col gap-2">
          {options.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                ref={setOptionRef(index)}
                data-testid={`dialogue-option-${option.id}`}
                className={UI.choiceOption}
                disabled={disabled}
                onClick={() => onSelectOption(option.id)}
                onKeyDown={(event) => onOptionKeyDown(event, index)}
              >
                {index < 9 ? (
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#38344f] text-xs text-[#a9a4c4]"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 whitespace-normal break-words">
                  {option.fallback ? t("dialogue.fallbackOption") : option.text}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

// Shared dialogue panel: the current speaker and line, and the available options.
// Used inside the phone call screen and in the face-to-face panel with Sam.
// Presentational only: it reads a `DialogueView` from `selectDialogueView` and reports the chosen
// option through `onSelectOption`. See design.md, "Rendering layer", and Requirements 9.3-9.5.
// Chrome comes from `chapter1:dialogue.*`. The player and system speaker labels and the fallback
// option are rendered by their codes; lines, option text and persona names come from the view.
//
// Keyboard: options are buttons in a list (Tab and Shift+Tab), Arrow Up/Down and Home/End move
// between them, and number keys 1-9 select the matching option when `numberKeys` is on.
import React, { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DialogueView } from "../../../game/narrative/selectors";
import { UI } from "../theme";

export interface DialoguePanelProps {
  /** Current conversation from `selectDialogueView`. */
  view: DialogueView;
  /** Called with the option ID; the page dispatches SELECT_DIALOGUE_OPTION. */
  onSelectOption: (optionId: string) => void;
  /** Disables every option, for example while the page is paused. */
  disabled?: boolean;
  /** Listen for number keys 1-9 to pick an option. Default: true. */
  numberKeys?: boolean;
  /** Move focus to the first option when the node changes. Default: true. */
  autoFocus?: boolean;
  className?: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export const DialoguePanel: React.FC<DialoguePanelProps> = ({
  view,
  onSelectOption,
  disabled = false,
  numberKeys = true,
  autoFocus = true,
  className = "",
}) => {
  const { t } = useTranslation("chapter1");
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const options = view.options;

  // Latest values for the window listener without re-subscribing on every render.
  const latest = useRef({ options, onSelectOption, disabled });
  useEffect(() => {
    latest.current = { options, onSelectOption, disabled };
  }, [options, onSelectOption, disabled]);

  // Focus the first option when a new node is shown, so keyboard players can answer at once.
  useEffect(() => {
    if (!autoFocus || disabled) return;
    optionRefs.current[0]?.focus();
  }, [autoFocus, disabled, view.graphId, view.nodeId]);

  useEffect(() => {
    if (!numberKeys) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      if (!/^[1-9]$/.test(event.key)) return;
      const { options: current, onSelectOption: select, disabled: off } = latest.current;
      if (off) return;
      const option = current[Number(event.key) - 1];
      if (!option) return;
      event.preventDefault();
      select(option.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [numberKeys]);

  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = options.length;
    if (count === 0) return;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next === null) return;
    event.preventDefault();
    optionRefs.current[next]?.focus();
  };

  // Speaker by code: the core's "You" is not shown; caller and NPC names come from the scenario.
  const speakerLabel =
    view.speaker === "player"
      ? t("dialogue.playerSpeaker")
      : view.speaker === "system"
        ? t("dialogue.systemSpeaker")
        : (view.speakerName ?? t("dialogue.systemSpeaker"));
  const listLabelId = `dialogue-options-${view.graphId}`;

  return (
    <div data-testid="dialogue-panel" className={`flex flex-col gap-3 ${className}`}>
      <div className={UI.card} aria-live="polite" aria-atomic="true" data-testid="dialogue-line">
        <p className={`${UI.label} flex items-center gap-1.5`}>
          <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{speakerLabel}</span>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[#f7f5ff]">{view.line}</p>
      </div>

      <div>
        <p id={listLabelId} className="sr-only">
          {t("dialogue.optionsLabel")}
        </p>
        {options.length === 0 ? (
          <p className={UI.body}>{t("dialogue.noOptions")}</p>
        ) : (
          <ol aria-labelledby={listLabelId} className="flex flex-col gap-2">
            {options.map((option, index) => (
              <li key={option.id}>
                <button
                  type="button"
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  data-testid={`dialogue-option-${option.id}`}
                  className={`${UI.buttonSecondary} w-full justify-start text-left`}
                  disabled={disabled}
                  onClick={() => onSelectOption(option.id)}
                  onKeyDown={(event) => onOptionKeyDown(event, index)}
                >
                  {numberKeys && index < 9 ? (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#38344f] text-xs text-[#a9a4c4]"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                  ) : null}
                  <span>{option.fallback ? t("dialogue.fallbackOption") : option.text}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

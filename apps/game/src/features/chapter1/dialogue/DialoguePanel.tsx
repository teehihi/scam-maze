// Shared dialogue panel: the current speaker and line, and the available options.
// Used inside the phone call screen and in the face-to-face panel with Sam.
// Presentational only: it reads a `DialogueView` from `selectDialogueView` and reports the chosen
// option through `onSelectOption`. See design.md, "Rendering layer", and Requirements 9.3-9.5.
// Chrome comes from `chapter1:dialogue.*`. The player and system speaker labels and the fallback
// option are rendered by their codes; lines, option text and persona names come from the view.
//
// Keyboard: options are buttons in a list (Tab and Shift+Tab), Arrow Up/Down and Home/End move
// between them, and number keys 1-9 select the matching option when `numberKeys` is on.
// The keyboard logic lives in `useDialogueOptionKeys`.
import React, { useEffect, useRef } from "react";
import { MessageCircle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DialogueView } from "../../../game/narrative/selectors";
import { UI } from "../theme";
import { useDialogueOptionKeys } from "./useDialogueOptionKeys";

/** Optional voice state for the face-to-face line. Absent: the panel renders as before. */
export interface DialoguePanelVoice {
  /** False when sound is off, volume is 0 or there is no clip and no preview. */
  replayEnabled: boolean;
  notice: "none" | "autoplay-blocked" | "dev-preview" | "english-voice" | "no-audio";
  onReplay: () => void;
}

const NOTICE_KEYS = {
  "autoplay-blocked": "phone.call.notice.autoplayBlocked",
  "dev-preview": "phone.call.notice.devPreview",
  "english-voice": "phone.call.notice.englishVoice",
  "no-audio": "phone.call.notice.noAudio",
} as const;

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
  /** Voice controls: a Replay button and the notice line. The text card is always visible. */
  voice?: DialoguePanelVoice;
  /** True while the speaker is still talking: replies are hidden until the wait ends. */
  waiting?: boolean;
  /** Ends the wait early ("Show replies now"). */
  onSkipWait?: () => void;
  className?: string;
}

export const DialoguePanel: React.FC<DialoguePanelProps> = ({
  view,
  onSelectOption,
  disabled = false,
  numberKeys = true,
  autoFocus = true,
  voice,
  waiting = false,
  onSkipWait,
  className = "",
}) => {
  const { t } = useTranslation("chapter1");
  const options = view.options;
  const { setOptionRef, onOptionKeyDown, focusFirst } = useDialogueOptionKeys({
    options,
    onSelectOption,
    disabled,
    numberKeys: numberKeys && !waiting,
    autoFocus: autoFocus && !waiting,
    nodeKey: `${view.graphId}:${view.nodeId}`,
  });

  const skipRef = useRef<HTMLButtonElement | null>(null);
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (waiting) {
      skipRef.current?.focus();
    } else if (wasWaiting.current) {
      focusFirst();
    }
    wasWaiting.current = waiting;
  }, [waiting, focusFirst]);

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

      {voice ? (
        <div className="flex flex-col gap-2">
          <p
            aria-live="polite"
            data-testid="dialogue-notice"
            className="text-sm leading-relaxed text-[#a9a4c4]"
          >
            {voice.notice === "none" ? null : t(NOTICE_KEYS[voice.notice])}
          </p>
          <button
            type="button"
            className={UI.buttonSecondary}
            onClick={voice.onReplay}
            disabled={disabled || !voice.replayEnabled}
            data-testid="dialogue-replay"
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("phone.call.replay")}</span>
          </button>
        </div>
      ) : null}

      {waiting ? (
        <div className="flex flex-col gap-2" data-testid="dialogue-waiting">
          <p role="status" className={UI.body}>
            {t("phone.call.listening")}
          </p>
          <button
            ref={skipRef}
            type="button"
            className={UI.buttonSecondary}
            disabled={disabled}
            onClick={() => onSkipWait?.()}
            data-testid="dialogue-skip-wait"
          >
            <span>{t("phone.call.showReplies")}</span>
          </button>
        </div>
      ) : (
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
                  ref={setOptionRef(index)}
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
      )}
    </div>
  );
};

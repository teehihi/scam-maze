// Keyboard logic for a list of dialogue option buttons, shared by `DialoguePanel` and the call
// `PlayerChoiceOverlay`. Extracted from `DialoguePanel.tsx` without behavior changes.
// See design.md, "`dialogue/useDialogueOptionKeys.ts` (extracted hook)", and Requirements 4.2-4.5
// and 4.7.
//
// - Number keys 1-9 (window listener, only when `numberKeys` is on) select the option at that
//   position. Ignored with Alt, Ctrl or Meta, on key repeat, in typing targets, while disabled,
//   and when N is larger than the option count.
// - Arrow Down and Arrow Up move focus to the next or previous option and wrap; Home and End jump
//   to the first or last option.
// - When `nodeKey` changes (and `autoFocus` is on and the list is not disabled), focus moves to the
//   first option.
import type React from "react";
import { useCallback, useEffect, useRef } from "react";
import type { DialogueOptionView } from "../../../game/narrative/dialogueEngine";

export interface DialogueOptionKeysInput {
  options: readonly DialogueOptionView[];
  onSelectOption: (optionId: string) => void;
  disabled: boolean;
  /** Listen on the window for number keys 1-9. */
  numberKeys: boolean;
  /** Focus the first option when `nodeKey` changes. */
  autoFocus: boolean;
  /** Identifies the shown node, for example `${graphId}:${nodeId}`. */
  nodeKey: string;
}

export interface DialogueOptionKeys {
  setOptionRef: (index: number) => (element: HTMLButtonElement | null) => void;
  onOptionKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => void;
  /** Focuses the first option; returns false when there is no option to focus. */
  focusFirst: () => boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useDialogueOptionKeys(input: DialogueOptionKeysInput): DialogueOptionKeys {
  const { options, onSelectOption, disabled, numberKeys, autoFocus, nodeKey } = input;
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Latest values for the window listener without re-subscribing on every render.
  const latest = useRef({ options, onSelectOption, disabled });
  useEffect(() => {
    latest.current = { options, onSelectOption, disabled };
  }, [options, onSelectOption, disabled]);

  const focusFirst = useCallback((): boolean => {
    const first = optionRefs.current[0];
    if (!first) return false;
    first.focus();
    return true;
  }, []);

  // Focus the first option when a new node is shown, so keyboard players can answer at once.
  useEffect(() => {
    if (!autoFocus || disabled) return;
    focusFirst();
  }, [autoFocus, disabled, nodeKey, focusFirst]);

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

  const setOptionRef = useCallback(
    (index: number) => (element: HTMLButtonElement | null) => {
      optionRefs.current[index] = element;
    },
    [],
  );

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

  return { setOptionRef, onOptionKeyDown, focusFirst };
}

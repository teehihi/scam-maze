// Feature: game-3d-phone-call-ui, Property 8: Option keyboard rules
//
// **Validates: Requirements 4.2, 4.3, 4.4, 4.7**
//
// For any option count from 0 to 9, any key (digits 0 to 9, Arrow Up, Arrow Down, Home, End,
// other keys) with any combination of Alt, Ctrl, Meta and `repeat`, sent from any focused option
// or from a typing target, and any paused flag, `useDialogueOptionKeys` selects option N exactly
// when the key is digit N from 1 to 9, N is at most the count, no modifier is held, the event is
// not a repeat, the target is not a typing target and the list is not paused. Arrow, Home and End
// keys move focus to the expected wrapped index and select nothing. No other event selects
// anything or moves focus.
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DialogueOptionView } from "../../../game/narrative/dialogueEngine";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { useDialogueOptionKeys } from "./useDialogueOptionKeys";

const SEED = 0x5ca1_0008;
const CASES = 300;
const PROPERTY_TIMEOUT_MS = 60_000;

const KEYS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "a",
  "Enter",
  " ",
  "Escape",
  "Tab",
  "ArrowLeft",
] as const;

type TypingTarget = "none" | "input" | "textarea" | "select";

interface KeyCase {
  count: number;
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  typingTarget: TypingTarget;
  /** Option the event is sent from, when there is no typing target and at least one option. */
  fromIndex: number;
  paused: boolean;
}

function makeOptions(count: number): DialogueOptionView[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `option-${index + 1}`,
    lineId: `line-${index + 1}`,
    text: `Option ${index + 1}`,
    fallback: false,
  }));
}

function Harness(props: {
  options: readonly DialogueOptionView[];
  onSelectOption: (optionId: string) => void;
  paused: boolean;
}) {
  const { options, onSelectOption, paused } = props;
  const { setOptionRef, onOptionKeyDown } = useDialogueOptionKeys({
    options,
    onSelectOption,
    disabled: paused,
    numberKeys: true,
    autoFocus: false,
    nodeKey: "graph:node",
  });
  return (
    <div>
      <input data-testid="typing-input" aria-label="Typing input" />
      <textarea data-testid="typing-textarea" aria-label="Typing textarea" />
      <select data-testid="typing-select" aria-label="Typing select">
        <option value="a">A</option>
      </select>
      <ul>
        {options.map((option, index) => (
          <li key={option.id}>
            <button
              type="button"
              ref={setOptionRef(index)}
              data-testid={`option-${index}`}
              // Same as DialoguePanel: options are disabled while paused.
              disabled={paused}
              onClick={() => onSelectOption(option.id)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              {option.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function generateCase(next: () => number): KeyCase {
  const count = randomInt(next, 0, 9);
  return {
    count,
    key: pick(next, KEYS),
    altKey: next() < 0.2,
    ctrlKey: next() < 0.2,
    metaKey: next() < 0.2,
    repeat: next() < 0.2,
    typingTarget: next() < 0.25 ? pick(next, ["input", "textarea", "select"] as const) : "none",
    fromIndex: count === 0 ? -1 : randomInt(next, 0, count - 1),
    paused: next() < 0.25,
  };
}

/** Independent model of the expected result: the selected option id and the focused option. */
function expected(c: KeyCase): { selected: string | null; focusIndex: number | null } {
  const fromOption = c.typingTarget === "none" && c.count > 0;
  // Disabled buttons cannot take focus, so while paused no option is the starting focus.
  const startFocus = fromOption && !c.paused ? c.fromIndex : null;

  let selected: string | null = null;
  const digit = /^[1-9]$/.test(c.key) ? Number(c.key) : null;
  if (
    digit !== null &&
    digit <= c.count &&
    !c.altKey &&
    !c.ctrlKey &&
    !c.metaKey &&
    !c.repeat &&
    c.typingTarget === "none" &&
    !c.paused
  ) {
    selected = `option-${digit}`;
  }

  let focusIndex = startFocus;
  if (startFocus !== null) {
    const n = c.count;
    if (c.key === "ArrowDown") focusIndex = (startFocus + 1) % n;
    else if (c.key === "ArrowUp") focusIndex = (startFocus - 1 + n) % n;
    else if (c.key === "Home") focusIndex = 0;
    else if (c.key === "End") focusIndex = n - 1;
  }
  return { selected, focusIndex };
}

describe("useDialogueOptionKeys (Property 8)", () => {
  it(
    "selects only on unmodified, non-repeated digit keys and moves focus only on navigation keys",
    () => {
      const next = createLcg(SEED);
      for (let caseIndex = 0; caseIndex < CASES; caseIndex += 1) {
        const c = generateCase(next);
        const onSelectOption = vi.fn();
        const view = render(
          <Harness options={makeOptions(c.count)} onSelectOption={onSelectOption} paused={c.paused} />,
        );
        try {
          let target: HTMLElement;
          if (c.typingTarget !== "none") {
            target = view.getByTestId(`typing-${c.typingTarget}`);
            target.focus();
          } else if (c.count > 0) {
            target = view.getByTestId(`option-${c.fromIndex}`);
            target.focus();
          } else {
            target = document.body;
          }
          const focusBefore = document.activeElement;

          fireEvent.keyDown(target, {
            key: c.key,
            altKey: c.altKey,
            ctrlKey: c.ctrlKey,
            metaKey: c.metaKey,
            repeat: c.repeat,
          });

          const want = expected(c);
          if (want.selected === null) {
            expect(onSelectOption).not.toHaveBeenCalled();
          } else {
            expect(onSelectOption).toHaveBeenCalledTimes(1);
            expect(onSelectOption).toHaveBeenCalledWith(want.selected);
          }
          if (want.focusIndex === null) {
            expect(document.activeElement).toBe(focusBefore);
          } else {
            expect(document.activeElement).toBe(view.getByTestId(`option-${want.focusIndex}`));
          }
        } catch (error) {
          throw new Error(
            `Property 8 failed (seed ${SEED}, case ${caseIndex}): ${JSON.stringify(c)}\n${String(error)}`,
          );
        } finally {
          view.unmount();
        }
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});

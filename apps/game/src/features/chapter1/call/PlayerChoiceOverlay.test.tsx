// PlayerChoiceOverlay unit tests (task 7.4). Requirements 3.5, 3.7, 3.8, 3.9, 4.1, 4.7 and 7.10.
//
// The dialogue views come from the real Chapter 1 core (`chapterReducer` and
// `selectDialogueView`), in English and in the Vietnamese display scenario, so the overlay is
// tested with the same data the Chapter_Page passes to it.
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { selectDialogueView, type DialogueView } from "../../../game/narrative/selectors";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import type { GameLocale } from "@scammaze/shared-types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import enStory from "../../../i18n/locales/en/chapter1/story";
import viStory from "../../../i18n/locales/vi/chapter1/story";
import { UI } from "../theme";
import { PlayerChoiceOverlay } from "./PlayerChoiceOverlay";

const STORY = { en: enStory, vi: viStory } as const;
const LOCALES: readonly GameLocale[] = ["en", "vi"];
const REGION = { left: 16, top: 400, width: 360, height: 300 };

/** Scam call answered: the caller's opening node, with its reply options. */
const SCAM_OPEN: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
  { type: "ANSWER_CALL" },
];

/** Official line reached: its first node is a `system` narration line (`official.greeting`). */
const OFFICIAL_GREETING: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
  { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
  { type: "ANSWER_CALL" },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.open.ask-proof" },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.knows.challenge" },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.challenged.call-card" },
  { type: "OPEN_PHONE" },
  { type: "INSPECT_EVIDENCE", evidenceId: "ev.caller-number" },
  { type: "VERIFY_CLAIM", claimId: "claim.account-suspended", method: "bank-app" },
  { type: "CLOSE_PHONE" },
  { type: "VERIFY_CLAIM", claimId: "claim.caller-identity", method: "official-line" },
];

function run(actions: readonly CoreAction[]): ChapterState {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  for (const action of actions) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    expect(result.accepted, `${JSON.stringify(action)} rejected: ${result.reason ?? ""}`).toBe(true);
    state = result.state;
  }
  return state;
}

function viewFor(actions: readonly CoreAction[], scenario: ScenarioDefinition): DialogueView {
  const view = selectDialogueView(run(actions), scenario);
  expect(view).not.toBeNull();
  return view!;
}

function renderOverlay(props: {
  view: DialogueView;
  narration?: string | null;
  disabled?: boolean;
  onSelectOption?: (optionId: string) => void;
}) {
  const onSelectOption = props.onSelectOption ?? vi.fn();
  const utils = render(
    <PlayerChoiceOverlay
      view={props.view}
      narration={props.narration ?? null}
      disabled={props.disabled ?? false}
      onSelectOption={onSelectOption}
      region={REGION}
    />,
  );
  return { ...utils, onSelectOption, overlay: screen.getByTestId("player-choice-overlay") };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(LOCALES)("PlayerChoiceOverlay (%s)", (locale) => {
  const story = STORY[locale];
  const scenario = getDisplayScenario(locale);

  function setLocale(): void {
    applyLocale(locale);
  }

  it("names the ordered option list with the visible label (Req 3.8, 7.10)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    expect(view.options.length).toBeGreaterThan(0);
    const { overlay } = renderOverlay({ view });

    const label = within(overlay).getByText(story.dialogue.optionsLabel);
    expect(label.tagName).toBe("P");
    const list = within(overlay).getByRole("list", { name: story.dialogue.optionsLabel });
    expect(list.tagName).toBe("OL");
    expect(list.getAttribute("aria-labelledby")).toBe(label.id);
    // The label sits above the list.
    expect(label.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // One list item per option, in order, each with exactly one button named by the option text.
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(view.options.length);
    items.forEach((item, index) => {
      const option = view.options[index];
      const buttons = within(item).getAllByRole("button");
      expect(buttons).toHaveLength(1);
      const expectedText = option.fallback ? story.dialogue.fallbackOption : option.text;
      expect(within(item).getByRole("button", { name: expectedText })).toBe(buttons[0]);
      expect(buttons[0].getAttribute("data-testid")).toBe(`dialogue-option-${option.id}`);
    });
  });

  it("shows noOptions and zero option buttons for a node without options (Req 3.7)", () => {
    setLocale();
    const base = viewFor(SCAM_OPEN, scenario);
    const { overlay } = renderOverlay({ view: { ...base, options: [] } });

    expect(within(overlay).getByText(story.dialogue.noOptions)).toBeTruthy();
    expect(within(overlay).getByText(story.dialogue.optionsLabel)).toBeTruthy();
    expect(within(overlay).queryAllByRole("button")).toHaveLength(0);
    expect(within(overlay).queryByRole("list")).toBeNull();
  });

  it("shows a system line as a labeled narration paragraph in a polite live region", () => {
    setLocale();
    const view = viewFor(OFFICIAL_GREETING, scenario);
    expect(view.speaker).toBe("system");
    const { overlay, rerender, onSelectOption } = renderOverlay({ view, narration: view.line });

    const region = within(overlay).getByTestId("choice-narration");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(within(region).getByText(story.dialogue.systemSpeaker)).toBeTruthy();
    const paragraph = within(region).getByText(view.line);
    expect(paragraph.tagName).toBe("P");
    expect(paragraph.className).toContain("whitespace-normal");
    expect(paragraph.className).toContain("break-words");
    // Narration comes before the options label and list.
    const label = within(overlay).getByText(story.dialogue.optionsLabel);
    expect(region.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The live region stays mounted when there is no narration, so the next line is announced.
    rerender(
      <PlayerChoiceOverlay
        view={view}
        narration={null}
        disabled={false}
        onSelectOption={onSelectOption}
        region={REGION}
      />,
    );
    const emptyRegion = screen.getByTestId("choice-narration");
    expect(emptyRegion).toBe(region);
    expect(emptyRegion.textContent).toBe("");
    expect(screen.queryByText(story.dialogue.systemSpeaker)).toBeNull();
  });

  it("wraps option text, never truncates it, and uses UI.choiceOption (Req 3.5, 3.9)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const { overlay } = renderOverlay({ view });

    const buttons = within(overlay).getAllByRole("button");
    for (const button of buttons) {
      expect(button.className).toBe(UI.choiceOption);
      expect(button.className).toContain("whitespace-normal");
      expect(button.className).toContain("break-words");
      const text = button.querySelector("span:last-child");
      expect(text?.className).toContain("whitespace-normal");
      expect(text?.className).toContain("break-words");
    }
    // State classes of the shared token (hover, pressed, keyboard focus, disabled).
    for (const token of [
      "hover:bg-[#26233a]",
      "active:bg-[#2f2a48]",
      "focus-visible:outline-2",
      "disabled:text-[#a9a4c4]",
    ]) {
      expect(UI.choiceOption).toContain(token);
    }
    // No truncation or ellipsis anywhere in the overlay.
    for (const element of [overlay, ...Array.from(overlay.querySelectorAll("*"))]) {
      const className = element.getAttribute("class") ?? "";
      expect(className).not.toMatch(/\b(truncate|text-ellipsis|line-clamp-\S+|whitespace-nowrap)\b/);
    }
    expect(overlay.style.overflowX).toBe("hidden");
    expect(overlay.style.overflowY).toBe("auto");
  });

  it("calls onSelectOption once with the option ID on click, Enter and Space (Req 4.1)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const onSelectOption = vi.fn();
    const { overlay } = renderOverlay({ view, onSelectOption });
    const buttons = within(overlay).getAllByRole("button");
    const first = view.options[0];
    const last = view.options[view.options.length - 1];

    fireEvent.click(buttons[0]);
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenLastCalledWith(first.id);

    // Enter and Space use the native button activation: no key handler cancels it or selects on
    // its own. jsdom does not synthesize the activation click, so dispatch it as the browser would.
    for (const key of [
      { key: "Enter", code: "Enter" },
      { key: " ", code: "Space" },
    ]) {
      onSelectOption.mockClear();
      const target = buttons[buttons.length - 1];
      target.focus();
      expect(document.activeElement).toBe(target);
      expect(fireEvent.keyDown(target, key)).toBe(true);
      expect(fireEvent.keyUp(target, key)).toBe(true);
      expect(onSelectOption).not.toHaveBeenCalled();
      fireEvent.click(target);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption).toHaveBeenLastCalledWith(last.id);
    }
  });

  it("disables every option while paused and dispatches nothing (Req 4.7)", () => {
    setLocale();
    const view = viewFor(SCAM_OPEN, scenario);
    const onSelectOption = vi.fn();
    const { overlay } = renderOverlay({ view, disabled: true, onSelectOption });

    const buttons = within(overlay).getAllByRole("button");
    expect(buttons).toHaveLength(view.options.length);
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    fireEvent.keyDown(window, { key: "1" });
    expect(onSelectOption).not.toHaveBeenCalled();
    // No option takes focus while paused.
    expect(buttons).not.toContain(document.activeElement);
  });
});

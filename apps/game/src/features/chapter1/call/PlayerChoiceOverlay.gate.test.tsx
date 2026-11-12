// PlayerChoiceOverlay reply gate tests (task 18.12). Requirements 5.9 and 8.3.
//
// While `waiting` is true the caller is still speaking: the options and the number keys are off,
// a listening status and one "Show replies now" button (with focus) are shown. When the wait ends
// focus moves to the first option. Without `waiting` nothing changes.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { selectDialogueView, type DialogueView } from "../../../game/narrative/selectors";
import type { CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import { PlayerChoiceOverlay } from "./PlayerChoiceOverlay";

const PHONE = { en: enPhone, vi: viPhone } as const;
const LOCALES: readonly GameLocale[] = ["en", "vi"];
const REGION = { left: 16, top: 400, width: 360, height: 300 };

const SCAM_OPEN: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
  { type: "ANSWER_CALL" },
];

function viewFor(scenario: ScenarioDefinition): DialogueView {
  let state = createInitialState(CHAPTER_1_SCENARIO);
  for (const action of SCAM_OPEN) {
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    expect(result.accepted).toBe(true);
    state = result.state;
  }
  const view = selectDialogueView(state, scenario);
  expect(view).not.toBeNull();
  return view!;
}

function overlayElement(
  view: DialogueView,
  props: { waiting?: boolean; onSelectOption?: (id: string) => void; onSkipWait?: () => void },
) {
  return (
    <PlayerChoiceOverlay
      view={view}
      narration={null}
      disabled={false}
      onSelectOption={props.onSelectOption ?? vi.fn()}
      region={REGION}
      waiting={props.waiting}
      onSkipWait={props.onSkipWait}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(LOCALES)("PlayerChoiceOverlay reply gate (%s)", (locale) => {
  const phone = PHONE[locale].phone.call;
  const scenario = getDisplayScenario(locale);

  it("hides the options and shows the listening status and one focused Skip button while waiting", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    expect(view.options.length).toBeGreaterThan(0);
    render(overlayElement(view, { waiting: true }));
    const overlay = screen.getByTestId("player-choice-overlay");

    for (const option of view.options) {
      expect(screen.queryByTestId(`dialogue-option-${option.id}`)).toBeNull();
    }
    expect(within(overlay).queryByRole("list")).toBeNull();
    expect(within(overlay).getByRole("status").textContent).toBe(phone.listening);

    const buttons = within(overlay).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe(phone.showReplies);
    expect(buttons[0].getAttribute("data-testid")).toBe("choice-skip-wait");
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("calls onSkipWait when the Skip button is activated", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSkipWait = vi.fn();
    const onSelectOption = vi.fn();
    render(overlayElement(view, { waiting: true, onSkipWait, onSelectOption }));

    fireEvent.click(screen.getByTestId("choice-skip-wait"));
    expect(onSkipWait).toHaveBeenCalledTimes(1);
    expect(onSelectOption).not.toHaveBeenCalled();
  });

  it("ignores number keys while waiting", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    render(overlayElement(view, { waiting: true, onSelectOption }));

    fireEvent.keyDown(window, { key: "1" });
    fireEvent.keyDown(window, { key: "2" });
    expect(onSelectOption).not.toHaveBeenCalled();
  });

  it("moves focus to the first option and re-enables number keys when the wait ends", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    const { rerender } = render(overlayElement(view, { waiting: true, onSelectOption }));
    expect(document.activeElement).toBe(screen.getByTestId("choice-skip-wait"));

    rerender(overlayElement(view, { waiting: false, onSelectOption }));

    expect(screen.queryByTestId("choice-skip-wait")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId(`dialogue-option-${view.options[0].id}`));

    fireEvent.keyDown(window, { key: "1" });
    expect(onSelectOption).toHaveBeenCalledTimes(1);
    expect(onSelectOption).toHaveBeenLastCalledWith(view.options[0].id);
  });

  it("behaves as before when waiting is absent", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    render(overlayElement(view, { onSelectOption }));
    const overlay = screen.getByTestId("player-choice-overlay");

    expect(within(overlay).queryByTestId("choice-waiting")).toBeNull();
    expect(within(overlay).queryByRole("status")).toBeNull();
    expect(within(overlay).getAllByRole("button")).toHaveLength(view.options.length);
    expect(document.activeElement).toBe(screen.getByTestId(`dialogue-option-${view.options[0].id}`));

    fireEvent.keyDown(window, { key: "1" });
    expect(onSelectOption).toHaveBeenCalledWith(view.options[0].id);
  });
});

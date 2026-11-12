// DialoguePanel voice props tests (task 18.13). Requirements 7.11 and 8.6.
//
// The optional `voice`, `waiting` and `onSkipWait` props add a Replay button, a notice line and a
// reply gate. The text card is always visible. Without the props the panel renders as before.
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
import { DialoguePanel, type DialoguePanelVoice } from "./DialoguePanel";

const PHONE = { en: enPhone, vi: viPhone } as const;
const LOCALES: readonly GameLocale[] = ["en", "vi"];

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

function voiceProps(overrides: Partial<DialoguePanelVoice> = {}): DialoguePanelVoice {
  return { replayEnabled: true, notice: "none", onReplay: vi.fn(), ...overrides };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(LOCALES)("DialoguePanel voice props (%s)", (locale) => {
  const call = PHONE[locale].phone.call;
  const scenario = getDisplayScenario(locale);

  it("calls the controller when Replay is activated and keeps focus on it", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const voice = voiceProps();
    render(<DialoguePanel view={view} onSelectOption={vi.fn()} voice={voice} autoFocus={false} />);

    const replay = screen.getByTestId("dialogue-replay");
    expect(replay.textContent).toBe(call.replay);
    replay.focus();
    fireEvent.click(replay);

    expect(voice.onReplay).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(replay);
  });

  it("disables Replay when replayEnabled is false", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const voice = voiceProps({ replayEnabled: false });
    render(<DialoguePanel view={view} onSelectOption={vi.fn()} voice={voice} />);

    const replay = screen.getByTestId("dialogue-replay") as HTMLButtonElement;
    expect(replay.disabled).toBe(true);
    fireEvent.click(replay);
    expect(voice.onReplay).not.toHaveBeenCalled();
  });

  it("shows the notice text for english-voice and no-audio, and nothing for none", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const { rerender } = render(
      <DialoguePanel view={view} onSelectOption={vi.fn()} voice={voiceProps({ notice: "none" })} />,
    );
    expect(screen.getByTestId("dialogue-notice").textContent).toBe("");

    rerender(
      <DialoguePanel
        view={view}
        onSelectOption={vi.fn()}
        voice={voiceProps({ notice: "english-voice" })}
      />,
    );
    expect(screen.getByTestId("dialogue-notice").textContent).toBe(call.notice.englishVoice);

    rerender(
      <DialoguePanel view={view} onSelectOption={vi.fn()} voice={voiceProps({ notice: "no-audio" })} />,
    );
    expect(screen.getByTestId("dialogue-notice").textContent).toBe(call.notice.noAudio);
  });

  it("always shows the text card, with and without voice and while waiting", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const { rerender } = render(<DialoguePanel view={view} onSelectOption={vi.fn()} />);
    expect(screen.getByTestId("dialogue-line").textContent).toContain(view.line);

    rerender(
      <DialoguePanel
        view={view}
        onSelectOption={vi.fn()}
        voice={voiceProps({ replayEnabled: false, notice: "no-audio" })}
      />,
    );
    expect(screen.getByTestId("dialogue-line").textContent).toContain(view.line);

    rerender(
      <DialoguePanel view={view} onSelectOption={vi.fn()} voice={voiceProps()} waiting />,
    );
    expect(screen.getByTestId("dialogue-line").textContent).toContain(view.line);
  });

  it("hides the options and ignores number keys while waiting, with focus on Skip", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    expect(view.options.length).toBeGreaterThan(0);
    const onSelectOption = vi.fn();
    const onSkipWait = vi.fn();
    render(
      <DialoguePanel view={view} onSelectOption={onSelectOption} onSkipWait={onSkipWait} waiting />,
    );

    for (const option of view.options) {
      expect(screen.queryByTestId(`dialogue-option-${option.id}`)).toBeNull();
    }
    const waitingBox = screen.getByTestId("dialogue-waiting");
    expect(within(waitingBox).getByRole("status").textContent).toBe(call.listening);
    const skip = screen.getByTestId("dialogue-skip-wait");
    expect(skip.textContent).toBe(call.showReplies);
    expect(document.activeElement).toBe(skip);

    fireEvent.keyDown(window, { key: "1" });
    expect(onSelectOption).not.toHaveBeenCalled();

    fireEvent.click(skip);
    expect(onSkipWait).toHaveBeenCalledTimes(1);
    expect(onSelectOption).not.toHaveBeenCalled();
  });

  it("moves focus to the first option when the wait ends and number keys work again", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    const { rerender } = render(
      <DialoguePanel view={view} onSelectOption={onSelectOption} waiting />,
    );
    expect(document.activeElement).toBe(screen.getByTestId("dialogue-skip-wait"));

    rerender(<DialoguePanel view={view} onSelectOption={onSelectOption} waiting={false} />);

    expect(screen.queryByTestId("dialogue-waiting")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId(`dialogue-option-${view.options[0].id}`));
    fireEvent.keyDown(window, { key: "1" });
    expect(onSelectOption).toHaveBeenCalledWith(view.options[0].id);
  });

  it("renders as before when no voice props are given", () => {
    applyLocale(locale);
    const view = viewFor(scenario);
    const onSelectOption = vi.fn();
    render(<DialoguePanel view={view} onSelectOption={onSelectOption} />);
    const panel = screen.getByTestId("dialogue-panel");

    expect(screen.queryByTestId("dialogue-replay")).toBeNull();
    expect(screen.queryByTestId("dialogue-notice")).toBeNull();
    expect(screen.queryByTestId("dialogue-waiting")).toBeNull();
    expect(within(panel).getAllByRole("button")).toHaveLength(view.options.length);
    expect(document.activeElement).toBe(screen.getByTestId(`dialogue-option-${view.options[0].id}`));

    fireEvent.keyDown(window, { key: "1" });
    expect(onSelectOption).toHaveBeenCalledWith(view.options[0].id);
  });
});

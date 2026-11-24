import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WritingMode, type WritingModeProps } from "./WritingMode";
import { sprintFor, SPRINT_IDS, type WritingDraft } from "./writingSprints";
import { DesktopNavProvider } from "../../desktopNav";

function setup(overrides: Partial<WritingModeProps> = {}) {
  const onCommit = vi.fn(() => true);
  const onKey = vi.fn();
  const onExit = vi.fn();
  const onDraft = vi.fn();
  let escape: (() => boolean) | null = null;
  const base: WritingModeProps = {
    sprintKey: "intro:Go on",
    sprintText: "Go on",
    sprintNumber: 1,
    sprintTotal: 6,
    sectionLabel: "Introduction",
    draft: null,
    onDraft,
    relaxed: false,
    onRelaxed: vi.fn(),
    commitTime: "1 h",
    onCommit,
    onKey,
    onExit,
    issue: null,
    incoming: null,
    ...overrides,
  };
  const view = render(
    <DesktopNavProvider value={{ openBrowser: vi.fn(), openApp: vi.fn(), setEscapeHandler: (handler) => (escape = handler) }}>
      <WritingMode {...base} />
    </DesktopNavProvider>,
  );
  const input = screen.getByTestId("writing-input") as HTMLTextAreaElement;
  const type = (text: string) => {
    for (const char of Array.from(text)) {
      input.value = char;
      fireEvent.input(input, { target: { value: char } });
    }
  };
  return { ...view, input, type, onCommit, onKey, onExit, onDraft, escape: () => escape?.(), rerenderWith: (next: Partial<WritingModeProps>) => view.rerender(<DesktopNavProvider value={{ openBrowser: vi.fn(), openApp: vi.fn(), setEscapeHandler: (handler) => (escape = handler) }}><WritingMode {...base} {...next} /></DesktopNavProvider>) };
}

describe("WritingMode", () => {
  it("shows wrong characters, fixes them with Backspace and plays a key for each", () => {
    const { input, type, onKey } = setup();
    type("Gx");
    expect(screen.getAllByTestId("writing-error")).toHaveLength(1);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryAllByTestId("writing-error")).toHaveLength(0);
    expect(onKey.mock.calls.map((call) => call[0])).toEqual(["key", "key", "backspace"]);
    type("o ");
    expect(onKey).toHaveBeenLastCalledWith("space");
    expect(screen.getByTestId("writing-progress").textContent).toBe("60%");
  });

  it("commits a complete sprint once, with Enter, and offers the next sprint", () => {
    const { input, type, onCommit } = setup({ issue: { label: "Citation triage", onOpen: vi.fn() } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
    type("Go on");
    expect(screen.getByTestId("writing-complete")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("writing-done")).toBeTruthy();
    expect(screen.getByTestId("writing-issue").textContent).toContain("Citation triage");
  });

  it("keeps the sprint and says so when the core rejects the commit", () => {
    const { type, onCommit } = setup({ onCommit: vi.fn(() => false) });
    type("Go on");
    fireEvent.click(screen.getByTestId("writing-commit"));
    expect(onCommit).toBeDefined();
    expect(screen.queryByTestId("writing-done")).toBeNull();
    expect(screen.getByTestId("writing-notice")).toBeTruthy();
  });

  it("blocks pasting, held keys and typing while paused", () => {
    const { input, type, onKey } = setup();
    fireEvent.paste(input);
    expect(screen.getByTestId("writing-notice")).toBeTruthy();
    expect(screen.getByTestId("writing-progress").textContent).toBe("0%");
    const repeat = fireEvent.keyDown(input, { key: "G", repeat: true });
    expect(repeat).toBe(false);
    fireEvent.click(screen.getByTestId("writing-pause"));
    type("Go");
    expect(screen.getByTestId("writing-progress").textContent).toBe("0%");
    expect(onKey).not.toHaveBeenCalled();
  });

  it("feeds an IME commit as one input and ignores the composition until then", () => {
    const { input } = setup({ sprintText: "Vit", sprintKey: "x:Vit" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "Vi" } });
    expect(screen.getByTestId("writing-progress").textContent).toBe("0%");
    fireEvent.compositionEnd(input, { data: "Vit" });
    expect(screen.getByTestId("writing-complete")).toBeTruthy();
  });

  it("restores a kept draft and leaves with Escape", () => {
    const first = setup();
    first.type("Go");
    const kept = first.onDraft.mock.calls.at(-1)?.[0] as WritingDraft;
    first.unmount();
    const second = setup({ draft: kept });
    expect(screen.getByTestId("writing-progress").textContent).toBe("40%");
    act(() => {
      expect(second.escape()).toBe(true);
    });
    expect(second.onExit).toHaveBeenCalled();
  });
});

describe("sprintFor", () => {
  it("follows the accepted work sessions and wraps around", () => {
    expect(sprintFor(0)).toEqual({ id: "intro", index: 0 });
    expect(sprintFor(2).id).toBe("literature");
    expect(sprintFor(SPRINT_IDS.length).id).toBe("intro");
    expect(sprintFor(-3).index).toBe(0);
  });
});

describe("WritingMode text and reward", () => {
  it("draws a Vietnamese sentence whole: no split diacritics, no extra spaces from the caret", () => {
    const text = "Nghiên cứu quốc tế ở trường.";
    setup({ sprintText: text, sprintKey: "vi:1" });
    expect(screen.getByTestId("writing-text").textContent).toBe(text);
    const { input } = { input: screen.getByTestId("writing-input") };
    for (const char of Array.from("Nghien cuu quoc")) fireEvent.input(input, { target: { value: char } });
    // The caret is a zero-width mark: the visible text is still exactly the sentence.
    expect(screen.getByTestId("writing-text").textContent).toBe(text);
    expect(screen.queryAllByTestId("writing-error")).toHaveLength(0);
    expect(screen.getByTestId("writing-caret").textContent).toBe("");
  });
  it("shows the reward before the sprint and the real change after it", () => {
    const view = setup({ gainPercent: 2, commitTime: "1 h", progress: 60, timeLeftMinutes: 600, formatTime: (m) => `${m} min` });
    expect(screen.getByTestId("writing-reward").textContent).toBe("+2% · 1 h");
    view.type("Go on");
    fireEvent.keyDown(view.input, { key: "Enter" });
    // The host re-renders with the core's new resources after the accepted commit.
    view.rerenderWith({ gainPercent: 2, commitTime: "1 h", progress: 62, timeLeftMinutes: 540, formatTime: (m) => `${m} min` });
    expect(screen.getByTestId("writing-result").textContent).toBe("+2% thesis · 60 min of work · now 62%");
  });
});
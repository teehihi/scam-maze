import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThesisWindow, type ThesisWindowProps } from "./ThesisWindow";
import type { ThesisWritingHost } from "./writing/WritingMode";
import type { ThesisTaskView } from "../../../../../game/narrative/world";

function host(overrides: Partial<ThesisWritingHost> = {}): ThesisWritingHost {
  return {
    active: false,
    setActive: vi.fn(),
    completedSessions: 0,
    draft: null,
    onDraft: vi.fn(),
    relaxed: true,
    onRelaxed: vi.fn(),
    onKey: vi.fn(),
    ...overrides,
  };
}

function props(overrides: Partial<ThesisWindowProps> = {}): ThesisWindowProps {
  return {
    progress: 40,
    sessionMinutes: 60,
    sessionPercent: 1,
    freeWorkMaxPercent: 90,
    timeLeftMinutes: 600,
    tasks: [],
    onWork: vi.fn(() => true),
    onTask: vi.fn(() => true),
    quality: "rough",
    ...overrides,
  };
}

describe("ThesisWindow writing mode", () => {
  it("starts the Writing Mode from the desk", () => {
    const writing = host();
    render(<ThesisWindow {...props({ writing })} />);
    fireEvent.click(screen.getByTestId("thesis-writing-start"));
    expect(writing.setActive).toHaveBeenCalledWith(true);
  });

  it("cannot start writing when free work is blocked", () => {
    render(<ThesisWindow {...props({ writing: host(), progress: 90 })} />);
    expect(screen.getByTestId("thesis-writing-start").hasAttribute("disabled")).toBe(true);
  });

  it("commits a typed sprint as one existing work session", () => {
    const onWork = vi.fn(() => true);
    render(<ThesisWindow {...props({ onWork, writing: host({ active: true }) })} />);
    const input = screen.getByTestId("writing-input");
    // Relaxed typing: any key types the next character of the sprint.
    for (let i = 0; i < 400 && !screen.queryByTestId("writing-complete"); i++) fireEvent.input(input, { target: { value: "a" } });
    fireEvent.click(screen.getByTestId("writing-commit"));
    expect(onWork).toHaveBeenCalledTimes(1);
    expect(onWork).toHaveBeenCalledWith(60);
    expect(screen.getByTestId("writing-done")).toBeTruthy();
  });
});

const DRAFT: ThesisTaskView = {
  id: "draft.final",
  label: "Type two sentences of your thesis",
  description: null,
  timeCostMinutes: 60,
  progressGain: 7,
  approaches: [],
  done: false,
  blocked: null,
};

/** Relaxed typing: any key types the next character, until the sentence is complete. */
function typeSentence() {
  const input = screen.getByTestId("writing-input");
  for (let i = 0; i < 400 && !screen.queryByTestId("writing-complete"); i++) fireEvent.input(input, { target: { value: "a" } });
}

describe("ThesisWindow draft: type two sentences", () => {
  it("offers the draft as one task and opens Writing Mode for it, without the free writing button", () => {
    const writing = host();
    render(<ThesisWindow {...props({ tasks: [DRAFT], writing })} />);
    expect(screen.getByTestId("thesis-draft").textContent).toContain("Type two sentences of your thesis");
    expect(screen.queryByTestId("thesis-writing-start")).toBeNull();
    fireEvent.click(screen.getByTestId("thesis-draft-start"));
    expect(writing.setActive).toHaveBeenCalledWith(true);
  });

  it("completes the draft task once, only after the second sentence, and never as free work", () => {
    const onTask = vi.fn(() => true);
    const onWork = vi.fn(() => true);
    render(<ThesisWindow {...props({ tasks: [DRAFT], onTask, onWork, writing: host({ active: true }) })} />);
    expect(screen.getByTestId("writing-mode").textContent).toContain("Sentence 1 of 2");
    typeSentence();
    fireEvent.click(screen.getByTestId("writing-commit"));
    // The first sentence moves straight on to the second: nothing reaches the core yet.
    expect(onTask).not.toHaveBeenCalled();
    expect(screen.queryByTestId("writing-done")).toBeNull();
    expect(screen.getByTestId("writing-mode").textContent).toContain("Sentence 2 of 2");
    typeSentence();
    fireEvent.click(screen.getByTestId("writing-commit"));
    expect(onTask).toHaveBeenCalledTimes(1);
    expect(onTask).toHaveBeenCalledWith("draft.final");
    expect(onWork).not.toHaveBeenCalled();
    expect(screen.getByTestId("writing-done")).toBeTruthy();
  });

  it("keeps the second sentence open when the core rejects the draft", () => {
    const onTask = vi.fn(() => false);
    render(<ThesisWindow {...props({ tasks: [DRAFT], onTask, writing: host({ active: true }) })} />);
    typeSentence();
    fireEvent.click(screen.getByTestId("writing-commit"));
    typeSentence();
    fireEvent.click(screen.getByTestId("writing-commit"));
    expect(onTask).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("writing-done")).toBeNull();
    expect(screen.getByTestId("writing-notice")).toBeTruthy();
    expect(screen.getByTestId("writing-mode").textContent).toContain("Sentence 2 of 2");
  });

  it("shows the draft as done once the core recorded it", () => {
    render(<ThesisWindow {...props({ tasks: [{ ...DRAFT, done: true, blocked: "done" }], writing: host() })} />);
    expect(screen.getByTestId("thesis-draft-done")).toBeTruthy();
    expect(screen.queryByTestId("thesis-draft-start")).toBeNull();
    expect(screen.getByTestId("thesis-writing-start")).toBeTruthy();
  });
});

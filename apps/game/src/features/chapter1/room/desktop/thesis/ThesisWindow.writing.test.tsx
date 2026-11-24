import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThesisWindow, type ThesisWindowProps } from "./ThesisWindow";
import type { ThesisWritingHost } from "./writing/WritingMode";

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

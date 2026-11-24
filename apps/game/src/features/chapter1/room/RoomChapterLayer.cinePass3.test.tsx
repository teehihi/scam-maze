// Cinematic UI pass 3 (screenshot fixes): Notes chip in the chip row, objective tracker hidden in
// investigation mode, evidence notice above the device surface, and the timed mouse hint.
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreAction } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import { DECLINE_ALEX } from "../../../test/chapterRuns";
import { mockReducedMotion, restoreMatchMedia } from "../../../test/loadingRuns";
import { CINE } from "../theme";
import { finishIntro, setupLayer } from "./testHarness";

const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const AFTER_DECLINE: CoreAction[] = [START, ...DECLINE_ALEX];

let lockElement: Element | null = null;
function setLock(element: Element | null) {
  lockElement = element;
  act(() => {
    document.dispatchEvent(new Event("pointerlockchange"));
  });
}

beforeEach(() => {
  lockElement = null;
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => lockElement });
  Object.defineProperty(document, "exitPointerLock", { configurable: true, value: () => undefined });
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  vi.useRealTimers();
  restoreMatchMedia();
  document.body.innerHTML = "";
  Reflect.deleteProperty(document, "pointerLockElement");
  Reflect.deleteProperty(document, "exitPointerLock");
});

describe("Notes chip", () => {
  it("is the last chip of the same row as Journal, Schedule and Hint, only while a call is active", () => {
    setupLayer({ restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    const row = screen.getByTestId("hud-chip-row");
    const notes = screen.getByTestId("room-call-notes");
    const chips = Array.from(row.querySelectorAll("button"));
    expect(chips).toHaveLength(4);
    expect(chips[3]).toBe(notes);
    expect(notes.parentElement).toBe(screen.getByTestId("hud-hints-chip").parentElement);
    // The row rises above the call presentation (z-40) so the chip is reachable.
    expect(Number((row as HTMLElement).style.zIndex)).toBeGreaterThan(40);
    // No separate floating tools group any more.
    expect(screen.queryByTestId("room-call-tools")).toBeNull();
  });

  it("is absent outside a call", () => {
    setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    expect(screen.queryByTestId("room-call-notes")).toBeNull();
    expect(screen.getByTestId("hud-chip-row").querySelectorAll("button")).toHaveLength(3);
  });
});

describe("objective tracker in investigation mode", () => {
  it("steps the full room HUD away while the laptop is open, then restores it on close", () => {
    const rig = setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    expect(screen.getByTestId("objective-tracker-slot")).toBeTruthy();
    expect(screen.getByTestId("hud-hints-chip")).toBeTruthy();
    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    expect(screen.getByTestId("room-chapter-layer").getAttribute("data-ui-mode")).toBe("investigation");
    expect(screen.queryByTestId("objective-tracker-slot")).toBeNull();
    expect(screen.queryByTestId("hud-hints-chip")).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => rig.bridge.onProp("laptop", "inspect-end"));
    expect(screen.getByTestId("objective-tracker-slot")).toBeTruthy();
    expect(screen.getByTestId("hud-hints-chip")).toBeTruthy();
  });

  it("is hidden while the journal is open", () => {
    setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    fireEvent.keyDown(window, { code: "KeyJ" });
    expect(screen.getByTestId("objective-tracker-slot").style.visibility).toBe("hidden");
  });
});

describe("evidence notice", () => {
  it("is above the device surface (z-index) and never takes clicks, and stays out of the tab order", () => {
    const rig = setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    act(() => rig.bridge.onProp("receipts", "interact"));
    const slot = screen.getByTestId("evidence-notice-slot");
    expect(slot.getAttribute("aria-hidden")).toBe("true");
    expect(slot.className).toContain("pointer-events-none");
    expect(Number(slot.style.zIndex)).toBe(CINE.toast.zIndex);
    // The laptop surface layer is z-40 (`ScreenSurface`).
    expect(CINE.toast.zIndex).toBeGreaterThan(40);
    expect(slot.querySelector("button, a, [tabindex]")).toBeNull();
  });
});

describe("mouse hint timer", () => {
  it("shows for a few seconds after the lock starts, then leaves, and shows again on the next lock", () => {
    setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    vi.useFakeTimers();
    setLock(document.body);
    expect(screen.getByTestId("room-mouse-hint")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(CINE.mouseHintMs - 10);
    });
    expect(screen.getByTestId("room-mouse-hint")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(10 + CINE.motion.baseMs + 5);
    });
    expect(screen.queryByTestId("room-mouse-hint")).toBeNull();

    setLock(null);
    setLock(document.body);
    expect(screen.getByTestId("room-mouse-hint")).toBeTruthy();
  });

  it("with reduced motion it just disappears at the end of the time", () => {
    mockReducedMotion(true);
    setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    vi.useFakeTimers();
    setLock(document.body);
    expect(screen.getByTestId("room-mouse-hint")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(CINE.mouseHintMs + 1);
    });
    expect(screen.queryByTestId("room-mouse-hint")).toBeNull();
  });
});

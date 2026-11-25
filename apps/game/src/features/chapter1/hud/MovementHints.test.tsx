import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../../i18n";
import enRoom from "../../../i18n/locales/en/chapter1/room";
import viRoom from "../../../i18n/locales/vi/chapter1/room";
import { CINE } from "../theme";
import { MovementHints } from "./MovementHints";

beforeEach(() => {
  window.sessionStorage.clear();
  applyLocale("en");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});


function setViewport(w: number, h: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
}

describe("MovementHints", () => {
  it("shows the move and look hints while active", () => {
    render(<MovementHints active />);
    const hints = screen.getByTestId("movement-hints");
    expect(hints.textContent).toContain(enRoom.room.hud.moveHint);
    expect(hints.textContent).toContain(enRoom.room.hud.lookHint);
  });

  it("has no box and sits at least 56 scaled px above the bottom edge (clear of the footer strip)", () => {
    render(<MovementHints active />);
    const hints = screen.getByTestId("movement-hints");
    expect(hints.style.background).toBe("");
    expect(hints.style.border).toBe("");
    expect(hints.style.backdropFilter).toBe("");
    const scale = parseFloat(hints.style.transform.replace("scale(", ""));
    expect(parseFloat(hints.style.bottom)).toBeGreaterThanOrEqual(56 * scale);
  });

  it("is scaled from its bottom-left corner with the shared HUD scale", () => {
    render(<MovementHints active />);
    const hints = screen.getByTestId("movement-hints");
    expect(hints.style.transform).toMatch(/^scale\(/);
    expect(hints.style.transformOrigin.split(" ").sort()).toEqual(["bottom", "left"]);
  });

  it("renders nothing when not active", () => {
    render(<MovementHints active={false} />);
    expect(screen.queryByTestId("movement-hints")).toBeNull();
  });

  it("fades out after the first movement key, then leaves the DOM and stays hidden", () => {
    const { unmount } = render(<MovementHints active />);
    fireEvent.keyDown(window, { code: "KeyW" });
    expect(screen.getByTestId("movement-hints").getAttribute("data-fading")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(CINE.motion.hintFadeMs + 5);
    });
    expect(screen.queryByTestId("movement-hints")).toBeNull();
    expect(window.sessionStorage.getItem(CINE.hintStorageKey)).toBe("1");
    unmount();
    render(<MovementHints active />);
    expect(screen.queryByTestId("movement-hints")).toBeNull();
  });

  it("ignores keys that are not movement keys", () => {
    render(<MovementHints active />);
    fireEvent.keyDown(window, { code: "KeyJ" });
    expect(screen.getByTestId("movement-hints").getAttribute("data-fading")).toBe("false");
  });

  it("fades after the mouse look only while the pointer is locked", () => {
    render(<MovementHints active />);
    fireEvent.mouseMove(window, { movementX: 5, movementY: 0 });
    expect(screen.getByTestId("movement-hints").getAttribute("data-fading")).toBe("false");
    Object.defineProperty(document, "pointerLockElement", { configurable: true, value: document.body });
    try {
      fireEvent.mouseMove(window, { movementX: 5, movementY: 2 });
      expect(screen.getByTestId("movement-hints").getAttribute("data-fading")).toBe("true");
    } finally {
      Object.defineProperty(document, "pointerLockElement", { configurable: true, value: null });
    }
  });

  it("has Vietnamese text for every hint key", () => {
    expect(viRoom.room.hud.moveHint.length).toBeGreaterThan(0);
    expect(viRoom.room.hud.lookHint.length).toBeGreaterThan(0);
    expect(viRoom.room.hud.controlsLabel.length).toBeGreaterThan(0);
  });
});

describe("MovementHints scale at a mocked viewport", () => {
  const saved = { w: window.innerWidth, h: window.innerHeight };
  afterEach(() => setViewport(saved.w, saved.h));

  it("applies the exact scale and scales the bottom offset with it, so it stays above the footer strip", () => {
    setViewport(1920, 1080);
    render(<MovementHints active />);
    const hints = screen.getByTestId("movement-hints");
    expect(hints.style.transform).toBe("scale(1.2)");
    expect(parseFloat(hints.style.bottom)).toBeCloseTo(CINE.hintsBottomPx * 1.2);
  });
});

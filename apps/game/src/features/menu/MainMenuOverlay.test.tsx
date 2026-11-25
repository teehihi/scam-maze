// Keyboard navigation of the main menu. Rendered in React.StrictMode like the app (main.tsx):
// StrictMode may call state updaters twice, which once made one ArrowDown move two items in
// development (found by the Playwright MCP gameplay QA flow).
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../app/settingsStorage";
import { MainMenuOverlay, type ContinueAvailability } from "./MainMenuOverlay";

function renderMenu(continueAvailability: ContinueAvailability) {
  const onHoverSound = vi.fn();
  render(
    <React.StrictMode>
      <MainMenuOverlay
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={() => {}}
        onHoverSound={onHoverSound}
        onStartNewGame={() => {}}
        onContinue={() => {}}
        continueAvailability={continueAvailability}
      />
    </React.StrictMode>,
  );
  const current = () => screen.getAllByRole("button").find((b) => b.getAttribute("aria-current") === "true")?.textContent;
  return { current, onHoverSound };
}

const NO_SAVE: ContinueAvailability = { available: false, reasonCode: "none", reason: "No saved game found." };

describe("MainMenuOverlay keyboard navigation", () => {
  it("moves exactly one enabled item per key press and skips a disabled CONTINUE", () => {
    const { current, onHoverSound } = renderMenu(NO_SAVE);
    expect(current()).toBe("NEW GAME");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(current()).toBe("SETTINGS");
    expect(document.activeElement?.textContent).toBe("SETTINGS");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(current()).toBe("CREDITS & LICENSES");

    // Wraps around, and W/S work like the arrows.
    fireEvent.keyDown(window, { key: "s", code: "KeyS" });
    expect(current()).toBe("NEW GAME");
    fireEvent.keyDown(window, { key: "w", code: "KeyW" });
    expect(current()).toBe("CREDITS & LICENSES");

    // One hover sound per real move, not two.
    expect(onHoverSound).toHaveBeenCalledTimes(4);
  });

  it("starts the new game on click, with no loader on the button", () => {
    const onStartNewGame = vi.fn();
    render(
      <MainMenuOverlay
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={() => {}}
        onStartNewGame={onStartNewGame}
        onContinue={() => {}}
        continueAvailability={NO_SAVE}
      />,
    );
    const button = screen.getByRole("button", { name: /NEW GAME/ });
    fireEvent.click(button);
    expect(onStartNewGame).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-busy")).toBeNull();
    expect(button.querySelector(".animate-spin")).toBeNull();
  });
  it("stops on CONTINUE when a save is available", () => {
    const { current } = renderMenu({ available: true });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(current()).toBe("CONTINUE");
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(current()).toBe("NEW GAME");
  });
});

describe("MainMenuOverlay scale", () => {
  it("lays the menu out in a virtual viewport scaled with the window", () => {
    renderMenu(NO_SAVE);
    const wrap = screen.getByTestId("main-menu-scale");
    expect(wrap.style.transform).toMatch(/^scale\(/);
    expect(wrap.style.transformOrigin.split(" ").sort()).toEqual(["left", "top"]);
  });
});

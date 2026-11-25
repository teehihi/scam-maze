// The Ctrl / Esc footer strip steps aside while a call or its replies own the screen: the host HUD
// marks the strip and the global stylesheet hides it when the Chapter 1 layer reports that mode.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PrologueHud, PrologueTopBar } from "./PrologueHud";

describe("PrologueHud footer hints", () => {
  it("marks the strip so the stylesheet can hide it", () => {
    render(<PrologueHud objective={null} prompt={null} showResume={false} cursorMode={false} />);
    expect(screen.getByTestId("hud-key-hints").hasAttribute("data-hud-footer-hints")).toBe(true);
  });

  it("has a rule that hides the strip in call and decision modes", () => {
    const css = readFileSync(resolve(import.meta.dirname, "../../styles/index.css"), "utf8");
    expect(css).toMatch(/\[data-ui-mode="call"\][^{]*\[data-ui-mode="decision"\][^{]*\[data-hud-footer-hints\]\s*\{\s*display:\s*none/);
  });

  it("scales the HUD blocks with the shared viewport scale, anchored to their edges", () => {
    const { container } = render(
      <>
        <PrologueTopBar soundEnabled onToggleSound={() => {}} onOpenSettings={() => {}} />
        <PrologueHud objective={null} prompt="Open" showResume cursorMode={false} clock={{ time: "10:00", detail: "Clear", raining: false }} />
      </>,
    );
    const transforms = Array.from(container.querySelectorAll<HTMLElement>("[style*='scale(']")).map((el) => el.style.transformOrigin.split(" ").sort().join(" "));
    expect(transforms).toEqual(expect.arrayContaining(["right top", "left top", "bottom center", "bottom left"]));
    expect(screen.getByTestId("resume-prompt").parentElement?.style.transform).toMatch(/^scale\(/);
  });

  describe("at a mocked 1920 x 1080 viewport (scale 1.2)", () => {
    const saved = { w: window.innerWidth, h: window.innerHeight };
    afterEach(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: saved.w });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: saved.h });
    });

    it("applies the exact scale and scales the prompt's bottom offset with it", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1920 });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 1080 });
      const { container } = render(<PrologueHud objective={null} prompt="Open" showResume cursorMode={false} />);
      const scaled = Array.from(container.querySelectorAll<HTMLElement>("[style*='scale(']"));
      expect(scaled.length).toBeGreaterThan(0);
      for (const el of scaled) expect(el.style.transform).toBe("scale(1.2)");
      const prompt = scaled.find((el) => el.style.bottom !== "");
      expect(parseFloat(prompt?.style.bottom ?? "0")).toBeCloseTo(96 * 1.2);
    });
  });
});

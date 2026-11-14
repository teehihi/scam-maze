import { describe, expect, it } from "vitest";
import { shouldPlayPrologue } from "./prologueGate";
import { homeCallClipPath } from "./homeCallClips";
import en from "../../i18n/locales/en/worlds/khupho";
import vi from "../../i18n/locales/vi/worlds/khupho";

describe("prologue gate", () => {
  it("plays for a new game and skips saved games", () => {
    expect(shouldPlayPrologue({ origin: "new-game" }, "")).toBe(true);
    expect(shouldPlayPrologue({ origin: "saved-game" }, "")).toBe(false);
  });

  it("can be skipped with ?skip-prologue", () => {
    expect(shouldPlayPrologue({ origin: "new-game" }, "?skip-prologue")).toBe(false);
    expect(shouldPlayPrologue({ origin: "new-game" }, "?skip-prologue=1&x=2")).toBe(false);
  });
});

describe("call-home narration", () => {
  it("names one clip per line and locale", () => {
    expect(homeCallClipPath("en", 0)).toBe("/audio/prologue/en/prologue_home1_en.mp3");
    expect(homeCallClipPath("vi", 2)).toBe("/audio/prologue/vi/prologue_home3_vi.mp3");
  });

  it("has the same three lines in both languages", () => {
    for (const key of ["l1", "l2", "l3"] as const) {
      expect(en.khupho.game.story[key].length).toBeGreaterThan(10);
      expect(vi.khupho.game.story[key].length).toBeGreaterThan(10);
    }
  });
});

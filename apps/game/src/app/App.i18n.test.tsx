import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale, i18n } from "../i18n";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from "./settingsStorage";

// App-level language tests (task 5.7; Requirements 2.3-2.5, 2.8, 2.9, 4.1-4.4, 4.6, 14.2-14.5,
// 14.8, 14.10). The 3D canvas and the heavy routes are stubs, as in `App.chapter.test.tsx`; the
// menu, the Settings modal and the i18n module are real. `main.tsx` is not rendered here, so a
// reload is simulated by resetting the locale to English, unmounting and rendering App again:
// App reads the stored settings and applies the locale in a layout effect.

const harness = vi.hoisted(() => ({ canvasMounts: 0, audioContexts: 0 }));

vi.mock("../game/core/GameCanvas", () => ({
  GameCanvas: () => {
    useEffect(() => {
      harness.canvasMounts += 1;
    }, []);
    return <div data-testid="menu-canvas" />;
  },
}));
vi.mock("../features/loading/MenuStartupLoading", () => ({ MenuStartupLoading: () => null }));
vi.mock("../features/loading/ChapterLoadingFlow", () => ({ ChapterLoadingFlow: () => null }));
vi.mock("../features/chapter1/ChapterOnePage", () => ({ ChapterOnePage: () => null }));
vi.mock("../features/testmove", () => ({ TestMovePage: () => null }));
vi.mock("../features/ueh", () => ({ UEHPage: () => null }));
vi.mock("../features/hue", () => ({ HuePage: () => null }));

import { App } from "./App";

/** Minimal Web Audio stand-in so the App's audio effect runs and its set-up can be counted. */
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  constructor() {
    harness.audioContexts += 1;
  }
  createGain() {
    const param = {
      setValueAtTime: () => {},
      setTargetAtTime: () => {},
      cancelScheduledValues: () => {},
      linearRampToValueAtTime: () => {},
    };
    return { gain: param, connect: () => {} };
  }
  createBufferSource() {
    return { connect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false };
  }
  decodeAudioData() {
    return new Promise(() => {});
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

const VI_MENU_LABELS = ["TRÒ CHƠI MỚI", "TIẾP TỤC", "CÀI ĐẶT", "GHI CÔNG & GIẤY PHÉP"];
const EN_MENU_LABELS = ["NEW GAME", "CONTINUE", "SETTINGS", "CREDITS"];

function storeSettings(value: unknown) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
}

function readStoredSettings(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null");
}

function menuButton(label: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(escapeRegExp(label)) });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expectMenuLabels(labels: string[]) {
  for (const label of labels) expect(menuButton(label)).toBeTruthy();
}

function openSettings(label: string): HTMLElement {
  fireEvent.click(menuButton(label));
  return screen.getByRole("dialog");
}

/** Simulates a page reload: fresh English i18n state, then a new App reading the stored settings. */
function reload(unmount: () => void) {
  unmount();
  act(() => applyLocale("en"));
  return render(<App />);
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  harness.canvasMounts = 0;
  harness.audioContexts = 0;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("fetch", () => new Promise(() => {}));
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("App language", () => {
  it("shows English on first start with empty storage", () => {
    render(<App />);

    expect(i18n.language).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getByRole("navigation", { name: "Game Main Menu" })).toBeTruthy();
    expectMenuLabels(EN_MENU_LABELS);
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("restores a stored vi language on start and after a remount", () => {
    storeSettings({ ...DEFAULT_SETTINGS, language: "vi" });
    const { unmount } = render(<App />);

    expect(i18n.language).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");
    expectMenuLabels(VI_MENU_LABELS);

    reload(unmount);
    expect(i18n.language).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");
    expectMenuLabels(VI_MENU_LABELS);
  });

  it.each([["fr"], [42], [null], ["VI"]])("uses English for the invalid stored language %j", (language) => {
    storeSettings({ ...DEFAULT_SETTINGS, language });
    render(<App />);

    expect(i18n.language).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expectMenuLabels(EN_MENU_LABELS);
  });

  it("switches the menu and the open Settings modal to Vietnamese without a reload, and persists it", () => {
    render(<App />);
    const dialog = openSettings("SETTINGS");
    expect(within(dialog).getByText("Display & Audio Settings")).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("true");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Tiếng Việt" }));

    expect(document.documentElement.lang).toBe("vi");
    // The same dialog element is still open and now shows Vietnamese.
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(within(dialog).getByText("Cài đặt hiển thị và âm thanh")).toBeTruthy();
    expect(within(dialog).getByRole("radiogroup", { name: "Ngôn ngữ" })).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: "Tiếng Việt" }).getAttribute("aria-checked")).toBe("true");
    expect(within(dialog).getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("navigation", { name: "Menu chính của trò chơi", hidden: true })).toBeTruthy();
    for (const label of VI_MENU_LABELS) {
      expect(screen.getByRole("button", { name: new RegExp(escapeRegExp(label)), hidden: true })).toBeTruthy();
    }
    expect(readStoredSettings().language).toBe("vi");

    // Back to English in the same session.
    fireEvent.click(within(dialog).getByRole("radio", { name: "English" }));
    expect(document.documentElement.lang).toBe("en");
    expect(within(dialog).getByText("Display & Audio Settings")).toBeTruthy();
    expect(readStoredSettings().language).toBe("en");
  });

  it("keeps every other settings field when the language changes", () => {
    const stored = {
      ...DEFAULT_SETTINGS,
      graphicsQuality: "high",
      soundEnabled: false,
      musicVolume: 0.35,
      sfxVolume: 0.6,
      fov: 80,
      language: "en",
    };
    storeSettings(stored);
    const { unmount } = render(<App />);
    const dialog = openSettings("SETTINGS");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Tiếng Việt" }));

    expect(readStoredSettings()).toEqual({ ...stored, language: "vi" });

    // The restored App keeps the same values after a reload.
    reload(unmount);
    expectMenuLabels(VI_MENU_LABELS);
    const reopened = openSettings("CÀI ĐẶT");
    expect(within(reopened).getByRole("slider", { name: "Góc nhìn (FOV)" })).toHaveProperty("value", "80");
    expect(within(reopened).getByText("ĐÃ TẮT")).toBeTruthy();
    expect(readStoredSettings()).toEqual({ ...stored, language: "vi" });
  });

  it("still switches the locale when writing the settings throws", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    render(<App />);
    const dialog = openSettings("SETTINGS");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Tiếng Việt" }));

    expect(setItem).toHaveBeenCalled();
    expect(i18n.language).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");
    expect(within(dialog).getByText("Cài đặt hiển thị và âm thanh")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it("does not remount the scene, reset the audio or leave the current screen on a language change", () => {
    render(<App />);
    expect(harness.canvasMounts).toBe(1);
    expect(harness.audioContexts).toBe(1);
    const canvas = screen.getByTestId("menu-canvas");
    const dialog = openSettings("SETTINGS");

    fireEvent.click(within(dialog).getByRole("radio", { name: "Tiếng Việt" }));
    fireEvent.click(within(dialog).getByRole("radio", { name: "English" }));

    expect(harness.canvasMounts).toBe(1);
    expect(harness.audioContexts).toBe(1);
    expect(screen.getByTestId("menu-canvas")).toBe(canvas);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(screen.getByRole("navigation", { name: "Game Main Menu", hidden: true })).toBeTruthy();
  });
});

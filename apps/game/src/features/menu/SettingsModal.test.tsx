import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameLocale, GameSettings } from "@scammaze/shared-types";
import { SettingsModal } from "./SettingsModal";
import { applyLocale } from "../../i18n";

/** Written out here so the test does not depend on the stored defaults. */
const BASE_SETTINGS: GameSettings = {
  graphicsQuality: "medium",
  soundEnabled: true,
  musicVolume: 0.75,
  sfxVolume: 0.75,
  fov: 72,
  language: "en",
};

function renderModal(language: GameLocale, onUpdateSettings = vi.fn()) {
  render(
    <SettingsModal
      isOpen
      onClose={() => {}}
      settings={{ ...BASE_SETTINGS, language }}
      onUpdateSettings={onUpdateSettings}
    />,
  );
  return onUpdateSettings;
}

/** Same update path as the App_Shell: merge the partial update, then apply the locale. */
function StatefulModal({ onUpdate }: { onUpdate: (next: GameSettings) => void }) {
  const [settings, setSettings] = useState<GameSettings>(BASE_SETTINGS);
  return (
    <SettingsModal
      isOpen
      onClose={() => {}}
      settings={settings}
      onUpdateSettings={(partial) => {
        const next = { ...settings, ...partial };
        setSettings(next);
        onUpdate(next);
        if (partial.language) applyLocale(partial.language);
      }}
    />
  );
}

/** Elements reachable with Tab, in document order (jsdom has no real Tab navigation). */
function tabbableElements(root: HTMLElement): HTMLElement[] {
  const candidates = root.querySelectorAll<HTMLElement>(
    "button, input, select, textarea, a[href], [tabindex]",
  );
  return [...candidates].filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex >= 0,
  );
}

describe("SettingsModal language selector", () => {
  it("renders two radios labeled English and Tiếng Việt in a named group", () => {
    renderModal("en");
    const group = screen.getByRole("radiogroup", { name: "Language" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["English", "Tiếng Việt"]);
    expect(radios.map((radio) => radio.getAttribute("lang"))).toEqual(["en", "vi"]);
  });

  it("aria-checked follows settings.language", () => {
    const modal = (language: GameLocale) => (
      <SettingsModal
        isOpen
        onClose={() => {}}
        settings={{ ...BASE_SETTINGS, language }}
        onUpdateSettings={() => {}}
      />
    );
    const { rerender } = render(modal("en"));
    expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "Tiếng Việt" }).getAttribute("aria-checked")).toBe(
      "false",
    );

    rerender(modal("vi"));
    expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("radio", { name: "Tiếng Việt" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("a click calls onUpdateSettings with only the language", () => {
    const onUpdateSettings = renderModal("en");
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    expect(onUpdateSettings).toHaveBeenCalledTimes(1);
    expect(onUpdateSettings).toHaveBeenCalledWith({ language: "vi" });
    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ language: "en" });
  });

  it("Enter and Space activate the options as native buttons", () => {
    const onUpdateSettings = renderModal("en");
    for (const name of ["English", "Tiếng Việt"]) {
      const radio = screen.getByRole("radio", { name });
      // Native <button type="button"> elements turn Enter and Space into a click in browsers.
      expect(radio.tagName).toBe("BUTTON");
      expect(radio.getAttribute("type")).toBe("button");
      radio.focus();
      expect(document.activeElement).toBe(radio);
      // No key handler cancels the default activation.
      expect(fireEvent.keyDown(radio, { key: "Enter", code: "Enter" })).toBe(true);
      expect(fireEvent.keyDown(radio, { key: " ", code: "Space" })).toBe(true);
      expect(fireEvent.keyUp(radio, { key: " ", code: "Space" })).toBe(true);
    }
    // jsdom does not synthesize the activation click, so dispatch it as the browser would.
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    expect(onUpdateSettings).toHaveBeenCalledWith({ language: "vi" });
    expect(onUpdateSettings.mock.calls.every(([partial]) => Object.keys(partial).join() === "language")).toBe(
      true,
    );
  });

  it("Tab reaches English then Tiếng Việt, before the other settings", () => {
    renderModal("en");
    const tabbable = tabbableElements(screen.getByRole("dialog"));
    const english = screen.getByRole("radio", { name: "English" });
    const vietnamese = screen.getByRole("radio", { name: "Tiếng Việt" });
    const englishIndex = tabbable.indexOf(english);
    const vietnameseIndex = tabbable.indexOf(vietnamese);
    expect(englishIndex).toBeGreaterThanOrEqual(0);
    expect(vietnameseIndex).toBe(englishIndex + 1);
    expect(tabbable.indexOf(screen.getByRole("button", { name: "Medium" }))).toBeGreaterThan(
      vietnameseIndex,
    );
  });

  it("localizes the group name and the volume percentage in vi", () => {
    applyLocale("vi");
    renderModal("vi");
    expect(screen.getByRole("radiogroup", { name: "Ngôn ngữ" })).toBeTruthy();
    const expectedPercent = new Intl.NumberFormat("vi", {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(BASE_SETTINGS.musicVolume);
    expect(screen.getByText(expectedPercent)).toBeTruthy();
    expect(screen.getByRole("slider", { name: "Âm lượng chung" })).toBeTruthy();
  });

  it("renders no flag image", () => {
    renderModal("en");
    const group = screen.getByRole("radiogroup", { name: "Language" });
    expect(within(group).queryAllByRole("img")).toHaveLength(0);
    expect(group.querySelectorAll("img, svg, picture")).toHaveLength(0);
    // No regional-indicator flag emoji either.
    expect(group.textContent ?? "").not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  it("switches the modal text immediately and leaves other settings unchanged", () => {
    const onUpdate = vi.fn<(next: GameSettings) => void>();
    render(<StatefulModal onUpdate={onUpdate} />);
    expect(screen.getByRole("heading", { name: "Display & Audio Settings" })).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));

    expect(screen.getByRole("heading", { name: "Cài đặt hiển thị và âm thanh" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Ngôn ngữ" })).toBeTruthy();
    expect(screen.getByText("Chất lượng đồ họa")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Tiếng Việt" }).getAttribute("aria-checked")).toBe("true");
    expect(document.documentElement.lang).toBe("vi");
    expect(onUpdate).toHaveBeenLastCalledWith({ ...BASE_SETTINGS, language: "vi" });

    fireEvent.click(screen.getByRole("radio", { name: "English" }));
    expect(screen.getByRole("heading", { name: "Display & Audio Settings" })).toBeTruthy();
    expect(onUpdate).toHaveBeenLastCalledWith(BASE_SETTINGS);
  });
});

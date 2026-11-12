import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  voiceVolume: 1,
  subtitlesEnabled: true,
  reducedStress: false,
  reducedMotion: "system",
  phoneVoiceFilter: true,
  englishVoiceFallback: false,
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


function renderWith(overrides: Partial<GameSettings>, onUpdateSettings = vi.fn()) {
  render(
    <SettingsModal
      isOpen
      onClose={() => {}}
      settings={{ ...BASE_SETTINGS, ...overrides }}
      onUpdateSettings={onUpdateSettings}
    />,
  );
  return onUpdateSettings;
}

const LABELS = {
  en: {
    heading: "Voice and comfort",
    volume: "Voice volume",
    captions: "Captions",
    phoneFilter: "Phone speaker effect",
    englishFallback: "Use the English voice when Vietnamese audio is missing",
    reducedStress: "Reduced-stress mode",
    motionHeading: "Reduce motion",
    motion: { system: "Follow the system", on: "On", off: "Off" },
  },
  vi: {
    heading: "Giọng nói và sự thoải mái",
    volume: "Âm lượng giọng nói",
    captions: "Phụ đề",
    phoneFilter: "Hiệu ứng loa điện thoại",
    englishFallback: "Dùng giọng tiếng Anh khi thiếu âm thanh tiếng Việt",
    reducedStress: "Chế độ giảm căng thẳng",
    motionHeading: "Giảm chuyển động",
    motion: { system: "Theo hệ thống", on: "Bật", off: "Tắt" },
  },
} as const;

describe("SettingsModal voice and comfort controls", () => {
  beforeEach(() => {
    applyLocale("en");
  });

  afterEach(() => {
    applyLocale("en");
  });

  for (const locale of ["en", "vi"] as const) {
    const labels = LABELS[locale];

    it(`renders every control with its ${locale} label`, () => {
      applyLocale(locale);
      renderModal(locale);
      expect(screen.getByText(labels.heading)).toBeTruthy();
      expect(screen.getByLabelText(labels.volume).getAttribute("type")).toBe("range");
      expect(screen.getByLabelText(labels.captions).getAttribute("type")).toBe("checkbox");
      expect(screen.getByLabelText(labels.phoneFilter).getAttribute("type")).toBe("checkbox");
      expect(screen.getByLabelText(labels.reducedStress).getAttribute("type")).toBe("checkbox");
      const group = screen.getByRole("group", { name: labels.motionHeading });
      const radios = within(group).getAllByRole("radio");
      expect(radios.map((radio) => radio.getAttribute("value"))).toEqual(["system", "on", "off"]);
      for (const radio of radios) {
        const value = radio.getAttribute("value") as "system" | "on" | "off";
        expect(within(group).getByRole("radio", { name: labels.motion[value] })).toBe(radio);
      }
    });

    it(`each ${locale} control calls onUpdateSettings with only its own field`, () => {
      applyLocale(locale);
      const onUpdateSettings = renderModal(locale);

      fireEvent.change(screen.getByLabelText(labels.volume), { target: { value: "0.5" } });
      expect(onUpdateSettings).toHaveBeenLastCalledWith({ voiceVolume: 0.5 });

      fireEvent.click(screen.getByLabelText(labels.captions));
      expect(onUpdateSettings).toHaveBeenLastCalledWith({ subtitlesEnabled: false });

      fireEvent.click(screen.getByLabelText(labels.phoneFilter));
      expect(onUpdateSettings).toHaveBeenLastCalledWith({ phoneVoiceFilter: false });

      fireEvent.click(screen.getByLabelText(labels.reducedStress));
      expect(onUpdateSettings).toHaveBeenLastCalledWith({ reducedStress: true });

      fireEvent.click(screen.getByRole("radio", { name: labels.motion.on }));
      expect(onUpdateSettings).toHaveBeenLastCalledWith({ reducedMotion: "on" });
      fireEvent.click(screen.getByRole("radio", { name: labels.motion.off }));
      expect(onUpdateSettings).toHaveBeenLastCalledWith({ reducedMotion: "off" });
    });
  }

  it("toggles write the opposite of the current value", () => {
    const onUpdateSettings = renderWith({
      subtitlesEnabled: false,
      phoneVoiceFilter: false,
      reducedStress: true,
    });
    fireEvent.click(screen.getByLabelText("Captions"));
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ subtitlesEnabled: true });
    fireEvent.click(screen.getByLabelText("Phone speaker effect"));
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ phoneVoiceFilter: true });
    fireEvent.click(screen.getByLabelText("Reduced-stress mode"));
    expect(onUpdateSettings).toHaveBeenLastCalledWith({ reducedStress: false });
  });

  it("shows the English voice fallback only in Vietnamese and writes only its field", () => {
    renderModal("en");
    expect(screen.queryByLabelText(LABELS.en.englishFallback)).toBeNull();
    cleanup();

    applyLocale("vi");
    const onUpdateSettings = renderModal("vi");
    const toggle = screen.getByLabelText(LABELS.vi.englishFallback) as HTMLInputElement;
    expect(toggle.type).toBe("checkbox");
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(onUpdateSettings).toHaveBeenCalledTimes(1);
    expect(onUpdateSettings).toHaveBeenCalledWith({ englishVoiceFallback: true });
  });

  it("shows the voice volume only when sound is on, with the percentage", () => {
    renderWith({ soundEnabled: true, voiceVolume: 0.5 });
    expect(screen.getByLabelText("Voice volume")).toBeTruthy();
    expect(screen.getByText(formatPercentForTest("en", 0.5))).toBeTruthy();
    cleanup();

    renderWith({ soundEnabled: false });
    expect(screen.queryByLabelText("Voice volume")).toBeNull();
    // The other comfort controls stay available while sound is off.
    expect(screen.getByLabelText("Captions")).toBeTruthy();
    expect(screen.getByLabelText("Reduced-stress mode")).toBeTruthy();
  });

  it("links the reduced-stress hint to its toggle", () => {
    renderModal("en");
    const toggle = screen.getByLabelText("Reduced-stress mode");
    const hint = document.getElementById(toggle.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toContain("Softer sounds");
  });

  it("the new controls are native, reachable with Tab, after the master volume", () => {
    applyLocale("vi");
    renderModal("vi");
    const tabbable = tabbableElements(screen.getByRole("dialog"));
    const master = screen.getByRole("slider", { name: "Âm lượng chung" });
    const controls = [
      screen.getByLabelText(LABELS.vi.volume),
      screen.getByLabelText(LABELS.vi.captions),
      screen.getByLabelText(LABELS.vi.phoneFilter),
      screen.getByLabelText(LABELS.vi.englishFallback),
      screen.getByLabelText(LABELS.vi.reducedStress),
    ];
    let previous = tabbable.indexOf(master);
    expect(previous).toBeGreaterThanOrEqual(0);
    for (const control of controls) {
      expect(["INPUT"]).toContain(control.tagName);
      const index = tabbable.indexOf(control);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });

  it("the reduced-motion radio group is native, named, and keyboard reachable", () => {
    renderWith({ reducedMotion: "off" });
    const group = screen.getByRole("group", { name: "Reduce motion" });
    expect(group.tagName).toBe("FIELDSET");
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    // One shared name makes the browser provide arrow-key movement inside the group.
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
    expect(radios.every((radio) => radio.type === "radio")).toBe(true);
    expect(radios.map((radio) => radio.checked)).toEqual([false, false, true]);
    const tabbable = tabbableElements(screen.getByRole("dialog"));
    for (const radio of radios) {
      expect(tabbable).toContain(radio);
      expect(radio.getAttribute("aria-hidden")).toBeNull();
      radio.focus();
      expect(document.activeElement).toBe(radio);
    }
  });

  it("the selected reduced-motion option follows settings and does not re-write itself", () => {
    const onUpdateSettings = renderWith({ reducedMotion: "on" });
    fireEvent.click(screen.getByRole("radio", { name: "On" }));
    expect(onUpdateSettings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Follow the system" }));
    expect(onUpdateSettings).toHaveBeenCalledTimes(1);
    expect(onUpdateSettings).toHaveBeenCalledWith({ reducedMotion: "system" });
  });

  it("changing the language in a stateful modal reveals the fallback and keeps other fields", () => {
    const onUpdate = vi.fn<(next: GameSettings) => void>();
    render(<StatefulModal onUpdate={onUpdate} />);
    expect(screen.queryByLabelText(LABELS.en.englishFallback)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Tiếng Việt" }));
    fireEvent.click(screen.getByLabelText(LABELS.vi.englishFallback));
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...BASE_SETTINGS,
      language: "vi",
      englishVoiceFallback: true,
    });
  });
});

function formatPercentForTest(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
}

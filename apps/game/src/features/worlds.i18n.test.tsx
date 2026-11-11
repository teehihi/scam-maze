import type { ReactElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyLocale } from "../i18n";
import type { GameLocale } from "../i18n/locales";
import { HCMOverlay } from "./hochiminh/HCMOverlay";
import { HCM_LANDMARKS, HCM_VIEW_PRESETS, type LandmarkInfo } from "./hochiminh/types";
import { HueHUD } from "./hue/components/HueHUD";
import { HUE_PLACE_NAMES } from "./hue/placeNames";
import { TestMoveOverlay } from "./testmove/TestMoveOverlay";
import { UEHOverlay, UEH_TRACK_TITLES } from "./ueh/UEHOverlay";

// The overlay and HUD components are plain DOM: they import no 3D canvas and no audio, so no
// mocks are needed. The setup file resets the locale to "en" after each test.

const noop = () => {};

const stats = {
  position: [1, 2, 3] as [number, number, number],
  speed: 4.5,
  isSprinting: true,
  isGrounded: true,
};

/** Renders the element in the given locale and returns the visible text, then unmounts it. */
function textIn(locale: GameLocale, element: ReactElement): string {
  applyLocale(locale);
  const { container } = render(element);
  const text = container.textContent ?? "";
  cleanup();
  return text;
}

function hcm(selectedLandmark: LandmarkInfo | null = null): ReactElement {
  return (
    <HCMOverlay
      theme="daylight"
      onChangeTheme={noop}
      autoRotate={false}
      onToggleAutoRotate={noop}
      showLandmarks
      onToggleLandmarks={noop}
      activeView={HCM_VIEW_PRESETS[0]}
      onSelectView={noop}
      selectedLandmark={selectedLandmark}
      onClearSelectedLandmark={noop}
      onBackToMenu={noop}
    />
  );
}

function hue(): ReactElement {
  return (
    <HueHUD
      isLocked={false}
      onToggleLock={noop}
      stats={stats}
      bellToast
      onBackToMenu={noop}
    />
  );
}

function testMove(): ReactElement {
  return <TestMoveOverlay isLocked={false} onToggleLock={noop} onBackToMenu={noop} stats={stats} />;
}

function ueh(): ReactElement {
  return (
    <UEHOverlay
      isLocked
      onToggleLock={noop}
      onBackToMenu={noop}
      isNearGuitar
      currentTrack="mua-ha"
      stats={stats}
    />
  );
}

describe("teammate world pages follow the locale", () => {
  it("HCMOverlay labels change with the locale", () => {
    const en = textIn("en", hcm());
    const vi = textIn("vi", hcm());

    expect(en).toContain("Game Menu");
    expect(en).toContain("Daylight");
    expect(en).toContain("Overview");
    expect(vi).toContain("Menu Game");
    expect(vi).toContain("Ban Ngày");
    expect(vi).toContain("Toàn Cảnh");
    expect(vi).not.toContain("Daylight");
    expect(en).not.toContain("Ban Ngày");
  });

  it("TestMoveOverlay labels change with the locale", () => {
    const en = textIn("en", testMove());
    const vi = textIn("vi", testMove());

    expect(en).toContain("Back to Main Menu");
    expect(en).toContain("3D Movement Test Mode");
    expect(en).toContain("Start Controls");
    expect(vi).toContain("Về Menu Chính");
    expect(vi).toContain("Chế độ Thử Nghiệm Di Chuyển 3D");
    expect(vi).toContain("Bắt đầu Điều Khiển");
    expect(vi).not.toContain("Back to Main Menu");
  });

  it("UEHOverlay labels change with the locale", () => {
    const en = textIn("en", ueh());
    const vi = textIn("vi", ueh());

    expect(en).toContain("Back to Main Menu");
    expect(en).toContain("Strum the Guitar");
    expect(en).toContain("CONTROLS:");
    expect(vi).toContain("Về Menu Chính");
    expect(vi).toContain("Gảy Đàn Guitar");
    expect(vi).toContain("PHÍM ĐIỀU KHIỂN:");
    expect(vi).not.toContain("CONTROLS:");
  });

  it("HueHUD labels change with the locale", () => {
    const en = textIn("en", hue());
    const vi = textIn("vi", hue());

    expect(en).toContain("Back to Main Menu");
    expect(en).toContain("Controls");
    expect(en).toContain("Speed:");
    expect(vi).toContain("Về Menu Chính");
    expect(vi).toContain("Phím điều khiển");
    expect(vi).toContain("Tốc độ:");
    expect(vi).not.toContain("Speed:");
  });

  it("a mounted overlay updates when the locale changes", () => {
    applyLocale("en");
    render(testMove());
    expect(screen.getByText("Back to Main Menu")).toBeTruthy();

    act(() => applyLocale("vi"));
    expect(screen.getByText("Về Menu Chính")).toBeTruthy();
    expect(screen.queryByText("Back to Main Menu")).toBeNull();
  });
});

describe("landmark and place names stay the same in every locale", () => {
  it("HCM landmark names and district names are identical in en and vi", () => {
    for (const landmark of HCM_LANDMARKS) {
      const en = textIn("en", hcm(landmark));
      const vi = textIn("vi", hcm(landmark));
      expect(en).toContain(landmark.name);
      expect(vi).toContain(landmark.name);
    }
    const districts = "Bến Nghé · Bến Thành · Thủ Thiêm · Sông Sài Gòn";
    expect(textIn("en", hcm())).toContain(districts);
    expect(textIn("vi", hcm())).toContain(districts);
  });

  it("Hue place names are identical in en and vi", () => {
    const en = textIn("en", hue());
    const vi = textIn("vi", hue());
    for (const key of ["cityUpper", "riverUpper", "bell", "river"] as const) {
      expect(en).toContain(HUE_PLACE_NAMES[key]);
      expect(vi).toContain(HUE_PLACE_NAMES[key]);
    }
  });

  it("UEH track titles are identical in en and vi", () => {
    const en = textIn("en", ueh());
    const vi = textIn("vi", ueh());
    const header = UEH_TRACK_TITLES["mua-ha"].toUpperCase();
    const next = UEH_TRACK_TITLES["ngay-mai"];
    expect(en).toContain(header);
    expect(vi).toContain(header);
    expect(en).toContain(next);
    expect(vi).toContain(next);
  });
});

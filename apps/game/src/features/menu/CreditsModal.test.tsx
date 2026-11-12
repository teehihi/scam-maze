import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { CreditsModal } from "./CreditsModal";
import { GAME_CREDITS } from "../../config/credits";
import { applyLocale, resources } from "../../i18n";

const LICENSE_NAMES = ["Creative Commons Attribution (CC-BY 4.0)", "MIT License"];

function renderCredits(locale: GameLocale) {
  applyLocale(locale);
  return render(<CreditsModal isOpen onClose={() => {}} />);
}

function headings(): string[] {
  return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
}

/** Text that must never be translated: asset names, creators, license names and source URLs. */
function untranslatedContent(container: HTMLElement) {
  const text = container.textContent ?? "";
  return {
    names: GAME_CREDITS.flatMap((g) => g.items.map((i) => text.includes(i.name))),
    creators: GAME_CREDITS.flatMap((g) => g.items.map((i) => text.includes(i.creator))),
    licenses: LICENSE_NAMES.map((name) => screen.getAllByText(name).length),
    hrefs: Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href")),
  };
}

describe("CreditsModal localization", () => {
  it("shows English category headings in en", () => {
    renderCredits("en");
    expect(headings()).toEqual(GAME_CREDITS.map((g) => resources.en.credits.groups[g.id].category));
    expect(headings()).toContain("3D World Environments & Architecture");
  });

  it("shows Vietnamese category headings in vi", () => {
    renderCredits("vi");
    expect(headings()).toEqual(GAME_CREDITS.map((g) => resources.vi.credits.groups[g.id].category));
    expect(headings()).toContain("Môi trường & kiến trúc thế giới 3D");
    for (const group of GAME_CREDITS) {
      expect(headings()).not.toContain(resources.en.credits.groups[group.id].category);
    }
  });

  it("keeps asset names, creators, license names and source URLs identical in en and vi", () => {
    const en = renderCredits("en");
    const enContent = untranslatedContent(en.container);
    en.unmount();

    const vi = renderCredits("vi");
    const viContent = untranslatedContent(vi.container);

    expect(enContent.names.every(Boolean)).toBe(true);
    expect(enContent.creators.every(Boolean)).toBe(true);
    expect(enContent.licenses.every((count) => count > 0)).toBe(true);
    expect(enContent.hrefs).toEqual(
      GAME_CREDITS.flatMap((g) =>
        g.items.filter((i) => i.sourceUrl.startsWith("https://")).map((i) => i.sourceUrl),
      ),
    );
    expect(viContent).toEqual(enContent);
  });

  it("links only https sources and shows every other source as plain text", () => {
    const { container } = renderCredits("en");
    const items = GAME_CREDITS.flatMap((g) => g.items);
    const plainSources = items.filter((i) => !i.sourceUrl.startsWith("https://"));
    expect(plainSources.map((i) => i.id)).toEqual(
      expect.arrayContaining(["menuStreetScene", "callPhone", "chapter1Voices"]),
    );
    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.getAttribute("href")).toMatch(/^https:\/\//);
    }
    for (const item of plainSources) {
      const node = screen.getByText(item.sourceUrl);
      expect(node.closest("a"), item.id).toBeNull();
      expect(node.parentElement?.textContent).toContain(resources.en.credits.sourceLabel);
    }
  });

  it("has a category key for every group id and a notes key for every item id in both locales", () => {
    for (const locale of ["en", "vi"] as const) {
      const dict = resources[locale].credits;
      for (const group of GAME_CREDITS) {
        expect(dict.groups[group.id]?.category, `${locale} groups.${group.id}`).toBeTruthy();
        for (const item of group.items) {
          expect(dict.items[item.id]?.notes, `${locale} items.${item.id}`).toBeTruthy();
        }
      }
    }
  });
});

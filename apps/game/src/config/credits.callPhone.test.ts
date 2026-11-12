import { describe, expect, it } from "vitest";
import { GAME_CREDITS } from "./credits";
import { resources } from "../i18n";

const callPhoneEntries = GAME_CREDITS.flatMap((group) =>
  group.items.filter((item) => item.id === "callPhone"),
);

describe("callPhone Asset_Credits entry", () => {
  it("exists exactly once", () => {
    expect(callPhoneEntries).toHaveLength(1);
  });

  it("names the optimized file and the candidate without a path", () => {
    const [entry] = callPhoneEntries;
    expect(entry.name).toBe("call-phone.optimized.glb");
    expect(entry.sourceUrl).toContain("iphone-17-pro.glb");
    expect(entry.sourceUrl).not.toContain("props/phone/");
  });

  it("states the creator as not stated and the license as the owner statement of 2026-11-12", () => {
    const [entry] = callPhoneEntries;
    expect(entry.creator).toBe("not stated");
    expect(entry.license).toContain("owner statement");
    expect(entry.license).toContain("2026-11-12");
  });

  it("has a notes key in en and vi without the words safe or an toàn", () => {
    for (const locale of ["en", "vi"] as const) {
      const notes = resources[locale].credits.items.callPhone?.notes;
      expect(notes, `${locale} items.callPhone.notes`).toBeTruthy();
      expect(notes).not.toMatch(/\bsafe/i);
      expect(notes?.toLowerCase()).not.toContain("an toàn");
    }
  });
});

describe("chapter1Voices Asset_Credits entry", () => {
  const audioGroups = GAME_CREDITS.filter((group) => group.id === "audio");
  const entries = GAME_CREDITS.flatMap((group) =>
    group.items.filter((item) => item.id === "chapter1Voices"),
  );

  it("exists exactly once, inside the audio group", () => {
    expect(audioGroups).toHaveLength(1);
    expect(entries).toHaveLength(1);
    expect(audioGroups[0].items.map((item) => item.id)).toContain("chapter1Voices");
  });

  it("names the generator script and states the terms of use as not verified", () => {
    const [entry] = entries;
    expect(entry.name).toBe("Chapter 1 voice clips");
    expect(entry.sourceUrl).toContain("generate-chapter1-voice");
    expect(entry.license).toContain("not verified");
  });

  it("has audio category and chapter1Voices notes keys in en and vi without the words safe or an toàn", () => {
    for (const locale of ["en", "vi"] as const) {
      const dict = resources[locale].credits;
      const notes = dict.items.chapter1Voices?.notes;
      expect(dict.groups.audio?.category, `${locale} groups.audio.category`).toBeTruthy();
      expect(notes, `${locale} items.chapter1Voices.notes`).toBeTruthy();
      expect(notes).not.toMatch(/\bsafe/i);
      expect(notes?.toLowerCase()).not.toContain("an toàn");
    }
  });
});

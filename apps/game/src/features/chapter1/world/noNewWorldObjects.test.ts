// No new interactable, 3D object or scene (gap G14 of chapter-01-voice-narrative). These checks
// need the chapter registry and the 3D prop layout, so they live outside `game/narrative`, whose
// boundary test forbids those imports.

import { describe, expect, it } from "vitest";

import { CHAPTERS } from "../../../game/chapters/chapterRegistry";
import { INTERACTABLE_IDS } from "../../../game/narrative/chapter1/ids";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import type { EvidenceItem } from "../../../game/narrative/types";
import { INTERACTABLE_LAYOUT } from "./propLayout";

const evidence = Object.values(CHAPTER_1_SCENARIO.evidence) as EvidenceItem[];

/** The five interactables that existed before this feature (baseline `8c93d27`). */
const BASELINE_INTERACTABLE_IDS = [
  "obj.mailbox",
  "obj.notice-board",
  "obj.shop-poster",
  "obj.shopkeeper",
  "obj.wallet",
];

describe("no new interactable or 3D object (gap G14)", () => {
  it("keeps exactly the five baseline interactables", () => {
    expect([...INTERACTABLE_IDS].sort()).toEqual(BASELINE_INTERACTABLE_IDS);
    expect(Object.keys(CHAPTER_1_SCENARIO.interactables).sort()).toEqual(BASELINE_INTERACTABLE_IDS);
  });

  it("places no extra prop in the 3D layout", () => {
    expect(Object.keys(INTERACTABLE_LAYOUT).sort()).toEqual(BASELINE_INTERACTABLE_IDS);
  });

  it("adds no scene beyond apartment and street", () => {
    const chapter = CHAPTERS.find((c) => c.id === "chapter-1");
    expect([...(chapter?.sceneIds ?? [])].sort()).toEqual(["apartment", "street"]);
  });

  it("uses only existing interactables for every evidence interaction", () => {
    for (const item of evidence) {
      if (item.discovery.via === "interact") {
        expect(INTERACTABLE_IDS as readonly string[]).toContain(item.discovery.objectId);
      }
    }
    // The four evidence items added by this feature use no interactable at all.
    for (const id of ["ev.transfer-check", "ev.second-number", "ev.case-sms", "ev.shifting-story"] as const) {
      expect(CHAPTER_1_SCENARIO.evidence[id].discovery.via).not.toBe("interact");
    }
  });
});

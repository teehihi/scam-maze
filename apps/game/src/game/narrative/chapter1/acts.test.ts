// Chapter 1 acts: structure checks on the act data. See design.md, "Acts".

import { describe, expect, it } from "vitest";

import { ACT_IDS } from "./ids";
import { CHAPTER_1_ACTS } from "./acts";
import { CHAPTER_1_SCENARIO } from "./scenario";

// The five interactables that existed before this feature (the street props and Sam).
const EXISTING_INTERACTABLES = [
  "obj.wallet",
  "obj.mailbox",
  "obj.shop-poster",
  "obj.shopkeeper",
  "obj.notice-board",
];

describe("Chapter 1 acts", () => {
  it("has six acts in order", () => {
    expect(CHAPTER_1_ACTS.map((a) => a.id)).toEqual([...ACT_IDS]);
    expect(CHAPTER_1_ACTS).toHaveLength(6);
    expect(CHAPTER_1_SCENARIO.acts).toBe(CHAPTER_1_ACTS);
  });

  it("each exitWhen equals the next act's enterWhen", () => {
    CHAPTER_1_ACTS.forEach((act, i) => {
      const next = CHAPTER_1_ACTS[i + 1];
      if (next) {
        expect(act.exitWhen, `${act.id} exitWhen`).toEqual(next.enterWhen);
      } else {
        expect(act.exitWhen).toEqual([]);
      }
    });
  });

  it("each objective belongs to exactly one act", () => {
    const seen = new Map<string, number>();
    for (const act of CHAPTER_1_ACTS) {
      for (const id of act.objectives) seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of Object.keys(CHAPTER_1_SCENARIO.objectives)) {
      expect(seen.get(id), `objective ${id}`).toBe(1);
    }
    for (const [id, count] of seen) {
      expect(count, `objective ${id}`).toBe(1);
      expect(CHAPTER_1_SCENARIO.objectives).toHaveProperty(id);
    }
  });

  it("Act 1 uses only the existing interactables", () => {
    const act1 = CHAPTER_1_ACTS[0];
    expect(act1.enterWhen).toEqual([]);
    expect(act1.objectives).toEqual(["obj.look-around"]);
    expect(Object.keys(CHAPTER_1_SCENARIO.interactables).sort()).toEqual(
      [...EXISTING_INTERACTABLES].sort(),
    );
  });
});

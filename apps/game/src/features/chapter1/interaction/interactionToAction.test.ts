import { describe, expect, it } from "vitest";
import { INTERACTABLE_IDS } from "../../../game/narrative/chapter1/ids";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { STREET_PLAY_BOUNDS } from "../../../game/scenes/MainMenuScene/streetPlayArea";
import { INTERACTABLE_LAYOUT } from "../world/propLayout";
import { interactionToAction } from "./interactionToAction";

describe("interactionToAction", () => {
  it.each([
    ["obj.wallet", { type: "INTERACT_OBJECT", objectId: "obj.wallet" }],
    ["obj.mailbox", { type: "INTERACT_OBJECT", objectId: "obj.mailbox" }],
    ["obj.shop-poster", { type: "INTERACT_OBJECT", objectId: "obj.shop-poster" }],
    ["obj.shopkeeper", { type: "TALK_TO_NPC", npcId: "npc.sam" }],
    ["obj.notice-board", { type: "INTERACT_OBJECT", objectId: "obj.notice-board" }],
  ] as const)("maps %s to its scenario action", (id, expected) => {
    expect(interactionToAction(id)).toEqual(expected);
  });

  it("returns null when nothing is focused", () => {
    expect(interactionToAction(null)).toBeNull();
  });

  it("produces an action the reducer accepts from a started chapter with no call", () => {
    const started = chapterReducer(createInitialState(), { type: "START_CHAPTER" });
    expect(started.accepted).toBe(true);
    expect(started.state.call.current).toBeNull();
    for (const id of INTERACTABLE_IDS) {
      const action = interactionToAction(id);
      expect(action).not.toBeNull();
      const result = chapterReducer(started.state, action!);
      expect(result.accepted, `${id}: ${result.reason ?? ""}`).toBe(true);
    }
  });
});

describe("INTERACTABLE_LAYOUT", () => {
  it("has a layout entry for every interactable id and no extra entries", () => {
    expect(Object.keys(INTERACTABLE_LAYOUT).sort()).toEqual([...INTERACTABLE_IDS].sort());
  });

  it("places every prop inside the street play bounds", () => {
    for (const id of INTERACTABLE_IDS) {
      const [x, y, z] = INTERACTABLE_LAYOUT[id].position;
      expect(x, id).toBeGreaterThanOrEqual(STREET_PLAY_BOUNDS.minX);
      expect(x, id).toBeLessThanOrEqual(STREET_PLAY_BOUNDS.maxX);
      expect(z, id).toBeGreaterThanOrEqual(STREET_PLAY_BOUNDS.minZ);
      expect(z, id).toBeLessThanOrEqual(STREET_PLAY_BOUNDS.maxZ);
      expect(y, id).toBeGreaterThanOrEqual(STREET_PLAY_BOUNDS.groundY);
    }
  });
});

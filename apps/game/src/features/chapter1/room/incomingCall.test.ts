import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../../../game/narrative/chapter1/lastSubmission";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import type { ChapterState, CoreAction } from "../../../game/narrative/types";
import { pendingIncomingCaller } from "./incomingCall";

const S = LAST_SUBMISSION_SCENARIO;
function run(actions: CoreAction[], from: ChapterState = createInitialState(S)): ChapterState {
  return actions.reduce((state, action) => chapterReducer(state, action, S).state, from);
}
const START: CoreAction = { type: "START_CHAPTER" };
const DRAFT: CoreAction = { type: "COMPLETE_THESIS_TASK", taskId: "draft.final" };

describe("pendingIncomingCaller", () => {
  it("is nobody before the draft, Minh after it, and nobody once he was answered or declined", () => {
    expect(pendingIncomingCaller(run([START]), S)).toBeNull();
    const after = run([START, DRAFT]);
    expect(pendingIncomingCaller(after, S)).toBe("contact.minh");
    expect(pendingIncomingCaller(run([{ type: "USE_DEVICE_ITEM", itemId: "contact.minh", actionId: "call" }], after), S)).toBeNull();
    expect(pendingIncomingCaller(run([{ type: "USE_DEVICE_ITEM", itemId: "contact.minh", actionId: "decline" }], after), S)).toBeNull();
  });

  it("never rings outside play", () => {
    const after = run([START, DRAFT]);
    expect(pendingIncomingCaller({ ...after, status: "ended" }, S)).toBeNull();
  });
});

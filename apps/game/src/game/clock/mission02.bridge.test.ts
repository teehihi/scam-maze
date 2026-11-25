// The bridge from Mission 01 to Mission 02: once the draft is done, Minh calls about the last interview.
// Answering, calling back later or declining all leave the same reminder, and nothing is forced.
import { describe, expect, it, vi } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { selectDeviceView, validateDeviceContent } from "../narrative/device";
import { LAST_SUBMISSION_NARRATIVE_VI } from "../../i18n/narrative/lastSubmission.vi";
import { narrativeTextEntries } from "../narrative/localize";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import type { ChapterState, CoreAction } from "../narrative/types";

// The test setup swaps this overlay for the parked story; this file checks the real one.
vi.mock("../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const S = LAST_SUBMISSION_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const DRAFT: CoreAction = { type: "COMPLETE_THESIS_TASK", taskId: "draft.final" };

function run(actions: CoreAction[], from: ChapterState = createInitialState(S)): ChapterState {
  return actions.reduce((state, action) => {
    const result = chapterReducer(state, action, S);
    expect(result.accepted, `${JSON.stringify(action)}: ${result.reason ?? ""}`).toBe(true);
    return result.state;
  }, from);
}
const arrived = (state: ChapterState, id: string) => Object.hasOwn(state.device.items, id);
/** Minh is still waiting for an answer: he arrived, and neither `call` nor `decline` was done. */
const ringing = (state: ChapterState) => arrived(state, "contact.minh") && !state.device.items["contact.minh"].done.some((id) => id === "call" || id === "decline");
const minh = (state: ChapterState) => selectDeviceView(state, S, "phone").apps.contacts.find((item) => item.id === "contact.minh");

describe("Minh's call after the draft", () => {
  it("is valid device content", () => {
    expect(validateDeviceContent(S)).toEqual([]);
  });

  it("does not exist before the draft is done, and calls once it is", () => {
    const before = run([START]);
    expect(arrived(before, "contact.minh")).toBe(false);
    expect(ringing(before)).toBe(false);
    const after = run([DRAFT], before);
    expect(arrived(after, "contact.minh")).toBe(true);
    expect(ringing(after)).toBe(true);
    // The draft itself is unchanged by the call: no time is spent until Alex picks up.
    expect(after.resources.timeMinutes).toBe(before.resources.timeMinutes - 60);
  });

  it("answering plays Minh's recorded reminder, then the Section 3.3 question, and leaves the note", () => {
    const answered = run([START, DRAFT, use("contact.minh", "call")]);
    expect(ringing(answered)).toBe(false);
    const view = minh(answered)!;
    expect(view.conversation.map((line) => line.voiceId)).toEqual(["m02.minh.setup"]);
    expect(view.conversation[0].text).toContain("11:30 tomorrow");
    // Decline is gone once the call was taken.
    expect(view.actions.map((action) => action.id)).toEqual(["call", "ask-section"]);
    const asked = run([use("contact.minh", "ask-section")], answered);
    expect(minh(asked)!.conversation.map((line) => line.voiceId)).toEqual(["m02.minh.setup", "m02.minh.minh_m02_coba.alex", "m02.minh.minh_m02_coba"]);
    expect(arrived(answered, "file.m02-section-3-3")).toBe(true);
    expect(arrived(answered, "msg.m02-minh-reminder")).toBe(false);
  });

  it("declining costs nothing, leaves Minh's message and the same note, and Alex can still call back", () => {
    const before = run([START, DRAFT]);
    const declined = run([use("contact.minh", "decline")], before);
    expect(ringing(declined)).toBe(false);
    expect(declined.resources.timeMinutes).toBe(before.resources.timeMinutes);
    expect(declined.resources.cash).toBe(before.resources.cash);
    expect(arrived(declined, "msg.m02-minh-reminder")).toBe(true);
    expect(arrived(declined, "file.m02-section-3-3")).toBe(true);
    const calledBack = run([use("contact.minh", "call")], declined);
    expect(minh(calledBack)!.conversation[0].voiceId).toBe("m02.minh.setup");
  });

  it("cannot be declined after it was answered", () => {
    const answered = run([START, DRAFT, use("contact.minh", "call")]);
    expect(chapterReducer(answered, use("contact.minh", "decline"), S).accepted).toBe(false);
  });

  it("has Vietnamese text for every new line", () => {
    const keys = narrativeTextEntries(S, {} as Parameters<typeof narrativeTextEntries>[1])
      .map(({ key }) => key)
      .filter((key) => /contact\.minh|m02-minh-reminder|m02-section-3-3/.test(key));
    expect(keys.length).toBeGreaterThan(8);
    for (const key of keys) expect(LAST_SUBMISSION_NARRATIVE_VI[key], key).toBeTruthy();
  });

  it("opens the reminder message without changing anything else", () => {
    const declined = run([START, DRAFT, use("contact.minh", "decline")]);
    const read = run([open("msg.m02-minh-reminder")], declined);
    expect(read.resources).toEqual(declined.resources);
  });
});

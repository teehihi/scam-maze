// From Mission 01 to Mission 02 in the room: the draft is saved (a small notice, no mission screen),
// then the phone rings, and Minh reminds Alex of the last interview. jsdom, fake engine commands.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";
import { INCOMING_RING_DELAY_MS, INCOMING_RING_TIMEOUT_MS } from "./useIncomingCall";

// Load the real routing instead of the suite-wide parked-story fixture (see `src/test/setup.ts`).
vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer() {
  const bridge = new RoomStoryBridge();
  const ring = vi.fn();
  bridge.commands = {
    setPhoneMode: vi.fn(),
    ring,
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
    setPhoneCarried: vi.fn(),
  } satisfies RoomStoryCommands;
  let store: ChapterStore | null = null;
  render(
    <RoomChapterLayer
      session={SESSION}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={SAVE_SOURCE}
      ringSettleMs={0}
      onOpenSettings={vi.fn()}
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  for (let i = 0; i < 12 && screen.queryByTestId("chapter-intro"); i += 1) fireEvent.click(screen.getByTestId("chapter-intro"));
  const get = () => {
    if (!store) throw new Error("store not ready");
    return store;
  };
  return { store: get, ring };
}
const finishDraft = (store: ChapterStore) => act(() => void store.dispatch({ type: "COMPLETE_THESIS_TASK", taskId: "draft.final" }));
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("Minh calls once the draft is done", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows a small saved notice first, never a mission screen, then rings and vibrates", () => {
    const rig = mountLayer();
    finishDraft(rig.store());
    expect(screen.getByTestId("progress-saved-notice").textContent).toContain("Draft saved · thesis 67%");
    expect(screen.queryByText(/mission complete/i)).toBeNull();
    expect(rig.ring).not.toHaveBeenCalledWith(true);
    wait(INCOMING_RING_DELAY_MS);
    expect(rig.ring).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId("incoming-call-notice").textContent).toContain("Minh is calling");
  });

  it("answering on the phone connects at once and plays Minh's line, and the ringing stops", () => {
    const rig = mountLayer();
    finishDraft(rig.store());
    wait(INCOMING_RING_DELAY_MS);
    fireEvent.click(screen.getByTestId("incoming-call-notice"));
    const phone = screen.getByTestId("held-phone");
    expect(within(phone).getByTestId("incoming-call-name").textContent).toBe("Minh");
    fireEvent.click(within(phone).getByTestId("incoming-call-accept"));
    expect(rig.ring).toHaveBeenLastCalledWith(false);
    wait(10);
    expect(rig.store().getState().device.items["contact.minh"].done).toContain("call");
    // Minh's reminder is in the call, and Alex can ask what Section 3.3 still needs.
    wait(4000);
    expect(within(phone).getByTestId("conversation-history").textContent).toContain("11:30 tomorrow");
    expect(within(phone).getByTestId("device-action-contact.minh-ask-section")).toBeTruthy();
    expect(screen.queryByTestId("incoming-call-notice")).toBeNull();
  });

  it("declining stops the ringing and leaves Minh's message", () => {
    const rig = mountLayer();
    finishDraft(rig.store());
    wait(INCOMING_RING_DELAY_MS);
    fireEvent.click(screen.getByTestId("incoming-call-notice"));
    fireEvent.click(within(screen.getByTestId("held-phone")).getByTestId("incoming-call-decline"));
    expect(rig.ring).toHaveBeenLastCalledWith(false);
    const state = rig.store().getState();
    expect(state.device.items["contact.minh"].done).toEqual(["decline"]);
    expect(Object.hasOwn(state.device.items, "msg.m02-minh-reminder")).toBe(true);
    expect(Object.hasOwn(state.device.items, "file.m02-section-3-3")).toBe(true);
  });

  it("a call nobody picks up becomes a missed call, changes nothing, and can be returned", () => {
    const rig = mountLayer();
    finishDraft(rig.store());
    wait(INCOMING_RING_DELAY_MS);
    expect(rig.ring).toHaveBeenLastCalledWith(true);
    wait(INCOMING_RING_TIMEOUT_MS);
    expect(rig.ring).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("missed-call-notice").textContent).toContain("Missed call from Minh");
    expect(rig.store().getState().device.items["contact.minh"].done).toEqual([]);
  });
});

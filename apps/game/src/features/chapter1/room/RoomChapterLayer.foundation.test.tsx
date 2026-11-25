// The chapter layer with the real "LAST SUBMISSION: 72 GIỜ CUỐI" routing (no parked story).
// jsdom, a fake commands object on a real RoomStoryBridge. No WebGL, no engine.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { CHAPTER_1_INITIAL_STATE } from "../../../game/narrative/resources";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

// Load the real routing instead of the suite-wide parked-story fixture (see `src/test/setup.ts`).
vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer(): { store: () => ChapterStore; bridge: RoomStoryBridge } {
  const bridge = new RoomStoryBridge();
  bridge.commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
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
  return {
    bridge,
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

function finishIntro() {
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) return;
    fireEvent.click(intro);
  }
  throw new Error("intro did not close");
}

describe("RoomChapterLayer with LAST SUBMISSION routing", () => {
  it("opens with the facts of the brief and does not start the parked story", () => {
    const rig = mountLayer();
    expect(rig.store().getState().status).toBe("not-started");
    expect(rig.store().getState().resources).toEqual(CHAPTER_1_INITIAL_STATE.resources);
    const intro = screen.getByTestId("chapter-intro");
    // The opening is cinematic: no paragraph and no goal text on screen. The facts stay in the HUD, the schedule and the journal.
    expect(within(intro).queryByText(/You are Alex, 23 years old/)).toBeNull();
    expect(within(intro).queryByText(/72 hours/i)).toBeNull();
    expect(screen.queryByTestId("chapter-intro-text")).toBeNull();
    expect(screen.queryByText(/bakery/i)).toBeNull();
  });

  it("starts the chapter on Begin and shows the HUD with the start values", () => {
    const rig = mountLayer();
    finishIntro();
    expect(rig.store().getState().status).toBe("playing");
    const cluster = screen.getByTestId("chapter-status-cluster");
    const time = within(cluster).getByTestId("resource-time").textContent;
    expect(time).toContain("17:00");
    expect(time).toContain("Tuesday");
    expect(time).toContain("72 h left to submit the thesis");
    expect(within(cluster).getByTestId("resource-thesis").textContent).toContain("60%");
    expect(within(cluster).getByTestId("resource-security").textContent).toContain("100%");
    expect(within(cluster).getByTestId("resource-support").textContent).toContain("50%");
    expect(within(cluster).getByTestId("resource-fatigue").textContent).toContain("20%");
    expect(within(screen.getByTestId("chapter-top-bar")).getByTestId("resource-cash").textContent).toContain("2,500,000 VND");
    // Evidence is not on the HUD (it will be inventory items).
    expect(screen.queryByTestId("resource-evidence")).toBeNull();
  });

  it("puts cash before settings and opens the task list from the task icon, which clears its mark", () => {
    mountLayer();
    finishIntro();
    const bar = screen.getByTestId("chapter-top-bar");
    const cash = within(bar).getByTestId("resource-cash");
    expect(cash.compareDocumentPosition(within(bar).getByTestId("hud-settings")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const task = within(screen.getByTestId("chapter-status-cluster")).getByRole("button", { name: "Tasks" });
    expect(screen.getByTestId("hud-task-new-mark")).toBeTruthy();
    fireEvent.click(task);
    const list = screen.getByTestId("task-list");
    expect(within(list).getByTestId("task-mission-m01.missing-access").textContent).toContain("THE MISSING ACCESS");
    expect(within(list).getByTestId("task-step-intro").getAttribute("data-state")).toBe("current");
    expect(screen.queryByTestId("hud-task-new-mark")).toBeNull();
    // T closes it again, and opens it.
    fireEvent.keyDown(window, { key: "t", code: "KeyT" });
    expect(screen.queryByTestId("task-list")).toBeNull();
    fireEvent.keyDown(window, { key: "t", code: "KeyT" });
    expect(screen.getByTestId("task-list")).toBeTruthy();
  });

  it("tracks the current step, marks it new and shows it complete when the thesis task is done", () => {
    const rig = mountLayer();
    finishIntro();
    const tracker = screen.getByTestId("task-tracker");
    expect(tracker.getAttribute("data-fresh")).toBe("true");
    expect(within(tracker).getByTestId("task-current").textContent).toBe("Edit the introduction and literature review");
    act(() => void rig.store().dispatch({ type: "COMPLETE_THESIS_TASK", taskId: "draft.intro-review" }));
    // The task took 90 minutes, so the email of 17:10 has arrived: reading it is the next step.
    expect(within(screen.getByTestId("task-tracker")).getByTestId("task-current").textContent).toBe("Read the new email about your submission account");
    expect(screen.getByTestId("task-step-done").textContent).toContain("Edit the introduction and literature review");
  });

  it("shows one task only, and tracks another task or a sub-task from the list", () => {
    const rig = mountLayer();
    finishIntro();
    expect(rig.store()).toBeTruthy();
    const tracker = screen.getByTestId("task-tracker");
    expect(screen.queryByTestId("task-others")).toBeNull();
    const firstStep = within(tracker).getByTestId("task-current").textContent;
    expect(firstStep).toBe("Edit the introduction and literature review");
    // Track a later sub-task of the same mission.
    fireEvent.click(screen.getByTestId("hud-task-button"));
    const list = screen.getByTestId("task-list");
    fireEvent.click(within(list).getByTestId("task-step-track-findings"));
    expect(within(screen.getByTestId("task-tracker")).getByTestId("task-current").textContent).toBe("Revise the findings section");
    expect(within(screen.getByTestId("task-list")).getByTestId("task-step-findings").getAttribute("data-state")).toBe("current");
    // Clicking the mission title tracks the mission again (its own current step).
    fireEvent.click(within(screen.getByTestId("task-list")).getByTestId("task-mission-pick-m01.missing-access"));
    expect(within(screen.getByTestId("task-tracker")).getByTestId("task-current").textContent).toBe(firstStep);
  });

  it("hides the room HUD over the laptop while marking the current task app on its desktop", () => {
    const rig = mountLayer();
    finishIntro();
    act(() => rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    expect(screen.queryByTestId("objective-tracker-slot")).toBeNull();
    expect(screen.getByTestId("desktop-icon-device-mail").getAttribute("data-task-target")).toBe("true");
    expect(screen.getByTestId("desktop-icon-thesis").getAttribute("data-task-target")).toBeNull();
    // The laptop retains its own device clock, without the room HUD crossing the title bar.
    expect(screen.getByTestId("desktop-clock")).toBeTruthy();
  });

  it("brings the carried phone up with P, low on the right, and puts it away with P", () => {
    const rig = mountLayer();
    finishIntro();
    expect(rig.bridge.commands?.setPhoneCarried).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId("held-phone")).toBeNull();
    fireEvent.keyDown(window, { key: "p", code: "KeyP" });
    const held = screen.getByTestId("held-phone");
    // No WebGL in the tests: the flat frame stands where the 3D phone would be.
    expect(held.getAttribute("data-held-mode")).toBe("fallback");
    expect(within(held).getByRole("dialog", { name: /Phone/ })).toBeTruthy();
    expect(screen.getByTestId("hud-phone-chip").getAttribute("aria-pressed")).toBe("true");
    // The HUD stays while the phone is up.
    expect(screen.getByTestId("objective-tracker-slot").style.visibility).toBe("visible");
    // No Close button on the held phone: P puts it away.
    expect(within(held).queryByTestId("phone-close")).toBeNull();
    fireEvent.click(within(held).getByTestId("phone-unlock"));
    expect(within(held).queryByTestId("phone-close")).toBeNull();
    fireEvent.keyDown(window, { key: "p", code: "KeyP" });
    expect(screen.queryByTestId("held-phone")).toBeNull();
  });

  it("brings the phone up over the open laptop with P, and putting it away leaves the laptop open", () => {
    const rig = mountLayer();
    finishIntro();
    act(() => rig.bridge.onProp("laptop", "inspect-ready"));
    expect(screen.getByTestId("desktop-icon-device-mail")).toBeTruthy();
    fireEvent.keyDown(window, { key: "p", code: "KeyP" });
    expect(screen.getByTestId("held-phone")).toBeTruthy();
    expect(screen.getByTestId("desktop-icon-device-mail")).toBeTruthy();
    expect(screen.queryByTestId("objective-tracker-slot")).toBeNull();
    const closes = vi.mocked(rig.bridge.commands!.closeInspect).mock.calls.length;
    fireEvent.keyDown(window, { key: "p", code: "KeyP" });
    expect(screen.queryByTestId("held-phone")).toBeNull();
    expect(screen.getByTestId("desktop-icon-device-mail")).toBeTruthy();
    expect(vi.mocked(rig.bridge.commands!.closeInspect).mock.calls.length).toBe(closes);
  });

  it("shows the task tracker in Vietnamese", () => {
    applyLocale("vi");
    mountLayer();
    finishIntro();
    expect(screen.getByTestId("task-current").textContent).toBe("Chỉnh sửa phần mở đầu và tổng quan tài liệu");
    expect(screen.getByTestId("task-where").textContent).toContain("Laptop · Khóa luận");
  });

  it("shows the HUD in Vietnamese", () => {
    applyLocale("vi");
    mountLayer();
    finishIntro();
    const time = screen.getByTestId("resource-time").textContent;
    expect(time).toContain("Thứ Ba");
    expect(time).toContain("Còn 72 giờ để nộp khóa luận");
    expect(screen.getByTestId("resource-cash").textContent).toContain("VNĐ");
  });
});

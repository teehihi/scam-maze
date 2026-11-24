// The chapter layer with a running world clock: time passes in free roam, events arrive on
// schedule, overlays pause the clock, and the schedule overlay answers events and works on the
// thesis. The content below is test content, not Mission 01.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async () => {
  const { FOUNDATION_SCENARIO } = await import("../../../game/narrative/chapter1/lastSubmission");
  return {
    ACTIVE_SCENARIO: {
      ...FOUNDATION_SCENARIO,
      // Fast clock for the test: one tick (5 simulated minutes) every 50 ms.
      gameplay: { clockRuns: true, tickMinutes: 5, msPerGameMinute: 10 },
      events: [
        {
          id: "test.offer",
          title: "A test offer",
          body: "Someone asks for help.",
          channel: "message",
          trigger: { atMinute: 20 },
          optional: true,
          responses: [
            { id: "help", label: "Help now", kind: "respond", timeCostMinutes: 30, effects: [{ kind: "setPersistent", flag: "minhTrustsAlex", value: true }] },
            { id: "later", label: "Answer later", kind: "postpone" },
            { id: "skip", label: "Ignore it", kind: "ignore" },
          ],
        },
      ],
      thesisTasks: [{ id: "test.task", label: "Finish a test task", timeCostMinutes: 30, progressGain: 5 }],
      missions: [
        {
          id: "test.deadline",
          title: "A test goal",
          optional: false,
          opensWhen: { atMinute: 0 },
          deadlineAtMinute: 600,
          completeWhen: [{ kind: "resourceAtLeast", resource: "thesisProgress", value: 100 }],
          paths: [{ id: "default", when: [], objective: "Finish the test goal" }],
        },
      ],
    },
  };
});

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer(props: { clockPaused?: boolean; soundEnabled?: boolean } = {}): { store: () => ChapterStore; rerender: (next: { clockPaused?: boolean }) => void } {
  const bridge = new RoomStoryBridge();
  bridge.commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
  let store: ChapterStore | null = null;
  const element = (clockPaused?: boolean) => (
    <RoomChapterLayer
      session={SESSION}
      settings={{ ...DEFAULT_SETTINGS, soundEnabled: props.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled }}
      bridge={bridge}
      saveSource={SAVE_SOURCE}
      ringSettleMs={0}
      clockPaused={clockPaused}
      onStoreReady={(s) => {
        store = s;
      }}
    />
  );
  const view = render(element(props.clockPaused));
  return {
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
    rerender: (next) => view.rerender(element(next.clockPaused)),
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

const timeLeft = (rig: { store: () => ChapterStore }) => rig.store().getState().resources.timeMinutes;

describe("RoomChapterLayer with a running world clock", () => {
  it("does not run the clock during the intro, then runs it in free roam", async () => {
    // Sound off: Alex's opening does not play, so the intro does not wait for it.
    const rig = mountLayer({ soundEnabled: false });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(timeLeft(rig)).toBe(72 * 60);
    finishIntro();
    await waitFor(() => expect(timeLeft(rig)).toBeLessThan(72 * 60), { timeout: 3000 });
  });

  it("brings the scheduled event on time, with a notice and a badge, and answers it from the schedule", async () => {
    const rig = mountLayer();
    finishIntro();
    await waitFor(() => expect(rig.store().getState().world.events["test.offer"]?.status).toBe("pending"), { timeout: 3000 });
    expect(await screen.findByTestId("event-arrival-notice")).toBeTruthy();
    expect(screen.getByTestId("hud-planner-chip").textContent).toContain("1");
    expect(screen.getByTestId("world-live-region").textContent).toContain("A test offer");

    fireEvent.click(screen.getByTestId("hud-planner-chip"));
    const planner = await screen.findByTestId("planner-overlay");
    const card = within(planner).getByTestId("planner-event-test.offer");
    expect(within(card).getByText("Someone asks for help.")).toBeTruthy();
    // Time cost is shown as a fact, no response is marked right or wrong.
    expect(within(card).getByText("Help now (30 min)")).toBeTruthy();
    expect(within(planner).getByTestId("planner-mission-test.deadline").textContent).toContain("Finish the test goal");

    // Postpone keeps it pending.
    fireEvent.click(within(card).getByTestId("planner-response-test.offer-later"));
    expect(rig.store().getState().world.events["test.offer"].status).toBe("pending");
    expect(rig.store().getState().world.events["test.offer"].postponed).toBe(1);
    fireEvent.click(within(planner).getByTestId("planner-response-test.offer-help"));
    expect(rig.store().getState().world.events["test.offer"].status).toBe("resolved");
    expect(within(planner).getByTestId("planner-no-events")).toBeTruthy();
  });

  it("pauses the clock while the schedule is open and while the host is paused", async () => {
    const rig = mountLayer();
    finishIntro();
    await waitFor(() => expect(timeLeft(rig)).toBeLessThan(72 * 60), { timeout: 3000 });
    fireEvent.click(screen.getByTestId("hud-planner-chip"));
    await screen.findByTestId("planner-overlay");
    const frozen = timeLeft(rig);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(timeLeft(rig)).toBe(frozen);

    fireEvent.click(within(screen.getByTestId("planner-overlay")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(timeLeft(rig)).toBeLessThan(frozen), { timeout: 3000 });
    rig.rerender({ clockPaused: true });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const paused = timeLeft(rig);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(timeLeft(rig)).toBe(paused);
  });

  it("opens the laptop draft from the schedule without granting thesis progress", async () => {
    const rig = mountLayer({ clockPaused: true });
    finishIntro();
    fireEvent.click(screen.getByTestId("hud-planner-chip"));
    const planner = await screen.findByTestId("planner-overlay");
    const before = rig.store().getState().resources;
    expect(within(planner).queryByTestId("thesis-work")).toBeNull();
    expect(within(planner).queryByTestId("thesis-task-test.task")).toBeNull();
    fireEvent.click(within(planner).getByTestId("thesis-open-document"));
    expect(screen.getByTestId("laptop-desktop")).toBeTruthy();
    expect(rig.store().getState().resources.thesisProgress).toBe(before.thesisProgress);
    expect(rig.store().getState().resources.timeMinutes).toBe(before.timeMinutes);
  });

  it("shows the simulated time of day on the shared game clock", async () => {
    const { gameClockText } = await import("../../../game/clock/gameClock");
    const rig = mountLayer({ clockPaused: true });
    finishIntro();
    expect(gameClockText()).toBe("17:00");
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 95 }));
    expect(gameClockText()).toBe("18:35");
  });

  it("opens the schedule with the K key", async () => {
    mountLayer();
    finishIntro();
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(await screen.findByTestId("planner-overlay")).toBeTruthy();
    fireEvent.keyDown(window, { code: "KeyK" });
    await waitFor(() => expect(screen.queryByTestId("planner-overlay")).toBeNull());
  });
});
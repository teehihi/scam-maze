import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../../../game/narrative/chapter1/lastSubmission";
import { DEFAULT_FATIGUE_CONFIG } from "../../../game/narrative/fatigue";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import {
  DESK_EVIDENCE_CARDS,
  getDisplayTargetPhrase,
  matchDeskKey,
  normalizeDeskChar,
  THESIS_DESK_STEPS,
} from "../../../game/narrative/thesisDeskGame";
import { DesktopNavProvider } from "../room/desktop/desktopNav";
import { OutsideHud, type OutsideWorldState } from "../room/useOutsideWorld";
import { resolveStoryNpcDialogue } from "../../../game/narrative/chapter1/storyCast";
import { ThesisPanel } from "./ThesisPanel";

describe("Mission 01 Playable Thesis Desk (Draft · Stamp · Proofread) & GTA-6 Street HUD", () => {
  it("supports accent-tolerant Vietnamese & English live keyboard matching", () => {
    expect(normalizeDeskChar("ể")).toBe("e");
    expect(normalizeDeskChar("đ")).toBe("d");
    expect(matchDeskKey("e", "ể")).toBe(true);
    expect(matchDeskKey("u", "ứ")).toBe(true);
    expect(matchDeskKey("d", "đ")).toBe(true);
    expect(matchDeskKey("x", "ể")).toBe(false);

    // Every deck step has valid cards/segments and non-empty localized copy
    for (const step of THESIS_DESK_STEPS) {
      expect(step.sectionTitle.vi.length).toBeGreaterThan(3);
      expect(step.wordsReward).toBeGreaterThan(100);
      if (step.kind === "type") {
        expect(getDisplayTargetPhrase(step, true).length).toBeGreaterThan(5);
        expect(getDisplayTargetPhrase(step, false).length).toBeGreaterThan(5);
      } else if (step.kind === "cite") {
        expect(DESK_EVIDENCE_CARDS[step.correctCardId]?.verified).toBe(true);
        expect(step.cardIds).toContain(step.correctCardId);
      } else {
        expect(step.segments.filter((s) => s.isError)).toHaveLength(1);
      }
    }
  });

  it("lets the player physically type a phrase on the Word page to advance straight into drag-and-drop citation stamping", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;
    const onWork = vi.fn();
    const onPreview = vi.fn();

    render(
      <DesktopNavProvider
        value={{ openApp: vi.fn(), openBrowser: vi.fn(), setEscapeHandler: vi.fn() }}
      >
        <ThesisPanel
          tone="paper"
          progress={state.resources.thesisProgress}
          sessionMinutes={60}
          sessionPercent={1}
          freeWorkMaxPercent={90}
          timeLeftMinutes={4000}
          tasks={[]}
          onWork={onWork}
          onTask={vi.fn()}
          deepWork={{
            state,
            scenario: LAST_SUBMISSION_SCENARIO,
            baseMinutesPerPercent: 60,
            fatigueConfig: { ...DEFAULT_FATIGUE_CONFIG, enabled: true },
            onPreviewMinutesOffset: onPreview,
          }}
        />
      </DesktopNavProvider>,
    );

    // Step 1 starts live immediately as Monkeytype typing challenge — zero waiting bar!
    expect(screen.getByTestId("desk-challenge-type")).toBeTruthy();

    // Type the target phrase letter by letter on the physical keyboard!
    const firstStep = THESIS_DESK_STEPS[0];
    if (firstStep.kind === "type") {
      const phrase = firstStep.targetPhrase.en;
      for (const ch of phrase) {
        fireEvent.keyDown(window, { key: ch });
      }
    }

    // Automatically transitioned right into Step 2 (Papers-Please Drag-and-Drop Citation Stamp)!
    expect(screen.getByTestId("desk-challenge-cite")).toBeTruthy();
    // Saigon sky clock preview advanced immediately with the completed typed phrase!
    expect(onPreview).toHaveBeenCalled();

    // Quick-commit button still works deterministically in test mode
    fireEvent.click(screen.getByTestId("thesis-work"));
    expect(onWork).toHaveBeenCalledTimes(1);
  });

  it("renders Rockstar-style lower-third Story NPC subtitle, ambient bark, and clickable RDR2 reply buttons in OutsideHud", () => {
    const onSelectReply = vi.fn();
    const onCloseDialogue = vi.fn();
    const turn = resolveStoryNpcDialogue("minh", {
      elapsedMinutes: 60,
      thesisProgress: 65,
      fatigue: 20,
      money: 3_500_000,
      flags: { minhTrustsAlex: true },
    });

    const barkState: OutsideWorldState = {
      ready: true,
      outdoors: true,
      prompt: "[E] Nói chuyện với Minh",
      zone: "Đường Lý Thái Tổ",
      storyDialogue: null,
      ambientBark: {
        npcId: "minh",
        speaker: turn.speaker,
        text: turn.ambientBark,
      },
      selectStoryReply: onSelectReply,
      closeStoryDialogue: onCloseDialogue,
    };

    const { rerender } = render(<OutsideHud state={barkState} />);
    expect(screen.getByTestId("outside-hud").textContent).toContain(turn.speaker.vi);

    const dialogueState: OutsideWorldState = {
      ...barkState,
      ambientBark: null,
      storyDialogue: {
        npcId: "minh",
        turn,
        currentText: turn.lines[0],
        currentMood: turn.mood,
        activeInsight: turn.hookNote ?? null,
        askedReplyIds: [],
        closing: false,
        lineKey: 1,
      },
    };

    rerender(<OutsideHud state={dialogueState} />);
    const replyButtons = screen.getAllByRole("button");
    expect(replyButtons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(replyButtons[0]);
    expect(onSelectReply).toHaveBeenCalledWith(0);
  });
});

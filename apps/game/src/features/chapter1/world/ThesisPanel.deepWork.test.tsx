import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LAST_SUBMISSION_SCENARIO } from "../../../game/narrative/chapter1/lastSubmission";
import { DEFAULT_FATIGUE_CONFIG } from "../../../game/narrative/fatigue";
import { chapterReducer, createInitialState } from "../../../game/narrative/reducer";
import { selectThesisView } from "../../../game/narrative/world";
import { OutsideHud, type OutsideWorldState } from "../room/useOutsideWorld";
import { resolveStoryNpcDialogue } from "../../../game/narrative/chapter1/storyCast";
import { applyLocale } from "../../../i18n";
import { ThesisPanel } from "./ThesisPanel";

afterEach(() => applyLocale("en"));

describe("Mission 01 thesis document editor", () => {
  it("presents Alex's manuscript, supervisor comments and source notes as a working document", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;

    render(
      <ThesisPanel
        tone="paper"
        progress={state.resources.thesisProgress}
        sessionMinutes={60}
        sessionPercent={1}
        freeWorkMaxPercent={90}
        timeLeftMinutes={4000}
        tasks={selectThesisView(state, LAST_SUBMISSION_SCENARIO).tasks}
        onWork={vi.fn()}
        onTask={vi.fn()}
        rest={{ napMinutes: 30, sleepMinutes: 360, onRest: vi.fn() }}
        deepWork={{
          state,
          scenario: LAST_SUBMISSION_SCENARIO,
          baseMinutesPerPercent: 60,
          fatigueConfig: { ...DEFAULT_FATIGUE_CONFIG, ...LAST_SUBMISSION_SCENARIO.gameplay?.fatigue },
        }}
      />,
    );

    expect(screen.getByTestId("thesis-document-editor")).toBeTruthy();
    expect(screen.getByTestId("thesis-supervisor-comment").textContent).toContain("The context is clear");
    expect(screen.getByTestId("thesis-research-notes").textContent).toContain("24 graduating students");
    expect(screen.getByTestId("thesis-progress").textContent).toContain("thesis-draft.docx");
    expect(screen.getByTestId("thesis-save-status").textContent).toBe("Saved");
    expect(screen.queryByText("On this device")).toBeNull();
    expect(screen.queryByTestId("rest-panel")).toBeNull();
    expect(screen.queryByText(/COMBO|WPM|Quick-Complete|Fake Source Trap/i)).toBeNull();
  });

  it("localizes anchored feedback and resolution controls in Vietnamese", () => {
    applyLocale("vi");
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;

    render(
      <ThesisPanel
        tone="paper"
        progress={state.resources.thesisProgress}
        sessionMinutes={60}
        sessionPercent={1}
        freeWorkMaxPercent={90}
        timeLeftMinutes={4000}
        tasks={selectThesisView(state, LAST_SUBMISSION_SCENARIO).tasks}
        onWork={vi.fn()}
        onTask={vi.fn()}
        deepWork={{
          state,
          scenario: LAST_SUBMISSION_SCENARIO,
          baseMinutesPerPercent: 60,
          fatigueConfig: { ...DEFAULT_FATIGUE_CONFIG, ...LAST_SUBMISSION_SCENARIO.gameplay?.fatigue },
        }}
      />,
    );

    expect(screen.getByTestId("thesis-supervisor-comment").textContent).toContain("Mở đầu · đoạn 2");
    expect(screen.getByTestId("thesis-supervisor-comment").textContent).toContain("Ít nghiên cứu chú ý");
    expect(screen.getByTestId("thesis-resolve-comment").textContent).toBe("Đánh dấu đã xử lý");
    expect(screen.getByTestId("thesis-research-notes").textContent).toContain("Bảng mã hóa phỏng vấn");
  });

  it("lets the player save any draft independently, then explicitly resolve the anchored comment", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;
    const onTask = vi.fn();
    const onWork = vi.fn();

    render(
      <ThesisPanel
        tone="paper"
        progress={state.resources.thesisProgress}
        sessionMinutes={60}
        sessionPercent={1}
        freeWorkMaxPercent={90}
        timeLeftMinutes={4000}
        tasks={selectThesisView(state, LAST_SUBMISSION_SCENARIO).tasks}
        onWork={onWork}
        onTask={onTask}
        deepWork={{
          state,
          scenario: LAST_SUBMISSION_SCENARIO,
          baseMinutesPerPercent: 60,
          fatigueConfig: { ...DEFAULT_FATIGUE_CONFIG, ...LAST_SUBMISSION_SCENARIO.gameplay?.fatigue },
        }}
      />,
    );

    const editor = screen.getByTestId("thesis-document-editor") as HTMLTextAreaElement;
    expect(screen.getByTestId("thesis-supervisor-comment").textContent).toContain("Introduction · paragraph 2");
    expect(screen.getByTestId("thesis-supervisor-comment").textContent).toContain("Less attention has been paid");
    expect(screen.getByTestId("thesis-resolve-comment").hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByTestId("thesis-jump-to-comment"));
    expect(editor.selectionStart).toBe(editor.value.indexOf("Less attention has been paid"));

    fireEvent.change(editor, { target: { value: `${editor.value} Unrelated change.` } });
    expect(screen.getByTestId("thesis-resolve-comment").hasAttribute("disabled")).toBe(true);

    // A very short edit inside the anchored paragraph is enough; no character-count threshold applies.
    fireEvent.change(editor, { target: { value: editor.value.replace("Less attention", "Less focus") } });
    expect(screen.getByTestId("thesis-save-status").textContent).toBe("Unsaved changes");
    expect(screen.getByTestId("thesis-save").hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("thesis-resolve-comment").hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByTestId("thesis-save"));
    expect(onTask).not.toHaveBeenCalled();
    expect(screen.getByText("Saved to thesis-draft.docx")).toBeTruthy();

    fireEvent.click(screen.getByTestId("thesis-resolve-comment"));
    expect(onTask).toHaveBeenCalledOnce();
    expect(onTask).toHaveBeenCalledWith("draft.intro-review", []);
    expect(onWork).not.toHaveBeenCalled();
  });

  it("requires the findings revision to cite interview evidence and qualify the sample", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;
    state = chapterReducer(state, { type: "COMPLETE_THESIS_TASK", taskId: "draft.intro-review" }, LAST_SUBMISSION_SCENARIO).state;
    const onTask = vi.fn();

    render(
      <ThesisPanel
        tone="paper"
        progress={state.resources.thesisProgress}
        sessionMinutes={60}
        sessionPercent={1}
        freeWorkMaxPercent={90}
        timeLeftMinutes={4000}
        tasks={selectThesisView(state, LAST_SUBMISSION_SCENARIO).tasks}
        onWork={vi.fn()}
        onTask={onTask}
        deepWork={{ state, scenario: LAST_SUBMISSION_SCENARIO, baseMinutesPerPercent: 60, fatigueConfig: { ...DEFAULT_FATIGUE_CONFIG, ...LAST_SUBMISSION_SCENARIO.gameplay?.fatigue } }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Findings/ }));
    const editor = screen.getByTestId("thesis-document-editor") as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: editor.value.replace("Across the interviews, students described", "Several participants described") } });
    expect(screen.getByTestId("thesis-resolve-comment").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("thesis-evidence-checklist").textContent).toContain("Cite at least one interview count");

    fireEvent.click(screen.getByTestId("thesis-synthesis-choice-saved-channel"));
    expect(screen.getByTestId("thesis-synthesis-preview").textContent).toContain("9 of 24 participants");
    fireEvent.click(screen.getByTestId("thesis-insert-synthesis"));
    expect(editor.value).toContain("This count describes these interviews, not all students.");
    expect(screen.getByTestId("thesis-evidence-checklist").textContent).toContain("✓ Cite at least one interview count");
    expect(screen.getByTestId("thesis-evidence-checklist").textContent).toContain("✓ State the limitation");
    expect(screen.getByTestId("thesis-resolve-comment").hasAttribute("disabled")).toBe(false);

    fireEvent.click(screen.getByTestId("thesis-resolve-comment"));
    expect(onTask).toHaveBeenCalledWith("draft.findings", ["saved-channel"]);
  });

  it("inserts interview material at the document caret as ordinary editing", () => {
    let state = createInitialState(LAST_SUBMISSION_SCENARIO);
    state = chapterReducer(state, { type: "START_CHAPTER" }, LAST_SUBMISSION_SCENARIO).state;
    render(
      <ThesisPanel
        tone="paper"
        progress={state.resources.thesisProgress}
        sessionMinutes={60}
        sessionPercent={1}
        freeWorkMaxPercent={90}
        timeLeftMinutes={4000}
        tasks={selectThesisView(state, LAST_SUBMISSION_SCENARIO).tasks}
        onWork={vi.fn()}
        onTask={vi.fn()}
        deepWork={{ state, scenario: LAST_SUBMISSION_SCENARIO, baseMinutesPerPercent: 60, fatigueConfig: { ...DEFAULT_FATIGUE_CONFIG, enabled: true } }}
      />,
    );
    const editor = screen.getByTestId("thesis-document-editor") as HTMLTextAreaElement;
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    fireEvent.click(screen.getAllByText("Insert into draft")[0]);
    expect(editor.value).toContain("9 of 24 participants described checking a saved portal");
  });
});

describe("GTA-6 Street HUD", () => {
  it("renders a lower-third Story NPC subtitle, ambient bark, and reply buttons in OutsideHud", () => {
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
      ambientBark: { npcId: "minh", speaker: turn.speaker, text: turn.ambientBark },
      selectStoryReply: onSelectReply,
      closeStoryDialogue: onCloseDialogue,
    };
    const { rerender } = render(<OutsideHud state={barkState} />);
    expect(screen.getByTestId("outside-hud").textContent).toContain(turn.speaker.vi);

    rerender(<OutsideHud state={{
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
    }} />);
    const replyButtons = screen.getAllByRole("button");
    expect(replyButtons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(replyButtons[0]);
    expect(onSelectReply).toHaveBeenCalledWith(0);
  });
});

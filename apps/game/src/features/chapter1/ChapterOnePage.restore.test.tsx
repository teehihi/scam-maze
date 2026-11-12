// Save-to-restore integration tests for the Chapter_Page (task 12.4). Requirements 15.12, 15.13
// and 18.6.
//
// The session is built the way the loader builds it: the scripted state is encoded with
// `encodeProgress` and replayed with `restoreProgress`. The 3D canvas is replaced by a stub that
// records its props (as in `ChapterOnePage.test.tsx`). Fake timers keep the Call_Trigger clock
// still, so no call rings on its own.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSettings } from "@scammaze/shared-types";
import { getChapter } from "../../game/chapters/chapterRegistry";
import { createNewChapterSession, type ChapterSession } from "../../game/chapters/chapterSession";
import { CHAPTER_1_SCENARIO } from "../../game/narrative/chapter1/scenario";
import { chapterReducer, createInitialState } from "../../game/narrative/reducer";
import type { ChapterState, CoreAction } from "../../game/narrative/types";
import { encodeProgress, restoreProgress } from "../../game/saves/chapterProgress";
import {
  SAVE_FORMAT_VERSION_V2,
  type SaveGameSource,
  type SaveReadResult,
  type SavedGameV2,
} from "../../game/saves/saveGame";
import type { ChapterOneCanvasProps } from "./ChapterOneCanvas";
import { ChapterOnePage } from "./ChapterOnePage";
import enHud from "../../i18n/locales/en/chapter1/hud";
import { INTRO_CONTINUE_EN, passIntro } from "../../test/chapterIntro";

const harness = vi.hoisted(() => ({ canvasProps: null as ChapterOneCanvasProps | null }));

vi.mock("./ChapterOneCanvas", () => ({
  ChapterOneCanvas: (props: ChapterOneCanvasProps) => {
    harness.canvasProps = props;
    return <div data-testid="canvas-stub" data-enabled={String(props.enabled)} />;
  },
}));

const SETTINGS: GameSettings = {
  graphicsQuality: "low",
  soundEnabled: false,
  musicVolume: 0,
  sfxVolume: 0,
  fov: 75,
  language: "en",
  voiceVolume: 1,
  subtitlesEnabled: true,
  reducedStress: false,
  reducedMotion: "system",
  phoneVoiceFilter: true,
  englishVoiceFallback: false,
};

const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

/** Card found, scam call answered and ended right away to verify. */
const AFTER_SCAM_CALL: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
  { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" },
  { type: "ANSWER_CALL" },
  option("opt.scam.open.verify"),
];
const ENDED: readonly CoreAction[] = [...AFTER_SCAM_CALL, { type: "MAKE_DECISION", decision: "stop-and-wait" }];
/** Saved while the scam call is active, on the opening node (game-3d-phone-call-ui task 10.6). */
const DURING_SCAM_CALL: readonly CoreAction[] = AFTER_SCAM_CALL.slice(0, 4);

// --- Pointer lock stub (jsdom has no Pointer Lock API) ---------------------------------------

let lockedElement: Element | null = null;

function setLocked(element: Element | null) {
  lockedElement = element;
  document.dispatchEvent(new Event("pointerlockchange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.canvasProps = null;
  lockedElement = null;
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => lockedElement });
  Object.defineProperty(document, "exitPointerLock", {
    configurable: true,
    writable: true,
    value: vi.fn(() => setLocked(null)),
  });
  Object.defineProperty(document.body, "requestPointerLock", {
    configurable: true,
    writable: true,
    value: vi.fn(() => setLocked(document.body)),
  });
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  // @ts-expect-error remove the test doubles so other suites see jsdom's defaults
  delete document.pointerLockElement;
  // @ts-expect-error see above
  delete document.exitPointerLock;
  // @ts-expect-error see above
  delete document.body.requestPointerLock;
});

// --- Helpers ---------------------------------------------------------------------------------

function play(actions: readonly CoreAction[]): ChapterState {
  let state = createInitialState();
  for (const action of actions) {
    const result = chapterReducer(state, action);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    state = result.state;
  }
  return state;
}

/** Builds a saved save and session from a scripted run, through encode and restore. */
function savedRun(actions: readonly CoreAction[]) {
  const chapter = getChapter("chapter-1");
  if (!chapter) throw new Error("chapter-1 is not registered");
  const scripted = play(actions);
  const progress = encodeProgress(scripted, { position: [0, 0, 0], yaw: 0 }, "obj.check-claims");
  if (!progress) throw new Error("encodeProgress returned null");
  const restored = restoreProgress(progress);
  if (!restored.ok) throw new Error(restored.reason);
  const session: ChapterSession = {
    ...createNewChapterSession(chapter),
    origin: "saved-game",
    progress,
    restored: { state: restored.state, pose: restored.pose },
  };
  const save: SavedGameV2 = {
    formatVersion: SAVE_FORMAT_VERSION_V2,
    chapterId: chapter.id,
    sceneId: chapter.startSceneId,
    savedAt: "2026-11-08T00:00:00.000Z",
    progress,
  };
  return { session, save, state: restored.state };
}

/** In-memory save source that starts with `initial`. */
function createMemorySaveSource(initial: SavedGameV2 | null) {
  let saved: SavedGameV2 | null = initial;
  return {
    read: vi.fn((): SaveReadResult => (saved ? { status: "valid", save: saved } : { status: "none" })),
    write: vi.fn((save: SavedGameV2) => {
      saved = save;
      return true;
    }),
    clear: vi.fn(() => {
      saved = null;
      return true;
    }),
  } satisfies SaveGameSource;
}

function renderPage(session: ChapterSession, saveSource: SaveGameSource) {
  render(<ChapterOnePage session={session} settings={SETTINGS} onReturnToMenu={vi.fn()} saveSource={saveSource} />);
}

function canvas(): ChapterOneCanvasProps {
  if (!harness.canvasProps) throw new Error("ChapterOneCanvas stub was not rendered");
  return harness.canvasProps;
}

function continueChapter() {
  act(() => canvas().onSceneReady?.());
  passIntro();
}

const pressKey = (init: KeyboardEventInit) => fireEvent.keyDown(window, init);

// --- Tests -----------------------------------------------------------------------------------

describe("ChapterOnePage restore", () => {
  it("restores the objectives and evidence from a saved Checkpoint and offers Continue", () => {
    const { session, save, state } = savedRun(AFTER_SCAM_CALL);
    const saveSource = createMemorySaveSource(save);
    renderPage(session, saveSource);

    // Resume mode: a short welcome-back text, no controls list, and the saved pose reaches the canvas.
    expect(screen.getByTestId("chapter-intro")).not.toBeNull();
    expect(screen.queryByText(enHud.intro.controls.heading)).toBeNull();
    expect(canvas().spawnPosition).toEqual(session.restored?.pose?.position);
    continueChapter();
    expect(screen.queryByTestId("chapter-intro")).toBeNull();
    // Mounting from a restored Checkpoint does not write again.
    expect(saveSource.write).not.toHaveBeenCalled();

    const tracker = screen.getByRole("region", { name: "Objectives" });
    expect(state.objectives.active.length).toBeGreaterThan(0);
    for (const id of state.objectives.active) {
      expect(within(tracker).getByText(CHAPTER_1_SCENARIO.objectives[id].text)).not.toBeNull();
    }

    pressKey({ key: "j", code: "KeyJ" });
    const journal = screen.getByRole("dialog", { name: "Journal" });
    expect(state.discovered).toContain("ev.bank-card");
    for (const id of state.discovered) {
      expect(within(journal).getAllByText(CHAPTER_1_SCENARIO.evidence[id].title).length).toBeGreaterThan(0);
    }
  });

  it("shows the ending for a restored ended chapter, and Continue writes the debrief Checkpoint", () => {
    const { session, save } = savedRun(ENDED);
    const saveSource = createMemorySaveSource(save);
    renderPage(session, saveSource);

    expect(screen.getByTestId("ending-transition").getAttribute("data-outcome")).toBe(
      play(ENDED).outcome,
    );
    expect(screen.queryByRole("heading", { name: CHAPTER_1_SCENARIO.title })).toBeNull();

    fireEvent.click(within(screen.getByTestId("ending-transition")).getByRole("button", { name: "Continue" }));
    expect(saveSource.write).toHaveBeenCalledTimes(1);
    expect(saveSource.write.mock.calls[0][0].progress.checkpointId).toBe("debrief");
  });

  it("opens the call presentation for a restored active call after the title card", () => {
    const { session, save, state } = savedRun(DURING_SCAM_CALL);
    expect(state.call.status).toBe("active");
    renderPage(session, createMemorySaveSource(save));

    // Nothing opens behind the title card.
    expect(screen.queryByTestId("call-presentation")).toBeNull();
    continueChapter();

    // The locked call presentation opens on its own, without the 2D phone.
    const call = screen.getByRole("dialog", { name: "Phone call" });
    expect(call).toBe(screen.getByTestId("call-presentation"));
    expect(call.getAttribute("aria-modal")).toBe("true");
    expect(screen.getAllByRole("dialog")).toEqual([call]);
    expect(screen.queryByRole("dialog", { name: "Phone" })).toBeNull();
    expect(within(call).getByTestId("call-screen")).not.toBeNull();
    expect(canvas().enabled).toBe(false);

    // Focus is on the first choice of the restored node; Escape leaves the call open.
    const options = within(call).getAllByRole("button").filter((button) => button.closest("ol"));
    expect(options.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(options[0]);
    pressKey({ key: "Escape", code: "Escape" });
    expect(screen.getByRole("dialog", { name: "Phone call" })).toBe(call);
    expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
  });

  it("Restart from the pause menu clears the save and returns to Begin", () => {
    const { session, save } = savedRun(AFTER_SCAM_CALL);
    const saveSource = createMemorySaveSource(save);
    renderPage(session, saveSource);
    continueChapter();

    pressKey({ key: "Escape", code: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Restart chapter" }));
    expect(saveSource.clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));

    expect(saveSource.clear).toHaveBeenCalledTimes(1);
    expect(saveSource.read()).toEqual({ status: "none" });
    expect(screen.queryByRole("dialog", { name: "Paused" })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: INTRO_CONTINUE_EN }).disabled).toBe(true);
    expect(canvas().spawnPosition).toBeUndefined();
    // The restart itself writes nothing: the next Checkpoint comes after Begin.
    expect(saveSource.write).not.toHaveBeenCalled();
  });
});

// Integration tests for the Chapter_Page (task 8.6). Requirements 1.5, 1.6, 3.4, 3.5, 3.6, 4.1,
// 4.4, 4.6, 4.7, 4.8, 4.9 and 18.6.
//
// The 3D canvas is replaced by a stub that records its props, so the tests can report scene
// readiness, focus and interaction the way the real canvas does. The chapter store is wrapped
// so every dispatch can be counted. Fake timers keep the Call_Trigger clock and the HUD toasts
// under test control.
//
// The phone and journal overlays are still placeholders. Tasks 9 and 10 replace them; the
// assertions below only use the dialog names "Phone" and "Journal", so they keep working as long
// as the new overlays are dialogs with those accessible names.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { GameSettings } from "@scammaze/shared-types";
import { getChapter } from "../../game/chapters/chapterRegistry";
import { createNewChapterSession } from "../../game/chapters/chapterSession";
import { CHAPTER_1_INTERACTABLES } from "../../game/narrative/chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../../game/narrative/chapter1/scenario";
import type { ChapterStore } from "../../game/narrative/store";
import type { CoreAction } from "../../game/narrative/types";
import type { SaveGameSource, SaveReadResult, SavedGameV2 } from "../../game/saves/saveGame";
import type { ChapterOneCanvasProps } from "./ChapterOneCanvas";
import { ChapterOnePage } from "./ChapterOnePage";

const harness = vi.hoisted(() => ({
  canvasProps: null as ChapterOneCanvasProps | null,
  stores: [] as Array<ChapterStore & { dispatch: Mock<ChapterStore["dispatch"]> }>,
}));

vi.mock("./ChapterOneCanvas", () => ({
  ChapterOneCanvas: (props: ChapterOneCanvasProps) => {
    harness.canvasProps = props;
    return <div data-testid="canvas-stub" data-enabled={String(props.enabled)} />;
  },
}));

vi.mock("../../game/narrative/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../game/narrative/store")>();
  return {
    ...original,
    createChapterStore: (...args: Parameters<typeof original.createChapterStore>) => {
      const store = original.createChapterStore(...args);
      const wrapped = { ...store, dispatch: vi.fn(store.dispatch) };
      harness.stores.push(wrapped);
      return wrapped;
    },
  };
});

const SETTINGS: GameSettings = {
  graphicsQuality: "low",
  soundEnabled: false,
  musicVolume: 0,
  sfxVolume: 0,
  fov: 75,
};

const WALLET = CHAPTER_1_INTERACTABLES["obj.wallet"];
const BANK_CARD = CHAPTER_1_SCENARIO.evidence["ev.bank-card"];
const FIRST_OBJECTIVE = CHAPTER_1_SCENARIO.objectives["obj.look-around"].text;

// --- Pointer lock stub (jsdom has no Pointer Lock API) ---------------------------------------

let lockedElement: Element | null = null;

function setLocked(element: Element | null) {
  lockedElement = element;
  document.dispatchEvent(new Event("pointerlockchange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.canvasProps = null;
  harness.stores.length = 0;
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

function canvas(): ChapterOneCanvasProps {
  if (!harness.canvasProps) throw new Error("ChapterOneCanvas stub was not rendered");
  return harness.canvasProps;
}

function store() {
  const latest = harness.stores[harness.stores.length - 1];
  if (!latest) throw new Error("No chapter store was created");
  return latest;
}

function dispatched(type: CoreAction["type"]): CoreAction[] {
  return store()
    .dispatch.mock.calls.map(([action]) => action)
    .filter((action) => action.type === type);
}

/** In-memory save source; `writable = false` makes every write fail like blocked storage. */
function createMemorySaveSource(writable = true) {
  let saved: SavedGameV2 | null = null;
  return {
    read: vi.fn((): SaveReadResult => (saved ? { status: "valid", save: saved } : { status: "none" })),
    write: vi.fn((save: SavedGameV2) => {
      if (!writable) return false;
      saved = save;
      return true;
    }),
    clear: vi.fn(() => {
      saved = null;
      return true;
    }),
  } satisfies SaveGameSource;
}

/** Without a `saveSource`, the page uses jsdom's localStorage, which `afterEach` clears. */
function renderPage(saveSource?: SaveGameSource) {
  const chapter = getChapter("chapter-1");
  if (!chapter) throw new Error("chapter-1 is not registered");
  const onReturnToMenu = vi.fn();
  render(
    <ChapterOnePage
      session={createNewChapterSession(chapter)}
      settings={SETTINGS}
      onReturnToMenu={onReturnToMenu}
      saveSource={saveSource}
    />,
  );
  return { onReturnToMenu };
}

function sceneReady() {
  act(() => canvas().onSceneReady?.());
}

function beginChapter() {
  sceneReady();
  fireEvent.click(screen.getByRole("button", { name: "Begin" }));
}

function focus(id: Parameters<ChapterOneCanvasProps["onFocusChange"]>[0]) {
  act(() => canvas().onFocusChange(id));
}

function interact() {
  act(() => canvas().onInteract?.([0, 0, 0]));
}

function pressKey(init: KeyboardEventInit) {
  fireEvent.keyDown(window, init);
}

const pressEscape = () => pressKey({ key: "Escape", code: "Escape" });
const pressP = () => pressKey({ key: "p", code: "KeyP" });
const pressJ = () => pressKey({ key: "j", code: "KeyJ" });

const queryDialog = (name: string) => screen.queryByRole("dialog", { name });

// --- Tests -----------------------------------------------------------------------------------

describe("ChapterOnePage", () => {
  it("keeps Begin disabled until the canvas reports the scene is ready", () => {
    renderPage();
    const begin = screen.getByRole<HTMLButtonElement>("button", { name: "Begin" });
    expect(begin.disabled).toBe(true);

    fireEvent.click(begin);
    expect(dispatched("START_CHAPTER")).toHaveLength(0);
    expect(canvas().enabled).toBe(false);

    sceneReady();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Begin" }).disabled).toBe(false);
  });

  it("dispatches START_CHAPTER on Begin and shows the first objective", () => {
    renderPage();
    beginChapter();

    expect(dispatched("START_CHAPTER")).toHaveLength(1);
    expect(store().getState().status).toBe("playing");
    expect(screen.queryByRole("button", { name: "Begin" })).toBeNull();
    const tracker = screen.getByRole("region", { name: "Objectives" });
    expect(within(tracker).getByText(FIRST_OBJECTIVE)).not.toBeNull();
    expect(canvas().enabled).toBe(true);
  });

  it("dispatches exactly one INTERACT_OBJECT per interaction with focus and opens the inspection panel", () => {
    renderPage();
    beginChapter();
    focus("obj.wallet");
    interact();

    expect(dispatched("INTERACT_OBJECT")).toEqual([{ type: "INTERACT_OBJECT", objectId: "obj.wallet" }]);
    const panel = screen.getByRole("dialog", { name: WALLET.label });
    expect(within(panel).getByText(WALLET.inspectionText)).not.toBeNull();
    expect(within(panel).getByText(BANK_CARD.title)).not.toBeNull();

    const notice = screen.getByTestId("evidence-notice");
    expect(notice.textContent).toContain(BANK_CARD.title);
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByTestId("evidence-notice")).toBeNull();

    // A second interact while the panel is open is ignored: input is off.
    interact();
    expect(dispatched("INTERACT_OBJECT")).toHaveLength(1);
  });

  it("dispatches nothing when the player interacts with no focus", () => {
    renderPage();
    beginChapter();
    const before = store().dispatch.mock.calls.length;

    interact();
    focus("obj.wallet");
    focus(null);
    interact();

    expect(store().dispatch.mock.calls.length).toBe(before);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("turns player input off while an overlay is open", () => {
    renderPage();
    beginChapter();
    focus("obj.wallet");
    expect(canvas().enabled).toBe(true);
    expect(canvas().focusedId).toBe("obj.wallet");

    interact();
    expect(canvas().enabled).toBe(false);
    expect(canvas().focusedId).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(canvas().enabled).toBe(true);
  });

  it("closes the top overlay on Escape, and opens the pause menu when nothing is open", () => {
    const { onReturnToMenu } = renderPage();
    beginChapter();
    focus("obj.wallet");
    interact();
    expect(queryDialog(WALLET.label)).not.toBeNull();

    pressEscape();
    expect(queryDialog(WALLET.label)).toBeNull();
    expect(queryDialog("Paused")).toBeNull();
    expect(canvas().enabled).toBe(true);

    pressEscape();
    expect(queryDialog("Paused")).not.toBeNull();
    expect(canvas().enabled).toBe(false);

    pressEscape();
    expect(queryDialog("Paused")).toBeNull();

    pressEscape();
    fireEvent.click(screen.getByRole("button", { name: "Save and return to menu" }));
    expect(onReturnToMenu).toHaveBeenCalledTimes(1);
  });

  it("pause menu: Save and return writes a Checkpoint; Restart asks first, then clears the save", () => {
    const saveSource = createMemorySaveSource();
    const { onReturnToMenu } = renderPage(saveSource);
    beginChapter();
    const writesAfterStart = saveSource.write.mock.calls.length;

    pressEscape();
    fireEvent.click(screen.getByRole("button", { name: "Save and return to menu" }));
    expect(saveSource.write.mock.calls.length).toBe(writesAfterStart + 1);
    expect(onReturnToMenu).toHaveBeenCalledTimes(1);

    // Restart: the first click only asks; Cancel goes back to the menu.
    fireEvent.click(screen.getByRole("button", { name: "Restart chapter" }));
    expect(screen.getByText("Restart Chapter 1? Your progress in this chapter will be lost.")).not.toBeNull();
    expect(saveSource.clear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Resume" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Restart chapter" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(saveSource.clear).toHaveBeenCalledTimes(1);
    expect(store().getState().status).toBe("not-started");
    expect(queryDialog("Paused")).toBeNull();
    // The title card is back in Begin mode and waits for the remounted canvas.
    const begin = screen.getByRole<HTMLButtonElement>("button", { name: "Begin" });
    expect(begin.disabled).toBe(true);
    expect(canvas().spawnPosition).toBeUndefined();
  });

  it("shows the save failure notice when a write fails, and the player can dismiss it", () => {
    const saveSource = createMemorySaveSource(false);
    renderPage(saveSource);
    beginChapter();

    const notice = screen.getByTestId("save-failure-notice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toContain("Progress cannot be saved on this device.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notice" }));
    expect(screen.queryByTestId("save-failure-notice")).toBeNull();
  });

  it("ignores Escape, P and J while the title card is open", () => {
    renderPage();
    sceneReady();
    pressEscape();
    pressP();
    pressJ();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("toggles the phone with P and the journal with J", () => {
    renderPage();
    beginChapter();

    pressP();
    expect(queryDialog("Phone")).not.toBeNull();
    expect(canvas().enabled).toBe(false);
    // J does not stack the journal on top of the phone.
    pressJ();
    expect(queryDialog("Journal")).toBeNull();
    pressP();
    expect(queryDialog("Phone")).toBeNull();
    expect(canvas().enabled).toBe(true);

    pressJ();
    expect(queryDialog("Journal")).not.toBeNull();
    pressP();
    expect(queryDialog("Phone")).toBeNull();
    pressJ();
    expect(queryDialog("Journal")).toBeNull();
  });

  it("shows Click to resume after an overlay closes, until the pointer is locked again", () => {
    renderPage();
    beginChapter();
    const gameView = screen.getByTestId("canvas-stub").parentElement as HTMLElement;

    fireEvent.click(gameView);
    expect(document.body.requestPointerLock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Click to resume")).toBeNull();

    pressJ();
    expect(document.exitPointerLock).toHaveBeenCalled();
    expect(screen.queryByText("Click to resume")).toBeNull();

    pressJ();
    expect(screen.getByText("Click to resume")).not.toBeNull();

    fireEvent.click(gameView);
    expect(document.body.requestPointerLock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Click to resume")).toBeNull();
  });
});

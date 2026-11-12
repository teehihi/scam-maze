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
import { FALLBACK_OPTION_ID, FALLBACK_OPTION_TEXT } from "../../game/narrative/dialogueEngine";
import type { DialogueView } from "../../game/narrative/selectors";
import { applyLocale } from "../../i18n";
import viHud from "../../i18n/locales/vi/chapter1/hud";
import viOutcome from "../../i18n/locales/vi/chapter1/outcome";
import viStory from "../../i18n/locales/vi/chapter1/story";
import { getDisplayPrompts, getDisplayScenario } from "../../i18n/narrative";
import type { ChapterOneCanvasProps } from "./ChapterOneCanvas";
import { ChapterOnePage } from "./ChapterOnePage";
import { DialoguePanel } from "./dialogue/DialoguePanel";
import { FIRST_INTERACTION_RING_DELAY_MS } from "./useCallTriggers";

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
  language: "en",
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
function renderPage(saveSource?: SaveGameSource, settings: GameSettings = SETTINGS) {
  const chapter = getChapter("chapter-1");
  if (!chapter) throw new Error("chapter-1 is not registered");
  const onReturnToMenu = vi.fn();
  render(
    <ChapterOnePage
      session={createNewChapterSession(chapter)}
      settings={settings}
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

  it("shows a ringing call as the Phone call dialog and gives control back with Click to resume", () => {
    renderPage();
    beginChapter();
    const gameView = screen.getByTestId("canvas-stub").parentElement as HTMLElement;
    fireEvent.click(gameView);
    expect(document.pointerLockElement).toBe(document.body);

    // The first interaction starts the ring delay; closing the panel lets the clock run.
    focus("obj.wallet");
    interact();
    fireEvent.click(within(screen.getByRole("dialog", { name: WALLET.label })).getByRole("button", { name: "Close" }));
    fireEvent.click(gameView);
    act(() => vi.advanceTimersByTime(FIRST_INTERACTION_RING_DELAY_MS + 1_000));
    expect(store().getState().call.status).toBe("ringing");

    // Requirements 1.1, 6.1, 6.2: one "Phone call" dialog, no 2D phone and no OPEN_PHONE,
    // player input off and pointer lock released.
    expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Phone call" })]);
    expect(queryDialog("Phone")).toBeNull();
    expect(dispatched("OPEN_PHONE")).toHaveLength(0);
    expect(canvas().enabled).toBe(false);
    expect(document.pointerLockElement).toBeNull();

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(dispatched("ANSWER_CALL")).toHaveLength(1);
    expect(queryDialog("Phone call")).not.toBeNull();
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(dispatched("END_CALL")).toHaveLength(1);

    // Requirement 6.8: empty stack, input back on, Click to resume, no lock until a click.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dispatched("CLOSE_PHONE")).toHaveLength(0);
    expect(canvas().enabled).toBe(true);
    expect(screen.getByText("Click to resume")).not.toBeNull();
    expect(document.pointerLockElement).toBeNull();
    fireEvent.click(gameView);
    expect(document.pointerLockElement).toBe(document.body);
  });
});

// --- Vietnamese (game-i18n-en-vi task 7.8; Requirements 4.5, 8.1, 8.3, 8.4, 8.5, 8.7, 9.8) ---

const VI_SETTINGS: GameSettings = { ...SETTINGS, language: "vi" };
const VI_SCENARIO = getDisplayScenario("vi");
const VI_WALLET = VI_SCENARIO.interactables["obj.wallet"];
const VI_BANK_CARD = VI_SCENARIO.evidence["ev.bank-card"];
const VI_FIRST_OBJECTIVE = VI_SCENARIO.objectives["obj.look-around"].text;

/** The App applies the language before paint; the page itself only follows i18n. */
function renderPageVi(saveSource?: SaveGameSource) {
  applyLocale("vi");
  return renderPage(saveSource, VI_SETTINGS);
}

function beginChapterVi() {
  sceneReady();
  fireEvent.click(screen.getByRole("button", { name: viHud.titleCard.begin }));
}

describe("ChapterOnePage in Vietnamese", () => {
  it("shows the Vietnamese title card, objective tracker and HUD buttons", () => {
    renderPageVi();
    expect(VI_SCENARIO.title).toBe("Cuộc gọi khẩn cấp");
    expect(screen.getByRole("heading", { name: "Cuộc gọi khẩn cấp" })).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Bắt đầu" }).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Begin" })).toBeNull();

    beginChapterVi();
    expect(dispatched("START_CHAPTER")).toHaveLength(1);
    const tracker = screen.getByRole("region", { name: viHud.objectives.heading });
    expect(within(tracker).getByText(VI_FIRST_OBJECTIVE)).not.toBeNull();
    expect(VI_FIRST_OBJECTIVE).not.toBe(FIRST_OBJECTIVE);

    // The name starts with the label; an unread badge adds its count text after it.
    const phone = screen.getByRole("button", { name: new RegExp(`^${viHud.hud.phone}`) });
    const journal = screen.getByRole("button", { name: new RegExp(`^${viHud.hud.journal}`) });
    expect(phone.textContent).not.toMatch(/Phone|unread/);
    // Key hints stay literal in every language.
    expect(phone.getAttribute("aria-keyshortcuts")).toBe("P");
    expect(journal.getAttribute("aria-keyshortcuts")).toBe("J");
    expect(screen.queryByRole("button", { name: "Phone" })).toBeNull();
  });

  it("shows the Vietnamese interaction prompt, inspection panel and evidence notice", () => {
    renderPageVi();
    beginChapterVi();
    focus("obj.wallet");
    const prompt = screen.getByTestId("interaction-prompt");
    expect(prompt.textContent).toBe(getDisplayPrompts("vi")["obj.wallet"]);
    expect(prompt.textContent).toMatch(/^Nhấn E để /);

    interact();
    expect(dispatched("INTERACT_OBJECT")).toEqual([{ type: "INTERACT_OBJECT", objectId: "obj.wallet" }]);
    const panel = screen.getByRole("dialog", { name: VI_WALLET.label });
    expect(within(panel).getByText(VI_WALLET.inspectionText)).not.toBeNull();
    expect(within(panel).getByText(VI_BANK_CARD.title)).not.toBeNull();
    expect(within(panel).getByText(viStory.inspection.evidenceHeading)).not.toBeNull();

    const notice = screen.getByTestId("evidence-notice");
    expect(notice.textContent).toContain(viHud.notice.evidenceRecorded);
    expect(notice.textContent).toContain(VI_BANK_CARD.title);

    fireEvent.click(within(panel).getByRole("button", { name: viStory.inspection.close }));
    expect(queryDialog(VI_WALLET.label)).toBeNull();
  });

  it("shows the Vietnamese pause menu and restart confirmation", () => {
    renderPageVi();
    beginChapterVi();
    pressEscape();
    const paused = screen.getByRole("dialog", { name: viOutcome.pause.heading });
    expect(within(paused).getByRole("button", { name: viOutcome.pause.resume })).not.toBeNull();
    expect(within(paused).getByRole("button", { name: viOutcome.pause.saveAndReturn })).not.toBeNull();

    fireEvent.click(within(paused).getByRole("button", { name: viOutcome.pause.restart }));
    expect(screen.getByText("Chơi lại Chương 1? Tiến trình của bạn trong chương này sẽ bị mất.")).not.toBeNull();
    expect(screen.getByRole("button", { name: viOutcome.pause.confirmRestart })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: viOutcome.pause.cancel }));
    expect(screen.getByRole("button", { name: viOutcome.pause.resume })).not.toBeNull();
  });

  it("shows the Vietnamese journal with stance, claim status and source by code", () => {
    renderPageVi();
    beginChapterVi();
    focus("obj.wallet");
    interact();
    pressEscape();

    pressJ();
    const journal = screen.getByRole("dialog", { name: viStory.journal.title });
    const text = journal.textContent ?? "";
    expect(within(journal).getAllByText(VI_BANK_CARD.title).length).toBeGreaterThan(0);
    expect(text).toContain(VI_BANK_CARD.description);
    expect(text).toContain(`${viStory.journal.stance["needs-verification"]}.`);
    expect(text).toContain(viStory.journal.source.physical);
    expect(text).toContain(viStory.journal.claimStatus.unverified);
    for (const english of ["Needs checking", "Not checked yet", "Something you found", "Evidence", "Close"]) {
      expect(text).not.toContain(english);
    }
    expect(within(journal).getByRole("button", { name: viStory.journal.close })).not.toBeNull();
  });

  it("shows the Vietnamese player speaker and fallback option in the dialogue panel", () => {
    applyLocale("vi");
    const view: DialogueView = {
      graphId: "dlg.shopkeeper",
      nodeId: "sam.before.greet",
      callId: null,
      channel: "face-to-face",
      speaker: "player",
      // The core's English label; the panel renders the speaker by its code instead.
      speakerName: "You",
      line: Object.values(VI_SCENARIO.dialogues["dlg.shopkeeper"].lines)[0],
      options: [{ id: FALLBACK_OPTION_ID, lineId: "__fallback.end", text: FALLBACK_OPTION_TEXT, fallback: true }],
    };
    const onSelectOption = vi.fn();
    render(<DialoguePanel view={view} onSelectOption={onSelectOption} />);

    const line = screen.getByTestId("dialogue-line");
    expect(within(line).getByText(viStory.dialogue.playerSpeaker)).not.toBeNull();
    expect(within(line).queryByText("You")).toBeNull();
    const fallback = screen.getByRole("button", { name: /Kết thúc cuộc trò chuyện/ });
    expect(fallback.textContent).not.toContain(FALLBACK_OPTION_TEXT);
    fireEvent.click(fallback);
    expect(onSelectOption).toHaveBeenCalledWith(FALLBACK_OPTION_ID);
  });

  it("switching language mid-chapter changes the visible text but not the store or the open overlay", () => {
    renderPage();
    beginChapter();
    // The objective toast for the first objective is shown before the switch.
    expect(screen.getByTestId("objective-toast").textContent).toContain(FIRST_OBJECTIVE);

    pressJ();
    expect(queryDialog("Journal")).not.toBeNull();
    const stateBefore = store().getState();
    const eventsBefore = stateBefore.events;
    const dispatchesBefore = store().dispatch.mock.calls.length;
    const storeBefore = store();

    act(() => applyLocale("vi"));

    // Same store, same state object, same event log, no new dispatch.
    expect(harness.stores).toHaveLength(1);
    expect(store()).toBe(storeBefore);
    expect(store().getState()).toBe(stateBefore);
    expect(store().getState().events).toBe(eventsBefore);
    expect(store().dispatch.mock.calls.length).toBe(dispatchesBefore);

    // The journal stays open and is now Vietnamese.
    expect(queryDialog("Journal")).toBeNull();
    const journal = screen.getByRole("dialog", { name: viStory.journal.title });
    expect(within(journal).getByText(viStory.journal.emptyState)).not.toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    // HUD and the toast queued before the switch follow the new language.
    const toast = screen.getByTestId("objective-toast");
    expect(toast.textContent).toContain(VI_FIRST_OBJECTIVE);
    expect(toast.textContent).toContain(viHud.toast.activated);
    expect(toast.textContent).not.toContain(FIRST_OBJECTIVE);
    const tracker = screen.getByRole("region", { name: viHud.objectives.heading });
    expect(within(tracker).getByText(VI_FIRST_OBJECTIVE)).not.toBeNull();
    expect(
      screen.getByRole("button", { name: new RegExp(`^${viHud.hud.journal}`) }).getAttribute("aria-pressed"),
    ).toBe("true");

    // The journal still closes with J, and the store did not restart.
    pressJ();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store().getState().status).toBe("playing");
    expect(dispatched("START_CHAPTER")).toHaveLength(1);
  });
});

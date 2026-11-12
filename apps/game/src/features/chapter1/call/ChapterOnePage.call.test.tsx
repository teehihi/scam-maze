// Chapter page call tests (game-3d-phone-call-ui task 11.6). Requirements 1.1, 4.9, 6.1, 6.2,
// 6.8, 6.9, 6.10, 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.2, 8.3, 8.5, 8.7, 8.8, 11.6, 11.7, 12.2, 12.3,
// 12.7, 13.4, 13.5, 13.7 and 13.11.
//
// The 3D canvas is replaced by a stub that records its props, the same way the other Chapter_Page
// tests do. The tests drive the call phone through those props: they publish a projected screen
// rectangle on `callPhone.screenSink` (model mode), call `onPhoneModelError` (load error) and
// `onWebGLContextChange` (context loss). `window.WebGLRenderingContext` is defined so the page
// sees WebGL as available unless a test removes it. The chapter store is wrapped so every
// dispatch can be counted. Calls are rung by dispatching the same RING_CALL action the
// Call_Trigger sends, so the call starts at a known time on the fake clock.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { GameSettings } from "@scammaze/shared-types";
import { CALL_PHONE_GLB } from "../../../config/assetPaths";
import { getChapter } from "../../../game/chapters/chapterRegistry";
import { createNewChapterSession } from "../../../game/chapters/chapterSession";
import { selectDialogueView } from "../../../game/narrative/selectors";
import type { ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { applyLocale } from "../../../i18n";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import enStory from "../../../i18n/locales/en/chapter1/story";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import viStory from "../../../i18n/locales/vi/chapter1/story";
import { DECISION_PANEL_PREFIX } from "../../../test/callStates";
import type { ChapterOneCanvasProps } from "../ChapterOneCanvas";
import { ChapterOnePage } from "../ChapterOnePage";
import { getTabbable } from "../focusTrap";
import { resetPhoneModelStatusForTests } from "./phoneModelStatus";
import { INTRO_CONTINUE_EN, INTRO_CONTINUE_VI, passIntro } from "../../../test/chapterIntro";

const harness = vi.hoisted(() => ({
  canvasProps: null as ChapterOneCanvasProps | null,
  stores: [] as Array<ChapterStore & { dispatch: Mock<ChapterStore["dispatch"]> }>,
}));

vi.mock("../ChapterOneCanvas", () => ({
  ChapterOneCanvas: (props: ChapterOneCanvasProps) => {
    harness.canvasProps = props;
    return <div data-testid="canvas-stub" data-enabled={String(props.enabled)} />;
  },
}));

vi.mock("../../../game/narrative/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../game/narrative/store")>();
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
  voiceVolume: 1,
  subtitlesEnabled: true,
  reducedStress: false,
  reducedMotion: "system",
  phoneVoiceFilter: true,
  englishVoiceFallback: false,
};

/** A projected screen rectangle, as the 3D phone publishes it every frame. */
const MODEL_RECT = { left: 120, top: 40, width: 300, height: 620 };

const RING_SCAM: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" };

// --- Pointer lock and WebGL stubs (jsdom has neither) ----------------------------------------

let lockedElement: Element | null = null;

function setLocked(element: Element | null) {
  lockedElement = element;
  document.dispatchEvent(new Event("pointerlockchange"));
}

function setWebGL(available: boolean) {
  if (available) {
    Object.defineProperty(window, "WebGLRenderingContext", {
      configurable: true,
      writable: true,
      value: function WebGLRenderingContext() {},
    });
  } else {
    // Removes the test double, so the page sees no WebGL (jsdom has none).
    Reflect.deleteProperty(window, "WebGLRenderingContext");
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.canvasProps = null;
  harness.stores.length = 0;
  lockedElement = null;
  setWebGL(true);
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
  vi.restoreAllMocks();
  resetPhoneModelStatusForTests();
  window.localStorage.clear();
  setWebGL(false);
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

function renderPage(settings: GameSettings = SETTINGS) {
  const chapter = getChapter("chapter-1");
  if (!chapter) throw new Error("chapter-1 is not registered");
  render(
    <ChapterOnePage
      session={createNewChapterSession(chapter)}
      settings={settings}
      onReturnToMenu={vi.fn()}
      saveSource={{ read: () => ({ status: "none" }), write: () => true, clear: () => true }}
    />,
  );
}

function beginChapter(beginLabel = INTRO_CONTINUE_EN) {
  act(() => canvas().onSceneReady?.());
  passIntro(beginLabel);
  expect(store().getState().status).toBe("playing");
}

/** Dispatches `action` the way a trigger or another part of the page would, and checks it. */
function dispatchAccepted(action: CoreAction) {
  let accepted = false;
  act(() => {
    accepted = store().dispatch(action).accepted;
  });
  expect(accepted, JSON.stringify(action)).toBe(true);
}

const ring = () => dispatchAccepted(RING_SCAM);

function pressKey(init: KeyboardEventInit) {
  fireEvent.keyDown(document.activeElement ?? window, init);
}

const pressEscape = () => pressKey({ key: "Escape", code: "Escape" });
const pressP = () => pressKey({ key: "p", code: "KeyP" });
const pressJ = () => pressKey({ key: "j", code: "KeyJ" });

const presentation = () => screen.queryByTestId("call-presentation");
const queryDialog = (name: string) => screen.queryByRole("dialog", { name });
const gameView = () => screen.getByTestId("chapter-game-view");

function publishModelRect() {
  const phone = canvas().callPhone;
  if (!phone) throw new Error("callPhone is null");
  act(() => phone.screenSink.publish(MODEL_RECT));
}

/** Options of the current call node, from the core (canonical English scenario). */
function currentOptionIds(): string[] {
  return selectDialogueView(store().getState(), CHAPTER_1_SCENARIO)?.options.map((option) => option.id) ?? [];
}

function optionButtons(): HTMLElement[] {
  const overlay = screen.getByTestId("player-choice-overlay");
  return within(overlay).getAllByRole("button");
}

function expectNoPresentation() {
  expect(presentation()).toBeNull();
  expect(screen.queryByTestId("phone-screen-host")).toBeNull();
  expect(screen.queryByTestId("incoming-call-screen")).toBeNull();
  expect(screen.queryByTestId("call-screen")).toBeNull();
  expect(screen.queryByTestId("player-choice-overlay")).toBeNull();
  expect(canvas().callPhone).toBeNull();
}

function warningsWithAssetPath(warn: { mock: { calls: unknown[][] } }): unknown[][] {
  return warn.mock.calls.filter((args) => args.some((arg) => String(arg).includes(CALL_PHONE_GLB)));
}

// --- Tests -----------------------------------------------------------------------------------

describe("ChapterOnePage call presentation", () => {
  it("shows a ringing call as one Phone call dialog with focus on Accept, input off and the pointer released", () => {
    renderPage();
    beginChapter();
    fireEvent.click(gameView());
    expect(document.pointerLockElement).toBe(document.body);

    ring();

    expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Phone call" })]);
    const dialog = screen.getByRole("dialog", { name: "Phone call" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByTestId("incoming-call-accept"));
    expect(canvas().enabled).toBe(false);
    expect(document.pointerLockElement).toBeNull();
    expect(dispatched("OPEN_PHONE")).toHaveLength(0);
    // WebGL is available: the canvas gets the call phone, and the first rectangle shows the model.
    expect(canvas().callPhone?.ringing).toBe(true);
    publishModelRect();
    expect(presentation()?.getAttribute("data-mode")).toBe("model");
  });

  it("(13.4a) Accept while ringing makes the call active and keeps the player disabled", () => {
    renderPage();
    beginChapter();
    ring();
    publishModelRect();

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(dispatched("ANSWER_CALL")).toHaveLength(1);
    expect(store().getState().call.status).toBe("active");
    expect(canvas().enabled).toBe(false);
    expect(canvas().callPhone?.ringing).toBe(false);
    expect(presentation()?.getAttribute("data-mode")).toBe("model");
    expect(screen.getByTestId("call-screen")).not.toBeNull();
    // Requirement 7.4: focus moves to the first option.
    expect(document.activeElement).toBe(optionButtons()[0]);
  });

  it("(13.4b) Decline removes the presentation, enables the player, shows Click to resume and focuses the game view", () => {
    renderPage();
    beginChapter();
    ring();
    publishModelRect();

    fireEvent.click(screen.getByTestId("incoming-call-decline"));
    expect(dispatched("END_CALL")).toHaveLength(1);
    const status = store().getState().call.status;
    expect(status === "ringing" || status === "active").toBe(false);
    expectNoPresentation();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(canvas().enabled).toBe(true);
    expect(screen.getByText("Click to resume")).not.toBeNull();
    expect(document.pointerLockElement).toBeNull();
    expect(document.activeElement).toBe(gameView());
  });

  it("(13.4c) Hang up removes the presentation, enables the player, shows Click to resume and focuses the game view", () => {
    renderPage();
    beginChapter();
    ring();
    publishModelRect();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));

    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(dispatched("END_CALL")).toHaveLength(1);
    const status = store().getState().call.status;
    expect(status === "ringing" || status === "active").toBe(false);
    expectNoPresentation();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(canvas().enabled).toBe(true);
    expect(screen.getByText("Click to resume")).not.toBeNull();
    expect(document.activeElement).toBe(gameView());
  });

  it("restores the 2D phone, its stack and focus after a call that rang while the phone was open (6.9, 7.6)", () => {
    renderPage();
    beginChapter();
    pressP();
    const phone = screen.getByRole("dialog", { name: "Phone" });
    const focusedBefore = document.activeElement;
    expect(focusedBefore instanceof HTMLElement && phone.contains(focusedBefore)).toBe(true);

    ring();
    // The phone stays mounted below the call, hidden, so only the call dialog is exposed.
    expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Phone call" })]);
    expect(document.activeElement).toBe(screen.getByTestId("incoming-call-accept"));

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));

    expectNoPresentation();
    expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Phone" })]);
    expect(screen.getByRole("dialog", { name: "Phone" })).toBe(phone);
    expect(document.activeElement).toBe(focusedBefore);
    expect(canvas().enabled).toBe(false);
    expect(dispatched("CLOSE_PHONE")).toHaveLength(0);
    expect(store().getState().phone.open).toBe(true);
  });

  it("returns to the decision panel after the official-line call started from it (6.9)", () => {
    renderPage();
    beginChapter();
    // The decision-panel prefix up to OPEN_PHONE; the page opens the phone itself with P.
    const openPhoneIndex = DECISION_PANEL_PREFIX.findIndex((action) => action.type === "OPEN_PHONE");
    for (const action of DECISION_PANEL_PREFIX.slice(1, openPhoneIndex)) dispatchAccepted(action);
    expect(store().getState().call.current).toBeNull();
    expectNoPresentation();

    pressP();
    for (const action of DECISION_PANEL_PREFIX.slice(openPhoneIndex + 1)) {
      if (action.type !== "CLOSE_PHONE") dispatchAccepted(action);
    }
    fireEvent.click(within(screen.getByRole("dialog", { name: "Phone" })).getByRole("button", { name: "Decide" }));
    const decision = screen.getByRole("dialog", { name: "Decide how to respond" });
    const dialogsBefore = screen.getAllByRole("dialog");
    expect(dialogsBefore).toEqual([screen.getByRole("dialog", { name: "Phone" }), decision]);

    fireEvent.click(within(decision).getByRole("button", { name: "Call Northgate on the official number" }));
    expect(store().getState().call).toMatchObject({ current: "call.official", status: "active" });
    expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Phone call" })]);
    expect(canvas().enabled).toBe(false);

    fireEvent.click(screen.getByTestId("call-screen-hang-up"));

    expectNoPresentation();
    expect(screen.getAllByRole("dialog")).toEqual(dialogsBefore);
    const active = document.activeElement;
    expect(active instanceof HTMLElement && decision.contains(active)).toBe(true);
    expect(canvas().enabled).toBe(false);
  });

  it("ignores Escape, P and J while a call rings or is active (7.5)", () => {
    renderPage();
    beginChapter();
    ring();

    const check = () => {
      const state = store().getState();
      const dispatches = store().dispatch.mock.calls.length;
      pressEscape();
      pressP();
      pressJ();
      expect(store().getState()).toBe(state);
      expect(store().dispatch.mock.calls.length).toBe(dispatches);
      expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Phone call" })]);
      expect(queryDialog("Paused")).toBeNull();
    };
    check();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    check();
    expect(store().getState().call.status).toBe("active");
  });

  it("wraps Tab and Shift+Tab inside the call dialog: voice controls and Hang up first, then the options (7.2)", () => {
    renderPage();
    beginChapter();
    ring();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));

    const dialog = screen.getByRole("dialog", { name: "Phone call" });
    const mute = screen.getByTestId("call-screen-mute");
    const replay = screen.getByTestId("call-screen-replay") as HTMLButtonElement;
    const hangUp = screen.getByTestId("call-screen-hang-up");
    const options = optionButtons();
    expect(options.length).toBeGreaterThan(0);
    // Designed order: Mute, Replay, Hang up, then the options. A disabled Replay is not tabbable.
    const callControls = replay.disabled ? [mute, hangUp] : [mute, replay, hangUp];
    expect(getTabbable(dialog)).toEqual([...callControls, ...options]);

    const first = callControls[0];
    const last = options[options.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab", code: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", code: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("(13.5) shows the 2D fallback with callPhone null when WebGL is unavailable (8.1)", () => {
    setWebGL(false);
    renderPage();
    beginChapter();
    ring();

    expect(canvas().callPhone).toBeNull();
    expect(canvas().phoneModelEnabled).toBe(false);
    // No grace period: the fallback shows at once.
    expect(presentation()?.getAttribute("data-mode")).toBe("fallback");
    expect(screen.getByTestId("phone-screen-host").getAttribute("data-mode")).toBe("fallback");
    expect(screen.getByTestId("incoming-call-accept")).not.toBeNull();
    expect(screen.getByTestId("incoming-call-decline")).not.toBeNull();
    expect(store().getState().call.status).toBe("ringing");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("(13.5) falls back after a model load error, logs one warning with the asset path, and later calls stay 2D (8.2, 8.5, 8.8)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderPage();
    beginChapter();
    ring();
    expect(canvas().callPhone).not.toBeNull();
    const callBefore = store().getState().call;

    act(() => canvas().onPhoneModelError?.(new Error("model load failed")));

    expect(canvas().callPhone).toBeNull();
    expect(canvas().phoneModelEnabled).toBe(false);
    expect(presentation()?.getAttribute("data-mode")).toBe("fallback");
    expect(screen.getByTestId("incoming-call-accept")).not.toBeNull();
    expect(screen.getByTestId("incoming-call-decline")).not.toBeNull();
    expect(store().getState().call).toBe(callBefore);
    expect(warningsWithAssetPath(warn)).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);

    // A second report (for example from the warmup) logs nothing new.
    act(() => canvas().onPhoneModelError?.(new Error("again")));
    expect(warningsWithAssetPath(warn)).toHaveLength(1);

    // A later call in the same session goes straight to the fallback, with no new warning.
    fireEvent.click(screen.getByTestId("incoming-call-decline"));
    expectNoPresentation();
    ring();
    expect(canvas().callPhone).toBeNull();
    expect(presentation()?.getAttribute("data-mode")).toBe("fallback");
    expect(screen.getByTestId("incoming-call-accept")).not.toBeNull();
    expect(warningsWithAssetPath(warn)).toHaveLength(1);
  });

  it("shows the fallback with working controls 200 ms after the ring while the model is still loading (8.3)", () => {
    renderPage();
    beginChapter();
    ring();
    expect(canvas().callPhone).not.toBeNull();
    expect(presentation()?.getAttribute("data-mode")).toBe("pending");

    act(() => vi.advanceTimersByTime(199));
    expect(presentation()?.getAttribute("data-mode")).toBe("pending");
    act(() => vi.advanceTimersByTime(1));
    expect(presentation()?.getAttribute("data-mode")).toBe("fallback");

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(store().getState().call.status).toBe("active");
    const [firstId] = currentOptionIds();
    const nodeBefore = store().getState().conversation?.nodeId;
    fireEvent.click(optionButtons()[0]);
    expect(dispatched("SELECT_DIALOGUE_OPTION")).toEqual([{ type: "SELECT_DIALOGUE_OPTION", optionId: firstId }]);
    expect(store().getState().conversation?.nodeId).not.toBe(nodeBefore);
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expectNoPresentation();
  });

  it("falls back when the WebGL context is lost during a call, keeping the call state (8.7)", () => {
    renderPage();
    beginChapter();
    ring();
    publishModelRect();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    fireEvent.click(optionButtons()[0]);
    expect(presentation()?.getAttribute("data-mode")).toBe("model");
    const stateBefore = store().getState();
    const optionsBefore = currentOptionIds();

    act(() => canvas().onWebGLContextChange?.(true));

    expect(presentation()?.getAttribute("data-mode")).toBe("fallback");
    expect(canvas().callPhone).toBeNull();
    expect(store().getState()).toBe(stateBefore);
    expect(optionButtons().map((button) => button.getAttribute("data-testid"))).toEqual(
      optionsBefore.map((id) => `dialogue-option-${id}`),
    );
    const host = screen.getByTestId("phone-screen-host");
    expect(host.contains(screen.getByTestId("player-choice-overlay"))).toBe(false);
  });

  it("removes a call that ends below the pause menu, keeps the pause, and resume returns control (6.10)", () => {
    // The page offers no input that opens the pause menu during a call (Escape is locked), so a
    // `[call, pause]` stack cannot be built through the UI. This covers the reachable order: the
    // pause menu is open when the call arrives, and the call entry is removed when it ends.
    renderPage();
    beginChapter();
    pressEscape();
    expect(queryDialog("Paused")).not.toBeNull();

    ring();
    expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Phone call" })]);
    fireEvent.click(screen.getByTestId("incoming-call-decline"));

    expectNoPresentation();
    expect(screen.getAllByRole("dialog")).toEqual([screen.getByRole("dialog", { name: "Paused" })]);
    expect(canvas().enabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(canvas().enabled).toBe(true);
    expect(screen.getByText("Click to resume")).not.toBeNull();
  });

  it("(13.7) shows the Vietnamese chrome text while ringing and while active", () => {
    applyLocale("vi");
    renderPage({ ...SETTINGS, language: "vi" });
    beginChapter(INTRO_CONTINUE_VI);
    ring();

    /** The shown text equals the `vi` value and differs from English unless both are identical. */
    const expectVi = (shown: string | null, viText: string, enText: string) => {
      expect(shown).toBe(viText);
      if (viText !== enText) expect(shown).not.toBe(enText);
    };
    const ringing = screen.getByRole("dialog", { name: viPhone.phone.callPresentation.name });
    expectVi(ringing.getAttribute("aria-label"), viPhone.phone.callPresentation.name, enPhone.phone.callPresentation.name);
    expectVi(
      within(ringing).getByText(viPhone.phone.incomingCall.caption).textContent,
      viPhone.phone.incomingCall.caption,
      enPhone.phone.incomingCall.caption,
    );
    expectVi(
      screen.getByTestId("incoming-call-accept").textContent,
      viPhone.phone.incomingCall.accept,
      enPhone.phone.incomingCall.accept,
    );
    expectVi(
      screen.getByTestId("incoming-call-decline").textContent,
      viPhone.phone.incomingCall.decline,
      enPhone.phone.incomingCall.decline,
    );

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    const active = screen.getByRole("dialog", { name: viPhone.phone.callPresentation.name });
    expectVi(active.getAttribute("aria-label"), viPhone.phone.callPresentation.name, enPhone.phone.callPresentation.name);
    expectVi(
      within(active).getByText(viPhone.phone.call.status).textContent,
      viPhone.phone.call.status,
      enPhone.phone.call.status,
    );
    expectVi(screen.getByTestId("call-screen-hang-up").textContent, viPhone.phone.call.hangUp, enPhone.phone.call.hangUp);
    expectVi(
      within(screen.getByTestId("player-choice-overlay")).getByText(viStory.dialogue.optionsLabel).textContent,
      viStory.dialogue.optionsLabel,
      enStory.dialogue.optionsLabel,
    );
    expect(active.textContent).not.toContain(enPhone.phone.call.status);
    expect(active.textContent).not.toContain(enStory.dialogue.optionsLabel);
  });

  it("keeps the call state when the locale changes during a call (12.7)", () => {
    renderPage();
    beginChapter();
    ring();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    const stateBefore = store().getState();
    const dispatchesBefore = store().dispatch.mock.calls.length;
    const idsBefore = optionButtons().map((button) => button.getAttribute("data-testid"));

    act(() => applyLocale("vi"));

    expect(store().getState()).toBe(stateBefore);
    expect(store().dispatch.mock.calls.length).toBe(dispatchesBefore);
    expect(screen.getByRole("dialog", { name: viPhone.phone.callPresentation.name })).not.toBeNull();
    expect(screen.getByTestId("call-screen-hang-up").textContent).toBe(viPhone.phone.call.hangUp);
    expect(optionButtons().map((button) => button.getAttribute("data-testid"))).toEqual(idsBefore);
    expect(store().getState().call.status).toBe("active");
  });

  it("P with no call shows the 2D phone apps and no call presentation (11.6)", () => {
    renderPage();
    beginChapter();
    pressP();
    const phone = screen.getByRole("dialog", { name: "Phone" });
    expect(within(phone).getByRole("button", { name: /Messages/ })).not.toBeNull();
    expect(within(phone).getByRole("button", { name: /Calls/ })).not.toBeNull();
    expectNoPresentation();
  });

  it("talking to Sam shows the DialoguePanel overlay and no call presentation (11.7)", () => {
    renderPage();
    beginChapter();
    act(() => canvas().onFocusChange("obj.shopkeeper"));
    act(() => canvas().onInteract?.([0, 0, 0]));
    expect(dispatched("TALK_TO_NPC")).toHaveLength(1);
    expect(screen.getByTestId("dialogue-overlay")).not.toBeNull();
    expectNoPresentation();
  });

  it("leaves the state unchanged for a stale option ID from a second click after the node changed (4.9)", () => {
    renderPage();
    beginChapter();
    ring();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    const [firstId] = currentOptionIds();
    const button = screen.getByTestId(`dialogue-option-${firstId}`);

    let afterFirst = store().getState();
    act(() => {
      fireEvent.click(button);
      afterFirst = store().getState();
      // The button is still mounted: React renders the new node when this act scope ends.
      fireEvent.click(button);
    });

    const selects = store().dispatch.mock.calls
      .map(([action], index) => ({ action, result: store().dispatch.mock.results[index] }))
      .filter(({ action }) => action.type === "SELECT_DIALOGUE_OPTION");
    expect(selects.map(({ action }) => action)).toEqual([
      { type: "SELECT_DIALOGUE_OPTION", optionId: firstId },
      { type: "SELECT_DIALOGUE_OPTION", optionId: firstId },
    ]);
    expect(currentOptionIds()).not.toContain(firstId);
    const second = selects[1].result;
    expect(second.type).toBe("return");
    expect((second.value as { accepted: boolean }).accepted).toBe(false);
    expect(store().getState()).toBe(afterFirst);
  });
});

// Chapter_Page voice integration tests (chapter-01-voice-narrative task 23.2). Requirements 17.2,
// 17.3, 17.4 and 16.6.
//
// The page creates its own Web Audio engine, so `game/voice/webAudioEngine` is replaced by a
// factory that returns `fakeAudioPort` plus fake versions of the extra engine methods (ringtone,
// connect click, ambience, tension). The 3D canvas is replaced by a stub that records its props,
// as in the other Chapter_Page tests. No WebGL, network, audio device or microphone is used.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { GameSettings } from "@scammaze/shared-types";
import { getChapter } from "../../game/chapters/chapterRegistry";
import { applyRestoredProgress, createNewChapterSession, type ChapterSession } from "../../game/chapters/chapterSession";
import { CHAPTER_1_INTERACTABLES } from "../../game/narrative/chapter1/interactables";
import { chapterReducer, createInitialState } from "../../game/narrative/reducer";
import type { ChapterStore } from "../../game/narrative/store";
import type { ChapterState, CoreAction } from "../../game/narrative/types";
import { encodeProgress } from "../../game/saves/chapterProgress";
import type { SaveGameSource } from "../../game/saves/saveGame";
import { applyLocale } from "../../i18n";
import enHud from "../../i18n/locales/en/chapter1/hud";
import type { FakeAudioPort, FakeAudioPortOptions } from "../../test/fakeAudioPort";
import type { ChapterOneCanvasProps } from "./ChapterOneCanvas";
import { ChapterOnePage } from "./ChapterOnePage";
import { resetPhoneModelStatusForTests } from "./call/phoneModelStatus";

const harness = vi.hoisted(() => ({
  canvasProps: null as ChapterOneCanvasProps | null,
  stores: [] as unknown[],
  audioOptions: {} as FakeAudioPortOptions,
  ports: [] as FakeAudioPort[],
  engines: [] as Array<Record<string, Mock>>,
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

vi.mock("../../game/voice/webAudioEngine", async () => {
  const { createFakeAudioPort } = await import("../../test/fakeAudioPort");
  return {
    createWebAudioEngine: () => {
      const port = createFakeAudioPort(harness.audioOptions);
      const extras = {
        setMasterGain: vi.fn(),
        startRingtone: vi.fn(),
        stopRingtone: vi.fn(),
        playConnectClick: vi.fn(),
        startAmbience: vi.fn(),
        setAmbienceInCall: vi.fn(),
        stopAmbience: vi.fn(),
        setTension: vi.fn(),
      };
      harness.ports.push(port);
      harness.engines.push(extras);
      return Object.assign(port, extras);
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

/** Sound on, captions off: the caption shows only when nothing is audible. */
const SOUND_ON: GameSettings = { ...SETTINGS, soundEnabled: true, sfxVolume: 1, subtitlesEnabled: false };

const RING_SCAM: CoreAction = { type: "RING_CALL", callId: "call.scam-1", reason: "first-interaction" };
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
const VERIFY_OPTION = "opt.scam.open.verify";

/** Card found, scam call answered and ended right away to verify (same run as the restore tests). */
const AFTER_SCAM_CALL: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "INTERACT_OBJECT", objectId: "obj.wallet" },
  RING_SCAM,
  { type: "ANSWER_CALL" },
  option(VERIFY_OPTION),
];

const MODEL_RECT = { left: 120, top: 40, width: 300, height: 620 };

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
    Reflect.deleteProperty(window, "WebGLRenderingContext");
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  harness.canvasProps = null;
  harness.stores.length = 0;
  harness.ports.length = 0;
  harness.engines.length = 0;
  harness.audioOptions = { autoLoad: true, defaultDurationMs: 2000 };
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
  applyLocale("en");
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

type TestStore = ChapterStore & { dispatch: Mock<ChapterStore["dispatch"]> };

function canvas(): ChapterOneCanvasProps {
  if (!harness.canvasProps) throw new Error("ChapterOneCanvas stub was not rendered");
  return harness.canvasProps;
}

function store(): TestStore {
  const latest = harness.stores[harness.stores.length - 1] as TestStore | undefined;
  if (!latest) throw new Error("No chapter store was created");
  return latest;
}

function port(): FakeAudioPort {
  const latest = harness.ports[harness.ports.length - 1];
  if (!latest) throw new Error("No fake audio port was created");
  return latest;
}

function dispatched(type: CoreAction["type"]): CoreAction[] {
  return store()
    .dispatch.mock.calls.map(([action]) => action)
    .filter((action) => action.type === type);
}

const noSaves: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function renderPage(settings: GameSettings, session?: ChapterSession) {
  const chapter = getChapter("chapter-1");
  if (!chapter) throw new Error("chapter-1 is not registered");
  render(
    <ChapterOnePage
      session={session ?? createNewChapterSession(chapter)}
      settings={settings}
      onReturnToMenu={vi.fn()}
      saveSource={noSaves}
    />,
  );
}

function pressBegin(label = "Begin") {
  act(() => canvas().onSceneReady?.());
  fireEvent.click(screen.getByRole("button", { name: label }));
}

function dispatchAccepted(action: CoreAction) {
  let accepted = false;
  act(() => {
    accepted = store().dispatch(action).accepted;
  });
  expect(accepted, JSON.stringify(action)).toBe(true);
}

/** Opens the wallet inspection panel and closes it again, like the player's first interaction. */
function inspectWallet() {
  act(() => canvas().onFocusChange("obj.wallet"));
  act(() => canvas().onInteract?.([0, 0, 0]));
  const label = CHAPTER_1_INTERACTABLES["obj.wallet"].label;
  fireEvent.click(within(screen.getByRole("dialog", { name: label })).getByRole("button", { name: "Close" }));
}

/** Wallet inspected, then the scam call rings (the first-interaction ring). */
function ringScamCall() {
  inspectWallet();
  dispatchAccepted(RING_SCAM);
}

/** Lets pending microtasks (clip loads, resume promises) settle. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Runs the pause-before timer of the current node, then settles loads and resume. */
async function playCurrentLine() {
  await flush();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000);
  });
}

function play(actions: readonly CoreAction[]): ChapterState {
  let state = createInitialState();
  for (const action of actions) {
    const result = chapterReducer(state, action);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    state = result.state;
  }
  return state;
}

const queryCaption = () => screen.queryByTestId("dialogue-line");

// --- Tests -----------------------------------------------------------------------------------

describe("ChapterOnePage voice integration", () => {
  it("unlocks audio when the player presses Begin and when the player presses Answer", () => {
    renderPage(SOUND_ON);
    // One engine is shared by the voice player and the call sounds, and nothing unlocks on mount.
    expect(harness.ports).toHaveLength(1);
    expect(port().resumeCalls).toBe(0);

    pressBegin();
    expect(dispatched("START_CHAPTER")).toHaveLength(1);
    const afterBegin = port().resumeCalls;
    expect(afterBegin).toBeGreaterThan(0);

    ringScamCall();
    // A ringing call alone does not unlock anything; the ringtone starts on the engine.
    expect(port().resumeCalls).toBe(afterBegin);
    expect(harness.engines[0].startRingtone).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(dispatched("ANSWER_CALL")).toHaveLength(1);
    expect(port().resumeCalls).toBeGreaterThan(afterBegin);
    expect(harness.engines[0].stopRingtone).toHaveBeenCalled();
    expect(harness.engines[0].playConnectClick).toHaveBeenCalledTimes(1);
  });

  it("plays a full run to an ending and the debrief with AI off and no microphone", () => {
    const fetchSpy = typeof globalThis.fetch === "function" ? vi.spyOn(globalThis, "fetch") : null;
    expect(navigator.mediaDevices).toBeUndefined();

    renderPage(SETTINGS);
    pressBegin();
    ringScamCall();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(store().getState().call.status).toBe("active");

    // The choices render and work with sound off; the call ends on the verify option.
    fireEvent.click(screen.getByTestId(`dialogue-option-${VERIFY_OPTION}`));
    if (store().getState().call.status === "active") fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(screen.queryByTestId("call-presentation")).toBeNull();
    expect(store().getState().outcome).toBeNull();

    dispatchAccepted({ type: "MAKE_DECISION", decision: "stop-and-wait" });
    const ending = screen.getByTestId("ending-transition");
    expect(store().getState().status).toBe("ended");
    fireEvent.click(within(ending).getByRole("button", { name: "Continue" }));

    expect(screen.getByTestId("debrief-screen").getAttribute("data-outcome")).toBe(store().getState().outcome);
    expect(store().getState().status).toBe("finished");

    // Sound off: no clip was requested. Nothing used the network or asked for a microphone.
    expect(port().loadRequests).toEqual([]);
    expect(port().playbacks).toEqual([]);
    expect(fetchSpy?.mock.calls ?? []).toEqual([]);
    expect(navigator.mediaDevices).toBeUndefined();
  });

  it("shows the caption with sound off even when captions are turned off, and Replay stays harmless", () => {
    renderPage({ ...SETTINGS, subtitlesEnabled: false });
    pressBegin();
    ringScamCall();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));

    // Nothing is audible, so the caption shows although the Subtitles setting is off.
    expect(queryCaption()).not.toBeNull();
    // With sound off there is no clip to replay: the control is shown, disabled, and does nothing.
    const replay = screen.getByTestId("call-screen-replay") as HTMLButtonElement;
    expect(replay.disabled).toBe(true);
    const state = store().getState();
    const dispatches = store().dispatch.mock.calls.length;
    fireEvent.click(replay);
    expect(port().playbacks).toEqual([]);
    expect(store().getState()).toBe(state);
    expect(store().dispatch.mock.calls.length).toBe(dispatches);
    expect(queryCaption()).not.toBeNull();
  });

  it("shows the caption and replays the line when the browser blocks audio", async () => {
    harness.audioOptions = { autoLoad: true, defaultDurationMs: 2000, resumeResult: "suspended" };
    renderPage(SOUND_ON);
    pressBegin();
    ringScamCall();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    await playCurrentLine();

    // Blocked autoplay: nothing plays, the caption shows although Subtitles is off, and the
    // options stay available.
    expect(port().playbacks).toEqual([]);
    expect(queryCaption()).not.toBeNull();
    expect(screen.getByTestId("call-notice").textContent).not.toBe("");
    const replay = screen.getByTestId("call-screen-replay") as HTMLButtonElement;
    expect(replay.disabled).toBe(false);
    expect(screen.getByTestId(`dialogue-option-${VERIFY_OPTION}`)).not.toBeNull();

    // The browser now allows audio; Replay plays the clip and changes no state.
    port().allowResume();
    const state = store().getState();
    const dispatches = store().dispatch.mock.calls.length;
    fireEvent.click(replay);
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(port().playbacks).toHaveLength(1);
    expect(port().liveHandles).toBe(1);
    expect(store().getState()).toBe(state);
    expect(store().dispatch.mock.calls.length).toBe(dispatches);
  });

  it("keeps the state and stops the clip when the language is switched during a call", async () => {
    renderPage(SOUND_ON);
    pressBegin();
    ringScamCall();
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    await playCurrentLine();
    expect(port().liveHandles).toBe(1);
    const startedBefore = port().playbacks.length;

    const stateBefore = store().getState();
    const dispatchesBefore = store().dispatch.mock.calls.length;
    act(() => applyLocale("vi"));

    expect(port().liveHandles).toBe(0);
    expect(port().playbacks).toHaveLength(startedBefore);
    expect(store().getState()).toBe(stateBefore);
    expect(store().dispatch.mock.calls.length).toBe(dispatchesBefore);
    expect(store().getState().call.status).toBe("active");
    expect(screen.getByTestId("call-presentation")).not.toBeNull();

    // Switching back does not restart the clip either; the player can replay it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(port().liveHandles).toBe(0);
  });

  it("shows the trimmed notice when the saved action log has drifted, and the player can dismiss it", () => {
    const chapter = getChapter("chapter-1");
    if (!chapter) throw new Error("chapter-1 is not registered");
    const valid = play(AFTER_SCAM_CALL);
    const encoded = encodeProgress(valid, { position: [0, 0, 0], yaw: 0 }, "obj.check-claims");
    if (!encoded) throw new Error("encodeProgress returned null");
    // An option that no longer exists in the scenario: the lenient restore stops before it.
    const progress = { ...encoded, actions: [...encoded.actions, option("opt.removed-in-a-newer-version")] };
    const applied = applyRestoredProgress({ ...createNewChapterSession(chapter), origin: "saved-game", progress });
    if (!applied.ok) throw new Error(applied.reason);
    expect(applied.session.saveTrimmed).toBe(true);

    renderPage(SETTINGS, applied.session);
    // Hidden behind the title card until the player continues.
    expect(screen.queryByTestId("save-trimmed-notice")).toBeNull();
    pressBegin("Continue");

    const notice = screen.getByTestId("save-trimmed-notice");
    expect(notice.getAttribute("role")).toBe("status");
    expect(notice.textContent).toContain(enHud.hud.saveTrimmed.message);
    expect(store().getState().events).toHaveLength(valid.events.length);

    fireEvent.click(within(notice).getByRole("button", { name: enHud.hud.saveTrimmed.dismiss }));
    expect(screen.queryByTestId("save-trimmed-notice")).toBeNull();
  });

  it("uses the 3D phone UI for a call and renders the choices outside the phone", () => {
    renderPage(SETTINGS);
    pressBegin();
    ringScamCall();

    // WebGL is available: the canvas gets the call phone, and the first rectangle shows the model.
    expect(canvas().callPhone?.ringing).toBe(true);
    act(() => canvas().callPhone?.screenSink.publish(MODEL_RECT));
    const presentation = screen.getByTestId("call-presentation");
    expect(presentation.getAttribute("data-mode")).toBe("model");
    expect(dispatched("OPEN_PHONE")).toHaveLength(0);
    expect(screen.queryByRole("dialog", { name: "Phone" })).toBeNull();

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(canvas().callPhone?.ringing).toBe(false);
    const host = screen.getByTestId("phone-screen-host");
    const choices = screen.getByTestId("player-choice-overlay");
    expect(host.contains(screen.getByTestId("call-screen"))).toBe(true);
    expect(host.contains(choices)).toBe(false);
    expect(presentation.contains(choices)).toBe(true);
    // The phone shows the caption, never the player's options.
    expect(within(host).queryByTestId(`dialogue-option-${VERIFY_OPTION}`)).toBeNull();
    expect(within(choices).getByTestId(`dialogue-option-${VERIFY_OPTION}`)).not.toBeNull();
  });
});

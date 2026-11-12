// Accessibility and icon tests for the Chapter_Page (task 14.4). Requirements 16.6, 17.1, 17.2,
// 17.3, 17.4, 17.5 and 18.1.
//
// The 3D canvas is replaced by a stub that records its props (as in ChapterOnePage.test.tsx), so
// the tests can report scene readiness, focus and interaction. Fake timers drive the Call_Trigger
// clock. `mockReducedMotion` from the loading tests sets the reduced-motion media query.

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSettings } from "@scammaze/shared-types";
import { getChapter } from "../../game/chapters/chapterRegistry";
import { createNewChapterSession } from "../../game/chapters/chapterSession";
import { CHAPTER_1_INTERACTABLES } from "../../game/narrative/chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../../game/narrative/chapter1/scenario";
import { buildDebrief, type DebriefView } from "../../game/narrative/debrief";
import { createInitialState } from "../../game/narrative/reducer";
import { createChapterStore } from "../../game/narrative/store";
import type { CoreAction } from "../../game/narrative/types";
import { applyLocale } from "../../i18n";
import viHud from "../../i18n/locales/vi/chapter1/hud";
import viOutcome from "../../i18n/locales/vi/chapter1/outcome";
import viPhone from "../../i18n/locales/vi/chapter1/phone";
import viStory from "../../i18n/locales/vi/chapter1/story";
import { getDisplayPrompts, getDisplayScenario } from "../../i18n/narrative";
import { mockReducedMotion, restoreMatchMedia } from "../../test/loadingRuns";
import type { ChapterOneCanvasProps } from "./ChapterOneCanvas";
import { SettingsModal } from "../menu/SettingsModal";
import { ChapterOnePage } from "./ChapterOnePage";
import { DebriefScreen } from "./debrief/DebriefScreen";
import { EndingTransition } from "./ending/EndingTransition";
import { FIRST_INTERACTION_RING_DELAY_MS } from "./useCallTriggers";

const harness = vi.hoisted(() => ({
  canvasProps: null as ChapterOneCanvasProps | null,
}));

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

const WALLET = CHAPTER_1_INTERACTABLES["obj.wallet"];

beforeEach(() => {
  vi.useFakeTimers();
  harness.canvasProps = null;
  // jsdom has no Pointer Lock API; the page only needs these to exist.
  Object.defineProperty(document, "exitPointerLock", { configurable: true, writable: true, value: vi.fn() });
  Object.defineProperty(document.body, "requestPointerLock", { configurable: true, writable: true, value: vi.fn() });
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  restoreMatchMedia();
  // @ts-expect-error remove the test doubles so other suites see jsdom's defaults
  delete document.exitPointerLock;
  // @ts-expect-error see above
  delete document.body.requestPointerLock;
});

// --- Page helpers ----------------------------------------------------------------------------

function canvas(): ChapterOneCanvasProps {
  if (!harness.canvasProps) throw new Error("ChapterOneCanvas stub was not rendered");
  return harness.canvasProps;
}

function renderPage(settings: GameSettings = SETTINGS) {
  const chapter = getChapter("chapter-1");
  if (!chapter) throw new Error("chapter-1 is not registered");
  render(<ChapterOnePage session={createNewChapterSession(chapter)} settings={settings} onReturnToMenu={vi.fn()} />);
}

function beginChapter(beginLabel = "Begin") {
  act(() => canvas().onSceneReady?.());
  fireEvent.click(screen.getByRole("button", { name: beginLabel }));
}

function inspectWallet() {
  act(() => canvas().onFocusChange("obj.wallet"));
  act(() => canvas().onInteract?.([0, 0, 0]));
}

/** First interaction, close the panel, then wait for the first scam Call to ring. */
function ringFirstCall() {
  inspectWallet();
  fireEvent.click(within(dialog(WALLET.label)).getByRole("button", { name: "Close" }));
  waitForRing();
}

/** Lets the Call_Trigger clock run with no overlay open until the first scam Call rings. */
function waitForRing() {
  act(() => vi.advanceTimersByTime(FIRST_INTERACTION_RING_DELAY_MS + 1_000));
}

/** Key presses go to the focused element and bubble to the page's window listeners. */
function pressKey(init: KeyboardEventInit) {
  fireEvent.keyDown(document.activeElement ?? document.body, init);
}

const pressEscape = () => pressKey({ key: "Escape", code: "Escape" });
const pressP = () => pressKey({ key: "p", code: "KeyP" });
const pressJ = () => pressKey({ key: "j", code: "KeyJ" });
const pressTab = (shiftKey = false) => pressKey({ key: "Tab", code: "Tab", shiftKey });

const dialog = (name: string) => screen.getByRole("dialog", { name });
const gameView = () => screen.getByTestId("chapter-game-view");

function expectFocusInside(container: HTMLElement) {
  expect(container.contains(document.activeElement), `focus is on ${document.activeElement?.outerHTML.slice(0, 80)}`).toBe(
    true,
  );
}

// --- Accessibility checks on the current DOM ------------------------------------------------

/** Text a screen reader reads from the subtree, skipping `aria-hidden` parts. */
function readableText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element) || node.getAttribute("aria-hidden") === "true") return "";
  return Array.from(node.childNodes).map(readableText).join("");
}

/** Accessible name: aria-labelledby, then aria-label, then readable content. */
function accessibleName(element: Element): string {
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
  }
  const label = element.getAttribute("aria-label")?.trim();
  if (label) return label;
  return readableText(element).replace(/\s+/g, " ").trim();
}

/**
 * Every dialog is modal and named, every button has a name (icon-only ones through aria-label),
 * and every lucide icon is hidden from assistive technology.
 */
function expectAccessibleDom(step: string) {
  for (const element of document.querySelectorAll('[role="dialog"]')) {
    expect(element.getAttribute("aria-modal"), `${step}: dialog aria-modal`).toBe("true");
    expect(accessibleName(element), `${step}: dialog name`).not.toBe("");
  }
  for (const button of document.querySelectorAll("button")) {
    expect(accessibleName(button), `${step}: button ${button.outerHTML.slice(0, 120)}`).not.toBe("");
    if (readableText(button).trim() === "") {
      expect(button.getAttribute("aria-label")?.trim(), `${step}: icon-only button needs aria-label`).toBeTruthy();
    }
  }
  const icons = document.querySelectorAll("svg.lucide");
  for (const icon of icons) {
    expect(icon.getAttribute("aria-hidden"), `${step}: ${icon.getAttribute("class")}`).toBe("true");
  }
  return icons.length;
}

// --- Scripted run for the ending and debrief (copied from DebriefScreen.test.tsx) -----------

const RISKY_MONEY_MOVED_RUN: CoreAction[] = [
  { type: "START_CHAPTER" },
  { type: "RING_CALL", callId: "call.scam-1", reason: "exploration-timer" },
  { type: "ANSWER_CALL" },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.open.yes-what" },
  { type: "OPEN_PHONE" },
  { type: "INSPECT_EVIDENCE", evidenceId: "ev.otp-sms" },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.code.read-code" },
  { type: "SELECT_DIALOGUE_OPTION", optionId: "opt.scam.move.move-money" },
  { type: "FINISH_CHAPTER" },
];

function riskyDebrief(): DebriefView {
  const store = createChapterStore(createInitialState(), CHAPTER_1_SCENARIO);
  for (const action of RISKY_MONEY_MOVED_RUN) expect(store.dispatch(action).accepted).toBe(true);
  const view = buildDebrief(store.getState(), CHAPTER_1_SCENARIO);
  if (!view) throw new Error("the risky run did not produce a debrief");
  return view;
}

// --- Source scan -----------------------------------------------------------------------------

const CHAPTER1_DIR = import.meta.dirname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

// Pictographic code points (emoji), variation selector 16 (emoji presentation) and regional
// indicators (flags). Typographic characters such as → · — × are not matched.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;

// --- Tests -----------------------------------------------------------------------------------

describe("Chapter 1 accessibility", () => {
  it("moves focus into each overlay when it opens and back to the game view when it closes", () => {
    renderPage();
    // The title card moves focus to its heading.
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: CHAPTER_1_SCENARIO.title }));
    beginChapter();

    inspectWallet();
    expectFocusInside(dialog(WALLET.label));
    fireEvent.click(within(dialog(WALLET.label)).getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(gameView());

    pressEscape();
    expectFocusInside(dialog("Paused"));
    pressEscape();
    expect(document.activeElement).toBe(gameView());

    pressP();
    expectFocusInside(dialog("Phone"));
    pressP();
    expect(document.activeElement).toBe(gameView());

    pressJ();
    expectFocusInside(dialog("Journal"));
    pressEscape();
    expect(document.activeElement).toBe(gameView());
  });

  it("follows the call into the call presentation and returns focus to the opener in the overlay below", () => {
    renderPage();
    beginChapter();
    ringFirstCall();

    // A ringing call opens the call presentation (not the 2D phone) with focus on Accept.
    const ringing = dialog("Phone call");
    expect(ringing).toBe(screen.getByTestId("call-presentation"));
    expect(ringing.getAttribute("aria-modal")).toBe("true");
    expect(screen.queryByRole("dialog", { name: "Phone" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("incoming-call-accept"));

    // Answering moves focus to the first choice, still inside the same dialog.
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    const active = dialog("Phone call");
    expectFocusInside(active);
    const options = within(active).getByRole("list");
    expect(document.activeElement).toBe(within(options).getAllByRole("button")[0]);

    // Hanging up empties the stack: focus returns to the game view and the resume prompt shows.
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(screen.queryByTestId("call-presentation")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(gameView());
    expect(screen.getByTestId("resume-prompt")).not.toBeNull();

    // The phone is closed after the call, so P opens it and P closes it again.
    pressP();
    expectFocusInside(dialog("Phone"));
    pressP();
    expect(document.activeElement).toBe(gameView());

    // The decision panel opens from the journal; closing it returns focus to Decide.
    pressJ();
    const decide = within(dialog("Journal")).getByRole("button", { name: "Decide" });
    decide.focus();
    fireEvent.click(decide);
    const decision = dialog("Decide how to respond");
    expectFocusInside(decision);
    fireEvent.click(within(decision).getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(decide);
  });

  it("keeps Tab and Shift+Tab inside the top dialog", () => {
    renderPage();
    beginChapter();
    pressEscape();
    const paused = dialog("Paused");
    const buttons = within(paused).getAllByRole("button");
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    last.focus();
    pressTab();
    expect(document.activeElement).toBe(first);

    first.focus();
    pressTab(true);
    expect(document.activeElement).toBe(last);

    // Focus outside the dialog is pulled back in.
    gameView().focus();
    pressTab();
    expect(document.activeElement).toBe(first);
    gameView().focus();
    pressTab(true);
    expect(document.activeElement).toBe(last);
  });

  it("names every dialog and button, marks dialogs modal and hides every lucide icon", () => {
    renderPage();
    let icons = expectAccessibleDom("title card");
    beginChapter();
    icons += expectAccessibleDom("hud");

    inspectWallet();
    icons += expectAccessibleDom("inspection");
    pressEscape();

    pressEscape();
    icons += expectAccessibleDom("pause");
    pressEscape();

    pressP();
    icons += expectAccessibleDom("phone home");
    expect(within(dialog("Phone")).getByRole("button", { name: "Close phone" })).not.toBeNull();
    pressP();

    pressJ();
    icons += expectAccessibleDom("journal");
    pressJ();

    // The wallet was inspected above, so the first-interaction ring is due.
    waitForRing();
    // Exactly one dialog while the call is open: the call presentation.
    expect(screen.getAllByRole("dialog")).toEqual([dialog("Phone call")]);
    icons += expectAccessibleDom("incoming call");
    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(screen.getAllByRole("dialog")).toEqual([dialog("Phone call")]);
    icons += expectAccessibleDom("active call");
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    // The call ended with an empty stack: no dialog is left open.
    expect(screen.queryByRole("dialog")).toBeNull();
    icons += expectAccessibleDom("after call");

    pressJ();
    fireEvent.click(within(dialog("Journal")).getByRole("button", { name: "Decide" }));
    icons += expectAccessibleDom("decision");

    // The checks found icons to inspect, so the lucide class selector still matches.
    expect(icons).toBeGreaterThan(0);
  });

  it("names the ending and debrief dialogs and hides their icons", () => {
    const view = riskyDebrief();
    const { unmount } = render(<EndingTransition outcome={view.outcome} onContinue={() => {}} />);
    expect(expectAccessibleDom("ending")).toBeGreaterThan(0);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: view.outcome.title }));
    unmount();

    render(<DebriefScreen view={view} onReplay={() => {}} onReturnToMenu={() => {}} />);
    expectAccessibleDom("debrief");
    expectFocusInside(screen.getByRole("dialog"));
  });

  it("puts the objective tracker in a polite live region", () => {
    renderPage();
    beginChapter();
    const tracker = screen.getByRole("region", { name: "Objectives" });
    const live = tracker.querySelector('[aria-live="polite"]') as HTMLElement | null;
    expect(live).not.toBeNull();
    expect(
      within(live as HTMLElement).getByText(CHAPTER_1_SCENARIO.objectives["obj.look-around"].text),
    ).not.toBeNull();
  });

  describe("reduced motion", () => {
    function toastAndCallMotion() {
      renderPage();
      beginChapter();
      const toastClass = screen.getByTestId("objective-toast").className;
      ringFirstCall();
      const icon = screen.getByTestId("incoming-call-icon");
      return { toastClass, vibrating: icon.getAttribute("data-vibrating"), animation: icon.style.animation };
    }

    it("animates the toast and the incoming call when motion is allowed", () => {
      mockReducedMotion(false);
      const motion = toastAndCallMotion();
      expect(motion.toastClass).toContain("transition-opacity");
      expect(motion.vibrating).toBe("true");
      expect(motion.animation).not.toBe("");
    });

    it("removes the toast fade and the call vibration when reduced motion is requested", () => {
      mockReducedMotion(true);
      const motion = toastAndCallMotion();
      expect(motion.toastClass).not.toMatch(/transition|duration-|animate-/);
      expect(motion.toastClass).toContain("opacity-100");
      expect(motion.vibrating).toBe("false");
      expect(motion.animation).toBe("");
    });

    it("shows the ending at once with no fade when reduced motion is requested", () => {
      const view = riskyDebrief();
      mockReducedMotion(false);
      const { unmount } = render(<EndingTransition outcome={view.outcome} onContinue={() => {}} />);
      expect(screen.getByTestId("ending-transition").style.transitionDuration).not.toBe("0ms");
      unmount();

      mockReducedMotion(true);
      render(<EndingTransition outcome={view.outcome} onContinue={() => {}} />);
      const ending = screen.getByTestId("ending-transition");
      expect(ending.style.transitionDuration).toBe("0ms");
      expect(ending.style.opacity).toBe("1");
    });
  });

  describe("in Vietnamese (game-i18n-en-vi task 7.8)", () => {
    const VI_SCENARIO = getDisplayScenario("vi");
    const VI_WALLET = VI_SCENARIO.interactables["obj.wallet"];

    function renderVi() {
      applyLocale("vi");
      renderPage({ ...SETTINGS, language: "vi" });
    }

    function liveRegion(): HTMLElement {
      const tracker = screen.getByRole("region", { name: viHud.objectives.heading });
      const live = tracker.querySelector('[aria-live="polite"]');
      if (!(live instanceof HTMLElement)) throw new Error("objective tracker has no live region");
      return live;
    }

    it("gives every dialog and button a Vietnamese accessible name", () => {
      renderVi();
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Cuộc gọi khẩn cấp" }));
      expectAccessibleDom("vi title card");
      beginChapter(viHud.titleCard.begin);
      expectAccessibleDom("vi hud");

      inspectWallet();
      const inspection = dialog(VI_WALLET.label);
      expectFocusInside(inspection);
      expectAccessibleDom("vi inspection");
      fireEvent.click(within(inspection).getByRole("button", { name: viStory.inspection.close }));
      expect(document.activeElement).toBe(gameView());

      pressEscape();
      expectFocusInside(dialog(viOutcome.pause.heading));
      expectAccessibleDom("vi pause");
      pressEscape();

      pressP();
      const phone = dialog(viPhone.phone.overlay.name);
      expectFocusInside(phone);
      expect(within(phone).getByRole("button", { name: viPhone.phone.overlay.close })).not.toBeNull();
      expectAccessibleDom("vi phone home");
      pressP();

      pressJ();
      expectFocusInside(dialog(viStory.journal.title));
      expectAccessibleDom("vi journal");
      pressJ();

      waitForRing();
      const ringing = dialog(viPhone.phone.callPresentation.name);
      expect(ringing.getAttribute("aria-modal")).toBe("true");
      expect(document.activeElement).toBe(screen.getByTestId("incoming-call-accept"));
      expect(screen.getByTestId("incoming-call-accept").textContent).toContain(viPhone.phone.incomingCall.accept);
      // The Decline button is checked by test id only: its visible text may change.
      expect(within(ringing).getByTestId("incoming-call-decline")).not.toBeNull();
      expectAccessibleDom("vi incoming call");
      fireEvent.click(screen.getByTestId("incoming-call-accept"));
      const active = dialog(viPhone.phone.callPresentation.name);
      expectFocusInside(active);
      expect(within(active).getByRole("button", { name: viPhone.phone.call.hangUp })).not.toBeNull();
      expectAccessibleDom("vi active call");
      fireEvent.click(screen.getByTestId("call-screen-hang-up"));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(gameView());
      expectAccessibleDom("vi after call");

      pressJ();
      fireEvent.click(within(dialog(viStory.journal.title)).getByRole("button", { name: viStory.journal.decide }));
      expectFocusInside(dialog(viOutcome.decision.heading));
      expectAccessibleDom("vi decision");

      // No English dialog name is left.
      for (const english of ["Paused", "Phone", "Phone call", "Journal", "Decide how to respond", WALLET.label]) {
        expect(screen.queryByRole("dialog", { name: english })).toBeNull();
      }
    });

    it("announces objectives in Vietnamese in the polite live region", () => {
      renderVi();
      beginChapter(viHud.titleCard.begin);
      expect(within(liveRegion()).getByText(VI_SCENARIO.objectives["obj.look-around"].text)).not.toBeNull();

      ringFirstCallVi();
      fireEvent.click(screen.getByTestId("incoming-call-accept"));
      const answered = VI_SCENARIO.objectives["obj.answer-call"].text;
      expect(liveRegion().textContent).toContain(`Đã hoàn thành mục tiêu: ${answered}`);
      expect(liveRegion().textContent).not.toContain("Objective completed");

      // The caller's line is in the subtitle overlay, a polite live region with the Vietnamese
      // caller name, inside the Vietnamese-named call presentation.
      const line = within(dialog(viPhone.phone.callPresentation.name)).getByTestId("call-subtitle-region");
      expect(line.getAttribute("aria-live")).toBe("polite");
      expect(line.getAttribute("aria-atomic")).toBe("true");
      expect(line.textContent).toContain(VI_SCENARIO.dialogues["dlg.scam-call"].persona.name);
    });

    it("names the Speaker and Replay buttons in Vietnamese", () => {
      renderVi();
      beginChapter(viHud.titleCard.begin);
      ringFirstCallVi();
      fireEvent.click(screen.getByTestId("incoming-call-accept"));
      const active = dialog(viPhone.phone.callPresentation.name);
      const speaker = within(active).getByTestId("call-screen-speaker");
      const replay = within(active).getByTestId("call-screen-replay");
      expect(accessibleName(speaker)).toBe("Loa ngoài");
      expect(accessibleName(replay)).toBe("Nghe lại câu vừa rồi");
      expect(replay.parentElement?.textContent).toContain("Nghe lại");
    });

    it("keeps the key hints E, P, J and Esc literal", () => {
      renderVi();
      beginChapter(viHud.titleCard.begin);
      act(() => canvas().onFocusChange("obj.wallet"));
      expect(screen.getByTestId("interaction-prompt").textContent).toBe(getDisplayPrompts("vi")["obj.wallet"]);
      expect(screen.getByTestId("interaction-prompt").textContent).toMatch(/^Nhấn E /);

      // The name starts with the label; an unread badge adds its Vietnamese count text after it.
      const phone = screen.getByRole("button", { name: new RegExp(`^${viHud.hud.phone}`) });
      const journal = screen.getByRole("button", { name: new RegExp(`^${viHud.hud.journal}`) });
      expect(accessibleName(phone)).not.toMatch(/unread|Phone/);
      expect(phone.getAttribute("aria-keyshortcuts")).toBe("P");
      expect(phone.querySelector("kbd")?.textContent).toBe("P");
      expect(journal.getAttribute("aria-keyshortcuts")).toBe("J");
      expect(journal.querySelector("kbd")?.textContent).toBe("J");

      // The Escape key still opens and closes the pause menu in Vietnamese.
      act(() => canvas().onFocusChange(null));
      pressEscape();
      expect(dialog(viOutcome.pause.heading)).not.toBeNull();
      pressEscape();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    /** Vietnamese twin of `ringFirstCall`: the inspection panel's Close is "Đóng". */
    function ringFirstCallVi() {
      inspectWallet();
      fireEvent.click(within(dialog(VI_WALLET.label)).getByRole("button", { name: viStory.inspection.close }));
      waitForRing();
    }
  });

  // Voice narrative (chapter-01-voice-narrative task 23.6).
  describe("voice controls", () => {
    /** Elements Tab reaches, in document order (jsdom has no real Tab navigation). */
    function tabbables(root: HTMLElement): HTMLElement[] {
      return Array.from(root.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]")).filter(
        (element) => !element.hasAttribute("disabled") && element.tabIndex >= 0,
      );
    }

    function answerFirstCall(): HTMLElement {
      renderPage();
      beginChapter();
      ringFirstCall();
      fireEvent.click(screen.getByTestId("incoming-call-accept"));
      return dialog("Phone call");
    }

    it("answers, mutes, replays and chooses an option with the keyboard, in the documented tab order", () => {
      renderPage();
      beginChapter();
      ringFirstCall();

      // Answer: focus starts on Accept; Enter or Space on a button is a native click.
      const accept = screen.getByTestId("incoming-call-accept");
      expect(document.activeElement).toBe(accept);
      fireEvent.click(accept);
      const call = dialog("Phone call");
      expectFocusInside(call);

      // Tab order: Mute, Speaker, Replay (only when enabled), Hang up, then the options.
      const mute = within(call).getByTestId("call-screen-mute");
      const speaker = within(call).getByTestId("call-screen-speaker");
      const replay = within(call).getByTestId("call-screen-replay");
      const hangUp = within(call).getByTestId("call-screen-hang-up");
      const options = within(within(call).getByRole("list")).getAllByRole("button");
      expect(options.length).toBeGreaterThan(0);
      const order = tabbables(call);
      const expected = [mute, speaker, ...(replay.hasAttribute("disabled") ? [] : [replay]), hangUp, ...options];
      expect(order).toEqual(expected);

      // Mute: named, toggles with aria-pressed and flips its label; keyboard focus is kept.
      mute.focus();
      expect(accessibleName(mute)).toBe("Mute");
      expect(mute.getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(mute);
      expect(mute.getAttribute("aria-pressed")).toBe("true");
      expect(accessibleName(mute)).toBe("Unmute");
      expect(document.activeElement).toBe(mute);
      fireEvent.click(mute);
      expect(mute.getAttribute("aria-pressed")).toBe("false");
      expect(accessibleName(mute)).toBe("Mute");

      // Replay: named; a disabled Replay is not a Tab stop, an enabled one keeps focus on click.
      expect(accessibleName(replay)).toBe("Replay last line");
      if (replay.hasAttribute("disabled")) {
        expect(order).not.toContain(replay);
      } else {
        replay.focus();
        fireEvent.click(replay);
        expect(document.activeElement).toBe(replay);
      }

      // Choose an option with a number key on the focused option.
      const lineBefore = within(call).getByTestId("call-subtitle-line").textContent;
      options[0].focus();
      pressKey({ key: "1", code: "Digit1" });
      expectFocusInside(dialog("Phone call"));
      expect(screen.queryByTestId(options[0].getAttribute("data-testid") ?? "")).toBeNull();
      expect(within(dialog("Phone call")).getByTestId("call-subtitle-line").textContent).not.toBe(lineBefore);
    });

    it("keeps Tab inside the call dialog from Hang up and from the last option", () => {
      const call = answerFirstCall();
      const order = tabbables(call);
      const first = order[0];
      const last = order[order.length - 1];
      last.focus();
      pressTab();
      expect(document.activeElement).toBe(first);
      first.focus();
      pressTab(true);
      expect(document.activeElement).toBe(last);
    });

    it("gives the new call controls accessible names, hidden icons and visible focus classes", () => {
      const call = answerFirstCall();
      expectAccessibleDom("voice call");
      for (const id of ["call-screen-mute", "call-screen-speaker", "call-screen-replay", "call-screen-hang-up"]) {
        const button = within(call).getByTestId(id);
        expect(accessibleName(button), id).not.toBe("");
        expect(button.className, id).toContain("focus-visible:outline");
        for (const icon of button.querySelectorAll("svg")) expect(icon.getAttribute("aria-hidden")).toBe("true");
      }
      // The notice and caption are polite live regions, not Tab stops.
      expect(within(call).getByTestId("call-notice").getAttribute("aria-live")).toBe("polite");
      expect(within(call).getByTestId("call-subtitle-region").getAttribute("aria-live")).toBe("polite");
      expect(within(call).getByTestId("call-subtitle-region").tabIndex).toBe(-1);
      expect(within(call).getByTestId("call-subtitle-overlay").tabIndex).toBe(-1);
    });

    it("gives the face-to-face Replay a name, a hidden icon and a visible focus class", () => {
      // Source check: the dialogue panel's Replay uses the shared secondary button with focus-visible.
      const source = readFileSync(join(CHAPTER1_DIR, "dialogue", "DialoguePanel.tsx"), "utf8");
      expect(source).toMatch(/data-testid="dialogue-replay"/);
      expect(source).toMatch(/aria-hidden="true"/);
      const theme = readFileSync(join(CHAPTER1_DIR, "theme.ts"), "utf8");
      expect(theme).toMatch(/buttonSecondary:\s*\n?\s*"[^"]*focus-visible:outline/);
    });

    it("lets the keyboard read the whole debrief and reach both actions", () => {
      const view = riskyDebrief();
      const onReplay = vi.fn();
      const onReturnToMenu = vi.fn();
      render(<DebriefScreen view={view} onReplay={onReplay} onReturnToMenu={onReturnToMenu} />);
      const debrief = screen.getByRole("dialog");
      // Focus starts on the heading; the sections are named headings in reading order.
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: view.outcome.title }));
      const sections = within(debrief).getAllByRole("region");
      expect(sections.length).toBeGreaterThanOrEqual(7);
      for (const section of sections) expect(accessibleName(section)).not.toBe("");
      // Only the two actions are Tab stops, both named and with a focus-visible class.
      const stops = tabbables(debrief).filter((element) => element.tagName === "BUTTON");
      expect(stops.map(accessibleName)).toEqual(["Return to menu", "Replay chapter"]);
      for (const stop of stops) expect(stop.className).toContain("focus-visible:outline");
      stops[1].focus();
      fireEvent.click(stops[1]);
      expect(onReplay).toHaveBeenCalledTimes(1);
      stops[0].focus();
      fireEvent.click(stops[0]);
      expect(onReturnToMenu).toHaveBeenCalledTimes(1);
    });

    it("labels the Settings voice controls", () => {
      render(
        <SettingsModal
          isOpen
          onClose={() => {}}
          settings={{ ...SETTINGS, soundEnabled: true, language: "vi", musicVolume: 0.5, sfxVolume: 0.5 }}
          onUpdateSettings={() => {}}
        />,
      );
      const volume = document.getElementById("settings-voice-volume");
      expect(volume).not.toBeNull();
      expect(volume?.getAttribute("type")).toBe("range");
      expect(document.querySelector('label[for="settings-voice-volume"]')?.textContent?.trim()).toBeTruthy();
      for (const id of ["settings-captions", "settings-phone-filter", "settings-english-fallback"]) {
        const control = document.getElementById(id);
        expect(control, id).not.toBeNull();
        const name = accessibleName(control as HTMLElement) || document.querySelector(`label[for="${id}"]`)?.textContent;
        expect(name?.trim(), id).toBeTruthy();
        expect((control as HTMLElement).tabIndex, id).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("uses no emoji anywhere in the features/chapter1 source", () => {
    const files = sourceFiles(CHAPTER1_DIR);
    expect(files.length).toBeGreaterThan(10);
    const findings: string[] = [];
    for (const file of files) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          for (const match of line.matchAll(EMOJI)) {
            const code = match[0].codePointAt(0)?.toString(16).toUpperCase();
            findings.push(`${relative(CHAPTER1_DIR, file)}:${index + 1} U+${code}`);
          }
        });
    }
    expect(findings).toEqual([]);
  });
});

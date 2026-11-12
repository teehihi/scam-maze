// Feature: game-phone-call-ui-redesign, Property 1: The phone screen holds only call content
// Feature: game-3d-phone-call-ui, Property 3: The choice overlay mirrors the dialogue options
//
// Content properties of `CallPresentation` (tasks 11.2 and 11.3; design.md, "Correctness
// Properties"). Generated call states come from `src/test/callStates.ts` (seeded, built with
// `chapterReducer` through `runSequence`). Each case renders `CallPresentation` with the display
// scenario of the generated locale, in model mode (the sink holds a rectangle before mount) or in
// fallback mode (`modelAllowed` false). `CallPresentation` imports no three, React Three Fiber or
// Drei code, so no WebGL context or canvas test double is needed here (Requirement 13.11).
import { act, cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { selectDialogueView } from "../../../game/narrative/selectors";
import { createChapterStore } from "../../../game/narrative/store";
import type { VoiceSnapshot } from "../../../game/voice/VoiceDialoguePlayer";
import { applyLocale } from "../../../i18n";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import enStory from "../../../i18n/locales/en/chapter1/story";
import viStory from "../../../i18n/locales/vi/chapter1/story";
import { getDisplayScenario } from "../../../i18n/narrative";
import { caseSeed } from "../../../test/chapterRuns";
import {
  CALL_STATE_SEED,
  describeCallState,
  generateCallState,
  type GeneratedCallState,
} from "../../../test/callStates";
import { createLcg } from "../../../test/seededRandom";
import { CallPresentation } from "./CallPresentation";
import type { CallVoiceProps } from "./CallPresentation";
import { isSubtitleVisible } from "./callDialogueView";
import { createPhoneScreenSink } from "./phoneScreenSink";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;
const PROPERTY_RUNS = 100;
const PROPERTY_1_SEED = (CALL_STATE_SEED ^ 0x0c0a0002) >>> 0;
const PROPERTY_3_SEED = (CALL_STATE_SEED ^ 0x0c0a0003) >>> 0;

const PHONE_TEXT = { en: enPhone.phone, vi: viPhone.phone } as const;
const DIALOGUE_TEXT = { en: enStory.dialogue, vi: viStory.dialogue } as const;
/** A rectangle published before mount, so the presentation starts in model mode. */
const MODEL_RECT = { left: 40, top: 60, width: 240, height: 480 };

type PresentationCaseMode = "model" | "fallback";

interface RenderedCase {
  generated: GeneratedCallState;
  mode: PresentationCaseMode;
  container: HTMLElement;
  /** Voice controls state; `null`: no `voice` prop. */
  voice: { muted: boolean; audible: boolean } | null;
  subtitlesEnabled: boolean;
}

/** Renders `CallPresentation` for a generated state, locale and mode. */
function renderCase(
  generated: GeneratedCallState,
  mode: PresentationCaseMode,
  voice: RenderedCase["voice"] = null,
  subtitlesEnabled = true,
): RenderedCase {
  act(() => {
    applyLocale(generated.locale);
  });
  const store = createChapterStore(generated.state);
  const screenSink = createPhoneScreenSink();
  if (mode === "model") screenSink.publish(MODEL_RECT);
  const noop = () => undefined;
  const voiceProps: CallVoiceProps | undefined =
    voice === null
      ? undefined
      : {
          snapshot: {
            phase: "playing",
            source: "clip",
            label: "none",
            reason: null,
            targetKey: null,
            muted: voice.muted,
            audible: voice.audible,
            durationMs: null,
            endedCount: 0,
          } as unknown as VoiceSnapshot,
          muted: voice.muted,
          unlock: () => Promise.resolve(),
          replay: noop,
          setMuted: noop,
          optionsWaiting: false,
          skipWait: noop,
        };
  const { container } = render(
    <CallPresentation
      store={store}
      scenario={getDisplayScenario(generated.locale)}
      paused={false}
      modelAllowed={mode === "model"}
      screenSink={screenSink}
      onAnswer={noop}
      onEnd={noop}
      onSelectOption={noop}
      voice={voiceProps}
      subtitlesEnabled={subtitlesEnabled}
      speaker={voice === null ? undefined : { on: false, onToggle: noop }}
    />,
  );
  return { generated, mode, container, voice, subtitlesEnabled };
}

/** Accessible name of a button: its visible text (icons are `aria-hidden`). */
function buttonName(button: HTMLElement): string {
  return button.getAttribute("aria-label") ?? (button.textContent ?? "").trim();
}

/** Number of text nodes in `root` whose trimmed text equals `text`. */
function countTextNodes(root: Node, text: string): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? "").trim() === text) count += 1;
  }
  return count;
}

/** Checks Property 1 for one rendered case. */
function checkPhoneScreenContent({ generated, mode, container, voice, subtitlesEnabled }: RenderedCase): void {
  const label = `${describeCallState(generated)} (mode ${mode}, voice ${voice === null ? "none" : "on"}, subtitles ${subtitlesEnabled})`;
  const { state, locale, callId } = generated;
  const scenario = getDisplayScenario(locale);
  const callDef = scenario.calls[callId];
  const text = PHONE_TEXT[locale];
  const doc = container.ownerDocument;

  expect(state.call.current, label).toBe(callId);

  // Exactly one modal dialog and exactly one phone screen host.
  const dialogs = doc.querySelectorAll('[role="dialog"]');
  expect(dialogs.length, label).toBe(1);
  expect(dialogs[0].getAttribute("aria-modal"), label).toBe("true");
  const hosts = doc.querySelectorAll('[data-testid="phone-screen-host"]');
  expect(hosts.length, label).toBe(1);
  const host = hosts[0] as HTMLElement;
  expect(host.getAttribute("data-mode"), label).toBe(mode);

  // No call content inside a 2D phone frame.
  for (const frame of Array.from(doc.querySelectorAll("[data-phone-frame]"))) {
    expect(frame.contains(host), label).toBe(false);
    expect(frame.querySelector('[data-testid="player-choice-overlay"]'), label).toBeNull();
  }

  // Buttons: Decline and Accept while ringing; Mute, Speaker, Replay and End call while active
  // with voice controls; End call only while active without voice controls.
  // The Decline button shows the "Decline" text (`phone.incomingCall.decline`).
  const buttonNames = within(host)
    .queryAllByRole("button", { hidden: true })
    .map(buttonName);
  if (state.call.status === "ringing") {
    expect(buttonNames, label).toEqual([text.incomingCall.decline, text.incomingCall.accept]);
  } else {
    expect(state.call.status, label).toBe("active");
    const expected =
      voice === null
        ? [text.call.hangUp]
        : [
            voice.muted ? text.call.unmute : text.call.mute,
            text.call.speaker,
            text.call.replayAria,
            text.call.hangUp,
          ];
    expect(buttonNames, label).toEqual(expected);
  }

  // Caller name and number from the display scenario; the number is the same in both locales,
  // plain text with `dir="ltr"` and no link ancestor, and shown once in the document.
  expect(callDef.number, label).toBe(getDisplayScenario("en").calls[callId].number);
  expect(countTextNodes(host, callDef.displayName), label).toBeGreaterThanOrEqual(1);
  const numberNodes = within(host).getAllByText(callDef.number);
  expect(numberNodes.length, label).toBe(1);
  expect(numberNodes[0].getAttribute("dir"), label).toBe("ltr");
  expect(numberNodes[0].closest("a"), label).toBeNull();
  expect(countTextNodes(doc.body, callDef.number), label).toBe(1);

  // The phone holds no sentences and no options.
  const hostText = host.textContent ?? "";
  expect(host.querySelector('[data-testid^="dialogue-option-"]'), label).toBeNull();
  expect(host.querySelector('[data-testid="dialogue-line"]'), label).toBeNull();
  expect(host.querySelector('[data-testid="call-line-region"]'), label).toBeNull();
  expect(host.querySelector('[data-testid="call-notice"]'), label).toBeNull();
  expect(hostText, label).not.toContain(text.call.connecting);
  for (const notice of Object.values(text.call.notice)) expect(hostText, label).not.toContain(notice);

  const view = selectDialogueView(state, scenario);
  const linked = view !== null && view.callId === callId ? view : null;
  if (linked !== null && linked.line.trim().length > 0) {
    expect(hostText, label).not.toContain(linked.line);
  }
  for (const option of linked?.options ?? []) {
    if (!option.fallback && option.text.trim().length > 0) expect(hostText, label).not.toContain(option.text);
  }

  // The caller line is in the subtitle overlay (outside the phone host) when it applies.
  const lines = Array.from(doc.querySelectorAll('[data-testid="call-subtitle-line"]'));
  const callerLine =
    state.call.status === "active" &&
    linked !== null &&
    (linked.speaker === "caller" || linked.speaker === "npc");
  const visible = isSubtitleVisible({ subtitlesEnabled, audible: voice?.audible });
  if (callerLine && visible) {
    expect(lines.length, label).toBe(1);
    expect(lines[0].textContent, label).toBe(linked.line);
    expect(host.contains(lines[0]), label).toBe(false);
    expect(lines[0].closest('[data-testid="call-subtitle-overlay"]'), label).not.toBeNull();
  } else {
    expect(lines.length, label).toBe(0);
  }
}
/** Accessible name from visible text, leaving out `aria-hidden` parts (for example the key hint). */
function visibleName(element: Element): string {
  const label = element.getAttribute("aria-label");
  if (label !== null) return label.trim();
  let text = "";
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node instanceof Element && node.getAttribute("aria-hidden") === "true") return;
    node.childNodes.forEach(walk);
  };
  walk(element);
  return text.replace(/\s+/g, " ").trim();
}

/** Checks Property 3 for one rendered case. */
function checkChoiceOverlay({ generated, mode, container }: RenderedCase): void {
  const label = `${describeCallState(generated)} (mode ${mode})`;
  const { state, locale, callId } = generated;
  const scenario = getDisplayScenario(locale);
  const text = DIALOGUE_TEXT[locale];
  const doc = container.ownerDocument;
  const overlays = doc.querySelectorAll('[data-testid="player-choice-overlay"]');

  if (state.call.status === "ringing") {
    expect(overlays.length, label).toBe(0);
    return;
  }
  expect(state.call.status, label).toBe("active");
  const view = selectDialogueView(state, scenario);
  const linked = view !== null && view.callId === callId ? view : null;
  if (linked === null) return;

  // Exactly one overlay, a sibling of the screen host and never inside it.
  expect(overlays.length, label).toBe(1);
  const overlay = overlays[0] as HTMLElement;
  const host = doc.querySelector('[data-testid="phone-screen-host"]') as HTMLElement | null;
  expect(host, label).not.toBeNull();
  expect(host!.contains(overlay), label).toBe(false);
  expect(overlay.contains(host!), label).toBe(false);
  expect(overlay.parentElement, label).toBe(host!.parentElement);

  const lists = overlay.querySelectorAll("ol");
  if (linked.options.length === 0) {
    // Zero options: the `dialogue.noOptions` text and no option list (Requirement 3.7).
    expect(lists.length, label).toBe(0);
    expect(overlay.querySelectorAll("button").length, label).toBe(0);
    expect(countTextNodes(overlay, text.noOptions), label).toBe(1);
    return;
  }

  // One `ol` with one `li > button` per option, in the same order and with the same names.
  expect(lists.length, label).toBe(1);
  const items = Array.from(lists[0].children);
  expect(items.length, label).toBe(linked.options.length);
  expect(overlay.querySelectorAll("button").length, label).toBe(linked.options.length);
  items.forEach((item, index) => {
    const option = linked.options[index];
    const itemLabel = `${label}, option ${index} (${option.id})`;
    expect(item.tagName, itemLabel).toBe("LI");
    const buttons = Array.from(item.children).filter((child) => child.tagName === "BUTTON");
    expect(buttons.length, itemLabel).toBe(1);
    const button = buttons[0];
    expect(button.getAttribute("data-testid"), itemLabel).toBe(`dialogue-option-${option.id}`);
    expect(visibleName(button), itemLabel).toBe(
      (option.fallback ? text.fallbackOption : option.text).replace(/\s+/g, " ").trim(),
    );
  });
}

/** Case `index` of a property: the generated call state and the presentation mode. */
function propertyCase(baseSeed: number, index: number): { generated: GeneratedCallState; mode: PresentationCaseMode } {
  const seed = caseSeed(baseSeed, index);
  const generated = generateCallState(seed);
  const mode: PresentationCaseMode = createLcg(seed ^ 0x5eed)() < 0.5 ? "model" : "fallback";
  return { generated, mode };
}

describe("call presentation content properties", () => {
  afterEach(() => {
    applyLocale("en");
  });

  it(
    "Property 1: the phone screen holds only call content (Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1, 7.1)",
    () => {
      const seen = { ringing: 0, callerLine: 0, withVoice: 0, hiddenLine: 0 };
      const locales = new Set<GameLocale>();
      for (let index = 0; index < PROPERTY_RUNS; index += 1) {
        const { generated, mode } = propertyCase(PROPERTY_1_SEED, index);
        const next = createLcg(caseSeed(PROPERTY_1_SEED, index) ^ 0x70ce);
        const voice = next() < 0.6 ? { muted: next() < 0.3, audible: next() < 0.6 } : null;
        const subtitlesEnabled = next() < 0.5;
        const rendered = renderCase(generated, mode, voice, subtitlesEnabled);
        try {
          checkPhoneScreenContent(rendered);
        } catch (error) {
          throw new Error(
            `Property 1 failed for case ${index} (seed 0x${generated.seed.toString(16)}): ${describeCallState(generated)}, mode ${mode}\n${String(error)}`,
          );
        } finally {
          cleanup();
        }
        locales.add(generated.locale);
        if (generated.state.call.status === "ringing") {
          seen.ringing += 1;
        } else {
          if (voice !== null) seen.withVoice += 1;
          const view = selectDialogueView(generated.state, getDisplayScenario(generated.locale));
          if (view !== null && view.callId === generated.callId && (view.speaker === "caller" || view.speaker === "npc")) {
            if (isSubtitleVisible({ subtitlesEnabled, audible: voice?.audible })) seen.callerLine += 1;
            else seen.hiddenLine += 1;
          }
        }
      }
      // The generator reaches both locales, ringing calls, voice controls and visible caller lines.
      expect([...locales].sort()).toEqual(["en", "vi"]);
      expect(seen.ringing).toBeGreaterThan(0);
      expect(seen.withVoice).toBeGreaterThan(0);
      expect(seen.callerLine).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
  it(
    "Property 3: the choice overlay mirrors the dialogue options (Requirements 3.1, 3.2, 3.6, 3.10, 7.10, 13.2)",
    () => {
      const seen = { ringing: 0, withOptions: 0 };
      const locales = new Set<GameLocale>();
      for (let index = 0; index < PROPERTY_RUNS; index += 1) {
        const { generated, mode } = propertyCase(PROPERTY_3_SEED, index);
        const rendered = renderCase(generated, mode);
        try {
          checkChoiceOverlay(rendered);
        } catch (error) {
          throw new Error(
            `Property 3 failed for case ${index} (seed 0x${generated.seed.toString(16)}): ${describeCallState(generated)}, mode ${mode}\n${String(error)}`,
          );
        } finally {
          cleanup();
        }
        locales.add(generated.locale);
        if (generated.state.call.status === "ringing") {
          seen.ringing += 1;
        } else {
          const view = selectDialogueView(generated.state, getDisplayScenario(generated.locale));
          if (view !== null && view.callId === generated.callId && view.options.length > 0) {
            seen.withOptions += 1;
          }
        }
      }
      // The generator reaches both locales, ringing calls and active calls with options.
      expect([...locales].sort()).toEqual(["en", "vi"]);
      expect(seen.ringing).toBeGreaterThan(0);
      expect(seen.withOptions).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

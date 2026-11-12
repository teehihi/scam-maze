// Feature: game-phone-call-ui-redesign, Property 2: Subtitle visibility and content
//
// For seeded generated call states (src/test/callStates.ts), random `subtitlesEnabled` and
// `audible` (including "no voice controller", where `audible` is undefined), the subtitle region
// holds exactly the current Caller_Line iff the node is a Caller_Line and the subtitles are
// visible; `isSubtitleVisible` equals `subtitlesEnabled || !audible` (and is true when `audible`
// is undefined); `deriveCallDialogueView` never returns an earlier line.
// Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { selectDialogueView } from "../../../game/narrative/selectors";
import { createChapterStore } from "../../../game/narrative/store";
import type { VoiceSnapshot } from "../../../game/voice/VoiceDialoguePlayer";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import {
  CALL_STATE_SEED,
  describeCallState,
  generateCallState,
  type GeneratedCallState,
} from "../../../test/callStates";
import { caseSeed, runSequence } from "../../../test/chapterRuns";
import { createLcg, pick } from "../../../test/seededRandom";
import { deriveCallDialogueView, isSubtitleVisible } from "./callDialogueView";
import { CallPresentation, type CallVoiceProps } from "./CallPresentation";
import { createPhoneScreenSink } from "./phoneScreenSink";

const PROPERTY_TIMEOUT_MS = 60_000;
const PROPERTY_RUNS = 120;
const PROPERTY_2_SEED = (CALL_STATE_SEED ^ 0x0c0a0102) >>> 0;

type AudibleMode = boolean | undefined;

function voiceProps(audible: boolean): CallVoiceProps {
  const snapshot: VoiceSnapshot = {
    phase: "paused",
    targetKey: null,
    source: "clip",
    label: "none",
    reason: null,
    muted: false,
    audible,
    durationMs: null,
    endedCount: 0,
  };
  const noop = () => undefined;
  return {
    snapshot,
    muted: false,
    unlock: () => Promise.resolve(),
    replay: noop,
    setMuted: noop,
    optionsWaiting: false,
    skipWait: noop,
  };
}

function checkCase(generated: GeneratedCallState, subtitlesEnabled: boolean, audible: AudibleMode): void {
  const { state, locale, callId } = generated;
  const scenario = getDisplayScenario(locale);
  const callDef = scenario.calls[callId];
  const view = selectDialogueView(state, scenario);
  const linked = view !== null && view.callId === callId ? view : null;
  const isCallerLine = linked !== null && (linked.speaker === "caller" || linked.speaker === "npc");

  // Pure visibility rule.
  const expectedVisible = audible === undefined ? true : subtitlesEnabled || !audible;
  expect(isSubtitleVisible({ subtitlesEnabled, audible })).toBe(expectedVisible);

  // Pure derivation: the subtitle is the current Caller_Line, never an earlier one.
  const derived = deriveCallDialogueView({ call: state.call, callDef, dialogueView: view });
  if (state.call.status === "active" && isCallerLine && linked !== null) {
    expect(derived.subtitle.kind).toBe("line");
    if (derived.subtitle.kind === "line") {
      expect(derived.subtitle.text).toBe(linked.line);
      expect(derived.subtitle.nodeKey).toBe(`${linked.graphId}:${linked.nodeId}`);
    }
    // The state one step earlier may show another node; the current one must not match it.
    if (generated.walk.length > 0) {
      const earlierState = runSequence(generated.actions.slice(0, -1)).final;
      const earlierView = selectDialogueView(earlierState, scenario);
      if (
        earlierView !== null &&
        derived.subtitle.kind === "line" &&
        `${earlierView.graphId}:${earlierView.nodeId}` !== derived.subtitle.nodeKey
      ) {
        expect(derived.subtitle.nodeKey).not.toBe(`${earlierView.graphId}:${earlierView.nodeId}`);
      }
    }
  } else {
    expect(derived.subtitle.kind).not.toBe("line");
  }

  // Rendered subtitle region.
  act(() => {
    applyLocale(locale);
  });
  const screenSink = createPhoneScreenSink();
  const noop = () => undefined;
  const { container } = render(
    <CallPresentation
      store={createChapterStore(state)}
      scenario={scenario}
      paused={false}
      modelAllowed={false}
      screenSink={screenSink}
      onAnswer={noop}
      onEnd={noop}
      onSelectOption={noop}
      subtitlesEnabled={subtitlesEnabled}
      voice={audible === undefined ? undefined : voiceProps(audible)}
    />,
  );
  const doc = container.ownerDocument;
  const overlay = doc.querySelector('[data-testid="call-subtitle-overlay"]');
  if (state.call.status !== "active") {
    expect(overlay).toBeNull();
    return;
  }
  expect(overlay).not.toBeNull();
  const region = doc.querySelector('[data-testid="call-subtitle-region"]') as HTMLElement;
  const lines = region.querySelectorAll('[data-testid="call-subtitle-line"]');
  if (isCallerLine && linked !== null && expectedVisible) {
    expect(lines.length).toBe(1);
    expect((lines[0].textContent ?? "").trim()).toBe(linked.line.trim());
    expect(region.textContent ?? "").toContain(linked.speakerName ?? callDef.displayName);
  } else {
    expect(lines.length).toBe(0);
    if (isCallerLine) expect((region.textContent ?? "").trim()).toBe("");
    if (linked !== null && linked.line.trim().length > 0 && !isCallerLine) {
      expect(region.textContent ?? "").not.toContain(linked.line);
    }
    if (!expectedVisible) expect((region.textContent ?? "").trim()).toBe("");
  }
}

describe("call subtitle properties", () => {
  afterEach(() => {
    cleanup();
    applyLocale("en");
  });

  it(
    "Property 2: subtitle visibility and content (Requirements 5.1, 5.2, 5.3, 5.4, 5.5)",
    () => {
      const seen = { shown: 0, hiddenByVoice: 0, noVoice: 0, noLine: 0 };
      for (let index = 0; index < PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(PROPERTY_2_SEED, index);
        const generated = generateCallState(seed);
        const next = createLcg(seed ^ 0x5ab7);
        const subtitlesEnabled = next() < 0.5;
        const audible: AudibleMode = pick(next, [true, false, undefined] as const);
        try {
          checkCase(generated, subtitlesEnabled, audible);
        } catch (error) {
          throw new Error(
            `Property 2 failed for case ${index} (seed 0x${seed.toString(16)}): ${describeCallState(generated)}, subtitlesEnabled ${subtitlesEnabled}, audible ${String(audible)}\n${String(error)}`,
          );
        } finally {
          cleanup();
        }
        if (audible === undefined) seen.noVoice += 1;
        else if (!subtitlesEnabled && audible) seen.hiddenByVoice += 1;
        const view = selectDialogueView(generated.state, getDisplayScenario(generated.locale));
        const callerLine =
          generated.state.call.status === "active" &&
          view !== null &&
          view.callId === generated.callId &&
          (view.speaker === "caller" || view.speaker === "npc");
        if (callerLine) seen.shown += 1;
        else seen.noLine += 1;
      }
      expect(seen.shown).toBeGreaterThan(0);
      expect(seen.noLine).toBeGreaterThan(0);
      expect(seen.noVoice).toBeGreaterThan(0);
      expect(seen.hiddenByVoice).toBeGreaterThan(0);
    },
    PROPERTY_TIMEOUT_MS,
  );

  it("isSubtitleVisible is true when audible is undefined, else subtitlesEnabled || !audible", () => {
    for (const subtitlesEnabled of [true, false]) {
      expect(isSubtitleVisible({ subtitlesEnabled, audible: undefined })).toBe(true);
      for (const audible of [true, false]) {
        expect(isSubtitleVisible({ subtitlesEnabled, audible })).toBe(subtitlesEnabled || !audible);
      }
    }
  });
});

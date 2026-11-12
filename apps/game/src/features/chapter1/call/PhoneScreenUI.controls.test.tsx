// PhoneScreenUI voice controls tests (task 18.11). Requirements 7.1, 7.2, 7.3, 7.4, 7.9, 11.9.
//
// Covers the optional `controls` prop (`CallControlsView`): duration timer, Mute, Replay, the
// caption gate, the notice line, both locales, and the rule that player options never appear in
// the phone tree. Layout numbers come from `computeCallLayout`; jsdom does no layout, so the
// compact check asserts the numbers and the structure that lets the caption region keep its space.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { applyLocale } from "../../../i18n";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import { computeCallLayout } from "./callLayout";
import {
  PhoneScreenUI,
  type CallControlsView,
  type CallScreenView,
  type PhoneScreenUIProps,
} from "./PhoneScreenUI";

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const PHONE_TEXT = { en: enPhone.phone, vi: viPhone.phone } as const;
const EMOJI = /\p{Extended_Pictographic}/u;
// Fictional reserved-style number (+000) and caller data; the view is plain data here.
const NUMBER = "+000 555 0100";
const LINE_TEXT = "Your account needs a quick check. Please stay on the line.";

const ringingView: CallScreenView = { status: "ringing", callerName: "Unit Desk", number: NUMBER };
const activeView: CallScreenView = {
  status: "active",
  callerName: "Unit Desk",
  number: NUMBER,
  line: { speakerName: "Unit Desk", text: LINE_TEXT },
};

function controlsView(overrides: Partial<CallControlsView> = {}): CallControlsView {
  return {
    durationSeconds: 0,
    muted: false,
    replayEnabled: true,
    captionVisible: true,
    notice: "none",
    compact: false,
    ...overrides,
  };
}

function renderScreen(props: Partial<PhoneScreenUIProps> & { view: CallScreenView }) {
  const handlers = { onAccept: vi.fn(), onDecline: vi.fn(), onHangUp: vi.fn() };
  const all: PhoneScreenUIProps = { disabled: false, vibrateIcon: false, ...handlers, ...props };
  const result = render(<PhoneScreenUI {...all} />);
  const rerender = (next: Partial<PhoneScreenUIProps>) => result.rerender(<PhoneScreenUI {...all} {...next} />);
  return { ...result, ...handlers, rerender };
}

function switchLocale(locale: GameLocale): void {
  act(() => {
    applyLocale(locale);
  });
}

describe("PhoneScreenUI voice controls", () => {
  for (const locale of LOCALES) {
    const text = PHONE_TEXT[locale];

    describe(`locale ${locale}`, () => {
      it("shows the ringing items and no voice controls", () => {
        switchLocale(locale);
        renderScreen({ view: ringingView, controls: controlsView() });
        const section = screen.getByTestId("incoming-call-screen");
        expect(within(section).getByText(text.incomingCall.caption)).toBeTruthy();
        expect(within(section).getAllByRole("button").map((b) => b.textContent)).toEqual([
          text.incomingCall.decline,
          text.incomingCall.accept,
        ]);
        expect(screen.queryByTestId("call-duration")).toBeNull();
        expect(screen.queryByTestId("call-screen-mute")).toBeNull();
        expect(screen.queryByTestId("call-screen-replay")).toBeNull();
        expect(screen.queryByTestId("call-notice")).toBeNull();
      });

      it("shows the active content with Mute, Replay and Hang up in order", () => {
        switchLocale(locale);
        renderScreen({ view: activeView, controls: controlsView() });
        const section = screen.getByTestId("call-screen");
        expect(within(section).getByText(text.call.status)).toBeTruthy();
        expect(within(section).getByTestId("dialogue-line").textContent).toContain(LINE_TEXT);
        expect(within(section).getAllByRole("button").map((b) => b.textContent)).toEqual([
          text.call.mute,
          text.call.replay,
          text.call.hangUp,
        ]);
      });

      it("shows the duration as a labelled timer in whole minutes and seconds", () => {
        switchLocale(locale);
        const { rerender } = renderScreen({ view: activeView, controls: controlsView({ durationSeconds: 0 }) });
        const timer = screen.getByTestId("call-duration");
        expect(timer.tagName).toBe("TIME");
        expect(timer.getAttribute("role")).toBe("timer");
        expect(timer.getAttribute("aria-label")).toBe(text.call.duration);
        expect(screen.getByRole("timer", { name: text.call.duration })).toBe(timer);
        expect(timer.textContent).toBe("0:00");
        expect(timer.getAttribute("datetime")).toBe("PT0M0S");

        rerender({ view: activeView, controls: controlsView({ durationSeconds: 65.9 }) });
        expect(screen.getByTestId("call-duration")).toBe(timer);
        expect(timer.textContent).toBe("1:05");
        expect(timer.getAttribute("datetime")).toBe("PT1M5S");

        rerender({ view: activeView, controls: controlsView({ durationSeconds: 600 }) });
        expect(timer.textContent).toBe("10:00");
      });

      it("switches Mute between pressed and not pressed with a matching label", () => {
        switchLocale(locale);
        const onToggleMute = vi.fn();
        const { rerender } = renderScreen({
          view: activeView,
          controls: controlsView({ muted: false }),
          onToggleMute,
        });
        const mute = screen.getByTestId("call-screen-mute");
        expect(mute.getAttribute("aria-pressed")).toBe("false");
        expect(mute.textContent).toBe(text.call.mute);
        expect(mute.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

        fireEvent.click(mute);
        expect(onToggleMute).toHaveBeenCalledTimes(1);

        rerender({ view: activeView, controls: controlsView({ muted: true }), onToggleMute });
        const muted = screen.getByTestId("call-screen-mute");
        expect(muted.getAttribute("aria-pressed")).toBe("true");
        expect(muted.textContent).toBe(text.call.unmute);
      });

      it("disables Replay when it is not available or the page is paused", () => {
        switchLocale(locale);
        const onReplay = vi.fn();
        const { rerender } = renderScreen({
          view: activeView,
          controls: controlsView({ replayEnabled: true }),
          onReplay,
        });
        const replay = screen.getByTestId("call-screen-replay") as HTMLButtonElement;
        expect(replay.textContent).toBe(text.call.replay);
        expect(replay.disabled).toBe(false);
        fireEvent.click(replay);
        expect(onReplay).toHaveBeenCalledTimes(1);

        rerender({ view: activeView, controls: controlsView({ replayEnabled: false }), onReplay });
        expect((screen.getByTestId("call-screen-replay") as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByTestId("call-screen-replay"));

        rerender({ view: activeView, controls: controlsView({ replayEnabled: true }), onReplay, disabled: true });
        expect((screen.getByTestId("call-screen-replay") as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByTestId("call-screen-mute") as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByTestId("call-screen-replay"));
        expect(onReplay).toHaveBeenCalledTimes(1);
      });

      it("hides the caption only when captionVisible is false", () => {
        switchLocale(locale);
        const { rerender } = renderScreen({ view: activeView, controls: controlsView({ captionVisible: true }) });
        expect(screen.getByTestId("dialogue-line").textContent).toContain(LINE_TEXT);

        rerender({ view: activeView, controls: controlsView({ captionVisible: false }) });
        const region = screen.getByTestId("call-line-region");
        expect(region.textContent).toBe("");
        expect(screen.queryByTestId("dialogue-line")).toBeNull();
        // The live region node and the other controls stay.
        expect(screen.getByTestId("call-screen-mute")).toBeTruthy();
        expect(screen.getByTestId("call-duration")).toBeTruthy();

        // The connecting text is a caption too, so it follows the same gate.
        rerender({ view: { ...activeView, line: "connecting" }, controls: controlsView({ captionVisible: false }) });
        expect(screen.getByTestId("call-line-region").textContent).toBe("");
        rerender({ view: { ...activeView, line: "connecting" }, controls: controlsView({ captionVisible: true }) });
        expect(screen.getByTestId("call-line-region").textContent).toBe(text.call.connecting);
      });

      it("shows each notice text in a polite region and nothing for none", () => {
        switchLocale(locale);
        const { rerender } = renderScreen({ view: activeView, controls: controlsView({ notice: "none" }) });
        const notice = screen.getByTestId("call-notice");
        expect(notice.getAttribute("aria-live")).toBe("polite");
        expect(notice.textContent).toBe("");

        const expected = {
          "autoplay-blocked": text.call.notice.autoplayBlocked,
          "dev-preview": text.call.notice.devPreview,
          "english-voice": text.call.notice.englishVoice,
          "no-audio": text.call.notice.noAudio,
        } as const;
        for (const [key, message] of Object.entries(expected)) {
          rerender({ view: activeView, controls: controlsView({ notice: key as keyof typeof expected }) });
          expect(screen.getByTestId("call-notice")).toBe(notice);
          expect(notice.textContent).toBe(message);
          expect(message.length).toBeGreaterThan(0);
        }
      });

      it("keeps the number as plain text, adds no player option and no emoji", () => {
        switchLocale(locale);
        const { container } = renderScreen({
          view: activeView,
          controls: controlsView({ notice: "english-voice", durationSeconds: 7 }),
        });
        const number = screen.getByTestId("call-screen-number");
        expect(number.tagName).toBe("P");
        expect(number.getAttribute("dir")).toBe("ltr");
        expect(number.textContent).toBe(NUMBER);
        expect(number.closest("a")).toBeNull();
        expect(container.querySelector("a")).toBeNull();
        expect(container.innerHTML).not.toContain("tel:");

        // Player options and the choice overlay live outside the phone tree (Requirement 3).
        expect(container.querySelector('[data-testid^="dialogue-option-"]')).toBeNull();
        expect(container.querySelector('[data-testid="player-choice-overlay"]')).toBeNull();
        expect(container.querySelector('[data-testid="choice-skip-wait"]')).toBeNull();

        const labels = Array.from(container.querySelectorAll("[aria-label],[title],[alt]")).flatMap((el) =>
          ["aria-label", "title", "alt"].map((name) => el.getAttribute(name) ?? ""),
        );
        expect(EMOJI.test([container.textContent ?? "", ...labels].join(" "))).toBe(false);
        for (const icon of container.querySelectorAll("svg")) expect(icon.getAttribute("aria-hidden")).toBe("true");
        for (const element of container.querySelectorAll("*")) {
          expect(element.getAttribute("class") ?? "").not.toMatch(/(^|\s)text-xs(\s|$)/);
        }
      });
    });
  }

  it("renders as before when the optional props are absent", () => {
    switchLocale("en");
    renderScreen({ view: activeView });
    expect(screen.queryByTestId("call-duration")).toBeNull();
    expect(screen.queryByTestId("call-notice")).toBeNull();
    expect(screen.queryByTestId("call-screen-mute")).toBeNull();
    expect(screen.queryByTestId("call-screen-replay")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([enPhone.phone.call.hangUp]);
    expect(screen.getByTestId("dialogue-line").textContent).toContain(LINE_TEXT);
    // The avatar is shown when there is no controls prop.
    expect(screen.getByTestId("call-screen").querySelector("header > div[aria-hidden='true']")).not.toBeNull();
  });

  it("compact mode hides the avatar and keeps a scrollable caption region at screen height 288", () => {
    switchLocale("en");
    // 360 x 400 is a narrow viewport where the minimum screen height of 288 applies.
    const layout = computeCallLayout({ width: 360, height: 400 });
    expect(layout.kind).toBe("narrow");
    expect(layout.screen.height).toBe(288);

    renderScreen({ view: activeView, controls: controlsView({ compact: true }) });
    const section = screen.getByTestId("call-screen");
    expect(section.querySelector("header > div[aria-hidden='true']")).toBeNull();

    // The caption region takes the free height and scrolls, so two lines stay reachable.
    const region = screen.getByTestId("call-line-region");
    expect(region.className).toContain("flex-1");
    expect(region.className).toContain("min-h-0");
    expect(region.className).toContain("overflow-y-auto");
    // Two caption lines at `text-sm leading-relaxed` (20 px x 1.625) need at least 40 px.
    const twoLines = 2 * 14 * 1.625;
    expect(twoLines).toBeLessThanOrEqual(layout.screen.height);
  });
});

// PhoneCallScreen voice controls tests. Requirements 3.1, 3.2, 3.4-3.9, 4.4, 4.6, 8.4, 10.1.
//
// Covers the optional `controls` prop (`CallControlsView`): the exact button set and order,
// pressed states, Replay availability, handlers, the paused state, the compact layout, accessible
// names in both locales and reduced motion. The phone shows no caller line, connecting text or
// notice (those live in CallSubtitleOverlay), and player options never appear in the phone tree.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { applyLocale } from "../../../i18n";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import { mockReducedMotion, restoreMatchMedia } from "../../../test/loadingRuns";
import type { PhoneCallView } from "./callDialogueView";
import { PhoneCallScreen, type CallControlsView, type PhoneCallScreenProps } from "./PhoneCallScreen";

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const PHONE_TEXT = { en: enPhone.phone, vi: viPhone.phone } as const;
const EMOJI = /\p{Extended_Pictographic}/u;
// Fictional reserved-style number (+000) and caller data; the view is plain data here.
const NUMBER = "+000 555 0100";

const ringingView: PhoneCallView = { status: "ringing", callerName: "Unit Desk", number: NUMBER };
const activeView: PhoneCallView = { status: "active", callerName: "Unit Desk", number: NUMBER };

function controlsView(overrides: Partial<CallControlsView> = {}): CallControlsView {
  return {
    durationSeconds: 0,
    muted: false,
    speakerOn: false,
    replayEnabled: true,
    compact: false,
    ...overrides,
  };
}

function renderScreen(props: Partial<PhoneCallScreenProps> & { view: PhoneCallView }) {
  const handlers = { onAccept: vi.fn(), onDecline: vi.fn(), onHangUp: vi.fn() };
  const all: PhoneCallScreenProps = { disabled: false, vibrateIcon: false, ...handlers, ...props };
  const result = render(<PhoneCallScreen {...all} />);
  const rerender = (next: Partial<PhoneCallScreenProps>) =>
    result.rerender(<PhoneCallScreen {...all} {...next} />);
  return { ...result, ...handlers, rerender };
}

function switchLocale(locale: GameLocale): void {
  act(() => {
    applyLocale(locale);
  });
}

afterEach(() => {
  restoreMatchMedia();
});

describe("PhoneCallScreen voice controls", () => {
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
        expect(screen.queryByTestId("call-screen-speaker")).toBeNull();
        expect(screen.queryByTestId("call-screen-replay")).toBeNull();
      });

      it("shows exactly Mute, Speaker, Replay and End call in that order", () => {
        switchLocale(locale);
        renderScreen({ view: activeView, controls: controlsView() });
        const section = screen.getByTestId("call-screen");
        expect(within(section).getByText(text.call.status)).toBeTruthy();
        const buttons = within(section).getAllByRole("button");
        expect(buttons.map((b) => b.getAttribute("data-testid"))).toEqual([
          "call-screen-mute",
          "call-screen-speaker",
          "call-screen-replay",
          "call-screen-hang-up",
        ]);
        expect(buttons.map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual([
          text.call.mute,
          text.call.speaker,
          text.call.replayAria,
          text.call.hangUp,
        ]);
        // The phone shows no caller line, connecting text or notice.
        expect(screen.queryByTestId("call-line-region")).toBeNull();
        expect(screen.queryByTestId("dialogue-line")).toBeNull();
        expect(screen.queryByTestId("call-notice")).toBeNull();
        expect(section.textContent).not.toContain(text.call.connecting);
      });

      it("puts the visible label of each round button in its accessible name", () => {
        switchLocale(locale);
        renderScreen({ view: activeView, controls: controlsView() });
        const section = screen.getByTestId("call-screen");
        const expected = [
          ["call-screen-mute", text.call.mute],
          ["call-screen-speaker", text.call.speaker],
          ["call-screen-replay", text.call.replay],
        ] as const;
        for (const [testId, visible] of expected) {
          const button = screen.getByTestId(testId);
          expect(within(section).getAllByText(visible).length).toBeGreaterThan(0);
          const name = screen.getByRole("button", { name: new RegExp(visible, "i") });
          expect(name).toBe(button);
        }
        expect(screen.getByRole("button", { name: text.call.replayAria })).toBe(
          screen.getByTestId("call-screen-replay"),
        );
        expect(screen.getByRole("button", { name: text.call.hangUp })).toBe(
          screen.getByTestId("call-screen-hang-up"),
        );
        expect(screen.getByTestId("call-screen-hang-up").textContent).toContain(text.call.hangUp);
      });

      it("shows the duration as a labelled mm:ss timer", () => {
        switchLocale(locale);
        const { rerender } = renderScreen({ view: activeView, controls: controlsView({ durationSeconds: 0 }) });
        const timer = screen.getByTestId("call-duration");
        expect(timer.tagName).toBe("TIME");
        expect(timer.getAttribute("role")).toBe("timer");
        expect(timer.getAttribute("aria-label")).toBe(text.call.duration);
        expect(screen.getByRole("timer", { name: text.call.duration })).toBe(timer);
        expect(timer.textContent).toBe("00:00");

        rerender({ view: activeView, controls: controlsView({ durationSeconds: 65.9 }) });
        expect(screen.getByTestId("call-duration")).toBe(timer);
        expect(timer.textContent).toBe("01:05");

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
        expect(mute.getAttribute("aria-label")).toBe(text.call.mute);
        expect(mute.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

        fireEvent.click(mute);
        expect(onToggleMute).toHaveBeenCalledTimes(1);

        rerender({ view: activeView, controls: controlsView({ muted: true }), onToggleMute });
        const muted = screen.getByTestId("call-screen-mute");
        expect(muted.getAttribute("aria-pressed")).toBe("true");
        expect(muted.getAttribute("aria-label")).toBe(text.call.unmute);
      });

      it("switches Speaker between pressed and not pressed and calls its handler once", () => {
        switchLocale(locale);
        const onToggleSpeaker = vi.fn();
        const { rerender } = renderScreen({
          view: activeView,
          controls: controlsView({ speakerOn: false }),
          onToggleSpeaker,
        });
        const speaker = screen.getByTestId("call-screen-speaker");
        expect(speaker.getAttribute("aria-pressed")).toBe("false");
        expect(speaker.getAttribute("aria-label")).toBe(text.call.speaker);

        fireEvent.click(speaker);
        expect(onToggleSpeaker).toHaveBeenCalledTimes(1);

        rerender({ view: activeView, controls: controlsView({ speakerOn: true }), onToggleSpeaker });
        expect(screen.getByTestId("call-screen-speaker").getAttribute("aria-pressed")).toBe("true");
      });

      it("disables Replay without audio and calls the handlers once", () => {
        switchLocale(locale);
        const onReplay = vi.fn();
        const { rerender, onHangUp } = renderScreen({
          view: activeView,
          controls: controlsView({ replayEnabled: true }),
          onReplay,
        });
        const replay = screen.getByTestId("call-screen-replay") as HTMLButtonElement;
        expect(replay.disabled).toBe(false);
        expect(replay.hasAttribute("aria-pressed")).toBe(false);
        fireEvent.click(replay);
        expect(onReplay).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByTestId("call-screen-hang-up"));
        expect(onHangUp).toHaveBeenCalledTimes(1);

        rerender({ view: activeView, controls: controlsView({ replayEnabled: false }), onReplay });
        const noAudio = screen.getByTestId("call-screen-replay") as HTMLButtonElement;
        expect(noAudio.disabled).toBe(true);
        fireEvent.click(noAudio);
        expect(onReplay).toHaveBeenCalledTimes(1);
        // The other buttons stay enabled.
        expect((screen.getByTestId("call-screen-mute") as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByTestId("call-screen-speaker") as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByTestId("call-screen-hang-up") as HTMLButtonElement).disabled).toBe(false);
      });

      it("disables every button and ignores clicks while paused", () => {
        switchLocale(locale);
        const onToggleMute = vi.fn();
        const onToggleSpeaker = vi.fn();
        const onReplay = vi.fn();
        const { onHangUp } = renderScreen({
          view: activeView,
          controls: controlsView(),
          disabled: true,
          onToggleMute,
          onToggleSpeaker,
          onReplay,
        });
        const buttons = within(screen.getByTestId("call-screen")).getAllByRole("button") as HTMLButtonElement[];
        expect(buttons).toHaveLength(4);
        for (const button of buttons) {
          expect(button.disabled).toBe(true);
          fireEvent.click(button);
        }
        expect(onToggleMute).not.toHaveBeenCalled();
        expect(onToggleSpeaker).not.toHaveBeenCalled();
        expect(onReplay).not.toHaveBeenCalled();
        expect(onHangUp).not.toHaveBeenCalled();
      });

      it("keeps the number as plain text, adds no player option and no emoji", () => {
        switchLocale(locale);
        const { container } = renderScreen({ view: activeView, controls: controlsView({ durationSeconds: 7 }) });
        const number = screen.getByTestId("call-screen-number");
        expect(number.tagName).toBe("P");
        expect(number.getAttribute("dir")).toBe("ltr");
        expect(number.textContent).toBe(NUMBER);
        expect(number.closest("a")).toBeNull();
        expect(container.querySelector("a")).toBeNull();
        expect(container.innerHTML).not.toContain("tel:");

        // Player options and the choice overlay live outside the phone tree.
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

  it("shows End call only, with no timer, when the controls prop is absent", () => {
    switchLocale("en");
    renderScreen({ view: activeView });
    expect(screen.queryByTestId("call-duration")).toBeNull();
    expect(screen.queryByTestId("call-screen-mute")).toBeNull();
    expect(screen.queryByTestId("call-screen-speaker")).toBeNull();
    expect(screen.queryByTestId("call-screen-replay")).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([enPhone.phone.call.hangUp]);
    expect(screen.getByTestId("call-screen-avatar")).toBeTruthy();
  });

  it("compact layout keeps the timer, avatar and all four buttons with smaller sizes", () => {
    switchLocale("en");
    renderScreen({ view: activeView, controls: controlsView({ compact: true, durationSeconds: 75 }) });
    const section = screen.getByTestId("call-screen");
    expect(within(section).getByTestId("call-duration").textContent).toBe("01:15");
    expect(within(section).getByTestId("call-screen-avatar")).toBeTruthy();
    expect(within(section).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByTestId("call-screen-avatar").className).toContain("h-14");
    expect(screen.getByTestId("call-screen-mute").className).toContain("h-11");
    expect(screen.getByTestId("call-screen-hang-up").className).toContain("h-11");
  });

  it("regular layout uses the larger avatar and button sizes", () => {
    switchLocale("en");
    renderScreen({ view: activeView, controls: controlsView({ compact: false }) });
    expect(screen.getByTestId("call-screen-avatar").className).toContain("h-20");
    expect(screen.getByTestId("call-screen-mute").className).toContain("h-14");
  });

  it("wobbles the ringing avatar only when allowed and not under reduced motion", () => {
    switchLocale("en");
    mockReducedMotion(false);
    const first = renderScreen({ view: ringingView, vibrateIcon: true });
    const icon = screen.getByTestId("incoming-call-icon");
    expect(icon.getAttribute("data-vibrating")).toBe("true");
    expect(icon.style.animation).toContain("scammaze-call-screen-vibrate");
    first.unmount();

    const noVibrate = renderScreen({ view: ringingView, vibrateIcon: false });
    expect(screen.getByTestId("incoming-call-icon").getAttribute("data-vibrating")).toBe("false");
    noVibrate.unmount();

    mockReducedMotion(true);
    const reduced = renderScreen({ view: ringingView, vibrateIcon: true });
    const still = screen.getByTestId("incoming-call-icon");
    expect(still.getAttribute("data-vibrating")).toBe("false");
    expect(still.style.animation).toBe("");
    expect(reduced.container.querySelector("style")).toBeNull();
  });
});

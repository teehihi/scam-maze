// PhoneCallScreen unit tests (task 5.1). Requirements 1.1 to 1.6, 2.1, 2.5 and 3.10.
//
// The views are built from the real Chapter 1 display scenario (English source and the `vi`
// narrative overlay), so the caller name, the number and the Caller_Line are scenario data.
// Button-row behavior (Mute, Speaker, Replay, compact) lives in PhoneCallScreen.controls.test.tsx.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import type { CallId } from "../../../game/narrative/chapter1/ids";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import { PhoneCallScreen, type PhoneCallScreenProps } from "./PhoneCallScreen";
import type { PhoneCallView } from "./callDialogueView";

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const PHONE_TEXT = { en: enPhone.phone, vi: viPhone.phone } as const;
const CALL_ID: CallId = "call.scam-1";
const FORBIDDEN_WORDS = ["safe", "verified", "trusted", "an toàn"];
const EMOJI = /\p{Extended_Pictographic}/u;

/** Caller display name, number and the first Caller_Line text of the scam call. */
function callData(locale: GameLocale) {
  const scenario = getDisplayScenario(locale);
  const call = scenario.calls[CALL_ID];
  const graph = scenario.dialogues[call.graphId];
  const lineTexts: string[] = [];
  for (const node of Object.values(graph.nodes)) {
    if (node.speaker === "caller" && !lineTexts.includes(graph.lines[node.lineId])) {
      lineTexts.push(graph.lines[node.lineId]);
    }
  }
  expect(lineTexts.length).toBeGreaterThanOrEqual(1);
  return { callerName: call.displayName, number: call.number, lineTexts };
}

function view(locale: GameLocale, status: PhoneCallView["status"]): PhoneCallView {
  const { callerName, number } = callData(locale);
  return { status, callerName, number };
}

function renderScreen(props: Partial<PhoneCallScreenProps> & { view: PhoneCallView }) {
  const handlers = { onAccept: vi.fn(), onDecline: vi.fn(), onHangUp: vi.fn() };
  const all: PhoneCallScreenProps = { disabled: false, vibrateIcon: false, ...handlers, ...props };
  const result = render(<PhoneCallScreen {...all} />);
  return { ...result, ...handlers };
}

function switchLocale(locale: GameLocale): void {
  act(() => {
    applyLocale(locale);
  });
}

/** All visible text plus every accessible-name attribute in the tree. */
function allText(root: HTMLElement): string {
  const labels = Array.from(root.querySelectorAll("[aria-label],[title],[alt]")).flatMap((element) =>
    ["aria-label", "title", "alt"].map((name) => element.getAttribute(name) ?? ""),
  );
  return [root.textContent ?? "", ...labels].join(" ");
}

/** Checks shared by both call states: number, icons, emoji, text size, trust words, no lines. */
function expectCommonRules(root: HTMLElement, locale: GameLocale): void {
  const { number, lineTexts } = callData(locale);

  // Number: plain text, `dir="ltr"`, one line, no link, no `tel:`, no tab stop.
  const numberNode = within(root).getByText(number);
  expect(numberNode.tagName).toBe("P");
  expect(numberNode.getAttribute("dir")).toBe("ltr");
  expect(numberNode.className).toContain("whitespace-nowrap");
  expect(numberNode.closest("a")).toBeNull();
  expect(numberNode.hasAttribute("tabindex")).toBe(false);
  expect(root.querySelector("a")).toBeNull();
  expect(root.querySelector("[href]")).toBeNull();
  expect(root.innerHTML).not.toContain("tel:");
  numberNode.focus();
  expect(document.activeElement).not.toBe(numberNode);

  // No caller line, no live region and no scrolling region on the phone.
  expect(within(root).queryByTestId("call-line-region")).toBeNull();
  expect(within(root).queryByTestId("dialogue-line")).toBeNull();
  expect(root.querySelector("[aria-live]")).toBeNull();
  expect(root.querySelector("[class*='overflow-y-auto'],[class*='overflow-auto'],[class*='overflow-y-scroll']")).toBeNull();
  for (const line of lineTexts) expect(root.textContent).not.toContain(line);

  // Icons: every lucide svg is hidden from assistive technology.
  const icons = root.querySelectorAll("svg");
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");

  const text = allText(root);
  expect(EMOJI.test(text)).toBe(false);
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word);

  // No text smaller than `text-sm` (Requirement 1.6).
  for (const element of root.querySelectorAll("*")) {
    expect(element.getAttribute("class") ?? "").not.toMatch(/(^|\s)text-xs(\s|$)/);
  }
}

describe("PhoneCallScreen", () => {
  for (const locale of LOCALES) {
    const text = PHONE_TEXT[locale];

    describe(`locale ${locale}`, () => {
      it("shows exactly the ringing items", () => {
        switchLocale(locale);
        const { callerName, number } = callData(locale);
        const { container } = renderScreen({ view: view(locale, "ringing") });
        const section = screen.getByRole("region", { name: text.callPresentation.screenLabel });
        expect(section).toBe(container.firstElementChild);
        expect(section.dataset.testid).toBe("incoming-call-screen");

        expect(within(section).getByText(text.incomingCall.caption)).toBeTruthy();
        expect(within(section).getByTestId("incoming-call-name").textContent).toBe(callerName);
        expect(within(section).getByTestId("incoming-call-number").textContent).toBe(number);
        const icon = within(section).getByTestId("incoming-call-icon");
        expect(icon.querySelector("[data-testid='call-screen-avatar']")).not.toBeNull();
        expect(icon.querySelector("svg")).not.toBeNull();

        // Decline is a red button labeled "Decline"; it sits before Accept.
        const buttons = within(section).getAllByRole("button");
        expect(buttons.map((button) => button.textContent)).toEqual([text.incomingCall.decline, text.incomingCall.accept]);
        expect(within(section).getByTestId("incoming-call-decline").textContent).toBe(text.incomingCall.decline);
        expect(within(section).getByTestId("incoming-call-accept").textContent).toBe(text.incomingCall.accept);
        expect(within(section).queryByText(text.call.status)).toBeNull();
        expect(within(section).queryByTestId("call-duration")).toBeNull();

        expectCommonRules(section, locale);
      });

      it("shows exactly the active items with avatar, name, number, status and timer", () => {
        switchLocale(locale);
        const { callerName, number } = callData(locale);
        renderScreen({
          view: view(locale, "active"),
          controls: { durationSeconds: 65, muted: false, speakerOn: false, replayEnabled: true, compact: false },
        });
        const section = screen.getByRole("region", { name: text.callPresentation.screenLabel });
        expect(section.dataset.testid).toBe("call-screen");

        expect(within(section).getByTestId("call-screen-avatar").querySelector("svg")).not.toBeNull();
        expect(within(section).getByText(callerName)).toBeTruthy();
        expect(within(section).getByTestId("call-screen-number").textContent).toBe(number);
        expect(within(section).getByText(text.call.status)).toBeTruthy();

        const timer = within(section).getByTestId("call-duration");
        expect(timer.textContent).toBe("01:05");
        expect(timer.textContent).toMatch(/^\d{2,}:\d{2}$/);
        expect(timer.getAttribute("role")).toBe("timer");
        expect(timer.getAttribute("aria-label")).toBe(text.call.duration);

        expect(within(section).queryByText(text.incomingCall.accept)).toBeNull();
        expect(within(section).queryByText(text.incomingCall.decline)).toBeNull();
        expect(within(section).queryByText(text.incomingCall.caption)).toBeNull();
        expect(within(section).getByTestId("call-screen-hang-up").textContent).toBe(text.call.hangUp);

        expectCommonRules(section, locale);
      });

      it("shows End call only and no timer when there are no controls", () => {
        switchLocale(locale);
        renderScreen({ view: view(locale, "active") });
        const section = screen.getByRole("region", { name: text.callPresentation.screenLabel });
        expect(within(section).getAllByRole("button").map((button) => button.textContent)).toEqual([
          text.call.hangUp,
        ]);
        expect(within(section).queryByTestId("call-duration")).toBeNull();
        expectCommonRules(section, locale);
      });

      it("calls each handler once when its enabled button is activated", () => {
        switchLocale(locale);
        const ringing = renderScreen({ view: view(locale, "ringing") });
        fireEvent.click(screen.getByTestId("incoming-call-accept"));
        fireEvent.click(screen.getByTestId("incoming-call-decline"));
        expect(ringing.onAccept).toHaveBeenCalledTimes(1);
        expect(ringing.onDecline).toHaveBeenCalledTimes(1);
        expect(ringing.onHangUp).not.toHaveBeenCalled();
        ringing.unmount();

        const active = renderScreen({ view: view(locale, "active") });
        fireEvent.click(screen.getByRole("button", { name: text.call.hangUp }));
        expect(active.onHangUp).toHaveBeenCalledTimes(1);
      });

      it("disables every call button while paused and calls no handler", () => {
        switchLocale(locale);
        const ringing = renderScreen({ view: view(locale, "ringing"), disabled: true });
        const ringingButtons = screen.getAllByRole("button");
        expect(ringingButtons).toHaveLength(2);
        for (const button of ringingButtons) {
          expect((button as HTMLButtonElement).disabled).toBe(true);
          fireEvent.click(button);
        }
        ringing.unmount();

        const active = renderScreen({ view: view(locale, "active"), disabled: true });
        const hangUp = screen.getByRole("button", { name: text.call.hangUp }) as HTMLButtonElement;
        expect(hangUp.disabled).toBe(true);
        fireEvent.click(hangUp);

        for (const handler of [
          ringing.onAccept,
          ringing.onDecline,
          ringing.onHangUp,
          active.onAccept,
          active.onDecline,
          active.onHangUp,
        ]) {
          expect(handler).not.toHaveBeenCalled();
        }
      });
    });
  }

  it("shows the same number characters in en and vi", () => {
    expect(callData("vi").number).toBe(callData("en").number);
    switchLocale("vi");
    renderScreen({ view: view("vi", "active") });
    expect(screen.getByTestId("call-screen-number").textContent).toBe(callData("en").number);
  });
});

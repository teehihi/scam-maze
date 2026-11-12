// PhoneScreenUI unit tests (task 7.3). Requirements 1.5, 2.1, 2.2, 2.5, 2.8, 2.9, 2.10, 2.11,
// 5.6 and 13.1.
//
// The views are built from the real Chapter 1 display scenario (English source and the `vi`
// narrative overlay), so the caller name, the number and the Caller_Line are scenario data.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import type { CallId } from "../../../game/narrative/chapter1/ids";
import { applyLocale } from "../../../i18n";
import { getDisplayScenario } from "../../../i18n/narrative";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import { PhoneScreenUI, type CallScreenView, type PhoneScreenUIProps } from "./PhoneScreenUI";

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const PHONE_TEXT = { en: enPhone.phone, vi: viPhone.phone } as const;
const CALL_ID: CallId = "call.scam-1";
const FORBIDDEN_WORDS = ["safe", "verified", "trusted", "an toàn"];
const EMOJI = /\p{Extended_Pictographic}/u;

/** Caller display name, number and the first two distinct Caller_Lines of the scam call. */
function callData(locale: GameLocale) {
  const scenario = getDisplayScenario(locale);
  const call = scenario.calls[CALL_ID];
  const graph = scenario.dialogues[call.graphId];
  const lineIds: string[] = [];
  for (const node of [graph.nodes[graph.startNodeId], ...Object.values(graph.nodes)]) {
    if (node.speaker === "caller" && !lineIds.includes(node.lineId)) lineIds.push(node.lineId);
  }
  expect(lineIds.length).toBeGreaterThanOrEqual(2);
  const lines = lineIds.slice(0, 2).map((id) => ({ speakerName: graph.persona.name, text: graph.lines[id] }));
  return { callerName: call.displayName, number: call.number, lines };
}

function ringingView(locale: GameLocale): CallScreenView {
  const { callerName, number } = callData(locale);
  return { status: "ringing", callerName, number };
}

function activeView(
  locale: GameLocale,
  line: Extract<CallScreenView, { status: "active" }>["line"] = callData(locale).lines[0],
): CallScreenView {
  const { callerName, number } = callData(locale);
  return { status: "active", callerName, number, line };
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

/** All visible text plus every accessible-name attribute in the tree. */
function allText(root: HTMLElement): string {
  const labels = Array.from(root.querySelectorAll("[aria-label],[title],[alt]")).flatMap((element) =>
    ["aria-label", "title", "alt"].map((name) => element.getAttribute(name) ?? ""),
  );
  return [root.textContent ?? "", ...labels].join(" ");
}

/** Checks shared by both call states: chrome, icons, emoji, text size, trust words, number. */
function expectCommonRules(root: HTMLElement, number: string): void {
  // Number: plain text, `dir="ltr"`, one line, no link ancestor, no `tel:`, no tab stop.
  const numberNode = within(root).getByText(number);
  expect(numberNode.tagName).toBe("P");
  expect(numberNode.getAttribute("dir")).toBe("ltr");
  expect(numberNode.className).toContain("whitespace-nowrap");
  expect(numberNode.closest("a")).toBeNull();
  expect(numberNode.hasAttribute("tabindex")).toBe(false);
  expect(root.querySelector("a")).toBeNull();
  expect(root.innerHTML).not.toContain("tel:");
  numberNode.focus();
  expect(document.activeElement).not.toBe(numberNode);

  // Icons: every lucide svg is hidden from assistive technology.
  const icons = root.querySelectorAll("svg");
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");

  const text = allText(root);
  expect(EMOJI.test(text)).toBe(false);
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN_WORDS) expect(lower).not.toContain(word);

  // No text smaller than `text-sm` (Requirement 1.5).
  for (const element of root.querySelectorAll("*")) {
    expect(element.getAttribute("class") ?? "").not.toMatch(/(^|\s)text-xs(\s|$)/);
  }
}

describe("PhoneScreenUI", () => {
  for (const locale of LOCALES) {
    const text = PHONE_TEXT[locale];

    describe(`locale ${locale}`, () => {
      it("shows exactly the ringing items", () => {
        switchLocale(locale);
        const { callerName, number } = callData(locale);
        const { container } = renderScreen({ view: ringingView(locale) });
        const section = screen.getByRole("region", { name: text.callPresentation.screenLabel });
        expect(section).toBe(container.firstElementChild);
        expect(section.dataset.testid).toBe("incoming-call-screen");

        expect(within(section).getByText(text.incomingCall.caption)).toBeTruthy();
        expect(within(section).getByTestId("incoming-call-name").textContent).toBe(callerName);
        expect(within(section).getByTestId("incoming-call-number").textContent).toBe(number);
        expect(within(section).getByTestId("incoming-call-icon").querySelector("svg")).not.toBeNull();

        const buttons = within(section).getAllByRole("button");
        expect(buttons.map((button) => button.textContent)).toEqual([
          text.incomingCall.decline,
          text.incomingCall.accept,
        ]);
        expect(within(section).queryByText(text.call.status)).toBeNull();
        expect(within(section).queryByText(text.call.hangUp)).toBeNull();
        expect(within(section).queryByTestId("call-line-region")).toBeNull();
        expect(within(section).queryByTestId("dialogue-line")).toBeNull();
        for (const line of callData(locale).lines) expect(within(section).queryByText(line.text)).toBeNull();

        expectCommonRules(section, number);
      });

      it("shows exactly the active items with the Caller_Line from the scenario", () => {
        switchLocale(locale);
        const { callerName, number, lines } = callData(locale);
        renderScreen({ view: activeView(locale) });
        const section = screen.getByRole("region", { name: text.callPresentation.screenLabel });
        expect(section.dataset.testid).toBe("call-screen");

        expect(within(section).getByText(callerName)).toBeTruthy();
        expect(within(section).getByTestId("call-screen-number").textContent).toBe(number);
        expect(within(section).getByText(text.call.status)).toBeTruthy();
        const line = within(section).getByTestId("dialogue-line");
        expect(within(line).getByText(lines[0].speakerName)).toBeTruthy();
        expect(within(line).getByText(lines[0].text)).toBeTruthy();

        const region = within(section).getByTestId("call-line-region");
        expect(region.getAttribute("aria-live")).toBe("polite");
        expect(region.getAttribute("aria-atomic")).toBe("true");
        expect(region.contains(line)).toBe(true);
        expect(region.tabIndex).toBe(-1);

        const buttons = within(section).getAllByRole("button");
        expect(buttons.map((button) => button.textContent)).toEqual([text.call.hangUp]);
        expect(within(section).queryByText(text.incomingCall.accept)).toBeNull();
        expect(within(section).queryByText(text.incomingCall.decline)).toBeNull();
        expect(within(section).queryByText(text.incomingCall.caption)).toBeNull();

        expectCommonRules(section, number);
      });

      it("shows the connecting text in the polite live region when no node is linked", () => {
        switchLocale(locale);
        const { callerName, number } = callData(locale);
        renderScreen({ view: activeView(locale, "connecting") });
        const section = screen.getByRole("region", { name: text.callPresentation.screenLabel });

        const region = within(section).getByTestId("call-line-region");
        expect(region.getAttribute("aria-live")).toBe("polite");
        expect(region.getAttribute("aria-atomic")).toBe("true");
        expect(region.textContent).toBe(text.call.connecting);
        expect(within(section).queryByTestId("dialogue-line")).toBeNull();

        expect(within(section).getByText(callerName)).toBeTruthy();
        expect(within(section).getByTestId("call-screen-number").textContent).toBe(number);
        expect(within(section).getByText(text.call.status)).toBeTruthy();
        expect(within(section).getByRole("button", { name: text.call.hangUp })).toBeTruthy();

        expectCommonRules(section, number);
      });

      it("shows no line text when the current line is not a Caller_Line", () => {
        switchLocale(locale);
        renderScreen({ view: activeView(locale, null) });
        const region = screen.getByTestId("call-line-region");
        expect(region.textContent).toBe("");
        expect(screen.queryByTestId("dialogue-line")).toBeNull();
        expect(screen.getByRole("button", { name: text.call.hangUp })).toBeTruthy();
      });

      it("keeps one live region node and changes its text only with the line", () => {
        switchLocale(locale);
        const { lines } = callData(locale);
        const { rerender } = renderScreen({ view: activeView(locale, lines[0]) });
        const region = screen.getByTestId("call-line-region");
        const firstText = region.textContent;
        expect(firstText).toContain(lines[0].text);

        // Same line, new object and other prop changes: same node, same text.
        rerender({ view: activeView(locale, { ...lines[0] }) });
        rerender({ view: activeView(locale, { ...lines[0] }), disabled: true });
        expect(screen.getByTestId("call-line-region")).toBe(region);
        expect(region.textContent).toBe(firstText);

        // A different line: same node, new text.
        rerender({ view: activeView(locale, lines[1]), disabled: false });
        expect(screen.getByTestId("call-line-region")).toBe(region);
        expect(region.textContent).not.toBe(firstText);
        expect(region.textContent).toContain(lines[1].text);

        // Connecting and back to a line still use the same node.
        rerender({ view: activeView(locale, "connecting") });
        expect(screen.getByTestId("call-line-region")).toBe(region);
        expect(region.textContent).toBe(text.call.connecting);
      });

      it("calls each handler once when its enabled button is activated", () => {
        switchLocale(locale);
        const ringing = renderScreen({ view: ringingView(locale) });
        fireEvent.click(screen.getByRole("button", { name: text.incomingCall.accept }));
        fireEvent.click(screen.getByRole("button", { name: text.incomingCall.decline }));
        expect(ringing.onAccept).toHaveBeenCalledTimes(1);
        expect(ringing.onDecline).toHaveBeenCalledTimes(1);
        ringing.unmount();

        const active = renderScreen({ view: activeView(locale) });
        fireEvent.click(screen.getByRole("button", { name: text.call.hangUp }));
        expect(active.onHangUp).toHaveBeenCalledTimes(1);
      });

      it("disables every call button while paused and calls no handler", () => {
        switchLocale(locale);
        const ringing = renderScreen({ view: ringingView(locale), disabled: true });
        const ringingButtons = screen.getAllByRole("button");
        expect(ringingButtons).toHaveLength(2);
        for (const button of ringingButtons) {
          expect((button as HTMLButtonElement).disabled).toBe(true);
          fireEvent.click(button);
          fireEvent.keyDown(button, { key: "Enter" });
          fireEvent.keyDown(button, { key: " " });
        }
        ringing.unmount();

        const active = renderScreen({ view: activeView(locale), disabled: true });
        const hangUp = screen.getByRole("button", { name: text.call.hangUp }) as HTMLButtonElement;
        expect(hangUp.disabled).toBe(true);
        fireEvent.click(hangUp);
        fireEvent.keyDown(hangUp, { key: "Enter" });

        for (const handler of [ringing.onAccept, ringing.onDecline, ringing.onHangUp, active.onAccept, active.onDecline, active.onHangUp]) {
          expect(handler).not.toHaveBeenCalled();
        }
      });
    });
  }

  it("shows the same number characters in en and vi", () => {
    expect(callData("vi").number).toBe(callData("en").number);
    switchLocale("vi");
    renderScreen({ view: activeView("vi") });
    expect(screen.getByTestId("call-screen-number").textContent).toBe(callData("en").number);
  });
});

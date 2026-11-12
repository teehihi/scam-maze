// CallSubtitleOverlay unit tests (task 5.3). Requirements 5.1, 5.2, 5.6 to 5.11 and 6.8.
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { applyLocale } from "../../../i18n";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import viPhone from "../../../i18n/locales/vi/chapter1/phone";
import type { SubtitleContent } from "./callDialogueView";
import { CallSubtitleOverlay, type CallSubtitleOverlayProps } from "./CallSubtitleOverlay";

const LOCALES: readonly GameLocale[] = ["en", "vi"];
const PHONE = { en: enPhone.phone, vi: viPhone.phone } as const;
const REGION = { left: 16, top: 400, width: 360, height: 120 };

const LINE_A: SubtitleContent = {
  kind: "line",
  speakerName: "Caller A",
  text: "Your account is locked.",
  nodeKey: "node.a",
};
const LINE_B: SubtitleContent = {
  kind: "line",
  speakerName: "Caller B",
  text: "Read me the code now.",
  nodeKey: "node.b",
};

function props(over: Partial<CallSubtitleOverlayProps> = {}): CallSubtitleOverlayProps {
  return { content: LINE_A, visible: true, notice: "none", region: REGION, ...over };
}

function mockReducedMotion(reduce: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function setLocale(locale: GameLocale): void {
  act(() => {
    applyLocale(locale);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setLocale("en");
});

describe.each(LOCALES)("CallSubtitleOverlay (%s)", (locale) => {
  const text = PHONE[locale];

  it("shows the line and the speaker name, and names the region", () => {
    setLocale(locale);
    render(<CallSubtitleOverlay {...props()} />);
    expect(screen.getByText("Caller A")).toBeTruthy();
    expect(screen.getByTestId("call-subtitle-line").textContent).toBe(LINE_A.kind === "line" ? LINE_A.text : "");
    expect(screen.getByRole("region").getAttribute("aria-label")).toBe(text.subtitle.label);
  });

  it("replaces the line when the node changes", () => {
    setLocale(locale);
    const { rerender } = render(<CallSubtitleOverlay {...props()} />);
    rerender(<CallSubtitleOverlay {...props({ content: LINE_B })} />);
    expect(screen.queryByText("Caller A")).toBeNull();
    expect(screen.queryByText("Your account is locked.")).toBeNull();
    expect(screen.getByText("Caller B")).toBeTruthy();
    expect(screen.getByText("Read me the code now.")).toBeTruthy();
  });

  it("shows the connecting text", () => {
    setLocale(locale);
    render(<CallSubtitleOverlay {...props({ content: { kind: "connecting" } })} />);
    expect(screen.getByTestId("call-subtitle-region").textContent).toBe(text.call.connecting);
  });

  it.each([
    ["autoplay-blocked", "autoplayBlocked"],
    ["dev-preview", "devPreview"],
    ["english-voice", "englishVoice"],
    ["no-audio", "noAudio"],
  ] as const)("shows the %s notice", (notice, key) => {
    setLocale(locale);
    render(<CallSubtitleOverlay {...props({ notice })} />);
    expect(screen.getByTestId("call-notice").textContent).toBe(text.call.notice[key]);
  });
});

describe("CallSubtitleOverlay behavior", () => {
  it("is empty and transparent when not visible and there is no notice", () => {
    render(<CallSubtitleOverlay {...props({ visible: false })} />);
    const root = screen.getByTestId("call-subtitle-overlay");
    expect(screen.getByTestId("call-subtitle-region").textContent).toBe("");
    expect(screen.getByTestId("call-notice").textContent).toBe("");
    expect(root.className).toContain("bg-transparent");
    expect(root.className).toContain("border-transparent");
  });

  it("hides the connecting text when not visible, but keeps the notice", () => {
    render(<CallSubtitleOverlay {...props({ content: { kind: "connecting" }, visible: false, notice: "no-audio" })} />);
    expect(screen.getByTestId("call-subtitle-region").textContent).toBe("");
    expect(screen.getByTestId("call-notice").textContent).toBe(enPhone.phone.call.notice.noAudio);
    expect(screen.getByTestId("call-subtitle-overlay").className).not.toContain("bg-transparent");
  });

  it("keeps the same live region elements across a rerender", () => {
    const { rerender } = render(<CallSubtitleOverlay {...props()} />);
    const region = screen.getByTestId("call-subtitle-region");
    const notice = screen.getByTestId("call-notice");
    rerender(<CallSubtitleOverlay {...props({ content: LINE_B, notice: "no-audio" })} />);
    rerender(<CallSubtitleOverlay {...props({ visible: false })} />);
    expect(screen.getByTestId("call-subtitle-region")).toBe(region);
    expect(screen.getByTestId("call-notice")).toBe(notice);
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(notice.getAttribute("aria-live")).toBe("polite");
  });

  it("is not a tab stop and has no pointer events", () => {
    render(<CallSubtitleOverlay {...props({ notice: "no-audio" })} />);
    const root = screen.getByTestId("call-subtitle-overlay");
    expect(root.style.pointerEvents).toBe("none");
    expect(root.hasAttribute("tabindex")).toBe(false);
    expect(root.querySelector("[tabindex],a,button,input,select,textarea")).toBeNull();
  });

  it("scrolls a long line within the region height and does not truncate it", () => {
    const long = "word ".repeat(300).trim();
    render(<CallSubtitleOverlay {...props({ content: { ...LINE_A, text: long } as SubtitleContent })} />);
    const root = screen.getByTestId("call-subtitle-overlay");
    expect(root.style.maxHeight).toBe(`${REGION.height}px`);
    expect(root.style.overflowY).toBe("auto");
    const line = screen.getByTestId("call-subtitle-line");
    expect(line.textContent).toBe(long);
    expect(line.className).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });

  it("fades the line in by default", () => {
    mockReducedMotion(false);
    const { container } = render(<CallSubtitleOverlay {...props()} />);
    expect(screen.getByTestId("call-subtitle-line").parentElement?.style.animation).toContain("scammaze-subtitle-in");
    expect(container.querySelector("style")).not.toBeNull();
  });

  it("has no fade animation or keyframes with reduced motion", () => {
    mockReducedMotion(true);
    const { container } = render(<CallSubtitleOverlay {...props()} />);
    expect(screen.getByTestId("call-subtitle-line").parentElement?.style.animation).toBe("");
    expect(container.querySelector("style")).toBeNull();
    expect(container.innerHTML).not.toContain("scammaze-subtitle-in");
  });
});

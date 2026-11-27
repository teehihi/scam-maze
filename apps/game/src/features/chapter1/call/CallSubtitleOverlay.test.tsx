// CallSubtitleOverlay unit tests (task 5.3). Requirements 5.1, 5.2, 5.6 to 5.11 and 6.8.
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { applyLocale } from "../../../i18n";
import { CINE } from "../theme";
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
  it("shows only the revealed characters while typing, and keeps the rest invisible", () => {
    render(<CallSubtitleOverlay {...props({ revealedChars: 4 })} />);
    expect(screen.getByTestId("call-subtitle-typed").textContent).toBe("Your");
    expect(screen.getByTestId("call-subtitle-pending").textContent).toBe(" account is locked.");
    expect(screen.getByTestId("call-subtitle-pending").getAttribute("aria-hidden")).toBe("true");
  });

  it("is empty and transparent when not visible and there is no notice", () => {
    render(<CallSubtitleOverlay {...props({ visible: false })} />);
    const bar = screen.getByTestId("call-subtitle-bar");
    expect(screen.getByTestId("call-subtitle-region").textContent).toBe("");
    expect(screen.getByTestId("call-notice").textContent).toBe("");
    expect(bar.className).toContain("bg-transparent");
    expect(bar.className).toContain("border-transparent");
    expect(screen.queryByTestId("call-subtitle-speaker")).toBeNull();
  });

  it("hides the connecting text when not visible, but keeps the notice", () => {
    render(<CallSubtitleOverlay {...props({ content: { kind: "connecting" }, visible: false, notice: "no-audio" })} />);
    expect(screen.getByTestId("call-subtitle-region").textContent).toBe("");
    expect(screen.getByTestId("call-notice").textContent).toBe(enPhone.phone.call.notice.noAudio);
    expect(screen.getByTestId("call-subtitle-bar").className).not.toContain("bg-transparent");
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
    // The box grows to the region (below the speaker), then the text scrolls inside it.
    const scroller = screen.getByTestId("call-subtitle-scroller");
    expect(scroller.style.overflowY).toBe("auto");
    // More than two lines are visible; the speaker name sits above the scroller.
    const lineHeight = Math.round(CINE.fontPx.subtitle * CINE.subtitle.lineHeight);
    expect(parseFloat(scroller.style.maxHeight)).toBeGreaterThan(lineHeight * 2);
    expect(parseFloat(scroller.style.maxHeight)).toBeLessThan(REGION.height);
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

describe("CallSubtitleOverlay placement (cinematic)", () => {
  it("anchors to the bottom edge of its region, left aligned, outside the phone", () => {
    render(<CallSubtitleOverlay {...props()} />);
    const root = screen.getByTestId("call-subtitle-overlay");
    // Bottom anchored: a short line sits at the bottom of the region, not at its top.
    expect(root.style.bottom).toContain(`${REGION.top + REGION.height}px`);
    expect(root.style.top).toBe("");
    expect(root.className).toContain("text-left");
    expect(root.style.left).toBe(`${REGION.left}px`);
    expect(root.style.width).toBe(`${REGION.width}px`);
  });

  it("has no panel of its own: a dark band behind the text, the speaker name in gold capitals", () => {
    render(<CallSubtitleOverlay {...props()} />);
    const bar = screen.getByTestId("call-subtitle-bar");
    expect(bar.style.backdropFilter).toBe("");
    expect(bar.style.background).toBe("");
    expect(screen.getByTestId("call-subtitle-band").getAttribute("aria-hidden")).toBe("true");
    const speaker = screen.getByText("Caller A");
    expect(speaker.className).toContain("uppercase");
    expect(speaker.style.color).toBe("rgb(185, 165, 245)");
    // Never below the minimum effective text size.
    expect(parseFloat(speaker.style.fontSize)).toBeGreaterThanOrEqual(13);
  });
});

describe("CallSubtitleOverlay speaker name and scroll hint", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the speaker name above the line, inside the live region", () => {
    render(<CallSubtitleOverlay {...props()} />);
    const name = screen.getByTestId("call-subtitle-speaker");
    expect(name.textContent).toBe("Caller A");
    expect(screen.getByTestId("call-subtitle-region").contains(name)).toBe(true);
    expect(screen.getByTestId("call-subtitle-bar").contains(name)).toBe(true);
    // The name comes before the line in the document.
    const line = screen.getByTestId("call-subtitle-line");
    expect(name.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a chevron only while more text is below the visible lines", () => {
    // jsdom has no layout: report a 200 px text in a 48 px scroller for the first render only.
    const scrollHeight = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(48);
    const { rerender } = render(<CallSubtitleOverlay {...props()} />);
    expect(screen.getByTestId("call-subtitle-more").getAttribute("aria-hidden")).toBe("true");
    // The whole text fits: no chevron.
    scrollHeight.mockReturnValue(48);
    rerender(<CallSubtitleOverlay {...props({ content: LINE_B })} />);
    expect(screen.queryByTestId("call-subtitle-more")).toBeNull();
  });
});
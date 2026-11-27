// Subtitle_Overlay for an active call: the current caller line, the connecting text and the voice
// notice, shown outside the phone screen. Pure DOM (no three, React Three Fiber or Drei imports).
// It is rendered by `CallPresentation` as a sibling of `PhoneScreenHost`, never inside it.
// See design.md, "`CallSubtitleOverlay`", and Requirements 5.1, 5.2, 5.6 to 5.11, 6.8 and 10.5.
//
// - Root: fixed at `region` (`layout.subtitle`, bottom-left in the wide layout), `pointer-events:
//   none`, not a tab stop, anchored to the bottom of the region. It holds one bar.
// - Same look as the street conversation (`prologue/DialogueOverlay`): no panel, a dark gradient band
//   at the bottom of the screen, the speaker's name in lavender capitals over a hairline, then the line
//   (it grows to the region height, then scrolls; it is never cut) and a small chevron-down at the
//   right while more text is below.
// - Two persistent polite live regions (the line with the speaker, and the notice) that are never
//   remounted, so a re-render with the same line makes no new announcement.
// - Transparent, without border, when there is nothing to show.
// - The line fades in over 150 ms, keyed by `nodeKey` only, and not with reduced motion.
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { CINE } from "../theme";
import type { SubtitleContent } from "./callDialogueView";
import type { Rect } from "./callLayout";

export interface CallSubtitleOverlayProps {
  content: SubtitleContent;
  /** `isSubtitleVisible(...)`: false hides the line and the connecting text, not the notice. */
  visible: boolean;
  notice: "none" | "autoplay-blocked" | "dev-preview" | "english-voice" | "no-audio";
  /** Region from `computeCallLayout` (`layout.subtitle`); its height is the maximum height. */
  region: Rect;
  /** Number of characters of the line revealed so far (typewriter). Absent: the whole line. */
  revealedChars?: number;
}

const NOTICE_KEYS = {
  "autoplay-blocked": "phone.call.notice.autoplayBlocked",
  "dev-preview": "phone.call.notice.devPreview",
  "english-voice": "phone.call.notice.englishVoice",
  "no-audio": "phone.call.notice.noAudio",
} as const;

/** Height of the speaker name, the hairline and their gaps above the line, in px. */
const SPEAKER_BLOCK_PX = 40;

const FADE_ANIMATION = `scammaze-subtitle-in ${CINE.motion.fastMs}ms ease-out both`;
const FADE_KEYFRAMES = `@keyframes scammaze-subtitle-in {
  from { opacity: 0; }
  to { opacity: 1; }
}`;

/** The revealed part, then the rest invisible, so the line keeps its final size while it types. */
const TypedText: React.FC<{ text: string; revealed: number }> = ({ text, revealed }) => {
  const chars = Array.from(text);
  const count = Math.max(0, Math.min(chars.length, revealed));
  return (
    <>
      <span data-testid="call-subtitle-typed">{chars.slice(0, count).join("")}</span>
      <span aria-hidden="true" data-testid="call-subtitle-pending" style={{ opacity: 0 }}>
        {chars.slice(count).join("")}
      </span>
    </>
  );
};

export const CallSubtitleOverlay: React.FC<CallSubtitleOverlayProps> = ({
  content,
  visible,
  notice,
  region,
  revealedChars,
}) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = usePrefersReducedMotion();

  const showLine = visible && content.kind === "line";
  const showConnecting = visible && content.kind === "connecting";
  const showNotice = notice !== "none";
  const hasContent = showLine || showConnecting || showNotice;

  // The chevron shows while the scrolling text has more below the visible part.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    setMore(el !== null && el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }, []);
  const lineKey = showLine && content.kind === "line" ? `${content.nodeKey}:${content.text}` : "";
  useLayoutEffect(() => {
    measure();
  }, [lineKey, measure, region.width]);

  const lineHeightPx = Math.round(CINE.fontPx.subtitle * CINE.subtitle.lineHeight);
  // The line box may use the whole region below the speaker name and its hairline.
  const scrollerMaxHeight = Math.max(lineHeightPx, region.height - SPEAKER_BLOCK_PX);

  return (
    <div
      data-testid="call-subtitle-overlay"
      role="region"
      aria-label={t("phone.subtitle.label")}
      className="flex flex-col justify-end text-left"
      style={{
        position: "fixed",
        left: region.left,
        // Anchored to the bottom edge of the region, so a short line sits at the bottom.
        bottom: `max(0px, calc(100dvh - ${region.top + region.height}px))`,
        width: region.width,
        maxHeight: region.height,
        boxSizing: "border-box",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {reducedMotion ? null : <style>{FADE_KEYFRAMES}</style>}
      {hasContent ? (
        <div aria-hidden="true" data-testid="call-subtitle-band" className="pointer-events-none" style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: "46%", zIndex: -1, background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.55) 50%, transparent)" }} />
      ) : null}

      <div
        data-testid="call-subtitle-bar"
        className={hasContent ? "relative" : "relative border border-transparent bg-transparent"}
        style={{
          padding: 0,
          boxSizing: "border-box",
          pointerEvents: hasContent ? "auto" : "none",
          textShadow: "0 2px 10px rgba(0,0,0,0.85)",
        }}
      >
        <div aria-live="polite" aria-atomic="true" data-testid="call-subtitle-region">
          {showLine && content.kind === "line" ? (
            <React.Fragment key={content.nodeKey}>
              <p data-testid="call-subtitle-speaker" className="font-menu font-bold uppercase" style={{ fontSize: 24, lineHeight: "30px", letterSpacing: "0.08em", color: "#b9a5f5" }}>
                {content.speakerName}
              </p>
              <div aria-hidden="true" className="mb-1 mt-0.5 h-px w-full" style={{ background: "linear-gradient(to right, rgba(185,165,245,0.8), rgba(185,165,245,0.3), transparent)" }} />
              <div
                ref={scrollerRef}
                data-testid="call-subtitle-scroller"
                onScroll={measure}
                style={{
                  maxHeight: scrollerMaxHeight,
                  overflowY: "auto",
                  overflowX: "hidden",
                  overscrollBehavior: "contain",
                  paddingRight: more ? 22 : 0,
                }}
              >
                <div style={reducedMotion ? undefined : { animation: FADE_ANIMATION }}>
                  <p
                    data-testid="call-subtitle-line"
                    className="whitespace-normal break-words"
                    style={{ fontSize: CINE.fontPx.subtitle, lineHeight: `${lineHeightPx}px`, color: CINE.color.text }}
                  >
                    {revealedChars === undefined ? (
                      content.text
                    ) : (
                      <TypedText text={content.text} revealed={revealedChars} />
                    )}
                  </p>
                </div>
              </div>
              {more ? (
                <ChevronDown
                  data-testid="call-subtitle-more"
                  aria-hidden="true"
                  className="absolute h-4 w-4"
                  style={{ right: 0, bottom: 2, color: "#b9a5f5" }}
                />
              ) : null}
            </React.Fragment>          ) : showConnecting ? (
            <p className="whitespace-normal break-words text-lg leading-relaxed text-[#a9a4c4]">
              {t("phone.call.connecting")}
            </p>
          ) : null}
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
          data-testid="call-notice"
          className={showNotice ? "mt-1 text-base leading-relaxed text-[#a9a4c4]" : undefined}
        >
          {showNotice ? t(NOTICE_KEYS[notice]) : null}
        </div>
      </div>
    </div>
  );
};
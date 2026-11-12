// Subtitle_Overlay for an active call: the current caller line, the connecting text and the voice
// notice, shown outside the phone screen. Pure DOM (no three, React Three Fiber or Drei imports).
// It is rendered by `CallPresentation` as a sibling of `PhoneScreenHost`, never inside it.
// See design.md, "`CallSubtitleOverlay`", and Requirements 5.1, 5.2, 5.6 to 5.11, 6.8 and 10.5.
//
// - Root: fixed at `region` (`layout.subtitle`), `pointer-events: none`, not a tab stop,
//   `maxHeight: region.height`, vertical scroll only (a long line scrolls, it is never cut).
// - Two persistent polite live regions (the line and the notice) that are never remounted, so a
//   re-render with the same line makes no new announcement.
// - Transparent, without border, when there is nothing to show.
// - The line fades in over 150 ms, keyed by `nodeKey` only, and not with reduced motion.
import React from "react";
import { useTranslation } from "react-i18next";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { UI } from "../theme";
import type { SubtitleContent } from "./callDialogueView";
import type { Rect } from "./callLayout";

export interface CallSubtitleOverlayProps {
  content: SubtitleContent;
  /** `isSubtitleVisible(...)`: false hides the line and the connecting text, not the notice. */
  visible: boolean;
  notice: "none" | "autoplay-blocked" | "dev-preview" | "english-voice" | "no-audio";
  /** Region from `computeCallLayout` (`layout.subtitle`); its height is the maximum height. */
  region: Rect;
}

const NOTICE_KEYS = {
  "autoplay-blocked": "phone.call.notice.autoplayBlocked",
  "dev-preview": "phone.call.notice.devPreview",
  "english-voice": "phone.call.notice.englishVoice",
  "no-audio": "phone.call.notice.noAudio",
} as const;

const FADE_ANIMATION = "scammaze-subtitle-in 150ms ease-out both";
const FADE_KEYFRAMES = `@keyframes scammaze-subtitle-in {
  from { opacity: 0; }
  to { opacity: 1; }
}`;

export const CallSubtitleOverlay: React.FC<CallSubtitleOverlayProps> = ({
  content,
  visible,
  notice,
  region,
}) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = usePrefersReducedMotion();

  const showLine = visible && content.kind === "line";
  const showConnecting = visible && content.kind === "connecting";
  const showNotice = notice !== "none";
  const hasContent = showLine || showConnecting || showNotice;

  return (
    <div
      data-testid="call-subtitle-overlay"
      role="region"
      aria-label={t("phone.subtitle.label")}
      className={
        hasContent
          ? "rounded-lg border border-[#38344f] bg-[#171521]/90 px-3 py-2"
          : "rounded-lg border border-transparent bg-transparent px-3 py-2"
      }
      style={{
        position: "fixed",
        left: region.left,
        top: region.top,
        width: region.width,
        maxHeight: region.height,
        overflowY: "auto",
        overflowX: "hidden",
        pointerEvents: "none",
      }}
    >
      {reducedMotion ? null : <style>{FADE_KEYFRAMES}</style>}

      <div aria-live="polite" aria-atomic="true" data-testid="call-subtitle-region">
        {showLine && content.kind === "line" ? (
          <div
            key={content.nodeKey}
            style={reducedMotion ? undefined : { animation: FADE_ANIMATION }}
          >
            <p className={UI.label}>{content.speakerName}</p>
            <p
              data-testid="call-subtitle-line"
              className="mt-1 whitespace-normal break-words text-base leading-snug text-[#f7f5ff]"
            >
              {content.text}
            </p>
          </div>
        ) : showConnecting ? (
          <p className="whitespace-normal break-words text-sm leading-relaxed text-[#a9a4c4]">
            {t("phone.call.connecting")}
          </p>
        ) : null}
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        data-testid="call-notice"
        className={showNotice ? "mt-1 text-sm leading-relaxed text-[#a9a4c4]" : undefined}
      >
        {showNotice ? t(NOTICE_KEYS[notice]) : null}
      </div>
    </div>
  );
};

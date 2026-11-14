import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CloudRain, House } from "lucide-react";
import { useIntroNarration, type NarrationLine } from "../chapter1/intro/useIntroNarration";
import { homeCallClipPath } from "./homeCallClips";

interface HomeCallOverlayProps {
  /** Language code of the voice clips (`en` or `vi`). */
  locale: string;
  /** 0..1 gain for the spoken lines; 0 mutes them. */
  voiceGain: number;
  onGoHome: () => void;
  onStay: () => void;
}

const LINE_KEYS = ["l1", "l2", "l3"] as const;

/**
 * "Time to go home": the rain has started. Same presentation as the chapter intro: one line on
 * screen at a time, typed in step with its voice clip (or at reading speed without one). A click
 * shows the whole line, the next click moves on; after the last line the two choices appear.
 */
export const HomeCallOverlay: React.FC<HomeCallOverlayProps> = ({ locale, voiceGain, onGoHome, onStay }) => {
  const { t } = useTranslation(["worlds", "chapter1"]);
  const texts = LINE_KEYS.map((key) => t(`worlds:khupho.game.story.${key}`));
  const linesKey = texts.join("\n") + locale;
  const lines: NarrationLine[] = useMemo(
    () => texts.map((text, i) => ({ text, src: homeCallClipPath(locale, i) })),
    // Rebuilt only when the language or the text changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linesKey],
  );
  const narration = useIntroNarration({ lines, active: true, gain: voiceGain });
  const { shown, text, lineDone, isLast } = narration;
  const canChoose = isLast && lineDone;

  const advance = () => {
    narration.advance();
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="home-call-title"
      onClick={canChoose ? undefined : advance}
      className={`absolute inset-0 z-[60] flex items-end justify-center text-[#f7f5ff] select-none ${canChoose ? "" : "cursor-pointer"}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-[#0d0c15]/95 via-[#0d0c15]/70 to-transparent" />
      <div className="relative w-full max-w-3xl px-6 pb-10 sm:px-10 sm:pb-14">
        <p id="home-call-title" className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#b9a5f5]">
          <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />
          {t("worlds:khupho.game.story.callKicker")}
        </p>
        <p className="sr-only" aria-live="polite">
          {text}
        </p>
        <div aria-hidden="true" className="mb-4 flex items-center gap-1.5">
          {lines.map((_, i) => (
            <span
              key={i}
              className={`h-1 transition-all duration-300 ${
                i === narration.index ? "w-8 bg-[#f3efe4]" : i < narration.index ? "w-4 bg-[#7654d6]" : "w-4 bg-white/20"
              }`}
            />
          ))}
        </div>
        <p
          aria-hidden="true"
          className="min-h-[6.5rem] whitespace-pre-line font-display text-lg leading-relaxed sm:text-2xl sm:leading-relaxed"
          style={{ textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}
        >
          {shown}
          {!lineDone && <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] bg-[#b9a5f5] motion-safe:animate-pulse" />}
        </p>

        <div className={`mt-6 flex flex-wrap items-center gap-3 transition-opacity duration-500 ${canChoose ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <button
            type="button"
            disabled={!canChoose}
            tabIndex={canChoose ? 0 : -1}
            onClick={onGoHome}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#7654d6]/60 bg-[#7654d6]/35 px-4 py-2 text-sm font-medium text-[#f7f5ff] transition-colors hover:bg-[#7654d6]/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b9a5f5]"
          >
            <House className="h-4 w-4" aria-hidden="true" />
            {t("worlds:khupho.game.story.goHome")}
          </button>
          <button
            type="button"
            disabled={!canChoose}
            tabIndex={canChoose ? 0 : -1}
            onClick={onStay}
            className="inline-flex cursor-pointer items-center rounded-md border border-[#38344f] bg-[#171521]/80 px-4 py-2 text-sm text-[#d6d1ea] transition-colors hover:border-[#7654d6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b9a5f5]"
          >
            {t("worlds:khupho.game.story.stay")}
          </button>
        </div>
        {!canChoose && (
          <p className="mt-4 text-xs text-[#a9a4c4]" aria-hidden="true">
            {lineDone ? t("chapter1:intro.next") : t("chapter1:intro.skip")}
          </p>
        )}
      </div>
    </section>
  );
};

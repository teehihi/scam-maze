// Opening screen of a chapter: the street is already visible behind it, and a friendly voice
// greets the player one paragraph at a time. Each paragraph plays its voice clip and is typed in
// step with it. A click shows the whole paragraph; the next click cuts the voice and moves on.
// After the last paragraph the controls appear and a click starts the story (the page
// dispatches START_CHAPTER in `onBegin`). It never shows the chapter number or title, so the
// player is not told in advance what is coming.

import React, { useEffect, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameLocale } from "../../../i18n";
import { RESUME_SCRIPT, welcomeScript } from "./introScript";
import { useIntroNarration, type NarrationLine } from "./useIntroNarration";

export type IntroMode = "begin" | "continue";

export interface ChapterIntroOverlayProps {
  /** True once the Chapter_Canvas has reported scene readiness. Voice and typing start then. */
  ready: boolean;
  /** "continue" when a saved run is being restored. */
  mode: IntroMode;
  /** Voice gain 0..1 from the settings (0 when sound is off). */
  voiceGain: number;
  onBegin: () => void;
  /** Test seam for the voice clips. */
  createAudio?: (src: string) => HTMLAudioElement;
}

/** Key caps are physical labels and stay the same in every language ("mouse" is translated). */
const CONTROLS = [
  { id: "move", keys: ["W", "A", "S", "D"] },
  { id: "look", keys: [] },
  { id: "interact", keys: ["E"] },
  { id: "phone", keys: ["P"] },
  { id: "journal", keys: ["J"] },
  { id: "pause", keys: ["Esc"] },
] as const;

export const ChapterIntroOverlay: React.FC<ChapterIntroOverlayProps> = ({
  ready,
  mode,
  voiceGain,
  onBegin,
  createAudio,
}) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const script = mode === "continue" ? RESUME_SCRIPT : welcomeScript(locale);
  const lineTexts = script.map((line) => t(line.textKey));
  const linesKey = `${script.map((line) => line.src ?? "").join("|")}\n${lineTexts.join("\n")}`;
  const lines: NarrationLine[] = useMemo(
    () => script.map((line, i) => ({ text: lineTexts[i], src: line.src })),
    // Rebuilt only when the clips or the translated text change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linesKey],
  );
  const narration = useIntroNarration({ lines, active: ready, gain: voiceGain, createAudio });
  const { shown, text, lineDone, isLast } = narration;
  const canContinue = ready && isLast && lineDone;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  /**
   * First click shows the whole paragraph; the next one moves to the next paragraph (cutting the
   * voice), and after the last paragraph it starts the story. Ignored while the scene loads.
   */
  const advance = () => {
    if (!ready) return;
    if (narration.advance() === "finished") onBegin();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    // The button handles its own Enter and Space.
    if (event.target instanceof HTMLButtonElement) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      advance();
    }
  };

  return (
    <section
      aria-labelledby="chapter-intro-heading"
      aria-busy={!ready}
      data-testid="chapter-intro"
      onClick={advance}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-30 flex cursor-pointer items-end justify-center text-[#f7f5ff] select-none"
    >
      {/* The street stays visible; the dark gradient only keeps the text readable. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(10,9,16,0.55)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%] bg-gradient-to-t from-[#0d0c15]/95 via-[#0d0c15]/75 to-transparent"
      />

      <div className="relative w-full max-w-3xl px-6 pb-10 sm:px-10 sm:pb-14">
        <h1 id="chapter-intro-heading" ref={headingRef} tabIndex={-1} className="sr-only outline-none">
          {t("intro.heading")}
        </h1>

        {ready ? (
          <>
            {/* Screen readers get each whole paragraph at once (announced when it changes). */}
            <p className="sr-only" aria-live="polite">
              {text}
            </p>
            {narration.total > 1 && (
              <div aria-hidden="true" data-testid="chapter-intro-step" className="mb-4 flex items-center gap-1.5">
                {Array.from({ length: narration.total }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1 transition-all duration-300 ${
                      i === narration.index ? "w-8 bg-[#f3efe4]" : i < narration.index ? "w-4 bg-[#7654d6]" : "w-4 bg-white/20"
                    }`}
                  />
                ))}
              </div>
            )}
            <p
              aria-hidden="true"
              data-testid="chapter-intro-text"
              className="min-h-[9rem] whitespace-pre-line font-display text-lg leading-relaxed text-[#f7f5ff] sm:text-2xl sm:leading-relaxed"
              style={{ textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}
            >
              {shown}
              {!lineDone && <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] bg-[#b9a5f5] motion-safe:animate-pulse" />}
            </p>
          </>
        ) : (
          <p role="status" className="flex items-center gap-2 text-sm text-[#a9a4c4]">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
            {t("intro.preparing")}
          </p>
        )}

        <div
          className={`mt-6 space-y-4 transition-opacity duration-500 ${canContinue ? "opacity-100" : "opacity-0"}`}
        >
          {mode === "begin" && (
            <div className="space-y-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#b9a5f5]">
                {t("intro.controls.heading")}
              </p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#d6d1ea]">
                {CONTROLS.map((control) => (
                  <li key={control.id} className="flex items-center gap-1.5">
                    {control.keys.length === 0 ? (
                      <kbd className="rounded border border-[#4a4466] bg-[#1d1b2b]/90 px-1.5 py-0.5 font-mono text-[11px] text-[#f7f5ff]">
                        {t("intro.controls.mouse")}
                      </kbd>
                    ) : (
                      control.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border border-[#4a4466] bg-[#1d1b2b]/90 px-1.5 py-0.5 font-mono text-[11px] text-[#f7f5ff]"
                        >
                          {key}
                        </kbd>
                      ))
                    )}
                    <span>{t(`intro.controls.${control.id}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[#a9a4c4]">{t("intro.simulation")}</p>
            </div>
          )}

          <button
            type="button"
            disabled={!canContinue}
            tabIndex={canContinue ? 0 : -1}
            onClick={(event) => {
              event.stopPropagation();
              if (canContinue) onBegin();
            }}
            className="inline-flex items-center gap-2 rounded-md border border-[#7654d6]/60 bg-[#7654d6]/25 px-4 py-2 text-sm font-medium text-[#f7f5ff] transition-colors hover:bg-[#7654d6]/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#b9a5f5] motion-safe:animate-pulse disabled:pointer-events-none"
          >
            {t("intro.continue")}
          </button>
        </div>

        {ready && !canContinue && (
          <p className="mt-4 text-xs text-[#a9a4c4]" aria-hidden="true">
            {lineDone ? t("intro.next") : t("intro.skip")}
          </p>
        )}
      </div>
    </section>
  );
};

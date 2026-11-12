// Opening screen of a chapter: the street is already visible behind it, and a friendly voice
// greets the player with typed-out text. It never shows the chapter number or title, so the
// player is not told in advance what is coming. A click skips the typing, a second click starts
// the story (the page dispatches START_CHAPTER in `onBegin`).

import React, { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTypewriter } from "./useTypewriter";

export type IntroMode = "begin" | "continue";

export interface ChapterIntroOverlayProps {
  /** True once the Chapter_Canvas has reported scene readiness. Typing starts then. */
  ready: boolean;
  /** "continue" when a saved run is being restored. */
  mode: IntroMode;
  onBegin: () => void;
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

export const ChapterIntroOverlay: React.FC<ChapterIntroOverlayProps> = ({ ready, mode, onBegin }) => {
  const { t } = useTranslation("chapter1");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const text =
    mode === "continue"
      ? t("intro.resume")
      : [t("intro.welcome.p1"), t("intro.welcome.p2"), t("intro.welcome.p3")].join("\n\n");
  const { shown, done, skip } = useTypewriter(text, ready);
  const canContinue = ready && done;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  /** First click shows all the text; the next one continues. Ignored while the scene loads. */
  const advance = () => {
    if (!ready) return;
    if (done) onBegin();
    else skip();
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
            {/* Screen readers get the whole text at once instead of letter by letter. */}
            <p className="sr-only">{text}</p>
            <p
              aria-hidden="true"
              data-testid="chapter-intro-text"
              className="min-h-[9rem] whitespace-pre-line font-display text-lg leading-relaxed text-[#f7f5ff] sm:text-2xl sm:leading-relaxed"
              style={{ textShadow: "0 2px 14px rgba(0,0,0,0.85)" }}
            >
              {shown}
              {!done && <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] bg-[#b9a5f5] motion-safe:animate-pulse" />}
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

        {ready && !done && (
          <p className="mt-4 text-xs text-[#a9a4c4]" aria-hidden="true">
            {t("intro.skip")}
          </p>
        )}
      </div>
    </section>
  );
};

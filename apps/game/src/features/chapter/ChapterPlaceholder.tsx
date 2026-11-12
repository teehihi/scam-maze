import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Construction } from "lucide-react";
import { BrandLogo } from "../../components/ui/BrandLogo";
import { SceneTransition } from "../../components/ui/SceneTransition";
import { LOADING_BACKGROUND_JPG, LOADING_BACKGROUND_WEBP } from "../../config/assetPaths";
import { useTranslation } from "react-i18next";
import { getChapter } from "../../game/chapters/chapterRegistry";
import type { ChapterSession } from "../../game/chapters/chapterSession";
import { formatChapterLabel } from "../../game/loading/loadingStrings";
import { useGameLocale } from "../../i18n";

interface ChapterPlaceholderProps {
  session: ChapterSession;
  onBackToMenu: () => void;
}

/**
 * Honest destination after loading a chapter whose gameplay does not exist yet.
 * Replace with the chapter scene once it is implemented (chapter.gameplayAvailable).
 */
export const ChapterPlaceholder: React.FC<ChapterPlaceholderProps> = ({ session, onBackToMenu }) => {
  const [leaving, setLeaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const chapter = getChapter(session.chapterId);
  const { t } = useTranslation(["loading", "common"]);
  const { t: tChapters } = useTranslation("chapters");
  const locale = useGameLocale();
  // The registry's English title is the fallback for a chapter without a dictionary key.
  const title = chapter
    ? tChapters(`${chapter.id}.title`, { defaultValue: chapter.title })
    : session.chapterId;

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <SceneTransition visible={!leaving} onHidden={onBackToMenu} className="z-40">
      <section
        aria-labelledby="chapter-placeholder-title"
        className="relative flex h-full w-full flex-col overflow-hidden bg-[#171521] text-[#f7f5ff]"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <picture>
            <source srcSet={LOADING_BACKGROUND_WEBP} type="image/webp" />
            <img
              src={LOADING_BACKGROUND_JPG}
              alt=""
              width={1920}
              height={1080}
              decoding="async"
              className="h-full w-full object-cover brightness-[0.45]"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-[#171521] via-[#171521]/60 to-[#171521]/80" />
        </div>

        <header className="relative z-10 p-6 sm:p-10">
          <BrandLogo size="sm" />
        </header>

        <div className="relative z-10 my-auto w-full px-6 pb-10 sm:px-10">
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#38344f] bg-[#1d1b2b]/92 p-6 sm:p-8 space-y-5">
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b9a5f5]">
                {formatChapterLabel(session.chapterNumber, { t, locale })}
              </p>
              <h2 id="chapter-placeholder-title" className="font-display text-3xl sm:text-4xl">
                {title}
              </h2>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-[#7654d6]/40 bg-[#7654d6]/10 p-4">
              <Construction className="mt-0.5 h-5 w-5 shrink-0 text-[#b9a5f5]" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">{tChapters("placeholder.heading")}</p>
                <p className="text-sm text-[#a9a4c4]">{tChapters("placeholder.body")}</p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="rounded-lg bg-[#171521]/70 p-3">
                <dt className="text-[#a9a4c4]">{tChapters("placeholder.startLabel")}</dt>
                <dd className="mt-1 text-[#f7f5ff]">{tChapters(`scenes.${session.sceneId}`)}</dd>
              </div>
              <div className="rounded-lg bg-[#171521]/70 p-3">
                <dt className="text-[#a9a4c4]">{tChapters("placeholder.originLabel")}</dt>
                <dd className="mt-1 text-[#f7f5ff]">{tChapters(`placeholder.origin.${session.origin}`)}</dd>
              </div>
            </dl>

            <div className="flex justify-end">
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setLeaving(true)}
                className="flex items-center gap-2 rounded-xl bg-[#7654d6] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#8b6be8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("common:actions.returnToMenu")}
              </button>
            </div>
          </div>
        </div>
      </section>
    </SceneTransition>
  );
};

// Chapter title card, shown when the Chapter_Page mounts and until Begin dispatches START_CHAPTER.
// Presentational: the page passes readiness and handles the click.
// See design.md, "UI components", and Requirements 1.4, 1.5.

import React, { useEffect, useRef } from "react";
import { Loader2, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "../../../i18n/format";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { UI } from "../theme";

export type TitleCardMode = "begin" | "continue";

export interface ChapterTitleCardProps {
  chapterNumber: number;
  title: string;
  subtitle: string;
  /** Optional short premise paragraph. Omitted when the scenario has none. */
  premise?: string;
  /** True once the Chapter_Canvas has reported scene readiness. */
  ready: boolean;
  /** "continue" when a saved run is being restored. */
  mode: TitleCardMode;
  onBegin: () => void;
}

export const ChapterTitleCard: React.FC<ChapterTitleCardProps> = ({
  chapterNumber,
  title,
  subtitle,
  premise,
  ready,
  mode,
  onBegin,
}) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="chapter-title-card-heading"
      aria-busy={!ready}
      className="absolute inset-0 z-30 flex items-end bg-gradient-to-t from-[#171521] via-[#171521]/80 to-[#171521]/40 p-6 text-[#f7f5ff] sm:p-10"
    >
      <div className="w-full max-w-2xl space-y-4">
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#b9a5f5]">
          {t("titleCard.eyebrow", { number: formatNumber(locale, chapterNumber) })}
        </p>
        <h1
          id="chapter-title-card-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-4xl leading-[1.05] text-[#f7f5ff] outline-none sm:text-5xl lg:text-6xl"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}
        >
          {title}
        </h1>
        <p className="text-base text-[#a9a4c4] sm:text-lg">{subtitle}</p>
        {premise && <p className={`${UI.body} max-w-xl`}>{premise}</p>}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <button type="button" onClick={onBegin} disabled={!ready} className={UI.buttonPrimary}>
            <Play className="h-4 w-4" aria-hidden="true" />
            {mode === "continue" ? t("titleCard.continue") : t("titleCard.begin")}
          </button>
          <p role="status" className={`flex items-center gap-2 text-sm ${UI.textMuted}`}>
            {!ready && <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />}
            {ready ? t("titleCard.ready") : t("titleCard.preparing")}
          </p>
        </div>
      </div>
    </section>
  );
};

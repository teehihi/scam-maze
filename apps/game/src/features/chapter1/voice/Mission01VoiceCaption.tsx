// The cinematic subtitle of the line Alex is saying: one sentence at a time, at the bottom centre,
// never more than two lines, in step with the playback position of the clip. It reads
// `voice.alex.<cue>` in the chapter1 texts (the transcript in the game language) and the timing of
// the clip of that language, so it follows the language and the Subtitles setting. It disappears
// between two sentences and when the clip ends.
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useGameLocale } from "../../../i18n";
import { buildSubtitleCues, cueAt } from "./mission01Subtitles";
import { MISSION01_SUBTITLE_TIMINGS } from "./mission01SubtitleTimings";
import type { AlexVoiceCue } from "./useMission01Voice";

export interface Mission01VoiceCaptionProps {
  /** An Alex line of Mission 01 or Mission 02; its caption is `voice.alex.<cue>`. */
  cue: AlexVoiceCue | null;
  subtitlesEnabled: boolean;
  /** Playback position of the line that is playing, in milliseconds from the start of the clip. */
  getPositionMs: () => number;
}

/** How often the caption looks at the playback position. */
const POLL_MS = 50;

export const Mission01VoiceCaption: React.FC<Mission01VoiceCaptionProps> = ({ cue, subtitlesEnabled, getPositionMs }) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  const text = cue === null ? "" : (t as unknown as (key: string, options: { defaultValue: string }) => string)(`voice.alex.${cue}`, { defaultValue: "" });
  const cues = useMemo(() => {
    if (cue === null || text.trim() === "") return [];
    const timings = MISSION01_SUBTITLE_TIMINGS[locale]?.[cue];
    const last = timings && timings.length > 0 ? timings[timings.length - 1][1] : 6000;
    return buildSubtitleCues(text, timings, last);
  }, [cue, locale, text]);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!subtitlesEnabled || cues.length === 0) {
      setShown(null);
      return undefined;
    }
    const look = () => setShown(cueAt(cues, getPositionMs())?.text ?? null);
    look();
    const id = window.setInterval(look, POLL_MS);
    return () => {
      window.clearInterval(id);
      setShown(null);
    };
  }, [cues, getPositionMs, subtitlesEnabled]);

  if (shown === null) return null;
  // A portal to the page, so the subtitle stays visible over the intro and the other overlays
  // (the HUD container around it is hidden while the intro is open).
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[11%] z-[60] flex justify-center px-6" data-testid="alex-voice-caption-wrap">
      <p
        role="status"
        data-testid="alex-voice-caption"
        className="line-clamp-2 max-w-[46rem] rounded-lg bg-black/45 px-4 py-1.5 text-center text-lg leading-snug text-white"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.95), 0 2px 12px rgba(0,0,0,0.85)" }}
      >
        {shown}
      </p>
    </div>,
    document.body,
  );
};

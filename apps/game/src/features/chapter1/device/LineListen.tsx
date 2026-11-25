// Listen button of one conversation line. A recorded clip plays when there is one; otherwise the
// browser's computer voice reads the line; otherwise the button says there is no voice and the text
// on screen is all there is. Pressing it again stops the line.
import React, { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { mission01LineVoiceUrl } from "../voice/mission01Voice";
import { mission02VoiceUrl } from "../voice/mission02Voice";
import { lineVoiceKey, playLineVoice, stopLineVoice } from "./lineVoice";
import { useLineVoiceKey } from "./useLineVoice";
import type { Tx } from "./deviceFormat";

export interface LineListenProps {
  lineKey: string;
  text: string;
  /** Recorded voice ID of the line, when the scenario authors one. */
  voiceId?: string;
  /** Extra classes for the button (the color it sits on). */
  className?: string;
}

/** The clip of a line: a Mission 02 recording when the line has one, else the Mission 01 layout. */
function lineClipUrl(lineKey: string, voiceId: string | undefined, locale: Parameters<typeof mission01LineVoiceUrl>[1]): string {
  return mission02VoiceUrl(voiceId, locale) ?? mission01LineVoiceUrl(lineKey, locale);
}

export const LineListen: React.FC<LineListenProps> = ({ lineKey, text, voiceId, className = "" }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const playingKey = useLineVoiceKey();
  const [noVoice, setNoVoice] = useState(false);
  const playing = playingKey === lineKey;
  // Leaving the screen ends the line that this button started.
  useEffect(
    () => () => {
      if (lineVoiceKey() === lineKey) stopLineVoice();
    },
    [lineKey],
  );
  const press = () => {
    if (playing) {
      stopLineVoice();
      return;
    }
    setNoVoice(false);
    void playLineVoice(lineKey, text, locale, lineClipUrl(lineKey, voiceId, locale), { synthetic: true }).then((result) => {
      if (result === "none") setNoVoice(true);
    });
  };
  const label = playing ? t("device.conversation.stop") : t("device.conversation.listen");
  return (
    <>
      <button
        type="button"
        aria-pressed={playing}
        aria-label={label}
        title={label}
        data-testid={`line-listen-${lineKey}`}
        data-compact
        onClick={press}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full motion-safe:transition-colors cursor-pointer hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#8fe0e8] ${className}`}
      >
        {playing ? <Square className="h-3 w-3" aria-hidden="true" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      {noVoice && (
        <span role="status" className="basis-full text-[12px] leading-snug opacity-80">
          {t("device.conversation.noVoice")}
        </span>
      )}
    </>
  );
};

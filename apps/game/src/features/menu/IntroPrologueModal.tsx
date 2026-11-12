import React from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ui/ModalDialog";
import { DEFAULT_CHAPTER_ID, getChapter } from "../../game/chapters/chapterRegistry";
import { Play, ArrowLeft, Keyboard, Clock, MapPin, AlertCircle } from "lucide-react";

const FIRST_CHAPTER_NUMBER = getChapter(DEFAULT_CHAPTER_ID)?.number ?? 1;

const HOW_TO_PLAY_KEYS = ["move", "look", "interact", "phone", "journal", "pause"] as const;

interface IntroPrologueModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Starts loading Chapter 1. */
  onBegin: () => void;
}

export const IntroPrologueModal: React.FC<IntroPrologueModalProps> = ({
  isOpen,
  onClose,
  onBegin,
}) => {
  const { t } = useTranslation("menu");

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("prologue.title")}
      subtitle={t("prologue.subtitle")}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Narrative Banner */}
        <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#241f3b] to-[#161424] border border-[#483d6a] overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-mono text-[#b9a5f5] mb-2 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-[#f2b24b]" aria-hidden="true" /> {t("prologue.location")}
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{t("prologue.heading")}</h3>
          <p className="text-xs text-zinc-300 leading-relaxed">{t("prologue.intro")}</p>
          <div className="my-3 p-3 rounded-xl bg-black/40 border border-[#3b3452] font-mono text-xs text-amber-200/90 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-bold text-white block text-[11px] mb-0.5">
                {t("prologue.alertTitle")}
              </span>
              {t("prologue.alertBody")}
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{t("prologue.outro")}</p>
        </div>

        {/* How to play */}
        <div className="p-3.5 rounded-xl bg-[#1a1727] border border-[#352f4a]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Keyboard className="w-5 h-5 text-[#b9a5f5] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h4 className="text-xs font-semibold text-white">{t("prologue.howToPlay.heading")}</h4>
                <ul className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-300">
                  {HOW_TO_PLAY_KEYS.map((key) => (
                    <li key={key}>{t(`prologue.howToPlay.${key}`)}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-zinc-400">{t("prologue.howToPlay.simulation")}</p>
              </div>
            </div>
            <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-[#7654d6]/20 border border-[#7654d6]/40 text-[#e9e2ff]">
              <Clock className="w-3 h-3" aria-hidden="true" /> {t("prologue.duration")}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-[#1a1827] hover:bg-[#25223a] border border-[#38334f] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t("prologue.back")}
          </button>
          <button
            type="button"
            onClick={onBegin}
            className="py-2.5 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7654d6] to-[#5b3eb3] hover:from-[#8b6be8] hover:to-[#6a4ac4] shadow-lg shadow-[#7654d6]/40 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" aria-hidden="true" /> {t("prologue.begin", { number: FIRST_CHAPTER_NUMBER })}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { Accent, KEYCAP, SHADOW, stop } from "./PrologueHud";
import { hasNewQuest, questsWith, type QuestId, type QuestState } from "./quest/quests";

const ICON_QUEST = "/assets/ui/hud/scammaze-quest-icon-512.png";
const ICON_TASK = "/assets/ui/hud/task.webp";
const ICON_DOT = "/assets/ui/hud/dot.webp";

/** Keys the page listens for (shown as key caps; the page owns the handlers). */
export const QUEST_LIST_KEY = "J";
export const QUEST_PATH_KEY = "Q";

const useQuestText = () => {
  const { t } = useTranslation("worlds");
  // The key is built from the quest id, so it cannot be typed statically.
  return (key: string, options?: Record<string, unknown>) => (t as unknown as (k: string, o?: object) => string)(key, options);
};

export interface QuestListButtonProps {
  state: QuestState;
  onOpen: () => void;
  onHoverSound?: () => void;
  /** Placement from the host (it sits on the corner of the minimap). */
  className?: string;
}

/**
 * The task icon on the minimap's lower-left corner. `dot.webp` lies on the upper-right corner of the
 * bookmark shape (both files are 512 px canvases with the shape off center, so the dot is offset to
 * put its circle on that corner) and shows only while a new quest has not been looked at.
 */
export const QuestListButton: React.FC<QuestListButtonProps> = ({ state, onOpen, onHoverSound, className = "" }) => {
  const q = useQuestText();
  return (
    <button
      type="button"
      onMouseDown={stop}
      onClick={onOpen}
      onPointerEnter={onHoverSound}
      aria-label={q("quests.openList")}
      aria-keyshortcuts={QUEST_LIST_KEY}
      className={`pointer-events-auto z-10 flex h-14 w-14 items-center justify-center rounded-lg outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#b9a5f5] ${className}`}
    >
      <span className="relative block h-[3.25rem] w-[3.25rem]">
        <img src={ICON_TASK} alt="" draggable={false} className="h-full w-full select-none object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
        {hasNewQuest(state) && <img data-testid="quest-new-mark" src={ICON_DOT} alt="" aria-hidden="true" draggable={false} style={{ width: "115%", height: "115%", left: "28.8%", top: "-48%" }} className="absolute max-w-none select-none object-contain" />}
      </span>
    </button>
  );
};

export interface QuestTrackerProps {
  questId: QuestId;
  /** Meters to the target, or null when unknown. */
  distance: number | null;
  /** A quest that just started: shown with a "new quest" label and a glow for a few seconds. */
  fresh?: boolean;
  /** Lights the guide trail. */
  onShowPath: () => void;
  onHoverSound?: () => void;
}

/** The tracked quest outside the list: the objective block of the HUD. Press it (or Q) to light the path. */
export const QuestTracker: React.FC<QuestTrackerProps> = ({ questId, distance, fresh, onShowPath, onHoverSound }) => {
  const q = useQuestText();
  return (
    <section aria-labelledby="quest-tracker-heading" data-fresh={fresh ? "true" : undefined} className={`pointer-events-auto max-w-sm ${fresh ? "quest-fresh" : ""}`}>
      <h2 id="quest-tracker-heading" className={`flex items-center gap-2.5 font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#c9bbf7] ${SHADOW}`}>
        <Accent />
        {fresh ? <span className="text-[#b9a5f5]">{q("quests.newQuest")}</span> : q("khupho.game.story.objective")}
      </h2>
      <button
        type="button"
        onMouseDown={stop}
        onClick={onShowPath}
        onPointerEnter={onHoverSound}
        aria-keyshortcuts={QUEST_PATH_KEY}
        title={q("quests.showPath")}
        className="group mt-1.5 flex items-start gap-2.5 text-left outline-none cursor-pointer"
      >
        <img src={ICON_QUEST} alt="" width={26} height={26} draggable={false} className="mt-0.5 h-6 w-6 shrink-0 select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
        <span className="grid">
          <span className={`font-menu text-xl font-semibold uppercase leading-tight tracking-[0.03em] text-[#f3efe4] underline decoration-[#b9a5f5]/70 decoration-2 underline-offset-4 group-hover:decoration-[#f3efe4] group-focus-visible:decoration-[#f3efe4] ${SHADOW}`} aria-live="polite">
            {q(`quests.${questId}.title`)}
          </span>
          {distance !== null && <span className={`mt-0.5 font-menu text-sm font-semibold tracking-[0.08em] text-[#c9bbf7] ${SHADOW}`}>{q("quests.distance", { meters: Math.round(distance) })}</span>}
        </span>
      </button>
    </section>
  );
};

export interface QuestToastProps {
  /** Quest just completed; null hides the toast. */
  questId: QuestId | null;
}

/** "Quest complete" under the minimap for a few seconds. */
export const QuestToast: React.FC<QuestToastProps> = ({ questId }) => {
  const q = useQuestText();
  if (!questId) return null;
  return (
    <div role="status" data-testid="quest-toast" className={`pointer-events-none flex items-start gap-2 ${SHADOW}`}>
      <Check className="mt-1 h-4 w-4 shrink-0 text-[#6fe0a8]" aria-hidden="true" />
      <div>
        <p className="font-menu text-base font-semibold uppercase tracking-[0.04em] text-[#f3efe4]">{q(`quests.${questId}.title`)}</p>
        <p className="font-menu text-xl font-bold uppercase tracking-[0.04em] text-[#6fe0a8]">{q("quests.complete")}</p>
      </div>
    </div>
  );
};

export interface QuestListPanelProps {
  state: QuestState;
  onClose: () => void;
  /** Tracks the quest and lights its path. */
  onShowPath: (id: QuestId) => void;
  onHoverSound?: () => void;
}

/** The quest list: quests in progress, then completed ones. */
export const QuestListPanel: React.FC<QuestListPanelProps> = ({ state, onClose, onShowPath, onHoverSound }) => {
  const q = useQuestText();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const active = questsWith(state, "active");
  const done = questsWith(state, "done");
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="absolute inset-0 z-[66] flex items-center justify-center bg-black/55 p-4" onMouseDown={stop} onClick={stop}>
      <div role="dialog" aria-modal="true" aria-labelledby="quest-list-heading" className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-white/15 bg-[#12101c]/95 p-5 text-[#f3efe4] shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="quest-list-heading" className="flex items-center gap-2.5 font-menu text-2xl font-bold uppercase tracking-[0.06em]">
            <Accent />
            {q("quests.title")}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} onPointerEnter={onHoverSound} aria-label={q("quests.close")} aria-keyshortcuts={`${QUEST_LIST_KEY} Escape`} className="flex items-center gap-2 rounded border border-white/20 px-2 py-1 font-menu text-sm font-semibold uppercase tracking-[0.1em] text-zinc-200 outline-none hover:border-white/50 cursor-pointer">
            <span aria-hidden="true" className={KEYCAP}>{QUEST_LIST_KEY}</span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 space-y-5 overflow-y-auto pr-1">
          {active.length === 0 && done.length === 0 && <p className="text-sm text-zinc-400">{q("quests.empty")}</p>}
          {active.length > 0 && (
            <section aria-label={q("quests.inProgress")}>
              <h3 className="font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#c9bbf7]">{q("quests.inProgress")}</h3>
              <ul className="mt-2 space-y-2">
                {active.map((id) => (
                  <li key={id} className="rounded border border-[#7654d6]/50 bg-[#1b1830] p-3">
                    <div className="flex items-start gap-3">
                      <img src={ICON_QUEST} alt="" width={28} height={28} draggable={false} className="h-7 w-7 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-menu text-lg font-semibold uppercase tracking-[0.03em]">{q(`quests.${id}.title`)}</p>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{q(`quests.${id}.description`)}</p>
                        <button type="button" onClick={() => onShowPath(id)} onPointerEnter={onHoverSound} className="mt-2 rounded bg-[#7654d6] px-3 py-1 font-menu text-sm font-semibold uppercase tracking-[0.1em] text-white outline-none hover:bg-[#8b6be8] focus-visible:ring-2 focus-visible:ring-[#b9a5f5] cursor-pointer">
                          {state.tracked === id ? `${q("quests.tracking")} · ${q("quests.showPath")}` : q("quests.showPath")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section aria-label={q("quests.completed")}>
              <h3 className="font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#6fe0a8]">{q("quests.completed")}</h3>
              <ul className="mt-2 space-y-2">
                {done.map((id) => (
                  <li key={id} className="flex items-start gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#6fe0a8]" aria-hidden="true" />
                    <div>
                      <p className="font-menu text-lg font-semibold uppercase tracking-[0.03em] text-zinc-300">{q(`quests.${id}.title`)}</p>
                      <p className="mt-1 text-sm text-zinc-400">{q(`quests.${id}.done`)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

/** Meters to a target polled a few times a second (the page passes the engine reads). */
export function useDistance(read: () => number | null, active: boolean): number | null {
  const [value, setValue] = useState<number | null>(null);
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    if (!active) { setValue(null); return; }
    const tick = () => setValue(readRef.current());
    tick();
    const id = window.setInterval(tick, 300);
    return () => window.clearInterval(id);
  }, [active]);
  return value;
}

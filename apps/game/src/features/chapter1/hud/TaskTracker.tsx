// Task tracker under the map, in the style of the neighborhood quest tracker: the tracked mission's
// title, its current step in large type (press it, or T, for the task list), where the step happens
// with the distance to it, and the deadline. A new step glows for a moment as "New task"; a finished
// step shows "Complete" for a moment. Other open missions are one dim line each.
// Presentation only: the steps come from `selectOpenMissions`.
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { MissionView } from "../../../game/narrative/world";
import { Accent, SHADOW, stop } from "../../prologue/PrologueHud";
import { formatSpan, type Tx } from "../device/deviceFormat";
import { formatMeters, stepPlace } from "./taskText";

const ICON_QUEST = "/assets/ui/hud/scammaze-quest-icon-512.png";
/** How long a new step glows and a finished step shows "Complete" (ms). */
export const TASK_FRESH_MS = 4000;
export const TASK_DONE_MS = 3000;
/** Task key for the T shortcut (the list). */
export const TASK_LIST_KEY = "T";

export interface TaskTrackerProps {
  /** The tracked mission. */
  mission: MissionView;
  /** The other open missions, shown as one line each. */
  others?: readonly MissionView[];
  /** Metres to the current step's prop, or null when unknown. */
  distance?: number | null;
  onOpenList: () => void;
  onHoverSound?: () => void;
  /** One line (the band above the open laptop): the step and where it happens; no title, deadline or other missions. */
  compact?: boolean;
}

export const TaskTracker: React.FC<TaskTrackerProps> = ({ mission, others = [], distance = null, onOpenList, onHoverSound, compact = false }) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as Tx;
  const step = mission.current;
  const key = step ? `${mission.id}/${step.id}` : `${mission.id}/-`;

  // "New task" glow on every new current step (also the first one), and "Complete" for the step before it.
  const [fresh, setFresh] = useState(true);
  const [finished, setFinished] = useState<string | null>(null);
  const previous = useRef<{ key: string; missionId: string; stepId: string | null }>({ key, missionId: mission.id, stepId: step?.id ?? null });
  useEffect(() => {
    const before = previous.current;
    previous.current = { key, missionId: mission.id, stepId: step?.id ?? null };
    if (before.key === key) {
      setFresh(true);
    } else {
      setFresh(step !== null);
      // Only a step of the same mission that is now done counts (tracking another mission does not).
      const doneBefore = before.missionId === mission.id ? mission.steps.find((candidate) => candidate.id === before.stepId && candidate.done) : undefined;
      if (doneBefore) setFinished(doneBefore.label);
    }
    const id = window.setTimeout(() => setFresh(false), TASK_FRESH_MS);
    return () => window.clearTimeout(id);
    // `step.label` changes with the locale only; the key is what marks a new step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (finished === null) return undefined;
    const id = window.setTimeout(() => setFinished(null), TASK_DONE_MS);
    return () => window.clearTimeout(id);
  }, [finished]);

  const place = step ? stepPlace(text, step) : null;
  const where = [place, distance !== null && step?.target ? formatMeters(text, distance) : null].filter(Boolean).join(" · ");

  if (compact) {
    return (
      <section aria-label={mission.title} data-testid="task-tracker" data-compact="true" className={`pointer-events-auto flex min-w-0 items-center gap-2 ${SHADOW}`}>
        <button
          type="button"
          onMouseDown={stop}
          onClick={onOpenList}
          onPointerEnter={onHoverSound}
          aria-keyshortcuts={TASK_LIST_KEY}
          title={t("taskSystem.openList")}
          className={`group flex min-w-0 items-center gap-2 text-left outline-none cursor-pointer ${fresh ? "quest-fresh" : ""}`}
        >
          <img src={ICON_QUEST} alt="" width={20} height={20} draggable={false} className="h-5 w-5 shrink-0 select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
          <span data-testid="task-current" className="truncate font-menu text-sm font-semibold uppercase tracking-[0.04em] text-[#f3efe4] underline decoration-[#b9a5f5]/70 underline-offset-4 group-hover:decoration-[#f3efe4]">
            {step ? step.label : mission.objective}
          </span>
          {place && (
            <span data-testid="task-where" className="shrink-0 font-menu text-xs font-semibold tracking-[0.08em] text-[#c9bbf7]">
              {place}
            </span>
          )}
        </button>
        {finished !== null && (
          <span data-testid="task-step-done" className="flex shrink-0 items-center gap-1 font-menu text-xs font-bold uppercase tracking-[0.06em] text-[#6fe0a8]">
            <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />
            {t("taskSystem.complete")}
          </span>
        )}
        <p className="sr-only" aria-live="polite">
          {step ? t("taskSystem.announce.newStep", { step: step.label }) : ""}
          {finished !== null ? ` ${t("taskSystem.announce.stepDone", { step: finished })}` : ""}
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="task-tracker-heading" data-testid="task-tracker" data-fresh={fresh ? "true" : undefined} className={`pointer-events-auto max-w-sm ${SHADOW}`}>
      <h2 id="task-tracker-heading" className="flex items-center gap-2.5 font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#c9bbf7]">
        <Accent />
        {fresh ? <span className="text-[#f3c969]">{t("taskSystem.newTask")}</span> : <span>{mission.title}</span>}
      </h2>
      {finished !== null && (
        <p data-testid="task-step-done" className="mt-1.5 flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6fe0a8]" aria-hidden="true" strokeWidth={3} />
          <span className="font-menu text-sm font-semibold uppercase tracking-[0.04em] text-zinc-300 line-through decoration-zinc-500">{finished}</span>
          <span className="font-menu text-sm font-bold uppercase tracking-[0.06em] text-[#6fe0a8]">{t("taskSystem.complete")}</span>
        </p>
      )}
      <button
        type="button"
        onMouseDown={stop}
        onClick={onOpenList}
        onPointerEnter={onHoverSound}
        aria-keyshortcuts={TASK_LIST_KEY}
        title={t("taskSystem.openList")}
        className={`group mt-1.5 flex items-start gap-2.5 text-left outline-none cursor-pointer ${fresh ? "quest-fresh" : ""}`}
      >
        <img src={ICON_QUEST} alt="" width={26} height={26} draggable={false} className="mt-0.5 h-6 w-6 shrink-0 select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]" />
        <span className="grid">
          <span
            data-testid="task-current"
            className="font-menu text-xl font-semibold uppercase leading-tight tracking-[0.03em] text-[#f3efe4] underline decoration-[#b9a5f5]/70 decoration-2 underline-offset-4 group-hover:decoration-[#f3efe4] group-focus-visible:decoration-[#f3efe4]"
          >
            {step ? step.label : mission.objective}
          </span>
          {where !== "" && (
            <span data-testid="task-where" className="mt-1 font-menu text-sm font-semibold tracking-[0.08em] text-[#c9bbf7]">
              {where}
            </span>
          )}
          {mission.minutesLeft !== null && (
            <span className="mt-0.5 font-menu text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {t("taskSystem.due", { time: formatSpan(text, mission.minutesLeft) })}
            </span>
          )}
        </span>
      </button>
      {others.length > 0 && (
        <ul className="mt-2 space-y-1 opacity-70 transition-opacity duration-200 hover:opacity-100" data-testid="task-others">
          {others.map((other) => (
            <li key={other.id} className="flex items-start gap-2 pl-[34px]">
              <span aria-hidden="true" className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rotate-45 bg-[#b9a5f5]/80" />
              <span className="font-menu text-[13px] leading-snug tracking-[0.02em] text-zinc-300">
                <span className="font-semibold uppercase tracking-[0.06em]">{other.title}</span>
                {other.current ? <span className="text-zinc-400"> · {other.current.label}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only" aria-live="polite">
        {step ? t("taskSystem.announce.newStep", { step: step.label }) : ""}
        {finished !== null ? ` ${t("taskSystem.announce.stepDone", { step: finished })}` : ""}
      </p>
    </section>
  );
};

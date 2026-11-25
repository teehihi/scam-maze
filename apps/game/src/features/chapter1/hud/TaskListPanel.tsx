// Task list (the task icon on the map, or T): open missions with their steps, then the missions that
// ended. Same look as the neighborhood quest list. Presentation only; "Track" (or a click on the mission or a sub-task) picks what the
// tracker and the marker follow.
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import type { ClosedMissionView, MissionStepView, MissionView } from "../../../game/narrative/world";
import { Accent, KEYCAP } from "../../prologue/PrologueHud";
import { formatSpan, type Tx } from "../device/deviceFormat";
import { stepPlace } from "./taskText";
import { TASK_LIST_KEY } from "./TaskTracker";

const ICON_QUEST = "/assets/ui/hud/scammaze-quest-icon-512.png";

export interface TaskListPanelProps {
  open: readonly MissionView[];
  closed: readonly ClosedMissionView[];
  trackedId: string | null;
  /** The sub-task the tracker shows now (the mission's current step unless the player picked another). */
  trackedStepId?: string | null;
  onTrack: (missionId: string) => void;
  /** Track one sub-task of a mission (also tracks the mission). */
  onTrackStep?: (missionId: string, stepId: string) => void;
  onClose: () => void;
  onHoverSound?: () => void;
}

const StepRow: React.FC<{ step: MissionStepView; current: boolean; text: Tx; onPick?: () => void; onHoverSound?: () => void }> = ({ step, current, text, onPick, onHoverSound }) => {
  const place = stepPlace(text, step);
  return (
    <li data-testid={`task-step-${step.id}`} data-state={step.done ? "done" : current ? "current" : "open"} className="flex items-start gap-2.5">
      {step.done ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6fe0a8]" strokeWidth={3} aria-hidden="true" />
      ) : current ? (
        <img src={ICON_QUEST} alt="" width={16} height={16} draggable={false} className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <span aria-hidden="true" className="ml-[5px] mr-[3px] mt-[0.45rem] h-1.5 w-1.5 shrink-0 rotate-45 border border-[#b9a5f5]" />
      )}
      <div className="min-w-0">
        {onPick && !step.done && !current ? (
          <button
            type="button"
            data-testid={`task-step-track-${step.id}`}
            onClick={onPick}
            onPointerEnter={onHoverSound}
            title={text("taskSystem.list.track")}
            className="block cursor-pointer text-left text-sm leading-snug text-zinc-300 underline decoration-[#b9a5f5]/40 underline-offset-2 outline-none hover:text-[#f3efe4] hover:decoration-[#f3efe4] focus-visible:decoration-[#f3efe4]"
          >
            {step.label}
            {step.optional && <span className="ml-1.5 text-xs font-normal uppercase tracking-[0.1em] text-zinc-500">({text("taskSystem.optional")})</span>}
          </button>
        ) : (
        <p className={`text-sm leading-snug ${step.done ? "text-zinc-500 line-through decoration-zinc-600" : current ? "font-semibold text-[#f3efe4]" : "text-zinc-300"}`}>
          {step.done && <span className="sr-only">{text("taskSystem.list.done")}: </span>}
          {current && <span className="sr-only">{text("taskSystem.list.current")}: </span>}
          {step.label}
          {step.optional && <span className="ml-1.5 text-xs font-normal uppercase tracking-[0.1em] text-zinc-500">({text("taskSystem.optional")})</span>}
        </p>
        )}
        {place && !step.done && <p className="text-xs tracking-[0.04em] text-[#c9bbf7]">{place}</p>}
      </div>
    </li>
  );
};

export const TaskListPanel: React.FC<TaskListPanelProps> = ({ open, closed, trackedId, trackedStepId = null, onTrack, onTrackStep, onClose, onHoverSound }) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as Tx;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="absolute inset-0 z-[66] flex items-center justify-center bg-black/55 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-list-heading"
        data-testid="task-list"
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-white/15 bg-[#12101c]/95 p-5 text-[#f3efe4] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="task-list-heading" className="flex items-center gap-2.5 font-menu text-2xl font-bold uppercase tracking-[0.06em]">
            <Accent />
            {t("taskSystem.list.title")}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            onPointerEnter={onHoverSound}
            aria-label={t("taskSystem.list.close")}
            aria-keyshortcuts={`${TASK_LIST_KEY} Escape`}
            className="flex items-center gap-2 rounded border border-white/20 px-2 py-1 font-menu text-sm font-semibold uppercase tracking-[0.1em] text-zinc-200 outline-none hover:border-white/50 focus-visible:border-[#f3efe4] cursor-pointer"
          >
            <span aria-hidden="true" className={KEYCAP}>
              {TASK_LIST_KEY}
            </span>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 space-y-5 overflow-y-auto overscroll-contain pr-1" onWheel={(event) => event.stopPropagation()}>
          {open.length === 0 && closed.length === 0 && <p className="text-sm text-zinc-400">{t("taskSystem.list.empty")}</p>}
          {open.length > 0 && (
            <section aria-labelledby="task-list-open">
              <h3 id="task-list-open" className="font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#c9bbf7]">
                {t("taskSystem.list.inProgress")}
              </h3>
              <ul className="mt-2 space-y-2">
                {open.map((mission) => {
                  const tracked = mission.id === trackedId;
                  return (
                    <li key={mission.id} data-testid={`task-mission-${mission.id}`} className={`rounded border p-3 ${tracked ? "border-[#7654d6]/70 bg-[#1b1830]" : "border-white/10 bg-white/[0.03]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-menu text-lg font-semibold uppercase tracking-[0.03em]">
                            <button
                              type="button"
                              data-testid={`task-mission-pick-${mission.id}`}
                              onClick={() => onTrack(mission.id)}
                              onPointerEnter={onHoverSound}
                              disabled={tracked && (mission.current?.id ?? null) === trackedStepId}
                              className="cursor-pointer text-left uppercase outline-none hover:text-white focus-visible:underline disabled:cursor-default"
                            >
                              {mission.title}
                            </button>
                            {mission.optional && <span className="ml-2 align-middle text-xs font-normal tracking-[0.1em] text-zinc-400">{t("taskSystem.optional")}</span>}
                          </p>
                          {mission.minutesLeft !== null && (
                            <p className="font-menu text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{t("taskSystem.due", { time: formatSpan(text, mission.minutesLeft) })}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onTrack(mission.id)}
                          onPointerEnter={onHoverSound}
                          disabled={tracked}
                          aria-pressed={tracked}
                          className="shrink-0 rounded bg-[#7654d6] px-3 py-1 font-menu text-sm font-semibold uppercase tracking-[0.1em] text-white outline-none hover:bg-[#8b6be8] focus-visible:ring-2 focus-visible:ring-[#b9a5f5] disabled:bg-transparent disabled:text-[#c9bbf7] disabled:ring-1 disabled:ring-[#7654d6]/60 cursor-pointer disabled:cursor-default"
                        >
                          {tracked ? t("taskSystem.list.tracking") : t("taskSystem.list.track")}
                        </button>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{mission.objective}</p>
                      {mission.steps.length > 0 && (
                        <ol className="mt-2.5 space-y-1.5">
                          {mission.steps.map((step) => (
                            <StepRow key={step.id} step={step} current={(tracked ? trackedStepId : mission.current?.id) === step.id} text={text} onPick={onTrackStep ? () => onTrackStep(mission.id, step.id) : undefined} onHoverSound={onHoverSound} />
                          ))}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {closed.length > 0 && (
            <section aria-labelledby="task-list-closed">
              <h3 id="task-list-closed" className="font-menu text-xs font-semibold uppercase tracking-[0.3em] text-[#6fe0a8]">
                {t("taskSystem.list.completed")}
              </h3>
              <ul className="mt-2 space-y-2">
                {closed.map((mission) => (
                  <li key={mission.id} className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                    {mission.status === "completed" ? (
                      <Check className="h-4 w-4 shrink-0 text-[#6fe0a8]" strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-[#f07a6a]" strokeWidth={3} aria-hidden="true" />
                    )}
                    <p className="font-menu text-base font-semibold uppercase tracking-[0.03em] text-zinc-300">{mission.title}</p>
                    <p className={`ml-auto text-xs uppercase tracking-[0.1em] ${mission.status === "completed" ? "text-[#6fe0a8]" : "text-[#f07a6a]"}`}>
                      {mission.status === "completed" ? t("taskSystem.list.done") : t("taskSystem.list.failed")}
                    </p>
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

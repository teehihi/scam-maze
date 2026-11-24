// Thesis work: progress comes from thesis tasks (interviews, revisions, document checks, the
// supervisor's confirmation, the final version) and from free work sessions that stop at a limit.
// Used in the schedule overlay and in the laptop's Thesis tab. Other deadlines keep running.
import React from "react";
import { GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FatigueLevel, RestMode } from "../../../game/narrative/fatigue";
import type { ThesisTaskView } from "../../../game/narrative/world";
import { UI } from "../theme";
import { formatDuration, type DurationText } from "./formatDuration";

/** `dark`: the schedule overlay. `paper`: the laptop's Thesis window, a white page like a word processor. */
export type ThesisTone = "dark" | "paper";

const FOCUS_PAPER = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3a63c2]";
const TONES = {
  dark: {
    card: UI.card,
    label: UI.label,
    body: UI.body,
    text: "text-[#f7f5ff]",
    muted: "text-[#a9a4c4]",
    primary: UI.buttonPrimary,
    secondary: UI.buttonSecondary,
  },
  paper: {
    card: "",
    label: "text-xs font-semibold uppercase tracking-wider text-[#3a63c2]",
    body: "text-sm leading-relaxed text-[#4b5563]",
    text: "text-[#1f2937]",
    muted: "text-[#6b7280]",
    primary: `flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#3a63c2] px-5 py-2.5 text-sm font-semibold text-white motion-safe:transition-colors hover:bg-[#2f52a3] disabled:cursor-not-allowed disabled:bg-[#d7deec] disabled:text-[#7b879e] ${FOCUS_PAPER}`,
    secondary: `flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#c9d3e6] bg-white px-4 py-2 text-left text-sm font-medium text-[#1f2937] motion-safe:transition-colors hover:bg-[#eef2fa] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_PAPER}`,
  },
} as const;

export interface ThesisPanelProps {
  /** Look of the panel. Default `dark`. */
  tone?: ThesisTone;
  progress: number;
  /** Minutes of one session and the percent it adds. */
  sessionMinutes: number;
  sessionPercent: number;
  /** Free work stops at this percent. */
  freeWorkMaxPercent: number;
  timeLeftMinutes: number;
  tasks: readonly ThesisTaskView[];
  onWork: (minutes: number) => void;
  /** Completes a thesis task; the laptop may provide a deliberate review approach. */
  onTask: (taskId: string, approachId?: string) => boolean | void;
  /** Present when the scenario has fatigue rules: how tired Alex is and how much longer work takes. */
  fatigue?: { level: FatigueLevel; slowdownPercent: number };
  /** Present when the scenario has fatigue rules: the rest options and their length. */
  rest?: { napMinutes: number; sleepMinutes: number; onRest: (mode: RestMode) => void };
}

export const ThesisPanel: React.FC<ThesisPanelProps> = ({
  tone = "dark",
  progress,
  sessionMinutes,
  sessionPercent,
  freeWorkMaxPercent,
  timeLeftMinutes,
  tasks,
  onWork,
  onTask,
  fatigue,
  rest,
}) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as DurationText;
  const complete = progress >= 100;
  const timeUp = timeLeftMinutes <= 0;
  const atLimit = progress >= freeWorkMaxPercent;
  const blocked = complete || timeUp || atLimit || sessionPercent < 1;
  const k = TONES[tone];
  return (
    <section aria-labelledby="thesis-panel-heading" data-testid="thesis-panel" className={k.card}>
      <h3 id="thesis-panel-heading" className={`${k.label} flex items-center gap-2`}>
        <GraduationCap className="h-4 w-4" aria-hidden="true" />
        {t("planner.thesis.heading")}
      </h3>
      <p className={`mt-2 text-sm ${k.text}`} data-testid="thesis-progress">
        {t("planner.thesis.progress", { value: progress })}
      </p>
      <p className={`${k.body} mt-1`}>
        {t("planner.thesis.session", { time: formatDuration(text, sessionMinutes), percent: sessionPercent })}
      </p>
      <p className={`${k.body} mt-1`} data-testid="thesis-limit">
        {t("planner.thesis.limit", { percent: freeWorkMaxPercent })}
      </p>
      <button
        type="button"
        className={`${k.primary} mt-3`}
        disabled={blocked}
        data-testid="thesis-work"
        onClick={() => onWork(sessionMinutes)}
      >
        {t("planner.thesis.work", { time: formatDuration(text, sessionMinutes) })}
      </button>
      {fatigue !== undefined && fatigue.level !== "rested" && (
        <p className={`${k.body} mt-2`} data-testid="thesis-fatigue">
          {t(`planner.thesis.fatigueNote.${fatigue.level}`, { percent: fatigue.slowdownPercent })}
        </p>
      )}
      {complete && <p className={`${k.body} mt-2`}>{t("planner.thesis.complete")}</p>}
      {!complete && timeUp && <p className={`${k.body} mt-2`}>{t("planner.thesis.timeUp")}</p>}

      {rest !== undefined && (
        <div className="mt-4" data-testid="rest-panel">
          <h4 className={k.label}>{t("planner.thesis.restHeading")}</h4>
          <p className={`${k.body} mt-1`}>{t("planner.thesis.restHint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={k.secondary} disabled={timeUp} data-testid="rest-nap" onClick={() => rest.onRest("nap")}>
              {t("planner.thesis.nap", { time: formatDuration(text, rest.napMinutes) })}
            </button>
            <button type="button" className={k.secondary} disabled={timeUp} data-testid="rest-sleep" onClick={() => rest.onRest("sleep")}>
              {t("planner.thesis.sleep", { time: formatDuration(text, rest.sleepMinutes) })}
            </button>
          </div>
        </div>
      )}
      <h4 className={`${k.label} mt-4`}>{t("planner.thesis.tasksHeading")}</h4>
      {tasks.length === 0 ? (
        <p className={`${k.body} mt-1`}>{t("planner.thesis.noTasks")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="space-y-1">
              {task.description && <p className={k.body}>{task.description}</p>}
              <button
                type="button"
                className={k.secondary}
                disabled={task.blocked !== null}
                aria-describedby={task.blocked === null ? undefined : `thesis-task-${task.id}-blocked`}
                data-testid={`thesis-task-${task.id}`}
                onClick={() => onTask(task.id)}
              >
                {task.timeCostMinutes > 0
                  ? t("planner.thesis.taskCost", { label: task.label, time: formatDuration(text, task.timeCostMinutes), percent: task.progressGain })
                  : t("planner.thesis.taskGain", { label: task.label, percent: task.progressGain })}
              </button>
              {task.blocked !== null && (
                <p id={`thesis-task-${task.id}-blocked`} className={`text-xs ${k.muted}`}>
                  {t(`planner.thesis.blocked.${task.blocked}`)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
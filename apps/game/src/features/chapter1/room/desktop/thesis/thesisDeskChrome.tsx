// Shared chrome of the Thesis desk: the tool buttons, the approach list and the evidence tray that
// the three interactive reviews use. Presentation only; every action goes through `onChoose`.
import React from "react";
import type { ThesisTaskView } from "../../../../../game/narrative/world";
import { formatDuration, type DurationText } from "../../../world/formatDuration";

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3a63c2]";
export const SECONDARY = `inline-flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[#c9d3e6] bg-white px-3.5 py-3 text-left text-sm font-medium text-[#1f2937] transition-colors hover:bg-[#eef2fa] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;
export const QUIET = `inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#3a63c2] transition-colors hover:bg-[#eef2fa] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;
export const QUIET_BORDERED = `inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#c9d3e6] bg-white px-3 py-1.5 text-xs font-medium text-[#1f2937] transition-colors hover:bg-[#eef2fa] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;
/** A white tool button with a leading icon: "Inspect", "Compare totals". */
export const TOOL = `inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#c9d3e6] bg-white px-3 py-2 text-left text-xs font-semibold text-[#1f2937] transition-colors hover:border-[#3a63c2] hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`;
/** The small stepper button of the findings chart. */
export const MINI = `inline-flex cursor-pointer items-center justify-center rounded-md border border-[#c9d3e6] bg-white px-2 py-1 text-xs font-semibold tabular-nums text-[#1f2937] transition-colors hover:border-[#3a63c2] hover:bg-[#eef2fa] ${FOCUS_RING}`;

export interface CitationInvestigationState {
  claimInspected: boolean;
  selectedTerm: string | null;
  openSources: ReadonlySet<number>;
}

export interface FindingsInvestigationState {
  inspectedExcerpt: boolean;
  inspectedChart: boolean;
  selectedParticipant: number | null;
  counts: { business: number; economics: number };
  compared: boolean;
  duplicatesScanned?: boolean;
}

export interface FinalInvestigationState {
  pages: ReadonlySet<string>;
  checks: ReadonlySet<string>;
}

export interface ThesisInvestigationState {
  citation: CitationInvestigationState;
  findings: FindingsInvestigationState;
  final: FinalInvestigationState;
}

export interface ReviewProps {
  task: ThesisTaskView;
  index: number;
  t: Translate;
  duration: DurationText;
  onChoose: (task: ThesisTaskView, approachId?: string) => void;
  /** Presentation-only investigation state owned by the thesis desk session. */
  investigation?: ThesisInvestigationState;
  onInvestigationChange?: (next: Partial<ThesisInvestigationState>) => void;
  /** Optional deadline context, supplied by the room's authoritative clock. */
  deadlineMinutesLeft?: number;
  /**
   * Local evidence work must be finished before the authored approach is offered. Blocks the
   * buttons only: there is never a state a careful player cannot leave.
   */
  ready?: boolean;
  /** Shown while `ready` is false: what the desk still expects. */
  readyHint?: string;
}

/** The authored approaches of the scenario, with their simulated cost and progress. */
export const ChoiceList: React.FC<ReviewProps> = ({ task, index, t, duration, onChoose, ready = true, readyHint, deadlineMinutesLeft }) => {
  const canChoose = task.blocked === null && ready;
  // `timeCostMinutes` of the view is already fatigue-adjusted by `selectThesisView`, so it is exactly
  // what `COMPLETE_THESIS_TASK` will spend. Applying the slowdown a second time would overstate it.
  const deadlineLine = (minutes: number) => {
    if (deadlineMinutesLeft === undefined) return null;
    const left = deadlineMinutesLeft - minutes;
    return (
      <span className={`mt-1 block text-[10px] leading-relaxed ${left <= 0 ? "text-[#b42318]" : "text-[#6b7280]"}`} data-testid="thesis-deadline-forecast">
        {left <= 0 ? t("laptop.thesisDesk.deadlineMissed") : t("laptop.thesisDesk.deadlineAfter", { time: formatDuration(duration, left) })}
      </span>
    );
  };
  return (
    <div>
      <h5 className="text-sm font-semibold text-[#1f2937]">{t("laptop.thesisDesk.choiceLabel")}</h5>
      {task.approaches.length === 0 ? (
        // A task the scenario defines without approaches keeps the plain deterministic action.
        <button
          type="button"
          className={`${SECONDARY} mt-2 w-full`}
          disabled={!canChoose}
          data-testid={`thesis-complete-${task.id}-${index}`}
          onClick={() => onChoose(task)}
        >
          <span className="min-w-0">{t("laptop.thesisDesk.completeTask")}</span>
          <span className="shrink-0 text-right text-xs font-medium tabular-nums text-[#3a63c2]">
            <span className="block">{formatDuration(duration, task.timeCostMinutes)}</span>
            <span className="mt-0.5 block">+{task.progressGain}%</span>
            {deadlineLine(task.timeCostMinutes)}
          </span>
        </button>
      ) : (
        <div className="mt-2 grid gap-2">
          {task.approaches.map((approach) => (
            <button
              key={approach.id}
              type="button"
              className={SECONDARY}
              disabled={!canChoose}
              data-testid={`thesis-approach-${task.id}-${approach.id}`}
              onClick={() => onChoose(task, approach.id)}
            >
              <span className="min-w-0">
                <span className="block">{approach.label}</span>
                {approach.description && (
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-[#6b7280]">{approach.description}</span>
                )}
              </span>
              <span className="shrink-0 text-right text-xs font-medium tabular-nums text-[#3a63c2]">
                <span className="block">{formatDuration(duration, approach.timeCostMinutes)}</span>
                <span className="mt-0.5 block">+{approach.progressGain}%</span>
                {deadlineLine(approach.timeCostMinutes)}
              </span>
            </button>
          ))}
        </div>
      )}
      {!ready && task.blocked === null && readyHint !== undefined && (
        <p className="mt-2 text-xs leading-relaxed text-[#6b7280]" data-testid="thesis-ready-hint">
          {readyHint}
        </p>
      )}
      {task.blocked !== null && <p className="mt-2 text-xs text-[#6b7280]">{t(`planner.thesis.blocked.${task.blocked}`)}</p>}
    </div>
  );
};

// The laptop's Thesis desk: an interactive research workspace. Thesis Map on the left, the review
// canvas on the right, and one slim status strip (progress, time, quality) above. Each section is an inspection task (Citation Detective, Data Forensics, Final Draft
// Assembly); the authored approach the player picks is the only thing that reaches the reducer, so
// progress, time, fatigue and quality stay in the deterministic core. Free writing stays underneath.
import React, { useEffect, useRef, useState } from "react";
import { BellRing, Check, CheckCircle2, Database, FileCheck2, FileText, PenLine, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ThesisQuality, ThesisTaskView } from "../../../../../game/narrative/world";
import type { ThesisPanelProps } from "../../../world/ThesisPanel";
import { formatDuration, type DurationText } from "../../../world/formatDuration";
import { useDesktopNav } from "../desktopNav";
import { CitationDetective } from "./CitationDetective";
import { DataForensics } from "./DataForensics";
import { DraftAssembly } from "./DraftAssembly";
import { WritingMode, type ThesisWritingHost } from "./writing/WritingMode";
import { SPRINT_IDS, SPRINT_SECTION, sprintFor } from "./writing/writingSprints";
import {
  ChoiceList,
  FOCUS_RING,
  QUIET,
  QUIET_BORDERED,
  type ReviewProps,
  type ThesisInvestigationState,
  type Translate,
} from "./thesisDeskChrome";

export interface ThesisWindowProps extends Omit<ThesisPanelProps, "tone" | "onTask" | "onWork"> {
  /** One free work session; returns whether the core accepted it (the Writing Mode commits through it). */
  onWork: (minutes: number) => boolean | void;
  /** The Writing Mode host (room story layer). Without it the desk offers only the work button. */
  writing?: ThesisWritingHost;
  /** The deterministic draft state from `selectThesisView`; never computed here. */
  quality: ThesisQuality;
  /** Returns whether the core accepted the action, so the desk never confirms a rejected review. */
  onTask: (taskId: string, approachId?: string) => boolean | void;
  /** Simulated minutes left until the draft deadline, or absent when the scenario has none. */
  draftDeadlineMinutesLeft?: number;
  /** Work that arrived while the desk is open: a non-modal chip, never a window that takes over. */
  distractions?: readonly { key: string; appId: string; label: string; count: number }[];
}

/** Investigation work of the three reviews. Session-local: it is not saved and not scored. */
const INITIAL_INVESTIGATION: ThesisInvestigationState = {
  citation: { claimInspected: false, selectedTerm: null, openSources: new Set() },
  findings: { inspectedExcerpt: false, inspectedChart: false, selectedParticipant: null, counts: { business: 4, economics: 4 }, compared: false, duplicatesScanned: false },
  final: { pages: new Set(), checks: new Set() },
};

/** Every authored approach whose draft change the desk can describe, plus the generic line. */
const DRAFT_DIFF_KEYS = [
  "qualify",
  "swap-source",
  "rewrite",
  "fix-chart",
  "fix-conclusion",
  "mark-check",
  "delete-claim",
  "quick-scan",
  "full-review",
  "ask-supervisor",
  "generic",
] as const;
type DraftDiffKey = (typeof DRAFT_DIFF_KEYS)[number];

/** The diff line of an approach; an approach without authored wording falls back to `generic`. */
function draftDiffKey(approachId: string | undefined): DraftDiffKey {
  return approachId !== undefined && (DRAFT_DIFF_KEYS as readonly string[]).includes(approachId) ? (approachId as DraftDiffKey) : "generic";
}

function iconForTask(id: string): React.ReactNode {
  if (id === "draft.findings") return <Database className="h-3.5 w-3.5" aria-hidden="true" />;
  if (id === "draft.final") return <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />;
  return <FileText className="h-3.5 w-3.5" aria-hidden="true" />;
}

/** `1`, `2`, `3`: the position of the section in the draft. */
function taskNumber(id: string, index: number): string {
  if (id === "draft.findings") return "2";
  if (id === "draft.final") return "3";
  if (id === "draft.intro-review") return "1";
  return String(index + 1);
}

const GenericReview: React.FC<ReviewProps> = (props) => (
  <div className="rounded-lg border border-[#c9d3e6] bg-[#fbfcff] p-4">
    <p className="text-sm leading-relaxed text-[#4b5563]">{props.task.description ?? props.t("laptop.thesisDesk.continueHint")}</p>
    <div className="mt-4">
      <ChoiceList {...props} />
    </div>
  </div>
);

export const ThesisWindow: React.FC<ThesisWindowProps> = (props) => {
  const { t } = useTranslation("chapter1");
  const nav = useDesktopNav();
  const text = t as unknown as Translate;
  const duration = t as unknown as DurationText;
  const { tasks, progress, timeLeftMinutes, fatigue, rest, sessionMinutes, onTask, onWork, quality, draftDeadlineMinutesLeft, distractions = [] } = props;
  const firstOpenId = tasks.find((task) => task.blocked === null)?.id ?? tasks[0]?.id ?? null;
  const [activeTaskId, setActiveTaskId] = useState<string | null>(firstOpenId);
  const [versionSaved, setVersionSaved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [investigation, setInvestigation] = useState<ThesisInvestigationState>(INITIAL_INVESTIGATION);
  const [draftDiff, setDraftDiff] = useState<{ taskId: string; approachId?: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Ctrl/Cmd+S saves a local draft version. It never touches the game state.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      setVersionSaved(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeIndex = Math.max(0, tasks.findIndex((task) => task.id === activeTaskId));
  const activeTask = tasks[activeIndex] ?? null;
  const timeUp = timeLeftMinutes <= 0;
  const atLimit = progress >= props.freeWorkMaxPercent;
  const tired = fatigue !== undefined && fatigue.level !== "rested" ? fatigue : null;
  // A tired Alex sees a lower focus, which is the same rule that makes work minutes cost more.
  const focus = tired ? Math.max(35, 100 - tired.slowdownPercent) : 100;

  // Records the review, then hands over to the next section that is still open. A finished section
  // can still be opened from the map: only a recorded review moves the desk on.
  const choose = (task: ThesisTaskView, approachId?: string) => {
    if (onTask(task.id, approachId) === false) {
      setRejected(true);
      return;
    }
    setRejected(false);
    // The diff names the section it belongs to, so it stays readable after the desk moves on to the
    // next one: it is the latest accepted review, not a property of the open canvas.
    setDraftDiff({ taskId: task.id, ...(approachId === undefined ? {} : { approachId }) });
    const from = tasks.indexOf(task);
    const others = [...tasks.slice(from + 1), ...tasks.slice(0, from)].filter((candidate) => candidate.id !== task.id);
    const next = others.find((candidate) => candidate.blocked === null) ?? others.find((candidate) => candidate.blocked === "locked" && !candidate.done);
    if (next) setActiveTaskId(next.id);
  };

  const onInvestigationChange = (next: Partial<ThesisInvestigationState>) => setInvestigation((current) => ({ ...current, ...next }));

  // Writing Mode: the same free work session as the work button, earned by typing a short passage.
  const writing = props.writing;
  const workBlocked = timeUp || atLimit || progress >= 100 || props.sessionPercent < 1;
  const sprint = sprintFor(writing?.completedSessions ?? 0);
  const sprintText = t(`laptop.thesisDesk.writing.sprints.${sprint.id}`);
  const openReview = tasks.find((task) => task.blocked === null && !task.done) ?? null;
  const writingView =
    writing?.active === true ? (
      <WritingMode
        sprintKey={`${sprint.id}:${sprintText}`}
        sprintText={sprintText}
        sprintNumber={sprint.index + 1}
        sprintTotal={SPRINT_IDS.length}
        sectionLabel={t(`laptop.thesisDesk.writing.sections.${SPRINT_SECTION[sprint.id]}`)}
        draft={writing.draft}
        onDraft={writing.onDraft}
        relaxed={writing.relaxed}
        onRelaxed={writing.onRelaxed}
        commitTime={formatDuration(duration, sessionMinutes)}
        gainPercent={props.sessionPercent}
        progress={progress}
        timeLeftMinutes={timeLeftMinutes}
        formatTime={(minutes) => formatDuration(duration, minutes)}
        onCommit={() => !workBlocked && onWork(sessionMinutes) === true}
        onKey={writing.onKey}
        onExit={() => writing.setActive(false)}
        issue={
          openReview === null
            ? null
            : {
                label: openReview.label,
                onOpen: () => {
                  writing.setActive(false);
                  setActiveTaskId(openReview.id);
                  setRejected(false);
                },
              }
        }
        incoming={
          distractions.length === 0
            ? null
            : {
                text: t("laptop.thesisDesk.writing.incoming", { items: distractions.map((item) => `${item.label} (${item.count})`).join(" · ") }),
                appLabel: distractions[0].label,
                onOpen: () => {
                  writing.setActive(false);
                  nav?.openApp(distractions[0].appId);
                },
              }
        }
      />
    ) : null;
  const review: ReviewProps | null =
    activeTask === null
      ? null
      : {
          task: activeTask,
          index: activeIndex,
          t: text,
          duration,
          onChoose: choose,
          investigation,
          onInvestigationChange,
          ...(draftDeadlineMinutesLeft === undefined ? {} : { deadlineMinutesLeft: draftDeadlineMinutesLeft }),
        };
  const renderReview = () => {
    if (review === null) return <p className="text-sm text-[#6b7280]">{t("planner.thesis.noTasks")}</p>;
    if (activeTask?.id === "draft.findings") return <DataForensics {...review} />;
    if (activeTask?.id === "draft.final") return <DraftAssembly {...review} />;
    if (activeTask?.id === "draft.intro-review") return <CitationDetective {...review} />;
    return <GenericReview {...review} />;
  };

  return (
    <div
      className="h-full overflow-y-auto overscroll-contain bg-[#e9edf3] p-2 sm:p-4"
      data-testid="thesis-window"
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-[#c3cde0] bg-white shadow-[0_1px_3px_rgba(31,41,55,0.18),0_12px_24px_-14px_rgba(31,41,55,0.28)]">
        <header className="border-b border-[#c9d3e6] bg-[#fbfcff] px-4 py-3 sm:px-6">
          {distractions.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-[#e7d8a6] bg-[#fff7df] px-3 py-2 text-xs text-[#6b4c13]" data-testid="thesis-distraction-chip" role="status">
              <BellRing className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{distractions.map((item) => `${item.label} (${item.count})`).join(" · ")}</span>
              {distractions.map((item) => (
                <button key={item.key} type="button" className="rounded border border-[#d8bb72] bg-white px-2 py-1 font-semibold text-[#6b4c13] hover:bg-[#fffaf0]" onClick={() => nav?.openApp(item.appId)}>
                  {t("laptop.thesisDesk.openDistraction", { app: item.label })}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <h3 className="min-w-0 text-lg font-semibold tracking-[-0.02em] text-[#1f2937]">{t("laptop.thesisDesk.heading")}</h3>
            <button type="button" className={QUIET} onClick={() => setVersionSaved(true)}>
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {versionSaved ? t("laptop.thesisDesk.versionSaved") : t("laptop.thesisDesk.saveVersion")}
            </button>
          </div>

          <div className="mt-3 grid items-center gap-x-6 gap-y-2 text-xs text-[#4b5563] sm:grid-cols-[minmax(0,1.4fr)_auto_auto]">
            <div>
              <div className="flex items-center justify-between gap-2 font-medium">
                <span>{t("laptop.thesisDesk.progressLabel")}</span>
                <strong className="tabular-nums text-[#3a63c2]" data-testid="thesis-progress">
                  {progress}%
                </strong>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#dfe6f2]" aria-hidden="true">
                <div className="h-full bg-[#3a63c2] transition-[width]" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
              </div>
            </div>
            <div>
              <p className="font-medium">{t("laptop.thesisDesk.timeLabel")}</p>
              <p className="text-base font-semibold tabular-nums text-[#1f2937]">{formatDuration(duration, timeLeftMinutes)}</p>
              {draftDeadlineMinutesLeft !== undefined && (
                <p className={`text-[11px] ${draftDeadlineMinutesLeft <= 0 ? "text-[#b42318]" : "text-[#a16207]"}`} data-testid="thesis-draft-deadline">
                  {draftDeadlineMinutesLeft <= 0 ? t("laptop.thesisDesk.deadlineMissed") : t("laptop.thesisDesk.deadlineAfter", { time: formatDuration(duration, draftDeadlineMinutesLeft) })}
                </p>
              )}
            </div>
            <div>
              <p className="font-medium">{t("laptop.thesisDesk.qualityLabel")}</p>
              <p className="text-base font-semibold text-[#1f2937]" data-testid="thesis-quality">
                {t(`laptop.thesisDesk.quality.${quality}`)}
              </p>
            </div>
          </div>
          {/* Focus only matters when it is lowered; at 100% it is noise. */}
          {tired ? (
            <p className="mt-2 text-[11px] leading-relaxed text-[#a16207]">
              {t("laptop.thesisDesk.interactive.focusLabel")}{" "}
              <strong className="tabular-nums" data-testid="thesis-focus">
                {focus}%
              </strong>
              {" · "}
              {t(`planner.thesis.fatigueNote.${tired.level}`, { percent: tired.slowdownPercent })}
            </p>
          ) : (
            <span className="sr-only" data-testid="thesis-focus">
              {focus}%
            </span>
          )}
        </header>

        <div className="grid gap-0 lg:grid-cols-[11rem_minmax(0,1fr)]">
          <aside className="border-b border-[#c9d3e6] bg-[#f8faff] p-3 lg:border-b-0 lg:border-r lg:p-4">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">{t("laptop.thesisDesk.thesisMap")}</p>
            </div>
            <nav className="mt-3 space-y-1" aria-label={t("laptop.thesisDesk.thesisMap")}>
              {tasks.map((task) => {
                const selected = task.id === activeTaskId;
                return (
                  <button
                    key={task.id}
                    type="button"
                    data-testid={`thesis-task-${task.id}`}
                    className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${FOCUS_RING} ${
                      selected ? "bg-[#e4edfd] text-[#1f2937]" : "text-[#4b5563] hover:bg-white"
                    }`}
                    aria-current={selected ? "page" : undefined}
                    onClick={() => {
                      setActiveTaskId(task.id);
                      setRejected(false);
                      headingRef.current?.focus();
                    }}
                  >
                    <span className={`mt-0.5 shrink-0 ${task.done ? "text-[#17624a]" : selected ? "text-[#3a63c2]" : "text-[#6b7280]"}`}>
                      {task.done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : iconForTask(task.id)}
                    </span>
                    <span className="min-w-0 leading-snug">{task.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
              <span>{activeTask ? t("laptop.thesisDesk.sectionLabel", { number: taskNumber(activeTask.id, activeIndex) }) : t("laptop.thesisDesk.eyebrow")}</span>
              {activeTask?.done && (
                <span className="inline-flex items-center gap-1 text-[#17624a]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("laptop.thesisDesk.completed")}
                </span>
              )}
            </div>
            <h4 ref={headingRef} tabIndex={-1} className="mt-2 text-lg font-semibold text-[#1f2937] outline-none sm:text-xl">
              {activeTask?.id === "draft.findings"
                ? t("laptop.thesisDesk.findingsReview.title")
                : activeTask?.id === "draft.final"
                  ? t("laptop.thesisDesk.finalReview.title")
                  : activeTask?.id === "draft.intro-review"
                    ? t("laptop.thesisDesk.introReview.title")
                    : (activeTask?.label ?? t("laptop.thesisDesk.heading"))}
            </h4>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4b5563]">
              {activeTask?.id === "draft.findings"
                ? t("laptop.thesisDesk.findingsReview.summary")
                : activeTask?.id === "draft.final"
                  ? t("laptop.thesisDesk.finalReview.summary")
                  : activeTask?.id === "draft.intro-review"
                    ? t("laptop.thesisDesk.introReview.summary")
                    : (activeTask?.description ?? t("laptop.thesisDesk.intro"))}
            </p>

            <div className="mt-5">{renderReview()}</div>

            {draftDiff && (
              <section className="mt-4 rounded-lg border border-[#b9dec9] bg-[#e8f5ef] p-3" data-testid="thesis-draft-diff" aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#17624a]">{t("laptop.thesisDesk.draftDiffLabel")}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#17624a]">
                  {tasks.find((candidate) => candidate.id === draftDiff.taskId)?.label ?? draftDiff.taskId}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#17624a]">
                  {t(`laptop.thesisDesk.draftDiff.${draftDiffKey(draftDiff.approachId)}`)}
                </p>
              </section>
            )}

            {rejected && (
              <p className="mt-3 rounded-lg border border-[#e7d8a6] bg-[#fff7df] p-3 text-sm text-[#6b4c13]" role="alert">
                {t("laptop.thesisDesk.reviewRejected")}
              </p>
            )}


            <section className="mt-6 border-t border-[#e4e9f2] pt-4" aria-label={t("planner.thesis.heading")}>
              <p className="text-sm text-[#4b5563]" data-testid="thesis-limit">
                {t("planner.thesis.limit", { percent: props.freeWorkMaxPercent })}
              </p>
              {writing && (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#e3dccd] bg-[#fbf8f1] p-3" data-testid="thesis-writing">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md bg-[#3a63c2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3155a8] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={workBlocked}
                    data-testid="thesis-writing-start"
                    onClick={() => writing.setActive(true)}
                  >
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    {t("laptop.thesisDesk.writing.start")}
                  </button>
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-[#5c5547]">
                    {workBlocked ? t("laptop.thesisDesk.writing.blocked") : t("laptop.thesisDesk.writing.startHint", { percent: props.sessionPercent, time: formatDuration(duration, sessionMinutes) })}
                  </p>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={QUIET_BORDERED}
                  disabled={workBlocked}
                  data-testid="thesis-work"
                  onClick={() => onWork(sessionMinutes)}
                >
                  {t("planner.thesis.work", { time: formatDuration(duration, sessionMinutes) })}
                </button>
                {rest !== undefined && (
                  <span className="flex flex-wrap gap-2" data-testid="rest-panel">
                    <button type="button" className={QUIET_BORDERED} disabled={timeUp} data-testid="rest-nap" onClick={() => rest.onRest("nap")}>
                      {t("planner.thesis.nap", { time: formatDuration(duration, rest.napMinutes) })}
                    </button>
                    <button type="button" className={QUIET_BORDERED} disabled={timeUp} data-testid="rest-sleep" onClick={() => rest.onRest("sleep")}>
                      {t("planner.thesis.sleep", { time: formatDuration(duration, rest.sleepMinutes) })}
                    </button>
                  </span>
                )}
              </div>
              {progress >= 100 && <p className="mt-2 text-xs text-[#17624a]">{t("planner.thesis.complete")}</p>}
              {progress < 100 && timeUp && <p className="mt-2 text-xs text-[#6b7280]">{t("planner.thesis.timeUp")}</p>}
            </section>
          </main>

        </div>
      </div>
      {writingView}
    </div>
  );
};

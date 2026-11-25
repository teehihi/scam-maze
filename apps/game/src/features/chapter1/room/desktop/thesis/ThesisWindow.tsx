// The laptop's Thesis desk. One slim status strip (progress, time, draft state) above, then the draft
// task: Alex types two sentences of the thesis in Writing Mode, and the second sentence completes the
// draft through the core (`COMPLETE_THESIS_TASK`). Progress, time, fatigue and quality stay in the
// deterministic core. Free writing (one sentence per work session) stays underneath.
import React, { useEffect, useState } from "react";
import { BellRing, CheckCircle2, PenLine, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ThesisQuality } from "../../../../../game/narrative/world";
import type { ThesisPanelProps } from "../../../world/ThesisPanel";
import { formatDuration, type DurationText } from "../../../world/formatDuration";
import { useDesktopNav } from "../desktopNav";
import { WritingMode, type ThesisWritingHost } from "./writing/WritingMode";
import { DRAFT_SPRINT_IDS, SPRINT_IDS, SPRINT_SECTION, sprintFor } from "./writing/writingSprints";
import { QUIET, QUIET_BORDERED } from "./thesisDeskChrome";

/** The thesis task the two typed sentences complete (`MISSION_01_THESIS_TASKS`). */
export const DRAFT_TASK_ID = "draft.final";

export interface ThesisWindowProps extends Omit<ThesisPanelProps, "tone" | "onTask" | "onWork"> {
  /** One free work session; returns whether the core accepted it (the Writing Mode commits through it). */
  onWork: (minutes: number) => boolean | void;
  /** The Writing Mode host (room story layer). Without it the desk offers only the work button. */
  writing?: ThesisWritingHost;
  /** The deterministic draft state from `selectThesisView`; never computed here. */
  quality: ThesisQuality;
  /** Returns whether the core accepted the task, so the desk never confirms a rejected draft. */
  onTask: (taskId: string, approachId?: string) => boolean | void;
  /** Simulated minutes left until the draft deadline, or absent when the scenario has none. */
  draftDeadlineMinutesLeft?: number;
  /** Work that arrived while the desk is open: a non-modal chip, never a window that takes over. */
  distractions?: readonly { key: string; appId: string; label: string; count: number }[];
}

/** The draft sentence a kept Writing Mode draft belongs to (0 or 1), so a reopened desk resumes it. */
function draftSentenceOf(key: string | undefined): number {
  return key !== undefined && key.startsWith("draft:1:") ? 1 : 0;
}

export const ThesisWindow: React.FC<ThesisWindowProps> = (props) => {
  const { t } = useTranslation("chapter1");
  const nav = useDesktopNav();
  const duration = t as unknown as DurationText;
  const { tasks, progress, timeLeftMinutes, fatigue, rest, sessionMinutes, onTask, onWork, quality, draftDeadlineMinutesLeft, distractions = [] } = props;
  const writing = props.writing;
  const [versionSaved, setVersionSaved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [draftSentence, setDraftSentence] = useState(() => draftSentenceOf(writing?.draft?.key));

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

  const draftTask = tasks.find((task) => task.id === DRAFT_TASK_ID) ?? null;
  const draftOpen = draftTask !== null && !draftTask.done && draftTask.blocked === null;
  const timeUp = timeLeftMinutes <= 0;
  const atLimit = progress >= props.freeWorkMaxPercent;
  const tired = fatigue !== undefined && fatigue.level !== "rested" ? fatigue : null;
  // A tired Alex sees a lower focus, which is the same rule that makes work minutes cost more.
  const focus = tired ? Math.max(35, 100 - tired.slowdownPercent) : 100;
  const workBlocked = timeUp || atLimit || progress >= 100 || props.sessionPercent < 1;

  // Writing Mode runs the two draft sentences while the draft is open, then free sprints.
  const freeSprint = sprintFor(writing?.completedSessions ?? 0);
  const sprintId = draftOpen ? DRAFT_SPRINT_IDS[draftSentence] : freeSprint.id;
  const sprintText = t(`laptop.thesisDesk.writing.sprints.${sprintId}`);
  const commitDraft = (): boolean | "continue" => {
    if (draftSentence < DRAFT_SPRINT_IDS.length - 1) {
      setDraftSentence(draftSentence + 1);
      return "continue";
    }
    const accepted = onTask(DRAFT_TASK_ID) !== false;
    setRejected(!accepted);
    if (accepted) setDraftSentence(0);
    return accepted;
  };
  const writingView =
    writing?.active === true ? (
      <WritingMode
        sprintKey={draftOpen ? `draft:${draftSentence}:${sprintText}` : `${freeSprint.id}:${sprintText}`}
        sprintText={sprintText}
        sprintNumber={draftOpen ? draftSentence + 1 : freeSprint.index + 1}
        sprintTotal={draftOpen ? DRAFT_SPRINT_IDS.length : SPRINT_IDS.length}
        sectionLabel={draftOpen ? t("laptop.thesisDesk.draft.section") : t(`laptop.thesisDesk.writing.sections.${SPRINT_SECTION[freeSprint.id]}`)}
        draft={writing.draft}
        onDraft={writing.onDraft}
        relaxed={writing.relaxed}
        onRelaxed={writing.onRelaxed}
        commitTime={
          draftOpen && draftSentence < DRAFT_SPRINT_IDS.length - 1
            ? t("laptop.thesisDesk.draft.nextSentence")
            : formatDuration(duration, draftOpen ? (draftTask?.timeCostMinutes ?? 0) : sessionMinutes)
        }
        {...(draftOpen && draftSentence < DRAFT_SPRINT_IDS.length - 1 ? {} : { gainPercent: draftOpen ? draftTask?.progressGain : props.sessionPercent })}
        progress={progress}
        timeLeftMinutes={timeLeftMinutes}
        formatTime={(minutes) => formatDuration(duration, minutes)}
        onCommit={draftOpen ? commitDraft : () => !workBlocked && onWork(sessionMinutes) === true}
        onKey={writing.onKey}
        onExit={() => writing.setActive(false)}
        issue={null}
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

  return (
    <div
      className="h-full overflow-y-auto overscroll-contain bg-[#e9edf3] p-2 sm:p-4"
      data-testid="thesis-window"
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-[#c3cde0] bg-white shadow-[0_1px_3px_rgba(31,41,55,0.18),0_12px_24px_-14px_rgba(31,41,55,0.28)]">
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
              {t("laptop.thesisDesk.focusLabel")}{" "}
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

        <main className="min-w-0 p-4 sm:p-6">
          {draftTask === null ? (
            <p className="text-sm text-[#6b7280]">{t("planner.thesis.noTasks")}</p>
          ) : (
            <section className="rounded-lg border border-[#c9d3e6] bg-[#fbfcff] p-4" data-testid="thesis-draft" aria-labelledby="thesis-draft-title">
              <h4 id="thesis-draft-title" className="text-lg font-semibold text-[#1f2937] sm:text-xl">
                {draftTask.label}
              </h4>
              {draftTask.done ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#17624a]" data-testid="thesis-draft-done">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {t("laptop.thesisDesk.draft.done")}
                </p>
              ) : (
                <>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4b5563]">{t("laptop.thesisDesk.draft.summary")}</p>
                  <p className="mt-2 text-xs text-[#6b7280]" data-testid="thesis-draft-progress">
                    {t("laptop.thesisDesk.draft.progress", { done: draftSentence, total: DRAFT_SPRINT_IDS.length })}
                    {" · "}
                    {t("laptop.thesisDesk.writing.reward", { percent: draftTask.progressGain, time: formatDuration(duration, draftTask.timeCostMinutes) })}
                  </p>
                  {writing ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#3a63c2] px-3 py-2 text-sm font-semibold text-white hover:bg-[#3155a8] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!draftOpen}
                      data-testid="thesis-draft-start"
                      onClick={() => {
                        setRejected(false);
                        writing.setActive(true);
                      }}
                    >
                      <PenLine className="h-4 w-4" aria-hidden="true" />
                      {t("laptop.thesisDesk.draft.start")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`mt-3 ${QUIET_BORDERED}`}
                      disabled={!draftOpen}
                      data-testid="thesis-draft-complete"
                      onClick={() => setRejected(onTask(DRAFT_TASK_ID) === false)}
                    >
                      {draftTask.label}
                    </button>
                  )}
                  {draftTask.blocked !== null && (
                    <p className="mt-2 text-xs text-[#6b7280]" data-testid="thesis-draft-blocked">
                      {t(`planner.thesis.blocked.${draftTask.blocked}`)}
                    </p>
                  )}
                </>
              )}
              {rejected && (
                <p className="mt-3 rounded-lg border border-[#e7d8a6] bg-[#fff7df] p-3 text-sm text-[#6b4c13]" role="alert">
                  {t("laptop.thesisDesk.reviewRejected")}
                </p>
              )}
            </section>
          )}

          <section className="mt-6 border-t border-[#e4e9f2] pt-4" aria-label={t("planner.thesis.heading")}>
            <p className="text-sm text-[#4b5563]" data-testid="thesis-limit">
              {t("planner.thesis.limit", { percent: props.freeWorkMaxPercent })}
            </p>
            {writing && !draftOpen && (
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
              <button type="button" className={QUIET_BORDERED} disabled={workBlocked} data-testid="thesis-work" onClick={() => onWork(sessionMinutes)}>
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
      {writingView}
    </div>
  );
};

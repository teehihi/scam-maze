// Writing Mode of the thesis desk: Alex types one short sentence of the draft. A small panel sits over
// the laptop screen at the top of the view while the 3D camera shows the keyboard and Alex's hands
// under it (the host moves the camera; this component never touches three or the game core).
//
// The typing engine (`typingEngine.ts`) is the only source of truth for what was typed. A completed
// sprint is committed once through the host's `onCommit`, which dispatches the existing thesis work
// action; accuracy is shown, never scored.
//
// Text rendering: the sentence is drawn in the bundled Inter font (it carries the Vietnamese subset,
// unlike the system serif fonts that split stacked diacritics), and in runs of characters that share
// a state, so the browser shapes whole words. The caret is a zero-width inline mark: it adds no space
// and no line-break opportunity inside a word.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BellRing, CheckCircle2, Pause, PenLine, Play, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePrefersReducedMotion } from "../../../../../../components/ui/usePrefersReducedMotion";
import { useComfort } from "../../../../comfort/ComfortProvider";
import { useDesktopEscape } from "../../desktopNav";
import { backspace, resumeTyping, typeText, typingStats, type TypedChar } from "./typingEngine";
import { draftFor, type WritingDraft } from "./writingSprints";

export type KeyKind = "key" | "space" | "enter" | "backspace";

/** What the room host gives the thesis desk for the Writing Mode. Presentation state only. */
export interface ThesisWritingHost {
  active: boolean;
  setActive: (on: boolean) => void;
  /** Accepted thesis work sessions in the event log; picks the sprint (see `sprintFor`). */
  completedSessions: number;
  /** The typed draft of the open sprint, kept by the host for the page session. */
  draft: WritingDraft | null;
  onDraft: (draft: WritingDraft) => void;
  relaxed: boolean;
  onRelaxed: (on: boolean) => void;
  /** A keystroke for the 3D hands and the keyboard sound. Never a game action. */
  onKey: (kind: KeyKind) => void;
}

export interface WritingModeProps {
  sprintKey: string;
  sprintText: string;
  sprintNumber: number;
  sprintTotal: number;
  sectionLabel: string;
  draft: WritingDraft | null;
  onDraft: (draft: WritingDraft) => void;
  relaxed: boolean;
  onRelaxed: (on: boolean) => void;
  /** Formatted simulated time one committed sprint costs at the current fatigue. */
  commitTime: string;
  /** Thesis percent one committed sprint adds (the work session's gain). */
  gainPercent?: number;
  /** Thesis progress and time left now, to show what the commit actually changed. */
  progress?: number;
  timeLeftMinutes?: number;
  formatTime?: (minutes: number) => string;
  /**
   * Commits a complete sprint; returns whether the core accepted it. `"continue"` means the sentence
   * is one of several in the same commit: the host moves on to the next sentence (new `sprintKey`)
   * and the panel shows no result yet.
   */
  onCommit: () => boolean | "continue";
  onKey: (kind: KeyKind) => void;
  onExit: () => void;
  /** An open research review the player can go to after a sprint, or null. */
  issue: { label: string; onOpen: () => void } | null;
  /** New mail or messages on the laptop (a quiet chip, never a window that takes over). */
  incoming: { text: string; appLabel: string; onOpen: () => void } | null;
}

const ICON_BUTTON =
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#5c5547] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a63c2] disabled:opacity-50";
const ACTION_BUTTON =
  "inline-flex items-center gap-1.5 rounded-md border border-[#d9d2c3] bg-white/80 px-2.5 py-1 text-xs font-medium text-[#3d372d] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a63c2]";

type RunState = "ok" | "todo";

/** The sentence as styled runs: matching text, still-to-type text, one span per wrong character, and the caret. */
function renderSentence(target: readonly string[], typed: readonly TypedChar[], caret: number | null, reducedMotion: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let run = "";
  let runState: RunState | null = null;
  let runStart = 0;
  const flush = () => {
    if (run.length > 0 && runState !== null) {
      nodes.push(
        <span key={`r${runStart}`} className={runState === "ok" ? "text-[#2b2620]" : "text-[#a39b8c]"}>
          {run}
        </span>,
      );
    }
    run = "";
    runState = null;
  };
  target.forEach((char, i) => {
    if (caret === i) {
      flush();
      nodes.push(
        <span key="caret" className="relative" aria-hidden="true" data-testid="writing-caret">
          <span className={`absolute -left-px top-[0.12em] h-[1.05em] w-[2px] rounded-full bg-[#3a63c2] ${reducedMotion ? "" : "animate-pulse"}`} />
        </span>,
      );
    }
    const entry = i < typed.length ? typed[i] : null;
    if (entry !== null && !entry.correct) {
      flush();
      nodes.push(
        <span key={`e${i}`} data-testid="writing-error" className="rounded-[3px] bg-[#fde3e1] text-[#b42318] underline decoration-wavy decoration-1 underline-offset-[3px]">
          {entry.char === " " ? "\u00b7" : entry.char}
        </span>,
      );
      return;
    }
    const state: RunState = entry === null ? "todo" : "ok";
    if (state !== runState) {
      flush();
      runState = state;
      runStart = i;
    }
    run += char;
  });
  flush();
  return nodes;
}

export const WritingMode: React.FC<WritingModeProps> = (props) => {
  const { sprintKey, sprintText, relaxed, onDraft, onKey, onCommit, onExit } = props;
  const { t } = useTranslation("chapter1");
  const comfort = useComfort();
  const osReduced = usePrefersReducedMotion();
  const reducedMotion = comfort?.reducedMotion ?? osReduced;
  const [draft, setDraftState] = useState<WritingDraft>(() => draftFor(props.draft, sprintKey, sprintText, relaxed));
  const draftRef = useRef(draft);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<"paste" | "rejected" | null>(null);
  /** The sprint just committed (with the progress and time before it), shown until the player moves on. */
  const [done, setDone] = useState<{
    chars: readonly TypedChar[];
    target: readonly string[];
    heading: string;
    stats: ReturnType<typeof typingStats>;
    before: { progress: number; timeLeft: number } | null;
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const composing = useRef(false);
  const committing = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const update = (next: WritingDraft) => {
    draftRef.current = next;
    setDraftState(next);
    onDraft(next);
  };

  // A new sprint (after a commit) or a language change starts a fresh session; relaxed typing follows the toggle.
  useEffect(() => {
    const next = draftFor(draftRef.current, sprintKey, sprintText, relaxed);
    if (next !== draftRef.current) update(next);
    // `update` only writes state and calls the host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintKey, sprintText, relaxed]);

  // The result of a commit slides in on the next frame (at once with reduced motion).
  useEffect(() => {
    if (done === null) {
      setRevealed(false);
      return;
    }
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [done, reducedMotion]);

  useDesktopEscape(() => {
    onExit();
    return true;
  });

  const focusInput = () => inputRef.current?.focus({ preventScroll: true });
  useEffect(() => {
    focusInput();
  }, []);

  const session = draft.session;
  const heading = `${props.sectionLabel} · ${t("laptop.thesisDesk.writing.sprint", { number: props.sprintNumber, total: props.sprintTotal })}`;
  // After a commit the panel keeps showing the committed sprint (its heading and numbers) until "Next".
  const stats = done?.stats ?? typingStats(session);
  const typingOff = paused || done !== null;

  const feed = (text: string) => {
    if (typingOff || text.length === 0) return;
    const next = typeText(draftRef.current.session, text, performance.now());
    if (next === draftRef.current.session) {
      if (Array.from(text).length > 1) setNotice("paste");
      return;
    }
    setNotice(null);
    update({ ...draftRef.current, session: next });
  };

  const commit = () => {
    if (committing.current || done !== null || !typingStats(draftRef.current.session).complete) return;
    committing.current = true;
    const finished = draftRef.current.session;
    const before = props.progress !== undefined && props.timeLeftMinutes !== undefined ? { progress: props.progress, timeLeft: props.timeLeftMinutes } : null;
    const accepted = onCommit();
    committing.current = false;
    if (accepted === "continue") {
      setNotice(null);
      return;
    }
    if (!accepted) {
      setNotice("rejected");
      return;
    }
    setNotice(null);
    setDone({ chars: finished.typed, target: finished.target, heading, stats: typingStats(finished), before });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escape and Tab are handled by the desktop; the shortcuts with Ctrl or Cmd stay with the browser.
    if (event.key === "Escape" || event.key === "Tab") return;
    if (typingOff) {
      // After a commit, Enter does nothing: a double press must not skip the result.
      if (event.key === "Enter" && done !== null) {
        event.preventDefault();
        return;
      }
      if (!event.ctrlKey && !event.metaKey) event.preventDefault();
      return;
    }
    if (event.nativeEvent.isComposing || event.key === "Process") {
      if (!event.repeat) onKey("key");
      return;
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      const after = backspace(draftRef.current.session, performance.now());
      if (after !== draftRef.current.session) update({ ...draftRef.current, session: after });
      if (!event.repeat) onKey("backspace");
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.repeat) return;
      onKey("enter");
      commit();
      return;
    }
    // A held key types once: repeats add nothing and make no sound.
    if (event.repeat && event.key.length === 1) event.preventDefault();
  };

  const onInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    if (composing.current) return;
    const inputType = (event.nativeEvent as InputEvent).inputType ?? "";
    const value = target.value;
    target.value = "";
    if (inputType.startsWith("insertFromPaste") || inputType === "insertFromDrop") {
      setNotice("paste");
      return;
    }
    if (value.length === 0 || typingOff) return;
    onKey(value === " " ? "space" : "key");
    feed(value);
  };

  const togglePause = () => {
    setPaused((was) => {
      if (was) update({ ...draftRef.current, session: resumeTyping(draftRef.current.session) });
      return !was;
    });
    focusInput();
  };

  const next = () => {
    setDone(null);
    focusInput();
  };

  const format = props.formatTime;
  const gain = props.gainPercent;
  const reward =
    gain !== undefined && gain > 0 ? t("laptop.thesisDesk.writing.reward", { percent: gain, time: props.commitTime }) : props.commitTime;
  // What the commit changed, read back from the core's resources (never computed here).
  const result =
    done?.before && props.progress !== undefined && props.timeLeftMinutes !== undefined
      ? { gained: Math.max(0, props.progress - done.before.progress), spent: Math.max(0, done.before.timeLeft - props.timeLeftMinutes), from: done.before.progress, to: props.progress }
      : null;
  const motion = reducedMotion ? "" : "transition-all duration-500 ease-out";

  const content = (
    <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-[46] flex justify-center px-3" data-testid="writing-mode">
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="writing-mode-heading"
        className="pointer-events-auto w-full max-w-[40rem] overflow-hidden rounded-xl border border-[#e3dccd] bg-[#fbf8f1]/95 font-sans text-[#2b2620] shadow-[0_14px_40px_-16px_rgba(20,16,8,0.6)] backdrop-blur-sm"
        // The panel's keys must not reach the laptop window behind it (its Tab trap and shortcuts).
        onKeyDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-2 px-3.5 pt-2.5">
          <PenLine className="h-3.5 w-3.5 shrink-0 text-[#3a63c2]" aria-hidden="true" />
          <h3 id="writing-mode-heading" className="min-w-0 flex-1 truncate text-xs font-semibold text-[#3d372d]">
            <span className="sr-only">{t("laptop.thesisDesk.writing.eyebrow")}: </span>
            {done?.heading ?? heading}
          </h3>
          {props.incoming && (
            <button type="button" className="inline-flex max-w-[11rem] items-center gap-1 truncate rounded-full bg-[#fff1c9] px-2 py-0.5 text-[11px] text-[#6b4c13] hover:bg-[#ffe9a8]" onClick={props.incoming.onOpen} title={props.incoming.text} data-testid="writing-incoming">
              <BellRing className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{t("laptop.thesisDesk.openDistraction", { app: props.incoming.appLabel })}</span>
            </button>
          )}
          <button
            type="button"
            className={ICON_BUTTON}
            aria-pressed={relaxed}
            title={t("laptop.thesisDesk.writing.relaxedHint")}
            data-testid="writing-relaxed"
            onClick={() => {
              props.onRelaxed(!relaxed);
              focusInput();
            }}
          >
            <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-sm border ${relaxed ? "border-[#3a63c2] bg-[#3a63c2]" : "border-[#a9a294]"}`} />
            {t("laptop.thesisDesk.writing.relaxed")}
          </button>
          <button type="button" className={ICON_BUTTON} onClick={togglePause} disabled={done !== null} data-testid="writing-pause" aria-label={paused ? t("laptop.thesisDesk.writing.resume") : t("laptop.thesisDesk.writing.pause")} title={paused ? t("laptop.thesisDesk.writing.resume") : t("laptop.thesisDesk.writing.pause")}>
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <button type="button" className={ICON_BUTTON} onClick={onExit} data-testid="writing-exit" aria-label={t("laptop.thesisDesk.writing.exit")} title={t("laptop.thesisDesk.writing.exit")}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>

        <div className="relative px-4 pb-2 pt-1.5" onClick={focusInput}>
          <textarea
            ref={inputRef}
            aria-label={t("laptop.thesisDesk.writing.editorLabel")}
            aria-describedby="writing-target"
            data-testid="writing-input"
            className="absolute left-4 top-2 h-5 w-5 resize-none opacity-0"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly={typingOff}
            onKeyDown={onKeyDown}
            onInput={onInput}
            onPaste={(event) => {
              event.preventDefault();
              setNotice("paste");
            }}
            onDrop={(event) => event.preventDefault()}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              event.currentTarget.value = "";
              feed(event.data);
            }}
          />
          <p
            id="writing-target"
            className={`text-[1.05rem] leading-[1.65] tracking-[0.005em] sm:text-[1.15rem] ${paused ? "opacity-50" : ""} ${done ? "text-[#17624a]" : ""} ${motion}`}
            data-testid="writing-text"
          >
            {done === null ? renderSentence(session.target, session.typed, stats.complete ? null : stats.caret, reducedMotion) : renderSentence(done.target, done.chars, null, true)}
          </p>
          {paused && <p className="mt-1 text-[11px] text-[#7a7264]">{t("laptop.thesisDesk.writing.paused")}</p>}
          {notice && (
            <p className="mt-1.5 rounded-md bg-[#fff1c9] px-2 py-1 text-[11px] text-[#6b4c13]" role="alert" data-testid="writing-notice">
              {notice === "paste" ? t("laptop.thesisDesk.writing.noPaste") : t("laptop.thesisDesk.writing.rejected")}
            </p>
          )}
        </div>

        <footer className="border-t border-[#ebe4d6] px-3.5 py-2">
          {done === null ? (
            <div className="flex items-center gap-3 text-[11px] text-[#5c5547]">
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-[#ebe4d6]" aria-hidden="true">
                <div className={`h-full rounded-full bg-[#3a63c2] ${reducedMotion ? "" : "transition-[width] duration-150"}`} style={{ width: `${stats.progress}%` }} />
              </div>
              <span className="tabular-nums" aria-label={t("laptop.thesisDesk.writing.written")}>
                <strong className="text-[#2b2620]" data-testid="writing-progress">{stats.progress}%</strong>
              </span>
              <span className="tabular-nums">
                {t("laptop.thesisDesk.writing.accuracy")} <strong className="text-[#2b2620]" data-testid="writing-accuracy">{stats.accuracy}%</strong>
              </span>
              {stats.complete ? (
                <>
                  <span data-testid="writing-complete" className="sr-only" role="status">
                    {t("laptop.thesisDesk.writing.complete")}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#17624a] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#12523d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a63c2]"
                    data-testid="writing-commit"
                    onClick={commit}
                  >
                    {t("laptop.thesisDesk.writing.commit", { reward })}
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-[#e9eefb] px-2 py-0.5 font-medium text-[#2c4f9e]" data-testid="writing-reward">
                  {reward}
                </span>
              )}
            </div>
          ) : (
            <div data-testid="writing-done" className={`flex flex-wrap items-center gap-2 text-xs ${motion} ${revealed ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#17624a]" aria-hidden="true" />
              <span className="font-semibold text-[#17624a]" role="status" data-testid="writing-result">
                {result && format
                  ? t("laptop.thesisDesk.writing.result", { percent: result.gained, time: format(result.spent), progress: result.to })
                  : t("laptop.thesisDesk.writing.committed")}
              </span>
              {result && (
                <div className="h-1 w-20 overflow-hidden rounded-full bg-[#dcefe5]" aria-hidden="true">
                  <div className={`h-full rounded-full bg-[#17624a] ${reducedMotion ? "" : "transition-[width] duration-700 ease-out"}`} style={{ width: `${revealed ? result.to : result.from}%` }} />
                </div>
              )}
              <span className="flex-1" />
              {props.issue && (
                <button type="button" className={ACTION_BUTTON} onClick={props.issue.onOpen} data-testid="writing-issue" title={t("laptop.thesisDesk.writing.issue", { task: props.issue.label })}>
                  <BellRing className="h-3.5 w-3.5 text-[#a16207]" aria-hidden="true" />
                  <span className="max-w-[12rem] truncate">{t("laptop.thesisDesk.writing.issue", { task: props.issue.label })}</span>
                </button>
              )}
              <button type="button" className={ACTION_BUTTON} onClick={next} data-testid="writing-next">
                {t("laptop.thesisDesk.writing.next")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  );
  return typeof document === "undefined" ? content : createPortal(content, document.body);
};

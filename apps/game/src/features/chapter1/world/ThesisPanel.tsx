// Playable Mission 1 Thesis Desk ("Draft · Stamp · Proofread"):
// Replaces passive idle progress-bar clicking with a hands-on 2-column tactile workbench combining:
// 1. Monkeytype-style accent-tolerant live keyboard drafting directly on the Word manuscript,
// 2. Papers-Please drag-and-drop (or click-snap) verified evidence citation stamping vs fake rumor traps,
// 3. Red-Pen proofreading (spot & slash factual/security errors right on the page),
// 4. Live Saigon sky time-lapse per completed block & non-blocking desk-buzzing phone notifications.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  Flame,
  GraduationCap,
  GripVertical,
  Keyboard,
  Landmark,
  Mail,
  MessageSquare,
  Moon,
  PenTool,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Stamp,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FatigueConfig, FatigueLevel, RestMode } from "../../../game/narrative/fatigue";
import {
  DESK_EVIDENCE_CARDS,
  getDisplayTargetPhrase,
  matchDeskKey,
  THESIS_DESK_STEPS,
  type DeskEvidenceCard,
  type ThesisDeskStep,
} from "../../../game/narrative/thesisDeskGame";
import {
  findSessionInterruptions,
  simulateThesisSession,
  storyClockHourAt,
  THESIS_TOTAL_WORDS,
  type SessionInterruption,
  type ThesisFocusMode,
} from "../../../game/narrative/thesisSession";
import type { ChapterState, ScenarioDefinition } from "../../../game/narrative/types";
import { elapsedMinutes, type ThesisTaskView } from "../../../game/narrative/world";
import { useGameLocale } from "../../../i18n";
import { useDesktopNav } from "../room/desktop/desktopNav";
import { UI } from "../theme";
import { formatDuration, type DurationText } from "./formatDuration";

/** `dark`: the schedule overlay. `paper`: the laptop's Thesis window, a white desk canvas. */
export type ThesisTone = "dark" | "paper";

const FOCUS_PAPER =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3a63c2]";

const TONES = {
  dark: {
    card: UI.card,
    label: UI.label,
    body: UI.body,
    text: "text-[#f7f5ff]",
    muted: "text-[#a9a4c4]",
    surface: "rounded-xl border border-white/10 bg-[#141224]/85 p-3",
    paper: "rounded-xl border border-white/15 bg-[#1b1830] p-4 text-slate-100",
    chipIdle: "border-white/15 bg-white/5 text-[#d4cff0] hover:bg-white/10",
    chipActive: "border-indigo-400/70 bg-indigo-500/25 text-white",
    primary: UI.buttonPrimary,
    secondary: UI.buttonSecondary,
  },
  paper: {
    card: "",
    label: "text-xs font-semibold uppercase tracking-wider text-[#3a63c2]",
    body: "text-xs leading-relaxed text-[#4b5563]",
    text: "text-[#1f2937]",
    muted: "text-[#64748b]",
    surface: "rounded-xl border border-[#d6deeb] bg-[#f8fafd] p-3",
    paper: "rounded-xl border border-[#cfd8e8] bg-white p-4 text-[#1e293b] shadow-sm",
    chipIdle: "border-[#cfd8e8] bg-white text-[#334155] hover:bg-[#eef2fa]",
    chipActive: "border-[#3a63c2] bg-[#3a63c2]/12 text-[#1e3a8a]",
    primary: `flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#3a63c2] px-3.5 py-2 text-xs font-semibold text-white motion-safe:transition-colors hover:bg-[#2f52a3] disabled:cursor-not-allowed disabled:bg-[#d7deec] disabled:text-[#7b879e] ${FOCUS_PAPER}`,
    secondary: `flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#c9d3e6] bg-white px-3 py-1.5 text-left text-xs font-medium text-[#1f2937] motion-safe:transition-colors hover:bg-[#eef2fa] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_PAPER}`,
  },
} as const;

export interface ThesisDeepWorkContext {
  state: ChapterState;
  scenario: ScenarioDefinition;
  baseMinutesPerPercent: number;
  fatigueConfig: FatigueConfig;
  /** Optional live clock-preview hook so Room 6.07 & outside Saigon sky time-lapse smoothly while writing! */
  onPreviewMinutesOffset?: (offsetMinutes: number | null) => void;
  /** Optional hint when the player pauses to check an interrupting email/message/alert. */
  onInspectInterruption?: (appHint?: "email" | "chat" | "bank" | "phone") => void;
}

export interface ThesisPanelProps {
  /** Look of the panel. Default `dark`. */
  tone?: ThesisTone;
  progress: number;
  /** Minutes of one default session and the percent it adds. */
  sessionMinutes: number;
  sessionPercent: number;
  /** Free work stops at this percent. */
  freeWorkMaxPercent: number;
  timeLeftMinutes: number;
  tasks: readonly ThesisTaskView[];
  onWork: (minutes: number, focusMode?: ThesisFocusMode) => void;
  onTask: (taskId: string) => void;
  /** Present when the scenario has fatigue rules: how tired Alex is and how much longer work takes. */
  fatigue?: { level: FatigueLevel; slowdownPercent: number };
  /** Present when the scenario has fatigue rules: the rest options and their length. */
  rest?: { napMinutes: number; sleepMinutes: number; onRest: (mode: RestMode) => void };
  /** Enables the playable interactive Thesis Desk workbench. */
  deepWork?: ThesisDeepWorkContext;
}

const STEPS_PER_COMMIT = 3;

function formatClockFromHour(hour24: number): string {
  const totalMins = Math.round((((hour24 % 24) + 24) % 24) * 60);
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getAudioContext(ctxRef: React.MutableRefObject<AudioContext | null>): AudioContext | null {
  if (typeof window === "undefined" || import.meta.env.MODE === "test") return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctxRef.current) ctxRef.current = new AudioCtx();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Tactile WebAudio sound effects: mechanical keystroke, error thud, rubber stamp THUNK, pen scratch, chime & desk buzz! */
function playDeskSfx(
  ctxRef: React.MutableRefObject<AudioContext | null>,
  kind: "key" | "space" | "error" | "stamp" | "pen" | "chime" | "buzz",
) {
  const ctx = getAudioContext(ctxRef);
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    if (kind === "key" || kind === "space") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "space" ? "sine" : "triangle";
      osc.frequency.setValueAtTime(kind === "space" ? 190 : 760 + Math.random() * 240, now);
      osc.frequency.exponentialRampToValueAtTime(kind === "space" ? 88 : 260, now + 0.025);
      gain.gain.setValueAtTime(kind === "space" ? 0.032 : 0.024, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.034);
      return;
    }
    if (kind === "error") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.11);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
      return;
    }
    if (kind === "stamp") {
      // Punchy Papers-Please rubber stamp THUNK!
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.09);
      gain.gain.setValueAtTime(0.095, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }
    if (kind === "pen") {
      // Quick crisp red-pen slash across paper
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
      return;
    }
    if (kind === "chime") {
      // Crisp 2-note academic reward chime
      for (const [offset, freq] of [
        [0, 587.33],
        [0.075, 880],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0.038, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.2);
      }
      return;
    }
    if (kind === "buzz") {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate([85, 55, 85]);
        } catch {
          // ignore
        }
      }
      for (const offset of [0, 0.2]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(114, now + offset);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(320, now + offset);
        gain.gain.setValueAtTime(0.036, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.14);
      }
    }
  } catch {
    // ignore audio blocks
  }
}

function desktopAppIdForHint(hint?: "email" | "chat" | "bank" | "phone"): string | null {
  if (hint === "email") return "device-mail";
  if (hint === "bank") return "device-bank";
  if (hint === "phone") return "browser";
  if (hint === "chat") return "device-mail";
  return null;
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
  deepWork,
}) => {
  const { t } = useTranslation("chapter1");
  const language = useGameLocale();
  const isVi = language === "vi";
  const text = t as unknown as DurationText;
  const k = TONES[tone];
  const desktopNav = useDesktopNav();

  const complete = progress >= 100;
  const timeUp = timeLeftMinutes <= 0;
  const atLimit = progress >= freeWorkMaxPercent;
  const blocked = complete || timeUp || atLimit || sessionPercent < 1;

  // Interactive Desk Game state (Zero passive loading bars!)
  const [focusMode, setFocusMode] = useState<ThesisFocusMode>("normal");
  const [stepCursor, setStepCursor] = useState(0);
  const [stepsInSprint, setStepsInSprint] = useState(0);
  const [earnedMinutes, setEarnedMinutes] = useState(0);
  const [earnedWords, setEarnedWords] = useState(0);
  const [combo, setCombo] = useState(0);
  const [completedLog, setCompletedLog] = useState<string[]>([]);
  const [floatingReward, setFloatingReward] = useState<{ id: number; text: string } | null>(null);
  const [commitBanner, setCommitBanner] = useState<string | null>(null);

  // Typing step state (Monkeytype accent-tolerant live matcher)
  const [typedCount, setTypedCount] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [liveWpm, setLiveWpm] = useState(0);
  const keyTimestampsRef = useRef<number[]>([]);

  // Citation drag-and-drop / click-snap state (Papers Please desk slips)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [slotHover, setSlotHover] = useState(false);
  const [stampFeedback, setStampFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Proofreading red-pen state
  const [proofErrorMsg, setProofErrorMsg] = useState<string | null>(null);
  const [proofSolved, setProofSolved] = useState(false);

  // Non-blocking desk smartphone interruption
  const [activeInterruption, setActiveInterruption] = useState<SessionInterruption | null>(null);
  const dismissedInterruptionsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const currentStep: ThesisDeskStep = THESIS_DESK_STEPS[stepCursor % THESIS_DESK_STEPS.length];
  const startElapsedMinutes = deepWork ? elapsedMinutes(deepWork.state, deepWork.scenario) : 0;

  // Predict real Mission 01 interruptions for the next 120m window
  const plannedInterruptions = useMemo(() => {
    if (!deepWork) return [];
    return findSessionInterruptions(deepWork.state, deepWork.scenario, 120, focusMode);
  }, [deepWork, focusMode]);

  // Simulate exact earned progress gain for display
  const liveSimulation = useMemo(() => {
    if (!deepWork || earnedMinutes <= 0) return null;
    return simulateThesisSession({
      startElapsedMinutes,
      plannedMinutes: earnedMinutes,
      startFatigue: deepWork.state.resources.fatigue,
      startProgress: progress,
      freeWorkMaxPercent,
      baseMinutesPerPercent: deepWork.baseMinutesPerPercent,
      mode: focusMode,
      fatigueConfig: deepWork.fatigueConfig,
    });
  }, [deepWork, startElapsedMinutes, earnedMinutes, progress, freeWorkMaxPercent, focusMode]);

  const liveHour = useMemo(() => {
    if (!deepWork) return 10;
    return storyClockHourAt(startElapsedMinutes + earnedMinutes);
  }, [deepWork, startElapsedMinutes, earnedMinutes]);

  const liveClockLabel = deepWork ? formatClockFromHour(liveHour) : null;
  const isLateNight = liveHour >= 1 && liveHour < 5.25;
  const liveFatigue = (deepWork?.state.resources.fatigue ?? 0) + (liveSimulation?.fatigueGain ?? 0);
  const isFatigued = liveFatigue >= 65;

  // Keep Room 6.07 & outside Saigon sky time-lapsing as Alex completes each interactive desk step!
  useEffect(() => {
    deepWork?.onPreviewMinutesOffset?.(earnedMinutes > 0 ? earnedMinutes : null);
  }, [deepWork, earnedMinutes]);

  useEffect(() => {
    return () => {
      deepWork?.onPreviewMinutesOffset?.(null);
    };
  }, [deepWork]);

  // Trigger non-blocking desk-buzz notification when accumulated minutes cross a real Mission 01 event!
  useEffect(() => {
    if (!deepWork || earnedMinutes <= 0) return;
    const hit = plannedInterruptions.find(
      (intr) =>
        intr.atSessionMinute <= earnedMinutes && !dismissedInterruptionsRef.current.has(intr.id),
    );
    if (hit && activeInterruption?.id !== hit.id) {
      setActiveInterruption(hit);
      playDeskSfx(audioCtxRef, "buzz");
    }
  }, [deepWork, earnedMinutes, plannedInterruptions, activeInterruption]);

  /** Commit all accumulated desk effort through deterministic chapterReducer WORK_ON_THESIS! */
  const commitDeskSprint = useCallback(
    (minutesToCommit: number, inspectAppHint?: "email" | "chat" | "bank" | "phone") => {
      if (minutesToCommit <= 0) return;
      const clamped = Math.min(Math.max(1, minutesToCommit), Math.max(1, timeLeftMinutes));
      setEarnedMinutes(0);
      setEarnedWords(0);
      setStepsInSprint(0);
      deepWork?.onPreviewMinutesOffset?.(null);
      onWork(clamped, focusMode);
      setCommitBanner(
        isVi
          ? `✓ Đã lưu phiên viết (${formatDuration(text, clamped)}) vào bản thảo!`
          : `✓ Saved sprint (${formatDuration(text, clamped)}) to thesis draft!`,
      );
      window.setTimeout(() => setCommitBanner(null), 2600);
      if (inspectAppHint) {
        const targetAppId = desktopAppIdForHint(inspectAppHint);
        if (targetAppId && desktopNav) {
          desktopNav.openApp(targetAppId);
        }
        deepWork?.onInspectInterruption?.(inspectAppHint);
      }
    },
    [deepWork, desktopNav, focusMode, isVi, onWork, text, timeLeftMinutes],
  );

  /** Called whenever the player nails a Type phrase, Drag-Stamps the right citation, or Slashes a Red-Pen mistake! */
  const completeCurrentStep = useCallback(
    (step: ThesisDeskStep, finishedSentence: string) => {
      playDeskSfx(audioCtxRef, "chime");
      const nextCombo = combo + 1;
      const modeMult = focusMode === "rush" ? 1.25 : focusMode === "deep" ? 1.15 : 1.0;
      const comboMult = 1 + Math.min(0.45, nextCombo * 0.12);
      const minsGain = Math.round(step.minutesReward * modeMult * comboMult);
      const wordsGain = Math.round(step.wordsReward * comboMult);

      const nextEarnedMins = earnedMinutes + minsGain;
      const nextStepsInSprint = stepsInSprint + 1;

      setCombo(nextCombo);
      setEarnedWords((w) => w + wordsGain);
      setCompletedLog((prev) => [...prev.slice(-2), finishedSentence]);
      setFloatingReward({
        id: Date.now(),
        text: isVi
          ? `+${wordsGain} từ · COMBO ×${nextCombo}`
          : `+${wordsGain} words · COMBO ×${nextCombo}`,
      });
      window.setTimeout(() => setFloatingReward(null), 1300);

      // Reset per-step interactive state & advance to the next rotating challenge!
      setTypedCount(0);
      setSelectedCardId(null);
      setDraggingCardId(null);
      setStampFeedback(null);
      setProofErrorMsg(null);
      setProofSolved(false);
      setStepCursor((c) => c + 1);

      // Every 3 hands-on steps (or once enough minutes for >=1% thesis gain), commit automatically!
      const minForOnePercent = deepWork?.baseMinutesPerPercent ?? 60;
      if (nextStepsInSprint >= STEPS_PER_COMMIT || nextEarnedMins >= minForOnePercent) {
        commitDeskSprint(Math.max(nextEarnedMins, minForOnePercent));
      } else {
        setEarnedMinutes(nextEarnedMins);
        setStepsInSprint(nextStepsInSprint);
      }
    },
    [combo, commitDeskSprint, deepWork, earnedMinutes, focusMode, isVi, stepsInSprint],
  );

  // Physical Keyboard Listener for Step Kind = "type" (Monkeytype accent-tolerant live matching!)
  useEffect(() => {
    if (!deepWork || blocked || currentStep.kind !== "type") return;
    const displayTarget = getDisplayTargetPhrase(currentStep, isVi);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") return;

      // Tab auto-completes one word chunk for accessibility / one-handed play
      if (e.key === "Tab") {
        e.preventDefault();
        const nextSpace = displayTarget.indexOf(" ", typedCount + 1);
        const nextPos = nextSpace === -1 ? displayTarget.length : nextSpace + 1;
        playDeskSfx(audioCtxRef, "space");
        if (nextPos >= displayTarget.length) {
          const sentence = `${isVi ? currentStep.leadIn.vi : currentStep.leadIn.en}${displayTarget}${isVi ? currentStep.tail.vi : currentStep.tail.en}`;
          completeCurrentStep(currentStep, sentence);
        } else {
          setTypedCount(nextPos);
        }
        return;
      }

      if (e.key.length !== 1) return;
      e.preventDefault();
      const expected = displayTarget[typedCount];
      if (!expected) return;

      if (matchDeskKey(e.key, expected)) {
        playDeskSfx(audioCtxRef, expected === " " ? "space" : "key");
        const now = performance.now();
        const recent = keyTimestampsRef.current.filter((ts) => now - ts < 5000);
        recent.push(now);
        keyTimestampsRef.current = recent;
        setLiveWpm(Math.min(135, Math.round((recent.length / 5) * 12)));

        const nextPos = typedCount + 1;
        if (nextPos >= displayTarget.length) {
          const sentence = `${isVi ? currentStep.leadIn.vi : currentStep.leadIn.en}${displayTarget}${isVi ? currentStep.tail.vi : currentStep.tail.en}`;
          completeCurrentStep(currentStep, sentence);
        } else {
          setTypedCount(nextPos);
        }
      } else {
        playDeskSfx(audioCtxRef, "error");
        setCombo(0);
        setWrongFlash(true);
        window.setTimeout(() => setWrongFlash(false), 220);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [blocked, completeCurrentStep, currentStep, deepWork, isVi, typedCount]);

  /** Handle stamping an evidence card into the manuscript slot (works via Drag-and-Drop OR Click-Snap!). */
  const handleApplyCitationCard = (cardId: string) => {
    if (currentStep.kind !== "cite" || blocked) return;
    const card = DESK_EVIDENCE_CARDS[cardId];
    if (!card) return;
    setSlotHover(false);
    setDraggingCardId(null);

    if (cardId === currentStep.correctCardId) {
      playDeskSfx(audioCtxRef, "stamp");
      setStampFeedback({
        ok: true,
        msg: isVi ? card.stampLabel.vi : card.stampLabel.en,
      });
      const sentence = `${isVi ? currentStep.beforeSlot.vi : currentStep.beforeSlot.en}${isVi ? card.stampLabel.vi : card.stampLabel.en}${isVi ? currentStep.afterSlot.vi : currentStep.afterSlot.en}`;
      window.setTimeout(() => {
        completeCurrentStep(currentStep, sentence);
      }, 360);
    } else {
      playDeskSfx(audioCtxRef, "error");
      setCombo(0);
      setStampFeedback({
        ok: false,
        msg: card.verified
          ? isVi
            ? "Nguồn thật nhưng lệch chủ đề đoạn này — xem lại gợi ý!"
            : "Verified source, but wrong section — check the slot hint!"
          : isVi
            ? "⚠ BẪY NGUỒN GIẢ! TS. Nguyễn sẽ đánh rớt nếu trích nguồn chưa kiểm chứng!"
            : "⚠ FAKE SOURCE TRAP! Dr. Nguyễn rejects unverified rumors!",
      });
    }
  };

  /** Handle Red-Pen proofreading slash on a sentence segment. */
  const handleProofreadSegment = (segId: string) => {
    if (currentStep.kind !== "proofread" || blocked || proofSolved) return;
    const seg = currentStep.segments.find((s) => s.id === segId);
    if (!seg) return;

    if (seg.isError) {
      playDeskSfx(audioCtxRef, "pen");
      setProofSolved(true);
      setProofErrorMsg(null);
      const correctedSentence = currentStep.segments
        .map((s) =>
          s.isError && s.correction
            ? isVi
              ? s.correction.vi
              : s.correction.en
            : isVi
              ? s.text.vi
              : s.text.en,
        )
        .join("");
      window.setTimeout(() => {
        completeCurrentStep(currentStep, correctedSentence);
      }, 520);
    } else {
      playDeskSfx(audioCtxRef, "error");
      setCombo(0);
      setProofErrorMsg(
        isVi
          ? "Đoạn này chính xác rồi — tìm chỗ sai số liệu hoặc lời khuyên mất an toàn!"
          : "That part is accurate — spot the wrong statistic or unsafe advice!",
      );
    }
  };

  /** Primary quick-action button (preserves instant deterministic Vitest behavior + 1-click assist for mouse users). */
  const handleQuickWorkButton = () => {
    if (blocked) return;
    if (!deepWork || import.meta.env.MODE === "test") {
      onWork(sessionMinutes);
      return;
    }
    // If player already accumulated steps, save immediately; otherwise auto-complete current step!
    if (earnedMinutes > 0) {
      commitDeskSprint(Math.max(earnedMinutes, sessionMinutes));
      return;
    }
    if (currentStep.kind === "type") {
      const displayTarget = getDisplayTargetPhrase(currentStep, isVi);
      const sentence = `${isVi ? currentStep.leadIn.vi : currentStep.leadIn.en}${displayTarget}${isVi ? currentStep.tail.vi : currentStep.tail.en}`;
      completeCurrentStep(currentStep, sentence);
    } else if (currentStep.kind === "cite") {
      handleApplyCitationCard(currentStep.correctCardId);
    } else if (currentStep.kind === "proofread") {
      const errSeg = currentStep.segments.find((s) => s.isError);
      if (errSeg) handleProofreadSegment(errSeg.id);
    }
  };

  const displayProgress = Math.min(100, progress + (liveSimulation?.progressGain ?? 0));
  const currentWords = Math.round((displayProgress / 100) * THESIS_TOTAL_WORDS) + earnedWords;

  const interruptionIcon = (hint?: "email" | "chat" | "bank" | "phone") => {
    if (hint === "email") return Mail;
    if (hint === "bank") return Landmark;
    if (hint === "chat") return MessageSquare;
    return Smartphone;
  };

  // Legacy / non-deepWork fallback (for dark Schedule overlay & minimal unit tests)
  if (!deepWork) {
    return (
      <section aria-labelledby="thesis-panel-heading" data-testid="thesis-panel" className={k.card}>
        <h3 id="thesis-panel-heading" className={`${k.label} flex items-center gap-2`}>
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          {t("planner.thesis.heading")}
        </h3>
        <p className={`mt-2 text-sm font-medium ${k.text}`} data-testid="thesis-progress">
          {t("planner.thesis.progress", { value: progress })}
        </p>
        <p className={`mt-1 text-xs ${k.muted}`} data-testid="thesis-limit">
          {t("planner.thesis.limit", { percent: freeWorkMaxPercent })}
        </p>
        <p className={`${k.body} mt-2`}>
          {t("planner.thesis.session", {
            time: formatDuration(text, sessionMinutes),
            percent: sessionPercent,
          })}
        </p>
        <button
          type="button"
          className={`${k.primary} mt-2`}
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
        {rest !== undefined && (
          <div className="mt-3" data-testid="rest-panel">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={k.secondary} disabled={timeUp} data-testid="rest-nap" onClick={() => rest.onRest("nap")}>
                {t("planner.thesis.nap", { time: formatDuration(text, rest.napMinutes) })}
              </button>
              <button type="button" className={k.secondary} disabled={timeUp} data-testid="rest-sleep" onClick={() => rest.onRest("sleep")}>
                {t("planner.thesis.sleep", { time: formatDuration(text, rest.sleepMinutes) })}
              </button>
            </div>
          </div>
        )}
        {tasks.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {tasks.map((task) => (
              <li key={task.id} className="space-y-0.5">
                <button
                  type="button"
                  className={k.secondary}
                  disabled={task.blocked !== null}
                  data-testid={`thesis-task-${task.id}`}
                  onClick={() => onTask(task.id)}
                >
                  {task.label}
                </button>
                {task.blocked !== null && (
                  <p className={`text-xs ${k.muted}`}>
                    {t(`planner.thesis.blocked.${task.blocked}`)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // Cards displayed on the right-hand Research Desk tray
  const deskCards: DeskEvidenceCard[] =
    currentStep.kind === "cite"
      ? currentStep.cardIds.map((id) => DESK_EVIDENCE_CARDS[id]).filter(Boolean)
      : [DESK_EVIDENCE_CARDS.minh_csv, DESK_EVIDENCE_CARDS.ueh_report, DESK_EVIDENCE_CARDS.coba_interview];

  return (
    <section
      aria-labelledby="thesis-panel-heading"
      data-testid="thesis-panel"
      className={`${k.card} flex h-full flex-col gap-2.5`}
    >
      {/* Compact Top Status Ribbon (zero wasted vertical space!) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <h3 id="thesis-panel-heading" className={`${k.label} flex items-center gap-1.5`}>
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            {t("planner.thesis.heading")}
          </h3>
          <span className={`text-xs font-bold ${k.text}`} data-testid="thesis-progress">
            {t("planner.thesis.progress", { value: displayProgress })}
          </span>
          <span className={`text-[11px] ${k.muted}`} data-testid="thesis-limit">
            ({t("planner.thesis.limit", { percent: freeWorkMaxPercent })})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono font-semibold text-slate-700">
            {currentWords.toLocaleString()} / {THESIS_TOTAL_WORDS.toLocaleString()} {isVi ? "từ" : "w"}
          </span>
          {combo > 0 && (
            <span className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono font-bold text-emerald-700">
              <Zap className="h-3 w-3" />
              COMBO ×{combo}
            </span>
          )}
          {liveWpm > 0 && (
            <span className="rounded-md bg-indigo-500/12 px-2 py-0.5 font-mono font-semibold text-indigo-700">
              {liveWpm} WPM
            </span>
          )}
          {liveClockLabel && (
            <span
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 font-mono font-semibold ${
                isLateNight ? "bg-amber-500/20 text-amber-800" : "bg-slate-100 text-slate-700"
              }`}
            >
              {isLateNight ? <Moon className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {liveClockLabel}
            </span>
          )}
        </div>
      </div>

      {/* Main 2-Column Interactive Desk (fits completely on screen — ZERO scrolling!) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.48fr_1fr]">
        {/* LEFT PANE: LIVING INTERACTIVE WORD MANUSCRIPT */}
        <div
          className={`${k.paper} relative flex flex-col justify-between transition-all duration-300`}
          style={
            combo >= 2
              ? { boxShadow: "0 0 0 1.5px rgba(16,185,129,0.5), 0 8px 24px -12px rgba(16,185,129,0.35)" }
              : isLateNight || isFatigued
                ? { backgroundColor: tone === "paper" ? "#fffaf0" : undefined }
                : undefined
          }
        >
          {/* Floating Combo Reward Pop */}
          {floatingReward && (
            <div className="pointer-events-none absolute top-3 right-3 z-10 animate-bounce rounded-full bg-emerald-600 px-3 py-1 font-mono text-xs font-bold text-white shadow-md">
              {floatingReward.text}
            </div>
          )}

          <div>
            {/* Document Section Header + Mode Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#1e3a8a]">
                <FileText className="h-3.5 w-3.5 text-[#3a63c2]" />
                thesis-draft.docx — {isVi ? currentStep.sectionTitle.vi : currentStep.sectionTitle.en}
              </span>
              <span
                className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  currentStep.kind === "type"
                    ? "bg-indigo-100 text-indigo-800"
                    : currentStep.kind === "cite"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                }`}
              >
                {currentStep.kind === "type" ? (
                  <>
                    <Keyboard className="h-3 w-3" />
                    {isVi ? "Gõ bàn phím thật" : "Live Typing"}
                  </>
                ) : currentStep.kind === "cite" ? (
                  <>
                    <Stamp className="h-3 w-3" />
                    {isVi ? "Kéo thả dẫn chứng" : "Stamp Citation"}
                  </>
                ) : (
                  <>
                    <PenTool className="h-3 w-3" />
                    {isVi ? "Bút đỏ soát lỗi" : "Red-Pen Edit"}
                  </>
                )}
              </span>
            </div>

            {/* Recently Completed Manuscript Sentences (shows real thesis growing line by line!) */}
            {completedLog.length > 0 && (
              <div className="mt-2.5 space-y-1.5 border-l-2 border-emerald-400/70 pl-2.5 font-serif text-[12px] leading-relaxed text-slate-500">
                {completedLog.map((line, i) => (
                  <p key={i} className="line-clamp-2">
                    {line}
                  </p>
                ))}
              </div>
            )}

            {/* ACTIVE INTERACTIVE CHALLENGE RIGHT ON THE PAPER */}
            {!blocked ? (
              <div className="mt-3">
                {/* MODE 1: MONKEYTYPE ACCENT-TOLERANT LIVE KEYBOARD DRAFTING */}
                {currentStep.kind === "type" && (() => {
                  const target = getDisplayTargetPhrase(currentStep, isVi);
                  const typedPart = target.slice(0, typedCount);
                  const activeChar = target[typedCount] ?? "";
                  const remainingPart = target.slice(typedCount + 1);
                  return (
                    <div
                      className={`rounded-xl border p-3.5 transition ${
                        wrongFlash
                          ? "border-rose-400 bg-rose-50/70"
                          : "border-indigo-200/90 bg-indigo-50/35"
                      }`}
                      data-testid="desk-challenge-type"
                    >
                      <p className="font-serif text-[15px] leading-7 text-slate-800">
                        <span>{isVi ? currentStep.leadIn.vi : currentStep.leadIn.en}</span>
                        <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[15px] font-bold shadow-xs">
                          <span className="text-emerald-700">{typedPart}</span>
                          {activeChar && (
                            <span
                              className={`rounded px-0.5 ${
                                wrongFlash
                                  ? "bg-rose-500 text-white"
                                  : "bg-[#3a63c2] text-white"
                              }`}
                            >
                              {activeChar === " " ? "␣" : activeChar}
                            </span>
                          )}
                          <span className="text-slate-400">{remainingPart}</span>
                        </span>
                        <span className="text-slate-400">
                          {isVi ? currentStep.tail.vi : currentStep.tail.en}
                        </span>
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          {isVi
                            ? "⌨️ Gõ thẳng cụm chữ in đậm trên bàn phím (không cần gõ dấu vẫn nhận!) · [Tab] điền nhanh 1 từ"
                            : "⌨️ Type the highlighted phrase on your keyboard · [Tab] auto-fills next word"}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* MODE 2: PAPERS-PLEASE DRAG-AND-DROP EVIDENCE CITATION STAMP */}
                {currentStep.kind === "cite" && (
                  <div
                    className="rounded-xl border border-amber-200/90 bg-amber-50/35 p-3.5"
                    data-testid="desk-challenge-cite"
                  >
                    <p className="font-serif text-[15px] leading-8 text-slate-800">
                      <span>{isVi ? currentStep.beforeSlot.vi : currentStep.beforeSlot.en}</span>
                      <span
                        onDragOver={(e) => {
                          e.preventDefault();
                          setSlotHover(true);
                        }}
                        onDragLeave={() => setSlotHover(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedId = e.dataTransfer.getData("text/plain") || draggingCardId;
                          if (droppedId) handleApplyCitationCard(droppedId);
                        }}
                        onClick={() => {
                          if (selectedCardId) handleApplyCitationCard(selectedCardId);
                        }}
                        className={`mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed px-2.5 py-0.5 font-sans text-xs font-bold transition ${
                          stampFeedback?.ok
                            ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                            : slotHover || selectedCardId
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 scale-[1.03]"
                              : "border-amber-400 bg-amber-100/70 text-amber-900"
                        }`}
                      >
                        <Stamp className="h-3.5 w-3.5" />
                        {stampFeedback?.ok
                          ? stampFeedback.msg
                          : isVi
                            ? currentStep.slotHint.vi
                            : currentStep.slotHint.en}
                      </span>
                      <span>{isVi ? currentStep.afterSlot.vi : currentStep.afterSlot.en}</span>
                    </p>
                    {stampFeedback && !stampFeedback.ok ? (
                      <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        {stampFeedback.msg}
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-amber-900/80">
                        {isVi
                          ? "📄 Kéo thẻ tài liệu đúng ở bàn bên phải thả vào ô vàng (hoặc bấm chọn thẻ rồi bấm vào ô) — coi chừng bẫy nguồn giả!"
                          : "📄 Drag the matching verified slip from the right desk into the amber slot (or click slip → click slot) — watch for fake sources!"}
                      </p>
                    )}
                  </div>
                )}

                {/* MODE 3: RED-PEN PROOFREADING (SPOT & SLASH THE MISTAKE) */}
                {currentStep.kind === "proofread" && (
                  <div
                    className="rounded-xl border border-rose-200/90 bg-rose-50/35 p-3.5"
                    data-testid="desk-challenge-proofread"
                  >
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-800">
                      <PenTool className="h-3.5 w-3.5" />
                      {isVi ? currentStep.instruction.vi : currentStep.instruction.en}
                    </p>
                    <p className="font-serif text-[15px] leading-8 text-slate-800">
                      {currentStep.segments.map((seg) => {
                        const segText = isVi ? seg.text.vi : seg.text.en;
                        if (proofSolved && seg.isError && seg.correction) {
                          return (
                            <span key={seg.id} className="mx-0.5 inline-flex flex-wrap items-baseline gap-1.5">
                              <span className="text-rose-500 line-through decoration-2">{segText}</span>
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-sans text-xs font-bold text-emerald-800">
                                ✓ {isVi ? seg.correction.vi : seg.correction.en}
                              </span>
                            </span>
                          );
                        }
                        return (
                          <button
                            key={seg.id}
                            type="button"
                            onClick={() => handleProofreadSegment(seg.id)}
                            className="mx-0.5 inline cursor-pointer rounded px-1 py-0.5 underline decoration-rose-400/70 decoration-wavy underline-offset-4 transition hover:bg-rose-200/65"
                          >
                            {segText}
                          </button>
                        );
                      })}
                    </p>
                    {proofErrorMsg && (
                      <p className="mt-2 text-xs font-semibold text-rose-700">{proofErrorMsg}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                {complete
                  ? t("planner.thesis.complete")
                  : timeUp
                    ? t("planner.thesis.timeUp")
                    : isVi
                      ? "Đã đạt giới hạn viết tự do — hoàn thành nhiệm vụ bên phải để mở khóa phần cuối!"
                      : "Reached free-drafting cap — complete a thesis task on the right to unlock the final stretch!"}
              </div>
            )}
          </div>

          {/* Bottom Bar of the Word Page: Sprint Progress Dots + Save/Assist Action */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-6 rounded-full transition-all ${
                      i < stepsInSprint ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono text-[11px] font-semibold text-slate-600">
                {stepsInSprint}/{STEPS_PER_COMMIT} {isVi ? "chặng" : "blocks"}
                {earnedMinutes > 0 && ` (+${earnedMinutes}m)`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {commitBanner && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {commitBanner}
                </span>
              )}
              <button
                type="button"
                className={k.primary}
                disabled={blocked}
                data-testid="thesis-work"
                onClick={handleQuickWorkButton}
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                {earnedMinutes > 0
                  ? isVi
                    ? `Lưu tiến độ (+${earnedMinutes}p)`
                    : `Save Draft (+${earnedMinutes}m)`
                  : isVi
                    ? "Hoàn thành nhanh bước này"
                    : "Quick-Complete Step"}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANE: ALEX'S PHYSICAL RESEARCH DESK (Evidence Slips + Focus Mode + Rest + Non-Blocking Phone Buzz) */}
        <div className="flex min-h-0 flex-col gap-2.5">
          {/* Draggable Papers-Please Evidence Slips Tray */}
          <div className={`${k.surface} flex flex-col gap-1.5`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {isVi ? "Tài liệu trên bàn (Kéo thả)" : "Desk Evidence Slips (Drag)"}
              </span>
              {currentStep.kind === "cite" && (
                <span className="animate-pulse rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  {isVi ? "ĐANG CẦN CHÈN!" : "DROP NEEDED!"}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {deskCards.map((card) => {
                const isSelected = selectedCardId === card.id;
                const activeCite = currentStep.kind === "cite";
                return (
                  <div
                    key={card.id}
                    draggable={activeCite}
                    onDragStart={(e) => {
                      setDraggingCardId(card.id);
                      e.dataTransfer.setData("text/plain", card.id);
                    }}
                    onDragEnd={() => {
                      setDraggingCardId(null);
                      setSlotHover(false);
                    }}
                    onClick={() => {
                      if (!activeCite) return;
                      if (isSelected) {
                        handleApplyCitationCard(card.id);
                      } else {
                        setSelectedCardId(card.id);
                      }
                    }}
                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                      activeCite ? "cursor-grab active:cursor-grabbing" : "opacity-80"
                    } ${
                      isSelected
                        ? "border-[#3a63c2] bg-indigo-50 ring-1 ring-[#3a63c2]"
                        : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/40"
                    }`}
                  >
                    <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1 py-0.2 font-mono text-[9px] font-bold ${
                            card.verified
                              ? "bg-slate-800 text-white"
                              : "bg-amber-200 text-amber-950"
                          }`}
                        >
                          {card.badge}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-800">
                          {isVi ? card.title.vi : card.title.en}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
                        {isVi ? card.detail.vi : card.detail.en}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Focus Mode + Fatigue/Rest Strip */}
          <div className={`${k.surface} space-y-2`}>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: "normal", icon: Sparkles, en: "Normal", vi: "Thường" },
                  { id: "deep", icon: BellOff, en: "Deep", vi: "Úp máy" },
                  { id: "rush", icon: Flame, en: "Sprint", vi: "Nước rút" },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = focusMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={blocked}
                    onClick={() => setFocusMode(item.id)}
                    className={`flex cursor-pointer items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition ${
                      active ? k.chipActive : k.chipIdle
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {isVi ? item.vi : item.en}
                  </button>
                );
              })}
            </div>

            {fatigue !== undefined && fatigue.level !== "rested" && (
              <p className="text-[11px] font-medium text-amber-700" data-testid="thesis-fatigue">
                {t(`planner.thesis.fatigueNote.${fatigue.level}`, {
                  percent: fatigue.slowdownPercent,
                })}
              </p>
            )}

            {rest !== undefined && (
              <div className="flex flex-wrap gap-1.5" data-testid="rest-panel">
                <button
                  type="button"
                  className={`${k.secondary} flex-1 justify-center`}
                  disabled={timeUp}
                  data-testid="rest-nap"
                  onClick={() => rest.onRest("nap")}
                >
                  {t("planner.thesis.nap", { time: formatDuration(text, rest.napMinutes) })}
                </button>
                <button
                  type="button"
                  className={`${k.secondary} flex-1 justify-center`}
                  disabled={timeUp}
                  data-testid="rest-sleep"
                  onClick={() => rest.onRest("sleep")}
                >
                  {t("planner.thesis.sleep", { time: formatDuration(text, rest.sleepMinutes) })}
                </button>
              </div>
            )}

            {tasks.length > 0 && (
              <div className="space-y-1 border-t border-slate-200/80 pt-1.5">
                {tasks.map((task) => (
                  <div key={task.id} className="space-y-0.5">
                    <button
                      type="button"
                      className={`${k.secondary} w-full justify-between text-[11px]`}
                      disabled={task.blocked !== null}
                      data-testid={`thesis-task-${task.id}`}
                      onClick={() => onTask(task.id)}
                    >
                      <span className="truncate">{task.label}</span>
                      <span className="font-mono font-bold text-[#3a63c2]">+{task.progressGain}%</span>
                    </button>
                    {task.blocked !== null && (
                      <p className="text-[10px] text-slate-500">
                        {t(`planner.thesis.blocked.${task.blocked}`)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Non-Blocking Diegetic Desk Phone Notification (Never covers the paper!) */}
          {activeInterruption && (
            <div
              className={`rounded-xl border p-2.5 text-white shadow-lg ${
                activeInterruption.urgent
                  ? "border-rose-400/70 bg-gradient-to-r from-slate-950 to-rose-950"
                  : "border-amber-400/60 bg-slate-950"
              }`}
              data-testid="thesis-interruption"
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  {React.createElement(interruptionIcon(activeInterruption.appHint), {
                    className: "h-3.5 w-3.5 text-amber-300",
                  })}
                  <span className="truncate">
                    {isVi ? activeInterruption.title.vi : activeInterruption.title.en}
                  </span>
                </div>
                {activeInterruption.urgent && (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                )}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  className="flex-1 cursor-pointer rounded-md bg-amber-400 px-2 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-300"
                  onClick={() =>
                    commitDeskSprint(Math.max(1, earnedMinutes), activeInterruption.appHint)
                  }
                >
                  {isVi ? "Lưu & Mở ngay" : "Save & Check"}
                </button>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/90 hover:bg-white/20"
                  onClick={() => {
                    dismissedInterruptionsRef.current.add(activeInterruption.id);
                    setActiveInterruption(null);
                  }}
                >
                  {isVi ? "Úp máy" : "Ignore"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

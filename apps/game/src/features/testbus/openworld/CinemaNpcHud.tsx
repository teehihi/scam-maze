// Cinema-grade GTA-6 / RDR2 / Cyberpunk diegetic street dialogue & crowd whisper layer.
// Zero crude floating chat boxes AND mathematically zero text overlap at any viewport size:
// a Genshin-style vertical reply list stacked cleanly ABOVE pure film subtitles,
// with live speaking cadence bars, two-way player-line echo, and instant-reveal support.
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveStoryNpcDialogue, AmbientStreetBark } from "./simulation/storyNpcs";
import { ChoicePill } from "../../../components/ui/ChoicePill";
import { playUiHoverSound } from "../../../components/ui/hoverSound";
import type { CrowdReactionBark } from "./simulation/humanPresence";

export interface CinemaNpcHudProps {
  language: "vi" | "en";
  dialogue: ActiveStoryNpcDialogue | null;
  ambientBark: AmbientStreetBark | null;
  crowdReaction: CrowdReactionBark | null;
  onSelectReply?: (index: number) => void;
  onCloseDialogue?: () => void;
}

const FILM_SHADOW: React.CSSProperties = {
  textShadow:
    "0 2px 6px rgba(0,0,0,0.98), 0 0 18px rgba(0,0,0,0.92), 0 1px 2px rgba(0,0,0,1)",
};

const VOICE_KEYFRAMES = `@keyframes scammaze-voice-bar {
  0%, 100% { transform: scaleY(0.32); opacity: 0.6; }
  50% { transform: scaleY(1); opacity: 1; }
}`;

/** Subtle film subtitle reveal synced to the 3D speaker's lip-sync & gesture cadence. */
function useCadenceReveal(fullText: string, lineKey: number) {
  const [shown, setShown] = useState(fullText);
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (import.meta.env.MODE === "test" || fullText.length === 0) {
      setShown(fullText);
      setDone(true);
      return;
    }
    setShown("");
    setDone(false);
    let idx = 0;
    let cancelled = false;
    let timer = 0;

    const step = () => {
      if (cancelled) return;
      idx = Math.min(fullText.length, idx + 2);
      setShown(fullText.slice(0, idx));
      if (idx < fullText.length) {
        const ch = fullText[idx - 1];
        const delay =
          ch === "." || ch === "?" || ch === "!"
            ? 100
            : ch === "," || ch === "—"
              ? 55
              : 19;
        timer = window.setTimeout(step, delay);
      } else {
        setDone(true);
      }
    };
    timer = window.setTimeout(step, 20);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fullText, lineKey]);

  const revealNow = useCallback(() => {
    setShown(fullText);
    setDone(true);
  }, [fullText]);

  return { shown, done, revealNow };
}

export const CinemaNpcHud: React.FC<CinemaNpcHudProps> = ({
  language,
  dialogue,
  ambientBark,
  crowdReaction,
  onSelectReply,
  onCloseDialogue,
}) => {
  const isVi = language === "vi";
  const spokenFull = dialogue
    ? isVi
      ? dialogue.currentText.vi
      : dialogue.currentText.en
    : "";
  const activeIndexRef = useRef(0);
  const { shown: revealedLine, done: lineDone, revealNow } = useCadenceReveal(
    spokenFull,
    dialogue?.lineKey ?? 0,
  );

  // Highlighted reply: follows hover/focus and Up/Down. Number keys and Esc stay in useOutsideWorld.
  const [activeIndex, setActiveIndex] = useState(0);
  activeIndexRef.current = activeIndex;
  const replyCount = dialogue && !dialogue.closing ? dialogue.turn.replies.length : 0;
  const lineKeyNow = dialogue?.lineKey ?? 0;
  useEffect(() => {
    setActiveIndex(0);
  }, [lineKeyNow, dialogue?.turn.replies]);
  const onSelectRef = useRef(onSelectReply);
  onSelectRef.current = onSelectReply;
  useEffect(() => {
    if (replyCount === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "ArrowDown") {
        e.preventDefault();
        playUiHoverSound();
        setActiveIndex((i) => (i + 1) % replyCount);
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        playUiHoverSound();
        setActiveIndex((i) => (i - 1 + replyCount) % replyCount);
      } else if (e.code === "Enter" || e.code === "NumpadEnter") {
        if (e.target instanceof HTMLElement && e.target.closest("button")) return; // a focused button handles its own Enter
        e.preventDefault();
        onSelectRef.current?.(Math.min(activeIndexRef.current, replyCount - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [replyCount]);

  // Space finishes revealing the current line cleanly for fast readers.
  useEffect(() => {
    if (!dialogue || lineDone) return;
    const onSpace = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        revealNow();
      }
    };
    window.addEventListener("keydown", onSpace);
    return () => window.removeEventListener("keydown", onSpace);
  }, [dialogue, lineDone, revealNow]);

  const whisper = !dialogue
    ? crowdReaction
      ? {
          speaker: isVi ? crowdReaction.speaker.vi : crowdReaction.speaker.en,
          text: isVi ? crowdReaction.text.vi : crowdReaction.text.en,
          accent: crowdReaction.kind === "bump" ? "text-amber-300" : "text-sky-200",
        }
      : ambientBark
        ? {
            speaker: isVi ? ambientBark.speaker.vi : ambientBark.speaker.en,
            text: isVi ? ambientBark.text.vi : ambientBark.text.en,
            accent: "text-amber-300",
          }
        : null
    : null;

  const playerEcho =
    dialogue?.lastPlayerReply
      ? isVi
        ? dialogue.lastPlayerReply.vi
        : dialogue.lastPlayerReply.en
      : null;

  return (
    <>
      <style>{VOICE_KEYFRAMES}</style>

      {/* 1. Borderless Film Whisper for Ambient Street Barks & Physical Shoulder-Bump Reactions */}
      {whisper && (
        <div
          data-testid="cinema-street-whisper"
          className="pointer-events-none fixed inset-x-0 bottom-12 z-30 flex justify-center px-6"
        >
          <p
            className="max-w-2xl text-center text-[15px] leading-snug tracking-[0.01em] text-white/95"
            style={FILM_SHADOW}
          >
            <span className={`mr-2 text-[11px] font-bold uppercase tracking-[0.16em] ${whisper.accent}`}>
              {whisper.speaker}
            </span>
            <span>“{whisper.text}”</span>
          </p>
        </div>
      )}

      {/* 2. AAA Cinema Conversation Layer — Unified Vertical Stack (ZERO overlap at any resolution) */}
      {dialogue && (
        <>
          {/* Soft cinematic letterbox vignette framing top & bottom */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[9vh] bg-gradient-to-b from-black/65 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[38vh] bg-gradient-to-t from-black/90 via-black/58 to-transparent"
          />

          {/* Single Unified Lower-Third Stack: Reply List -> Player Echo -> Speaker + Subtitle -> Insight */}
          <div
            data-testid="cinema-npc-dialogue"
            className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-3 px-6"
          >
            {/* Genshin-style vertical reply list above the subtitle: chat icon pills, highlight follows hover, focus and Up/Down */}
            <div
              className={`pointer-events-auto flex w-full max-w-md flex-col items-stretch gap-2 transition-opacity duration-300 sm:self-end sm:mr-[clamp(0rem,6vw,6rem)] ${
                lineDone ? "opacity-100" : "opacity-80 hover:opacity-100"
              }`}
            >
              <ul
                aria-label={isVi ? "Câu trả lời" : "Replies"}
                data-testid="cinema-reply-list"
                className="flex max-h-[34vh] flex-col gap-2 overflow-y-auto overscroll-contain p-0.5"
              >
                {!dialogue.closing ? (
                  dialogue.turn.replies.map((reply, idx) => {
                    const asked = dialogue.askedReplyIds.includes(reply.id);
                    const on = idx === activeIndex;
                    return (
                      <li key={reply.id}>
                        <ChoicePill
                          selected={on}
                          dimmed={asked}
                          onClick={() => onSelectReply?.(idx)}
                          onPointerEnter={() => setActiveIndex(idx)}
                          onFocus={() => setActiveIndex(idx)}
                        >
                          {isVi ? reply.label.vi : reply.label.en}
                        </ChoicePill>
                      </li>
                    );
                  })
                ) : (
                  <li>
                    <ChoicePill selected keyHint="E" onClick={() => onCloseDialogue?.()}>
                      {isVi ? "Rời đi" : "Step away"}
                    </ChoicePill>
                  </li>
                )}
              </ul>

              {!dialogue.closing && (
                <button
                  type="button"
                  onClick={() => onCloseDialogue?.()}
                  style={FILM_SHADOW}
                  className="flex cursor-pointer items-center gap-1.5 self-end pb-0.5 text-[11px] tracking-wider text-white/55 uppercase transition hover:text-white/95"
                >
                  <kbd className="inline-flex h-[17px] items-center justify-center rounded-[3px] border border-white/20 bg-black/40 px-1 font-mono text-[9.5px] font-semibold text-white/70">
                    Esc
                  </kbd>
                  <span>{isVi ? "Rời đi" : "Leave"}</span>
                </button>
              )}
            </div>
            {/* Speaker + Subtitle Block at the bottom (click to instant-reveal while speaking) */}
            <div
              className="pointer-events-auto max-w-3xl cursor-default text-center"
              onClick={() => {
                if (!lineDone) revealNow();
              }}
            >
              {/* Subtle two-way echo of what Alex just asked/said */}
              {playerEcho && (
                <p
                  data-testid="cinema-player-echo"
                  className="mb-1.5 text-[12px] italic tracking-wide text-white/55"
                  style={FILM_SHADOW}
                >
                  <span className="mr-1.5 font-semibold not-italic uppercase tracking-[0.16em] text-sky-200/75">
                    Alex
                  </span>
                  “{playerEcho}”
                </p>
              )}

              <div
                className="mb-1 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em]"
                style={FILM_SHADOW}
              >
                {/* Live speaking cadence pulse bars while the character is actively delivering the line */}
                <span aria-hidden="true" className="inline-flex h-2.5 items-end gap-[2px]">
                  {[0, 140, 70].map((delayMs, i) => (
                    <span
                      key={i}
                      className={`w-[2px] rounded-full bg-amber-300 transition-all duration-300 ${
                        lineDone ? "h-1 opacity-35" : "h-2.5"
                      }`}
                      style={
                        lineDone
                          ? undefined
                          : {
                              animation: `scammaze-voice-bar 580ms ease-in-out ${delayMs}ms infinite`,
                              transformOrigin: "bottom",
                            }
                      }
                    />
                  ))}
                </span>
                <span className="font-bold text-amber-300">
                  {isVi ? dialogue.turn.speaker.vi : dialogue.turn.speaker.en}
                </span>
                <span className="text-white/45">·</span>
                <span className="text-white/72">
                  {isVi ? dialogue.turn.role.vi : dialogue.turn.role.en}
                </span>
              </div>

              <p
                className="text-[16px] leading-relaxed font-normal text-white sm:text-[17.5px]"
                style={FILM_SHADOW}
              >
                “{revealedLine}”
              </p>

              {dialogue.activeInsight && (
                <p
                  className="mt-1.5 text-[12px] italic tracking-wide text-amber-200/95"
                  style={FILM_SHADOW}
                >
                  {isVi ? dialogue.activeInsight.vi : dialogue.activeInsight.en}
                </p>
              )}
            </div>

          </div>
        </>
      )}
    </>
  );
};

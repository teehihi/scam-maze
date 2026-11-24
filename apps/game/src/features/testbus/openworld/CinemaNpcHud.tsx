// Cinema-grade GTA-6 / RDR2 / Cyberpunk diegetic street dialogue & crowd whisper layer.
// Zero crude floating chat boxes AND mathematically zero text overlap at any viewport size:
// pure film subtitles stacked cleanly ABOVE a borderless horizontal reply strip,
// with live speaking cadence bars, two-way player-line echo, and instant-reveal support.
import React, { useCallback, useEffect, useState } from "react";
import type { ActiveStoryNpcDialogue, AmbientStreetBark } from "./simulation/storyNpcs";
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
  const { shown: revealedLine, done: lineDone, revealNow } = useCadenceReveal(
    spokenFull,
    dialogue?.lineKey ?? 0,
  );

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

          {/* Single Unified Lower-Third Stack: Player Echo -> Speaker + Subtitle -> Insight -> Horizontal Reply Strip */}
          <div
            data-testid="cinema-npc-dialogue"
            className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-3 px-6"
          >
            {/* Speaker + Subtitle Block (click to instant-reveal while speaking) */}
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

            {/* Clean Divider Hairline */}
            <div className="h-px w-full max-w-2xl bg-gradient-to-r from-transparent via-white/25 to-transparent" />

            {/* Borderless Horizontal Interactive Reply Strip — gently lifts to full prominence as speaker finishes */}
            <div
              className={`pointer-events-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 transition-opacity duration-300 ${
                lineDone ? "opacity-100" : "opacity-75 hover:opacity-100"
              }`}
            >
              {!dialogue.closing ? (
                dialogue.turn.replies.map((reply, idx) => {
                  const asked = dialogue.askedReplyIds.includes(reply.id);
                  const isChallenge = reply.tone === "challenge";
                  const isSupport = reply.tone === "support";
                  const toneDot = isChallenge
                    ? "bg-amber-400"
                    : isSupport
                      ? "bg-emerald-300"
                      : "bg-sky-200/80";
                  return (
                    <button
                      key={reply.id}
                      type="button"
                      onClick={() => onSelectReply?.(idx)}
                      style={FILM_SHADOW}
                      className={`group flex cursor-pointer items-center gap-2 border-b-2 pb-0.5 text-[13px] leading-snug transition-all duration-150 hover:-translate-y-[1px] ${
                        asked
                          ? "border-transparent text-white/45 hover:border-white/50 hover:text-white/85"
                          : isChallenge
                            ? "border-amber-400/70 text-amber-100 hover:border-amber-300 hover:text-white"
                            : "border-white/30 text-white/95 hover:border-amber-300 hover:text-white"
                      }`}
                    >
                      <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] border border-white/25 bg-black/45 px-1 font-mono text-[10px] font-bold text-amber-300 group-hover:border-amber-300/75 group-hover:text-amber-200">
                        {idx + 1}
                      </kbd>
                      {!asked && (
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${toneDot} opacity-80`}
                        />
                      )}
                      <span className="font-medium">
                        {isVi ? reply.label.vi : reply.label.en}
                      </span>
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  onClick={() => onCloseDialogue?.()}
                  style={FILM_SHADOW}
                  className="group flex cursor-pointer items-center gap-2 border-b-2 border-amber-300 pb-0.5 text-[13px] font-semibold text-amber-200 transition hover:text-white"
                >
                  <kbd className="inline-flex h-[18px] items-center justify-center rounded-[3px] border border-amber-300/60 bg-black/45 px-1.5 font-mono text-[10px] font-bold text-amber-200">
                    E
                  </kbd>
                  <span>{isVi ? "Rời đi" : "Step away"}</span>
                </button>
              )}

              {!dialogue.closing && (
                <button
                  type="button"
                  onClick={() => onCloseDialogue?.()}
                  style={FILM_SHADOW}
                  className="flex cursor-pointer items-center gap-1.5 pb-0.5 text-[11px] tracking-wider text-white/55 uppercase transition hover:text-white/95"
                >
                  <kbd className="inline-flex h-[17px] items-center justify-center rounded-[3px] border border-white/20 bg-black/40 px-1 font-mono text-[9.5px] font-semibold text-white/70">
                    Esc
                  </kbd>
                  <span>{isVi ? "Rời đi" : "Leave"}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

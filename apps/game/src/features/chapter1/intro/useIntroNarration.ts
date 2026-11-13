// Voiced, line-by-line intro narration.
// One line is on screen at a time. Its voice clip plays and the text is revealed in step with the
// clip's playback position, so the typing speed matches the voice. Presentation only: it never
// touches the chapter store, and the full text of the current line is always returned for
// screen readers.

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";

export interface NarrationLine {
  text: string;
  /** Voice clip URL, or null for a line without a recording. */
  src: string | null;
}

export type AdvanceResult = "revealed" | "next" | "finished";

export interface IntroNarration {
  /** Index of the line on screen. */
  index: number;
  total: number;
  /** Full text of the current line. */
  text: string;
  /** The part of the current line revealed so far. */
  shown: string;
  /** Every character of the current line is visible. */
  lineDone: boolean;
  isLast: boolean;
  /**
   * First call on a line shows all of its text (the voice keeps playing). The next call cuts the
   * voice and moves to the next line; on the last line it reports "finished".
   */
  advance: () => AdvanceResult;
}

export interface IntroNarrationOptions {
  lines: readonly NarrationLine[];
  /** Typing and voice start when true (the scene is ready). */
  active: boolean;
  /** Voice gain 0..1 (0 when sound is off). The clip still drives the typing when silent. */
  gain: number;
  /** Test seam. Default: `new Audio(src)`. */
  createAudio?: (src: string) => HTMLAudioElement;
}

const TICK_MS = 30;
/** Fallback speed when a clip cannot play; close to the recorded voices (about 13 per second). */
const VOICE_FALLBACK_CPS = 14;
/** Speed for lines that have no recording. */
const TEXT_ONLY_CPS = 38;
/** How long to wait for a clip's duration before typing at the fallback speed. */
const METADATA_TIMEOUT_MS = 1500;

const defaultCreateAudio = (src: string): HTMLAudioElement => {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
};

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function useIntroNarration({ lines, active, gain, createAudio }: IntroNarrationOptions): IntroNarration {
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [revealedAll, setRevealedAll] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef(gain);
  gainRef.current = gain;
  const createAudioRef = useRef(createAudio ?? defaultCreateAudio);
  createAudioRef.current = createAudio ?? defaultCreateAudio;

  // A new script (for example after a language switch) starts again from the first line.
  const scriptKey = lines.map((line) => `${line.src ?? ""}|${line.text}`).join("\n");
  const [lastScriptKey, setLastScriptKey] = useState(scriptKey);
  if (lastScriptKey !== scriptKey) {
    setLastScriptKey(scriptKey);
    setIndex(0);
    setCount(0);
    setRevealedAll(false);
  }

  const safeIndex = Math.min(index, Math.max(0, lines.length - 1));
  const line = lines[safeIndex] ?? { text: "", src: null };
  const chars = Array.from(line.text);
  const total = chars.length;

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio === null) return;
    try {
      audio.pause();
    } catch {
      // Ignored: a clip that never started has nothing to stop.
    }
  }, []);

  // Voice and typing for the current line.
  useEffect(() => {
    if (!active || total === 0) return undefined;
    let disposed = false;
    let failed = line.src === null;
    let ended = false;
    let revealed = 0;
    const startedAt = performance.now();
    // Where fixed-speed typing starts: the time and the characters already visible.
    let fallbackFrom = startedAt;
    let fallbackBase = 0;
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      fallbackFrom = performance.now();
      fallbackBase = revealed;
    };

    if (line.src !== null) {
      try {
        const audio = createAudioRef.current(line.src);
        audio.volume = clamp01(gainRef.current);
        audio.addEventListener("ended", () => {
          ended = true;
        });
        audio.addEventListener("error", fail);
        audioRef.current = audio;
        const playing = audio.play();
        // Autoplay can be refused; the text is then typed at the fallback speed.
        if (playing && typeof playing.catch === "function") playing.catch(fail);
      } catch {
        failed = true;
      }
    }

    const cps = line.src === null ? TEXT_ONLY_CPS : VOICE_FALLBACK_CPS;
    // A slow clip only bridges the wait: typing starts at the fallback speed, and once the clip
    // reports its duration the text follows the voice again (it never moves backwards, so if the
    // fallback got ahead it holds until the voice catches up).
    let waitingSince: number | null = null;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const audio = audioRef.current;
      const hasDuration = audio !== null && Number.isFinite(audio.duration) && audio.duration > 0;
      let target = revealed;
      if (ended) {
        target = total;
      } else if (!failed && hasDuration && audio !== null) {
        waitingSince = null;
        target = Math.floor((audio.currentTime / audio.duration) * total);
      } else if (failed) {
        target = fallbackBase + Math.floor(((now - fallbackFrom) / 1000) * cps);
      } else if (now - startedAt > METADATA_TIMEOUT_MS) {
        if (waitingSince === null) {
          waitingSince = now;
          fallbackBase = revealed;
        }
        target = fallbackBase + Math.floor(((now - waitingSince) / 1000) * cps);
      }
      const next = Math.min(total, Math.max(revealed, target));
      if (next !== revealed) {
        revealed = next;
        setCount(next);
      }
      if (revealed >= total) window.clearInterval(timer);
    }, TICK_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      stopAudio();
    };
    // The line is identified by its index and the script; `gain` is applied separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, safeIndex, scriptKey, total, stopAudio]);

  // Volume changes apply to the clip that is playing.
  useEffect(() => {
    if (audioRef.current !== null) audioRef.current.volume = clamp01(gain);
  }, [gain]);

  const lineDone = active && (reducedMotion || revealedAll || count >= total);
  const isLast = safeIndex >= lines.length - 1;

  const advance = useCallback((): AdvanceResult => {
    if (!lineDone) {
      setRevealedAll(true);
      return "revealed";
    }
    stopAudio();
    if (!isLast) {
      setIndex(safeIndex + 1);
      setCount(0);
      setRevealedAll(false);
      return "next";
    }
    return "finished";
  }, [lineDone, isLast, safeIndex, stopAudio]);

  const revealedCount = reducedMotion || revealedAll ? total : count;
  return {
    index: safeIndex,
    total: lines.length,
    text: line.text,
    shown: chars.slice(0, revealedCount).join(""),
    lineDone,
    isLast,
    advance,
  };
}

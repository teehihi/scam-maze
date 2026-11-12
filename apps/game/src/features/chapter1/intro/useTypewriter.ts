// Typewriter reveal for the chapter intro text.
// Presentation only: the full text is always available to the caller (and to screen readers).

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";

export interface TypewriterState {
  /** The part of the text revealed so far. */
  shown: string;
  /** True once `active` and every character is revealed. */
  done: boolean;
  /** Reveals the rest of the text at once. */
  skip: () => void;
}

const TICK_MS = 30;

/**
 * Reveals `text` character by character while `active` is true. With "reduce motion" the whole
 * text shows at once. Changing `text` restarts the reveal.
 */
export function useTypewriter(text: string, active: boolean, charsPerSecond = 38): TypewriterState {
  const reducedMotion = useReducedMotion();
  // Code points, so a character is never cut in the middle of a surrogate pair.
  const [chars, setChars] = useState<string[]>(() => Array.from(text));
  const [count, setCount] = useState(0);
  const progressRef = useRef(0);

  // Restart when the text changes (for example after a language switch).
  const [lastText, setLastText] = useState(text);
  if (lastText !== text) {
    setLastText(text);
    setChars(Array.from(text));
    setCount(0);
    progressRef.current = 0;
  }

  const total = chars.length;

  useEffect(() => {
    if (!active || reducedMotion || count >= total) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      progressRef.current += ((now - last) / 1000) * charsPerSecond;
      last = now;
      const next = Math.min(total, Math.floor(progressRef.current));
      setCount(next);
      if (next >= total) window.clearInterval(id);
    }, TICK_MS);
    return () => window.clearInterval(id);
    // `count` is read only to stop early, so it is left out of the dependencies on purpose.
  }, [active, reducedMotion, total, charsPerSecond]);

  const skip = useCallback(() => {
    progressRef.current = total;
    setCount(total);
  }, [total]);

  const revealed = reducedMotion ? total : count;
  return {
    shown: chars.slice(0, revealed).join(""),
    done: active && revealed >= total,
    skip,
  };
}

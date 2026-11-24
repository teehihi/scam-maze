// Typing engine of the thesis Writing Mode: the single source of truth for what the player typed in
// a writing sprint. Pure TypeScript: no React, DOM, three, audio or i18n; time comes in as numbers.
//
// Rules: every typed character is kept and compared with the target at its position, so a wrong
// character stays visible and is fixed with Backspace (the sprint is never retyped from the start).
// The comparison ignores diacritics and quote/dash variants, so any keyboard layout or input method
// can type the text (a Vietnamese target can be typed with or without an IME). Relaxed typing types
// the next target character for any key. Speed is reported, never scored: the sprint is complete when
// every character matches, however fast it was typed. The engine never touches game state; the host
// commits a completed sprint through the existing reducer action.

/** A character the player typed, and whether it matches the target there. */
export interface TypedChar {
  char: string;
  correct: boolean;
}

export interface TypingSession {
  /** Target text as grapheme clusters (NFC), see `toChars`. */
  target: readonly string[];
  typed: readonly TypedChar[];
  /** Character keystrokes that added a character, right or wrong (Backspace does not count). */
  keystrokes: number;
  /** Of those, the ones that matched the target. */
  correctKeystrokes: number;
  /** Simulated typing time in ms: the gaps between keystrokes, each capped at `IDLE_CAP_MS`. */
  activeMs: number;
  /** Time of the last keystroke (host clock, ms), or null before the first one. */
  lastKeyAt: number | null;
  relaxed: boolean;
}

/** A pause longer than this counts as this much typing time (reading a notification, thinking). */
export const IDLE_CAP_MS = 2000;
/** Most characters accepted from one input event (an IME commit); more is treated as a paste. */
export const MAX_CHARS_PER_INPUT = 8;

const graphemes: Intl.Segmenter | null =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/**
 * The characters of a text as the reader sees them: NFC-normalised grapheme clusters, so a letter and
 * its diacritics ("ệ", or "e" with combining marks that have no precomposed form) are one character
 * that is typed, compared, highlighted and erased together. Without `Intl.Segmenter`, code points.
 */
export function toChars(text: string): string[] {
  const nfc = text.normalize("NFC");
  if (graphemes === null) return Array.from(nfc);
  return Array.from(graphemes.segment(nfc), (part) => part.segment);
}

/** Folds a character for comparison: no diacritics, one form of quotes, dashes and spaces. */
export function foldChar(char: string): string {
  const base = char.normalize("NFD").replace(/\p{M}/gu, "");
  if (base === "đ") return "d";
  if (base === "Đ") return "D";
  if (/[\u2018\u2019\u201A\u2032`]/u.test(base)) return "'";
  if (/[\u201C\u201D\u201E\u2033]/u.test(base)) return '"';
  if (/[\u2010-\u2015\u2212]/u.test(base)) return "-";
  if (/\s/u.test(base)) return " ";
  return base;
}

export function charsMatch(typed: string, target: string): boolean {
  return foldChar(typed) === foldChar(target);
}

export function createTypingSession(target: string, relaxed = false): TypingSession {
  return { target: toChars(target), typed: [], keystrokes: 0, correctKeystrokes: 0, activeMs: 0, lastKeyAt: null, relaxed };
}

/** Typing time added by a keystroke at `now`. */
function elapse(session: TypingSession, now: number): number {
  if (session.lastKeyAt === null || !Number.isFinite(now)) return 0;
  return Math.min(IDLE_CAP_MS, Math.max(0, now - session.lastKeyAt));
}

/**
 * Typed text from one input event (one key, or one IME commit). Characters past the target end are
 * dropped. Text longer than `MAX_CHARS_PER_INPUT` is rejected as a paste: the session is unchanged.
 */
export function typeText(session: TypingSession, text: string, now: number): TypingSession {
  const chars = toChars(text).filter((char) => char !== "\r" && char !== "\n");
  if (chars.length === 0 || chars.length > MAX_CHARS_PER_INPUT) return session;
  const room = session.target.length - session.typed.length;
  if (room <= 0 && !/^\p{M}+$/u.test(chars[0])) return session;
  const typed = [...session.typed];
  let correct = 0;
  // Some input methods send a diacritic on its own after the letter: it belongs to the last character.
  if (/^\p{M}+$/u.test(chars[0]) && typed.length > 0 && !session.relaxed) {
    const index = typed.length - 1;
    const char = (typed[index].char + chars.shift()).normalize("NFC");
    const entry = { char, correct: charsMatch(char, session.target[index]) };
    if (entry.correct && !typed[index].correct) correct += 1;
    typed[index] = entry;
    if (chars.length === 0) {
      return { ...session, typed, correctKeystrokes: session.correctKeystrokes + correct, activeMs: session.activeMs + elapse(session, now), lastKeyAt: now };
    }
  }
  for (const char of chars.slice(0, room)) {
    const want = session.target[typed.length];
    // Relaxed typing: the key types the next target character, so it is always right.
    const entry = session.relaxed ? { char: want, correct: true } : { char, correct: charsMatch(char, want) };
    if (entry.correct) correct += 1;
    typed.push(entry);
  }
  const added = typed.length - session.typed.length;
  return {
    ...session,
    typed,
    keystrokes: session.keystrokes + added,
    correctKeystrokes: session.correctKeystrokes + correct,
    activeMs: session.activeMs + elapse(session, now),
    lastKeyAt: now,
  };
}

/** Removes the last typed character (a whole grapheme cluster, never one diacritic of it). */
export function backspace(session: TypingSession, now: number): TypingSession {
  if (session.typed.length === 0) return session;
  return { ...session, typed: session.typed.slice(0, -1), activeMs: session.activeMs + elapse(session, now), lastKeyAt: now };
}

/** Starts the pause clock again, so time spent paused or away is not typing time. */
export function resumeTyping(session: TypingSession): TypingSession {
  return session.lastKeyAt === null ? session : { ...session, lastKeyAt: null };
}

export function setRelaxed(session: TypingSession, relaxed: boolean): TypingSession {
  return session.relaxed === relaxed ? session : { ...session, relaxed };
}

export interface TypingStats {
  /** Typed characters that match the target. */
  correctChars: number;
  /** Position of the caret (typed characters). */
  caret: number;
  /** Wrong characters still on the page. */
  errors: number;
  /** 0..100: share of character keystrokes that were right. 100 before the first key. */
  accuracy: number;
  /** Words per minute (5 matching characters per word) over the typing time; 0 before a second key. */
  wpm: number;
  /** 0..100: matching characters out of the target length. */
  progress: number;
  /** Every target character typed and matching (in relaxed typing: every character typed). */
  complete: boolean;
}

export function typingStats(session: TypingSession): TypingStats {
  const correctChars = session.typed.filter((entry) => entry.correct).length;
  const errors = session.typed.length - correctChars;
  const total = session.target.length;
  const minutes = session.activeMs / 60000;
  return {
    correctChars,
    caret: session.typed.length,
    errors,
    accuracy: session.keystrokes === 0 ? 100 : Math.round((session.correctKeystrokes / session.keystrokes) * 100),
    wpm: minutes > 0 ? Math.round(correctChars / 5 / minutes) : 0,
    progress: total === 0 ? 100 : Math.floor((correctChars / total) * 100),
    // Relaxed typing accepts the mistakes made before it was switched on, so it never needs Backspace.
    complete: total > 0 && session.typed.length === total && (errors === 0 || session.relaxed),
  };
}

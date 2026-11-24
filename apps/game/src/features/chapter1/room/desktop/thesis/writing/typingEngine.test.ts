import { describe, expect, it } from "vitest";
import {
  IDLE_CAP_MS,
  MAX_CHARS_PER_INPUT,
  backspace,
  charsMatch,
  createTypingSession,
  resumeTyping,
  setRelaxed,
  toChars,
  typeText,
  typingStats,
  type TypingSession,
} from "./typingEngine";

/** Types `text` one character per keystroke, `gapMs` apart, starting at `at`. */
function typeAll(session: TypingSession, text: string, at = 0, gapMs = 100): TypingSession {
  let s = session;
  Array.from(text).forEach((char, i) => {
    s = typeText(s, char, at + i * gapMs);
  });
  return s;
}

describe("typingEngine", () => {
  it("marks right and wrong characters and keeps the wrong ones visible", () => {
    const s = typeAll(createTypingSession("cat"), "cut");
    expect(s.typed.map((entry) => entry.correct)).toEqual([true, false, true]);
    const stats = typingStats(s);
    expect(stats.errors).toBe(1);
    expect(stats.complete).toBe(false);
    expect(stats.caret).toBe(3);
  });

  it("fixes a mistake with Backspace without retyping the sprint", () => {
    let s = typeAll(createTypingSession("cat"), "cu");
    s = backspace(s, 300);
    s = typeAll(s, "at", 400);
    expect(typingStats(s).complete).toBe(true);
    // Accuracy keeps the mistake: 3 of 4 character keystrokes were right.
    expect(typingStats(s).accuracy).toBe(75);
  });

  it("handles Space like any character and ignores line breaks", () => {
    let s = typeAll(createTypingSession("a b"), "a ");
    s = typeText(s, "\n", 300);
    expect(s.typed).toHaveLength(2);
    s = typeText(s, "b", 400);
    expect(typingStats(s).complete).toBe(true);
  });

  it("rejects pasted text and does not move past the end", () => {
    const s = createTypingSession("short text");
    const pasted = typeText(s, "x".repeat(MAX_CHARS_PER_INPUT + 1), 0);
    expect(pasted).toBe(s);
    const done = typeAll(s, "short text");
    expect(typeText(done, "z", 5000)).toBe(done);
  });

  it("accepts an IME commit of several characters as one input", () => {
    const s = typeText(createTypingSession("Việt"), "Việt", 0);
    expect(typingStats(s).complete).toBe(true);
  });

  it("compares without diacritics and quote or dash variants", () => {
    expect(charsMatch("a", "ă")).toBe(true);
    expect(charsMatch("d", "đ")).toBe(true);
    expect(charsMatch("'", "\u2019")).toBe(true);
    expect(charsMatch("-", "\u2014")).toBe(true);
    expect(charsMatch("A", "a")).toBe(false);
    const s = typeAll(createTypingSession("Khóa luận"), "Khoa luan");
    expect(typingStats(s).complete).toBe(true);
  });

  it("relaxed typing types the target for any key", () => {
    const s = typeAll(createTypingSession("ok", true), "zz");
    expect(s.typed.map((entry) => entry.char).join("")).toBe("ok");
    expect(typingStats(s).complete).toBe(true);
    expect(setRelaxed(s, true)).toBe(s);
  });

  it("relaxed typing completes a sprint that still has earlier mistakes", () => {
    const strict = typeAll(createTypingSession("abc"), "x");
    const relaxed = typeAll(setRelaxed(strict, true), "zz", 200);
    expect(typingStats(relaxed).errors).toBe(1);
    expect(typingStats(relaxed).complete).toBe(true);
    expect(typingStats(setRelaxed(relaxed, false)).complete).toBe(false);
  });

  it("measures words per minute over typing time, with long pauses capped", () => {
    // Ten characters, 120 ms apart: 1080 ms of typing for 2 words.
    const s = typeAll(createTypingSession("abcdefghij"), "abcdefghij", 0, 120);
    expect(typingStats(s).wpm).toBe(Math.round(2 / (1080 / 60000)));
    // A one-minute pause adds only IDLE_CAP_MS.
    const paused = typeText(typeAll(createTypingSession("abc"), "ab", 0, 100), "c", 60100);
    expect(paused.activeMs).toBe(100 + IDLE_CAP_MS);
    // After a resume, the pause adds nothing.
    const resumed = typeText(resumeTyping(typeAll(createTypingSession("abc"), "ab", 0, 100)), "c", 60100);
    expect(resumed.activeMs).toBe(100);
  });

  it("does not mutate the session", () => {
    const s = createTypingSession("ab");
    typeText(s, "a", 0);
    backspace(s, 0);
    expect(s.typed).toHaveLength(0);
    expect(s.keystrokes).toBe(0);
  });
});

describe("Vietnamese text (grapheme clusters)", () => {
  const SENTENCE = "Nghiên cứu này tìm hiểu cách sinh viên lên kế hoạch.";
  it("keeps each letter with its diacritics, whether the source is NFC or NFD", () => {
    expect(toChars("quốc tế")).toEqual(["q", "u", "ố", "c", " ", "t", "ế"]);
    expect(toChars("quốc tế".normalize("NFD"))).toEqual(toChars("quốc tế"));
    // A letter with two combining marks that has no precomposed form stays one character.
    expect(toChars("x\u0302\u0301y")).toHaveLength(2);
    expect(createTypingSession(SENTENCE.normalize("NFD")).target.join("")).toBe(SENTENCE);
  });
  it("accepts the sentence typed with or without accents", () => {
    const plain = "Nghien cuu nay tim hieu cach sinh vien len ke hoach.";
    const typedPlain = Array.from(plain).reduce((s, char, i) => typeText(s, char, i * 100), createTypingSession(SENTENCE));
    expect(typingStats(typedPlain)).toMatchObject({ complete: true, errors: 0 });
    const typedAccents = toChars(SENTENCE).reduce((s, char, i) => typeText(s, char, i * 100), createTypingSession(SENTENCE));
    expect(typingStats(typedAccents)).toMatchObject({ complete: true, errors: 0 });
  });
  it("erases a whole letter with Backspace, never one diacritic", () => {
    let s = typeText(typeText(createTypingSession("tế"), "t", 0), "ế", 10);
    s = backspace(s, 20);
    expect(s.typed.map((entry) => entry.char)).toEqual(["t"]);
  });
  it("joins a diacritic sent on its own to the letter before it", () => {
    let s = typeText(createTypingSession("tê"), "t", 0);
    s = typeText(s, "e", 10);
    s = typeText(s, "\u0302", 20);
    expect(s.typed.map((entry) => entry.char)).toEqual(["t", "ê"]);
    expect(typingStats(s)).toMatchObject({ complete: true, caret: 2 });
  });
  it("follows a Telex-style input method that erases and retypes the letter", () => {
    let s = createTypingSession("cố");
    for (const [step, text] of [["c"], ["o"], [null], ["ô"], [null], ["ố"]].entries()) {
      s = text[0] === null ? backspace(s, step * 10) : typeText(s, text[0], step * 10);
    }
    expect(typingStats(s)).toMatchObject({ complete: true, errors: 0 });
  });
});
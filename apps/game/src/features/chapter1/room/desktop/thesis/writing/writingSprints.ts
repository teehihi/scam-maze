// Writing sprints of the thesis Writing Mode: one short sentence each (8 to 15 words, one academic
// point, about 5 to 15 seconds of typing) of Alex's own thesis, in draft order. The text lives in the
// locale files (`laptop.thesisDesk.writing.sprints.<id>`). Pure: no React, no i18n, no game state.
import { createTypingSession, type TypingSession } from "./typingEngine";

export const SPRINT_IDS = ["intro", "question", "literature", "gap", "method", "sample", "findings", "feedback", "limits", "next"] as const;
export type SprintId = (typeof SPRINT_IDS)[number];
export const SECTION_IDS = ["intro", "literature", "method", "findings", "limits", "next"] as const;
export type SectionId = (typeof SECTION_IDS)[number];
/** The thesis section each sprint belongs to (`laptop.thesisDesk.writing.sections.<id>`). */
export const SPRINT_SECTION: Readonly<Record<SprintId, SectionId>> = {
  intro: "intro",
  question: "intro",
  literature: "literature",
  gap: "literature",
  method: "method",
  sample: "method",
  findings: "findings",
  feedback: "findings",
  limits: "limits",
  next: "next",
};

/**
 * The sprint to write after `completedSessions` accepted thesis work sessions. The count comes from
 * the saved event log, so Continue and a refresh return to the same sprint without new save data.
 */
export function sprintFor(completedSessions: number): { id: SprintId; index: number } {
  const n = Number.isFinite(completedSessions) && completedSessions > 0 ? Math.floor(completedSessions) : 0;
  const index = n % SPRINT_IDS.length;
  return { id: SPRINT_IDS[index], index };
}

/**
 * What the player has typed in the open sprint. Kept by the host for the page session, so closing the
 * laptop, switching apps or pausing does not lose it. `key` names the sprint and its text (language).
 */
export interface WritingDraft {
  key: string;
  session: TypingSession;
}

/** The draft for this sprint text: the kept one when it matches, otherwise a fresh session. */
export function draftFor(kept: WritingDraft | null, key: string, text: string, relaxed: boolean): WritingDraft {
  if (kept !== null && kept.key === key) return kept.session.relaxed === relaxed ? kept : { key, session: { ...kept.session, relaxed } };
  return { key, session: createTypingSession(text, relaxed) };
}

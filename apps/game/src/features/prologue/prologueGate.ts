import type { ChapterSession } from "../../game/chapters/chapterSession";

/**
 * A new game starts with the neighborhood prologue (explore, rain, walk home to the room).
 * Saved games skip it. `?skip-prologue` goes straight to the street chapter for QA and replays
 * of the existing chapter while the prologue is still being built out.
 */
export function shouldPlayPrologue(session: Pick<ChapterSession, "origin">, search: string): boolean {
  if (session.origin !== "new-game") return false;
  return !new URLSearchParams(search).has("skip-prologue");
}

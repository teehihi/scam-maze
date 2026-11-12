// Vietnamese Chapter 1 narrative overlay (game-i18n-en-vi, design section 1 "File-split rule").
// Each area part lives in its own file under `chapter1.vi/` so translations can be written in
// parallel. The parts use disjoint keys, so this plain spread has no collisions.

import type { NarrativeOverlay } from "../../game/narrative/localize";
import { CORE_VI } from "./chapter1.vi/core";
import { DECISIONS_VI } from "./chapter1.vi/decisions";
import { DIALOGUES_VI } from "./chapter1.vi/dialogues";
import { EVIDENCE_VI } from "./chapter1.vi/evidence";
import { PHONE_VI } from "./chapter1.vi/phone";
import { WORLD_VI } from "./chapter1.vi/world";

/** The overlay parts by area, for the disjoint-key test. */
export const CHAPTER_1_NARRATIVE_VI_PARTS = {
  core: CORE_VI,
  evidence: EVIDENCE_VI,
  world: WORLD_VI,
  dialogues: DIALOGUES_VI,
  phone: PHONE_VI,
  decisions: DECISIONS_VI,
} as const satisfies Record<string, NarrativeOverlay>;

export const CHAPTER_1_NARRATIVE_VI: NarrativeOverlay = {
  ...CORE_VI,
  ...EVIDENCE_VI,
  ...WORLD_VI,
  ...DIALOGUES_VI,
  ...PHONE_VI,
  ...DECISIONS_VI,
};

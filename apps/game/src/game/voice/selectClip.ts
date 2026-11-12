// Pure clip selection for the Chapter 1 voice layer. No React, no Three.js, no i18n and no audio
// API. Only types are imported from the narrative core.

import type { GameLocale } from "@scammaze/shared-types";

import type { DialogueGraphId } from "../narrative/chapter1/ids";
import type { VoiceClipEntry, VoiceManifest } from "./manifestTypes";

export type ClipChoice =
  | { kind: "clip"; entry: VoiceClipEntry; label: "none" | "english-voice" }
  | { kind: "none"; reason: "missing" };

function findPresent(
  manifest: VoiceManifest,
  graphId: DialogueGraphId,
  nodeId: string,
  locale: GameLocale,
): VoiceClipEntry | undefined {
  return manifest.clips.find(
    (clip) =>
      clip.status === "present" &&
      clip.locale === locale &&
      clip.nodeId === nodeId &&
      clip.graphId === graphId &&
      clip.sources.length > 0,
  );
}

/**
 * Chooses the clip for a node. Only `present` entries are returned. An entry of another locale is
 * returned only for a non-`en` locale, with the explicit `english-voice` label, when the setting
 * is on and the English entry is present. English audio is never presented as the player's language.
 */
export function selectClip(
  manifest: VoiceManifest,
  graphId: DialogueGraphId,
  nodeId: string,
  locale: GameLocale,
  englishVoiceFallback: boolean,
): ClipChoice {
  const own = findPresent(manifest, graphId, nodeId, locale);
  if (own) return { kind: "clip", entry: own, label: "none" };

  if (locale !== "en" && englishVoiceFallback) {
    const english = findPresent(manifest, graphId, nodeId, "en");
    if (english) return { kind: "clip", entry: english, label: "english-voice" };
  }

  return { kind: "none", reason: "missing" };
}

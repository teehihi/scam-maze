import type { GameLocale } from "@scammaze/shared-types";
import { describe, expect, it } from "vitest";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../test/chapterRuns";
import { createFakeAudioPort, createFakeClock, createFakePreviewPort } from "../../test/fakeAudioPort";
import type { FakeVoice } from "../../test/fakeAudioPort";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import { DIALOGUE_GRAPH_IDS, SPEAKER_IDS, TONE_IDS } from "../narrative/chapter1/ids";
import { pickPreviewVoice } from "./devSpeechPreview";
import type { VoiceClipEntry, VoiceManifest } from "./manifestTypes";
import { VOICE_MANIFEST_SCHEMA_VERSION } from "./manifestTypes";
import { createVoiceDialoguePlayer } from "./VoiceDialoguePlayer";
import type { VoiceSettings, VoiceTarget } from "./VoiceDialoguePlayer";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const SEED_P18_PICK = (CORE_PROPERTY_SEED ^ 0x18a11ce5) >>> 0;
const SEED_P18_PLAYER = (CORE_PROPERTY_SEED ^ 0x18b22df6) >>> 0;

const LOCALES: readonly GameLocale[] = ["en", "vi"];

/** Language tags for the pure picker: well-formed, odd casing and separators, and near misses. */
const PICKER_TAGS: readonly string[] = [
  "en",
  "en-US",
  "en-GB",
  "en_AU",
  "EN-us",
  "vi",
  "vi-VN",
  "vi_VN",
  "VI-vn",
  "fr-FR",
  "de-DE",
  "ja-JP",
  "zh-CN",
  "es-ES",
  "env",
  "english",
  "vie",
  "viet",
  "e",
  "v",
  "",
  "en-",
  "x-en",
];

/** Well-formed tags only, for the player test (the fake preview port matches by plain prefix). */
const PLAYER_TAGS: readonly string[] = ["en-US", "en-GB", "vi-VN", "fr-FR", "de-DE", "ja-JP", "es-ES"];

const GRAPH_ID = DIALOGUE_GRAPH_IDS[0];
const SPEAKER_ID = SPEAKER_IDS[0];
const TONE = TONE_IDS[0];
const NODE_ID = "n.preview";
const LINE_TEXT = "preview line";

function normalize(tag: string): string {
  return tag.replace(/_/g, "-").toLowerCase();
}

/** Independent statement of "has a language tag that starts with the locale tag". */
function matchesLocale(lang: string, locale: GameLocale): boolean {
  const l = normalize(lang);
  return l === locale || l.startsWith(`${locale}-`);
}

function randomVoices(next: () => number, tags: readonly string[]): FakeVoice[] {
  const count = randomInt(next, 0, 8);
  const voices: FakeVoice[] = [];
  for (let i = 0; i < count; i += 1) voices.push({ name: `voice-${i}`, lang: pick(next, tags) });
  return voices;
}

/** Runs one pure picker case. Returns the first violation or null. */
function runPickCase(voices: readonly FakeVoice[], locale: GameLocale): string | null {
  const chosen = pickPreviewVoice(voices, locale);
  const firstMatch = voices.find((v) => matchesLocale(v.lang, locale)) ?? null;
  if (chosen === null) {
    return firstMatch === null ? null : `no voice chosen although "${firstMatch.lang}" matches "${locale}"`;
  }
  if (!voices.includes(chosen)) return "the chosen voice is not in the installed list";
  if (!normalize(chosen.lang).startsWith(locale)) {
    return `chosen language "${chosen.lang}" does not start with "${locale}"`;
  }
  if (!matchesLocale(chosen.lang, locale)) return `chosen language "${chosen.lang}" is not a "${locale}" tag`;
  return chosen === firstMatch ? null : "the chosen voice is not the first matching voice";
}

// ---------------------------------------------------------------------------
// Player integration
// ---------------------------------------------------------------------------

interface PlayerCase {
  locale: GameLocale;
  devPreview: boolean;
  hasOwnClip: boolean;
  hasEnglishClip: boolean;
  englishVoiceFallback: boolean;
  voices: FakeVoice[];
}

function generatePlayerCase(seed: number): PlayerCase {
  const next = createLcg(seed);
  return {
    locale: pick(next, LOCALES),
    devPreview: next() < 0.7,
    hasOwnClip: next() < 0.3,
    hasEnglishClip: next() < 0.4,
    englishVoiceFallback: next() < 0.5,
    voices: randomVoices(next, PLAYER_TAGS),
  };
}

function entry(locale: GameLocale): VoiceClipEntry {
  return {
    clipId: `${locale}.${NODE_ID}`,
    nodeId: NODE_ID,
    graphId: GRAPH_ID,
    speakerId: SPEAKER_ID,
    locale,
    status: "present",
    sources: [{ src: `${CHAPTER1_VOICE_BASE}/${locale}/${NODE_ID}.mp3`, type: "audio/mpeg" }],
    durationMs: 1000,
    tone: TONE,
    voiceNote: "test",
    origin: "tts-generated",
    credit: "test",
    sourceTextHash: "00000000",
  };
}

function manifestFor(c: PlayerCase): VoiceManifest {
  const clips: VoiceClipEntry[] = [];
  if (c.hasOwnClip) clips.push(entry(c.locale));
  if (c.hasEnglishClip && c.locale !== "en") clips.push(entry("en"));
  return { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips };
}

const TARGET: VoiceTarget = {
  key: `${GRAPH_ID}:${NODE_ID}`,
  graphId: GRAPH_ID,
  nodeId: NODE_ID,
  speakerId: SPEAKER_ID,
  tone: TONE,
  channel: "phone",
  lineText: LINE_TEXT,
  pauseBeforeMs: 0,
};

async function flush(): Promise<void> {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

async function runPlayerCase(c: PlayerCase): Promise<string | null> {
  const clock = createFakeClock();
  const port = createFakeAudioPort({ clock });
  const preview = createFakePreviewPort(c.voices);
  const manifest = manifestFor(c);
  const clipsBefore = JSON.stringify(manifest);
  const player = createVoiceDialoguePlayer({
    manifest,
    port,
    preview,
    now: () => clock.now(),
    setTimer: (fn, ms) => clock.setTimer(fn, ms),
    clearTimer: (id) => clock.clearTimer(id),
    log: () => undefined,
  });
  const settings: VoiceSettings = {
    locale: c.locale,
    soundEnabled: true,
    masterVolume: 1,
    voiceVolume: 1,
    phoneFilter: true,
    englishVoiceFallback: c.englishVoiceFallback,
    devPreview: c.devPreview,
  };

  try {
    player.configure(settings);
    player.show(TARGET);
    port.completeLoad();
    clock.advance(0);
    await flush();

    const snap = player.getSnapshot();
    const clipAvailable = c.hasOwnClip || (c.locale !== "en" && c.englishVoiceFallback && c.hasEnglishClip);
    const matching = c.voices.find((v) => matchesLocale(v.lang, c.locale));

    // The preview never speaks with a voice of another language.
    for (const spoken of preview.spoken) {
      if (!matchesLocale(spoken.voice.lang, c.locale)) {
        return `spoke with "${spoken.voice.lang}" for locale "${c.locale}"`;
      }
      if (spoken.locale !== c.locale) return `spoke for locale "${spoken.locale}", expected "${c.locale}"`;
    }
    // The preview is never counted as a present clip: the manifest is untouched.
    if (JSON.stringify(manifest) !== clipsBefore) return "the manifest changed";
    if (snap.source === "dev-preview" && manifest.clips.some((e) => e.status === "present" && e.nodeId === NODE_ID && !clipAvailable && e.locale === c.locale)) {
      return "preview used although a present clip exists for the locale";
    }

    if (clipAvailable) {
      // The preview is only a stand-in when there is no clip.
      if (preview.spoken.length !== 0) return "the preview spoke although a clip is available";
      if (snap.source === "dev-preview" || snap.label === "dev-preview") return "dev-preview label on a clip";
      if (snap.source !== "clip") return `source ${snap.source}, expected clip`;
      const wantLabel = c.hasOwnClip ? "none" : "english-voice";
      if (snap.label !== wantLabel) return `label ${snap.label}, expected ${wantLabel}`;
      if (port.playbacks.length !== 1) return `${port.playbacks.length} clip playbacks, expected 1`;
      return null;
    }

    // No clip for this line.
    if (port.playbacks.length !== 0 || port.loadRequests.length !== 0) {
      return "clip audio was loaded or started although no clip is available";
    }
    if (!c.devPreview) {
      if (preview.spoken.length !== 0) return "the preview spoke with the developer preview off";
      if (snap.source !== "none" || snap.label !== "none") return `source ${snap.source} label ${snap.label} with preview off`;
      return snap.phase === "unavailable" ? null : `phase ${snap.phase}, expected unavailable`;
    }
    if (matching) {
      if (preview.spoken.length !== 1) return `${preview.spoken.length} utterances, expected 1`;
      if (snap.source !== "dev-preview" || snap.label !== "dev-preview") {
        return `source ${snap.source} label ${snap.label}, expected dev-preview`;
      }
      if (snap.phase !== "playing") return `phase ${snap.phase}, expected playing`;
      if (preview.spoken[0].text !== LINE_TEXT) return "the preview did not speak the line text";
      return null;
    }
    // No voice for the locale: nothing is spoken and the line is not labelled as preview audio.
    if (preview.spoken.length !== 0) return "the preview spoke although no voice matches the locale";
    if (snap.audible) return "audible although nothing was spoken";
    if (snap.source === "dev-preview" || snap.label === "dev-preview") return "dev-preview label although nothing was spoken";
    return snap.phase === "unavailable" ? null : `phase ${snap.phase}, expected unavailable`;
  } catch (error) {
    return `threw: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    player.dispose();
  }
}

describe("dev speech preview properties", () => {
  // Feature: chapter-01-voice-narrative, Property 18: The dev preview never speaks with the wrong language
  it(
    "picks a voice whose language starts with the locale tag, or none",
    () => {
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(SEED_P18_PICK, index);
        const next = createLcg(seed);
        const locale = pick(next, LOCALES);
        const voices = randomVoices(next, PICKER_TAGS);
        const violation = runPickCase(voices, locale);
        if (violation !== null) {
          // Shortest failing prefix of the voice list.
          let shortest = voices.length;
          for (let length = 0; length <= voices.length; length += 1) {
            if (runPickCase(voices.slice(0, length), locale) !== null) {
              shortest = length;
              break;
            }
          }
          expect.fail(
            `Property 18 (picker) failed. seed=${seed} case=${index} locale=${locale}\n` +
              `shortest failing prefix (${shortest} voices): ${JSON.stringify(voices.slice(0, shortest))}\n${violation}`,
          );
        }
      }
    },
    PROPERTY_TIMEOUT_MS,
  );

  // Feature: chapter-01-voice-narrative, Property 18: The dev preview never speaks with the wrong language
  it(
    "uses the preview only when no clip exists, labels it dev-preview and never counts it as present",
    async () => {
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(SEED_P18_PLAYER, index);
        const c = generatePlayerCase(seed);
        const violation = await runPlayerCase(c);
        if (violation !== null) {
          let shortest = c.voices.length;
          for (let length = 0; length <= c.voices.length; length += 1) {
            if ((await runPlayerCase({ ...c, voices: c.voices.slice(0, length) })) !== null) {
              shortest = length;
              break;
            }
          }
          expect.fail(
            `Property 18 (player) failed. seed=${seed} case=${index}\n` +
              `case: ${JSON.stringify({ ...c, voices: c.voices.slice(0, shortest) })}\n` +
              `shortest failing prefix (${shortest} voices)\n${violation}`,
          );
        }
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});

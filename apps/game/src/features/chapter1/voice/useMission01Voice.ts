// Plays Alex's story lines: Mission 01 and Mission 02 (`mission02AlexVoice.ts`) share this one queue,
// so two Alex lines never overlap. Presentation only: it reads the chapter state and never writes it.
//   - One line at a time. Lines that come while another plays wait in a queue and never overlap.
//   - A line is played once per run. The cues that already hold when the layer starts (a continued
//     save, a remount) are marked as played, so nothing is replayed after a load.
//   - While the game is held (pause menu, settings, hidden tab, a call) the line stops where it is
//     and continues from that point when the hold ends.
//   - The clip follows the game language (English or Vietnamese). Changing the language while a line
//     plays stops it; the lines that come next use the new language. Two voices never play together.
//   - A clip that is missing or cannot be decoded does not stop the game: the line is shown as a
//     caption for a few seconds instead (the caption comes from the chapter texts in the same language).
//   - It uses the chapter's Web Audio engine, so there is one AudioContext, and it plays nothing
//     while sound is off or the voice volume is zero.
import { useEffect, useRef, useState } from "react";
import type { GameLocale } from "@scammaze/shared-types";
import type { AudioPort, LoadedClip, PlaybackHandle } from "../../../game/voice/audioPort";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ScenarioDefinition } from "../../../game/narrative/types";
import type { ChapterState } from "../../../game/narrative/types";
import { mission01VoiceUrl, passedVoiceCues, reachedVoiceCues, type Mission01VoiceCue, type VoiceSurfaces } from "./mission01Voice";
import {
  isMission02AlexCue,
  mission02AlexVoiceUrl,
  MISSION02_ALEX_SUPERSEDES,
  passedMission02AlexCues,
  reachedMission02AlexCues,
  type Mission02AlexCue,
} from "./mission02AlexVoice";
import { MISSION01_SUBTITLE_TIMINGS } from "./mission01SubtitleTimings";

/** One of Alex's story lines: a Mission 01 cue or a Mission 02 cue. */
export type AlexVoiceCue = Mission01VoiceCue | Mission02AlexCue;

/** The clip of a line, or null when it has no recording yet (it is shown as a caption only). */
function alexVoiceUrl(cue: AlexVoiceCue, locale: GameLocale): string | null {
  return isMission02AlexCue(cue) ? mission02AlexVoiceUrl(cue, locale) : mission01VoiceUrl(cue, locale);
}

function reachedAlexCues(state: ChapterState, scenario: ScenarioDefinition, surfaces: VoiceSurfaces): AlexVoiceCue[] {
  return [...reachedVoiceCues(state, scenario, surfaces), ...reachedMission02AlexCues(state)];
}

function passedAlexCues(state: ChapterState, scenario: ScenarioDefinition): AlexVoiceCue[] {
  return [...passedVoiceCues(state, scenario), ...passedMission02AlexCues(state)];
}

export interface Mission01VoiceSettings {
  soundEnabled: boolean;
  voiceVolume: number;
}

/** How long a caption stays when its clip could not be played, in milliseconds. */
export const CAPTION_ONLY_MS = 6000;

/**
 * A line that waits in the queue longer than this is dropped: by then the player has moved on and
 * the line no longer fits what is on screen. Time with the game held does not count.
 */
export const QUEUE_TTL_MS = 30_000;

/** What a device app shows now: the app and the items in its list. */
export interface VoiceView {
  app: string;
  itemIds: readonly string[];
}

export interface UseMission01VoiceOptions {
  store: ChapterStore;
  scenario: ScenarioDefinition;
  /** The shared audio engine. Null until it exists (and in tests without one): nothing plays. */
  port: AudioPort | null;
  locale: GameLocale;
  settings: Mission01VoiceSettings;
  /** True while the pause menu or the settings are open. */
  held: boolean;
  /** True while the new-game intro is on screen. The intro line plays once for it. */
  introVisible: boolean;
  /** True while a call is ringing or active: the voice waits. */
  callOpen: boolean;
  /** The list a device app (phone or laptop) shows now, or null. The email and bank lines wait for it. */
  viewing: VoiceView | null;
}

export interface Mission01VoiceState {
  /** The line that is playing now, for its caption. */
  current: AlexVoiceCue | null;
  /** Where the clip of that line is now, in milliseconds. The subtitles follow it. */
  positionMs: () => number;
  /** Alex's opening line is playing (its clip, or its caption when the clip cannot load). The new-game intro waits for it (owner). */
  introSpeaking: boolean;
}

interface Playing {
  cue: AlexVoiceCue;
  handle: PlaybackHandle;
  token: number;
}

export function useMission01Voice(options: UseMission01VoiceOptions): Mission01VoiceState {
  const { store, scenario, port, locale, settings, held, introVisible, callOpen, viewing } = options;
  /** What the player has seen so far in this run (it stays true once it was seen). */
  const surfaces = useRef<VoiceSurfaces>({ mailListed: false, bankViewed: false });
  const viewingRef = useRef<VoiceView | null>(viewing);
  viewingRef.current = viewing;
  const [current, setCurrent] = useState<AlexVoiceCue | null>(null);

  const played = useRef(new Set<AlexVoiceCue>());
  const queue = useRef<Array<{ cue: AlexVoiceCue; at: number }>>([]);
  const wasAllowed = useRef(false);
  const playing = useRef<Playing | null>(null);
  /** A line that was cut by a hold, with the point to continue from. */
  const resumeAt = useRef<{ cue: AlexVoiceCue; offsetMs: number } | null>(null);
  const clips = useRef(new Map<string, Promise<LoadedClip>>());
  const token = useRef(0);
  const starting = useRef(false);
  const allowed = useRef(false);
  const pumpRef = useRef<() => void>(() => undefined);
  /** The one-shot gesture listeners that retry a start the browser refused. Removed when the layer goes away. */
  const retryRef = useRef<(() => void) | null>(null);
  const gone = useRef(false);
  const live = useRef({ port, locale, settings, scenario, store });
  live.current = { port, locale, settings, scenario, store };

  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  useEffect(() => {
    const onChange = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const soundOn = settings.soundEnabled && settings.voiceVolume > 0;
  allowed.current = port !== null && soundOn && !held && !hidden && !callOpen;

  const removeFromQueue = (cue: AlexVoiceCue) => {
    const index = queue.current.findIndex((entry) => entry.cue === cue);
    if (index >= 0) queue.current.splice(index, 1);
  };

  const stopPlaying = (keepPosition: boolean) => {
    const active = playing.current;
    if (!active) return;
    token.current += 1;
    if (keepPosition) resumeAt.current = { cue: active.cue, offsetMs: Math.max(0, active.handle.positionMs()) };
    playing.current = null;
    active.handle.stop();
    setCurrent(null);
  };

  const pump = () => {
    const { port: audio, settings: s } = live.current;
    if (gone.current || !allowed.current || audio === null || playing.current !== null || starting.current) return;
    // A line that waited too long has lost its moment.
    const now = performance.now();
    queue.current = queue.current.filter((entry) => now - entry.at <= QUEUE_TTL_MS);
    // A Mission 02 line whose moment no longer holds (Alex already arrived, the interview is done)
    // is dropped instead of being said late.
    const m02Now = reachedMission02AlexCues(live.current.store.getState());
    queue.current = queue.current.filter((entry) => !isMission02AlexCue(entry.cue) || m02Now.includes(entry.cue));
    const next = resumeAt.current ?? (queue.current.length > 0 ? { cue: queue.current[0].cue, offsetMs: 0 } : null);
    if (next === null) return;
    const myToken = ++token.current;
    const url = alexVoiceUrl(next.cue, live.current.locale);
    // A line without a recording yet (a placeholder) is a caption only: nothing is loaded.
    if (url === null) {
      showCaptionOnly(next.cue, myToken);
      return;
    }
    starting.current = true;
    const clip = clips.current.get(url) ?? audio.load(url);
    clips.current.set(url, clip);
    void Promise.all([clip, audio.resume()])
      .then(([loaded, state]) => {
        if (myToken === token.current) starting.current = false;
        if (myToken !== token.current || !allowed.current) {
          // Something changed while the clip loaded (a hold, a remount): look at the queue again.
          pumpRef.current();
          return;
        }
        if (state !== "running") {
          // The browser wants a gesture first; try again on the next one.
          if (retryRef.current !== null) return;
          const retry = () => {
            window.removeEventListener("pointerdown", retry);
            window.removeEventListener("keydown", retry);
            retryRef.current = null;
            pumpRef.current();
          };
          retryRef.current = retry;
          window.addEventListener("pointerdown", retry, { once: true });
          window.addEventListener("keydown", retry, { once: true });
          return;
        }
        if (resumeAt.current?.cue === next.cue) resumeAt.current = null;
        else removeFromQueue(next.cue);
        const handle = audio.start(loaded, {
          offsetMs: next.offsetMs,
          gain: s.voiceVolume,
          phoneFilter: false,
          onEnded: () => {
            if (playing.current?.token !== myToken) return;
            playing.current = null;
            setCurrent(null);
            pumpRef.current();
          },
        });
        playing.current = { cue: next.cue, handle, token: myToken };
        setCurrent(next.cue);
      })
      .catch(() => {
        // A clip that cannot load does not stop the game: the line shows as a caption for a few seconds.
        if (myToken === token.current) starting.current = false;
        clips.current.delete(url);
        if (myToken !== token.current) return;
        showCaptionOnly(next.cue, myToken);
      });
  };
  pumpRef.current = pump;

  /** Shows a line as a caption only (no clip, or a clip that could not load), on its own clock. */
  const showCaptionOnly = (cue: AlexVoiceCue, myToken: number) => {
    if (resumeAt.current?.cue === cue) resumeAt.current = null;
    else removeFromQueue(cue);
    // The caption lasts as long as the recording would have (its timings), at least a few seconds.
    const timings = MISSION01_SUBTITLE_TIMINGS[live.current.locale]?.[cue];
    const lasts = timings && timings.length > 0 ? timings[timings.length - 1][1] : 0;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      if (playing.current?.token !== myToken) return;
      playing.current = null;
      setCurrent(null);
      pumpRef.current();
    }, Math.max(CAPTION_ONLY_MS, lasts));
    const captionOnly: PlaybackHandle = {
      stop: () => window.clearTimeout(timer),
      setGain: () => undefined,
      positionMs: () => performance.now() - startedAt,
    };
    playing.current = { cue, handle: captionOnly, token: myToken };
    setCurrent(cue);
  };

  // Queues the lines whose moment has come and have not been played.
  const scan = () => {
    const state = store.getState();
    // What the lists on screen show right now.
    const view = viewingRef.current;
    if (view?.app === "mail" && view.itemIds.includes("mail.clearance") && Object.hasOwn(state.device.items, "mail.clearance")) {
      surfaces.current = { ...surfaces.current, mailListed: true };
    }
    if (view?.app === "bank" && Object.hasOwn(state.world.events, "m01.transfer-1")) {
      surfaces.current = { ...surfaces.current, bankViewed: true };
    }
    const reached = reachedAlexCues(state, scenario, surfaces.current);
    // Opening the email straight away comes first: "seeing it in the inbox" is not said after it.
    if (reached.includes("emailSuspicious") && !played.current.has("emailSuspicious")) {
      removeFromQueue("emailReceived");
      played.current.add("emailReceived");
      if (playing.current?.cue === "emailReceived") stopPlaying(false);
    }
    // Mission 02: a waiting line that a later moment made wrong is dropped (never cut while it plays).
    for (const cue of reached) {
      if (!isMission02AlexCue(cue) || played.current.has(cue)) continue;
      for (const stale of MISSION02_ALEX_SUPERSEDES[cue] ?? []) {
        removeFromQueue(stale);
        played.current.add(stale);
      }
    }
    for (const cue of reached) {
      if (played.current.has(cue)) continue;
      played.current.add(cue);
      queue.current.push({ cue, at: performance.now() });
    }
    pumpRef.current();
  };
  const scanRef = useRef(scan);
  scanRef.current = scan;

  // The cues that follow the player. What is already behind the player at the start (a continued
  // save) counts as played.
  useEffect(() => {
    played.current = new Set<AlexVoiceCue>(passedAlexCues(store.getState(), scenario));
    queue.current = [];
    let seenEvents = store.getState().events.length;
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      if (state.events.length < seenEvents) {
        // A restart shortened the log: start again from what holds now.
        played.current = new Set<AlexVoiceCue>(passedAlexCues(state, scenario));
        surfaces.current = { mailListed: false, bankViewed: false };
        queue.current = [];
        stopPlaying(false);
        resumeAt.current = null;
      }
      seenEvents = state.events.length;
      scanRef.current();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, scenario]);

  // The player looks at a list: an inbox or the bank app.
  useEffect(() => {
    scanRef.current();
  }, [viewing]);

  // The intro belongs to the new-game intro screen: once, in front of everything else.
  useEffect(() => {
    if (!introVisible || played.current.has("intro")) return;
    played.current.add("intro");
    queue.current.unshift({ cue: "intro", at: performance.now() });
    pumpRef.current();
  }, [introVisible, port]);

  // A language change: the line of the old language stops and is not continued in the new one.
  const lastLocale = useRef(locale);
  useEffect(() => {
    if (lastLocale.current === locale) return;
    lastLocale.current = locale;
    stopPlaying(false);
    // A clip of the old language that is still loading must not start either.
    token.current += 1;
    starting.current = false;
    resumeAt.current = null;
    pumpRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Hold and release, and the sound settings.
  useEffect(() => {
    if (!allowed.current) stopPlaying(true);
    else {
      // Time while the game was held does not count against a waiting line.
      if (!wasAllowed.current) queue.current.forEach((entry) => (entry.at = performance.now()));
      pumpRef.current();
    }
    wasAllowed.current = allowed.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, soundOn, held, hidden, callOpen, settings.voiceVolume]);

  // The engine is disposed with the layer; make sure no line outlives it.
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      token.current += 1;
      const active = playing.current;
      playing.current = null;
      active?.handle.stop();
      if (retryRef.current !== null) {
        window.removeEventListener("pointerdown", retryRef.current);
        window.removeEventListener("keydown", retryRef.current);
        retryRef.current = null;
      }
    };
  }, []);

  const positionMs = useRef(() => playing.current?.handle.positionMs() ?? 0).current;
  return { current, positionMs, introSpeaking: current === "intro" };
}

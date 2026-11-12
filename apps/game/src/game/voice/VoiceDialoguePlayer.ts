// Voice dialogue player for Chapter 1 (design.md section 4, requirements 5.1 to 5.13).
// Plain TypeScript: no React, no Three.js, no i18n and no DOM audio API. It talks to audio only
// through `AudioPort` and `PreviewPort`, and it never touches the narrative store. Playback end is
// a presentation signal only.

import type { GameLocale } from "@scammaze/shared-types";

import type { DialogueGraphId, SpeakerId, Tone } from "../narrative/chapter1/ids";
import type {
  AudioPort,
  LoadedClip,
  PlaybackHandle,
  PreviewPort,
  StopReason,
} from "./audioPort";
import type { VoiceManifest } from "./manifestTypes";
import { LATE_CLIP_MS, voiceGain } from "./mixPlan";
import type { GatePhase } from "./optionsGate";
import { selectClip } from "./selectClip";

/** Maximum number of decoded clips kept in the cache (least recently used is evicted). */
export const PREFETCH_CACHE_SIZE = 8;
/** Maximum number of prefetch loads in flight. */
export const PREFETCH_CONCURRENCY = 2;

export interface VoiceTarget {
  /** `${graphId}:${nodeId}` */
  key: string;
  graphId: DialogueGraphId;
  nodeId: string;
  speakerId: SpeakerId;
  tone: Tone;
  channel: "phone" | "face-to-face";
  /** Used only by the developer preview. */
  lineText: string;
  /** Already adjusted for reduced stress. */
  pauseBeforeMs: number;
}

export interface VoiceSettings {
  locale: GameLocale;
  soundEnabled: boolean;
  masterVolume: number;
  voiceVolume: number;
  phoneFilter: boolean;
  englishVoiceFallback: boolean;
  devPreview: boolean;
}

/** `GatePhase` values from `optionsGate.ts`, plus `paused`. */
export type VoicePhase = GatePhase | "paused";

export interface VoiceSnapshot {
  phase: VoicePhase;
  targetKey: string | null;
  source: "clip" | "dev-preview" | "none";
  label: "none" | "english-voice" | "dev-preview";
  reason:
    | "disabled"
    | "missing"
    | "no-matching-voice"
    | "autoplay-blocked"
    | "load-failed"
    | "late"
    | null;
  muted: boolean;
  /** True when something can be heard right now. */
  audible: boolean;
  durationMs: number | null;
  endedCount: number;
}

export interface VoiceDialoguePlayer {
  /** Call inside a user gesture. */
  unlock(): Promise<void>;
  configure(s: VoiceSettings): void;
  show(t: VoiceTarget): void;
  /** Replaying while muted unmutes first. */
  replay(): void;
  setMuted(m: boolean): void;
  pause(): void;
  resume(): void;
  /** Synchronous. */
  stop(reason: StopReason): void;
  prefetch(keys: ReadonlyArray<{ graphId: DialogueGraphId; nodeId: string }>): void;
  subscribe(l: () => void): () => void;
  getSnapshot(): VoiceSnapshot;
  dispose(): void;
}

export interface VoiceDialoguePlayerDeps {
  manifest: VoiceManifest;
  port: AudioPort;
  preview: PreviewPort | null;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
  log: (message: string) => void;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  locale: "en",
  soundEnabled: true,
  masterVolume: 1,
  voiceVolume: 1,
  phoneFilter: true,
  englishVoiceFallback: false,
  devPreview: false,
};

const IDLE_SNAPSHOT: VoiceSnapshot = {
  phase: "idle",
  targetKey: null,
  source: "none",
  label: "none",
  reason: null,
  muted: false,
  audible: false,
  durationMs: null,
  endedCount: 0,
};

/** One `show` or `replay`. Callbacks that belong to an older session are ignored. */
interface Session {
  id: number;
  target: VoiceTarget;
  url: string | null;
  loaded: LoadedClip | null;
  pauseDone: boolean;
  started: boolean;
}

export function createVoiceDialoguePlayer(deps: VoiceDialoguePlayerDeps): VoiceDialoguePlayer {
  const { manifest, port, preview, setTimer, clearTimer, log } = deps;

  let settings: VoiceSettings = DEFAULT_SETTINGS;
  let snapshot: VoiceSnapshot = IDLE_SNAPSHOT;
  let muted = false;
  let disposed = false;
  let playId = 0;
  let startToken = 0;
  let session: Session | null = null;
  let lastTarget: VoiceTarget | null = null;
  let handle: PlaybackHandle | null = null;
  let previewActive = false;
  let pausedOffsetMs = 0;
  let endedCount = 0;
  const timers = new Set<number>();
  const listeners = new Set<() => void>();

  // Cache and prefetch.
  const cache = new Map<string, LoadedClip>();
  const inflight = new Map<string, Promise<LoadedClip>>();
  const failedUrls = new Set<string>();
  const loggedFailures = new Set<string>();
  const prefetchQueue: string[] = [];
  let prefetchRunning = 0;

  function safe(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      logOnce("player:internal", error);
    }
  }

  function logOnce(key: string, error: unknown): void {
    if (loggedFailures.has(key)) return;
    loggedFailures.add(key);
    try {
      log(`Voice: ${key} failed${error instanceof Error ? ` (${error.message})` : ""}`);
    } catch {
      // The logger must never break playback.
    }
  }

  function currentGain(): number {
    return voiceGain(settings, muted);
  }

  /** Sound is off or the voice level is zero: nothing is fetched or started. */
  function isDisabled(): boolean {
    return voiceGain(settings, false) <= 0;
  }

  function update(patch: Partial<VoiceSnapshot>): void {
    if (disposed) return;
    const next: VoiceSnapshot = { ...snapshot, ...patch, muted, endedCount };
    const changed = (Object.keys(next) as Array<keyof VoiceSnapshot>).some(
      (k) => next[k] !== snapshot[k],
    );
    if (!changed) return;
    snapshot = next;
    for (const l of Array.from(listeners)) safe(l);
  }

  function setTimerSafe(fn: () => void, ms: number): number {
    const id = setTimer(() => {
      timers.delete(id);
      safe(fn);
    }, Math.max(0, ms));
    timers.add(id);
    return id;
  }

  function clearTimers(): void {
    for (const id of timers) {
      try {
        clearTimer(id);
      } catch {
        // ignore
      }
    }
    timers.clear();
  }

  /** Synchronously silences everything: source, gain, dev speech, timers. */
  function halt(): void {
    clearTimers();
    startToken += 1;
    const h = handle;
    handle = null;
    if (h) {
      try {
        h.setGain(0);
      } catch {
        // ignore
      }
      try {
        h.stop();
      } catch {
        // ignore
      }
    }
    if (previewActive && preview) {
      try {
        preview.stop();
      } catch {
        // ignore
      }
    }
    previewActive = false;
    pausedOffsetMs = 0;
  }

  // ---- loading and cache ----

  function touch(url: string, clip: LoadedClip): void {
    cache.delete(url);
    cache.set(url, clip);
    while (cache.size > PREFETCH_CACHE_SIZE) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  function getClip(url: string): Promise<LoadedClip> {
    const hit = cache.get(url);
    if (hit) {
      touch(url, hit);
      return Promise.resolve(hit);
    }
    const pending = inflight.get(url);
    if (pending) return pending;
    let promise: Promise<LoadedClip>;
    try {
      promise = port.load(url);
    } catch (error) {
      promise = Promise.reject(error);
    }
    const tracked = promise.then(
      (clip) => {
        inflight.delete(url);
        failedUrls.delete(url);
        touch(url, clip);
        return clip;
      },
      (error: unknown) => {
        inflight.delete(url);
        failedUrls.add(url);
        logOnce(url, error);
        throw error;
      },
    );
    inflight.set(url, tracked);
    // Avoid an unhandled rejection when nobody waits for this promise.
    tracked.catch(() => undefined);
    return tracked;
  }

  function urlFor(
    graphId: DialogueGraphId,
    nodeId: string,
  ): { url: string; label: "none" | "english-voice" } | null {
    const choice = selectClip(manifest, graphId, nodeId, settings.locale, settings.englishVoiceFallback);
    if (choice.kind !== "clip") return null;
    const src = choice.entry.sources[0]?.src;
    return src ? { url: src, label: choice.label } : null;
  }

  function pumpPrefetch(): void {
    while (!disposed && prefetchRunning < PREFETCH_CONCURRENCY && prefetchQueue.length > 0) {
      const url = prefetchQueue.shift();
      if (url === undefined) break;
      if (cache.has(url) || inflight.has(url) || failedUrls.has(url)) continue;
      prefetchRunning += 1;
      const done = (): void => {
        prefetchRunning -= 1;
        pumpPrefetch();
      };
      getClip(url).then(done, done);
    }
  }

  // ---- playback ----

  function onSourceEnded(id: number, token: number): void {
    if (disposed || id !== playId || token !== startToken) return;
    handle = null;
    previewActive = false;
    endedCount += 1;
    update({ phase: "ended", audible: false });
  }

  function startClip(s: Session, offsetMs: number): void {
    if (disposed || s.id !== playId || !s.loaded) return;
    const token = ++startToken;
    try {
      handle = port.start(s.loaded, {
        offsetMs,
        gain: currentGain(),
        phoneFilter: s.target.channel === "phone" && settings.phoneFilter,
        onEnded: () => onSourceEnded(s.id, token),
      });
    } catch (error) {
      handle = null;
      logOnce(s.url ?? s.target.key, error);
      update({ phase: "failed", reason: "load-failed", audible: false });
      return;
    }
    update({
      phase: "playing",
      reason: null,
      durationMs: s.loaded.durationMs,
      audible: currentGain() > 0,
    });
  }

  function tryStart(s: Session): void {
    if (disposed || s.id !== playId || s.started || !s.loaded || !s.pauseDone) return;
    s.started = true;
    let resumed: Promise<"running" | "suspended">;
    try {
      resumed = port.resume();
    } catch (error) {
      resumed = Promise.reject(error);
    }
    resumed.then(
      (state) => {
        if (disposed || s.id !== playId) return;
        if (state !== "running") {
          update({ phase: "blocked", reason: "autoplay-blocked", audible: false });
          return;
        }
        safe(() => startClip(s, 0));
      },
      (error: unknown) => {
        if (disposed || s.id !== playId) return;
        logOnce(s.url ?? s.target.key, error);
        update({ phase: "failed", reason: "load-failed", audible: false });
      },
    );
  }

  function startPreview(s: Session): void {
    if (disposed || s.id !== playId || !preview) return;
    const token = ++startToken;
    let spoke = false;
    try {
      spoke = preview.speak(s.target.lineText, settings.locale, {
        gain: currentGain(),
        onEnded: () => onSourceEnded(s.id, token),
      });
    } catch (error) {
      logOnce(`preview:${s.target.key}`, error);
    }
    if (!spoke) {
      update({ phase: "unavailable", reason: "no-matching-voice", source: "none", label: "none", audible: false });
      return;
    }
    previewActive = true;
    update({ phase: "playing", reason: null, audible: currentGain() > 0 });
  }

  /** Starts a fresh session for `target`. Callers have already incremented `playId` and halted. */
  function begin(target: VoiceTarget, pauseMs: number): void {
    lastTarget = target;
    const s: Session = { id: playId, target, url: null, loaded: null, pauseDone: false, started: false };
    session = s;
    const base: Partial<VoiceSnapshot> = {
      targetKey: target.key,
      source: "none",
      label: "none",
      reason: null,
      audible: false,
      durationMs: null,
    };

    if (isDisabled()) {
      update({ ...base, phase: "unavailable", reason: "disabled" });
      return;
    }

    const found = urlFor(target.graphId, target.nodeId);
    if (!found) {
      if (settings.devPreview && preview) {
        update({ ...base, phase: "loading", source: "dev-preview", label: "dev-preview" });
        setTimerSafe(() => startPreview(s), pauseMs);
        return;
      }
      update({ ...base, phase: "unavailable", reason: "missing" });
      return;
    }

    if (!port.supported) {
      logOnce("audio-unsupported", new Error("Audio is not supported"));
      update({ ...base, phase: "unavailable", reason: "load-failed" });
      return;
    }

    s.url = found.url;
    update({ ...base, phase: "loading", source: "clip", label: found.label });

    setTimerSafe(() => {
      s.pauseDone = true;
      tryStart(s);
    }, pauseMs);

    // A clip that is not decoded in time is skipped for this node; it keeps loading into the cache.
    setTimerSafe(() => {
      if (s.id !== playId || s.loaded || snapshot.phase !== "loading") return;
      update({ phase: "unavailable", reason: "late", audible: false });
    }, LATE_CLIP_MS);

    getClip(found.url).then(
      (clip) => {
        if (disposed || s.id !== playId) return;
        // Too late: the late timer already gave up on this node.
        if (snapshot.phase === "unavailable" && snapshot.reason === "late") return;
        s.loaded = clip;
        update({ durationMs: clip.durationMs });
        tryStart(s);
      },
      () => {
        if (disposed || s.id !== playId) return;
        update({ phase: "failed", reason: "load-failed", audible: false });
      },
    );
  }

  // ---- public API ----

  function applyGain(): void {
    const gain = currentGain();
    if (handle) {
      try {
        handle.setGain(gain);
      } catch {
        // ignore
      }
    }
    if (previewActive && preview) {
      try {
        preview.setGain(gain);
      } catch {
        // ignore
      }
    }
    if (snapshot.phase === "playing") update({ audible: gain > 0 });
  }

  return {
    async unlock() {
      if (disposed) return;
      try {
        await port.resume();
      } catch (error) {
        logOnce("unlock", error);
      }
    },

    configure(s) {
      if (disposed) return;
      const previous = settings;
      settings = s;
      const active = snapshot.phase !== "idle" && snapshot.targetKey !== null;
      if (active && previous.locale !== s.locale) {
        playId += 1;
        halt();
        session = null;
        update({ ...IDLE_SNAPSHOT });
        return;
      }
      if (active && isDisabled() && !(snapshot.phase === "unavailable" || snapshot.phase === "ended")) {
        playId += 1;
        halt();
        session = null;
        update({ phase: "unavailable", reason: "disabled", audible: false, source: "none", label: "none" });
        return;
      }
      applyGain();
    },

    show(t) {
      if (disposed) return;
      safe(() => {
        playId += 1;
        halt();
        session = null;
        begin(t, Math.max(0, Number.isFinite(t.pauseBeforeMs) ? t.pauseBeforeMs : 0));
      });
    },

    replay() {
      if (disposed || !lastTarget) return;
      const target = lastTarget;
      safe(() => {
        if (muted) muted = false;
        playId += 1;
        halt();
        session = null;
        begin(target, 0);
      });
    },

    setMuted(m) {
      if (disposed) return;
      muted = m;
      applyGain();
      update({});
    },

    pause() {
      if (disposed || snapshot.phase !== "playing") return;
      safe(() => {
        if (handle) {
          let pos = 0;
          try {
            pos = handle.positionMs();
          } catch {
            pos = 0;
          }
          pausedOffsetMs = Number.isFinite(pos) && pos > 0 ? pos : 0;
          startToken += 1; // the stopped source must not report an end
          const h = handle;
          handle = null;
          try {
            h.setGain(0);
            h.stop();
          } catch {
            // ignore
          }
        } else if (previewActive && preview) {
          try {
            preview.pause();
          } catch {
            // ignore
          }
        }
        update({ phase: "paused", audible: false });
      });
    },

    resume() {
      if (disposed || snapshot.phase !== "paused") return;
      safe(() => {
        if (previewActive && preview) {
          try {
            preview.resume();
          } catch {
            // ignore
          }
          update({ phase: "playing", audible: currentGain() > 0 });
          return;
        }
        const s = session;
        if (!s || s.id !== playId || !s.loaded) return;
        const duration = s.loaded.durationMs;
        const offset = Math.min(pausedOffsetMs, Math.max(0, duration));
        startClip(s, offset);
      });
    },

    stop(reason) {
      void reason;
      if (disposed) return;
      safe(() => {
        playId += 1;
        halt();
        session = null;
        // `lastTarget` is kept so Replay still works after a stop.
        update({ ...IDLE_SNAPSHOT });
      });
    },

    prefetch(keys) {
      if (disposed || isDisabled() || !port.supported) return;
      safe(() => {
        for (const key of keys) {
          const found = urlFor(key.graphId, key.nodeId);
          if (!found) continue;
          if (cache.has(found.url) || inflight.has(found.url) || failedUrls.has(found.url)) continue;
          if (!prefetchQueue.includes(found.url)) prefetchQueue.push(found.url);
        }
        pumpPrefetch();
      });
    },

    subscribe(l) {
      if (disposed) return () => undefined;
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },

    getSnapshot() {
      return snapshot;
    },

    dispose() {
      if (disposed) return;
      playId += 1;
      halt();
      session = null;
      lastTarget = null;
      disposed = true;
      listeners.clear();
      prefetchQueue.length = 0;
      cache.clear();
      inflight.clear();
      try {
        preview?.dispose();
      } catch {
        // ignore
      }
      try {
        port.dispose();
      } catch {
        // ignore
      }
    },
  };
}

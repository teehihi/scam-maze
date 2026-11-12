// Test double for the Chapter 1 voice player: a fake AudioPort, a fake PreviewPort, a fake clock and
// fake timers. Everything is under manual control. No network, no real audio, no speechSynthesis.

import type { GameLocale } from "@scammaze/shared-types";
import type {
  AudioPort,
  LoadedClip,
  PlaybackHandle,
  PreviewPort,
} from "../game/voice/audioPort";

export interface FakePlayback {
  readonly id: string;
  readonly clip: LoadedClip;
  readonly startedAt: number;
  readonly offsetMs: number;
  readonly phoneFilter: boolean;
  gain: number;
  live: boolean;
  stopCount: number;
  stoppedAt: number | null;
  readonly onEnded: () => void;
}

export interface FakeClock {
  now(): number;
  advance(ms: number): void;
  setTimer(fn: () => void, ms: number): number;
  clearTimer(id: number): void;
  readonly pendingTimers: number;
  /** Count of setTimer calls and of clearTimer calls that removed a pending timer. */
  readonly scheduledCount: number;
  readonly clearedCount: number;
}

export function createFakeClock(startMs = 0): FakeClock {
  let current = startMs;
  let nextId = 1;
  let scheduled = 0;
  let cleared = 0;
  const timers = new Map<number, { at: number; seq: number; fn: () => void }>();
  let seq = 0;
  return {
    now: () => current,
    setTimer(fn, ms) {
      const id = nextId++;
      scheduled += 1;
      timers.set(id, { at: current + Math.max(0, ms), seq: seq++, fn });
      return id;
    },
    clearTimer(id) {
      if (timers.delete(id)) cleared += 1;
    },
    advance(ms) {
      const target = current + Math.max(0, ms);
      for (;;) {
        let nextKey: number | null = null;
        let next: { at: number; seq: number; fn: () => void } | null = null;
        for (const [key, t] of timers) {
          if (t.at > target) continue;
          if (next === null || t.at < next.at || (t.at === next.at && t.seq < next.seq)) {
            next = t;
            nextKey = key;
          }
        }
        if (next === null || nextKey === null) break;
        timers.delete(nextKey);
        current = Math.max(current, next.at);
        next.fn();
      }
      current = target;
    },
    get pendingTimers() {
      return timers.size;
    },
    get scheduledCount() {
      return scheduled;
    },
    get clearedCount() {
      return cleared;
    },
  };
}

interface PendingLoad {
  readonly url: string;
  resolve(clip: LoadedClip): void;
  reject(error: Error): void;
}

export interface FakeAudioPortOptions {
  supported?: boolean;
  /** When true, `load` settles on a microtask instead of waiting for `completeLoad`. */
  autoLoad?: boolean;
  defaultDurationMs?: number;
  /** Initial result of `resume()`. */
  resumeResult?: "running" | "suspended";
  clock?: FakeClock;
}

export interface FakeAudioPort extends AudioPort {
  readonly clock: FakeClock;
  readonly playbacks: ReadonlyArray<FakePlayback>;
  readonly loadRequests: ReadonlyArray<string>;
  readonly pendingLoads: ReadonlyArray<string>;
  readonly resumeCalls: number;
  readonly disposed: boolean;
  /** Live (started, not stopped, not ended) handles. */
  readonly liveHandles: number;
  /** Highest number of live handles seen at any moment (the no-overlap property wants this to be <= 1). */
  readonly maxConcurrentPlaybacks: number;
  /** Chronological record of concurrency after every start/stop/end. */
  readonly concurrencyLog: ReadonlyArray<number>;
  /** Timers pending on the fake clock and onEnded listeners still attached to live handles. */
  readonly timers: number;
  readonly listeners: number;
  setDuration(url: string, durationMs: number): void;
  /** Resolve the oldest pending load (or the oldest for `url`). Returns false if none was pending. */
  completeLoad(url?: string): boolean;
  /** Reject pending loads for `url` and every future load of `url`. */
  failLoad(url: string): void;
  /** Make `resume()` resolve "suspended" until `allowResume()`. */
  refuseResume(): void;
  allowResume(): void;
  /** Natural end of a playback: marks it not live and calls its onEnded. No-op if already stopped. */
  fireEnded(id: string): void;
  /** The most recently started playback, or undefined. */
  last(): FakePlayback | undefined;
  setSupported(v: boolean): void;
}

export function createFakeAudioPort(options: FakeAudioPortOptions = {}): FakeAudioPort {
  const clock = options.clock ?? createFakeClock();
  const durations = new Map<string, number>();
  const failing = new Set<string>();
  const pending: PendingLoad[] = [];
  const loadRequests: string[] = [];
  const playbacks: FakePlayback[] = [];
  const concurrencyLog: number[] = [];
  let supported = options.supported ?? true;
  let refusing = options.resumeResult === "suspended";
  let resumeCalls = 0;
  let disposed = false;
  let maxConcurrent = 0;
  let nextPlayback = 1;

  const live = (): number => playbacks.filter((p) => p.live).length;
  const record = (): void => {
    const n = live();
    concurrencyLog.push(n);
    if (n > maxConcurrent) maxConcurrent = n;
  };
  const clipFor = (url: string): LoadedClip => ({
    id: url,
    durationMs: durations.get(url) ?? options.defaultDurationMs ?? 1000,
  });

  const port: FakeAudioPort = {
    clock,
    get supported() {
      return supported;
    },
    get playbacks() {
      return playbacks;
    },
    get loadRequests() {
      return loadRequests;
    },
    get pendingLoads() {
      return pending.map((p) => p.url);
    },
    get resumeCalls() {
      return resumeCalls;
    },
    get disposed() {
      return disposed;
    },
    get liveHandles() {
      return live();
    },
    get maxConcurrentPlaybacks() {
      return maxConcurrent;
    },
    get concurrencyLog() {
      return concurrencyLog;
    },
    get timers() {
      return clock.pendingTimers;
    },
    get listeners() {
      return playbacks.filter((p) => p.live).length;
    },
    resume() {
      resumeCalls += 1;
      return Promise.resolve(refusing ? "suspended" : "running");
    },
    load(url) {
      loadRequests.push(url);
      if (failing.has(url)) return Promise.reject(new Error(`fake load failed: ${url}`));
      return new Promise<LoadedClip>((resolve, reject) => {
        const entry: PendingLoad = { url, resolve, reject };
        if (options.autoLoad) {
          queueMicrotask(() => resolve(clipFor(url)));
          return;
        }
        pending.push(entry);
      });
    },
    start(clip, o) {
      const id = `pb-${nextPlayback++}`;
      const pb: FakePlayback = {
        id,
        clip,
        startedAt: clock.now(),
        offsetMs: o.offsetMs,
        phoneFilter: o.phoneFilter,
        gain: o.gain,
        live: true,
        stopCount: 0,
        stoppedAt: null,
        onEnded: o.onEnded,
      };
      playbacks.push(pb);
      record();
      const handle: PlaybackHandle = {
        stop() {
          pb.stopCount += 1;
          if (!pb.live) return;
          pb.live = false;
          pb.stoppedAt = clock.now();
          record();
        },
        setGain(v) {
          pb.gain = v;
        },
        positionMs() {
          const end = pb.stoppedAt ?? clock.now();
          return Math.min(clip.durationMs, pb.offsetMs + Math.max(0, end - pb.startedAt));
        },
      };
      return handle;
    },
    dispose() {
      disposed = true;
      for (const p of playbacks) {
        if (p.live) {
          p.live = false;
          p.stoppedAt = clock.now();
        }
      }
      record();
    },
    setDuration(url, durationMs) {
      durations.set(url, durationMs);
    },
    completeLoad(url) {
      const i = url === undefined ? 0 : pending.findIndex((p) => p.url === url);
      if (i < 0 || i >= pending.length) return false;
      const [entry] = pending.splice(i, 1);
      entry.resolve(clipFor(entry.url));
      return true;
    },
    failLoad(url) {
      failing.add(url);
      for (let i = pending.length - 1; i >= 0; i -= 1) {
        if (pending[i].url === url) {
          const [entry] = pending.splice(i, 1);
          entry.reject(new Error(`fake load failed: ${url}`));
        }
      }
    },
    refuseResume() {
      refusing = true;
    },
    allowResume() {
      refusing = false;
    },
    fireEnded(id) {
      const pb = playbacks.find((p) => p.id === id);
      if (!pb || !pb.live) return;
      pb.live = false;
      pb.stoppedAt = clock.now();
      record();
      pb.onEnded();
    },
    last() {
      return playbacks[playbacks.length - 1];
    },
    setSupported(v) {
      supported = v;
    },
  };
  return port;
}

export interface FakeVoice {
  readonly name: string;
  readonly lang: string;
}

export interface FakeSpeech {
  readonly text: string;
  readonly locale: GameLocale;
  readonly voice: FakeVoice;
  gain: number;
  live: boolean;
  paused: boolean;
  readonly onEnded: () => void;
}

export interface FakePreviewPort extends PreviewPort {
  /** The fake `speechSynthesis` voice list. Matching uses `lang` starting with the locale tag. */
  voices: FakeVoice[];
  readonly spoken: ReadonlyArray<FakeSpeech>;
  readonly silentRequests: number;
  readonly liveUtterances: number;
  readonly disposed: boolean;
  /** Natural end of the current utterance. */
  fireEnded(): void;
}

export function createFakePreviewPort(
  voices: FakeVoice[] = [{ name: "Fake English", lang: "en-US" }],
): FakePreviewPort {
  const spoken: FakeSpeech[] = [];
  let silent = 0;
  let disposed = false;
  let gain = 1;
  const current = (): FakeSpeech | undefined => {
    const s = spoken[spoken.length - 1];
    return s && s.live ? s : undefined;
  };
  const port: FakePreviewPort = {
    voices,
    get spoken() {
      return spoken;
    },
    get silentRequests() {
      return silent;
    },
    get liveUtterances() {
      return spoken.filter((s) => s.live).length;
    },
    get disposed() {
      return disposed;
    },
    speak(text, locale, o) {
      const voice = port.voices.find((v) => v.lang.toLowerCase().startsWith(locale.toLowerCase()));
      if (disposed || !voice) {
        silent += 1;
        return false;
      }
      const prev = current();
      if (prev) prev.live = false;
      gain = o.gain;
      spoken.push({ text, locale, voice, gain, live: true, paused: false, onEnded: o.onEnded });
      return true;
    },
    setGain(v) {
      gain = v;
      const s = current();
      if (s) s.gain = v;
    },
    pause() {
      const s = current();
      if (s) s.paused = true;
    },
    resume() {
      const s = current();
      if (s) s.paused = false;
    },
    stop() {
      const s = current();
      if (s) s.live = false;
    },
    dispose() {
      port.stop();
      disposed = true;
    },
    fireEnded() {
      const s = current();
      if (!s) return;
      s.live = false;
      s.onEnded();
    },
  };
  void gain;
  return port;
}

// Web Audio implementation of `AudioPort` for the Chapter 1 voice layer, plus procedural ringtone,
// connect click, street ambience and tension drone. No React, no Three.js, no i18n, and no new
// audio files: every sound except the voice clips is generated here. Gains come from `mixPlan.ts`.
//
// Graph (design.md "Web Audio graph"):
//   clip -> [highpass -> lowpass] -> playback gain -> voice bus -> master -> limiter -> destination
//   ringtone / click / ambience / tension -> own gain (capped by PEAK_CAP) -> master
//
// Clips are fetched only from the same origin as the page. Nothing here changes game state.

import type { AudioPort, LoadedClip, PlaybackHandle } from "./audioPort";
import {
  PEAK_CAP,
  PHONE_FILTER,
  TENSION_FADE_SECONDS,
  ambienceGain,
  ringtoneGain,
  tensionGain,
} from "./mixPlan";

type ContextCtor = new () => AudioContext;

function findContextCtor(): ContextCtor | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as unknown as {
    AudioContext?: ContextCtor;
    webkitAudioContext?: ContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function clampGain(v: number, max: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > max ? max : v;
}

function clamp01(v: number): number {
  return clampGain(v, 1);
}

/** True only for an http(s) URL on the same origin as the page, or a relative URL. */
function isSameOriginUrl(url: string): boolean {
  try {
    const base = typeof location !== "undefined" ? location.href : "http://localhost/";
    const parsed = new URL(url, base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const origin = typeof location !== "undefined" ? location.origin : parsed.origin;
    return parsed.origin === origin;
  } catch {
    return false;
  }
}

/** Move an AudioParam to a target value over `seconds` without a click. */
function rampTo(ctx: AudioContext, param: AudioParam, target: number, seconds: number): void {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  if (seconds <= 0) param.setValueAtTime(target, now);
  else param.linearRampToValueAtTime(target, now + seconds);
}

export interface WebAudioEngine extends AudioPort {
  /** Master gain: the sfx volume, 0 when sound is off. */
  setMasterGain(v: number): void;
  startRingtone(reducedStress: boolean): void;
  stopRingtone(): void;
  /** Short noise burst when a call connects. */
  playConnectClick(): void;
  startAmbience(inCall: boolean): void;
  setAmbienceInCall(inCall: boolean): void;
  stopAmbience(): void;
  /** Tension drone for a pressure level 0 to 3. Level 0 fades it out. */
  setTension(pressureLevel: number, reducedStress: boolean): void;
}

const RING_CYCLE_S = 3;
const RING_CYCLES = 20;

export function createWebAudioEngine(): WebAudioEngine {
  const Ctor = findContextCtor();
  const supported = Ctor !== null;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let voiceBus: GainNode | null = null;
  let masterValue = 1;
  let disposed = false;

  const activeHandles = new Set<PlaybackHandle>();
  let noiseBuffer: AudioBuffer | null = null;

  let ring: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  let ambience: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null =
    null;
  let tension: { osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  let clickTimerNodes: AudioNode[] = [];

  function ensureContext(): AudioContext | null {
    if (disposed || !Ctor) return null;
    if (ctx) return ctx;
    try {
      const c = new Ctor();
      const m = c.createGain();
      m.gain.value = masterValue;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      m.connect(limiter);
      limiter.connect(c.destination);
      const vb = c.createGain();
      vb.gain.value = 1;
      vb.connect(m);
      ctx = c;
      master = m;
      voiceBus = vb;
      return c;
    } catch {
      return null;
    }
  }

  function getNoise(c: AudioContext): AudioBuffer {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.max(1, Math.floor(c.sampleRate * 2));
    const buf = c.createBuffer(1, length, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  }

  function safeDisconnect(n: AudioNode | null | undefined): void {
    try {
      n?.disconnect();
    } catch {
      /* already disconnected */
    }
  }

  function safeStop(n: AudioScheduledSourceNode | null | undefined): void {
    try {
      n?.stop();
    } catch {
      /* not started or already stopped */
    }
  }

  const decoded = new Map<string, AudioBuffer>();

  async function resume(): Promise<"running" | "suspended"> {
    const c = ensureContext();
    if (!c) return "suspended";
    if (c.state === "running") return "running";
    try {
      await c.resume();
    } catch {
      return "suspended";
    }
    return (c.state as string) === "running" ? "running" : "suspended";
  }

  async function load(url: string): Promise<LoadedClip> {
    if (!isSameOriginUrl(url)) throw new Error("Clip URL is not same-origin.");
    const c = ensureContext();
    if (!c) throw new Error("Web Audio is not supported.");
    const cached = decoded.get(url);
    if (cached) return { id: url, durationMs: cached.duration * 1000 };
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Clip request failed with status ${res.status}.`);
    const bytes = await res.arrayBuffer();
    const buffer = await c.decodeAudioData(bytes);
    if (disposed) throw new Error("Engine disposed.");
    decoded.set(url, buffer);
    return { id: url, durationMs: buffer.duration * 1000 };
  }

  function start(
    clip: LoadedClip,
    o: { offsetMs: number; gain: number; phoneFilter: boolean; onEnded: () => void },
  ): PlaybackHandle {
    const c = ctx;
    const buffer = decoded.get(clip.id);
    const noop: PlaybackHandle = { stop() {}, setGain() {}, positionMs: () => 0 };
    if (disposed || !c || !voiceBus || !buffer) return noop;

    const src = c.createBufferSource();
    src.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = clamp01(o.gain);

    const nodes: AudioNode[] = [src, gain];
    let tail: AudioNode = src;
    if (o.phoneFilter) {
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = PHONE_FILTER.highPassHz;
      hp.Q.value = PHONE_FILTER.q;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = PHONE_FILTER.lowPassHz;
      lp.Q.value = PHONE_FILTER.q;
      tail.connect(hp);
      hp.connect(lp);
      tail = lp;
      nodes.push(hp, lp);
    }
    tail.connect(gain);
    gain.connect(voiceBus);

    const offsetS = Math.min(Math.max(0, o.offsetMs) / 1000, Math.max(0, buffer.duration));
    const startedAt = c.currentTime;
    let finished = false;

    const cleanup = (): void => {
      finished = true;
      src.onended = null;
      for (const n of nodes) safeDisconnect(n);
      activeHandles.delete(handle);
    };

    const handle: PlaybackHandle = {
      stop() {
        if (finished) return;
        try {
          gain.gain.cancelScheduledValues(c.currentTime);
          gain.gain.value = 0;
        } catch {
          /* ignore */
        }
        safeStop(src);
        cleanup();
      },
      setGain(v: number) {
        if (finished) return;
        gain.gain.value = clamp01(v);
      },
      positionMs() {
        if (finished) return Math.round(buffer.duration * 1000);
        const ms = (offsetS + (c.currentTime - startedAt)) * 1000;
        return Math.max(0, Math.min(ms, buffer.duration * 1000));
      },
    };

    src.onended = () => {
      if (finished) return;
      cleanup();
      try {
        o.onEnded();
      } catch {
        /* the player never lets a callback break the engine */
      }
    };

    activeHandles.add(handle);
    try {
      src.start(0, offsetS);
    } catch {
      cleanup();
      return noop;
    }
    return handle;
  }

  function setMasterGain(v: number): void {
    masterValue = clamp01(v);
    if (ctx && master) rampTo(ctx, master.gain, masterValue, 0.02);
  }

  function stopRingtone(): void {
    const r = ring;
    ring = null;
    const c = ctx;
    if (!r || !c) return;
    try {
      r.gain.gain.cancelScheduledValues(c.currentTime);
      r.gain.gain.value = 0;
    } catch {
      /* ignore */
    }
    for (const o of r.oscs) {
      safeStop(o);
      safeDisconnect(o);
    }
    safeDisconnect(r.gain);
  }

  function startRingtone(reducedStress: boolean): void {
    const c = ensureContext();
    if (!c || !master) return;
    stopRingtone();
    const peak = clampGain(ringtoneGain(reducedStress), PEAK_CAP);
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(master);
    const oscs = [440, 480].map((f) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(g);
      return o;
    });
    // Two bursts per cycle, then silence. Gentle 20 ms edges so there is no click.
    const t0 = c.currentTime + 0.05;
    const edge = 0.02;
    for (let i = 0; i < RING_CYCLES; i += 1) {
      const base = t0 + i * RING_CYCLE_S;
      for (const offset of [0, 0.6]) {
        const s = base + offset;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(peak, s + edge);
        g.gain.setValueAtTime(peak, s + 0.4 - edge);
        g.gain.linearRampToValueAtTime(0, s + 0.4);
      }
    }
    const end = t0 + RING_CYCLES * RING_CYCLE_S;
    for (const o of oscs) {
      o.start(t0);
      o.stop(end);
    }
    ring = { oscs, gain: g };
  }

  function playConnectClick(): void {
    const c = ensureContext();
    if (!c || !master) return;
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 1;
    const g = c.createGain();
    const peak = clampGain(PEAK_CAP, PEAK_CAP);
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    const nodes: AudioNode[] = [src, filter, g];
    clickTimerNodes.push(...nodes);
    src.onended = () => {
      for (const n of nodes) safeDisconnect(n);
      clickTimerNodes = clickTimerNodes.filter((n) => !nodes.includes(n));
    };
    src.start(t, 0, 0.06);
  }

  function stopAmbience(): void {
    const a = ambience;
    ambience = null;
    if (!a) return;
    safeStop(a.src);
    safeDisconnect(a.src);
    safeDisconnect(a.filter);
    safeDisconnect(a.gain);
  }

  function startAmbience(inCall: boolean): void {
    const c = ensureContext();
    if (!c || !master) return;
    if (ambience) {
      setAmbienceInCall(inCall);
      return;
    }
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.707;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    ambience = { src, filter, gain: g };
    rampTo(c, g.gain, clampGain(ambienceGain(inCall), PEAK_CAP), 1);
  }

  function setAmbienceInCall(inCall: boolean): void {
    if (!ctx || !ambience) return;
    rampTo(ctx, ambience.gain.gain, clampGain(ambienceGain(inCall), PEAK_CAP), 0.5);
  }

  function setTension(pressureLevel: number, reducedStress: boolean): void {
    const target = clampGain(tensionGain(pressureLevel, reducedStress), PEAK_CAP);
    if (!tension && target === 0) return;
    const c = ensureContext();
    if (!c || !master) return;
    if (!tension) {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 55;
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 200;
      filter.Q.value = 0.707;
      const g = c.createGain();
      g.gain.value = 0;
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start();
      tension = { osc, filter, gain: g };
    }
    rampTo(c, tension.gain.gain, target, TENSION_FADE_SECONDS);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const h of Array.from(activeHandles)) h.stop();
    activeHandles.clear();
    stopRingtone();
    stopAmbience();
    if (tension) {
      safeStop(tension.osc);
      safeDisconnect(tension.osc);
      safeDisconnect(tension.filter);
      safeDisconnect(tension.gain);
      tension = null;
    }
    for (const n of clickTimerNodes) safeDisconnect(n);
    clickTimerNodes = [];
    safeDisconnect(voiceBus);
    safeDisconnect(master);
    decoded.clear();
    noiseBuffer = null;
    // Close only the context this engine created.
    const c = ctx;
    ctx = null;
    master = null;
    voiceBus = null;
    if (c && c.state !== "closed") {
      void c.close().catch(() => undefined);
    }
  }

  return {
    supported,
    resume,
    load,
    start,
    dispose,
    setMasterGain,
    startRingtone,
    stopRingtone,
    playConnectClick,
    startAmbience,
    setAmbienceInCall,
    stopAmbience,
    setTension,
  };
}

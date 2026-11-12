// Unit tests for the Web Audio engine using a minimal fake AudioContext on globalThis.
// No real audio device, no network. Requirements: 17.2, 17.3.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PEAK_CAP, PHONE_FILTER } from "./mixPlan";
import { createWebAudioEngine } from "./webAudioEngine";

class FakeParam {
  value = 0;
  cancelScheduledValues(): void {}
  setValueAtTime(v: number): void {
    this.value = v;
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v;
  }
  exponentialRampToValueAtTime(v: number): void {
    this.value = v;
  }
}

class FakeNode {
  connected: FakeNode[] = [];
  disconnected = false;
  connect(n: FakeNode): FakeNode {
    this.connected.push(n);
    return n;
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type = "";
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeCompressor extends FakeNode {
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: { duration: number } | null = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
}

class FakeOsc extends FakeSource {
  type = "";
  frequency = new FakeParam();
}

class FakeContext {
  static instances: FakeContext[] = [];
  state = "running";
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  filters: FakeFilter[] = [];
  sources: FakeSource[] = [];
  closeCalls = 0;
  constructor() {
    FakeContext.instances.push(this);
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    g.gain.value = 1;
    this.gains.push(g);
    return g;
  }
  createBiquadFilter(): FakeFilter {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createOscillator(): FakeOsc {
    return new FakeOsc();
  }
  createBuffer(_c: number, length: number): { duration: number; getChannelData: () => Float32Array } {
    return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
  }
  decodeAudioData(): Promise<{ duration: number }> {
    return Promise.resolve({ duration: 2 });
  }
  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closeCalls += 1;
    this.state = "closed";
    return Promise.resolve();
  }
}

const g = globalThis as unknown as Record<string, unknown>;

describe("webAudioEngine", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    FakeContext.instances = [];
    g.AudioContext = FakeContext;
    delete g.webkitAudioContext;
    fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete g.AudioContext;
  });

  it("reports unsupported without a constructor and creates no context", async () => {
    delete g.AudioContext;
    const engine = createWebAudioEngine();
    expect(engine.supported).toBe(false);
    expect(await engine.resume()).toBe("suspended");
    await expect(engine.load("/a.mp3")).rejects.toThrow();
    expect(FakeContext.instances).toHaveLength(0);
    expect(() => engine.dispose()).not.toThrow();
  });

  it("creates the audio graph lazily", async () => {
    const engine = createWebAudioEngine();
    expect(engine.supported).toBe(true);
    expect(FakeContext.instances).toHaveLength(0);
    await engine.resume();
    expect(FakeContext.instances).toHaveLength(1);
  });

  it("rejects cross-origin and non-http URLs without any network call", async () => {
    const engine = createWebAudioEngine();
    for (const url of [
      "https://other.example/clip.mp3",
      "http://203.0.113.5/clip.mp3",
      "//other.example/clip.mp3",
      "data:audio/mpeg;base64,AAAA",
      "javascript:alert(1)",
    ]) {
      await expect(engine.load(url)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a same-origin URL through the stubbed fetch only", async () => {
    const engine = createWebAudioEngine();
    const clip = await engine.load("/assets/voice/a.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clip.durationMs).toBe(2000);
    await engine.load("/assets/voice/a.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds the phone filter only when requested", async () => {
    const engine = createWebAudioEngine();
    const clip = await engine.load("/a.mp3");
    const ctx = FakeContext.instances[0];
    const before = ctx.filters.length;
    engine.start(clip, { offsetMs: 0, gain: 0.5, phoneFilter: false, onEnded: () => {} });
    expect(ctx.filters.length).toBe(before);
    engine.start(clip, { offsetMs: 0, gain: 0.5, phoneFilter: true, onEnded: () => {} });
    const added = ctx.filters.slice(before);
    expect(added.map((f) => f.type)).toEqual(["highpass", "lowpass"]);
    expect(added[0].frequency.value).toBe(PHONE_FILTER.highPassHz);
    expect(added[1].frequency.value).toBe(PHONE_FILTER.lowPassHz);
  });

  it("keeps playback gains within 0 to 1 and generated sounds within the peak cap", async () => {
    const engine = createWebAudioEngine();
    const clip = await engine.load("/a.mp3");
    const ctx = FakeContext.instances[0];
    const startGainsBefore = ctx.gains.length;
    const h = engine.start(clip, { offsetMs: 0, gain: 9, phoneFilter: false, onEnded: () => {} });
    const playbackGain = ctx.gains[startGainsBefore];
    expect(playbackGain.gain.value).toBe(1);
    h.setGain(-3);
    expect(playbackGain.gain.value).toBe(0);
    h.setGain(Number.NaN);
    expect(playbackGain.gain.value).toBe(0);
    h.setGain(5);
    expect(playbackGain.gain.value).toBe(1);

    const n = ctx.gains.length;
    engine.startRingtone(false);
    engine.startAmbience(false);
    engine.setTension(3, false);
    engine.playConnectClick();
    for (const gn of ctx.gains.slice(n)) {
      expect(gn.gain.value).toBeLessThanOrEqual(PEAK_CAP);
      expect(gn.gain.value).toBeGreaterThanOrEqual(0);
    }
    engine.setMasterGain(7);
    engine.setMasterGain(-1);
    expect(() => engine.setAmbienceInCall(true)).not.toThrow();
  });

  it("stop is idempotent and onEnded does not fire after stop", async () => {
    const engine = createWebAudioEngine();
    const clip = await engine.load("/a.mp3");
    const ctx = FakeContext.instances[0];
    const onEnded = vi.fn();
    const h = engine.start(clip, { offsetMs: 500, gain: 1, phoneFilter: true, onEnded });
    const src = ctx.sources[ctx.sources.length - 1];
    expect(src.started).toBe(true);
    h.stop();
    h.stop();
    expect(src.stopped).toBe(true);
    expect(src.onended).toBeNull();
    expect(onEnded).not.toHaveBeenCalled();
    expect(h.positionMs()).toBe(2000);
  });

  it("dispose closes only its own context, once, and later calls are no-ops", async () => {
    const a = createWebAudioEngine();
    const b = createWebAudioEngine();
    await a.resume();
    await b.resume();
    const [ctxA, ctxB] = FakeContext.instances;
    a.dispose();
    a.dispose();
    expect(ctxA.closeCalls).toBe(1);
    expect(ctxB.closeCalls).toBe(0);
    expect(await a.resume()).toBe("suspended");
    expect(FakeContext.instances).toHaveLength(2);
    await expect(a.load("/a.mp3")).rejects.toThrow();
    b.dispose();
    expect(ctxB.closeCalls).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

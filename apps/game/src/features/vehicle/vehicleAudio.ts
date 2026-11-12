/**
 * Vehicle sound engine (framework-agnostic). Used directly by imperative engines such as the
 * Huế world, and through the `useVehicleAudio` React hook by the R3F maps.
 */

export interface VehicleAudioOptions {
  enabled?: boolean;
  volume?: number;
  doorSoundPath?: string;
  driveSoundPath?: string;
  stopSoundPath?: string;
  stopCarSoundPath?: string;
  indicatorSoundPath?: string;
}

export const DEFAULT_VEHICLE_SOUNDS = {
  doorSoundPath: "/assets/audio/closedoorlx.mp3",
  driveSoundPath: "/assets/audio/drive.wav",
  stopSoundPath: "/assets/audio/stop.mp3",
  stopCarSoundPath: "/assets/audio/stopCar.mp3",
  indicatorSoundPath: "/assets/audio/indicator.mp3",
} as const;

/**
 * Loudness of the vehicle sounds relative to the SFX volume setting (about +5 dB).
 * Gains may exceed 1; the output limiter keeps the mix from clipping.
 */
const VEHICLE_GAIN_BOOST = 1.8;
const MAX_VEHICLE_GAIN = 2.0;
const vehicleGain = (base: number, volume: number) => Math.min(MAX_VEHICLE_GAIN, base * volume * VEHICLE_GAIN_BOOST);

const safeStop = (source: AudioBufferSourceNode | null) => {
  try {
    source?.stop();
    source?.disconnect();
  } catch {
    // already stopped
  }
};

export class VehicleAudio {
  enabled: boolean;
  volume: number;

  private ctx: AudioContext | null = null;
  /** Every vehicle sound goes through this limiter before reaching the speakers. */
  private output: AudioNode | null = null;
  private disposed = false;

  private doorBuffer: AudioBuffer | null = null;
  private driveBuffer: AudioBuffer | null = null;
  private stopBuffer: AudioBuffer | null = null;
  private stopCarBuffer: AudioBuffer | null = null;
  private indicatorBuffer: AudioBuffer | null = null;

  private doorSource: AudioBufferSourceNode | null = null;
  private doorGain: GainNode | null = null;
  private startSource: AudioBufferSourceNode | null = null;
  private startGain: GainNode | null = null;
  private driveSource: AudioBufferSourceNode | null = null;
  private driveGain: GainNode | null = null;
  private stopSource: AudioBufferSourceNode | null = null;
  private stopGain: GainNode | null = null;
  private indicatorSource: AudioBufferSourceNode | null = null;
  private indicatorGain: GainNode | null = null;
  private isDrivingSoundActive = false;

  constructor(options: VehicleAudioOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.volume = options.volume ?? 1.5;
    this.initAudio();
    const ctx = this.ctx;
    if (!ctx) return;
    const load = (path: string, label: string, assign: (b: AudioBuffer) => void) => {
      fetch(path)
        .then((res) => res.arrayBuffer())
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => {
          if (!this.disposed) assign(decoded);
        })
        .catch((err) => console.warn(`Failed to load car ${label} sound:`, err));
    };
    load(options.doorSoundPath ?? DEFAULT_VEHICLE_SOUNDS.doorSoundPath, "door", (b) => (this.doorBuffer = b));
    load(options.driveSoundPath ?? DEFAULT_VEHICLE_SOUNDS.driveSoundPath, "drive", (b) => (this.driveBuffer = b));
    load(options.stopSoundPath ?? DEFAULT_VEHICLE_SOUNDS.stopSoundPath, "stop", (b) => (this.stopBuffer = b));
    load(options.stopCarSoundPath ?? DEFAULT_VEHICLE_SOUNDS.stopCarSoundPath, "stopCar", (b) => (this.stopCarBuffer = b));
    load(options.indicatorSoundPath ?? DEFAULT_VEHICLE_SOUNDS.indicatorSoundPath, "turn signal", (b) => (this.indicatorBuffer = b));
  }

  private initAudio() {
    if (this.ctx || this.disposed || typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);
    this.ctx = ctx;
    this.output = limiter;
  }

  /** Live context, resumed if the browser suspended it; null when audio is unavailable. */
  private liveContext(): AudioContext | null {
    this.initAudio();
    const ctx = this.ctx;
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  private connect(source: AudioBufferSourceNode, gain: GainNode, ctx: AudioContext) {
    source.connect(gain);
    gain.connect(this.output ?? ctx.destination);
  }

  /** One-shot with an "ended" callback guarded by a timer, in case the event never fires. */
  private playOneShot(buffer: AudioBuffer, base: number, onEnded?: () => void) {
    const ctx = this.liveContext();
    if (!ctx) {
      onEnded?.();
      return null;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vehicleGain(base, this.volume), ctx.currentTime);
    this.connect(source, gain, ctx);
    let endedCalled = false;
    const handleEnded = () => {
      if (!endedCalled) {
        endedCalled = true;
        onEnded?.();
      }
    };
    source.onended = handleEnded;
    const fallbackMs = Math.max(500, Math.floor(buffer.duration * 1000));
    setTimeout(handleEnded, fallbackMs + 100);
    source.start(0);
    return { source, gain };
  }

  /** Car door close + engine start on entering. Calls onEnded when complete. */
  playDoorSound(onEnded?: () => void) {
    if (!this.enabled || !this.doorBuffer) {
      onEnded?.();
      return;
    }
    const nodes = this.playOneShot(this.doorBuffer, 0.9, onEnded);
    if (nodes) {
      this.doorSource = nodes.source;
      this.doorGain = nodes.gain;
    }
  }

  /** Ignition sound. Calls onEnded when complete. */
  playStartSound(onEnded?: () => void) {
    if (!this.enabled) {
      onEnded?.();
      return;
    }
    if (!this.driveBuffer) {
      // Audio not decoded yet; let gameplay proceed.
      setTimeout(() => onEnded?.(), 2000);
      return;
    }
    safeStop(this.startSource);
    this.startSource = null;
    const nodes = this.playOneShot(this.driveBuffer, 0.9, onEnded);
    if (nodes) {
      this.startSource = nodes.source;
      this.startGain = nodes.gain;
    }
  }

  /** Sound when getting out of the car. */
  playStopCarSound() {
    if (!this.enabled || !this.stopCarBuffer) return;
    this.playOneShot(this.stopCarBuffer, 0.95);
  }

  /** Engine loop while accelerating; its pitch follows the speed. */
  playDriveSound(speed: number) {
    if (!this.enabled || !this.driveBuffer) return;
    const ctx = this.liveContext();
    if (!ctx) return;

    if (this.isDrivingSoundActive && this.driveSource) {
      const pitch = 0.95 + Math.min(0.4, (Math.abs(speed) / 18.0) * 0.35);
      this.driveSource.playbackRate.setValueAtTime(pitch, ctx.currentTime);
      return;
    }

    if (this.stopSource && this.stopGain) {
      this.stopGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      const prev = this.stopSource;
      setTimeout(() => safeStop(prev), 120);
      this.stopSource = null;
      this.stopGain = null;
    }

    const source = ctx.createBufferSource();
    source.buffer = this.driveBuffer;
    source.loop = true;
    source.playbackRate.setValueAtTime(1.0, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vehicleGain(0.85, this.volume), ctx.currentTime + 0.15);
    this.connect(source, gain, ctx);
    source.start(0);
    this.driveSource = source;
    this.driveGain = gain;
    this.isDrivingSoundActive = true;
  }

  /** Coasting sound when the throttle is released. */
  playStopSound() {
    if (!this.enabled || !this.stopBuffer) return;
    const ctx = this.liveContext();
    if (!ctx) return;

    if (this.driveSource && this.driveGain) {
      this.driveGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      const prev = this.driveSource;
      setTimeout(() => safeStop(prev), 180);
      this.driveSource = null;
      this.driveGain = null;
    }
    this.isDrivingSoundActive = false;

    const source = ctx.createBufferSource();
    source.buffer = this.stopBuffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vehicleGain(0.85, this.volume), ctx.currentTime + 0.12);
    this.connect(source, gain, ctx);
    source.start(0);
    this.stopSource = source;
    this.stopGain = gain;
  }

  /** Turn signal ticking: loops from the start while on, fades out when switched off. */
  setIndicator(on: boolean) {
    const ctx = this.ctx;
    if (!on) {
      const source = this.indicatorSource;
      const gain = this.indicatorGain;
      this.indicatorSource = null;
      this.indicatorGain = null;
      if (ctx && source && gain) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        setTimeout(() => safeStop(source), 120);
      }
      return;
    }
    if (!this.enabled || this.indicatorSource || !this.indicatorBuffer) return;
    const live = this.liveContext();
    if (!live) return;
    const source = live.createBufferSource();
    source.buffer = this.indicatorBuffer;
    source.loop = true;
    const gain = live.createGain();
    gain.gain.setValueAtTime(0.001, live.currentTime);
    gain.gain.linearRampToValueAtTime(vehicleGain(0.7, this.volume), live.currentTime + 0.05);
    this.connect(source, gain, live);
    source.start(0);
    this.indicatorSource = source;
    this.indicatorGain = gain;
  }

  /** Stop every driving sound (called on exit). */
  stopAll() {
    this.isDrivingSoundActive = false;
    this.setIndicator(false);
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const g of [this.doorGain, this.startGain, this.driveGain, this.stopGain]) {
      g?.gain.linearRampToValueAtTime(0.001, now + 0.08);
    }
    const sources = [this.doorSource, this.startSource, this.driveSource, this.stopSource];
    this.doorSource = this.startSource = this.driveSource = this.stopSource = null;
    this.doorGain = this.startGain = this.driveGain = this.stopGain = null;
    setTimeout(() => sources.forEach(safeStop), 100);
  }

  /** Suspend/resume with the host page (e.g. hidden tab). */
  pause() {
    this.ctx?.suspend().catch(() => {});
  }
  resume() {
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
  }

  dispose() {
    this.disposed = true;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.output = null;
    this.indicatorSource = null;
    this.indicatorGain = null;
  }
}

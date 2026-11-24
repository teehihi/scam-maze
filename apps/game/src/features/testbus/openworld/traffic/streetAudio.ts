import type { VehicleAgent, VehicleCategory } from "./types";

/**
 * Spatial Saigon Street Audio Engine.
 *
 * Uses the repo's authentic Vietnamese sound assets (`/audio/horn.mp3`, `/audio/netpo.mp3`)
 * combined with lightweight procedural WebAudio beds:
 *  - Distance-attenuated + stereo-panned Vietnamese motorbike/car horn when player blocks traffic
 *  - Subtle motorbike launch rev (`netpo.mp3`) on green-light waves
 *  - Continuous speed-reactive tire pass-by & wet-asphalt spray hiss when `wetness > 0.15`
 *  - Bus 06 pneumatic air-brake hiss on curb stops
 *
 * Completely safe in SSR/Vitest/headless environments (silently no-ops when AudioContext is unavailable).
 */
export class SaigonStreetAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private hornBuf: AudioBuffer | null = null;
  /** Owner-supplied car horn (`/audio/car_horn.mp3`): cars, vans and the bus; scooters keep `horn.mp3`. */
  private carHornBuf: AudioBuffer | null = null;
  /** Recorded street bed (traffic, scooters, voices; shared with the main menu and the neighborhood). */
  private ambientGain: GainNode | null = null;
  private ambientLevel = 0;
  private muted = false;
  /** Seconds until the next horn somewhere in the traffic around the player (street life, not a reaction). */
  private nextStreetHorn = 4;
  private revBuf: AudioBuffer | null = null;
  private wetNoiseGain: GainNode | null = null;
  private wetNoiseFilter: BiquadFilterNode | null = null;
  private loading = false;
  private disposed = false;

  private lastHornAt = -10;
  private lastRevAt = -10;
  private lastAirBrakeAt = -10;
  private simTime = 0;

  /** Call once after a user interaction (click/keydown) to arm WebAudio. */
  unlock() {
    if (this.disposed || typeof window === "undefined") return;
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.55;
        this.masterGain.connect(this.ctx.destination);
        this.initWetSprayBed();
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (!this.loading) {
      this.loading = true;
      void this.loadBuffers();
    }
  }

  private async loadBuffers() {
    if (!this.ctx) return;
    const loadOne = async (url: string): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arr = await res.arrayBuffer();
        if (!this.ctx || this.disposed) return null;
        return await this.ctx.decodeAudioData(arr);
      } catch {
        return null;
      }
    };
    const [horn, rev, carHorn, ambient] = await Promise.all([
      loadOne("/audio/horn.mp3"),
      loadOne("/audio/netpo.mp3"),
      loadOne("/audio/car_horn.mp3"),
      loadOne("/assets/audio/menu_ambient.mp3"),
    ]);
    if (this.disposed || !this.ctx || !this.masterGain) return;
    this.hornBuf = horn;
    this.revBuf = rev;
    this.carHornBuf = carHorn;
    if (ambient) {
      const src = this.ctx.createBufferSource();
      src.buffer = ambient;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(g).connect(this.masterGain);
      src.start(0, Math.random() * Math.max(0, ambient.duration - 1));
      this.ambientGain = g;
    }
  }

  private initWetSprayBed() {
    if (!this.ctx || !this.masterGain) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.45;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1250;
    filter.Q.value = 0.9;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter).connect(gain).connect(this.masterGain);
    src.start();
    this.wetNoiseFilter = filter;
    this.wetNoiseGain = gain;
  }

  /** Play a spatialized Vietnamese vehicle horn (rate-limited so it never spams). */
  playHorn(
    srcX: number,
    srcZ: number,
    listenerX: number,
    listenerZ: number,
    listenerYaw: number,
    category: VehicleCategory,
    urgent = false,
  ) {
    if (!this.ctx || !this.masterGain || this.ctx.state !== "running") return;
    const minInterval = urgent ? 1.4 : 3.2;
    if (this.simTime - this.lastHornAt < minInterval) return;

    const dist = Math.hypot(srcX - listenerX, srcZ - listenerZ);
    if (dist > 44) return;
    this.lastHornAt = this.simTime;

    const gainVal = Math.max(0, 1 - dist / 44) ** 1.6 * (urgent ? 0.46 : 0.28);
    const pan = this.computeStereoPan(srcX, srcZ, listenerX, listenerZ, listenerYaw);

    const car = category !== "moto" && this.carHornBuf;
    if (car && this.carHornBuf) {
      // Cars, vans and the bus: the recorded car horn, a little lower for the heavier ones.
      const src = this.ctx.createBufferSource();
      src.buffer = this.carHornBuf;
      src.playbackRate.value = category === "car" ? 0.97 + Math.random() * 0.08 : 0.84;
      const g = this.ctx.createGain();
      g.gain.value = gainVal * 1.4;
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(g).connect(p).connect(this.masterGain);
      src.start(0, 0, Math.min(urgent ? 0.9 : 0.5, this.carHornBuf.duration));
    } else if (this.hornBuf) {
      // Motorbikes (and the others until car_horn.mp3 has loaded): the recorded scooter horn, whole and at its
      // own pitch (as in the neighborhood); only a slight variation between bikes.
      const src = this.ctx.createBufferSource();
      src.buffer = this.hornBuf;
      src.playbackRate.value = 0.97 + Math.random() * 0.06;
      const g = this.ctx.createGain();
      g.gain.value = gainVal * 1.6;
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(g).connect(p).connect(this.masterGain);
      src.start();
    } else {
      // Crisp dual-tone procedural fallback before mp3 finishes decoding
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = category === "moto" ? 490 : category === "bus" ? 210 : 370;
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 1400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainVal * 0.45), now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      osc.connect(filt).connect(g).connect(p).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  }

  /** Play subtle Saigon motorbike launch rev (`netpo.mp3`) when a scooter accelerates away. */
  playMotoRev(
    srcX: number,
    srcZ: number,
    listenerX: number,
    listenerZ: number,
    listenerYaw: number,
    /** The reckless rider ("Báo Thủ") revs the whole engine at whatever holds him up: longer and louder. */
    full = false,
  ) {
    if (!this.ctx || !this.masterGain || !this.revBuf || this.ctx.state !== "running") return;
    if (this.simTime - this.lastRevAt < (full ? 3.5 : 4.5)) return;
    const dist = Math.hypot(srcX - listenerX, srcZ - listenerZ);
    if (dist > (full ? 48 : 34)) return;
    this.lastRevAt = this.simTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.revBuf;
    src.playbackRate.value = 0.92 + Math.random() * 0.24;
    const g = this.ctx.createGain();
    g.gain.value = full ? Math.max(0, 1 - dist / 48) ** 1.4 * 0.55 : Math.max(0, 1 - dist / 34) ** 1.7 * 0.22;
    const p = this.ctx.createStereoPanner();
    p.pan.value = this.computeStereoPan(srcX, srcZ, listenerX, listenerZ, listenerYaw);
    src.connect(g).connect(p).connect(this.masterGain);
    src.start(0, 0, Math.min(full ? 2.4 : 0.65, this.revBuf.duration));
  }

  /** Play Bus 06 pneumatic air-brake hiss when halting at a stop. */
  playBusAirBrake(busX: number, busZ: number, listenerX: number, listenerZ: number) {
    if (!this.ctx || !this.masterGain || this.ctx.state !== "running") return;
    if (this.simTime - this.lastAirBrakeAt < 5.0) return;
    const dist = Math.hypot(busX - listenerX, busZ - listenerZ);
    if (dist > 36) return;
    this.lastAirBrakeAt = this.simTime;

    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.55);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2200;
    const g = this.ctx.createGain();
    g.gain.value = Math.max(0, 1 - dist / 36) * 0.26;
    src.connect(hp).connect(g).connect(this.masterGain);
    src.start(now);
  }

  /** Update continuous tire spray / Doppler pass-by hiss from nearby moving traffic. */
  updateFrame(
    dt: number,
    wetness: number,
    listenerX: number,
    listenerZ: number,
    vehicles: readonly VehicleAgent[],
    listenerYaw = 0,
  ) {
    this.simTime += dt;
    if (!this.ctx || !this.wetNoiseGain || !this.wetNoiseFilter || this.ctx.state !== "running") return;
    this.ambientGain?.gain.setTargetAtTime(this.ambientLevel * 0.5, this.ctx.currentTime, 0.6);
    // Out on the street somebody honks every few seconds, as on any Saigon street (one random nearby vehicle).
    if (this.ambientLevel > 0.5) {
      this.nextStreetHorn -= dt;
      if (this.nextStreetHorn <= 0) {
        this.nextStreetHorn = 5 + Math.random() * 9;
        const near = vehicles.filter((v) => v.speed > 1.5 && !v.externalControl && Math.hypot(v.x - listenerX, v.z - listenerZ) < 40);
        const v = near[Math.floor(Math.random() * near.length)];
        if (v) this.playHorn(v.x, v.z, listenerX, listenerZ, listenerYaw, v.category, false);
      }
    }

    // Accumulate weighted tire noise from moving vehicles within 28m
    let energy = 0;
    let fastestSpeed = 0;
    for (const v of vehicles) {
      if (v.speed < 1.2) continue;
      const dist = Math.hypot(v.x - listenerX, v.z - listenerZ);
      if (dist > 28) continue;
      const w = (1 - dist / 28) ** 2 * (v.speed / 12);
      energy += w * (v.category === "moto" ? 0.55 : 1.0);
      if (v.speed > fastestSpeed) fastestSpeed = v.speed;
    }

    const dryWhoosh = Math.min(0.055, energy * 0.022);
    const wetSpray = wetness * Math.min(0.16, energy * 0.075);
    const targetGain = dryWhoosh + wetSpray;
    const targetFreq = 850 + wetness * 1100 + fastestSpeed * 45;

    const now = this.ctx.currentTime;
    this.wetNoiseGain.gain.setTargetAtTime(targetGain, now, 0.12);
    this.wetNoiseFilter.frequency.setTargetAtTime(targetFreq, now, 0.15);
  }

  private computeStereoPan(
    sx: number,
    sz: number,
    lx: number,
    lz: number,
    lYaw: number,
  ): number {
    const dx = sx - lx;
    const dz = sz - lz;
    const dist = Math.hypot(dx, dz) || 1;
    // Camera/player right vector when yaw rotates around +Y (forward = (-sin yaw, -cos yaw) in Three.js)
    const rx = Math.cos(lYaw);
    const rz = -Math.sin(lYaw);
    return Math.max(-0.9, Math.min(0.9, ((dx * rx + dz * rz) / dist) * 0.9));
  }

  /** 0..1: the street bed and the street's own horns (1 out on the street, 0 inside). */
  setAmbience(level: number) {
    this.ambientLevel = Math.max(0, Math.min(1, level));
  }
  /** Follows the game's sound setting. */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }
  get isMuted() {
    return this.muted;
  }
  dispose() {
    this.disposed = true;
    try {
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}

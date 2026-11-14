import * as THREE from 'three';

export class Emitter {
  pa: THREE.PositionalAudio;
  input: GainNode;
  constructor(listener: THREE.AudioListener, ref = 1, rolloff = 1.2) {
    const ctx = listener.context;
    this.pa = new THREE.PositionalAudio(listener);
    this.input = ctx.createGain();
    this.pa.setNodeSource(this.input as unknown as AudioBufferSourceNode);
    this.pa.setRefDistance(ref);
    this.pa.setRolloffFactor(rolloff);
    this.pa.setDistanceModel('inverse');
    (this.pa.panner as PannerNode).panningModel = 'HRTF';
  }
}

/** Recorded rain, shared with the neighborhood. Muffled through the closed window, clearer when it is open. */
const RAIN_URL = '/audio/rain.mp3';
const RAIN_CLOSED = 0.22;
const RAIN_OPEN = 0.5;
/** Owner-supplied sounds: thunder (shared with the neighborhood) and the wall clock's ticking loop. */
const THUNDER_URL = '/audio/thunder.mp3';
const CLOCK_URL = '/audio/clock.mp3';
/** City heard through the walls and the window, kept low because the player is indoors. */
const CITY_ROOM = 0.04;
const CITY_WINDOW_CLOSED = 0.07;
const CITY_WINDOW_OPEN = 0.25;

export class AudioEngine {
  listener: THREE.AudioListener;
  ctx: AudioContext;
  white!: AudioBuffer;
  brown!: AudioBuffer;
  pink!: AudioBuffer;
  emit: Record<string, Emitter> = {};
  room!: GainNode;
  windowBed!: GainNode;
  windowOpen = 0;
  fridgeGain!: GainNode;
  fanGain!: GainNode;
  vibeGain!: GainNode;
  cityDuck!: GainNode;
  kettleGain!: GainNode;
  kettleNoise?: AudioBufferSourceNode;
  started = false;
  private rainGain?: GainNode;
  private rainFilter?: BiquadFilterNode;
  timers: number[] = [];

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = this.listener.context;
    this.makeBuffers();
  }

  private makeBuffers() {
    const sr = this.ctx.sampleRate, len = sr * 4;
    this.white = this.ctx.createBuffer(1, len, sr);
    this.brown = this.ctx.createBuffer(1, len, sr);
    this.pink = this.ctx.createBuffer(1, len, sr);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0), p = this.pink.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
    }
  }

  private loop(buf: AudioBuffer, dest: AudioNode, rate = 1) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    s.loopStart = Math.random(); s.start(0, Math.random() * 3);
    s.connect(dest);
    return s;
  }
  private filt(type: BiquadFilterType, f: number, q = 0.7) {
    const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
  }
  private gain(v: number) { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  addEmitter(name: string, parent: THREE.Object3D, pos: THREE.Vector3, ref = 1, rolloff = 1.2) {
    const e = new Emitter(this.listener, ref, rolloff);
    e.pa.position.copy(pos);
    parent.add(e.pa);
    this.emit[name] = e;
    return e;
  }

  /** Called on first user gesture */
  start() {
    if (this.started) return;
    this.started = true;
    this.ctx.resume();
    const out = this.listener.getInput();
    this.cityDuck = this.gain(1);
    this.cityDuck.connect(out);

    // The room plays (owner): a low city bed, the recorded rain, distant thunder, the wall clock, the
    // light switches, the door, typing, and the phone vibrating. The other synthesized sounds were removed.
    this.room = this.gain(CITY_ROOM);
    const roomLp = this.filt('lowpass', 180);
    this.loop(this.brown, roomLp); roomLp.connect(this.room); this.room.connect(this.cityDuck);
    this.windowBed = this.gain(CITY_WINDOW_CLOSED);
    const wlp = this.filt('lowpass', 700);
    this.loop(this.pink, wlp, 0.9); wlp.connect(this.windowBed);
    this.windowBed.connect(this.emit.window.input);
    const load = (url: string) => fetch(url).then((res) => res.arrayBuffer()).then((data) => this.ctx.decodeAudioData(data));
    load(THUNDER_URL).then((buf) => { this.thunderBuf = buf; }).catch((err) => console.warn('[room] thunder sound failed to load', err));
    load(CLOCK_URL)
      .then((buf) => {
        const e = this.emit.clock; if (!e || this.ctx.state === 'closed') return;
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = this.gain(0.6); src.connect(g); g.connect(e.input); src.start();
      })
      .catch((err) => console.warn('[room] clock sound failed to load', err));
    // Thunder far away, the storm moving off: once early, then now and then.
    this.timers.push(window.setTimeout(() => this.thunder(0.55), 18000));
    this.every(60, 130, () => this.thunder(0.3 + Math.random() * 0.25));
    this.every(5, 12, () => this.tireHiss());
    this.rainFilter = this.filt('lowpass', 900);
    this.rainGain = this.gain(0);
    this.rainFilter.connect(this.rainGain); this.rainGain.connect(this.cityDuck);
    fetch(RAIN_URL)
      .then((res) => res.arrayBuffer())
      .then((data) => this.ctx.decodeAudioData(data))
      .then((buf) => {
        if (this.ctx.state === 'closed') return;
        const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(this.rainFilter!);
        src.start(0, Math.random() * Math.max(0, buf.duration - 1));
        this.rainGain!.gain.setTargetAtTime(RAIN_CLOSED, this.ctx.currentTime, 1.5);
      })
      .catch((err) => console.warn('[room] rain sound failed to load', err));

    // Phone vibration chain
    this.vibeGain = this.gain(0);
    const vo = this.ctx.createOscillator(); vo.type = 'square'; vo.frequency.value = 172;
    const vlp = this.filt('lowpass', 900); vo.connect(vlp); vo.start();
    const rattle = this.filt('bandpass', 1200, 1.4); this.loop(this.white, rattle);
    const ram = this.gain(0); rattle.connect(ram);
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 31; const lfoG = this.gain(0.5); lfo.connect(lfoG); lfoG.connect(ram.gain); lfo.start();
    const vmix = this.gain(1); vlp.connect(vmix); const rg = this.gain(0.9); ram.connect(rg); rg.connect(vmix);
    vmix.connect(this.vibeGain); this.vibeGain.connect(this.emit.phone.input);

  }

  drip(..._args: unknown[]): void {}
  horn(..._args: unknown[]): void {}
  siren(..._args: unknown[]): void {}
  private every(minS: number, maxS: number, fn: () => void) {
    const tick = () => { fn(); this.timers.push(window.setTimeout(tick, (minS + Math.random() * (maxS - minS)) * 1000)); };
    this.timers.push(window.setTimeout(tick, (minS + Math.random() * (maxS - minS)) * 1000));
  }
  private thunderBuf: AudioBuffer | null = null;
  private burst(dest: AudioNode, opts: { f: number; q?: number; type?: BiquadFilterType; dur: number; vol: number; delay?: number; buf?: AudioBuffer }) {
    const t = this.ctx.currentTime + (opts.delay ?? 0);
    const s = this.ctx.createBufferSource(); s.buffer = opts.buf ?? this.white;
    const f = this.filt(opts.type ?? 'bandpass', opts.f, opts.q ?? 1);
    const g = this.gain(0); g.gain.setValueAtTime(opts.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 3); s.stop(t + opts.dur + 0.05);
  }
  private tone(dest: AudioNode, f: number, dur: number, vol: number, delay = 0, type: OscillatorType = 'sine') {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = this.gain(0); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  /** Tyres on the wet street below, quiet (part of the city bed). */
  tireHiss() {
    const t = this.ctx.currentTime, dur = 2.5 + Math.random() * 2;
    const s = this.ctx.createBufferSource(); s.buffer = this.white;
    const bp = this.filt('bandpass', 600, 0.8);
    bp.frequency.setValueAtTime(500, t); bp.frequency.linearRampToValueAtTime(2200 + Math.random() * 800, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(500, t + dur);
    const g = this.gain(0);
    const peak = (0.03 + Math.random() * 0.03) * (1 + this.windowOpen * 2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.5); g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = this.filt('lowpass', 1800 + this.windowOpen * 4000);
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.emit.window.input);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
  }
  /** Distant thunder (the recorded clap, darker and through the window). */
  thunder(v: number) {
    const buf = this.thunderBuf; if (!buf || this.ctx.state === 'closed') return;
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.8 + Math.random() * 0.15;
    const lp = this.filt('lowpass', 700 + this.windowOpen * 3000); const g = this.gain(v * (1 + this.windowOpen * 0.6));
    s.connect(lp); lp.connect(g); g.connect(this.cityDuck); s.start();
  }
  switchClick(at: string) {
    const e = this.emit[at]; if (!e) return;
    this.burst(e.input, { f: 3200, q: 2, dur: 0.03, vol: 0.5 });
    this.tone(e.input, 1900, 0.03, 0.08);
    this.burst(e.input, { f: 1400, q: 3, dur: 0.02, vol: 0.25, delay: 0.045 });
  }
  doorClose() {
    const e = this.emit.door; if (!e) return;
    this.burst(e.input, { f: 90, type: 'lowpass', dur: 0.5, vol: 1.2, buf: this.brown });
    this.burst(e.input, { f: 2400, q: 4, dur: 0.05, vol: 0.4, delay: 0.08 });
    this.burst(e.input, { f: 3600, q: 6, dur: 0.04, vol: 0.3, delay: 0.16 });
  }
  typing() {
    const e = this.emit.laptop; if (!e) return;
    for (let i = 0; i < 7; i++) {
      const dl = i * 0.075 + Math.random() * 0.04;
      this.burst(e.input, { f: 3400 + Math.random() * 1200, q: 2, dur: 0.018, vol: 0.35, delay: dl });
      this.tone(e.input, 180 + Math.random() * 60, 0.03, 0.12, dl);
    }
  }
  // Removed (owner): the sounds below stay as no-ops so the engine's calls keep working.
  footstep(..._args: unknown[]): void {}
  keys(..._args: unknown[]): void {}
  paper(..._args: unknown[]): void {}
  clink(..._args: unknown[]): void {}
  windowSlide(open: boolean) {
    this.windowOpen = open ? 1 : 0;
    const t = this.ctx.currentTime;
    this.rainGain?.gain.setTargetAtTime(open ? RAIN_OPEN : RAIN_CLOSED, t, 0.5);
    this.rainFilter?.frequency.setTargetAtTime(open ? 7000 : 900, t, 0.5);
    this.windowBed?.gain.setTargetAtTime(open ? CITY_WINDOW_OPEN : CITY_WINDOW_CLOSED, t, 0.4);
  }
  setFan(..._args: unknown[]): void {}
  setFridge(..._args: unknown[]): void {}
  setVibe(on: boolean) { this.vibeGain?.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.012); }
  duckCity(v: number) {
    this.cityDuck?.gain.setTargetAtTime(v, this.ctx.currentTime, 1.2);
    this.emit.window?.pa.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 1.2);
  }
  kettle(..._args: unknown[]): void {}
  bedRustle(..._args: unknown[]): void {}
  sigh(..._args: unknown[]): void {}
  stinger(..._args: unknown[]): void {}
  fridgeDoor(..._args: unknown[]): void {}
  beep(..._args: unknown[]): void {}
  chairRoll(..._args: unknown[]): void {}
  sit(..._args: unknown[]): void {}
  /** The wall clock plays its recorded ticking loop (started in `start`); the per-second call does nothing. */
  tick(..._args: unknown[]): void {}
  /** Silences (or restores) everything the room plays. */
  setMuted(muted: boolean) { this.listener.setMasterVolume(muted ? 0 : 1); }
  dispose() { this.timers.forEach(clearTimeout); this.ctx.close(); }
}

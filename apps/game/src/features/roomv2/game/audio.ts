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

    // The room plays only two things (owner): the recorded rain outside and the phone vibrating.
    // Every synthesized sound (room tone, clock tick, fridge, footsteps, clicks, city, thunder) was removed.
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

  tireHiss(..._args: unknown[]): void {}
  drip(..._args: unknown[]): void {}
  horn(..._args: unknown[]): void {}
  siren(..._args: unknown[]): void {}
  thunder(..._args: unknown[]): void {}
  // Removed (owner): the room plays only the recorded rain and the phone vibration. The methods
  // below stay as no-ops so the engine's calls (clicks, steps, fridge, clock, ...) keep working.
  switchClick(..._args: unknown[]): void {}
  footstep(..._args: unknown[]): void {}
  doorClose(..._args: unknown[]): void {}
  keys(..._args: unknown[]): void {}
  paper(..._args: unknown[]): void {}
  clink(..._args: unknown[]): void {}
  windowSlide(open: boolean) {
    this.windowOpen = open ? 1 : 0;
    const t = this.ctx.currentTime;
    this.rainGain?.gain.setTargetAtTime(open ? RAIN_OPEN : RAIN_CLOSED, t, 0.5);
    this.rainFilter?.frequency.setTargetAtTime(open ? 7000 : 900, t, 0.5);
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
  typing(..._args: unknown[]): void {}
  tick(..._args: unknown[]): void {}
  /** Silences (or restores) everything the room plays. */
  setMuted(muted: boolean) { this.listener.setMasterVolume(muted ? 0 : 1); }
  dispose() { this.timers.forEach(clearTimeout); this.ctx.close(); }
}

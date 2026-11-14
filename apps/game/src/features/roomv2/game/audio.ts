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

    // Room tone: very low brown rumble of the city through walls
    this.room = this.gain(0.09);
    const lp = this.filt('lowpass', 180);
    this.loop(this.brown, lp); lp.connect(this.room); this.room.connect(this.cityDuck);

    // City through the window glass (positional, grows when window opens)
    this.windowBed = this.gain(0.16);
    const wlp = this.filt('lowpass', 700);
    this.loop(this.pink, wlp, 0.9); wlp.connect(this.windowBed);
    this.windowBed.connect(this.emit.window.input);

    // Fridge hum
    this.fridgeGain = this.gain(0);
    [50, 100, 150, 201].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.frequency.value = f + Math.random() * 0.4;
      const g = this.gain([0.5, 0.35, 0.12, 0.05][i]); o.connect(g); g.connect(this.fridgeGain); o.start();
    });
    const fn = this.filt('bandpass', 420, 2); this.loop(this.white, fn); const fng = this.gain(0.05); fn.connect(fng); fng.connect(this.fridgeGain);
    this.fridgeGain.connect(this.emit.fridge.input);
    this.fridgeGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 2);

    // Laptop fan
    this.fanGain = this.gain(0);
    const ff = this.filt('bandpass', 2600, 0.8); this.loop(this.white, ff, 0.7); ff.connect(this.fanGain);
    this.fanGain.connect(this.emit.laptop.input);

    // Phone vibration chain
    this.vibeGain = this.gain(0);
    const vo = this.ctx.createOscillator(); vo.type = 'square'; vo.frequency.value = 172;
    const vlp = this.filt('lowpass', 900); vo.connect(vlp); vo.start();
    const rattle = this.filt('bandpass', 1200, 1.4); this.loop(this.white, rattle);
    const ram = this.gain(0); rattle.connect(ram);
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 31; const lfoG = this.gain(0.5); lfo.connect(lfoG); lfoG.connect(ram.gain); lfo.start();
    const vmix = this.gain(1); vlp.connect(vmix); const rg = this.gain(0.9); ram.connect(rg); rg.connect(vmix);
    vmix.connect(this.vibeGain); this.vibeGain.connect(this.emit.phone.input);

    // Kettle
    this.kettleGain = this.gain(0);
    const kf = this.filt('bandpass', 900, 0.6); this.kettleNoise = this.loop(this.pink, kf); kf.connect(this.kettleGain);
    this.kettleGain.connect(this.emit.kettle.input);

    this.scheduleAmbience();
  }

  private every(minS: number, maxS: number, fn: () => void) {
    const tick = () => { fn(); this.timers.push(window.setTimeout(tick, (minS + Math.random() * (maxS - minS)) * 1000)); };
    this.timers.push(window.setTimeout(tick, (minS + Math.random() * (maxS - minS)) * 1000));
  }

  private scheduleAmbience() {
    // tires hissing on wet asphalt
    this.every(3, 9, () => this.tireHiss());
    // drips from the AC unit / window ledge outside
    this.every(0.5, 2.4, () => this.drip('window', 1500 + Math.random() * 900, 0.18));
    // umbrella dripping into the little puddle by the door (slows down over time)
    let um = 0;
    const umbrella = () => { um++; this.drip('umbrella', 900 + Math.random() * 500, 0.12); this.timers.push(window.setTimeout(umbrella, (1.2 + um * 0.04 + Math.random() * 1.8) * 1000)); };
    this.timers.push(window.setTimeout(umbrella, 1500));
    // distant motorbike horn / siren
    this.every(25, 60, () => (Math.random() < 0.6 ? this.horn() : this.siren()));
    // thunder far away (the storm moving off)
    this.timers.push(window.setTimeout(() => this.thunder(0.5), 18000));
    this.every(70, 140, () => this.thunder(0.3));
  }

  tireHiss() {
    const t = this.ctx.currentTime, dur = 2.5 + Math.random() * 2;
    const s = this.ctx.createBufferSource(); s.buffer = this.white;
    const bp = this.filt('bandpass', 600, 0.8);
    bp.frequency.setValueAtTime(500, t); bp.frequency.linearRampToValueAtTime(2200 + Math.random() * 800, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(500, t + dur);
    const g = this.gain(0);
    const peak = 0.05 + Math.random() * 0.06 + this.windowOpen * 0.12;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.5); g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = this.filt('lowpass', 1800 + this.windowOpen * 4000);
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.emit.window.input);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.1);
  }

  drip(where: string, f: number, vol: number) {
    const e = this.emit[where]; if (!e) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.06);
    const g = this.gain(0); g.gain.setValueAtTime(vol * (where === 'window' ? 0.5 + this.windowOpen : 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g); g.connect(e.input); o.start(t); o.stop(t + 0.12);
  }

  horn() {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 420 + Math.random() * 80;
    const lp = this.filt('lowpass', 900); const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.015 + this.windowOpen * 0.02, t + 0.03); g.gain.setValueAtTime(0.015, t + 0.25); g.gain.linearRampToValueAtTime(0, t + 0.3);
    o.connect(lp); lp.connect(g); g.connect(this.emit.window.input); o.start(t); o.stop(t + 0.35);
  }

  siren() {
    const t = this.ctx.currentTime, dur = 7;
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.35; const lg = this.gain(180); lfo.connect(lg); lg.connect(o.frequency); o.frequency.value = 760;
    const lp = this.filt('lowpass', 1200); const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 2.5); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.emit.window.input); o.start(t); lfo.start(t); o.stop(t + dur); lfo.stop(t + dur);
  }

  thunder(v: number) {
    const t = this.ctx.currentTime, dur = 6;
    const s = this.ctx.createBufferSource(); s.buffer = this.brown;
    const lp = this.filt('lowpass', 140); const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.8); g.gain.exponentialRampToValueAtTime(v * 0.4, t + 2); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(lp); lp.connect(g); g.connect(this.cityDuck); s.start(t, Math.random()); s.stop(t + dur);
  }

  /* ---------- one-shots ---------- */
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

  switchClick(at: string) {
    const e = this.emit[at]; if (!e) return;
    this.burst(e.input, { f: 3200, q: 2, dur: 0.03, vol: 0.5 });
    this.tone(e.input, 1900, 0.03, 0.08);
    this.burst(e.input, { f: 1400, q: 3, dur: 0.02, vol: 0.25, delay: 0.045 });
  }
  footstep(intensity = 1) {
    const dest = this.listener.getInput();
    this.burst(dest, { f: 160 + Math.random() * 60, type: 'lowpass', dur: 0.12, vol: 0.22 * intensity, buf: this.brown });
    this.burst(dest, { f: 2500 + Math.random() * 1500, q: 0.9, dur: 0.04, vol: 0.012 * intensity });
  }
  doorClose() {
    const e = this.emit.door;
    this.burst(e.input, { f: 90, type: 'lowpass', dur: 0.5, vol: 1.2, buf: this.brown });
    this.burst(e.input, { f: 2400, q: 4, dur: 0.05, vol: 0.4, delay: 0.08 });
    this.burst(e.input, { f: 3600, q: 6, dur: 0.04, vol: 0.3, delay: 0.16 });
  }
  keys() {
    const e = this.emit.keys;
    for (let i = 0; i < 9; i++) this.tone(e.input, 3500 + Math.random() * 3000, 0.15 + Math.random() * 0.2, 0.04, 0.9 + i * 0.03 + Math.random() * 0.05);
    this.tone(e.input, 1250, 0.4, 0.05, 1.05);
  }
  paper(at: string) {
    const e = this.emit[at] ?? { input: this.listener.getInput() };
    for (let i = 0; i < 5; i++) this.burst(e.input, { f: 4000 + Math.random() * 3000, q: 0.6, dur: 0.05 + Math.random() * 0.08, vol: 0.08, delay: i * 0.04 + Math.random() * 0.05 });
  }
  clink(at: string) {
    const e = this.emit[at]; if (!e) return;
    this.tone(e.input, 2350, 0.5, 0.05); this.tone(e.input, 3810, 0.3, 0.03); this.tone(e.input, 5600, 0.2, 0.015);
    this.burst(e.input, { f: 400, type: 'lowpass', dur: 0.05, vol: 0.2, buf: this.brown });
  }
  windowSlide(open: boolean) {
    const e = this.emit.window;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.white;
    const bp = this.filt('bandpass', open ? 700 : 900, 1.5); const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.1); g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
    s.connect(bp); bp.connect(g); g.connect(e.input); s.start(t); s.stop(t + 0.8);
    this.burst(e.input, { f: 150, type: 'lowpass', dur: 0.2, vol: 0.4, buf: this.brown, delay: 0.65 });
    this.windowOpen = open ? 1 : 0;
    this.windowBed.gain.setTargetAtTime(open ? 0.55 : 0.16, t, 0.4);
  }
  setFan(on: boolean) { this.fanGain?.gain.setTargetAtTime(on ? 0.012 : 0, this.ctx.currentTime, 1.5); }
  setFridge(on: boolean) {
    if (!this.fridgeGain) return;
    const t = this.ctx.currentTime;
    if (!on) { this.burst(this.emit.fridge.input, { f: 120, type: 'lowpass', dur: 0.25, vol: 0.35, buf: this.brown }); this.tone(this.emit.fridge.input, 80, 0.4, 0.05); }
    this.fridgeGain.gain.setTargetAtTime(on ? 0.035 : 0, t, on ? 1.5 : 0.08);
  }
  setVibe(on: boolean) { this.vibeGain?.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.012); }
  duckCity(v: number) {
    this.cityDuck?.gain.setTargetAtTime(v, this.ctx.currentTime, 1.2);
    this.emit.window?.pa.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 1.2);
  }
  kettle(on: boolean) {
    const t = this.ctx.currentTime;
    if (on) { this.switchClick('kettle'); this.kettleGain.gain.cancelScheduledValues(t); this.kettleGain.gain.setValueAtTime(0.001, t); this.kettleGain.gain.linearRampToValueAtTime(0.09, t + 16); }
    else { this.kettleGain.gain.cancelScheduledValues(t); this.kettleGain.gain.setTargetAtTime(0, t, 0.3); this.switchClick('kettle'); }
  }
  bedRustle() {
    for (let i = 0; i < 8; i++) this.burst(this.listener.getInput(), { f: 1200 + Math.random() * 1500, q: 0.5, dur: 0.15 + Math.random() * 0.2, vol: 0.06, delay: i * 0.08 });
    this.burst(this.listener.getInput(), { f: 120, type: 'lowpass', dur: 0.4, vol: 0.4, buf: this.brown, delay: 0.1 });
  }
  sigh() {
    // a tired exhale: breathy filtered noise
    const t = this.ctx.currentTime + 0.3;
    const s = this.ctx.createBufferSource(); s.buffer = this.pink;
    const bp = this.filt('bandpass', 700, 0.7); const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.4); g.gain.linearRampToValueAtTime(0, t + 1.6);
    bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(500, t + 1.6);
    s.connect(bp); bp.connect(g); g.connect(this.listener.getInput()); s.start(t); s.stop(t + 1.7);
  }
  stinger() {
    // a low, almost subliminal swell when the phone first buzzes
    const t = this.ctx.currentTime;
    [55, 82.4].forEach((f) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.gain(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 3); g.gain.linearRampToValueAtTime(0, t + 9);
      o.connect(g); g.connect(this.listener.getInput()); o.start(t); o.stop(t + 9.2);
    });
  }
  fridgeDoor(open: boolean) {
    const e = this.emit.fridge; if (!e) return;
    if (open) {
      this.burst(e.input, { f: 260, type: 'lowpass', dur: 0.16, vol: 0.5, buf: this.brown });
      this.burst(e.input, { f: 1800, q: 1.5, dur: 0.1, vol: 0.22, delay: 0.02 });
      this.burst(e.input, { f: 5200, q: 0.8, dur: 0.3, vol: 0.05, delay: 0.05 });
    } else {
      this.burst(e.input, { f: 120, type: 'lowpass', dur: 0.3, vol: 1.0, buf: this.brown, delay: 0.38 });
      this.burst(e.input, { f: 1300, q: 1.2, dur: 0.06, vol: 0.3, delay: 0.38 });
      this.burst(e.input, { f: 4000, q: 1, dur: 0.1, vol: 0.06, delay: 0.42 });
    }
  }
  beep() { const e = this.emit.fridge; if (!e) return; this.tone(e.input, 2300, 0.14, 0.05); this.tone(e.input, 2300, 0.14, 0.05, 0.22); }
  chairRoll() {
    const d = this.listener.getInput();
    this.burst(d, { f: 240, type: 'lowpass', dur: 0.9, vol: 0.14, buf: this.brown });
    for (let i = 0; i < 6; i++) this.burst(d, { f: 2600 + Math.random() * 1500, q: 2, dur: 0.02, vol: 0.03, delay: 0.1 + i * 0.13 + Math.random() * 0.05 });
  }
  sit() {
    const t = this.ctx.currentTime, d = this.listener.getInput();
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(190, t); o.frequency.linearRampToValueAtTime(128, t + 0.45);
    const bp = this.filt('bandpass', 600, 3); const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022, t + 0.08); g.gain.linearRampToValueAtTime(0, t + 0.5);
    o.connect(bp); bp.connect(g); g.connect(d); o.start(t); o.stop(t + 0.55);
    this.burst(d, { f: 130, type: 'lowpass', dur: 0.3, vol: 0.35, buf: this.brown });
    this.sigh();
  }
  typing() {
    const e = this.emit.laptop; if (!e) return;
    for (let i = 0; i < 7; i++) {
      const dl = i * 0.075 + Math.random() * 0.04;
      this.burst(e.input, { f: 3400 + Math.random() * 1200, q: 2, dur: 0.018, vol: 0.35, delay: dl });
      this.tone(e.input, 180 + Math.random() * 60, 0.03, 0.12, dl);
    }
  }
  tick() { const e = this.emit.clock; if (!e) return; this.burst(e.input, { f: 2400, q: 4, dur: 0.012, vol: 0.12 }); }
  /** Silences (or restores) everything the room plays. */
  setMuted(muted: boolean) { this.listener.setMasterVolume(muted ? 0 : 1); }
  dispose() { this.timers.forEach(clearTimeout); this.ctx.close(); }
}

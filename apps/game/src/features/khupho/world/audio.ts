import * as THREE from 'three';
import type { Sfx } from './types';
import { clamp, lerp } from './util';

/** Recorded street ambience shared with the main menu (traffic, scooters, voices). */
const STREET_AMBIENT_URL = '/assets/audio/menu_ambient.mp3';
/** Recorded rain bed and thunder clap (owner-supplied). */
const RAIN_URL = '/audio/rain.mp3';
const THUNDER_URL = '/audio/thunder.mp3';

type Loop = { stop: () => void; panner: PannerNode | null; gain: GainNode; on: boolean; kind: string };

export class AudioSys implements Sfx {
  ac: AudioContext | null = null;
  master!: GainNode; outBus!: GainNode; outLP!: BiquadFilterNode; inBus!: GainNode;
  noiseBuf!: AudioBuffer; brownBuf!: AudioBuffer;
  loops = new Map<string, Loop>();
  amb: Record<string, GainNode> = {};
  muted = false; volume = 0.8;
  /** Outdoor sound level while a voice line plays (1 = no ducking). */
  duck = 1;
  private birdT = 2;
  private lastHorn = 0;

  /** Releases the AudioContext so sound stops when the player leaves the route. */
  dispose() { try { void this.ac?.close(); } catch { /* ignore */ } this.ac = null; }

  start() {
    if (this.ac) { this.ac.resume(); return; }
    const ac = this.ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.master = ac.createGain(); this.master.gain.value = this.volume; this.master.connect(ac.destination);
    this.outLP = ac.createBiquadFilter(); this.outLP.type = 'lowpass'; this.outLP.frequency.value = 14000;
    this.outBus = ac.createGain(); this.outBus.connect(this.outLP); this.outLP.connect(this.master);
    this.inBus = ac.createGain(); this.inBus.connect(this.master);
    const mk = (type: 'white' | 'brown') => {
      const b = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = b.getChannelData(0); let l = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (type === 'white') d[i] = w; else { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } }
      return b;
    };
    this.noiseBuf = mk('white'); this.brownBuf = mk('brown');
    const src = (buf: AudioBuffer) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const chain = (name: string, buf: AudioBuffer, nodes: AudioNode[], to: AudioNode = this.outBus) => {
      const g = ac.createGain(); g.gain.value = 0; let n: AudioNode = src(buf); for (const x of nodes) { n.connect(x); n = x; } n.connect(g); g.connect(to); this.amb[name] = g; return g;
    };
    const lp = (f: number) => { const b = ac.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; return b; };
    // Traffic and city murmur come from the main menu's recorded street ambience instead of
    // synthesized noise and engine drones. It goes through the outdoor bus, so it is muffled indoors.
    const street = ac.createGain(); street.gain.value = 0; street.connect(this.outBus); this.amb.street = street;
    fetch(STREET_AMBIENT_URL)
      .then((res) => res.arrayBuffer())
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => { if (this.ac !== ac) return; const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(street); s.start(); })
      .catch((err) => console.warn('[khupho] street ambience failed to load', err));
    // The synthesized crickets, cicadas and rain hiss were removed (owner: too harsh). Rain is now a
    // low, soft rumble far under the street recording, and the room tone a faint hum.
    // Rain: the recorded bed through the outdoor bus (muffled indoors by the same low-pass).
    const rainG = ac.createGain(); rainG.gain.value = 0; rainG.connect(this.outBus); this.amb.rain = rainG;
    const load = (url: string) => fetch(url).then((r) => r.arrayBuffer()).then((d) => ac.decodeAudioData(d));
    load(RAIN_URL)
      .then((buf) => { if (this.ac !== ac) return; const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(rainG); s.start(0, Math.random() * Math.max(0, buf.duration - 1)); })
      .catch((err) => console.warn('[khupho] rain sound failed to load', err));
    load(THUNDER_URL).then((buf) => { if (this.ac === ac) this.thunderBuf = buf; }).catch((err) => console.warn('[khupho] thunder sound failed to load', err));
    chain('room', this.brownBuf, [lp(160)], this.inBus);
  }
  private thunderBuf: AudioBuffer | null = null;
  /** One thunder clap at `level` (0..1); a little slower and darker for distant strikes. */
  thunder(level: number) {
    const ac = this.ac, buf = this.thunderBuf;
    if (!ac || !buf || this.muted) return;
    const s = ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.85 + 0.25 * level;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + 6000 * level;
    const g = ac.createGain(); g.gain.value = 0.35 + 0.65 * level;
    s.connect(f); f.connect(g); g.connect(this.outBus); s.start();
  }
  /** Lowers rain, street and thunder under a voice line (`on`), and brings them back after. */
  setDuck(on: boolean) { this.duck = on ? 0.28 : 1; }
  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m: boolean) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  private burst(opts: { dur: number; type?: BiquadFilterType; f: number; q?: number; f2?: number; vol: number; pos?: THREE.Vector3 | null; attack?: number; toBus?: 'out' | 'in' }) {
    const ac = this.ac!; const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = opts.type ?? 'bandpass'; f.frequency.setValueAtTime(opts.f, t); if (opts.f2) f.frequency.exponentialRampToValueAtTime(opts.f2, t + opts.dur); f.Q.value = opts.q ?? 1;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(opts.vol, t + (opts.attack ?? 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    s.connect(f); f.connect(g); this.route(g, opts.pos, opts.toBus); s.start(t, Math.random() * 3); s.stop(t + opts.dur + 0.05);
  }
  private tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', pos?: THREE.Vector3 | null) {
    const ac = this.ac!, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.route(g, pos); o.start(t); o.stop(t + dur + 0.05);
  }
  private route(n: AudioNode, pos?: THREE.Vector3 | null, bus: 'out' | 'in' = 'in') {
    const ac = this.ac!;
    if (pos) { const p = ac.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 1.5; p.rolloffFactor = 1.6; p.setPosition?.(pos.x, pos.y, pos.z); if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } n.connect(p); p.connect(bus === 'out' ? this.outBus : this.master); }
    else n.connect(this.master);
  }

  play(kind: string, pos?: THREE.Vector3) {
    if (!this.ac || this.muted) return; const p = pos ?? null;
    switch (kind) {
      case 'click': this.burst({ dur: 0.04, f: 2600, q: 3, vol: 0.25, pos: p }); this.tone(1700, 900, 0.03, 0.06, 'square', p); break;
      case 'dooropen': this.burst({ dur: 0.5, f: 380, f2: 240, q: 4, vol: 0.12, pos: p, attack: 0.1 }); this.tone(150, 105, 0.45, 0.04, 'sawtooth', p); this.burst({ dur: 0.05, f: 1200, q: 2, vol: 0.2, pos: p }); break;
      case 'doorclose': this.tone(100, 45, 0.18, 0.35, 'sine', p); this.burst({ dur: 0.07, f: 900, q: 1, vol: 0.28, pos: p }); break;
      case 'shutter': this.burst({ dur: 1.5, f: 900, f2: 700, q: 1.5, vol: 0.18, pos: p, attack: 0.05 }); this.burst({ dur: 1.4, f: 2400, q: 2, vol: 0.06, pos: p }); break;
      case 'flush': this.burst({ dur: 3, f: 900, f2: 400, type: 'lowpass', q: 0.5, vol: 0.22, pos: p, attack: 0.4 }); break;
      case 'fridge': this.tone(120, 70, 0.2, 0.2, 'sine', p); this.burst({ dur: 0.1, f: 700, vol: 0.1, pos: p }); break;
      case 'horn': this.tone(420, 415, 0.35, 0.12, 'square', p); this.tone(520, 515, 0.35, 0.1, 'square', p); break;
    }
  }
  step(surface: string, run: boolean) {
    if (!this.ac) return; const v = run ? 0.3 : 0.2;
    if (surface === 'wood') { this.burst({ dur: 0.09, type: 'lowpass', f: 700, vol: v * 1.2 }); this.tone(130, 90, 0.08, v * 0.4); if (Math.random() < 0.18) this.tone(380, 330, 0.12, 0.02, 'sawtooth'); }
    else if (surface === 'tile') { this.burst({ dur: 0.05, f: 2200, q: 1.5, vol: v * 0.8 }); this.burst({ dur: 0.08, type: 'lowpass', f: 500, vol: v * 0.5 }); }
    else this.burst({ dur: 0.08, f: 900, q: 0.8, vol: v * 0.7 });
  }
  horn(pos: THREE.Vector3) { const n = performance.now(); if (n - this.lastHorn > 6000) { this.lastHorn = n; this.play('horn', pos); } }

  loop(id: string, kind: string, pos: THREE.Vector3 | null, on: boolean) {
    if (!this.ac) return;
    const ex = this.loops.get(id);
    if (ex) { if (ex.on === on) return; if (!on) { ex.on = false; ex.gain.gain.setTargetAtTime(0, this.ac.currentTime, 0.1); setTimeout(() => !ex.on && ex.stop(), 600); this.loops.delete(id); return; } }
    if (!on) return;
    const ac = this.ac, g = ac.createGain(); g.gain.value = 0;
    let panner: PannerNode | null = null;
    if (pos) { panner = ac.createPanner(); panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse'; panner.refDistance = 1.2; panner.rolloffFactor = 2.0; panner.maxDistance = 30; if (panner.positionX) { panner.positionX.value = pos.x; panner.positionY.value = pos.y; panner.positionZ.value = pos.z; } }
    g.connect(panner ?? this.master); panner?.connect(this.master);
    const stops: (() => void)[] = [];
    const noise = (buf = this.noiseBuf) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2); stops.push(() => s.stop()); return s; };
    const flt = (t: BiquadFilterType, f: number, q = 1) => { const b = ac.createBiquadFilter(); b.type = t; b.frequency.value = f; b.Q.value = q; return b; };
    const osc = (f: number, t: OscillatorType = 'sine') => { const o = ac.createOscillator(); o.type = t; o.frequency.value = f; o.start(); stops.push(() => o.stop()); return o; };
    let vol = 0.05;
    let timer: number | undefined;
    switch (kind) {
      case 'fan': { const n = noise(), f = flt('bandpass', 420, 0.8); n.connect(f); f.connect(g); const l = osc(9); const lg = ac.createGain(); lg.gain.value = 0.02; l.connect(lg); lg.connect(g.gain); vol = 0.06; break; }
      case 'water': { const n = noise(), f = flt('highpass', 1800); n.connect(f); f.connect(g); vol = 0.1; break; }
      case 'shower': { const n = noise(), f = flt('bandpass', 3500, 0.5); n.connect(f); f.connect(g); vol = 0.2; break; }
      case 'gas': { const n = noise(), f = flt('highpass', 3500); n.connect(f); f.connect(g); const b = noise(this.brownBuf); const lf = flt('lowpass', 200); b.connect(lf); lf.connect(g); vol = 0.06; break; }
      case 'ac': { const n = noise(this.brownBuf), f = flt('lowpass', 700); n.connect(f); f.connect(g); vol = 0.1; break; }
      case 'washer': { const n = noise(), f = flt('bandpass', 280, 0.7); n.connect(f); f.connect(g); const l = osc(1.1); const lg = ac.createGain(); lg.gain.value = 0.5; l.connect(lg); lg.connect(g.gain); vol = 0.2; break; }
      case 'tv': {
        const f = flt('bandpass', 1000, 1.3); f.connect(g);
        const pent = [293.7, 329.6, 392, 440, 493.9, 587.3]; let i = 0;
        timer = window.setInterval(() => { if (!this.ac) return; const t = ac.currentTime; const o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle'; o.frequency.value = pent[(i++ * 3 + 1) % 6]; og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.3, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.4); f.frequency.value = 700 + Math.random() * 900; }, 900);
        vol = 0.12; break;
      }
      case 'radio': {
        const f = flt('bandpass', 1400, 0.7); f.connect(g); const pent = [293.7, 329.6, 392, 440, 493.9, 587.3, 659.3]; let idx = 2;
        timer = window.setInterval(() => { if (!this.ac) return; const t = ac.currentTime; idx = clamp(idx + Math.floor(Math.random() * 5) - 2, 0, 6); const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = pent[idx]; og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.35, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.connect(og); og.connect(f); o.start(t); o.stop(t + 1); }, 480);
        vol = 0.18; break;
      }
      default: break;
    }
    g.gain.setTargetAtTime(vol, ac.currentTime, 0.15);
    const L: Loop = { gain: g, panner, on: true, kind, stop: () => { stops.forEach((s) => { try { s(); } catch { /* */ } }); if (timer) clearInterval(timer); g.disconnect(); } };
    this.loops.set(id, L);
  }

  update(dt: number, env: { hour: number; night: number; rain: number; sun: number }, cam: THREE.Camera, indoor: number, open: number, _vehicles?: { pos: THREE.Vector3; speed: number }[]) {
    if (!this.ac) return;
    const ac = this.ac, t = ac.currentTime, L = ac.listener;
    const p = cam.position, f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z; }
    const muffle = indoor * (1 - open * 0.55);
    this.outLP.frequency.setTargetAtTime(lerp(15000, 650, muffle), t, 0.25);
    this.outBus.gain.setTargetAtTime(lerp(1, 0.55, muffle) * this.duck, t, 0.25);
    const day = env.sun, hr = env.hour;
    const rush = Math.max(Math.exp(-Math.pow((hr - 7.5) / 1.3, 2)), Math.exp(-Math.pow((hr - 17.5) / 1.6, 2)));
    const set = (n: string, v: number) => this.amb[n]?.gain.setTargetAtTime(v, t, 0.5);
    set('street', (0.32 + 0.1 * day + 0.08 * rush) * (1 - 0.35 * env.rain));
    set('rain', 0.55 * env.rain);
    set('room', 0.06 * indoor);
    // birds
    this.birdT -= dt;
    if (this.birdT < 0) {
      this.birdT = 1.5 + Math.random() * 4;
      const morning = hr > 4.8 && hr < 9.5, eve = hr > 15.5 && hr < 18.5;
      if ((morning || eve) && env.rain < 0.3 && Math.random() < (morning ? 0.9 : 0.5)) {
        const pos = new THREE.Vector3(p.x + (Math.random() - 0.5) * 30, 6 + Math.random() * 6, p.z + (Math.random() - 0.5) * 30);
        const base = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) setTimeout(() => this.ac && this.tone(base * (1 + Math.random() * 0.3), base * (0.7 + Math.random() * 0.8), 0.09 + Math.random() * 0.06, 0.05 * (1 - muffle * 0.6), 'sine', pos), i * 130);
      }
    }
  }
}

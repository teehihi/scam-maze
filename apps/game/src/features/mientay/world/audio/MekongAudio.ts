export class MekongAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private cricketGain: GainNode | null = null;
  private wakeGain: GainNode | null = null;
  private enabled = false;

  toggle(): boolean {
    if (!this.ctx) {
      this.init();
    }
    this.enabled = !this.enabled;
    if (this.ctx && this.ctx.state === 'suspended' && this.enabled) {
      void this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.32 : 0.0, this.ctx.currentTime, 0.25);
    }
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Switches the ambience on or off explicitly (the first call needs a user gesture). */
  setEnabled(on: boolean): void {
    if (on !== this.enabled) this.toggle();
  }

  /** Suspends the audio context while the tab is hidden, so nothing runs in the background. */
  pause(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.enabled && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private init(): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // 2-second looping brown/pink noise buffer
    const sr = ctx.sampleRate;
    const len = sr * 3;
    const buffer = ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 2.8;
    }

    // 1. River lapping layer
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = buffer;
    waterSrc.loop = true;

    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = 'bandpass';
    waterFilter.frequency.value = 340;
    waterFilter.Q.value = 0.7;

    const waterLfo = ctx.createOscillator();
    waterLfo.frequency.value = 0.24;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    waterLfo.connect(lfoGain);
    lfoGain.connect(waterFilter.frequency);

    const wGain = ctx.createGain();
    wGain.gain.value = 0.28;
    waterSrc.connect(waterFilter);
    waterFilter.connect(wGain);
    wGain.connect(master);
    waterSrc.start();
    waterLfo.start();
    this.waterGain = wGain;

    // 2. Boat wake / paddling rush layer
    const wakeSrc = ctx.createBufferSource();
    wakeSrc.buffer = buffer;
    wakeSrc.loop = true;
    const wakeFilter = ctx.createBiquadFilter();
    wakeFilter.type = 'lowpass';
    wakeFilter.frequency.value = 620;
    const wkGain = ctx.createGain();
    wkGain.gain.value = 0.0;
    wakeSrc.connect(wakeFilter);
    wakeFilter.connect(wkGain);
    wkGain.connect(master);
    wakeSrc.start();
    this.wakeGain = wkGain;

    // 3. Soft twilight cricket harmonic shimmer
    const cricketOsc = ctx.createOscillator();
    cricketOsc.type = 'sine';
    cricketOsc.frequency.value = 4150;
    const cricketMod = ctx.createOscillator();
    cricketMod.frequency.value = 14;
    const modDepth = ctx.createGain();
    modDepth.gain.value = 0.012;
    const cGain = ctx.createGain();
    cGain.gain.value = 0.0;
    cricketMod.connect(modDepth);
    modDepth.connect(cGain.gain);
    cricketOsc.connect(cGain);
    cGain.connect(master);
    cricketOsc.start();
    cricketMod.start();
    this.cricketGain = cGain;
  }

  update(nightFactor: number, boatSpeed: number, distToWater: number): void {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (this.waterGain) {
      const proximity = Math.max(0.18, 1.0 - Math.min(distToWater, 45) / 55);
      this.waterGain.gain.setTargetAtTime(0.28 * proximity, now, 0.2);
    }
    if (this.wakeGain) {
      const wakeVol = Math.min(0.45, Math.abs(boatSpeed) * 0.055);
      this.wakeGain.gain.setTargetAtTime(wakeVol, now, 0.15);
    }
    if (this.cricketGain) {
      this.cricketGain.gain.setTargetAtTime(nightFactor * 0.025, now, 0.4);
    }
  }

  dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

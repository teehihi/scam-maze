export class HueAmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private muted = true;
  private initialized = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public initIfNeeded() {
    if (this.initialized) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);

    // Filtered noise for Hương River water & pine forest wind
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 2.8;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.28;

    src.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    src.start();

    this.initialized = true;
  }

  public setMuted(nextMuted: boolean) {
    this.muted = nextMuted;
    if (!nextMuted) {
      this.initIfNeeded();
      if (this.ctx?.state === 'suspended') {
        void this.ctx.resume();
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        nextMuted ? 0 : 0.65,
        this.ctx.currentTime,
        0.25,
      );
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Synthesizes the deep 2-ton bronze Đại Hồng Chung resonance of Chùa Thiên Mụ */
  public ringDaiHongChung() {
    if (this.muted) this.setMuted(false);
    this.initIfNeeded();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();

    const now = this.ctx.currentTime;
    const partials = [
      { freq: 112, gain: 0.38, dur: 9.5 },
      { freq: 224, gain: 0.24, dur: 7.2 },
      { freq: 268.8, gain: 0.19, dur: 6.0 },
      { freq: 403, gain: 0.11, dur: 4.5 },
      { freq: 558, gain: 0.06, dur: 3.0 },
    ];

    partials.forEach((p) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.freq, now);
      // Slight gentle beat decay
      osc.frequency.exponentialRampToValueAtTime(p.freq * 0.996, now + p.dur);

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(p.gain, now + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);

      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + p.dur + 0.05);
    });
  }

  /** Gentle Hue pentatonic chime when entering a new heritage site */
  public playDiscoveryChime() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 587.33, 783.99, 880.0]; // C5 D5 G5 A5 Huế pentatonic
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.14;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.065, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.9);
    });
  }

  public dispose() {
    try {
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // AudioContext close error guard
    }
    this.ctx = null;
    this.masterGain = null;
    this.windGain = null;
    this.initialized = false;
  }
}

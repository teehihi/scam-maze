// Procedural Acoustic Guitar Synthesizer using Web Audio API
class AcousticGuitarAudio {
  private ctx: AudioContext | null = null;

  private init() {
    if (this.ctx) return;
    if (typeof window === "undefined") return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
    }
  }

  // Play a full acoustic guitar chord strum (e.g. D-maj for "Mùa Hạ", or Am for "Nếu Ngày Mai")
  playChord(chordType: "mua-ha" | "ngay-mai", volume = 0.85) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    // Chord string frequencies (Hz)
    // Mùa Hạ Thứ 18 (D major): D3, A3, D4, F#4, A4, D5 (sáng, hoài niệm mùa hạ)
    // Nếu Ngày Mai (Am / C): A2, E3, A3, C4, E4, A4 (ấm áp, bình minh)
    const chords = {
      "mua-ha": [146.83, 220.0, 293.66, 369.99, 440.0, 587.33],
      "ngay-mai": [110.0, 164.81, 220.0, 261.63, 329.63, 440.0],
    };

    const notes = chords[chordType];
    const now = this.ctx.currentTime;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(this.ctx.destination);

    notes.forEach((freq, idx) => {
      // Stagger each string for realistic acoustic strumming delay (38ms)
      const strumTime = now + idx * 0.038;
      this.pluckString(freq, strumTime, masterGain);
    });
  }

  private pluckString(freq: number, when: number, dest: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Dual oscillator: triangle for warm woody acoustic body + sine harmonic for resonance
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = "triangle";
    osc2.type = "sine";
    osc1.frequency.setValueAtTime(freq, when);
    osc2.frequency.setValueAtTime(freq * 2.002, when); // Subtle detune for acoustic shimmer

    // Acoustic body lowpass filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq * 4.5, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 1.1), when + 2.0);
    filter.Q.value = 2.4;

    // Amplitude envelope (fast attack, natural acoustic decay)
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.linearRampToValueAtTime(0.22, when + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 2.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(dest);

    osc1.start(when);
    osc2.start(when);
    osc1.stop(when + 2.6);
    osc2.stop(when + 2.6);
  }
}

export const guitarAudio = new AcousticGuitarAudio();

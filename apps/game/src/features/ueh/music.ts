// UEH Campus ambient sound & audio reactivity state
import type { TrackId } from './tracks'

export class UEHMusicEngine {
  trackId: TrackId | null = null
  playing = false
  ended = false
  bass = 0.25
  mid = 0.35
  high = 0.2
  kick = 0.1
  energy = 0.4
  progress = 0
  elapsed = 0
  dur = 295

  private audioEl: HTMLAudioElement | null = null
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gainNode: GainNode | null = null
  private dataArray: Uint8Array<ArrayBuffer> | null = null

  private initAudio() {
    if (this.audioEl || typeof window === 'undefined') return
    const el = new Audio('/reality/neu-ngay-mai.mp3')
    el.loop = true
    el.crossOrigin = 'anonymous'
    this.audioEl = el

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        this.ctx = ctx
        const src = ctx.createMediaElementSource(el)
        const gain = ctx.createGain()
        gain.gain.value = 0.85
        const an = ctx.createAnalyser()
        an.fftSize = 128
        an.smoothingTimeConstant = 0.8

        src.connect(gain)
        gain.connect(an)
        an.connect(ctx.destination)

        this.gainNode = gain
        this.analyser = an
        this.dataArray = new Uint8Array(an.frequencyBinCount)
      }
    } catch {
      // AudioContext fallback: element plays directly
    }
  }

  setVolume(vol: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime)
    } else if (this.audioEl) {
      this.audioEl.volume = Math.max(0, Math.min(1, vol))
    }
  }

  start(id: TrackId, _delay = 0, _crossfade = 0.08) {
    this.initAudio()
    this.trackId = id
    this.playing = true
    this.ended = false

    if (id === 'ngay-mai' && this.audioEl) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {})
      }
      this.audioEl.play().catch((err) => {
        console.warn('Audio play prevented or waiting for interaction:', err)
      })
    } else if (this.audioEl) {
      this.audioEl.pause()
    }
  }

  stop(_crossfade = 0.1) {
    this.playing = false
    this.trackId = null
    if (this.audioEl) {
      this.audioEl.pause()
    }
  }

  setRain(_vol: number) {
    // rain ambient volume hook
  }

  stepAudio(dt: number) {
    if (!this.playing) return
    this.elapsed += dt

    if (this.analyser && this.dataArray && this.trackId === 'ngay-mai') {
      this.analyser.getByteFrequencyData(this.dataArray)
      const b = (this.dataArray[1] ?? 0) / 255
      const m = (this.dataArray[6] ?? 0) / 255
      const h = (this.dataArray[16] ?? 0) / 255
      this.bass = 0.15 + b * 0.85
      this.mid = 0.15 + m * 0.85
      this.high = 0.1 + h * 0.9
      this.kick = b > 0.65 ? (b - 0.65) * 2.8 : 0
      this.energy = (this.bass + this.mid + this.high) / 3
      if (this.audioEl && this.audioEl.duration) {
        this.progress = this.audioEl.currentTime / this.audioEl.duration
      }
    } else {
      this.progress = (this.elapsed % this.dur) / this.dur
      const t = this.elapsed
      this.bass = 0.2 + 0.15 * Math.sin(t * 1.5)
      this.mid = 0.25 + 0.12 * Math.cos(t * 2.1)
      this.high = 0.18 + 0.1 * Math.sin(t * 3.4)
      this.kick = Math.max(0, Math.sin(t * 3.14)) * 0.3
      this.energy = 0.35 + 0.15 * Math.sin(t * 0.8)
    }
  }
}

export const music = new UEHMusicEngine()

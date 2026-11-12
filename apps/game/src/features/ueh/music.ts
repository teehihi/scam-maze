// UEH Campus ambient sound & audio reactivity state
import { TRACKS, type TrackId } from './tracks'

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

  /** One element per track, created on first play, so a song is only downloaded when it is used. */
  private audioEls = new Map<TrackId, HTMLAudioElement>()
  private audioEl: HTMLAudioElement | null = null
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private gainNode: GainNode | null = null
  private dataArray: Uint8Array<ArrayBuffer> | null = null
  private volume = 0.85
  private initGraph() {
    if (this.ctx || typeof window === 'undefined') return
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const gain = ctx.createGain()
      gain.gain.value = this.volume
      const an = ctx.createAnalyser()
      an.fftSize = 128
      an.smoothingTimeConstant = 0.8
      gain.connect(an)
      an.connect(ctx.destination)
      this.ctx = ctx
      this.gainNode = gain
      this.analyser = an
      this.dataArray = new Uint8Array(an.frequencyBinCount)
    } catch {
      // AudioContext unavailable: elements play directly
    }
  }
  private elementFor(id: TrackId): HTMLAudioElement | null {
    const cached = this.audioEls.get(id)
    if (cached) return cached
    const src = TRACKS[id].audioSrc
    if (!src || typeof window === 'undefined') return null
    this.initGraph()
    const el = new Audio(src)
    el.loop = true
    el.crossOrigin = 'anonymous'
    el.preload = 'auto'
    if (this.ctx && this.gainNode) {
      try {
        this.ctx.createMediaElementSource(el).connect(this.gainNode)
      } catch {
        el.volume = this.volume
      }
    } else {
      el.volume = this.volume
    }
    this.audioEls.set(id, el)
    return el
  }
  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol))
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime)
    } else {
      for (const el of this.audioEls.values()) el.volume = this.volume
    }
  }
  start(id: TrackId, _delay = 0, _crossfade = 0.08) {
    this.trackId = id
    this.playing = true
    this.ended = false
    this.elapsed = 0
    this.dur = TRACKS[id].highlight.dur
    const next = this.elementFor(id)
    // Only one song at a time.
    for (const [otherId, el] of this.audioEls) if (otherId !== id) el.pause()
    this.audioEl = next
    if (!next) return
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    next.play().catch((err) => {
      console.warn('Audio play prevented or waiting for interaction:', err)
    })
  }
  stop(_crossfade = 0.1) {
    this.playing = false
    this.trackId = null
    for (const el of this.audioEls.values()) el.pause()
  }
  setRain(_vol: number) {
    // rain ambient volume hook
  }

  stepAudio(dt: number) {
    if (!this.playing) return
    this.elapsed += dt

    if (this.analyser && this.dataArray && this.audioEl && !this.audioEl.paused) {
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

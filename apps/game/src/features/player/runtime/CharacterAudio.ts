import { CharacterAssetCache, HIT_PUNCH_SOUND_PATH, MISS_PUNCH_SOUND_PATH } from './CharacterAssetCache';

export class CharacterAudio {
  private enabled = true;
  private volume = 1.0;
  private hitAudioFallback: HTMLAudioElement | null = null;
  private missAudioFallback: HTMLAudioElement | null = null;

  constructor(enabled = true, volume = 1.0) {
    this.enabled = enabled;
    this.volume = volume;

    // Eagerly pre-warm audio buffers
    CharacterAssetCache.getAudioBuffers().catch(() => {});

    try {
      this.hitAudioFallback = new Audio(HIT_PUNCH_SOUND_PATH);
      this.hitAudioFallback.volume = Math.min(1.0, 0.7 * this.volume);
      this.missAudioFallback = new Audio(MISS_PUNCH_SOUND_PATH);
      this.missAudioFallback.volume = Math.min(1.0, 0.5 * this.volume);
    } catch {
      // Audio catch in headless / constrained environments
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.hitAudioFallback) this.hitAudioFallback.volume = Math.min(1.0, 0.7 * this.volume);
    if (this.missAudioFallback) this.missAudioFallback.volume = Math.min(1.0, 0.5 * this.volume);
  }

  public playPunchSound(type: 'hit' | 'miss') {
    if (!this.enabled) return;

    CharacterAssetCache.getAudioBuffers()
      .then(({ ctx, hit, miss }) => {
        const buffer = type === 'hit' ? hit : miss;
        if (ctx && buffer) {
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = 0.94 + Math.random() * 0.12;

          const gain = ctx.createGain();
          const baseGain = type === 'hit' ? 0.85 : 0.6;
          gain.gain.value = Math.min(1.0, baseGain * this.volume);

          source.connect(gain);
          gain.connect(ctx.destination);
          source.start(0);
          return;
        }

        // Fallback to HTMLAudioElement
        const el = type === 'hit' ? this.hitAudioFallback : this.missAudioFallback;
        if (el) {
          el.currentTime = 0;
          el.play().catch(() => {});
        }
      })
      .catch(() => {
        const el = type === 'hit' ? this.hitAudioFallback : this.missAudioFallback;
        if (el) {
          el.currentTime = 0;
          el.play().catch(() => {});
        }
      });
  }

  public dispose() {
    this.hitAudioFallback = null;
    this.missAudioFallback = null;
  }
}

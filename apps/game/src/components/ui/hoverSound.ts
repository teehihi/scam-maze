import { loadSettings } from "../../app/settingsStorage";

const HOVER_SRC = "/assets/audio/button_hover.mp3";
const MIN_GAP_MS = 45;

let base: HTMLAudioElement | null = null;
let lastPlayedAt = 0;

/** Plays the menu's button hover tick, following the saved sound toggle and SFX volume. */
export function playUiHoverSound(): void {
  if (typeof window === "undefined" || import.meta.env.MODE === "test") return;
  const now = performance.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  const settings = loadSettings(storage);
  if (!settings.soundEnabled || settings.sfxVolume <= 0) return;
  lastPlayedAt = now;
  if (!base) {
    base = new Audio(HOVER_SRC);
    base.preload = "auto";
  }
  const tick = base.cloneNode(true) as HTMLAudioElement;
  tick.volume = Math.min(1, Math.max(0, settings.sfxVolume));
  tick.play().catch(() => {});
}

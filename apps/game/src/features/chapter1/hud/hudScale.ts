// One HUD scale for every screen. The HUD was authored at 100%; the shipped size is 80% of that at the
// reference viewport (1280 x 720), and it is proportional to the viewport in CSS pixels:
//
//   scale = clamp(HUD_BASE_SCALE * min(width / 1280, height / 720), 0.4, 2.4)
//
// Browser zoom shrinks window.innerWidth / innerHeight by the zoom factor, so a proportional scale keeps the
// HUD at the same fraction of the screen at any zoom (200% zoom of 1280 x 720 is 640 x 360, which gives half
// the scale, and the HUD covers the same share of the picture). The floor (0.5, reached below 800 x 450) keeps
// 12px footer text at 6px or more; it is a trade-off, so zoom beyond about 250% no longer shrinks the HUD
// further. The ceiling (2.4, reached at 3840 x 2160) only guards huge monitors. Rounded to 2 decimals so
// resizing does not re-render on every pixel.
//
// The layout viewport (innerWidth / innerHeight) is used, not visualViewport: browser zoom changes it, while
// pinch zoom and the on-screen keyboard do not, so the HUD (anchored to the layout viewport) is not shrunk
// off screen by a pinch.
import { useEffect, useState, type CSSProperties } from "react";

export const HUD_BASE_SCALE = 0.8;
export const HUD_REFERENCE = { width: 1280, height: 720 } as const;
export const HUD_SCALE_RANGE = { min: 0.5, max: 2.4 } as const;

export function computeHudScale(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return HUD_BASE_SCALE;
  const fit = HUD_BASE_SCALE * Math.min(width / HUD_REFERENCE.width, height / HUD_REFERENCE.height);
  const scale = Math.min(HUD_SCALE_RANGE.max, Math.max(HUD_SCALE_RANGE.min, fit));
  return Math.round(scale * 100) / 100;
}

function read(): number {
  if (typeof window === "undefined") return HUD_BASE_SCALE;
  return computeHudScale(window.innerWidth, window.innerHeight);
}

export function useHudScale(): number {
  const [scale, setScale] = useState(read);
  useEffect(() => {
    const update = () => setScale(read());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

/** The main menu was tuned at 1024 x 551; its own scale is 1 there and follows the HUD scale from it. */
export const MENU_REFERENCE_SCALE = computeHudScale(1024, 551);

export type HudScaleOrigin =
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right"
  | "top center"
  | "bottom center";

/** Scale a HUD block around the screen edge or corner it is anchored to. */
export function hudScaleStyle(scale: number, origin: HudScaleOrigin): CSSProperties {
  return { transform: `scale(${scale})`, transformOrigin: origin };
}

/** A fixed pixel offset that sits next to a scaled block, scaled with it so the two never overlap. */
export function hudOffset(px: number, scale: number): number {
  return Math.round(px * scale * 100) / 100;
}

// One HUD scale for every screen. The HUD was authored at 100%; the shipped size is 80% of that at the
// reference viewport (1280 x 720), and it follows the viewport so a laptop, a 1080p monitor and a small
// window show the same proportion of the picture instead of the same pixel size.
//
//   scale = HUD_BASE_SCALE * clamp(min(width / 1280, height / 720), 0.8, 1.25)
//
// So the result stays between 0.64 (small windows, at or below about 1024 x 576) and 1.0 (large monitors,
// at or above 1600 x 900). Rounded to 2 decimals so resizing does not re-render on every pixel.
import { useEffect, useState, type CSSProperties } from "react";

export const HUD_BASE_SCALE = 0.8;
export const HUD_REFERENCE = { width: 1280, height: 720 } as const;
export const HUD_FACTOR_RANGE = { min: 0.8, max: 1.25 } as const;

export function computeHudScale(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return HUD_BASE_SCALE;
  const fit = Math.min(width / HUD_REFERENCE.width, height / HUD_REFERENCE.height);
  const factor = Math.min(HUD_FACTOR_RANGE.max, Math.max(HUD_FACTOR_RANGE.min, fit));
  return Math.round(HUD_BASE_SCALE * factor * 100) / 100;
}

function read(): number {
  return typeof window === "undefined" ? HUD_BASE_SCALE : computeHudScale(window.innerWidth, window.innerHeight);
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

/** Scale a HUD block around the screen corner it is anchored to. */
export function hudScaleStyle(scale: number, origin: "top left" | "top right" | "bottom left" | "bottom right"): CSSProperties {
  return { transform: `scale(${scale})`, transformOrigin: origin };
}

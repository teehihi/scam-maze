// Unified cinema-grade street HUD elements shared by Chapter 1 outdoors and /testbus:
// 1. `DistrictArrivalBanner` — GTA/RDR2-style smooth location title card on zone transitions
//    (dissolves cleanly after ~3.8s so the Saigon sky stays unobstructed).
// 2. `StreetActionPrompt` — crisp diegetic keycap + verb + optional context subtitle
//    (eliminates raw "[E] ..." bracket strings and unifies indoor/outdoor prompt hierarchy).
import React, { useEffect, useRef, useState } from "react";
import { CloudDrizzle, CloudRain, CloudSun, Sun } from "lucide-react";
import type { WeatherPreset } from "./world/AtmosphereSystem";

const FILM_SHADOW: React.CSSProperties = {
  textShadow: "0 2px 10px rgba(0,0,0,0.92), 0 1px 2px rgba(0,0,0,1)",
};

export interface ParsedPrompt {
  key: string | null;
  primary: string;
  secondary: string | null;
}

/**
 * Parses engine prompt strings like:
 * - "[E] Nói chuyện với chú Tuấn (Chủ trọ 462/14)" -> { key: "E", primary: "Nói chuyện với chú Tuấn", secondary: "Chủ trọ 462/14" }
 * - "[F] Xác nhận lên xe buýt" -> { key: "F", primary: "Xác nhận lên xe buýt", secondary: null }
 * - "Đang chờ xe buýt Tuyến 06..." -> { key: null, primary: "Đang chờ xe buýt Tuyến 06...", secondary: null }
 */
export function parseStreetPrompt(raw: string): ParsedPrompt {
  let text = raw.trim();
  let key: string | null = null;
  const keyMatch = text.match(/^\[([A-Za-z0-9/ ]+)\]\s*(.+)$/);
  if (keyMatch) {
    key = keyMatch[1].trim();
    text = keyMatch[2].trim();
  }

  let primary = text;
  let secondary: string | null = null;
  const parenMatch = text.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (parenMatch) {
    primary = parenMatch[1].trim();
    secondary = parenMatch[2].trim();
  } else {
    const dotSplit = text.split(" · ");
    if (dotSplit.length === 2 && dotSplit[0].trim().length > 0 && dotSplit[1].trim().length > 0) {
      primary = dotSplit[0].trim();
      secondary = dotSplit[1].trim();
    }
  }

  return { key, primary, secondary };
}

export interface StreetActionPromptProps {
  prompt: string;
  /** Optional override for vertical offset (Tailwind bottom class). */
  bottomClass?: string;
}

export const StreetActionPrompt: React.FC<StreetActionPromptProps> = ({
  prompt,
  bottomClass = "bottom-[19%]",
}) => {
  const { key, primary, secondary } = parseStreetPrompt(prompt);
  return (
    <div
      data-testid="street-action-prompt"
      className={`pointer-events-none absolute left-1/2 -translate-x-1/2 ${bottomClass} flex flex-col items-center`}
    >
      <div className="flex items-center gap-2.5 rounded-md border border-white/15 bg-[#100f18]/72 px-3.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.55)] backdrop-blur-md">
        {key && (
          <kbd
            aria-hidden="true"
            className="inline-flex min-w-[1.5rem] items-center justify-center rounded-[4px] border border-lavender/60 bg-lavender/15 px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-lilac shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
          >
            {key}
          </kbd>
        )}
        <div className="flex flex-col leading-tight">
          <span
            className="font-menu text-[15px] font-semibold tracking-[0.04em] text-[#f3efe4]"
            style={FILM_SHADOW}
          >
            {primary}
          </span>
          {secondary && (
            <span className="mt-0.5 text-[11px] font-medium tracking-[0.06em] text-lilac/80">
              {secondary}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export interface DistrictArrivalBannerProps {
  zone: string | null;
  district?: string | null;
  weather?: WeatherPreset | null;
  /** Suppresses the banner (e.g. during active cinema conversation). */
  hidden?: boolean;
  /** Auto-hide duration in milliseconds (default 3800ms). */
  holdMs?: number;
}

const WEATHER_ICON: Record<WeatherPreset, React.FC<{ className?: string }>> = {
  clear: Sun,
  overcast: CloudSun,
  drizzle: CloudDrizzle,
  monsoon: CloudRain,
};

/**
 * Cinema location card that glides in briefly whenever the player crosses into a new Saigon
 * zone/street, then dissolves cleanly away so the viewport stays unobstructed.
 */
export const DistrictArrivalBanner: React.FC<DistrictArrivalBannerProps> = ({
  zone,
  district,
  weather,
  hidden = false,
  holdMs = 3800,
}) => {
  const [phase, setPhase] = useState<"hidden" | "shown" | "fading">("hidden");
  const [display, setDisplay] = useState<{ zone: string; district: string | null } | null>(null);
  const lastZoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!zone) {
      lastZoneRef.current = null;
      setPhase("hidden");
      return;
    }
    if (zone === lastZoneRef.current) return;
    lastZoneRef.current = zone;
    setDisplay({ zone, district: district ?? null });
    setPhase("shown");

    // In test environments, keep it visible immediately without async timers flickering.
    if (import.meta.env.MODE === "test") return;

    const fadeTimer = window.setTimeout(() => setPhase("fading"), holdMs);
    const hideTimer = window.setTimeout(() => setPhase("hidden"), holdMs + 700);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [zone, district, holdMs]);

  if (hidden || !display || phase === "hidden") return null;

  const WeatherIcon = weather ? WEATHER_ICON[weather] : null;

  return (
    <div
      data-testid="district-arrival-banner"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-6 z-20 flex flex-col items-center transition-all duration-700 ease-out"
      style={{
        opacity: phase === "shown" ? 1 : 0,
        transform: phase === "shown" ? "translateY(0)" : "translateY(-6px)",
      }}
    >
      {display.district && (
        <div
          className="flex items-center gap-1.5 font-menu text-[11px] font-semibold uppercase tracking-[0.28em] text-[#c9bbf7]/90"
          style={FILM_SHADOW}
        >
          {WeatherIcon && <WeatherIcon className="h-3 w-3 text-lilac/80" />}
          <span>{display.district}</span>
        </div>
      )}
      <p
        className="mt-0.5 font-menu text-xl font-bold uppercase tracking-[0.12em] text-[#f3efe4]"
        style={FILM_SHADOW}
      >
        {display.zone}
      </p>
      <div className="mt-1.5 h-px w-28 bg-gradient-to-r from-transparent via-[#f3efe4]/45 to-transparent" />
    </div>
  );
};

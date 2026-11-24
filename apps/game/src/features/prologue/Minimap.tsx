import React, { useEffect, useRef } from "react";
import { SignalZero } from "lucide-react";
import type { MapData } from "../khupho/world/questLayer";

export interface MinimapPose { x: number; z: number; yaw: number }

export interface MinimapProps {
  /** Player position and yaw each frame (null before the world is ready). */
  getPose: () => MinimapPose | null;
  /** Roads and house footprints; null draws an empty disc. */
  map: MapData | null;
  /** Where the tracked quest leads (world x, z), or null. */
  getTarget: () => { x: number; z: number } | null;
  /** Accessible name of the map and the letter for north, already translated. */
  label: string;
  north: string;
  /** Diameter in CSS px. */
  size?: number;
  /** Meters from the center to the edge of the disc. */
  radiusM?: number;
}

const COLORS = {
  ground: "#1c1b28",
  road: "#3b3a4a",
  walk: "#4d4b5e",
  alley: "#434254",
  court: "#4a4a60",
  house: "#7a7391",
  houseEdge: "#a79fc4",
};

const QUEST_ICON = "/assets/ui/hud/scammaze-quest-icon-512.png";

/**
 * Circular minimap in the top-left, like an action game's: it turns with the camera (what is
 * ahead is up), the player is the arrow in the middle, and the tracked quest is a diamond that
 * sticks to the rim when it is farther than the map shows. Drawn on a canvas every frame from the
 * engine's player pose.
 */
export const Minimap: React.FC<MinimapProps> = ({ getPose, map, getTarget, label, north, size = 148, radiusM = 38 }) => {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const live = useRef({ getPose, getTarget, map });
  live.current = { getPose, getTarget, map };

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);
    const icon = new Image();
    icon.src = QUEST_ICON;
    const r = size / 2;
    const scale = r / radiusM;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const pose = live.current.getPose();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(0, 0, size, size);
      if (pose) {
        // Forward (what the camera faces) and its right-hand side, on the ground plane. yaw 0 faces -z.
        const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw);
        const rx = -fz, rz = fx;
        const sx = (x: number, z: number) => r + ((x - pose.x) * rx + (z - pose.z) * rz) * scale;
        const sy = (x: number, z: number) => r - ((x - pose.x) * fx + (z - pose.z) * fz) * scale;
        const data = live.current.map;
        if (data) {
          for (const rect of data.rects) {
            ctx.fillStyle = COLORS[rect.kind];
            ctx.beginPath();
            const c: [number, number][] = [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x1, rect.z1], [rect.x0, rect.z1]];
            c.forEach(([x, z], i) => (i ? ctx.lineTo(sx(x, z), sy(x, z)) : ctx.moveTo(sx(x, z), sy(x, z))));
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = COLORS.house;
          ctx.strokeStyle = COLORS.houseEdge;
          ctx.lineWidth = 1;
          for (const poly of data.houses) {
            ctx.beginPath();
            poly.forEach(([x, z], i) => (i ? ctx.lineTo(sx(x, z), sy(x, z)) : ctx.moveTo(sx(x, z), sy(x, z))));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
        const target = live.current.getTarget();
        if (target) {
          let tx = sx(target.x, target.z), ty = sy(target.x, target.z);
          const dx = tx - r, dy = ty - r, d = Math.hypot(dx, dy), edge = r - 13;
          if (d > edge) { tx = r + (dx / d) * edge; ty = r + (dy / d) * edge; }
          if (icon.complete && icon.naturalWidth) ctx.drawImage(icon, tx - 10, ty - 10, 20, 20);
          else { ctx.fillStyle = "#b9a5f5"; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      // The player: an arrow pointing up (the map turns, the arrow does not).
      ctx.fillStyle = "#cdbcff";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r, r - 9);
      ctx.lineTo(r + 6.5, r + 7);
      ctx.lineTo(r, r + 3.5);
      ctx.lineTo(r - 6.5, r + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // North letter on the rim.
      if (pose) {
        const fx = -Math.sin(pose.yaw), fz = -Math.cos(pose.yaw);
        const a = -fx * (r - 11), b = -fz * (r - 11); // north is -z: its right and forward parts on screen
        ctx.fillStyle = "#f3efe4";
        ctx.font = "600 11px 'Barlow Condensed', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(north, r + a, r - b);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, radiusM, north]);

  return (
    <div
      role="img"
      aria-label={label}
      className="pointer-events-none relative shrink-0 rounded-full border-2 border-[#f3efe4]/70 bg-black/40 shadow-[0_0_0_3px_rgba(0,0,0,0.35),0_4px_18px_rgba(0,0,0,0.6)]"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvas} aria-hidden="true" style={{ width: size, height: size }} className="rounded-full" />
    </div>
  );
};

export interface NoSignalMinimapProps {
  /** Accessible name and visible text, already translated. */
  label: string;
  size?: number;
}

/** The minimap disc indoors: same frame as the street minimap, with quiet radar rings and indoor standby label. */
export const NoSignalMinimap: React.FC<NoSignalMinimapProps> = ({ label, size = 148 }) => (
  <div
    role="img"
    aria-label={label}
    data-testid="minimap-no-signal"
    className="pointer-events-none relative flex shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-full border-2 border-[#f3efe4]/55 bg-[#12101c]/82 shadow-[0_0_0_3px_rgba(0,0,0,0.35),0_4px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm"
    style={{ width: size, height: size }}
  >
    {/* Subtle concentric radar standby rings so indoors feels intentional rather than broken */}
    <span aria-hidden="true" className="absolute inset-4 rounded-full border border-white/[0.06]" />
    <span aria-hidden="true" className="absolute inset-9 rounded-full border border-white/[0.05]" />
    <SignalZero className="relative h-5 w-5 text-[#a9a4c4]/80" aria-hidden="true" />
    <span aria-hidden="true" className="relative px-4 text-center font-menu text-[11px] font-semibold uppercase leading-tight tracking-[0.2em] text-[#a9a4c4]/85">
      {label}
    </span>
  </div>
);

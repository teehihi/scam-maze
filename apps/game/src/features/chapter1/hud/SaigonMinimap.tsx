// Live rotating circular Saigon GPS radar for Chapter 1 & the open-world street mode.
// Fits identically inside the circular ring slot of `ChapterStatusCluster`, replacing the
// indoor "No Signal" disc the moment the player steps out of Room 6.07 onto Hẻm 462/14.
import React, { useEffect, useRef } from "react";
import type { StoryNpcRadarBlip } from "../../testbus/openworld/simulation/storyNpcs";

export interface SaigonRadarData {
  position: { x: number; z: number };
  /** Clockwise heading in degrees where 0 = north (-Z). */
  headingDeg: number;
  busPosition?: { x: number; z: number } | null;
  npcBlips?: readonly StoryNpcRadarBlip[];
  zone?: string | null;
  district?: string | null;
}

export interface SaigonMinimapProps {
  radar: SaigonRadarData;
  /** Accessible label. */
  label: string;
  /** North compass letter (default "N"). */
  north?: string;
  /** Diameter in CSS px (matches `ChapterStatusHud` DISC = 148). */
  size?: number;
  /** Visible radar radius in metres. */
  radiusM?: number;
}

interface RoadSegment {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  widthM: number;
  kind: "avenue" | "alley" | "boulevard";
}

// Architectural Saigon street layout matching `OpenWorldEngine`, `boardingHouse`, and `saigonDistricts`.
const SAIGON_ROADS: readonly RoadSegment[] = [
  // Lý Thái Tổ & Northern Riverside Avenue
  { x0: -6, z0: 42, x1: -6, z1: -365, widthM: 12, kind: "avenue" },
  // Hẻm 462/14 Lý Thái Tổ into the boarding-house courtyard
  { x0: -2, z0: -11.2, x1: 23, z1: -11.2, widthM: 4.8, kind: "alley" },
  { x0: 20.5, z0: -11.2, x1: 20.5, z1: -19.5, widthM: 5.5, kind: "alley" },
  // East Boulevards (3/2 & District 1 approach)
  { x0: -6, z0: -76, x1: 126, z1: -76, widthM: 11, kind: "boulevard" },
  { x0: -6, z0: -147, x1: 126, z1: -147, widthM: 11, kind: "boulevard" },
  // Hải Triều connector toward Bitexco
  { x0: 56, z0: -72, x1: 56, z1: -242, widthM: 9.5, kind: "boulevard" },
  { x0: 56, z0: -186, x1: 118, z1: -186, widthM: 8.5, kind: "boulevard" },
  // Riverside promenade toward Landmark 81
  { x0: -6, z0: -348, x1: 68, z1: -348, widthM: 9.5, kind: "boulevard" },
];

const LANDMARKS = [
  { id: "room", x: 22, z: -16.8, color: "#b9a5f5", label: "6.07" },
  { id: "bitexco", x: 94, z: -186, color: "#b9a5f5", label: "Q.1" },
  { id: "landmark81", x: 26, z: -356, color: "#38bdf8", label: "L81" },
] as const;

const COLORS = {
  bg: "#13121e",
  block: "#1d1b2c",
  river: "#14263b",
  avenue: "#3d3c52",
  boulevard: "#343348",
  alley: "#4c465c",
  centerline: "rgba(243, 239, 228, 0.14)",
  grid: "rgba(185, 165, 245, 0.06)",
};

function lerpAngleRad(from: number, to: number, alpha: number): number {
  let diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * alpha;
}

export const SaigonMinimap: React.FC<SaigonMinimapProps> = ({
  radar,
  label,
  north = "N",
  size = 148,
  radiusM = 58,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef(radar);
  liveRef.current = radar;

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext?.("2d");
    if (!cv || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr);
    cv.height = Math.round(size * dpr);

    const r = size / 2;
    const scale = r / radiusM;
    let smoothX = liveRef.current.position.x;
    let smoothZ = liveRef.current.position.z;
    let smoothYaw = (-liveRef.current.headingDeg * Math.PI) / 180;
    let raf = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const cur = liveRef.current;
      const targetYaw = (-cur.headingDeg * Math.PI) / 180;
      // Smooth 60fps interpolation over 8Hz engine snapshots
      smoothX += (cur.position.x - smoothX) * 0.24;
      smoothZ += (cur.position.z - smoothZ) * 0.24;
      smoothYaw = lerpAngleRad(smoothYaw, targetYaw, 0.24);

      const fx = -Math.sin(smoothYaw);
      const fz = -Math.cos(smoothYaw);
      const rx = -fz;
      const rz = fx;
      const toScreen = (wx: number, wz: number): [number, number] => [
        r + ((wx - smoothX) * rx + (wz - smoothZ) * rz) * scale,
        r - ((wx - smoothX) * fx + (wz - smoothZ) * fz) * scale,
      ];

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
      ctx.clip();

      // Base dark urban surface
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, size, size);

      // Subtle concentric radar distance rings
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      for (const frac of [0.36, 0.7]) {
        ctx.beginPath();
        ctx.arc(r, r, r * frac, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Saigon River water strip along far east & north edge
      const [rw0x, rw0y] = toScreen(116, 40);
      const [rw1x, rw1y] = toScreen(116, -390);
      const [rw2x, rw2y] = toScreen(185, -390);
      const [rw3x, rw3y] = toScreen(185, 40);
      ctx.fillStyle = COLORS.river;
      ctx.beginPath();
      ctx.moveTo(rw0x, rw0y);
      ctx.lineTo(rw1x, rw1y);
      ctx.lineTo(rw2x, rw2y);
      ctx.lineTo(rw3x, rw3y);
      ctx.closePath();
      ctx.fill();

      // Architectural street network
      ctx.lineCap = "round";
      for (const seg of SAIGON_ROADS) {
        const [x0, y0] = toScreen(seg.x0, seg.z0);
        const [x1, y1] = toScreen(seg.x1, seg.z1);
        ctx.strokeStyle =
          seg.kind === "avenue"
            ? COLORS.avenue
            : seg.kind === "alley"
              ? COLORS.alley
              : COLORS.boulevard;
        ctx.lineWidth = Math.max(2.6, seg.widthM * scale);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        if (seg.kind !== "alley") {
          ctx.strokeStyle = COLORS.centerline;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }

      // Subtle forward camera sight cone
      const coneGrad = ctx.createRadialGradient(r, r, 2, r, r, r * 0.56);
      coneGrad.addColorStop(0, "rgba(205, 188, 255, 0.20)");
      coneGrad.addColorStop(1, "rgba(205, 188, 255, 0)");
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(r, r);
      ctx.arc(r, r, r * 0.56, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.closePath();
      ctx.fill();

      // Clamped landmark markers (home 6.07, Bitexco, Landmark 81)
      const edgeR = r - 11;
      for (const lm of LANDMARKS) {
        let [lx, ly] = toScreen(lm.x, lm.z);
        const dx = lx - r;
        const dy = ly - r;
        const dist = Math.hypot(dx, dy);
        const clamped = dist > edgeR;
        if (clamped) {
          lx = r + (dx / dist) * edgeR;
          ly = r + (dy / dist) * edgeR;
        }
        ctx.fillStyle = lm.color;
        ctx.globalAlpha = clamped ? 0.55 : 0.92;
        ctx.beginPath();
        ctx.arc(lx, ly, clamped ? 2.4 : 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Live Bus 06 transit beacon
      if (cur.busPosition) {
        let [bx, by] = toScreen(cur.busPosition.x, cur.busPosition.z);
        const dx = bx - r;
        const dy = by - r;
        const dist = Math.hypot(dx, dy);
        const clamped = dist > edgeR;
        if (clamped) {
          bx = r + (dx / dist) * edgeR;
          by = r + (dy / dist) * edgeR;
        }
        ctx.fillStyle = "#34d399";
        ctx.strokeStyle = "#062b1f";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(bx - 3.5, by - 2.5, 7, 5, 1.5);
        ctx.fill();
        ctx.stroke();
      }

      // Live Story NPC diamonds (subtle lavender pulse when close)
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
      if (cur.npcBlips) {
        for (const npc of cur.npcBlips) {
          const [nx, ny] = toScreen(npc.x, npc.z);
          const dist = Math.hypot(nx - r, ny - r);
          if (dist > r - 7) continue;
          if (dist < r * 0.48) {
            ctx.strokeStyle = `rgba(185, 165, 245, ${(0.22 + 0.22 * pulse).toFixed(2)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(nx, ny, 4.8 + pulse * 1.4, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = "#b9a5f5";
          ctx.strokeStyle = "#171521";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nx, ny - 3.6);
          ctx.lineTo(nx + 3.2, ny);
          ctx.lineTo(nx, ny + 3.6);
          ctx.lineTo(nx - 3.2, ny);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      // Player heading chevron (always points straight ahead / up)
      ctx.fillStyle = "#f3efe4";
      ctx.strokeStyle = "#171521";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(r, r - 7.5);
      ctx.lineTo(r + 5.5, r + 5.8);
      ctx.lineTo(r, r + 2.8);
      ctx.lineTo(r - 5.5, r + 5.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Subtle inner vignette shadow for depth
      const vig = ctx.createRadialGradient(r, r, r * 0.62, r, r, r);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, size, size);

      ctx.restore();

      // Cardinal North pip on the rim
      const nx = r - fx * (r - 10);
      const ny = r + fz * (r - 10);
      ctx.fillStyle = "#13121e";
      ctx.beginPath();
      ctx.arc(nx, ny, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f3efe4";
      ctx.font = "700 9.5px 'Barlow Condensed', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(north, nx, ny + 0.5);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, radiusM, north]);

  return (
    <div
      role="img"
      aria-label={label}
      data-testid="minimap-saigon-live"
      className="pointer-events-none relative shrink-0 rounded-full border-2 border-[#f3efe4]/75 bg-[#13121e] shadow-[0_0_0_3px_rgba(0,0,0,0.4),0_6px_22px_rgba(0,0,0,0.65)]"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: size, height: size }} className="rounded-full" />
    </div>
  );
};

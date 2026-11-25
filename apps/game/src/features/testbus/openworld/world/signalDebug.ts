import * as T from "three";
import type { IntersectionSpec } from "../traffic/types";
import type { SaigonRoadGraph } from "../traffic/roadGraph";
import { rightOf, signalBasePosition, signalYaw, validateApproach, type SignalApproach } from "./signalPlacement";

export { validateApproach } from "./signalPlacement";

declare global {
  interface Window { __SIGNAL_DEBUG__?: boolean }
}

/** Development only: true when running the dev server and the URL has ?signalDebug=1 (or window.__SIGNAL_DEBUG__). */
export function isSignalDebugEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  if (window.__SIGNAL_DEBUG__) return true;
  return new URLSearchParams(window.location?.search ?? "").get("signalDebug") === "1";
}

const OK = new T.Color(0x22dd55);
const BAD = new T.Color(0xff2222);
const CENTRE = new T.Color(0xffffff);
const Y = 0.4;

function labelSprite(text: string, ok: boolean): T.Sprite | null {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = ok ? "#22dd55" : "#ff4444";
  ctx.font = "20px monospace";
  ctx.fillText(text, 6, 30, 244);
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthTest: false }));
  sprite.scale.set(8, 1.5, 1);
  sprite.renderOrder = 999;
  return sprite;
}

/**
 * Debug overlay: one LineSegments (a single draw call) with intersection centres, incoming heading
 * arrows, stop lines, pole markers, facing and arm vectors, plus a text sprite per approach.
 * Approaches that fail validateApproach are drawn red, the others green.
 */
export function createSignalDebugOverlay(
  approaches: readonly SignalApproach[],
  graph: SaigonRoadGraph,
  intersections: Iterable<IntersectionSpec>,
): T.Group {
  const group = new T.Group();
  group.name = "signal-debug";
  const pos: number[] = [];
  const col: number[] = [];
  const seg = (ax: number, az: number, bx: number, bz: number, c: T.Color) => {
    pos.push(ax, Y, az, bx, Y, bz);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  };

  for (const i of intersections) {
    if (!i.signalized) continue;
    const { x, z } = i.center;
    seg(x - 2, z, x + 2, z, CENTRE);
    seg(x, z - 2, x, z + 2, CENTRE);
  }

  for (const a of approaches) {
    const v = validateApproach(a, graph);
    const c = v.ok ? OK : BAD;
    const h = a.heading;
    const r = rightOf(h);
    const sx = a.stopLine.x;
    const sz = a.stopLine.z;
    // Incoming road direction arrow ending at the stop line.
    seg(sx - h.dx * 8, sz - h.dz * 8, sx, sz, c);
    seg(sx, sz, sx - h.dx * 1.2 + r.x * 0.6, sz - h.dz * 1.2 + r.z * 0.6, c);
    seg(sx, sz, sx - h.dx * 1.2 - r.x * 0.6, sz - h.dz * 1.2 - r.z * 0.6, c);
    // Stop line across the carriageway.
    seg(sx - r.x * a.kerbDistance, sz - r.z * a.kerbDistance, sx + r.x * a.kerbDistance, sz + r.z * a.kerbDistance, c);
    // Pole marker, link to the stop line, facing vector and arm extension.
    const p = signalBasePosition(a);
    seg(p.x - 0.4, p.z, p.x + 0.4, p.z, c);
    seg(p.x, p.z - 0.4, p.x, p.z + 0.4, c);
    seg(p.x, p.z, sx, sz, c);
    const yaw = signalYaw(h);
    seg(p.x, p.z, p.x - Math.sin(yaw) * 3, p.z - Math.cos(yaw) * 3, c);
    seg(p.x, p.z, p.x + Math.cos(yaw) * a.armLength, p.z - Math.sin(yaw) * a.armLength, c);
    const label = labelSprite(a.id, v.ok);
    if (label) {
      label.position.set(p.x, 8, p.z);
      group.add(label);
    }
  }

  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(col, 3));
  const lines = new T.LineSegments(geo, new T.LineBasicMaterial({ vertexColors: true, depthTest: false }));
  lines.renderOrder = 998;
  lines.frustumCulled = false;
  group.add(lines);
  return group;
}

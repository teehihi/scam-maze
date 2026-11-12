/**
 * Maps the DOM phone screen onto the projected quad of the 3D screen.
 *
 * When the 3D phone is tilted, its screen projects to a general quadrilateral, not a
 * rectangle. `quadToMatrix3d` returns the CSS `matrix3d` (with `transform-origin: 0 0`) that
 * maps an element of size `width` x `height` onto that quad, so text, focus rings and clicks
 * stay on the glass. Pure TypeScript: no React, three or i18n imports.
 */

/** A point in CSS pixels from the top-left corner of the viewport. */
export interface Point {
  x: number;
  y: number;
}

/** Projected screen corners in order: top-left, top-right, bottom-right, bottom-left. */
export type ScreenQuad = readonly [Point, Point, Point, Point];

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Element size used for the quad: the mean length of opposite edges. */
export function quadSize(quad: ScreenQuad): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  return {
    width: (distance(tl, tr) + distance(bl, br)) / 2,
    height: (distance(tl, bl) + distance(tr, br)) / 2,
  };
}

/** Axis-aligned bounding rectangle of the quad. */
export function quadBounds(quad: ScreenQuad): { left: number; top: number; width: number; height: number } {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/**
 * Projective coefficients mapping element coordinates (x in [0, width], y in [0, height]) to
 * the quad: X = (a x + b y + c) / (g x + h y + 1), Y = (d x + e y + f) / (g x + h y + 1).
 * Returns `null` for a degenerate quad.
 */
export function quadHomography(
  width: number,
  height: number,
  quad: ScreenQuad,
): [number, number, number, number, number, number, number, number] | null {
  if (!(width > 0) || !(height > 0)) return null;
  const [p0, p1, p2, p3] = quad;
  // Shoelace area: a quad smaller than one square pixel cannot carry the screen.
  const area =
    (p0.x * p1.y - p1.x * p0.y + p1.x * p2.y - p2.x * p1.y + p2.x * p3.y - p3.x * p2.y + p3.x * p0.y - p0.x * p3.y) / 2;
  if (!(Math.abs(area) >= 1)) return null;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const coefficients: [number, number, number, number, number, number, number, number] = [
    a / width,
    b / height,
    p0.x,
    d / width,
    e / height,
    p0.y,
    g / width,
    h / height,
  ];
  return coefficients.every(Number.isFinite) ? coefficients : null;
}

/** Applies the homography to an element-space point (used by tests). */
export function applyHomography(
  m: readonly [number, number, number, number, number, number, number, number],
  x: number,
  y: number,
): Point {
  const [a, b, c, d, e, f, g, h] = m;
  const w = g * x + h * y + 1;
  return { x: (a * x + b * y + c) / w, y: (d * x + e * y + f) / w };
}

/** CSS `matrix3d(...)` for the element of the given size, or `null` for a degenerate quad. */
export function quadToMatrix3d(width: number, height: number, quad: ScreenQuad): string | null {
  const m = quadHomography(width, height, quad);
  if (m === null) return null;
  const [a, b, c, d, e, f, g, h] = m;
  // Column-major 4x4: [a b 0 c; d e 0 f; 0 0 1 0; g h 0 1].
  const values = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${values.map((v) => Number(v.toFixed(9))).join(", ")})`;
}
/**
 * Pure layout, pose and projection math for the call presentation.
 *
 * This module imports nothing from three, React or i18n, so the DOM components and the tests
 * can use it without a WebGL context. All rectangles are in CSS pixels, measured from the
 * top-left corner of the viewport. Poses are in camera space (meters): +x right, +y up, and the
 * camera looks down -z.
 */

/** Viewport size in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** Axis-aligned rectangle in CSS pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CallLayout {
  /** `narrow` when the viewport is narrower than `NARROW_BREAKPOINT`. */
  kind: "narrow" | "wide";
  /** Target rectangle of the phone screen. */
  screen: Rect;
  /** Region for the choice overlay (its maximum size). */
  choice: Rect;
  /** Screen corner radius in CSS pixels: `SCREEN_CORNER_RATIO * screen.width`. */
  screenCornerRadius: number;
}

/** Camera-space position (meters) of the screen center. `z` is negative (in front). */
export interface ScreenPose {
  x: number;
  y: number;
  z: number;
}

/** Width of the `OLED` screen primitive of the phone model, in meters. */
export const SCREEN_WIDTH_M = 0.0668;
/** Height of the `OLED` screen primitive of the phone model, in meters. */
export const SCREEN_HEIGHT_M = 0.1449;
/** Width divided by height of the phone screen (about 0.4610). */
export const SCREEN_ASPECT = SCREEN_WIDTH_M / SCREEN_HEIGHT_M;
/** Corner radius divided by width: 0.01174 m / 0.0668 m. */
export const SCREEN_CORNER_RATIO = 0.176;
/** Viewports narrower than this use the narrow layout (same as Tailwind `sm`). */
export const NARROW_BREAKPOINT = 640;
/** The phone screen is never taller than this, in CSS pixels. */
export const MAX_SCREEN_HEIGHT = 720;
/** The wide layout keeps at least this width for the choice region, in CSS pixels. */
export const MIN_CHOICE_WIDTH = 280;

const NARROW_MARGIN = 12;
const WIDE_MARGIN = 24;
const NARROW_MIN_SCREEN_HEIGHT = 288;
const NARROW_SCREEN_HEIGHT_RATIO = 0.6;
const WIDE_SCREEN_HEIGHT_RATIO = 0.9;
const MAX_CHOICE_WIDTH = 720;
/** Guard so the screen anchor can never reach the camera near plane (0.05 m). */
const MIN_POSE_DISTANCE_M = 0.06;

function screenRectOfHeight(height: number, left: number, top: number): Rect {
  return { left, top, width: height * SCREEN_ASPECT, height };
}

/** Computes the target phone screen rectangle and the choice region for a viewport. */
export function computeCallLayout(viewport: Viewport): CallLayout {
  const W = viewport.width;
  const H = viewport.height;

  if (W < NARROW_BREAKPOINT) {
    const m = NARROW_MARGIN;
    const height = Math.min(
      Math.max(NARROW_SCREEN_HEIGHT_RATIO * H, NARROW_MIN_SCREEN_HEIGHT),
      MAX_SCREEN_HEIGHT,
      (W - 2 * m) / SCREEN_ASPECT,
    );
    const width = height * SCREEN_ASPECT;
    const screen = screenRectOfHeight(height, (W - width) / 2, m);
    const choiceTop = screen.top + screen.height + m;
    const choice: Rect = {
      left: m,
      top: choiceTop,
      width: W - 2 * m,
      height: Math.max(0, H - m - choiceTop),
    };
    return {
      kind: "narrow",
      screen,
      choice,
      screenCornerRadius: SCREEN_CORNER_RATIO * screen.width,
    };
  }

  const m = WIDE_MARGIN;
  const height = Math.min(
    WIDE_SCREEN_HEIGHT_RATIO * H,
    MAX_SCREEN_HEIGHT,
    (W - 3 * m - MIN_CHOICE_WIDTH) / SCREEN_ASPECT,
  );
  const width = height * SCREEN_ASPECT;
  const choiceWidth = Math.min(W - 3 * m - width, MAX_CHOICE_WIDTH);
  const choice: Rect = {
    left: m,
    top: H / 2,
    width: choiceWidth,
    height: H / 2 - m,
  };
  // Center the screen in the space right of the choice region (between its right edge plus
  // one margin and the viewport right edge minus one margin), and vertically in the viewport.
  const spaceLeft = choice.left + choice.width + m;
  const spaceRight = W - m;
  const screen = screenRectOfHeight(
    height,
    spaceLeft + (spaceRight - spaceLeft - width) / 2,
    (H - height) / 2,
  );
  return {
    kind: "wide",
    screen,
    choice,
    screenCornerRadius: SCREEN_CORNER_RATIO * screen.width,
  };
}

/** Area of the intersection of two rectangles; 0 when they only touch or are apart. */
export function rectsIntersectArea(a: Rect, b: Rect): number {
  const overlapX = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const overlapY = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  return overlapX * overlapY;
}

/** Half of the visible height (meters) at distance 1 for a vertical field of view in degrees. */
function tanHalfFov(fovDeg: number): number {
  return Math.tan((fovDeg * Math.PI) / 360);
}

/**
 * Camera-space position (meters) of the screen center so it projects onto `target`.
 *
 * The distance is `d = SCREEN_HEIGHT_M / (2 · tan(fov/2) · target.height / H)`, clamped to at
 * least 0.06 m as a guard (the clamp never applies to layouts from `computeCallLayout` with a
 * field of view from 60 to 85 degrees).
 */
export function solveScreenPose(target: Rect, viewport: Viewport, fovDeg: number): ScreenPose {
  const W = viewport.width;
  const H = viewport.height;
  const t = tanHalfFov(fovDeg);
  const d = Math.max(SCREEN_HEIGHT_M / ((2 * t * target.height) / H), MIN_POSE_DISTANCE_M);
  const halfHeightM = d * t;
  const halfWidthM = halfHeightM * (W / H);
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  const ndcX = (centerX / W) * 2 - 1;
  const ndcY = 1 - (centerY / H) * 2;
  return { x: ndcX * halfWidthM, y: ndcY * halfHeightM, z: -d };
}

/** Pinhole projection of the screen anchor corners for a pose; the inverse of `solveScreenPose`. */
export function projectScreenRect(pose: ScreenPose, viewport: Viewport, fovDeg: number): Rect {
  const W = viewport.width;
  const H = viewport.height;
  const d = -pose.z;
  const halfHeightM = d * tanHalfFov(fovDeg);
  const pxPerMeter = H / 2 / halfHeightM;
  const centerX = W / 2 + pose.x * pxPerMeter;
  const centerY = H / 2 - pose.y * pxPerMeter;
  const width = SCREEN_WIDTH_M * pxPerMeter;
  const height = SCREEN_HEIGHT_M * pxPerMeter;
  return { left: centerX - width / 2, top: centerY - height / 2, width, height };
}

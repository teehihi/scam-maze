import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import {
  computeCallLayout,
  NARROW_BREAKPOINT,
  rectsIntersectArea,
  SCREEN_ASPECT,
  SCREEN_HEIGHT_M,
  SCREEN_WIDTH_M,
  solveScreenPose,
  type Rect,
  type Viewport,
} from "./callLayout";
import { phoneMotionOffset } from "./phoneMotion";

/** Cases per property (design: at least 100). */
const RUNS = 200;
/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

/** Viewport range from the design (Property 5), in CSS px. */
const MIN_WIDTH = 320;
const MAX_WIDTH = 2560;
const MIN_HEIGHT = 480;
const MAX_HEIGHT = 1600;

/** Written out here, not imported, so the test does not reuse the code under test. */
const NARROW_MARGIN = 12;
const WIDE_MARGIN = 24;
const MIN_SCREEN_WIDTH = 132;
/** Tolerance for floating-point edges, in CSS px. */
const EPSILON = 1e-6;

/** Field of view range from the design (Property 6), in degrees. */
const MIN_FOV_DEG = 60;
const MAX_FOV_DEG = 85;
/** Camera near plane used by the design (0.05 m); the pose distance must be beyond it. */
const CAMERA_NEAR_M = 0.05;
/** Maximum edge error between the projected and the target rectangle, in CSS px. */
const PROJECTION_TOLERANCE_PX = 0.5;
/** Elapsed time range for the motion offset, in milliseconds. */
const MAX_ELAPSED_MS = 10_000;

/** Projects a camera-space point to CSS px with a real three.js camera (no WebGL context). */
function projectToCss(point: Vector3, camera: PerspectiveCamera, viewport: Viewport): { x: number; y: number } {
  const ndc = point.clone().project(camera);
  return {
    x: ((ndc.x + 1) / 2) * viewport.width,
    y: ((1 - ndc.y) / 2) * viewport.height,
  };
}

/** Viewport with boundary values mixed in so the breakpoint and range ends are always covered. */
function generateViewport(next: () => number): Viewport {
  const width = pick(next, [
    MIN_WIDTH,
    NARROW_BREAKPOINT - 1,
    NARROW_BREAKPOINT,
    MAX_WIDTH,
    randomInt(next, MIN_WIDTH, MAX_WIDTH),
    randomInt(next, MIN_WIDTH, NARROW_BREAKPOINT - 1),
    MIN_WIDTH + next() * (MAX_WIDTH - MIN_WIDTH),
  ]);
  const height = pick(next, [
    MIN_HEIGHT,
    MAX_HEIGHT,
    randomInt(next, MIN_HEIGHT, MAX_HEIGHT),
    MIN_HEIGHT + next() * (MAX_HEIGHT - MIN_HEIGHT),
  ]);
  return { width, height };
}

function expectInsideViewport(rect: Rect, viewport: Viewport, label: string): void {
  expect(rect.width, label).toBeGreaterThanOrEqual(0);
  expect(rect.height, label).toBeGreaterThanOrEqual(0);
  expect(rect.left, label).toBeGreaterThanOrEqual(-EPSILON);
  expect(rect.top, label).toBeGreaterThanOrEqual(-EPSILON);
  expect(rect.left + rect.width, label).toBeLessThanOrEqual(viewport.width + EPSILON);
  expect(rect.top + rect.height, label).toBeLessThanOrEqual(viewport.height + EPSILON);
}

describe("callLayout properties", () => {
  // Feature: game-3d-phone-call-ui, Property 5: Layout keeps the screen and the choices inside the viewport and apart
  it("Property 5: layout keeps the screen and the choices inside the viewport and apart (Requirements 1.3, 1.4, 3.2, 3.3, 3.4)", () => {
    const seed = 0xca11a705;
    const next = createLcg(seed);
    const kinds = new Set<string>();
    for (let index = 0; index < RUNS; index += 1) {
      const viewport = generateViewport(next);
      const layout = computeCallLayout(viewport);
      const { screen, choice } = layout;
      const label = `seed ${seed.toString(16)} case ${index}, viewport ${JSON.stringify(viewport)}, layout ${JSON.stringify(layout)}`;
      kinds.add(layout.kind);

      expect(layout.kind, label).toBe(viewport.width < NARROW_BREAKPOINT ? "narrow" : "wide");
      expectInsideViewport(screen, viewport, `${label} (screen)`);
      expectInsideViewport(choice, viewport, `${label} (choice)`);
      expect(rectsIntersectArea(screen, choice), label).toBe(0);
      expect(Math.abs(screen.width / screen.height - SCREEN_ASPECT), label).toBeLessThanOrEqual(0.001);
      expect(screen.width, label).toBeGreaterThanOrEqual(MIN_SCREEN_WIDTH);

      if (viewport.width >= NARROW_BREAKPOINT) {
        expect(choice.top, label).toBeGreaterThanOrEqual(viewport.height / 2 - EPSILON);
      } else {
        expect(choice.top, label).toBeGreaterThanOrEqual(screen.top + screen.height - EPSILON);
        expect(choice.top + choice.height, label).toBeGreaterThanOrEqual(
          viewport.height - NARROW_MARGIN - EPSILON,
        );
      }
    }
    // Both layouts were generated at least once.
    expect([...kinds].sort()).toEqual(["narrow", "wide"]);
  }, PROPERTY_TIMEOUT_MS);

  // Feature: game-phone-call-ui-redesign, Property 3: Subtitle rectangle is inside the viewport and apart from the phone and the choices
  it("Property 3: subtitle rectangle is inside the viewport and apart from the phone and the choices (Requirements 6.1-6.7)", () => {
    const seed = 0x5ab717e3;
    const next = createLcg(seed);
    const kinds = new Set<string>();
    for (let index = 0; index < RUNS; index += 1) {
      const viewport = generateViewport(next);
      const layout = computeCallLayout(viewport);
      const { screen, choice, subtitle } = layout;
      const label = `seed ${seed.toString(16)} case ${index}, viewport ${JSON.stringify(viewport)}, layout ${JSON.stringify(layout)}`;
      kinds.add(layout.kind);

      expectInsideViewport(subtitle, viewport, `${label} (subtitle)`);
      expect(rectsIntersectArea(subtitle, screen), `${label} (subtitle/screen)`).toBe(0);
      expect(rectsIntersectArea(subtitle, choice), `${label} (subtitle/choice)`).toBe(0);
      // Existing guarantees still hold with the subtitle present.
      expect(Math.abs(screen.width / screen.height - SCREEN_ASPECT), label).toBeLessThanOrEqual(0.001);
      expect(screen.width, label).toBeGreaterThanOrEqual(MIN_SCREEN_WIDTH);
      expectInsideViewport(choice, viewport, `${label} (choice)`);

      const subtitleBottom = subtitle.top + subtitle.height;
      if (layout.kind === "narrow") {
        // Below the screen and above the choice.
        expect(subtitle.top, label).toBeGreaterThanOrEqual(screen.top + screen.height - EPSILON);
        expect(subtitleBottom, label).toBeLessThanOrEqual(choice.top + EPSILON);
      } else {
        // Left column, directly above the choice: same left edge, bottom within one margin.
        expect(subtitle.left, label).toBeGreaterThanOrEqual(choice.left - EPSILON);
        expect(subtitle.left + subtitle.width, label).toBeLessThanOrEqual(choice.left + choice.width + EPSILON);
        expect(subtitleBottom, label).toBeLessThanOrEqual(choice.top + EPSILON);
        expect(choice.top - subtitleBottom, label).toBeLessThanOrEqual(WIDE_MARGIN + EPSILON);
      }
    }
    expect([...kinds].sort()).toEqual(["narrow", "wide"]);
  }, PROPERTY_TIMEOUT_MS);

  // Feature: game-3d-phone-call-ui, Property 6: Pose and projection round trip
  it("Property 6: pose and projection round trip (Requirements 10.3, 10.5, 10.7)", () => {
    const seed = 0x905e7a11;
    const next = createLcg(seed);
    for (let index = 0; index < RUNS; index += 1) {
      const viewport = generateViewport(next);
      const fovDeg = pick(next, [
        MIN_FOV_DEG,
        MAX_FOV_DEG,
        MIN_FOV_DEG + next() * (MAX_FOV_DEG - MIN_FOV_DEG),
      ]);
      const layout = computeCallLayout(viewport);
      const motion = {
        elapsedMs: pick(next, [0, next() * 400, next() * MAX_ELAPSED_MS]),
        animateEntry: next() < 0.5,
        ringing: next() < 0.5,
        reducedMotion: next() < 0.25,
      };
      const offset = phoneMotionOffset({ ...motion, layout, viewport });
      const target: Rect = { ...layout.screen, left: layout.screen.left + offset };
      const pose = solveScreenPose(target, viewport, fovDeg);
      const label = `seed ${seed.toString(16)} case ${index}, viewport ${JSON.stringify(viewport)}, fov ${fovDeg}, motion ${JSON.stringify(motion)}, offset ${offset}, target ${JSON.stringify(target)}, pose ${JSON.stringify(pose)}`;

      const camera = new PerspectiveCamera(fovDeg, viewport.width / viewport.height, CAMERA_NEAR_M, 100);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      // The screen anchor faces the camera: its corners differ from the pose by half the size.
      const halfWidth = SCREEN_WIDTH_M / 2;
      const halfHeight = SCREEN_HEIGHT_M / 2;
      const topLeft = projectToCss(new Vector3(pose.x - halfWidth, pose.y + halfHeight, pose.z), camera, viewport);
      const topRight = projectToCss(new Vector3(pose.x + halfWidth, pose.y + halfHeight, pose.z), camera, viewport);
      const bottomLeft = projectToCss(new Vector3(pose.x - halfWidth, pose.y - halfHeight, pose.z), camera, viewport);
      const bottomRight = projectToCss(new Vector3(pose.x + halfWidth, pose.y - halfHeight, pose.z), camera, viewport);

      const left = Math.min(topLeft.x, bottomLeft.x);
      const right = Math.max(topRight.x, bottomRight.x);
      const top = Math.min(topLeft.y, topRight.y);
      const bottom = Math.max(bottomLeft.y, bottomRight.y);

      expect(Math.abs(left - target.left), `${label} (left)`).toBeLessThanOrEqual(PROJECTION_TOLERANCE_PX);
      expect(Math.abs(right - (target.left + target.width)), `${label} (right)`).toBeLessThanOrEqual(
        PROJECTION_TOLERANCE_PX,
      );
      expect(Math.abs(top - target.top), `${label} (top)`).toBeLessThanOrEqual(PROJECTION_TOLERANCE_PX);
      expect(Math.abs(bottom - (target.top + target.height)), `${label} (bottom)`).toBeLessThanOrEqual(
        PROJECTION_TOLERANCE_PX,
      );
      // In front of the camera and beyond the near plane.
      expect(-pose.z, label).toBeGreaterThan(CAMERA_NEAR_M);
    }
  }, PROPERTY_TIMEOUT_MS);
});

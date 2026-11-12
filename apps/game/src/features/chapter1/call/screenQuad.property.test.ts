// Feature: game-3d-phone-call-ui, Property 11: The screen quad transform maps the element corners onto the projected quad
import { describe, expect, it } from "vitest";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { applyHomography, quadBounds, quadHomography, quadSize, quadToMatrix3d, type ScreenQuad } from "./screenQuad";

const PROPERTY_TIMEOUT_MS = 60_000;
const CASES = 200;

describe("screenQuad", () => {
  it("maps a rectangle quad with a plain scale and translation", () => {
    const quad: ScreenQuad = [
      { x: 100, y: 50 },
      { x: 400, y: 50 },
      { x: 400, y: 700 },
      { x: 100, y: 700 },
    ];
    expect(quadSize(quad)).toEqual({ width: 300, height: 650 });
    expect(quadBounds(quad)).toEqual({ left: 100, top: 50, width: 300, height: 650 });
    expect(quadToMatrix3d(300, 650, quad)).toBe("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 100, 50, 0, 1)");
  });

  it("returns null for a degenerate quad", () => {
    const point = { x: 10, y: 10 };
    expect(quadToMatrix3d(100, 200, [point, point, point, point])).toBeNull();
    expect(quadToMatrix3d(0, 200, [point, point, point, point])).toBeNull();
  });

  it(
    "maps the four element corners onto any convex tilted quad",
    () => {
      const next = createLcg(0x5c4ee011);
      for (let index = 0; index < CASES; index += 1) {
        const left = randomInt(next, 0, 1500);
        const top = randomInt(next, 0, 400);
        const w = randomInt(next, 120, 500);
        const h = randomInt(next, 260, 900);
        const skew = (max: number) => randomInt(next, -max, max);
        const quad: ScreenQuad = [
          { x: left + skew(20), y: top + skew(20) },
          { x: left + w + skew(20), y: top + skew(30) },
          { x: left + w + skew(20), y: top + h + skew(30) },
          { x: left + skew(20), y: top + h + skew(20) },
        ];
        const size = quadSize(quad);
        const m = quadHomography(size.width, size.height, quad);
        const label = `seed 0x5c4ee011 case ${index} quad ${JSON.stringify(quad)}`;
        expect(m, label).not.toBeNull();
        const corners: Array<[number, number]> = [
          [0, 0],
          [size.width, 0],
          [size.width, size.height],
          [0, size.height],
        ];
        corners.forEach(([x, y], corner) => {
          const mapped = applyHomography(m!, x, y);
          expect(mapped.x, label).toBeCloseTo(quad[corner].x, 6);
          expect(mapped.y, label).toBeCloseTo(quad[corner].y, 6);
        });
      }
    },
    PROPERTY_TIMEOUT_MS,
  );
});
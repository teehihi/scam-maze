import { describe, expect, it } from 'vitest';
import { createLcg, pick, randomInt } from '../../../test/seededRandom';
import {
  findFocusedInteractable,
  MAX_INTERACT_DISTANCE,
  type InteractableSphere,
  type Vec3,
} from './findFocusedInteractable';

const CASES = 500;
/** Decisions closer than this to a boundary (tangent, t = 0, t = max, near-tie) are ambiguous. */
const EPSILON = 1e-9;

interface ReferenceResult {
  readonly id: string | null;
  /** True when floating-point rounding could change the answer for this case. */
  readonly ambiguous: boolean;
}

/**
 * Independent reference: solves |origin + s * direction - center|^2 = radius^2 as a quadratic in
 * `s` with the direction left unnormalised, converts the smaller root to a distance in metres and
 * scans every sphere. It shares no code with the implementation, which uses a projected-closest-
 * point formula on a normalised direction.
 */
function referenceFocus(
  origin: Vec3,
  direction: Vec3,
  spheres: readonly InteractableSphere[],
  maxDistance: number,
): ReferenceResult {
  const a = direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2;
  if (a === 0) return { id: null, ambiguous: false };
  const length = Math.sqrt(a);

  let ambiguous = false;
  const candidates: { id: string; t: number; key: string }[] = [];
  for (const sphere of spheres) {
    if (sphere.radius <= 0) continue;
    const ox = origin[0] - sphere.center[0];
    const oy = origin[1] - sphere.center[1];
    const oz = origin[2] - sphere.center[2];
    const b = 2 * (direction[0] * ox + direction[1] * oy + direction[2] * oz);
    const c = ox * ox + oy * oy + oz * oz - sphere.radius ** 2;
    const disc = b * b - 4 * a * c;
    const scale = b * b + Math.abs(4 * a * c) + 1;
    if (Math.abs(disc) <= EPSILON * scale) ambiguous = true; // grazing the sphere
    if (disc < 0) continue;
    const t = ((-b - Math.sqrt(disc)) / (2 * a)) * length;
    if (Math.abs(t) <= EPSILON || Math.abs(t - maxDistance) <= EPSILON) ambiguous = true;
    if (t > 0 && t <= maxDistance) {
      candidates.push({
        id: sphere.id,
        t,
        key: `${sphere.center.join(',')}|${sphere.radius}`,
      });
    }
  }

  let best: { id: string; t: number; key: string } | null = null;
  for (const candidate of candidates) {
    if (best === null || candidate.t < best.t) best = candidate;
  }
  if (best !== null) {
    // A near-tie between geometrically different spheres is ambiguous; identical spheres give
    // bit-identical distances in both implementations, so first-listed must win.
    for (const candidate of candidates) {
      if (candidate.key !== best.key && Math.abs(candidate.t - best.t) <= EPSILON) {
        ambiguous = true;
      }
    }
  }
  return { id: best?.id ?? null, ambiguous };
}

function randomIn(next: () => number, min: number, max: number): number {
  return min + next() * (max - min);
}

function generateCase(next: () => number): {
  origin: Vec3;
  direction: Vec3;
  spheres: InteractableSphere[];
} {
  const origin: Vec3 = [randomIn(next, -2, 2), randomIn(next, -2, 2), randomIn(next, -2, 2)];
  const count = randomInt(next, 0, 8);
  const spheres: InteractableSphere[] = [];
  for (let i = 0; i < count; i += 1) {
    const duplicateOf = spheres.length > 0 && next() < 0.1 ? pick(next, spheres) : null;
    if (duplicateOf) {
      // Exact tie: same geometry under a new ID; the first-listed sphere must win.
      spheres.push({ id: `sphere-${i}`, center: duplicateOf.center, radius: duplicateOf.radius });
      continue;
    }
    // Most spheres sit within reach of the 3 m limit; the rest use the full ±6 m range.
    const near = next() < 0.7;
    const spread = near ? 2.5 : 6;
    spheres.push({
      id: `sphere-${i}`,
      center: [
        origin[0] + randomIn(next, -spread, spread),
        origin[1] + randomIn(next, -spread, spread),
        origin[2] + randomIn(next, -spread, spread),
      ],
      radius: next() < 0.05 ? pick(next, [0, -0.5]) : randomIn(next, 0.2, 1.0),
    });
  }

  let direction: Vec3;
  const mode = next();
  if (mode < 0.05) {
    direction = [0, 0, 0];
  } else if (mode < 0.65 && spheres.length > 0) {
    // Aim roughly at a sphere so many cases have a hit; leave the direction unnormalised.
    const target = pick(next, spheres);
    const scale = randomIn(next, 0.1, 5);
    direction = [
      (target.center[0] - origin[0] + randomIn(next, -0.6, 0.6)) * scale,
      (target.center[1] - origin[1] + randomIn(next, -0.6, 0.6)) * scale,
      (target.center[2] - origin[2] + randomIn(next, -0.6, 0.6)) * scale,
    ];
  } else {
    direction = [randomIn(next, -1, 1), randomIn(next, -1, 1), randomIn(next, -1, 1)];
  }
  return { origin, direction, spheres };
}

describe('findFocusedInteractable (property)', () => {
  it('matches a brute-force reference on 500 seeded cases', () => {
    // Feature: chapter-01-the-urgent-call, Property 9: Focus selection matches a brute-force reference
    const next = createLcg(0x5eed_0009);
    let checked = 0;
    let hits = 0;
    let ambiguousCases = 0;

    for (let i = 0; i < CASES; i += 1) {
      const { origin, direction, spheres } = generateCase(next);
      const expected = referenceFocus(origin, direction, spheres, MAX_INTERACT_DISTANCE);
      const actual = findFocusedInteractable(origin, direction, spheres, MAX_INTERACT_DISTANCE);
      if (expected.ambiguous) {
        ambiguousCases += 1;
        continue;
      }
      checked += 1;
      if (expected.id !== null) hits += 1;
      expect(actual, `case ${i}: ${JSON.stringify({ origin, direction, spheres })}`).toBe(
        expected.id,
      );
    }

    // Guard against a generator that only produces trivial or skipped cases.
    expect(ambiguousCases).toBeLessThan(CASES * 0.02);
    expect(hits).toBeGreaterThan(CASES * 0.2);
    expect(checked - hits).toBeGreaterThan(CASES * 0.2);
  });
});

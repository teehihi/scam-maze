/**
 * Layout of the low-poly city that surrounds the walkable street.
 *
 * Pure and deterministic (no React, no Three.js): given the measured footprint of every piece it
 * returns where each building and car goes. The street scene (MenuBG) is a small built-up cluster
 * on a large empty ground plane; the district fills that plane with rows of buildings and a car
 * park, and leaves the street, the view lane to the skyline and the play area untouched.
 *
 * Piece conventions (see scripts/optimize-city-packs.cjs): the origin is the centre of the
 * footprint on the ground, the front of a building looks along local +z, and a car's long side
 * runs along z.
 */

/** Height of the ground plane's top face in the street scene. */
export const CITY_GROUND_Y = -95;
/** Height of the street's road surface (cars on the street stand here). */
export const CITY_ROAD_Y = -94.45;

/** Size of a piece in metres: width along local x, height, depth along local z. */
export interface PieceFootprint {
  name: string;
  w: number;
  h: number;
  d: number;
}

export interface Placement {
  name: string;
  x: number;
  y: number;
  z: number;
  /** Rotation about the vertical axis in radians. */
  yaw: number;
}

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** The ground plane of the street scene (the part that can carry buildings). */
export const CITY_GROUND: Rect = Object.freeze({ minX: 57, maxX: 306, minZ: -116, maxZ: 38 });

/**
 * Areas that stay free of city pieces: the street cluster with its houses and grass, the lane
 * that runs north from the street to the Landmark 81 / Bitexco backdrop, and the play area.
 */
export const CITY_RESERVED: readonly Rect[] = Object.freeze([
  { minX: 134, maxX: 234, minZ: -106, maxZ: -2 },
  { minX: 174, maxX: 208, minZ: -2, maxZ: 40 },
  { minX: 150, maxX: 232, minZ: 24, maxZ: 40 },
  { minX: 176, maxX: 202, minZ: -106, maxZ: 54 },
]);

interface Strip {
  /** Start of the line the buildings' backs are measured from. */
  start: readonly [number, number];
  /** Unit direction along the line. */
  dir: readonly [number, number];
  /** Unit direction the building fronts look (toward the street). */
  facing: readonly [number, number];
  length: number;
  minHeight: number;
  maxHeight: number;
}

const EAST = [1, 0] as const;
const WEST = [-1, 0] as const;
const ALONG_Z = [0, 1] as const;

/** Rows of buildings; the outer rows are taller so they read as a skyline above the houses. */
const STRIPS: readonly Strip[] = [
  // West of the street, three rows deep.
  { start: [126, -104], dir: ALONG_Z, facing: EAST, length: 98, minHeight: 6, maxHeight: 18 },
  { start: [98, -104], dir: ALONG_Z, facing: EAST, length: 98, minHeight: 12, maxHeight: 46 },
  { start: [70, -104], dir: ALONG_Z, facing: EAST, length: 98, minHeight: 14, maxHeight: 46 },
  // East of the street, two rows deep, running the full length of the plane.
  { start: [262, -104], dir: ALONG_Z, facing: WEST, length: 138, minHeight: 6, maxHeight: 18 },
  { start: [290, -104], dir: ALONG_Z, facing: WEST, length: 138, minHeight: 12, maxHeight: 46 },
  // Either side of the lane that runs north from the street.
  { start: [172, -2], dir: ALONG_Z, facing: EAST, length: 22, minHeight: 6, maxHeight: 20 },
  { start: [210, -2], dir: ALONG_Z, facing: WEST, length: 22, minHeight: 6, maxHeight: 20 },
];

/** Seeded random numbers (mulberry32), so the city is the same on every visit. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

/** Axis-aligned footprint of a piece placed at `placement` (yaw is a multiple of 90 degrees). */
export function placementRect(placement: Placement, footprint: PieceFootprint): Rect {
  const quarterTurn = Math.abs(Math.round(placement.yaw / (Math.PI / 2))) % 2 === 1;
  const halfX = (quarterTurn ? footprint.d : footprint.w) / 2;
  const halfZ = (quarterTurn ? footprint.w : footprint.d) / 2;
  return {
    minX: placement.x - halfX,
    maxX: placement.x + halfX,
    minZ: placement.z - halfZ,
    maxZ: placement.z + halfZ,
  };
}

const MAX_PIECE_WIDTH = 32;
const MAX_PIECE_DEPTH = 26;

/** Buildings along the strips. Pieces are chosen per row by height and never repeat back to back. */
export function layoutBuildings(
  footprints: readonly PieceFootprint[],
  seed = 20261112,
): { placement: Placement; footprint: PieceFootprint }[] {
  const random = createRandom(seed);
  const usable = footprints.filter((f) => f.w <= MAX_PIECE_WIDTH && f.d <= MAX_PIECE_DEPTH && f.w > 2 && f.d > 2);
  const result: { placement: Placement; footprint: PieceFootprint }[] = [];

  for (const strip of STRIPS) {
    const pool = usable.filter((f) => f.h >= strip.minHeight && f.h <= strip.maxHeight);
    if (pool.length === 0) continue;
    const yaw = Math.atan2(strip.facing[0], strip.facing[1]);
    let cursor = 0;
    let previous = "";
    for (let guard = 0; guard < 200; guard++) {
      const candidates = pool.filter((f) => f.name !== previous);
      const footprint = candidates[Math.floor(random() * candidates.length)] ?? pool[0];
      if (cursor + footprint.w > strip.length) break;
      const along = cursor + footprint.w / 2;
      const placement: Placement = {
        name: footprint.name,
        x: strip.start[0] + strip.dir[0] * along - strip.facing[0] * (footprint.d / 2),
        y: CITY_GROUND_Y,
        z: strip.start[1] + strip.dir[1] * along - strip.facing[1] * (footprint.d / 2),
        yaw,
      };
      const rect = placementRect(placement, footprint);
      const insideGround =
        rect.minX >= CITY_GROUND.minX + 4 &&
        rect.maxX <= CITY_GROUND.maxX - 4 &&
        rect.minZ >= CITY_GROUND.minZ + 4 &&
        rect.maxZ <= CITY_GROUND.maxZ - 4;
      const blocked = CITY_RESERVED.some((reserved) => rectsOverlap(rect, reserved));
      if (insideGround && !blocked) result.push({ placement, footprint });
      previous = footprint.name;
      cursor += footprint.w + 2 + random() * 3;
    }
  }
  return result;
}

/** Parking lot on the plain west of the north lane, plus a few cars parked on the side road. */
const LOT = { minX: 92, maxX: 146, rowsZ: [8, 19] as const, spacing: 2.9 };
const SIDE_ROAD_CARS = [
  { x: 147, z: -92.3 },
  { x: 155, z: -92.3 },
  { x: 152, z: -88.1 },
  { x: 161, z: -88.1 },
] as const;

export function layoutCars(
  footprints: readonly PieceFootprint[],
  seed = 20261113,
): { placement: Placement; footprint: PieceFootprint }[] {
  const random = createRandom(seed);
  const cars = footprints.filter((f) => f.w >= 1.2 && f.d >= 2.5);
  if (cars.length === 0) return [];
  const pick = () => cars[Math.floor(random() * cars.length)];
  const result: { placement: Placement; footprint: PieceFootprint }[] = [];

  LOT.rowsZ.forEach((z, row) => {
    for (let x = LOT.minX; x <= LOT.maxX; x += LOT.spacing) {
      // Some bays stay empty so the lot looks used rather than stamped.
      if (random() < 0.28) continue;
      const footprint = pick();
      const placement: Placement = {
        name: footprint.name,
        x: x + (random() - 0.5) * 0.3,
        y: CITY_GROUND_Y,
        z: z + (random() - 0.5) * 0.6,
        // Rows face each other, with a little variation in how they were parked.
        yaw: (row === 0 ? 0 : Math.PI) + (random() - 0.5) * 0.06,
      };
      result.push({ placement, footprint });
    }
  });

  for (const spot of SIDE_ROAD_CARS) {
    const footprint = pick();
    result.push({
      footprint,
      placement: { name: footprint.name, x: spot.x, y: CITY_ROAD_Y, z: spot.z, yaw: Math.PI / 2 },
    });
  }
  return result;
}

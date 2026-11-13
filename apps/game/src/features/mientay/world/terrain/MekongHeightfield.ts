import { clamp, distanceToPolylineXZ, fbm2D, lerp, smoothstep } from '../math/Noise';

export const WORLD_SIZE = 520;
export const WATER_LEVEL = 0.0;

export const MAIN_RIVER_SPINE: ReadonlyArray<readonly [number, number]> = [
  [-38, -260],
  [-30, -185],
  [-20, -118],
  [-12, -62],
  [-7, -18],
  [-5, 16],
  [-11, 68],
  [-21, 130],
  [-28, 195],
  [-32, 260],
];

export const EAST_CANAL_SPINE: ReadonlyArray<readonly [number, number]> = [
  [-6, -16],
  [14, -22],
  [36, -26],
  [58, -22],
  [78, -8],
  [92, 18],
  [96, 56],
  [88, 108],
  [76, 175],
  [66, 260],
];

export const WEST_CREEK_SPINE: ReadonlyArray<readonly [number, number]> = [
  [-15, 36],
  [-42, 46],
  [-68, 62],
  [-95, 88],
  [-130, 128],
];

// Village footpath spine on East Bank & Orchard & West Bank
export const VILLAGE_PATH_EAST: ReadonlyArray<readonly [number, number]> = [
  [24, 28], // Ferry pier entrance
  [31, 30], // Stone embankment promenade
  [44, 34], // Mansion gate approach
  [54, 42], // Heritage Mansion front courtyard
  [30, 18], // Connects to Stilt Village boardwalk entrance
  [28, -4],
];

export const VILLAGE_PATH_ORCHARD: ReadonlyArray<readonly [number, number]> = [
  [26, -34], // North end of wooden canal bridge
  [26, -54],
  [12, -66], // Approach to main river bridge
  [48, -36], // North end of bamboo monkey bridge
  [48, -56],
  [26, -54],
];

export const VILLAGE_PATH_WEST: ReadonlyArray<readonly [number, number]> = [
  [-38, -66], // West end of main river bridge
  [-45, -42],
  [-48, -14],
  [-50, 8], // Khmer Pagoda plaza
  [-36, 10], // West river landing steps
];

export interface WalkableSurface {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  getHeight: (x: number, z: number) => number;
}

export interface SolidCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY?: number;
}

const walkableSurfaces: WalkableSurface[] = [];
const solidColliders: SolidCollider[] = [];

export function clearWorldCollisionRegistry(): void {
  walkableSurfaces.length = 0;
  solidColliders.length = 0;
}

export function registerWalkableBox(
  id: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  topY: number,
): void {
  walkableSurfaces.push({
    id,
    minX,
    maxX,
    minZ,
    maxZ,
    getHeight: () => topY,
  });
}

export function registerWalkableSlope(
  id: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  getHeight: (x: number, z: number) => number,
): void {
  walkableSurfaces.push({ id, minX, maxX, minZ, maxZ, getHeight });
}

export function registerSolidCollider(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  maxY = 12,
): void {
  solidColliders.push({ minX, maxX, minZ, maxZ, maxY });
}

export interface TerrainSample {
  height: number;
  riverFactor: number; // 1 in deep river/canal, 0 on dry land
  canalFactor: number; // 1 inside small canals/ditches
  pathFactor: number;  // 1 on packed earth village paths
  mudFactor: number;   // 1 on tidal alluvial mud bank
  orchardFactor: number;
}

export function sampleMainRiverDistance(x: number, z: number): { dist: number; halfWidth: number } {
  const { dist } = distanceToPolylineXZ(x, z, MAIN_RIVER_SPINE);
  // Wider confluence near Floating Market (z in [-42..32])
  const confluence =
    (1 - smoothstep(18, 60, Math.abs(z + 4))) * 9.5;
  // Slightly narrower at main bridge crossing (z around -66)
  const bridgePinch =
    (1 - smoothstep(0, 26, Math.abs(z + 66))) * 5.0;
  const wobble = (fbm2D(x * 0.025 + 3.1, z * 0.025 - 1.7, 3) - 0.5) * 4.5;
  const halfWidth = 25.5 + confluence - bridgePinch + wobble;
  return { dist, halfWidth };
}

export function sampleEastCanalDistance(x: number, z: number): { dist: number; halfWidth: number } {
  const { dist } = distanceToPolylineXZ(x, z, EAST_CANAL_SPINE);
  const wobble = (fbm2D(x * 0.04 + 7.2, z * 0.04 + 2.4, 2) - 0.5) * 2.2;
  const mouthFlare = (1 - smoothstep(0, 20, Math.hypot(x + 2, z + 16))) * 4.5;
  const halfWidth = 7.6 + mouthFlare + wobble;
  return { dist, halfWidth };
}

export function sampleWestCreekDistance(x: number, z: number): { dist: number; halfWidth: number } {
  const { dist } = distanceToPolylineXZ(x, z, WEST_CREEK_SPINE);
  const halfWidth = 5.4;
  return { dist, halfWidth };
}

export function sampleTerrainInfo(x: number, z: number): TerrainSample {
  // Base organic Mekong alluvial plain (gently undulating +1.15m .. +1.95m)
  const macroNoise = fbm2D(x * 0.011 + 12.4, z * 0.011 - 8.3, 4);
  const microNoise = fbm2D(x * 0.065 - 4.1, z * 0.065 + 9.2, 3);
  let h = 1.25 + macroNoise * 0.72 + (microNoise - 0.5) * 0.18;

  // Distant subtle mounds/tree-line horizon banks beyond 145m
  const distFromCenter = Math.hypot(x, z);
  if (distFromCenter > 135) {
    h += smoothstep(135, 240, distFromCenter) * (0.4 + macroNoise * 0.8);
  }

  // --- Curated Flat / Terraced Architectural Grounds ---
  // 1. Heritage Mansion & Shophouses plateau (x: 24..86, z: 22..78) -> y = 1.62
  const mansionMask =
    (1 - smoothstep(22, 34, Math.abs(x - 54))) *
    (1 - smoothstep(22, 34, Math.abs(z - 48)));
  h = lerp(h, 1.64, mansionMask * 0.92);

  // 2. Khmer Pagoda West Bank plateau (x: -82..-38, z: -24..34) -> y = 1.72
  const pagodaMask =
    (1 - smoothstep(16, 28, Math.abs(x + 60))) *
    (1 - smoothstep(20, 32, Math.abs(z - 6)));
  h = lerp(h, 1.74, pagodaMask * 0.94);

  // 3. Stilt Village rear dry embankment (x: 26..48, z: -12..20)
  const villageRearMask =
    (1 - smoothstep(9, 16, Math.abs(x - 36))) *
    (1 - smoothstep(12, 20, Math.abs(z - 4)));
  h = lerp(h, 1.48, villageRearMask * 0.85);

  // 4. Orchard Peninsula Raised Beds ("lên liếp") & Irrigation Trenches ("mương vườn")
  // Zone: x in [28..105], z in [-112..-42]
  const inOrchardX = smoothstep(24, 34, x) * (1 - smoothstep(98, 114, x));
  const inOrchardZ = smoothstep(-118, -102, z) * (1 - smoothstep(-46, -36, z));
  const orchardFactor = inOrchardX * inOrchardZ;
  if (orchardFactor > 0.01) {
    // Parallel raised orchard beds every ~11m along X, separated by 2.4m ditches
    const ditchPhase = Math.abs(((x - 30) % 12 + 12) % 12 - 6);
    const ditchMask = 1 - smoothstep(1.1, 2.3, ditchPhase);
    // Avoid digging ditches directly under footpaths or lotus pond
    const bedHeight = 1.48 + (microNoise - 0.5) * 0.1;
    const ditchDepth = -0.45;
    h = lerp(h, lerp(bedHeight, ditchDepth, ditchMask * 0.95), orchardFactor * 0.9);
  }

  // 5. Lotus Pond ("Ao Sen") centered at (70, -74), radius ~12.5m
  const pondDist = Math.hypot(x - 70, z + 74);
  const pondFactor = 1 - smoothstep(8.0, 14.5, pondDist);
  if (pondFactor > 0.001) {
    h = lerp(h, -0.78, pondFactor);
  }

  // --- River & Canal Hydrological Carving ---
  const mainR = sampleMainRiverDistance(x, z);
  const mainRatio = mainR.dist / Math.max(mainR.halfWidth, 4);
  // Smooth alluvial riverbank: gradual muddy shelf between 0.72 and 1.15
  const mainCarve = 1 - smoothstep(0.68, 1.16, mainRatio);

  const eastC = sampleEastCanalDistance(x, z);
  const eastRatio = eastC.dist / Math.max(eastC.halfWidth, 3);
  const eastCarve = 1 - smoothstep(0.58, 1.22, eastRatio);

  const westC = sampleWestCreekDistance(x, z);
  const westRatio = westC.dist / Math.max(westC.halfWidth, 3);
  const westCarve = 1 - smoothstep(0.58, 1.22, westRatio);

  const channelCarve = Math.max(mainCarve, eastCarve * 0.92, westCarve * 0.85);
  const targetBedDepth =
    mainCarve >= eastCarve
      ? -3.6 * smoothstep(0.05, 0.9, mainCarve) - 0.45
      : -1.85 * smoothstep(0.05, 0.9, Math.max(eastCarve, westCarve)) - 0.35;

  if (channelCarve > 0.001) {
    // Blend gently so tidal mudflats form naturally at -0.25m .. +0.42m
    h = lerp(h, targetBedDepth, smoothstep(0.0, 0.85, channelCarve));
  }

  // Stilt Village tidal shelf under houses (x: 16..27, z: -14..18)
  // Keep shallow muddy water / low mudflat (-0.55..+0.25) so stilt pilings are visually dramatic!
  const stiltBankMask =
    (1 - smoothstep(4, 8, Math.abs(x - 21))) *
    (1 - smoothstep(13, 19, Math.abs(z - 2)));
  if (stiltBankMask > 0.01) {
    const shelfH = lerp(-0.55, 0.65, smoothstep(16, 26, x));
    h = lerp(h, shelfH, stiltBankMask * 0.65);
  }

  // --- Village Packed Earth Paths ---
  const dEast = distanceToPolylineXZ(x, z, VILLAGE_PATH_EAST).dist;
  const dOrchard = distanceToPolylineXZ(x, z, VILLAGE_PATH_ORCHARD).dist;
  const dWest = distanceToPolylineXZ(x, z, VILLAGE_PATH_WEST).dist;
  const minPathDist = Math.min(dEast, dOrchard, dWest);
  const pathFactor =
    h > 0.45 ? 1 - smoothstep(1.35, 2.7, minPathDist) : 0;

  // Flatten terrain smoothly along dry paths
  if (pathFactor > 0.01 && h > 0.6) {
    h = lerp(h, Math.max(h, 1.48), pathFactor * 0.35);
  }

  const mudFactor = clamp(1 - smoothstep(-0.35, 0.52, Math.abs(h - 0.08)), 0, 1);

  return {
    height: h,
    riverFactor: channelCarve,
    canalFactor: Math.max(eastCarve, westCarve, pondFactor),
    pathFactor,
    mudFactor,
    orchardFactor,
  };
}

export function sampleTerrainHeight(x: number, z: number): number {
  return sampleTerrainInfo(x, z).height;
}

/**
 * Returns the effective ground elevation for player walking (maximum of terrain height
 * and any registered wooden deck / pier / stair / bridge surface covering (x, z)).
 */
export function sampleWalkableHeight(x: number, z: number, currentFootY = 2): {
  y: number;
  onStructure: boolean;
} {
  const terrainY = sampleTerrainHeight(x, z);
  let bestY = terrainY;
  let onStructure = false;

  for (let i = 0; i < walkableSurfaces.length; i++) {
    const s = walkableSurfaces[i];
    if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
      const sy = s.getHeight(x, z);
      // Allow stepping onto structures up to 1.25m above feet or below feet
      if (sy > bestY && sy <= currentFootY + 1.5) {
        bestY = sy;
        onStructure = true;
      }
    }
  }

  return { y: bestY, onStructure };
}

export function resolveHorizontalCollision(
  nextX: number,
  nextZ: number,
  radius: number,
  footY: number,
): { x: number; z: number } {
  let x = clamp(nextX, -210, 210);
  let z = clamp(nextZ, -210, 210);

  for (let i = 0; i < solidColliders.length; i++) {
    const c = solidColliders[i];
    if (c.maxY !== undefined && footY > c.maxY) continue;
    const minX = c.minX - radius;
    const maxX = c.maxX + radius;
    const minZ = c.minZ - radius;
    const maxZ = c.maxZ + radius;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      const dxLeft = x - minX;
      const dxRight = maxX - x;
      const dzFront = z - minZ;
      const dzBack = maxZ - z;
      const m = Math.min(dxLeft, dxRight, dzFront, dzBack);
      if (m === dxLeft) x = minX;
      else if (m === dxRight) x = maxX;
      else if (m === dzFront) z = minZ;
      else z = maxZ;
    }
  }

  return { x, z };
}

/**
 * Distance along a ray (in metres) to the nearest registered solid collider, or `null` when the
 * ray does not hit one within `maxDistance`. Colliders are vertical boxes (open at the bottom,
 * capped by `maxY` when set), so this is a slab test in x and z plus a height check at the hit.
 */
export function raycastSolidColliders(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxDistance: number,
): number | null {
  let nearest: number | null = null;
  for (let i = 0; i < solidColliders.length; i++) {
    const c = solidColliders[i];
    let tMin = 0;
    let tMax = maxDistance;
    const slabs: Array<[number, number, number]> = [
      [originX, dirX, c.minX],
      [originZ, dirZ, c.minZ],
    ];
    const maxes = [c.maxX, c.maxZ];
    let hit = true;
    for (let axis = 0; axis < 2; axis++) {
      const [origin, dir, min] = slabs[axis];
      const max = maxes[axis];
      if (Math.abs(dir) < 1e-6) {
        if (origin < min || origin > max) {
          hit = false;
          break;
        }
      } else {
        let t1 = (min - origin) / dir;
        let t2 = (max - origin) / dir;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) {
          hit = false;
          break;
        }
      }
    }
    if (!hit) continue;
    if (c.maxY !== undefined && originY + dirY * tMin > c.maxY) continue;
    if (nearest === null || tMin < nearest) nearest = tMin;
  }
  return nearest;
}

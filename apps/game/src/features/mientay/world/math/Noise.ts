export class SeededRNG {
  private state: number;

  constructor(seed = 1337) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 0.9999));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(ix: number, iy: number): number {
  const h = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

export function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

export function fbm2D(
  x: number,
  y: number,
  octaves = 4,
  lacunarity = 2.04,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq);
    norm += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return sum / norm;
}

export function ridgedFbm2D(x: number, y: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1.0 - Math.abs(valueNoise2D(x * freq, y * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    freq *= 2.13;
    amp *= 0.5;
  }
  return sum / norm;
}

/**
 * Minimum distance from point (px, pz) to a polyline in XZ plane.
 * Also returns normalized parameter t along polyline and closest point.
 */
export function distanceToPolylineXZ(
  px: number,
  pz: number,
  pts: ReadonlyArray<readonly [number, number]>,
): { dist: number; t: number; cx: number; cz: number } {
  let bestDistSq = Infinity;
  let bestT = 0;
  let bestX = pts[0][0];
  let bestZ = pts[0][1];
  const segCount = pts.length - 1;

  for (let i = 0; i < segCount; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0];
    const bz = pts[i + 1][1];
    const dx = bx - ax;
    const dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    let u = lenSq > 1e-6 ? ((px - ax) * dx + (pz - az) * dz) / lenSq : 0;
    u = clamp(u, 0, 1);
    const cx = ax + u * dx;
    const cz = az + u * dz;
    const ddx = px - cx;
    const ddz = pz - cz;
    const dSq = ddx * ddx + ddz * ddz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestT = (i + u) / segCount;
      bestX = cx;
      bestZ = cz;
    }
  }

  return {
    dist: Math.sqrt(bestDistSq),
    t: bestT,
    cx: bestX,
    cz: bestZ,
  };
}

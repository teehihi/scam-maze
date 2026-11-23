import type {
  CrosswalkSpec,
  IntersectionSpec,
  RoadEdge,
  SignalAxis,
  SplineSample,
  TurnArc,
  TurnKind,
  Vec2,
} from "./types";

const LUT_STEPS = 24;

function evalCubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): {
  x: number;
  z: number;
  dx: number;
  dz: number;
  ddx: number;
  ddz: number;
} {
  const u = 1 - t;
  const u2 = u * u;
  const t2 = t * t;
  const x = u2 * u * p0.x + 3 * u2 * t * p1.x + 3 * u * t2 * p2.x + t2 * t * p3.x;
  const z = u2 * u * p0.z + 3 * u2 * t * p1.z + 3 * u * t2 * p2.z + t2 * t * p3.z;
  const dx = 3 * u2 * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
  const dz = 3 * u2 * (p1.z - p0.z) + 6 * u * t * (p2.z - p1.z) + 3 * t2 * (p3.z - p2.z);
  const ddx = 6 * u * (p2.x - 2 * p1.x + p0.x) + 6 * t * (p3.x - 2 * p2.x + p1.x);
  const ddz = 6 * u * (p2.z - 2 * p1.z + p0.z) + 6 * t * (p3.z - 2 * p2.z + p1.z);
  return { x, z, dx, dz, ddx, ddz };
}

function buildBezierLut(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): {
  lut: SplineSample[];
  lutS: number[];
  length: number;
} {
  const lut: SplineSample[] = [];
  const lutS: number[] = [];
  let accum = 0;
  let prevX = p0.x;
  let prevZ = p0.z;

  for (let i = 0; i <= LUT_STEPS; i++) {
    const t = i / LUT_STEPS;
    const e = evalCubicBezier(p0, p1, p2, p3, t);
    if (i > 0) accum += Math.hypot(e.x - prevX, e.z - prevZ);
    prevX = e.x;
    prevZ = e.z;

    const speed = Math.hypot(e.dx, e.dz) || 1;
    const tx = e.dx / speed;
    const tz = e.dz / speed;
    // Signed curvature in XZ plane: positive when curving LEFT (counter-clockwise in yaw = atan2(tx, tz))
    // d(yaw)/ds = (tx * ddz - tz * ddx)? Let's verify:
    // yaw = atan2(tx, tz) -> d/dt atan2(dx, dz) = (dz*ddx - dx*ddz) / (dx^2 + dz^2)
    // With forward (0, -1) turning LEFT to (-1, 0): dx goes 0 -> -1 (ddx < 0), dz = -1 -> dz*ddx = (-1)(-1) = +1 > 0!
    // Wait: yaw goes from PI to -PI/2 which is +PI/2 (CCW = LEFT)! So (dz*ddx - dx*ddz) / speed^3 > 0 = LEFT turn!
    const curvature = (e.dz * e.ddx - e.dx * e.ddz) / Math.max(speed * speed * speed, 1e-4);

    lut.push({
      x: e.x,
      z: e.z,
      tx,
      tz,
      rx: -tz,
      rz: tx,
      yaw: Math.atan2(tx, tz),
      curvature,
    });
    lutS.push(accum);
  }
  return { lut, lutS, length: Math.max(accum, 0.1) };
}

export function sampleEdge(edge: RoadEdge, s: number, latOffset = 0): SplineSample {
  const clamped = Math.max(0, Math.min(edge.length, s));
  return {
    x: edge.start.x + edge.tx * clamped + edge.rx * latOffset,
    z: edge.start.z + edge.tz * clamped + edge.rz * latOffset,
    tx: edge.tx,
    tz: edge.tz,
    rx: edge.rx,
    rz: edge.rz,
    yaw: edge.yaw,
    curvature: 0,
  };
}

export function sampleTurn(turn: TurnArc, s: number, latOffset = 0): SplineSample {
  const { lut, lutS, length } = turn;
  const target = Math.max(0, Math.min(length, s));
  // Binary search in LUT (25 entries -> 5 iterations)
  let lo = 0;
  let hi = lutS.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (lutS[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = Math.max(lutS[hi] - lutS[lo], 1e-5);
  const f = (target - lutS[lo]) / span;
  const a = lut[lo];
  const b = lut[hi];
  const tx0 = a.tx + (b.tx - a.tx) * f;
  const tz0 = a.tz + (b.tz - a.tz) * f;
  const tLen = Math.hypot(tx0, tz0) || 1;
  const tx = tx0 / tLen;
  const tz = tz0 / tLen;
  const rx = -tz;
  const rz = tx;
  const cx = a.x + (b.x - a.x) * f;
  const cz = a.z + (b.z - a.z) * f;
  return {
    x: cx + rx * latOffset,
    z: cz + rz * latOffset,
    tx,
    tz,
    rx,
    rz,
    yaw: Math.atan2(tx, tz),
    curvature: a.curvature + (b.curvature - a.curvature) * f,
  };
}

function distSqPointToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-8) return (px - ax) ** 2 + (pz - az) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
  const dx = px - (ax + vx * t);
  const dz = pz - (az + vz * t);
  return dx * dx + dz * dz;
}

function turnsConflict(a: TurnArc, b: TurnArc): boolean {
  if (a.id === b.id) return false;
  // Same source edge never conflicts in-junction (handled by same-lane car-following)
  if (a.fromEdgeId === b.fromEdgeId) return false;
  // Merging into the exact same destination edge ALWAYS conflicts!
  if (a.toEdgeId === b.toEdgeId) return true;
  // Otherwise test swept polyline clearance (< 3.4m centerline distance inside the junction)
  const clearanceSq = 3.4 * 3.4;
  for (let i = 2; i < a.lut.length - 2; i += 2) {
    const pa = a.lut[i];
    for (let j = 2; j < b.lut.length - 2; j += 2) {
      const pb = b.lut[j];
      const d2 = (pa.x - pb.x) ** 2 + (pa.z - pb.z) ** 2;
      if (d2 < clearanceSq) return true;
    }
  }
  return false;
}

function turnCrossesCrosswalk(turn: TurnArc, cw: CrosswalkSpec): boolean {
  const threshSq = (cw.halfWidth + 1.4) ** 2;
  for (let i = 0; i < turn.lut.length; i += 2) {
    const p = turn.lut[i];
    if (distSqPointToSegment(p.x, p.z, cw.a.x, cw.a.z, cw.b.x, cw.b.z) < threshSq) {
      return true;
    }
  }
  return false;
}

export class SaigonRoadGraph {
  readonly edges = new Map<string, RoadEdge>();
  readonly turns = new Map<string, TurnArc>();
  readonly intersections = new Map<string, IntersectionSpec>();
  readonly crosswalks = new Map<string, CrosswalkSpec>();

  constructor() {
    this.buildNetwork();
  }

  private addEdge(spec: {
    id: string;
    streetName: string;
    fromNode: string;
    toNode: string;
    axis: SignalAxis;
    start: Vec2;
    end: Vec2;
    width?: number;
    carLaneOffsets?: number[];
    motoLatRange?: [number, number];
    speedLimit?: number;
    busStopS?: number;
    curbObstructions?: { s: number; halfLen: number; latMin: number; latMax: number }[];
  }) {
    const dx = spec.end.x - spec.start.x;
    const dz = spec.end.z - spec.start.z;
    const length = Math.hypot(dx, dz);
    const tx = dx / Math.max(length, 1e-4);
    const tz = dz / Math.max(length, 1e-4);
    const rx = -tz;
    const rz = tx;
    const edge: RoadEdge = {
      id: spec.id,
      streetName: spec.streetName,
      fromNode: spec.fromNode,
      toNode: spec.toNode,
      axis: spec.axis,
      start: spec.start,
      end: spec.end,
      length,
      tx,
      tz,
      rx,
      rz,
      yaw: Math.atan2(tx, tz),
      width: spec.width ?? 5.4,
      carLaneOffsets: spec.carLaneOffsets ?? [-1.25, 0.95],
      motoLatRange: spec.motoLatRange ?? [-1.85, 1.95],
      speedLimit: spec.speedLimit ?? 11.1, // 40 km/h urban Saigon default
      busStopS: spec.busStopS,
      curbObstructions: spec.curbObstructions ?? [],
      outgoingTurns: [],
    };
    this.edges.set(edge.id, edge);
  }

  private addIntersection(spec: Omit<IntersectionSpec, "turnIds" | "crosswalkIds">) {
    this.intersections.set(spec.id, { ...spec, turnIds: [], crosswalkIds: [] });
  }

  private addCrosswalk(spec: Omit<CrosswalkSpec, "length">) {
    const length = Math.hypot(spec.b.x - spec.a.x, spec.b.z - spec.a.z);
    const cw: CrosswalkSpec = { ...spec, length };
    this.crosswalks.set(cw.id, cw);
    this.intersections.get(cw.intersectionId)?.crosswalkIds.push(cw.id);
  }

  private addTurn(
    intersectionId: string,
    fromEdgeId: string,
    toEdgeId: string,
    kind: TurnKind,
    opts?: { weight?: number; motoRtor?: boolean; handleScale?: number },
  ) {
    const from = this.edges.get(fromEdgeId);
    const to = this.edges.get(toEdgeId);
    if (!from || !to) throw new Error(`Invalid turn ${fromEdgeId} -> ${toEdgeId}`);

    const p0 = { x: from.end.x, z: from.end.z };
    const p3 = { x: to.start.x, z: to.start.z };
    const chord = Math.hypot(p3.x - p0.x, p3.z - p0.z);

    let p1: Vec2;
    let p2: Vec2;
    if (kind === "uturn") {
      // Smooth off-screen turnaround arc beyond road boundary
      const bulge = Math.max(4.5, chord * 0.85);
      p1 = { x: p0.x + from.tx * bulge, z: p0.z + from.tz * bulge };
      p2 = { x: p3.x - to.tx * bulge, z: p3.z - to.tz * bulge };
    } else if (kind === "straight") {
      const h = chord * 0.35;
      p1 = { x: p0.x + from.tx * h, z: p0.z + from.tz * h };
      p2 = { x: p3.x - to.tx * h, z: p3.z - to.tz * h };
    } else {
      // Right or left 90° intersection curve: Hermite/Bezier handle ~0.55 * chord gives natural circular arc!
      const h = chord * (opts?.handleScale ?? 0.56);
      p1 = { x: p0.x + from.tx * h, z: p0.z + from.tz * h };
      p2 = { x: p3.x - to.tx * h, z: p3.z - to.tz * h };
    }

    const { lut, lutS, length } = buildBezierLut(p0, p1, p2, p3);
    const maxSpeed =
      kind === "straight"
        ? Math.min(from.speedLimit, to.speedLimit)
        : kind === "right"
          ? 5.8 // ~21 km/h tight urban corner
          : kind === "left"
            ? 6.6 // ~24 km/h wide left turn
            : 4.5; // U-turn

    const id = `${fromEdgeId}__${toEdgeId}`;
    const turn: TurnArc = {
      id,
      intersectionId,
      fromEdgeId,
      toEdgeId,
      kind,
      axis: from.axis,
      motoRtor: opts?.motoRtor ?? false,
      p0,
      p1,
      p2,
      p3,
      length,
      lut,
      lutS,
      maxSpeed,
      conflicts: new Set<string>(),
      crosswalks: [],
      weight: opts?.weight ?? (kind === "straight" ? 0.62 : 0.24),
    };

    this.turns.set(id, turn);
    from.outgoingTurns.push(id);
    this.intersections.get(intersectionId)?.turnIds.push(id);
  }

  private buildNetwork() {
    // =========================================================================
    // 1. INTERSECTIONS (5 Signalized QCVN 41:2024 + 1 Unsignalized + 5 Portals)
    // =========================================================================
    this.addIntersection({
      id: "J_LTT_32",
      name: "Ngã ba Lý Thái Tổ × Đường 3/2",
      center: { x: -6.4, z: -76 },
      signalized: true,
      phaseOffset: 0,
      nsGreenSec: 18,
      ewGreenSec: 15,
      amberSec: 3.0,
      allRedSec: 1.8,
    });

    this.addIntersection({
      id: "J_LTT_PED",
      name: "Vạch đi bộ Lý Thái Tổ (Z=-96)",
      center: { x: -6.4, z: -96 },
      signalized: true,
      phaseOffset: 6.5,
      nsGreenSec: 22,
      ewGreenSec: 11, // Pedestrian crossing phase (>= 10s per QCVN 41:2024)
      amberSec: 3.0,
      allRedSec: 1.8,
      midblockPedOnly: true,
    });

    this.addIntersection({
      id: "J_LTT_DBP",
      name: "Ngã ba Lý Thái Tổ × Điện Biên Phủ",
      center: { x: -6.4, z: -147 },
      signalized: true,
      phaseOffset: 11.0, // Green wave from J_LTT_32 (~71m at ~30 km/h)
      nsGreenSec: 18,
      ewGreenSec: 15,
      amberSec: 3.0,
      allRedSec: 1.8,
    });

    this.addIntersection({
      id: "J_HT_32",
      name: "Ngã ba Hải Triều × Đường 3/2",
      center: { x: 56, z: -76 },
      signalized: true,
      phaseOffset: 8.0, // Green wave from Lý Thái Tổ along Đường 3/2 (~62m)
      nsGreenSec: 15,
      ewGreenSec: 18,
      amberSec: 3.0,
      allRedSec: 1.8,
    });

    this.addIntersection({
      id: "J_HT_DBP",
      name: "Ngã tư Hải Triều × Điện Biên Phủ (Bitexco)",
      center: { x: 56, z: -147 },
      signalized: true,
      phaseOffset: 16.0,
      nsGreenSec: 16,
      ewGreenSec: 17,
      amberSec: 3.0,
      allRedSec: 1.8,
    });

    // Unsignalized smooth connector at north end of Lý Thái Tổ -> Vinhomes Blvd
    this.addIntersection({
      id: "J_LTT_VH",
      name: "Nút giao Ven Sông – Vinhomes Central Park",
      center: { x: -6.4, z: -306 },
      signalized: false,
      phaseOffset: 0,
      nsGreenSec: 30,
      ewGreenSec: 30,
      amberSec: 0,
      allRedSec: 0,
    });

    // Boundary turnaround nodes (beyond main playable street focus)
    for (const [id, x, z] of [
      ["END_LTT_S", -6.4, 46],
      ["END_D32_E", 122, -76],
      ["END_DBP_E", 124, -147],
      ["END_HT_N", 56, -230],
      ["END_VH_E", 90, -306],
    ] as const) {
      this.addIntersection({
        id,
        name: id,
        center: { x, z },
        signalized: false,
        phaseOffset: 0,
        nsGreenSec: 30,
        ewGreenSec: 30,
        amberSec: 0,
        allRedSec: 0,
      });
    }

    // =========================================================================
    // 2. ROAD EDGES — STRICT VIETNAM RIGHT-HAND TRAFFIC (MATCHING RENDERED ASPHALT!)
    // =========================================================================
    // A. LÝ THÁI TỔ (x ∈ [-12.8, 0], median at x = -6.4)
    //    Northbound (-Z): centerline x = -3.2 (right curb x = 0, median x = -6.4)
    //    Southbound (+Z): centerline x = -9.6 (right curb x = -12.8, median x = -6.4)
    //    Note: Parked SUV (x=-11.78, z=-12.5) and Parked Van (x=-11.82, z=-34) on West curb
    //    occupy southbound latOffset ∈ [+1.12, +3.1] (since rx = -1 -> x = -9.6 - lat).
    this.addEdge({
      id: "LTT_S_NB",
      streetName: "Đường Lý Thái Tổ (Nam → Bắc)",
      fromNode: "END_LTT_S",
      toNode: "J_LTT_32",
      axis: "ns",
      start: { x: -3.2, z: 46 },
      end: { x: -3.2, z: -67.2 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45], // x = -4.65 (inner car/van), x = -2.75 (outer)
      motoLatRange: [-2.15, 1.95], // x ∈ [-5.35, -1.25]
      speedLimit: 11.2,
      busStopS: 46, // z = 0 (Trạm Lý Thái Tổ)
    });
    this.addEdge({
      id: "LTT_S_SB",
      streetName: "Đường Lý Thái Tổ (Bắc → Nam)",
      fromNode: "J_LTT_32",
      toNode: "END_LTT_S",
      axis: "ns",
      start: { x: -9.6, z: -67.2 },
      end: { x: -9.6, z: 46 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45], // x = -8.15 (inner), x = -10.05 (outer, clear of parked cars!)
      motoLatRange: [-2.15, 1.95],
      speedLimit: 11.2,
      curbObstructions: [
        // Parked Van at z = -34 -> s = -34 - (-67.2) = 33.2
        { s: 33.2, halfLen: 2.35, latMin: 1.05, latMax: 3.1 },
        // Parked SUV at z = -12.5 -> s = -12.5 - (-67.2) = 54.7
        { s: 54.7, halfLen: 2.55, latMin: 1.05, latMax: 3.1 },
      ],
    });

    // Lý Thái Tổ mid segment 1: J_LTT_32 (-76) <-> J_LTT_PED (-96)
    this.addEdge({
      id: "LTT_M1_NB",
      streetName: "Đường Lý Thái Tổ",
      fromNode: "J_LTT_32",
      toNode: "J_LTT_PED",
      axis: "ns",
      start: { x: -3.2, z: -84.8 },
      end: { x: -3.2, z: -91.4 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45],
      motoLatRange: [-2.15, 1.95],
      speedLimit: 10.5,
    });
    this.addEdge({
      id: "LTT_M1_SB",
      streetName: "Đường Lý Thái Tổ",
      fromNode: "J_LTT_PED",
      toNode: "J_LTT_32",
      axis: "ns",
      start: { x: -9.6, z: -91.4 },
      end: { x: -9.6, z: -84.8 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45],
      motoLatRange: [-2.15, 1.95],
      speedLimit: 10.5,
    });

    // Lý Thái Tổ mid segment 2: J_LTT_PED (-96) <-> J_LTT_DBP (-147)
    this.addEdge({
      id: "LTT_M2_NB",
      streetName: "Đường Lý Thái Tổ – Châu Văn Liêm",
      fromNode: "J_LTT_PED",
      toNode: "J_LTT_DBP",
      axis: "ns",
      start: { x: -3.2, z: -100.6 },
      end: { x: -3.2, z: -138.2 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45],
      motoLatRange: [-2.15, 1.95],
      speedLimit: 11.2,
      busStopS: 27.4, // z = -128 (Trạm Chợ Lớn)
    });
    this.addEdge({
      id: "LTT_M2_SB",
      streetName: "Đường Lý Thái Tổ – Châu Văn Liêm",
      fromNode: "J_LTT_DBP",
      toNode: "J_LTT_PED",
      axis: "ns",
      start: { x: -9.6, z: -138.2 },
      end: { x: -9.6, z: -100.6 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45],
      motoLatRange: [-2.15, 1.95],
      speedLimit: 11.2,
    });

    // Lý Thái Tổ north segment: J_LTT_DBP (-147) <-> J_LTT_VH (-306)
    this.addEdge({
      id: "LTT_N_NB",
      streetName: "Đường Ven Sông Sài Gòn",
      fromNode: "J_LTT_DBP",
      toNode: "J_LTT_VH",
      axis: "ns",
      start: { x: -3.2, z: -155.8 },
      end: { x: -3.2, z: -297.5 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45],
      motoLatRange: [-2.15, 1.95],
      speedLimit: 13.5, // ~49 km/h riverside avenue
    });
    this.addEdge({
      id: "LTT_N_SB",
      streetName: "Đường Ven Sông Sài Gòn",
      fromNode: "J_LTT_VH",
      toNode: "J_LTT_DBP",
      axis: "ns",
      start: { x: -9.6, z: -297.5 },
      end: { x: -9.6, z: -155.8 },
      width: 5.8,
      carLaneOffsets: [-1.45, 0.45],
      motoLatRange: [-2.15, 1.95],
      speedLimit: 13.5,
    });

    // B. ĐƯỜNG 3/2 (z ∈ [-82, -70], median at z = -76)
    //    Eastbound (+X, South half): centerline z = -73.0
    //    Westbound (-X, North half): centerline z = -79.0
    this.addEdge({
      id: "D32_W_EB",
      streetName: "Đường 3/2 (Tây → Đông)",
      fromNode: "J_LTT_32",
      toNode: "J_HT_32",
      axis: "ew",
      start: { x: 8.6, z: -73.0 },
      end: { x: 44.8, z: -73.0 },
      speedLimit: 11.8,
    });
    this.addEdge({
      id: "D32_W_WB",
      streetName: "Đường 3/2 (Đông → Tây)",
      fromNode: "J_HT_32",
      toNode: "J_LTT_32",
      axis: "ew",
      start: { x: 44.8, z: -79.0 },
      end: { x: 8.6, z: -79.0 },
      speedLimit: 11.8,
    });
    this.addEdge({
      id: "D32_E_EB",
      streetName: "Đường 3/2 (Hướng Q.1)",
      fromNode: "J_HT_32",
      toNode: "END_D32_E",
      axis: "ew",
      start: { x: 67.2, z: -73.0 },
      end: { x: 122.0, z: -73.0 },
      speedLimit: 12.2,
    });
    this.addEdge({
      id: "D32_E_WB",
      streetName: "Đường 3/2 (Hướng Q.10)",
      fromNode: "END_D32_E",
      toNode: "J_HT_32",
      axis: "ew",
      start: { x: 122.0, z: -79.0 },
      end: { x: 67.2, z: -79.0 },
      speedLimit: 12.2,
    });

    // C. ĐƯỜNG ĐIỆN BIÊN PHỦ (z ∈ [-153, -141], median at z = -147)
    //    Eastbound (+X, South half): centerline z = -144.0
    //    Westbound (-X, North half): centerline z = -150.0
    this.addEdge({
      id: "DBP_W_EB",
      streetName: "Đường Điện Biên Phủ (Tây → Đông)",
      fromNode: "J_LTT_DBP",
      toNode: "J_HT_DBP",
      axis: "ew",
      start: { x: 8.6, z: -144.0 },
      end: { x: 44.8, z: -144.0 },
      speedLimit: 12.0,
    });
    this.addEdge({
      id: "DBP_W_WB",
      streetName: "Đường Điện Biên Phủ (Đông → Tây)",
      fromNode: "J_HT_DBP",
      toNode: "J_LTT_DBP",
      axis: "ew",
      start: { x: 44.8, z: -150.0 },
      end: { x: 8.6, z: -150.0 },
      speedLimit: 12.0,
    });
    this.addEdge({
      id: "DBP_E_EB",
      streetName: "Đường Điện Biên Phủ (Bitexco)",
      fromNode: "J_HT_DBP",
      toNode: "END_DBP_E",
      axis: "ew",
      start: { x: 67.2, z: -144.0 },
      end: { x: 124.0, z: -144.0 },
      speedLimit: 12.0,
    });
    this.addEdge({
      id: "DBP_E_WB",
      streetName: "Đường Điện Biên Phủ (Bitexco)",
      fromNode: "END_DBP_E",
      toNode: "J_HT_DBP",
      axis: "ew",
      start: { x: 124.0, z: -150.0 },
      end: { x: 67.2, z: -150.0 },
      speedLimit: 12.0,
    });

    // D. ĐƯỜNG HẢI TRIỀU (x ∈ [50, 62], median at x = 56)
    //    Northbound (-Z, East half): centerline x = 59.0
    //    Southbound (+Z, West half): centerline x = 53.0
    this.addEdge({
      id: "HT_S_NB",
      streetName: "Đường Hải Triều (Bắc)",
      fromNode: "J_HT_32",
      toNode: "J_HT_DBP",
      axis: "ns",
      start: { x: 59.0, z: -87.2 },
      end: { x: 59.0, z: -135.8 },
      speedLimit: 11.0,
    });
    this.addEdge({
      id: "HT_S_SB",
      streetName: "Đường Hải Triều (Nam)",
      fromNode: "J_HT_DBP",
      toNode: "J_HT_32",
      axis: "ns",
      start: { x: 53.0, z: -135.8 },
      end: { x: 53.0, z: -87.2 },
      speedLimit: 11.0,
    });
    this.addEdge({
      id: "HT_N_NB",
      streetName: "Đường Hải Triều (Bitexco Bắc)",
      fromNode: "J_HT_DBP",
      toNode: "END_HT_N",
      axis: "ns",
      start: { x: 59.0, z: -158.2 },
      end: { x: 59.0, z: -230.0 },
      speedLimit: 11.5,
    });
    this.addEdge({
      id: "HT_N_SB",
      streetName: "Đường Hải Triều (Bitexco Nam)",
      fromNode: "END_HT_N",
      toNode: "J_HT_DBP",
      axis: "ns",
      start: { x: 53.0, z: -230.0 },
      end: { x: 53.0, z: -158.2 },
      speedLimit: 11.5,
    });

    // E. ĐƯỜNG VINHOMES CENTRAL PARK (z ∈ [-312, -300], center z = -306)
    this.addEdge({
      id: "VH_EB",
      streetName: "Đại lộ Vinhomes Central Park",
      fromNode: "J_LTT_VH",
      toNode: "END_VH_E",
      axis: "ew",
      start: { x: 4.0, z: -303.0 },
      end: { x: 90.0, z: -303.0 },
      speedLimit: 12.5,
    });
    this.addEdge({
      id: "VH_WB",
      streetName: "Đại lộ Vinhomes Central Park",
      fromNode: "END_VH_E",
      toNode: "J_LTT_VH",
      axis: "ew",
      start: { x: 90.0, z: -309.0 },
      end: { x: 4.0, z: -309.0 },
      speedLimit: 12.5,
    });

    // =========================================================================
    // 3. CROSSWALKS (MATCHING EVERY RENDERED ZEBRA STRIP IN street.ts & saigonDistricts.ts!)
    // =========================================================================
    this.addCrosswalk({
      id: "CW_LTT_32_NS",
      intersectionId: "J_LTT_32",
      pedAxis: "ew",
      parallelVehicleAxis: "ew",
      a: { x: 0.4, z: -76 },
      b: { x: -13.2, z: -76 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_LTT_32_EW",
      intersectionId: "J_LTT_32",
      pedAxis: "ns",
      parallelVehicleAxis: "ns",
      a: { x: 5.6, z: -69.8 },
      b: { x: 5.6, z: -82.2 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_LTT_PED",
      intersectionId: "J_LTT_PED",
      pedAxis: "ew",
      parallelVehicleAxis: "ew",
      a: { x: 0.4, z: -96 },
      b: { x: -13.2, z: -96 },
      halfWidth: 1.7,
    });
    this.addCrosswalk({
      id: "CW_LTT_DBP_NS",
      intersectionId: "J_LTT_DBP",
      pedAxis: "ew",
      parallelVehicleAxis: "ew",
      a: { x: 0.4, z: -147 },
      b: { x: -13.2, z: -147 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_LTT_DBP_EW",
      intersectionId: "J_LTT_DBP",
      pedAxis: "ns",
      parallelVehicleAxis: "ns",
      a: { x: 5.6, z: -140.8 },
      b: { x: 5.6, z: -153.2 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_HT_32_W",
      intersectionId: "J_HT_32",
      pedAxis: "ns",
      parallelVehicleAxis: "ns",
      a: { x: 48.0, z: -69.8 },
      b: { x: 48.0, z: -82.2 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_HT_32_E",
      intersectionId: "J_HT_32",
      pedAxis: "ns",
      parallelVehicleAxis: "ns",
      a: { x: 64.0, z: -69.8 },
      b: { x: 64.0, z: -82.2 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_HT_32_N",
      intersectionId: "J_HT_32",
      pedAxis: "ew",
      parallelVehicleAxis: "ew",
      a: { x: 49.8, z: -84.0 },
      b: { x: 62.2, z: -84.0 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_HT_DBP_W",
      intersectionId: "J_HT_DBP",
      pedAxis: "ns",
      parallelVehicleAxis: "ns",
      a: { x: 48.0, z: -140.8 },
      b: { x: 48.0, z: -153.2 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_HT_DBP_E",
      intersectionId: "J_HT_DBP",
      pedAxis: "ns",
      parallelVehicleAxis: "ns",
      a: { x: 64.0, z: -140.8 },
      b: { x: 64.0, z: -153.2 },
      halfWidth: 1.6,
    });
    this.addCrosswalk({
      id: "CW_HT_DBP_N",
      intersectionId: "J_HT_DBP",
      pedAxis: "ew",
      parallelVehicleAxis: "ew",
      a: { x: 49.8, z: -155.0 },
      b: { x: 62.2, z: -155.0 },
      halfWidth: 1.6,
    });

    // =========================================================================
    // 4. INTERSECTION TURNS (CURVED BEZIER ARCS — ZERO TELEPORTATION!)
    // =========================================================================
    // J_LTT_32: Lý Thái Tổ × Đường 3/2 (T-junction)
    this.addTurn("J_LTT_32", "LTT_S_NB", "LTT_M1_NB", "straight", { weight: 0.65 });
    this.addTurn("J_LTT_32", "LTT_S_NB", "D32_W_EB", "right", { weight: 0.35, motoRtor: true });
    this.addTurn("J_LTT_32", "LTT_M1_SB", "LTT_S_SB", "straight", { weight: 0.72 });
    this.addTurn("J_LTT_32", "LTT_M1_SB", "D32_W_EB", "left", { weight: 0.28 });
    this.addTurn("J_LTT_32", "D32_W_WB", "LTT_M1_NB", "right", { weight: 0.45, motoRtor: true });
    this.addTurn("J_LTT_32", "D32_W_WB", "LTT_S_SB", "left", { weight: 0.55 });

    // J_LTT_PED: Midblock zebra crossing (straight through only)
    this.addTurn("J_LTT_PED", "LTT_M1_NB", "LTT_M2_NB", "straight", { weight: 1.0 });
    this.addTurn("J_LTT_PED", "LTT_M2_SB", "LTT_M1_SB", "straight", { weight: 1.0 });

    // J_LTT_DBP: Lý Thái Tổ × Điện Biên Phủ (T-junction)
    this.addTurn("J_LTT_DBP", "LTT_M2_NB", "LTT_N_NB", "straight", { weight: 0.58 });
    this.addTurn("J_LTT_DBP", "LTT_M2_NB", "DBP_W_EB", "right", { weight: 0.42, motoRtor: true });
    this.addTurn("J_LTT_DBP", "LTT_N_SB", "LTT_M2_SB", "straight", { weight: 0.70 });
    this.addTurn("J_LTT_DBP", "LTT_N_SB", "DBP_W_EB", "left", { weight: 0.30 });
    this.addTurn("J_LTT_DBP", "DBP_W_WB", "LTT_N_NB", "right", { weight: 0.42, motoRtor: true });
    this.addTurn("J_LTT_DBP", "DBP_W_WB", "LTT_M2_SB", "left", { weight: 0.58 });

    // J_HT_32: Hải Triều × Đường 3/2 (T-junction going North)
    this.addTurn("J_HT_32", "D32_W_EB", "D32_E_EB", "straight", { weight: 0.58 });
    this.addTurn("J_HT_32", "D32_W_EB", "HT_S_NB", "left", { weight: 0.42 });
    this.addTurn("J_HT_32", "D32_E_WB", "D32_W_WB", "straight", { weight: 0.60 });
    this.addTurn("J_HT_32", "D32_E_WB", "HT_S_NB", "right", { weight: 0.40, motoRtor: true });
    this.addTurn("J_HT_32", "HT_S_SB", "D32_W_WB", "right", { weight: 0.55, motoRtor: true });
    this.addTurn("J_HT_32", "HT_S_SB", "D32_E_EB", "left", { weight: 0.45 });

    // J_HT_DBP: Hải Triều × Điện Biên Phủ (Full 4-way junction right beside Bitexco!)
    this.addTurn("J_HT_DBP", "DBP_W_EB", "DBP_E_EB", "straight", { weight: 0.50 });
    this.addTurn("J_HT_DBP", "DBP_W_EB", "HT_S_SB", "right", { weight: 0.25, motoRtor: true });
    this.addTurn("J_HT_DBP", "DBP_W_EB", "HT_N_NB", "left", { weight: 0.25 });

    this.addTurn("J_HT_DBP", "DBP_E_WB", "DBP_W_WB", "straight", { weight: 0.50 });
    this.addTurn("J_HT_DBP", "DBP_E_WB", "HT_N_NB", "right", { weight: 0.25, motoRtor: true });
    this.addTurn("J_HT_DBP", "DBP_E_WB", "HT_S_SB", "left", { weight: 0.25 });

    this.addTurn("J_HT_DBP", "HT_S_NB", "HT_N_NB", "straight", { weight: 0.50 });
    this.addTurn("J_HT_DBP", "HT_S_NB", "DBP_E_EB", "right", { weight: 0.25, motoRtor: true });
    this.addTurn("J_HT_DBP", "HT_S_NB", "DBP_W_WB", "left", { weight: 0.25 });

    this.addTurn("J_HT_DBP", "HT_N_SB", "HT_S_SB", "straight", { weight: 0.50 });
    this.addTurn("J_HT_DBP", "HT_N_SB", "DBP_W_WB", "right", { weight: 0.25, motoRtor: true });
    this.addTurn("J_HT_DBP", "HT_N_SB", "DBP_E_EB", "left", { weight: 0.25 });

    // J_LTT_VH: Riverside curve onto Vinhomes Blvd
    this.addTurn("J_LTT_VH", "LTT_N_NB", "VH_EB", "right", { weight: 1.0, handleScale: 0.6 });
    this.addTurn("J_LTT_VH", "VH_WB", "LTT_N_SB", "left", { weight: 1.0, handleScale: 0.6 });

    // Boundary turnaround U-turns (keeps entire city fleet circulating naturally forever!)
    this.addTurn("END_LTT_S", "LTT_S_SB", "LTT_S_NB", "uturn", { weight: 1.0 });
    this.addTurn("END_D32_E", "D32_E_EB", "D32_E_WB", "uturn", { weight: 1.0 });
    this.addTurn("END_DBP_E", "DBP_E_EB", "DBP_E_WB", "uturn", { weight: 1.0 });
    this.addTurn("END_HT_N", "HT_N_NB", "HT_N_SB", "uturn", { weight: 1.0 });
    this.addTurn("END_VH_E", "VH_EB", "VH_WB", "uturn", { weight: 1.0 });

    // =========================================================================
    // 5. PRECOMPUTE CONFLICT MATRICES & CROSSWALK OVERLAPS (A/B STREET STYLE)
    // =========================================================================
    for (const inter of this.intersections.values()) {
      const arcs = inter.turnIds.map((id) => this.turns.get(id)!);
      for (let i = 0; i < arcs.length; i++) {
        for (let j = i + 1; j < arcs.length; j++) {
          if (turnsConflict(arcs[i], arcs[j])) {
            arcs[i].conflicts.add(arcs[j].id);
            arcs[j].conflicts.add(arcs[i].id);
          }
        }
        for (const cwId of inter.crosswalkIds) {
          const cw = this.crosswalks.get(cwId)!;
          if (turnCrossesCrosswalk(arcs[i], cw)) {
            arcs[i].crosswalks.push(cwId);
          }
        }
      }
    }
  }
}

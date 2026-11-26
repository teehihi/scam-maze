import { sampleEdge, sampleTurn, type SaigonRoadGraph } from "./roadGraph";
import type { RoadEdge, SignalAxis, TurnArc, VehicleAgent } from "./types";

/**
 * Bus 06's circuit: a closed loop around the whole map, derived from the road graph (never from hard-coded
 * coordinates). Lý Thái Tổ northbound (Trạm Lý Thái Tổ, then Trạm Chợ Lớn), on to the riverside road and the
 * Vinhomes boulevard (turnaround at its east end), back down the riverside road, east along Điện Biên Phủ, south on
 * Hải Triều, west along Đường 3/2 and south on Lý Thái Tổ to the turnaround that leads back to the first stop.
 */
export const BUS06_ROUTE_EDGES = [
  "LTT_S_NB",
  "LTT_M1_NB",
  "LTT_M2_NB",
  "LTT_N_NB",
  "VH_EB",
  "VH_WB",
  "LTT_N_SB",
  "DBP_W_EB",
  "HT_S_SB",
  "D32_W_WB",
  "LTT_S_SB",
] as const;

/** Lateral offset (m, + = right curb) of the bus in the kerb lane: the offset of the stop's kerb position. */
export const BUS06_CURB_LAT = 0.9;

export interface CircuitSegment {
  index: number;
  kind: "edge" | "turn";
  id: string;
  /** Distance along the circuit where this segment starts (m). */
  start: number;
  length: number;
  edge?: RoadEdge;
  turn?: TurnArc;
}

export interface CircuitPose {
  x: number;
  z: number;
  /** Traffic yaw convention (atan2(tx, tz)): the bus' heading along -Z is PI. */
  yaw: number;
  segment: CircuitSegment;
  /** Arc length along the segment (m). */
  s: number;
}

export interface CircuitFix {
  /** Distance along the circuit (m, 0..length). */
  d: number;
  /** Lateral offset from the carriageway centreline (+ = right). */
  lat: number;
  segment: CircuitSegment;
  s: number;
  /** Distance from the queried point to the circuit (m). */
  dist: number;
}

export interface CircuitStopLine {
  /** Distance along the circuit of the stop line (the end of the edge before the junction). */
  d: number;
  intersectionId: string;
  axis: SignalAxis;
  signalized: boolean;
  turnId: string;
}

export interface CircuitBusStop {
  edgeId: string;
  d: number;
}

export class BusCircuit {
  readonly segments: CircuitSegment[] = [];
  readonly length: number;
  readonly stopLines: CircuitStopLine[] = [];
  readonly busStops: CircuitBusStop[] = [];
  private readonly byId = new Map<string, CircuitSegment>();

  constructor(graph: SaigonRoadGraph, edgeIds: readonly string[] = BUS06_ROUTE_EDGES) {
    let at = 0;
    for (let i = 0; i < edgeIds.length; i++) {
      const edge = graph.edges.get(edgeIds[i]);
      if (!edge) throw new Error(`Bus circuit: unknown edge ${edgeIds[i]}`);
      const edgeSeg: CircuitSegment = { index: this.segments.length, kind: "edge", id: edge.id, start: at, length: edge.length, edge };
      this.segments.push(edgeSeg);
      at += edge.length;
      if (edge.busStopS !== undefined) this.busStops.push({ edgeId: edge.id, d: edgeSeg.start + edge.busStopS });

      const nextId = edgeIds[(i + 1) % edgeIds.length];
      const turn = graph.turns.get(`${edge.id}__${nextId}`);
      if (!turn) throw new Error(`Bus circuit: no turn ${edge.id} -> ${nextId}`);
      const inter = graph.intersections.get(turn.intersectionId);
      this.stopLines.push({
        d: at,
        intersectionId: turn.intersectionId,
        axis: turn.axis,
        signalized: !!inter?.signalized,
        turnId: turn.id,
      });
      this.segments.push({ index: this.segments.length, kind: "turn", id: turn.id, start: at, length: turn.length, turn });
      at += turn.length;
    }
    this.length = at;
    for (const seg of this.segments) this.byId.set(seg.id, seg);
  }

  /** Wraps a distance into [0, length). */
  wrap(d: number): number {
    const m = d % this.length;
    return m < 0 ? m + this.length : m;
  }

  /** Signed shortest distance from `from` to `to` along the loop (positive = `to` is ahead). */
  delta(from: number, to: number): number {
    const half = this.length / 2;
    return this.wrap(to - from + half) - half;
  }

  /** Circuit distance of the bus stop on `edgeId`, or undefined when the circuit has none there. */
  stopD(edgeId: string): number | undefined {
    return this.busStops.find((s) => s.edgeId === edgeId)?.d;
  }

  segmentAt(d: number): CircuitSegment {
    const w = this.wrap(d);
    for (let i = this.segments.length - 1; i >= 0; i--) if (this.segments[i].start <= w) return this.segments[i];
    return this.segments[0];
  }

  /** World pose at circuit distance `d` and lateral offset `lat` (offset fades out on junction arcs, as for cars). */
  poseAt(d: number, lat = BUS06_CURB_LAT): CircuitPose {
    const seg = this.segmentAt(d);
    const s = this.wrap(d) - seg.start;
    const sample = seg.edge ? sampleEdge(seg.edge, s, lat) : sampleTurn(seg.turn!, s, lat);
    return { x: sample.x, z: sample.z, yaw: sample.yaw, segment: seg, s };
  }

  /** Circuit position of a traffic agent that drives on the circuit (null for vehicles elsewhere). */
  agentFix(v: VehicleAgent): { d: number; lat: number } | null {
    const seg = this.byId.get(v.onTurn && v.turnId ? v.turnId : v.edgeId);
    if (!seg) return null;
    return { d: seg.start + v.s, lat: v.latOffset };
  }

  /**
   * Nearest point of the circuit to a world position. With `yaw` only segments heading the same way count, with
   * `hintD` the search starts near that distance (and falls back to the whole loop when nothing is close).
   */
  project(x: number, z: number, yaw?: number, hintD?: number): CircuitFix {
    const search = (windowed: boolean): CircuitFix | null => {
      let best: CircuitFix | null = null;
      let bestScore = Infinity;
      for (const seg of this.segments) {
        if (windowed && hintD !== undefined) {
          const mid = seg.start + seg.length / 2;
          if (Math.abs(this.delta(hintD, mid)) > seg.length / 2 + 40) continue;
        }
        const hit = seg.edge ? this.projectEdge(seg, x, z) : this.projectTurn(seg, x, z);
        let score = hit.dist;
        if (yaw !== undefined) {
          const heading = seg.edge ? seg.edge.yaw : sampleTurn(seg.turn!, hit.s).yaw;
          const dot = Math.sin(yaw) * Math.sin(heading) + Math.cos(yaw) * Math.cos(heading);
          if (dot < 0.3) score += 50;
        }
        if (score < bestScore) {
          bestScore = score;
          best = { d: seg.start + hit.s, lat: hit.lat, segment: seg, s: hit.s, dist: hit.dist };
        }
      }
      return best;
    };
    const near = hintD !== undefined ? search(true) : null;
    if (near && near.dist < 4) return near;
    return search(false)!;
  }

  private projectEdge(seg: CircuitSegment, x: number, z: number) {
    const e = seg.edge!;
    const px = x - e.start.x;
    const pz = z - e.start.z;
    const t = px * e.tx + pz * e.tz;
    const s = Math.max(0, Math.min(e.length, t));
    const lat = px * e.rx + pz * e.rz;
    return { s, lat, dist: Math.hypot(t - s, lat) };
  }

  private projectTurn(seg: CircuitSegment, x: number, z: number) {
    const turn = seg.turn!;
    let best = { s: 0, lat: 0, dist: Infinity };
    for (let i = 0; i < turn.lut.length; i++) {
      const p = turn.lut[i];
      const dx = x - p.x;
      const dz = z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < best.dist) best = { s: turn.lutS[i], lat: dx * p.rx + dz * p.rz, dist };
    }
    return best;
  }
}

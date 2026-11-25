/**
 * Pure placement maths for traffic signals. No Three.js imports so it can be unit tested and
 * checked against the road graph.
 *
 * World axes: +X east, +Z south (so "northbound" travels toward -Z). Vietnam drives on the right,
 * so for a heading (dx, dz) the driver's right-hand side is (-dz, dx):
 *   northbound (0,-1) -> +X, southbound (0,1) -> -X, eastbound (1,0) -> +Z, westbound (-1,0) -> -Z.
 */
import type { RoadEdge, SignalAxis } from "../traffic/types";
import type { SaigonRoadGraph } from "../traffic/roadGraph";

export interface Heading { dx: number; dz: number }

export const NORTHBOUND: Heading = { dx: 0, dz: -1 };
export const SOUTHBOUND: Heading = { dx: 0, dz: 1 };
export const EASTBOUND: Heading = { dx: 1, dz: 0 };
export const WESTBOUND: Heading = { dx: -1, dz: 0 };

/** Unit vector pointing to the driver's right for a given heading. */
export function rightOf(h: Heading): { x: number; z: number } {
  return { x: -h.dz || 0, z: h.dx || 0 };
}

/**
 * Yaw for a signal built in local space (arm along +X, heads facing -Z) so that the arm reaches
 * over the road (to the driver's left of the pole) and the heads face the approaching driver.
 */
export function signalYaw(h: Heading): number {
  return Math.atan2(h.dx, h.dz);
}

/** Gap between the kerb line and the pole axis, on the pavement (m). */
export const SIDEWALK_INSET = 0.8;
/** Distance from the carriageway edge to the kerb (RoadEdge.width/2 + KERB_MARGIN is the kerb offset). */
export const KERB_MARGIN = 0.3;
/** The pole stands this far before the stop line, so the lower head is seen just ahead of the driver. */
export const POLE_BEHIND_STOP = 1.0;
/** Arm overhang past the outermost lane centre (m). */
const ARM_OVERHANG = 0.5;

export interface SignalApproach {
  /** `${intersectionId}:${edgeId}`, unique and stable. */
  id: string;
  /** Owning intersection id in the road graph. */
  intersectionId: string;
  /** Road graph edge that arrives at the intersection on this approach. */
  edgeId: string;
  axis: SignalAxis;
  /** Unit tangent at the end of the edge (direction of travel at the stop line). */
  heading: Heading;
  /** RoadEdge.end, the stop line the simulation uses. */
  stopLine: { x: number; z: number };
  /** Distance from the edge centreline to the kerb on the driver's right. */
  kerbDistance: number;
  /** Distance from the edge centreline to the pole, to the driver's right. */
  poleLateral: number;
  /** Distance from the stop line back along the approach to the pole. */
  poleBehindStop: number;
  /** Length of the mast arm over the road. */
  armLength: number;
  /** Distance of each car lane centre from the pole along the arm. */
  laneCentres: number[];
}

/** Unit tangent at the end of an edge. Edges are straight today; a polyline would use its last segment. */
export function edgeEndTangent(edge: Pick<RoadEdge, "tx" | "tz"> & { points?: { x: number; z: number }[] }): Heading {
  const pts = edge.points;
  if (pts && pts.length >= 2) {
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > 1e-6) return { dx: (b.x - a.x) / len, dz: (b.z - a.z) / len };
  }
  return { dx: edge.tx, dz: edge.tz };
}

/** One signal per edge that arrives at a signalized intersection, ordered by intersection id then edge id. */
export function deriveSignalApproaches(graph: SaigonRoadGraph): SignalApproach[] {
  const out: SignalApproach[] = [];
  for (const inter of graph.intersections.values()) {
    if (!inter.signalized) continue;
    for (const edge of graph.edges.values()) {
      if (edge.toNode !== inter.id) continue;
      const kerbDistance = edge.width / 2 + KERB_MARGIN;
      const poleLateral = kerbDistance + SIDEWALK_INSET;
      const offsets = edge.carLaneOffsets.length > 0 ? edge.carLaneOffsets : [0];
      out.push({
        id: `${inter.id}:${edge.id}`,
        intersectionId: inter.id,
        edgeId: edge.id,
        axis: edge.axis,
        heading: edgeEndTangent(edge),
        stopLine: { x: edge.end.x, z: edge.end.z },
        kerbDistance,
        poleLateral,
        poleBehindStop: POLE_BEHIND_STOP,
        armLength: poleLateral - Math.min(...offsets) + ARM_OVERHANG,
        laneCentres: offsets.map((o) => poleLateral - o),
      });
    }
  }
  return out.sort((a, b) =>
    a.intersectionId === b.intersectionId ? (a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0) : a.intersectionId < b.intersectionId ? -1 : 1,
  );
}

/** Pole base: back from the stop line by `poleBehindStop`, out to the driver's right by `poleLateral`. */
export function signalBasePosition(a: Pick<SignalApproach, "heading" | "stopLine" | "poleBehindStop" | "poleLateral">) {
  const r = rightOf(a.heading);
  return {
    x: a.stopLine.x - a.heading.dx * a.poleBehindStop + r.x * a.poleLateral,
    z: a.stopLine.z - a.heading.dz * a.poleBehindStop + r.z * a.poleLateral,
  };
}

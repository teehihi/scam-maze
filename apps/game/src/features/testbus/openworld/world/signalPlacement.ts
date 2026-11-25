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

export interface ApproachValidation { ok: boolean; problems: string[] }

/** Shortest distance from point p to segment a-b. */
export function distanceToSegment(p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2)) : 0;
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

/** Minimum pole to pole spacing and pole clearance from a crosswalk strip (m). */
export const CROSSWALK_CLEARANCE = 0.3;
export const MIN_POLE_BEHIND_STOP = 0.5;

/**
 * Pure geometric check of one approach against the road graph: the pole stands outside the
 * carriageway, behind the stop line, clear of crosswalks, and the arm reaches over every car lane
 * toward the median with the heads facing the oncoming driver.
 */
export function validateApproach(a: SignalApproach, graph: SaigonRoadGraph): ApproachValidation {
  const problems: string[] = [];
  const edge = graph.edges.get(a.edgeId);
  if (!edge) return { ok: false, problems: [`unknown edge ${a.edgeId}`] };
  const inter = graph.intersections.get(a.intersectionId);
  if (!inter || edge.toNode !== a.intersectionId) problems.push("edge does not arrive at the intersection");

  const pole = signalBasePosition(a);
  const r = rightOf(a.heading);
  const lateral = (pole.x - a.stopLine.x) * r.x + (pole.z - a.stopLine.z) * r.z;
  if (!(lateral > a.kerbDistance)) problems.push(`pole lateral ${lateral.toFixed(2)} not beyond kerb ${a.kerbDistance.toFixed(2)}`);
  for (const other of graph.edges.values()) {
    if (other.fromNode !== edge.toNode || other.toNode !== edge.fromNode) continue;
    const d = distanceToSegment(pole, other.start, other.end);
    if (!(d > other.width / 2)) problems.push(`pole ${d.toFixed(2)} m from opposite carriageway ${other.id}, inside its ${other.width / 2} m half width`);
  }

  const along = (a.stopLine.x - pole.x) * a.heading.dx + (a.stopLine.z - pole.z) * a.heading.dz;
  if (!(along >= MIN_POLE_BEHIND_STOP)) problems.push(`pole only ${along.toFixed(2)} m behind the stop line`);
  for (const id of inter?.crosswalkIds ?? []) {
    const cw = graph.crosswalks.get(id);
    if (cw && !(distanceToSegment(pole, cw.a, cw.b) > cw.halfWidth + CROSSWALK_CLEARANCE)) problems.push(`pole inside crosswalk ${id}`);
  }

  const yaw = signalYaw(a.heading);
  const arm = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const face = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  if (arm.x * r.x + arm.z * r.z >= -0.999) problems.push("arm does not point toward the median");
  if (face.x * a.heading.dx + face.z * a.heading.dz > -0.999) problems.push("heads do not face the oncoming driver");
  const farLane = Math.min(...(edge.carLaneOffsets.length ? edge.carLaneOffsets : [0]));
  if (!(a.armLength > lateral - farLane)) problems.push("arm ends before the far lane centre");
  return { ok: problems.length === 0, problems };
}

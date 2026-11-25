/**
 * Pure placement maths for traffic signals. No Three.js imports so it can be unit tested and
 * checked against the road graph.
 *
 * World axes: +X east, +Z south (so "northbound" travels toward -Z). Vietnam drives on the right,
 * so for a heading (dx, dz) the driver's right-hand side is (-dz, dx):
 *   northbound (0,-1) -> +X, southbound (0,1) -> -X, eastbound (1,0) -> +Z, westbound (-1,0) -> -Z.
 */
import type { SignalAxis } from "../traffic/types";

export interface Heading { dx: number; dz: number }

export const NORTHBOUND: Heading = { dx: 0, dz: -1 };
export const SOUTHBOUND: Heading = { dx: 0, dz: 1 };
export const EASTBOUND: Heading = { dx: 1, dz: 0 };
export const WESTBOUND: Heading = { dx: -1, dz: 0 };

/** Unit vector pointing to the driver's right for a given heading. */
export function rightOf(h: Heading): { x: number; z: number } {
  return { x: -h.dz + 0, z: h.dx + 0 };
}

/**
 * Yaw for a signal built in local space (arm along +X, heads facing -Z) so that the arm reaches
 * over the road (to the driver's left of the pole) and the heads face the approaching driver.
 */
export function signalYaw(h: Heading): number {
  return Math.atan2(h.dx, h.dz);
}

export interface SignalApproach {
  /** Owning intersection id in the road graph. */
  intersectionId: string;
  /** Road graph edge that arrives at the intersection on this approach. */
  edgeId: string;
  axis: SignalAxis;
  heading: Heading;
  /** Junction centre (median crossing). */
  center: { x: number; z: number };
  /** Distance from the junction centre back along the approach to the pole. */
  setback: number;
  /** Distance from the road median to the pole, measured to the driver's right. */
  lateral: number;
  /** Which world chunk builds this signal. */
  owner: "ltt" | "east";
}

/** Pole base position: back along the approach by `setback`, out to the right by `lateral`. */
export function signalBasePosition(a: Pick<SignalApproach, "heading" | "center" | "setback" | "lateral">) {
  const r = rightOf(a.heading);
  return {
    x: a.center.x - a.heading.dx * a.setback + r.x * a.lateral,
    z: a.center.z - a.heading.dz * a.setback + r.z * a.lateral,
  };
}

const LTT_X = -6.4;
const LTT_LATERAL = 6.8; // x = 0.4 (east curb side) / -13.2 (west curb side)
const BLVD_LATERAL = 7.0; // 1 m behind the 6 m half-width kerb, on the sidewalk
const approach = (
  intersectionId: string,
  edgeId: string,
  axis: SignalAxis,
  heading: Heading,
  center: { x: number; z: number },
  setback: number,
  lateral: number,
  owner: "ltt" | "east",
): SignalApproach => ({ intersectionId, edgeId, axis, heading, center, setback, lateral, owner });

const C_LTT_32 = { x: LTT_X, z: -76 };
const C_LTT_DBP = { x: LTT_X, z: -147 };
const C_LTT_PED = { x: LTT_X, z: -96 };
const C_HT_32 = { x: 56, z: -76 };
const C_HT_DBP = { x: 56, z: -147 };

/**
 * One signal per existing approach. T-junctions (J_LTT_32, J_LTT_DBP, J_HT_32) have no leg on one
 * side, so they get three. J_LTT_PED is a midblock pedestrian crossing with one per direction.
 */
export const SIGNAL_APPROACHES: readonly SignalApproach[] = [
  approach("J_LTT_32", "LTT_S_NB", "ns", NORTHBOUND, C_LTT_32, 8, LTT_LATERAL, "ltt"),
  approach("J_LTT_32", "LTT_M1_SB", "ns", SOUTHBOUND, C_LTT_32, 8, LTT_LATERAL, "ltt"),
  approach("J_LTT_32", "D32_W_WB", "ew", WESTBOUND, C_LTT_32, 14.4, BLVD_LATERAL, "east"),

  approach("J_LTT_PED", "LTT_M1_NB", "ns", NORTHBOUND, C_LTT_PED, 3.6, LTT_LATERAL, "ltt"),
  approach("J_LTT_PED", "LTT_M2_SB", "ns", SOUTHBOUND, C_LTT_PED, 3.6, LTT_LATERAL, "ltt"),

  approach("J_LTT_DBP", "LTT_M2_NB", "ns", NORTHBOUND, C_LTT_DBP, 8, LTT_LATERAL, "ltt"),
  approach("J_LTT_DBP", "LTT_N_SB", "ns", SOUTHBOUND, C_LTT_DBP, 8, LTT_LATERAL, "ltt"),
  approach("J_LTT_DBP", "DBP_W_WB", "ew", WESTBOUND, C_LTT_DBP, 14.4, BLVD_LATERAL, "east"),

  approach("J_HT_32", "D32_W_EB", "ew", EASTBOUND, C_HT_32, 10.8, BLVD_LATERAL, "east"),
  approach("J_HT_32", "D32_E_WB", "ew", WESTBOUND, C_HT_32, 10.8, BLVD_LATERAL, "east"),
  approach("J_HT_32", "HT_S_SB", "ns", SOUTHBOUND, C_HT_32, 11.2, BLVD_LATERAL, "east"),

  approach("J_HT_DBP", "HT_S_NB", "ns", NORTHBOUND, C_HT_DBP, 10.8, BLVD_LATERAL, "east"),
  approach("J_HT_DBP", "HT_N_SB", "ns", SOUTHBOUND, C_HT_DBP, 11.8, BLVD_LATERAL, "east"),
  approach("J_HT_DBP", "DBP_W_EB", "ew", EASTBOUND, C_HT_DBP, 10.8, BLVD_LATERAL, "east"),
  approach("J_HT_DBP", "DBP_E_WB", "ew", WESTBOUND, C_HT_DBP, 10.8, BLVD_LATERAL, "east"),
];

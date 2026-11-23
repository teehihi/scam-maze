import type { SaigonRoadGraph } from "./roadGraph";
import type { TrafficSignalController } from "./signalController";
import type { PedestrianObstacle, TurnArc, VehicleAgent } from "./types";

interface ActiveReservation {
  vehicleId: string;
  turnId: string;
  enteredAt: number;
}

export interface EntryDecision {
  allowed: boolean;
  /** True when vehicle is committed through amber dilemma zone or already reserved */
  committed: boolean;
  /** Speed cap while creeping (e.g. motorbike RTOR or yielding left turn) */
  speedCap: number;
  reason: "ok" | "red" | "amber_stop" | "conflict" | "box_full" | "pedestrian" | "rtor_creep";
}

/**
 * Deadlock-free Intersection Conflict & Turn Reservation Manager.
 * Architecture adapted from A/B Street (`sim/src/mechanics/intersection.rs`) + QCVN 41:2024 rules:
 *  - Conflict matrix enforcement (`accepted` active turns inside each junction box)
 *  - Physical Dilemma Zone decision on Amber (stopping distance vs road grip μ)
 *  - Don't-Block-The-Box check on destination edge
 *  - Saigon Motorbike Right-Turn-on-Red (RTOR) with mandatory yield
 *  - Automatic Deadlock Breaker so the network never stalls indefinitely
 */
export class IntersectionManager {
  private readonly active = new Map<string, Map<string, ActiveReservation>>();
  private readonly graph: SaigonRoadGraph;
  private readonly signals: TrafficSignalController;

  constructor(graph: SaigonRoadGraph, signals: TrafficSignalController) {
    this.graph = graph;
    this.signals = signals;
    for (const id of graph.intersections.keys()) {
      this.active.set(id, new Map());
    }
  }

  /** Register that a vehicle has physically entered a turn arc inside an intersection. */
  enterTurn(vehicleId: string, turn: TurnArc, simTime: number) {
    const box = this.active.get(turn.intersectionId);
    if (!box) return;
    box.set(vehicleId, { vehicleId, turnId: turn.id, enteredAt: simTime });
  }

  /** Release reservation as soon as the vehicle exits the turn onto the next edge. */
  exitTurn(vehicleId: string, intersectionId: string) {
    this.active.get(intersectionId)?.delete(vehicleId);
  }

  /** Remove any stale reservations (e.g. vehicle reset or timeout > 18s). */
  pruneStale(simTime: number, liveIds: Set<string>) {
    for (const box of this.active.values()) {
      for (const [vid, res] of box) {
        if (!liveIds.has(vid) || simTime - res.enteredAt > 18) {
          box.delete(vid);
        }
      }
    }
  }

  /**
   * Evaluate whether `v` approaching `turn` (at `distToStop` meters from the stop line)
   * should proceed or brake to stop before the stop line.
   */
  evaluateEntry(
    v: VehicleAgent,
    turn: TurnArc,
    distToStop: number,
    muRoad: number,
    allVehicles: readonly VehicleAgent[],
    pedestrians: readonly PedestrianObstacle[],
  ): EntryDecision {
    const inter = this.graph.intersections.get(turn.intersectionId);
    if (!inter || !inter.signalized) {
      // Unsignalized junction / curve: still check conflicts for safety
      const hasConflict = this.hasActiveConflict(v.id, turn);
      if (hasConflict && v.waitTime < 4.0) {
        return { allowed: false, committed: false, speedCap: 0, reason: "conflict" };
      }
      return { allowed: true, committed: false, speedCap: turn.maxSpeed, reason: "ok" };
    }

    const axisState = this.signals.getAxisState(turn.intersectionId, turn.axis);
    const p = v.personality;

    // 1. Already committed through this junction's dilemma zone -> finish clearing!
    if (v.committedJunctionId === turn.intersectionId && distToStop < 12) {
      return { allowed: true, committed: true, speedCap: turn.maxSpeed, reason: "ok" };
    }

    // 2. Check traffic signal phase + physical Dilemma Zone
    let isRtor = false;
    if (axisState.lamp === "red") {
      // Saigon rule: motorbikes may creep right-turn-on-red if signed & clear!
      const canRtor =
        turn.motoRtor &&
        v.category === "moto" &&
        distToStop < 6.5 &&
        !this.hasActiveConflict(v.id, turn) &&
        !this.hasPedestrianOnCrosswalk(turn, pedestrians);

      // Impatient Saigon creep: slight roll forward ONLY when countdown <= 1.2s and gap clear
      if (!canRtor) {
        return { allowed: false, committed: false, speedCap: 0, reason: "red" };
      }
      isRtor = true;
    } else if (axisState.lamp === "amber") {
      // Physical stopping distance: d_stop = v * t_react + v^2 / (2 * b_comfort * mu)
      const effBrake = Math.max(1.8, p.comfortBrake * muRoad);
      const dStop = v.speed * p.reactionTime + (v.speed * v.speed) / (2 * effBrake);
      // If vehicle is too close to stop safely AND can clear before all-red ends -> commit!
      if (distToStop < dStop && v.speed > 2.2) {
        return { allowed: true, committed: true, speedCap: turn.maxSpeed, reason: "ok" };
      }
      return { allowed: false, committed: false, speedCap: 0, reason: "amber_stop" };
    }

    // 3. Pedestrian crosswalk protection (vehicles turning or starting MUST yield to walkers in zebra!)
    if (distToStop < 9.0 && this.hasPedestrianOnCrosswalk(turn, pedestrians)) {
      return { allowed: false, committed: false, speedCap: 0, reason: "pedestrian" };
    }

    // 4. Active junction conflict matrix check (prevents cross-clipping with late-clearing cross traffic)
    if (distToStop < 7.0 && this.hasActiveConflict(v.id, turn)) {
      // Deadlock breaker after 6.5s wait
      if (v.waitTime < 6.5) {
        return { allowed: false, committed: false, speedCap: 0, reason: "conflict" };
      }
    }

    // 5. Left-turn permissive yield to approaching oncoming straight traffic
    if (turn.kind === "left" && distToStop < 6.0 && v.waitTime < 5.5) {
      if (this.hasApproachingOncomingStraight(v, turn, allVehicles)) {
        return { allowed: false, committed: false, speedCap: 0, reason: "conflict" };
      }
    }

    // 6. Don't-Block-The-Box: verify destination edge entrance has room for this vehicle
    if (distToStop < 5.5 && v.waitTime < 6.0 && !this.hasDestinationRoom(v, turn, allVehicles)) {
      return { allowed: false, committed: false, speedCap: 0, reason: "box_full" };
    }

    if (isRtor) {
      return { allowed: true, committed: false, speedCap: Math.min(3.2, turn.maxSpeed), reason: "rtor_creep" };
    }

    return { allowed: true, committed: false, speedCap: turn.maxSpeed, reason: "ok" };
  }

  private hasActiveConflict(vehicleId: string, turn: TurnArc): boolean {
    const box = this.active.get(turn.intersectionId);
    if (!box) return false;
    for (const res of box.values()) {
      if (res.vehicleId === vehicleId) continue;
      if (turn.conflicts.has(res.turnId)) return true;
    }
    return false;
  }

  private hasPedestrianOnCrosswalk(turn: TurnArc, pedestrians: readonly PedestrianObstacle[]): boolean {
    if (turn.crosswalks.length === 0 || pedestrians.length === 0) return false;
    for (const ped of pedestrians) {
      if (ped.inCrosswalkId && turn.crosswalks.includes(ped.inCrosswalkId)) {
        return true;
      }
    }
    return false;
  }

  private hasApproachingOncomingStraight(
    v: VehicleAgent,
    turn: TurnArc,
    allVehicles: readonly VehicleAgent[],
  ): boolean {
    for (const other of allVehicles) {
      if (other.id === v.id || other.onTurn) continue;
      if (!other.nextTurnId || !turn.conflicts.has(other.nextTurnId)) continue;
      const otherTurn = this.graph.turns.get(other.nextTurnId);
      if (!otherTurn || otherTurn.kind !== "straight") continue;
      const otherEdge = this.graph.edges.get(other.edgeId);
      if (!otherEdge) continue;
      const rem = otherEdge.length - other.s;
      const ttc = rem / Math.max(other.speed, 1.5);
      // Yield if oncoming straight vehicle will enter the junction within 2.6 seconds
      if (rem < 18 && ttc < 2.6 && other.speed > 1.2) {
        return true;
      }
    }
    return false;
  }

  private hasDestinationRoom(
    v: VehicleAgent,
    turn: TurnArc,
    allVehicles: readonly VehicleAgent[],
  ): boolean {
    const needed = v.halfLength * 2 + 1.8;
    for (const other of allVehicles) {
      if (other.id === v.id || other.onTurn) continue;
      if (other.edgeId !== turn.toEdgeId) continue;
      // Only consider vehicles stopped/slow near the entrance of the target edge in the same lateral band
      if (other.s - other.halfLength < needed && other.speed < 1.2) {
        const latDiff = Math.abs(other.latOffset - v.latOffset);
        if (latDiff < v.halfWidth + other.halfWidth + 0.35) {
          return false;
        }
      }
    }
    return true;
  }

  getActiveCount(intersectionId: string): number {
    return this.active.get(intersectionId)?.size ?? 0;
  }
}

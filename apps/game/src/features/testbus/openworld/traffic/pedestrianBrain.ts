import type { SaigonRoadGraph } from "./roadGraph";
import type { TrafficSignalController } from "./signalController";
import type { CrosswalkSpec, PedestrianObstacle, VehicleAgent } from "./types";

export type PedPhase = "sidewalk" | "wait_curb" | "crossing";

export interface SmartPedestrianAgent {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  speed: number;
  baseSpeed: number;
  radius: number;
  phase: PedPhase;
  /** Patrol waypoints on sidewalk when not crossing */
  homeX: number;
  patrolZMin: number;
  patrolZMax: number;
  patrolDir: 1 | -1;
  /** Crosswalk assignment when crossing a Saigon zebra strip */
  crosswalkId: string | null;
  crossFromA: boolean;
  crossProgress: number; // 0..1
  nextCrossCooldown: number;
  waitTimer: number;
}

/**
 * Saigon Pedestrian Social Force + Crosswalk State Machine.
 *
 * Implements:
 *  - Helbing Social Force repulsion from nearby pedestrians, Player, and vehicles
 *  - Signalized zebra crosswalk waiting (`dont_walk`) & brisk hurry-up during flashing countdown (`flash`)
 *  - Automatic crosswalk obstacle reporting back to `TrafficManager` so vehicles yield cleanly!
 */
export class PedestrianBrain {
  private readonly graph: SaigonRoadGraph;
  private readonly signals: TrafficSignalController;
  readonly agents: SmartPedestrianAgent[] = [];
  private readonly crosswalkList: CrosswalkSpec[] = [];

  constructor(graph: SaigonRoadGraph, signals: TrafficSignalController) {
    this.graph = graph;
    this.signals = signals;
    for (const cw of graph.crosswalks.values()) {
      this.crosswalkList.push(cw);
    }
  }

  registerSidewalkWalker(spec: {
    id: string;
    x: number;
    z: number;
    patrolZMin: number;
    patrolZMax: number;
    baseSpeed: number;
    canCross?: boolean;
    seed?: number;
  }): SmartPedestrianAgent {
    const seed = spec.seed ?? this.agents.length + 1;
    const agent: SmartPedestrianAgent = {
      id: spec.id,
      x: spec.x,
      z: spec.z,
      vx: 0,
      vz: 0,
      yaw: 0,
      speed: 0,
      baseSpeed: spec.baseSpeed,
      radius: 0.34,
      phase: "sidewalk",
      homeX: spec.x,
      patrolZMin: spec.patrolZMin,
      patrolZMax: spec.patrolZMax,
      patrolDir: seed % 2 === 0 ? 1 : -1,
      crosswalkId: null,
      crossFromA: true,
      crossProgress: 0,
      nextCrossCooldown: spec.canCross === false ? 1e9 : 6 + (seed * 7.3) % 18,
      waitTimer: 0,
    };
    this.agents.push(agent);
    return agent;
  }

  update(
    dt: number,
    playerX: number,
    playerZ: number,
    vehicles: readonly VehicleAgent[],
  ): PedestrianObstacle[] {
    const obstacles: PedestrianObstacle[] = [];

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      a.nextCrossCooldown = Math.max(0, a.nextCrossCooldown - dt);

      let goalX = a.homeX;
      let goalZ = a.z + a.patrolDir * 3.0;
      let desiredSpeed = a.baseSpeed;
      let inCrosswalkId: string | null = null;

      // 1. State Machine: Sidewalk Patrol <-> Curb Wait <-> Zebra Crossing
      if (a.phase === "sidewalk") {
        if (a.z >= a.patrolZMax) a.patrolDir = -1;
        else if (a.z <= a.patrolZMin) a.patrolDir = 1;
        goalX = a.homeX;
        goalZ = a.z + a.patrolDir * 3.5;

        // Check if walking near a crosswalk endpoint & ready to cross
        if (a.nextCrossCooldown <= 0) {
          for (const cw of this.crosswalkList) {
            const da = Math.hypot(a.x - cw.a.x, a.z - cw.a.z);
            const db = Math.hypot(a.x - cw.b.x, a.z - cw.b.z);
            if (da < 2.2 || db < 2.2) {
              a.crosswalkId = cw.id;
              a.crossFromA = da <= db;
              a.crossProgress = 0;
              a.phase = "wait_curb";
              a.waitTimer = 0;
              break;
            }
          }
        }
      } else if (a.phase === "wait_curb") {
        const cw = a.crosswalkId ? this.graph.crosswalks.get(a.crosswalkId) : null;
        if (!cw) {
          a.phase = "sidewalk";
        } else {
          const startPt = a.crossFromA ? cw.a : cw.b;
          const endPt = a.crossFromA ? cw.b : cw.a;
          goalX = startPt.x;
          goalZ = startPt.z;
          a.waitTimer += dt;

          // Face across the street while waiting!
          const lookDx = endPt.x - a.x;
          const lookDz = endPt.z - a.z;
          const lookYaw = Math.atan2(lookDx, lookDz);
          a.yaw = lerpAngle(a.yaw, lookYaw, Math.min(1, dt * 6));

          const sig = this.signals.getAxisState(cw.intersectionId, cw.parallelVehicleAxis);
          // Start crossing ONLY on steady Walk (not at the last 1.5s of flashing) AND if no fast car is about to sweep the zebra
          const safeToStep = sig.pedLamp === "walk" && !this.hasFastVehicleInCrosswalk(cw, vehicles);
          if (safeToStep) {
            a.phase = "crossing";
          } else if (a.waitTimer > 22) {
            // Lost patience waiting -> resume sidewalk stroll
            a.phase = "sidewalk";
            a.crosswalkId = null;
            a.nextCrossCooldown = 14;
          } else {
            desiredSpeed = Math.hypot(goalX - a.x, goalZ - a.z) > 0.45 ? a.baseSpeed * 0.6 : 0;
          }
        }
      } else if (a.phase === "crossing") {
        const cw = a.crosswalkId ? this.graph.crosswalks.get(a.crosswalkId) : null;
        if (!cw) {
          a.phase = "sidewalk";
        } else {
          const endPt = a.crossFromA ? cw.b : cw.a;
          goalX = endPt.x;
          goalZ = endPt.z;
          inCrosswalkId = cw.id;

          const sig = this.signals.getAxisState(cw.intersectionId, cw.parallelVehicleAxis);
          // Hurry up during flashing countdown or if light changed while mid-crossing!
          desiredSpeed = sig.pedLamp === "walk" ? a.baseSpeed * 1.15 : a.baseSpeed * 1.55;

          const distToEnd = Math.hypot(endPt.x - a.x, endPt.z - a.z);
          if (distToEnd < 0.75) {
            a.phase = "sidewalk";
            a.homeX = endPt.x + (endPt.x > 0 ? 0.6 : -0.6);
            a.crosswalkId = null;
            a.nextCrossCooldown = 18 + (i * 5) % 16;
            inCrosswalkId = null;
          }
        }
      }

      // 2. Helbing Social Force Model: goal pull + pedestrian/player/vehicle repulsion
      const gdx = goalX - a.x;
      const gdz = goalZ - a.z;
      const gDist = Math.hypot(gdx, gdz);
      let fx = gDist > 0.05 ? (gdx / gDist) * desiredSpeed : 0;
      let fz = gDist > 0.05 ? (gdz / gDist) * desiredSpeed : 0;

      // Ped-to-Ped personal space repulsion
      for (let j = 0; j < this.agents.length; j++) {
        if (i === j) continue;
        const b = this.agents[j];
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 2.25 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = Math.exp((a.radius + b.radius + 0.35 - d) / 0.32) * 1.4;
        fx += (dx / d) * push;
        fz += (dz / d) * push;
      }

      // Player avoidance (give player polite sidewalk space)
      const pdx = a.x - playerX;
      const pdz = a.z - playerZ;
      const pd2 = pdx * pdx + pdz * pdz;
      if (pd2 < 2.6 && pd2 > 1e-5) {
        const pd = Math.sqrt(pd2);
        const push = Math.exp((a.radius + 0.65 - pd) / 0.34) * 1.9;
        fx += (pdx / pd) * push;
        fz += (pdz / pd) * push;
      }

      // Moving vehicle self-preservation repulsion
      for (const v of vehicles) {
        const dx = a.x - v.x;
        const dz = a.z - v.z;
        const r = Math.hypot(v.halfWidth, v.halfLength) + 1.4;
        const d2 = dx * dx + dz * dz;
        if (d2 > r * r || d2 < 1e-5) continue;
        const d = Math.sqrt(d2);
        const push = Math.exp((r - d) / 0.4) * (v.speed > 0.6 ? 3.8 : 1.5);
        fx += (dx / d) * push;
        fz += (dz / d) * push;
      }

      // Smooth velocity integration with relaxation time τ = 0.28s
      const alpha = Math.min(1, dt / 0.28);
      a.vx += (fx - a.vx) * alpha;
      a.vz += (fz - a.vz) * alpha;

      const maxSpd = desiredSpeed * 1.35 + 0.2;
      const curSpd = Math.hypot(a.vx, a.vz);
      if (curSpd > maxSpd) {
        a.vx = (a.vx / curSpd) * maxSpd;
        a.vz = (a.vz / curSpd) * maxSpd;
      }
      a.speed = Math.hypot(a.vx, a.vz);

      if (a.phase !== "wait_curb" || desiredSpeed > 0) {
        a.x += a.vx * dt;
        a.z += a.vz * dt;
      }

      if (a.speed > 0.15) {
        const targetYaw = Math.atan2(a.vx, a.vz);
        a.yaw = lerpAngle(a.yaw, targetYaw, Math.min(1, dt * 8));
      }

      // Report crossing pedestrians (or any ped stepping onto asphalt) to TrafficManager
      if (inCrosswalkId || (a.x > -12.6 && a.x < -0.2 && a.z > -160 && a.z < 40)) {
        obstacles.push({
          id: a.id,
          x: a.x,
          z: a.z,
          vx: a.vx,
          vz: a.vz,
          radius: a.radius,
          inCrosswalkId,
        });
      }
    }

    return obstacles;
  }

  private hasFastVehicleInCrosswalk(cw: CrosswalkSpec, vehicles: readonly VehicleAgent[]): boolean {
    const cx = (cw.a.x + cw.b.x) * 0.5;
    const cz = (cw.a.z + cw.b.z) * 0.5;
    const halfLen = cw.length * 0.55;
    for (const v of vehicles) {
      if (v.speed < 2.2) continue;
      const d = Math.hypot(v.x - cx, v.z - cz);
      if (d < halfLen + 4.5) return true;
    }
    return false;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

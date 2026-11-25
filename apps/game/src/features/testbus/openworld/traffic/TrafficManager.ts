import { pickStunt, stuntSeconds, weaveOffset, wheeliePitch } from "../../../khupho/world/baothuMotion";
import { TrafficCollisionSystem } from "./collisionSystem";
import {
  computeAccIdmPlus,
  computeSaigonMotoSublaneTarget,
  createDriverPersonality,
  evaluateMobilLaneChange,
  mulberry32,
  roadFrictionFactor,
  VN_TRAFFIC_TUNING,
  type LateralNeighbor,
} from "./driverModels";
import { IntersectionManager } from "./intersectionMgr";
import { PedestrianBrain } from "./pedestrianBrain";
import { SaigonRoadGraph, sampleEdge, sampleTurn } from "./roadGraph";
import { TrafficSignalController, type SignalVisualBinding } from "./signalController";
import { SaigonStreetAudio } from "./streetAudio";
import type {
  PedestrianObstacle,
  PlayerCollisionResult,
  RoadEdge,
  TurnArc,
  VehicleAgent,
  VehicleCategory,
  VehicleVisualRig,
} from "./types";
import { updateVehicleDynamicsAndRig } from "./vehicleDynamics";

function busDwellSeconds(r: number): number {
  const { dwellMin, dwellMax } = VN_TRAFFIC_TUNING.bus;
  return dwellMin + r * (dwellMax - dwellMin);
}

export interface SpawnVehicleSpec {
  id: string;
  category: VehicleCategory;
  edgeId: string;
  s: number;
  laneIndex?: 0 | 1;
  latOffset?: number;
  halfWidth: number;
  halfLength: number;
  wheelBase?: number;
  speed?: number;
  /** Optional deterministic preferred routes (or leave undefined for dynamic weighted city turns) */
  preferStraightBias?: number;
  rig?: VehicleVisualRig | null;
  /** The reckless rider ("Báo Thủ", a motorbike): revs instead of honking, wheelies and weaves. */
  reckless?: boolean;
}

export interface TrafficStepInput {
  dt: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerYaw: number;
  wetness: number;
  /** Optional extra pedestrians (e.g. from external roamers) */
  extraPedestrians?: readonly PedestrianObstacle[];
}

export interface TrafficTelemetry {
  vehicleCount: number;
  activeInJunctions: number;
  avgSpeed: number;
  stoppedCount: number;
  simTime: number;
}

function wrapAngleDiff(target: number, current: number): number {
  let d = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Unified Saigon Street Simulation Engine (CARLA 5-Stage Pipeline + 3-Tier Hybrid LOD).
 *
 * Single source of truth for:
 *  - Lý Thái Tổ, Đường 3/2, Điện Biên Phủ, Hải Triều, and Vinhomes Blvd traffic
 *  - QCVN 41:2024 synchronized traffic signals & LED countdown displays
 *  - Route 06 Bus integration (both obstacle & signal-aware agent)
 *  - Exact 2D OBB/SAT Player↔Vehicle and Vehicle↔Vehicle collisions
 *  - Social-Force crosswalk pedestrians & spatial Saigon street audio
 */
export class SaigonTrafficManager {
  readonly graph: SaigonRoadGraph;
  private bus06StopLinesCache: { z: number; interId: string }[] | null = null;
  readonly signals: TrafficSignalController;
  readonly intersections: IntersectionManager;
  readonly collisions: TrafficCollisionSystem;
  readonly pedestrians: PedestrianBrain;
  readonly audio: SaigonStreetAudio;

  readonly vehicles: VehicleAgent[] = [];
  private readonly vehicleById = new Map<string, VehicleAgent>();
  private readonly busAgentId = "BUS_06";
  private simTime = 0;
  private tickCount = 0;
  private rngState = 133791;
  /** Separate seeded stream for overtake and dwell decisions, so behaviour tuning never shifts route picks. */
  private behaviourRng = { s: 0x5eed1234 };

  constructor() {
    this.graph = new SaigonRoadGraph();
    this.signals = new TrafficSignalController(this.graph.intersections.values());
    this.intersections = new IntersectionManager(this.graph, this.signals);
    this.collisions = new TrafficCollisionSystem();
    this.pedestrians = new PedestrianBrain(this.graph, this.signals);
    this.audio = new SaigonStreetAudio();
  }

  private nextRand(): number {
    // Fast deterministic Mulberry32 PRNG (makes tests & traffic reproducible!)
    let t = (this.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private behaviourRand(): number {
    return mulberry32(this.behaviourRng);
  }

  /** True when `o` is a bus standing at (or pulling into / out of) a stop, so it will not move on soon. */
  private isHaltedBus(o: VehicleAgent): boolean {
    if (o.category !== "bus") return false;
    if (o.busStop) return o.busStop.phase !== "cruise" && o.speed < 1.5;
    return !!o.externalControl && o.speed < 1.0;
  }

  /** The nearest halted bus ahead in the lane `v` is driving in, if any. */
  private haltedBusAhead(v: VehicleAgent, sameEdge: readonly VehicleAgent[]): VehicleAgent | null {
    let best: VehicleAgent | null = null;
    let bestDs = 30;
    for (const o of sameEdge) {
      if (o.id === v.id || !this.isHaltedBus(o)) continue;
      const ds = o.s - v.s - (v.halfLength + o.halfLength);
      if (ds < -0.5 || ds >= bestDs) continue;
      if (Math.abs(o.latOffset - v.latOffset) > v.halfWidth + o.halfWidth + 0.4) continue;
      best = o;
      bestDs = ds;
    }
    return best;
  }

  /** True when no vehicle occupies the strip around `lat` from `behind` m behind to `ahead` m ahead of `v`. */
  private laneClear(
    v: VehicleAgent,
    sameEdge: readonly VehicleAgent[],
    lat: number,
    behind: number,
    ahead: number,
    followerTime: number,
  ): boolean {
    for (const o of sameEdge) {
      if (o.id === v.id) continue;
      if (Math.abs(o.latOffset - lat) > v.halfWidth + o.halfWidth + 0.2) continue;
      const ds = o.s - v.s;
      if (ds < 0 && -ds < behind + o.halfLength + o.speed * followerTime) return false;
      if (ds >= 0 && ds < ahead + v.halfLength + o.halfLength) return false;
    }
    return true;
  }

  /**
   * Ambient bus stop routine on edges with `busStopS`: signal right and pull in to the curb, stop, dwell,
   * signal left, then cut out to the middle lane once it is clear. Moves `latOffset` itself while in a stop
   * phase and returns the gap (m) to the point where the bus must stand (Infinity = no stop barrier).
   */
  private updateBusStop(v: VehicleAgent, edge: RoadEdge, sameEdge: readonly VehicleAgent[], dt: number): number {
    const T = VN_TRAFFIC_TUNING.bus;
    const st = (v.busStop ??= { phase: "cruise", timer: 0, servedEdgeId: null, indicator: 0 });
    const stopS = edge.busStopS;
    const lanes = edge.carLaneOffsets;
    const curbLat = Math.min(lanes[lanes.length - 1] + T.curbInset, edge.width / 2 - v.halfWidth - 0.15);
    const laneLat = lanes[T.pullOutLane];
    const moveTo = (target: number, guarded: boolean) => {
      v.targetLatOffset = target;
      const err = target - v.latOffset;
      let step = Math.max(-T.lateralRate * dt, Math.min(T.lateralRate * dt, err));
      if (guarded && Math.abs(err) > 0.05 && !this.laneClear(v, sameEdge, target, v.halfLength + 1, 1, 0)) step = 0;
      v.latOffset += step;
      v.latVel = step / Math.max(dt, 0.001);
    };

    if (st.phase === "cruise") {
      if (stopS !== undefined && st.servedEdgeId !== edge.id && v.s < stopS && stopS - v.s < T.approachDist) {
        st.phase = "pullIn";
        st.indicator = 1;
      }
      st.indicator = st.phase === "cruise" ? 0 : st.indicator;
      return Infinity;
    }
    if (stopS === undefined) {
      st.phase = "cruise";
      st.indicator = 0;
      return Infinity;
    }

    const standGap = Math.max(0, stopS - v.s) + v.personality.minGap * 0.8;
    switch (st.phase) {
      case "pullIn": {
        st.indicator = 1;
        moveTo(curbLat, true);
        v.laneIndex = lanes.length > 1 ? 1 : 0;
        if (v.s > stopS + T.overshootGiveUp) {
          st.phase = "cruise";
          st.indicator = 0;
          st.servedEdgeId = edge.id;
          return Infinity;
        }
        if (v.speed < 0.3 && stopS - v.s < 4 && Math.abs(v.latOffset - curbLat) < 0.3) {
          st.phase = "dwell";
          st.indicator = 0;
          st.timer = busDwellSeconds(this.behaviourRand());
        }
        return standGap;
      }
      case "dwell": {
        st.timer -= dt;
        if (st.timer <= 0) {
          st.phase = "signalOut";
          st.indicator = -1;
          st.timer = T.indicatorLead;
        }
        return 0;
      }
      case "signalOut": {
        st.indicator = -1;
        st.timer -= dt;
        if (st.timer <= 0 && this.laneClear(v, sameEdge, laneLat, T.clearBehind, T.clearAhead, 1.5)) {
          st.phase = "pullOut";
          v.laneIndex = T.pullOutLane;
        }
        return 0;
      }
      default: {
        st.indicator = -1;
        moveTo(laneLat, false);
        if (Math.abs(v.latOffset - laneLat) < 0.25) {
          st.phase = "cruise";
          st.indicator = 0;
          st.servedEdgeId = edge.id;
        }
        return Infinity;
      }
    }
  }

  bindSignalVisual(binding: SignalVisualBinding) {
    this.signals.bindVisual(binding);
  }

  /** Register a simulated AI vehicle (motorbike, sedan, SUV, van, or truck) on the Saigon road graph. */
  spawnVehicle(spec: SpawnVehicleSpec): VehicleAgent {
    const edge = this.graph.edges.get(spec.edgeId);
    if (!edge) throw new Error(`Unknown road edge: ${spec.edgeId}`);

    const seed = this.vehicles.length + 1;
    const personality = createDriverPersonality(spec.category, seed);
    const laneIndex: 0 | 1 =
      spec.laneIndex ?? (spec.category === "moto" ? 1 : (seed % 2 === 0 ? 0 : 1));
    const latOffset =
      spec.latOffset ??
      (spec.category === "moto"
        ? edge.motoLatRange[0] +
          (edge.motoLatRange[1] - edge.motoLatRange[0]) * (0.25 + this.nextRand() * 0.65)
        : edge.carLaneOffsets[laneIndex]);

    const s = Math.max(0.5, Math.min(edge.length - 0.5, spec.s));
    const sample = sampleEdge(edge, s, latOffset);

    const agent: VehicleAgent = {
      id: spec.id,
      category: spec.category,
      externalControl: false,
      edgeId: edge.id,
      onTurn: false,
      turnId: null,
      nextTurnId: null,
      s,
      latOffset,
      targetLatOffset: latOffset,
      latVel: 0,
      laneIndex,
      x: sample.x,
      z: sample.z,
      yaw: sample.yaw,
      yawRate: 0,
      speed: spec.speed ?? edge.speedLimit * 0.55 * personality.driverFactor,
      accel: 0,
      halfWidth: spec.halfWidth,
      halfLength: spec.halfLength,
      wheelBase: spec.wheelBase ?? (spec.category === "moto" ? 1.28 : spec.halfLength * 1.18),
      personality,
      pitch: 0,
      pitchVel: 0,
      roll: 0,
      rollVel: 0,
      steerAngle: 0,
      brakeLevel: 0,
      blinker: 0,
      waitTime: 0,
      hornCooldown: 2 + this.nextRand() * 4,
      laneChangeCooldown: 1 + this.nextRand() * 3,
      collisionPause: 0,
      committedJunctionId: null,
      lodTier: 0,
      rig: spec.rig ?? null,
      reckless: spec.category === "moto" && !!spec.reckless,
      stunt: null,
      stuntCooldown: 3 + this.nextRand() * 6,
    };

    agent.nextTurnId = this.pickNextTurn(agent, edge, spec.preferStraightBias);
    this.vehicles.push(agent);
    this.vehicleById.set(agent.id, agent);

    if (agent.rig) {
      agent.rig.root.position.set(agent.x, 0, agent.z);
      agent.rig.root.rotation.y = agent.yaw;
    }
    return agent;
  }

  /** Attach or update a visual Three.js rig after async GLB load completes! */
  attachRig(vehicleId: string, rig: VehicleVisualRig) {
    const v = this.vehicleById.get(vehicleId);
    if (!v) return;
    v.rig = rig;
    rig.root.position.set(v.x, 0, v.z);
    rig.root.rotation.y = v.yaw;
  }

  /**
   * Register Route 06 Bus as a first-class obstacle & signal-aware agent in the unified simulation!
   * Every AI vehicle automatically yields to, queues behind, or filters around Bus 06.
   */
  registerBus06(x: number, z: number, yaw = Math.PI) {
    if (this.vehicleById.has(this.busAgentId)) return;
    const agent: VehicleAgent = {
      id: this.busAgentId,
      category: "bus",
      externalControl: true,
      edgeId: "LTT_S_NB",
      onTurn: false,
      turnId: null,
      nextTurnId: null,
      s: 46 - z,
      latOffset: x - -3.2,
      targetLatOffset: x - -3.2,
      latVel: 0,
      laneIndex: 1,
      x,
      z,
      yaw,
      yawRate: 0,
      speed: 0,
      accel: 0,
      halfWidth: 1.32,
      halfLength: 5.55,
      wheelBase: 5.6,
      personality: createDriverPersonality("bus", 6),
      pitch: 0,
      pitchVel: 0,
      roll: 0,
      rollVel: 0,
      steerAngle: 0,
      brakeLevel: 0,
      blinker: 0,
      waitTime: 0,
      hornCooldown: 0,
      laneChangeCooldown: 0,
      collisionPause: 0,
      committedJunctionId: null,
      lodTier: 0,
      rig: null,
    };
    this.vehicles.push(agent);
    this.vehicleById.set(agent.id, agent);
  }

  /** Sync Bus 06's live world pose & speed every frame from `BusRouteController`. */
  syncBus06(x: number, z: number, yaw: number, speed: number, accel: number, listenerX?: number, listenerZ?: number) {
    const bus = this.vehicleById.get(this.busAgentId);
    if (!bus) return;
    const wasMoving = bus.speed > 1.2;
    bus.x = x;
    bus.z = z;
    bus.yaw = yaw;
    bus.speed = speed;
    bus.accel = accel;
    // Map Bus 06 onto the closest Lý Thái Tổ northbound segment for neighbor awareness
    if (z > -76) {
      bus.edgeId = "LTT_S_NB";
      bus.s = Math.max(0, 46 - z);
    } else if (z > -96) {
      bus.edgeId = "LTT_M1_NB";
      bus.s = Math.max(0, -84.8 - z);
    } else if (z > -147) {
      bus.edgeId = "LTT_M2_NB";
      bus.s = Math.max(0, -100.6 - z);
    } else {
      bus.edgeId = "LTT_N_NB";
      bus.s = Math.max(0, -155.8 - z);
    }
    bus.latOffset = x - -3.2;

    if (wasMoving && speed < 0.25 && listenerX !== undefined && listenerZ !== undefined) {
      this.audio.playBusAirBrake(x, z, listenerX, listenerZ);
    }
  }

  /** Northbound Ly Thai To stop lines (RoadEdge.end.z of the incoming ns edge) for the three signalized junctions. */
  private bus06StopLines(): { z: number; interId: string }[] {
    if (this.bus06StopLinesCache) return this.bus06StopLinesCache;
    const lines: { z: number; interId: string }[] = [];
    for (const interId of ["J_LTT_32", "J_LTT_PED", "J_LTT_DBP"]) {
      for (const e of this.graph.edges.values()) {
        if (e.toNode === interId && e.axis === "ns" && e.tz < 0) lines.push({ z: e.end.z, interId });
      }
    }
    this.bus06StopLinesCache = lines;
    return lines;
  }

  /**
   * Query safe target speed cap for Bus 06 along Lý Thái Tổ (-Z northbound) so Bus 06:
   *  - Obeys QCVN 41:2024 red lights at J_LTT_32 (-76), J_LTT_PED (-96), and J_LTT_DBP (-147)
   *  - Never drives through vehicles or pedestrians ahead of its front bumper!
   */
  computeBus06SafeSpeed(busX: number, busZ: number, desiredSpeed: number): number {
    let cap = desiredSpeed;

    // 1. Check upcoming N-S traffic lights ahead of Bus 06's front bumper (busZ - 5.55)
    const frontZ = busZ - 5.55;
    const stopLines = this.bus06StopLines();
    for (const sl of stopLines) {
      const dist = frontZ - sl.z;
      if (dist > -0.6 && dist < 24) {
        const sig = this.signals.getAxisState(sl.interId, "ns");
        if (sig.lamp === "red" || (sig.lamp === "amber" && dist > 6.0)) {
          const brakeSpeed = dist <= 0.6 ? 0 : Math.sqrt(Math.max(0, 2 * 2.1 * (dist - 0.6)));
          cap = Math.min(cap, brakeSpeed);
        }
      }
    }

    // 2. Check any vehicle directly ahead of Bus 06 in its northbound corridor
    for (const v of this.vehicles) {
      if (v.id === this.busAgentId) continue;
      const dx = Math.abs(v.x - busX);
      if (dx > v.halfWidth + 1.42) continue;
      const distAhead = frontZ - (v.z + v.halfLength);
      if (distAhead > -0.5 && distAhead < 22) {
        const safe = distAhead <= 1.4 ? 0 : Math.min(v.speed + 0.5, Math.sqrt(Math.max(0, 2 * 2.2 * (distAhead - 1.4))));
        cap = Math.min(cap, Math.max(0, safe));
      }
    }

    return Math.max(0, cap);
  }

  /**
   * Main 5-Stage Synchronous CARLA Simulation Step:
   *   Stage 1: Signals & Pedestrian Social Force / Crosswalk Brain
   *   Stage 2: Spatial Hash Rebuild & 3-Tier Distance LOD Assignment
   *   Stage 3: Collision Geodesic Forecast + Intersection Manager + ACC/IDM+/SL2015 Motion Planner
   *   Stage 4: Ballistic Integration + Hard OBB/SAT Guard + Spatial Audio
   *   Stage 5: Vehicle Dynamics (Suspension Pitch/Roll, Moto Lean, Ackermann Wheels, Lights, Gaze)
   */
  step(input: TrafficStepInput) {
    const dt = Math.min(0.05, Math.max(0.001, input.dt));
    this.simTime += dt;
    this.tickCount++;
    const muRoad = roadFrictionFactor(input.wetness);

    // STAGE 1: Update synchronized QCVN 41:2024 traffic signals + LED timers
    this.signals.update(this.simTime);

    // Update Social-Force crosswalk pedestrians & combine with any external pedestrian obstacles
    const brainPeds = this.pedestrians.update(dt, input.playerX, input.playerZ, this.vehicles);
    const allPeds: PedestrianObstacle[] = input.extraPedestrians
      ? [...brainPeds, ...input.extraPedestrians]
      : brainPeds;

    // STAGE 2: Rebuild Spatial Hash Grid & assign 3-tier distance LOD around Player
    this.collisions.rebuild(this.vehicles);
    const liveIds = new Set<string>();
    for (const v of this.vehicles) {
      liveIds.add(v.id);
      const dist = Math.hypot(v.x - input.playerX, v.z - input.playerZ);
      v.lodTier = dist < 48 ? 0 : dist < 135 ? 1 : 2;
    }
    this.intersections.pruneStale(this.simTime, liveIds);

    // Build edge-bucketed neighbor lists for fast O(1) lateral sublane / MOBIL lookup
    const byEdge = new Map<string, VehicleAgent[]>();
    for (const v of this.vehicles) {
      if (v.onTurn) continue;
      let list = byEdge.get(v.edgeId);
      if (!list) {
        list = [];
        byEdge.set(v.edgeId, list);
      }
      list.push(v);
    }

    // STAGE 3 & 4: Evaluate & integrate every autonomous vehicle
    for (const v of this.vehicles) {
      if (v.externalControl) continue;
      // Tier 2 (>135m from player): update at half-rate (double dt) to keep 60fps rock-solid
      if (v.lodTier === 2 && (this.tickCount & 1) === 1) continue;
      const stepDt = v.lodTier === 2 ? dt * 2 : dt;

      this.stepSingleVehicle(v, stepDt, muRoad, byEdge, allPeds, input);
    }

    // Post-step hard SAT safety pass (eliminates any micro-overlap after dense merging)
    this.collisions.rebuild(this.vehicles);
    this.collisions.resolveHardVehicleContacts(this.vehicles);

    // Update continuous Saigon tire-spray & pass-by audio bed
    this.audio.updateFrame(dt, input.wetness, input.playerX, input.playerZ, this.vehicles, input.playerYaw);
  }

  /** Resolve Player capsule against ALL moving traffic & Bus 06 (call inside OpenWorldEngine.resolveCollisions!). */
  resolvePlayerCollision(
    playerX: number,
    playerZ: number,
    playerY: number,
    playerRadius: number,
  ): PlayerCollisionResult {
    return this.collisions.resolvePlayerVsTraffic(playerX, playerZ, playerY, playerRadius);
  }

  private stepSingleVehicle(
    v: VehicleAgent,
    dt: number,
    muRoad: number,
    byEdge: Map<string, VehicleAgent[]>,
    pedestrians: readonly PedestrianObstacle[],
    input: TrafficStepInput,
  ) {
    v.hornCooldown = Math.max(0, v.hornCooldown - dt);
    v.laneChangeCooldown = Math.max(0, v.laneChangeCooldown - dt);
    v.collisionPause = Math.max(0, v.collisionPause - dt);

    const prevSpeed = v.speed;
    let desiredSpeedLimit = 11.0;
    let distToStop = Infinity;
    let stopRequired = false;
    let upcomingTurn: TurnArc | null = null;
    let signalIsRedOrAmber = false;
    let curvature = 0;
    let busStopGap = Infinity;

    if (v.onTurn && v.turnId) {
      const turn = this.graph.turns.get(v.turnId);
      if (turn) {
        desiredSpeedLimit = turn.maxSpeed;
        v.blinker = turn.kind === "left" ? -1 : turn.kind === "right" ? 1 : 0;
        // Ease lateral offset smoothly back to target lane offset over the turn arc
        v.latOffset += (v.targetLatOffset - v.latOffset) * Math.min(1, dt * 1.8);
        v.latVel = 0;
      }
    } else {
      const edge = this.graph.edges.get(v.edgeId);
      if (!edge) return;
      desiredSpeedLimit = edge.speedLimit;

      if (!v.nextTurnId) {
        v.nextTurnId = this.pickNextTurn(v, edge);
      }
      upcomingTurn = v.nextTurnId ? (this.graph.turns.get(v.nextTurnId) ?? null) : null;
      distToStop = Math.max(0, edge.length - v.s - v.halfLength);

      // Turn signal blinkers activate ~24m before corner!
      if (upcomingTurn && distToStop < 24 && (upcomingTurn.kind === "left" || upcomingTurn.kind === "right")) {
        v.blinker = upcomingTurn.kind === "left" ? -1 : 1;
      } else {
        v.blinker = 0;
      }

      // Corner entry speed preview (so cars naturally brake BEFORE entering a 90° turn!)
      if (upcomingTurn && distToStop < 22 && upcomingTurn.kind !== "straight") {
        const cornerApproach = Math.sqrt(
          upcomingTurn.maxSpeed * upcomingTurn.maxSpeed + 2 * v.personality.comfortBrake * muRoad * distToStop,
        );
        desiredSpeedLimit = Math.min(desiredSpeedLimit, cornerApproach);
      }

      // Evaluate signal & intersection conflict decision
      if (upcomingTurn && distToStop < 32) {
        const sig = this.signals.getAxisState(upcomingTurn.intersectionId, upcomingTurn.axis);
        signalIsRedOrAmber = sig.lamp !== "green";

        const decision = this.intersections.evaluateEntry(
          v,
          upcomingTurn,
          distToStop,
          muRoad,
          this.vehicles,
          pedestrians,
        );
        if (decision.committed) {
          v.committedJunctionId = upcomingTurn.intersectionId;
        }
        if (!decision.allowed) {
          stopRequired = true;
        } else {
          desiredSpeedLimit = Math.min(desiredSpeedLimit, decision.speedCap);
        }
      }

      // Ambient bus stop routine (pull in, dwell, indicate, pull out)
      if (v.category === "bus" && !v.externalControl) {
        busStopGap = this.updateBusStop(v, edge, byEdge.get(edge.id) ?? [], dt);
        if (v.busStop && v.busStop.indicator !== 0) v.blinker = v.busStop.indicator;
      }

      // Lateral Behavior: Saigon Motorbike SL2015 Sublane Filtering OR 4-Wheeler MOBIL Lane Change
      if (v.lodTier <= 1) {
        this.updateLateralPlanner(v, edge, byEdge, distToStop, signalIsRedOrAmber, upcomingTurn, muRoad, dt);
      }
    }

    // CARLA Stage 2: Geodesic Hazard Forecast (leader, merging vehicle, Bus 06, Player, pedestrians)
    const hazard = this.collisions.forecastHazards(
      v,
      this.graph,
      input.playerX,
      input.playerY,
      input.playerZ,
      pedestrians,
    );

    // Compute Treiber ACC / IDM+ acceleration for free road + hazard
    let acc = computeAccIdmPlus(
      hazard.gap,
      v.speed,
      hazard.hazardSpeed,
      hazard.hazardAccel,
      desiredSpeedLimit,
      v.personality,
      muRoad,
      this.simTime,
    );

    // Combine with virtual stop-line barrier when signal / intersection requires stopping!
    if (stopRequired) {
      // Impatient Saigon motorbike red-light creep when countdown <= 1.2s
      const stopLinePad = v.category === "moto" ? 0.35 : 0.75;
      const stopGap = distToStop - stopLinePad;
      const accStop = computeAccIdmPlus(
        stopGap,
        v.speed,
        0,
        0,
        desiredSpeedLimit,
        v.personality,
        muRoad,
        0,
      );
      acc = Math.min(acc, accStop);
    }

    // Bus stop barrier: stand at the stop point, hold while dwelling or waiting to pull out
    if (busStopGap < Infinity) {
      acc = Math.min(
        acc,
        computeAccIdmPlus(busStopGap, v.speed, 0, 0, desiredSpeedLimit, v.personality, muRoad, 0),
      );
    }

    // Motorbikes keep creeping into free space instead of idling (never at a red light, never into a hazard)
    if (
      v.category === "moto" &&
      !stopRequired &&
      !signalIsRedOrAmber &&
      !v.onTurn &&
      v.collisionPause <= 0 &&
      v.speed < VN_TRAFFIC_TUNING.moto.creepSpeed &&
      (hazard.kind === "none" || hazard.kind === "vehicle") &&
      hazard.gap > v.personality.minGap + VN_TRAFFIC_TUNING.moto.creepMinGap
    ) {
      acc = Math.max(acc, VN_TRAFFIC_TUNING.moto.creepAccel);
    }

    // Respect brief collision-recovery brake hold
    if (v.collisionPause > 0) {
      acc = Math.min(acc, -v.personality.maxBrake * muRoad * 0.75);
    }

    // Track waiting time & trigger authentic Saigon horn if player steps directly in front!
    if (v.speed < 0.35) {
      v.waitTime += dt;
    } else {
      v.waitTime = Math.max(0, v.waitTime - dt * 2.5);
    }

    // Held up by something on the road (the player, a stopped vehicle ahead; not a red light): ordinary drivers
    // honk, the reckless rider revs his engine at it instead.
    const heldUp = !stopRequired && !signalIsRedOrAmber && hazard.gap < 7 && v.speed < 1.2 && v.waitTime > 1.6;
    if ((hazard.blockedByPlayer || heldUp) && v.hornCooldown <= 0 && v.lodTier === 0) {
      v.hornCooldown = (hazard.blockedByPlayer ? 3.2 : 6) + this.nextRand() * 3;
      if (v.reckless) {
        this.audio.playMotoRev(v.x, v.z, input.playerX, input.playerZ, input.playerYaw, true);
      } else {
        this.audio.playHorn(v.x, v.z, input.playerX, input.playerZ, input.playerYaw, v.category, hazard.blockedByPlayer);
      }
    }

    // Subtle Saigon motorbike green-light launch rev when starting from standstill!
    // Only the reckless rider revs (netpo.mp3); ordinary bikes pull away quietly.
    if (v.reckless && prevSpeed < 0.25 && acc > 1.6 && v.lodTier === 0 && this.nextRand() < 0.35) {
      this.audio.playMotoRev(v.x, v.z, input.playerX, input.playerZ, input.playerYaw);
    }

    // Ballistic Integration (exact kinematics: v_new = max(0, v + a*dt), ds = v*dt + 0.5*a*dt^2)
    v.accel = acc;
    let nextSpeed = v.speed + acc * dt;
    let stepDist: number;
    if (nextSpeed <= 0) {
      stepDist = acc < -0.01 ? Math.max(0, -(v.speed * v.speed) / (2 * acc)) : 0;
      nextSpeed = 0;
    } else {
      stepDist = Math.max(0, v.speed * dt + 0.5 * acc * dt * dt);
    }
    v.speed = nextSpeed;

    // Advance arc-length s across edge -> turn -> next edge seamlessly!
    v.s += stepDist;
    const prevYaw = v.yaw;

    if (v.onTurn && v.turnId) {
      const turn = this.graph.turns.get(v.turnId)!;
      if (v.s >= turn.length) {
        const overflow = v.s - turn.length;
        this.intersections.exitTurn(v.id, turn.intersectionId);
        v.onTurn = false;
        v.turnId = null;
        v.committedJunctionId = null;
        v.edgeId = turn.toEdgeId;
        v.s = overflow;
        const newEdge = this.graph.edges.get(v.edgeId)!;
        // Clamp lateral offset cleanly onto the new road edge
        if (v.category === "moto") {
          v.latOffset = Math.max(newEdge.motoLatRange[0], Math.min(newEdge.motoLatRange[1], v.latOffset));
          v.targetLatOffset = v.latOffset;
        } else {
          v.targetLatOffset = newEdge.carLaneOffsets[v.laneIndex];
          v.latOffset = Math.max(-newEdge.width * 0.42, Math.min(newEdge.width * 0.42, v.latOffset));
        }
        v.nextTurnId = this.pickNextTurn(v, newEdge);
      }
    } else {
      const edge = this.graph.edges.get(v.edgeId)!;
      if (v.s >= edge.length) {
        const turnId = v.nextTurnId ?? this.pickNextTurn(v, edge);
        const turn = turnId ? this.graph.turns.get(turnId) : null;
        if (turn) {
          const overflow = v.s - edge.length;
          v.onTurn = true;
          v.turnId = turn.id;
          v.nextTurnId = null;
          v.s = overflow;
          this.intersections.enterTurn(v.id, turn, this.simTime);
          // Target smooth landing lane on destination edge
          const destEdge = this.graph.edges.get(turn.toEdgeId)!;
          if (v.category !== "moto") {
            v.targetLatOffset = destEdge.carLaneOffsets[v.laneIndex];
          }
        } else {
          v.s = edge.length - 0.1;
          v.speed = 0;
        }
      }
    }

    // Sample world (x, z, yaw, curvature) from active edge or Bézier turn LUT
    if (v.onTurn && v.turnId) {
      const turn = this.graph.turns.get(v.turnId)!;
      const frac = Math.min(1, v.s / Math.max(turn.length, 0.1));
      const latBlend = v.latOffset * (1 - frac) + v.targetLatOffset * frac;
      const s = sampleTurn(turn, v.s, latBlend);
      v.x = s.x;
      v.z = s.z;
      v.yaw = s.yaw;
      curvature = s.curvature;
    } else {
      const edge = this.graph.edges.get(v.edgeId)!;
      const s = sampleEdge(edge, v.s, v.latOffset);
      v.x = s.x;
      v.z = s.z;
      // Add subtle realistic heading yaw slip during lateral lane change / motorbike weave!
      const slipYaw = v.speed > 0.6 ? Math.atan2(-v.latVel, Math.max(v.speed, 2.0)) * 0.55 : 0;
      v.yaw = s.yaw + slipYaw;
      curvature = 0;
    }

    const dYaw = wrapAngleDiff(v.yaw, prevYaw);
    v.yawRate = dYaw / Math.max(dt, 0.004);

    // STAGE 5: Update 3D visual rig (suspension pitch/roll, moto lean, Ackermann wheels, brake/blinker lamps, head gaze)
    updateVehicleDynamicsAndRig(v, dt, this.simTime, stepDist, curvature, input.playerX, input.playerZ);
    if (v.reckless) this.updateStunt(v, dt, hazard.gap);
  }
  /**
   * The reckless rider's stunts (same timing as the neighborhood's Báo Thủ, `khupho/world/baothuMotion.ts`):
   * on a clear stretch he lifts the front wheel or swings left and right across the lane. Visual only: the
   * collision and lane model keep the bike on its path.
   */
  private updateStunt(v: VehicleAgent, dt: number, gap: number) {
    if (v.stunt) {
      v.stunt.t += dt;
      // Something closes in ahead: the stunt ends early (the curves below ease back to flat on their own).
      if (v.stunt.t >= stuntSeconds(v.stunt.kind) || (gap < 9 && v.stunt.t < 0.4)) {
        v.stunt = null;
        v.stuntCooldown = 6 + this.nextRand() * 9;
      }
    } else {
      v.stuntCooldown = (v.stuntCooldown ?? 0) - dt;
      if (v.stuntCooldown <= 0 && v.speed > 4 && !v.onTurn && gap > 30 && v.lodTier <= 1) {
        v.stunt = { kind: pickStunt(this.nextRand()), t: 0 };
      }
    }
    const rig = v.rig;
    if (!rig) return;
    const t = v.stunt?.t ?? 0;
    const pitch = v.stunt?.kind === "wheelie" ? wheeliePitch(t) : 0;
    const weave = v.stunt?.kind === "weave" ? weaveOffset(t) : 0;
    // Wheelie: nose up about the rear axle (the chassis' -Z side), so the rear wheel stays on the road.
    const rear = v.halfLength * 0.62;
    rig.chassis.rotation.x -= pitch;
    rig.chassis.position.y = rear * Math.sin(pitch);
    rig.chassis.position.z = -rear * (1 - Math.cos(pitch));
    if (weave !== 0 && v.stunt) {
      // Weave: sideways along the bike's local +X, leaning into the swing.
      const h = 1 / 60;
      const acc = (weaveOffset(t + h) - 2 * weave + weaveOffset(Math.max(0, t - h))) / (h * h);
      rig.root.position.x += Math.cos(v.yaw) * weave;
      rig.root.position.z -= Math.sin(v.yaw) * weave;
      rig.chassis.rotation.z += Math.max(-0.32, Math.min(0.32, -Math.atan(acc / 9.81)));
    }
  }

  private updateLateralPlanner(
    v: VehicleAgent,
    edge: RoadEdge,
    byEdge: Map<string, VehicleAgent[]>,
    distToStop: number,
    signalIsRedOrAmber: boolean,
    upcomingTurn: TurnArc | null,
    muRoad: number,
    dt: number,
  ) {
    const sameEdge = byEdge.get(edge.id) ?? [];
    const tune = VN_TRAFFIC_TUNING;

    // A bus in its stop routine steers itself (updateBusStop)
    if (v.category === "bus" && v.busStop && v.busStop.phase !== "cruise") return;

    if (v.category === "moto") {
      // SUMO SL2015 + Saigon Motorbike Sublane & Red-Light Swarm!
      const neighbors: LateralNeighbor[] = [];
      for (const o of sameEdge) {
        if (o.id === v.id) continue;
        const ds = o.s - v.s;
        if (ds < -10 || ds > 26) continue;
        neighbors.push({
          ds,
          lat: o.latOffset,
          halfLength: o.halfLength,
          halfWidth: o.halfWidth,
          speed: o.speed,
          category: o.category,
        });
      }

      // Blocked by a slow or standing vehicle ahead in the rider's own strip: fill any gap beside it
      const mt = tune.moto;
      const blocked = neighbors.some(
        (n) =>
          n.ds > 0 &&
          n.ds - (v.halfLength + n.halfLength) < mt.blockedLeaderGap &&
          n.speed < mt.blockedLeaderSpeed &&
          Math.abs(n.lat - v.latOffset) < v.halfWidth + n.halfWidth + 0.3,
      );
      const busAhead = this.haltedBusAhead(v, sameEdge);
      const squeeze =
        blocked &&
        (tune.overtakeWillingness.moto >= 1 || this.behaviourRand() < tune.overtakeWillingness.moto);

      if (v.laneChangeCooldown <= 0) {
        v.targetLatOffset = computeSaigonMotoSublaneTarget({
          v,
          edge,
          neighbors,
          distToStop,
          signalIsRedOrAmber,
          upcomingTurnKind: upcomingTurn?.kind ?? null,
          squeeze: squeeze || !!busAhead,
        });
        v.laneChangeCooldown = squeeze || busAhead ? mt.blockedReplan : 0.45;
      }

      const latErr = v.targetLatOffset - v.latOffset;
      // Can filter laterally even at low speed (creep ~0.4 m/s), capped cleanly when fully stationary
      const maxLatSpd = Math.max(
        v.speed > 0.25 ? Math.min(1.65, 0.45 + v.speed * 0.16) : 0,
        blocked || busAhead ? mt.blockedLatSpeed : 0,
      );
      const desiredLatVel = Math.max(-maxLatSpd, Math.min(maxLatSpd, latErr * 2.2));
      v.latVel += (desiredLatVel - v.latVel) * Math.min(1, dt * 6.5);
      v.latOffset = Math.max(
        edge.motoLatRange[0],
        Math.min(edge.motoLatRange[1], v.latOffset + v.latVel * dt),
      );
    } else {
      // 4-Wheeler MOBIL Lane Change (only when safe & clear of intersections!)
      const desiredLane: 0 | 1 =
        upcomingTurn && distToStop < 38
          ? upcomingTurn.kind === "right"
            ? 1
            : upcomingTurn.kind === "left"
              ? 0
              : v.laneIndex
          : v.laneIndex;

      const busAhead = this.haltedBusAhead(v, sameEdge);
      // Standing behind a halted bus or held up mid-block for a while: the driver may nose out from standstill
      const stuck = v.speed <= 1.8 && (!!busAhead || v.waitTime > tune.car.stuckWait);
      if (v.laneChangeCooldown <= 0 && distToStop > 14 && (v.speed > 1.8 || stuck)) {
        const altLane: 0 | 1 = v.laneIndex === 0 ? 1 : 0;
        const curLat = edge.carLaneOffsets[v.laneIndex];
        const altLat = edge.carLaneOffsets[altLane];

        // Check static curb obstructions in candidate lane
        const altBlockedByPark = edge.curbObstructions.some(
          (obs) =>
            obs.s - v.s > -obs.halfLen &&
            obs.s - v.s < 24 &&
            altLat + v.halfWidth + 0.3 > obs.latMin &&
            altLat - v.halfWidth - 0.3 < obs.latMax,
        );

        if (!altBlockedByPark) {
          const findLeadLag = (laneLat: number) => {
            let lead: VehicleAgent | null = null;
            let lag: VehicleAgent | null = null;
            let minLead = Infinity;
            let minLag = Infinity;
            for (const o of sameEdge) {
              if (o.id === v.id) continue;
              if (Math.abs(o.latOffset - laneLat) > v.halfWidth + o.halfWidth + 0.35) continue;
              const ds = o.s - v.s;
              if (ds >= 0 && ds < minLead) {
                minLead = ds;
                lead = o;
              } else if (ds < 0 && -ds < minLag) {
                minLag = -ds;
                lag = o;
              }
            }
            return { lead, lag };
          };

          const curLL = findLeadLag(curLat);
          const altLL = findLeadLag(altLat);

          const gapCur = curLL.lead
            ? curLL.lead.s - v.s - (v.halfLength + curLL.lead.halfLength)
            : Infinity;
          const gapAlt = altLL.lead
            ? altLL.lead.s - v.s - (v.halfLength + altLL.lead.halfLength)
            : Infinity;
          const gapLagAlt = altLL.lag
            ? v.s - altLL.lag.s - (v.halfLength + altLL.lag.halfLength)
            : Infinity;

          // Never merge if side-by-side overlap exists
          if (gapAlt > 1.2 && gapLagAlt > 2.0) {
            const accOwnOld = computeAccIdmPlus(
              gapCur,
              v.speed,
              curLL.lead?.speed ?? v.speed,
              0,
              edge.speedLimit,
              v.personality,
              muRoad,
            );
            const accOwnNew = computeAccIdmPlus(
              gapAlt,
              v.speed,
              altLL.lead?.speed ?? v.speed,
              0,
              edge.speedLimit,
              v.personality,
              muRoad,
            );
            const accLagOld = altLL.lag
              ? computeAccIdmPlus(
                  altLL.lead
                    ? altLL.lead.s - altLL.lag.s - (altLL.lead.halfLength + altLL.lag.halfLength)
                    : Infinity,
                  altLL.lag.speed,
                  altLL.lead?.speed ?? altLL.lag.speed,
                  0,
                  edge.speedLimit,
                  altLL.lag.personality,
                  muRoad,
                )
              : 0;
            const accLagNew = altLL.lag
              ? computeAccIdmPlus(
                  gapLagAlt,
                  altLL.lag.speed,
                  v.speed,
                  0,
                  edge.speedLimit,
                  altLL.lag.personality,
                  muRoad,
                )
              : 0;

            const turnBias = altLane === desiredLane && desiredLane !== v.laneIndex ? 1.15 : 0;
            const bias = turnBias + (busAhead ? tune.busStopOvertakeBias : 0);
            const shouldChange = evaluateMobilLaneChange({
              vRel: Math.min(1, v.speed / Math.max(edge.speedLimit, 1)),
              accOwnOld,
              accOwnNew,
              accLagOld,
              accLagNew,
              politeness: v.personality.politeness,
              bias,
              muRoad,
            });
            // Vietnamese car drivers rarely weave out around a slow leader, unless a bus is standing at a stop
            const blockedAhead =
              turnBias === 0 &&
              !!curLL.lead &&
              gapCur < tune.blockedLeaderGap &&
              curLL.lead.speed < v.speed * 0.8 + 0.5;
            const willing = busAhead
              ? tune.busStopOvertakeWillingness[v.category]
              : tune.overtakeWillingness[v.category];
            if (shouldChange && blockedAhead && this.behaviourRand() >= willing) {
              v.laneChangeCooldown = tune.declineCooldown;
            } else if (shouldChange) {
              v.laneIndex = altLane;
              v.laneChangeCooldown = 3.2;
            }
          }
        }
      }

      v.targetLatOffset = edge.carLaneOffsets[v.laneIndex];
      const latErr = v.targetLatOffset - v.latOffset;
      const maxLatSpd = Math.max(
        v.speed > 0.5 ? Math.min(1.15, v.speed * 0.14) : 0,
        stuck && Math.abs(latErr) > 0.05 ? tune.car.stuckLatSpeed : 0,
      );
      const desiredLatVel = Math.max(-maxLatSpd, Math.min(maxLatSpd, latErr * 1.8));
      v.latVel += (desiredLatVel - v.latVel) * Math.min(1, dt * 5.0);
      v.latOffset += v.latVel * dt;
    }
  }

  private pickNextTurn(v: VehicleAgent, edge: RoadEdge, straightBias?: number): string | null {
    const ids = edge.outgoingTurns;
    if (ids.length === 0) return null;
    if (ids.length === 1) return ids[0];

    let total = 0;
    const weights: number[] = [];
    for (const id of ids) {
      const turn = this.graph.turns.get(id)!;
      let w = turn.weight;
      if (straightBias !== undefined && turn.kind === "straight") {
        w *= straightBias;
      }
      // Vans/heavy vehicles prefer major straight arterials slightly more
      if (v.category === "van" && turn.kind === "straight") w *= 1.3;
      weights.push(w);
      total += w;
    }

    let r = this.nextRand() * total;
    for (let i = 0; i < ids.length; i++) {
      r -= weights[i];
      if (r <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }

  getTelemetry(): TrafficTelemetry {
    let activeInJunctions = 0;
    for (const id of this.graph.intersections.keys()) {
      activeInJunctions += this.intersections.getActiveCount(id);
    }
    let speedSum = 0;
    let stoppedCount = 0;
    let count = 0;
    for (const v of this.vehicles) {
      if (v.externalControl) continue;
      count++;
      speedSum += v.speed;
      if (v.speed < 0.3) stoppedCount++;
    }
    return {
      vehicleCount: count,
      activeInJunctions,
      avgSpeed: count > 0 ? speedSum / count : 0,
      stoppedCount,
      simTime: this.simTime,
    };
  }

  dispose() {
    this.audio.dispose();
  }
}

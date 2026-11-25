import type * as T from "three";

export type VehicleCategory = "moto" | "car" | "van" | "bus";
export type TurnKind = "straight" | "right" | "left" | "uturn";
export type SignalAxis = "ns" | "ew";
export type LampColor = "green" | "amber" | "red";
export type PedLampState = "walk" | "flash" | "dont_walk";

export interface Vec2 {
  x: number;
  z: number;
}

export interface SplineSample {
  x: number;
  z: number;
  /** Unit forward tangent (tx, tz) */
  tx: number;
  tz: number;
  /** Unit right-hand normal (-tz, tx) in XZ plane */
  rx: number;
  rz: number;
  /** Heading yaw = atan2(tx, tz) */
  yaw: number;
  /** Signed curvature (rad/m): positive = turning left, negative = turning right */
  curvature: number;
}

export interface RoadEdge {
  id: string;
  /** Logical street name (for telemetry/HUD) */
  streetName: string;
  fromNode: string;
  toNode: string;
  /** Axis classification for signal phasing */
  axis: SignalAxis;
  /** Start point of this directional carriageway centerline */
  start: Vec2;
  /** End point (at stop line if entering a signalized intersection) */
  end: Vec2;
  /** Arc length in meters */
  length: number;
  /** Unit tangent */
  tx: number;
  tz: number;
  /** Unit right normal (-tz, tx) */
  rx: number;
  rz: number;
  yaw: number;
  /** Total usable carriageway width for this travel direction (m) */
  width: number;
  /**
   * Discrete car lane lateral offsets relative to carriageway centerline
   * (0 = center of directional half; negative = closer to median/left, positive = closer to curb/right).
   */
  carLaneOffsets: number[];
  /** Continuous sublane lateral bounds [minLat, maxLat] usable by motorbikes (m from centerline). */
  motoLatRange: [number, number];
  /** Posted urban speed limit (m/s), e.g. 50 km/h = 13.89 m/s, 40 km/h = 11.11 m/s */
  speedLimit: number;
  /** Whether a bus stop pull-in sits on the right curb of this edge */
  busStopS?: number;
  /** Static curb hazards (e.g. parked vehicles) on this edge: { s, halfLen, latMin, latMax } */
  curbObstructions: { s: number; halfLen: number; latMin: number; latMax: number }[];
  /** Outgoing turn arcs from this edge */
  outgoingTurns: string[];
}

export interface TurnArc {
  id: string;
  intersectionId: string;
  fromEdgeId: string;
  toEdgeId: string;
  kind: TurnKind;
  axis: SignalAxis;
  /** Whether right-turn-on-red is allowed for motorbikes at this turn (Saigon rule) */
  motoRtor: boolean;
  /** Cubic Bezier control points P0, P1, P2, P3 in world XZ */
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
  /** Total arc length (m) */
  length: number;
  /** Pre-sampled arc-length lookup table for O(1) evaluation */
  lut: SplineSample[];
  lutS: number[];
  /** Recommended safe maximum cornering speed (m/s) */
  maxSpeed: number;
  /** Set of other TurnArc IDs in the same intersection whose swept footprints intersect this turn */
  conflicts: Set<string>;
  /** Crosswalk IDs that this turn crosses (yield to pedestrians inside them!) */
  crosswalks: string[];
  /** Selection weight for ambient routing */
  weight: number;
}

export interface CrosswalkSpec {
  id: string;
  intersectionId: string;
  /** Axis of pedestrian walking direction ("ns" crosses an EW road; "ew" crosses an NS road) */
  pedAxis: SignalAxis;
  /** Signal axis whose green light gives pedestrians WALK (parallel vehicle phase) */
  parallelVehicleAxis: SignalAxis;
  /** World endpoints of the crosswalk centerline (curb A to curb B) */
  a: Vec2;
  b: Vec2;
  /** Half-width of zebra strip (m) */
  halfWidth: number;
  length: number;
}

export interface IntersectionSpec {
  id: string;
  name: string;
  center: Vec2;
  signalized: boolean;
  /** Green-wave phase offset in seconds so adjacent junctions cascade naturally */
  phaseOffset: number;
  /** Main (NS) green duration in seconds (QCVN 41:2024 >= 15s) */
  nsGreenSec: number;
  /** Cross (EW) green duration in seconds (0 for midblock pedestrian crossing where EW is ped-only) */
  ewGreenSec: number;
  /** Amber clearance duration in seconds (Vietnam standard: 3.0s) */
  amberSec: number;
  /** All-red safety clearance between conflicting phases (1.8s) */
  allRedSec: number;
  /** Whether this is a midblock pedestrian crossing (NS traffic vs Pedestrians) */
  midblockPedOnly?: boolean;
  turnIds: string[];
  crosswalkIds: string[];
}

export interface AxisSignalState {
  lamp: LampColor;
  /** Remaining seconds in current green or red phase (for LED countdown display) */
  countdown: number;
  /** Remaining seconds until this axis turns red (only meaningful when lamp is green or amber) */
  timeToRed: number;
  /** Remaining seconds until this axis turns green (only meaningful when lamp is red) */
  timeToGreen: number;
  pedLamp: PedLampState;
  pedCountdown: number;
}

export interface IntersectionSignalSnapshot {
  intersectionId: string;
  ns: AxisSignalState;
  ew: AxisSignalState;
  allRed: boolean;
}

export interface DriverPersonality {
  /** Desired speed & acceleration multiplier (Treiber driverfactor: 0.85..1.18) */
  driverFactor: number;
  /** Desired time headway T (s): cars 1.1..1.6s, motos 0.7..1.1s, vans/buses 1.4..1.9s */
  timeHeadway: number;
  /** Minimum standstill bumper-to-bumper gap s0 (m): motos 0.9..1.3m, cars 1.8..2.4m */
  minGap: number;
  /** Max comfortable acceleration a (m/s^2) */
  maxAccel: number;
  /** Comfortable braking deceleration b (m/s^2) */
  comfortBrake: number;
  /** Emergency maximum braking bMax (m/s^2) on dry asphalt */
  maxBrake: number;
  /** MOBIL politeness p (0 = aggressive, 0.45 = polite) */
  politeness: number;
  /** Human perception/reaction time (s) for dilemma zone & sudden hazards (0.45..0.85s) */
  reactionTime: number;
  /** Saigon impatient rider flag: creeps slightly at countdown <= 1.5s, filters more eagerly */
  impatient: boolean;
  /** Deterministic seed for subtle organic acceleration noise */
  noiseSeed: number;
}

export interface VehicleLightingHandle {
  setBrake(intensity: number): void;
  setBlinker(dir: -1 | 0 | 1, blinkOn: boolean): void;
}

export interface VehicleVisualRig {
  /** Outer root placed at (x, 0, z) with rotation.y = yaw */
  root: T.Group;
  /** Inner body child (or root child) tilted for suspension pitch/roll & motorcycle lean */
  chassis: T.Object3D;
  wheels: { node: T.Object3D; sign: number; isFront: boolean; baseYaw: number }[];
  wheelRadius: number;
  crewRoot?: T.Object3D | null;
  crewHead?: T.Object3D | null;
  crewHeadRestQ?: T.Quaternion | null;
  lights?: VehicleLightingHandle | null;
}

export type BusStopPhase = "cruise" | "pullIn" | "dwell" | "signalOut" | "pullOut";

/** Ambient bus stop routine: pull in to the curb, dwell, indicate, cut out to the middle lane. */
export interface BusStopState {
  phase: BusStopPhase;
  /** Seconds left in the current dwell or indicator lead phase */
  timer: number;
  /** Edge whose stop was already served, so the bus does not stop there twice */
  servedEdgeId: string | null;
  /** Indicator state commanded by the stop routine: -1 = left (pulling out), 0 = off, +1 = right (pulling in) */
  indicator: -1 | 0 | 1;
}

export interface VehicleAgent {
  id: string;
  category: VehicleCategory;
  /** Physical half-width & half-length for OBB/SAT collision & headway */
  halfWidth: number;
  halfLength: number;
  wheelBase: number;
  personality: DriverPersonality;

  // Topology state
  /** Either traversing a RoadEdge or an Intersection TurnArc */
  onTurn: boolean;
  edgeId: string;
  turnId: string | null;
  /** Chosen upcoming turn once approaching the end of an edge */
  nextTurnId: string | null;
  /** Arc-length progress along current edge or turn (m) */
  s: number;
  /** Discrete car lane index (for 4-wheelers) */
  laneIndex: 0 | 1;
  /** Continuous lateral offset from directional carriageway centerline (+ = right curb, - = median) */
  latOffset: number;
  /** Target lateral offset computed by MOBIL / SL2015 sublane planner */
  targetLatOffset: number;
  /** Current lateral velocity (m/s) */
  latVel: number;

  // Kinematics & dynamics
  x: number;
  z: number;
  yaw: number;
  yawRate: number;
  speed: number;
  accel: number;
  steerAngle: number;
  /** 2nd-order spring-damper chassis pitch (rad), roll/lean (rad) & angular velocities */
  pitch: number;
  pitchVel: number;
  roll: number;
  rollVel: number;
  /** Post-collision brief recovery / stun timer (s) */
  collisionPause: number;
  /** Turn signal command: -1 = left, 0 = off, +1 = right */
  blinker: -1 | 0 | 1;
  /** Brake light intensity 0..1 */
  brakeLevel: number;
  /** Whether committed through amber/all-red dilemma zone */
  committedJunctionId: string | null;
  /** Seconds waiting blocked at intersection or behind player */
  waitTime: number;
  /** Countdown until next honk/rev when held up by player */
  hornCooldown: number;
  /** Cooldown between lane-change / sublane re-evaluations */
  laneChangeCooldown: number;
  /** Visual & LOD tier (0 = full <45m, 1 = medium 45..135m, 2 = coarse >135m) */
  lodTier: 0 | 1 | 2;
  /** The reckless rider ("Báo Thủ"): revs at whatever holds him up, pulls wheelies and weaves across the lane. */
  reckless?: boolean;
  /** Stunt in progress (reckless riders only), seconds into it, and seconds until the next one. */
  stunt?: { kind: "wheelie" | "weave"; t: number } | null;
  stuntCooldown?: number;
  /** Stop routine state for ambient buses (undefined until the bus first reaches an edge with a stop) */
  busStop?: BusStopState;
  /** True for externally driven hero/bus vehicles (e.g. Bus 06) registered into the shared collision & yield grid */
  externalControl?: boolean;
  /** Visual rig (optional so pure headless Node unit/stress tests can run without Three.js meshes!) */
  rig?: VehicleVisualRig | null;
}

export interface PedestrianObstacle {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  inCrosswalkId: string | null;
}

export interface PlayerCollisionResult {
  x: number;
  z: number;
  hitVehicle: boolean;
  /** Impact impulse (m/s) to apply subtle knockback / camera stagger if bumped by moving vehicle */
  impulseX: number;
  impulseZ: number;
  impactSpeed: number;
}

export interface OBB2D {
  x: number;
  z: number;
  halfWidth: number;
  halfLength: number;
  /** Unit forward (sin yaw, cos yaw) */
  fx: number;
  fz: number;
  /** Unit right (-cos yaw, sin yaw) ->Wait: right of (tx, tz) is (-tz, tx) */
  rx: number;
  rz: number;
}

/**
 * Long Q9, the one-of-a-kind street mechanic of the Saigon open world.
 *
 * Routine (a roadside rescue, in this order): he cruises on his yellow Honda Wave in traffic, sees a rider
 * stranded at the curb with a bike, signals and slows down, pulls over, rides up the curb at walking pace, parks on the
 * kickstand, climbs off, walks over, greets the rider, repairs the bike (crouching at the tyre, then kneeling at the pump),
 * says goodbye, walks back, climbs on, kicks the stand up, rides off the pavement into traffic and heads for the next site.
 *
 * This module is a pure, deterministic state machine (no three, no react). The renderer calls `stepLongQ9` every frame
 * and only applies the returned frame: bike pose, wheel and handlebar angles, kickstand, lamp commands, rider pose and clip.
 * The model (`longq9.optimized.glb`) carries the clips of LONG_Q9_CLIPS, built by
 * `apps/game/scripts/longq9/build-longq9.cjs`; the clips carry no root motion. He is spawned exactly once per world (a
 * guard in `saigonDistricts.ts`) and his file is in no shared model list.
 *
 * Coordinates: every site works in a road frame. `u` is the distance along the road edge (the edge's own arc length `s`),
 * `v` the lateral offset to the right of the edge centre line (+v is toward the curb, the way traffic drives in Vietnam).
 * World = origin + dir * u + right * v with right = (-dir.z, dir.x).
 */

export const LONG_Q9_FILE = "longq9.optimized.glb";
/** The yellow Honda Wave he rides (`apps/game/scripts/longq9/build-wave.cjs`), in the same model folder. */
export const WAVE_LONGQ9_FILE = "wave-longq9.optimized.glb";
/** Height of the rigged model at rest in metres (the T-pose is 1.704 m tall). */
export const LONG_Q9_RIG_HEIGHT = 1.704;
/** Height he is shown at in the street. */
export const LONG_Q9_HEIGHT = 1.66;

/** Every clip baked into the file, in the order the build writes them. */
export const LONG_Q9_CLIPS = ["Walk", "Ride", "Greet_Seated", "Crouch_Repair", "Wave_Hand", "Kneel_Pump"] as const;
export type LongQ9Clip = (typeof LONG_Q9_CLIPS)[number];

/** Height of the sidewalk above the road (equal to CURB_HEIGHT in `boarding.ts`, repeated so this module has no imports). */
export const LONG_Q9_CURB_HEIGHT = 0.16;
/** Lateral position of the curb edge in the road frame (the carriageway half width of the directional edges). */
export const LONG_Q9_CURB_V = 3.0;

// ----------------------------------------------------------------------------------------------------------------
// Tuning constants
// ----------------------------------------------------------------------------------------------------------------

/** Rider origin in the bike frame (the Wave_Rider anchor of the GLB; +Z forward, +X left). */
export const LONG_Q9_SEAT_OFFSET = { x: 0, z: -0.16 } as const;
/** Where he stands next to the bike after climbing off: on the right (-X) side, away from the kickstand. */
export const LONG_Q9_STAND_OFFSET = { x: -0.62, z: -0.1 } as const;
/** Kickstand hinge angles of the Wave GLB (degrees about local X), folded and deployed. */
export const LONG_Q9_KICKSTAND_FOLDED_DEG = 10;
export const LONG_Q9_KICKSTAND_DEPLOYED_DEG = -75;
/** Roll (rad, +Z rotation tilts the top toward the right) of the bike resting on its stand, which stands on its left. */
export const LONG_Q9_KICKSTAND_LEAN = -0.06;
/** Wheel base of the Wave in metres, used for the handlebar angle. */
export const LONG_Q9_WHEEL_BASE = 1.2;

export const LONG_Q9_PARK_SECONDS = 1.6;
/** Seconds the kickstand takes to go down or up. */
export const LONG_Q9_KICKSTAND_SECONDS = 0.9;
export const LONG_Q9_DISMOUNT_SECONDS = 1.4;
export const LONG_Q9_GREET_SECONDS = 3.0;
export const LONG_Q9_CROUCH_SECONDS = 11;
export const LONG_Q9_PUMP_SECONDS = 8;
export const LONG_Q9_REPAIR_SECONDS = LONG_Q9_CROUCH_SECONDS + LONG_Q9_PUMP_SECONDS;
export const LONG_Q9_FAREWELL_SECONDS = 3.5;
export const LONG_Q9_MOUNT_SECONDS = 1.4;
export const LONG_Q9_KICKSTAND_UP_SECONDS = 1.2;
/** Seconds of cruise in traffic before he is allowed to spot the next stranded rider. */
export const LONG_Q9_CRUISE_MIN_SECONDS = 4;
/** Managed cruise longer than this asks the renderer to bring him near the next site (only when nobody sees it). */
export const LONG_Q9_CRUISE_TIMEOUT_SECONDS = 150;
/** Seconds he is out of sight between two sites in the scripted fallback (no traffic manager). */
export const LONG_Q9_TRANSIT_SECONDS = 3;

/** Ground speed (m/s) of his stroll. The clip plays at its own rate; the pace is tuned by eye. */
export const LONG_Q9_WALK_SPEED = 1.0;
/** Cruise speed of the scripted fallback (m/s). */
export const LONG_Q9_SCRIPTED_CRUISE_SPEED = 6;
/** Speed at the end of each approach leg (m/s): end of the signal leg, of the pull-over leg and of the curb climb. */
export const LONG_Q9_LEG_SPEEDS = [4, 2.2, 1.4, 0] as const;
/** Acceleration when riding off (m/s^2) and the speed he merges at. */
export const LONG_Q9_RIDE_OFF_ACCEL = 1.6;
export const LONG_Q9_RIDE_OFF_SPEED = 5.2;

/** Lateral positions (m, road frame) of the things on the sidewalk. */
export const LONG_Q9_PARK_V = 3.9;
export const LONG_Q9_WALK_V = 4.45;
export const LONG_Q9_WORK_V = 4.8;
export const LONG_Q9_NPC_V = 5.3;
/** The takeover window ends this far (m) before the parking place; the approach legs need the rest to slow down. */
export const LONG_Q9_TAKEOVER_LEAD = 18;
/** Longest he waits (s) with the stand up for the lane behind him to clear before riding off anyway. */
export const LONG_Q9_RIDE_OFF_MAX_WAIT_SECONDS = 25;
/** Lane position (v) he rides in on a normal cruise and merges back into. */
export const LONG_Q9_LANE_V = 1.9;

// ----------------------------------------------------------------------------------------------------------------
// Sites
// ----------------------------------------------------------------------------------------------------------------

export interface LongQ9Site {
  id: string;
  /** Road edge he rides on (traffic/roadGraph.ts). */
  edgeId: string;
  edgeLength: number;
  /** Edge start and unit tangent (copied from the road graph; a test compares them). */
  origin: { x: number; z: number };
  dir: { x: number; z: number };
  /** Where he parks (u, with v = LONG_Q9_PARK_V). */
  parkU: number;
  /** Where the stranded rider's bike stands (behind the parking place, v = LONG_Q9_PARK_V). */
  strangerBikeU: number;
  /** Where he kneels beside the stranger's bike (v = LONG_Q9_WORK_V). */
  workU: number;
  /** Where the stranded rider stands (v = LONG_Q9_NPC_V). */
  npcU: number;
}

/**
 * The rescue sites, visited in this order and then again. All three are on the sidewalk next to a main road, clear of trees,
 * lamp posts and shopfronts (checked in `longQ9.test.ts`).
 *  1. Đường 3/2 south sidewalk, westbound edge D32_W_EB, between the trees at x = 18 and 25 (bike at x 22.6, he parks at x 30.6). He parks early on the edge so that he is handed back to traffic at least 8 m before its end.
 *  2. Đường 3/2 east of Hải Triều, D32_E_EB (bike at x 89.5, he parks at x 97.5).
 *  3. Điện Biên Phủ north sidewalk, DBP_E_WB (heading west; bike at x 101, he parks at x 93).
 */
export const LONG_Q9_SITES: readonly LongQ9Site[] = [
  {
    id: "d32-west",
    edgeId: "D32_W_EB",
    edgeLength: 36.2,
    origin: { x: 8.6, z: -73 },
    dir: { x: 1, z: 0 },
    parkU: 22,
    strangerBikeU: 14,
    workU: 14.4,
    npcU: 12.2,
  },
  {
    id: "d32-east",
    edgeId: "D32_E_EB",
    edgeLength: 54.8,
    origin: { x: 67.2, z: -73 },
    dir: { x: 1, z: 0 },
    parkU: 30.3,
    strangerBikeU: 22.3,
    workU: 22.7,
    npcU: 20.5,
  },
  {
    id: "dbp-bitexco",
    edgeId: "DBP_E_WB",
    edgeLength: 56.8,
    origin: { x: 124, z: -150 },
    dir: { x: -1, z: 0 },
    parkU: 31,
    strangerBikeU: 23,
    workU: 23.4,
    npcU: 21.2,
  },
];

export function siteRight(site: LongQ9Site) {
  return { x: -site.dir.z, z: site.dir.x };
}

/** World position of the road frame point (u, v). */
export function longQ9SitePoint(site: LongQ9Site, u: number, v: number) {
  const r = siteRight(site);
  return { x: site.origin.x + site.dir.x * u + r.x * v, z: site.origin.z + site.dir.z * u + r.z * v };
}

/** Sidewalk height at road frame lateral position `v`: the bike rides up and down the curb around v = 3. */
export function longQ9CurbHeight(v: number): number {
  const k = Math.min(1, Math.max(0, (v - 2.7) / 0.75));
  return LONG_Q9_CURB_HEIGHT * k * k * (3 - 2 * k);
}

/** First and last edge position at which he takes over from traffic and starts to signal for a site. */
export function longQ9TakeoverWindow(site: LongQ9Site): { sLo: number; sHi: number } {
  return { sLo: Math.max(0, site.parkU - 36), sHi: site.parkU - LONG_Q9_TAKEOVER_LEAD };
}

/** The pavement route from the parked bike to the work spot, in road frame (u, v) points. */
export function longQ9WalkRoute(site: LongQ9Site): { u: number; v: number }[] {
  const away = Math.sign(site.parkU - site.workU) || 1;
  return [
    { u: site.parkU + LONG_Q9_STAND_OFFSET.z, v: LONG_Q9_PARK_V - LONG_Q9_STAND_OFFSET.x },
    { u: site.workU + away * 1.0, v: LONG_Q9_WALK_V },
    { u: site.workU, v: LONG_Q9_WORK_V },
  ];
}

// ----------------------------------------------------------------------------------------------------------------
// State machine
// ----------------------------------------------------------------------------------------------------------------

export type LongQ9Phase =
  | "cruise"
  | "signal"
  | "pull_over"
  | "climb_curb"
  | "park"
  | "dismount"
  | "walk_to"
  | "greet"
  | "repair"
  | "farewell"
  | "walk_back"
  | "mount"
  | "kickstand_up"
  | "ride_off";

/** Every phase in the order of one rescue. */
export const LONG_Q9_PHASES: readonly LongQ9Phase[] = [
  "cruise",
  "signal",
  "pull_over",
  "climb_curb",
  "park",
  "dismount",
  "walk_to",
  "greet",
  "repair",
  "farewell",
  "walk_back",
  "mount",
  "kickstand_up",
  "ride_off",
];

/** What the traffic simulation says about his bike while it is managed (null on a turn arc). */
export interface LongQ9TrafficReading {
  edgeId: string;
  s: number;
  latOffset: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
}

interface Leg {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  len: number;
  vs: number;
  ve: number;
}

export interface LongQ9State {
  site: number;
  phase: LongQ9Phase;
  /** Seconds spent in the current phase. */
  t: number;
  /** Road frame position of the bike. */
  u: number;
  v: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  yawRate: number;
  steer: number;
  kickstand: number;
  /** Rider on foot (world pose below) or on the bike. */
  px: number;
  pz: number;
  pyaw: number;
  /** Approach and ride-off path bookkeeping. */
  legs: Leg[];
  leg: number;
  legD: number;
  rideD: number;
  /** Walk bookkeeping. */
  walk: { x: number; z: number }[];
  walkI: number;
  /** Seconds left out of sight in the scripted fallback. */
  transit: number;
  relocate: boolean;
  /** True on the frame the traffic manager must get the bike back (see `LongQ9Frame.handback`). */
  handback: LongQ9TrafficReading | null;
}

export interface LongQ9Pose {
  x: number;
  z: number;
  y: number;
  yaw: number;
}

export interface LongQ9Frame {
  phase: LongQ9Phase;
  site: number;
  /** The bike. */
  bike: LongQ9Pose;
  speed: number;
  /** Front wheel angle (rad, + is left) and chassis roll (rad, the `rotation.z` of the chassis). */
  steer: number;
  lean: number;
  /** 0 folded, 1 deployed. */
  kickstand: number;
  brake: boolean;
  /** Blinker command, -1 left, +1 right. */
  blinker: -1 | 0 | 1;
  bikeVisible: boolean;
  /** True while this machine places the bike; false in cruise, when traffic moves it. */
  external: boolean;
  /** The rider's world pose, valid while `standingOnFoot` (otherwise he sits at the seat anchor). */
  person: LongQ9Pose;
  standingOnFoot: boolean;
  clip: LongQ9Clip;
  /** The stranded rider faces Long while he is on foot near the bike, otherwise his own bike. */
  strangerFacesLong: boolean;
  /** Set once, on the frame the bike must be given back to the traffic manager (the pose is on the road). */
  handback: LongQ9TrafficReading | null;
  /** True while a managed cruise lasted too long; the renderer may then move him near the next site, out of sight. */
  relocate: boolean;
}

export function createLongQ9State(sites: readonly LongQ9Site[] = LONG_Q9_SITES, siteIndex = 0): LongQ9State {
  const site = sites[siteIndex];
  const { sLo } = longQ9TakeoverWindow(site);
  const p = longQ9SitePoint(site, sLo, LONG_Q9_LANE_V);
  return {
    site: siteIndex,
    phase: "cruise",
    t: LONG_Q9_CRUISE_MIN_SECONDS,
    u: sLo,
    v: LONG_Q9_LANE_V,
    x: p.x,
    z: p.z,
    yaw: Math.atan2(site.dir.x, site.dir.z),
    speed: LONG_Q9_SCRIPTED_CRUISE_SPEED,
    yawRate: 0,
    steer: 0,
    kickstand: 0,
    px: p.x,
    pz: p.z,
    pyaw: Math.atan2(site.dir.x, site.dir.z),
    legs: [],
    leg: 0,
    legD: 0,
    rideD: 0,
    walk: [],
    walkI: 0,
    transit: 0,
    relocate: false,
    handback: null,
  };
}

const wrap = (a: number) => {
  let d = a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const smooth01 = (k: number) => {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function setPhase(state: LongQ9State, phase: LongQ9Phase) {
  state.phase = phase;
  state.t = 0;
}

function bikeWorldOffset(state: LongQ9State, ox: number, oz: number) {
  // Bike frame +Z forward, +X left: world = pos + forward * oz + left * ox, left = (cos yaw, -sin yaw).
  const fx = Math.sin(state.yaw);
  const fz = Math.cos(state.yaw);
  return { x: state.x + fx * oz + fz * ox, z: state.z + fz * oz - fx * ox };
}

function placeBike(state: LongQ9State, site: LongQ9Site) {
  const p = longQ9SitePoint(site, state.u, state.v);
  state.x = p.x;
  state.z = p.z;
}

function buildLegs(site: LongQ9Site, u0: number, v0: number, speed0: number): Leg[] {
  const pts: [number, number][] = [
    [u0, v0],
    [site.parkU - 10, 2.0],
    [site.parkU - 4.4, 2.65],
    [site.parkU - 2.2, 3.55],
    [site.parkU, LONG_Q9_PARK_V],
  ];
  const legs: Leg[] = [];
  let vs = Math.max(speed0, LONG_Q9_LEG_SPEEDS[0]);
  for (let i = 0; i < 4; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    const ve = LONG_Q9_LEG_SPEEDS[i];
    legs.push({ u0: a[0], v0: a[1], u1: b[0], v1: b[1], len: Math.hypot(b[0] - a[0], b[1] - a[1]), vs, ve });
    vs = ve;
  }
  return legs;
}

function rideOffPath(site: LongQ9Site): [number, number][] {
  const u = site.parkU;
  return [
    [u, LONG_Q9_PARK_V],
    [u + 1.4, 3.5],
    [u + 3.0, 2.55],
    [u + 5.0, LONG_Q9_LANE_V],
    [u + 6.0, LONG_Q9_LANE_V],
  ];
}

function followHeading(state: LongQ9State, site: LongQ9Site, du: number, dv: number, dt: number, rate = 6) {
  const r = siteRight(site);
  const wx = site.dir.x * du + r.x * dv;
  const wz = site.dir.z * du + r.z * dv;
  const target = Math.atan2(wx, wz);
  const old = state.yaw;
  state.yaw += wrap(target - state.yaw) * Math.min(1, dt * rate);
  state.yawRate = dt > 0 ? wrap(state.yaw - old) / dt : 0;
}

/** Moves the bike along the approach legs. Returns true when the last leg is done. */
function advanceApproach(state: LongQ9State, site: LongQ9Site, dt: number): boolean {
  let leg = state.legs[state.leg];
  const frac = leg.len > 0 ? clamp(state.legD / leg.len, 0, 1) : 1;
  const v2 = leg.vs * leg.vs + (leg.ve * leg.ve - leg.vs * leg.vs) * frac;
  state.speed = Math.max(leg.ve === 0 ? 0.3 : 0.5, Math.sqrt(Math.max(v2, 0)));
  state.legD += state.speed * dt;
  let done = false;
  while (state.legD >= leg.len) {
    if (state.leg === state.legs.length - 1) {
      state.legD = leg.len;
      done = true;
      break;
    }
    state.legD -= leg.len;
    state.leg += 1;
    leg = state.legs[state.leg];
  }
  const f = leg.len > 0 ? clamp(state.legD / leg.len, 0, 1) : 1;
  state.u = leg.u0 + (leg.u1 - leg.u0) * f;
  state.v = leg.v0 + (leg.v1 - leg.v0) * f;
  placeBike(state, site);
  if (state.leg === state.legs.length - 1) {
    // Straighten along the curb while rolling to a stop.
    const along = Math.atan2(site.dir.x, site.dir.z);
    const r = siteRight(site);
    const du = leg.u1 - leg.u0;
    const dv = leg.v1 - leg.v0;
    const dirYaw = Math.atan2(site.dir.x * du + r.x * dv, site.dir.z * du + r.z * dv);
    const target = dirYaw + wrap(along - dirYaw) * smooth01(f);
    const old = state.yaw;
    state.yaw += wrap(target - state.yaw) * Math.min(1, dt * 6);
    state.yawRate = dt > 0 ? wrap(state.yaw - old) / dt : 0;
  } else {
    followHeading(state, site, leg.u1 - leg.u0, leg.v1 - leg.v0, dt);
  }
  if (done) state.speed = 0;
  return done;
}

function startWalk(state: LongQ9State, site: LongQ9Site, reverse: boolean) {
  const route = longQ9WalkRoute(site).map((p) => longQ9SitePoint(site, p.u, p.v));
  state.walk = reverse ? route.slice().reverse() : route;
  state.walkI = 1;
  state.px = state.walk[0].x;
  state.pz = state.walk[0].z;
}

/** Walks along `state.walk`. Returns true on arrival. */
function advanceWalk(state: LongQ9State, dt: number): boolean {
  let budget = LONG_Q9_WALK_SPEED * dt;
  while (state.walkI < state.walk.length) {
    const target = state.walk[state.walkI];
    const dx = target.x - state.px;
    const dz = target.z - state.pz;
    const dist = Math.hypot(dx, dz);
    if (dist > 1e-6) state.pyaw += wrap(Math.atan2(dx, dz) - state.pyaw) * Math.min(1, dt * 8);
    if (dist <= budget) {
      state.px = target.x;
      state.pz = target.z;
      budget -= dist;
      state.walkI += 1;
    } else {
      state.px += (dx / dist) * budget;
      state.pz += (dz / dist) * budget;
      return false;
    }
  }
  return true;
}

function faceTowards(state: LongQ9State, tx: number, tz: number, dt: number) {
  state.pyaw += wrap(Math.atan2(tx - state.px, tz - state.pz) - state.pyaw) * Math.min(1, dt * 5);
}

/**
 * Advances the rescue loop by `dt` seconds and returns the frame to render.
 *
 * `traffic` describes the managed bike during cruise: pass the agent's reading (edge, position, speed), `null` while it
 * is on a junction arc, or leave it `undefined` when there is no traffic manager. Then he rides a scripted lane path.
 * `rideOffClear` is false while a vehicle is closing in on the spot where he merges back; he then waits with the stand up
 * (at most `LONG_Q9_RIDE_OFF_MAX_WAIT_SECONDS`) instead of pulling out in front of it.
 */
export function stepLongQ9(
  state: LongQ9State,
  rawDt: number,
  sites: readonly LongQ9Site[] = LONG_Q9_SITES,
  traffic?: LongQ9TrafficReading | null,
  rideOffClear = true,
): LongQ9Frame {
  const dt = clamp(rawDt, 0, 0.1);
  state.t += dt;
  state.handback = null;
  const site = sites[state.site];
  const { sLo, sHi } = longQ9TakeoverWindow(site);

  switch (state.phase) {
    case "cruise": {
      let reading: LongQ9TrafficReading | null;
      if (traffic === undefined) {
        // Scripted fallback: ride the lane toward the site, out of sight for the transit between two sites.
        if (state.transit > 0) {
          state.transit -= dt;
          if (state.transit <= 0) {
            state.transit = 0;
            state.u = sLo;
            state.v = LONG_Q9_LANE_V;
            state.t = LONG_Q9_CRUISE_MIN_SECONDS;
            placeBike(state, site);
            state.yaw = Math.atan2(site.dir.x, site.dir.z);
          }
          // Still riding away along his heading for a moment, then out of sight.
          state.x += Math.sin(state.yaw) * state.speed * dt;
          state.z += Math.cos(state.yaw) * state.speed * dt;
          reading = null;
        } else {
          state.speed = LONG_Q9_SCRIPTED_CRUISE_SPEED;
          state.u += state.speed * dt;
          state.v = LONG_Q9_LANE_V;
          placeBike(state, site);
          reading = { edgeId: site.edgeId, s: state.u, latOffset: state.v, x: state.x, z: state.z, yaw: state.yaw, speed: state.speed };
        }
      } else {
        reading = traffic;
        if (traffic) {
          state.x = traffic.x;
          state.z = traffic.z;
          state.yaw = traffic.yaw;
          state.speed = traffic.speed;
          state.u = traffic.s;
          state.v = traffic.latOffset;
        }
        if (state.t > LONG_Q9_CRUISE_TIMEOUT_SECONDS) state.relocate = true;
      }
      state.steer *= 0.9;
      state.yawRate = 0;
      if (
        reading &&
        state.t >= LONG_Q9_CRUISE_MIN_SECONDS &&
        reading.edgeId === site.edgeId &&
        reading.s >= (traffic === undefined ? sHi - 0.5 : sLo) &&
        reading.s <= sHi &&
        reading.latOffset >= -0.6 &&
        reading.latOffset <= 2.4
      ) {
        state.relocate = false;
        state.legs = buildLegs(site, reading.s, reading.latOffset, reading.speed);
        state.leg = 0;
        state.legD = 0;
        state.u = reading.s;
        state.v = reading.latOffset;
        state.yaw = reading.yaw;
        setPhase(state, "signal");
      }
      break;
    }
    case "signal":
    case "pull_over":
    case "climb_curb": {
      const done = advanceApproach(state, site, dt);
      state.phase = state.leg === 0 ? "signal" : state.leg === 1 ? "pull_over" : "climb_curb";
      if (done) setPhase(state, "park");
      break;
    }
    case "park": {
      state.speed = 0;
      state.yawRate = 0;
      state.steer = 0;
      state.kickstand = smooth01((state.t - 0.2) / LONG_Q9_KICKSTAND_SECONDS);
      if (state.t >= LONG_Q9_PARK_SECONDS) {
        const seat = bikeWorldOffset(state, LONG_Q9_SEAT_OFFSET.x, LONG_Q9_SEAT_OFFSET.z);
        state.px = seat.x;
        state.pz = seat.z;
        state.pyaw = state.yaw;
        setPhase(state, "dismount");
      }
      break;
    }
    case "dismount": {
      const k = smooth01(state.t / LONG_Q9_DISMOUNT_SECONDS);
      const a = bikeWorldOffset(state, LONG_Q9_SEAT_OFFSET.x, LONG_Q9_SEAT_OFFSET.z);
      const b = bikeWorldOffset(state, LONG_Q9_STAND_OFFSET.x, LONG_Q9_STAND_OFFSET.z);
      state.px = a.x + (b.x - a.x) * k;
      state.pz = a.z + (b.z - a.z) * k;
      if (state.t >= LONG_Q9_DISMOUNT_SECONDS) {
        startWalk(state, site, false);
        setPhase(state, "walk_to");
      }
      break;
    }
    case "walk_to": {
      if (advanceWalk(state, dt)) setPhase(state, "greet");
      break;
    }
    case "greet": {
      const npc = longQ9SitePoint(site, site.npcU, LONG_Q9_NPC_V);
      faceTowards(state, npc.x, npc.z, dt);
      if (state.t >= LONG_Q9_GREET_SECONDS) setPhase(state, "repair");
      break;
    }
    case "repair": {
      const bike = longQ9SitePoint(site, site.strangerBikeU, LONG_Q9_PARK_V);
      faceTowards(state, bike.x, bike.z, dt);
      if (state.t >= LONG_Q9_REPAIR_SECONDS) setPhase(state, "farewell");
      break;
    }
    case "farewell": {
      const npc = longQ9SitePoint(site, site.npcU, LONG_Q9_NPC_V);
      faceTowards(state, npc.x, npc.z, dt);
      if (state.t >= LONG_Q9_FAREWELL_SECONDS) {
        startWalk(state, site, true);
        setPhase(state, "walk_back");
      }
      break;
    }
    case "walk_back": {
      if (advanceWalk(state, dt)) setPhase(state, "mount");
      break;
    }
    case "mount": {
      const k = smooth01(state.t / LONG_Q9_MOUNT_SECONDS);
      const a = bikeWorldOffset(state, LONG_Q9_STAND_OFFSET.x, LONG_Q9_STAND_OFFSET.z);
      const b = bikeWorldOffset(state, LONG_Q9_SEAT_OFFSET.x, LONG_Q9_SEAT_OFFSET.z);
      state.px = a.x + (b.x - a.x) * k;
      state.pz = a.z + (b.z - a.z) * k;
      state.pyaw += wrap(state.yaw - state.pyaw) * Math.min(1, dt * 6);
      if (state.t >= LONG_Q9_MOUNT_SECONDS) setPhase(state, "kickstand_up");
      break;
    }
    case "kickstand_up": {
      state.kickstand = 1 - smooth01(state.t / LONG_Q9_KICKSTAND_SECONDS);
      if (state.t >= LONG_Q9_KICKSTAND_UP_SECONDS && (rideOffClear || state.t >= LONG_Q9_KICKSTAND_UP_SECONDS + LONG_Q9_RIDE_OFF_MAX_WAIT_SECONDS)) {
        state.kickstand = 0;
        state.rideD = 0;
        setPhase(state, "ride_off");
      }
      break;
    }
    case "ride_off": {
      const pts = rideOffPath(site);
      state.speed = Math.max(0.4, Math.min(LONG_Q9_RIDE_OFF_SPEED, Math.sqrt(2 * LONG_Q9_RIDE_OFF_ACCEL * state.rideD)));
      state.rideD += state.speed * dt;
      let d = state.rideD;
      let i = 0;
      while (i < pts.length - 2 && d > Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])) {
        d -= Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        i++;
      }
      const a = pts[i];
      const b = pts[i + 1];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const f = segLen > 0 ? Math.min(1, d / segLen) : 1;
      state.u = a[0] + (b[0] - a[0]) * f;
      state.v = a[1] + (b[1] - a[1]) * f;
      placeBike(state, site);
      followHeading(state, site, b[0] - a[0], b[1] - a[1], dt);
      if (i === pts.length - 2 && f >= 1) {
        state.handback = {
          edgeId: site.edgeId,
          s: state.u,
          latOffset: state.v,
          x: state.x,
          z: state.z,
          yaw: state.yaw,
          speed: state.speed,
        };
        const next = (state.site + 1) % sites.length;
        const sameEdge = traffic !== undefined;
        state.site = next;
        setPhase(state, "cruise");
        if (!sameEdge) {
          // Scripted fallback: keep riding straight on (still on this road) for a moment, then leave the stage unseen.
          state.transit = LONG_Q9_TRANSIT_SECONDS;
          state.speed = LONG_Q9_SCRIPTED_CRUISE_SPEED;
        }
        state.t = 0;
      }
      break;
    }
  }

  return frameOf(state);
}

function frameOf(state: LongQ9State): LongQ9Frame {
  const phase = state.phase;
  const y = longQ9CurbHeight(state.v);
  const onFoot =
    phase === "dismount" || phase === "walk_to" || phase === "greet" || phase === "repair" || phase === "farewell" || phase === "walk_back" || phase === "mount";
  const parked = onFoot || phase === "park" || phase === "kickstand_up";
  const moving = state.speed > 0.6;

  let clip: LongQ9Clip;
  switch (phase) {
    case "walk_to":
    case "walk_back":
      clip = "Walk";
      break;
    case "greet":
    case "farewell":
      clip = "Wave_Hand";
      break;
    case "repair":
      clip = state.t < LONG_Q9_CROUCH_SECONDS ? "Crouch_Repair" : "Kneel_Pump";
      break;
    case "dismount":
    case "mount":
    case "park":
    case "kickstand_up":
      clip = "Greet_Seated";
      break;
    default:
      clip = moving ? "Ride" : "Greet_Seated";
  }

  const seat = bikeWorldOffset(state, LONG_Q9_SEAT_OFFSET.x, LONG_Q9_SEAT_OFFSET.z);
  const person: LongQ9Pose = onFoot
    ? { x: state.px, z: state.pz, y, yaw: state.pyaw }
    : { x: seat.x, z: seat.z, y, yaw: state.yaw };

  const rollMoving = moving && !parked ? -Math.atan((state.speed * state.yawRate) / 9.81) * 1.15 : 0;
  const lean = clamp(rollMoving, -0.4, 0.4) + LONG_Q9_KICKSTAND_LEAN * state.kickstand;
  const steerTarget = moving ? clamp(Math.atan((LONG_Q9_WHEEL_BASE * state.yawRate) / Math.max(state.speed, 0.5)), -0.5, 0.5) : 0;
  state.steer += (steerTarget - state.steer) * 0.3;

  let blinker: -1 | 0 | 1 = 0;
  if (phase === "signal" || phase === "pull_over") blinker = 1;
  if (phase === "ride_off") blinker = -1;
  const leg = state.legs[state.leg];
  const decel = (phase === "signal" || phase === "pull_over" || phase === "climb_curb") && leg !== undefined && leg.ve < leg.vs;
  const brake = decel || phase === "park" || phase === "dismount" || phase === "mount" || phase === "kickstand_up";

  const cruiseHidden = phase === "cruise" && state.transit > 0 && state.transit <= LONG_Q9_TRANSIT_SECONDS - 0.4;
  const strangerFacesLong =
    phase === "walk_to" || phase === "greet" || phase === "repair" || phase === "farewell" || phase === "walk_back";

  return {
    phase,
    site: state.site,
    bike: { x: state.x, z: state.z, y, yaw: state.yaw },
    speed: state.speed,
    steer: state.steer,
    lean,
    kickstand: state.kickstand,
    brake,
    blinker,
    bikeVisible: !cruiseHidden,
    external: phase !== "cruise",
    person,
    standingOnFoot: onFoot,
    clip,
    strangerFacesLong,
    handback: state.handback,
    relocate: state.relocate,
  };
}

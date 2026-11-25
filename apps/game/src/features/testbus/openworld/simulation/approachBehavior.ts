// A street NPC who notices Alex and walks up to him (Mission 02: the unregistered driver at the Bus 06 stop), then walks
// back to his spot when the talk is over or Alex leaves. Pure and frame-rate independent: no three.js, no clock, no
// randomness. The director (storyNpcs.ts) applies the result to the model and picks the walk or idle clip.
//
//   home ──(Alex comes within noticeRadius)──▶ noticed ──(turnSeconds)──▶ approaching ──(at stopDistance)──▶ engaged
//     ▲                                                                       │ (Alex leaves)                  │
//     └──────────────────────────── returning ◀───────────────────────────────┴──(talk over / Alex walks off)──┘
//
// He never walks into Alex (he stops `stopDistance` short, on the line between them), never leaves the sidewalk band
// (`minX`..`maxX`) and never goes further than `leash` from his spot, so he cannot block the road or the bus door.

export type ApproachPhase = "home" | "noticed" | "approaching" | "engaged" | "returning";

export interface ApproachConfig {
  homeX: number;
  homeZ: number;
  homeYaw: number;
  /** Alex this close to the spot gets noticed (metres). */
  noticeRadius: number;
  /** Conversation distance he stops at (metres, centre to centre). */
  stopDistance: number;
  /** Furthest he walks from his spot (metres). */
  leash: number;
  /** Walking speed (metres per second): the walk clip's own speed, so the feet do not slide. */
  walkSpeed: number;
  /** Time to turn toward Alex and call out before he starts walking (seconds). */
  turnSeconds: number;
  /** Alex further than this from the spot ends the approach (metres). */
  giveUpRadius: number;
  /** After a talk (or a walk-off), the time before he approaches again (seconds). */
  cooldownSeconds: number;
  /** He waits this long after the talk closes before turning away (seconds): the goodbye beat. */
  farewellSeconds: number;
  /** Sidewalk band he keeps to (world x). */
  minX: number;
  maxX: number;
}

export interface ApproachState {
  phase: ApproachPhase;
  x: number;
  z: number;
  yaw: number;
  /** Seconds left in the current timed beat (noticed, farewell, walk-off). */
  timer: number;
  /** No new approach before this time (seconds, the director's clock). */
  cooldownUntil: number;
  /** A conversation happened during this approach. */
  talked: boolean;
}

export interface ApproachInput {
  dt: number;
  time: number;
  playerX: number;
  playerZ: number;
  /** Alex is on foot on the street (not on the bus, not indoors). */
  playerAvailable: boolean;
  /** A conversation with this NPC is open. */
  conversing: boolean;
}

export interface ApproachOutput {
  state: ApproachState;
  /** Metres per second he moves this frame (0 when standing): drives the walk / idle blend. */
  speed: number;
  /** Where he should look: Alex while noticing, walking up and talking; null for his own heading. */
  facePlayer: boolean;
}

export function initialApproachState(config: ApproachConfig): ApproachState {
  return { phase: "home", x: config.homeX, z: config.homeZ, yaw: config.homeYaw, timer: 0, cooldownUntil: 0, talked: false };
}

const wrap = (a: number) => {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
};
/** Turns `yaw` toward `target` at a frame-rate independent rate. */
function turn(yaw: number, target: number, rate: number, dt: number): number {
  return yaw + wrap(target - yaw) * (1 - Math.exp(-rate * dt));
}
const headingTo = (fromX: number, fromZ: number, toX: number, toZ: number) => Math.atan2(toX - fromX, toZ - fromZ);

/** The conversation spot: `stopDistance` short of Alex on the line from him, inside the leash and the sidewalk band. */
export function conversationSpot(config: ApproachConfig, from: { x: number; z: number }, playerX: number, playerZ: number): { x: number; z: number } {
  const dx = from.x - playerX;
  const dz = from.z - playerZ;
  const len = Math.hypot(dx, dz) || 1;
  let x = playerX + (dx / len) * config.stopDistance;
  let z = playerZ + (dz / len) * config.stopDistance;
  const hx = x - config.homeX;
  const hz = z - config.homeZ;
  const fromHome = Math.hypot(hx, hz);
  if (fromHome > config.leash) {
    x = config.homeX + (hx / fromHome) * config.leash;
    z = config.homeZ + (hz / fromHome) * config.leash;
  }
  return { x: Math.min(config.maxX, Math.max(config.minX, x)), z };
}

/** Moves toward a point at `speed`; returns the new position and whether it arrived. */
function walkTo(state: ApproachState, tx: number, tz: number, speed: number, dt: number): { x: number; z: number; arrived: boolean; moved: number } {
  const dx = tx - state.x;
  const dz = tz - state.z;
  const dist = Math.hypot(dx, dz);
  const step = speed * dt;
  // Arrive only within this frame's step, so the last frame is never faster than the walk (no one-frame speed spike).
  if (dist <= step) return { x: tx, z: tz, arrived: true, moved: dist };
  return { x: state.x + (dx / dist) * step, z: state.z + (dz / dist) * step, arrived: false, moved: step };
}

export function stepApproach(prev: ApproachState, config: ApproachConfig, input: ApproachInput): ApproachOutput {
  const { dt, time, playerX, playerZ } = input;
  const s: ApproachState = { ...prev };
  const playerFromHome = Math.hypot(playerX - config.homeX, playerZ - config.homeZ);
  const playerFromNpc = Math.hypot(playerX - s.x, playerZ - s.z);
  let speed = 0;
  let facePlayer = false;
  if (input.conversing) s.talked = true;

  switch (s.phase) {
    case "home": {
      s.yaw = turn(s.yaw, config.homeYaw, 3, dt);
      if (input.playerAvailable && time >= s.cooldownUntil && playerFromHome < config.noticeRadius) {
        s.phase = "noticed";
        s.timer = config.turnSeconds;
        s.talked = false;
      }
      // Alex can still walk up to him at his spot and talk.
      if (input.conversing) s.phase = "engaged";
      break;
    }
    case "noticed": {
      facePlayer = true;
      s.yaw = turn(s.yaw, headingTo(s.x, s.z, playerX, playerZ), 6, dt);
      s.timer -= dt;
      if (input.conversing) s.phase = "engaged";
      else if (!input.playerAvailable || playerFromHome > config.giveUpRadius) s.phase = "returning";
      else if (s.timer <= 0) s.phase = playerFromNpc <= config.stopDistance + 0.3 ? "engaged" : "approaching";
      break;
    }
    case "approaching": {
      facePlayer = true;
      if (input.conversing) {
        s.phase = "engaged";
        break;
      }
      if (!input.playerAvailable || playerFromHome > config.giveUpRadius) {
        s.phase = "returning";
        break;
      }
      const spot = conversationSpot(config, s, playerX, playerZ);
      const step = walkTo(s, spot.x, spot.z, config.walkSpeed, dt);
      s.x = step.x;
      s.z = step.z;
      speed = dt > 0 ? step.moved / dt : 0;
      // Walking: face the way he walks; at the end of the walk he turns to Alex.
      const heading = step.moved > 0.001 ? headingTo(prev.x, prev.z, s.x, s.z) : headingTo(s.x, s.z, playerX, playerZ);
      s.yaw = turn(s.yaw, heading, 7, dt);
      if (step.arrived) s.phase = "engaged";
      break;
    }
    case "engaged": {
      facePlayer = true;
      s.yaw = turn(s.yaw, headingTo(s.x, s.z, playerX, playerZ), 6, dt);
      if (input.conversing) {
        s.timer = config.farewellSeconds;
        break;
      }
      // The talk closed (goodbye beat), or Alex walked off without talking: walk back once the beat is over.
      const walkedOff = !input.playerAvailable || playerFromNpc > config.noticeRadius;
      if (s.talked || walkedOff) {
        s.timer -= dt;
        if (s.timer <= 0 || walkedOff) {
          s.phase = "returning";
          s.cooldownUntil = time + config.cooldownSeconds;
        }
      } else if (playerFromNpc > config.stopDistance + 0.8) {
        // Alex stepped back a little: follow him to a comfortable distance again.
        s.phase = "approaching";
      }
      break;
    }
    case "returning": {
      if (input.conversing) {
        s.phase = "engaged";
        break;
      }
      const step = walkTo(s, config.homeX, config.homeZ, config.walkSpeed, dt);
      s.x = step.x;
      s.z = step.z;
      speed = dt > 0 ? step.moved / dt : 0;
      if (step.moved > 0.001) s.yaw = turn(s.yaw, headingTo(prev.x, prev.z, s.x, s.z), 7, dt);
      if (step.arrived) {
        s.phase = "home";
        s.cooldownUntil = Math.max(s.cooldownUntil, time + config.cooldownSeconds);
      }
      break;
    }
  }
  return { state: s, speed, facePlayer };
}

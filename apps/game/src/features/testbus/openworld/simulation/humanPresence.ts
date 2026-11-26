import * as T from "three";

/**
 * Unified Living-Human Physical Collision & Social Space Registry for Saigon.
 *
 * Guarantees the player can NEVER walk through ANY human (Street Residents, Story NPCs,
 * or District Pedestrians), and turns every shoulder brush / sprint bump / awkward stare
 * into a living GTA-6 / Cyberpunk-grade physical + social reaction.
 */

export interface LocalizedReaction {
  en: string;
  vi: string;
}

export interface CrowdReactionBark {
  speaker: LocalizedReaction;
  text: LocalizedReaction;
  kind: "bump" | "personal_space";
}

export interface HumanBodyRegistration {
  id: string;
  /** Display speaker name for organic street bump/reaction subtitles. */
  label: LocalizedReaction;
  /** Living 3D root whose world position is tracked every frame. */
  object: T.Object3D;
  /** Collision cylinder radius in meters (default 0.34m). */
  radius?: number;
  /** True for standing/walking humans who can subtly yield/sidestep on contact. */
  canSidestep?: boolean;
  /** Optional hook invoked when Alex physically bumps into this human. */
  onBump?: (worldDirX: number, worldDirZ: number, strength: number) => void;
  /** Optional hook invoked while Alex stands awkwardly close (< 1.15m). */
  onPersonalSpace?: (intensity: number) => void;
  /** Optional flag so Story NPCs mid-conversation don't complain about personal space. */
  isConversing?: () => boolean;
}

export interface HumanCollisionResult {
  x: number;
  z: number;
  hitHuman: boolean;
  bumped: boolean;
  impactStrength: number;
  impulseX: number;
  impulseZ: number;
  reaction: CrowdReactionBark | null;
}

interface TrackedHuman extends Required<Pick<HumanBodyRegistration, "id" | "label" | "object" | "radius" | "canSidestep">> {
  onBump?: (worldDirX: number, worldDirZ: number, strength: number) => void;
  onPersonalSpace?: (intensity: number) => void;
  isConversing?: () => boolean;
  lastBumpAt: number;
  lastSpaceBarkAt: number;
  lingerTimer: number;
}

const SOFT_BUMP_LINES: readonly LocalizedReaction[] = [
  { en: "Hey, watch it!", vi: "Ấy, coi chừng đụng kìa bạn!" },
  { en: "Whoa—easy there, student!", vi: "Ủa trời, đi từ từ thôi em ơi!" },
  { en: "Excuse me! Tight sidewalk here.", vi: "Ê khoan, vỉa hè chật quá nha bạn." },
  { en: "Sorry—whoa, almost dropped my coffee!", vi: "Ối, xém đổ ly cà phê luôn á!" },
  { en: "Careful! Rushing somewhere?", vi: "Cẩn thận kìa! Đang gấp đi đâu dữ vậy?" },
];

const HARD_BUMP_LINES: readonly LocalizedReaction[] = [
  { en: "Hey! Eyes up—you just slammed right into me!", vi: "Ủa đi đứng kiểu gì mà tông thẳng vô người ta vậy trời?!" },
  { en: "What the—watch where you're running!", vi: "Trời đất ơi, chạy gì mà không nhìn đường vậy?!" },
  { en: "Whoa! Slow down before you knock someone over!", vi: "Ê chạy chậm thôi cha nội, xém té luôn nè!" },
  { en: "Hey! Sidewalk isn't a racetrack!", vi: "Vỉa hè chứ đâu phải đường đua đâu bạn ơi!" },
];

const PERSONAL_SPACE_LINES: readonly LocalizedReaction[] = [
  { en: "Uh... can I help you?", vi: "Ủa... có chuyện gì không bạn?" },
  { en: "A little close there, friend.", vi: "Đứng hơi sát rồi đó nha bạn ơi." },
  { en: "Everything alright? You're staring.", vi: "Có chuyện gì hả em? Nhìn dữ vậy?" },
];

const _tmpPos = new T.Vector3();

export interface HumanPresenceSystem {
  register(entry: HumanBodyRegistration): () => void;
  readonly count: number;
  /**
   * Resolve solid player-vs-human body collisions and trigger bump / personal-space reactions.
   * Safe to call every frame in `OpenWorldEngine.resolveCollisions`.
   */
  resolvePlayerCollision(
    nx: number,
    nz: number,
    playerY: number,
    playerRadius: number,
    playerSpeed: number,
    nowSec: number,
    dt: number,
  ): HumanCollisionResult;
  /** Get current active crowd bark (if any) for the borderless cinema subtitle strip. */
  getActiveReaction(nowSec: number): CrowdReactionBark | null;
  /**
   * A walking NPC's next position, pushed out of every other registered body (the same solid cylinders the player
   * collides with), so two people never stand inside each other. `selfId` is the walker's own registration.
   */
  separate(selfId: string, x: number, z: number, y: number, radius: number): { x: number; z: number };
  clear(): void;
}

export function createHumanPresenceSystem(): HumanPresenceSystem {
  const bodies: TrackedHuman[] = [];
  let lineSeed = 0;
  let activeReaction: { bark: CrowdReactionBark; expiresAt: number } | null = null;

  return {
    get count() {
      return bodies.length;
    },

    register(entry: HumanBodyRegistration) {
      const tracked: TrackedHuman = {
        id: entry.id,
        label: entry.label,
        object: entry.object,
        radius: entry.radius ?? 0.34,
        canSidestep: entry.canSidestep ?? true,
        onBump: entry.onBump,
        onPersonalSpace: entry.onPersonalSpace,
        isConversing: entry.isConversing,
        lastBumpAt: -10,
        lastSpaceBarkAt: -20,
        lingerTimer: 0,
      };
      bodies.push(tracked);
      return () => {
        const idx = bodies.indexOf(tracked);
        if (idx >= 0) bodies.splice(idx, 1);
      };
    },

    separate(selfId, nx, nz, y, radius) {
      let x = nx;
      let z = nz;
      for (const body of bodies) {
        if (body.id === selfId || !body.object.visible) continue;
        body.object.getWorldPosition(_tmpPos);
        if (Math.abs(_tmpPos.y - y) > 1.35) continue;
        const dx = x - _tmpPos.x;
        const dz = z - _tmpPos.z;
        const minDist = radius + body.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minDist * minDist) continue;
        const dist = Math.sqrt(distSq);
        // Exactly on top: step aside along +x (toward the shops, away from the road).
        const ux = dist > 1e-4 ? dx / dist : 1;
        const uz = dist > 1e-4 ? dz / dist : 0;
        x += ux * (minDist - dist + 0.004);
        z += uz * (minDist - dist + 0.004);
      }
      return { x, z };
    },

    resolvePlayerCollision(nx, nz, playerY, playerRadius, playerSpeed, nowSec, dt) {
      let x = nx;
      let z = nz;
      let hitHuman = false;
      let bumped = false;
      let strongestImpact = 0;
      let impulseX = 0;
      let impulseZ = 0;
      let emittedReaction: CrowdReactionBark | null = null;

      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (!body.object.visible) continue;
        body.object.getWorldPosition(_tmpPos);

        // Only collide with humans on the same floor / elevation tier.
        if (Math.abs(_tmpPos.y - playerY) > 1.35) continue;

        const dx = x - _tmpPos.x;
        const dz = z - _tmpPos.z;
        const distSq = dx * dx + dz * dz;
        const minDist = playerRadius + body.radius;

        // 1. Solid body cylinder separation (ZERO walking through humans!)
        if (distSq < minDist * minDist) {
          hitHuman = true;
          const dist = Math.sqrt(distSq);
          const ux = dist > 1e-4 ? dx / dist : 0;
          const uz = dist > 1e-4 ? dz / dist : 1;
          const overlap = minDist - dist;

          // Push player cleanly outside body cylinder
          x += ux * (overlap + 0.004);
          z += uz * (overlap + 0.004);

          // Trigger visceral GTA-6 / Cyberpunk shoulder-bump reaction when walking/sprinting into them!
          if ((overlap > 0.012 || playerSpeed > 1.2) && nowSec - body.lastBumpAt > 2.8) {
            body.lastBumpAt = nowSec;
            bumped = true;
            const strength = T.MathUtils.clamp(0.45 + playerSpeed * 0.14 + overlap * 1.8, 0.45, 1.35);
            if (strength > strongestImpact) {
              strongestImpact = strength;
              // Soft physical bounce-back felt on player camera & velocity
              impulseX = ux * Math.min(1.6, 0.55 + strength * 0.5);
              impulseZ = uz * Math.min(1.6, 0.55 + strength * 0.5);
            }
            // Impact direction pushed INTO the NPC is (-ux, -uz)
            body.onBump?.(-ux, -uz, strength);

            if (!body.isConversing?.()) {
              const pool = playerSpeed > 5.0 ? HARD_BUMP_LINES : SOFT_BUMP_LINES;
              const text = pool[lineSeed++ % pool.length];
              emittedReaction = { speaker: body.label, text, kind: "bump" };
              activeReaction = { bark: emittedReaction, expiresAt: nowSec + 2.9 };
            }
          }
          body.lingerTimer = 0;
          continue;
        }

        // 2. Social personal-space awareness (< 1.15m linger while NOT in active conversation)
        if (distSq < 1.15 * 1.15 && !body.isConversing?.()) {
          const dist = Math.sqrt(distSq);
          const closeness = T.MathUtils.clamp((1.15 - dist) / (1.15 - minDist), 0, 1);
          body.lingerTimer += dt;
          body.onPersonalSpace?.(closeness);

          if (body.lingerTimer > 2.4 && nowSec - body.lastSpaceBarkAt > 16) {
            body.lastSpaceBarkAt = nowSec;
            body.lingerTimer = 0;
            const text = PERSONAL_SPACE_LINES[lineSeed++ % PERSONAL_SPACE_LINES.length];
            const bark: CrowdReactionBark = {
              speaker: body.label,
              text,
              kind: "personal_space",
            };
            if (!emittedReaction) {
              emittedReaction = bark;
              activeReaction = { bark, expiresAt: nowSec + 2.8 };
            }
          }
        } else {
          body.lingerTimer = Math.max(0, body.lingerTimer - dt * 1.5);
        }
      }

      return {
        x,
        z,
        hitHuman,
        bumped,
        impactStrength: strongestImpact,
        impulseX,
        impulseZ,
        reaction: emittedReaction,
      };
    },

    getActiveReaction(nowSec: number) {
      if (!activeReaction) return null;
      if (nowSec > activeReaction.expiresAt) {
        activeReaction = null;
        return null;
      }
      return activeReaction.bark;
    },

    clear() {
      bodies.length = 0;
      activeReaction = null;
    },
  };
}

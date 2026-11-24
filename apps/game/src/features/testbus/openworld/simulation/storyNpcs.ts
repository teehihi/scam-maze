import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  OPEN_WORLD_STORY_NPCS,
  resolveNpcSchedule,
  resolveStoryNpcDialogue,
  type LocalizedPair,
  type StoryNpcDialogueTurn,
  type StoryNpcId,
  type StoryNpcMood,
  type StoryNpcProfile,
  type StoryNpcPropKind,
  type StoryNpcRuntimeContext,
} from "../../../../game/narrative/chapter1/storyCast";
import { contact, contactMaterial, disposeScene, material, rounded } from "./scene-kit";
import { streetClips } from "./streetClips";
import {
  createHumanRealismRig,
  upgradeHumanMaterials,
  type HumanActivity,
  type HumanRealismRig,
} from "./humanRealism";
import type { HumanPresenceSystem } from "./humanPresence";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export interface ActiveStoryNpcDialogue {
  npcId: StoryNpcId;
  turn: StoryNpcDialogueTurn;
  /** Currently displayed spoken line (opening line or NPC response to Alex's chosen reply). */
  currentText: LocalizedPair;
  /**
   * Stable recording key of the line being spoken now, or null for subtitle-only lines. A voice
   * player resolves this against its manifest; nothing here loads audio by itself.
   */
  /** Stable recording key for the currently displayed NPC line, when one is authored. */
  currentVoiceId?: string | null;
  /** Brief echo of the reply Alex just chose (makes dialogue feel naturally two-way). */
  lastPlayerReply?: LocalizedPair | null;
  currentMood: StoryNpcMood;
  /** Optional scam-awareness / mission insight revealed by a reply. */
  activeInsight: LocalizedPair | null;
  /** Reply IDs already asked during this conversation. */
  askedReplyIds: readonly string[];
  /** True once the player picked a "leave" reply and is reading the farewell line. */
  closing: boolean;
  /** Monotonic counter incremented on every spoken turn (syncs cinema subtitle cadence & voice). */
  lineKey: number;
}

export interface AmbientStreetBark {
  npcId: StoryNpcId;
  speaker: LocalizedPair;
  text: LocalizedPair;
  /** Stable recorded voice ID for this ambient callout, when one exists. */
  voiceId?: string | null;
}

export interface StoryNpcInteractionTarget {
  npc: StoryNpcProfile;
  distance: number;
}

export interface StoryNpcRadarBlip {
  id: StoryNpcId;
  x: number;
  z: number;
}

export interface StoryNpcDirector {
  readonly group: T.Group;
  update(dt: number, time: number, playerPos: T.Vector3, rain: number): void;
  setContext(ctx: Partial<StoryNpcRuntimeContext>): void;
  nearestInteractable(playerPos: T.Vector3, maxDistance?: number): StoryNpcInteractionTarget | null;
  beginDialogue(npcId: StoryNpcId): ActiveStoryNpcDialogue;
  /** Select an interactive RDR2/GTA-6 style reply by 0-based index (keys 1 / 2 / 3 or click). */
  selectReply(index: number): ActiveStoryNpcDialogue | null;
  advanceDialogue(): ActiveStoryNpcDialogue | null;
  /**
   * Re-resolves the open conversation's turn against the current context while keeping the line
   * being spoken. Used when the player's reply changed story state that the dialogue branches on.
   */
  refreshDialogue(): ActiveStoryNpcDialogue | null;
  closeDialogue(): void;
  getActiveDialogue(): ActiveStoryNpcDialogue | null;
  getAmbientBark(): AmbientStreetBark | null;
  /** World-space eye position of the NPC currently speaking with Alex (drives smooth camera framing). */
  getConversationEyePos(out: T.Vector3): boolean;
  /** Lightweight world-space coordinates of currently visible Story NPCs for the live Saigon radar. */
  getRadarBlips(): readonly StoryNpcRadarBlip[];
  dispose(): void;
}

interface SpawnedStoryNpc {
  profile: StoryNpcProfile;
  root: T.Group;
  baseYaw: number;
  eyeHeight: number;
  realism: HumanRealismRig;
  mixer?: T.AnimationMixer;
  handBone: T.Object3D | null;
  handProp: T.Group | null;
  lastBarkTime: number;
}

const DEFAULT_CONTEXT: StoryNpcRuntimeContext = {
  elapsedMinutes: 0,
  thesisProgress: 60,
  fatigue: 20,
  money: 3_500_000,
  flags: { minhTrustsAlex: true },
};

/**
 * Build realistic lightweight 3D physical props for each Story NPC so every character has
 * authentic Saigon environmental staging (zero glowing arcade circles on the pavement!).
 */
function buildStoryNpcProps(
  propKind: StoryNpcPropKind,
  npcRoot: T.Group,
  worldGroup: T.Group,
): { handProp: T.Group | null } {
  const handProp = new T.Group();
  handProp.name = `Prop_${propKind}`;

  if (propKind === "phone_chat" || propKind === "phone_gold") {
    // No phone in the hand (owner): it read as a floating box on the rigged models. The NPC just stands.
    return { handProp: null };
  }

  if (propKind === "clipboard") {
    // Wooden landlord rent ledger clipboard with clipped paper notice!
    rounded(handProp, [0, -0.05, 0.02], [0.23, 0.31, 0.012], 0.005, material(0x7c4e2a, 0.72));
    rounded(handProp, [0, -0.05, 0.028], [0.2, 0.27, 0.003], 0.002, material(0xf3efe4, 0.85));
    rounded(handProp, [0, 0.095, 0.032], [0.08, 0.026, 0.012], 0.003, material(0x9ca3af, 0.35, 0.75));
    handProp.rotation.set(-0.25, 0.15, 0.05);
    npcRoot.add(handProp);
    return { handProp };
  }

  if (propKind === "portfolio") {
    // Sleek Bitexco HR leather interview portfolio folder
    rounded(handProp, [0, -0.08, 0.01], [0.25, 0.33, 0.028], 0.008, material(0x1f242c, 0.48, 0.12));
    rounded(handProp, [0, -0.08, 0.026], [0.16, 0.025, 0.004], 0.002, material(0xd1b16a, 0.32, 0.75));
    handProp.rotation.set(0.08, 0.2, 0.12);
    npcRoot.add(handProp);
    return { handProp };
  }

  if (propKind === "helmet") {
    // Glossy Saigon motorbike half-helmet held casually at the hip beside his parked Super Cub!
    const shell = new T.Mesh(
      new T.SphereGeometry(0.145, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      material(0x1a3454, 0.22, 0.2),
    );
    shell.position.set(0, -0.08, 0.04);
    shell.rotation.x = Math.PI * 0.45;
    handProp.add(shell);
    const visor = new T.Mesh(
      new T.CylinderGeometry(0.148, 0.148, 0.065, 16, 1, true, -Math.PI * 0.35, Math.PI * 0.7),
      material(0x14181e, 0.15, 0.4),
    );
    visor.position.set(0, -0.1, 0.05);
    visor.rotation.x = Math.PI * 0.45;
    handProp.add(visor);
    npcRoot.add(handProp);
    return { handProp };
  }

  if (propKind === "cafe_laptop") {
    // Minh's open laptop + Vietnamese cà phê sữa đá staged directly on the Lý Thái Tổ café table (`x=4.4, z=-19`)!
    const tableProps = new T.Group();
    tableProps.name = "MinhCafeTableProps";
    tableProps.position.set(4.24, 0.89, -19.02);
    tableProps.rotation.y = -1.25;

    // Open ultrabook laptop
    rounded(tableProps, [0, 0.008, 0], [0.33, 0.012, 0.22], 0.004, material(0xcbd2db, 0.32, 0.75));
    const lid = new T.Group();
    lid.position.set(0, 0.014, -0.105);
    lid.rotation.x = -0.22;
    rounded(lid, [0, 0.105, 0], [0.33, 0.21, 0.008], 0.004, material(0xbfc7d1, 0.32, 0.75));
    const screen = new T.Mesh(
      new T.PlaneGeometry(0.3, 0.185),
      new T.MeshStandardMaterial({
        color: 0xeef3fb,
        emissive: 0xdbeafe,
        emissiveIntensity: 0.55,
        roughness: 0.2,
      }),
    );
    screen.position.set(0, 0.105, 0.005);
    lid.add(screen);
    tableProps.add(lid);

    // Tall Saigon cà phê sữa đá cup + green straw!
    const cup = new T.Mesh(
      new T.CylinderGeometry(0.036, 0.028, 0.125, 14),
      material(0x6b3e1f, 0.25, 0.05),
    );
    cup.position.set(0.24, 0.064, 0.04);
    tableProps.add(cup);
    const milkLayer = new T.Mesh(
      new T.CylinderGeometry(0.031, 0.028, 0.03, 14),
      material(0xe7d6bd, 0.35, 0.02),
    );
    milkLayer.position.set(0.24, 0.016, 0.04);
    tableProps.add(milkLayer);
    const straw = new T.Mesh(
      new T.CylinderGeometry(0.003, 0.003, 0.17, 6),
      material(0x16a34a, 0.45),
    );
    straw.position.set(0.248, 0.095, 0.04);
    straw.rotation.z = -0.16;
    tableProps.add(straw);

    worldGroup.add(tableProps);
    return { handProp: null };
  }

  return { handProp: null };
}

/**
 * Spawns and directs the canonical Chapter 1 (Missions 01–05) Story NPCs physically inside
 * Saigon with verified architectural staging, authentic 3D props, ambient street callouts,
 * GTA-6 human realism, and RDR2-style interactive branching replies.
 */
export function createStoryNpcDirector(
  onAssetLoaded?: (obj: T.Object3D) => void,
  humanPresence?: HumanPresenceSystem,
): StoryNpcDirector {
  const group = new T.Group();
  group.name = "SaigonStoryNPCs";

  let disposed = false;
  let context: StoryNpcRuntimeContext = { ...DEFAULT_CONTEXT };
  let activeDialogue: ActiveStoryNpcDialogue | null = null;
  let activeBark: AmbientStreetBark | null = null;
  let barkExpiresAt = 0;
  let currentTime = 0;
  let lineKeySeq = 1;
  let lineStartedAt = 0;
  let lineDurationSec = 4.0;
  const spawned: SpawnedStoryNpc[] = [];
  const presenceCleanups: (() => void)[] = [];
  const shadowMat = contactMaterial(0.54);
  const _handPos = new T.Vector3();

  const loadAll = async () => {
    let seed = 101;
    for (const profile of OPEN_WORLD_STORY_NPCS) {
      if (disposed || !profile.worldAnchor) return;
      const anchor = profile.worldAnchor;
      const gltf = await loader
        .loadAsync(`/assets/testbus/ow/models/${anchor.modelFile}`)
        .catch(() => null);
      if (!gltf || disposed) continue;
      const clips = await streetClips(anchor.modelFile, gltf.scene, gltf.animations);
      if (disposed) {
        disposeScene(gltf.scene);
        return;
      }

      const obj = cloneSkinned(gltf.scene);
      const box = new T.Box3().setFromObject(obj, true);
      const scale = anchor.height / Math.max(0.1, box.max.y - box.min.y);
      obj.scale.setScalar(scale);
      obj.position.set(
        -((box.max.x + box.min.x) * scale) / 2,
        -box.min.y * scale,
        -((box.max.z + box.min.z) * scale) / 2,
      );
      upgradeHumanMaterials(obj);

      const root = new T.Group();
      root.name = `StoryNPC_${profile.id}`;
      root.position.set(anchor.x, anchor.y, anchor.z);
      root.rotation.y = anchor.yaw;
      root.add(obj);

      // Grounded soft contact shadow ONLY (zero glowing arcade circles on the pavement!).
      const feetShadow = contact(root, 0, 0.012, 0, 0.72, 0.54, shadowMat);
      feetShadow.renderOrder = 1;

      const { handProp } = buildStoryNpcProps(anchor.propKind, root, group);
      const handBone =
        obj.getObjectByName("hand_r") ??
        obj.getObjectByName("mixamorig:RightHand") ??
        obj.getObjectByName("RightHand") ??
        null;

      let mixer: T.AnimationMixer | undefined;
      if (clips.idle) {
        mixer = new T.AnimationMixer(obj);
        const action = mixer.clipAction(clips.idle);
        action.timeScale = 0.85;
        action.time = ((seed * 0.37) % 1) * clips.idle.duration;
        action.play();
      }

      const realism = createHumanRealismRig(root, obj, seed++);
      group.add(root);
      if (humanPresence) {
        presenceCleanups.push(
          humanPresence.register({
            id: `story_${profile.id}`,
            label: profile.name,
            object: root,
            radius: 0.36,
            canSidestep: false,
            onBump: (dx, dz, strength) => realism.triggerBump(dx, dz, strength),
            onPersonalSpace: (closeness) => realism.setPersonalSpace(closeness),
            isConversing: () => activeDialogue?.npcId === profile.id,
          }),
        );
      }
      onAssetLoaded?.(root);

      spawned.push({
        profile,
        root,
        baseYaw: anchor.yaw,
        eyeHeight: anchor.height * 0.89,
        realism,
        mixer,
        handBone,
        handProp,
        lastBarkTime: -999,
      });
    }
  };

  loadAll().catch((err) => console.warn("Story NPC loader warning:", err));

  return {
    group,
    setContext(patch) {
      context = {
        ...context,
        ...patch,
        flags: { ...context.flags, ...(patch.flags ?? {}) },
      };
    },
    update(dt, time, playerPos, rain) {
      currentTime = time;
      if (activeBark && (time >= barkExpiresAt || activeDialogue !== null)) {
        activeBark = null;
      }

      for (const npc of spawned) {
        const dx = playerPos.x - npc.root.position.x;
        const dz = playerPos.z - npc.root.position.z;
        const dist = Math.hypot(dx, dz);
        const visible = dist < 78;
        npc.root.visible = visible;
        if (!visible) continue;

        const isTalkingToPlayer = activeDialogue?.npcId === npc.profile.id;
        // Auto-close conversation naturally if Alex walks away (> 6.5m).
        if (isTalkingToPlayer && dist > 6.5) {
          activeDialogue = null;
        }

        // Trigger organic RDR2/GTA-6 ambient street callout when Alex passes within 7.2m (28s cooldown per NPC).
        if (
          !activeDialogue &&
          !activeBark &&
          dist < 7.2 &&
          dist > 1.8 &&
          time - npc.lastBarkTime > 28
        ) {
          npc.lastBarkTime = time;
          const turn = resolveStoryNpcDialogue(npc.profile.id, context);
          activeBark = {
            npcId: npc.profile.id,
            speaker: turn.speaker,
            text: turn.ambientBark,
            voiceId: turn.ambientVoiceId ?? null,
          };
          barkExpiresAt = time + 4.8;
        }

        // Turn body smoothly toward Alex during conversation or close proximity (< 3.8m).
        const desiredYaw =
          isTalkingToPlayer || dist < 3.6 ? Math.atan2(dx, dz) : npc.baseYaw;
        let diff = desiredYaw - npc.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        npc.root.rotation.y += diff * Math.min(1, dt * (isTalkingToPlayer ? 6.8 : 3.2));

        npc.mixer?.update(dt);

        const slot = resolveNpcSchedule(npc.profile.id, context.elapsedMinutes);
        const isBarkingNow = activeBark?.npcId === npc.profile.id;
        const speechElapsed = time - lineStartedAt;
        const isActivelySpeaking =
          (isTalkingToPlayer && speechElapsed < lineDurationSec) || isBarkingNow;
        const speechIntensity = isActivelySpeaking
          ? 0.55 + 0.4 * Math.abs(Math.sin(time * 6.8))
          : 0;
        const activity: HumanActivity = isActivelySpeaking
          ? "talking"
          : isTalkingToPlayer
            ? "listening"
            : (slot?.activity ?? "idle");

        npc.realism.update({
          dt,
          time,
          playerPos,
          focusPoint: isTalkingToPlayer || isBarkingNow || dist < 7.2 ? playerPos : null,
          moveSpeed: 0,
          activity,
          rain,
          hasActiveMixer: Boolean(npc.mixer),
          speechIntensity,
          holdingProp: Boolean(npc.handProp),
        });

        // Update hand prop AFTER realism raises the right forearm so clipboard/phone/helmet sits in hand!
        if (npc.handProp && npc.handBone) {
          npc.root.updateMatrixWorld(true);
          npc.root.worldToLocal(npc.handBone.getWorldPosition(_handPos));
          npc.handProp.position.copy(_handPos);
        }
      }
    },
    nearestInteractable(playerPos, maxDistance = 3.5) {
      let best: StoryNpcInteractionTarget | null = null;
      for (const npc of spawned) {
        if (!npc.root.visible) continue;
        const d = Math.hypot(
          playerPos.x - npc.root.position.x,
          playerPos.z - npc.root.position.z,
        );
        if (d <= maxDistance && (!best || d < best.distance)) {
          best = { npc: npc.profile, distance: d };
        }
      }
      return best;
    },
    beginDialogue(npcId) {
      activeBark = null;
      const turn = resolveStoryNpcDialogue(npcId, context);
      const firstLine = turn.lines[0] ?? turn.ambientBark;
      lineStartedAt = currentTime;
      lineDurationSec = Math.max(2.6, Math.min(6.0, firstLine.vi.length * 0.042));
      activeDialogue = {
        npcId,
        turn,
        currentText: firstLine,
        currentVoiceId: turn.openingVoiceId ?? null,
        lastPlayerReply: null,
        currentMood: turn.mood,
        activeInsight: turn.hookNote ?? null,
        askedReplyIds: [],
        closing: false,
        lineKey: lineKeySeq++,
      };
      return activeDialogue;
    },
    selectReply(index) {
      if (!activeDialogue) return null;
      const reply = activeDialogue.turn.replies[index];
      if (!reply) return activeDialogue;
      const asked = activeDialogue.askedReplyIds.includes(reply.id)
        ? activeDialogue.askedReplyIds
        : [...activeDialogue.askedReplyIds, reply.id];
      lineStartedAt = currentTime;
      lineDurationSec = Math.max(2.6, Math.min(6.0, reply.response.vi.length * 0.042));
      activeDialogue = {
        ...activeDialogue,
        currentText: reply.response,
        currentVoiceId: reply.voiceId ?? null,
        lastPlayerReply: reply.label,
        currentMood: reply.nextMood,
        activeInsight: reply.insight ?? activeDialogue.activeInsight,
        askedReplyIds: asked,
        closing: reply.tone === "leave",
        lineKey: lineKeySeq++,
      };
      return activeDialogue;
    },
    advanceDialogue() {
      if (!activeDialogue) return null;
      if (activeDialogue.closing || activeDialogue.turn.replies.length === 0) {
        activeDialogue = null;
        return null;
      }
      // Pressing [E] again picks the next unasked reply or wraps cleanly if all asked.
      const nextIdx = activeDialogue.turn.replies.findIndex(
        (r) => !activeDialogue!.askedReplyIds.includes(r.id),
      );
      if (nextIdx === -1) {
        activeDialogue = null;
        return null;
      }
      return this.selectReply(nextIdx);
    },
    refreshDialogue() {
      if (!activeDialogue) return null;
      const turn = resolveStoryNpcDialogue(activeDialogue.npcId, context);
      activeDialogue = { ...activeDialogue, turn };
      return activeDialogue;
    },
    closeDialogue() {
      activeDialogue = null;
    },
    getActiveDialogue() {
      return activeDialogue;
    },
    getAmbientBark() {
      return activeBark;
    },
    getConversationEyePos(out) {
      if (!activeDialogue) return false;
      const target = spawned.find((n) => n.profile.id === activeDialogue!.npcId);
      if (!target) return false;
      out.set(
        target.root.position.x,
        target.root.position.y + target.eyeHeight,
        target.root.position.z,
      );
      return true;
    },
    getRadarBlips() {
      const out: StoryNpcRadarBlip[] = [];
      for (const npc of spawned) {
        if (!npc.root.visible) continue;
        out.push({
          id: npc.profile.id,
          x: Number(npc.root.position.x.toFixed(1)),
          z: Number(npc.root.position.z.toFixed(1)),
        });
      }
      return out;
    },
    dispose() {
      disposed = true;
      for (const cleanup of presenceCleanups) cleanup();
      presenceCleanups.length = 0;
      for (const npc of spawned) {
        disposeScene(npc.root);
      }
      spawned.length = 0;
    },
  };
}

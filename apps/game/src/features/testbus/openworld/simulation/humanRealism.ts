import * as T from "three";
import { warmSkin } from "./drive-look";

/**
 * GTA-6 / Cyberpunk-grade procedural human realism layer for EVERY living character in Saigon.
 *
 * Combines:
 * - Hierarchical Head → Neck → Spine look-at chain with exponential `softClamp` & stop-angle relaxation.
 * - Organic breathing, weight-shift sway, saccadic street glances, and double-blink cadence.
 * - Physical shoulder-bump stagger, defensive forearm lift, torso twist, and glare-back recovery.
 * - Personal-space lean-back when crowded by the player.
 * - Live speech-synced jaw/mouth viseme articulation + asymmetric conversational hand beat-gestures.
 * - Contextual everyday poses (checking phone, shielding eyes in Saigon rain, chatting, waiting for bus).
 * - Grounded radial soft ambient-occlusion contact shadow beneath shoes so no human looks pasted on.
 */

export type HumanActivity =
  | "idle"
  | "walking"
  | "talking"
  | "listening"
  | "phone"
  | "waiting_bus"
  | "seated"
  | "crossing";

export interface HumanRealismUpdate {
  dt: number;
  time: number;
  /** World-space position of the player camera / Alex. */
  playerPos: T.Vector3;
  /** Optional explicit interest point (conversation partner, approaching bus, crosswalk, etc.). */
  focusPoint?: T.Vector3 | null;
  /** Current ground movement speed (m/s). */
  moveSpeed?: number;
  /** Behavioral activity preset. */
  activity?: HumanActivity;
  /** Current Saigon rain intensity (0 = dry, 1 = monsoon). */
  rain?: number;
  /** Whether an animation mixer updated bones just before this call. */
  hasActiveMixer?: boolean;
  /** Live speech syllable energy (0..1) synced with active dialogue reveal for lip-sync & hand beats. */
  speechIntensity?: number;
  /** True when the NPC holds a handheld prop (clipboard, phone, helmet) so right forearm raises naturally. */
  holdingProp?: boolean;
}

export interface HumanRealismRig {
  update(params: HumanRealismUpdate): void;
  /** Trigger physical shoulder-bump stagger & glare reaction in world direction `(worldDirX, worldDirZ)`. */
  triggerBump(worldDirX: number, worldDirZ: number, strength?: number): void;
  /** Feed player crowding intensity (0..1) when Alex lingers inside personal space (< 1.15m). */
  setPersonalSpace(closeness: number): void;
  /** True if the rig resolved at least a head or spine bone. */
  readonly hasSkeleton: boolean;
}

/**
 * Exponential soft-clamp: linear up to `softStart * limit`, then smoothly asymptotic so joints
 * never hit a robotic hard stop.
 */
export function softClamp(angle: number, limit: number, softStart = 0.7): number {
  const mag = Math.abs(angle);
  const knee = limit * softStart;
  if (mag <= knee) return angle;
  const range = limit - knee;
  if (range <= 1e-5) return angle < 0 ? -limit : limit;
  const clamped = knee + range * (1 - Math.exp(-(mag - knee) / range));
  return angle < 0 ? -clamped : clamped;
}

let sharedContactShadowTex: T.CanvasTexture | null = null;
let sharedContactShadowGeo: T.PlaneGeometry | null = null;

function getContactShadowTexture(): T.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (sharedContactShadowTex) return sharedContactShadowTex;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
  g.addColorStop(0, "rgba(10, 12, 18, 0.56)");
  g.addColorStop(0.5, "rgba(10, 12, 18, 0.24)");
  g.addColorStop(1, "rgba(10, 12, 18, 0.0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  sharedContactShadowTex = new T.CanvasTexture(canvas);
  sharedContactShadowTex.needsUpdate = true;
  return sharedContactShadowTex;
}

/** Attach a subtle, grounded AO shadow disc right under a character's shoes (no floating cutouts!). */
export function attachContactShadow(root: T.Object3D, radius = 0.44): void {
  if (root.userData.__hasContactShadow) return;
  const tex = getContactShadowTexture();
  if (!tex) return;
  if (!sharedContactShadowGeo) {
    sharedContactShadowGeo = new T.PlaneGeometry(1, 1);
    sharedContactShadowGeo.rotateX(-Math.PI / 2);
  }
  const mat = new T.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const disc = new T.Mesh(sharedContactShadowGeo, mat);
  disc.name = "__human_contact_shadow";
  disc.scale.set(radius * 2, 1, radius * 2);
  disc.position.y = 0.014;
  disc.renderOrder = 1;
  root.add(disc);
  root.userData.__hasContactShadow = true;
}

/**
 * Upgrade PBR human materials across ALL character GLBs so none look like plastic or metallic statues.
 * Fixes known asset quirks (e.g. `juno3` / `rowan` / `taixe` metallic=1.00 baked materials, glossy skin, flat cloth).
 */
export function upgradeHumanMaterials(root: T.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof T.Mesh)) return;
    if (node.name === "__human_contact_shadow") return;
    node.castShadow = true;
    node.receiveShadow = true;
    const meshName = (node.name || "").toLowerCase();
    const mats = Array.isArray(node.material) ? node.material : [node.material];

    for (const mat of mats) {
      if (!(mat instanceof T.MeshStandardMaterial)) continue;
      const matName = (mat.name || "").toLowerCase();
      const combined = `${meshName} ${matName}`;

      if (mat.metalness > 0.85 && !/buckle|watch|ring|metal|zip|button|glass|frame|jewelry/i.test(combined)) {
        mat.metalness = 0.02;
        mat.roughness = Math.min(Math.max(mat.roughness, 0.68), 0.84);
        mat.envMapIntensity = 0.68;
      }

      if (/humanbody|skin|face|head|body/i.test(combined) && !/cloth|shirt|pant|shoe|hair|eye/i.test(combined)) {
        warmSkin(mat);
        mat.roughness = T.MathUtils.clamp(mat.roughness, 0.52, 0.66);
        mat.metalness = 0.0;
        mat.envMapIntensity = 0.74;
      } else if (/eye|cornea|iris/i.test(combined)) {
        mat.roughness = 0.14;
        mat.metalness = 0.0;
        mat.envMapIntensity = 1.35;
      } else if (/hair|brow|lash/i.test(combined)) {
        mat.roughness = 0.56;
        mat.metalness = 0.04;
        mat.envMapIntensity = 0.82;
      } else if (/shoe|boot|leather|bag|belt/i.test(combined)) {
        mat.roughness = T.MathUtils.clamp(mat.roughness, 0.44, 0.62);
        mat.metalness = Math.min(mat.metalness, 0.08);
        mat.envMapIntensity = 0.85;
      } else if (/baked|vendorscan|material\.001/i.test(combined)) {
        mat.metalness = 0.02;
        mat.roughness = 0.76;
        mat.envMapIntensity = 0.7;
      } else if (mat.metalness < 0.2) {
        // Lift pitch-black crushed cloth/suit albedos (e.g. npc-arthur dark suit in shaded courtyards)
        // to realistic tailored charcoal so fabric folds & shoulders read naturally under AgX.
        const lum = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114;
        if (lum < 0.055 && !mat.map) {
          mat.color.setRGB(
            Math.max(mat.color.r, 0.095),
            Math.max(mat.color.g, 0.1),
            Math.max(mat.color.b, 0.115),
          );
        } else if (mat.map) {
          mat.envMapIntensity = Math.max(mat.envMapIntensity || 0.9, 1.08);
        }
        mat.roughness = Math.max(mat.roughness, 0.72);
        mat.envMapIntensity = Math.min(Math.max(mat.envMapIntensity || 0.85, 0.86), 1.12);
      }
    }
  });
}

function findBone(root: T.Object3D, patterns: RegExp[]): T.Object3D | null {
  let found: T.Object3D | null = null;
  for (const re of patterns) {
    root.traverse((o) => {
      if (found) return;
      if (re.test(o.name)) found = o;
    });
    if (found) return found;
  }
  return null;
}

const _axisX = new T.Vector3(1, 0, 0);
const _axisY = new T.Vector3(0, 1, 0);
const _axisZ = new T.Vector3(0, 0, 1);
const _worldPos = new T.Vector3();
const _worldQuat = new T.Quaternion();
const _invQuat = new T.Quaternion();
const _toTarget = new T.Vector3();
const _localBump = new T.Vector3();
const _qYaw = new T.Quaternion();
const _qPitch = new T.Quaternion();
const _qRoll = new T.Quaternion();
const _qDelta = new T.Quaternion();

/**
 * Create a per-character procedural realism controller that layers directly on top of
 * any GLB rig (Unreal `npc-*`, Mixamo `juno3`/`rowan`, or custom `banhmi-vendor`/`taixe`).
 */
export function createHumanRealismRig(
  root: T.Object3D,
  modelObj: T.Object3D,
  seed = 1,
): HumanRealismRig {
  // Ground every living human with a soft contact shadow under their shoes.
  attachContactShadow(root, 0.42);

  const head = findBone(modelObj, [/^head$/i, /^mixamorig:head$/i, /^head_01$/i]);
  const neck = findBone(modelObj, [/^neck_01$/i, /^neck$/i, /^mixamorig:neck$/i]);
  const spineUpper = findBone(modelObj, [/^spine_03$/i, /^chest$/i, /^mixamorig:spine2$/i, /^spine1$/i]);
  const spineMid = findBone(modelObj, [/^spine_02$/i, /^spine_01$/i, /^mixamorig:spine1$/i, /^spine$/i]);
  const armL = findBone(modelObj, [/^upperarm_l$/i, /^mixamorig:leftarm$/i, /^leftarm$/i, /^shoulder-1$/i]);
  const armR = findBone(modelObj, [/^upperarm_r$/i, /^mixamorig:rightarm$/i, /^rightarm$/i, /^shoulder1$/i]);
  const forearmL = findBone(modelObj, [/^lowerarm_l$/i, /^mixamorig:leftforearm$/i, /^leftforearm$/i]);
  const forearmR = findBone(modelObj, [/^lowerarm_r$/i, /^mixamorig:rightforearm$/i, /^rightforearm$/i]);
  const jaw = findBone(modelObj, [/^jaw$/i, /^mixamorig:jaw$/i, /^cc_base_jawroot$/i]);

  const restHead = head?.quaternion.clone() ?? null;
  const restNeck = neck?.quaternion.clone() ?? null;
  const restSpineUpper = spineUpper?.quaternion.clone() ?? null;
  const restSpineMid = spineMid?.quaternion.clone() ?? null;
  const restArmL = armL?.quaternion.clone() ?? null;
  const restArmR = armR?.quaternion.clone() ?? null;
  const restForearmL = forearmL?.quaternion.clone() ?? null;
  const restForearmR = forearmR?.quaternion.clone() ?? null;
  const restJaw = jaw?.quaternion.clone() ?? null;

  // Detect facial morph targets for blinking + mouth lip-sync (juno3, rowan, etc.).
  const blinkMeshes: { mesh: T.Mesh; index: number }[] = [];
  const mouthMeshes: { mesh: T.Mesh; index: number }[] = [];
  modelObj.traverse((o) => {
    if (o instanceof T.Mesh && o.morphTargetInfluences && o.morphTargetInfluences.length > 0) {
      const dict = o.morphTargetDictionary;
      let blinkIdx = 0;
      let mouthIdx = -1;
      if (dict) {
        const bMatch = Object.entries(dict).find(([k]) => /blink|eye.*close/i.test(k));
        if (bMatch) blinkIdx = bMatch[1];
        const mMatch = Object.entries(dict).find(([k]) => /jaw|mouth|open|viseme|talk|ah|aa/i.test(k));
        if (mMatch) mouthIdx = mMatch[1];
        else if (o.morphTargetInfluences.length > 1) mouthIdx = 1;
      }
      blinkMeshes.push({ mesh: o, index: blinkIdx });
      if (mouthIdx >= 0 && mouthIdx !== blinkIdx) {
        mouthMeshes.push({ mesh: o, index: mouthIdx });
      }
    }
  });

  // Unique biological rhythms per person so crowds never sync up like robots.
  const phase = seed * 2.39996;
  const breathRate = 0.22 + ((seed * 17) % 10) * 0.0068;
  const swayRate = 0.12 + ((seed * 23) % 7) * 0.011;

  // Hierarchical LookAnimator spring state
  let headYaw = 0;
  let headPitch = 0;
  let neckYaw = 0;
  let neckPitch = 0;
  let spineYaw = 0;
  let spinePitch = 0;
  let lookWeight = 0;

  // Saccadic street curiosity
  let nextSaccadeAt = 1.4 + (seed % 5) * 0.65;
  let saccadeYaw = 0;
  let saccadePitch = 0;

  // Organic blinking (with occasional realistic double-blink!)
  let nextBlinkAt = 2.0 + (seed % 4) * 0.85;
  let blinkElapsed = 1.0;

  // Physical bump recoil & glare state (GTA 6 / Cyberpunk shoulder-bump!)
  let bumpRecoil = 0;
  let bumpLocalX = 0;
  let bumpLocalZ = 0;
  let glareTimer = 0;

  // Personal-space lean-back (smoothed 0..1)
  let personalSpaceTarget = 0;
  let personalSpaceSmooth = 0;

  // Smoothed speech lip-sync & gesture envelope
  let speechEnv = 0;

  const hasSkeleton = Boolean(head || neck || spineUpper || spineMid);

  const applyBoneLayer = (
    bone: T.Object3D | null,
    rest: T.Quaternion | null,
    hasActiveMixer: boolean,
    yaw: number,
    pitch: number,
    roll: number,
  ) => {
    if (!bone) return;
    if (!hasActiveMixer && rest) bone.quaternion.copy(rest);
    if (Math.abs(yaw) < 1e-4 && Math.abs(pitch) < 1e-4 && Math.abs(roll) < 1e-4) return;
    _qYaw.setFromAxisAngle(_axisY, yaw);
    _qPitch.setFromAxisAngle(_axisX, pitch);
    _qRoll.setFromAxisAngle(_axisZ, roll);
    _qDelta.copy(_qYaw).multiply(_qPitch).multiply(_qRoll);
    bone.quaternion.multiply(_qDelta);
  };

  return {
    hasSkeleton,

    triggerBump(worldDirX: number, worldDirZ: number, strength = 0.85) {
      root.getWorldQuaternion(_worldQuat);
      _invQuat.copy(_worldQuat).invert();
      _localBump.set(worldDirX, 0, worldDirZ).normalize().applyQuaternion(_invQuat);
      bumpLocalX = _localBump.x;
      bumpLocalZ = _localBump.z;
      bumpRecoil = Math.min(1.4, Math.max(bumpRecoil, strength));
      glareTimer = 2.4;
    },

    setPersonalSpace(closeness: number) {
      personalSpaceTarget = Math.max(personalSpaceTarget, T.MathUtils.clamp(closeness, 0, 1));
    },

    update({
      dt,
      time,
      playerPos,
      focusPoint = null,
      moveSpeed = 0,
      activity = "idle",
      rain = 0,
      hasActiveMixer = false,
      speechIntensity = 0,
      holdingProp = false,
    }) {
      if (!hasSkeleton) return;
      const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

      // Decay physical bump recoil, glare timer, and personal-space discomfort cleanly.
      bumpRecoil = T.MathUtils.damp(bumpRecoil, 0, 5.2, safeDt);
      glareTimer = Math.max(0, glareTimer - safeDt);
      personalSpaceSmooth = T.MathUtils.damp(personalSpaceSmooth, personalSpaceTarget, 4.5, safeDt);
      personalSpaceTarget = 0;

      // Smooth speech syllable energy (auto-pulsed during "talking" even if caller leaves speechIntensity=0).
      const targetSpeech =
        speechIntensity > 0.01
          ? speechIntensity
          : activity === "talking"
            ? 0.45 + 0.4 * Math.max(0, Math.sin(time * 7.2 + phase) * Math.sin(time * 2.1 + phase))
            : 0;
      speechEnv = T.MathUtils.damp(speechEnv, targetSpeech, 11, safeDt);

      // 1. Periodic organic eye/head saccade (ambient environmental curiosity).
      if (time >= nextSaccadeAt) {
        const h1 = Math.sin(time * 12.9898 + seed * 78.233) * 43758.5453;
        const r1 = h1 - Math.floor(h1);
        const h2 = Math.sin(time * 39.346 + seed * 11.135) * 24634.6345;
        const r2 = h2 - Math.floor(h2);
        nextSaccadeAt = time + 2.1 + r1 * 3.1;
        saccadeYaw = (r1 - 0.5) * (activity === "waiting_bus" ? 0.58 : 0.36);
        saccadePitch = (r2 - 0.45) * 0.14;
      }

      // 2. Choose look target: bumped glare > explicit focus > nearby player Alex (< 8.5m) > organic glance.
      root.getWorldPosition(_worldPos);
      root.getWorldQuaternion(_worldQuat);
      const eyeY = _worldPos.y + (activity === "seated" ? 1.15 : 1.56);
      const distToPlayer = _worldPos.distanceTo(playerPos);

      let desiredYaw = saccadeYaw;
      let desiredPitch = saccadePitch;
      let targetActiveWeight = 0.55;

      const activeTarget =
        glareTimer > 0
          ? playerPos
          : (focusPoint ?? (distToPlayer < 8.5 && distToPlayer > 0.55 ? playerPos : null));

      if (activeTarget) {
        _toTarget.set(
          activeTarget.x - _worldPos.x,
          (activeTarget === playerPos ? activeTarget.y - 0.08 : activeTarget.y) - eyeY,
          activeTarget.z - _worldPos.z,
        );
        _invQuat.copy(_worldQuat).invert();
        _toTarget.applyQuaternion(_invQuat);

        const horiz = Math.hypot(_toTarget.x, _toTarget.z);
        if (horiz > 0.15) {
          const rawYaw = Math.atan2(_toTarget.x, _toTarget.z);
          const rawPitch = Math.atan2(-_toTarget.y, horiz);
          const absYaw = Math.abs(rawYaw);
          if (absYaw < 2.12 || glareTimer > 0) {
            const fade = absYaw > 1.55 ? 1 - Math.min(1, (absYaw - 1.55) / 0.57) : 1;
            const distFade =
              focusPoint != null || glareTimer > 0
                ? 1
                : T.MathUtils.clamp(1 - (distToPlayer - 3.2) / 5.3, 0.28, 1);
            targetActiveWeight = glareTimer > 0 ? Math.max(0.85, fade) : fade * distFade;
            desiredYaw = rawYaw + saccadeYaw * 0.16;
            desiredPitch = rawPitch + saccadePitch * 0.14;
          } else {
            targetActiveWeight = 0.24;
          }
        }
      }

      // Activity gaze modifiers (phone glance down with natural double-take when Alex passes close!)
      if (activity === "phone" && glareTimer <= 0) {
        const doubleTake = distToPlayer < 4.2 ? 0.72 : 0;
        desiredPitch += 0.28 * (1 - doubleTake);
        desiredYaw *= 0.45 + doubleTake * 0.45;
      } else if (activity === "crossing") {
        desiredYaw += Math.sin(time * 1.55 + phase) * 0.44;
      } else if (activity === "waiting_bus") {
        desiredYaw += 0.25 * Math.sin(time * 0.55 + phase);
      }

      // Hierarchical LookAnimator spring distribution (snappier when glaring after bump!)
      const snapSpeed = glareTimer > 0 ? 13.5 : 9.4;
      lookWeight = T.MathUtils.damp(lookWeight, targetActiveWeight, 5.2, safeDt);
      const clampedTotalYaw = softClamp(desiredYaw, 1.18) * lookWeight;
      const clampedTotalPitch = softClamp(desiredPitch, 0.46) * lookWeight;

      headYaw = T.MathUtils.damp(headYaw, softClamp(clampedTotalYaw * 0.56, 0.8), snapSpeed, safeDt);
      headPitch = T.MathUtils.damp(headPitch, softClamp(clampedTotalPitch * 0.62, 0.38), snapSpeed * 0.95, safeDt);
      neckYaw = T.MathUtils.damp(neckYaw, softClamp(clampedTotalYaw * 0.26, 0.36), 6.2, safeDt);
      neckPitch = T.MathUtils.damp(neckPitch, softClamp(clampedTotalPitch * 0.24, 0.16), 5.8, safeDt);
      spineYaw = T.MathUtils.damp(spineYaw, softClamp(clampedTotalYaw * 0.18, 0.24), 3.6, safeDt);
      spinePitch = T.MathUtils.damp(spinePitch, softClamp(clampedTotalPitch * 0.14, 0.11), 3.4, safeDt);

      // 3. Organic Breathing + Idle Weight Shift + Physical Bump Recoil + Personal Space + Speech Acting.
      const exertion = T.MathUtils.clamp(moveSpeed / 1.5, 0, 1);
      const breathFreq = (breathRate + exertion * 0.14) * Math.PI * 2;
      const breathWave = Math.sin(time * breathFreq + phase) + 0.18 * Math.sin(time * breathFreq * 2 + phase);
      const breathAmp = 0.024 + exertion * 0.015;

      const isStanding = moveSpeed < 0.12 && activity !== "seated";
      const idleSwayRoll = isStanding ? Math.sin(time * swayRate * Math.PI * 2 + phase) * 0.032 : 0;
      const idleSwayYaw = isStanding ? Math.sin(time * swayRate * Math.PI * 1.4 + phase + 1.1) * 0.038 : 0;

      // Physical shoulder-bump stagger: torso pitches & twists away from impact, rolls laterally!
      const recoilPitch = bumpRecoil * (0.22 * bumpLocalZ - 0.12);
      const recoilRoll = -bumpRecoil * bumpLocalX * 0.26;
      const recoilTwist = bumpRecoil * bumpLocalX * 0.24;

      // Personal-space discomfort: subtle lean-back away from Alex
      const spaceLeanBack = -personalSpaceSmooth * 0.085;

      // Saigon rain reflex: hunch shoulders & raise left forearm to shield brow
      const rainLevel = T.MathUtils.clamp(rain, 0, 1);
      const rainHunch = rainLevel * 0.09;

      // Live conversational acting synced to `speechEnv`!
      let nodPitch = 0;
      let headTiltRoll = Math.sin(time * 0.47 + phase) * 0.026;
      let talkGestureR = 0;
      let talkGestureL = 0;
      if (activity === "talking") {
        const beatA = Math.sin(time * 3.1 + phase);
        const beatB = Math.sin(time * 1.85 + phase + 1.4);
        nodPitch = (beatA * 0.055 + Math.sin(time * 7.5 + phase) * 0.016) * (0.35 + speechEnv * 0.85);
        headTiltRoll += beatB * 0.048 * (0.4 + speechEnv * 0.7);
        talkGestureR = (0.14 + beatA * 0.14) * (0.35 + speechEnv * 0.85);
        talkGestureL = (0.08 + beatB * 0.11) * (0.25 + speechEnv * 0.7);
      } else if (activity === "listening") {
        nodPitch = Math.max(0, Math.sin(time * 0.95 + phase) - 0.5) * 0.16 * Math.sin(time * 4.4);
        headTiltRoll += 0.045;
      }

      applyBoneLayer(
        spineMid,
        restSpineMid,
        hasActiveMixer,
        idleSwayYaw * 0.6 + recoilTwist * 0.5,
        breathWave * breathAmp * 0.45 + rainHunch * 0.65 + recoilPitch * 0.6 + spaceLeanBack * 0.6,
        idleSwayRoll + recoilRoll * 0.6,
      );
      applyBoneLayer(
        spineUpper,
        restSpineUpper,
        hasActiveMixer,
        spineYaw + idleSwayYaw * 0.4 + recoilTwist * 0.5,
        spinePitch + breathWave * breathAmp + rainHunch * 0.35 + recoilPitch * 0.4 + spaceLeanBack * 0.4,
        -idleSwayRoll * 0.45 + recoilRoll * 0.4,
      );
      applyBoneLayer(neck, restNeck, hasActiveMixer, neckYaw, neckPitch + nodPitch * 0.35, 0);
      applyBoneLayer(
        head,
        restHead,
        hasActiveMixer,
        headYaw,
        headPitch + nodPitch - rainHunch * 0.38 - recoilPitch * 0.3,
        headTiltRoll - recoilRoll * 0.35,
      );

      // Bilateral arm & forearm natural acting — layered ADDITIVELY even when an idle/walk AnimationMixer plays!
      // Eliminates stiff mannequin A-pose arms during conversation, prop holding, rain, and shoulder bumps.
      const defensiveLift = bumpRecoil * 0.42 + personalSpaceSmooth * 0.1;
      const isWalkingFast = moveSpeed > 0.25;
      const armScale = isWalkingFast ? 0.35 : 1.0;
      const shoulderBreath = breathWave * 0.024;
      const phoneRaise = activity === "phone" ? 0.36 : 0;
      const propRaise = holdingProp ? 0.44 : 0;
      const rainShieldL = rainLevel > 0.25 && activity !== "talking" ? rainLevel * 0.36 : 0;

      // Expressive chest-height conversational gesture posture when talking or listening
      const talkArmLiftR = activity === "talking" ? (0.34 + talkGestureR * 0.95) : activity === "listening" ? 0.14 : 0;
      const talkArmLiftL = activity === "talking" ? (0.24 + talkGestureL * 0.85) : activity === "listening" ? 0.12 : 0;

      const rightUpperPitch =
        (rainHunch * 0.35 + Math.max(talkArmLiftR, phoneRaise, propRaise) * 0.62 + defensiveLift * 0.55) * armScale;
      const rightForearmPitch =
        -(Math.max(talkArmLiftR * 1.15, phoneRaise * 1.25, propRaise * 1.35) + defensiveLift * 0.8) * armScale;

      const leftUpperPitch =
        (rainHunch * 0.35 + talkArmLiftL * 0.58 + defensiveLift * 0.55 + rainShieldL * 0.55) * armScale;
      const leftForearmPitch =
        -(talkArmLiftL * 1.05 + defensiveLift * 0.75 + rainShieldL * 0.9) * armScale;

      // Apply additive bone offsets cleanly (works BOTH with and without an active AnimationMixer!)
      applyBoneLayer(
        armL,
        restArmL,
        hasActiveMixer,
        talkArmLiftL * 0.18,
        leftUpperPitch,
        shoulderBreath + defensiveLift * 0.18,
      );
      applyBoneLayer(forearmL, restForearmL, hasActiveMixer, 0, leftForearmPitch, 0);
      applyBoneLayer(
        armR,
        restArmR,
        hasActiveMixer,
        -talkArmLiftR * 0.18,
        rightUpperPitch,
        -shoulderBreath - defensiveLift * 0.18,
      );
      applyBoneLayer(forearmR, restForearmR, hasActiveMixer, 0, rightForearmPitch, 0);

      // Skeletal jaw articulation during speech (for rigs with jaw bone)
      if (jaw && speechEnv > 0.02) {
        const jawOpen = speechEnv * (0.08 + 0.06 * Math.abs(Math.sin(time * 11.5 + phase)));
        applyBoneLayer(jaw, restJaw, hasActiveMixer, 0, jawOpen, 0);
      }

      // 4. Natural eyelid blinking + live mouth viseme lip-sync on morph-equipped characters!
      if (blinkMeshes.length > 0) {
        if (time >= nextBlinkAt) {
          blinkElapsed = 0;
          const h = Math.sin(time * 91.7 + seed * 37.1) * 14321.5;
          const r = h - Math.floor(h);
          // 18% chance of quick natural double-blink!
          nextBlinkAt = time + (r < 0.18 ? 0.32 : 2.5 + r * 3.2);
        }
        blinkElapsed += safeDt;
        const blinkDur = 0.15;
        const blinkVal =
          blinkElapsed < blinkDur ? Math.sin((blinkElapsed / blinkDur) * Math.PI) : 0;
        for (const bm of blinkMeshes) {
          bm.mesh.morphTargetInfluences![bm.index] = blinkVal;
        }
      }
      if (mouthMeshes.length > 0) {
        const mouthVal =
          speechEnv > 0.02
            ? T.MathUtils.clamp(
                speechEnv * (0.28 + 0.42 * Math.abs(Math.sin(time * 10.5 + phase))),
                0,
                0.78,
              )
            : 0;
        for (const mm of mouthMeshes) {
          mm.mesh.morphTargetInfluences![mm.index] = mouthVal;
        }
      }
    },
  };
}

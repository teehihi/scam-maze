import * as THREE from 'three';
import { CharacterAssetCache } from './CharacterAssetCache';
import { createTypingClock, isTypingMoving, stepTypingClock, typingKey, wrapTypingTime, type TypingClock } from './typingClock';

/**
 * Where the arms sit while typing (camera space): the hands low and forward, over the keys of the
 * laptop seen in its inspect pose (the camera looks down at the keyboard from above and behind).
 */
export const TYPING_POSE: Readonly<{ y: number; z: number }> = { y: -1.17, z: -0.04 };
/** How fast the arms move into the typing pose (1/s). */
const TYPING_BLEND_SPEED = 14;
/** The hands leave the keys after this long without a keystroke. */
const TYPING_IDLE_MS = 3500;
/** Size (camera-space units) and speed of the short hand dip for Space, Enter and Backspace. */
const TYPING_PRESS_DEPTH = 0.006;
const TYPING_PRESS_DECAY = 6;
/** Resting distance of the arms in front of the camera (the constructor's z). */
const REST_Z = 0.06;
/** Orientation and size of the arms in camera space (the constructor's values). */
const REST_PITCH = -0.05;
const REST_SCALE = 0.72;

/**
 * Hands resting on a real keyboard: the arms are placed in the keyboard object's local space instead
 * of camera space, so they stay on the keys whatever the camera or the scene transform does.
 */
export interface KeyboardAnchor {
  /** The keyboard (or laptop) object. Every value below is in its local space. */
  object: THREE.Object3D;
  /** Where the midpoint of the two wrists goes. */
  wrists: THREE.Vector3;
  /**
   * Rig orientation, radians: pitch (about x, negative tips the forearms down), yaw (about y) and roll
   * (about z, negative lowers the right hand). The rig's own pose is not symmetric, so roll levels it.
   */
  pitch: number;
  yaw: number;
  roll: number;
  /** Uniform scale of the rig while anchored. */
  scale: number;
  /**
   * Extra wrist rotation per hand, about the object's axes (radians). `out` turns the fingers away
   * from the centre, `down` lowers the fingertips. The typing clip still plays on top of it.
   */
  wristL: { out: number; down: number };
  wristR: { out: number; down: number };
  /** Depth of the short press dip for Space, Enter and Backspace (local units). */
  pressDepth: number;
  /**
   * The fingertip bones (their centres) never go below this height: when the clip curls a finger
   * lower, that wrist bends up by what is missing and settles back slowly, so no finger enters the keys.
   */
  tipFloorY: number;
}

/** Most a wrist bends up to keep its fingers out of the keys (radians), and how fast it settles back (rad/s). */
const TIP_RAISE_MAX = 0.6;
const TIP_RAISE_RELEASE = 1.5;

export class CharacterArmsViewmodel {
  public group: THREE.Group;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<string, THREE.AnimationAction> = {};
  private isLoaded = false;

  private currentY = -1.55;
  private targetY = -1.55;
  private combatReadyUntil = 0;
  private punchHand: 'R' | 'L' = 'R';

  private currentLocomotion: THREE.AnimationAction | null = null;
  private currentPunch: THREE.AnimationAction | null = null;

  private isPunching = false;
  private isBlocking = false;
  private isInteracting = false;
  private isInspecting = false;
  private wasHandsActive = false;

  private unequipTimer: number | null = null;
  private punchTimer: number | null = null;
  private interactTimer: number | null = null;
  private inspectTimer: number | null = null;
  // Typing: the hands rest on the keys and each keystroke plays the next bit of the typing clip.
  private typingWanted = false;
  private typingAction: THREE.AnimationAction | null = null;
  private typingBase: THREE.AnimationAction | null = null;
  private typingClock: TypingClock = createTypingClock();
  private typingLoading = false;
  private typingPlaying = false;
  private typingLastKeyMs = 0;
  private typingHold = false;
  /** 1 right after a Space, Enter or Backspace press, falling to 0. */
  private typingPress = 0;
  /** The typing pose of this viewmodel (a host with another camera framing can move it). */
  public typingPose: { y: number; z: number } = { ...TYPING_POSE };
  /** See `setKeyboardAnchor`. Public so a debug session can tune the values live. */
  public keyboardAnchor: KeyboardAnchor | null = null;
  /** 0..1: how far the arms have moved from the camera pose to the anchored pose. */
  private anchorBlend = 0;
  /** Extra upward wrist bend per hand (radians) that keeps the fingertips above the keys, see `KeyboardAnchor.tipFloorY`. */
  public tipRaise = { L: 0, R: 0 };
  private fingertips: { L: THREE.Object3D[]; R: THREE.Object3D[] } = { L: [], R: [] };
  private handBones: { L: THREE.Object3D | null; R: THREE.Object3D | null } = { L: null, R: null };
  private readonly wristCache = {
    L: { base: new THREE.Quaternion(), written: new THREE.Quaternion(), valid: false },
    R: { base: new THREE.Quaternion(), written: new THREE.Quaternion(), valid: false },
  };
  private readonly scratch = {
    mid: new THREE.Vector3(),
    a: new THREE.Vector3(),
    target: new THREE.Vector3(),
    up: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    scale: new THREE.Vector3(),
    qObject: new THREE.Quaternion(),
    qObjectInv: new THREE.Quaternion(),
    qRig: new THREE.Quaternion(),
    qWorld: new THREE.Quaternion(),
    qLocal: new THREE.Quaternion(),
    qParent: new THREE.Quaternion(),
    qCorr: new THREE.Quaternion(),
    qStep: new THREE.Quaternion(),
    matrix: new THREE.Matrix4(),
    parentInv: new THREE.Matrix4(),
    groupInv: new THREE.Matrix4(),
    euler: new THREE.Euler(),
    axisX: new THREE.Vector3(1, 0, 0),
    axisY: new THREE.Vector3(0, 1, 0),
  };

  constructor(camera: THREE.Camera) {
    this.group = new THREE.Group();
    this.group.name = 'FirstPersonArmsViewmodel';
    this.group.position.set(0, this.currentY, REST_Z);
    this.group.rotation.set(REST_PITCH, Math.PI, 0);
    this.group.scale.setScalar(REST_SCALE);

    camera.add(this.group);
    this.initModel();
  }

  public get loaded(): boolean {
    return this.isLoaded;
  }

  /** True while the arms are typing: the host keeps drawing frames so the hands move. */
  public get typingActive(): boolean {
    return this.typingWanted && this.typingAction !== null;
  }

  /**
   * Puts the hands on the keyboard (true) or takes them away (false). With hold, the hands stay on
   * the keys between keystrokes (a writing session) instead of leaving after a few idle seconds.
   */
  public setTyping(on: boolean, hold = false) {
    this.typingHold = on && hold;
    if (this.typingWanted === on) return;
    this.typingWanted = on;
    if (!on) {
      this.typingPlaying = false;
      this.typingAction?.stop();
      this.typingBase?.stop();
      this.typingClock = createTypingClock();
      return;
    }
    void this.ensureTyping();
  }

  /**
   * One keystroke, or `count` of them: the hands go to the keys and the fingers play the next part of
   * the clip. Space, Enter and Backspace move the clip a little further and give the hands a short
   * press. The clip has no per-key motion, so this is the same typing motion, not a key-accurate one.
   */
  public typingKeystroke(count = 1, kind: 'key' | 'space' | 'enter' | 'backspace' = 'key') {
    this.typingClock = typingKey(this.typingClock, kind === 'key' ? count : count * 2);
    this.typingLastKeyMs = performance.now();
    if (kind !== 'key') this.typingPress = 1;
    this.setTyping(true, this.typingHold);
  }

  /**
   * Rests the typing hands on a keyboard (see `KeyboardAnchor`), or back to the camera pose (null).
   * Only applies while typing; the arms blend into the anchored pose at the typing blend speed.
   */
  public setKeyboardAnchor(anchor: KeyboardAnchor | null) {
    this.keyboardAnchor = anchor;
    this.anchorBlend = 0;
    this.tipRaise = { L: 0, R: 0 };
    this.restoreWrists();
    if (anchor) return;
    this.group.position.x = 0;
    this.group.rotation.set(REST_PITCH, Math.PI, 0);
    this.group.scale.setScalar(REST_SCALE);
  }

  /**
   * Places the rig so the wrists sit at the anchor point, in the anchor's orientation, then turns the
   * wrists by the anchor's corrections. Runs after the mixer posed the bones for this frame.
   */
  private applyKeyboardAnchor(k: number, dt: number) {
    const anchor = this.keyboardAnchor;
    const parent = this.group.parent;
    const { L, R } = this.handBones;
    if (!anchor || !parent || !L || !R) return;
    const s = this.scratch;
    this.anchorBlend += (1 - this.anchorBlend) * k;
    const b = this.anchorBlend;
    // Wrist midpoint in the rig's own space (independent of where the group is now).
    this.group.updateWorldMatrix(true, false);
    s.groupInv.copy(this.group.matrixWorld).invert();
    L.getWorldPosition(s.mid);
    R.getWorldPosition(s.a);
    s.mid.add(s.a).multiplyScalar(0.5).applyMatrix4(s.groupInv);
    // Wanted world transform: the anchor's frame times the rig orientation; the rig faces -z (yaw pi).
    anchor.object.updateWorldMatrix(true, false);
    anchor.object.getWorldQuaternion(s.qObject);
    s.qObjectInv.copy(s.qObject).invert();
    s.qRig.setFromEuler(s.euler.set(anchor.pitch, anchor.yaw, anchor.roll, 'YXZ')).multiply(s.qStep.setFromAxisAngle(s.axisY, Math.PI));
    s.qWorld.copy(s.qObject).multiply(s.qRig);
    s.target.copy(anchor.wrists);
    // Space, Enter and Backspace dip the hands a little toward the keys.
    s.target.y -= Math.sin(this.typingPress * Math.PI) * anchor.pressDepth;
    s.target.applyMatrix4(anchor.object.matrixWorld);
    s.pos.copy(s.mid).multiplyScalar(anchor.scale).applyQuaternion(s.qWorld);
    s.pos.subVectors(s.target, s.pos);
    s.matrix.compose(s.pos, s.qWorld, s.scale.setScalar(anchor.scale));
    parent.updateWorldMatrix(true, false);
    s.matrix.premultiply(s.parentInv.copy(parent.matrixWorld).invert());
    s.matrix.decompose(s.pos, s.qLocal, s.scale);
    this.group.position.lerp(s.pos, b);
    this.group.quaternion.slerp(s.qLocal, b);
    this.group.scale.lerp(s.scale, b);
    // Wrist corrections, about the anchor's axes. The mixer writes a bone only when its value changes
    // (a paused clip does not), so the clip's wrist rotation is kept and restored before each correction.
    for (const side of ['L', 'R'] as const) {
      const bone = this.handBones[side];
      const cache = this.wristCache[side];
      const corr = side === 'L' ? anchor.wristL : anchor.wristR;
      if (!bone || !bone.parent) continue;
      if (cache.valid && bone.quaternion.equals(cache.written)) bone.quaternion.copy(cache.base);
      else cache.base.copy(bone.quaternion);
      // A turn about -x lowers a fingertip that points to -z; a turn about +y moves it to -x (left hand out).
      const down = corr.down - this.tipRaise[side];
      s.qCorr.setFromAxisAngle(s.axisX, -down * b).multiply(s.qStep.setFromAxisAngle(s.axisY, (side === 'L' ? 1 : -1) * corr.out * b));
      this.turnBone(bone, s.qCorr);
      // No fingertip enters the keys: when the clip curls one lower, this wrist bends up at once by
      // what is missing, and settles back slowly once the fingers are clear. The arms do not move.
      const { lowest, reach } = this.lowestTip(side, anchor.object);
      if (!Number.isFinite(lowest)) continue;
      const clearance = lowest - anchor.tipFloorY;
      if (clearance < 0) {
        const extra = Math.min(-clearance / reach, TIP_RAISE_MAX - this.tipRaise[side]);
        this.tipRaise[side] += extra;
        this.turnBone(bone, s.qCorr.setFromAxisAngle(s.axisX, extra * b));
      } else {
        this.tipRaise[side] = Math.max(0, this.tipRaise[side] - Math.min(clearance / reach, TIP_RAISE_RELEASE * dt));
      }
      cache.written.copy(bone.quaternion);
      cache.valid = true;
    }
  }

  /** Turns a bone about its own origin by a rotation given in the anchor's axes. */
  private turnBone(bone: THREE.Object3D, inAnchor: THREE.Quaternion) {
    const s = this.scratch;
    const parent = bone.parent;
    if (!parent) return;
    s.qStep.copy(s.qObject).multiply(inAnchor).multiply(s.qObjectInv);
    parent.getWorldQuaternion(s.qParent);
    s.qWorld.copy(s.qParent).multiply(bone.quaternion).premultiply(s.qStep);
    bone.quaternion.copy(s.qParent.invert().multiply(s.qWorld)).normalize();
  }

  /** The lowest fingertip of one hand in the anchor's space, and its distance from the wrist. */
  private lowestTip(side: 'L' | 'R', object: THREE.Object3D): { lowest: number; reach: number } {
    const s = this.scratch;
    const wrist = this.handBones[side];
    let lowest = Infinity;
    let reach = 0.05;
    if (!wrist) return { lowest, reach };
    wrist.getWorldPosition(s.mid);
    object.worldToLocal(s.mid);
    for (const tip of this.fingertips[side]) {
      tip.getWorldPosition(s.a);
      object.worldToLocal(s.a);
      if (s.a.y < lowest) {
        lowest = s.a.y;
        reach = Math.max(0.03, s.a.distanceTo(s.mid));
      }
    }
    return { lowest, reach };
  }

  /** Puts back the clip's wrist rotation the anchor corrected (see `applyKeyboardAnchor`). */
  private restoreWrists() {
    for (const side of ['L', 'R'] as const) {
      const bone = this.handBones[side];
      const cache = this.wristCache[side];
      if (bone && cache.valid && bone.quaternion.equals(cache.written)) bone.quaternion.copy(cache.base);
      cache.valid = false;
    }
  }

  private async ensureTyping() {
    if (this.typingAction || this.typingLoading || !this.mixer) return;
    this.typingLoading = true;
    const clip = await CharacterAssetCache.loadTypingClip();
    this.typingLoading = false;
    if (!clip || !this.mixer || this.typingAction) return;
    const nodeOf = (track: THREE.KeyframeTrack) => track.name.slice(0, track.name.lastIndexOf('.'));
    const idle = this.actions['rig|Idle']?.getClip();
    // The idle base must not touch the bones the typing clip drives, or the two would be averaged.
    const driven = new Set(clip.tracks.map(nodeOf));
    if (idle) {
      const base = new THREE.AnimationClip('rig|IdleNoHands', idle.duration, idle.tracks.filter((track) => !driven.has(nodeOf(track))));
      this.typingBase = this.mixer.clipAction(base);
    }
    this.typingAction = this.mixer.clipAction(clip);
    this.typingAction.setLoop(THREE.LoopRepeat, Infinity);
  }

  /** One typing frame: the hands rise to the keys, and the clip plays by the keystroke clock. */
  private updateTyping(dt: number) {
    const action = this.typingAction;
    const mixer = this.mixer;
    if (!action || !mixer) return;
    if (!this.typingPlaying) {
      this.typingPlaying = true;
      this.typingBase?.reset().play();
      action.reset().play();
      // The clip time is set by hand from the keystroke clock; the mixer must not advance it.
      action.paused = true;
    }
    this.typingClock = stepTypingClock(this.typingClock, dt);
    // The hands go back down when the keys stop for a while (not while a writing session holds them).
    if (!this.typingHold && !isTypingMoving(this.typingClock) && performance.now() - this.typingLastKeyMs > TYPING_IDLE_MS) {
      this.setTyping(false);
      return;
    }
    action.time = wrapTypingTime(this.typingClock.time, action.getClip().duration);
    const k = 1 - Math.exp(-TYPING_BLEND_SPEED * dt);
    this.currentY += (this.typingPose.y - this.currentY) * k;
    this.targetY = this.typingPose.y;
    // A Space, Enter or Backspace press dips the hands by a few millimetres and lets them come back.
    this.typingPress = Math.max(0, this.typingPress - dt * TYPING_PRESS_DECAY);
    this.group.position.y = this.currentY - Math.sin(this.typingPress * Math.PI) * TYPING_PRESS_DEPTH;
    this.group.position.z += (this.typingPose.z - this.group.position.z) * k;
    this.group.visible = true;
    mixer.update(dt);
    if (this.keyboardAnchor) this.applyKeyboardAnchor(k, dt);
  }

  public isBlockingActive(): boolean {
    return this.isBlocking;
  }

  public isPunchingActive(): boolean {
    return this.isPunching;
  }

  public isCombatActive(): boolean {
    return performance.now() < this.combatReadyUntil;
  }

  private async initModel() {
    try {
      const gltf = await CharacterAssetCache.loadArmsModel();
      const cloned = CharacterAssetCache.cloneArmsScene(gltf);

      this.group.add(cloned.scene);
      this.mixer = new THREE.AnimationMixer(cloned.scene);
      // The wrist bones (`DEF-hand.L` / `.R`; three drops the dot and may add a suffix).
      cloned.scene.traverse((node) => {
        const side = /^DEF-hand([LR])(?:_\d+)?$/.exec(node.name)?.[1];
        if (side === 'L' || side === 'R') this.handBones[side] ??= node;
        const tip = /^DEF-(?:thumb|f_index|f_middle|f_ring|f_pinky)03([LR])_end(?:_\d+)?$/.exec(node.name)?.[1];
        if (tip === 'L' || tip === 'R') this.fingertips[tip].push(node);
      });

      cloned.animations.forEach((clip) => {
        const action = this.mixer!.clipAction(clip);
        this.actions[clip.name] = action;
      });

      this.isLoaded = true;
    } catch (err) {
      console.warn('[CharacterArmsViewmodel] Failed to initialize arms viewmodel:', err);
    }
  }

  public triggerPunch(onStrikeFeedback?: () => void) {
    if (!this.isLoaded || !this.mixer) return;

    this.isPunching = true;
    const hand = this.punchHand;
    this.punchHand = hand === 'R' ? 'L' : 'R';

    const clipName = hand === 'R' ? 'rig|Punch_R' : 'rig|Punch_L';
    const punchAction = this.actions[clipName];
    if (!punchAction) return;

    // Instant zero-latency snap so the strike appears on screen at frame 0
    this.currentY = -1.08;
    this.targetY = -1.08;
    this.group.position.y = -1.08;

    onStrikeFeedback?.();

    if (this.actions['rig|Unequip']?.isRunning()) {
      this.actions['rig|Unequip'].stop();
    }
    if (this.currentLocomotion) {
      this.currentLocomotion.fadeOut(0.04);
      this.currentLocomotion = null;
    }
    if (this.currentPunch && this.currentPunch !== punchAction) {
      this.currentPunch.fadeOut(0.06);
    }
    this.currentPunch = punchAction;

    punchAction.reset();
    punchAction.timeScale = 2.25;
    punchAction.setLoop(THREE.LoopOnce, 1);
    punchAction.clampWhenFinished = false;
    punchAction.fadeIn(0.01);
    punchAction.play();

    const durationMs = Math.round((punchAction.getClip().duration / punchAction.timeScale) * 1000);
    // Short 120ms readiness window for rapid 1-2 punch combo; drops down briskly once finished
    this.combatReadyUntil = performance.now() + durationMs + 120;

    if (this.punchTimer) {
      window.clearTimeout(this.punchTimer);
    }
    this.punchTimer = window.setTimeout(() => {
      this.isPunching = false;
      this.punchTimer = null;
      if (this.currentPunch) {
        this.currentPunch.fadeOut(0.12);
        this.currentPunch = null;
      }
    }, durationMs);
  }

  public setBlocking(blocking: boolean) {
    if (!this.isLoaded || !this.mixer || this.isBlocking === blocking) return;
    this.isBlocking = blocking;

    const blockStart = this.actions['rig|Block_Start'];
    const blockLoop = this.actions['rig|Block_Loop'];
    const blockStop = this.actions['rig|Block_Stop'];
    if (!blockStart || !blockLoop || !blockStop) return;

    if (blocking) {
      this.targetY = -0.98;
      this.combatReadyUntil = performance.now() + 800;

      if (this.actions['rig|Unequip']?.isRunning()) this.actions['rig|Unequip'].stop();
      if (this.currentLocomotion) {
        this.currentLocomotion.fadeOut(0.08);
        this.currentLocomotion = null;
      }

      blockStart.reset();
      blockStart.timeScale = 1.8;
      blockStart.setLoop(THREE.LoopOnce, 1);
      blockStart.clampWhenFinished = true;
      blockStart.play();

      window.setTimeout(() => {
        if (this.isBlocking) {
          blockStart.fadeOut(0.08);
          blockLoop.reset().fadeIn(0.08).play();
        }
      }, 160);
    } else {
      blockLoop.fadeOut(0.08);
      blockStop.reset();
      blockStop.timeScale = 1.8;
      blockStop.setLoop(THREE.LoopOnce, 1);
      blockStop.clampWhenFinished = false;
      blockStop.fadeIn(0.08).play();
    }
  }

  public triggerInspect() {
    if (!this.isLoaded || !this.mixer || this.isInspecting) return;
    const inspect = this.actions['rig|Inspect'];
    if (!inspect) return;

    this.isInspecting = true;
    this.targetY = -1.08;
    this.combatReadyUntil = performance.now() + 2000;

    if (this.actions['rig|Unequip']?.isRunning()) this.actions['rig|Unequip'].stop();
    if (this.currentLocomotion) {
      this.currentLocomotion.fadeOut(0.12);
      this.currentLocomotion = null;
    }

    inspect.reset();
    inspect.timeScale = 1.35;
    inspect.setLoop(THREE.LoopOnce, 1);
    inspect.fadeIn(0.12).play();

    const ms = Math.round((inspect.getClip().duration / 1.35) * 1000);
    if (this.inspectTimer) window.clearTimeout(this.inspectTimer);
    this.inspectTimer = window.setTimeout(() => {
      inspect.fadeOut(0.2);
      this.isInspecting = false;
      this.inspectTimer = null;
    }, ms);
  }

  public triggerInteract() {
    if (!this.isLoaded || !this.mixer || this.isInteracting) return;
    const takeStart = this.actions['rig|Take_Start'];
    const takeStop = this.actions['rig|Take_Stop'];
    if (!takeStart || !takeStop) return;

    this.isInteracting = true;
    this.targetY = -1.08;
    this.combatReadyUntil = performance.now() + 800;

    if (this.actions['rig|Unequip']?.isRunning()) this.actions['rig|Unequip'].stop();
    if (this.currentLocomotion) {
      this.currentLocomotion.fadeOut(0.08);
      this.currentLocomotion = null;
    }

    takeStart.reset();
    takeStart.timeScale = 1.7;
    takeStart.setLoop(THREE.LoopOnce, 1);
    takeStart.play();

    if (this.interactTimer) window.clearTimeout(this.interactTimer);
    this.interactTimer = window.setTimeout(() => {
      takeStart.fadeOut(0.08);
      takeStop.reset();
      takeStop.timeScale = 1.7;
      takeStop.setLoop(THREE.LoopOnce, 1);
      takeStop.play();

      this.interactTimer = window.setTimeout(() => {
        this.isInteracting = false;
        this.interactTimer = null;
      }, 260);
    }, 220);
  }

  public update(
    dt: number,
    isMoving: boolean,
    isSprinting: boolean,
    isStowed = false,
  ) {
    if (!this.isLoaded || !this.mixer) return;
    if (this.typingWanted && this.typingAction) {
      this.updateTyping(dt);
      return;
    }
    // After typing, the arms go back to their resting distance.
    this.group.position.z += (REST_Z - this.group.position.z) * (1 - Math.exp(-12 * dt));

    // In vehicle / boat ride or cinematic mode, stow arms away completely below screen
    if (isStowed) {
      this.targetY = -1.75;
      this.currentY += (-1.75 - this.currentY) * (1 - Math.exp(-12 * dt));
      this.group.position.y = this.currentY;
      this.group.visible = this.currentY > -1.70;
      if (this.group.visible) {
        this.mixer.update(dt);
      }
      return;
    }

    const isCombat = performance.now() < this.combatReadyUntil;
    const isHandsActive =
      this.isBlocking ||
      this.isPunching ||
      this.isInteracting ||
      this.isInspecting ||
      (isSprinting && isMoving) ||
      isCombat;

    // Edge-triggered unequip transition: fires smoothly ONCE, no frame-loop hitching
    if (isHandsActive) {
      this.wasHandsActive = true;
      if (this.unequipTimer) {
        window.clearTimeout(this.unequipTimer);
        this.unequipTimer = null;
      }
      if (this.actions['rig|Unequip']?.isRunning()) {
        this.actions['rig|Unequip'].fadeOut(0.08);
      }
    } else if (this.wasHandsActive) {
      this.wasHandsActive = false;
      if (this.currentLocomotion?.isRunning()) {
        this.currentLocomotion.fadeOut(0.12);
        this.currentLocomotion = null;
      }
      const unequipAction = this.actions['rig|Unequip'];
      if (unequipAction) {
        unequipAction.reset();
        unequipAction.timeScale = 1.35;
        unequipAction.setLoop(THREE.LoopOnce, 1);
        unequipAction.clampWhenFinished = true;
        unequipAction.fadeIn(0.12).play();
        if (this.unequipTimer) window.clearTimeout(this.unequipTimer);
        this.unequipTimer = window.setTimeout(() => {
          unequipAction.fadeOut(0.15);
        }, 750);
      }
    }

    if (this.isBlocking) {
      this.targetY = -0.98;
    } else if (this.isPunching || this.isInteracting || this.isInspecting || isCombat) {
      this.targetY = -1.08;
    } else if (isSprinting && isMoving) {
      // Dynamic sprint arm pumping
      this.targetY = -1.10;
      const sprintAction = this.actions['rig|Sprint_Type_1'];
      if (sprintAction && (!sprintAction.isRunning() || this.currentLocomotion !== sprintAction)) {
        if (this.currentLocomotion && this.currentLocomotion !== sprintAction) {
          this.currentLocomotion.fadeOut(0.12);
        }
        this.currentLocomotion = sprintAction;
        sprintAction.reset().fadeIn(0.12).play();
      }
    } else {
      // Idle & Normal Walk: Stow hands naturally off-screen (unequipped)
      this.targetY = -1.55;
      if (this.currentLocomotion) {
        this.currentLocomotion.fadeOut(0.15);
        this.currentLocomotion = null;
      }
      if (this.currentPunch && !this.isPunching) {
        this.currentPunch.fadeOut(0.15);
        this.currentPunch = null;
      }
    }

    // Framerate-independent exponential smoothing: snappy raise (20), brisk natural tuck away (15)
    const lerpSpeed = this.targetY > this.currentY ? 20 : 15;
    this.currentY += (this.targetY - this.currentY) * (1 - Math.exp(-lerpSpeed * dt));
    this.group.position.y = this.currentY;

    // Only update skinning and bone matrices when visible on screen
    const isVisible = this.currentY > -1.53 || isHandsActive;
    this.group.visible = isVisible;
    if (isVisible) {
      this.mixer.update(dt);
    }
  }

  public dispose() {
    if (this.punchTimer) window.clearTimeout(this.punchTimer);
    if (this.unequipTimer) window.clearTimeout(this.unequipTimer);
    if (this.interactTimer) window.clearTimeout(this.interactTimer);
    if (this.inspectTimer) window.clearTimeout(this.inspectTimer);
    this.punchTimer = null;
    this.unequipTimer = null;
    this.interactTimer = null;
    this.inspectTimer = null;

    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.group);
      this.mixer = null;
    }

    this.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });

    this.group.clear();
    this.group.removeFromParent();
  }
}

import * as THREE from 'three';
import { CharacterAssetCache } from './CharacterAssetCache';

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

  constructor(camera: THREE.Camera) {
    this.group = new THREE.Group();
    this.group.name = 'FirstPersonArmsViewmodel';
    this.group.position.set(0, this.currentY, 0.06);
    this.group.rotation.set(-0.05, Math.PI, 0);
    this.group.scale.set(0.72, 0.72, 0.72);

    camera.add(this.group);
    this.initModel();
  }

  public get loaded(): boolean {
    return this.isLoaded;
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
    if (this.currentLocomotion?.isRunning()) {
      this.currentLocomotion.fadeOut(0.04);
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
      if (this.currentLocomotion?.isRunning()) this.currentLocomotion.fadeOut(0.08);

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
    if (this.currentLocomotion?.isRunning()) this.currentLocomotion.fadeOut(0.12);

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
    if (this.currentLocomotion?.isRunning()) this.currentLocomotion.fadeOut(0.08);

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
      if (sprintAction && this.currentLocomotion !== sprintAction) {
        if (this.currentLocomotion) this.currentLocomotion.fadeOut(0.12);
        this.currentLocomotion = sprintAction;
        sprintAction.reset().fadeIn(0.12).play();
      }
    } else {
      // Idle & Normal Walk: Stow hands naturally off-screen (unequipped)
      this.targetY = -1.55;
      if (this.currentLocomotion?.isRunning()) {
        this.currentLocomotion.fadeOut(0.15);
        this.currentLocomotion = null;
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
    this.mixer?.stopAllAction();
    this.group.clear();
  }
}

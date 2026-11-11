import * as THREE from 'three';
import { CharacterArmsViewmodel } from './CharacterArmsViewmodel';
import { CharacterAudio } from './CharacterAudio';
import type { GameWorldAdapter } from '../adapters/GameWorldAdapter';
import type { PlayerControlsState, PlayerStats } from '../types';

export interface PlayerControlsProvider {
  keysRef: { current: PlayerControlsState };
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
}

export interface CharacterRuntimeOptions {
  camera: THREE.Camera;
  adapter: GameWorldAdapter;
  controls: PlayerControlsProvider;
  spawnPosition?: [number, number, number];
  spawnYaw?: number;
  soundEnabled?: boolean;
  sfxVolume?: number;
  onStatsUpdate?: (stats: PlayerStats) => void;
  onInteract?: (position: [number, number, number]) => void;
  onPunchStrike?: (hit: boolean) => void;
}

export class CharacterRuntime {
  public camera: THREE.Camera;
  public adapter: GameWorldAdapter;
  public controls: PlayerControlsProvider;
  public arms: CharacterArmsViewmodel;
  public audio: CharacterAudio;

  // Orientation
  public yaw = 0;
  public pitch = 0;
  private targetYaw = 0;
  private targetPitch = 0;

  // Kinematics
  public velocity = new THREE.Vector3();
  public onGround = true;
  private isFlyMode = false;
  private isStowed = false;

  // Callbacks
  private onStatsUpdate?: (stats: PlayerStats) => void;
  private onInteract?: (position: [number, number, number]) => void;
  private onPunchStrike?: (hit: boolean) => void;
  private lastStatsTime = 0;

  // Melee combat
  private raycaster = new THREE.Raycaster();
  private aimDir = new THREE.Vector3();

  // Scratch objects for 60fps loop to eliminate GC overhead
  private readonly _upAxis = new THREE.Vector3(0, 1, 0);
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _wishDir = new THREE.Vector3();
  private readonly _camEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly _posScratch = new THREE.Vector3();

  constructor(options: CharacterRuntimeOptions) {
    this.camera = options.camera;
    this.adapter = options.adapter;
    this.controls = options.controls;
    this.onStatsUpdate = options.onStatsUpdate;
    this.onInteract = options.onInteract;
    this.onPunchStrike = options.onPunchStrike;

    this.arms = new CharacterArmsViewmodel(this.camera);
    this.audio = new CharacterAudio(options.soundEnabled ?? true, options.sfxVolume ?? 1.0);

    if (options.spawnPosition) {
      this.camera.position.set(...options.spawnPosition);
    }
    if (options.spawnYaw !== undefined) {
      this.yaw = options.spawnYaw;
      this.targetYaw = options.spawnYaw;
    }
  }

  public setFlyMode(enabled: boolean) {
    this.isFlyMode = enabled;
    if (enabled) {
      this.onGround = false;
    }
  }

  public getFlyMode(): boolean {
    return this.isFlyMode;
  }

  public setStowed(stowed: boolean) {
    this.isStowed = stowed;
  }

  public setCameraPose(pos: THREE.Vector3, lookTarget: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.camera.lookAt(lookTarget);
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;
    this.targetYaw = euler.y;
    this.targetPitch = euler.x;
    this.velocity.set(0, 0, 0);
  }

  public teleport(position: [number, number, number], spawnYaw?: number) {
    this.camera.position.set(...position);
    if (spawnYaw !== undefined) {
      this.yaw = spawnYaw;
      this.targetYaw = spawnYaw;
      this.pitch = 0;
      this.targetPitch = 0;
    }
    this.velocity.set(0, 0, 0);
  }

  public triggerPunch() {
    this.arms.triggerPunch(() => {
      this.performPunchRaycastAndAudio();
    });
  }

  public setBlocking(blocking: boolean) {
    this.arms.setBlocking(blocking);
  }

  public triggerInspect() {
    this.arms.triggerInspect();
  }

  public triggerInteract() {
    this.arms.triggerInteract();
    this.onInteract?.([this.camera.position.x, this.camera.position.y, this.camera.position.z]);
  }

  private performPunchRaycastAndAudio() {
    this.camera.getWorldDirection(this.aimDir);
    this.raycaster.set(this.camera.position, this.aimDir);
    this.raycaster.near = 0.1;
    this.raycaster.far = 2.4;

    let targets = this.adapter.getInteractionTargets?.();
    if (!targets && this.camera.parent) {
      // Find scene root if targets not explicitly supplied
      let root: THREE.Object3D = this.camera.parent;
      while (root.parent) root = root.parent;
      targets = root.children;
    }

    let hit = false;
    if (targets && targets.length > 0) {
      const intersects = this.raycaster.intersectObjects(targets, true);
      const validHit = intersects.find((i) => {
        let parent: THREE.Object3D | null = i.object;
        while (parent) {
          if (parent === this.camera || parent === this.arms.group || !parent.visible) {
            return false;
          }
          parent = parent.parent;
        }
        return true;
      });
      hit = Boolean(validHit);
    }

    if (hit) {
      this.audio.playPunchSound('hit');
    } else {
      this.audio.playPunchSound('miss');
    }

    this.onPunchStrike?.(hit);
  }

  public update(dt: number) {
    const keys = this.controls.keysRef.current;

    // 1. Mouse look with silky exponential interpolation
    const mouseDelta = this.controls.consumeMovement();
    const MOUSE_SENSITIVITY = 0.0022;
    this.targetYaw -= mouseDelta.x * MOUSE_SENSITIVITY;
    this.targetPitch -= mouseDelta.y * MOUSE_SENSITIVITY;

    const PITCH_LIMIT = (85 * Math.PI) / 180;
    this.targetPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.targetPitch));

    const ROT_SMOOTH = 1 - Math.exp(-25 * dt);
    this.yaw += (this.targetYaw - this.yaw) * ROT_SMOOTH;
    this.pitch += (this.targetPitch - this.pitch) * ROT_SMOOTH;
    this._camEuler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(this._camEuler);

    // 2. Action Triggers
    const blocking = Boolean(keys.block);
    if (blocking !== this.arms.isBlockingActive()) {
      this.arms.setBlocking(blocking);
    }

    const punchTriggered = this.controls.consumePunchTrigger();
    const isHoldingPunch = keys.punch;
    if ((punchTriggered || isHoldingPunch) && !this.arms.isPunchingActive() && !blocking) {
      this.triggerPunch();
    }

    const interactTriggered = this.controls.consumeInteractTrigger();
    if (interactTriggered && !this.arms.isPunchingActive()) {
      this.triggerInteract();
    }

    const inspectTriggered = this.controls.consumeInspectTrigger();
    if (inspectTriggered && !this.arms.isPunchingActive() && !blocking) {
      this.triggerInspect();
    }

    // 3. Movement Direction & Kinematics
    this._forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);

    if (this.isFlyMode) {
      const speed = keys.sprint ? 42 : 17;
      const moveVec = new THREE.Vector3();
      if (keys.forward) moveVec.add(this._forward);
      if (keys.backward) moveVec.sub(this._forward);
      if (keys.right) moveVec.add(this._right);
      if (keys.left) moveVec.sub(this._right);
      if (keys.jump) moveVec.y += 1;

      if (moveVec.lengthSq() > 0) moveVec.normalize();
      this.velocity.lerp(moveVec.multiplyScalar(speed), Math.min(1, dt * 8));
      this.camera.position.addScaledVector(this.velocity, dt);

      const groundFloor = this.adapter.getGroundHeight(this.camera.position.x, this.camera.position.z);
      if (groundFloor !== null) {
        const minH = groundFloor + 0.8;
        if (this.camera.position.y < minH) this.camera.position.y = minH;
      }
    } else {
      const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const moveZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
      const hasInput = moveX !== 0 || moveZ !== 0;

      const sprinting = hasInput && keys.sprint && this.onGround && !blocking && moveZ > 0;
      const targetSpeed = blocking ? 2.0 : (sprinting ? 8.2 : 4.2);
      const currentSpeedTarget = hasInput ? targetSpeed : 0;

      this._forward.set(0, 0, -1).applyAxisAngle(this._upAxis, this.yaw);
      this._right.set(1, 0, 0).applyAxisAngle(this._upAxis, this.yaw);

      this._wishDir.set(0, 0, 0);
      if (hasInput) {
        this._wishDir.addScaledVector(this._forward, moveZ);
        this._wishDir.addScaledVector(this._right, moveX);
        this._wishDir.normalize();
      }

      // Acceleration: 18.0 m/s² with input, 12.0 m/s² friction deceleration
      const accel = this.onGround ? (hasInput ? 18.0 : 12.0) : 4.0;
      const targetVelX = this._wishDir.x * currentSpeedTarget;
      const targetVelZ = this._wishDir.z * currentSpeedTarget;

      this.velocity.x += (targetVelX - this.velocity.x) * Math.min(1, accel * dt);
      this.velocity.z += (targetVelZ - this.velocity.z) * Math.min(1, accel * dt);

      // Jump & Gravity constants from adapter
      const gravity = this.adapter.gravity ?? -24.0;
      const jumpForce = this.adapter.jumpForce ?? 7.2;

      if (keys.jump && this.onGround && !blocking) {
        this.velocity.y = jumpForce;
        this.onGround = false;
      }

      // Horizontal displacement & collision resolution
      const currX = this.camera.position.x;
      const currZ = this.camera.position.z;
      const targetX = currX + this.velocity.x * dt;
      const targetZ = currZ + this.velocity.z * dt;

      const eyeHeight = this.adapter.eyeHeight ?? 1.85;
      const footY = this.camera.position.y - eyeHeight;

      if (this.adapter.resolveMovement) {
        const colRes = this.adapter.resolveMovement(
          currX,
          currZ,
          targetX,
          targetZ,
          footY,
          0.35,
          eyeHeight,
        );
        this.camera.position.x = colRes.newX;
        this.camera.position.z = colRes.newZ;

        if (colRes.collided) {
          const nx = colRes.hitNormalX;
          const nz = colRes.hitNormalZ;
          const vDotN = this.velocity.x * nx + this.velocity.z * nz;
          if (vDotN < 0) {
            this.velocity.x -= vDotN * nx;
            this.velocity.z -= vDotN * nz;
          }
        }
      } else {
        this.camera.position.x = targetX;
        this.camera.position.z = targetZ;
      }

      // Map boundary clamps
      if (this.adapter.clampPosition) {
        this._posScratch.copy(this.camera.position);
        this.adapter.clampPosition(this._posScratch);
        this.camera.position.x = this._posScratch.x;
        this.camera.position.z = this._posScratch.z;
      }

      // 4. Ground height tracking & gravity integration
      const groundFloor = this.adapter.getGroundHeight(this.camera.position.x, this.camera.position.z);
      if (groundFloor !== null) {
        const targetFloorY = groundFloor + eyeHeight;

        if (this.onGround) {
          const delta = targetFloorY - this.camera.position.y;
          if (delta >= -1.25 && delta <= 0.85) {
            this.camera.position.y = targetFloorY;
            this.velocity.y = 0;
          } else if (delta < -1.25) {
            this.onGround = false;
            this.velocity.y = 0;
          } else {
            this.camera.position.y = targetFloorY;
            this.velocity.y = 0;
          }
        }

        if (!this.onGround) {
          this.velocity.y += gravity * dt;
          this.camera.position.y += this.velocity.y * dt;

          if (this.camera.position.y <= targetFloorY) {
            this.camera.position.y = targetFloorY;
            this.velocity.y = 0;
            this.onGround = true;
          }
        }
      }

      // Update arms viewmodel
      const isMoving = hasInput;
      this.arms.update(dt, isMoving, sprinting, this.isStowed);
    }

    // 5. Throttled stats update for HUD telemetry (120ms throttle)
    const now = performance.now();
    if (now - this.lastStatsTime > 120) {
      this.lastStatsTime = now;
      const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      const isMoving = Boolean(keys.forward || keys.backward || keys.left || keys.right);
      const isSprinting = isMoving && Boolean(keys.sprint) && !this.arms.isBlockingActive();

      this.onStatsUpdate?.({
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        speed: horizontalSpeed,
        isSprinting,
        isGrounded: this.onGround,
        isBlocking: this.arms.isBlockingActive(),
      });
    }
  }

  public dispose() {
    this.arms.dispose();
    this.audio.dispose();
  }
}

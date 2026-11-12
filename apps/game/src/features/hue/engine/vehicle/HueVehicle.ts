import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CharacterRuntime } from '../../../player';
import { resolveBoxCollision, stepVehiclePhysics } from '../../../vehicle/vehiclePhysics';
import { DEFAULT_VEHICLE_CONFIG, type VehiclePhysicsConfig, type VehicleState } from '../../../vehicle/types';
import { INITIAL_TURN_SIGNAL, stepTurnSignal, type TurnSignalState } from '../../../vehicle/turnSignal';
import { VehicleAudio } from '../../../vehicle/vehicleAudio';
import { WORLD_SIZE, getWalkableHeight } from '../../world/hueWorldConfig';
import type { HueCollisionSystem } from '../collision/HueCollisionSystem';
import { canDriveTo, carGroundPose, isHueWater } from './hueDriving';

/** Mercedes-Benz A45 S AMG (Ddiaz Design, CC BY-NC-SA 4.0), converted to Meshopt + WebP GLB. */
export const HUE_CAR_MODEL_PATH = '/assets/3d/vehicles/merc-a45.glb';
export const HUE_CAR_NAME = 'Mercedes-AMG A45 S';

/** Parked on the flat north riverside lane just east of the Thiên Mụ terrace (the terrace itself has stairs), facing east (+X). */
export const HUE_CAR_PARKING = (() => {
  const x = -150;
  return { x, z: -65 - 5 * Math.sin(0.014 * x), yaw: Math.PI / 2 };
})();

/** Car-local driver eye (left-hand drive: driver on +X), centred behind the steering wheel. */
const SEAT_EYE = new THREE.Vector3(0.355, 1.13, -0.25);
/**
 * Steering wheel: the model keeps it as its own group (rim, suede, trim, buttons, badge).
 * Hub and column axis measured from the rim vertices (PCA): 19.7 degrees from vertical,
 * rim radius 0.165 m; the axis points from the hub towards the driver, like the Lexus.
 */
const WHEEL_GROUP_NAME = /SK_Body_Bones_101_SK_Body_Bones_101_MI_Exhaust1(_\d+)?$/;
const WHEEL_HUB = new THREE.Vector3(0.3552, 0.8897, 0.2735);
const WHEEL_AXIS = new THREE.Vector3(0, 0.3373, -0.9414).normalize();
/** Body footprint for the walking player (half width with mirrors folded, half length). */
const BODY_HALF_WIDTH = 0.95;
const BODY_HALF_LENGTH = 2.25;
const PLAYER_RADIUS = 0.4;
/** Circles along the body used against the world colliders while driving. */
const BODY_PROBES = [-1.45, 0, 1.45];
const BODY_PROBE_RADIUS = 0.95;
const ENTER_REACH = 2.6;
const ENGINE_START_FALLBACK_MS = 11300;
const COCKPIT_SENS = 0.002;
/**
 * Studio reflections for the car only. The Huế sky environment is soft and its lower half is dark
 * earth, so glossy black details (the star badge, trim, chrome) reflect almost nothing and vanish;
 * the model was authored for a studio light like Sketchfab's. Scaled by the scene's environment
 * intensity so the car still dims at night.
 */
const CAR_ENV_INTENSITY = 1.0;

const HUE_VEHICLE_CONFIG: VehiclePhysicsConfig = {
  ...DEFAULT_VEHICLE_CONFIG,
  roadBounds: {
    minX: -WORLD_SIZE * 0.45,
    maxX: WORLD_SIZE * 0.45,
    minZ: -WORLD_SIZE * 0.45,
    maxZ: WORLD_SIZE * 0.45,
  },
};

export interface HueVehicleControls {
  keysRef: { current: { forward: boolean; backward: boolean; left: boolean; right: boolean; jump: boolean } | null };
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
}

/** Driving telemetry merged into the Huế PlayerStats. */
export interface HueVehicleStats {
  isDriving: boolean;
  isNearCar: boolean;
  carSpeed: number;
  carGear: 'P' | 'D' | 'R';
  isEngineStarting: boolean;
}

/**
 * Drivable car for the imperative Huế engine. The car follows the heightfield, stays out of the
 * river and lake, cannot climb stairs or walls, and is blocked by the world colliders.
 */
export class HueVehicle {
  private pivot: THREE.Group | null = null;
  private steeringPivot: THREE.Group | null = null;
  private state: VehicleState;
  private driving = false;
  private nearCar = false;
  private canDrive = false;
  private engineTimer: number | null = null;
  private cockpitYaw = 0;
  private cockpitPitch = -0.05;
  private wasAccelerating = false;
  private turnSignal: TurnSignalState = INITIAL_TURN_SIGNAL;
  private lastStats = 0;
  private disposed = false;
  private readonly audio: VehicleAudio;
  private readonly seat = new THREE.Vector3();
  private readonly look = new THREE.Quaternion();
  private readonly lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envIntensity = 1;
  private readonly carMaterials = new Set<THREE.MeshStandardMaterial>();

  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly collision: HueCollisionSystem;
  private readonly character: CharacterRuntime;
  private readonly controls: HueVehicleControls;
  private readonly onStats: (stats: HueVehicleStats & { position: [number, number, number]; speed: number }) => void;
  /** Called with the car footprint so the grass field leaves it empty. */
  onFootprint?: (x: number, z: number, yaw: number, halfWidth: number, halfLength: number) => void;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    collision: HueCollisionSystem,
    character: CharacterRuntime,
    controls: HueVehicleControls,
    onStats: (stats: HueVehicleStats & { position: [number, number, number]; speed: number }) => void,
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.collision = collision;
    this.character = character;
    this.controls = controls;
    this.onStats = onStats;
    const { x, z, yaw } = HUE_CAR_PARKING;
    const pose = carGroundPose(x, z, yaw);
    this.state = {
      position: [x, pose.y, z],
      yaw,
      speed: 0,
      steering: 0,
      gear: 'P',
      isDriving: false,
      isNearCar: false,
      steeringWheelRotation: 0,
      pitch: 0,
      roll: 0,
    };
    this.audio = new VehicleAudio();
    this.load();
  }

  get isDriving() {
    return this.driving;
  }
  get isNearCar() {
    return this.nearCar && !this.driving;
  }

  private load() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      HUE_CAR_MODEL_PATH,
      (gltf) => {
        if (this.disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const pivot = new THREE.Group();
        pivot.name = 'HueCarPivot';
        pivot.add(gltf.scene);
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) this.carMaterials.add(m as THREE.MeshStandardMaterial);
            }
          }
        });
        this.applyStudioEnvironment();
        this.pivot = pivot;
        this.rigSteeringWheel(pivot, gltf.scene);
        this.applyPose();
        this.scene.add(pivot);
      },
      undefined,
      (err) => console.warn('Huế car model failed to load:', err),
    );
  }

  /** Re-parents the steering wheel group to a pivot on the steering column. */
  private rigSteeringWheel(pivot: THREE.Group, model: THREE.Object3D) {
    let wheel: THREE.Object3D | null = null;
    model.traverse((o) => {
      if (!wheel && WHEEL_GROUP_NAME.test(o.name) && o.children.length > 0) wheel = o;
    });
    if (!wheel) {
      console.warn('Huế car: steering wheel group not found; the wheel will not turn.');
      return;
    }
    const steering = new THREE.Group();
    steering.name = 'HueCarSteeringPivot';
    steering.position.copy(WHEEL_HUB);
    pivot.add(steering);
    pivot.updateMatrixWorld(true);
    steering.attach(wheel);
    this.steeringPivot = steering;
  }

  /** Keeps the walking player out of the car body (called from the world adapter). */
  resolvePlayer(x: number, z: number, radius: number) {
    if (!this.pivot || this.driving) return null;
    const [cx, , cz] = this.state.position;
    const hit = resolveBoxCollision(x, z, Math.max(radius, PLAYER_RADIUS), {
      x: cx,
      z: cz,
      halfWidth: BODY_HALF_WIDTH,
      halfLength: BODY_HALF_LENGTH,
      // BoxCollider yaw uses the math convention: opposite sign of a Three.js Y rotation.
      yaw: -this.state.yaw,
    });
    return hit.collided ? hit : null;
  }

  /** Walking: refresh the "[E] get in" proximity from the player's position. */
  updateProximity(px: number, pz: number) {
    if (!this.pivot || this.driving) {
      this.nearCar = false;
      return;
    }
    const [cx, , cz] = this.state.position;
    const door = this.localToWorldXZ(1.1, 0.2);
    this.nearCar = Math.hypot(px - door[0], pz - door[1]) < ENTER_REACH || Math.hypot(px - cx, pz - cz) < 3.2;
  }

  enter() {
    if (!this.pivot || this.driving) return;
    this.driving = true;
    this.nearCar = false;
    this.state.gear = 'P';
    this.state.speed = 0;
    this.cockpitYaw = 0;
    this.cockpitPitch = -0.05;
    this.wasAccelerating = false;
    this.turnSignal = INITIAL_TURN_SIGNAL;
    this.canDrive = false;
    this.character.arms.group.visible = false;
    this.character.setStowed(true);
    const unlock = () => {
      this.canDrive = true;
      if (this.state.gear === 'P') this.state.gear = 'D';
    };
    this.audio.playDoorSound(unlock);
    if (this.engineTimer) window.clearTimeout(this.engineTimer);
    this.engineTimer = window.setTimeout(unlock, ENGINE_START_FALLBACK_MS);
  }

  exit() {
    if (!this.driving) return;
    this.driving = false;
    this.canDrive = false;
    this.state.speed = 0;
    if (this.engineTimer) {
      window.clearTimeout(this.engineTimer);
      this.engineTimer = null;
    }
    this.turnSignal = INITIAL_TURN_SIGNAL;
    this.audio.stopAll();
    this.audio.playStopCarSound();
    this.steeringPivot?.quaternion.identity();

    // Step out on the driver's side if it is dry and clear, otherwise try the other sides.
    const [cx, , cz] = this.state.position;
    const candidates: Array<[number, number]> = [
      [1.75, -0.2],
      [-1.75, -0.2],
      [0, -3.1],
      [0, 3.1],
    ];
    let spot = this.localToWorldXZ(...candidates[0]);
    for (const [lx, lz] of candidates) {
      const p = this.localToWorldXZ(lx, lz);
      const blocked = this.collision.resolveMovement(cx, cz, p[0], p[1], getWalkableHeight(cx, cz), 0.35, 1.85).collided;
      if (!isHueWater(p[0], p[1]) && !blocked) {
        spot = p;
        break;
      }
    }
    const eyeY = getWalkableHeight(spot[0], spot[1]) + 1.85;
    const fx = Math.sin(this.state.yaw);
    const fz = Math.cos(this.state.yaw);
    this.character.setCameraPose(
      new THREE.Vector3(spot[0], eyeY, spot[1]),
      new THREE.Vector3(spot[0] + fx * 5, eyeY, spot[1] + fz * 5),
    );
    this.character.arms.group.visible = true;
    this.character.setStowed(false);
  }

  /** Driving step: physics, terrain, collisions, cockpit camera, audio and HUD. */
  step(dt: number) {
    if (!this.driving || !this.pivot) return;
    const keys = this.controls.keysRef.current;

    const mouse = this.controls.consumeMovement();
    this.cockpitYaw = THREE.MathUtils.clamp(this.cockpitYaw - mouse.x * COCKPIT_SENS, -0.95, 0.95);
    this.cockpitPitch = THREE.MathUtils.clamp(this.cockpitPitch - mouse.y * COCKPIT_SENS, -0.35, 0.25);
    this.controls.consumePunchTrigger();
    this.controls.consumeInspectTrigger();
    if (this.controls.consumeInteractTrigger() && Math.abs(this.state.speed) < 2.5) {
      this.exit();
      return;
    }

    const starting = !this.canDrive;
    const inputs = {
      forward: !starting && Boolean(keys?.forward),
      backward: !starting && Boolean(keys?.backward),
      left: !starting && Boolean(keys?.left),
      right: !starting && Boolean(keys?.right),
      handbrake: Boolean(keys?.jump) || starting,
    };
    const prev = this.state;
    const next = stepVehiclePhysics(prev, inputs, HUE_VEHICLE_CONFIG, dt);
    if (starting) {
      next.gear = 'P';
      next.speed = 0;
    }

    // Terrain, water and world colliders: if the move is not allowed, stay put and bounce back.
    const [x0, , z0] = prev.position;
    let [x1, , z1] = next.position;
    if (!this.canOccupy(x0, z0, x1, z1, next.yaw)) {
      x1 = x0;
      z1 = z0;
      next.speed = -prev.speed * 0.2;
    }
    const ground = carGroundPose(x1, z1, next.yaw);
    next.position = [x1, ground.y, z1];
    this.state = next;
    this.applyPose(ground.pitch, ground.roll);
    this.steeringPivot?.quaternion.setFromAxisAngle(WHEEL_AXIS, next.steeringWheelRotation);

    // Automatic turn signal and engine sounds.
    const steer = inputs.left === inputs.right ? 0 : inputs.left ? -1 : 1;
    const before = this.turnSignal.active;
    this.turnSignal = stepTurnSignal(this.turnSignal, steer, dt);
    if ((this.turnSignal.active !== 0) !== (before !== 0)) this.audio.setIndicator(this.turnSignal.active !== 0);
    if (!starting) {
      if (inputs.forward || inputs.backward) {
        this.wasAccelerating = true;
        this.audio.playDriveSound(next.speed);
      } else if (this.wasAccelerating) {
        this.wasAccelerating = false;
        this.audio.playStopSound();
      }
    }

    // Driver-seat camera: car orientation, then the head look inside the cabin.
    this.pivot.updateMatrixWorld(true);
    this.camera.position.copy(this.pivot.localToWorld(this.seat.copy(SEAT_EYE)));
    this.lookEuler.set(this.cockpitPitch, Math.PI + this.cockpitYaw, 0, 'YXZ');
    this.camera.quaternion.copy(this.pivot.quaternion).multiply(this.look.setFromEuler(this.lookEuler));

    const now = performance.now();
    if (now - this.lastStats > 100) {
      this.lastStats = now;
      this.onStats({
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        speed: Math.abs(next.speed),
        isDriving: true,
        isNearCar: false,
        carSpeed: Math.abs(next.speed),
        carGear: starting ? 'P' : next.gear,
        isEngineStarting: starting,
      });
    }
  }

  /** Telemetry fields for the walking HUD. */
  walkingStats(): HueVehicleStats {
    return { isDriving: false, isNearCar: this.isNearCar, carSpeed: 0, carGear: this.state.gear, isEngineStarting: false };
  }

  /** Follow the world's environment brightness (e.g. 0.4 at night). */
  setEnvironmentIntensity(intensity: number) {
    this.envIntensity = intensity;
    for (const m of this.carMaterials) m.envMapIntensity = CAR_ENV_INTENSITY * intensity;
  }

  private applyStudioEnvironment() {
    if (!this.envTarget) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.envTarget = pmrem.fromScene(room, 0.04);
      room.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
      pmrem.dispose();
    }
    for (const m of this.carMaterials) {
      m.envMap = this.envTarget.texture;
      m.envMapIntensity = CAR_ENV_INTENSITY * this.envIntensity;
      m.needsUpdate = true;
    }
  }

  pauseAudio() {
    this.audio.pause();
  }
  resumeAudio() {
    this.audio.resume();
  }

  dispose() {
    this.disposed = true;
    if (this.engineTimer) window.clearTimeout(this.engineTimer);
    this.audio.stopAll();
    this.audio.dispose();
    for (const m of this.carMaterials) m.envMap = null;
    this.carMaterials.clear();
    this.envTarget?.dispose();
    this.envTarget = null;
    if (this.pivot) {
      this.scene.remove(this.pivot);
      disposeObject(this.pivot);
      this.pivot = null;
    }
    this.steeringPivot = null;
  }

  private canOccupy(x0: number, z0: number, x1: number, z1: number, yaw: number) {
    if (x0 === x1 && z0 === z1) return true;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const footY = getWalkableHeight(x0, z0);
    for (const o of BODY_PROBES) {
      const ax = x0 + fx * o;
      const az = z0 + fz * o;
      const bx = x1 + fx * o;
      const bz = z1 + fz * o;
      if (!canDriveTo(ax, az, bx, bz)) return false;
      // Blocked only when a collider pushes the probe back against the direction of travel.
      // A car already touching a wall can still drive or reverse away from it.
      const res = this.collision.resolveMovement(ax, az, bx, bz, footY, BODY_PROBE_RADIUS, 1.4);
      if (res.collided) {
        const mx = bx - ax;
        const mz = bz - az;
        const len = Math.hypot(mx, mz) || 1;
        const pushBack = ((res.newX - bx) * mx + (res.newZ - bz) * mz) / len;
        if (pushBack < -0.002) return false;
      }
    }
    return true;
  }

  private applyPose(groundPitch?: number, groundRoll?: number) {
    if (!this.pivot) return;
    const [x, y, z] = this.state.position;
    // slightly larger than the body so no blade tip shows through the sills
    this.onFootprint?.(x, z, this.state.yaw, BODY_HALF_WIDTH + 0.1, BODY_HALF_LENGTH + 0.15);
    const pose =
      groundPitch === undefined || groundRoll === undefined ? carGroundPose(x, z, this.state.yaw) : null;
    this.pivot.position.set(x, y, z);
    this.pivot.rotation.set(
      (groundPitch ?? pose!.pitch) + this.state.pitch,
      this.state.yaw,
      (groundRoll ?? pose!.roll) + this.state.roll,
      'YXZ',
    );
  }

  /** Car-local offset (+X driver side, +Z forward) to world XZ. */
  private localToWorldXZ(lx: number, lz: number): [number, number] {
    const yaw = this.state.yaw;
    const [cx, , cz] = this.state.position;
    return [cx + lx * Math.cos(yaw) + lz * Math.sin(yaw), cz - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
  }
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      for (const [k, v] of Object.entries(m)) if (k !== 'envMap' && v instanceof THREE.Texture) v.dispose();
      m.dispose();
    }
  });
}

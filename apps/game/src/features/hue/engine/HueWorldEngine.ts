import * as THREE from 'three';
import { setMaxAnisotropy } from './materials/HueSurface';
import {
  ATMOSPHERE_PRESETS,
  getWalkableHeight,
  HUE_LANDMARKS,
  WORLD_SIZE,
} from '../world/hueWorldConfig';
import type {
  AtmosphereId,
  LandmarkDef,
} from '../world/hueWorldConfig';
import { createHueMaterialFoundry } from './materials/HueMaterialFoundry';
import type { HueMaterialSet } from './materials/HueMaterialFoundry';
import { buildHueTerrainAndFlora } from './terrain/HueTerrainAndFlora';
import { createHueAtmosphereAndWater } from './shaders/HueAtmosphereAndWater';
import { buildThienMuComplex } from '../world/monuments/buildThienMuComplex';
import { buildKhaiDinhTomb } from '../world/monuments/buildKhaiDinhTomb';
import { buildTuDucLakeComplex } from '../world/monuments/buildTuDucLakeComplex';
import { buildTrangTienBridge } from '../world/monuments/buildTrangTienBridge';
import { buildThanhToanAndVillage } from '../world/monuments/buildThanhToanAndVillage';
import { buildKimLongGardenAndBoats } from '../world/monuments/buildKimLongGardenAndBoats';
import type { LanternHandle } from '../world/monuments/hueArchitecturalHelpers';
import { createHueParticles } from './HueParticles';
import { HueAmbientAudio } from './audio/HueAmbientAudio';
import { HueFirstPersonArms } from './HueFirstPersonArms';
import type { PlayerControlsState } from '../../player';
import { HueCollisionSystem } from './collision/HueCollisionSystem';
import { populateHueWorldColliders } from './collision/HueWorldColliders';

export type MovementMode = 'walk' | 'fly' | 'boat';

export interface PlayerControlsProvider {
  keysRef: React.RefObject<PlayerControlsState>;
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
  togglePointerLock?: () => void;
}

export interface PlayerStats {
  position: [number, number, number];
  speed: number;
  isSprinting: boolean;
  isGrounded: boolean;
  isBlocking?: boolean;
}

export interface EngineCallbacks {
  onZoneChange?: (landmark: LandmarkDef | null) => void;
  onBellNear?: (near: boolean) => void;
  onModeChange?: (mode: MovementMode) => void;
  onBellRung?: () => void;
  onReady?: () => void;
  onPointerLockChange?: (locked: boolean) => void;
  onStatsUpdate?: (stats: PlayerStats) => void;
}

interface LandmarkChunk {
  id: string;
  name: string;
  group: THREE.Group;
  center: THREE.Vector3;
  streamDist: number;
  lanterns: LanternHandle[];
  interiorLights?: THREE.PointLight[];
}

export class HueWorldEngine {
  private container: HTMLElement;
  private controls: PlayerControlsProvider;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private updateTerrainCamera!: (p: THREE.Vector3) => void;

  private mats: HueMaterialSet;
  private audio = new HueAmbientAudio();
  private arms: HueFirstPersonArms;
  private callbacks: EngineCallbacks;

  private landmarkChunks: LandmarkChunk[] = [];
  private lastStreamCheck = 0;

  private allLanterns: LanternHandle[] = [];
  private interiorLights: THREE.PointLight[] = [];
  private hoaDangGroup!: THREE.Group;
  private hoaDangLights: THREE.PointLight[] = [];
  private bellMesh!: THREE.Group;
  private bellPosition = new THREE.Vector3();
  private bellSwingAmp = 0;
  private bellSwingPhase = 0;

  private updateWind!: (t: number) => void;
  private setTerrainWetness!: (w: number) => void;
  private updateAtmos!: (t: number, camPos: THREE.Vector3) => void;
  private applyAtmosPreset!: (
    preset: (typeof ATMOSPHERE_PRESETS)[AtmosphereId],
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
  ) => void;
  private updateBoats!: (t: number) => void;
  private updateParticles!: (dt: number, t: number, camPos: THREE.Vector3) => void;
  private setRainIntensity!: (r: number) => void;
  private leadBoatGroup!: THREE.Group;

  private currentAtmos: AtmosphereId = 'morning';
  private mode: MovementMode = 'walk';
  private introActive = false;
  private disposed = false;
  private loopPaused = false;
  private rafId = 0;
  private clock = new THREE.Clock();
  private elapsed = 0;
  // Adaptive resolution keeps exploration fluid on modest GPUs
  private maxPixelRatio = 1.5;
  private frameAcc = 0;
  private frameCount = 0;
  private qualityTimer = 0;

  // Player / Camera state
  private yaw = 0;
  private pitch = 0.08;
  private targetYaw = 0;
  private targetPitch = 0.08;
  private velocity = new THREE.Vector3();
  private onGround = true;
  private lastStatsTime = 0;

  // Physical collision system with spatial hash grid
  private collision = new HueCollisionSystem();

  // Zero-allocation reusable math scratch objects for the 60fps animation loop
  private readonly _upAxis = new THREE.Vector3(0, 1, 0);
  private readonly _forward = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();
  private readonly _wishDir = new THREE.Vector3();
  private readonly _moveVec = new THREE.Vector3();
  private readonly _camEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Melee combat aim direction
  private aimDir = new THREE.Vector3();

  // Smooth camera transition glide
  private tween: {
    active: boolean;
    t: number;
    dur: number;
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromQuat: THREE.Quaternion;
    toQuat: THREE.Quaternion;
  } = {
    active: false,
    t: 0,
    dur: 1.05,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    toQuat: new THREE.Quaternion(),
  };

  private activeZoneId: string | null = null;
  private discoveredZones = new Set<string>();
  private wasNearBell = false;

  constructor(
    container: HTMLElement,
    controls: PlayerControlsProvider,
    callbacks: EngineCallbacks = {},
  ) {
    this.container = container;
    this.controls = controls;
    this.callbacks = callbacks;

    // 1. Renderer setup with ACES Filmic & PCFSoftShadowMap
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.maxPixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Unified camera matching PLAYER_CONTROLLER_SPEC.md (FOV 70, near 0.05, far 1800 for 1300m SkyDome)
    this.camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.05,
      1800,
    );
    // Crucial: Camera MUST be in the scene graph for camera children (arms viewmodel) to render!
    this.scene.add(this.camera);

    // 2. High-Performance Direct Hardware Rendering Pipeline
    setMaxAnisotropy(4);

    // 3. Materials, Sky, Water, Terrain & All Huế Heritage Landmarks
    this.mats = createHueMaterialFoundry();
    this.arms = new HueFirstPersonArms(this.camera);

    const atmos = createHueAtmosphereAndWater(this.scene);
    this.updateAtmos = atmos.update;
    this.applyAtmosPreset = atmos.applyAtmosphere;

    const terrain = buildHueTerrainAndFlora();
    this.scene.add(terrain.group);
    this.updateWind = terrain.updateWind;
    this.setTerrainWetness = terrain.setRainWetness;
    this.updateTerrainCamera = terrain.updateCamera;

    const thienMu = buildThienMuComplex(this.mats);
    this.scene.add(thienMu.group);
    this.bellMesh = thienMu.bellMesh;
    this.bellPosition.copy(thienMu.bellPosition);
    this.allLanterns.push(...thienMu.lanterns);

    const khaiDinh = buildKhaiDinhTomb(this.mats);
    this.scene.add(khaiDinh.group);
    this.allLanterns.push(...khaiDinh.lanterns);
    this.interiorLights.push(...khaiDinh.interiorLights);

    const tuDuc = buildTuDucLakeComplex(this.mats);
    this.scene.add(tuDuc.group);
    this.allLanterns.push(...tuDuc.lanterns);

    const trangTien = buildTrangTienBridge(this.mats);
    this.scene.add(trangTien.group);
    this.allLanterns.push(...trangTien.lanterns);

    const thanhToan = buildThanhToanAndVillage(this.mats);
    this.scene.add(thanhToan.group);
    this.allLanterns.push(...thanhToan.lanterns);

    const kimLong = buildKimLongGardenAndBoats(this.mats);
    this.scene.add(kimLong.group);
    this.allLanterns.push(...kimLong.lanterns);
    this.hoaDangGroup = kimLong.hoaDangGroup;
    this.hoaDangLights = kimLong.hoaDangLights;
    this.updateBoats = kimLong.updateBoats;
    this.leadBoatGroup = kimLong.boats[0].group;

    // Professional Distance Streaming & LOD: Only render monuments within active player zone
    this.landmarkChunks = [
      {
        id: 'thien-mu',
        name: 'Chùa Thiên Mụ',
        group: thienMu.group,
        center: new THREE.Vector3(-210, 9.5, -100),
        streamDist: 340,
        lanterns: thienMu.lanterns,
      },
      {
        id: 'khai-dinh',
        name: 'Lăng Khải Định',
        group: khaiDinh.group,
        center: new THREE.Vector3(40, 16, 310),
        streamDist: 280,
        lanterns: khaiDinh.lanterns,
        interiorLights: khaiDinh.interiorLights,
      },
      {
        id: 'tu-duc',
        name: 'Lăng Tự Đức',
        group: tuDuc.group,
        center: new THREE.Vector3(-68, 5.4, 170),
        streamDist: 280,
        lanterns: tuDuc.lanterns,
      },
      {
        id: 'trang-tien',
        name: 'Cầu Trường Tiền',
        group: trangTien.group,
        center: new THREE.Vector3(195, 8.2, 0),
        streamDist: 320,
        lanterns: trangTien.lanterns,
      },
      {
        id: 'thanh-toan',
        name: 'Cầu Ngói Thanh Toàn',
        group: thanhToan.group,
        center: new THREE.Vector3(258, 4.5, 215),
        streamDist: 280,
        lanterns: thanhToan.lanterns,
      },
      {
        id: 'kim-long',
        name: 'Kim Long & Bến Thuyền',
        group: kimLong.group,
        center: new THREE.Vector3(-120, 3.2, -35),
        streamDist: 280,
        lanterns: kimLong.lanterns,
      },
    ];
    this.updateStreamingChunks();

    // Atmospheric Particles (incense smoke + sunbeam dust motes + Mưa Bụi)
    const particles = createHueParticles([
      khaiDinh.incenseOrigin,
      new THREE.Vector3(-210, 11.4, -145), // Điện Đại Hùng incense
      new THREE.Vector3(260, 4.6, 213.5), // Cầu Ngói altar incense
    ]);
    this.scene.add(particles.group);
    this.updateParticles = particles.update;
    this.setRainIntensity = particles.setRainIntensity;

    // 4. Initial Atmosphere & Scenic Opening Position at Chùa Thiên Mụ Courtyard looking at Tháp Phước Duyên
    populateHueWorldColliders(this.collision);
    this.setAtmosphere('morning');
    this.setCameraPose(
      new THREE.Vector3(-210, 6.05, -52),
      new THREE.Vector3(-210, 8.2, -104),
    );

    this.bindEvents();
    this.exposeDebugHook();
    this.animate();
    this.callbacks.onReady?.();
  }

  private setCameraPose(pos: THREE.Vector3, lookTarget: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.camera.lookAt(lookTarget);
    const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = euler.y;
    this.pitch = euler.x;
    this.targetYaw = euler.y;
    this.targetPitch = euler.x;
    this.velocity.set(0, 0, 0);
    this.updateStreamingChunks();
  }

  public beginExploration() {
    this.introActive = false;
    this.flyToLandmark('thien-mu');
  }

  public setAtmosphere(id: AtmosphereId) {
    this.currentAtmos = id;
    const preset = ATMOSPHERE_PRESETS[id];
    this.applyAtmosPreset(preset, this.renderer, this.scene);
    this.setRainIntensity(preset.rainIntensity);
    this.setTerrainWetness(preset.rainIntensity);
    this.mats.setRainWetness(preset.rainIntensity);

    // Tune lantern emissive glow & floating Hoa Đăng visibility
    const glow = preset.lanternGlow;
    this.allLanterns.forEach((l) => {
      l.mat.emissiveIntensity = 0.55 + glow * 1.1;
      if (l.light) l.light.intensity = l.baseIntensity * glow;
    });

    // Cung Thiên Định interior stays warmly lit with rich jewel-tone contrast
    this.interiorLights.forEach((pt, idx) => {
      pt.intensity = (idx === 0 ? 5.2 : 6.4) * (id === 'night' ? 1.35 : 1.0);
    });

    const showHoaDang = id === 'sunset' || id === 'night' || id === 'dawn';
    this.hoaDangGroup.visible = showHoaDang;
    this.hoaDangLights.forEach((pt) => {
      pt.intensity = id === 'night' ? 2.4 : 1.1;
    });
  }

  public setMode(nextMode: MovementMode) {
    this.mode = nextMode;
    this.introActive = false;
    this.tween.active = false;
    this.velocity.set(0, 0, 0);
    this.updateStreamingChunks();
    if (nextMode === 'walk') {
      const groundY = getWalkableHeight(this.camera.position.x, this.camera.position.z);
      if (this.camera.position.y < groundY + 1.6) {
        this.camera.position.y = groundY + 1.85;
      }
    }
    this.callbacks.onModeChange?.(nextMode);
  }

  public flyToLandmark(landmarkId: string) {
    const lm = HUE_LANDMARKS.find((l) => l.id === landmarkId);
    if (!lm) return;

    this.introActive = false;
    if (this.mode === 'boat') {
      this.setMode('walk');
    }

    const toPos = new THREE.Vector3(...lm.position);
    const lookTarget = new THREE.Vector3(...lm.lookAt);

    // Ensure target landmark is immediately streamed in
    const targetChunk = this.landmarkChunks.find((c) => c.id === lm.id || lm.id.startsWith(c.id));
    if (targetChunk) targetChunk.group.visible = true;

    const dummyCam = new THREE.PerspectiveCamera();
    dummyCam.position.copy(toPos);
    dummyCam.lookAt(lookTarget);

    this.tween.active = true;
    this.tween.t = 0;
    this.tween.dur = 1.05;
    this.tween.fromPos.copy(this.camera.position);
    this.tween.toPos.copy(toPos);
    this.tween.fromQuat.copy(this.camera.quaternion);
    this.tween.toQuat.copy(dummyCam.quaternion);
    this.velocity.set(0, 0, 0);
    this.updateStreamingChunks();
  }

  public toggleMute(): boolean {
    return this.audio.toggleMute();
  }

  public isMuted(): boolean {
    return this.audio.isMuted();
  }

  public ringTempleBell() {
    this.bellSwingAmp = 0.24;
    this.bellSwingPhase = 0;
    this.audio.ringDaiHongChung();
    this.callbacks.onBellRung?.();
  }

  public triggerPunch() {
    this.camera.getWorldDirection(this.aimDir);
    // Instant zero-overhead raycast against spatial hash grid colliders
    const hit = this.collision.raycast(this.camera.position, this.aimDir, 2.5);
    this.arms.triggerPunch(hit.hit);
  }

  public toggleCollisionDebug(): boolean {
    return this.collision.toggleDebug(this.scene);
  }

  public isCollisionDebugActive(): boolean {
    return this.collision.isDebugActive();
  }

  public togglePointerLock() {
    this.controls.togglePointerLock?.();
  }

  public requestPointerLock() {
    this.controls.togglePointerLock?.();
  }

  public getPointerLockState(): boolean {
    return Boolean(document.pointerLockElement);
  }

  private bindEvents() {
    const dom = this.renderer.domElement;

    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth;
      const h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyG') {
        this.ringTempleBell();
      } else if (e.code === 'KeyV') {
        this.setMode(this.mode === 'fly' ? 'walk' : 'fly');
      } else if (e.key === 'F3' || (e.ctrlKey && e.code === 'KeyF3')) {
        this.toggleCollisionDebug();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const onWheel = (e: WheelEvent) => {
      // Smooth forward/backward dolly on scroll
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      if (this.mode === 'walk') forward.y = 0;
      forward.normalize();
      this.camera.position.addScaledVector(forward, -e.deltaY * 0.025);
    };
    dom.addEventListener('wheel', onWheel, { passive: true });

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    dom.addEventListener('contextmenu', onContextMenu);

    // Store cleanup on instance
    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContextMenu);
    };
  }

  private cleanupListeners: () => void = () => {};

  private exposeDebugHook() {
    (window as unknown as Record<string, unknown>).__HUE_DEBUG__ = {
      teleportTo: (pos: [number, number, number], lookAt: [number, number, number]) => {
        this.introActive = false;
        this.tween.active = false;
        this.setMode('fly');
        this.setCameraPose(new THREE.Vector3(...pos), new THREE.Vector3(...lookAt));
        this.updateAtmos(this.elapsed, this.camera.position);
        this.updateTerrainCamera(this.camera.position);
        this.renderer.render(this.scene, this.camera);
      },
      setAtmosphere: (id: AtmosphereId) => {
        this.setAtmosphere(id);
        this.renderer.render(this.scene, this.camera);
      },
      toggleCollisionDebug: () => this.toggleCollisionDebug(),
      getColliderCount: () => this.collision.getColliderCount(),
      setMode: (mode: MovementMode) => this.setMode(mode),
      flyToLandmark: (id: string) => this.flyToLandmark(id),
      setLoopPaused: (paused: boolean) => {
        this.loopPaused = paused;
        if (!paused) this.animate();
        else this.renderer.render(this.scene, this.camera);
      },
      renderOnce: () => this.renderer.render(this.scene, this.camera),
      getState: () => ({
        position: this.camera.position.toArray(),
        atmos: this.currentAtmos,
        mode: this.mode,
      }),
    };
  }

  private updateCameraAndMovement(dt: number) {
    if (this.introActive) {
      // Serene opening aerial drift across Sông Hương framing Tháp Phước Duyên cleanly
      const angle = this.elapsed * 0.075;
      const cx = -172 + Math.sin(angle) * 22;
      const cz = -14 + Math.cos(angle) * 12;
      const cy = 11.4 + Math.sin(this.elapsed * 0.25) * 0.9;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(-210, 17.2, -104);
      return;
    }

    if (this.tween.active) {
      this.tween.t += dt / this.tween.dur;
      const t = Math.min(1, this.tween.t);
      // Cubic ease-in-out
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, ease);
      this.camera.quaternion.slerpQuaternions(
        this.tween.fromQuat,
        this.tween.toQuat,
        ease,
      );
      if (t >= 1) {
        this.tween.active = false;
        const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.yaw = euler.y;
        this.pitch = euler.x;
      }
      return;
    }

    // 1. Mouse look with silky exponential interpolation (exact match to FirstPersonPlayer)
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

    if (this.mode === 'boat') {
      // Ride smoothly on the bow deck of the lead Thuyền Rồng!
      const bowLocal = new THREE.Vector3(4.5, 2.35, 0);
      bowLocal.applyMatrix4(this.leadBoatGroup.matrixWorld);
      this.camera.position.copy(bowLocal);
      return;
    }

    const keys = this.controls.keysRef.current;
    this._forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);

    if (this.mode === 'fly') {
      const speed = keys.sprint ? 42 : 17;
      this._moveVec.set(0, 0, 0);
      if (keys.forward) this._moveVec.add(this._forward);
      if (keys.backward) this._moveVec.sub(this._forward);
      if (keys.right) this._moveVec.add(this._right);
      if (keys.left) this._moveVec.sub(this._right);
      if (keys.jump) this._moveVec.y += 1;

      if (this._moveVec.lengthSq() > 0) this._moveVec.normalize();
      this.velocity.lerp(this._moveVec.multiplyScalar(speed), Math.min(1, dt * 8));
      this.camera.position.addScaledVector(this.velocity, dt);

      const minH = getWalkableHeight(this.camera.position.x, this.camera.position.z) + 0.8;
      if (this.camera.position.y < minH) this.camera.position.y = minH;
    } else {
      // 2. Action Triggers (Exact match to FirstPersonPlayer)
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
        this.arms.triggerInteract();
        if (this.wasNearBell) {
          this.ringTempleBell();
        }
      }

      const inspectTriggered = this.controls.consumeInspectTrigger();
      if (inspectTriggered && !this.arms.isPunchingActive() && !blocking) {
        this.arms.triggerInspect();
      }

      // 3. Locomotion Movement Direction (relative to camera yaw)
      const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const moveZ = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
      const hasInput = moveX !== 0 || moveZ !== 0;

      const sprinting = hasInput && keys.sprint && this.onGround && !blocking && moveZ > 0;

      // Locomotion Speeds: Walk = 4.2 m/s, Sprint = 8.2 m/s, Block = 2.0 m/s
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

      // Jump & Gravity: Gravity = -24.0, Jump force = 7.2
      const GRAVITY = -24.0;
      const JUMP_FORCE = 7.2;

      if (keys.jump && this.onGround && !blocking) {
        this.velocity.y = JUMP_FORCE;
        this.onGround = false;
      }

      // Horizontal displacement with physical collision & continuous wall sliding
      const currX = this.camera.position.x;
      const currZ = this.camera.position.z;
      const targetX = currX + this.velocity.x * dt;
      const targetZ = currZ + this.velocity.z * dt;

      const footY = this.camera.position.y - 1.85;
      const colRes = this.collision.resolveMovement(
        currX,
        currZ,
        targetX,
        targetZ,
        footY,
        0.35,
        1.85,
      );

      this.camera.position.x = colRes.newX;
      this.camera.position.z = colRes.newZ;

      if (colRes.collided) {
        // Project velocity onto wall tangent for silky wall sliding
        const nx = colRes.hitNormalX;
        const nz = colRes.hitNormalZ;
        const vDotN = this.velocity.x * nx + this.velocity.z * nz;
        if (vDotN < 0) {
          this.velocity.x -= vDotN * nx;
          this.velocity.z -= vDotN * nz;
        }
      }

      // Ground height at current (X, Z) with adult eye height (1.85m)
      const groundFloor = getWalkableHeight(this.camera.position.x, this.camera.position.z);
      const targetFloorY = Math.max(0.65, groundFloor + 1.85);

      if (this.onGround) {
        // Player is grounded: follow slopes and stairs smoothly without floating
        const delta = targetFloorY - this.camera.position.y;
        if (delta >= -1.25 && delta <= 0.85) {
          // Walked up or down a natural slope/stairs: stick firmly to the ground
          this.camera.position.y = targetFloorY;
          this.velocity.y = 0;
        } else if (delta < -1.25) {
          // Stepped off a high cliff/terrace drop: leave ground and fall
          this.onGround = false;
          this.velocity.y = 0;
        } else {
          // Upward step within step height
          this.camera.position.y = targetFloorY;
          this.velocity.y = 0;
        }
      }

      if (!this.onGround) {
        // Apply gravitational acceleration
        this.velocity.y += GRAVITY * dt;
        this.camera.position.y += this.velocity.y * dt;

        // Ground landing check
        if (this.camera.position.y <= targetFloorY) {
          this.camera.position.y = targetFloorY;
          this.velocity.y = 0;
          this.onGround = true;
        }
      }
    }

    // Clamp to playable Hue valley bounds
    const bound = WORLD_SIZE * 0.45;
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -bound, bound);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -bound, bound);
  }

  private checkLandmarksAndProximity() {
    let found: LandmarkDef | null = null;
    const cp = this.camera.position;
    for (const lm of HUE_LANDMARKS) {
      const dist = Math.hypot(cp.x - lm.zoneCenter[0], cp.z - lm.zoneCenter[2]);
      if (dist <= lm.zoneRadius) {
        // Prefer interior Cung Thiên Định over general Khải Định when inside chamber!
        if (!found || lm.zoneRadius < found.zoneRadius) {
          found = lm;
        }
      }
    }

    const nextId = found?.id ?? null;
    if (nextId !== this.activeZoneId) {
      this.activeZoneId = nextId;
      this.callbacks.onZoneChange?.(found);
      if (found && !this.discoveredZones.has(found.id)) {
        this.discoveredZones.add(found.id);
        this.audio.playDiscoveryChime();
      }
    }

    const nearBell = cp.distanceTo(this.bellPosition) < 28;
    if (nearBell !== this.wasNearBell) {
      this.wasNearBell = nearBell;
      this.callbacks.onBellNear?.(nearBell);
    }
  }

  /**
   * Distance Streaming & Dynamic LOD:
   * Only renders monuments within active zone distance. Points lights beyond 75m
   * are hidden to eliminate rasterization fill rate overhead.
   */
  public updateStreamingChunks() {
    const cp = this.camera.position;
    for (const chunk of this.landmarkChunks) {
      const dist = Math.hypot(cp.x - chunk.center.x, cp.z - chunk.center.z);
      const maxDist = this.mode === 'fly' ? chunk.streamDist * 1.5 : chunk.streamDist;
      const isVisible = dist <= maxDist;
      chunk.group.visible = isVisible;

      // Distance culling for point lights: only active within 75m to save GPU fill rate
      const lightsActive = isVisible && dist <= 75;
      chunk.lanterns.forEach((l) => {
        if (l.light) l.light.visible = lightsActive;
      });
      if (chunk.interiorLights) {
        chunk.interiorLights.forEach((pt) => {
          pt.visible = lightsActive;
        });
      }
    }
  }

  private animate = () => {
    if (this.disposed || this.loopPaused) return;
    this.rafId = requestAnimationFrame(this.animate);

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    this.updateBoats(this.elapsed);
    this.updateCameraAndMovement(dt);
    this.updateWind(this.elapsed);
    this.updateAtmos(this.elapsed, this.camera.position);
    this.updateTerrainCamera(this.camera.position);
    this.updateParticles(dt, this.elapsed, this.camera.position);

    // Throttled distance chunk streaming check (every 150ms)
    const nowMs = performance.now();
    if (nowMs - this.lastStreamCheck > 150) {
      this.lastStreamCheck = nowMs;
      this.updateStreamingChunks();
    }

    // Subtle bell oscillation after ringing Đại Hồng Chung
    if (this.bellSwingAmp > 0.001) {
      this.bellSwingPhase += dt * 4.2;
      this.bellMesh.rotation.x = Math.sin(this.bellSwingPhase) * this.bellSwingAmp;
      this.bellSwingAmp *= Math.exp(-dt * 0.45);
    } else {
      this.bellMesh.rotation.x = 0;
    }

    // Subtle candle flicker inside Cung Thiên Định
    this.interiorLights.forEach((pt, idx) => {
      const base = idx === 0 ? 5.2 : 6.4;
      const mult = this.currentAtmos === 'night' ? 1.35 : 1.0;
      pt.intensity =
        base *
        mult *
        (0.95 + 0.05 * Math.sin(this.elapsed * 7.5 + idx * 2.1));
    });

    this.checkLandmarksAndProximity();
    const keys = this.controls.keysRef.current;
    const isMoving = Boolean(keys.forward || keys.backward || keys.left || keys.right);
    const isSprinting = isMoving && Boolean(keys.sprint) && !this.arms.isBlockingActive();
    this.arms.update(dt, isMoving, isSprinting, this.mode, this.introActive);

    // Live HUD stats telemetry callback throttled to 120ms
    const now = performance.now();
    if (now - this.lastStatsTime > 120) {
      this.lastStatsTime = now;
      const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      this.callbacks.onStatsUpdate?.({
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        speed: horizontalSpeed,
        isSprinting: isSprinting,
        isGrounded: this.onGround,
        isBlocking: this.arms.isBlockingActive(),
      });
    }

    this.adaptQuality(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private adaptQuality(dt: number) {
    this.frameAcc += dt;
    this.frameCount++;
    this.qualityTimer += dt;
    if (this.qualityTimer < 2.0) return;
    const avg = this.frameAcc / Math.max(1, this.frameCount);
    this.frameAcc = 0;
    this.frameCount = 0;
    this.qualityTimer = 0;
    const cur = this.renderer.getPixelRatio();
    let next = cur;
    if (avg > 1 / 38) next = Math.max(0.6, cur - 0.15);
    else if (avg < 1 / 57) next = Math.min(this.maxPixelRatio, cur + 0.1);
    if (Math.abs(next - cur) > 0.01) {
      this.renderer.setPixelRatio(next);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.cleanupListeners();
    this.collision.clear();
    this.audio.dispose();
    this.arms.dispose();

    // Deeply traverse and release all geometries, materials, and textures from GPU VRAM
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
      const mat = (obj as THREE.Mesh).material;
      if (mat) {
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            m.dispose();
            for (const key of Object.keys(m)) {
              const val = (m as unknown as Record<string, unknown>)[key];
              if (val && typeof (val as THREE.Texture).dispose === 'function') {
                (val as THREE.Texture).dispose();
              }
            }
          });
        } else {
          mat.dispose();
          for (const key of Object.keys(mat)) {
            const val = (mat as unknown as Record<string, unknown>)[key];
            if (val && typeof (val as THREE.Texture).dispose === 'function') {
              (val as THREE.Texture).dispose();
            }
          }
        }
      }
    });
    this.scene.clear();

    // Crucial: Force WebGL context loss to ensure Chrome/Metal immediately purges GPU memory
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

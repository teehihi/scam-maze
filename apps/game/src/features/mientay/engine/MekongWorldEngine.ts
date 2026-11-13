/// <reference path="../n8ao.d.ts" />
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { N8AOPass } from 'n8ao';
import { CharacterRuntime, type PlayerControlsState, type PlayerStats } from '../../player';
import {
  clearWorldCollisionRegistry,
  sampleTerrainHeight,
  sampleWalkableHeight,
} from '../world/terrain/MekongHeightfield';
import { MekongMaterialLibrary } from '../world/materials/ProceduralPBR';
import { createMekongTerrain } from '../world/terrain/MekongTerrain';
import { createMekongWater, sampleRiverWave } from '../world/water/MekongWater';
import { createMekongAtmosphere } from '../world/atmosphere/MekongSky';
import { createMekongFlora } from '../world/foliage/MekongFlora';
import { createBoatsSystem } from '../world/architecture/Boats';
import { createStiltVillage } from '../world/architecture/StiltVillage';
import { createHeritageMansion } from '../world/architecture/HeritageMansion';
import { createKhmerShrine } from '../world/architecture/KhmerShrine';
import { createBridgesAndLife } from '../world/architecture/BridgesAndLife';
import { MekongAudioEngine } from '../world/audio/MekongAudio';
import { clamp, lerp } from '../world/math/Noise';
import { freezeStaticTransforms, mergeStaticMeshes } from '../world/optimize/mergeStaticMeshes';
import type { MientayZoneId } from '../placeNames';
import { DEFAULT_BOOKMARK, WORLD_BOOKMARKS, type TraversalMode, type WorldBookmark } from './bookmarks';
import { MekongWorldAdapter } from './MekongWorldAdapter';

export type { TraversalMode, WorldBookmark } from './bookmarks';
export type { PlayerStats } from '../../player';

/** Steps shown on the loading screen, in build order, with their share of the progress bar. */
export const LOAD_STAGES = [
  { id: 'renderer', weight: 1 },
  { id: 'materials', weight: 2 },
  { id: 'terrain', weight: 4 },
  { id: 'water', weight: 2 },
  { id: 'flora', weight: 12 },
  { id: 'boats', weight: 8 },
  { id: 'village', weight: 8 },
  { id: 'mansion', weight: 8 },
  { id: 'shrine', weight: 6 },
  { id: 'bridges', weight: 6 },
  { id: 'optimize', weight: 5 },
  { id: 'pipeline', weight: 4 },
  { id: 'shaders', weight: 24 },
] as const;

export type LoadStageId = (typeof LOAD_STAGES)[number]['id'];

export interface LoadProgress {
  stage: LoadStageId;
  /** 0..1 across the whole build; reaches 1 when the world is ready. */
  fraction: number;
}

export interface MekongTelemetry {
  mode: TraversalMode;
  nearBoat: boolean;
  zone: MientayZoneId;
  timeOfDay: number;
  audioOn: boolean;
  performanceMode: boolean;
}

export interface MekongControls {
  keysRef: React.RefObject<PlayerControlsState>;
  consumeMovement: () => { x: number; y: number };
  consumePunchTrigger: () => boolean;
  consumeInspectTrigger: () => boolean;
  consumeInteractTrigger: () => boolean;
}

export interface MekongEngineCallbacks {
  onProgress?: (progress: LoadProgress) => void;
  onTelemetry?: (telemetry: MekongTelemetry) => void;
  onStatsUpdate?: (stats: PlayerStats) => void;
  /** Frames per second, about twice a second. */
  onFps?: (fps: number) => void;
}

export interface MekongEngineOptions {
  /** Vertical field of view in degrees. */
  fov: number;
  /** "low" starts in performance mode; "medium" and "high" keep every effect at full quality. */
  graphicsQuality: 'low' | 'medium' | 'high';
  soundEnabled: boolean;
}

/** Thrown inside the staged build when the page unmounts before the world is ready. */
class BuildCancelled extends Error {
  constructor() {
    super('Mekong world build cancelled');
  }
}

/**
 * Lets the browser paint (and handle input) between build stages. Falls back to a timer when the
 * tab is hidden, and never waits more than ~60 ms, so a throttled animation frame cannot stall
 * the build.
 */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    if (!document.hidden) requestAnimationFrame(() => setTimeout(finish, 0));
    setTimeout(finish, 60);
  });
}

/** First light of the day, as in the original explorer. */
const DEFAULT_START_HOURS = 6.9;
const EYE_HEIGHT_SEAT = 1.15;
/** The planar water reflection is redrawn every N frames; the other frames reuse it. */
const REFLECTION_INTERVAL = 2;
/**
 * Render scale of the whole post-processing chain, relative to CSS pixels. 1.0 is what the
 * prototype always used (on a Retina screen the browser upscales it), and it is the biggest
 * single saving: 1.5 meant 2.25x the pixels for ambient occlusion, bloom and the scene itself.
 */
const MAX_PIXEL_RATIO = 1.0;
const MIN_PIXEL_RATIO = 0.7;
/** The performance mode renders at this scale. */
const PERFORMANCE_PIXEL_RATIO = 0.8;
const PIXEL_RATIO_STEP = 0.15;
/** A display refreshing faster than this interval (ms) gets every other frame, i.e. 60 per second. */
const HIGH_REFRESH_INTERVAL_MS = 11;
const MOUSE_SENSITIVITY = 0.0022;

export class MekongWorldEngine {
  private readonly container: HTMLElement;
  private readonly controls: MekongControls;
  private readonly callbacks: MekongEngineCallbacks;
  private readonly options: MekongEngineOptions;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private composer!: EffectComposer;
  private n8aoPass!: N8AOPass;
  private bloomPass!: UnrealBloomPass;

  private mats!: MekongMaterialLibrary;
  private atmosphere!: ReturnType<typeof createMekongAtmosphere>;
  private terrain!: ReturnType<typeof createMekongTerrain>;
  private water!: ReturnType<typeof createMekongWater>;
  private flora!: ReturnType<typeof createMekongFlora>;
  private boats!: ReturnType<typeof createBoatsSystem>;
  private stiltVillage!: ReturnType<typeof createStiltVillage>;
  private mansion!: ReturnType<typeof createHeritageMansion>;
  private shrine!: ReturnType<typeof createKhmerShrine>;
  private bridgesAndLife!: ReturnType<typeof createBridgesAndLife>;
  private audio = new MekongAudioEngine();
  private adapter = new MekongWorldAdapter();
  private character!: CharacterRuntime;
  private grassMesh: THREE.Object3D | null = null;

  private mode: TraversalMode = 'walk';
  private boatSpeed = 0;
  private boatHeading = Math.PI * 0.9;
  private lookYaw = 0;
  private lookPitch = 0;
  private readonly lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  private disposed = false;
  private loopPaused = false;
  private rafId = 0;
  private readonly clock = new THREE.Clock();
  private elapsed = 0;
  private frameIndex = 0;
  private reflectionDue = true;
  private shadowRefreshPending = true;

  // Adaptive resolution: never below 1.0, so close-up textures stay crisp.
  private pixelRatio = 1;
  private maxPixelRatio = MAX_PIXEL_RATIO;
  private aoHalfRes = false;
  private performanceMode = false;
  private qualityFrameAcc = 0;
  private qualityFrameCount = 0;
  private qualityTimer = 0;
  private slowWindows = 0;
  private fastWindows = 0;
  private upgradesLocked = false;
  private lastQualityMove: 'none' | 'down' | 'up' = 'none';
  /** Values the next frame will switch to; applied right before drawing (see commitQuality). */
  private targetPixelRatio = 1;
  private aoDirty = false;

  private fpsFrames = 0;
  private fpsTimer = 0;
  private currentFps = 60;
  private telemetryTimer = 0;
  private audioTimer = 0;
  private lastTelemetryKey = '';
  private userMutedAudio = false;
  private lastBoatStatsMs = 0;
  private lastRafMs = 0;
  private refreshIntervalMs = 16.7;
  private skipThisFrame = false;

  private readonly buildTimings: Partial<Record<LoadStageId, number>> = {};
  private readonly mergeStats = { removed: 0, created: 0 };
  private cleanupListeners: () => void = () => {};

  private constructor(
    container: HTMLElement,
    controls: MekongControls,
    callbacks: MekongEngineCallbacks,
    options: MekongEngineOptions,
  ) {
    this.container = container;
    this.controls = controls;
    this.callbacks = callbacks;
    this.options = options;
  }

  /**
   * Builds the world in stages, yielding to the browser between them so the loading screen keeps
   * painting, then compiles every shader in parallel before the first frame. Rejects (after
   * cleaning up) when `signal` aborts first.
   */
  static async create(
    container: HTMLElement,
    controls: MekongControls,
    callbacks: MekongEngineCallbacks,
    options: MekongEngineOptions,
    signal?: AbortSignal,
  ): Promise<MekongWorldEngine> {
    const engine = new MekongWorldEngine(container, controls, callbacks, options);
    try {
      await engine.build(signal);
      return engine;
    } catch (error) {
      engine.dispose();
      throw error;
    }
  }

  static isCancelled(error: unknown): boolean {
    return error instanceof BuildCancelled;
  }

  // ---------------------------------------------------------------------------------------
  // Staged build
  // ---------------------------------------------------------------------------------------

  private async build(signal?: AbortSignal): Promise<void> {
    const totalWeight = LOAD_STAGES.reduce((sum, stage) => sum + stage.weight, 0);
    let doneWeight = 0;

    const run = async (id: LoadStageId, work: () => void | Promise<void>) => {
      if (signal?.aborted || this.disposed) throw new BuildCancelled();
      const weight = LOAD_STAGES.find((stage) => stage.id === id)?.weight ?? 1;
      // Report first and let the browser paint, so the label matches the work being done.
      this.callbacks.onProgress?.({ stage: id, fraction: doneWeight / totalWeight });
      await yieldToPaint();
      if (signal?.aborted || this.disposed) throw new BuildCancelled();
      const start = performance.now();
      await work();
      this.buildTimings[id] = Math.round(performance.now() - start);
      doneWeight += weight;
    };

    const container = this.container;
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    await run('renderer', () => {
      clearWorldCollisionRegistry();
      this.performanceMode = this.options.graphicsQuality === 'low';
      this.maxPixelRatio = this.performanceMode ? PERFORMANCE_PIXEL_RATIO : MAX_PIXEL_RATIO;
      // Ambient occlusion always runs at half resolution with depth-aware upsampling: it looks
      // the same at this strength and costs about a quarter.
      this.aoHalfRes = true;
      this.pixelRatio = this.maxPixelRatio;
      this.targetPixelRatio = this.maxPixelRatio;

      // The post-processing chain does its own anti-aliasing-free HDR work, so the canvas itself
      // is plain; the linear HDR buffer is tone-mapped once, by OutputPass.
      this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(width, height);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.88;
      container.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(this.options.fov, width / height, 0.05, 560);
      this.camera.rotation.order = 'YXZ';
      // The camera must be in the scene graph so the arms viewmodel (a camera child) is drawn.
      this.scene.add(this.camera);
    });

    await run('materials', () => {
      this.mats = new MekongMaterialLibrary();
      this.atmosphere = createMekongAtmosphere(this.scene, this.camera, 2048);
    });

    await run('terrain', () => {
      this.terrain = createMekongTerrain();
      this.scene.add(this.terrain.group);
    });

    await run('water', () => {
      this.water = createMekongWater(this.terrain.heightDataTex);
      this.scene.add(this.water.mesh);
    });

    await run('flora', () => {
      this.flora = createMekongFlora(this.mats);
      this.scene.add(this.flora.group);
      this.grassMesh = this.flora.group.getObjectByName('MekongRiverGrass') ?? null;
    });

    await run('boats', () => {
      this.boats = createBoatsSystem(this.mats);
      this.scene.add(this.boats.group);
    });

    await run('village', () => {
      this.stiltVillage = createStiltVillage(this.mats);
      this.scene.add(this.stiltVillage.group);
    });

    await run('mansion', () => {
      this.mansion = createHeritageMansion(this.mats);
      this.scene.add(this.mansion.group);
    });

    await run('shrine', () => {
      this.shrine = createKhmerShrine(this.mats);
      this.scene.add(this.shrine.group);
    });

    await run('bridges', () => {
      this.bridgesAndLife = createBridgesAndLife(this.mats);
      this.scene.add(this.bridgesAndLife.group);
    });

    await run('optimize', () => {
      // Same pixels, far fewer draw calls: static pieces that share a material are baked together
      // (per ground cell, so frustum culling still works), and each boat and floating plant is
      // merged inside itself so it still bobs and drifts as one unit. Every draw call is repeated
      // for the three shadow cascades and the water reflection, so this is the biggest saving.
      for (const child of this.boats.group.children) {
        if (child.type === 'Group') child.userData.rigid = true;
      }
      for (const group of [
        this.flora.group,
        this.boats.group,
        this.stiltVillage.group,
        this.mansion.group,
        this.shrine.group,
        this.bridgesAndLife.group,
      ]) {
        const merged = mergeStaticMeshes(group);
        this.mergeStats.removed += merged.removed;
        this.mergeStats.created += merged.created;
        freezeStaticTransforms(group);
      }
      // Cascaded shadows on every standard material, then the starting time of day.
      this.atmosphere.applyCSMToScene(this.scene);
      this.atmosphere.setTimeOfDay(DEFAULT_START_HOURS, this.renderer, true);
    });

    await run('pipeline', () => {
      // N8AO (linear HDR) -> subtle bloom -> OutputPass (ACES + sRGB). The composer works at the
      // adaptive pixel ratio, so the picture is as sharp as the canvas.
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(width, height);

      this.n8aoPass = new N8AOPass(this.scene, this.camera, width, height);
      this.n8aoPass.configuration.gammaCorrection = false; // OutputPass handles tone mapping + sRGB
      this.n8aoPass.configuration.aoRadius = 2.4;
      this.n8aoPass.configuration.distanceFalloff = 0.85;
      this.n8aoPass.configuration.intensity = 2.1;
      this.n8aoPass.configuration.color = new THREE.Color(0x1f1912);
      this.applyAmbientOcclusionQuality();
      this.composer.addPass(this.n8aoPass);

      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.09, 0.28, 2.2);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());

      // Walking, flying and the arms use the same runtime as the other maps.
      this.character = new CharacterRuntime({
        camera: this.camera,
        adapter: this.adapter,
        controls: {
          keysRef: this.controls.keysRef as unknown as { current: PlayerControlsState },
          consumeMovement: this.controls.consumeMovement,
          consumePunchTrigger: this.controls.consumePunchTrigger,
          consumeInspectTrigger: this.controls.consumeInspectTrigger,
          consumeInteractTrigger: this.controls.consumeInteractTrigger,
        },
        soundEnabled: this.options.soundEnabled,
        onStatsUpdate: (stats) => this.callbacks.onStatsUpdate?.(stats),
      });
      this.applyBookmark(DEFAULT_BOOKMARK);
      this.bindEvents();
      this.exposeDebugHook();
    });

    await run('shaders', async () => {
      // Compile every program in parallel (KHR_parallel_shader_compile), then draw two warm-up
      // frames behind the loading screen so post-processing and the water reflection are ready.
      this.updateWorldSystems(0.016);
      try {
        await this.renderer.compileAsync(this.scene, this.camera);
      } catch {
        // Compilation falls back to the first draw call.
      }
      await yieldToPaint();
      this.uploadEverythingToGpu();
      await yieldToPaint();
      this.reflectionDue = true;
      this.renderFrame(0.016);
      await yieldToPaint();
      this.reflectionDue = true;
      this.renderFrame(0.016);
    });

    if (signal?.aborted || this.disposed) throw new BuildCancelled();
    this.callbacks.onProgress?.({ stage: 'shaders', fraction: 1 });
    this.clock.getDelta();
    this.emitTelemetry(true);
    this.animate();
  }

  /**
   * Geometry buffers and textures are normally sent to the GPU the first time an object is drawn,
   * which is when it first comes into view: a hitch each time the player turns toward something
   * new. Drawing the whole scene once with culling off, behind the loading screen, pays that cost
   * up front.
   */
  private uploadEverythingToGpu(): void {
    const culled: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (object.frustumCulled && (object as THREE.Mesh).isMesh) {
        object.frustumCulled = false;
        culled.push(object);
      }
    });
    try {
      this.renderer.render(this.scene, this.camera);
    } finally {
      for (const object of culled) object.frustumCulled = true;
    }
  }

  // ---------------------------------------------------------------------------------------
  // Public controls
  // ---------------------------------------------------------------------------------------

  setFov(fov: number): void {
    if (this.disposed || !this.camera || this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Moves the time of day. While a slider is dragged call with `commit = false`: the sky, sun and
   * fog follow at once but the image-based lighting is only re-baked when the value has moved
   * noticeably. Call again with `commit = true` on release to bake it exactly.
   */
  setTimeOfDay(hours: number, commit = true): void {
    if (this.disposed) return;
    this.atmosphere.setTimeOfDay(hours, this.renderer, commit);
    this.shadowRefreshPending = true;
    this.emitTelemetry(true);
  }

  /** Optional lighter mode: lower render scale and the cheapest ambient-occlusion setting. */
  setPerformanceMode(on: boolean): void {
    if (this.disposed) return;
    this.performanceMode = on;
    this.maxPixelRatio = on ? PERFORMANCE_PIXEL_RATIO : MAX_PIXEL_RATIO;
    this.targetPixelRatio = this.maxPixelRatio;
    this.aoDirty = true;
    this.slowWindows = 0;
    this.fastWindows = 0;
    this.emitTelemetry(true);
  }

  isPerformanceMode(): boolean {
    return this.performanceMode;
  }

  toggleAudio(): boolean {
    const on = !this.audio.isEnabled();
    this.userMutedAudio = !on;
    this.audio.setEnabled(on);
    this.emitTelemetry(true);
    return this.audio.isEnabled();
  }

  /** Starts the ambience after the first user gesture, unless the player muted it. */
  startAudioFromGesture(): void {
    if (this.disposed || this.userMutedAudio || !this.options.soundEnabled || this.audio.isEnabled()) return;
    this.audio.setEnabled(true);
    this.emitTelemetry(true);
  }

  setMode(next: TraversalMode): void {
    if (this.disposed || next === this.mode) return;
    const previous = this.mode;
    if (next === 'boat') {
      this.lookYaw = this.character.yaw;
      this.lookPitch = this.character.pitch;
      this.mode = 'boat';
      this.boatSpeed = 0;
      this.boatHeading = this.boats.playerBoat.rotation.y;
      this.character.setFlyMode(false);
      this.character.setStowed(true);
      return;
    }
    this.mode = next;
    if (previous === 'boat') this.leaveBoatCamera();
    this.character.setStowed(false);
    this.character.setFlyMode(next === 'fly');
    this.character.velocity.set(0, 0, 0);
    if (next === 'walk') {
      const eye = this.adapter.eyeHeight;
      const surface = sampleWalkableHeight(this.camera.position.x, this.camera.position.z, this.camera.position.y - eye);
      this.camera.position.y = Math.max(surface.y, 0.3) + eye;
    }
  }

  /** B key: step off the boat, or board it when it is within reach. */
  toggleBoatMode(): void {
    if (this.disposed) return;
    if (this.mode === 'boat') {
      this.disembark();
    } else if (this.isNearBoat()) {
      this.setMode('boat');
    }
  }

  toggleFlyMode(): void {
    this.setMode(this.mode === 'fly' ? 'walk' : 'fly');
  }

  applyBookmark(bm: WorldBookmark): void {
    if (this.disposed) return;
    const eye = this.adapter.eyeHeight;
    this.lookYaw = bm.yaw;
    this.lookPitch = bm.pitch;
    if (bm.mode === 'boat') {
      this.boats.playerBoat.position.set(bm.pos[0], 0, bm.pos[2]);
      this.boatHeading = bm.yaw;
      this.boats.playerBoat.rotation.y = bm.yaw;
      this.boatSpeed = 0;
      this.mode = 'boat';
      this.character.setFlyMode(false);
      this.character.setStowed(true);
      this.placeBoatCamera();
    } else {
      this.mode = 'walk';
      this.character.setFlyMode(false);
      this.character.setStowed(false);
      this.adapter.setFootY(bm.pos[1] - eye);
      const ground = this.adapter.getGroundHeight(bm.pos[0], bm.pos[2]);
      const position = new THREE.Vector3(bm.pos[0], ground + eye, bm.pos[2]);
      this.character.setCameraPose(position, this.lookTarget(position, bm.yaw, bm.pitch));
    }
    this.shadowRefreshPending = true;
    this.reflectionDue = true;
    this.emitTelemetry(true);
  }

  // ---------------------------------------------------------------------------------------
  // Movement helpers
  // ---------------------------------------------------------------------------------------

  private lookTarget(position: THREE.Vector3, yaw: number, pitch: number): THREE.Vector3 {
    const cosPitch = Math.cos(pitch);
    return new THREE.Vector3(
      position.x - Math.sin(yaw) * cosPitch,
      position.y + Math.sin(pitch),
      position.z - Math.cos(yaw) * cosPitch,
    );
  }

  private isNearBoat(): boolean {
    return this.camera.position.distanceTo(this.boats.playerBoat.position) < 6.5;
  }

  /** Seats the camera in the boat, just behind the bow, looking where the mouse points. */
  private placeBoatCamera(): void {
    const boat = this.boats.playerBoat.position;
    const dirX = Math.sin(this.boatHeading);
    const dirZ = Math.cos(this.boatHeading);
    this.camera.position.set(boat.x - dirX * 0.65, boat.y + EYE_HEIGHT_SEAT, boat.z - dirZ * 0.65);
    this.lookEuler.set(this.lookPitch, this.lookYaw, 0);
    this.camera.quaternion.setFromEuler(this.lookEuler);
  }

  /** Hands the camera back to the character runtime so the view does not jump. */
  private leaveBoatCamera(): void {
    this.character.setCameraPose(this.camera.position.clone(), this.lookTarget(this.camera.position, this.lookYaw, this.lookPitch));
  }

  private disembark(): void {
    const eye = this.adapter.eyeHeight;
    const bx = this.boats.playerBoat.position.x;
    const bz = this.boats.playerBoat.position.z;
    const landing = [
      [0, 0],
      [2.5, 0],
      [-2.5, 0],
      [0, 2.5],
      [0, -2.5],
    ] as const;
    for (const [dx, dz] of landing) {
      const surface = sampleWalkableHeight(bx + dx, bz + dz, 3.0);
      const minimum = dx === 0 && dz === 0 ? 0.1 : 0.15;
      if (surface.y > minimum) {
        this.mode = 'walk';
        this.camera.position.set(bx + dx, surface.y + eye, bz + dz);
        this.leaveBoatCamera();
        this.character.setStowed(false);
        this.character.setFlyMode(false);
        return;
      }
    }
    // No bank within reach: float free instead.
    this.mode = 'fly';
    this.leaveBoatCamera();
    this.character.setStowed(false);
    this.character.setFlyMode(true);
  }

  private updateBoat(dt: number): void {
    const keys = this.controls.keysRef.current;
    const look = this.controls.consumeMovement();
    this.lookYaw -= look.x * MOUSE_SENSITIVITY;
    this.lookPitch = clamp(this.lookPitch - look.y * MOUSE_SENSITIVITY, -1.38, 1.38);

    const throttle = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
    const steer = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    this.boatSpeed = lerp(this.boatSpeed, throttle * (keys.sprint ? 8.5 : 4.8), dt * 2.4);
    this.boatHeading += steer * dt * (1.25 + Math.abs(this.boatSpeed) * 0.08);

    const dirX = Math.sin(this.boatHeading);
    const dirZ = Math.cos(this.boatHeading);
    const boat = this.boats.playerBoat.position;
    const candX = clamp(boat.x + dirX * this.boatSpeed * dt, -145, 145);
    const candZ = clamp(boat.z + dirZ * this.boatSpeed * dt, -145, 145);
    // The boat stays in navigable water (deeper than 0.26 m).
    if (sampleTerrainHeight(candX, candZ) < -0.26) {
      boat.x = candX;
      boat.z = candZ;
    } else {
      this.boatSpeed *= -0.25;
    }

    const wave = sampleRiverWave(boat.x, boat.z, this.elapsed);
    boat.y = wave.height - 0.05;
    this.boats.playerBoat.rotation.set(
      wave.slopeZ * 0.65 - this.boatSpeed * 0.015,
      this.boatHeading,
      -wave.slopeX * 0.85,
    );
    this.placeBoatCamera();
    this.character.arms.update(dt, false, false, true);

    // The character runtime is idle in the boat, so report the HUD numbers from here.
    const now = performance.now();
    if (now - this.lastBoatStatsMs > 120) {
      this.lastBoatStatsMs = now;
      this.callbacks.onStatsUpdate?.({
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        speed: Math.abs(this.boatSpeed),
        isSprinting: Boolean(keys.sprint),
        isGrounded: true,
        isBlocking: false,
      });
    }
  }

  private zoneAt(x: number, z: number): MientayZoneId {
    if (x < -30 && z > -28 && z < 36) return 'khmerPagoda';
    if (x > 25 && z > 22 && z < 75) return 'oldHouse';
    if (x > 14 && x < 44 && z >= -18 && z <= 22) return 'stiltVillage';
    if (x > 20 && z <= -32) return 'orchard';
    if (x >= 10 && x <= 26 && z >= 22 && z <= 32) return 'ferryPier';
    if (x > 10 && z > -36 && z < -12) return 'creek';
    return 'floatingMarket';
  }

  // ---------------------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------------------

  private animate = (timestamp: number = performance.now()): void => {
    if (this.disposed || this.loopPaused) return;
    this.rafId = requestAnimationFrame(this.animate);

    // Estimate the display refresh interval. On a 90 Hz or faster display (a MacBook Pro runs at
    // 120 Hz) every other frame is skipped: the picture stays as smooth as 60 Hz needs and the GPU
    // does half the work. Nothing is skipped on a 60 Hz display, so no frame is ever dropped
    // because of timing jitter.
    if (this.lastRafMs > 0) {
      const interval = timestamp - this.lastRafMs;
      if (interval > 0 && interval < 50) this.refreshIntervalMs += (interval - this.refreshIntervalMs) * 0.1;
    }
    this.lastRafMs = timestamp;
    if (this.refreshIntervalMs < HIGH_REFRESH_INTERVAL_MS) {
      this.skipThisFrame = !this.skipThisFrame;
      if (this.skipThisFrame) return;
    }

    const dt = Math.min(0.05, this.clock.getDelta());
    this.renderFrame(dt);
    this.afterFrame(dt);
  };

  /** Everything that moves or changes colour, without drawing. */
  private updateWorldSystems(dt: number): void {
    const atmo = this.atmosphere.state;
    this.elapsed += dt;
    this.atmosphere.update(this.elapsed);
    this.terrain.update(this.elapsed);
    this.flora.update(this.elapsed, atmo.sunDir, atmo.sunColor, atmo.fogColor, atmo.fogDensity);
    this.boats.update(this.elapsed, atmo.nightFactor, this.mode === 'boat', this.boatSpeed);
    const wake = this.boats.playerBoat.position;
    this.waterAnchors[17].set(wake.x, wake.z, 4.4 + Math.abs(this.boatSpeed) * 0.45, 0.22);
    this.water.setInteractionPoints(this.waterAnchors);
    this.stiltVillage.update(this.elapsed, atmo.nightFactor);
    this.mansion.update(this.elapsed, atmo.nightFactor);
    this.shrine.update(this.elapsed, atmo.nightFactor);
    this.bridgesAndLife.update(this.elapsed, atmo.nightFactor);
  }

  private renderFrame(dt: number): void {
    if (this.mode === 'boat') {
      this.updateBoat(dt);
    } else {
      this.adapter.setFootY(this.camera.position.y - this.adapter.eyeHeight);
      this.character.update(dt);
      if (this.mode === 'fly') {
        this.camera.position.x = clamp(this.camera.position.x, -210, 210);
        this.camera.position.z = clamp(this.camera.position.z, -210, 210);
        this.camera.position.y = clamp(this.camera.position.y, 0.35, 95);
      }
    }
    // The camera matrices feed CSM, the light pool, the reflection and the water; refresh them
    // once here instead of letting each system trigger its own update.
    this.camera.updateMatrixWorld(true);

    this.updateWorldSystems(dt);
    const atmo = this.atmosphere.state;
    this.water.updateUniforms({
      time: this.elapsed,
      sunDir: atmo.sunDir,
      sunColor: atmo.sunColor,
      sunIntensity: atmo.sunIntensity,
      skyHorizonColor: atmo.skyHorizonColor,
      skyZenithColor: atmo.skyZenithColor,
      fogColor: atmo.fogColor,
      fogDensity: atmo.fogDensity,
      camera: this.camera,
    });

    this.scheduleShadowCascades();

    // The planar reflection is a full second scene pass: redraw it every other frame (the water
    // is moving, so nobody can tell) and reuse the last image in between.
    const shadowsReady = this.atmosphere.csm.lights.every((light) => Boolean(light.shadow.map));
    if (shadowsReady && (this.reflectionDue || this.frameIndex % REFLECTION_INTERVAL === 0)) {
      this.water.renderReflection(this.renderer, this.scene, this.camera, this.grassMesh ? [this.grassMesh] : []);
      this.reflectionDue = false;
    }

    // Nothing in daylight is bright enough for the bloom threshold; skip its passes then.
    this.bloomPass.enabled = atmo.nightFactor > 0.1;
    this.commitQuality();
    this.composer.render(dt);
    this.frameIndex++;
  }

  /**
   * Spreads the expensive passes evenly, so every frame costs about the same. An uneven pattern
   * (some frames drawing the reflection and all three shadow maps, others none) shows up as
   * stutter even when the average frame rate is fine.
   *
   *   even frames: near shadows + water reflection
   *   odd frames:  near shadows + mid and far shadows
   *
   * The mid and far cascades cover large areas with coarse texels, so a one-frame delay moves a
   * shadow edge by far less than a texel's worth of error.
   */
  private scheduleShadowCascades(): void {
    const lights = this.atmosphere.csm.lights;
    const all = this.shadowRefreshPending || this.frameIndex < 3;
    const odd = this.frameIndex % 2 === 1;
    for (let index = 0; index < lights.length; index++) {
      const light = lights[index];
      light.shadow.autoUpdate = false;
      if (all || index === 0 || odd) light.shadow.needsUpdate = true;
    }
    this.shadowRefreshPending = false;
  }

  private afterFrame(dt: number): void {
    this.updateFps(dt);
    this.adaptQuality(dt);

    this.audioTimer += dt;
    if (this.audioTimer >= 0.1) {
      this.audioTimer = 0;
      const terrainY = sampleTerrainHeight(this.camera.position.x, this.camera.position.z);
      this.audio.update(
        this.atmosphere.state.nightFactor,
        this.mode === 'boat' ? this.boatSpeed : 0,
        Math.max(0, terrainY) * 14,
      );
    }

    this.telemetryTimer += dt;
    if (this.telemetryTimer >= 0.25) {
      this.telemetryTimer = 0;
      this.emitTelemetry(false);
    }
  }

  private updateFps(dt: number): void {
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsTimer);
      this.callbacks.onFps?.(this.currentFps);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }
  }

  /**
   * Keeps exploration fluid on modest GPUs: when frames stay long the render scale eases down
   * (never below 0.7), and it climbs back when there is plenty of headroom.
   *
   * Every change reallocates the render targets, so changes are rare: a drop needs three slow
   * 2-second windows in a row, a rise needs eight comfortable ones, and a rise that is followed
   * by a drop is never tried again.
   */
  private adaptQuality(dt: number): void {
    this.qualityFrameAcc += dt;
    this.qualityFrameCount++;
    this.qualityTimer += dt;
    if (this.qualityTimer < 2.0) return;
    const average = this.qualityFrameAcc / Math.max(1, this.qualityFrameCount);
    this.qualityFrameAcc = 0;
    this.qualityFrameCount = 0;
    this.qualityTimer = 0;

    if (average > 1 / 45) {
      this.slowWindows++;
      this.fastWindows = 0;
    } else if (average < 1 / 58) {
      this.fastWindows++;
      this.slowWindows = 0;
    } else {
      this.slowWindows = 0;
      this.fastWindows = 0;
    }

    if (this.slowWindows >= 3) {
      this.slowWindows = 0;
      if (this.targetPixelRatio <= MIN_PIXEL_RATIO + 0.01) return;
      this.targetPixelRatio = Math.max(MIN_PIXEL_RATIO, this.targetPixelRatio - PIXEL_RATIO_STEP);
      // A rise that did not hold: stay where it is stable.
      if (this.lastQualityMove === 'up') this.upgradesLocked = true;
      this.lastQualityMove = 'down';
    } else if (this.fastWindows >= 8 && !this.upgradesLocked) {
      this.fastWindows = 0;
      if (this.targetPixelRatio >= this.maxPixelRatio - 0.01) return;
      this.targetPixelRatio = Math.min(this.maxPixelRatio, this.targetPixelRatio + PIXEL_RATIO_STEP);
      this.lastQualityMove = 'up';
    }
  }

  /**
   * Applies a pending render-scale or ambient-occlusion change. Called right before the frame is
   * drawn: resizing the canvas clears it, so changing it after a frame and waiting for the next
   * animation frame would let the browser show one blank (black) picture in between.
   */
  private commitQuality(): void {
    if (Math.abs(this.targetPixelRatio - this.pixelRatio) > 0.005) {
      this.pixelRatio = this.targetPixelRatio;
      this.renderer.setPixelRatio(this.pixelRatio);
      this.composer.setPixelRatio(this.pixelRatio);
    }
    if (this.aoDirty) {
      this.aoDirty = false;
      this.applyAmbientOcclusionQuality();
    }
  }

  private applyAmbientOcclusionQuality(): void {
    this.n8aoPass.configuration.halfRes = this.aoHalfRes;
    this.n8aoPass.setQualityMode(this.performanceMode ? 'Low' : 'Medium');
  }

  // ---------------------------------------------------------------------------------------
  // Telemetry, events, debug
  // ---------------------------------------------------------------------------------------

  private emitTelemetry(force: boolean): void {
    if (!this.callbacks.onTelemetry || !this.camera) return;
    const telemetry: MekongTelemetry = {
      mode: this.mode,
      nearBoat: this.isNearBoat(),
      zone: this.zoneAt(this.camera.position.x, this.camera.position.z),
      timeOfDay: Math.round(this.atmosphere.state.timeOfDay * 100) / 100,
      audioOn: this.audio.isEnabled(),
      performanceMode: this.performanceMode,
    };
    const key = JSON.stringify(telemetry);
    if (!force && key === this.lastTelemetryKey) return;
    this.lastTelemetryKey = key;
    this.callbacks.onTelemetry(telemetry);
  }

  private bindEvents(): void {
    const onResize = () => {
      if (this.disposed) return;
      const width = Math.max(this.container.clientWidth, 320);
      const height = Math.max(this.container.clientHeight, 240);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);
      this.water.resize(width, height);
    };
    window.addEventListener('resize', onResize);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.repeat) return;
      if (event.code === 'KeyB') this.toggleBoatMode();
      else if (event.code === 'KeyV') this.toggleFlyMode();
    };
    window.addEventListener('keydown', onKeyDown);

    const dom = this.renderer.domElement;
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    dom.addEventListener('contextmenu', onContextMenu);

    // A hidden tab stops drawing and updating entirely, and the audio context is suspended, so
    // nothing runs in the background.
    const onVisibilityChange = () => {
      if (this.disposed) return;
      if (document.hidden) {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = 0;
        }
        this.audio.pause();
      } else {
        this.clock.getDelta();
        this.audio.resume();
        if (!this.loopPaused && !this.rafId && this.composer) this.animate();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      dom.removeEventListener('contextmenu', onContextMenu);
    };
  }

  private readonly waterAnchors: THREE.Vector4[] = [
    new THREE.Vector4(-12.5, -14.0, 7.2, 0.12),
    new THREE.Vector4(-3.2, -4.5, 7.2, 0.34),
    new THREE.Vector4(-15.8, 6.5, 7.2, 0.58),
    new THREE.Vector4(2.5, -20.5, 7.2, 0.77),
    new THREE.Vector4(-8.0, 16.0, 7.2, 0.25),
    new THREE.Vector4(-7.0, 2.2, 5.4, 0.42),
    new THREE.Vector4(-1.2, -11.5, 5.4, 0.65),
    new THREE.Vector4(4.6, 7.8, 5.4, 0.91),
    new THREE.Vector4(12.4, 2.2, 3.6, 0.19),
    new THREE.Vector4(13.6, -7.2, 3.6, 0.48),
    new THREE.Vector4(12.2, 27.4, 4.8, 0.05),
    new THREE.Vector4(20.0, 4.0, 4.4, 0.31),
    new THREE.Vector4(21.0, -7.0, 4.4, 0.72),
    new THREE.Vector4(-31.8, 9.0, 4.8, 0.54),
    new THREE.Vector4(-13.0, -66.0, 6.2, 0.88),
    new THREE.Vector4(26.5, -25.0, 4.2, 0.14),
    new THREE.Vector4(48.0, -26.5, 3.8, 0.61),
    new THREE.Vector4(11.6, 27.6, 4.4, 0.22), // live player boat wake slot (index 17)
  ];

  /** Test and profiling helpers; removed again in `dispose()`. */
  private exposeDebugHook(): void {
    (window as unknown as Record<string, unknown>).__MEKONG_DEBUG__ = {
      teleport: (x: number, y: number, z: number, yaw: number, pitch: number, mode: TraversalMode = 'fly') => {
        this.setMode(mode === 'boat' ? 'walk' : mode);
        const position = new THREE.Vector3(x, y, z);
        this.character.setCameraPose(position, this.lookTarget(position, yaw, pitch));
        this.reflectionDue = true;
        this.shadowRefreshPending = true;
      },
      setTime: (hours: number) => this.setTimeOfDay(hours),
      applyBookmark: (id: string) => {
        const bookmark = WORLD_BOOKMARKS.find((b) => b.id === id);
        if (bookmark) this.applyBookmark(bookmark);
      },
      setLoopPaused: (paused: boolean) => {
        this.loopPaused = paused;
        if (!paused && !this.rafId) this.animate();
      },
      renderOnce: (dt = 0.016) => this.renderFrame(dt),
      /** Draw calls and triangles of one plain scene pass (the shadow cascades add to this). */
      getPerf: () => {
        this.renderer.info.reset();
        this.renderer.render(this.scene, this.camera);
        return {
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        merged: { ...this.mergeStats },
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        programs: this.renderer.info.programs?.length ?? 0,
        fps: this.currentFps,
        pixelRatio: this.pixelRatio,
        aoHalfRes: this.aoHalfRes,
        buildTimings: { ...this.buildTimings },
        };
      },
      /** Per top-level group: meshes, distinct materials, shadow casters (profiling aid). */
      describeScene: () =>
        this.scene.children.map((child) => {
          let meshes = 0;
          let instanced = 0;
          let casters = 0;
          const materials = new Set<THREE.Material>();
          child.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh && !(object as THREE.Points).isPoints && !(object as THREE.Line).isLine) return;
            meshes++;
            if ((mesh as THREE.InstancedMesh).isInstancedMesh) instanced++;
            if (mesh.castShadow) casters++;
            const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            list.forEach((m) => m && materials.add(m));
          });
          return { name: child.name || child.type, meshes, instanced, casters, materials: materials.size };
        }),
      getState: () => ({
        mode: this.mode,
        position: this.camera.position.toArray(),
        timeOfDay: this.atmosphere.state.timeOfDay,
      }),
    };
  }

  // ---------------------------------------------------------------------------------------
  // Disposal (safe on a partly built engine)
  // ---------------------------------------------------------------------------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.cleanupListeners();
    delete (window as unknown as Record<string, unknown>).__MEKONG_DEBUG__;
    clearWorldCollisionRegistry();

    this.audio.dispose();
    this.character?.dispose();
    this.atmosphere?.dispose();
    this.terrain?.dispose();
    this.water?.dispose();
    this.flora?.dispose();
    this.boats?.dispose();
    this.stiltVillage?.dispose();
    this.mansion?.dispose();
    this.shrine?.dispose();
    this.bridgesAndLife?.dispose();
    this.mats?.dispose();
    this.composer?.dispose();

    // Release every geometry, material and texture still reachable from the scene.
    this.scene?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        for (const value of Object.values(material as unknown as Record<string, unknown>)) {
          if (value && typeof (value as THREE.Texture).dispose === 'function' && (value as THREE.Texture).isTexture) {
            (value as THREE.Texture).dispose();
          }
        }
        material.dispose();
      }
    });
    this.scene?.clear();

    if (this.renderer) {
      this.renderer.dispose();
      try {
        this.renderer.forceContextLoss();
      } catch {
        // Already lost.
      }
      if (this.renderer.domElement.parentNode === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
  }
}

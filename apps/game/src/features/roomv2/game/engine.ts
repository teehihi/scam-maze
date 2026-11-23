import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { buildApartment, ROOM, WIN, type Apartment } from './apartment';
import { buildCity } from './city';
import { createRainGlass } from './glass';
import { AudioEngine } from './audio';
import { clock, type LaptopFrame, type PhoneMode } from './screens';
import { tr, trLines } from './strings';
import { CharacterArmsViewmodel } from '../../player/runtime/CharacterArmsViewmodel';
import { dropMaskCanvas, paintDropMask, canvas, toTex } from './textures';
import { projectCornersToViewport, projectPointToViewport, placeTaskMarker, cornersChanged, anchorMoved, ANCHOR_TOLERANCE_PX, type ScreenCornersPx, type ScreenDeviceId } from './screenProjection';
import { pickHoverId, laptopInteractRoute, inspectDurationSec } from './storyInteract';
import { formatClock, setGameElapsedSeconds } from '../../../game/clock/gameClock';
import { DOOR_OPEN_AT_S, entranceFrame, HANDOFF } from './entranceShot';
import { isRoomPropId, type RoomOptions, type RoomStoryCommands, type TaskMarker } from './outside';

export type Caption = { text: string; voice?: boolean; id: number };
export type UIAction = { key: string; label: string };
/** Screen part (0..1, origin bottom-left) where the open door / window shows. */
export interface OutsidePortal { x0: number; y0: number; x1: number; y1: number }
/** Camera lens shared by the room and the outside world, so their depth buffers line up. */
export interface OutsideLens { fov: number; aspect: number; near: number; far: number }
/**
 * A live outside world around the room (the Chapter 1 host plugs the Saigon open world in here). Room and outside
 * are one space: the outside is drawn every frame from the room camera into `backdrop()` (colour + depth) and the
 * room is composited over it, so the player walks out of the open door and back in with no cut.
 * Positions are room-local.
 */
export interface OutsideView {
  /** Player in the room. `backdrop` asks for the colour + depth image this frame (door or window open). */
  stepView(dt: number, pose: OutsideLens & { position: THREE.Vector3; quaternion: THREE.Quaternion; yaw: number; pitch: number; door: number; window: number; backdrop: boolean; portal?: OutsidePortal | null; windowInView?: boolean }): void;
  /** The player stepped through the doorway; `eye` is the room camera position. */
  enterPlay(eye: THREE.Vector3, yaw: number, pitch: number): void;
  /** Player outside: moves with the room's keys and look; returns the camera position and whether they are back in. */
  stepPlay(dt: number, input: OutsideLens & { keys: ReadonlySet<string>; yaw: number; pitch: number; door: number }): { position: THREE.Vector3; inRoom: boolean; moved: number };
  /** E outside (bus, ...). */
  interact(): void;
  /** What the last step drew, or null. */
  backdrop(): { color: THREE.Texture; depth: THREE.DepthTexture; scale?: THREE.Vector2 } | null;
  /** Exposure the outside is meant to be seen at (the room's tone mapping applies on top). */
  exposure?(): number;
  /** 0..1: how hard it rains outside. Drives the drops on the glass. */
  rainAmount?(): number;
  /** 0..1: how bright the sky is outside. Drives the light through the window. */
  daylight?(): number;
}
/** Engine.activate options. entrance: play the scripted entrance shot (outside the door, the door opens, walk in) instead of appearing at the spawn. */
export interface ActivateOptions {
  entrance?: boolean;
  /** Default: the browser's prefers-reduced-motion setting. Reduced motion is a plain fade up at the spawn. */
  reducedMotion?: boolean;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface UIState {
  prompt: string | null;
  /** Story mode: the aimed prop's projected position (container pixels), or null. */
  anchor: { x: number; y: number } | null;
  focus: boolean;
  captions: Caption[];
  inspecting: { title: string; actions: UIAction[] } | null;
  locked: boolean;
  fade: number;
  ended: null | 'answered' | 'declined';
  started: boolean;
  seated: boolean;
  /** Ctrl showed the cursor: the camera does not turn, everything else works. */
  cursorMode: boolean;
}

type Pose = { pos: THREE.Vector3; look: THREE.Vector3; fov: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const POSES: Record<string, Pose> = {
  laptop: { pos: V(-1.6, 0.95, -1.46), look: V(-1.615, 0.86, -1.84), fov: 42 },
  note: { pos: V(-1.32, 0.99, -1.38), look: V(-1.33, 0.742, -1.54), fov: 38 },
  receipts: { pos: V(-1.14, 1.01, -1.5), look: V(-1.18, 0.742, -1.71), fov: 44 },
  mug: { pos: V(-1.0, 0.93, -1.38), look: V(-1.13, 0.79, -1.57), fov: 44 },
  phone: { pos: V(0.93, 0.87, -1.6), look: V(0.93, 0.555, -1.785), fov: 42 },
  window: { pos: V(-0.72, 1.56, -1.7), look: V(-0.6, -2.5, -12), fov: 55 },
  calendar: { pos: V(-2.14, 1.46, -1.62), look: V(-2.6, 1.44, -1.65), fov: 50 },
  photo: { pos: V(-2.2, 1.98, -1.42), look: V(-2.5, 1.935, -1.56), fov: 40 },
  fridge: { pos: V(-2.12, 1.1, 0.8), look: V(-2.27, 0.6, 1.8), fov: 58 },
  bed: { pos: V(1.55, 0.74, -1.66), look: V(0.7, 2.65, -1.0), fov: 70 },
};

/**
 * Story mode only: closer poses so the device screen fills about 75 to 80 percent of the view width
 * (laptop) or about 85 percent of the view height (phone) at 16:9, because the host maps its UI onto
 * that screen. Standalone `/roomv2` keeps `POSES`. The phone camera sits on the phone's own "down"
 * side so the portrait screen appears upright.
 */
const STORY_POSES: Record<string, Pose> = {
  // Pulled back (z -1.56 to -1.53) and moved right (x -1.63 to -1.583) so the laptop surface sits
  // about 880 px wide at 1280x720 with at least 330 px free on its right for the evidence notice.
  laptop: { pos: V(-1.583, 0.932, -1.53), look: V(-1.583, 0.862, -1.84), fov: 42 },
  phone: { pos: V(0.936, 0.88, -1.745), look: V(0.93, 0.559, -1.78), fov: 29 },
};

/** Scratch objects for projecting a device screen to the viewport (story mode, no per-frame allocation). */
const _scrViewProj = new THREE.Matrix4();
/** Scratch point and placement of the task marker (story mode). */
const _taskPoint = new THREE.Vector3();
/** Height of the task marker above its prop (m), and its inset from the screen edge when off screen (px). */
const TASK_MARKER_LIFT_M = 0.22;
const TASK_MARKER_MARGIN_PX = 56;
const _scrPoint = new THREE.Vector3();
const _scrWorld = new Array<number>(12).fill(0);
const _scrOut = new Array<number>(8).fill(0);
/** Scratch objects of the anchored prompt (no allocation per hover tick). */
const _anchorBox = new THREE.Box3();
const _anchorPoint = new THREE.Vector3();
const _anchorOut = new Array<number>(2).fill(0);

const CAPTION_COUNTS: Record<string, number> = {
  window: 2, laptop: 1, note: 1, receipts: 1, mug: 1, phone: 1, calendar: 1, photo: 1, fridge: 3, bed: 2, jacket: 1, umbrella: 1, door: 1,
};
/** Behind the laptop page the settled room draws one frame in this many (about 20 per second at 60 Hz). */
const BACKDROP_FRAME_STEP = 3;
/** Front doorway (room-local x of its centre) and the half width the player's centre can use in it. */
const DOOR_X = 1.2;
const DOOR_HALF = 0.25;
const _portalP = new THREE.Vector3();
const _portalC = Array.from({ length: 8 }, () => new THREE.Vector3());
/** Box edges as corner index pairs (corner bits: 1 = x, 2 = y, 4 = z). */
const PORTAL_EDGES: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();
const captionLines = (id: string): string[] => trLines(`inspect.${id}`, CAPTION_COUNTS[id] ?? 0);
const typedText = () => tr('typed');
/** Small objects the player picks up or looks over closely: the hands play the take animation. */
const HAND_INSPECT = new Set(['note', 'receipts', 'mug', 'photo', 'phone']);
/** Interactions that are a plain reach: switches, door handles and the like. */
const HAND_REACH = new Set(['switch', 'desklamp', 'bedlamp', 'kitchenlight', 'kettle', 'fridge', 'window', 'jacket', 'umbrella', 'door']);
const SEAT = { x: -1.62, z: -1.17, y: 1.2, yaw: 0, pitch: -0.36 };
const STAND = V(-0.9, 1.62, -0.72);
const CHAIR_REST = V(-1.5, 0, -1.02);
const CHAIR_DESK = V(-1.62, 0, -1.13);
// Scratch objects reused every frame, so turning and walking allocate nothing (no GC pauses mid-turn).
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _want = new THREE.Vector3(), _next = new THREE.Vector3();
const _walkPos = new THREE.Vector3(), _walkQ = new THREE.Quaternion(), _walkE = new THREE.Euler(0, 0, 0, 'YXZ');
const _center = new THREE.Vector2(0, 0);
/** Time the neighborhood needs to white out the screen when the player leaves. */
const EXIT_SECONDS = 0.6;
/** One pointer-lock event moving more than this (px) is a browser glitch (a known Chrome jump), not the player. */
const MAX_MOUSE_STEP = 250;
const angDiff = (a: number, b: number) => THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const TITLE_IDS = ['window', 'laptop', 'note', 'receipts', 'mug', 'phone', 'calendar', 'photo', 'fridge', 'bed'];
const titleOf = (id: string): string => (TITLE_IDS.includes(id) ? tr(`title.${id}`) : '');

export class Engine implements RoomStoryCommands {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer!: EffectComposer;
  gtao?: GTAOPass;
  bloom!: UnrealBloomPass;
  finalPass!: ShaderPass;
  cityRT: THREE.WebGLRenderTarget;
  apt!: Apartment;
  city!: ReturnType<typeof buildCity>;
  audio: AudioEngine;
  pmrem: THREE.PMREMGenerator;
  envScene = new THREE.Scene();
  envParts: Record<string, THREE.Mesh> = {};
  envDirty = true;
  envTex?: THREE.Texture;
  glassMats: THREE.ShaderMaterial[] = [];
  dropCanvas = dropMaskCanvas();
  dropTex: THREE.CanvasTexture;
  outSpot!: THREE.SpotLight;
  upSpot!: THREE.SpotLight;
  neonSpot!: THREE.SpotLight;
  winRect!: THREE.RectAreaLight;

  ui: UIState = { prompt: null, anchor: null, focus: false, captions: [], inspecting: null, locked: false, fade: 1, ended: null, started: false, seated: false, cursorMode: false };
  onUI: (s: UIState) => void;
  /** Part of the neighborhood: built ahead in standby (`live` false), shown by `activate`, left through the door. */
  opts: RoomOptions;
  live = true;
  exiting = false;
  exitT = 0;
  exitSent = false;
  visits = 0;
  /** The entrance shot in progress (input is ignored until it ends and egin() runs), or null. */
  entrance: null | { t: number; reduced: boolean; clicked: boolean } = null;

  // player
  pos = V(1.3, 1.62, 1.55);
  vel = new THREE.Vector3();
  yaw = 0.62;
  pitch = -0.08;
  keys = new Set<string>();
  bobPhase = 0;
  lastStepSign = 1;

  // state
  t = 0;
  startT = 0;
  lights = { ceiling: false, desk: false, bed: false, kitchen: false };
  lightLevels = { ceiling: 0, desk: 0, bed: 0, kitchen: 0 };
  windowOpen = false;
  /** Set by the story host: the live outside world replaces the built-in city. */
  private outside: OutsideView | null = null;
  /** The player is outside the room (the outside world moves them; the room only looks and draws). */
  outdoors = false;
  /** The front door when an outside world is plugged in: open state and 0..1 swing. */
  outDoorOpen = false;
  outDoorT = 0;
  private backdropQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  private readonly outsideLens: OutsideLens = { fov: 68, aspect: 1, near: 0.03, far: 700 };
  sashX = 0;
  laptopAwake = 0;
  laptopWoken = false;
  phoneMode: PhoneMode = 'aod';
  phoneLockUntil = 0;
  kettleOn = false;
  kettleT = 0;
  used = new Set<string>();
  lastInteract = 0;
  exposure = 1.55;

  inspect: null | { id: string; from: { pos: THREE.Vector3; q: THREE.Quaternion; fov: number }; to: Pose; t: number; dir: 1 | -1; capIdx: number; ready: boolean } = null;
  lookOffset = new THREE.Vector2();

  // fridge / seat / extras
  fridgeOpen = false; fridgeAng = 0; fridgeLvl = 0; fridgeOpenT = 0; fridgeBeepT = 0; fridgeSaid = false;
  seat: 'none' | 'sitting' | 'seated' | 'standing' = 'none';
  seatT = 0;
  seatFrom = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 };
  standYaw = -2.5;
  typed = 0; lastTyped = -1; lastAwakeKey = -1; lastSecond = -1;
  dust!: THREE.Points;
  dustSeed: number[] = [];

  /** `'external'`: a story host (`opts.story`) owns the story; the room's own phone-call timeline never runs. */
  story: 'calm' | 'presilence' | 'ringing' | 'call' | 'declined' | 'missed' | 'done' | 'external' = 'calm';
  storyT = 0;
  /** External story only: the host asked the phone to ring (vibration and ringtone). */
  extRinging = false;
  extMood: 'calm' | 'quiet' | 'tense' = 'calm';
  laptopFrame: LaptopFrame | null = null;
  vibeOn = false;
  vibeClock = 0;
  callSec = 0;
  captionId = 0;
  timeouts: number[] = [];
  raf = 0;
  raycaster = new THREE.Raycaster();
  hovered: string | null = null;
  quality: 'high' | 'low';
  disposed = false;
  phoneBase = new THREE.Vector3();
  phoneBaseRot = 0;
  lastPhoneDraw = 0;
  lastClock = '';
  dropT = 0;
  arms: CharacterArmsViewmodel;
  armsShadowOff = false;
  /** How much of the hands' own colour shows on top of the room's lighting (see `updateArms`). */
  armFill = { value: 0.3 };
  /** Ground speed (m/s) and Shift-running this frame: drive the sprinting hands and the footsteps. */
  walkSpeed = 0;
  running = false;
  /** Metres walked on the street since the last footstep. */
  private streetStepAcc = 0;
  /** Last value of `shadowSignature()`; the shadow maps are redrawn only when it changes. */
  shadowSig = Number.NaN;
  shadowFrames = 0;
  private chairShadowAt = Number.NaN;
  private chairShadowWait = 0;
  private hoverFrame = 0;
  private lastPhoneMode = '';

  constructor(container: HTMLElement, onUI: (s: UIState) => void, quality: 'high' | 'low', opts: RoomOptions = {}) {
    this.container = container;
    this.opts = opts;
    this.live = !opts.standby;
    if (opts.story) this.story = 'external';
    this.onUI = onUI;
    this.quality = quality;
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    // Reading the shader logs after every link waits for the driver; keep that check for development.
    r.debug.checkShaderErrors = import.meta.env.DEV;
    r.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.5 : 1));
    r.setSize(container.clientWidth, container.clientHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);
    this.renderer = r;
    RectAreaLightUniformsLib.init();

    this.camera = new THREE.PerspectiveCamera(68, container.clientWidth / container.clientHeight, 0.03, 700);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.enable(1);
    this.scene.add(this.camera);
    // First-person hands (shared viewmodel). They live on the camera, so they also follow the seat and inspect poses.
    this.arms = new CharacterArmsViewmodel(this.camera);
    this.scene.background = new THREE.Color(0x05060a);
    this.scene.fog = new THREE.FogExp2(0x1b1820, 0.0062);

    const pr = r.getPixelRatio();
    this.cityRT = new THREE.WebGLRenderTarget(Math.floor(container.clientWidth * pr * 0.5), Math.floor(container.clientHeight * pr * 0.5), {
      type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    this.dropTex = new THREE.CanvasTexture(this.dropCanvas);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.audio = new AudioEngine(this.camera);
    this.build();
    this.setupPost();
    // Dev-only handle for the browser console and automated checks; never set in production builds.
    if (import.meta.env.DEV) (window as unknown as { __roomEngine?: Engine }).__roomEngine = this;
    this.bindInput();
    this.loop = this.loop.bind(this);
    if (this.live) this.raf = requestAnimationFrame(this.loop);
    else this.prepare();
  }

  /**
   * Standby: build the reflection environment and compile every shader now, while the player is
   * still on their way to the door, so the first frame in the room does not stall.
   */
  private prepare() {
    this.updateEnv();
    // Nothing plays while the room waits: the audio context stays suspended until `goLive`/`activate`.
    this.audio.suspend();
    this.warmed = (async () => {
      // compileAsync can stall (hidden tab, no parallel-compile support); the warm frame below then compiles what is left.
      try {
        await Promise.race([
          this.renderer.compileAsync(this.scene, this.camera),
          new Promise<void>((resolve) => window.setTimeout(resolve, 4000)),
        ]);
      } catch { /* compile on first draw instead */ }
      if (!this.disposed) this.renderWarmFrame();
    })();
  }

  /** Resolves once the standby room has compiled its shaders and drawn one full frame (textures and shadow maps uploaded). */
  warmed: Promise<void> = Promise.resolve();

  /** One complete frame, as the loop draws it, so the first visible frame needs no upload or compile. */
  private renderWarmFrame() {
    try {
      const r = this.renderer;
      this.glassMats.forEach((m) => m.uniforms.uRes.value.set(r.domElement.width, r.domElement.height));
      this.camera.layers.set(1);
      r.setRenderTarget(this.cityRT);
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
      this.camera.layers.set(0);
      this.camera.layers.enable(1);
      r.shadowMap.needsUpdate = true;
      this.composer.render(0);
    } catch { /* the first live frame draws it instead */ }
  }

  /**
   * Preloaded room: move the canvas into the page that adopts it. The room was built in a hidden host
   * at window size, so it is resized to its new container.
   */
  attachTo(container: HTMLElement, onUI: (s: UIState) => void) {
    if (this.disposed) return;
    this.container = container;
    this.onUI = onUI;
    container.appendChild(this.renderer.domElement);
    this.onResize();
  }

  /** Standby -> running for the story chapter: starts the loop where the room stands (no entrance shot). */
  goLive() {
    if (this.disposed || this.live) return;
    this.live = true;
    this.t = performance.now() / 1000;
    this.audio.wake();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Standby -> running: the player steps into the room. */
  activate(opts: ActivateOptions = {}) {
    if (this.disposed || this.live) return;
    this.live = true;
    this.t = performance.now() / 1000;
    this.exiting = false; this.exitT = 0; this.exitSent = false;
    this.pos.set(HANDOFF.x, HANDOFF.y, HANDOFF.z); this.vel.set(0, 0, 0); this.yaw = HANDOFF.yaw; this.pitch = HANDOFF.pitch;
    this.keys.clear();
    if (opts.entrance) {
      // The cut from the neighborhood lands on the room's own dark frame; the shot fades up from there.
      this.entrance = { t: 0, reduced: opts.reducedMotion ?? prefersReducedMotion(), clicked: false };
      this.applyEntranceFrame(entranceFrame(0, this.entrance.reduced));
      this.audio.wake();
      this.audio.start();
      this.lock();
      this.emit();
    } else {
      // the neighborhood's white doorway covers the cut, so no fade up from black
      this.ui.fade = 0; this.finalPass.uniforms.uFade.value = 1;
      this.audio.wake();
      this.begin();
    }
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Running -> standby (the player left); the room keeps its state for the next visit. */
  deactivate() {
    this.live = false;
    this.entrance = null;
    this.apt.doorLeaf.rotation.y = 0;
    cancelAnimationFrame(this.raf);
    this.keys.clear();
    this.audio.suspend();
    this.ui.started = false; this.ui.locked = false; this.ui.prompt = null; this.ui.anchor = null; this.ui.focus = false;
    this.emit();
  }

  /** Plugs a live outside world into the window (replaces the built-in city). */
  setOutside(view: OutsideView | null) {
    this.outside = view;
    this.city.group.visible = view === null;
    // The dark hall stub only exists for the entrance shot; the real corridor replaces it.
    for (const o of this.apt.hallStub) o.visible = view === null;
    // The doorway in the entrance wall opens only onto a real corridor.
    this.apt.entranceWall.full.visible = view === null;
    for (const o of this.apt.entranceWall.doorway) o.visible = view !== null;
    if (view) this.ensureBackdropQuad();
    this.audio.weatherDriven = view !== null;
    // The outside world's sky dome has a 920 m radius: the shared lens must reach past it.
    this.camera.far = view ? 1400 : 700;
    this.camera.updateProjectionMatrix();
    if (!view) {
      if (this.outdoors) { this.outdoors = false; this.pos.set(1.2, HANDOFF.y, ROOM.z1 - 0.3); }
      this.outDoorOpen = false;
      if (this.backdropQuad) this.backdropQuad.visible = false;
      this.audio.setRain(1);
    }
  }
  /**
   * A full-screen quad drawn first in the room pass: it writes the outside's colour and depth, so the room's own
   * meshes are depth-tested against the street (one render call, so the MSAA buffer keeps both).
   */
  private ensureBackdropQuad() {
    if (this.backdropQuad) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: null }, tDepth: { value: null }, uGain: { value: 1 }, uScale: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }',
      fragmentShader: `uniform sampler2D tColor; uniform sampler2D tDepth; uniform float uGain; uniform vec2 uScale; varying vec2 vUv;
        void main(){
          // Soft-limit the street's HDR highlights (sun glints, lamps): above 1.1 they roll off toward 2.4, so the
          // room's bloom never flares the whole doorway.
          vec2 uv = vUv * uScale;
          vec3 c = max(texture2D(tColor, uv).rgb * uGain, vec3(0.0));
          float l = max(c.r, max(c.g, c.b));
          if (l > 1.1) { float e = l - 1.1; c *= (1.1 + e / (1.0 + e / 1.3)) / l; }
          gl_FragColor = vec4(c, 1.0); gl_FragDepth = texture2D(tDepth, uv).x; }`,
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.AlwaysDepth,
      fog: false,
      toneMapped: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.name = 'OutsideBackdrop';
    quad.frustumCulled = false;
    quad.renderOrder = -1e9;
    quad.matrixAutoUpdate = false;
    quad.visible = false;
    this.scene.add(quad);
    this.backdropQuad = quad;
    // Hide it again right after the scene pass, so the AO pass (which redraws the scene) never sees it.
    const hide = new (class extends Pass {
      constructor() { super(); this.needsSwap = false; }
      render() { quad.visible = false; }
    })();
    this.composer.insertPass(hide, 1);
  }
  /** Open / close the front door (outside world plugged in). From outside it always opens, so nobody is locked out. */
  toggleOutsideDoor() {
    if (!this.outside) return;
    if (!this.outdoors && !this.outDoorOpen && this.opts.story?.doorLocked?.()) { this.audio.switchClick('door'); this.say(captionLines('door')[0]); return; }
    this.outDoorOpen = !this.outDoorOpen;
    if (this.outDoorOpen) this.audio.switchClick('door'); else this.audio.doorClose();
    this.emit();
  }
  /** The player walked through the open doorway onto the corridor. */
  private goOutdoors() {
    if (!this.outside || this.outdoors) return;
    this.outdoors = true;
    this.outside.enterPlay(this.pos, this.yaw, this.pitch);
    this.vel.set(0, 0, 0);
    this.hovered = null;
    this.ui.prompt = null; this.ui.anchor = null; this.ui.focus = false;
    this.emit();
  }
  private applyEntranceFrame(f: ReturnType<typeof entranceFrame>) {
    this.pos.set(f.x, f.y, f.z); this.yaw = f.yaw; this.pitch = f.pitch;
    this.apt.doorLeaf.rotation.y = -f.doorAngle;
    this.ui.fade = 1 - f.fade;
    this.finalPass.uniforms.uFade.value = f.fade;
  }

  /** One step of the entrance shot: scripted camera, door and fade; ends with the same hand-over as `begin()`. */
  private stepEntrance(dt: number) {
    const e = this.entrance;
    if (!e) return;
    e.t += dt;
    const f = entranceFrame(e.t, e.reduced);
    if (!e.reduced && !e.clicked && e.t >= DOOR_OPEN_AT_S) { e.clicked = true; this.audio.switchClick('door'); }
    const speed = dt > 0 ? Math.hypot(f.x - this.pos.x, f.z - this.pos.z) / dt : 0;
    this.applyEntranceFrame(f);
    // Walking pace drives the same head-bob and footsteps as `movePlayer`.
    this.vel.set(f.done ? 0 : speed, 0, 0);
    if (speed > 0.05 && !f.done) {
      this.bobPhase += dt * speed * 5.2;
      const sign = Math.sign(Math.sin(this.bobPhase));
      if (sign !== this.lastStepSign && sign !== 0) { this.lastStepSign = sign; this.audio.started && this.audio.footstep(false); }
    }
    if (f.done) { this.entrance = null; this.begin(); }
  }

  /** Fades out, then tells the neighborhood the player left (`RoomOptions.onExit`). */
  requestExit() {
    if (!this.opts.onExit || this.exiting) return;
    this.exiting = true; this.exitT = 0;
    this.opts.onExitStart?.();
  }

  /* =================== BUILD =================== */
  build() {
    this.city = buildCity(this.scene);
    this.apt = buildApartment(this.scene, (panes) => {
      panes.forEach((p) => {
        const m = createRainGlass(this.cityRT.texture, new THREE.Vector2((p.geometry as THREE.PlaneGeometry).parameters.width, (p.geometry as THREE.PlaneGeometry).parameters.height), p.userData.seed);
        p.material = m;
        this.glassMats.push(m);
      });
    }, { wideLaptopHit: !!this.opts.story });
    const a = this.apt;
    this.phoneBase.copy(a.phone.position);
    this.phoneBaseRot = a.phone.rotation.y;

    // ambient night fill
    const hemi = new THREE.HemisphereLight(0x39436a, 0x1c1612, 0.32);
    this.scene.add(hemi);

    // cool city sky glow through the window
    const cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2;
    this.winRect = new THREE.RectAreaLight(0x8d97c8, 1.6, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
    this.winRect.position.set(cx, cy, ROOM.z0 - 0.12);
    this.winRect.lookAt(cx, cy - 0.2, 2);
    this.scene.add(this.winRect);

    paintDropMask(this.dropCanvas, 0);
    this.dropTex.needsUpdate = true;
    // light from the sky/neighbouring facades falling in, carrying the droplet pattern
    this.outSpot = new THREE.SpotLight(0x9aa8ff, 32, 0, 0.26, 1.0, 2);
    this.outSpot.position.set(-0.9, 4.2, -8.5);
    this.outSpot.target.position.set(-0.3, 0, 0.9);
    this.outSpot.map = this.dropTex;
    this.outSpot.castShadow = true;
    this.outSpot.shadow.mapSize.set(1024, 1024);
    this.outSpot.shadow.bias = -0.0006;
    this.outSpot.shadow.camera.near = 4;
    this.outSpot.shadow.camera.far = 16;
    this.scene.add(this.outSpot, this.outSpot.target);
    // sodium street light thrown up onto the ceiling
    this.upSpot = new THREE.SpotLight(0xff9a4a, 30, 0, 0.24, 0.9, 2);
    this.upSpot.position.set(-0.8, -7.5, -9.5);
    this.upSpot.target.position.set(-0.4, 2.65, 0.6);
    this.upSpot.map = this.dropTex;
    this.upSpot.castShadow = true;
    this.upSpot.shadow.mapSize.set(1024, 1024);
    this.upSpot.shadow.bias = -0.0006;
    this.upSpot.shadow.camera.near = 6;
    this.upSpot.shadow.camera.far = 20;
    this.scene.add(this.upSpot, this.upSpot.target);
    // karaoke neon across the street (flickers)
    this.neonSpot = new THREE.SpotLight(0xff3fa8, 26, 0, 0.3, 0.8, 2);
    this.neonSpot.position.set(3, -6, -12);
    this.neonSpot.target.position.set(0.8, 2.6, -0.8);
    this.scene.add(this.neonSpot, this.neonSpot.target);

    // environment for reflections
    this.buildEnvScene();

    // audio emitters
    const au = this.audio;
    const s = this.scene;
    au.addEmitter('window', s, V(cx, 1.5, ROOM.z0 - 0.25), 1.2, 1);
    au.addEmitter('fridge', s, V(-2.3, 0.6, 1.8), 0.6, 1.4);
    au.addEmitter('laptop', s, V(-1.62, 0.8, -1.7), 0.3, 1.6);
    au.addEmitter('phone', s, V(0.93, 0.56, -1.78), 0.7, 1.1);
    au.addEmitter('kettle', s, V(-1.55, 1.0, 1.88), 0.6, 1.2);
    au.addEmitter('door', s, V(1.2, 1.0, 2.05), 1, 1);
    au.addEmitter('keys', s, V(2.0, 0.86, 1.92), 0.5, 1);
    au.addEmitter('umbrella', s, V(2.4, 0.05, 1.0), 0.4, 1.3);
    au.addEmitter('switch', s, V(0.52, 1.2, 2.08), 0.4, 1.2);
    au.addEmitter('desklamp', s, V(-2.18, 0.8, -1.98), 0.4, 1.2);
    au.addEmitter('bedlamp', s, V(0.72, 0.8, -1.97), 0.4, 1.2);
    au.addEmitter('kitchenlight', s, V(-0.7, 1.55, 1.8), 0.4, 1.2);
    au.addEmitter('mug', s, V(-1.13, 0.8, -1.57), 0.4, 1.2);
    au.addEmitter('desk', s, V(-1.3, 0.8, -1.6), 0.4, 1.2);
    au.addEmitter('clock', s, V(-0.05, 2.05, 2.06), 0.5, 1.4);

    // floating dust motes that catch the lamp light
    const N = 150;
    const dg = new THREE.BufferGeometry();
    const dp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.dustSeed.push(Math.random() * 100, Math.random(), Math.random(), Math.random()); dp[i * 3] = -2.4 + Math.random() * 4.8; dp[i * 3 + 1] = 0.3 + Math.random() * 2.1; dp[i * 3 + 2] = -1.9 + Math.random() * 3.8; }
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dc = canvas(32, 32); const dx = dc.getContext('2d')!; const gr = dx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,215,1)'); gr.addColorStop(1, 'rgba(255,240,215,0)'); dx.fillStyle = gr; dx.fillRect(0, 0, 32, 32);
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: toTex(dc), size: 0.014, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a8 }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  buildEnvScene() {
    const es = this.envScene;
    const room = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.65, 4.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.019, 0.018), side: THREE.BackSide }));
    room.position.y = 1.32;
    es.add(room);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.35), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.3, 0.4) }));
    win.position.set(-0.7, 1.62, -2.08);
    es.add(win);
    const mk = (name: string, pos: THREE.Vector3, r: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }));
      m.position.copy(pos); es.add(m); this.envParts[name] = m;
    };
    mk('ceiling', V(-0.2, 2.05, 0.05), 0.22);
    mk('desk', V(-1.9, 1.15, -1.8), 0.06);
    mk('bed', V(0.72, 0.88, -1.97), 0.13);
    mk('kitchen', V(-1.3, 1.54, 1.8), 0.1);
  }

  updateEnv() {
    const p = this.envParts;
    const warm = new THREE.Color(1, 0.7, 0.45);
    (p.ceiling.material as THREE.MeshBasicMaterial).color.copy(warm).multiplyScalar(this.lightLevels.ceiling * 6);
    (p.desk.material as THREE.MeshBasicMaterial).color.copy(warm).multiplyScalar(this.lightLevels.desk * 14);
    (p.bed.material as THREE.MeshBasicMaterial).color.copy(warm).multiplyScalar(this.lightLevels.bed * 4);
    (p.kitchen.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.9, 0.8).multiplyScalar(this.lightLevels.kitchen * 6);
    const old = this.envTex;
    this.envTex = this.pmrem.fromScene(this.envScene, 0.03, 0.1, 50).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.55;
    old?.dispose();
    this.envDirty = false;
  }

  setupPost() {
    const r = this.renderer;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const rt = new THREE.WebGLRenderTarget(w * r.getPixelRatio(), h * r.getPixelRatio(), { type: THREE.HalfFloatType, samples: this.quality === 'high' ? 4 : 2 });
    const c = new EffectComposer(r, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    if (this.quality === 'high') {
      try {
        const g = new GTAOPass(this.scene, this.camera, w, h);
        g.output = GTAOPass.OUTPUT.Default;
        g.blendIntensity = 0.85;
        g.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 12 });
        g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
        c.addPass(g);
        this.gtao = g;
      } catch (e) { console.warn('GTAO unavailable', e); }
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.6, 1.0);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.finalPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.9 }, uCA: { value: 0.0018 }, uFade: { value: 1 }, uDesat: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uVig, uCA, uFade, uDesat; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*43.0)*43758.5453); }
        void main(){
          vec2 d = vUv - 0.5;
          float r2 = dot(d,d);
          vec2 off = d * uCA * (1.0 + r2*4.0);
          vec3 col;
          col.r = texture2D(tDiffuse, vUv + off).r;
          col.g = texture2D(tDiffuse, vUv).g;
          col.b = texture2D(tDiffuse, vUv - off).b;
          float l = dot(col, vec3(0.299,0.587,0.114));
          col = mix(col, vec3(l), uDesat);
          // gentle split-tone: cool shadows, warm highs
          col += vec3(-0.006, 0.0, 0.014) * (1.0 - smoothstep(0.0, 0.35, l));
          col *= 1.0 - uVig * smoothstep(0.18, 0.75, r2*1.6);
          col += (h(vUv*vec2(1920.,1080.)) - 0.5) * 0.035;
          col *= uFade;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    c.addPass(this.finalPass);
    this.composer = c;
  }

  /* =================== INPUT =================== */
  onMouseMove = (e: MouseEvent) => {
    if (!this.live || !this.ui.locked || this.entrance) return;
    if (this.callHeld()) return;
    if (Math.abs(e.movementX) > MAX_MOUSE_STEP || Math.abs(e.movementY) > MAX_MOUSE_STEP) return;
    const s = 0.0021;
    if (this.seat === 'sitting' || this.seat === 'standing') return;
    if (this.inspect) {
      this.lookOffset.x = THREE.MathUtils.clamp(this.lookOffset.x - e.movementX * s * 0.5, -0.22, 0.22);
      this.lookOffset.y = THREE.MathUtils.clamp(this.lookOffset.y - e.movementY * s * 0.5, -0.16, 0.16);
      return;
    }
    this.yaw -= e.movementX * s;
    if (this.seat === 'seated') this.yaw = THREE.MathUtils.clamp(this.yaw, -1.5, 1.5);
    this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * s, -1.45, 1.45);
  };
  /** True while the player types in a text field (for example the browser's address bar): the room ignores those keys. */
  private static typingInField(e: KeyboardEvent): boolean {
    const t = e.target;
    return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);
  }
  onKeyDown = (e: KeyboardEvent) => {
    if (Engine.typingInField(e)) return;
    if (this.ui.started && !this.ui.ended && (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight')) {
      if (!e.repeat) this.setCursorMode(!this.ui.cursorMode);
      return;
    }
    this.keys.add(e.code);
    if (!this.ui.started) return;
    if (this.outdoors) {
      // Outside: E works the room door when it is aimed at, otherwise the street (bus, ...).
      if (e.code === 'KeyE') { if (this.hovered === 'door') this.interact(); else this.outside?.interact(); }
      return;
    }
    if (e.code === 'KeyE') { if (this.inspect && this.inspect.dir === 1) this.endInspect(); else this.interact(); }
    if (e.code === 'KeyQ' || e.code === 'Backspace') { if (this.inspect) this.endInspect(); else if (this.seat === 'seated') this.standUp(); }
    if (e.code === 'KeyF') this.inspectAction('F');
    if (e.code === 'KeyR') this.inspectAction('R');
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  onMouseDown = (e: MouseEvent) => {
    if (!this.ui.started) return;
    if (!this.ui.locked && !this.ui.cursorMode) { this.lock(); return; }
    if (this.outdoors) { if (e.button === 0) { if (this.hovered === 'door') this.interact(); else this.outside?.interact(); } return; }
    if (e.button === 0) { if (this.inspect && this.inspect.dir === 1) { /* click = primary action if any */ if (!this.inspectAction('F')) this.endInspect(); } else this.interact(); }
    if (e.button === 2) { if (this.inspect) this.endInspect(); else if (this.seat === 'seated') this.standUp(); }
  };
  onLockChange = () => {
    if (!this.live) return;
    this.ui.locked = document.pointerLockElement === this.renderer.domElement;
    if (this.ui.locked) this.ui.cursorMode = false;
    this.emit();
  };
  onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    if (this.screenWatch) this.readScreenOffset();
    const pr = this.renderer.getPixelRatio();
    this.cityRT.setSize(Math.floor(w * pr * 0.5), Math.floor(h * pr * 0.5));
  };

  bindInput() {
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('resize', this.onResize);
  }

  /** Shows (true) or hides (false) the cursor. While shown the camera does not turn; moving and interacting still work. */
  setCursorMode(on: boolean) {
    this.ui.cursorMode = on;
    if (on) { if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); }
    else this.lock();
    this.emit();
  }
  lock() {
    try { (this.renderer.domElement.requestPointerLock() as unknown as Promise<void>)?.catch?.(() => {}); } catch { /* ignore */ }
  }

  /* =================== FLOW =================== */
  begin() {
    if (this.ui.started) return;
    this.ui.started = true;
    this.startT = this.t;
    this.audio.start();
    this.lock();
    this.audio.doorClose();
    this.audio.keys();
    this.audio.sigh();
    this.visits++;
    this.later(9, () => { if (!this.lights.ceiling && !this.lights.bed && !this.lights.desk) this.say(tr('say.dark')); });
    this.emit();
  }

  later(sec: number, fn: () => void) { this.timeouts.push(window.setTimeout(() => { if (!this.disposed) fn(); }, sec * 1000)); }

  /** True while a hosted phone call is on screen: its dialogue owns the arrow keys, so the view stays put. */
  callHeld(): boolean { return !!this.opts.story && this.phoneMode === 'call'; }

  say(text: string, voice = false, dur?: number, hosted = false) {
    // The call dialogue has its own captions; a room remark must not overlap it.
    if (!voice && this.callHeld()) return;
    // With a story host, only the story speaks: the room's own remarks stay quiet (owner).
    if (!voice && !hosted && this.opts.story) return;
    const id = ++this.captionId;
    this.ui.captions = [...this.ui.captions.slice(-1), { text, voice, id }];
    this.emit();
    const d = dur ?? Math.max(3.8, text.length * 0.075);
    this.later(d, () => { this.ui.captions = this.ui.captions.filter((c) => c.id !== id); this.emit(); });
  }

  emit() { this.onUI({ ...this.ui }); }

  markUsed(id: string) {
    this.used.add(id);
    this.lastInteract = this.t;
  }

  label(id: string): string | null {
    const hosted = this.opts.story?.label(id);
    if (hosted != null) return hosted;
    const ring = this.story === 'ringing' || (this.story === 'external' && this.phoneMode === 'ringing');
    switch (id) {
      case 'switch': return this.lights.ceiling ? tr('label.ceilingOff') : tr('label.ceilingOn');
      case 'desklamp': return this.lights.desk ? tr('label.deskOff') : tr('label.deskOn');
      case 'bedlamp': return this.lights.bed ? tr('label.bedOff') : tr('label.bedOn');
      case 'kitchenlight': return this.lights.kitchen ? tr('label.kitchenOff') : tr('label.kitchenOn');
      case 'window': return tr('label.window');
      case 'laptop': return this.seat === 'seated' || this.opts.story ? tr('label.laptopLook') : tr('label.laptopSit');
      case 'chair': return this.seat === 'none' ? tr('label.sit') : null;
      case 'note': return tr('label.note');
      case 'receipts': return tr('label.receipts');
      case 'mug': return tr('label.mug');
      case 'phone': return ring ? tr('label.phonePick') : tr('label.phoneView');
      case 'calendar': return tr('label.calendar');
      case 'photo': return tr('label.photo');
      case 'fridge': return this.fridgeOpen ? tr('label.fridgeClose') : tr('label.fridgeOpen');
      case 'kettle': return this.kettleOn ? tr('label.kettleOff') : tr('label.kettleOn');
      case 'bed': return tr('label.bed');
      case 'jacket': return tr('label.jacket');
      case 'umbrella': return tr('label.umbrella');
      case 'door':
        if (this.outside) {
          if (!this.outdoors && !this.outDoorOpen && this.opts.story?.doorLocked?.()) return tr('label.doorLocked');
          return this.outDoorOpen ? tr('label.doorClose') : tr('label.doorOpen');
        }
        if (this.opts.story?.doorLocked?.()) return tr('label.doorLocked');
        return this.opts.onExit ? tr('label.doorLeave') : tr('label.door');
    }
    return null;
  }

  interact() {
    const id = this.hovered;
    if (!id || this.inspect || this.seat === 'sitting' || this.seat === 'standing') return;
    this.markUsed(id);
    this.reachWithHand(id);
    const port = this.opts.story;
    if (port && isRoomPropId(id)) port.onProp(id, 'interact');
    if (id === 'door' && this.outside) { this.toggleOutsideDoor(); return; }
    if (id === 'door' && port?.doorLocked?.()) { this.audio.switchClick('door'); this.say(captionLines('door')[0]); return; }
    if (id === 'door' && this.opts.onExit) { this.audio.switchClick('door'); this.requestExit(); return; }
    switch (id) {
      case 'laptop': if (laptopInteractRoute(!!port, this.seat) === 'inspect') this.startInspect('laptop'); else this.startSit(); return;
      case 'chair': if (this.seat === 'none') this.startSit(); return;
      case 'fridge': if (this.fridgeOpen) this.setFridgeDoor(false); else { this.setFridgeDoor(true); this.startInspect('fridge'); } return;
      case 'switch': this.toggleLight('ceiling', 'switch'); return;
      case 'desklamp': this.toggleLight('desk', 'desklamp'); return;
      case 'bedlamp': this.toggleLight('bed', 'bedlamp'); return;
      case 'kitchenlight': this.toggleLight('kitchen', 'kitchenlight'); return;
      case 'kettle': this.toggleKettle(); return;
      case 'jacket': case 'umbrella': case 'door': this.say(captionLines(id)[0]); if (id === 'door') this.audio.switchClick('door'); return;
      default:
        if (POSES[id]) this.startInspect(id);
    }
  }

  /** Plays the reach animation for plain interactions (inspect-type items use `triggerInspect`). */
  reachWithHand(id: string) {
    if (HAND_REACH.has(id)) this.arms.triggerInteract();
  }

  /**
   * One number that changes whenever something that casts a shadow moves or a light fades:
   * the lights, the chair, the fridge door and the window sash. The scene has no moving
   * character, so while this stays the same the shadow maps need no redraw.
   */
  shadowSignature(): number {
    const L = this.lightLevels;
    const chair = this.apt.chair;
    // Rounded to 1 mm / 1 mrad: the eased sash and fridge door never land exactly on their targets, and an unrounded
    // signature redrew all four shadow maps on every frame for the rest of the session after the window was opened.
    const q = (v: number) => Math.round(v * 1000) / 1000;
    return L.ceiling + L.desk * 2.1 + L.bed * 3.3 + L.kitchen * 4.7 + q(this.fridgeAng) * 5.9 + q(this.sashX) * 7.1
      + q(chair.position.x) * 11.3 + q(chair.position.z) * 13.7;
  }
  /**
   * The seated chair swivels a little with the view (a quarter of the yaw). Its shadow follows at
   * most every 6th frame instead of redrawing all four shadow maps on every frame of a turn.
   */
  chairTurnSignature(): number { return this.apt.chair.rotation.y; }

  toggleLight(k: keyof Engine['lights'], at: string) {
    this.lights[k] = !this.lights[k];
    this.audio.switchClick(at);
    if (k === 'ceiling' && this.lights[k] && this.used.size <= 1) this.later(1.2, () => this.say(tr('say.ceilingLit')));
  }

  toggleKettle() {
    this.kettleOn = !this.kettleOn;
    this.audio.kettle(this.kettleOn);
    this.kettleT = 0;
    if (this.kettleOn) this.say(tr('say.kettle'));
  }

  startInspect(id: string) {
    const to = (this.opts.story ? STORY_POSES[id] : undefined) ?? POSES[id];
    this.inspect = { id, from: { pos: this.camera.position.clone(), q: this.camera.quaternion.clone(), fov: this.camera.fov }, to, t: 0, dir: 1, capIdx: 0, ready: false };
    this.lookOffset.set(0, 0);
    // Picking it up is enough; the "look at your hand" inspect clip covered the phone (owner).
    if (HAND_INSPECT.has(id)) this.arms.triggerInteract();
    if (id === 'laptop') { this.laptopWoken = true; this.audio.setFan(true); }
    if (id === 'phone' && this.story === 'calm') { this.phoneMode = 'lock'; this.phoneLockUntil = Infinity; }
    if (id === 'note' || id === 'receipts') this.audio.paper('desk');
    if (id === 'bed') this.audio.bedRustle();
    const lines = this.inspectLines(id);
    const hosted = !!this.opts.story?.inspectLines(id);
    lines.forEach((l, i) => this.later(0.9 + i * 4.2, () => { if (this.inspect?.id === id && this.inspect.dir === 1) this.say(l, false, undefined, hosted); }));
    this.ui.inspecting = { title: titleOf(id), actions: this.actionsFor(id) };
    this.emit();
  }

  inspectLines(id: string): string[] {
    const hosted = this.opts.story?.inspectLines(id);
    if (hosted) return hosted;
    if (id === 'phone') {
      if (this.story === 'ringing') return [];
      if (this.story === 'declined' || this.story === 'missed' || this.story === 'done') return this.ui.ended === 'answered' ? trLines('inspect.phoneEndedAnswered', 1) : trLines('inspect.phoneEndedDeclined', 1);
    }
    if (id === 'window' && this.windowOpen) return trLines('inspect.windowOpen', 1);
    return captionLines(id);
  }

  actionsFor(id: string): UIAction[] {
    const hosted = this.opts.story?.actions(id);
    if (hosted) return hosted;
    const back = { key: 'Q', label: tr('action.back') };
    if (id === 'window') return [{ key: 'F', label: this.windowOpen ? tr('action.windowClose') : tr('action.windowOpen') }, back];
    if (id === 'mug') return [{ key: 'F', label: tr('action.drink') }, back];
    // Story mode: the chapter layer owns the laptop UI, so no typing demo hint and no "sit up" (the player never sat).
    if (id === 'laptop') return this.opts.story ? [back] : [{ key: 'F', label: tr('action.type') }, { key: 'Q', label: tr('action.sitUp') }];
    if (id === 'fridge') return [{ key: 'F', label: this.fridgeOpen ? tr('action.fridgeShut') : tr('action.fridgeUnlatch') }, { key: 'Q', label: tr('action.back') }];
    if (id === 'phone' && this.story === 'ringing') return [{ key: 'F', label: tr('action.answer') }, { key: 'R', label: tr('action.decline') }];
    return [back];
  }

  inspectAction(key: string): boolean {
    if (!this.inspect || this.inspect.dir !== 1 || this.inspect.t < 0.6) return false;
    const id = this.inspect.id;
    const port = this.opts.story;
    if (port && isRoomPropId(id) && port.onInspectKey(id, key)) return true;
    if (id === 'window' && key === 'F') {
      this.windowOpen = !this.windowOpen;
      this.audio.windowSlide(this.windowOpen);
      if (this.windowOpen) this.later(1.0, () => this.say(tr('say.windowAir')));
      this.ui.inspecting = { title: titleOf(id), actions: this.actionsFor(id) }; this.emit();
      return true;
    }
    if (id === 'laptop' && key === 'F' && !port) {
      this.typed = Math.min(typedText().length, this.typed + 4 + Math.floor(Math.random() * 5));
      this.audio.typing();
      if (this.typed >= typedText().length && !this.used.has('typed')) { this.used.add('typed'); this.later(1.2, () => this.say(tr('say.typedSend'))); }
      return true;
    }
    if (id === 'fridge' && key === 'F') { this.setFridgeDoor(!this.fridgeOpen); return true; }
    if (id === 'mug' && key === 'F') {
      this.audio.clink('mug');
      this.later(0.6, () => this.say(tr('say.coldCoffee')));
      return true;
    }
    if (id === 'phone' && this.story === 'ringing') {
      if (key === 'F') { this.answerCall(); return true; }
      if (key === 'R') { this.declineCall(); return true; }
    }
    return false;
  }

  endInspect(force = false) {
    if (!this.inspect || (force && this.inspect.dir !== 1)) return;
    const id = this.inspect.id;
    if (this.story === 'ringing' && id === 'phone') return; // must decide
    if (!force && this.opts.story && !this.opts.story.canLeaveInspect(id)) return;
    const wasReady = this.inspect.ready;
    this.inspect.dir = -1;
    this.inspect.from = { pos: this.camera.position.clone(), q: this.camera.quaternion.clone(), fov: this.camera.fov };
    this.inspect.t = 0;
    if (id === 'phone' && this.story === 'calm') this.phoneLockUntil = this.t + 4;
    if (id === 'bed') this.audio.bedRustle();
    this.ui.inspecting = null;
    this.emit();
    if (wasReady && this.opts.story && isRoomPropId(id)) this.opts.story.onProp(id, 'inspect-end');
  }

  /* =================== STORY HOST COMMANDS =================== */
  setPhoneMode(mode: PhoneMode) {
    if (mode === 'call' && this.phoneMode !== 'call') {
      this.callSec = 0;
      this.ui.captions = this.ui.captions.filter((c) => c.voice);
    }
    this.phoneMode = mode;
  }

  ring(on: boolean) {
    if (this.extRinging === on) return;
    this.extRinging = on;
    this.vibeClock = 0;
    if (on) this.audio.ring(true); else this.stopVibe();
  }

  /** Time of day from a story host (seconds), or null for the room's own clock. */
  storyClockSeconds: number | null = null;
  setStoryClock(secondsOfDay: number | null) {
    this.storyClockSeconds = secondsOfDay;
    this.lastAwakeKey = -1; // redraw the screens with the new time
  }
  setLaptopFrame(frame: LaptopFrame | null) {
    this.laptopFrame = frame;
    // A new card wakes the screen (the existing fade-in and the small screen light) so the laptop
    // shows it is waiting. No marker or highlight: only the screen light and the chime.
    if (frame && this.opts.story) this.laptopWoken = true;
    this.lastAwakeKey = -1; // redraw the screen on the next frame
  }

  chime() { this.audio.chime(); }

  setMood(mood: 'calm' | 'quiet' | 'tense') {
    if (this.extMood === mood) return;
    this.extMood = mood;
    this.audio.duckCity(mood === 'tense' ? 0.25 : mood === 'quiet' ? 0.55 : 1);
  }

  /** Story host: lowers the room's ambience while narration plays (true) and restores it (false). */
  duckForVoice(on: boolean) { this.audio.duckForVoice(on); }
  /** Leaves the inspect pose even when the host would keep the player there. */
  closeInspect() { this.endInspect(true); }
  private phoneCarried = false;
  /** Story host: the player carries the phone, so the one on the nightstand goes (not drawn, lit or aimed at). */
  /** See `RoomCommands.setBackdrop`: while on and the camera is settled, the room draws every `BACKDROP_FRAME_STEP`th frame. */
  backdrop = false;
  private backdropFrame = 0;
  setBackdrop(on: boolean) {
    this.backdrop = on;
    this.backdropFrame = 0;
  }
  /** The arms load after the warm-up compile; their shaders are built once they arrive, before they first rise into view. */
  private armsCompiled = false;
  setPhoneCarried(carried: boolean) {
    if (carried === this.phoneCarried) return;
    this.phoneCarried = carried;
    const phone = this.apt.phone;
    phone.visible = !carried;
    const index = this.apt.hits.indexOf(phone);
    if (carried && index >= 0) this.apt.hits.splice(index, 1);
    else if (!carried && index < 0) this.apt.hits.push(phone);
    if (carried && this.hovered === 'phone') { this.hovered = null; this.ui.prompt = null; this.ui.anchor = null; this.ui.focus = false; this.emit(); }
  }

  /**
   * Story host: follow the projected screen of a device. While the matching inspect pose is reached the
   * listener gets the four viewport-pixel corners (top-left, top-right, bottom-right, bottom-left) when they
   * change by more than a quarter pixel, and `null` when the screen is behind the camera. `null` as device
   * stops watching. Nothing is reported while the camera is still moving into the pose.
   */
  watchScreen(device: ScreenDeviceId | null, listener?: (corners: ScreenCornersPx | null) => void) {
    if (device === null || !listener) { this.screenWatch = null; return; }
    this.readScreenOffset();
    this.screenWatch = { device, listener, last: [0, 0, 0, 0, 0, 0, 0, 0], hasLast: false, visible: false };
    this.updateScreenWatch();
  }

  private screenLeft = 0;
  private screenTop = 0;
  private readScreenOffset() { const r = this.container.getBoundingClientRect(); this.screenLeft = r.left; this.screenTop = r.top; }
  private screenWatch: { device: ScreenDeviceId; listener: (corners: ScreenCornersPx | null) => void; last: number[]; hasLast: boolean; visible: boolean } | null = null;

  private updateScreenWatch() {
    const w = this.screenWatch;
    if (!w || !this.opts.story) return;
    const ins = this.inspect;
    if (!ins || ins.id !== w.device || ins.dir !== 1 || !ins.ready) return;
    const mesh = w.device === 'laptop' ? this.apt.laptopScreenMesh : this.apt.phoneScreenMesh;
    const params = (mesh.geometry as THREE.PlaneGeometry).parameters;
    const hw = params.width / 2, hh = params.height / 2;
    mesh.updateWorldMatrix(true, false);
    for (let i = 0; i < 4; i++) {
      _scrPoint.set(i === 0 || i === 3 ? -hw : hw, i < 2 ? hh : -hh, 0).applyMatrix4(mesh.matrixWorld);
      _scrWorld[i * 3] = _scrPoint.x; _scrWorld[i * 3 + 1] = _scrPoint.y; _scrWorld[i * 3 + 2] = _scrPoint.z;
    }
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    _scrViewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const ok = projectCornersToViewport(_scrViewProj.elements, _scrWorld, this.container.clientWidth, this.container.clientHeight, this.screenLeft, this.screenTop, _scrOut);
    if (!ok) {
      if (w.visible || !w.hasLast) { w.visible = false; w.hasLast = true; w.listener(null); }
      return;
    }
    if (w.visible && w.hasLast && !cornersChanged(w.last, _scrOut, 0.25)) return;
    for (let i = 0; i < 8; i++) w.last[i] = _scrOut[i];
    w.visible = true; w.hasLast = true;
    w.listener([_scrOut[0], _scrOut[1], _scrOut[2], _scrOut[3], _scrOut[4], _scrOut[5], _scrOut[6], _scrOut[7]]);
  }

  private taskWatch: { prop: ScreenDeviceId; listener: (marker: TaskMarker | null) => void; last: TaskMarker | null; reported: boolean } | null = null;
  /**
   * Story host: follow the task marker of the laptop or the phone (a point a little above the prop). Reports
   * when the placement moves by more than half a pixel, crosses the screen edge or the distance changes, and
   * null while the player is not walking. `null` as prop stops watching.
   */
  watchTaskMarker(prop: ScreenDeviceId | null, listener?: (marker: TaskMarker | null) => void) {
    if (prop === null || !listener) { this.taskWatch = null; return; }
    this.taskWatch = { prop, listener, last: null, reported: false };
    this.updateTaskMarker();
  }
  private updateTaskMarker() {
    const w = this.taskWatch;
    if (!w || !this.opts.story) return;
    const report = (marker: TaskMarker | null) => { w.last = marker; w.reported = true; w.listener(marker); };
    if (!this.ui.started || this.inspect || this.entrance) { if (w.last !== null || !w.reported) report(null); return; }
    if (w.prop === 'phone') this.apt.phone.getWorldPosition(_taskPoint);
    else _taskPoint.copy(this.apt.points.laptop);
    _taskPoint.y += TASK_MARKER_LIFT_M;
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    _scrViewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const placed = placeTaskMarker(_scrViewProj.elements, _taskPoint.x, _taskPoint.y, _taskPoint.z, this.container.clientWidth, this.container.clientHeight, TASK_MARKER_MARGIN_PX);
    if (!placed) { if (w.last !== null || !w.reported) report(null); return; }
    const distance = Math.round(cam.position.distanceTo(_taskPoint) * 10) / 10;
    const last = w.last;
    if (last && last.onScreen === placed.onScreen && last.distance === distance && Math.abs(last.x - placed.x) <= 0.5 && Math.abs(last.y - placed.y) <= 0.5) return;
    report({ ...placed, distance });
  }
  /** External story: vibration cycle and call timer, the part of `updateStory` the host does not own. */
  private updateExternal(dt: number) {
    if (this.phoneMode === 'call') this.callSec += dt;
    if (!this.extRinging) return;
    this.vibeClock += dt;
    const on = this.vibeClock % 1.6 < 0.85;
    if (on !== this.vibeOn) { this.vibeOn = on; this.audio.setVibe(on); if (on) this.phoneBaseRot += (Math.random() - 0.3) * 0.035; }
  }

  /* =================== STORY: the phone =================== */
  updateStory(dt: number) {
    if (this.story === 'external') { this.updateExternal(dt); return; }
    const el = this.t - this.startT;
    if (this.story === 'calm' && this.ui.started) {
      const quiet = this.t - this.lastInteract;
      const ready = (this.used.size >= 4 && el > 70 && quiet > 7 && !this.inspect) || (el > 210 && !this.inspect) || el > 300;
      if (ready) {
        this.story = 'presilence'; this.storyT = 0;
        this.audio.setFridge(false); // the compressor clicks off… and the room goes very quiet
        this.audio.duckCity(0.55);
      }
    } else if (this.story === 'presilence') {
      this.storyT += dt;
      if (this.storyT > 4.5) {
        this.story = 'ringing'; this.storyT = 0; this.vibeClock = 0;
        this.phoneMode = 'ringing';
        this.audio.stinger();
        this.audio.ring(true);
        // Rain, city bed, thunder and the clock drop well under the ringtone and the call.
        this.audio.duckCity(0.25);
        if (this.inspect && this.inspect.id !== 'phone') this.endInspect();
        this.standYaw = -1.05;
        this.later(1.1, () => { if (this.seat === 'seated' && !this.inspect) this.standUp(); });
        this.later(3.5, () => { if (this.story === 'ringing') this.say(tr('say.whoCalls')); });
      }
    } else if (this.story === 'ringing') {
      this.storyT += dt;
      this.vibeClock += dt;
      const cyc = this.vibeClock % 1.6;
      const on = cyc < 0.85;
      if (on !== this.vibeOn) { this.vibeOn = on; this.audio.setVibe(on); if (on) this.phoneBaseRot += (Math.random() - 0.3) * 0.035; }
      if (this.storyT > 42) { this.missCall(); }
    } else if (this.story === 'call') {
      this.storyT += dt;
      this.callSec += dt;
    }
  }

  stopVibe() { this.vibeOn = false; this.audio.setVibe(false); this.audio.ring(false); }

  answerCall() {
    this.stopVibe();
    this.story = 'call'; this.storyT = 0; this.callSec = 0;
    this.phoneMode = 'call';
    this.ui.inspecting = { title: tr('title.calling'), actions: [] };
    this.emit();
    const lines: [number, string, boolean][] = [
      [1.2, tr('say.callL1'), true],
      [6.0, tr('say.callL2'), true],
      [11.6, tr('say.callL3'), true],
      [18.0, tr('say.callL4'), false],
    ];
    lines.forEach(([t, s, v]) => this.later(t, () => this.say(s, v, 5.2)));
    this.later(23.5, () => this.finish('answered'));
  }

  declineCall() {
    this.stopVibe();
    this.story = 'declined'; this.storyT = 0;
    this.phoneMode = 'lock';
    this.ui.inspecting = { title: tr('title.phone'), actions: [] };
    this.emit();
    this.later(1.0, () => this.say(tr('say.callEnded')));
    this.later(5.5, () => this.smsArrives());
  }

  missCall() {
    this.stopVibe();
    this.story = 'missed'; this.storyT = 0;
    this.phoneMode = 'aod';
    this.later(2.5, () => this.smsArrives());
  }

  smsArrives() {
    this.phoneMode = 'sms';
    let n = 0;
    const buzz = () => { this.audio.setVibe(true); this.vibeOn = true; this.later(0.32, () => { this.audio.setVibe(false); this.vibeOn = false; if (++n < 2) this.later(0.25, buzz); }); };
    buzz();
    if (this.inspect?.id === 'phone') { this.ui.inspecting = { title: tr('title.message'), actions: [] }; this.emit(); }
    this.later(1.4, () => this.say(tr('say.smsArrives')));
    this.later(9.5, () => this.finish('declined'));
  }

  finish(kind: 'answered' | 'declined') {
    if (this.ui.ended) return;
    this.story = 'done';
    if (kind === 'answered') { this.phoneMode = 'lock'; }
    this.audio.duckCity(1);
    this.audio.setFridge(true);
    this.ui.ended = kind;
    if (this.inspect) { const keep = this.inspect; keep.dir = 1; }
    this.ui.inspecting = this.inspect ? { title: titleOf(this.inspect.id), actions: [{ key: 'Q', label: tr('action.back') }] } : null;
    this.emit();
  }

  continueAfterEnd() {
    this.ui.ended = null;
    this.emit();
    this.lock();
  }

  /* =================== SEAT + FRIDGE =================== */
  startSit() {
    if (this.story === 'ringing' || this.seat !== 'none') return;
    this.seat = 'sitting'; this.seatT = 0;
    this.yaw = THREE.MathUtils.euclideanModulo(this.yaw + Math.PI, Math.PI * 2) - Math.PI;
    this.seatFrom = { pos: this.pos.clone(), yaw: this.yaw, pitch: this.pitch };
    this.vel.set(0, 0, 0);
    this.ui.seated = true; this.ui.prompt = null; this.ui.anchor = null; this.ui.focus = false; this.emit();
    this.audio.chairRoll();
    this.later(1.4, () => this.audio.sit());
    this.later(2.3, () => { this.laptopWoken = true; this.audio.setFan(true); });
    this.later(2.8, () => this.say(this.used.has('sat') ? tr('say.sat') : tr('say.satFirst')));
    this.used.add('sat');
  }

  standUp() {
    if (this.seat !== 'seated' || this.inspect) return;
    this.seat = 'standing'; this.seatT = 0;
    this.seatFrom = { pos: this.pos.clone(), yaw: this.yaw, pitch: this.pitch };
    this.ui.seated = false; this.emit();
    this.audio.chairRoll();
  }

  updateSeat(dt: number) {
    const f = this.seatFrom;
    let c = this.seat === 'seated' ? 1 : 0;
    if (this.seat === 'sitting') {
      this.seatT = Math.min(1, this.seatT + dt / 2.2);
      const kh = easeIO(Math.min(1, this.seatT / 0.72)), kv = easeIO(Math.max(0, (this.seatT - 0.42) / 0.58));
      this.pos.x = THREE.MathUtils.lerp(f.pos.x, SEAT.x, kh); this.pos.z = THREE.MathUtils.lerp(f.pos.z, SEAT.z, kh);
      this.pos.y = THREE.MathUtils.lerp(f.pos.y, SEAT.y, kv);
      this.yaw = f.yaw + angDiff(f.yaw, SEAT.yaw) * kh; this.pitch = THREE.MathUtils.lerp(f.pitch, SEAT.pitch, kh);
      c = kh;
      if (this.seatT >= 1) this.seat = 'seated';
    } else if (this.seat === 'standing') {
      this.seatT = Math.min(1, this.seatT + dt / 1.6);
      const kv = easeIO(Math.min(1, this.seatT / 0.5)), kh = easeIO(Math.max(0, (this.seatT - 0.25) / 0.75));
      this.pos.y = THREE.MathUtils.lerp(f.pos.y, STAND.y, kv);
      this.pos.x = THREE.MathUtils.lerp(f.pos.x, STAND.x, kh); this.pos.z = THREE.MathUtils.lerp(f.pos.z, STAND.z, kh);
      this.yaw = f.yaw + angDiff(f.yaw, this.standYaw) * kh; this.pitch = THREE.MathUtils.lerp(f.pitch, -0.05, kh);
      c = 1 - easeIO(Math.min(1, Math.max(0, (this.seatT - 0.2) / 0.8)));
      if (this.seatT >= 1) { this.seat = 'none'; this.standYaw = -2.5; }
    }
    const ch = this.apt.chair;
    ch.position.lerpVectors(CHAIR_REST, CHAIR_DESK, c);
    ch.rotation.y = THREE.MathUtils.lerp(0.45, 0, c) + (this.seat === 'seated' ? this.yaw * 0.25 : 0);
  }

  setFridgeDoor(open: boolean) {
    if (this.fridgeOpen === open) return;
    this.fridgeOpen = open; this.fridgeOpenT = 0; this.fridgeSaid = false; this.fridgeBeepT = 0;
    this.audio.fridgeDoor(open);
    if (this.inspect?.id === 'fridge') { this.ui.inspecting = { title: titleOf('fridge'), actions: this.actionsFor('fridge') }; this.emit(); }
  }

  /* =================== PER-FRAME =================== */
  movePlayer(dt: number) {
    if (this.inspect || this.seat !== 'none' || this.callHeld()) { this.vel.set(0, 0, 0); this.walkSpeed = 0; this.running = false; return; }
    const f = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const s = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = (run ? 2.0 : 1.25) * (this.ui.locked || this.ui.cursorMode ? 1 : 0);
    const fwd = _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const want = _want.copy(fwd.multiplyScalar(f)).add(right.multiplyScalar(s));
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed);
    this.vel.lerp(want, 1 - Math.exp(-dt * 7));
    const next = _next.copy(this.pos).addScaledVector(this.vel, dt);
    const R = 0.24;
    next.x = THREE.MathUtils.clamp(next.x, ROOM.x0 + R, ROOM.x1 - R);
    // With an outside world the front doorway is walkable while the door stands open (the jambs still hold).
    const inDoorway = !!this.outside && this.pos.z > ROOM.z1 - R + 1e-3;
    const doorPass = !!this.outside && this.outDoorT > 0.6 && Math.abs(next.x - DOOR_X) < DOOR_HALF;
    next.z = THREE.MathUtils.clamp(next.z, ROOM.z0 + R, inDoorway || doorPass ? ROOM.z1 + 0.6 : ROOM.z1 - R);
    if (inDoorway) next.x = THREE.MathUtils.clamp(next.x, DOOR_X - DOOR_HALF, DOOR_X + DOOR_HALF);
    for (const [ax0, ax1, az0, az1] of this.apt.colliders) {
      const cx = THREE.MathUtils.clamp(next.x, ax0, ax1), cz = THREE.MathUtils.clamp(next.z, az0, az1);
      const dx = next.x - cx, dz = next.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 0.0001;
        if (d2 === 0) { next.x = this.pos.x; next.z = this.pos.z; continue; }
        next.x = cx + (dx / d) * R; next.z = cz + (dz / d) * R;
      }
    }
    this.pos.x = next.x; this.pos.z = next.z;
    if (this.outside && this.pos.z > ROOM.z1 + 0.25) { this.goOutdoors(); return; }
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.walkSpeed = sp;
    this.running = run && sp > 1.6;
    if (sp > 0.05) {
      this.bobPhase += dt * sp * 5.2;
      const sign = Math.sign(Math.sin(this.bobPhase));
      if (sign !== this.lastStepSign && sign !== 0) { this.lastStepSign = sign; this.audio.started && this.audio.footstep(this.running); }
    }
  }

  updateCamera(dt: number) {
    const cam = this.camera;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const breathe = Math.sin(this.t * 1.1) * 0.004;
    const bob = Math.abs(Math.sin(this.bobPhase)) * 0.018 * Math.min(1, sp / 1.2);
    const sway = Math.sin(this.bobPhase) * 0.004 * Math.min(1, sp / 1.2);
    const walkPos = _walkPos.set(this.pos.x, this.pos.y + breathe + bob - 0.009, this.pos.z);
    const walkQ = _walkQ.setFromEuler(_walkE.set(this.pitch + Math.sin(this.t * 0.7) * 0.003, this.yaw + sway * 0.5, Math.sin(this.bobPhase * 0.5) * 0.003, 'YXZ'));
    if (this.inspect) {
      const ins = this.inspect;
      ins.t = Math.min(1, ins.t + dt / inspectDurationSec(!!this.opts.story, ins.id, ins.dir === 1 ? 1 : -1));
      const k = ins.t < 0.5 ? 4 * ins.t ** 3 : 1 - (-2 * ins.t + 2) ** 3 / 2;
      let toPos: THREE.Vector3, toQ: THREE.Quaternion, toFov: number;
      if (ins.dir === 1) {
        // The laptop holds still under its page (owner); other props keep a little breathing.
        const still = ins.id === 'laptop' && !!this.opts.story;
        toPos = still ? ins.to.pos.clone() : ins.to.pos.clone().add(V(0, Math.sin(this.t * 1.1) * 0.002, 0));
        const m = new THREE.Matrix4().lookAt(ins.to.pos, ins.to.look, V(0, 1, 0));
        toQ = new THREE.Quaternion().setFromRotationMatrix(m);
        const off = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.lookOffset.y, this.lookOffset.x, 0, 'YXZ'));
        toQ.multiply(off);
        toFov = ins.to.fov;
      } else { toPos = walkPos; toQ = walkQ; toFov = 68; }
      // arc the path slightly (camera "leans in" rather than sliding)
      const p = ins.from.pos.clone().lerp(toPos, k);
      p.y += Math.sin(k * Math.PI) * (ins.dir === 1 ? 0.035 : 0.02);
      cam.position.copy(p);
      cam.quaternion.copy(ins.from.q).slerp(toQ, k);
      cam.fov = THREE.MathUtils.lerp(ins.from.fov, toFov, k);
      cam.updateProjectionMatrix();
      if (ins.dir === -1 && ins.t >= 1) { this.inspect = null; }
      else if (ins.dir === 1 && ins.t >= 1 && !ins.ready) {
        ins.ready = true;
        const port = this.opts.story;
        if (port && isRoomPropId(ins.id)) port.onProp(ins.id, 'inspect-ready');
      }
    } else {
      cam.position.copy(walkPos);
      cam.quaternion.copy(walkQ);
      if (cam.fov !== 68) { cam.fov = 68; cam.updateProjectionMatrix(); }
    }
    void dt;
  }

  /** Projects the world point of the aimed prop into `_anchorOut`. False when it is behind the camera. */
  private projectHoverAnchor(id: string, found: THREE.Intersection[]): boolean {
    const known = Object.hasOwn(this.apt.points, id) ? this.apt.points[id] : null;
    if (known) _anchorPoint.copy(known);
    else {
      const hit = found.find((h) => h.object.userData.id === id);
      if (!hit) return false;
      _anchorBox.setFromObject(hit.object).getCenter(_anchorPoint);
    }
    const cam = this.camera;
    cam.updateMatrixWorld();
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    _scrViewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    return projectPointToViewport(_scrViewProj.elements, _anchorPoint.x, _anchorPoint.y, _anchorPoint.z, this.container.clientWidth, this.container.clientHeight, 0, 0, _anchorOut, 0);
  }

  updateHover() {
    if (this.inspect || !this.ui.started || this.seat === 'sitting' || this.seat === 'standing') { if (this.ui.prompt || this.ui.anchor) { this.ui.prompt = null; this.ui.anchor = null; this.ui.focus = false; this.emit(); } this.hovered = null; return; }
    // The prompt under the crosshair is refreshed at 30 Hz; nobody can tell, and it halves the raycasts.
    if ((this.hoverFrame++ & 1) === 1) return;
    this.raycaster.setFromCamera(_center, this.camera);
    this.raycaster.far = 2.3;
    const found = this.raycaster.intersectObjects(this.apt.hits, true);
    let id: string | null = this.apt.laptopHitProxy
      ? pickHoverId(found.map((h) => ({ id: h.object.userData.id as string, proxy: !!h.object.userData.hitProxy, distance: h.distance })))
      : ((found[0]?.object.userData.id as string) ?? null);
    if (id === 'chair' && this.seat !== 'none') id = null;
    if (this.outdoors && id !== 'door') id = null;
    // Story mode only: the aimed prop's world point, projected; the prompt is drawn next to it.
    let ax: number | null = null;
    let ay: number | null = null;
    if (id && this.opts.story && this.label(id) !== null && this.projectHoverAnchor(id, found)) { ax = _anchorOut[0]; ay = _anchorOut[1]; }
    const moved = anchorMoved(this.ui.anchor, ax, ay, ANCHOR_TOLERANCE_PX);
    if (id !== this.hovered || (id && this.label(id) !== this.ui.prompt) || moved) {
      this.hovered = id;
      this.ui.prompt = id ? this.label(id) : null;
      this.ui.anchor = ax !== null && ay !== null ? { x: ax, y: ay } : null;
      this.ui.focus = !!id;
      this.emit();
    }
  }

  updateArms(dt: number) {
    // The viewmodel clones its meshes with shadows on; the static shadow maps must not redraw for the hands.
    if (!this.armsShadowOff && this.arms.loaded) {
      this.arms.group.traverse((o) => {
        o.castShadow = false;
        const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!(o as THREE.Mesh).isMesh || !mat?.isMeshStandardMaterial) return;
        // The hands keep their own skin colour: the dim, mostly back-lit room left them almost black. They stay lit
        // by the room's lights; a soft view-facing fill (indirect light only) adds `armFill` of their base colour.
        mat.roughness = 0.8; // the model's own value (the shared loader sets 0.55)
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uArmFill = this.armFill;
          sh.fragmentShader = 'uniform float uArmFill;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>',
            '#include <lights_fragment_end>\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * uArmFill * (0.55 + 0.45 * saturate(dot(normal, normalize(vViewPosition))));');
        };
        mat.customProgramCacheKey = () => 'room-arms-fill';
        mat.needsUpdate = true;
      });
      this.armsShadowOff = true;
    }
    // On the street the hands are still drawn in the room's scene, under its dim room lights: the fill follows the
    // outside light instead (bright by day, lower at night), eased over the doorway.
    const fillTarget = this.outside && this.outdoors ? 0.45 + 0.85 * (this.outside.daylight?.() ?? 0.5) : 0.3;
    this.armFill.value += (fillTarget - this.armFill.value) * (1 - Math.exp(-dt * 3));
    // Hands are stowed while seated or once the prologue has ended; Shift-running brings them up pumping (as in the neighborhood).
    this.arms.update(dt, this.walkSpeed > 0.3, this.running, this.seat !== 'none' || !!this.ui.ended || !this.ui.started);
    // Dry steps in the room and on a dry street; the wet walking loop on the street while it rains.
    this.audio.setWalk(this.walkSpeed, this.running, !!this.outside && this.outdoors);
  }

  updateLights(dt: number) {
    const a = this.apt;
    const L = this.lightLevels;
    const ease = (cur: number, on: boolean, up: number, down: number) => THREE.MathUtils.clamp(cur + (on ? dt * up : -dt * down), 0, 1);
    const prev = { ...L };
    L.ceiling = ease(L.ceiling, this.lights.ceiling, 5, 8);
    L.desk = ease(L.desk, this.lights.desk, 14, 14);
    L.bed = ease(L.bed, this.lights.bed, 6, 6);
    L.kitchen = ease(L.kitchen, this.lights.kitchen, 9, 9);
    // LED bulb warming flicker on switch-on
    const flick = L.ceiling > 0 && L.ceiling < 1 ? (Math.random() < 0.5 ? 0.6 : 1) : 1;
    a.lights.ceilingSpot.intensity = 3.2 * L.ceiling * flick;
    a.lights.ceilingFill.intensity = 1.3 * L.ceiling * flick;
    a.emissives.ceiling.emissiveIntensity = 0.9 * L.ceiling * flick;
    a.lights.deskSpot.intensity = 2.6 * L.desk;
    a.lights.deskFill.intensity = 0.4 * L.desk;
    a.emissives.desk.emissiveIntensity = 14 * Math.max(L.desk, L.bed);
    a.lights.bedLamp.intensity = 0.8 * L.bed;
    a.emissives.bed.emissiveIntensity = 0.7 * L.bed;
    a.lights.kitchen.intensity = 2.4 * L.kitchen;
    a.emissives.kitchen.emissiveIntensity = 6 * L.kitchen;
    if (prev.ceiling !== L.ceiling || prev.desk !== L.desk || prev.bed !== L.bed || prev.kitchen !== L.kitchen) {
      if ([L.ceiling, L.desk, L.bed, L.kitchen].every((v) => v === 0 || v === 1)) this.envDirty = true;
    }
    // warm interior reflection on glass
    const warm = L.ceiling * 0.5 + L.desk * 0.18 + L.bed * 0.22 + L.kitchen * 0.1;
    this.glassMats.forEach((m) => { m.uniforms.uWarm.value.setRGB(0.9, 0.62, 0.38).multiplyScalar(warm * 0.12); });
    // eye adaptation: darkness opens the pupils
    const target = warm > 0.35 ? 0.95 : warm > 0.1 ? 1.2 : 1.55;
    this.exposure += (target - this.exposure) * (1 - Math.exp(-dt * (target < this.exposure ? 3.5 : 0.5)));
    this.renderer.toneMappingExposure = this.exposure;
    // neon flicker on the ceiling
    if (Math.random() < 0.02) this.neonSpot.userData.off = Math.random() < 0.3;
    this.neonSpot.intensity = this.neonSpot.userData.off ? 3 : 26 + Math.sin(this.t * 40) * 1.5;
  }

  updateDevices(dt: number) {
    const a = this.apt;
    const el = this.ui.started ? this.t - this.startT : 0;
    setGameElapsedSeconds(el);
    const time = this.storyClockSeconds === null ? clock({ h: 23, m: 8 }, el) : formatClock(this.storyClockSeconds);
    // laptop
    if (this.laptopWoken) this.laptopAwake = Math.min(1, this.laptopAwake + dt * 1.8);
    a.laptopScreenMat.color.setScalar(1.0 * this.laptopAwake);
    a.lights.laptop.intensity = 0.07 * this.laptopAwake;
    a.emissives.powerLed.color.setScalar(this.laptopAwake > 0 ? 1.4 : 0.6 + Math.sin(this.t * 2) * 0.6);
    const awakeKey = this.laptopAwake > 0 ? 1 : 0;
    if ((this.laptopAwake > 0 && this.laptopAwake < 1) || time !== this.lastClock || this.typed !== this.lastTyped || awakeKey !== this.lastAwakeKey) {
      a.laptopScreen.draw(this.laptopAwake, time, typedText().slice(0, this.typed), this.opts.story ? this.laptopFrame : undefined); this.lastTyped = this.typed; this.lastAwakeKey = awakeKey;
    }
    // phone
    if (this.phoneMode === 'lock' && this.story === 'calm' && this.t > this.phoneLockUntil) this.phoneMode = 'aod';
    const ringing = this.phoneMode === 'ringing';
    const bright = this.phoneMode === 'aod' ? 0.55 : this.phoneMode === 'dark' ? 0 : 1.1;
    const pc = a.phoneScreenMat.color.r + (bright - a.phoneScreenMat.color.r) * Math.min(1, dt * 6);
    a.phoneScreenMat.color.setScalar(pc);
    a.lights.phone.intensity = this.phoneCarried ? 0 : (this.phoneMode === 'aod' ? 0.0 : ringing ? 0.22 + Math.sin(this.t * 6) * 0.06 : 0.14) * (pc / 1.1);
    // Only the ringing and call screens animate; the others change with the minute or the mode, so a
    // 390x844 canvas is no longer redrawn and re-uploaded twice a second for nothing.
    const animated = ringing || this.phoneMode === 'call';
    if ((animated && this.t - this.lastPhoneDraw > 0.06) || time !== this.lastClock || this.phoneMode !== this.lastPhoneMode) {
      a.phoneScreen.draw(this.phoneMode, time, this.t, this.callSec);
      this.lastPhoneDraw = this.t;
      this.lastPhoneMode = this.phoneMode;
    }
    this.lastClock = time;
    // physical vibration: the phone walks across the wood
    if (this.vibeOn) {
      a.phone.position.set(this.phoneBase.x + (Math.random() - 0.5) * 0.0024, this.phoneBase.y + Math.random() * 0.0008, this.phoneBase.z + (Math.random() - 0.5) * 0.0024);
      a.phone.rotation.y = this.phoneBaseRot + (Math.random() - 0.5) * 0.01;
      this.phoneBase.x += dt * 0.0016;
    } else {
      a.phone.position.copy(this.phoneBase);
      a.phone.rotation.y = this.phoneBaseRot;
    }
    // window sash
    const target = this.windowOpen ? -0.45 : 0;
    this.sashX += (target - this.sashX) * (1 - Math.exp(-dt * 3));
    if (Math.abs(target - this.sashX) < 5e-4) this.sashX = target;
    if (!a.rightSash.userData.base) a.rightSash.userData.base = a.rightSash.position.x;
    a.rightSash.position.x = a.rightSash.userData.base + this.sashX;
    // curtain would breathe a little with the window open (via glass fog)
    this.glassMats.forEach((m) => { m.uniforms.uTime.value = this.t; m.uniforms.uFog.value = 0.55 - (this.windowOpen ? 0.25 : 0) * Math.min(1, el / 60); });
    if (this.outside) {
      // The weather outside decides how much rain runs down the glass and how much daylight comes in.
      const rain = this.outside.rainAmount?.() ?? 1;
      const day = this.outside.daylight?.() ?? 0;
      this.audio.setRain(rain);
      this.glassMats.forEach((m) => {
        const u = m.uniforms;
        u.uSliding.value = 0.05 + 0.3 * rain; u.uFog.value *= 0.5 + 0.5 * rain;
        u.uMinLod.value = 1.2 + 1.3 * day; u.uRefract.value = 0.9 - 0.6 * day; u.uBeads.value = 1 - 0.85 * day;
      });
      this.winRect.intensity = 1.6 + 0.7 * day;
      this.winRect.color.setRGB(0.55 + 0.25 * day, 0.59 + 0.22 * day, 0.78 + 0.1 * day);
    }
    // kettle
    if (this.kettleOn) {
      this.kettleT += dt;
      if (this.kettleT > 19) { this.kettleOn = false; this.audio.kettle(false); this.say(tr('say.kettleDone')); }
    }
    const steam = a.steam;
    const sm = steam.material as THREE.PointsMaterial;
    const steamAmt = this.kettleOn ? THREE.MathUtils.smoothstep(this.kettleT, 8, 16) : Math.max(0, sm.opacity - dt * 0.1);
    sm.opacity = this.kettleOn ? steamAmt * 0.5 : Math.max(0, sm.opacity - dt * 0.15);
    if (sm.opacity > 0.001) {
      const p = steam.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.apt.points.kettle;
      for (let i = 0; i < p.count; i++) {
        const life = ((this.t * 0.35 + i / p.count) % 1);
        p.setXYZ(i, base.x + 0.06 + Math.sin(i * 7.1 + this.t) * 0.02 * life * 3, base.y + 0.13 + life * 0.45, base.z - 0.06 + Math.cos(i * 3.3 + this.t * 0.7) * 0.02 * life * 3);
      }
      p.needsUpdate = true;
    }
    // fridge door, light, mist
    const fTarget = this.fridgeOpen ? 1.5 : 0;
    this.fridgeAng += (fTarget - this.fridgeAng) * (1 - Math.exp(-dt * (this.fridgeOpen ? 4.2 : 6)));
    if (Math.abs(fTarget - this.fridgeAng) < 0.002) this.fridgeAng = fTarget;
    a.fridgeDoor.rotation.y = this.fridgeAng;
    this.fridgeLvl += ((this.fridgeAng > 0.06 ? 1 : 0) - this.fridgeLvl) * Math.min(1, dt * 30);
    a.fridge.point.intensity = 0.28 * this.fridgeLvl;
    a.fridge.spot.intensity = 1.5 * this.fridgeLvl;
    a.fridge.led.color.setRGB(0.8, 0.9, 1.05).multiplyScalar(this.fridgeLvl);
    const col = a.fridgeCollider;
    if (this.fridgeAng > 0.5) { col[0] = -2.64; col[1] = -2.5; col[2] = 0.94; col[3] = 1.5; } else { col[0] = col[1] = col[2] = col[3] = 100; }
    const mm = a.fridge.mist.material as THREE.PointsMaterial;
    mm.opacity = 0.22 * THREE.MathUtils.smoothstep(this.fridgeAng, 0.4, 1.2);
    if (mm.opacity > 0.002) {
      const p = a.fridge.mist.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const life = (this.t * 0.22 + i / p.count) % 1;
        p.setXYZ(i, -2.27 + Math.sin(i * 12.9) * 0.2 + Math.sin(this.t + i) * 0.03 * life, 0.2 - life * 0.19, 1.5 - life * 0.55 + Math.cos(i * 7.7) * 0.05);
      }
      p.needsUpdate = true;
    }
    if (this.fridgeOpen && this.audio.started) {
      this.fridgeOpenT += dt;
      if (this.fridgeOpenT > 28 && !this.fridgeSaid && !this.inspect) { this.fridgeSaid = true; this.say(tr('say.fridgeOpen')); }
      if (this.fridgeOpenT > 48) { this.fridgeBeepT -= dt; if (this.fridgeBeepT <= 0) { this.fridgeBeepT = 3.6; this.audio.beep(); } }
    }
    // wall clock follows game time
    const secs = this.storyClockSeconds ?? 23 * 3600 + 8 * 60 + el;
    const hh = (secs / 3600) % 12, mmn = (secs / 60) % 60, ss = secs % 60;
    a.clockHands.h.rotation.z = -(hh / 12) * Math.PI * 2;
    a.clockHands.m.rotation.z = -(mmn / 60) * Math.PI * 2;
    a.clockHands.s.rotation.z = -(Math.floor(ss) / 60) * Math.PI * 2;
    const sec = Math.floor(el);
    if (sec !== this.lastSecond) { this.lastSecond = sec; if (this.audio.started && this.ui.started) this.audio.tick(); }
    // dust motes
    {
      const p = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const sd = this.dustSeed[i * 4];
        let x = p.getX(i) + Math.sin(this.t * 0.13 + sd) * dt * 0.012, y = p.getY(i) + Math.sin(this.t * 0.21 + sd * 2) * dt * 0.01 - dt * 0.004, z = p.getZ(i) + Math.cos(this.t * 0.11 + sd) * dt * 0.012;
        if (y < 0.2) y = 2.4;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
      const lit = Math.min(1, this.lightLevels.ceiling + this.lightLevels.desk * 0.8 + this.lightLevels.bed * 0.6 + this.lightLevels.kitchen * 0.4);
      (this.dust.material as THREE.PointsMaterial).opacity = 0.05 + lit * 0.4;
    }
    // droplet light mask
    this.dropT += dt;
    if (this.dropT > 0.12) { this.dropT = 0; paintDropMask(this.dropCanvas, this.t); this.dropTex.needsUpdate = true; }
    // AC LED breathing
    a.emissives.acLed.color.setRGB(0.1, 0.6 + Math.sin(this.t * 0.8) * 0.3, 0.2);
  }

  loop(now: number) {
    if (this.disposed || !this.live) return;
    this.raf = requestAnimationFrame(this.loop);
    const tNow = now / 1000;
    const rawDt = Math.min(1, tNow - (this.t || tNow));
    const dt = Math.min(0.05, rawDt);
    this.t = tNow;

    const out = this.outside;
    // Front door swing (outside world plugged in; the entrance shot drives the leaf itself).
    if (out) {
      this.outDoorT += ((this.outDoorOpen ? 1 : 0) - this.outDoorT) * (1 - Math.exp(-dt * 4));
      if (!this.entrance) this.apt.doorLeaf.rotation.y = -this.outDoorT * 1.45;
    }
    if (out && this.outdoors) {
      // Outside: the outside world walks the player with the room's keys and look; the room camera follows it.
      const lens = this.lensForOutside();
      const res = out.stepPlay(dt, { ...lens, keys: this.ui.locked || this.ui.cursorMode ? this.keys : EMPTY_KEYS, yaw: this.yaw, pitch: this.pitch, door: this.outDoorT });
      if (res.inRoom) {
        this.outdoors = false;
        this.pos.set(res.position.x, HANDOFF.y, Math.min(res.position.z, ROOM.z1 + 0.2));
        this.vel.set(0, 0, 0);
        this.updateCamera(dt);
      } else {
        this.camera.position.copy(res.position);
        this.camera.quaternion.setFromEuler(_walkE.set(this.pitch, this.yaw, 0, 'YXZ'));
        const shift = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        this.walkSpeed = dt > 0 ? res.moved / dt : 0;
        this.running = shift && this.walkSpeed > 3;
        if (res.moved > 0) {
          this.bobPhase += res.moved * 5.2;
          // The street pace is faster than the room's: one step per stride (longer while running), as in the neighborhood.
          this.streetStepAcc += res.moved;
          const stride = this.running ? 2.9 : 1.6;
          if (this.streetStepAcc > stride) { this.streetStepAcc = 0; this.audio.started && this.audio.footstep(this.running); }
        }
      }
    } else {
      this.walkSpeed = 0; this.running = false;
      if (this.entrance) this.stepEntrance(dt);
      else if (this.ui.started) {
        // Below 20 fps one 50 ms step made walking slow; up to 100 ms of real time is walked in two steps.
        let rem = Math.min(0.1, rawDt);
        do { const step = Math.min(0.05, rem); this.movePlayer(step); rem -= step; } while (rem > 1e-4 && !this.outdoors);
      }
      if (!this.outdoors) {
        this.updateSeat(rawDt > 0.05 ? 0.05 : dt);
        this.updateCamera(dt);
      }
    }
    this.updateScreenWatch();
    this.updateTaskMarker();
    this.updateArms(dt);
    this.updateHover();
    this.updateStory(rawDt);
    this.updateLights(dt);
    this.updateDevices(dt);
    this.city.update(this.t, dt);
    if (this.envDirty) this.updateEnv();

    // fade in
    if (this.ui.started && this.ui.fade > 0) { this.ui.fade = Math.max(0, this.ui.fade - dt / 3.5); }
    const endDim = this.ui.ended ? 0.55 : 1;
    const fu = this.finalPass.uniforms;
    if (!this.entrance) fu.uFade.value += ((1 - this.ui.fade) * endDim - fu.uFade.value) * Math.min(1, dt * 3);
    if (this.exiting) {
      // the neighborhood whites the screen out meanwhile; then it takes over
      this.exitT += dt / EXIT_SECONDS;
      if (this.exitT >= 1 && !this.exitSent) { this.exitSent = true; this.opts.onExit?.(); if (this.disposed) return; }
    }
    fu.uTime.value = this.t % 100;
    const tension = this.story === 'ringing' || this.story === 'call' || this.extMood === 'tense' ? 1 : 0;
    fu.uVig.value += ((0.85 + tension * 0.35) - fu.uVig.value) * dt * 0.8;
    fu.uDesat.value += ((tension * 0.18) - fu.uDesat.value) * dt * 0.6;

    const r = this.renderer;
    if (!this.armsCompiled && this.arms.loaded) {
      this.armsCompiled = true;
      void r.compileAsync(this.scene, this.camera).catch(() => undefined);
    }
    // Behind a page (the laptop) the settled room draws fewer frames; the canvas keeps the last one.
    const settled = this.inspect !== null && this.inspect.dir === 1 && this.inspect.t >= 1;
    if (this.backdrop && settled && this.shadowFrames <= 0) {
      this.backdropFrame = (this.backdropFrame + 1) % BACKDROP_FRAME_STEP;
      if (this.backdropFrame !== 0) return;
    }
    // pass 1: the city alone, for the glass to refract
    this.glassMats.forEach((m) => m.uniforms.uRes.value.set(r.domElement.width, r.domElement.height));
    if (out) {
      const cam = this.camera;
      if (!this.outdoors) {
        const window = Math.min(1, Math.abs(this.sashX) / 0.45);
        // Only the part of the street seen through the open door / window is drawn; nothing when neither is in view.
        // The rain glass shows the outside too: it only needs a fresh picture while the window is on screen.
        const windowInView = window > 0.01 || this.outsidePortal(false, true) !== false;
        const portal = this.outsidePortal(this.outDoorT > 0.01, window > 0.01);
        out.stepView(dt, { ...this.lensForOutside(), position: cam.position, quaternion: cam.quaternion, yaw: this.yaw, pitch: this.pitch, door: this.outDoorT, window, backdrop: portal !== false, portal: portal || null, windowInView });
      }
      const bd = out.backdrop();
      const quad = this.backdropQuad;
      if (quad) {
        quad.visible = !!bd;
        if (bd) {
          const u = quad.material.uniforms;
          u.tColor.value = bd.color;
          u.tDepth.value = bd.depth;
          if (bd.scale) u.uScale.value.copy(bd.scale); else u.uScale.value.set(1, 1);
          u.uGain.value = (out.exposure?.() ?? 1.3) / Math.max(0.05, r.toneMappingExposure);
        }
      }
    } else {
      this.camera.layers.set(1);
      r.setRenderTarget(this.cityRT);
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
      this.camera.layers.set(0);
      this.camera.layers.enable(1);
    }
    // pass 2: everything
    const sig = this.shadowSignature();
    if (sig !== this.shadowSig) { this.shadowSig = sig; this.shadowFrames = 2; }
    this.chairShadowWait--;
    const turn = this.chairTurnSignature();
    if (Math.abs(turn - this.chairShadowAt) > 1e-4 && this.chairShadowWait <= 0) { this.chairShadowAt = turn; this.chairShadowWait = 6; this.shadowFrames = Math.max(this.shadowFrames, 1); }
    if (this.shadowFrames > 0) { this.shadowFrames--; r.shadowMap.needsUpdate = true; }
    this.composer.render(dt);
  }

  /** A lightning strike in the outside world (0..1, already softened): thunder follows the flash. */
  outsideThunder(v: number) {
    this.audio.thunderAfter(Math.min(0.6, 0.25 + v * 0.8), 0.6 + Math.random() * 1.8);
  }
  /**
   * Where the open front door and the open window are on screen: a rectangle (0..1, origin bottom-left), null for
   * the whole screen (the camera is in the opening), or false when neither opening is open and in view.
   */
  private outsidePortal(door: boolean, win: boolean): OutsidePortal | null | false {
    if (!door && !win) return false;
    const cam = this.camera;
    cam.updateMatrixWorld();
    const p = _portalP;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const boxes: number[][] = [];
    // [x0, x1, y0, y1, z0, z1]: the doorway (through the wall, a little past it) and the window recess.
    if (door) boxes.push([DOOR_X - 0.46, DOOR_X + 0.46, -0.02, 2.16, ROOM.z1 - 0.06, ROOM.z1 + 0.2]);
    if (win) boxes.push([WIN.x0 - 0.02, WIN.x1 + 0.02, WIN.y0 - 0.02, WIN.y1 + 0.02, ROOM.z0 - WIN.depth - 0.02, ROOM.z0 + 0.02]);
    const near = -cam.near * 1.05;
    const add = (v: THREE.Vector3) => {
      v.applyMatrix4(cam.projectionMatrix);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    };
    for (const b of boxes) {
      // The box corners in view space, then its 12 edges clipped to the near plane, projected and bounded.
      for (let i = 0; i < 8; i++) _portalC[i].set(i & 1 ? b[1] : b[0], i & 2 ? b[3] : b[2], i & 4 ? b[5] : b[4]).applyMatrix4(cam.matrixWorldInverse);
      // The camera inside the opening's box: it fills the view.
      if (this.camInBox(b)) return null;
      for (const [i, j] of PORTAL_EDGES) {
        const a = _portalC[i], c = _portalC[j];
        const ia = a.z <= near, ic = c.z <= near;
        if (ia) add(p.copy(a));
        if (ic) add(p.copy(c));
        if (ia !== ic) add(p.copy(a).lerp(c, (near - a.z) / (c.z - a.z)));
      }
    }
    const pad = 0.02;
    x0 = Math.max(-1, x0 - pad); y0 = Math.max(-1, y0 - pad); x1 = Math.min(1, x1 + pad); y1 = Math.min(1, y1 + pad);
    if (x1 <= x0 || y1 <= y0) return false;
    const r = this.portalRect;
    r.x0 = (x0 + 1) / 2; r.y0 = (y0 + 1) / 2; r.x1 = (x1 + 1) / 2; r.y1 = (y1 + 1) / 2;
    return r;
  }
  private camInBox(b: number[]) {
    const c = this.camera.position, m = 0.15;
    return c.x > b[0] - m && c.x < b[1] + m && c.y > b[2] - m && c.y < b[3] + m && c.z > b[4] - m && c.z < b[5] + m;
  }
  private portalRect: OutsidePortal = { x0: 0, y0: 0, x1: 1, y1: 1 };
  /** The room camera's lens, for the outside world (same projection, so the two depth buffers agree). */
  private lensForOutside(): OutsideLens {
    const c = this.camera, l = this.outsideLens;
    l.fov = c.fov; l.aspect = c.aspect; l.near = c.near; l.far = c.far;
    return l;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.timeouts.forEach(clearTimeout);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('resize', this.onResize);
    this.arms.dispose();
    this.audio.dispose();
    const proxy = this.apt?.laptopHitProxy;
    if (proxy) { proxy.removeFromParent(); proxy.geometry.dispose(); (proxy.material as THREE.Material).dispose(); }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

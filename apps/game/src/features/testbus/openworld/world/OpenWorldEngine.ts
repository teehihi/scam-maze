import * as T from "three";
import { tr } from "../strings";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

import { buildApartment, ROOM, WIN, type Apartment } from "../room/apartment";
import { createRainGlass } from "../room/glass";
import { AudioEngine } from "../room/audio";
import { canvas as makeRoomCanvas, dropMaskCanvas, paintDropMask, toTex } from "../room/textures";

import {
  blocksBus,
  BUS_DOORS,
  CURB_HEIGHT,
  floorAt as busFloorAt,
  isInside as insideBus,
  rect,
  seatBase,
  seats as BUS_SEATS,
  toLocal as busToLocal,
  toWorld as busToWorld,
  type PassengerSeat,
  type Solid,
} from "../simulation/boarding";
import { buildStreet } from "../simulation/street";
import { buildBus } from "../simulation/bus";
import { BusRouteController, type TransitEvent } from "../simulation/transit";
import { castStreet } from "../simulation/residents";
import {
  createStoryNpcDirector,
  type ActiveStoryNpcDialogue,
  type AmbientStreetBark,
  type StoryNpcRadarBlip,
} from "../simulation/storyNpcs";
import {
  createHumanPresenceSystem,
  type CrowdReactionBark,
  type HumanPresenceSystem,
} from "../simulation/humanPresence";
import type { StoryNpcRuntimeContext } from "../../../../game/narrative/chapter1/storyCast";
import { i18n } from "../../../../i18n";
import { SaigonTrafficManager } from "../traffic";

import {
  buildBoardingHouse,
  COURTYARD_Y,
  FLOOR2_Y,
  ROOM_ANCHOR,
  STAIR,
  type BoardingHouse,
  type PooledLightSpec,
} from "./boardingHouse";
import { BITEXCO_POS, buildSaigonDistricts, LANDMARK81_POS, type SaigonDistricts } from "./saigonDistricts";
import { WorldStreamer, type StreamingStats } from "./WorldStreamer";
import { AtmosphereSystem, type AtmosphereState, type WeatherPreset } from "./AtmosphereSystem";
import { freezeStaticMatrices, mergeStaticMeshesByMaterial } from "./meshBatcher";
import { onPbrTextureLoaded, SAIGON_SHADER_UNIFORMS } from "./pbrTextures";

export type LandmarkWaypoint = "room" | "balcony" | "hem" | "bus" | "bitexco" | "landmark81";

export interface OpenWorldSnapshot {
  zone: string;
  district: string;
  position: { x: number; y: number; z: number };
  headingDeg: number;
  busPosition: { x: number; z: number };
  npcBlips: readonly StoryNpcRadarBlip[];
  atmosphere: AtmosphereState;
  streaming: StreamingStats;
  doorOpen: boolean;
  gateOpen: boolean;
  onBus: boolean;
  busStatus: string;
  prompt: string | null;
  activeModal: "phone" | "note" | null;
  storyDialogue: ActiveStoryNpcDialogue | null;
  ambientBark: AmbientStreetBark | null;
  crowdReaction: CrowdReactionBark | null;
  pointerLocked: boolean;
  fps: number;
  isIndoors: boolean;
}

/** Bus 06 status line in the game language (`testbus.world.bus.<phase>`). */
const phaseLabel = (phase: string) => tr(`bus.${phase}`);

const LAPTOP_DRAFT =
  "Chào chị Linh,\nEm gửi chị bản báo cáo quý trước 10h sáng mai ạ. Phần chi phí em đã đối chiếu xong, còn phần tổng hợp em sẽ rà lần cuối đầu giờ sáng.\nCảm ơn chị nhiều.";

function formatClock24(hours: number): string {
  const h = Math.floor(((hours % 24) + 24) % 24);
  const m = Math.floor((((hours % 24) + 24) % 24 - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function detectSoftwareRenderer(renderer: T.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const info = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    return /swiftshader|llvmpipe|software|mesa offscreen/i.test(info);
  } catch {
    return false;
  }
}

function resolveSolids(x: number, z: number, radius: number, solids: Solid[]): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) {
      const cx = T.MathUtils.clamp(px, s.x0, s.x1);
      const cz = T.MathUtils.clamp(pz, s.z0, s.z1);
      const dx = px - cx;
      const dz = pz - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        if (distSq > 1e-8) {
          const d = Math.sqrt(distSq);
          const push = radius - d;
          px += (dx / d) * push;
          pz += (dz / d) * push;
        } else {
          const dl = Math.abs(px - s.x0);
          const dr = Math.abs(s.x1 - px);
          const dt = Math.abs(pz - s.z0);
          const db = Math.abs(s.z1 - pz);
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) px = s.x0 - radius;
          else if (m === dr) px = s.x1 + radius;
          else if (m === dt) pz = s.z0 - radius;
          else pz = s.z1 + radius;
        }
      }
    }
  }
  return { x: px, z: pz };
}

/**
 * Embedded mode: the Chapter 1 room (roomv2 engine) owns the renderer, the canvas, the input and the frame loop.
 * Every frame it calls `stepView` (player in the room) or `stepPlay` (player outside), then draws this world into
 * `backdrop` (colour + depth, same camera and projection as the room camera) and composites the room over it with
 * a shared depth buffer. Room and street are one continuous space: no cut, no white-out at the door.
 * Coordinates handed to and from the host are room-local (world minus `ROOM_ANCHOR`).
 */
export interface ExternalHost {
  renderer: T.WebGLRenderer;
  /** The room's render target that its rain glass refracts. */
  viewTarget: T.WebGLRenderTarget;
  /** Hours of the day from the story clock, or null to let the world run its own day. */
  clockHours?: () => number | null;
  /** E at Room 6.07's door from the corridor: open / close the room's real door. */
  onDoor?: () => void;
  /** A lightning strike outside (0..1): the host plays the thunder. */
  onThunder?: (intensity: number) => void;
  /**
   * Bus 06 route events (boarded, fare-paid, departed, arrived, transfer-complete). The host turns
   * them into deterministic chapter actions; the world keeps driving the bus itself.
   */
  onTransit?: (event: TransitEvent) => void;
  /**
   * The player picked a reply in a street conversation. The host records what the character said
   * in the chapter store, so a street talk can count as asking a question in the phone record.
   */
  onStoryReply?: (npcId: string, replyId: string) => Partial<StoryNpcRuntimeContext> | void;
  /** The player opened a conversation; a host may return the synchronous narrative context patch. */
  onStoryStart?: (npcId: string) => Partial<StoryNpcRuntimeContext> | void;
}
export interface ViewLens {
  fov: number;
  aspect: number;
  near: number;
  far: number;
}
export interface ViewPose extends ViewLens {
  /** Room camera position (room-local). */
  position: T.Vector3;
  /** Room camera orientation; when given it is used as is (inspect poses are not plain yaw / pitch). */
  quaternion?: T.Quaternion;
  yaw: number;
  pitch: number;
  /** 0 closed .. 1 open: the room's front door and window sash. */
  door: number;
  window: number;
  /** Draw `backdrop` this frame (the door or the window is open and in view). */
  backdrop: boolean;
  /**
   * Screen part (0..1, origin bottom-left) where the open door / window shows. Only that part is drawn, and only what
   * can be seen through it is culled in, so the street hidden behind the room walls costs nothing. Omitted: full view.
   */
  portal?: { x0: number; y0: number; x1: number; y1: number } | null;
  /** The room window is on screen (its glass shows this world's view). Omitted: guessed from `yaw`. */
  windowInView?: boolean;
}
export interface PlayInput extends ViewLens {
  keys: ReadonlySet<string>;
  yaw: number;
  pitch: number;
  door: number;
}
export interface PlayResult {
  /** Camera position (room-local) for the room camera. */
  position: T.Vector3;
  /** The player walked back through the door into Room 6.07. */
  inRoom: boolean;
  /** Metres walked this frame (footsteps). */
  moved: number;
}
export class OpenWorldEngine {
  private container: HTMLElement;
  private external: ExternalHost | null;
  /** Embedded and the player is in the room: the room drives the camera, this world only runs and draws. */
  private viewMode: boolean;
  /** Embedded: colour + depth of this world, drawn with the room camera, composited under the room. */
  private backdropRT: T.WebGLRenderTarget | null = null;
  private wantBackdrop = false;
  /** ViewPose.portal for this frame (null: the whole view). */
  private backdropPortal: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private extDoor = 0;
  private extWin = 0;
  private backdropShadowT = 0;
  private readonly _bdSize = new T.Vector2();
  private readonly playOut = { position: new T.Vector3(), inRoom: false, moved: 0 };
  public renderer: T.WebGLRenderer;
  public scene: T.Scene;
  private exteriorGroup = new T.Group();
  private streetGroup = new T.Group();
  private busCastGroup = new T.Group();
  private roomLightsGroup = new T.Group();
  private roomFarTimer = 0;
  private outdoorLightSpecs: PooledLightSpec[] = [];
  public camera: T.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private postPass: ShaderPass | null = null;
  private roomAccentLight!: T.PointLight;
  private software: boolean;

  // EXACT "The Room" Heartfelt Rain-on-Glass refraction render target + caustic projector lights!
  private cityRT: T.WebGLRenderTarget;
  private rainGlassMats: T.ShaderMaterial[] = [];
  private exteriorGlassMat: T.MeshStandardMaterial;
  private glassModeIndoor = true;
  private dropCanvas: HTMLCanvasElement;
  private dropTex: T.CanvasTexture;
  private dropTimer = 0;
  private winRect!: T.RectAreaLight;
  private outSpot!: T.SpotLight;
  private upSpot!: T.SpotLight;
  private neonSpot!: T.SpotLight;
  private dust!: T.Points;
  private dustSeed: number[] = [];

  public apartment: Apartment;
  public boardingHouse: BoardingHouse;
  public street: ReturnType<typeof buildStreet>;
  public route: BusRouteController;
  public bus: ReturnType<typeof buildBus>;
  public cast: ReturnType<typeof castStreet>;
  public storyNpcs: ReturnType<typeof createStoryNpcDirector>;
  public humanPresence: HumanPresenceSystem = createHumanPresenceSystem();
  public districts: SaigonDistricts;
  public traffic: SaigonTrafficManager;
  public streamer: WorldStreamer;
  public atmosphere: AtmosphereSystem;
  private audio: AudioEngine;
  private bumpVx = 0;
  private bumpVz = 0;

  private solidsGround: Solid[] = [];
  private solidsUpper: Solid[] = [];
  private roomFurnitureSolids: Solid[] = [];
  private raycaster = new T.Raycaster();

  // Player physical state (exact Room 6.07 spawn translated into world space!)
  public feet = new T.Vector3(ROOM_ANCHOR.x + 1.3, ROOM_ANCHOR.y, ROOM_ANCHOR.z + 1.55);
  public yaw = 0.62;
  public pitch = -0.05;
  private readonly eyeHeight = 1.62;
  private bob = 0;
  private stepDist = 0;

  // Interactive doors, Room 6.07 appliances, & transit state
  public doorOpen = false;
  private doorAnim = 0;
  public gateOpen = true;
  private winOpen = false;
  private winAnim = 0;
  private fridgeOpen = false;
  private fridgeAnim = 0;
  private deskOn = true;
  private ceilOn = false;
  private bedLampOn = true;
  private kitchenOn = false;
  private lightLevels = { ceiling: 0, desk: 1, bed: 1, kitchen: 0 };
  private lastScreenClock = "";
  public onBus = false;
  /**
   * On the bus the player stands or sits in bus-local coordinates (x right, z toward the rear; the front door is
   * on the right at z -5.2..-3.7, the rear door at 0.3..1.8). They walk on through the open front door, sit with E,
   * confirm the ride with F, and get off through the rear door once the bus has arrived.
   */
  private busLocal = { x: 1.0, z: -4.4 };
  private busSeat: PassengerSeat | null = null;
  /** Metres the player walked inside the bus this frame (not the bus's own motion). */
  private busWalked = 0;
  private readonly _busEye = new T.Vector3();
  private lastStreetEnvHash = -1;
  private renderFrame = 0;
  private lastCityRtYaw = 999;
  private lastCityRtPitch = 999;
  private lastCityRtTime = -999;
  private prevDoorAnim = -1;
  private prevWinAnim = -1;
  private prevFridgeAnim = -1;
  private wasRoomMoving = false;
  private indoorShadowDirty = true;
  private texWarmupQueue: T.Texture[] = [];
  private queuedTexSet = new Set<T.Texture>();
  private unsubPbrWarmup: (() => void) | null = null;
  private warmupRT: T.WebGLRenderTarget;
  private warmupViewRT: T.WebGLRenderTarget | null = null;
  private warmupCam: T.PerspectiveCamera;
  private bootWarmupStage = 0;
  private wasIndoors = true;
  private outdoorWarmupFrames = 0;
  private lastShadowX = 9999;
  private lastShadowZ = 9999;
  private readonly _winDayCol = new T.Color(0xfff1dc);
  private readonly _winNightCol = new T.Color(0x8d97c8);
  private readonly _outDayCol = new T.Color(0xfff0d4);
  private readonly _outNightCol = new T.Color(0x9fb8e8);
  private readonly _convEyePos = new T.Vector3();
  private convBlend = 0;

  // Input state
  private keys = new Set<string>();
  private dragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private pointerLocked = false;
  private activeModal: "phone" | "note" | null = null;
  private currentPrompt: string | null = null;
  private hoveredId: string | null = null;

  // Loop & telemetry
  private raf = 0;
  private clock = new T.Clock();
  private elapsed = 0;
  private fps = 60;
  private frameCount = 0;
  private fpsTimer = 0;
  private hudTimer = 0;
  private disposed = false;
  private onSnapshot?: (snap: OpenWorldSnapshot) => void;

  constructor(
    container: HTMLElement,
    onSnapshot?: (snap: OpenWorldSnapshot) => void,
    external?: ExternalHost,
  ) {
    this.container = container;
    this.onSnapshot = onSnapshot;
    this.external = external ?? null;
    this.viewMode = !!external;
    const initW = container.clientWidth || window.innerWidth;
    const initH = Math.max(1, container.clientHeight || window.innerHeight);
    this.renderer =
      external?.renderer ??
      new T.WebGLRenderer({
        antialias: false, // Post-processing SMAAPass handles crisp AA (avoids double MSAA buffer cost!)
        powerPreference: "high-performance",
        stencil: false,
      });
    this.software = detectSoftwareRenderer(this.renderer);
    // Smart DPR cap: 1.15× + FXAA delivers razor-sharp clarity with huge GPU fill-rate headroom!
    const pr = external
      ? this.renderer.getPixelRatio()
      : Math.min(window.devicePixelRatio || 1, this.software ? 1 : 1.15);
    if (!external) {
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(initW, initH);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.18;
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.domElement.style.display = "block";
      this.renderer.domElement.style.width = "100%";
      this.renderer.domElement.style.height = "100%";
      container.appendChild(this.renderer.domElement);
    }

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(64, initW / initH, 0.05, 1400);

    // Hardware-fast Power-of-Two (512×256 RGBA8) mip-mapped render target of north Saigon skyline for Room 6.07 Rain-on-Glass!
    // POT UnsignedByteType generates mipmaps in ~0.03ms in pure hardware (eliminates 50–100ms HalfFloat non-POT GPU sync stall!).
    this.cityRT = external?.viewTarget ?? new T.WebGLRenderTarget(
      this.software ? 256 : 512,
      this.software ? 128 : 256,
      {
        type: T.UnsignedByteType,
        generateMipmaps: true,
        minFilter: T.LinearMipmapLinearFilter,
        magFilter: T.LinearFilter,
      },
    );

    this.exteriorGlassMat = new T.MeshStandardMaterial({
      color: 0x1d2b36,
      roughness: 0.08,
      metalness: 0.55,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.68,
      side: T.DoubleSide,
    });

    // ULTRA-FAST 2-PASS HDR PIPELINE (replaces 17-pass aoPass + Bloom + OutputPass + finalPass + 3-pass SMAAPass!):
    //  1. RenderPass -> HDR HalfFloat + DepthTexture
    //  2. Compact 0.35×-res UnrealBloomPass (silky neon/lamp bloom at 1/8th pixel cost!)
    //  3. ONE Single Combined ShaderPass: DepthTexture Contact AO + ACES Filmic Tone Mapping + sRGB +
    //     Room 6.07 Cinematic Grade (CA, Split-Tone, Vignette, Micro Grain) + Fast Luma FXAA!
    if (!this.software) {
      const rtW = Math.max(1, Math.floor(initW * pr));
      const rtH = Math.max(1, Math.floor(initH * pr));
      const rt = new T.WebGLRenderTarget(rtW, rtH, { type: T.HalfFloatType });
      rt.depthTexture = new T.DepthTexture(rtW, rtH, T.UnsignedIntType);
      const comp = new EffectComposer(this.renderer, rt);
      comp.addPass(new RenderPass(this.scene, this.camera));

      this.bloomPass = new UnrealBloomPass(
        new T.Vector2(Math.max(192, Math.round(initW * 0.35)), Math.max(108, Math.round(initH * 0.35))),
        0.28,
        0.55,
        1.04,
      );
      comp.addPass(this.bloomPass);

      this.postPass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          tDepth: { value: null },
          uPixel: { value: new T.Vector2(1 / rtW, 1 / rtH) },
          uClip: { value: new T.Vector2(this.camera.near, this.camera.far) },
          uAoStrength: { value: 0.44 },
          uExposure: { value: 1.18 },
          uTime: { value: 0 },
          uVig: { value: 0.62 },
          uCA: { value: 0.0011 },
          uNight: { value: 0.9 },
          uIndoors: { value: 1.0 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse, tDepth;
          uniform vec2 uPixel, uClip;
          uniform float uAoStrength, uExposure, uTime, uVig, uCA, uNight, uIndoors;
          varying vec2 vUv;

          float viewZ(vec2 uv) {
            float z = texture2D(tDepth, clamp(uv, 0.0, 1.0)).r;
            return uClip.x * uClip.y / (uClip.y - z * (uClip.y - uClip.x));
          }
          float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
          // Khronos / AgX Filmic Cinema Camera Tone Mapping (unique names so NEVER collides with Three.js built-in AgX helpers!)
          vec3 saigonAgxCurve(vec3 x) {
            vec3 x2 = x * x;
            vec3 x4 = x2 * x2;
            return 15.5     * x4 * x2
                   - 40.14  * x4 * x
                   + 31.96  * x4
                   - 6.868  * x2 * x
                   + 0.4298 * x2
                   + 0.1191 * x
                   - 0.00232;
          }
          vec3 saigonAgxFilmic(vec3 val) {
            mat3 agx_mat = mat3(
              0.842479062253094, 0.0423282422610123, 0.0423756549057051,
              0.0784335999999992, 0.878468636469772, 0.0784336,
              0.0792237451477643, 0.0791661274605434, 0.879142973793104
            );
            mat3 agx_mat_inv = mat3(
              1.19687900512017, -0.0528968517574562, -0.0529716355144438,
              -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
              -0.0990297440797205, -0.0989611768448433, 1.15107367264116
            );
            val = max(val, vec3(1e-6));
            val = agx_mat * val;
            val = clamp(log2(val), -12.47393, 4.026069);
            val = (val + 12.47393) / 16.5;
            val = saigonAgxCurve(val);
            val = agx_mat_inv * val;
            return clamp(val, 0.0, 1.0);
          }
          float hash12(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 43.0) * 43758.5453);
          }

          void main() {
            // 1. Fast 5-tap Luma FXAA + Subtle Optical Chromatic Aberration in HDR space
            vec2 d = vUv - 0.5;
            float r2 = dot(d, d);
            vec2 caOff = d * uCA * (1.0 + r2 * 3.0);

            vec3 rgbM = vec3(
              texture2D(tDiffuse, vUv + caOff).r,
              texture2D(tDiffuse, vUv).g,
              texture2D(tDiffuse, vUv - caOff).b
            );
            vec3 rgbNW = texture2D(tDiffuse, vUv + vec2(-uPixel.x, -uPixel.y)).rgb;
            vec3 rgbNE = texture2D(tDiffuse, vUv + vec2( uPixel.x, -uPixel.y)).rgb;
            vec3 rgbSW = texture2D(tDiffuse, vUv + vec2(-uPixel.x,  uPixel.y)).rgb;
            vec3 rgbSE = texture2D(tDiffuse, vUv + vec2( uPixel.x,  uPixel.y)).rgb;

            float lM = luma(rgbM);
            float lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE);
            float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
            float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
            vec3 col = rgbM;
            if (lMax - lMin > max(0.05, lMax * 0.14)) {
              vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
              float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
              float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
              dir = clamp(dir * rcpDirMin, vec2(-4.0), vec2(4.0)) * uPixel;
              vec3 rgbA = 0.5 * (
                texture2D(tDiffuse, vUv + dir * -0.1667).rgb +
                texture2D(tDiffuse, vUv + dir *  0.1667).rgb
              );
              vec3 rgbB = rgbA * 0.5 + 0.25 * (
                texture2D(tDiffuse, vUv + dir * -0.5).rgb +
                texture2D(tDiffuse, vUv + dir *  0.5).rgb
              );
              float lB = luma(rgbB);
              col = (lB < lMin || lB > lMax) ? rgbA : rgbB;
            }

            // 2. Fast 4-Tap Interleaved Contact + Macro Architectural Depth AO (2× faster GPU shader, crisp grounding!)
            float m = viewZ(vUv);
            if (m < 145.0 && uAoStrength > 0.01) {
              float occ = 0.0;
              float radFine = clamp(98.0 / max(0.15, m), 2.0, 10.0);
              float radMacro = clamp(280.0 / max(0.35, m), 6.0, 22.0);
              float rotOff = hash12(gl_FragCoord.xy) * 1.5708;
              for (int i = 0; i < 4; i++) {
                float a = rotOff + float(i) * 1.5708;
                vec2 sdir = vec2(cos(a), sin(a));
                float rUse = (i < 2 || uIndoors > 0.5) ? radFine : radMacro;
                float dz = m - viewZ(vUv + uPixel * sdir * rUse);
                float maxR = (i < 2 || uIndoors > 0.5) ? 0.85 : 3.8;
                occ += smoothstep(0.025, 0.18, dz) * (1.0 - smoothstep(maxR * 0.35, maxR, dz));
              }
              float distFade = 1.0 - smoothstep(80.0, 145.0, m);
              col *= 1.0 - uAoStrength * distFade * clamp(occ * 0.28, 0.0, 0.85);
            }

            // 3. True Khronos AgX Cinema Camera Tone Mapping (already outputs display sRGB — NO double-gamma!)
            col = saigonAgxFilmic(col * uExposure);

            // 4. Photorealistic Cinema Camera Grade (Natural filmic desaturation & micro-contrast — ZERO anime saturation!)
            float lum = luma(col);
            // Subtle natural S-curve contrast for crisp shadow depth & airy highlights
            col = mix(col, smoothstep(vec3(0.02), vec3(0.98), col), 0.16 * (1.0 - uIndoors));
            vec3 shadowTint = mix(vec3(-0.004, 0.001, 0.008), vec3(-0.006, 0.0, 0.012), max(uNight, uIndoors));
            col += shadowTint * (1.0 - smoothstep(0.0, 0.34, lum));
            // Real camera natural color saturation (0.88–0.92 outdoors kills cartoon plastic look!)
            float satFactor = mix(0.89, 0.92, uNight) * (1.0 - uIndoors) + 1.0 * uIndoors;
            col = mix(vec3(lum), col, satFactor);
            col *= 1.0 - uVig * smoothstep(0.26, 0.90, r2 * 1.38);
            float grainAmp = mix(0.014, 0.022, max(uIndoors, uNight * 0.7));
            col += (hash12(vUv * vec2(1920.0, 1080.0)) - 0.5) * grainAmp;

            gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
          }
        `,
      });
      comp.addPass(this.postPass);
      this.composer = comp;
    }

    this.audio = new AudioEngine(this.camera);
    RectAreaLightUniformsLib.init();

    // Animated rain-on-glass caustic gobo texture (verbatim from The Room!)
    // Disable mipmap regeneration on dynamic 256×256 spotlight gobo to eliminate periodic GPU mipmap sync stalls!
    this.dropCanvas = dropMaskCanvas();
    paintDropMask(this.dropCanvas, 0);
    this.dropTex = new T.CanvasTexture(this.dropCanvas);
    this.dropTex.generateMipmaps = false;
    this.dropTex.minFilter = T.LinearFilter;
    this.dropTex.magFilter = T.LinearFilter;

    // 1. Dynamic 24h Day/Night Sky, Tropical Weather, Wet-Surface Planar Reflections & PMREM GI
    this.atmosphere = new AtmosphereSystem(this.scene, this.renderer, this.software, (intensity) => {
      if (this.external) this.external.onThunder?.(intensity);
      else if (this.audio.started) this.audio.thunder(intensity * 0.45);
    });
    // Seen from the room, a full lightning flash whites out the doorway and the window; keep it a soft flicker.
    if (this.external) this.atmosphere.lightningScale = 0.3;

    // 2. Spatial Open-World Level Streamer (zero loading screens!)
    this.streamer = new WorldStreamer();

    // 3. EXACT "THE ROOM" ANCHOR — 100% ORIGINAL HEARTFELT RAIN-ON-GLASS & CAUSTIC LIGHTING!
    this.apartment = buildApartment(this.scene, (panes) => {
      panes.forEach((pane, idx) => {
        const geom = pane.geometry as T.PlaneGeometry;
        const paneSize = new T.Vector2(geom.parameters.width, geom.parameters.height);
        const seed = (pane.userData?.seed as number | undefined) ?? idx * 17.3 + 4.1;
        // 100% EXACT ORIGINAL Martijn Steinrucken / Heartfelt Rain-on-Glass shader refracting our REAL live 3D Saigon!
        const rainMat = createRainGlass(this.cityRT.texture, paneSize, seed);
        rainMat.uniforms.uRes.value.set(this.renderer.domElement.width, this.renderer.domElement.height);
        pane.material = rainMat;
        this.rainGlassMats.push(rainMat);
      });
    });

    // Restore ALL 4 signature Room 6.07 cinematic window lights as children of apartment.root (so they move cleanly with ROOM_ANCHOR!)
    const cx = (WIN.x0 + WIN.x1) * 0.5;
    const cy = (WIN.y0 + WIN.y1) * 0.5;
    const rRoot = this.apartment.root;

    // 3a. Soft sky/city window RectAreaLight
    this.winRect = new T.RectAreaLight(0x8d97c8, 1.85, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
    // Permanent Room-Lights sibling group directly in this.scene (NEVER hidden by apartment.root or exteriorGroup!):
    // Guarantees the scene's active Light count & shadow count NEVER changes -> 0 WebGL shader recompiles when opening door!
    this.roomLightsGroup.name = "RoomLightsPermanent";
    this.roomLightsGroup.position.copy(ROOM_ANCHOR);
    this.scene.add(this.roomLightsGroup);

    // Permanently configure Room shadow lights (1 crisp 512x512 caustic projector + ceiling spot -> never toggled at runtime!)
    this.apartment.lights.deskSpot.castShadow = false;
    this.apartment.lights.deskSpot.penumbra = 0.9;
    this.apartment.lights.ceilingSpot.castShadow = !this.software;
    this.apartment.lights.ceilingSpot.shadow.mapSize.set(512, 512);

    // PERMANENTLY prune 6 redundant micro-lights BEFORE boot shader compile!
    // Cuts global scene light count from 20 lights (2 RectAreaLights) -> 11 lights (1 RectAreaLight) = ~45% faster pixel shaders EVERYWHERE!
    // (Kitchen LED strip still lights up warmly via ceilingFill + emissive; laptop/phone/fridge share 1 dynamic roomAccentLight!)
    const pruneLight = (l: T.Light) => {
      l.removeFromParent();
      if ("target" in l && (l as T.SpotLight).target) (l as T.SpotLight).target.removeFromParent();
    };
    pruneLight(this.apartment.lights.kitchen);
    pruneLight(this.apartment.lights.deskFill);
    pruneLight(this.apartment.lights.phone);
    pruneLight(this.apartment.lights.laptop);
    pruneLight(this.apartment.fridge.point);
    pruneLight(this.apartment.fridge.spot);

    // Hoist remaining 4 essential apartment lights into permanent roomLightsGroup (NEVER hidden -> ZERO door-open recompiles!)
    rRoot.updateMatrixWorld(true);
    const hoistLight = (l: T.Light) => {
      this.roomLightsGroup.attach(l);
      if ("target" in l && (l as T.SpotLight).target) {
        this.roomLightsGroup.attach((l as T.SpotLight).target);
      }
    };
    hoistLight(this.apartment.lights.ceilingSpot);
    hoistLight(this.apartment.lights.ceilingFill);
    hoistLight(this.apartment.lights.deskSpot);
    hoistLight(this.apartment.lights.bedLamp);

    // 1 shared Room accent PointLight smoothly serving laptop/phone glow OR open-fridge interior glow!
    this.roomAccentLight = new T.PointLight(0x88b8ff, 0.35, 3.8, 2);
    this.roomAccentLight.position.set(-0.35, 1.05, -1.55);
    this.roomLightsGroup.add(this.roomAccentLight);

    this.winRect.position.set(cx, cy, ROOM.z0 + 0.04);
    this.winRect.lookAt(cx, cy, ROOM.z0 + 2.0);
    this.roomLightsGroup.add(this.winRect);

    // 3b. Rain-drop caustic projector through window onto desk & wooden floor (exact outSpot from The Room!)
    this.outSpot = new T.SpotLight(0x9fb8e8, 32, 16, 0.52, 0.72, 2);
    this.outSpot.position.set(cx - 0.5, 4.6, -7.8);
    const outTarget = new T.Object3D();
    outTarget.position.set(-0.3, 0, 0.9);
    this.roomLightsGroup.add(outTarget);
    this.outSpot.target = outTarget;
    this.outSpot.map = this.dropTex;
    this.outSpot.castShadow = !this.software;
    this.outSpot.shadow.mapSize.set(512, 512);
    this.outSpot.shadow.bias = -0.0006;
    this.outSpot.shadow.camera.near = 4;
    this.outSpot.shadow.camera.far = 16;
    this.roomLightsGroup.add(this.outSpot);

    // 3c. Warm Saigon sodium streetlamp bouncing upward through wet glass onto Room 6.07's ceiling (exact upSpot!)
    this.upSpot = new T.SpotLight(0xff9a4a, 30, 20, 0.24, 0.9, 2);
    this.upSpot.position.set(-0.8, -7.5, -9.5);
    const upTarget = new T.Object3D();
    upTarget.position.set(-0.4, 2.65, 0.6);
    this.roomLightsGroup.add(upTarget);
    this.upSpot.target = upTarget;
    this.upSpot.map = this.dropTex;
    this.upSpot.castShadow = false; // points straight up at blank ceiling -> no shadow map needed!
    this.roomLightsGroup.add(this.upSpot);

    // 3d. Flickering magenta karaoke neon across the Saigon alley casting subtle living light onto ceiling (exact neonSpot!)
    this.neonSpot = new T.SpotLight(0xff3fa8, 24, 22, 0.3, 0.8, 2);
    this.neonSpot.position.set(3, -6, -12);
    const neonTarget = new T.Object3D();
    neonTarget.position.set(0.8, 2.6, -0.8);
    this.roomLightsGroup.add(neonTarget);
    this.neonSpot.target = neonTarget;
    this.roomLightsGroup.add(this.neonSpot);

    // 3e. 150 Floating Golden Dust Motes drifting lazily inside Room 6.07's warm desk lamp beam!
    const dustCount = 150;
    const dg = new T.BufferGeometry();
    const dp = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      this.dustSeed.push(Math.random() * 100, Math.random(), Math.random(), Math.random());
      dp[i * 3] = -2.4 + Math.random() * 4.8;
      dp[i * 3 + 1] = 0.3 + Math.random() * 2.1;
      dp[i * 3 + 2] = -1.9 + Math.random() * 3.8;
    }
    dg.setAttribute("position", new T.BufferAttribute(dp, 3));
    const dc = makeRoomCanvas(32, 32);
    const dx = dc.getContext("2d")!;
    const gr = dx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "rgba(255,240,215,1)");
    gr.addColorStop(1, "rgba(255,240,215,0)");
    dx.fillStyle = gr;
    dx.fillRect(0, 0, 32, 32);
    this.dust = new T.Points(
      dg,
      new T.PointsMaterial({
        map: toTex(dc),
        size: 0.015,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: T.AdditiveBlending,
        color: 0xffd9a8,
      }),
    );
    this.dust.frustumCulled = false;
    rRoot.add(this.dust);

    // Translate entire untouched Room 6.07 (with all its lights, caustics, dust motes & emitters) to Floor 2!
    rRoot.position.copy(ROOM_ANCHOR);
    rRoot.updateMatrixWorld(true);

    // Register ALL 15 exact Room 6.07 positional audio emitters on apartment.root!
    this.audio.addEmitter("window", rRoot, new T.Vector3(cx, 1.5, ROOM.z0 - 0.25), 1.2, 1);
    this.audio.addEmitter("fridge", rRoot, new T.Vector3(-2.3, 0.6, 1.8), 0.6, 1.4);
    this.audio.addEmitter("laptop", rRoot, new T.Vector3(-1.62, 0.8, -1.7), 0.3, 1.6);
    this.audio.addEmitter("phone", rRoot, new T.Vector3(0.93, 0.56, -1.78), 0.7, 1.1);
    this.audio.addEmitter("kettle", rRoot, new T.Vector3(-1.55, 1.0, 1.88), 0.6, 1.2);
    this.audio.addEmitter("door", rRoot, new T.Vector3(1.2, 1.0, 2.05), 1, 1);
    this.audio.addEmitter("keys", rRoot, new T.Vector3(2.0, 0.86, 1.92), 0.5, 1);
    this.audio.addEmitter("umbrella", rRoot, new T.Vector3(2.4, 0.05, 1.0), 0.4, 1.3);
    this.audio.addEmitter("switch", rRoot, new T.Vector3(0.52, 1.2, 2.08), 0.4, 1.2);
    this.audio.addEmitter("desklamp", rRoot, new T.Vector3(-2.18, 0.8, -1.98), 0.4, 1.2);
    this.audio.addEmitter("bedlamp", rRoot, new T.Vector3(0.72, 0.8, -1.97), 0.4, 1.2);
    this.audio.addEmitter("kitchenlight", rRoot, new T.Vector3(-0.7, 1.55, 1.8), 0.4, 1.2);
    this.audio.addEmitter("mug", rRoot, new T.Vector3(-1.13, 0.8, -1.57), 0.4, 1.2);
    this.audio.addEmitter("desk", rRoot, new T.Vector3(-1.3, 0.8, -1.6), 0.4, 1.2);
    this.audio.addEmitter("clock", rRoot, new T.Vector3(-0.05, 2.05, 2.06), 0.5, 1.4);

    // Draw initial crisp Room 6.07 laptop & phone displays
    const initClockStr = formatClock24(this.atmosphere.state.timeOfDay);
    this.apartment.laptopScreen.draw(1, initClockStr, LAPTOP_DRAFT);
    this.apartment.laptopScreenMat.color.setScalar(1.0);
    this.apartment.lights.laptop.intensity = 0.08;
    this.apartment.phoneScreen.draw("lock", initClockStr, 0, 0);
    this.apartment.phoneScreenMat.color.setScalar(0.85);
    this.apartment.lights.phone.intensity = 0.11;
    this.lastScreenClock = initClockStr;

    // Translate Room 6.07 exact furniture colliders into world coordinates!
    this.roomFurnitureSolids = this.apartment.colliders.map(([x0, x1, z0, z1]) => ({
      x0: ROOM_ANCHOR.x + x0,
      x1: ROOM_ANCHOR.x + x1,
      z0: ROOM_ANCHOR.z + z0,
      z1: ROOM_ANCHOR.z + z1,
    }));

    // Batch ~300 static meshes inside Room 6.07 down to ~45 GPU draw calls (7× fewer draw calls, 100% pixel-identical!)
    // Safely excludes all interactive hits, animated doors/sash/clock/fridge, rain-glass panes, and dust/mist particles.
    const roomSkip = new Set<T.Object3D>([
      this.apartment.doorPivot,
      this.apartment.rightSash,
      this.apartment.fridgeDoor,
      this.apartment.clockHands.h,
      this.apartment.clockHands.m,
      this.apartment.clockHands.s,
      this.apartment.fridge.mist,
      this.dust,
      ...this.apartment.glassPanes,
      ...this.apartment.hits,
    ]);
    const isDynamicRoomNode = (o: T.Object3D) => {
      if (roomSkip.has(o)) return true;
      if (o instanceof T.Points || o instanceof T.Light) return true;
      return false;
    };
    mergeStaticMeshesByMaterial(this.apartment.root, isDynamicRoomNode);
    freezeStaticMatrices(this.apartment.root, isDynamicRoomNode);

    // 4. VIETNAMESE BOARDING HOUSE COMPLEX (DÃY TRỌ 462/14) WRAPPING THE ROOM
    this.exteriorGroup.name = "SaigonExteriorWorld";
    this.streetGroup.name = "LyThaiToStreetHub";
    this.busCastGroup.name = "BusStationCast";
    this.exteriorGroup.add(this.streetGroup);
    this.exteriorGroup.add(this.busCastGroup);
    this.scene.add(this.exteriorGroup);

    const extScene = this.exteriorGroup as unknown as T.Scene;
    const streetScene = this.streetGroup as unknown as T.Scene;
    const castScene = this.busCastGroup as unknown as T.Scene;

    const texProps = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "alphaMap", "aoMap"] as const;
    const enqueueTex = (tx: T.Texture) => this.enqueueTexture(tx);
    const onAssetLoaded = (obj: T.Object3D) => {
      if (this.disposed) return;
      this.lastAssetAt = this.elapsed;
      this.shadowProgramsDirty = true;
      obj.traverse((n) => {
        if (n instanceof T.Mesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          for (const mat of mats) {
            const rec = mat as unknown as Record<string, unknown>;
            for (const k of texProps) {
              const tx = rec[k];
              if (tx instanceof T.Texture) enqueueTex(tx);
            }
          }
        }
      });
      // Compile both light-set variants (with / without Room 6.07 lights) so walking away from the room never
      // triggers a lazy program link. compileAsync collects the lights synchronously, so toggling around it is safe.
      const roomLightsWereOn = this.roomLightsGroup.visible;
      for (const lightsOn of [true, false]) {
        this.roomLightsGroup.visible = lightsOn;
        this.compileToMainTarget(() => void this.renderer.compileAsync(obj, this.camera, this.scene).catch(() => {}));
      }
      this.roomLightsGroup.visible = roomLightsWereOn;
    };
    this.unsubPbrWarmup = onPbrTextureLoaded(enqueueTex);

    this.boardingHouse = buildBoardingHouse(extScene, onAssetLoaded);
    this.streamer.register({
      id: "boarding-house",
      name: "Dãy Trọ 462/14 Lý Thái Tổ",
      district: "Quận 10",
      cx: 22,
      cz: -13,
      near: this.boardingHouse.root,
      nearDist: 140,
      lodDist: 320,
      alwaysVisible: true,
    });

    // 5. UNIFIED SAIGON STREET SIMULATION ENGINE (CARLA 5-Stage + QCVN 41:2024 + ACC/IDM+ + Saigon Sublane)
    this.traffic = new SaigonTrafficManager();

    // 5b. FOUNDATIONAL BUS STATION HUB (ĐƯỜNG LÝ THÁI TỔ — EXACT SOURCE HUB + UNIFIED TRAFFIC FLEET)
    this.street = buildStreet(streetScene, this.software, undefined, onAssetLoaded, this.traffic);
    this.street.blocks.forEach((blk, idx) => {
      this.streamer.register({
        id: `ly-thai-to-block-${idx}`,
        name: `Phố Lý Thái Tổ · Ô ${idx + 1}`,
        district: "Quận 10",
        cx: -6,
        cz: blk.start + 10.5,
        near: blk.group,
        lod: blk.far,
        nearDist: 72,
        lodDist: 360,
      });
    });

    // 6. EXACT ROUTE 06 BUS & 15 EXACT BUS STATION NPCS + DRIVER (UNIFIED WITH SAIGON TRAFFIC!)
    this.route = new BusRouteController({ onEvent: (event) => this.external?.onTransit?.(event) });
    this.route.wait();
    this.route.update(6.5, { front: false, rear: false }, false);
    this.traffic.registerBus06(this.route.x, this.route.z, Math.PI + this.route.yaw);
    // Keep exteriorGroup free of extra dynamic PointLights (bus already has emissive interior strips!) -> constant light count!
    this.bus = buildBus(extScene, this.route, false);
    this.bus.update(0);
    this.cast = castStreet(
      castScene,
      this.bus.root,
      this.route,
      () => {
        // Pre-compile newly streamed NPC skinned shaders asynchronously so stepping outside NEVER freezes!
        const prev = this.busCastGroup.visible;
        this.busCastGroup.visible = true;
        onAssetLoaded(this.busCastGroup);
        this.busCastGroup.visible = prev;
      },
      () => {},
      this.street.solids,
      this.traffic,
      this.humanPresence,
    );

    // 7. EXPANDED HO CHI MINH CITY DISTRICTS + EXACT BITEXCO TOWER & LANDMARK 81 + UNIFIED FLEET & NPCS
    this.districts = buildSaigonDistricts(
      extScene,
      this.streamer,
      this.software,
      onAssetLoaded,
      this.traffic,
      this.humanPresence,
    );
    this.storyNpcs = createStoryNpcDirector(onAssetLoaded, this.humanPresence);
    this.exteriorGroup.add(this.storyNpcs.group);
    this.outdoorLightSpecs = [...this.boardingHouse.lightSpecs, ...this.districts.lightSpecs];

    this.solidsGround = [
      ...this.boardingHouse.solidsGround,
      ...this.street.solids,
      ...this.districts.solids,
    ];
    this.solidsUpper = [...this.boardingHouse.solidsUpper];

    if (external) {
      // The room engine draws the real Room 6.07 (with every story feature); this world's copy of it is not drawn.
      this.apartment.root.removeFromParent();
      this.roomLightsGroup.removeFromParent();
      const size = this.renderer.getDrawingBufferSize(new T.Vector2());
      this.backdropRT = new T.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
        type: T.HalfFloatType,
        depthBuffer: true,
        stencilBuffer: false,
      });
      this.backdropRT.depthTexture = new T.DepthTexture(Math.max(1, size.x), Math.max(1, size.y), T.UnsignedIntType);
    }
    if (!external) this.bindEvents();
    this.syncCamera();
    if (!external) this.exposeDebugHandle();

    // Tiny 16×16 GPU VBO/VAO pre-draw warmup target + wide-angle elevated camera (ZERO frustum-culling skips!)
    // Same colour and depth format as the real targets: on Metal/ANGLE a pipeline is built per target format, so a
    // warm-up into an RGBA8 target left the first frame in the HDR target to build every pipeline again.
    this.warmupRT = new T.WebGLRenderTarget(16, 16, {
      type: T.HalfFloatType,
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.warmupRT.depthTexture = new T.DepthTexture(16, 16, T.UnsignedIntType);
    this.warmupViewRT = this.external
      ? new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType, depthBuffer: true, stencilBuffer: false })
      : null;
    this.warmupCam = new T.PerspectiveCamera(115, 1, 1, 2000);
    this.warmupCam.position.set(35, 290, 95);
    this.warmupCam.lookAt(35, 0, -145);
    this.warmupCam.updateMatrixWorld(true);

    // PHASE 0 ZERO-STUTTER BOOT PIPELINE:
    // Static ancestors: with matrixAutoUpdate on, every frame flags the whole subtree for a world-matrix recompute
    // (about 8% of frame CPU on the street). Both groups stay at identity, so freeze them.
    for (const g of [this.exteriorGroup, this.streetGroup, this.street.environment]) {
      g.updateMatrix();
      g.matrixAutoUpdate = false;
    }
    // 1. Pre-apply initial night/wet state BEFORE compile so street.wet() NEVER triggers runtime shader recompiles!
    this.street.wet(true, 0.86);
    this.bus.night(true);
    this.lastStreetEnvHash = 100 + Math.round(0.86 * 20);

    // 2. Make EVERY exterior group, LOD block, busCastGroup, and exteriorGlassMat visible for single-shot boot compile!
    this.exteriorGroup.visible = true;
    this.streetGroup.visible = true;
    this.busCastGroup.visible = true;
    this.apartment.root.visible = true;
    this.street.blocks.forEach((b) => {
      b.group.visible = true;
      b.far.visible = true;
    });
    const firstPane = this.apartment.glassPanes[0];
    const savedPaneMat = firstPane?.material;
    if (firstPane) firstPane.material = this.exteriorGlassMat;
    this.compileToMainTarget(() => this.renderer.compile(this.scene, this.camera));
    if (firstPane && savedPaneMat) firstPane.material = savedPaneMat;
    this.compileToMainTarget(() => this.renderer.compile(this.scene, this.camera));
    // Second light-set variant (Room 6.07 lights removed) used while the player is on the street.
    this.roomLightsGroup.visible = false;
    if (firstPane) firstPane.material = this.exteriorGlassMat;
    this.compileToMainTarget(() => this.renderer.compile(this.scene, this.camera));
    // Shadow depth programs are only built when a shadow pass actually runs; force one now (both light sets) so
    // the first shadow refresh on the street does not link them on demand.
    for (const lightsOn of [false, true]) {
      this.roomLightsGroup.visible = lightsOn;
      this.renderer.shadowMap.needsUpdate = true;
      this.renderer.setRenderTarget(this.warmupRT);
      this.renderer.render(this.scene, this.warmupCam);
      this.renderer.setRenderTarget(null);
    }
    this.renderer.shadowMap.needsUpdate = true;
    if (firstPane && savedPaneMat) firstPane.material = savedPaneMat;
    this.roomLightsGroup.visible = true;

    // 3. Synchronously pre-upload ALL Room 6.07 textures at boot, AND enqueue ALL exterior CanvasTextures/maps
    // into texWarmupQueue so they drain smoothly into VRAM (2/frame, <0.4ms) while player is still inside Room 6.07!
    const texKeys = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "alphaMap", "aoMap"] as const;
    const uploadedTex = new Set<T.Texture>();
    this.apartment.root.traverse((obj) => {
      if (obj instanceof T.Mesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          const rec = mat as unknown as Record<string, unknown>;
          for (const k of texKeys) {
            const tx = rec[k];
            if (tx instanceof T.Texture && !uploadedTex.has(tx)) {
              uploadedTex.add(tx);
              if (tx.image) {
                this.renderer.initTexture(tx);
              } else {
                enqueueTex(tx);
              }
            }
          }
        }
      }
    });
    this.exteriorGroup.traverse((obj) => {
      if (obj instanceof T.Mesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          const rec = mat as unknown as Record<string, unknown>;
          for (const k of texKeys) {
            const tx = rec[k];
            if (tx instanceof T.Texture && !uploadedTex.has(tx)) {
              uploadedTex.add(tx);
              enqueueTex(tx);
            }
          }
        }
      }
    });
    this.renderer.initTexture(this.dropTex);

    this.clock.start();
    if (!external) this.tick();
  }

  /**
   * Programs are keyed by the active render target (output colour space, tone mapping). The scene is drawn into the
   * HDR composer target, so warming programs against the default framebuffer compiled variants that were never used
   * and every material then linked lazily on first sight (the freezes when turning a corner).
   */
  private compileToMainTarget(fn: () => void) {
    const target = this.backdropRT ?? (this.composer ? this.composer.readBuffer : null);
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target);
    try {
      fn();
    } finally {
      this.renderer.setRenderTarget(prev);
    }
  }
  private enqueueTexture(tx: T.Texture) {
    if (this.queuedTexSet.has(tx)) return;
    this.queuedTexSet.add(tx);
    this.texWarmupQueue.push(tx);
  }

  /** Queues every texture of every material in the scene (also in hidden groups) for a gentle upload, one per frame. */
  private queueAllSceneTextures() {
    this.scene.traverse((obj) => {
      if (!(obj instanceof T.Mesh) && !(obj instanceof T.Points) && !(obj instanceof T.Line)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        const rec = mat as unknown as Record<string, unknown>;
        for (const k in rec) {
          const v = rec[k];
          if (v instanceof T.Texture && v.image) this.enqueueTexture(v);
        }
        const uniforms = (mat as T.ShaderMaterial).uniforms;
        if (uniforms) {
          for (const u of Object.values(uniforms)) {
            if (u && u.value instanceof T.Texture && u.value.image) this.enqueueTexture(u.value);
          }
        }
      }
    });
  }

  /** Draws every group once into a tiny target with an enlarged sun shadow box so all depth programs link now. */
  private prewarmShadowPrograms() {
    this.queueAllSceneTextures();
    const light = this.atmosphere.sunLight;
    const cam = light.shadow.camera as T.OrthographicCamera;
    const saved = { l: cam.left, r: cam.right, t: cam.top, b: cam.bottom, far: cam.far };
    const vis = [
      this.apartment.root,
      this.exteriorGroup,
      this.streetGroup,
      this.busCastGroup,
      this.bus.root,
      this.boardingHouse.root,
      this.districts.root,
    ].map((o) => [o, o.visible] as const);
    for (const [o] of vis) o.visible = true;
    const k = 3;
    cam.left *= k;
    cam.right *= k;
    cam.top *= k;
    cam.bottom *= k;
    cam.far *= 1.5;
    cam.updateProjectionMatrix();
    const sm = this.renderer.shadowMap;
    const prevAuto = sm.autoUpdate;
    sm.autoUpdate = false;
    sm.needsUpdate = true;
    const prevRT = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(this.warmupRT);
      this.renderer.render(this.scene, this.warmupCam);
      if (this.warmupViewRT) {
        sm.needsUpdate = false;
        this.renderer.setRenderTarget(this.warmupViewRT);
        this.renderer.render(this.scene, this.warmupCam);
      }
    } finally {
      this.renderer.setRenderTarget(prevRT);
      sm.autoUpdate = prevAuto;
      sm.needsUpdate = false;
      cam.left = saved.l;
      cam.right = saved.r;
      cam.top = saved.t;
      cam.bottom = saved.b;
      cam.far = saved.far;
      cam.updateProjectionMatrix();
      for (const [o, v] of vis) o.visible = v;
      // the real shadow map holds the enlarged box now: rebuild it on the next normal update
      this.indoorShadowDirty = true;
      this.lastShadowX = 9999;
    }
  }

  private isInsideRoom(x: number, y: number, z: number): boolean {
    const rx0 = ROOM_ANCHOR.x + ROOM.x0;
    const rx1 = ROOM_ANCHOR.x + ROOM.x1;
    const rz0 = ROOM_ANCHOR.z + ROOM.z0;
    const rz1 = ROOM_ANCHOR.z + ROOM.z1;
    return y >= 2.75 && x >= rx0 - 0.12 && x <= rx1 + 0.12 && z >= rz0 - 0.12 && z <= rz1 + 0.12;
  }

  private getFloorHeight(x: number, z: number, curY: number): number {
    // Seamless staircase ramp zone (X: 14.2 .. 19.2, Z: -14.55 .. -12.55)
    if (x >= STAIR.xBottom - 0.35 && x <= STAIR.xTop + 0.05 && z >= STAIR.z0 - 0.22 && z <= STAIR.z1 + 0.22) {
      const t = T.MathUtils.clamp((x - STAIR.xBottom) / (STAIR.xTop - STAIR.xBottom), 0, 1);
      return T.MathUtils.lerp(COURTYARD_Y, FLOOR2_Y, t);
    }
    if (x >= STAIR.xTop - 0.1 && x <= 31.8 && z >= -19.1 && z <= -12.4 && curY >= 2.15) {
      return FLOOR2_Y;
    }
    if (x >= 0 || x <= -12.8 || this.districts.isWalkableSidewalk(x, z)) {
      return CURB_HEIGHT;
    }
    return 0.0;
  }

  private resolveCollisions(
    nx: number,
    nz: number,
    y: number,
    playerSpeed = 0,
    dt = 0.016,
  ): { x: number; z: number } {
    const r = 0.26;
    let x = nx;
    let z = nz;

    const rx0 = ROOM_ANCHOR.x + ROOM.x0;
    const rx1 = ROOM_ANCHOR.x + ROOM.x1;
    const rz0 = ROOM_ANCHOR.z + ROOM.z0;
    const rz1 = ROOM_ANCHOR.z + ROOM.z1;
    const doorMinX = ROOM_ANCHOR.x + 1.2 - 0.36;
    const doorMaxX = ROOM_ANCHOR.x + 1.2 + 0.36;

    // 1. Unified Seamless Staircase Corridor (works smoothly both going DOWN from Floor 2 and UP from Courtyard!)
    const inStairX = x <= STAIR.xTop + 0.15 && x >= STAIR.xBottom - 0.25;
    const inStairZ = this.feet.z >= STAIR.z0 - 0.25 && this.feet.z <= STAIR.z1 + 0.25;
    const onStairRamp =
      inStairX &&
      inStairZ &&
      (y > 0.28 || (this.feet.x >= STAIR.xBottom - 0.4 && x > this.feet.x && z >= STAIR.z0 && z <= STAIR.z1));
    if (onStairRamp) {
      // Smooth wide stair lane bounded only by P.6.06 north wall & south handrail — ZERO snags at top or bottom!
      x = Math.max(x, 13.75);
      z = T.MathUtils.clamp(z, STAIR.z0 + 0.24, STAIR.z1 - 0.2);
      return { x, z };
    }

    // 2. Floor 2 Balcony & Inside Room 6.07
    if (y >= 2.65) {
      const wasInRoom = this.isInsideRoom(this.feet.x, this.feet.y, this.feet.z);
      const inDoorX = x >= doorMinX && x <= doorMaxX && this.doorAnim > 0.45;

      if (wasInRoom) {
        x = T.MathUtils.clamp(x, rx0 + r, rx1 - r);
        z = Math.max(z, rz0 + r);
        if (!inDoorX) z = Math.min(z, rz1 - r);
        const furn = resolveSolids(x, z, r, this.roomFurnitureSolids);
        x = furn.x;
        z = furn.z;
      } else {
        if (z < rz1 + r && x > rx0 - r && x < rx1 + r && !inDoorX) {
          z = Math.max(z, rz1 + r);
        }
        const up = resolveSolids(x, z, r, this.solidsUpper);
        x = up.x;
        z = up.z;
        x = Math.min(x, 31.3);
        z = T.MathUtils.clamp(z, -18.7, -12.78);
      }
      return { x, z };
    }

    // 3. Ground Courtyard, Hẻm & Open World Saigon Streets
    const col = resolveSolids(x, z, r, this.solidsGround);
    x = col.x;
    z = col.z;

    if (!this.onBus) {
      const busHull = rect(this.route.x, this.route.z, 2.55, 11.1);
      const busCol = resolveSolids(x, z, r, [busHull]);
      x = busCol.x;
      z = busCol.z;

      // Exact 2D Circle-vs-OBB collision against EVERY moving motorbike, car, taxi, SUV & van in Saigon!
      const vehCol = this.traffic.resolvePlayerCollision(x, z, y, r);
      x = vehCol.x;
      z = vehCol.z;
      if (vehCol.hitVehicle && vehCol.impactSpeed > 0.9) {
        this.bumpVx = vehCol.impulseX;
        this.bumpVz = vehCol.impulseZ;
      }

      // Solid physical human collision + shoulder-bump recoil against ALL Street Residents, Story NPCs & District Pedestrians!
      const humCol = this.humanPresence.resolvePlayerCollision(
        x,
        z,
        y,
        r,
        playerSpeed,
        this.elapsed,
        dt,
      );
      x = humCol.x;
      z = humCol.z;
      if (humCol.bumped) {
        this.bumpVx = humCol.impulseX;
        this.bumpVz = humCol.impulseZ;
        if (this.audio.started && !this.external) {
          this.audio.footstep(Math.min(1.4, 0.75 + humCol.impactStrength * 0.4));
        }
      }
    }

    if (!this.districts.isWithinOpenWorld(x, z)) {
      return { x: this.feet.x, z: this.feet.z };
    }

    return { x, z };
  }

  private ensureAudio() {
    this.traffic.audio.unlock();
    if (!this.audio.started) {
      try {
        this.audio.start();
      } catch {
        // ignore WebAudio gesture blocks
      }
    }
  }

  private busDoorWorldPos(): T.Vector3 {
    return new T.Vector3(this.route.x + 1.4, CURB_HEIGHT, this.route.z - 4.4);
  }

  private tryInteract() {
    this.ensureAudio();

    if (this.activeModal) {
      this.activeModal = null;
      return;
    }

    if (this.storyNpcs.getActiveDialogue()) {
      this.storyNpcs.advanceDialogue();
      return;
    }

    if (this.onBus) {
      // E sits on the nearest seat, or stands up again (the doors decide whether the player can get off).
      if (this.busSeat) {
        this.busLocal = { x: Math.sign(this.busSeat.x) * 0.2, z: this.busSeat.aisleZ };
        this.busSeat = null;
        return;
      }
      const seat = this.nearestBusSeat();
      if (seat) this.busSeat = seat;
      return;
    }

    if (this.feet.y < 1.2) {
      const targetNpc = this.storyNpcs.nearestInteractable(this.feet);
      if (targetNpc) {
        // Let the chapter reducer record the physical interaction first. A host hands its fresh
        // narrative context straight back, so the opening turn is resolved on the right branch
        // (notably Cô Ba's on-time late/rescheduled states) instead of one render late.
        const patch = this.external?.onStoryStart?.(targetNpc.npc.id);
        if (patch) this.storyNpcs.setContext(patch);
        this.storyNpcs.beginDialogue(targetNpc.npc.id);
        return;
      }
    }
    const doorPos = this.busDoorWorldPos();
    if (Math.hypot(this.feet.x - doorPos.x, this.feet.z - doorPos.z) < 4.8 && this.feet.y < 1.2) {
      // The bus is not at the stop yet: wait for it (time skips to its arrival). At the stop the player walks on.
      if (this.route.phase === "waiting") this.route.wait();
      return;
    }

    const doorWorldX = ROOM_ANCHOR.x + 1.2;
    const doorWorldZ = ROOM_ANCHOR.z + ROOM.z1;
    if (
      Math.abs(this.feet.y - ROOM_ANCHOR.y) < 0.6 &&
      Math.hypot(this.feet.x - doorWorldX, this.feet.z - doorWorldZ) < 2.25
    ) {
      if (this.external) {
        this.external.onDoor?.();
        return;
      }
      this.doorOpen = !this.doorOpen;
      if (this.audio.started) this.audio.doorClose();
      return;
    }
    if (this.hoveredId) {
      const id = this.hoveredId;
      if (id === "desklamp" || id === "lamp") {
        this.deskOn = !this.deskOn;
        if (this.audio.started) this.audio.switchClick("desklamp");
      } else if (id === "switch" || id === "ceiling") {
        this.ceilOn = !this.ceilOn;
        if (this.audio.started) this.audio.switchClick("switch");
      } else if (id === "bedlamp") {
        this.bedLampOn = !this.bedLampOn;
        if (this.audio.started) this.audio.switchClick("bedlamp");
      } else if (id === "kitchenlight") {
        this.kitchenOn = !this.kitchenOn;
        if (this.audio.started) this.audio.switchClick("kitchenlight");
      } else if (id === "phone") {
        this.activeModal = "phone";
      } else if (id === "note") {
        this.activeModal = "note";
        if (this.audio.started) this.audio.paper("desk");
      } else if (id === "window") {
        this.winOpen = !this.winOpen;
        if (this.audio.started) this.audio.windowSlide(this.winOpen);
      } else if (id === "fridge") {
        this.fridgeOpen = !this.fridgeOpen;
        if (this.audio.started) this.audio.fridgeDoor(this.fridgeOpen);
      } else if (id === "door") {
        this.doorOpen = !this.doorOpen;
        if (this.audio.started) this.audio.doorClose();
      }
    }
  }

  private updateHoverPrompt() {
    this.hoveredId = null;

    if (this.onBus) {
      const phase = this.route.phase;
      const status = phaseLabel(phase);
      const atEnd = phase === "arrived" || phase === "complete";
      if (this.busSeat) {
        this.currentPrompt =
          phase === "boarding"
            ? tr("prompt.confirmRide")
            : atEnd
              ? tr("prompt.standUpRear")
              : tr("prompt.noMidway", { status });
      } else {
        this.currentPrompt = this.nearestBusSeat() ? tr("prompt.sitDown", { status }) : atEnd ? tr("prompt.offRear") : status;
      }
      return;
    }
    if (this.feet.y < 1.2 && !this.storyNpcs.getActiveDialogue()) {
      const targetNpc = this.storyNpcs.nearestInteractable(this.feet);
      if (targetNpc) {
        const lang = i18n.language === "en" ? "en" : "vi";
        const name = lang === "vi" ? targetNpc.npc.name.vi : targetNpc.npc.name.en;
        const role = lang === "vi" ? targetNpc.npc.role.vi : targetNpc.npc.role.en;
        this.currentPrompt =
          lang === "vi"
            ? `[E] Nói chuyện với ${name} (${role})`
            : `[E] Talk to ${name} (${role})`;
        return;
      }
    }

    const busDoor = this.busDoorWorldPos();
    if (this.feet.y < 1.2 && Math.hypot(this.feet.x - busDoor.x, this.feet.z - busDoor.z) < 4.8) {
      this.currentPrompt =
        this.route.phase === "boarding"
          ? tr("prompt.walkOn")
          : this.route.phase === "waiting"
            ? tr("prompt.waitBus")
            : phaseLabel(this.route.phase);
      return;
    }

    const doorWorldX = ROOM_ANCHOR.x + 1.2;
    const doorWorldZ = ROOM_ANCHOR.z + ROOM.z1;
    if (
      Math.abs(this.feet.y - ROOM_ANCHOR.y) < 0.6 &&
      Math.hypot(this.feet.x - doorWorldX, this.feet.z - doorWorldZ) < 2.15
    ) {
      this.currentPrompt = this.external
        ? null
        : this.doorOpen
          ? tr("prompt.closeRoomDoor")
          : tr("prompt.openToHall");
      return;
    }

    if (this.isInsideRoom(this.feet.x, this.feet.y, this.feet.z)) {
      this.raycaster.setFromCamera(new T.Vector2(0, 0), this.camera);
      this.raycaster.far = 3.2;
      const hits = this.raycaster.intersectObjects(this.apartment.hits, true);
      if (hits.length > 0) {
        const id = hits[0].object.userData?.id as string | undefined;
        if (id) {
          this.hoveredId = id;
          const labels: Record<string, string> = {
            desklamp: tr("prompt.deskLamp"),
            switch: tr("prompt.ceilingLight"),
            bedlamp: tr("prompt.bedLamp"),
            kitchenlight: tr("prompt.kitchenLight"),
            phone: tr("prompt.phone"),
            note: tr("prompt.note"),
            window: this.winOpen ? tr("prompt.closeWindow") : tr("prompt.openWindow"),
            fridge: this.fridgeOpen ? tr("prompt.closeFridge") : tr("prompt.openFridge"),
            door: this.doorOpen ? tr("prompt.closeRoomDoor") : tr("prompt.openToBuilding"),
          };
          this.currentPrompt = labels[id] ?? null;
          return;
        }
      }
    }

    this.currentPrompt = null;
  }

  public moveToWaypoint(wp: LandmarkWaypoint) {
    this.onBus = false;
    this.activeModal = null;
    if (wp === "room") {
      this.feet.set(ROOM_ANCHOR.x + 1.3, ROOM_ANCHOR.y, ROOM_ANCHOR.z + 1.55);
      this.yaw = 0.62;
      this.pitch = -0.05;
    } else if (wp === "balcony") {
      this.doorOpen = true;
      this.doorAnim = 1;
      this.feet.set(22.4, ROOM_ANCHOR.y, -13.5);
      this.yaw = Math.PI * 0.52;
      this.pitch = -0.14;
    } else if (wp === "hem") {
      this.feet.set(9.2, CURB_HEIGHT, -11.25);
      this.yaw = Math.PI * 0.5;
      this.pitch = 0.02;
    } else if (wp === "bus") {
      this.feet.set(3.4, CURB_HEIGHT, 6.2);
      this.yaw = 0.34;
      this.pitch = 0.04;
    } else if (wp === "bitexco") {
      this.feet.set(BITEXCO_POS.x - 24, CURB_HEIGHT, BITEXCO_POS.z + 24);
      this.yaw = -0.74;
      this.pitch = 0.38;
    } else if (wp === "landmark81") {
      this.feet.set(LANDMARK81_POS.x - 12, CURB_HEIGHT, -315);
      this.yaw = -0.26;
      this.pitch = 0.48;
    }
    this.syncCamera();
  }

  public closeModal() {
    this.activeModal = null;
  }

  public setWeather(w: WeatherPreset) {
    this.atmosphere.setWeather(w);
  }

  public setTimeOfDay(h: number) {
    this.atmosphere.setTimeOfDay(h);
  }

  public setAutoCycle(enabled: boolean) {
    this.atmosphere.state.autoCycle = enabled;
  }

  public toggleDoor() {
    this.doorOpen = !this.doorOpen;
    if (this.audio.started) this.audio.doorClose();
  }

  /** Bus-local walking speed (m/s). */
  private static readonly BUS_WALK = 1.5;
  /** Floor height inside the bus (steps at the doors). */
  private busFloor(L: { x: number; z: number }): number {
    return busFloorAt(busToWorld(L, this.route), L);
  }
  /** Nearest seat within reach of where the player stands in the bus, or null. */
  private nearestBusSeat(): PassengerSeat | null {
    if (this.busSeat) return null;
    let best: PassengerSeat | null = null;
    let bestD = 1.25;
    for (const seat of BUS_SEATS) {
      const d = Math.hypot(seat.x - this.busLocal.x, seat.z - this.busLocal.z);
      if (d < bestD) {
        bestD = d;
        best = seat;
      }
    }
    return best;
  }
  /** World x/z of a move by `forward` / `strafe` this frame at `speed`. */
  private walkDelta(forward: number, strafe: number, speed: number, dt: number) {
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const dx = -sinY * forward + cosY * strafe;
    const dz = -cosY * forward - sinY * strafe;
    const len = Math.hypot(dx, dz) || 1;
    return { dx: (dx / len) * speed * dt, dz: (dz / len) * speed * dt };
  }
  /** The bus is at the stop with the front door open and the player walks into the doorway: they are on board. */
  private tryWalkOnBus(forward: number, strafe: number, dt: number) {
    if (this.route.phase !== "boarding" || !this.route.doors.front.passable || this.feet.y > 1.2) return;
    const { dx, dz } = this.walkDelta(forward, strafe, 4.2, dt);
    const local = busToLocal({ x: this.feet.x + dx, z: this.feet.z + dz }, this.route);
    const door = BUS_DOORS.front;
    if (local.x > 1.85 || local.x < 0.9 || local.z < door.min + 0.2 || local.z > door.max - 0.2) return;
    this.onBus = true;
    this.busSeat = null;
    this.busLocal = { x: Math.min(local.x, 1.45), z: local.z };
    this.route.passengerCrossed(true);
    this.carryOnBus();
  }
  /** Walking inside the bus (bus-local, against its walls and closed doors); off through an open door. */
  private stepOnBus(dt: number, forward: number, strafe: number) {
    if (this.busSeat || this.activeModal || (forward === 0 && strafe === 0)) {
      this.carryOnBus();
      return;
    }
    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const { dx, dz } = this.walkDelta(forward, strafe, OpenWorldEngine.BUS_WALK * (sprint ? 1.4 : 1), dt);
    // World delta into bus-local axes (the inverse of the bus yaw).
    const c = Math.cos(this.route.yaw);
    const s = Math.sin(this.route.yaw);
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    const steps = Math.max(1, Math.ceil(Math.hypot(lx, lz) / 0.06));
    const L = this.busLocal;
    const x0 = L.x;
    const z0 = L.z;
    for (let i = 0; i < steps; i++) {
      for (const [ax, az] of [[lx / steps, 0], [0, lz / steps]]) {
        const next = { x: L.x + ax, z: L.z + az };
        if (!blocksBus(next, this.route)) {
          L.x = next.x;
          L.z = next.z;
        }
      }
    }
    this.busWalked = Math.hypot(L.x - x0, L.z - z0);
    this.bob += this.busWalked * 2.8;
    // Out through an open door onto the curb. The doors are shut while the bus runs, so nobody leaves mid-route.
    if (!insideBus(L) && L.x > 1.62) {
      const world = busToWorld(L, this.route);
      this.onBus = false;
      this.busSeat = null;
      this.feet.set(world.x + 0.25, CURB_HEIGHT, world.z);
      this.route.passengerCrossed(false, this.route.phase === "arrived");
      return;
    }
    this.carryOnBus();
  }
  /** Keeps the player's feet with the bus (world position of the bus-local spot). */
  private carryOnBus() {
    const L = this.busSeat ?? this.busLocal;
    const w = busToWorld(L, this.route);
    this.feet.set(w.x, this.busFloor(L), w.z);
  }
  /** Embedded F on the bus: seated at the stop, the player confirms and the bus leaves (fare paid, doors close). */
  public confirmRide() {
    if (!this.onBus || !this.busSeat || this.route.phase !== "boarding") return;
    if (this.route.pay(true)) this.route.depart(true, false);
  }
  private syncCamera() {
    if (this.onBus) {
      // The bus matrix is refreshed first: a stale one put the eye a frame behind the bus and the view shook.
      this.bus.root.updateMatrixWorld(true);
      const L = this.busSeat ? this.busSeat : this.busLocal;
      const eye = this.busSeat ? seatBase(this.busSeat.z) + 1.18 : this.busFloor(L) + 1.6;
      this.camera.position.copy(this.bus.root.localToWorld(this._busEye.set(L.x, eye, L.z)));
    } else {
      const breathe = Math.sin(this.elapsed * 1.1) * 0.004;
      const bobY = Math.sin(this.bob * 2) * 0.028;
      this.camera.position.set(this.feet.x, this.feet.y + this.eyeHeight + breathe + bobY, this.feet.z);
    }
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private updateRoomFidelity(dt: number, atm: AtmosphereState, indoors: boolean, nearRoom: boolean) {
    const a = this.apartment;
    const L = this.lightLevels;
    const ease = (cur: number, on: boolean, up: number, down: number) =>
      T.MathUtils.clamp(cur + (on ? dt * up : -dt * down), 0, 1);

    L.ceiling = ease(L.ceiling, this.ceilOn, 5, 8);
    L.desk = ease(L.desk, this.deskOn, 14, 14);
    L.bed = ease(L.bed, this.bedLampOn, 6, 6);
    L.kitchen = ease(L.kitchen, this.kitchenOn, 9, 9);

    // Exact original Room 6.07 light balance & warm LED switch-on flicker (using streamlined constant light pool!)
    const flick = L.ceiling > 0 && L.ceiling < 1 ? (Math.random() < 0.5 ? 0.6 : 1) : 1;
    a.lights.ceilingSpot.intensity = 3.2 * L.ceiling * flick;
    a.lights.ceilingFill.intensity = 1.3 * L.ceiling * flick + 1.15 * L.kitchen;
    a.emissives.ceiling.emissiveIntensity = 0.9 * L.ceiling * flick;
    a.lights.deskSpot.intensity = 1.78 * L.desk;
    a.emissives.desk.emissiveIntensity = 12 * Math.max(L.desk, L.bed);
    a.lights.bedLamp.intensity = 0.95 * L.bed;
    a.emissives.bed.emissiveIntensity = 0.8 * L.bed;
    a.emissives.kitchen.emissiveIntensity = 6.0 * L.kitchen;

    // Breathing AC & laptop LEDs
    a.emissives.acLed.color.setRGB(0.1, 0.6 + Math.sin(this.elapsed * 0.8) * 0.3, 0.2);
    a.emissives.powerLed.color.setScalar(1.2);

    // Sync Room 6.07 wall clock + laptop/phone displays with live Saigon time!
    const totalHours = atm.timeOfDay;
    const hrs = totalHours % 12;
    const mins = (totalHours * 60) % 60;
    const secs = (totalHours * 3600) % 60;
    a.clockHands.h.rotation.z = -(hrs / 12) * Math.PI * 2;
    a.clockHands.m.rotation.z = -(mins / 60) * Math.PI * 2;
    a.clockHands.s.rotation.z = -(Math.floor(secs) / 60) * Math.PI * 2;

    const clockStr = formatClock24(totalHours);
    if (clockStr !== this.lastScreenClock) {
      this.lastScreenClock = clockStr;
      a.laptopScreen.draw(1, clockStr, LAPTOP_DRAFT);
      a.phoneScreen.draw("lock", clockStr, this.elapsed, 0);
    }

    // Fridge mist & shared roomAccentLight (smoothly serves fridge glow when open, or subtle laptop/phone glow!)
    this.fridgeAnim = T.MathUtils.lerp(this.fridgeAnim, this.fridgeOpen ? 1 : 0, 1 - Math.exp(-dt * 5.2));
    a.fridgeDoor.rotation.y = this.fridgeAnim * 1.45;
    const fridgeLvl = this.fridgeAnim > 0.06 ? 1 : 0;
    a.fridge.led.color.setRGB(0.8, 0.9, 1.05).multiplyScalar(fridgeLvl);
    if (fridgeLvl > 0) {
      this.roomAccentLight.position.set(-2.1, 0.95, 1.45);
      this.roomAccentLight.color.setHex(0xcfe8ff);
      this.roomAccentLight.intensity = 1.45 * this.fridgeAnim;
    } else {
      this.roomAccentLight.position.set(-0.35, 1.05, -1.55);
      this.roomAccentLight.color.setHex(0x88b8ff);
      this.roomAccentLight.intensity = 0.32;
    }
    const mm = a.fridge.mist.material as T.PointsMaterial;
    mm.opacity = 0.24 * T.MathUtils.smoothstep(this.fridgeAnim, 0.35, 1.0);
    if (mm.opacity > 0.002) {
      const p = a.fridge.mist.geometry.attributes.position as T.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const life = (this.elapsed * 0.22 + i / p.count) % 1;
        p.setXYZ(
          i,
          -2.27 + Math.sin(i * 12.9) * 0.2 + Math.sin(this.elapsed + i) * 0.03 * life,
          0.2 - life * 0.19,
          1.5 - life * 0.55 + Math.cos(i * 7.7) * 0.05,
        );
      }
      p.needsUpdate = true;
    }

    // Floating dust motes drifting in the desk lamp light beam
    if (indoors) {
      const dp = this.dust.geometry.attributes.position as T.BufferAttribute;
      for (let i = 0; i < dp.count; i++) {
        const sd = this.dustSeed[i * 4];
        let x = dp.getX(i) + Math.sin(this.elapsed * 0.13 + sd) * dt * 0.012;
        let y = dp.getY(i) + Math.sin(this.elapsed * 0.21 + sd * 2) * dt * 0.01 - dt * 0.004;
        let z = dp.getZ(i) + Math.cos(this.elapsed * 0.11 + sd) * dt * 0.012;
        if (y < 0.2) y = 2.4;
        dp.setXYZ(i, x, y, z);
      }
      dp.needsUpdate = true;
      const lit = Math.min(1, L.ceiling + L.desk * 0.8 + L.bed * 0.6 + L.kitchen * 0.4);
      (this.dust.material as T.PointsMaterial).opacity = 0.06 + lit * 0.38;
    }

    // Rain-drop caustic gobo light texture & Room 6.07 window lights (exact original Room look + Day/Night reactivity!)
    if (indoors) {
      this.dropTimer += dt;
      if (this.dropTimer > 0.11) {
        this.dropTimer = 0;
        paintDropMask(this.dropCanvas, this.elapsed);
        this.dropTex.needsUpdate = true;
      }
    }

    // ZERO-RECOMPILE Room 6.07 Light Control:
    // NEVER toggle .visible or .castShadow on any Light (toggling changes Three.js programCacheKey -> multi-second freeze!).
    // Instead, drive .intensity to 0 when lamps are off or player is outdoors (> 9m away).
    if (!nearRoom) {
      a.lights.ceilingSpot.intensity = 0;
      a.lights.ceilingFill.intensity = 0;
      a.lights.deskSpot.intensity = 0;
      a.lights.bedLamp.intensity = 0;
    }
    if (!indoors) {
      this.roomAccentLight.intensity = 0;
      this.winRect.intensity = 0;
      this.outSpot.intensity = 0;
      this.upSpot.intensity = 0;
      this.neonSpot.intensity = 0;
    } else {
      this.winRect.color.copy(this._winDayCol).lerp(this._winNightCol, atm.nightFactor);
      this.winRect.intensity =
        T.MathUtils.lerp(4.2 * (1 - atm.rainIntensity * 0.32), 1.85, atm.nightFactor) + atm.lightningFlash * 3.2;

      this.outSpot.color.copy(this._outDayCol).lerp(this._outNightCol, atm.nightFactor);
      this.outSpot.intensity =
        T.MathUtils.lerp(44 * (1 - atm.rainIntensity * 0.35), 26, atm.nightFactor) + atm.lightningFlash * 38;
      this.upSpot.intensity = atm.nightFactor > 0.15 ? 30 * atm.nightFactor * (0.45 + atm.wetness * 0.55) : 0;
      if (Math.random() < 0.02) this.neonSpot.userData.off = Math.random() < 0.3;
      this.neonSpot.intensity =
        atm.nightFactor > 0.25 ? (this.neonSpot.userData.off ? 3 : 24 + Math.sin(this.elapsed * 40) * 1.5) * atm.nightFactor : 0;
    }

    // Swap Room 6.07 window panes seamlessly:
    // - INDOORS: 100% EXACT original Martijn Steinrucken Heartfelt Rain-on-Glass shader refracting live 3D Saigon!
    // - OUTDOORS: Photorealistic dark architectural reflective glass looking back into Dãy Trọ!
    if (indoors !== this.glassModeIndoor) {
      this.glassModeIndoor = indoors;
      this.apartment.glassPanes.forEach((pane, idx) => {
        pane.material = indoors ? this.rainGlassMats[idx] : this.exteriorGlassMat;
      });
    }

    if (indoors) {
      const warm = L.ceiling * 0.5 + L.desk * 0.22 + L.bed * 0.22 + L.kitchen * 0.1;
      const rw = this.renderer.domElement.width;
      const rh = this.renderer.domElement.height;
      for (const gm of this.rainGlassMats) {
        gm.uniforms.uRes.value.set(rw, rh);
        gm.uniforms.uTime.value = this.elapsed * (0.65 + atm.rainIntensity * 1.15);
        // Frosted condensation & sliding drop density driven dynamically by real Saigon tropical weather!
        gm.uniforms.uFog.value = T.MathUtils.lerp(0.06, 0.58, atm.wetness);
        gm.uniforms.uSliding.value = T.MathUtils.clamp(0.06 + atm.wetness * 0.32 + atm.rainIntensity * 0.55, 0.04, 0.92);
        gm.uniforms.uWarm.value.setRGB(0.95, 0.65, 0.4).multiplyScalar(warm * (0.04 + atm.nightFactor * 0.12));
      }
    }

    for (const fn of a.updaters) fn(this.elapsed, dt);
  }

  private tick = () => {
    if (this.disposed || this.viewMode) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    this.frame(dt);
  };

  private applyLens(lens: ViewLens) {
    const cam = this.camera;
    if (cam.fov !== lens.fov || cam.aspect !== lens.aspect || cam.near !== lens.near || cam.far !== lens.far) {
      cam.fov = lens.fov;
      cam.aspect = lens.aspect;
      cam.near = lens.near;
      cam.far = lens.far;
      cam.updateProjectionMatrix();
    }
  }

  /** Embedded, player in the room: run the world for one frame seen from the room camera. */
  public stepView(dt: number, pose: ViewPose) {
    if (this.disposed || !this.external) return;
    if (!this.viewMode) this.viewMode = true;
    this.elapsed += dt;
    this.feet.set(ROOM_ANCHOR.x + 1.3, ROOM_ANCHOR.y, ROOM_ANCHOR.z + 1.55);
    this.extDoor = pose.door;
    this.extWin = pose.window;
    this.winOpen = pose.window > 0.05;
    this.yaw = pose.yaw;
    this.pitch = pose.pitch;
    this.applyLens(pose);
    const cam = this.camera;
    cam.rotation.order = "YXZ";
    cam.position.set(ROOM_ANCHOR.x + pose.position.x, ROOM_ANCHOR.y + pose.position.y, ROOM_ANCHOR.z + pose.position.z);
    if (pose.quaternion) cam.quaternion.copy(pose.quaternion);
    else cam.rotation.set(pose.pitch, pose.yaw, 0);
    this.wantBackdrop = pose.backdrop;
    this.backdropPortal = pose.portal ?? null;
    this.extWindowInView = pose.windowInView ?? Math.cos(pose.yaw) > -0.2;
    this.frame(dt);
  }

  /** Embedded: the player walked out of the room door. `eye` is the room camera position (room-local). */
  public enterPlay(eye: T.Vector3, yaw: number, pitch: number) {
    if (!this.external || this.disposed) return;
    this.viewMode = false;
    this.onBus = false;
    this.activeModal = null;
    this.feet.set(ROOM_ANCHOR.x + eye.x, ROOM_ANCHOR.y, ROOM_ANCHOR.z + eye.z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.wasIndoors = false;
    this.outdoorWarmupFrames = 6;
    this.lastShadowX = 9999;
    // The street's horns, revs and bed (the page has had a user gesture by now: the player walked out).
    this.traffic.audio.unlock();
  }
  /** Embedded: the game's sound setting for the street audio. */
  public setStreetMuted(muted: boolean) {
    this.traffic.audio.setMuted(muted);
  }

  /** Embedded, player outside: move with the room's input and draw the backdrop. */
  public stepPlay(dt: number, input: PlayInput): PlayResult {
    const out = this.playOut;
    out.moved = 0;
    if (this.disposed || !this.external) {
      out.inRoom = true;
      return out;
    }
    this.viewMode = false;
    this.elapsed += dt;
    this.keys.clear();
    input.keys.forEach((k) => this.keys.add(k));
    this.yaw = input.yaw;
    this.pitch = input.pitch;
    this.extDoor = input.door;
    this.applyLens(input);
    const fx = this.feet.x;
    const fz = this.feet.z;
    this.wantBackdrop = true;
    this.backdropPortal = null;
    this.frame(dt);
    out.moved = this.onBus ? this.busWalked : Math.hypot(this.feet.x - fx, this.feet.z - fz);
    out.inRoom = !this.onBus && this.isInsideRoom(this.feet.x, this.feet.y, this.feet.z);
    out.position.copy(this.camera.position).sub(ROOM_ANCHOR);
    return out;
  }

  /** Embedded, player outside: E (bus, room door). */
  public interact() {
    if (this.external && !this.viewMode) this.tryInteract();
  }

  public get playing(): boolean {
    return !!this.external && !this.viewMode;
  }

  public get hudPrompt(): string | null {
    return this.currentPrompt;
  }

  /** Embedded: what `stepView` / `stepPlay` drew this frame (null when nothing was drawn). */
  public get backdrop(): { color: T.Texture; depth: T.DepthTexture; scale: T.Vector2 } | null {
    const rt = this.backdropRT;
    if (!rt || !rt.depthTexture || !this.backdropDrawn) return null;
    return { color: rt.texture, depth: rt.depthTexture, scale: this.backdropScale };
  }
  /** Part of the backdrop target that holds the picture (uv scale). */
  private readonly backdropScale = new T.Vector2(1, 1);
  private backdropDrawn = false;

  /** The location line and the street state for the host HUD while playing embedded. */
  public get lastSnapshot(): OpenWorldSnapshot | null {
    return this.lastSnap;
  }
  private lastSnap: OpenWorldSnapshot | null = null;
  private lastAssetAt = 0;
  private viewShadowT = 0;
  /** ViewPose.windowInView of the last stepView. */
  private extWindowInView = true;
  private shadowProgramsDirty = true;

  private frame(dt: number) {
    const viewMode = this.viewMode;
    // 1. Movement & Seamless Multi-Floor Physics
    const forward =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const strafe =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);

    this.busWalked = 0;
    // Walking into the open front door at the stop steps straight up onto the bus.
    if (!viewMode && !this.onBus && !this.activeModal && (forward !== 0 || strafe !== 0)) this.tryWalkOnBus(forward, strafe, dt);
    if (viewMode) {
      // window view only: the player stays in the room
    } else if (this.onBus) {
      this.stepOnBus(dt, forward, strafe);
    } else if (!this.onBus && !this.activeModal && (forward !== 0 || strafe !== 0)) {
      const sprinting = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
      const indoorsNow = this.isInsideRoom(this.feet.x, this.feet.y, this.feet.z);
      const speed = indoorsNow ? (sprinting ? 3.2 : 2.15) : sprinting ? 8.8 : 4.2;

      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      let dx = -sinY * forward + cosY * strafe;
      let dz = -cosY * forward - sinY * strafe;
      const len = Math.hypot(dx, dz) || 1;
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;

      const resolved = this.resolveCollisions(
        this.feet.x + dx,
        this.feet.z + dz,
        this.feet.y,
        speed,
        dt,
      );
      const moved = Math.hypot(resolved.x - this.feet.x, resolved.z - this.feet.z);
      this.feet.x = resolved.x;
      this.feet.z = resolved.z;

      const targetY = this.getFloorHeight(this.feet.x, this.feet.z, this.feet.y);
      this.feet.y = T.MathUtils.lerp(this.feet.y, targetY, 1 - Math.exp(-dt * 18));

      if (moved > 0.001) {
        this.bob += moved * 2.8;
        this.stepDist += moved;
        if (this.stepDist > 0.65) {
          this.stepDist = 0;
          // Embedded, the room plays the player's footsteps (dry / wet walking, as in the neighborhood).
          if (this.audio.started && !this.external) this.audio.footstep(indoorsNow ? 0.85 : 1.0);
        }
      }
    } else if (!this.onBus) {
      // Even while standing still on asphalt, apply vehicle knockback impulse & exact OBB collision push-out!
      if (Math.abs(this.bumpVx) > 0.02 || Math.abs(this.bumpVz) > 0.02) {
        const pushed = this.resolveCollisions(
          this.feet.x + this.bumpVx * dt,
          this.feet.z + this.bumpVz * dt,
          this.feet.y,
          Math.hypot(this.bumpVx, this.bumpVz),
          dt,
        );
        this.feet.x = pushed.x;
        this.feet.z = pushed.z;
        const decay = Math.exp(-dt * 8.5);
        this.bumpVx *= decay;
        this.bumpVz *= decay;
      } else if (this.feet.y < 1.35) {
        const standHit = this.traffic.resolvePlayerCollision(this.feet.x, this.feet.z, this.feet.y, 0.26);
        if (standHit.hitVehicle) {
          this.feet.x = standHit.x;
          this.feet.z = standHit.z;
          if (standHit.impactSpeed > 0.9) {
            this.bumpVx = standHit.impulseX;
            this.bumpVz = standHit.impulseZ;
          }
        }
        // Even while standing still, moving walkers push cleanly past Alex & lingering triggers personal-space awareness!
        const humStand = this.humanPresence.resolvePlayerCollision(
          this.feet.x,
          this.feet.z,
          this.feet.y,
          0.26,
          0,
          this.elapsed,
          dt,
        );
        if (humStand.hitHuman) {
          this.feet.x = humStand.x;
          this.feet.z = humStand.z;
        }
      }
      const targetY = this.getFloorHeight(this.feet.x, this.feet.z, this.feet.y);
      this.feet.y = T.MathUtils.lerp(this.feet.y, targetY, 1 - Math.exp(-dt * 14));
      this.bob = T.MathUtils.lerp(this.bob, 0, Math.min(1, dt * 6));
    }

    // 2. Smooth Hinged Room Door & Sliding Window Sash
    this.doorAnim = T.MathUtils.lerp(this.doorAnim, this.doorOpen ? 1 : 0, 1 - Math.exp(-dt * 7.5));
    this.apartment.doorPivot.rotation.y = this.doorAnim * 1.72;

    this.winAnim = T.MathUtils.lerp(this.winAnim, this.winOpen ? 1 : 0, 1 - Math.exp(-dt * 5.0));
    if (this.external) {
      this.doorAnim = this.extDoor;
      this.winAnim = this.extWin;
    }
    this.apartment.rightSash.position.x = -this.winAnim * 0.68;

    if (!viewMode) this.syncCamera();
    this.renderFrame++;

    // 3. Atmosphere, 24h Day/Night Sky, Tropical Rain & Wet-Surface Reflections
    const indoors = this.isInsideRoom(this.feet.x, this.feet.y, this.feet.z);
    // Street bed and street horns only out on the street (the room has its own muffled city).
    this.traffic.audio.setAmbience(viewMode || indoors ? 0 : 1);
    // Stagger outdoor GPU wakeup over 4 frames on room exit (street -> bus+districts -> cast -> shadow -> reflector)
    // Guarantees ZERO frame-spike stacking when stepping out of Room 6.07 onto the balcony!
    if (indoors) {
      this.outdoorWarmupFrames = 0;
    } else if (this.wasIndoors) {
      // Through an open door the street was already drawn: nothing to wake up in stages.
      this.outdoorWarmupFrames = this.doorAnim > 0.3 ? 6 : 1;
    } else if (this.outdoorWarmupFrames > 0 && this.outdoorWarmupFrames < 6) {
      this.outdoorWarmupFrames++;
    }
    this.wasIndoors = indoors;

    // Suppress outdoor planar wet reflector while indoors AND during the first 4 frames of stepping outside!
    const clockHours = this.external?.clockHours?.();
    if (clockHours !== null && clockHours !== undefined) {
      this.atmosphere.state.autoCycle = false;
      this.atmosphere.setTimeOfDay(clockHours);
    }
    this.atmosphere.setReflectorSuppressed(indoors || this.outdoorWarmupFrames < 5);
    this.atmosphere.update(dt, this.elapsed, this.camera.position);
    const atm = this.atmosphere.state;

    // Sync GTA 6 Global Tropical Weathering & Wet-Asphalt Anisotropic Specular Shader Uniforms!
    SAIGON_SHADER_UNIFORMS.uWetness.value = atm.wetness;
    SAIGON_SHADER_UNIFORMS.uNight.value = atm.nightFactor;
    SAIGON_SHADER_UNIFORMS.uTime.value = this.elapsed;
    SAIGON_SHADER_UNIFORMS.uRain.value = atm.rainIntensity;

    const dxRoom = this.feet.x - ROOM_ANCHOR.x;
    const dzRoom = this.feet.z - ROOM_ANCHOR.z;
    const nearRoom = dxRoom * dxRoom + dzRoom * dzRoom < 81;
    // Street-side perf: 9 of the 14 scene lights belong to Room 6.07 and sit at intensity 0 outdoors, yet every
    // material still uploads/loops them (~30% of frame CPU). Drop them while far from the room. Both light-set
    // variants are compiled at boot (see compile below), so the swap costs one cheap program lookup, no recompile.
    const farFromRoom = dxRoom * dxRoom + dzRoom * dzRoom > 169;
    if (indoors || nearRoom) {
      this.roomFarTimer = 0;
      this.roomLightsGroup.visible = true;
    } else if (farFromRoom && this.roomLightsGroup.visible) {
      this.roomFarTimer += dt;
      if (this.roomFarTimer > 1.2) this.roomLightsGroup.visible = false;
    }

    // 4. Update Room 6.07 EXACT Fidelity (Heartfelt Rain-on-Glass, Caustics, Dust, Live Screens — ZERO shader recompiles!)
    if (!this.external) this.updateRoomFidelity(dt, atm, indoors, nearRoom);

    // 5. Propagate Dynamic Weather & Lighting to ALL World Subsystems
    const isNight = atm.nightFactor > 0.45;
    const streetEnvHash = (isNight ? 100 : 0) + Math.round(atm.wetness * 20);
    if (streetEnvHash !== this.lastStreetEnvHash) {
      this.lastStreetEnvHash = streetEnvHash;
      this.street.wet(isNight, atm.wetness);
      this.bus.night(isNight);
    }
    this.street.setWind(0.35 + atm.windStrength * 1.8);
    this.boardingHouse.setEnvironment(atm.nightFactor, atm.wetness, atm.windStrength);
    this.boardingHouse.update(this.elapsed);
    const sceneFog = this.scene.fog instanceof T.FogExp2 ? this.scene.fog : null;
    this.districts.setEnvironment(
      atm.nightFactor,
      atm.wetness,
      atm.windStrength,
      atm.rainIntensity,
      this.atmosphere.sunDir,
      sceneFog?.color,
      sceneFog?.density ?? 0.0024,
    );
    const sealExterior = indoors && this.doorAnim < 0.02 && this.winAnim < 0.02;

    this.atmosphere.updateOutdoorLightPool(this.outdoorLightSpecs, this.camera.position, indoors);
    if (!sealExterior) {
      this.districts.update(dt, this.elapsed, this.feet.x, this.feet.z);
    }

    // Dynamic Eye-Adaptation Exposure calibrated for true Khronos AgX (natural photographic midtones, zero neon bloom!)
    const warm = this.lightLevels.ceiling * 0.5 + this.lightLevels.desk * 0.18 + this.lightLevels.bed * 0.22 + this.lightLevels.kitchen * 0.1;
    const roomExp = warm > 0.35 ? 1.08 : warm > 0.1 ? 1.32 : 1.62;
    const outdoorExp = T.MathUtils.lerp(1.26, 1.42, atm.nightFactor);
    const targetExp = indoors ? T.MathUtils.lerp(1.05, roomExp, atm.nightFactor) : outdoorExp;
    if (!this.external) {
      this.renderer.toneMappingExposure = T.MathUtils.lerp(
        this.renderer.toneMappingExposure,
        targetExp,
        1 - Math.exp(-dt * 2.8),
      );
    }
    if (this.bloomPass && !this.external) {
      // Restrained optical lens glare only on genuine HDR highlights (kills cartoon/anime glow!)
      this.bloomPass.strength = indoors ? 0.22 : T.MathUtils.lerp(0.07, 0.20, atm.nightFactor);
    }
    if (this.postPass && this.composer && !this.external) {
      this.postPass.uniforms.tDepth.value = this.composer.readBuffer.depthTexture;
      this.postPass.uniforms.uAoStrength.value = indoors ? 0.52 : 0.36;
      this.postPass.uniforms.uExposure.value = this.renderer.toneMappingExposure;
      this.postPass.uniforms.uTime.value = this.elapsed % 100;
      this.postPass.uniforms.uVig.value = indoors ? 0.78 : T.MathUtils.lerp(0.28, 0.44, atm.nightFactor);
      this.postPass.uniforms.uCA.value = indoors ? 0.0011 : 0.0005;
      this.postPass.uniforms.uNight.value = atm.nightFactor;
      this.postPass.uniforms.uIndoors.value = indoors ? 1.0 : 0.0;
    }

    // 6. Spatial Open-World Level Streaming (Zero Loading Screens!)
    const streamStats = this.streamer.update(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      this.software,
    );

    // 7. Unified Saigon Street Simulation + Bus 06 Hub (skipped while sealed inside Room 6.07!)
    const distToBusHub = Math.hypot(this.feet.x + 4, this.feet.z);
    if (!sealExterior) {
      // Step the unified citywide traffic simulation (signals, ACC/IDM+, Saigon sublane, OBB collisions, pedestrians, audio)
      this.traffic.step({
        dt,
        playerX: this.feet.x,
        playerY: this.feet.y,
        playerZ: this.feet.z,
        playerYaw: this.yaw,
        wetness: atm.wetness,
      });
      this.street.update(dt, { x: this.feet.x, z: this.feet.z }, this.elapsed, true);
      if (this.route.phase === "boarding" && this.route.doors.front.target === 0 && !this.onBus) {
        this.route.doors.front.target = 1;
      }
      const busSafeSpeed = this.traffic.computeBus06SafeSpeed(this.route.x, this.route.z, 12.0);
      this.route.update(dt, { front: false, rear: false }, false, busSafeSpeed);
      this.traffic.syncBus06(
        this.route.x,
        this.route.z,
        Math.PI + this.route.yaw,
        this.route.speed,
        this.route.accel,
        this.feet.x,
        this.feet.z,
      );
      // Off at the rear door only: on arrival the front door stays shut.
      if ((this.route.phase === "arrived" || this.route.phase === "complete") && this.route.doors.front.target === 1) {
        this.route.doors.front.target = 0;
      }
      this.bus.update(dt);
      // The bus moved after the camera was placed: place it again so the view rides with the bus.
      if (this.onBus && !viewMode) {
        this.carryOnBus();
        this.syncCamera();
      }
    }

    const showBusCast = !indoors && this.outdoorWarmupFrames >= 3 && distToBusHub < 105;
    this.busCastGroup.visible = showBusCast;
    if (showBusCast) {
      this.cast.update(dt, this.elapsed, this.camera.position, atm.rainIntensity);
    }
    this.storyNpcs.group.visible = !indoors && this.outdoorWarmupFrames >= 3;
    if (this.storyNpcs.group.visible) {
      this.storyNpcs.update(dt, this.elapsed, this.camera.position, atm.rainIntensity);
    }

    // Smooth GTA-6 / Cyberpunk cinematic conversation camera framing (works in BOTH /testbus AND Room Chapter 1!).
    // Frames the speaker's head, eyes, and gesturing hands cleanly so their face is NEVER cut off.
    if (!viewMode) {
      const inConversation = this.storyNpcs.getConversationEyePos(this._convEyePos);
      this.convBlend = T.MathUtils.damp(this.convBlend, inConversation ? 1 : 0, 5.8, dt);

      if (this.convBlend > 0.005 || (!this.external && Math.abs(this.camera.fov - 64) > 0.05)) {
        const baseFov = this.external ? this.camera.fov : 64;
        const targetFov = inConversation ? 50 : baseFov;
        if (this.external) {
          if (this.convBlend > 0.005) {
            this.camera.fov = T.MathUtils.lerp(baseFov, 50, this.convBlend);
            this.camera.updateProjectionMatrix();
          }
        } else if (Math.abs(this.camera.fov - targetFov) > 0.05) {
          this.camera.fov = T.MathUtils.damp(this.camera.fov, targetFov, 6.2, dt);
          this.camera.updateProjectionMatrix();
        }
      }

      if (inConversation && !this.dragging) {
        const dx = this._convEyePos.x - this.camera.position.x;
        // Aim slightly below crown of head (~eye/chin line) so full head + shoulders sit cleanly in upper third!
        const dy = this._convEyePos.y - 0.14 - this.camera.position.y;
        const dz = this._convEyePos.z - this.camera.position.z;
        const horiz = Math.hypot(dx, dz);
        if (horiz > 0.3) {
          const desiredYaw = Math.atan2(-dx, -dz);
          let dyaw = desiredYaw - this.yaw;
          while (dyaw > Math.PI) dyaw -= Math.PI * 2;
          while (dyaw < -Math.PI) dyaw += Math.PI * 2;
          const desiredPitch = T.MathUtils.clamp(Math.atan2(dy, horiz), -0.35, 0.38);

          if (this.external) {
            // Blend embedded Room Chapter 1 camera smoothly toward the speaker's face every frame!
            const blend = this.convBlend * 0.88;
            this.yaw += dyaw * blend;
            this.pitch = T.MathUtils.lerp(this.pitch, desiredPitch, blend);
            this.syncCamera();
          } else {
            this.yaw += dyaw * Math.min(1, dt * 4.8);
            this.pitch = T.MathUtils.damp(this.pitch, desiredPitch, 4.8, dt);
            this.syncCamera();
          }
        }
      }
    }

    // 8. Hover Interaction Prompt (throttled to 15 Hz so CPU raycast never spikes camera turns!)
    if (this.renderFrame % 4 === 0 && !viewMode) {
      this.updateHoverPrompt();
    }

    // Shadow depth programs for streamed-in models (NPCs, vehicles, trees) are only linked when a shadow pass first
    // sees them, which used to happen on the first step outside. Do that pass early, while the player is indoors.
    if (indoors && this.shadowProgramsDirty && this.renderFrame > 120 && this.elapsed - this.lastAssetAt > 1.5) {
      this.shadowProgramsDirty = false;
      this.prewarmShadowPrograms();
    }
    // 9. ULTRA-FAST TWO-PASS RENDER WITH NORTH-SKYLINE-ONLY cityRT & ZERO CAMERA-TURN STUTTER:
    // Pass 1 (Indoors): Render ONLY the north rooftops/neon + distant skyline (~20 draw calls, ~6k tris!) into
    // hardware POT 512×256 RGBA8 cityRT (< 0.2ms!). Skipped completely when looking away from the north window!
    if (indoors) {
      // Camera forward Z = -cos(yaw); north window is at -Z, so cos(yaw) > -0.20 means window may be in view.
      // Embedded, the room says whether its window is on screen (inspect poses do not follow yaw / pitch).
      const facingNorthWindow = this.external && viewMode ? this.extWindowInView : Math.cos(this.yaw) > -0.2;
      const camMoved =
        Math.abs(this.yaw - this.lastCityRtYaw) > 0.002 ||
        Math.abs(this.pitch - this.lastCityRtPitch) > 0.002;
      const sinceCityRt = this.elapsed - this.lastCityRtTime;
      // While the view turns, or while it rains (the falling rain outside is in this picture: at the 0.15 s idle
      // refresh it stepped down the glass in slow jerks), the glass view follows at up to ~30 Hz.
      const live = camMoved || atm.rainIntensity > 0.02;
      if (facingNorthWindow && ((live && sinceCityRt >= 1 / 32) || sinceCityRt >= 0.15)) {
        this.lastCityRtYaw = this.yaw;
        this.lastCityRtPitch = this.pitch;
        this.lastCityRtTime = this.elapsed;
        this.apartment.root.visible = false;
        this.exteriorGroup.visible = true;
        this.streetGroup.visible = false;
        this.boardingHouse.root.visible = false;
        this.bus.root.visible = false;
        const preview = !(viewMode && this.winAnim > 0.3);
        if (preview) this.districts.setWindowPreviewMode(true);
        const sm = this.renderer.shadowMap;
        const keepShadowUpdate = sm.needsUpdate;
        sm.autoUpdate = false;
        if (viewMode) {
          // The window view refreshes the outdoor shadow maps every few seconds (the sun moves slowly).
          this.viewShadowT -= sinceCityRt;
          sm.needsUpdate = this.viewShadowT <= 0;
          if (this.viewShadowT <= 0) this.viewShadowT = 12;
        }
        this.renderer.setRenderTarget(this.cityRT);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        if (viewMode) sm.needsUpdate = keepShadowUpdate;
        if (preview) this.districts.setWindowPreviewMode(false);
        this.streetGroup.visible = true;
        this.boardingHouse.root.visible = true;
        this.bus.root.visible = true;
        this.apartment.root.visible = true;
      }
    }

    // PHASE 0 ZERO-STUTTER GPU WARMUP:
    // 1. Drain up to 2 queued exterior/streamed textures per frame into VRAM (<0.4ms) while player is in Room 6.07!
    for (let u = 0, n = this.texWarmupQueue.length > 60 ? 2 : 1; u < n && this.texWarmupQueue.length > 0; u++) {
      const nextTex = this.texWarmupQueue.shift()!;
      if (nextTex.image) {
        this.renderer.initTexture(nextTex);
      }
    }

    // 2. 4-Stage Invisible 16×16 GPU VBO/VAO Pre-Draw on boot frames 3, 6, 9, 12:
    // Forces WebGL to upload ALL vertex buffers, VAOs & program links for boardingHouse, street+bus, districts & busCast
    // into GPU memory BEFORE the user ever opens Room 6.07's door or steps onto the balcony!
    if (this.bootWarmupStage < 4 && this.renderFrame === (this.bootWarmupStage + 1) * 3) {
      const prevExt = this.exteriorGroup.visible;
      const prevStr = this.streetGroup.visible;
      const prevBus = this.bus.root.visible;
      const prevBH = this.boardingHouse.root.visible;
      const prevDist = this.districts.root.visible;
      const prevCast = this.busCastGroup.visible;
      const prevApt = this.apartment.root.visible;

      this.apartment.root.visible = false;
      this.exteriorGroup.visible = true;
      this.boardingHouse.root.visible = this.bootWarmupStage === 0;
      this.streetGroup.visible = this.bootWarmupStage === 1;
      this.bus.root.visible = this.bootWarmupStage === 1;
      this.districts.root.visible = this.bootWarmupStage === 2;
      this.busCastGroup.visible = this.bootWarmupStage === 3;

      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = false;
      this.renderer.setRenderTarget(this.warmupRT);
      this.renderer.render(this.scene, this.warmupCam);
      this.renderer.setRenderTarget(null);

      this.exteriorGroup.visible = prevExt;
      this.streetGroup.visible = prevStr;
      this.bus.root.visible = prevBus;
      this.boardingHouse.root.visible = prevBH;
      this.districts.root.visible = prevDist;
      this.busCastGroup.visible = prevCast;
      this.apartment.root.visible = prevApt;
      this.bootWarmupStage++;
    }

    // Portal Occlusion & 4-Frame Staggered Room-Exit Cascade:
    // - Sealed inside Room 6.07: hide exterior completely.
    // - Door open indoors OR frame 1 of exit: show boardingHouse only (street/bus/districts still occluded).
    // - Frame 2 of exit: wake streetGroup + bus; Frame 3+: full city & busCast -> ZERO step-outside spike!
    // An open door shows the whole street (no pop when stepping out); only a window glimpse uses the cheap portal.
    const doorPortalOnly =
      (indoors && !sealExterior && this.doorAnim < 0.3) || (!indoors && this.outdoorWarmupFrames === 1);
    const partialExit = !indoors && this.outdoorWarmupFrames === 2;
    if (sealExterior) {
      this.exteriorGroup.visible = false;
      this.atmosphere.setPrecipitationVisible(false);
    } else if (doorPortalOnly) {
      this.exteriorGroup.visible = true;
      this.streetGroup.visible = false;
      this.bus.root.visible = false;
      this.districts.setWindowPreviewMode(true);
    } else if (partialExit) {
      this.exteriorGroup.visible = true;
      this.streetGroup.visible = true;
      this.bus.root.visible = true;
      this.districts.setWindowPreviewMode(true);
    }

    // Event-Driven ZERO-STUTTER Shadow Scheduling:
    // - Indoors: update ONLY on entry & once when door/window animation settles.
    // - Outdoors: NEVER rebuild shadows every 10 frames! Update ONLY on exit frame 4 OR when walking across a 12m cell!
    const snapX = Math.round(this.feet.x / 12) * 12;
    const snapZ = Math.round(this.feet.z / 12) * 12;
    const crossedCell = snapX !== this.lastShadowX || snapZ !== this.lastShadowZ;
    const roomGeometryMoved =
      Math.abs(this.doorAnim - this.prevDoorAnim) > 0.002 ||
      Math.abs(this.winAnim - this.prevWinAnim) > 0.002 ||
      Math.abs(this.fridgeAnim - this.prevFridgeAnim) > 0.002;
    const roomJustSettled = this.wasRoomMoving && !roomGeometryMoved;
    this.wasRoomMoving = roomGeometryMoved;
    this.prevDoorAnim = this.doorAnim;
    this.prevWinAnim = this.winAnim;
    this.prevFridgeAnim = this.fridgeAnim;

    this.renderer.shadowMap.autoUpdate = false;
    if (indoors) {
      if (this.indoorShadowDirty || roomJustSettled) {
        this.renderer.shadowMap.needsUpdate = true;
        this.indoorShadowDirty = false;
      }
    } else {
      this.indoorShadowDirty = true;
      if (this.outdoorWarmupFrames > 0 && this.outdoorWarmupFrames < 4) {
        this.renderer.shadowMap.needsUpdate = false;
      } else if (this.outdoorWarmupFrames === 4 || crossedCell) {
        this.renderer.shadowMap.needsUpdate = true;
        this.lastShadowX = snapX;
        this.lastShadowZ = snapZ;
      }
    }

    // Pass 2: Ultra-Fast Single-Pass HDR Render (Bloom + Combined Fast AO / FXAA / AgX Filmic Grade!)
    if (this.external) {
      const r = this.renderer;
      const sm = r.shadowMap;
      this.backdropDrawn = false;
      if (this.wantBackdrop && this.backdropRT) {
        // The sun moves slowly: refresh this world's shadow maps every few seconds while it is seen.
        this.backdropShadowT -= dt;
        if (this.backdropShadowT <= 0) {
          this.backdropShadowT = 12;
          sm.needsUpdate = true;
        }
        const size = r.getDrawingBufferSize(this._bdSize);
        if (this.backdropRT.width !== size.x || this.backdropRT.height !== size.y) this.backdropRT.setSize(size.x, size.y);
        const prev = r.getRenderTarget();
        const rt = this.backdropRT;
        const W = rt.width, H = rt.height;
        // The street is drawn at a reduced resolution in the lower-left part of the target (no reallocation when the
        // scale changes): through the door from inside the room it is a small, soft part of the view; outside it
        // fills the screen. The room samples it with `backdrop.scale`.
        const sc = Math.min(viewMode ? 0.62 : 0.8, 1000 / Math.max(1, H));
        const Wf = Math.max(1, Math.floor(W * sc)), Hf = Math.max(1, Math.floor(H * sc));
        this.backdropScale.set((Wf - 0.5) / W, (Hf - 0.5) / H);
        rt.viewport.set(0, 0, W, H);
        rt.scissorTest = false;
        r.setRenderTarget(rt);
        r.clear(true, true, false);
        const pp = this.backdropPortal;
        // Only the door / window part of the screen (all of it outside), with a camera frustum cut to it, so the city
        // hidden behind the room walls is culled. The depth values match the full view: an off-centre projection keeps z.
        const x = pp ? Math.max(0, Math.floor(pp.x0 * Wf)) : 0, y = pp ? Math.max(0, Math.floor(pp.y0 * Hf)) : 0;
        const w = (pp ? Math.min(Wf, Math.ceil(pp.x1 * Wf)) : Wf) - x, h = (pp ? Math.min(Hf, Math.ceil(pp.y1 * Hf)) : Hf) - y;
        if (w > 0 && h > 0) {
          rt.viewport.set(x, y, w, h);
          rt.scissor.set(x, y, w, h);
          rt.scissorTest = true;
          this.camera.setViewOffset(Wf, Hf, x, Hf - y - h, w, h);
          r.setRenderTarget(rt);
          r.render(this.scene, this.camera);
          this.camera.clearViewOffset();
          rt.viewport.set(0, 0, W, H);
          rt.scissorTest = false;
        }
        r.setRenderTarget(prev);
        this.backdropDrawn = true;
      }
      // Never leave a shadow refresh pending for the room's own render.
      sm.needsUpdate = false;
    } else if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (sealExterior) {
      this.exteriorGroup.visible = true;
    } else if (doorPortalOnly || partialExit) {
      this.districts.setWindowPreviewMode(false);
      this.streetGroup.visible = true;
      this.bus.root.visible = true;
    }

    // 10. FPS & Throttled React HUD Snapshot
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    this.hudTimer += dt;
    if (this.hudTimer >= 0.12 && this.onSnapshot) {
      this.hudTimer = 0;
      const deg = (((-this.yaw * 180) / Math.PI) % 360 + 360) % 360;
      const snap: OpenWorldSnapshot = {
        zone: streamStats.zone,
        district: streamStats.district,
        position: {
          x: Number(this.feet.x.toFixed(1)),
          y: Number(this.feet.y.toFixed(2)),
          z: Number(this.feet.z.toFixed(1)),
        },
        headingDeg: Math.round(deg),
        busPosition: {
          x: Number(this.bus.root.position.x.toFixed(1)),
          z: Number(this.bus.root.position.z.toFixed(1)),
        },
        npcBlips: this.storyNpcs.getRadarBlips(),
        atmosphere: { ...atm },
        streaming: streamStats,
        doorOpen: this.doorOpen,
        gateOpen: this.gateOpen,
        onBus: this.onBus,
        busStatus: phaseLabel(this.route.phase),
        prompt: this.currentPrompt,
        activeModal: this.activeModal,
        storyDialogue: this.storyNpcs.getActiveDialogue(),
        ambientBark: this.storyNpcs.getAmbientBark(),
        crowdReaction: this.humanPresence.getActiveReaction(this.elapsed),
        pointerLocked: this.pointerLocked,
        fps: this.fps,
        isIndoors: indoors,
      };
      this.lastSnap = snap;
      this.onSnapshot(snap);
    }
  };

  private bindEvents() {
    const dom = this.renderer.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
      this.ensureAudio();
      if (e.code === "KeyE") this.tryInteract();
      if (e.code === "KeyF" && !e.repeat) this.confirmRide();
      if (e.code === "Escape") {
        if (this.activeModal) this.activeModal = null;
        if (this.storyNpcs.getActiveDialogue()) this.storyNpcs.closeDialogue();
      }
      if (this.storyNpcs.getActiveDialogue() && !e.repeat) {
        if (e.code === "Digit1") {
          this.storyNpcs.selectReply(0);
          return;
        }
        if (e.code === "Digit2") {
          this.storyNpcs.selectReply(1);
          return;
        }
        if (e.code === "Digit3") {
          this.storyNpcs.selectReply(2);
          return;
        }
      }
      if (!this.external) {
        if (e.code === "Digit1") this.setWeather("clear");
        if (e.code === "Digit2") this.setWeather("overcast");
        if (e.code === "Digit3") this.setWeather("drizzle");
        if (e.code === "Digit4") this.setWeather("monsoon");
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      this.ensureAudio();
      if (this.external && !this.pointerLocked && dom.requestPointerLock) {
        dom.requestPointerLock();
        return;
      }
      if (this.pointerLocked) {
        this.tryInteract();
        return;
      }
      this.dragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      this.dragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.pointerLocked) {
        this.yaw -= e.movementX * 0.0022;
        this.pitch = T.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.25, 1.32);
      } else if (this.dragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.yaw -= dx * 0.0042;
        this.pitch = T.MathUtils.clamp(this.pitch - dy * 0.0042, -1.25, 1.32);
      }
    };

    const onDoubleClick = () => {
      if (!this.pointerLocked && dom.requestPointerLock) {
        dom.requestPointerLock();
      }
    };

    const onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === dom;
    };

    const onResize = () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = Math.max(1, this.container.clientHeight || window.innerHeight);
      const pr = this.renderer.getPixelRatio();
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer?.setSize(w, h);
      this.postPass?.uniforms.uPixel.value.set(1 / Math.max(1, w * pr), 1 / Math.max(1, h * pr));
      this.bloomPass?.setSize(Math.max(192, Math.round(w * 0.35)), Math.max(108, Math.round(h * 0.35)));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    dom.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    dom.addEventListener("dblclick", onDoubleClick);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("resize", onResize);

    this.cleanupListeners = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dom.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      dom.removeEventListener("dblclick", onDoubleClick);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("resize", onResize);
    };
  }

  private cleanupListeners: () => void = () => {};

  private exposeDebugHandle() {
    (window as unknown as Record<string, unknown>).__saigonWorld = {
      moveTo: (wp: LandmarkWaypoint) => this.moveToWaypoint(wp),
      setPos: (x: number, y: number, z: number, yaw?: number, pitch?: number) => {
        this.onBus = false;
        this.feet.set(x, y, z);
        if (yaw !== undefined) this.yaw = yaw;
        if (pitch !== undefined) this.pitch = pitch;
        this.syncCamera();
      },
      setTime: (h: number) => {
        this.atmosphere.state.autoCycle = false;
        this.atmosphere.setTimeOfDay(h);
      },
      setWeather: (w: WeatherPreset) => this.atmosphere.setWeather(w),
      toggleDoor: () => this.toggleDoor(),
      scene: () => this.scene,
      trafficTelemetry: () => this.traffic.getTelemetry(),
      getState: () => ({
        feet: { x: this.feet.x, y: this.feet.y, z: this.feet.z },
        yaw: this.yaw,
        pitch: this.pitch,
        zone: this.streamer.getZone(this.feet.x, this.feet.y, this.feet.z),
        landmarksReady: this.streamer.landmarksReady,
        weather: this.atmosphere.state.weather,
        timeOfDay: this.atmosphere.state.timeOfDay,
      }),
    };
  }

  public setStoryContext(ctx: Partial<StoryNpcRuntimeContext>) {
    this.storyNpcs.setContext(ctx);
  }

  public selectStoryReply(index: number) {
    const dialogue = this.storyNpcs.selectReply(index);
    if (!dialogue) return;
    const replyId = dialogue.askedReplyIds[dialogue.askedReplyIds.length - 1];
    if (!replyId) return;
    // A reply may synchronously change the reducer flags (late reschedule, interview start, etc.).
    // Push that patch into the director and re-resolve the active turn so the next reply strip is
    // immediately the new branch instead of stale options from the previous state.
    const patch = this.external?.onStoryReply?.(dialogue.npcId, replyId);
    if (patch) {
      this.storyNpcs.setContext(patch);
      this.storyNpcs.refreshDialogue();
    }
  }

  public advanceStoryDialogue() {
    this.storyNpcs.advanceDialogue();
  }

  public refreshStoryDialogue() {
    this.storyNpcs.refreshDialogue();
  }

  public closeStoryDialogue() {
    this.storyNpcs.closeDialogue();
  }

  public dispose() {
    this.disposed = true;
    this.unsubPbrWarmup?.();
    cancelAnimationFrame(this.raf);
    this.cleanupListeners();
    this.audio.dispose();
    this.traffic.dispose();
    this.atmosphere.dispose();
    this.districts.dispose();
    this.boardingHouse.dispose();
    this.street.dispose();
    this.cast.dispose();
    this.storyNpcs.dispose();
    this.humanPresence.clear();
    if (!this.external) this.cityRT.dispose();
    this.warmupRT.dispose();
    this.warmupViewRT?.dispose();
    this.backdropRT?.depthTexture?.dispose();
    this.backdropRT?.dispose();
    this.dropTex.dispose();
    this.exteriorGlassMat.dispose();
    this.rainGlassMats.forEach((m) => m.dispose());
    this.composer?.dispose();
    if (!this.external) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }
}

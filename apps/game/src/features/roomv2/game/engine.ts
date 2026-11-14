import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { buildApartment, ROOM, WIN, type Apartment } from './apartment';
import { buildCity } from './city';
import { createRainGlass } from './glass';
import { AudioEngine } from './audio';
import { clock, type PhoneMode } from './screens';
import { tr, trLines } from './strings';
import { CharacterArmsViewmodel } from '../../player/runtime/CharacterArmsViewmodel';
import { dropMaskCanvas, paintDropMask, canvas, toTex } from './textures';

export type Caption = { text: string; voice?: boolean; id: number };
export type UIAction = { key: string; label: string };
export interface UIState {
  prompt: string | null;
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

const CAPTION_COUNTS: Record<string, number> = {
  window: 2, laptop: 1, note: 1, receipts: 1, mug: 1, phone: 1, calendar: 1, photo: 1, fridge: 3, bed: 2, jacket: 1, umbrella: 1, door: 1,
};
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
const angDiff = (a: number, b: number) => THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;
const easeIO = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const TITLE_IDS = ['window', 'laptop', 'note', 'receipts', 'mug', 'phone', 'calendar', 'photo', 'fridge', 'bed'];
const titleOf = (id: string): string => (TITLE_IDS.includes(id) ? tr(`title.${id}`) : '');

export class Engine {
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

  ui: UIState = { prompt: null, focus: false, captions: [], inspecting: null, locked: false, fade: 1, ended: null, started: false, seated: false, cursorMode: false };
  onUI: (s: UIState) => void;

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

  inspect: null | { id: string; from: { pos: THREE.Vector3; q: THREE.Quaternion; fov: number }; to: Pose; t: number; dir: 1 | -1; capIdx: number } = null;
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

  story: 'calm' | 'presilence' | 'ringing' | 'call' | 'declined' | 'missed' | 'done' = 'calm';
  storyT = 0;
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
  /** Last value of `shadowSignature()`; the shadow maps are redrawn only when it changes. */
  shadowSig = Number.NaN;
  shadowFrames = 0;

  constructor(container: HTMLElement, onUI: (s: UIState) => void, quality: 'high' | 'low') {
    this.container = container;
    this.onUI = onUI;
    this.quality = quality;
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
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
    this.raf = requestAnimationFrame(this.loop);
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
    });
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
    if (!this.ui.locked) return;
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
  onKeyDown = (e: KeyboardEvent) => {
    if (this.ui.started && !this.ui.ended && (e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight')) {
      if (!e.repeat) this.setCursorMode(!this.ui.cursorMode);
      return;
    }
    this.keys.add(e.code);
    if (!this.ui.started) return;
    if (e.code === 'KeyE') { if (this.inspect && this.inspect.dir === 1) this.endInspect(); else this.interact(); }
    if (e.code === 'KeyQ' || e.code === 'Backspace') { if (this.inspect) this.endInspect(); else if (this.seat === 'seated') this.standUp(); }
    if (e.code === 'KeyF') this.inspectAction('F');
    if (e.code === 'KeyR') this.inspectAction('R');
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  onMouseDown = (e: MouseEvent) => {
    if (!this.ui.started) return;
    if (!this.ui.locked && !this.ui.cursorMode) { this.lock(); return; }
    if (e.button === 0) { if (this.inspect && this.inspect.dir === 1) { /* click = primary action if any */ if (!this.inspectAction('F')) this.endInspect(); } else this.interact(); }
    if (e.button === 2) { if (this.inspect) this.endInspect(); else if (this.seat === 'seated') this.standUp(); }
  };
  onLockChange = () => {
    this.ui.locked = document.pointerLockElement === this.renderer.domElement;
    if (this.ui.locked) this.ui.cursorMode = false;
    this.emit();
  };
  onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
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
    this.later(2.2, () => this.say(tr('say.arrive')));
    this.later(9, () => { if (!this.lights.ceiling && !this.lights.bed && !this.lights.desk) this.say(tr('say.dark')); });
    this.emit();
  }

  later(sec: number, fn: () => void) { this.timeouts.push(window.setTimeout(() => { if (!this.disposed) fn(); }, sec * 1000)); }

  say(text: string, voice = false, dur?: number) {
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
    const ring = this.story === 'ringing';
    switch (id) {
      case 'switch': return this.lights.ceiling ? tr('label.ceilingOff') : tr('label.ceilingOn');
      case 'desklamp': return this.lights.desk ? tr('label.deskOff') : tr('label.deskOn');
      case 'bedlamp': return this.lights.bed ? tr('label.bedOff') : tr('label.bedOn');
      case 'kitchenlight': return this.lights.kitchen ? tr('label.kitchenOff') : tr('label.kitchenOn');
      case 'window': return tr('label.window');
      case 'laptop': return this.seat === 'seated' ? tr('label.laptopLook') : tr('label.laptopSit');
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
      case 'door': return tr('label.door');
    }
    return null;
  }

  interact() {
    const id = this.hovered;
    if (!id || this.inspect || this.seat === 'sitting' || this.seat === 'standing') return;
    this.markUsed(id);
    this.reachWithHand(id);
    switch (id) {
      case 'laptop': if (this.seat === 'seated') this.startInspect('laptop'); else this.startSit(); return;
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
    return L.ceiling + L.desk * 2.1 + L.bed * 3.3 + L.kitchen * 4.7 + this.fridgeAng * 5.9 + this.sashX * 7.1
      + chair.position.x * 11.3 + chair.position.z * 13.7 + chair.rotation.y * 17.9;
  }

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
    const to = POSES[id];
    this.inspect = { id, from: { pos: this.camera.position.clone(), q: this.camera.quaternion.clone(), fov: this.camera.fov }, to, t: 0, dir: 1, capIdx: 0 };
    this.lookOffset.set(0, 0);
    // Picking it up is enough; the "look at your hand" inspect clip covered the phone (owner).
    if (HAND_INSPECT.has(id)) this.arms.triggerInteract();
    if (id === 'laptop') { this.laptopWoken = true; this.audio.setFan(true); }
    if (id === 'phone' && this.story === 'calm') { this.phoneMode = 'lock'; this.phoneLockUntil = Infinity; }
    if (id === 'note' || id === 'receipts') this.audio.paper('desk');
    if (id === 'bed') this.audio.bedRustle();
    const lines = this.inspectLines(id);
    lines.forEach((l, i) => this.later(0.9 + i * 4.2, () => { if (this.inspect?.id === id && this.inspect.dir === 1) this.say(l); }));
    this.ui.inspecting = { title: titleOf(id), actions: this.actionsFor(id) };
    this.emit();
  }

  inspectLines(id: string): string[] {
    if (id === 'phone') {
      if (this.story === 'ringing') return [];
      if (this.story === 'declined' || this.story === 'missed' || this.story === 'done') return this.ui.ended === 'answered' ? trLines('inspect.phoneEndedAnswered', 1) : trLines('inspect.phoneEndedDeclined', 1);
    }
    if (id === 'window' && this.windowOpen) return trLines('inspect.windowOpen', 1);
    return captionLines(id);
  }

  actionsFor(id: string): UIAction[] {
    const back = { key: 'Q', label: tr('action.back') };
    if (id === 'window') return [{ key: 'F', label: this.windowOpen ? tr('action.windowClose') : tr('action.windowOpen') }, back];
    if (id === 'mug') return [{ key: 'F', label: tr('action.drink') }, back];
    if (id === 'laptop') return [{ key: 'F', label: tr('action.type') }, { key: 'Q', label: tr('action.sitUp') }];
    if (id === 'fridge') return [{ key: 'F', label: this.fridgeOpen ? tr('action.fridgeShut') : tr('action.fridgeUnlatch') }, { key: 'Q', label: tr('action.back') }];
    if (id === 'phone' && this.story === 'ringing') return [{ key: 'F', label: tr('action.answer') }, { key: 'R', label: tr('action.decline') }];
    return [back];
  }

  inspectAction(key: string): boolean {
    if (!this.inspect || this.inspect.dir !== 1 || this.inspect.t < 0.6) return false;
    const id = this.inspect.id;
    if (id === 'window' && key === 'F') {
      this.windowOpen = !this.windowOpen;
      this.audio.windowSlide(this.windowOpen);
      if (this.windowOpen) this.later(1.0, () => this.say(tr('say.windowAir')));
      this.ui.inspecting = { title: titleOf(id), actions: this.actionsFor(id) }; this.emit();
      return true;
    }
    if (id === 'laptop' && key === 'F') {
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

  endInspect() {
    if (!this.inspect) return;
    const id = this.inspect.id;
    if (this.story === 'ringing' && id === 'phone') return; // must decide
    this.inspect.dir = -1;
    this.inspect.from = { pos: this.camera.position.clone(), q: this.camera.quaternion.clone(), fov: this.camera.fov };
    this.inspect.t = 0;
    if (id === 'phone' && this.story === 'calm') this.phoneLockUntil = this.t + 4;
    if (id === 'bed') this.audio.bedRustle();
    this.ui.inspecting = null;
    this.emit();
  }

  /* =================== STORY: the phone =================== */
  updateStory(dt: number) {
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
    this.ui.seated = true; this.ui.prompt = null; this.ui.focus = false; this.emit();
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
    if (this.inspect || this.seat !== 'none') { this.vel.set(0, 0, 0); return; }
    const f = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const s = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = (run ? 2.0 : 1.25) * (this.ui.locked || this.ui.cursorMode ? 1 : 0);
    const fwd = V(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = V(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const want = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed);
    this.vel.lerp(want, 1 - Math.exp(-dt * 7));
    const next = this.pos.clone().addScaledVector(this.vel, dt);
    const R = 0.24;
    next.x = THREE.MathUtils.clamp(next.x, ROOM.x0 + R, ROOM.x1 - R);
    next.z = THREE.MathUtils.clamp(next.z, ROOM.z0 + R, ROOM.z1 - R);
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
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > 0.05) {
      this.bobPhase += dt * sp * 5.2;
      const sign = Math.sign(Math.sin(this.bobPhase));
      if (sign !== this.lastStepSign && sign !== 0) { this.lastStepSign = sign; this.audio.started && this.audio.footstep(Math.min(1, sp / 1.3)); }
    }
  }

  updateCamera(dt: number) {
    const cam = this.camera;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const breathe = Math.sin(this.t * 1.1) * 0.004;
    const bob = Math.abs(Math.sin(this.bobPhase)) * 0.018 * Math.min(1, sp / 1.2);
    const sway = Math.sin(this.bobPhase) * 0.004 * Math.min(1, sp / 1.2);
    const walkPos = V(this.pos.x, this.pos.y + breathe + bob - 0.009, this.pos.z);
    const walkQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch + Math.sin(this.t * 0.7) * 0.003, this.yaw + sway * 0.5, Math.sin(this.bobPhase * 0.5) * 0.003, 'YXZ'));
    if (this.inspect) {
      const ins = this.inspect;
      ins.t = Math.min(1, ins.t + dt / (ins.dir === 1 ? 1.15 : 0.9));
      const k = ins.t < 0.5 ? 4 * ins.t ** 3 : 1 - (-2 * ins.t + 2) ** 3 / 2;
      let toPos: THREE.Vector3, toQ: THREE.Quaternion, toFov: number;
      if (ins.dir === 1) {
        toPos = ins.to.pos.clone().add(V(0, Math.sin(this.t * 1.1) * 0.002, 0));
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
    } else {
      cam.position.copy(walkPos);
      cam.quaternion.copy(walkQ);
      if (cam.fov !== 68) { cam.fov = 68; cam.updateProjectionMatrix(); }
    }
    void dt;
  }

  updateHover() {
    if (this.inspect || !this.ui.started || this.seat === 'sitting' || this.seat === 'standing') { if (this.ui.prompt) { this.ui.prompt = null; this.ui.focus = false; this.emit(); } this.hovered = null; return; }
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 2.3;
    const hit = this.raycaster.intersectObjects(this.apt.hits, true)[0];
    let id: string | null = (hit?.object.userData.id as string) ?? null;
    if (id === 'chair' && this.seat !== 'none') id = null;
    if (id !== this.hovered || (id && this.label(id) !== this.ui.prompt)) {
      this.hovered = id;
      this.ui.prompt = id ? this.label(id) : null;
      this.ui.focus = !!id;
      this.emit();
    }
  }

  updateArms(dt: number) {
    // The viewmodel clones its meshes with shadows on; the static shadow maps must not redraw for the hands.
    if (!this.armsShadowOff && this.arms.loaded) {
      this.arms.group.traverse((o) => { o.castShadow = false; });
      this.armsShadowOff = true;
    }
    // Hands are stowed while seated or once the prologue has ended; they never sprint in this small room.
    this.arms.update(dt, false, false, this.seat !== 'none' || !!this.ui.ended || !this.ui.started);
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
    const time = clock({ h: 23, m: 8 }, el);
    // laptop
    if (this.laptopWoken) this.laptopAwake = Math.min(1, this.laptopAwake + dt * 1.8);
    a.laptopScreenMat.color.setScalar(1.0 * this.laptopAwake);
    a.lights.laptop.intensity = 0.07 * this.laptopAwake;
    a.emissives.powerLed.color.setScalar(this.laptopAwake > 0 ? 1.4 : 0.6 + Math.sin(this.t * 2) * 0.6);
    const awakeKey = this.laptopAwake > 0 ? 1 : 0;
    if ((this.laptopAwake > 0 && this.laptopAwake < 1) || time !== this.lastClock || this.typed !== this.lastTyped || awakeKey !== this.lastAwakeKey) {
      a.laptopScreen.draw(this.laptopAwake, time, typedText().slice(0, this.typed)); this.lastTyped = this.typed; this.lastAwakeKey = awakeKey;
    }
    // phone
    if (this.phoneMode === 'lock' && this.story === 'calm' && this.t > this.phoneLockUntil) this.phoneMode = 'aod';
    const ringing = this.phoneMode === 'ringing';
    const bright = this.phoneMode === 'aod' ? 0.55 : this.phoneMode === 'dark' ? 0 : 1.1;
    const pc = a.phoneScreenMat.color.r + (bright - a.phoneScreenMat.color.r) * Math.min(1, dt * 6);
    a.phoneScreenMat.color.setScalar(pc);
    a.lights.phone.intensity = (this.phoneMode === 'aod' ? 0.0 : ringing ? 0.22 + Math.sin(this.t * 6) * 0.06 : 0.14) * (pc / 1.1);
    if (this.t - this.lastPhoneDraw > (ringing || this.phoneMode === 'call' ? 0.06 : 0.5) || time !== this.lastClock) {
      a.phoneScreen.draw(this.phoneMode, time, this.t, this.callSec);
      this.lastPhoneDraw = this.t;
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
    if (!a.rightSash.userData.base) a.rightSash.userData.base = a.rightSash.position.x;
    a.rightSash.position.x = a.rightSash.userData.base + this.sashX;
    // curtain would breathe a little with the window open (via glass fog)
    this.glassMats.forEach((m) => { m.uniforms.uTime.value = this.t; m.uniforms.uFog.value = 0.55 - (this.windowOpen ? 0.25 : 0) * Math.min(1, el / 60); });
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
    const secs = 23 * 3600 + 8 * 60 + el;
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
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const tNow = now / 1000;
    const rawDt = Math.min(1, tNow - (this.t || tNow));
    const dt = Math.min(0.05, rawDt);
    this.t = tNow;

    if (this.ui.started) this.movePlayer(dt);
    this.updateSeat(rawDt > 0.05 ? 0.05 : dt);
    this.updateCamera(dt);
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
    fu.uFade.value += ((1 - this.ui.fade) * endDim - fu.uFade.value) * Math.min(1, dt * 3);
    fu.uTime.value = this.t % 100;
    const tension = this.story === 'ringing' || this.story === 'call' ? 1 : 0;
    fu.uVig.value += ((0.85 + tension * 0.35) - fu.uVig.value) * dt * 0.8;
    fu.uDesat.value += ((tension * 0.18) - fu.uDesat.value) * dt * 0.6;

    // pass 1: the city alone, for the glass to refract
    const r = this.renderer;
    this.glassMats.forEach((m) => m.uniforms.uRes.value.set(r.domElement.width, r.domElement.height));
    this.camera.layers.set(1);
    r.setRenderTarget(this.cityRT);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    this.camera.layers.set(0);
    this.camera.layers.enable(1);
    // pass 2: everything
    const sig = this.shadowSignature();
    if (sig !== this.shadowSig) { this.shadowSig = sig; this.shadowFrames = 2; }
    if (this.shadowFrames > 0) { this.shadowFrames--; r.shadowMap.needsUpdate = true; }
    this.composer.render(dt);
  }

  dispose() {
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

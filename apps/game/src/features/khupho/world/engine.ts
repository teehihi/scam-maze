import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Physics } from './physics';
import { Interactions } from './interact';
import { Player } from './player';
import { SkySys, makeEnvMap } from './sky';
import { AudioSys } from './audio';
import { buildNeighborhood } from './neighborhood';
import { buildLife, PERSON_GROUPS, type Life } from './people';
import { windUniform, setWet, setNightEmit, setAnisotropy } from './materials';
import type { Ctx, RoomLight } from './types';
import type { House } from './house';
import { clamp, mulberry32 } from './util';
import { tr } from './strings';
import { DistanceCuller } from './distanceCull';
import { probeDrawCategories, probeTimings } from './perfProbe';
import { buildShadowProxies } from './shadowProxy';
import { mergeDevices, mergeHouseShells, mergeRigidParts } from './staticMerge';
import { CharacterArmsViewmodel } from '../../player/runtime/CharacterArmsViewmodel';
import { CharacterAssetCache } from '../../player/runtime/CharacterAssetCache';
import { loadStreetProps, STORY_SPAWN, type PlacedProp } from './streetProps';

export interface Hud { time: string; hour: number; loc: string; prompt: string | null; indoor: boolean; fps: number; rain: number; sitting: string | null; tour: boolean; started: boolean; timeScale: number; muted: boolean; quality: string; weather: string; cursorMode: boolean }

/** Story-mode clock: the player explores from the afternoon until the rain starts and it is time to go home. */
export const STORY_CLOCK = { startHour: 16.6, rainHour: 17.7, callHomeHour: 18.4 } as const;
export type StoryEvent = 'rain' | 'callHome';
export interface EngineOptions {
  /** Start in the afternoon, advance the clock only while playing, and report the story events. */
  story?: boolean;
  onStory?: (event: StoryEvent) => void;
  /** Graphics quality to build, warm up and run at (default 'high'). Applied once, before the first frame. */
  quality?: EngineQuality;
}
export type EngineQuality = 'low' | 'med' | 'high';
/** Multisampling of the composer target per quality: MSAA only on high. */
const COMPOSER_SAMPLES: Record<EngineQuality, number> = { low: 0, med: 0, high: 4 };
/** Steps of `Engine.create`, in order (each one is a loading-screen line). */
export const BUILD_STEPS = ['world', 'life', 'optimize', 'props', 'hands', 'shaders', 'warmup'] as const;
export type BuildStep = (typeof BUILD_STEPS)[number];
export type BuildProgress = (step: BuildStep, fraction: number) => void;

/** Lets the browser paint (the loading screen) between two heavy build steps. */
const yieldFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
export class Engine {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  composer: EffectComposer | null = null; bloom: UnrealBloomPass | null = null; gtao: GTAOPass | null = null;
  phys = new Physics(); inter = new Interactions(); audio = new AudioSys();
  player: Player; sky: SkySys; ctx: Ctx; life: Life | null = null;
  houses: House[] = [];
  env = { hour: 17.2, night: 0, rain: 0, sun: 1 };
  rainTarget = 0; timeScale = 60; clock = new THREE.Clock();
  pool: THREE.PointLight[] = []; lampPool: THREE.PointLight[] = [];
  rain: THREE.LineSegments; rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOp: { value: 0 } };
  indoor = 0; openness = 0; started = false; running = false; quality = 'high';
  hud: Hud; onHud: (h: Hud) => void; hudT = 0; frames = 0; fpsT = 0; fps = 60; pickT = 0;
  current: ReturnType<Interactions['pick']> = null; loc = ''; wet = 0;
  vehicles: { pos: THREE.Vector3; speed: number }[] = [];
  dragging = false; moved = 0; locked = false; lostLock = false; swallowClick = false; lastTouch: { x: number; y: number } | null = null;
  private disposers: (() => void)[] = [];
  culler = new DistanceCuller(); private frameNo = 0;
  arms: CharacterArmsViewmodel;
  private armsShadowOff = false;
  /** Paused (pause menu open): the simulation and the input stop, the picture stays. */
  paused = false;
  /** Ctrl shows the cursor: everything keeps working except turning the camera; Ctrl again hides it. */
  cursorMode = false;
  /** Lightning: current flash level (0..1), time to the next strike, and the strike's flicker pattern. */
  private flash = 0; private nextStrike = 6; private strikeT = -1; private strikeDelay = 0;
  /** Input ignored (a story overlay is open) while the world keeps running. */
  inputBlocked = false;
  /** Adaptive resolution: pixel ratio limits for the current quality, and the frame-time window. */
  private prMax = 1.25; private prMin = 0.7; private pr = 1; private perfT = 0; private perfFrames = 0; private slowWins = 0; private fastWins = 0; private settleT = 3;
  private houseCenters: { h: House; x: number; z: number }[] = [];
  /** Reused per-frame buffers (no allocation in the frame loop). */
  private readonly lightCand: { rl: RoomLight; d: number }[] = [];
  private readonly lightCandPool: { rl: RoomLight; d: number }[] = [];
  private readonly lampOrder: THREE.Vector3[] = [];
  private lampSortT = 0;
  private readonly lampSortedAt = new THREE.Vector3(Infinity, 0, 0);
  private readonly freezeAt = new THREE.Vector3(Infinity, 0, 0);
  private lastHudKey = '';

  el: HTMLElement;
  opts: EngineOptions;
  /** Resolves when the street props are in the world (or failed to load). */
  propsReady: Promise<PlacedProp[]>;
  private storyRain = false; private storyCall = false;
  constructor(el: HTMLElement, onHud: (h: Hud) => void, opts: EngineOptions = {}) { this.el = el; this.opts = opts;
    this.onHud = onHud;
    const w = el.clientWidth || 1280, h = el.clientHeight || 720;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    // Anti-aliasing comes from the composer's multisampled target, so the canvas itself needs none, and
    // keeping the drawing buffer (the prototype's screenshot option) forces an extra copy every frame.
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The sun moves slowly, so its shadow map is redrawn every 4th frame (see frame()).
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    setAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.05, 2400);
    this.scene.add(this.camera);
    this.sky = new SkySys(this.scene, this.renderer);
    this.scene.environment = makeEnvMap(this.renderer);
    this.player = new Player(this.camera, this.phys);
    const eye = new THREE.Vector3();
    this.ctx = {
      root: new THREE.Group(), phys: this.phys, inter: this.inter, roomLights: [], dyn: [], env: this.env, eye, houses: this.houses,
      sfx: this.audio, player: { sit: (p, y, e, l) => { this.player.sit(p, y, e, l); } }, rand: mulberry32(7), lamps: [], walkers: [],
    };
    this.scene.add(this.ctx.root);
    this.propsReady = Promise.resolve([]);
    this.houses = this.ctx.houses;
    this.audio.start = this.audio.start.bind(this.audio);
    // First-person hands (shared viewmodel), on the camera like in the other worlds.
    this.arms = new CharacterArmsViewmodel(this.camera);
    if (opts.story) { this.env.hour = STORY_CLOCK.startHour; }
    // Rain streaks (built here because the type needs them before `build`).
    const N = 6000, pos = new Float32Array(N * 6), seed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random() * 40, y = Math.random() * 26, z = Math.random() * 40;
      const sd = Math.random(); pos.set([x, y, z, x, y, z], i * 6); seed.set([sd, sd], i * 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('sd', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: this.rainU, transparent: true, depthWrite: false,
      vertexShader: `uniform float uTime; uniform vec3 uCam; attribute float sd; varying float vA;
        void main(){ vec3 p = position; float sp = 16.0 + sd*5.0; float ty = mod(p.y - uTime*sp, 26.0);
          vec3 w; w.xz = uCam.xz + mod(p.xz - uCam.xz + 20.0, 40.0) - 20.0; w.y = ty - 0.5;
          vec3 q = w; q.y += (gl_VertexID % 2 == 0 ? 0.0 : -0.6); q.x += (gl_VertexID % 2 == 0 ? 0.0 : -0.06);
          vA = 0.55; gl_Position = projectionMatrix * viewMatrix * vec4(q,1.0); }`,
      fragmentShader: `uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(0.78,0.84,0.9, vA*uOp); }`,
    });
    this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 10; this.scene.add(this.rain);
    this.hud = { time: '', hour: this.env.hour, loc: '', prompt: null, indoor: false, fps: 60, rain: 0, sitting: null, tour: false, started: false, timeScale: this.timeScale, muted: false, quality: this.quality, weather: '', cursorMode: false };
  }

  /**
   * Builds the world in steps, yielding to the browser between them so a loading screen keeps
   * painting, then compiles every shader and draws warm-up frames so nothing is compiled or
   * uploaded the first time the player turns around. Resolves once frames are steady.
   */
  static async create(el: HTMLElement, onHud: (h: Hud) => void, opts: EngineOptions = {}, onProgress?: BuildProgress, isCancelled: () => boolean = () => false): Promise<Engine> {
    const report = (step: BuildStep, f = 0) => onProgress?.(step, f);
    const e = new Engine(el, onHud, opts);
    try {
      report('world'); await yieldFrame(); if (isCancelled()) return e;
      buildNeighborhood(e.ctx);
      if (opts.story) e.player.teleport(STORY_SPAWN.x, STORY_SPAWN.z, STORY_SPAWN.yaw);
      report('life'); await yieldFrame(); if (isCancelled()) return e;
      e.life = buildLife(e.ctx, e.houses, e.vehicles, e.audio);
      report('optimize'); await yieldFrame(); if (isCancelled()) return e;
      e.optimizeStatic();
      e.initLightsAndPost();
      report('props'); await yieldFrame(); if (isCancelled()) return e;
      e.propsReady = loadStreetProps(e.ctx).catch((err) => { console.warn('[khupho] street props failed to load', err); return [] as PlacedProp[]; });
      await e.propsReady;
      e.culler.collect(e.ctx.root, e.houses);
      report('hands'); if (isCancelled()) return e;
      await CharacterAssetCache.loadArmsModel().catch(() => undefined);
      report('shaders'); await yieldFrame(); if (isCancelled()) return e;
      await e.warmUp();
      report('warmup'); if (isCancelled()) return e;
      e.renderer.setAnimationLoop(() => e.frame());
      await e.waitForSteadyFrames(4000);
      report('warmup', 1);
    } catch (err) {
      e.dispose();
      throw err;
    }
    return e;
  }

  /** Merges static geometry and sets up shadow proxies and the culler (see staticMerge.ts). */
  private optimizeStatic() {
    for (const g of PERSON_GROUPS) mergeRigidParts(g);
    // Shadow proxies first: they read the shells' cast-shadow flag, then the shells are merged for drawing.
    buildShadowProxies(this.ctx.root);
    mergeHouseShells(this.houses, this.ctx.root);
    // After the shadow proxies, so merged device parts keep their own shadow flag and the culler's shadow reach.
    mergeDevices(this.houses);
    this.culler.collect(this.ctx.root, this.houses);
    this.houseCenters = this.houses.map((h) => { const c = h.wp(h.W / 2, 0, h.D / 2); return { h, x: c.x, z: c.z }; });
  }

  private initLightsAndPost() {
    // Point lights are pooled and re-positioned each frame; each light is a cost in every shader, so keep the pools small.
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffe0b0, 0, 9, 2); l.castShadow = false; this.scene.add(l); this.pool.push(l); }
    for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffd9a0, 0, 24, 2); this.scene.add(l); this.lampPool.push(l); }
    const w = this.el.clientWidth || 1280, h = this.el.clientHeight || 720;
    this.initComposer(w, h);
    this.player.onStep = (s, r) => this.audio.step(s === 'wood' ? 'wood' : s === 'tile' ? 'tile' : 'concrete', r);
    this.bind();
    // The requested quality from the start, so the build and the warm-up never run at 'high' for a medium/low player.
    this.applyQuality(this.opts.quality ?? 'high');
    this.update(0.016);
    // Dev-only handles for the browser console and automated checks; never set in production builds.
    if (import.meta.env.DEV) {
      (window as unknown as { __khuphoEngine?: Engine }).__khuphoEngine = this;
      const target = { scene: this.scene, camera: this.camera, renderer: this.renderer, root: this.ctx.root, houses: this.houses, update: (dt: number) => this.update(dt), renderFrame: () => this.renderOnly() };
      (window as unknown as { __khuphoProbe?: unknown }).__khuphoProbe = { draws: () => probeDrawCategories(target), timings: (n?: number) => probeTimings(target, n) };
    }
  }

  /** Compiles every material and uploads every mesh once, so turning the camera never stalls on it. */
  private async warmUp() {
    this.culler.reset();
    const toggled: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.frustumCulled) { o.frustumCulled = false; toggled.push(o); } });
    try { await this.renderer.compileAsync(this.scene, this.camera); } catch { /* compile on first draw instead */ }
    this.renderer.shadowMap.needsUpdate = true;
    this.renderOnly();
    toggled.forEach((o) => { o.frustumCulled = true; });
    this.culler.update(0, this.camera.position, true);
    this.renderOnly();
  }

  /** Resolves once 10 frames in a row took under 40 ms, or after `timeoutMs`. */
  private waitForSteadyFrames(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      let last = start, good = 0;
      const tick = () => {
        const now = performance.now();
        good = now - last < 40 ? good + 1 : 0;
        last = now;
        if (good >= 10 || now - start > timeoutMs || !this.renderer.getContext()) { resolve(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  initComposer(w: number, h: number) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: COMPOSER_SAMPLES[(this.opts.quality ?? 'high')] });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // ground-truth ambient occlusion from depth+normals: contact darkening under furniture, in corners, under eaves
    this.gtao = new GTAOPass(this.scene, this.camera, w, h);
    this.gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.0, scale: 1.0, samples: 8, distanceFallOff: 1.0, screenSpaceRadius: false });
    this.gtao.blendIntensity = 0.85;
    this.composer.addPass(this.gtao);
    // sanitise HDR before bloom: one NaN/Inf texel (mirror-like wet surface under a lamp) would smear into a black block through the blur mips
    this.composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 v = c.rgb;
          if (any(isnan(v)) || any(isinf(v))) v = vec3(0.0);
          gl_FragColor = vec4(clamp(v, 0.0, 24.0), 1.0); }`,
    }));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.14, 0.35, 2.2);
    this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
  }
  applyQuality(q: string) {
    this.quality = q;
    // The pixel ratio starts at the quality's ceiling (at most 1 on medium) and then adapts to the frame time (see adaptResolution).
    this.prMax = q === 'low' ? 0.85 : q === 'med' ? Math.min(window.devicePixelRatio, 0.85) : Math.min(window.devicePixelRatio, 1.5);
    this.prMin = 0.6;
    this.pr = this.prMax; this.slowWins = 0; this.fastWins = 0; this.settleT = 3;
    this.culler.sizeFactor = q === 'low' ? 300 : q === 'med' ? 420 : 520;
    this.culler.shadowDistance = q === 'low' ? 16 : q === 'med' ? 22 : 28;
    this.renderer.setPixelRatio(this.pr); this.resize();
    this.renderer.shadowMap.enabled = q !== 'low';
    const s = q === 'high' ? 2048 : 1024;
    this.setComposerSamples(COMPOSER_SAMPLES[q as EngineQuality] ?? 0);
    if (this.sky.sun.shadow.mapSize.x !== s) { this.sky.sun.shadow.mapSize.set(s, s); this.sky.sun.shadow.map?.dispose(); (this.sky.sun.shadow as any).map = null; }
    if (this.renderer.shadowMap.enabled !== this.shadowsWereOn) { this.shadowsWereOn = this.renderer.shadowMap.enabled; this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; }); }
    this.useBloom = q !== 'low';
    // Screen-space AO shimmers when the camera turns and redraws the whole scene once more; only on high, never in the story.
    if (this.gtao) this.gtao.enabled = q === 'high' && !this.opts.story;
  }
  useBloom = true;

  /** MSAA of the composer's two targets. Changing it frees the targets; they are reallocated on the next draw. */
  private setComposerSamples(n: number) {
    const c = this.composer;
    if (!c) return;
    for (const rt of [c.renderTarget1, c.renderTarget2]) {
      if (rt.samples === n) continue;
      rt.samples = n;
      rt.dispose();
    }
  }
  private shadowsWereOn = true;

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h); this.bloom?.setSize(w, h);
  }

  bind() {
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void) => { window.addEventListener(t, f as EventListener); this.disposers.push(() => window.removeEventListener(t, f as EventListener)); };
    on('resize', () => this.resize());
    on('keydown', (e) => {
      if (!this.started || this.paused || this.inputBlocked) return;
      if ((e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) { this.setCursorMode(!this.cursorMode); return; }
      this.player.keys.add(e.code);
      if (e.code === 'KeyE' || e.code === 'Space') { this.interact(); e.preventDefault(); }
      if (e.code === 'KeyF') this.arms.triggerInspect();
      // Debug keys of the prototype route only.
      if (!this.opts.story) {
        if (e.code === 'KeyT') this.setTimeScale(this.timeScale > 0 ? 0 : 60);
        if (e.code === 'KeyR') this.setRain(this.rainTarget > 0.3 ? 0 : 1);
        if (e.code === 'KeyM') this.toggleMute();
        if (e.code === 'KeyG') this.startTour();
      }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    on('keyup', (e) => this.player.keys.delete(e.code));
    on('blur', () => this.player.keys.clear());
    const cv = this.renderer.domElement;
    const onLock = () => { const was = this.locked; this.locked = document.pointerLockElement === cv; if (this.locked) { this.lostLock = false; this.cursorMode = false; } else if (was && !this.cursorMode) this.lostLock = true; };
    document.addEventListener('pointerlockchange', onLock);
    this.disposers.push(() => document.removeEventListener('pointerlockchange', onLock));
    cv.addEventListener('mousedown', () => {
      // After the pointer was released (Esc, or an overlay), the first click takes the pointer back instead of interacting.
      if (this.started && this.lostLock && !this.paused && !this.inputBlocked && !this.cursorMode) { this.lostLock = false; this.swallowClick = true; try { void (cv.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => { /* ignore */ }); } catch { /* ignore */ } }
      this.dragging = true; this.moved = 0;
    });
    on('mouseup', () => { if (this.dragging && this.moved < 4 && this.started && !this.paused && !this.inputBlocked && !this.swallowClick) this.interact(); this.swallowClick = false; this.dragging = false; });
    on('mousemove', (e) => {
      if (!this.started || this.paused || this.inputBlocked) return;
      if (this.locked || (this.dragging && !this.opts.story && !this.cursorMode)) { const k = 0.0022; this.player.look.x -= e.movementX * k; this.player.look.y -= e.movementY * k; this.moved += Math.abs(e.movementX) + Math.abs(e.movementY); }
    });
    cv.addEventListener('touchstart', (e) => { const t = e.touches[0]; this.lastTouch = { x: t.clientX, y: t.clientY }; this.moved = 0; }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      const t = e.touches[e.touches.length - 1]; if (!this.lastTouch) return;
      if (t.clientX > window.innerWidth * 0.35) { this.player.look.x -= (t.clientX - this.lastTouch.x) * 0.005; this.player.look.y -= (t.clientY - this.lastTouch.y) * 0.005; }
      this.moved += Math.abs(t.clientX - this.lastTouch.x); this.lastTouch = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    cv.addEventListener('touchend', () => { if (this.moved < 6) this.interact(); this.lastTouch = null; });
  }

  begin(lock = true) {
    this.started = true; this.audio.start();
    if (lock) { try { const p = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => { /* ignore */ }); } catch { /* ignore */ } }
  }
  interact() {
    if (this.player.sitting) { this.player.stand(); return; }
    const it = this.current; if (it) { this.arms.triggerInteract(); it.act(); }
  }
  /** Takes the pointer (after a click on the page). */
  lock() { try { void (this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => { /* ignore */ }); } catch { /* ignore */ } }
  /** Shows (true) or hides (false) the cursor. While shown the camera does not turn; moving and interacting still work. */
  setCursorMode(on: boolean) {
    this.cursorMode = on;
    this.lostLock = false;
    if (on) { if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); }
    else this.lock();
    this.hudT = 0;
  }
  setInputBlocked(b: boolean) { this.inputBlocked = b; if (b) this.player.keys.clear(); }
  setPaused(p: boolean) { this.paused = p; if (!p) this.cursorMode = false; if (p) { this.player.keys.clear(); if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); } }
  /**
   * Thunderstorm while it rains hard: every 9-26 s a strike flickers the sky light two or three
   * times (ambient and exposure boost, no extra light, so no shader recompiles), and the thunder
   * follows 0.3-2.5 s later, as if from a random distance. Indoors the flash is softer.
   */
  private updateLightning(dt: number) {
    const e = this.env;
    if (e.rain > 0.55 && this.started) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = 9 + Math.random() * 17;
        this.strikeT = 0;
        this.strikeDelay = 0.3 + Math.random() * 2.2;
        const near = 1 - (this.strikeDelay - 0.3) / 2.2;
        window.setTimeout(() => this.audio.thunder(0.45 + 0.55 * near), this.strikeDelay * 1000);
      }
    }
    let f = 0;
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      const t = this.strikeT;
      // Three quick pulses, the second the brightest, then a fading afterglow.
      f = Math.max(0, 1 - Math.abs(t - 0.04) / 0.05) * 0.7 + Math.max(0, 1 - Math.abs(t - 0.16) / 0.06) + Math.max(0, 1 - Math.abs(t - 0.34) / 0.07) * 0.5;
      if (t > 0.34) f += Math.max(0, 0.25 * (1 - (t - 0.34) / 0.5));
      if (t > 0.9) this.strikeT = -1;
    }
    this.flash = f * (1 - 0.6 * this.indoor);
    if (this.flash > 0.001) {
      this.sky.hemi.intensity += this.flash * 2.4;
      this.renderer.toneMappingExposure *= 1 + this.flash * 0.9;
    }
  }
  /** Story beats: the rain starts at dusk, then the call to go home. Each fires once. */
  private updateStory() {
    if (!this.opts.story || !this.started) return;
    const e = this.env;
    if (!this.storyRain && e.hour >= STORY_CLOCK.rainHour) { this.storyRain = true; this.setRain(1); this.opts.onStory?.('rain'); }
    if (!this.storyCall && e.hour >= STORY_CLOCK.callHomeHour && e.rain > 0.4) { this.storyCall = true; this.opts.onStory?.('callHome'); }
  }
  setTime(h: number) { this.env.hour = ((h % 24) + 24) % 24; }
  setTimeScale(s: number) { this.timeScale = s; }
  setRain(v: number) { this.rainTarget = v; }
  toggleMute() { this.audio.setMuted(!this.audio.muted); }
  setVolume(v: number) { this.audio.setVolume(v); }
  setMove(x: number, y: number) { this.player.joy.set(x, y); }

  facing(h: House, dx: number, dz: number) { const c = Math.cos(h.rot), s = Math.sin(h.rot); const wx = dx * c + dz * s, wz = -dx * s + dz * c; return Math.atan2(-wx, -wz); }
  teleportHouse(idx: number, lx: number, k: number, lz: number, dx: number, dz: number) {
    const h = this.houses[idx]; if (!h) return;
    const p = h.wp(lx, 0, lz); this.player.teleport(p.x, p.z, this.facing(h, dx, dz));
    const fl = this.phys.floorAt(p.x, p.z, h.F(k) + 0.2, 0.6); this.player.pos.y = fl.y;
  }
  teleport(name: string) {
    this.player.auto = null;
    switch (name) {
      case 'street': this.player.teleport(12, 2.4, 2.5); break;
      case 'alley': this.player.teleport(10, 8, Math.PI); break;
      case 'court': this.player.teleport(10, 38, Math.PI); break;
      case 'living': this.teleportHouse(0, 1.2, 0, 0.9, 0, 1); break;
      case 'kitchen': this.teleportHouse(0, 1.3, 0, 10.2, 0, 1); break;
      case 'bedroom': this.teleportHouse(0, 1.2, 1, 3.4, 0, -1); break;
      case 'roof': { const h = this.houses[0]; this.teleportHouse(0, h.xs + 1.0, h.n, 1.0, 0, 1); break; }
      case 'cafe': this.teleportHouse(3, 1.9, 0, 0.8, 0, 1); break;
      case 'pho': this.teleportHouse(4, 2.2, 0, 0.8, 0, 1); break;
      case 'grocery': this.teleportHouse(1, 2.0, 0, 0.8, 0, 1); break;
      case 'cap4': this.teleportHouse(2, 2.6, 0, -1.5, 0, 1); break;
    }
  }
  startTour() {
    const h = this.houses[0]; if (!h) return;
    const world = (pts: { x: number; z: number }[]) => pts.map((p) => { const w = h.wp(p.x, 0, p.z); return { x: w.x, z: w.z }; });
    h.doors.forEach((d) => d.set(true));
    const start = h.wp(h.doorX, 0, -4.2);
    this.player.teleport(start.x, start.z, this.facing(h, 0, 1));
    let pts: { x: number; z: number }[] = [];
    pts = pts.concat(h.route(0, 0, 0, 0, 1.4, 2.2, true));
    pts = pts.concat(h.route(0, 1.4, 2.2, 0, 1.35, 10.6));
    pts = pts.concat(h.route(0, 1.35, 10.6, 0, 1.65, 13.1));
    pts = pts.concat(h.route(0, 1.65, 13.1, 1, 1.4, 2.2));
    pts = pts.concat(h.route(1, 1.4, 2.2, 1, 1.4, 11.5));
    pts = pts.concat(h.route(1, 1.4, 11.5, h.n - 1, 1.4, 2.0));
    pts = pts.concat(h.route(h.n - 1, 1.4, 2.0, h.n, h.xs + 1.0, h.zs - 0.3));
    pts.push({ x: h.xs + 1.0, z: h.zs - 0.9 }, { x: h.xs + 1.0, z: h.zs - 1.9 }, { x: h.W / 2, z: 0.2 });
    this.player.startAuto(world(pts));
  }

  update(dt: number) {
    const e = this.env;
    if (this.started || !this.opts.story) e.hour = (e.hour + (dt * this.timeScale) / 3600) % 24;
    this.updateStory();
    e.rain += (this.rainTarget - e.rain) * Math.min(1, dt * 0.35);
    this.wet += ((this.rainTarget > 0.2 ? 1 : 0) - this.wet) * Math.min(1, dt * (this.rainTarget > 0.2 ? 0.08 : 0.01));
    const t = this.clock.elapsedTime;
    windUniform.value = t;
    // player
    if (this.started) this.player.update(dt, false); else { this.player.camera.position.set(this.player.pos.x, this.player.pos.y + 1.62, this.player.pos.z); this.player.camera.rotation.set(this.player.pitch, this.player.yaw, 0); this.player.pos.y = this.phys.floorAt(this.player.pos.x, this.player.pos.z, 3, 4).y; }
    this.ctx.eye.copy(this.camera.position);
    // indoor
    const cp = this.camera.position;
    let room = null as ReturnType<House['roomAtWorld']>, inH: House | null = null;
    for (const h of this.houses) { if (!h.contains(cp.x, cp.z) || h.spec.lite) continue; const r = h.roomAtWorld(cp.x, cp.y, cp.z); if (r) { room = r; inH = h; break; } }
    const inside = room && room.kind !== 'well' && room.kind !== 'wellup' ? 1 : 0;
    this.indoor += (inside - this.indoor) * Math.min(1, dt * 2.5);
    let openN = 0; if (inH) for (const d of inH.doors) if (d.on) openN++; this.openness += ((inH ? clamp(openN / 3, 0, 1) : 0) - this.openness) * Math.min(1, dt * 2);
    // location label
    if (room) this.loc = `${room.name} · ${room.house.spec.no ? tr('loc.house', { no: room.house.spec.no }) : ''} · ${tr('loc.floor', { n: room.k + 1 })}`;
    else if (cp.z > 40 && cp.x > -5 && cp.x < 24) this.loc = tr('loc.court');
    else if (cp.z > 6 && cp.x > 8 && cp.x < 12) this.loc = tr('loc.alley');
    else if (Math.abs(cp.z) <= 6.2) this.loc = tr('loc.street');
    else this.loc = tr('loc.area');
    // sim
    this.life?.update(dt, t);
    for (const f of this.ctx.dyn) f(dt, t);
    this.updateLights(dt, t);
    this.sky.update(e, cp, this.indoor);
    this.updateLightning(dt);
    setNightEmit(clamp(e.night * 1.0 + 0.0, 0, 1)); setWet(this.wet);
    this.rainU.uTime.value = t; this.rainU.uCam.value.copy(cp); this.rainU.uOp.value = e.rain * (1 - this.indoor) * 0.85;
    this.rain.visible = e.rain > 0.02 && this.indoor < 0.95;
    this.audio.update(dt, e, this.camera, this.indoor, this.openness, this.vehicles);
    this.audio.setWalk(this.player.vy === 0 ? this.player.moving : 0, this.player.moving > 2.5);
    // interaction pick
    this.pickT -= dt; if (this.pickT <= 0) { this.pickT = 0.07; this.current = this.player.sitting ? null : this.inter.pick(this.camera, this.phys); }
    this.freezeFarTransforms();
  }

  /**
   * Hidden people and far houses keep their last world matrices instead of recomputing ~15,000
   * of them every frame: only what is visible and near is updated.
   */
  private freezeFarTransforms() {
    const cp = this.camera.position;
    for (const c of this.ctx.root.children) if (!(c as THREE.Mesh).isMesh) c.matrixWorldAutoUpdate = c.visible;
    // The house set near the camera only changes once it has moved; people toggle visibility every frame, so the loop above always runs.
    if (this.freezeAt.distanceToSquared(cp) < 0.25) return;
    this.freezeAt.copy(cp);
    for (const hc of this.houseCenters) {
      const dx = hc.x - cp.x, dz = hc.z - cp.z;
      hc.h.group.matrixWorldAutoUpdate = dx * dx + dz * dz < 45 * 45;
    }
  }

  updateLights(dt: number, t: number) {
    const cp = this.camera.position, e = this.env;
    const cand = this.lightCand; cand.length = 0;
    for (const rl of this.ctx.roomLights) {
      const k = Math.min(1, dt * 5); rl.level += (rl.target - rl.level) * k;
      const lvl = rl.level, tv = rl.roomId.endsWith(':tv');
      const fl = tv ? 0.75 + 0.25 * Math.sin(t * 9 + rl.pos.x) * Math.sin(t * 3.7) : 1;
      for (const m of rl.mats) m.emissiveIntensity = lvl * 2.6;
      for (const m of rl.curtainMats) m.emissiveIntensity = lvl * 0.5 * (0.35 + e.night * 0.65);
      if (lvl > 0.02) {
        const d = rl.pos.distanceTo(cp);
        if (d < 26) { let c = this.lightCandPool[cand.length]; if (!c) { c = { rl, d }; this.lightCandPool.push(c); } c.rl = rl; c.d = d; cand.push(c); }
      }
      (rl as any)._fl = fl;
    }
    cand.sort((a, b) => a.d - b.d);
    this.pool.forEach((p, i) => {
      const c = cand[i];
      if (!c) { p.intensity += (0 - p.intensity) * Math.min(1, dt * 8); return; }
      p.position.copy(c.rl.pos); p.color.setHex(c.rl.color);
      const tgt = c.rl.level * c.rl.power * 7 * (c.rl as any)._fl;
      p.intensity += (tgt - p.intensity) * Math.min(1, dt * 10);
      p.distance = c.rl.roomId.endsWith(':tv') ? 6 : 8.5;
    });
    // Street lamps sorted by distance in place; re-sorted at most once a second (or after a 4 m move, or a new lamp set).
    const lamps = this.lampOrder;
    this.lampSortT -= dt;
    if (lamps.length !== this.ctx.lamps.length || this.lampSortT <= 0 || this.lampSortedAt.distanceToSquared(cp) > 16) {
      if (lamps.length !== this.ctx.lamps.length) { lamps.length = 0; for (const l of this.ctx.lamps) lamps.push(l); }
      lamps.sort((a, b) => a.distanceToSquared(cp) - b.distanceToSquared(cp));
      this.lampSortT = 1; this.lampSortedAt.copy(cp);
    }
    this.lampPool.forEach((p, i) => { if (lamps[i]) p.position.copy(lamps[i]); p.intensity = e.night * 20 * (1 - 0.3 * e.rain) * (lamps[i] ? 1 : 0); });
  }

  /** Draws one frame without advancing the simulation (dev measurements). */
  renderOnly() {
    if (this.composer && this.useBloom) this.composer.render(1 / 60); else this.renderer.render(this.scene, this.camera);
  }
  frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.06);
    if (!this.paused) this.update(dt);
    this.updateArms(dt);
    this.culler.update(dt, this.camera.position);
    // The sun barely moves and the shadow casters are static, so the map is redrawn every 4th frame.
    if ((this.frameNo++ & 3) === 0) this.renderer.shadowMap.needsUpdate = true;
    this.adaptResolution(raw);
    if (this.composer && this.useBloom) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    this.frames++; this.fpsT += dt;
    if (this.fpsT > 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.12;
      const h = this.env.hour, hh = Math.floor(h), mm = Math.floor((h % 1) * 60);
      this.hud = {
        time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, hour: h, loc: this.loc, prompt: this.player.sitting ? tr('seated') : this.current ? this.current.label() : null,
        indoor: this.indoor > 0.5, fps: this.fps, rain: this.env.rain, sitting: this.player.sitting?.label ?? null, tour: !!this.player.auto, started: this.started, timeScale: this.timeScale, muted: this.audio.muted, quality: this.quality,
        cursorMode: this.cursorMode,
        weather: this.env.rain > 0.5 ? tr('weather.rain') : this.env.night > 0.6 ? tr('weather.night') : this.env.sun < 0.5 ? tr('weather.dusk') : tr('weather.clear'),
      };
      const key = `${this.hud.time}|${this.hud.loc}|${this.hud.prompt}|${this.hud.fps}|${this.hud.rain > 0.3}|${this.hud.started}|${this.hud.tour}|${this.hud.timeScale}|${this.hud.muted}|${this.hud.quality}|${this.hud.weather}|${this.hud.cursorMode}`;
      if (key !== this.lastHudKey) { this.lastHudKey = key; this.onHud(this.hud); }
    }
  }

  private updateArms(dt: number) {
    if (!this.armsShadowOff && this.arms.loaded) {
      // The viewmodel clones with shadows on; on the camera they would throw a shadow on the street.
      this.arms.group.traverse((o) => { o.castShadow = false; });
      this.armsShadowOff = true;
    }
    const k = this.player.keys;
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    this.arms.update(dt, this.player.moving > 0.3, run && this.player.moving > 2.5, !this.started || this.paused || !!this.player.sitting);
  }

  /**
   * Keeps the frame rate up on any machine: after 1 slow second (under ~48 fps) the render
   * resolution steps down, after 6 smooth ones (over ~75 fps) it steps back up, never above the
   * quality's ceiling. Applied right before a frame is drawn, so the resize never shows a blank canvas.
   */
  private adaptResolution(raw: number) {
    if (this.paused || !this.started) return;
    if (this.settleT > 0) { this.settleT -= raw; return; }
    this.perfT += raw; this.perfFrames++;
    if (this.perfT < 1) return;
    const ms = (this.perfT / this.perfFrames) * 1000;
    this.perfT = 0; this.perfFrames = 0;
    if (ms > 21) { this.slowWins++; this.fastWins = 0; } else if (ms < 13.5) { this.fastWins++; this.slowWins = 0; } else { this.slowWins = 0; this.fastWins = 0; }
    let next = this.pr;
    if (this.slowWins >= 1 && this.pr > this.prMin) { next = Math.max(this.prMin, this.pr - 0.15); this.slowWins = 0; }
    else if (this.fastWins >= 6 && this.pr < this.prMax) { next = Math.min(this.prMax, this.pr + 0.1); this.fastWins = 0; }
    if (next !== this.pr) { this.pr = next; this.renderer.setPixelRatio(next); this.resize(); this.settleT = 1; }
  }

  dispose() { this.renderer.setAnimationLoop(null); this.arms.dispose(); if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); this.disposers.forEach((d) => d()); this.audio.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}

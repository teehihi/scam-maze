import * as THREE from 'three';

/**
 * A live `renderer.info` snapshot plus a rolling frame-time window, for any Host (an R3F canvas
 * or one of the imperative engines). Independent of `profiling.ts`'s scene audits: those traverse
 * the whole scene graph on demand and have no concept of "per frame" or "over time"; this probe
 * never traverses the scene, only reads the renderer's own counters.
 *
 * `renderer.info.autoReset` resets the draw-call/triangle counters inside every `render()` call,
 * not once per animation frame — a composer with several passes (each its own `render()` call)
 * would otherwise show only its last pass. The probe takes over `autoReset` for the lifetime of
 * the renderer it was created for: `beginFrame()` resets once, before anything in the frame
 * renders; `endFrame()` reads the accumulated counters after everything has. `dispose()` restores
 * `autoReset` to `true`, three.js's own default, so the renderer behaves normally again.
 */

export interface StatsSnapshot {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  frameMs: { p50: number; p95: number; last: number };
}

const DEFAULT_WINDOW_SIZE = 120;

export class StatsProbe {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly frameTimes: Float64Array;
  private readonly scratch: Float64Array;
  private frameCount = 0;
  private writeIndex = 0;
  private lastFrameMs = 0;
  private lastCalls = 0;
  private lastTriangles = 0;

  constructor(renderer: THREE.WebGLRenderer, options: { windowSize?: number } = {}) {
    this.renderer = renderer;
    const windowSize = Math.max(1, options.windowSize ?? DEFAULT_WINDOW_SIZE);
    this.frameTimes = new Float64Array(windowSize);
    this.scratch = new Float64Array(windowSize);
    renderer.info.autoReset = false;
  }

  /** Call once, before anything in the frame renders. */
  beginFrame(): void {
    this.renderer.info.reset();
  }

  /** Call once, after everything in the frame (every pass, every shadow map) has rendered. */
  endFrame(frameMs: number): void {
    const info = this.renderer.info;
    this.lastFrameMs = frameMs;
    this.lastCalls = info.render.calls;
    this.lastTriangles = info.render.triangles;
    const size = this.frameTimes.length;
    this.frameTimes[this.writeIndex % size] = frameMs;
    this.writeIndex++;
    this.frameCount = Math.min(this.frameCount + 1, size);
  }

  /**
   * A snapshot as of the last `endFrame()`. Sorts at most `windowSize` numbers (cheap even a few
   * times a second); nothing here runs on every frame, only when a caller asks for a reading.
   */
  snapshot(): StatsSnapshot {
    const info = this.renderer.info;
    return {
      calls: this.lastCalls,
      triangles: this.lastTriangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      frameMs: {
        p50: this.percentile(0.5),
        p95: this.percentile(0.95),
        last: this.lastFrameMs,
      },
    };
  }

  private percentile(p: number): number {
    const n = this.frameCount;
    if (n === 0) return 0;
    for (let i = 0; i < n; i++) this.scratch[i] = this.frameTimes[i];
    const view = this.scratch.subarray(0, n);
    view.sort();
    const rank = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
    return view[rank];
  }

  /** Restores `renderer.info.autoReset` to three.js's own default (`true`). */
  dispose(): void {
    this.renderer.info.autoReset = true;
  }
}

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

/** Reads the `?stats=1`-style URL flag once; safe to call outside a browser. */
export function isStatsEnabled(): boolean {
  if (!hasWindow()) return false;
  return new URLSearchParams(window.location.search).has('stats');
}

/**
 * Returns a probe only when diagnostics are enabled, so a disabled Host allocates nothing (no
 * ring buffer) and has nothing to call on its hot path beyond a `probe?.` no-op check.
 */
export function createStatsProbe(
  renderer: THREE.WebGLRenderer,
  options: { windowSize?: number; force?: boolean } = {},
): StatsProbe | null {
  if (!(options.force ?? isStatsEnabled())) return null;
  return new StatsProbe(renderer, options);
}

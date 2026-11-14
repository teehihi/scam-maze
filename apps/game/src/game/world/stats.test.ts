import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { StatsProbe, createStatsProbe, isStatsEnabled } from './stats';

/** A minimal fake renderer: just enough of `renderer.info` for the probe to read and reset. */
function fakeRenderer(): THREE.WebGLRenderer {
  const info = {
    autoReset: true,
    reset: vi.fn(),
    render: { calls: 0, triangles: 0, points: 0, lines: 0, frame: 0 },
    memory: { geometries: 7, textures: 3 },
    programs: [{}, {}],
  };
  return { info } as unknown as THREE.WebGLRenderer;
}

describe('StatsProbe', () => {
  it('sets autoReset to false on construction and restores it to true on dispose', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer);
    expect(renderer.info.autoReset).toBe(false);
    probe.dispose();
    expect(renderer.info.autoReset).toBe(true);
  });

  it('beginFrame resets the renderer info once per frame', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer);
    probe.beginFrame();
    expect(renderer.info.reset).toHaveBeenCalledTimes(1);
  });

  it('endFrame captures the counters as they stood after everything rendered', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer);
    probe.beginFrame();
    renderer.info.render.calls = 42;
    renderer.info.render.triangles = 100_000;
    probe.endFrame(16.6);
    const snapshot = probe.snapshot();
    expect(snapshot.calls).toBe(42);
    expect(snapshot.triangles).toBe(100_000);
    expect(snapshot.geometries).toBe(7);
    expect(snapshot.textures).toBe(3);
    expect(snapshot.programs).toBe(2);
    expect(snapshot.frameMs.last).toBeCloseTo(16.6);
  });

  it('a composer with several passes is read correctly: counters accumulate across renders within one frame', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer);
    probe.beginFrame();
    // Simulate three passes, each adding to the (not auto-reset) counters.
    renderer.info.render.calls += 1;
    renderer.info.render.triangles += 2;
    renderer.info.render.calls += 5;
    renderer.info.render.triangles += 500;
    renderer.info.render.calls += 1;
    renderer.info.render.triangles += 10;
    probe.endFrame(10);
    const snapshot = probe.snapshot();
    expect(snapshot.calls).toBe(7);
    expect(snapshot.triangles).toBe(512);
  });

  it('snapshot before any endFrame reports zeroed frame-time percentiles, not a crash', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer);
    const snapshot = probe.snapshot();
    expect(snapshot.frameMs.p50).toBe(0);
    expect(snapshot.frameMs.p95).toBe(0);
    expect(snapshot.frameMs.last).toBe(0);
  });

  it('computes p50 and p95 over the rolling window', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer, { windowSize: 100 });
    // Feed 100 frames: 90 at 16ms (60fps) and 10 at 50ms (a stutter).
    for (let i = 0; i < 90; i++) {
      probe.beginFrame();
      probe.endFrame(16);
    }
    for (let i = 0; i < 10; i++) {
      probe.beginFrame();
      probe.endFrame(50);
    }
    const snapshot = probe.snapshot();
    expect(snapshot.frameMs.p50).toBe(16);
    // The slowest 10 of 100 frames are all 50ms, so the 95th percentile frame (index 94) is one
    // of them: a real stutter shows up in p95 even though the average frame rate still looks fine.
    expect(snapshot.frameMs.p95).toBe(50);
    expect(snapshot.frameMs.last).toBe(50);
  });

  it('a window shorter than its capacity still computes a sensible percentile', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer, { windowSize: 120 });
    probe.beginFrame();
    probe.endFrame(10);
    probe.beginFrame();
    probe.endFrame(20);
    probe.beginFrame();
    probe.endFrame(30);
    const snapshot = probe.snapshot();
    expect(snapshot.frameMs.p50).toBe(20);
    expect(snapshot.frameMs.last).toBe(30);
  });

  it('the ring buffer wraps: only the most recent windowSize frames count', () => {
    const renderer = fakeRenderer();
    const probe = new StatsProbe(renderer, { windowSize: 3 });
    for (const ms of [100, 100, 100, 5, 6, 7]) {
      probe.beginFrame();
      probe.endFrame(ms);
    }
    // Only the last 3 values (5, 6, 7) should remain in the window.
    const snapshot = probe.snapshot();
    expect(snapshot.frameMs.p50).toBe(6);
    expect(snapshot.frameMs.last).toBe(7);
  });
});

describe('isStatsEnabled', () => {
  const originalLocation = window.location.href;

  afterEach(() => {
    window.history.replaceState({}, '', originalLocation);
  });

  it('is false with no query string', () => {
    window.history.replaceState({}, '', '/mientay');
    expect(isStatsEnabled()).toBe(false);
  });

  it('is true with ?stats present, regardless of its value', () => {
    window.history.replaceState({}, '', '/mientay?stats=1');
    expect(isStatsEnabled()).toBe(true);
  });

  it('is true even with an empty value (?stats with nothing after it)', () => {
    window.history.replaceState({}, '', '/hue?stats');
    expect(isStatsEnabled()).toBe(true);
  });
});

describe('createStatsProbe', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/mientay');
  });

  it('returns null when stats are not enabled, allocating no ring buffer', () => {
    const renderer = fakeRenderer();
    const probe = createStatsProbe(renderer);
    expect(probe).toBeNull();
    // autoReset must be left alone when disabled: the probe never touched the renderer.
    expect(renderer.info.autoReset).toBe(true);
  });

  it('returns a working probe when force is true, independent of the URL', () => {
    const renderer = fakeRenderer();
    const probe = createStatsProbe(renderer, { force: true });
    expect(probe).not.toBeNull();
    expect(renderer.info.autoReset).toBe(false);
  });

  it('returns a working probe when the URL carries ?stats=1', () => {
    window.history.replaceState({}, '', '/mientay?stats=1');
    const renderer = fakeRenderer();
    const probe = createStatsProbe(renderer);
    expect(probe).not.toBeNull();
  });
});

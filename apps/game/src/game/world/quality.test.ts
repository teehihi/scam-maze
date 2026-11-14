import { describe, expect, it, vi } from 'vitest';
import { AdaptiveQuality, type AdaptiveQualityPolicy } from './quality';

const mekongPolicy = (onChange: (ratio: number) => void): AdaptiveQualityPolicy => ({
  initial: 1.0,
  min: 0.7,
  max: 1.0,
  step: 0.15,
  windowSeconds: 2.0,
  slowFrameSeconds: 1 / 45,
  fastFrameSeconds: 1 / 58,
  dropStreak: 3,
  riseStreak: 8,
  lockUpgradesAfterRevert: true,
  epsilon: 0.005,
  onChange,
});

const huePolicy = (onChange: (ratio: number) => void): AdaptiveQualityPolicy => ({
  initial: 1.5,
  min: 1.0,
  max: 1.5,
  step: 0.1,
  windowSeconds: 2.0,
  slowFrameSeconds: 1 / 38,
  fastFrameSeconds: 1 / 57,
  dropStreak: 1,
  riseStreak: 1,
  lockUpgradesAfterRevert: false,
  epsilon: 0.01,
  onChange,
});

/** Feeds one 2-second-equivalent window of frames, each `frameSeconds` long. */
function feedWindow(quality: AdaptiveQuality, frameSeconds: number, totalSeconds = 2.0): void {
  let elapsed = 0;
  while (elapsed < totalSeconds) {
    quality.update(frameSeconds);
    elapsed += frameSeconds;
  }
}

describe('AdaptiveQuality (Mekong policy: 3-window drop streak, 8-window rise streak, ratchet)', () => {
  it('does not change the pixel ratio on a single slow window (streak of 3 required)', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    feedWindow(quality, 1 / 30); // slower than 1/45
    quality.commit();
    expect(onChange).not.toHaveBeenCalled();
    expect(quality.getState().slowWindows).toBe(1);
  });

  it('drops one step after three consecutive slow windows', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    quality.commit();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.85);
    expect(quality.getCurrent()).toBe(0.85);
  });

  it('never drops below the floor', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    for (let i = 0; i < 20; i++) feedWindow(quality, 1 / 20);
    quality.commit();
    expect(quality.getCurrent()).toBeGreaterThanOrEqual(0.7);
    expect(quality.getCurrent()).toBeCloseTo(0.7, 5);
  });

  it('a rise needs eight consecutive fast windows, not three', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    // Force it down first so there is room to rise.
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    quality.commit();
    expect(quality.getCurrent()).toBe(0.85);
    onChange.mockClear();

    for (let i = 0; i < 7; i++) feedWindow(quality, 1 / 60);
    quality.commit();
    expect(onChange).not.toHaveBeenCalled();

    feedWindow(quality, 1 / 60); // 8th fast window
    quality.commit();
    expect(onChange).toHaveBeenCalledWith(1.0);
  });

  it('locks upgrades after a rise is immediately followed by a drop', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    // Drop, then rise back up.
    for (let i = 0; i < 3; i++) feedWindow(quality, 1 / 30);
    quality.commit();
    for (let i = 0; i < 8; i++) feedWindow(quality, 1 / 60);
    quality.commit();
    expect(quality.getCurrent()).toBe(1.0);
    expect(quality.getState().upgradesLocked).toBe(false);

    // Drop again: the ratchet should now lock further rises.
    for (let i = 0; i < 3; i++) feedWindow(quality, 1 / 30);
    quality.commit();
    expect(quality.getState().upgradesLocked).toBe(true);

    onChange.mockClear();
    for (let i = 0; i < 20; i++) feedWindow(quality, 1 / 60);
    quality.commit();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('setCeiling with jumpTo snaps straight to the new ceiling (performance mode)', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    quality.setCeiling(0.8, { jumpTo: true });
    quality.commit();
    expect(onChange).toHaveBeenCalledWith(0.8);
  });

  it('setCeiling without jumpTo only clamps future steps, not the current ratio', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    quality.setCeiling(0.9);
    quality.commit();
    // 1.0 (unchanged current) is above the new 0.9 ceiling only if pending was clamped; since
    // pending started at 1.0, setCeiling must clamp pending down to 0.9 without a jump request.
    expect(onChange).toHaveBeenCalledWith(0.9);
  });

  it('setCeiling resets the streak counters but keeps the upgrade lock unless told to unlock', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    for (let i = 0; i < 3; i++) feedWindow(quality, 1 / 30);
    quality.commit();
    for (let i = 0; i < 8; i++) feedWindow(quality, 1 / 60);
    quality.commit();
    for (let i = 0; i < 3; i++) feedWindow(quality, 1 / 30);
    quality.commit();
    expect(quality.getState().upgradesLocked).toBe(true);

    quality.setCeiling(1.0);
    expect(quality.getState().upgradesLocked).toBe(true);
    expect(quality.getState().slowWindows).toBe(0);

    quality.setCeiling(1.0, { unlock: true });
    expect(quality.getState().upgradesLocked).toBe(false);
  });
});

describe('AdaptiveQuality (Hue policy: streak of 1 = immediate reaction, no ratchet)', () => {
  it('reacts on the very first slow window, matching the un-streaked original code', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(huePolicy(onChange));
    feedWindow(quality, 1 / 20); // slower than 1/38
    quality.commit();
    expect(onChange).toHaveBeenCalledWith(1.4);
  });

  it('reacts on the very first fast window', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(huePolicy(onChange));
    feedWindow(quality, 1 / 20);
    quality.commit();
    onChange.mockClear();
    feedWindow(quality, 1 / 60); // faster than 1/57
    quality.commit();
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  it('never locks upgrades after a drop-then-rise, unlike Mekong', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(huePolicy(onChange));
    feedWindow(quality, 1 / 20);
    quality.commit();
    feedWindow(quality, 1 / 60);
    quality.commit();
    expect(quality.getCurrent()).toBe(1.5);
    feedWindow(quality, 1 / 20);
    quality.commit();
    expect(quality.getState().upgradesLocked).toBe(false);
    onChange.mockClear();
    feedWindow(quality, 1 / 60);
    quality.commit();
    expect(onChange).toHaveBeenCalled(); // would be blocked if locked, unlike the Mekong test above
  });

  it('never drops below the floor of 1.0', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(huePolicy(onChange));
    for (let i = 0; i < 10; i++) feedWindow(quality, 1 / 10);
    quality.commit();
    expect(quality.getCurrent()).toBeCloseTo(1.0, 5);
  });
});

describe('AdaptiveQuality general behavior', () => {
  it('does not call onChange for a change smaller than epsilon', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality({
      ...mekongPolicy(onChange),
      step: 0.001, // smaller than epsilon (0.005)
    });
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    quality.commit();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a mid-band average (between the fast and slow thresholds) resets both streaks without moving', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    feedWindow(quality, 1 / 30); // slow window 1
    feedWindow(quality, 1 / 30); // slow window 2
    feedWindow(quality, 1 / 50); // mid-band: resets the slow streak
    expect(quality.getState().slowWindows).toBe(0);
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    quality.commit();
    expect(onChange).not.toHaveBeenCalled(); // only 2 consecutive slow windows since the reset
  });

  it('getState reports the pending ratio separately from the committed current ratio', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    // Pending has moved, but commit() has not been called yet.
    expect(quality.getState().pending).toBe(0.85);
    expect(quality.getState().current).toBe(1.0);
    expect(quality.getCurrent()).toBe(1.0);
    quality.commit();
    expect(quality.getCurrent()).toBe(0.85);
  });

  it('reset() clears streaks and the ratchet without changing the current ratio', () => {
    const onChange = vi.fn();
    const quality = new AdaptiveQuality(mekongPolicy(onChange));
    feedWindow(quality, 1 / 30);
    feedWindow(quality, 1 / 30);
    quality.reset();
    expect(quality.getState().slowWindows).toBe(0);
    expect(quality.getCurrent()).toBe(1.0);
  });
});

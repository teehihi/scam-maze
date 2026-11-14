import { useEffect } from 'react';
import { addAfterEffect, addEffect, useThree } from '@react-three/fiber';
import { createStatsProbe, type StatsProbe } from './stats';

/**
 * Mounts a `StatsProbe` for the R3F renderer of whichever `<Canvas>` this is rendered inside, and
 * exposes its snapshot through `window.__WORLD_STATS__.<name>` while `?stats=1` is present in
 * the URL. Renders nothing; does nothing at all when diagnostics are disabled (`createStatsProbe`
 * returns null, and the effect never subscribes to the render loop).
 *
 * Uses `addEffect`/`addAfterEffect` rather than `useFrame`, because `useFrame` runs before R3F's
 * own render call for that frame: reading `gl.info` there would see the *previous* frame's
 * counters. `addEffect` fires once before every Canvas's render in the frame; `addAfterEffect`
 * fires once after.
 */
export function StatsProbeHost({ name }: { name: string }): null {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const probe = createStatsProbe(gl);
    if (!probe) return;

    const globalStats = ((window as unknown as Record<string, unknown>).__WORLD_STATS__ ??= {}) as Record<
      string,
      () => ReturnType<StatsProbe['snapshot']>
    >;
    globalStats[name] = () => probe.snapshot();

    let frameStart = 0;
    const unsubscribeBegin = addEffect(() => {
      frameStart = performance.now();
      probe.beginFrame();
      return true;
    });
    const unsubscribeAfter = addAfterEffect(() => {
      probe.endFrame(performance.now() - frameStart);
      return true;
    });

    return () => {
      unsubscribeBegin();
      unsubscribeAfter();
      delete globalStats[name];
      probe.dispose();
    };
  }, [gl, name]);

  return null;
}

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { ContextLossHandlers } from './lifecycle';
import { watchContextLoss } from './lifecycle';

/** The console-only handlers, factored out so they are testable without an R3F render harness. */
export function contextLossLogHandlers(name: string): ContextLossHandlers {
  return {
    onLost: () => {
      console.warn(`WebGL context lost (${name}). Waiting for the browser to restore it...`);
    },
    onRestored: () => {
      console.info(`WebGL context restored (${name}).`);
    },
  };
}

/**
 * Mounts `watchContextLoss` for the renderer of whichever `<Canvas>` this is rendered inside, so
 * a lost WebGL context is allowed to recover (`preventDefault()`) instead of staying dead.
 * Renders nothing. Matches the console-only behavior `GameCanvas` and `ChapterOneCanvas` already
 * have inline — this does not add a user-facing fallback or error boundary; a canvas with neither
 * (`TestMoveCanvas`, `UEHCanvas`) still has none after adopting this, only the ability to recover
 * from a GPU context loss instead of staying blank.
 *
 * A child component (rather than the `onCreated` callback `GameCanvas`/`ChapterOneCanvas` use) so
 * the unsubscribe has a real place to run: R3F cleans up child effects before it disposes the
 * renderer on unmount, so this is symmetric without relying on the canvas element being GC'd.
 */
export function ContextLossWatcher({ name }: { name: string }): null {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const unsubscribe = watchContextLoss(gl.domElement, contextLossLogHandlers(name));
    return unsubscribe;
  }, [gl, name]);

  return null;
}

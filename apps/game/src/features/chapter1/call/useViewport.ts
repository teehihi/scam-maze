// Window size in CSS pixels for the call layout (design.md, "`CallPresentation.tsx` (wiring)").
// Reads `window.innerWidth` and `window.innerHeight` and updates on `resize`. The returned object
// keeps its identity until the size changes, so `computeCallLayout` can be memoized on it.
import { useEffect, useState } from "react";
import type { Viewport } from "./callLayout";

function readViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight };
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(readViewport);

  useEffect(() => {
    const update = () => {
      const next = readViewport();
      setViewport((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      );
    };
    // The size may have changed between the first render and this effect.
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return viewport;
}

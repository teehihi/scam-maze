import { useEffect, useRef } from "react";

/**
 * Writes the scroll offset (clamped) to a CSS variable `--py` on the element.
 * Layers use `translate3d(0, calc(var(--py) * -0.04), 0)` for subtle depth.
 * Skipped entirely for reduced motion and small screens.
 */
export function useParallax<T extends HTMLElement>(max = 600) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 1024px)");
    if (reduce.matches || !wide.matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.scrollY, max);
      el.style.setProperty("--py", `${y}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [max]);

  return ref;
}

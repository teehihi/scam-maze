import React, { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface SceneTransitionProps {
  /** Fades in on mount; set to false to fade out. */
  visible: boolean;
  /** Called exactly once, after the fade-out has finished. */
  onHidden?: () => void;
  /**
   * When true (default), the layer starts at opacity 0 and fades in on the frame after mount.
   * When false, the layer is fully opaque on its first render, with no fade-in. The fade-out
   * is the same in both cases.
   */
  fadeIn?: boolean;
  durationMs?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Full-screen fade layer. Reduced-motion users get instant changes (duration 0).
 * Set `fadeIn={false}` for screens that must be opaque from their first frame, such as
 * loading screens. The timer only sequences the visual fade; it never decides when loading
 * is done.
 */
export const SceneTransition: React.FC<SceneTransitionProps> = ({
  visible,
  onHidden,
  fadeIn = true,
  durationMs = 500,
  className = "",
  children,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const duration = reducedMotion ? 0 : durationMs;
  const [entered, setEntered] = useState(!fadeIn || duration === 0);
  const onHiddenRef = useRef(onHidden);
  const firedRef = useRef(false);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  // Fade in on the frame after mount so the browser can transition from opacity 0.
  useEffect(() => {
    if (entered) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [entered]);

  useEffect(() => {
    if (visible || firedRef.current) return;
    const finish = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      onHiddenRef.current?.();
    };
    if (duration === 0) {
      finish();
      return;
    }
    const timer = setTimeout(finish, duration);
    return () => clearTimeout(timer);
  }, [visible, duration]);

  const opaque = visible && entered;

  return (
    <div
      data-testid="scene-transition"
      data-state={opaque ? "visible" : "hidden"}
      className={`fixed inset-0 transition-opacity ease-out ${opaque ? "opacity-100" : "pointer-events-none opacity-0"} ${className}`}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

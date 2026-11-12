/**
 * Screen slot for the single `PhoneScreenUI` instance during a call.
 *
 * - `pending` and `fallback` place the slot at `layout.screen`. `fallback` adds a 2D bezel
 *   (the Fallback_Phone_Screen); `pending` keeps the slot invisible until the mode settles.
 * - `model` follows the projected screen rectangle of the 3D phone. The host subscribes to the
 *   screen sink in an effect and writes the style directly on the element, so the per-frame
 *   rectangle never causes a React render.
 *
 * The host always renders the same `div` at the same tree position, so switching modes never
 * remounts the children. Pure DOM: no three, React Three Fiber or Drei imports.
 */
import React, { useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { SCREEN_CORNER_RATIO } from "./callLayout";
import type { CallLayout } from "./callLayout";
import type { PhoneScreenSink, ScreenPlacement } from "./phoneScreenSink";
import { quadSize, quadToMatrix3d } from "./screenQuad";

export type PhoneScreenHostMode = "pending" | "model" | "fallback";

export interface PhoneScreenHostProps {
  mode: PhoneScreenHostMode;
  layout: CallLayout;
  screenSink: PhoneScreenSink;
  /** The single `PhoneScreenUI` instance. */
  children: ReactNode;
}

/** Opaque phone screen background (`BRAND.navy`). */
const SCREEN_BACKGROUND = "#1d1b2b";
/** 2D bezel drawn outside the screen rectangle in fallback mode. */
const FALLBACK_BEZEL_OUTLINE = "6px solid #38344f";

/**
 * Writes the placement-driven style properties on the host element. With a projected quad the
 * element keeps its natural size and a matrix3d maps it onto the tilted glass.
 */
function applyRect(element: HTMLDivElement, rect: ScreenPlacement, cornerRadius: number): void {
  const { style } = element;
  if (rect.quad) {
    const size = quadSize(rect.quad);
    const matrix = quadToMatrix3d(size.width, size.height, rect.quad);
    if (matrix !== null) {
      style.transformOrigin = "0 0";
      style.transform = matrix;
      style.width = `${size.width}px`;
      style.height = `${size.height}px`;
      style.borderRadius = `${SCREEN_CORNER_RATIO * size.width}px`;
      return;
    }
  }
  style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  style.width = `${rect.width}px`;
  style.height = `${rect.height}px`;
  style.borderRadius = `${cornerRadius}px`;
}

export const PhoneScreenHost: React.FC<PhoneScreenHostProps> = ({
  mode,
  layout,
  screenSink,
  children,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const isModel = mode === "model";

  // Model mode: follow the sink without React renders. Until the sink has a rectangle, keep
  // the layout target so the slot never collapses to zero size.
  useLayoutEffect(() => {
    if (!isModel) return undefined;
    const element = hostRef.current;
    if (element === null) return undefined;

    const write = (rect: ScreenPlacement | null): void => {
      // `null` means the 3D phone is gone; the parent switches to fallback mode.
      if (rect === null) return;
      applyRect(element, rect, SCREEN_CORNER_RATIO * rect.width);
    };

    const initial = screenSink.current();
    if (initial !== null) {
      write(initial);
    } else {
      applyRect(element, layout.screen, layout.screenCornerRadius);
    }
    return screenSink.subscribe(write);
  }, [isModel, screenSink, layout]);

  const staticStyle: CSSProperties = {
    position: "fixed",
    left: 0,
    top: 0,
    containerType: "inline-size",
    background: SCREEN_BACKGROUND,
  };

  // In model mode React leaves the rectangle properties alone so the effect owns them.
  const style: CSSProperties = isModel
    ? staticStyle
    : {
        ...staticStyle,
        transform: `translate(${layout.screen.left}px, ${layout.screen.top}px)`,
        width: `${layout.screen.width}px`,
        height: `${layout.screen.height}px`,
        borderRadius: `${layout.screenCornerRadius}px`,
        ...(mode === "fallback" ? { outline: FALLBACK_BEZEL_OUTLINE } : null),
        ...(mode === "pending" ? { opacity: 0 } : null),
      };

  return (
    <div
      ref={hostRef}
      data-testid="phone-screen-host"
      data-mode={mode}
      className={mode === "fallback" ? "shadow-xl" : undefined}
      style={style}
    >
      {children}
    </div>
  );
};

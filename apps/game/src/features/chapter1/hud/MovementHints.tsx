// Small WASD and mouse hints for the exploration mode. They fade out after the first use of the
// movement keys or the mouse look, and stay hidden for the rest of the browser session
// (sessionStorage, no global store). Presentation only: reads input events, never writes state.
import React, { useCallback, useEffect, useState } from "react";
import { Mouse } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";
import { CINE, CINE_KEYCAP_STYLE } from "../theme";
import { hudScaleStyle, useHudScale } from "./hudScale";

export interface MovementHintsProps {
  /** True in the exploration mode with the HUD shown. */
  active: boolean;
}

const MOVE_CODES: ReadonlySet<string> = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(CINE.hintStorageKey) === "1";
  } catch {
    return false;
  }
}

function writeSeen(): void {
  try {
    window.sessionStorage.setItem(CINE.hintStorageKey, "1");
  } catch {
    // Storage can be blocked; the hints then fade for this mount only.
  }
}

export const MovementHints: React.FC<MovementHintsProps> = ({ active }) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as (key: string) => string;
  const reducedMotion = useReducedMotion();
  const hudScale = useHudScale();
  const [seen, setSeen] = useState(readSeen);
  const [fading, setFading] = useState(false);

  const markUsed = useCallback(() => {
    writeSeen();
    setFading(true);
  }, []);

  useEffect(() => {
    if (!active || seen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (!event.repeat && MOVE_CODES.has(event.code)) markUsed();
    };
    const onMouse = (event: MouseEvent) => {
      if (document.pointerLockElement != null && (event.movementX !== 0 || event.movementY !== 0)) markUsed();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMouse);
    };
  }, [active, markUsed, seen]);

  useEffect(() => {
    if (!fading) return undefined;
    if (reducedMotion) {
      setSeen(true);
      return undefined;
    }
    const id = window.setTimeout(() => setSeen(true), CINE.motion.hintFadeMs);
    return () => window.clearTimeout(id);
  }, [fading, reducedMotion]);

  if (!active || seen) return null;

  const keycap = (label: string) => (
    <kbd key={label} aria-hidden="true" className="inline-flex items-center justify-center font-mono" style={CINE_KEYCAP_STYLE}>
      {label}
    </kbd>
  );

  return (
    <div
      role="group"
      aria-label={text("room.hud.controlsLabel")}
      data-testid="movement-hints"
      data-fading={fading ? "true" : "false"}
      className="pointer-events-none absolute left-6 z-10 flex flex-col gap-2"
      style={{
        ...hudScaleStyle(hudScale, "bottom left"),
        // No box: plain key-caps and labels, clear of the Ctrl / Esc footer strip.
        bottom: CINE.hintsBottomPx,
        textShadow: "0 1px 8px rgba(0,0,0,0.85)",
        color: CINE.color.text,
        fontSize: CINE.fontPx.small,
        opacity: fading ? 0 : 1,
        transition: reducedMotion ? "none" : `opacity ${CINE.motion.hintFadeMs}ms ${CINE.motion.ease}`,
      }}
    >
      <p className="flex items-center gap-2">
        <span className="flex gap-1">{["W", "A", "S", "D"].map(keycap)}</span>
        <span style={{ color: CINE.color.textMuted }}>{text("room.hud.moveHint")}</span>
      </p>
      <p className="flex items-center gap-2">
        <span aria-hidden="true" className="inline-flex items-center justify-center px-1" style={CINE_KEYCAP_STYLE}>
          <Mouse className="h-3.5 w-3.5" />
        </span>
        <span style={{ color: CINE.color.textMuted }}>{text("room.hud.lookHint")}</span>
      </p>
    </div>
  );
};

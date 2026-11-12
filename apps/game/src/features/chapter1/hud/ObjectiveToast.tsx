// Transient notice for an objective that was activated or completed (Requirement 6.10).
// Visual only: the ObjectiveTracker owns the aria-live announcement, so screen readers hear the
// change once. Fades only when the user allows motion.

import React, { useEffect, useRef, useState } from "react";
import { CircleCheck, Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { UI } from "../theme";

export type ObjectiveChangeKind = "activated" | "completed";

export interface ObjectiveToastProps {
  kind: ObjectiveChangeKind;
  /** Objective text from the scenario. */
  text: string;
  /** Called once the toast has been visible for `durationMs`. Remount (new `key`) to restart. */
  onDismiss?: () => void;
  durationMs?: number;
}

const FADE_MS = 300;

export const ObjectiveToast: React.FC<ObjectiveToastProps> = ({ kind, text, onDismiss, durationMs = 4000 }) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(reducedMotion);
  // Latest callback without restarting the timers when the parent passes a new function.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    // Fade in after mount when motion is allowed.
    const showId = window.setTimeout(() => setVisible(true), 0);
    const hideId = window.setTimeout(() => setVisible(false), Math.max(0, durationMs - FADE_MS));
    const doneId = window.setTimeout(() => onDismissRef.current?.(), durationMs);
    return () => {
      window.clearTimeout(showId);
      window.clearTimeout(hideId);
      window.clearTimeout(doneId);
    };
  }, [durationMs]);

  const Icon = kind === "completed" ? CircleCheck : Flag;
  const motionClass = reducedMotion ? "" : "transition-opacity duration-300";
  const opacityClass = visible || reducedMotion ? "opacity-100" : "opacity-0";

  return (
    <div
      data-testid="objective-toast"
      className={`${UI.hudPanel} pointer-events-none flex max-w-sm items-start gap-2 ${motionClass} ${opacityClass}`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${kind === "completed" ? UI.textPositive : "text-[#b9a5f5]"}`}
        aria-hidden="true"
      />
      <div>
        <p className={UI.label}>{t(`toast.${kind}`)}</p>
        <p>{text}</p>
      </div>
    </div>
  );
};

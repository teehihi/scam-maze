// Short notice when an Evidence_Item is discovered (Requirement 11.6).
// A polite status region; disappears after `durationMs`. Remount (new `key`) to restart.

import React, { useEffect, useRef } from "react";
import { NotebookPen } from "lucide-react";
import { UI } from "../theme";

export interface EvidenceNoticeProps {
  /** Evidence_Item title from the scenario. */
  title: string;
  onDismiss?: () => void;
  durationMs?: number;
}

export const EVIDENCE_NOTICE_LABEL = "New evidence recorded:";

export const EvidenceNotice: React.FC<EvidenceNoticeProps> = ({ title, onDismiss, durationMs = 4000 }) => {
  // Latest callback without restarting the timer when the parent passes a new function.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const id = window.setTimeout(() => onDismissRef.current?.(), durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs]);

  return (
    <p
      role="status"
      data-testid="evidence-notice"
      className={`${UI.hudPanel} pointer-events-none flex max-w-sm items-start gap-2`}
    >
      <NotebookPen className={`mt-0.5 h-4 w-4 shrink-0 ${UI.textPositive}`} aria-hidden="true" />
      <span>
        <span className="font-semibold">{EVIDENCE_NOTICE_LABEL}</span> {title}
      </span>
    </p>
  );
};

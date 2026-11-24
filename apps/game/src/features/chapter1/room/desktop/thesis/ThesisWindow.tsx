// The laptop's Thesis app: one manuscript workspace, with chrome owned by the desktop window.
import React from "react";
import { ThesisPanel, type ThesisPanelProps } from "../../../world/ThesisPanel";

export const ThesisWindow: React.FC<Omit<ThesisPanelProps, "tone">> = (props) => (
  <div
    className="h-full min-h-0 overflow-hidden bg-[#e5eaf2] p-2 sm:p-3"
    data-testid="thesis-window"
  >
    <div
      className="mx-auto h-full min-h-0 max-w-6xl overflow-hidden rounded-lg bg-white/95"
      style={{
        boxShadow:
          "0 1px 3px rgba(31,41,55,0.14), 0 10px 24px -14px rgba(31,41,55,0.22)",
      }}
    >
      <ThesisPanel {...props} tone="paper" />
    </div>
  </div>
);

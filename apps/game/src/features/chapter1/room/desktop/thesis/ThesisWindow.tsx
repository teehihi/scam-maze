// The laptop's Thesis window: a full-width, zero-scroll 2-column interactive Word & Research Desk
// canvas ("Draft · Stamp · Proofread") framing Alex's living thesis manuscript and evidence tray.
import React from "react";
import { ThesisPanel, type ThesisPanelProps } from "../../../world/ThesisPanel";

export const ThesisWindow: React.FC<Omit<ThesisPanelProps, "tone">> = (props) => (
  <div
    className="flex h-full flex-col overflow-hidden"
    data-testid="thesis-window"
    style={{ background: "#e5eaf2" }}
  >
    {/* Compact diegetic Word ribbon */}
    <div
      className="flex shrink-0 items-center justify-between border-b px-3.5 py-1 text-[11px]"
      style={{ background: "#f7f9fc", borderColor: "#d4dce8", color: "#475569" }}
    >
      <div className="flex items-center gap-2 font-mono font-semibold text-[#1e3a8a]">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        <span>Alex_Thesis_Final_Ch3.docx</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[#64748b]">
        <span>Draft · Stamp · Proofread</span>
        <span>·</span>
        <span>Autosave ON</span>
      </div>
    </div>

    {/* Full-desk interactive workspace (fits laptop viewport cleanly without pushing manuscript off-screen) */}
    <div
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        className="mx-auto flex h-full max-w-5xl flex-col rounded-lg bg-white/95 p-3.5"
        style={{
          boxShadow:
            "0 1px 3px rgba(31,41,55,0.14), 0 10px 24px -14px rgba(31,41,55,0.22)",
        }}
      >
        <ThesisPanel {...props} tone="paper" />
      </div>
    </div>
  </div>
);

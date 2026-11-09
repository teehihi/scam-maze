import React from "react";
import { ModalDialog } from "../../components/ui/ModalDialog";
import { Play, ArrowLeft, Smartphone, MapPin, AlertCircle } from "lucide-react";

interface IntroPrologueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IntroPrologueModal: React.FC<IntroPrologueModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Prologue: An Ordinary Morning"
      subtitle="Chapter 1 — Street & Digital Intersection"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Narrative Banner */}
        <div className="relative p-5 rounded-2xl bg-gradient-to-br from-[#241f3b] to-[#161424] border border-[#483d6a] overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-mono text-[#b9a5f5] mb-2 uppercase tracking-wider">
            <MapPin className="w-3.5 h-3.5 text-[#f2b24b]" /> District 4 · Morning
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            The notification arrives before breakfast.
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            The sun is rising over the low-poly brick buildings and quiet storefronts along your street.
            You poured yourself a fresh cup of coffee when your smartphone buzzes with a high-priority alert:
          </p>
          <div className="my-3 p-3 rounded-xl bg-black/40 border border-[#3b3452] font-mono text-xs text-amber-200/90 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block text-[11px] mb-0.5">
                URGENT BANK NOTIFICATION
              </span>
              "Account #9284 suspended due to suspicious overseas activity. Confirm your identity within 15 minutes to avoid permanent freeze."
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Downstairs, the street is alive. Neighbors are heading to work, delivery vans are parked along the sidewalk, and the corner shop is opening up.
            What will you do?
          </p>
        </div>

        {/* Status Callout */}
        <div className="p-3.5 rounded-xl bg-[#1a1727] border border-[#352f4a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-[#b9a5f5]" />
            <div>
              <div className="text-xs font-semibold text-white">
                Chapter 1 Gameplay Controller & Scenario Engine
              </div>
              <div className="text-[11px] text-zinc-400">
                Scheduled for Milestone: First-Person Exploration & Digital Phone UI.
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded bg-[#7654d6]/20 border border-[#7654d6]/40 text-[#e9e2ff]">
            In Progress
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-[#1a1827] hover:bg-[#25223a] border border-[#38334f] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Menu
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7654d6] to-[#5b3eb3] hover:from-[#8b6be8] hover:to-[#6a4ac4] shadow-lg shadow-[#7654d6]/40 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" /> Acknowledge & Continue Preview
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};

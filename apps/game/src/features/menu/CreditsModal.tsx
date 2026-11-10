import React from "react";
import { ModalDialog } from "../../components/ui/ModalDialog";
import { GAME_CREDITS } from "../../config/credits";
import { ExternalLink, ShieldCheck } from "lucide-react";

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Project Credits & Verified 3D Assets"
      subtitle="Acknowledging asset creators, open licenses, and contributors"
      maxWidth="lg"
    >
      <div className="space-y-6">
        <div className="p-3.5 rounded-xl bg-[#1c192e] border border-[#3b3452] flex items-start gap-3 text-xs text-zinc-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            SCAMMAZE strictly verifies third-party creative licenses. All 3D environment and vehicle assets
            used in the game street scene are published under Creative Commons Attribution (CC-BY 4.0)
            or permissive open-source licenses with attribution.
          </p>
        </div>

        {GAME_CREDITS.map((group) => (
          <div key={group.category} className="space-y-3">
            <h3 className="text-xs uppercase font-mono tracking-wider text-[#b9a5f5] font-semibold border-b border-[#2d293d] pb-1.5">
              {group.category}
            </h3>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.name}
                  className="p-3.5 rounded-xl bg-[#181625] border border-[#2e2a40] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">{item.name}</span>
                    <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                      {item.license}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    Creator: <span className="text-zinc-200">{item.creator}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.notes}</p>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#b9a5f5] hover:text-white underline pt-1"
                    >
                      View Source on Sketchfab <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ModalDialog>
  );
};

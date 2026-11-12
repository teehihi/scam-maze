import React from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ui/ModalDialog";
import { GAME_CREDITS } from "../../config/credits";
import { ExternalLink, ShieldCheck } from "lucide-react";

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** License name kept verbatim in every language (legal text, not translated). */
const CC_BY_LICENSE = "Creative Commons Attribution (CC-BY 4.0)";

/** Only `https://` sources become links; any other source text stays plain text. */
function isWebSource(sourceUrl: string): boolean {
  return sourceUrl.startsWith("https://");
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation("credits");

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("title")}
      subtitle={t("subtitle")}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <div className="p-3.5 rounded-xl bg-[#1c192e] border border-[#3b3452] flex items-start gap-3 text-xs text-zinc-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{t("licenseNotice", { license: CC_BY_LICENSE })}</p>
        </div>

        {GAME_CREDITS.map((group) => (
          <div key={group.id} className="space-y-3">
            <h3 className="text-xs uppercase font-mono tracking-wider text-[#b9a5f5] font-semibold border-b border-[#2d293d] pb-1.5">
              {t(`groups.${group.id}.category`, { defaultValue: group.category })}
            </h3>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#181625] border border-[#2e2a40] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-sm">{item.name}</span>
                    <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                      {item.license}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {t("creatorLabel")} <span className="text-zinc-200">{item.creator}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t(`items.${item.id}.notes`, { defaultValue: item.notes })}
                  </p>
                  {item.sourceUrl && !isWebSource(item.sourceUrl) && (
                    <div className="text-xs text-zinc-400 pt-1">
                      {t("sourceLabel")} <span className="text-zinc-200">{item.sourceUrl}</span>
                    </div>
                  )}
                  {isWebSource(item.sourceUrl) && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#b9a5f5] hover:text-white underline pt-1"
                    >
                      {t("viewSource")} <ExternalLink className="w-3 h-3" aria-hidden="true" />
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

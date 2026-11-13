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
      maxWidth="wide"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 border-l-2 border-[#7654d6] bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-zinc-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b9a5f5]" aria-hidden="true" />
          <p>{t("licenseNotice", { license: CC_BY_LICENSE })}</p>
        </div>

        {GAME_CREDITS.map((group) => (
          <div key={group.id} className="space-y-3">
            <h3 className="flex items-center gap-2.5 border-b border-white/10 pb-2 font-menu text-base font-semibold uppercase tracking-[0.14em] text-zinc-100">
              <span aria-hidden="true" className="inline-block h-4 w-1.5 -skew-x-12 bg-[#7654d6]" />
              {t(`groups.${group.id}.category`, { defaultValue: group.category })}
            </h3>
            {/* Landscape layout: two cards per row on wide screens. */}
            <div className="grid gap-2 lg:grid-cols-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="space-y-1.5 border border-white/10 bg-white/[0.03] px-4 py-3.5 transition-colors hover:border-white/20"
                >
                  <div className="flex flex-col items-start gap-1.5">
                    <span className="font-menu text-lg font-semibold leading-tight tracking-[0.02em] text-[#f3efe4]">
                      {item.name}
                    </span>
                    <span className="border border-white/15 bg-black/30 px-2 py-0.5 text-[11px] leading-snug text-zinc-300">
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
                      className="inline-flex items-center gap-1.5 pt-1 font-menu text-sm font-semibold uppercase tracking-[0.1em] text-[#c9bbf7] underline-offset-4 hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f3efe4]"
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

import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { AlertTriangle, Monitor, RefreshCw } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

/** Shown as plain text inside `<code>`, never as a link. */
const WEBGL_CHECK_SITE = "get.webgl.org";

interface WebGLFallbackProps {
  /** Technical detail from the renderer. Shown as plain text, not translated. */
  error?: string;
}

export const WebGLFallback: React.FC<WebGLFallbackProps> = ({ error }) => {
  const { t } = useTranslation("loading");

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#0e0c16] text-white text-center">
      <div className="max-w-md p-8 rounded-2xl bg-[#171524] border border-[#3b3552] shadow-2xl space-y-6">
        <BrandLogo className="justify-center" size="lg" />

        <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-7 h-7" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">{t("webgl.heading")}</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{t("webgl.body")}</p>
          {error && (
            <div className="text-xs font-mono text-zinc-500 bg-black/40 p-2.5 rounded border border-zinc-800 break-all text-left">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-black/30 border border-[#2c283d] text-left text-xs text-zinc-300 space-y-2 font-mono">
          <div className="flex items-center gap-2 text-[#b9a5f5] font-semibold">
            <Monitor className="w-4 h-4" aria-hidden="true" /> {t("webgl.troubleshootingTitle")}
          </div>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>{t("webgl.hardwareAcceleration")}</li>
            <li>{t("webgl.updateDriver")}</li>
            <li>
              <Trans
                t={t}
                i18nKey="webgl.checkSupport"
                values={{ site: WEBGL_CHECK_SITE }}
                components={{ code: <code /> }}
              />
            </li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-3 px-4 rounded-xl bg-[#7654d6] hover:bg-[#8b6be8] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#7654d6]/30"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> {t("webgl.reload")}
        </button>
      </div>
    </div>
  );
};

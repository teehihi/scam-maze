import React from "react";
import { AlertTriangle, Monitor, RefreshCw } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

interface WebGLFallbackProps {
  error?: string;
}

export const WebGLFallback: React.FC<WebGLFallbackProps> = ({ error }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#0e0c16] text-white text-center">
      <div className="max-w-md p-8 rounded-2xl bg-[#171524] border border-[#3b3552] shadow-2xl space-y-6">
        <BrandLogo className="justify-center" size="lg" />

        <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">WebGL Acceleration Unavailable</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            SCAMMAZE requires 3D WebGL 2.0 acceleration to render the first-person neighborhood environment.
          </p>
          {error && (
            <div className="text-xs font-mono text-zinc-500 bg-black/40 p-2.5 rounded border border-zinc-800 break-all text-left">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-black/30 border border-[#2c283d] text-left text-xs text-zinc-300 space-y-2 font-mono">
          <div className="flex items-center gap-2 text-[#b9a5f5] font-semibold">
            <Monitor className="w-4 h-4" /> Quick Troubleshooting:
          </div>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Ensure "Hardware Acceleration" is enabled in your browser settings.</li>
            <li>Update your graphics driver or test in Chrome / Edge / Firefox / Safari.</li>
            <li>Check if your browser supports WebGL at <code>get.webgl.org</code>.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-3 px-4 rounded-xl bg-[#7654d6] hover:bg-[#8b6be8] text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#7654d6]/30"
        >
          <RefreshCw className="w-4 h-4" /> Reload Experience
        </button>
      </div>
    </div>
  );
};

import React from "react";
import { Car, Info } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { PlayerStats } from "../player/types";

/** Vehicle model name shown in the HUD; a proper name, never translated. */
export const LEXUS_CAR_NAME = "Lexus GX 550";

/**
 * Map-independent driving HUD: the "[E] get in" prompt near the car, and while driving the
 * driving controls and speedometer. Reuses the driving strings from `worlds:testmove`.
 * Render it inside a full-screen overlay; it positions itself.
 */
export const VehicleHud: React.FC<{
  stats: PlayerStats;
  /** False hides the driving panels; the "[E] get in" prompt is always shown. */
  showPanels?: boolean;
}> = ({ stats, showPanels = true }) => {
  const { t } = useTranslation("worlds");
  const isDriving = Boolean(stats.isDriving);
  const isNearCar = Boolean(stats.isNearCar);

  if (!isDriving && isNearCar) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
        <div
          role="status"
          className="mt-28 flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#1b1535]/95 border border-[#8b5cf6]/60 shadow-[0_0_20px_rgba(139,92,246,0.35)] backdrop-blur-md animate-bounce"
        >
          <kbd className="px-2 py-0.5 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 font-bold font-mono text-xs shadow-md">
            E
          </kbd>
          <span className="text-white text-xs font-semibold tracking-wide">
            {t("testmove.enterCarPrompt", { car: LEXUS_CAR_NAME })}
          </span>
        </div>
      </div>
    );
  }
  if (!isDriving || !showPanels) return null;

  const kmh = (stats.speed * 3.6).toFixed(0);
  const starting = Boolean(stats.isEngineStarting);
  const gearClass = starting
    ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 animate-pulse"
    : stats.carGear === "R"
      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
      : stats.carGear === "D"
        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
        : "bg-zinc-700/50 text-zinc-300";

  return (
    <div className="absolute inset-x-6 bottom-6 sm:inset-x-8 sm:bottom-8 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 pointer-events-none z-40">
      <div className="p-3.5 rounded-xl bg-[#120f22]/85 backdrop-blur-md border border-[#3b3452] shadow-xl text-xs space-y-2 max-w-md">
        <div className="flex items-center gap-2 text-purple-300 font-semibold font-mono text-[11px] uppercase tracking-wider">
          <Car className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>{t("testmove.controls.drivingTitle")}</span>
          <span className="normal-case text-amber-300">· {LEXUS_CAR_NAME}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-300 font-mono">
          <div><span className="text-amber-300 font-bold">W</span> : {t("testmove.driving.accelerate")}</div>
          <div><span className="text-amber-300 font-bold">S</span> : {t("testmove.driving.brakeReverse")}</div>
          <div><span className="text-amber-300 font-bold">A / D</span> : {t("testmove.driving.steer")}</div>
          <div><span className="text-amber-300 font-bold">Space</span> : {t("testmove.driving.handbrake")}</div>
          <div><span className="text-amber-300 font-bold">E</span> : {t("testmove.driving.exit")}</div>
        </div>
        <div className="pt-1.5 border-t border-[#2d2742] text-[10px] text-zinc-400 leading-tight flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          <span>
            <Trans
              t={t}
              i18nKey="testmove.drivingTip"
              components={{ strong: <strong className="text-amber-300" />, key: <strong className="text-amber-300" /> }}
            />
          </span>
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-[#120f22]/85 backdrop-blur-md border border-[#3b3452] text-right font-mono text-[11px] text-zinc-400 space-y-1">
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-zinc-400 text-xs">{t("testmove.telemetry.speedLabel")}</span>
          <span className="text-2xl font-black text-amber-400">{kmh}</span>
          <span className="text-xs text-zinc-400">km/h</span>
          <span className={`px-2 py-0.5 rounded font-black text-xs ${gearClass}`}>
            [{starting ? t("testmove.telemetry.gearStarting") : stats.carGear || "P"}]
          </span>
        </div>
        <div className={`text-[10px] font-semibold ${starting ? "text-amber-300 animate-pulse" : "text-emerald-400"}`}>
          {starting ? t("testmove.telemetry.engineStarting") : t("testmove.telemetry.engineRunning")}
        </div>
      </div>
    </div>
  );
};

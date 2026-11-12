import React from "react";
import { ArrowLeft, Crosshair, Eye, Car, Info } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import type { PlayerStats } from "../player";

/** Vehicle model name shown in the HUD; a proper name, never translated. */
const CAR_NAME = "Lexus GX 550";

interface TestMoveOverlayProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onBackToMenu: () => void;
  stats: PlayerStats;
}

export const TestMoveOverlay: React.FC<TestMoveOverlayProps> = ({
  isLocked,
  onToggleLock,
  onBackToMenu,
  stats,
}) => {
  const { t } = useTranslation("worlds");
  const isDriving = Boolean(stats.isDriving);
  const isNearCar = Boolean(stats.isNearCar);
  const kmh = (stats.speed * 3.6).toFixed(0);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 flex flex-col justify-between p-6 sm:p-8">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between w-full">
        <button
          type="button"
          onClick={onBackToMenu}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1b172b]/85 hover:bg-[#28233f] border border-[#3b3452] text-xs font-semibold text-zinc-200 transition-all shadow-lg hover:border-[#7654d6] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-purple-400" />
          <span>{t("testmove.backToMenu")}</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Vehicle status pill if driving */}
          {isDriving && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-600/20 border border-amber-400/40 text-xs font-semibold text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse">
              <Car className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{CAR_NAME} (4WD)</span>
            </div>
          )}

          {/* Pointer Lock Status Pill */}
          <button
            type="button"
            onClick={onToggleLock}
            className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1b172b]/85 hover:bg-[#252237] border border-[#3b3452] text-xs font-mono text-zinc-300 transition-all shadow-lg cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${isLocked ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span>{isLocked ? t("testmove.mouseLocked") : t("testmove.mouseUnlocked")}</span>
          </button>
        </div>
      </header>

      {/* Center Reticle / Crosshair (hidden while driving) */}
      {!isDriving && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div className={`w-1.5 h-1.5 rounded-full ${isNearCar ? "bg-amber-300 shadow-[0_0_10px_#f59e0b]" : "bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.9)]"}`} />
            <div className={`absolute w-6 h-6 border rounded-full transition-all ${isNearCar ? "border-amber-400 scale-125" : "border-white/30"}`} />
          </div>
        </div>
      )}

      {/* Interactive Floating Prompt when near car */}
      {isNearCar && !isDriving && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="mt-28 flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#1b1535]/95 border border-[#8b5cf6]/60 shadow-[0_0_20px_rgba(139,92,246,0.35)] backdrop-blur-md animate-bounce">
            <kbd className="px-2 py-0.5 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-zinc-950 font-bold font-mono text-xs shadow-md">
              E
            </kbd>
            <span className="text-white text-xs font-semibold tracking-wide">
              {t("testmove.enterCarPrompt", { car: CAR_NAME })}
            </span>
          </div>
        </div>
      )}

      {/* Click-to-lock prompt banner (shown when mouse is unlocked) */}
      {!isLocked && (
        <div className="my-auto mx-auto pointer-events-auto flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#120f22]/90 backdrop-blur-md border border-[#3b3452] shadow-2xl text-center max-w-md animate-fade-in">
          <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Eye className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">{t("testmove.lockPrompt.title")}</h3>
            <p className="text-xs text-zinc-300">
              <Trans
                t={t}
                i18nKey="testmove.lockPrompt.body"
                components={{
                  kbd: <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-amber-300" />,
                }}
              />
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleLock}
            className="mt-1 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg hover:shadow-purple-500/30 cursor-pointer"
          >
            {t("testmove.lockPrompt.start")}
          </button>
        </div>
      )}

      {/* Bottom HUD: Control Guide & Realtime Physics Data */}
      <footer className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 w-full">
        {/* Controls Guide */}
        <div className="p-3.5 rounded-xl bg-[#120f22]/85 backdrop-blur-md border border-[#3b3452] shadow-xl text-xs space-y-2 max-w-md">
          <div className="flex items-center gap-2 text-purple-300 font-semibold font-mono text-[11px] uppercase tracking-wider">
            {isDriving ? (
              <Car className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
            )}
            <span>{isDriving ? t("testmove.controls.drivingTitle") : t("testmove.controls.title")}</span>
          </div>

          {isDriving ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-300 font-mono">
              <div><span className="text-amber-300 font-bold">W</span> : {t("testmove.driving.accelerate")}</div>
              <div><span className="text-amber-300 font-bold">S</span> : {t("testmove.driving.brakeReverse")}</div>
              <div><span className="text-amber-300 font-bold">A / D</span> : {t("testmove.driving.steer")}</div>
              <div><span className="text-amber-300 font-bold">Space</span> : {t("testmove.driving.handbrake")}</div>
              <div><span className="text-amber-300 font-bold">E</span> : {t("testmove.driving.exit")}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-300 font-mono">
              <div><span className="text-amber-300 font-bold">W A S D</span> : {t("testmove.controls.move")}</div>
              <div><span className="text-amber-300 font-bold">Shift</span> : {t("testmove.controls.sprint")}</div>
              <div><span className="text-amber-300 font-bold">Space</span> : {t("testmove.controls.jump")}</div>
              <div><span className="text-amber-300 font-bold">{t("testmove.controls.leftClickOrF")}</span> : {t("testmove.controls.punch")}</div>
              <div><span className="text-amber-300 font-bold">{t("testmove.controls.rightClick")}</span> : {t("testmove.controls.block")}</div>
              <div><span className="text-amber-300 font-bold">E</span> : {t("testmove.controls.interact")}</div>
              <div><span className="text-amber-300 font-bold">T / I</span> : {t("testmove.controls.inspect")}</div>
              <div><span className="text-amber-300 font-bold">Ctrl</span> : {t("testmove.controls.toggleMouse")}</div>
            </div>
          )}

          {/* Context tip */}
          <div className="pt-1.5 border-t border-[#2d2742] text-[10px] text-zinc-400 leading-tight flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              {isDriving ? (
                <Trans
                  t={t}
                  i18nKey="testmove.drivingTip"
                  components={{
                    strong: <strong className="text-amber-300" />,
                    key: <strong className="text-amber-300" />,
                  }}
                />
              ) : (
                <Trans
                  t={t}
                  i18nKey="testmove.walkingTip"
                  values={{ car: CAR_NAME }}
                  components={{
                    strong: <strong className="text-zinc-300" />,
                    key: <strong className="text-amber-300" />,
                  }}
                />
              )}
            </span>
          </div>
        </div>

        {/* Real-time telemetry */}
        <div className="p-3.5 rounded-xl bg-[#120f22]/85 backdrop-blur-md border border-[#3b3452] text-right font-mono text-[11px] text-zinc-400 space-y-1">
          {isDriving ? (
            <>
              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="text-zinc-400 text-xs">{t("testmove.telemetry.speedLabel")}</span>
                <span className="text-2xl font-black text-amber-400">{kmh}</span>
                <span className="text-xs text-zinc-400">km/h</span>
                <span className={`px-2 py-0.5 rounded font-black text-xs ${stats.isEngineStarting ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 animate-pulse" : stats.carGear === "R" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : stats.carGear === "D" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-zinc-700/50 text-zinc-300"}`}>
                  [{stats.isEngineStarting ? t("testmove.telemetry.gearStarting") : stats.carGear || "P"}]
                </span>
              </div>
              <div>
                <Trans
                  t={t}
                  i18nKey="testmove.telemetry.positionZ"
                  values={{ z: stats.position[2].toFixed(1) }}
                  components={{ value: <span className="text-zinc-200" /> }}
                />
              </div>
              <div className={`text-[10px] font-semibold ${stats.isEngineStarting ? "text-amber-300 animate-pulse" : "text-emerald-400"}`}>
                {stats.isEngineStarting ? t("testmove.telemetry.engineStarting") : t("testmove.telemetry.engineRunning")}
              </div>
            </>
          ) : (
            <>
              <div>
                <Trans
                  t={t}
                  i18nKey="testmove.telemetry.speed"
                  values={{ speed: stats.speed.toFixed(1) }}
                  components={{ value: <span className="text-emerald-400 font-bold" /> }}
                />
                {stats.isSprinting && <span className="ml-1 text-purple-300 text-[10px] font-bold">{t("testmove.telemetry.sprint")}</span>}
              </div>
              <div>
                <Trans
                  t={t}
                  i18nKey="testmove.telemetry.positionZ"
                  values={{ z: stats.position[2].toFixed(1) }}
                  components={{ value: <span className="text-zinc-200" /> }}
                />
              </div>
              <div className="text-[10px] text-zinc-500">
                {stats.isGrounded ? t("testmove.telemetry.stateGrounded") : t("testmove.telemetry.stateAirborne")}
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

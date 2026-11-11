import React from "react";
import { ArrowLeft, Crosshair, Eye, Car, Info } from "lucide-react";
import type { PlayerStats } from "../player";

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
          <span>Về Menu Chính</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Vehicle status pill if driving */}
          {isDriving && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-600/20 border border-amber-400/40 text-xs font-semibold text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse">
              <Car className="w-3.5 h-3.5 text-amber-400" />
              <span>Lexus GX 550 (4WD)</span>
            </div>
          )}

          {/* Pointer Lock Status Pill */}
          <button
            type="button"
            onClick={onToggleLock}
            className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1b172b]/85 hover:bg-[#252237] border border-[#3b3452] text-xs font-mono text-zinc-300 transition-all shadow-lg cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${isLocked ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span>{isLocked ? "MOUSE LOCKED (Ctrl: mở)" : "MOUSE UNLOCKED (Click: khoá)"}</span>
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
              Lên xe Lexus GX 550 (Lái xe)
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
            <h3 className="text-base font-bold text-white">Chế độ Thử Nghiệm Di Chuyển 3D</h3>
            <p className="text-xs text-zinc-300">
              Nhấn chuột vào màn hình hoặc bấm phím <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-amber-300">Ctrl</kbd> để khóa chuột và xoay góc nhìn.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleLock}
            className="mt-1 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg hover:shadow-purple-500/30 cursor-pointer"
          >
            Bắt đầu Điều Khiển
          </button>
        </div>
      )}

      {/* Bottom HUD: Control Guide & Realtime Physics Data */}
      <footer className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 w-full">
        {/* Controls Guide */}
        <div className="p-3.5 rounded-xl bg-[#120f22]/85 backdrop-blur-md border border-[#3b3452] shadow-xl text-xs space-y-2 max-w-md">
          <div className="flex items-center gap-2 text-purple-300 font-semibold font-mono text-[11px] uppercase tracking-wider">
            {isDriving ? <Car className="w-3.5 h-3.5 text-amber-400" /> : <Crosshair className="w-3.5 h-3.5 text-purple-400" />}
            <span>{isDriving ? "Điều khiển Lái Xe:" : "Phím điều khiển:"}</span>
          </div>

          {isDriving ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-300 font-mono">
              <div><span className="text-amber-300 font-bold">W</span> : Đạp ga (Tăng tốc)</div>
              <div><span className="text-amber-300 font-bold">S</span> : Phanh / Số lùi</div>
              <div><span className="text-amber-300 font-bold">A / D</span> : Đánh lái vô lăng</div>
              <div><span className="text-amber-300 font-bold">Space</span> : Phanh tay</div>
              <div><span className="text-amber-300 font-bold">E</span> : Xuống xe (dừng lại)</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-300 font-mono">
              <div><span className="text-amber-300 font-bold">W A S D</span> : Di chuyển</div>
              <div><span className="text-amber-300 font-bold">Shift</span> : Chạy nhanh</div>
              <div><span className="text-amber-300 font-bold">Space</span> : Nhảy</div>
              <div><span className="text-amber-300 font-bold">Chuột Trái / F</span> : Đấm</div>
              <div><span className="text-amber-300 font-bold">Chuột Phải</span> : Đỡ đòn (Block)</div>
              <div><span className="text-amber-300 font-bold">E</span> : Tương tác / Vào xe</div>
              <div><span className="text-amber-300 font-bold">T / I</span> : Xem tay (Inspect)</div>
              <div><span className="text-amber-300 font-bold">Ctrl</span> : Ẩn/Hiện chuột</div>
            </div>
          )}

          {/* Context tip */}
          <div className="pt-1.5 border-t border-[#2d2742] text-[10px] text-zinc-400 leading-tight flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {isDriving ? (
              <span><strong className="text-amber-300">Mẹo:</strong> Nhấn <strong className="text-amber-300">E</strong> khi xe dừng để xuống xe. Lia chuột để xoay nhìn quanh cabin!</span>
            ) : (
              <span><strong className="text-zinc-300">Mac Trackpad tip:</strong> Đi lại gần cửa xe Lexus GX 550 và nhấn <strong className="text-amber-300">E</strong> để vào xe lái!</span>
            )}
          </div>
        </div>

        {/* Real-time telemetry */}
        <div className="p-3.5 rounded-xl bg-[#120f22]/85 backdrop-blur-md border border-[#3b3452] text-right font-mono text-[11px] text-zinc-400 space-y-1">
          {isDriving ? (
            <>
              <div className="flex items-center justify-end gap-2 text-sm">
                <span className="text-zinc-400 text-xs">Tốc độ:</span>
                <span className="text-2xl font-black text-amber-400">{kmh}</span>
                <span className="text-xs text-zinc-400">km/h</span>
                <span className={`px-2 py-0.5 rounded font-black text-xs ${stats.isEngineStarting ? "bg-amber-500/25 text-amber-300 border border-amber-500/50 animate-pulse" : stats.carGear === "R" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : stats.carGear === "D" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-zinc-700/50 text-zinc-300"}`}>
                  [{stats.isEngineStarting ? "P - NỔ MÁY..." : stats.carGear || "P"}]
                </span>
              </div>
              <div>
                Vị trí Z: <span className="text-zinc-200">{stats.position[2].toFixed(1)}m</span> (Đường Q4)
              </div>
              <div className={`text-[10px] font-semibold ${stats.isEngineStarting ? "text-amber-300 animate-pulse" : "text-emerald-400"}`}>
                {stats.isEngineStarting ? "Động cơ: Đang khởi động (Chờ nổ máy)..." : "Động cơ: V8 Twin-Turbo Đang Nổ Máy"}
              </div>
            </>
          ) : (
            <>
              <div>
                Tốc độ: <span className="text-emerald-400 font-bold">{stats.speed.toFixed(1)} m/s</span>
                {stats.isSprinting && <span className="ml-1 text-purple-300 text-[10px] font-bold">[SPRINT]</span>}
              </div>
              <div>
                Vị trí Z: <span className="text-zinc-200">{stats.position[2].toFixed(1)}m</span> (Đường Q4)
              </div>
              <div className="text-[10px] text-zinc-500">
                Trạng thái: {stats.isGrounded ? "Mặt đất" : "Trên không"}
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
};

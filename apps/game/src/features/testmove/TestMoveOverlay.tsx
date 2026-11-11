import React from "react";
import { ArrowLeft, Crosshair, Eye } from "lucide-react";

interface TestMoveOverlayProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onBackToMenu: () => void;
  stats: {
    position: [number, number, number];
    speed: number;
    isSprinting: boolean;
    isGrounded: boolean;
  };
}

export const TestMoveOverlay: React.FC<TestMoveOverlayProps> = ({
  isLocked,
  onToggleLock,
  onBackToMenu,
  stats,
}) => {
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

      {/* Center Reticle / Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          <div className="absolute w-6 h-6 border border-white/30 rounded-full" />
        </div>
      </div>

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
            <Crosshair className="w-3.5 h-3.5 text-purple-400" />
            <span>Phím điều khiển:</span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-zinc-300 font-mono">
            <div><span className="text-amber-300 font-bold">W A S D</span> : Di chuyển</div>
            <div><span className="text-amber-300 font-bold">Shift</span> : Chạy nhanh</div>
            <div><span className="text-amber-300 font-bold">Space</span> : Nhảy</div>
            <div><span className="text-amber-300 font-bold">Chuột Trái / F</span> : Đấm</div>
            <div><span className="text-amber-300 font-bold">Chuột Phải</span> : Đỡ đòn (Block)</div>
            <div><span className="text-amber-300 font-bold">E</span> : Tương tác</div>
            <div><span className="text-amber-300 font-bold">T / I</span> : Xem tay (Inspect)</div>
            <div><span className="text-amber-300 font-bold">Ctrl</span> : Ẩn/Hiện chuột</div>
          </div>

          {/* Mac Trackpad Tip */}
          <div className="pt-1.5 border-t border-[#2d2742] text-[10px] text-zinc-400 leading-tight">
            💡 <strong className="text-zinc-300">Mac Trackpad tip:</strong> Vuốt 1 ngón để lia camera mượt mà, dùng phím <strong className="text-amber-300">F</strong> để đấm mà không cần gõ mạnh trackpad!
          </div>
        </div>

        {/* Real-time telemetry */}
        <div className="p-3 rounded-xl bg-[#120f22]/85 backdrop-blur-md border border-[#3b3452] text-right font-mono text-[11px] text-zinc-400 space-y-1">
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
        </div>
      </footer>
    </div>
  );
};

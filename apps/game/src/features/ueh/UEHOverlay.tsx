import React from "react";
import { ArrowLeft, Eye, Music, Sparkles } from "lucide-react";

interface UEHOverlayProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onBackToMenu: () => void;
  isNearGuitar?: boolean;
  currentTrack?: string;
  activeToast?: string | null;
  stats: {
    position: [number, number, number];
    speed: number;
    isSprinting: boolean;
    isGrounded: boolean;
  };
}

export const UEHOverlay: React.FC<UEHOverlayProps> = ({
  isLocked,
  onToggleLock,
  onBackToMenu,
  isNearGuitar = false,
  currentTrack = "mua-ha",
  activeToast = null,
  stats,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none z-30 flex flex-col justify-between p-6 sm:p-8">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMenu}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1f2d]/85 hover:bg-[#133045] border border-[#1e4659] text-xs font-semibold text-zinc-100 transition-all shadow-lg hover:border-[#00a896] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#4dd8ff]" />
            <span>Về Menu Chính</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#005f69]/40 border border-[#00a896]/30 text-xs font-medium text-emerald-100 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#f26f33]" />
            <span>
              UEH CAMPUS · {currentTrack === "mua-ha" ? "MÙA HẠ THỨ 18 (MƯA RÀO)" : "NẾU NGÀY MAI (HOA PHƯỢNG BAY)"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Pointer Lock Status Pill */}
          <button
            type="button"
            onClick={onToggleLock}
            className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0d1f2d]/85 hover:bg-[#172f3e] border border-[#1e4659] text-xs font-mono text-zinc-300 transition-all shadow-lg cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${isLocked ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span>{isLocked ? "MOUSE LOCKED (Ctrl: mở)" : "MOUSE UNLOCKED (Click: khoá)"}</span>
          </button>
        </div>
      </header>

      {/* Floating Strum / Track Toast Notification */}
      {activeToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#071620]/95 border border-[#00a896] shadow-2xl text-xs font-medium text-emerald-200 animate-fade-in backdrop-blur-md z-40">
          <Music className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>{activeToast}</span>
        </div>
      )}

      {/* Center Reticle / Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          <div className="absolute w-6 h-6 border border-white/35 rounded-full" />
        </div>
      </div>

      {/* Interactive Prompt: [E] Strum Guitar on Bench */}
      {isNearGuitar && isLocked && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-12 pointer-events-none flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#071a26]/95 border border-[#00a896] text-white shadow-2xl backdrop-blur-md animate-bounce-subtle z-40">
          <kbd className="px-2.5 py-1 rounded-lg bg-[#005f69] text-amber-300 font-extrabold font-mono text-sm border border-[#00a896] shadow-md">
            E
          </kbd>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-emerald-200">Gảy Đàn Guitar · Đổi Giai Điệu</span>
            <span className="text-[10px] text-zinc-300">
              Đổi sang: <strong className="text-amber-300">{currentTrack === "mua-ha" ? "Nếu Ngày Mai (Hoa phượng bay)" : "Mùa Hạ Thứ 18 (Cơn mưa hạ)"}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Click-to-lock prompt banner (shown when mouse is unlocked) */}
      {!isLocked && (
        <div className="my-auto mx-auto pointer-events-auto flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#071620]/92 backdrop-blur-md border border-[#1e4659] shadow-2xl text-center max-w-md animate-fade-in">
          <div className="w-10 h-10 rounded-full bg-[#005f69]/30 border border-[#00a896]/50 flex items-center justify-center text-[#4dd8ff]">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">Khám Phá Khuôn Viên UEH</h3>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Nhấn chuột vào màn hình hoặc bấm phím <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[11px] border border-zinc-700">Ctrl</kbd> để khóa chuột và điều khiển góc nhìn.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleLock}
            className="mt-1 px-5 py-2 rounded-xl bg-gradient-to-r from-[#005f69] to-[#028090] hover:from-[#028090] hover:to-[#00a896] text-white text-xs font-semibold shadow-lg shadow-teal-900/40 transition-all cursor-pointer"
          >
            Bắt đầu Điều Khiển
          </button>
        </div>
      )}

      {/* Bottom Status & Controls Guide */}
      <footer className="flex flex-col sm:flex-row items-end sm:items-end justify-between gap-4 w-full">
        {/* Controls cheat sheet */}
        <div className="p-3.5 rounded-2xl bg-[#091b26]/85 backdrop-blur-md border border-[#1e4659]/80 text-[11px] text-zinc-300 shadow-xl max-w-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#4dd8ff] uppercase tracking-wider mb-2">
            <span>PHÍM ĐIỀU KHIỂN:</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
            <div>
              <span className="text-amber-300 font-semibold">W A S D</span>
              <span className="text-zinc-400"> : Di chuyển</span>
            </div>
            <div>
              <span className="text-amber-300 font-semibold">Shift</span>
              <span className="text-zinc-400"> : Chạy nhanh</span>
            </div>
            <div>
              <span className="text-amber-300 font-semibold">Space</span>
              <span className="text-zinc-400"> : Nhảy</span>
            </div>
            <div>
              <span className="text-amber-300 font-semibold">Chuột Trái / F</span>
              <span className="text-zinc-400"> : Đấm</span>
            </div>
            <div>
              <span className="text-amber-300 font-semibold">Chuột Phải</span>
              <span className="text-zinc-400"> : Đỡ đòn (Block)</span>
            </div>
            <div>
              <span className="text-amber-300 font-semibold">E</span>
              <span className="text-zinc-400"> : Tương tác (Đàn)</span>
            </div>
            <div>
              <span className="text-amber-300 font-semibold">T / I</span>
              <span className="text-zinc-400"> : Xem tay</span>
            </div>
            <div className="col-span-2">
              <span className="text-amber-300 font-semibold">Ctrl</span>
              <span className="text-zinc-400"> : Ẩn / Hiện chuột</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800 text-[10px] text-zinc-400">
            💡 Tiến lại ghế đá dưới tán phượng và bấm phím <strong className="text-amber-300">E</strong> để gảy đàn guitar & đổi giai điệu / thời tiết.
          </div>
        </div>

        {/* Live coordinate & speed HUD telemetry */}
        <div className="p-3 rounded-2xl bg-[#091b26]/85 backdrop-blur-md border border-[#1e4659]/80 text-[11px] font-mono text-zinc-300 shadow-xl flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Tốc độ:</span>
            <span className="text-emerald-400 font-bold">{stats.speed.toFixed(1)} m/s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Tọa độ:</span>
            <span className="text-zinc-200">
              X:{stats.position[0].toFixed(1)} Z:{stats.position[2].toFixed(1)}
            </span>
          </div>
          <div className="text-[10px] text-zinc-400">
            {stats.isGrounded ? "Mặt sân trường" : "Đang nhảy"}
          </div>
        </div>
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { ArrowLeft, Sparkles, HelpCircle } from 'lucide-react';
import type { PlayerStats } from '../engine/HueWorldEngine';

interface HueHUDProps {
  isLocked: boolean;
  onToggleLock: () => void;
  stats: PlayerStats;
  bellToast?: boolean;
  onBackToMenu?: () => void;
}

export const HueHUD: React.FC<HueHUDProps> = ({
  isLocked,
  onToggleLock,
  stats,
  bellToast,
  onBackToMenu,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-5 select-none">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          {onBackToMenu && (
            <button
              type="button"
              onClick={onBackToMenu}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1f2d]/90 hover:bg-[#133045] border border-[#1e4659] text-xs font-semibold text-zinc-100 transition-all shadow-lg hover:border-[#4dd8ff] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#4dd8ff]" />
              <span>Về Menu Chính</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1b172b]/80 border border-[#d6b372]/30 text-xs font-medium text-[#fae7c2] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#e5c17b]" />
            <span>CỐ ĐÔ HUẾ · DI SẢN BỜ HƯƠNG GIANG</span>
          </div>
        </div>

        {/* Top-Right Pointer Lock Status Pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLock}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0d1f2d]/85 hover:bg-[#172f3e] border border-[#1e4659] text-xs font-mono text-zinc-300 transition-all shadow-lg cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${isLocked ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isLocked ? 'MOUSE LOCKED (Ctrl: mở)' : 'MOUSE UNLOCKED (Click: khoá)'}</span>
          </button>
        </div>
      </header>

      {/* Center Reticle / Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/85 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          <div className="absolute w-6 h-6 border border-white/35 rounded-full" />
        </div>
      </div>

      {/* Subtle bottom-center click-to-lock hint (non-blocking) */}
      {!isLocked && (
        <div
          className="pointer-events-auto mx-auto mb-2 flex items-center gap-2 px-4 py-2 rounded-full bg-[#071620]/90 border border-[#1e4659]/80 shadow-lg text-xs text-zinc-300 animate-fade-in backdrop-blur-md cursor-pointer hover:border-[#4dd8ff] transition-all"
          onClick={onToggleLock}
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Click chuột vào màn hình hoặc bấm <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[10px] border border-zinc-700">Ctrl</kbd> để điều khiển góc nhìn</span>
        </div>
      )}

      {/* Subtle Bell Resonance Notification */}
      {bellToast && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 rounded-full border border-[#e5c17b]/45 bg-[#161a22]/85 px-5 py-2 text-xs tracking-wide text-[#f7e7c5] shadow-lg backdrop-blur-md z-40">
          🔔 Tiếng Đại Hồng Chung Thiên Mụ vang vọng đôi bờ Sông Hương…
        </div>
      )}

      {/* Bottom row: Clean layout with controls tucked to the RIGHT as requested */}
      <footer className="w-full flex items-end justify-between gap-4">
        {/* Left side: minimal quick hint toggle */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#091b26]/80 hover:bg-[#0f2838] border border-[#1e4659]/80 text-[11px] font-mono text-zinc-300 transition-all shadow-md cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Phím điều khiển</span>
            <span className="text-amber-400 font-bold ml-1">{showHelp ? '✕' : '?'}</span>
          </button>
        </div>

        {/* Right side: Controls card (if open) + Telemetry coordinates */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          {showHelp && (
            <div className="p-3.5 rounded-2xl bg-[#091b26]/92 backdrop-blur-md border border-[#1e4659] text-[11px] text-zinc-300 shadow-2xl max-w-sm animate-fade-in">
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
                  <span className="text-zinc-400"> : Đỡ đòn</span>
                </div>
                <div>
                  <span className="text-amber-300 font-semibold">E</span>
                  <span className="text-zinc-400"> : Tương tác</span>
                </div>
                <div>
                  <span className="text-amber-300 font-semibold">T / I</span>
                  <span className="text-zinc-400"> : Xem tay</span>
                </div>
                <div>
                  <span className="text-amber-300 font-semibold">G</span>
                  <span className="text-zinc-400"> : Thỉnh chuông</span>
                </div>
                <div>
                  <span className="text-amber-300 font-semibold">Ctrl</span>
                  <span className="text-zinc-400"> : Chuột</span>
                </div>
                <div>
                  <span className="text-emerald-400 font-semibold">F3</span>
                  <span className="text-zinc-400"> : Khung va chạm</span>
                </div>
              </div>
            </div>
          )}

          {/* Live telemetry coordinates & speed */}
          <div className="p-2.5 px-3.5 rounded-2xl bg-[#091b26]/85 backdrop-blur-md border border-[#1e4659]/80 text-[11px] font-mono text-zinc-300 shadow-xl flex items-center gap-3">
            <div>
              <span className="text-zinc-400">Tốc độ: </span>
              <span className="text-emerald-400 font-bold">{stats.speed.toFixed(1)} m/s</span>
            </div>
            <div className="text-zinc-500">|</div>
            <div>
              <span className="text-zinc-400">Tọa độ: </span>
              <span className="text-zinc-200">
                X:{stats.position[0].toFixed(1)} Y:{stats.position[1].toFixed(1)} Z:{stats.position[2].toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

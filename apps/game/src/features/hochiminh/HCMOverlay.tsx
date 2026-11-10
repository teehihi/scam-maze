import React, { useState } from "react";
import {
  ArrowLeft,
  Sun,
  Moon,
  Sunset,
  Cpu,
  MapPin,
  Compass,
  RotateCw,
  Info,
  Maximize2,
  Minimize2,
  X,
  Layers,
} from "lucide-react";
import {
  HCM_VIEW_PRESETS,
  type HCMThemeId,
  type LandmarkInfo,
  type ViewPreset,
} from "./types";

interface HCMOverlayProps {
  theme: HCMThemeId;
  onChangeTheme: (theme: HCMThemeId) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  showLandmarks: boolean;
  onToggleLandmarks: () => void;
  activeView: ViewPreset | null;
  onSelectView: (preset: ViewPreset) => void;
  selectedLandmark: LandmarkInfo | null;
  onClearSelectedLandmark: () => void;
  onBackToMenu: () => void;
}

export const HCMOverlay: React.FC<HCMOverlayProps> = ({
  theme,
  onChangeTheme,
  autoRotate,
  onToggleAutoRotate,
  showLandmarks,
  onToggleLandmarks,
  activeView,
  onSelectView,
  selectedLandmark,
  onClearSelectedLandmark,
  onBackToMenu,
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const THEMES: { id: HCMThemeId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "daylight", label: "Ban Ngày", icon: Sun },
    { id: "cyberpunk", label: "Cyberpunk", icon: Moon },
    { id: "sunset", label: "Hoàng Hôn", icon: Sunset },
    { id: "blueprint", label: "Bản Đồ Tech", icon: Cpu },
  ];

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 pointer-events-none select-none">
      {/* Top Header Navigation Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 w-full">
        {/* Left: Back & Title Badge */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={onBackToMenu}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#13111f]/90 hover:bg-[#201d33] border border-[#3b3554] text-zinc-200 hover:text-white backdrop-blur-xl transition-all cursor-pointer shadow-lg active:scale-95"
            title="Quay lại Menu Game"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold tracking-wide">Menu Game</span>
          </button>

          <div className="hidden sm:flex flex-col px-3.5 py-1.5 rounded-xl bg-[#13111f]/85 border border-[#3b3554] backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-xs font-bold tracking-wider text-zinc-100 uppercase">
                TP. Hồ Chí Minh 2025 · 3D Map
              </h1>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              Bến Nghé · Bến Thành · Thủ Thiêm · Sông Sài Gòn
            </p>
          </div>
        </div>

        {/* Right: Theme Switcher & Utility Tools */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Theme Selector */}
          <div className="flex items-center p-1 rounded-xl bg-[#13111f]/90 border border-[#3b3554] backdrop-blur-xl shadow-lg">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChangeTheme(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-md font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#232038]"
                  }`}
                  title={t.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Auto-rotate Toggle */}
          <button
            type="button"
            onClick={onToggleAutoRotate}
            className={`p-2 rounded-xl border backdrop-blur-xl transition-all cursor-pointer shadow-lg ${
              autoRotate
                ? "bg-emerald-950/80 border-emerald-600 text-emerald-400"
                : "bg-[#13111f]/90 border-[#3b3554] text-zinc-400 hover:text-white"
            }`}
            title={autoRotate ? "Dừng tự động xoay" : "Bật tự động xoay"}
          >
            <RotateCw className={`w-4 h-4 ${autoRotate ? "animate-spin" : ""}`} />
          </button>

          {/* Landmark Pins Toggle */}
          <button
            type="button"
            onClick={onToggleLandmarks}
            className={`p-2 rounded-xl border backdrop-blur-xl transition-all cursor-pointer shadow-lg ${
              showLandmarks
                ? "bg-amber-950/80 border-amber-600 text-amber-400"
                : "bg-[#13111f]/90 border-[#3b3554] text-zinc-400 hover:text-white"
            }`}
            title={showLandmarks ? "Ẩn địa danh" : "Hiện địa danh 3D"}
          >
            <MapPin className="w-4 h-4" />
          </button>

          {/* Info Modal Button */}
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="p-2 rounded-xl bg-[#13111f]/90 hover:bg-[#201d33] border border-[#3b3554] text-zinc-300 hover:text-white backdrop-blur-xl transition-all cursor-pointer shadow-lg"
            title="Thông tin mô hình 3D"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl bg-[#13111f]/90 hover:bg-[#201d33] border border-[#3b3554] text-zinc-300 hover:text-white backdrop-blur-xl transition-all cursor-pointer shadow-lg"
            title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Selected Landmark Info Card (Bottom-Left) */}
      {selectedLandmark && (
        <div className="pointer-events-auto max-w-sm mb-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="p-4 rounded-2xl bg-[#12101f]/95 border border-sky-500/40 backdrop-blur-2xl shadow-2xl relative">
            <button
              type="button"
              onClick={onClearSelectedLandmark}
              className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-lg bg-sky-500/20 text-sky-400">
                <MapPin className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Địa Danh Nổi Bật
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-0.5">
              {selectedLandmark.name}
            </h3>
            <p className="text-xs font-medium text-amber-300/90 mb-2">
              {selectedLandmark.title}
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {selectedLandmark.description}
            </p>
          </div>
        </div>
      )}

      {/* Bottom Floating View Preset Dock */}
      <footer className="w-full flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-[#12101f]/90 border border-[#3b3554] backdrop-blur-xl shadow-2xl pointer-events-auto max-w-full overflow-x-auto">
          <div className="hidden sm:flex items-center gap-1 px-2.5 text-zinc-400 text-[11px] font-medium border-r border-[#3b3554]/70">
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Góc nhìn:</span>
          </div>

          {HCM_VIEW_PRESETS.map((preset) => {
            const isActive = activeView?.id === preset.id && !selectedLandmark;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectView(preset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-sky-600 text-white shadow-md font-semibold ring-1 ring-sky-400/50"
                    : "text-zinc-300 hover:text-white hover:bg-[#221e36]"
                }`}
                title={preset.description}
              >
                {preset.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-zinc-400/80 font-mono tracking-wider text-center drop-shadow">
          Kéo chuột trái để xoay · Chuột phải để di chuyển · Lăn chuột để phóng to/thu nhỏ
        </div>
      </footer>

      {/* Info Modal Dialog */}
      {infoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md pointer-events-auto">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#131122] border border-[#3d3657] shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2d2842]">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  Mô Hình 3D TP. Hồ Chí Minh
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                Bản đồ mô phỏng không gian 3D tỷ lệ thực tế của trung tâm{" "}
                <strong className="text-white">Thành phố Hồ Chí Minh (2025)</strong>, bao gồm dải skyline Quận 1, khu Bến Nghé, Bến Thành, sông Sài Gòn và bán đảo Thủ Thiêm (TP. Thủ Đức).
              </p>
              <div className="p-3 rounded-xl bg-[#1b172e] border border-[#3b3456] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Quy mô hiển thị:</span>
                  <span className="text-emerald-400 font-semibold">~9 km² (3km x 3km)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Số lượng đỉnh (Vertices):</span>
                  <span className="text-sky-400 font-semibold">493,715 vertices</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Hệ thống tạo màu:</span>
                  <span className="text-amber-400 font-semibold">Dynamic Height & Normal Shading</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Bản quyền 3D:</span>
                  <span className="text-zinc-200">Saigon 3D City (CC-BY-4.0)</span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400">
                Toàn bộ màu sắc kiến trúc (mái ngói terracotta, tường biệt thự vàng thuộc địa, kính phản quang cao ốc, mặt nước sông Sài Gòn) được phân tích và tạo màu thủ công kết hợp thuật toán tính toán độ cao và hướng pháp tuyến.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs cursor-pointer transition-colors shadow-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

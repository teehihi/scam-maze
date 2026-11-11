import React, { useState, Suspense } from "react";
import { HCMCanvas } from "./HCMCanvas";
import { HCMOverlay } from "./HCMOverlay";
import {
  HCM_VIEW_PRESETS,
  type HCMThemeId,
  type LandmarkInfo,
  type ViewPreset,
} from "./types";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HCMPageProps {
  onBackToMenu: () => void;
}

export const HCMPage: React.FC<HCMPageProps> = ({ onBackToMenu }) => {
  const [theme, setTheme] = useState<HCMThemeId>("daylight");
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<ViewPreset | null>(HCM_VIEW_PRESETS[0]);
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkInfo | null>(null);

  const handleSelectView = (preset: ViewPreset) => {
    setSelectedLandmark(null);
    setActiveView(preset);
  };

  const handleSelectLandmark = (landmark: LandmarkInfo) => {
    setSelectedLandmark(landmark);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#090b14]">
      {/* 3D WebGL Canvas Layer */}
      <Suspense fallback={<HCMLoadingFallback />}>
        <HCMCanvas
          theme={theme}
          showLandmarks={showLandmarks}
          autoRotate={autoRotate}
          selectedLandmark={selectedLandmark}
          activeView={activeView}
          onSelectLandmark={handleSelectLandmark}
        />
      </Suspense>

      {/* HTML / React HUD Overlay */}
      <HCMOverlay
        theme={theme}
        onChangeTheme={setTheme}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((prev) => !prev)}
        showLandmarks={showLandmarks}
        onToggleLandmarks={() => setShowLandmarks((prev) => !prev)}
        activeView={activeView}
        onSelectView={handleSelectView}
        selectedLandmark={selectedLandmark}
        onClearSelectedLandmark={() => setSelectedLandmark(null)}
        onBackToMenu={onBackToMenu}
      />
    </div>
  );
};

const HCMLoadingFallback: React.FC = () => {
  const { t } = useTranslation("worlds");
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0f1a] text-white z-10">
      <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-[#141224]/90 border border-[#3b3454] shadow-2xl backdrop-blur-xl">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <div className="text-center space-y-1">
          <p className="text-sm font-bold tracking-wide uppercase text-zinc-100">
            {t("hcm.loading.title")}
          </p>
          <p className="text-xs text-zinc-400 font-mono">
            {t("hcm.loading.detail")}
          </p>
        </div>
      </div>
    </div>
  );
};

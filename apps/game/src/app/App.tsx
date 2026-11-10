import React, { useState, useEffect } from "react";
import { GameCanvas } from "../game/core/GameCanvas";
import { MainMenuOverlay } from "../features/menu/MainMenuOverlay";
import { HCMPage } from "../features/hochiminh";
import type { GameSettings } from "@scammaze/shared-types";

const SETTINGS_STORAGE_KEY = "scammaze_settings_v1";

const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: "medium",
  soundEnabled: true,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  fov: 72,
};

function getIsHCMRoute(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path.startsWith("/hochiminh") ||
    path.startsWith("/hcm") ||
    hash.includes("hochiminh") ||
    hash.includes("hcm")
  );
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<"menu" | "hochiminh">(() =>
    getIsHCMRoute() ? "hochiminh" : "menu"
  );

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(getIsHCMRoute() ? "hochiminh" : "menu");
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateTo = (newRoute: "menu" | "hochiminh") => {
    const targetPath = newRoute === "hochiminh" ? "/hochiminh" : "/";
    window.history.pushState(null, "", targetPath);
    setRoute(newRoute);
  };

  const handleUpdateSettings = (updates: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore localStorage quota errors
      }
      return next;
    });
  };

  // Global keyboard shortcuts (e.g. 'M' for mute when in menu)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "m" || e.key === "M") {
        handleUpdateSettings({ soundEnabled: !settings.soundEnabled });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.soundEnabled]);

  // Route: /hochiminh -> Standalone 3D Ho Chi Minh Map Explorer with rich colors
  if (route === "hochiminh") {
    return <HCMPage onBackToMenu={() => navigateTo("menu")} />;
  }

  // Route: / -> Original Main Menu Scene & Overlay
  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#13111f]">
      {/* 3D WebGL Canvas Layer */}
      <GameCanvas settings={settings} />

      {/* HTML / React Menu Overlay */}
      <MainMenuOverlay
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenHCM={() => navigateTo("hochiminh")}
      />
    </div>
  );
};

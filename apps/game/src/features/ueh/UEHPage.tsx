import React, { useRef, useState, useCallback, useEffect } from "react";
import { UEHCanvas } from "./UEHCanvas";
import { useTranslation } from "react-i18next";
import { UEHOverlay, UEH_TRACK_TITLES } from "./UEHOverlay";
import { usePlayerControls } from "../player";
import { useReality, rt } from "./state";
import { guitarAudio } from "./guitarAudio";
import { music } from "./music";
import type { GameSettings } from "@scammaze/shared-types";
import type { PlayerStats } from "../player";

interface UEHPageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
}

// Guitar position on bench under the flamboyant tree
const GUITAR_BENCH = {
  x: -1.94,
  z: 5.68,
};

export const UEHPage: React.FC<UEHPageProps> = ({
  settings,
  onBackToMenu,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("worlds");

  const {
    isLocked,
    keysRef,
    consumeMovement,
    consumePunchTrigger,
    consumeInspectTrigger,
    consumeInteractTrigger,
    togglePointerLock,
  } = usePlayerControls(containerRef);

  const [stats, setStats] = useState<PlayerStats>({
    position: [0, 1.85, 28],
    speed: 0,
    isSprinting: false,
    isGrounded: true,
    isBlocking: false,
  });

  const [isNearGuitar, setIsNearGuitar] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string>(() => useReality.getState().track ?? "mua-ha");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      music.stop();
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleStatsUpdate = useCallback((newStats: PlayerStats) => {
    setStats(newStats);
    const dist = Math.hypot(newStats.position[0] - GUITAR_BENCH.x, newStats.position[2] - GUITAR_BENCH.z);
    setIsNearGuitar(dist <= 3.0);
  }, []);

  const handleInteract = useCallback(() => {
    // Check if player is near the guitar on the bench
    const dist = Math.hypot(stats.position[0] - GUITAR_BENCH.x, stats.position[2] - GUITAR_BENCH.z);
    if (dist <= 3.2) {
      const active = useReality.getState().track ?? "mua-ha";
      const next = active === "mua-ha" ? "ngay-mai" : "mua-ha";

      guitarAudio.playChord(next, settings.sfxVolume);
      music.start(next);
      useReality.getState().set({ track: next });
      setCurrentTrack(next);

      if (next === "ngay-mai") {
        rt.rain = 0;
        rt.wetness = 0;
        rt.blossom = 1.0;
        setToastMessage(t("ueh.toast.ngayMai", { title: UEH_TRACK_TITLES["ngay-mai"] }));
      } else {
        rt.rain = 0.85;
        rt.wetness = 0.85;
        rt.blossom = 0.35;
        setToastMessage(t("ueh.toast.muaHa", { title: UEH_TRACK_TITLES["mua-ha"] }));
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToastMessage(null);
      }, 4500);
    }
  }, [stats.position, settings.sfxVolume, t]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-black select-none"
    >
      <UEHCanvas
        settings={settings}
        consumeMovement={consumeMovement}
        consumePunchTrigger={consumePunchTrigger}
        consumeInspectTrigger={consumeInspectTrigger}
        consumeInteractTrigger={consumeInteractTrigger}
        keysRef={keysRef}
        onStatsUpdate={handleStatsUpdate}
        onInteract={handleInteract}
      />

      <UEHOverlay
        isLocked={isLocked}
        onToggleLock={togglePointerLock}
        onBackToMenu={onBackToMenu}
        isNearGuitar={isNearGuitar}
        currentTrack={currentTrack}
        activeToast={toastMessage}
        stats={stats}
      />
    </div>
  );
};

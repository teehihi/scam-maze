import React, { useRef, useState, useCallback, useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { TestMoveCanvas } from "./TestMoveCanvas";
import { TestMoveOverlay } from "./TestMoveOverlay";
import { usePlayerControls, type PlayerStats } from "../player";
import type { GameSettings } from "@scammaze/shared-types";

interface TestMovePageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
}

export const TestMovePage: React.FC<TestMovePageProps> = ({
  settings,
  onBackToMenu,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const {
    keysRef,
    isLocked,
    togglePointerLock,
    consumeMovement,
    consumePunchTrigger: rawConsumePunchTrigger,
    consumeInspectTrigger,
    consumeInteractTrigger,
  } = usePlayerControls(containerRef);

  const { progress } = useProgress();
  const [sceneReady, setSceneReady] = useState(false);
  const showLoading = !sceneReady;

  const [stats, setStats] = useState<PlayerStats>({
    position: [188.6, -92.70, -88.89],
    speed: 0,
    isSprinting: false,
    isGrounded: true,
    isBlocking: false,
    isDriving: false,
    isNearCar: false,
    carSpeed: 0,
    carGear: "P",
  });

  const consumePunchTrigger = useCallback(() => {
    return rawConsumePunchTrigger();
  }, [rawConsumePunchTrigger]);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const handleStatsUpdate = useCallback((newStats: PlayerStats) => {
    setStats(newStats);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-[#13111f] select-none"
    >
      <TestMoveCanvas
        settings={settings}
        consumeMovement={consumeMovement}
        consumePunchTrigger={consumePunchTrigger}
        consumeInspectTrigger={consumeInspectTrigger}
        consumeInteractTrigger={consumeInteractTrigger}
        keysRef={keysRef}
        onStatsUpdate={handleStatsUpdate}
        onSceneReady={() => setSceneReady(true)}
      />

      {showLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#13111f] text-white">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            <div className="text-center font-mono">
              <p className="text-sm font-semibold text-zinc-300">Đang tải bản đồ đường phố 3D...</p>
              <p className="text-xs text-zinc-500 mt-1">{Math.round(progress)}%</p>
            </div>
          </div>
        </div>
      )}

      <TestMoveOverlay
        isLocked={isLocked}
        onToggleLock={togglePointerLock}
        onBackToMenu={onBackToMenu}
        stats={stats}
      />
    </div>
  );
};

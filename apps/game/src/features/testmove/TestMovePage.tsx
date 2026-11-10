import React, { useRef, useState, useCallback, useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { TestMoveCanvas } from "./TestMoveCanvas";
import { TestMoveOverlay } from "./TestMoveOverlay";
import { usePlayerControls } from "./usePlayerControls";
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
  } = usePlayerControls(containerRef);

  const { progress } = useProgress();
  const [sceneReady, setSceneReady] = useState(false);
  const showLoading = !sceneReady;

  const [stats, setStats] = useState({
    position: [188.6, -92.70, -88.89] as [number, number, number],
    speed: 0,
    isSprinting: false,
    isGrounded: true,
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

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden select-none bg-[#13111f]"
    >
      {/* 3D Scene View */}
      <TestMoveCanvas
        settings={settings}
        consumeMovement={consumeMovement}
        consumePunchTrigger={consumePunchTrigger}
        consumeInspectTrigger={consumeInspectTrigger}
        keysRef={keysRef}
        onStatsUpdate={setStats}
        onSceneReady={() => setSceneReady(true)}
      />

      {/* HTML Overlay with Crosshair, HUD & Controls */}
      <TestMoveOverlay
        isLocked={isLocked}
        onToggleLock={togglePointerLock}
        onBackToMenu={onBackToMenu}
        stats={stats}
      />

      {/* Fast loading screen with real progress so the screen is never black */}
      {showLoading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0e0d16] text-white select-none transition-opacity duration-300">
          <div className="flex flex-col items-center space-y-4 max-w-sm px-6 text-center">
            <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-wide text-zinc-100 font-mono uppercase">
                Chuẩn bị môi trường thử nghiệm
              </h3>
              <p className="text-xs text-zinc-400">
                Tải mô hình đường phố Quận 4 & cánh tay 3D...
              </p>
            </div>
            <div className="w-48 h-1.5 bg-[#1b172b] rounded-full overflow-hidden border border-[#3b3452]">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-[width] duration-150"
                style={{ width: `${Math.min(Math.round(progress), 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-[#b9a5f5]">
              {Math.min(Math.round(progress), 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

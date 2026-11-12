import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HUE_PLACE_NAMES } from './placeNames';
import { HueWorldEngine } from './engine/HueWorldEngine';
import type { PlayerStats } from './engine/HueWorldEngine';
import { HueHUD } from './components/HueHUD';
import { usePlayerControls } from '../player';
import type { GameSettings } from '@scammaze/shared-types';

interface HuePageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
}

export const HuePage: React.FC<HuePageProps> = ({
  settings: _settings,
  onBackToMenu,
}) => {
  const { t } = useTranslation('worlds');
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controls = usePlayerControls(mountRef);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const engineRef = useRef<HueWorldEngine | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState<PlayerStats>({
    position: [-210, 6.05, -52],
    speed: 0,
    isSprinting: false,
    isGrounded: true,
  });
  const [bellToast, setBellToast] = useState(false);
  const bellTimerRef = useRef<number | null>(null);

  const handleStatsUpdate = useCallback((nextStats: PlayerStats) => {
    setStats(nextStats);
  }, []);

  const handleStatsUpdateRef = useRef(handleStatsUpdate);
  handleStatsUpdateRef.current = handleStatsUpdate;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // Stable delegating controls proxy so engine is never re-instantiated on state updates
    const controlsProxy = {
      get keysRef() {
        return controlsRef.current.keysRef;
      },
      get isLocked() {
        return controlsRef.current.isLocked;
      },
      consumeMovement: () => controlsRef.current.consumeMovement(),
      consumePunchTrigger: () => controlsRef.current.consumePunchTrigger(),
      consumeInspectTrigger: () => controlsRef.current.consumeInspectTrigger(),
      consumeInteractTrigger: () => controlsRef.current.consumeInteractTrigger(),
      togglePointerLock: () => controlsRef.current.togglePointerLock(),
      lockPointer: () => controlsRef.current.lockPointer(),
      unlockPointer: () => controlsRef.current.unlockPointer(),
    };

    const engine = new HueWorldEngine(el, controlsProxy, {
      onReady: () => setIsReady(true),
      onStatsUpdate: (s) => handleStatsUpdateRef.current?.(s),
      onBellRung: () => {
        setBellToast(true);
        if (bellTimerRef.current) window.clearTimeout(bellTimerRef.current);
        bellTimerRef.current = window.setTimeout(() => setBellToast(false), 4200);
      },
    });
    engineRef.current = engine;

    const handleUnload = () => {
      engine.dispose();
    };
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      if (bellTimerRef.current) window.clearTimeout(bellTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []); // Run ONCE on mount — prevents infinite WebGL recreation loop

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0e1116] select-none">
      {!isReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0e13] text-[#e8cf9b] transition-opacity duration-500">
          <div className="h-10 w-10 rounded-full border-2 border-[#d6b372]/30 border-t-[#d6b372] animate-spin mb-4" />
          <p className="text-xs tracking-widest uppercase font-mono text-[#d6b372]">
            {t('hue.loading', { city: HUE_PLACE_NAMES.city })}
          </p>
        </div>
      )}

      <div
        ref={mountRef}
        onClick={() => {
          if (!controls.isLocked) {
            controls.lockPointer();
          }
        }}
        className="h-full w-full cursor-grab active:cursor-grabbing outline-none"
        tabIndex={0}
      />
      <HueHUD
        isLocked={controls.isLocked}
        onToggleLock={controls.togglePointerLock}
        stats={stats}
        bellToast={bellToast}
        onBackToMenu={onBackToMenu}
      />
    </div>
  );
};

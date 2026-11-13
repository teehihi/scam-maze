import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameSettings } from '@scammaze/shared-types';
import { usePlayerControls } from '../player';
import { LoadingProgress } from '../../components/ui/LoadingProgress';
import { MientayHUD } from './components/MientayHUD';
import {
  LOAD_STAGES,
  MekongWorldEngine,
  type LoadProgress,
  type MekongControls,
  type MekongTelemetry,
  type PlayerStats,
  type TraversalMode,
  type WorldBookmark,
} from './engine/MekongWorldEngine';
import { MIENTAY_PLACE_NAMES } from './placeNames';
import { createLiveValue } from './liveValue';

interface MientayPageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
}

const INITIAL_STATS: PlayerStats = {
  position: [17, 3, 27.4],
  speed: 0,
  isSprinting: false,
  isGrounded: true,
  isBlocking: false,
};

const INITIAL_TELEMETRY: MekongTelemetry = {
  mode: 'walk',
  nearBoat: false,
  zone: 'ferryPier',
  timeOfDay: 6.9,
  audioOn: false,
  performanceMode: false,
};

export const MientayPage: React.FC<MientayPageProps> = ({ settings, onBackToMenu }) => {
  const { t } = useTranslation('worlds');
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controls = usePlayerControls(mountRef);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const engineRef = useRef<MekongWorldEngine | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [progress, setProgress] = useState<LoadProgress>({ stage: LOAD_STAGES[0].id, fraction: 0 });
  const [ready, setReady] = useState(false);
  // Updated many times a second, so kept out of React state (see liveValue.ts).
  const [statsStore] = useState(() => createLiveValue<PlayerStats>(INITIAL_STATS));
  const [fpsStore] = useState(() => createLiveValue(60));
  const [telemetry, setTelemetry] = useState<MekongTelemetry>(INITIAL_TELEMETRY);
  const [hudVisible, setHudVisible] = useState(true);

  useEffect(() => {
    const element = mountRef.current;
    if (!element) return;

    // Stable delegating proxy, so the engine never needs to be rebuilt when the hook re-renders.
    const controlsProxy: MekongControls = {
      get keysRef() {
        return controlsRef.current.keysRef;
      },
      consumeMovement: () => controlsRef.current.consumeMovement(),
      consumePunchTrigger: () => controlsRef.current.consumePunchTrigger(),
      consumeInspectTrigger: () => controlsRef.current.consumeInspectTrigger(),
      consumeInteractTrigger: () => controlsRef.current.consumeInteractTrigger(),
    };

    const abort = new AbortController();
    let created: MekongWorldEngine | null = null;

    MekongWorldEngine.create(
      element,
      controlsProxy,
      {
        onProgress: (next) => {
          if (!abort.signal.aborted) setProgress(next);
        },
        onTelemetry: (next) => {
          if (!abort.signal.aborted) setTelemetry(next);
        },
        onStatsUpdate: (next) => {
          if (!abort.signal.aborted) statsStore.set(next);
        },
        onFps: (next) => {
          if (!abort.signal.aborted) fpsStore.set(next);
        },
      },
      {
        fov: settingsRef.current.fov,
        graphicsQuality: settingsRef.current.graphicsQuality,
        soundEnabled: settingsRef.current.soundEnabled,
        baseline: new URLSearchParams(window.location.search).has('mientay-baseline'),
      },
      abort.signal,
    )
      .then((engine) => {
        if (abort.signal.aborted) {
          engine.dispose();
          return;
        }
        created = engine;
        engineRef.current = engine;
        setReady(true);
      })
      .catch((error: unknown) => {
        // A build cancelled by leaving the page is expected; anything else is a real failure.
        if (!MekongWorldEngine.isCancelled(error)) console.error('Failed to build the Mekong world:', error);
      });

    const handleUnload = () => {
      abort.abort();
      created?.dispose();
    };
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      abort.abort();
      created?.dispose();
      engineRef.current = null;
    };
  }, [statsStore, fpsStore]); // Run once on mount: rebuilding the world would be expensive.

  useEffect(() => {
    engineRef.current?.setFov(settings.fov);
  }, [settings.fov, ready]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === 'KeyH' && !event.repeat) setHudVisible((visible) => !visible);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLock = useCallback(() => {
    // The first click is also the user gesture that lets the river ambience start.
    engineRef.current?.startAudioFromGesture();
    if (!controlsRef.current.isLocked) controlsRef.current.lockPointer();
  }, []);

  const handleModeChange = useCallback((mode: TraversalMode) => engineRef.current?.setMode(mode), []);
  const handleBookmark = useCallback((bookmark: WorldBookmark) => engineRef.current?.applyBookmark(bookmark), []);
  const handleTime = useCallback(
    (hours: number, commit: boolean) => engineRef.current?.setTimeOfDay(hours, commit),
    [],
  );
  const handleAudio = useCallback(() => engineRef.current?.toggleAudio(), []);
  const handlePerformance = useCallback(() => {
    const engine = engineRef.current;
    engine?.setPerformanceMode(!engine.isPerformanceMode());
  }, []);

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-stone-950">
      {!ready && (
        <div
          role="status"
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0b0e0c] px-6 text-[#f3e6c4]"
        >
          <div className="w-full max-w-xl space-y-5">
            <div className="space-y-1.5 text-center">
              <h1 className="font-display text-3xl text-amber-100 sm:text-4xl">
                {t('mientay.loading.title', { region: MIENTAY_PLACE_NAMES.region })}
              </h1>
              <p className="text-sm text-stone-400">{t('mientay.loading.hint')}</p>
            </div>
            <LoadingProgress progress={progress.fraction} status={t(`mientay.loading.stages.${progress.stage}`)} />
          </div>
        </div>
      )}
      <div
        ref={mountRef}
        onClick={handleLock}
        className="h-full w-full cursor-grab outline-none active:cursor-grabbing"
        tabIndex={0}
      />
      {ready && (
        <MientayHUD
          isLocked={controls.isLocked}
          onToggleLock={handleLock}
          stats={statsStore}
          fps={fpsStore}
          telemetry={telemetry}
          visible={hudVisible}
          onToggleVisible={() => setHudVisible((visible) => !visible)}
          onBackToMenu={onBackToMenu}
          onModeChange={handleModeChange}
          onBookmark={handleBookmark}
          onTimeChange={handleTime}
          onToggleAudio={handleAudio}
          onTogglePerformance={handlePerformance}
        />
      )}
    </div>
  );
};

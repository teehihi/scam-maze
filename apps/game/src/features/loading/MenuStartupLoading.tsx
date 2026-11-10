import React, { useEffect, useState, useSyncExternalStore } from "react";
import { useProgress } from "@react-three/drei";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { SceneTransition } from "../../components/ui/SceneTransition";
import { createLoadingError } from "../../game/loading/loadingErrors";
import { formatFileCount, LOADING_TEXT } from "../../game/loading/loadingStrings";
import { menuAssetProgress } from "../../game/loading/menuAssetProgress";
import { STARTUP_LOADING_MIN_DISPLAY_MS } from "./loadingHold";
import { shouldShowLoadingScreen, useMinimumDisplayTime } from "./useMinimumDisplayTime";

/** Show a "taking longer than usual" notice when nothing changes for this long. */
export const STARTUP_SLOW_NOTICE_MS = 30_000;

/**
 * Minimum time the startup screen stays visible, so a fast (cached) load does not flash.
 * Presentation-only: it never advances progress or decides whether loading succeeded.
 */
export { STARTUP_LOADING_MIN_DISPLAY_MS };

interface MenuStartupLoadingProps {
  /** True once the menu scene has compiled its shaders and is visible. */
  sceneReady: boolean;
  /** Message from the canvas error boundary, if the 3D scene crashed. */
  sceneError: string | null;
  /** Called once, after the screen has faded out. */
  onFinished: () => void;
}

/**
 * Startup screen for the main menu scene.
 *
 * The percentage comes from `menuAssetProgress`, which measures the downloaded bytes of the
 * street file. While those bytes arrive the bar shows that percent; once they are all in, the bar
 * is full and the status says the scene is still being prepared. After Scene_Ready the bar is
 * full with "Ready", also while the screen is held for the minimum display time.
 *
 * When the file size is unknown (no byte percent yet), the bar is indeterminate and the screen
 * falls back to Drei's useProgress file count. useProgress follows THREE.DefaultLoadingManager
 * for the whole page, which is correct here because at startup only the menu scene's loaders
 * run. Its file total grows while the GLB is parsed, so it is shown as text, never as a percent.
 * useProgress also remains the source of load errors.
 */
export const MenuStartupLoading: React.FC<MenuStartupLoadingProps> = ({
  sceneReady,
  sceneError,
  onFinished,
}) => {
  const { loaded, total, errors } = useProgress();
  // The store's subscribe and getPercent are bound closures, so they can be passed directly.
  const bytePercent = useSyncExternalStore(
    menuAssetProgress.subscribe,
    menuAssetProgress.getPercent,
    menuAssetProgress.getPercent,
  );
  const [dismissed, setDismissed] = useState(false);
  const [slow, setSlow] = useState(false);

  const failed = errors.length > 0 || sceneError !== null;
  const minElapsed = useMinimumDisplayTime(STARTUP_LOADING_MIN_DISPLAY_MS);
  // "Continue to menu" (error or slow notice) bypasses the hold.
  const visible = shouldShowLoadingScreen({ done: sceneReady, minElapsed, bypassed: dismissed });

  // Watchdog: restarts whenever real progress changes. It never advances progress itself.
  useEffect(() => {
    setSlow(false);
    if (!visible || failed) return;
    const timer = setTimeout(() => setSlow(true), STARTUP_SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [loaded, total, bytePercent, visible, failed]);

  const error = failed
    ? errors.length > 0
      ? createLoadingError("network", `Could not load: ${errors.join(", ")}`)
      : createLoadingError("webgl-init", sceneError ?? undefined)
    : null;

  let status: string = LOADING_TEXT.menuStartup.startingEngine;
  let detail: string | undefined;
  let progress: number | null = null;
  if (sceneReady && !error) {
    // Scene is ready; the screen is only being held for the minimum display time.
    status = LOADING_TEXT.menuStartup.ready;
    progress = 1;
  } else if (bytePercent === 100) {
    // All bytes are in; shaders may still be compiling, so the status says work remains.
    status = LOADING_TEXT.menuStartup.preparingScene;
    progress = 1;
  } else if (bytePercent !== null) {
    // Measured download percent; the Drei file count would contradict it, so it is omitted.
    status = LOADING_TEXT.menuStartup.loadingFiles;
    progress = bytePercent / 100;
  } else if (total > 0 && loaded < total) {
    status = LOADING_TEXT.menuStartup.loadingFiles;
    detail = formatFileCount(loaded, total);
  } else if (total > 0) {
    status = LOADING_TEXT.menuStartup.preparingScene;
  }

  const dismiss = () => setDismissed(true);

  return (
    <SceneTransition visible={visible} fadeIn={false} onHidden={onFinished} className="z-50">
      <LoadingScreen
        eyebrow={LOADING_TEXT.menuStartup.eyebrow}
        chapterTitle={LOADING_TEXT.menuStartup.title}
        subtitle={LOADING_TEXT.menuStartup.subtitle}
        loadingStage={status}
        progress={progress}
        progressDetail={detail}
        notice={
          slow
            ? {
                message: LOADING_TEXT.menuStartup.slowNotice,
                actionLabel: LOADING_TEXT.continueToMenu,
                onAction: dismiss,
              }
            : null
        }
        error={error}
        onRetry={() => window.location.reload()}
        retryLabel={LOADING_TEXT.reload}
        onBackToMenu={dismiss}
        backLabel={LOADING_TEXT.continueToMenu}
      />
    </SceneTransition>
  );
};

import React, { useCallback, useState } from "react";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { SceneTransition } from "../../components/ui/SceneTransition";
import { getChapter } from "../../game/chapters/chapterRegistry";
import type { ChapterSession } from "../../game/chapters/chapterSession";
import type { ChapterLoaderDeps, ChapterLoadRequest } from "../../game/loading/chapterLoader";
import { useTranslation } from "react-i18next";
import {
  describeChapterStage,
  formatFileCount,
  type LoadingTextContext,
} from "../../game/loading/loadingStrings";
import { useChapterLoader } from "../../game/loading/useChapterLoader";
import { useGameLocale } from "../../i18n";
import { CHAPTER_LOADING_MIN_DISPLAY_MS } from "./loadingHold";
import { shouldShowLoadingScreen, useMinimumDisplayTime } from "./useMinimumDisplayTime";

/** Minimum time the chapter loading screen stays visible, even when the load is instant. */
export { CHAPTER_LOADING_MIN_DISPLAY_MS };

interface ChapterLoadingFlowProps {
  request: ChapterLoadRequest;
  /** Called once, after the loading screen has faded out with a ready session. */
  onEnterChapter: (session: ChapterSession) => void;
  /** Called once, after the loading screen has faded out because the player left. */
  onBackToMenu: () => void;
  deps?: ChapterLoaderDeps;
  /**
   * Extra work that must finish before the screen fades out, for example building the first 3D
   * scene behind it. Its progress is added to the bar and its line shown once the files are in.
   */
  hold?: LoadingHold | null;
}

export interface LoadingHold {
  /** 0..1 */
  progress: number;
  /** Text of the current step, already translated. */
  stage: string;
  done: boolean;
}

/** Share of the bar that belongs to the files when there is extra work (`hold`). */
const FILES_SHARE = 0.55;

/** Connects the chapter loader to the loading screen and the fade transition. */
export const ChapterLoadingFlow: React.FC<ChapterLoadingFlowProps> = ({
  request,
  onEnterChapter,
  onBackToMenu,
  deps,
  hold = null,
}) => {
  const { snapshot, retry, cancel } = useChapterLoader(request, deps);
  const [leavingToMenu, setLeavingToMenu] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { t } = useTranslation(["loading", "common"]);
  const { t: tChapters } = useTranslation("chapters");
  const locale = useGameLocale();
  const text: LoadingTextContext = { t, locale };

  // Presentation-only hold so a fast (cached) load is still readable. Restarts on Retry.
  const minElapsed = useMinimumDisplayTime(CHAPTER_LOADING_MIN_DISPLAY_MS, attempt);

  const session = snapshot.stage === "ready" ? snapshot.session : null;
  const visible = shouldShowLoadingScreen({ done: session !== null && (hold === null || hold.done), minElapsed, bypassed: leavingToMenu });

  const handleRetry = useCallback(() => {
    retry();
    setAttempt((value) => value + 1);
  }, [retry]);

  // Leaving (Cancel, Escape, Return to menu) skips the hold.
  const handleBack = useCallback(() => {
    cancel();
    setLeavingToMenu(true);
  }, [cancel]);

  const handleHidden = useCallback(() => {
    if (leavingToMenu) onBackToMenu();
    else if (session) onEnterChapter(session);
  }, [leavingToMenu, session, onBackToMenu, onEnterChapter]);

  // The loading screen never names the chapter (no number, title or subtitle), so the player is
  // not told in advance what the story is about. Chapter data is still used for asset text.
  const chapter = snapshot.chapter ?? (request.kind === "new-game" ? getChapter(request.chapterId) : undefined) ?? null;
  const isNewGame = request.kind === "new-game";
  const eyebrow = isNewGame ? t("loading:newGameEyebrow") : t("loading:continueEyebrow");
  const title = isNewGame ? t("loading:newGameTitle") : t("loading:continueTitle");
  const subtitle = isNewGame ? t("loading:newGameSubtitle") : t("loading:continueSubtitle");
  const filesStageText =
    snapshot.stage === "loading-assets" && chapter && snapshot.currentAssetId && snapshot.currentAssetText
      ? tChapters(`${chapter.id}.assets.${snapshot.currentAssetId}`, { defaultValue: snapshot.currentAssetText })
      : describeChapterStage(snapshot, text);
  const detail =
    snapshot.stage === "loading-assets" && snapshot.filesTotal > 0
      ? formatFileCount(snapshot.filesCompleted, snapshot.filesTotal, text)
      : undefined;
  const filesProgress = snapshot.stage === "loading-assets" ? snapshot.progress : snapshot.stage === "ready" ? 1 : null;
  // With extra work the bar is files first, then the scene; the scene's line is shown once the files are in.
  const progress =
    hold === null || snapshot.error
      ? filesProgress
      : (filesProgress ?? 0) * FILES_SHARE + Math.min(1, Math.max(0, hold.progress)) * (1 - FILES_SHARE);
  const stageText = hold !== null && session !== null && !hold.done ? hold.stage : filesStageText;

  return (
    <SceneTransition visible={visible} fadeIn={false} onHidden={handleHidden} className="z-50">
      <LoadingScreen
        eyebrow={eyebrow}
        chapterId={chapter?.id}
        chapterTitle={title}
        subtitle={subtitle}
        loadingStage={stageText}
        progress={progress}
        progressDetail={detail}
        error={snapshot.error}
        onRetry={handleRetry}
        onBackToMenu={handleBack}
        onCancel={snapshot.error ? undefined : handleBack}
      />
    </SceneTransition>
  );
};

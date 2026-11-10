import React, { useCallback, useState } from "react";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { SceneTransition } from "../../components/ui/SceneTransition";
import { getChapter } from "../../game/chapters/chapterRegistry";
import type { ChapterSession } from "../../game/chapters/chapterSession";
import type { ChapterLoaderDeps, ChapterLoadRequest } from "../../game/loading/chapterLoader";
import {
  describeChapterStage,
  formatChapterLabel,
  formatFileCount,
  LOADING_TEXT,
} from "../../game/loading/loadingStrings";
import { useChapterLoader } from "../../game/loading/useChapterLoader";
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
}

/** Connects the chapter loader to the loading screen and the fade transition. */
export const ChapterLoadingFlow: React.FC<ChapterLoadingFlowProps> = ({
  request,
  onEnterChapter,
  onBackToMenu,
  deps,
}) => {
  const { snapshot, retry, cancel } = useChapterLoader(request, deps);
  const [leavingToMenu, setLeavingToMenu] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Presentation-only hold so a fast (cached) load is still readable. Restarts on Retry.
  const minElapsed = useMinimumDisplayTime(CHAPTER_LOADING_MIN_DISPLAY_MS, attempt);

  const session = snapshot.stage === "ready" ? snapshot.session : null;
  const visible = shouldShowLoadingScreen({ done: session !== null, minElapsed, bypassed: leavingToMenu });

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

  // Before the loader reports a chapter, show what was requested (or a generic "Continue").
  const requested = request.kind === "new-game" ? getChapter(request.chapterId) : undefined;
  const chapter = snapshot.chapter ?? requested ?? null;

  const eyebrow = chapter ? formatChapterLabel(chapter.number) : LOADING_TEXT.continueEyebrow;
  const title = chapter?.title ?? LOADING_TEXT.continueTitle;
  const subtitle = chapter?.subtitle ?? LOADING_TEXT.continueSubtitle;
  const detail =
    snapshot.stage === "loading-assets" && snapshot.filesTotal > 0
      ? formatFileCount(snapshot.filesCompleted, snapshot.filesTotal)
      : undefined;
  const progress = snapshot.stage === "loading-assets" ? snapshot.progress : snapshot.stage === "ready" ? 1 : null;

  return (
    <SceneTransition visible={visible} fadeIn={false} onHidden={handleHidden} className="z-50">
      <LoadingScreen
        eyebrow={eyebrow}
        chapterId={chapter?.id}
        chapterTitle={title}
        subtitle={subtitle}
        loadingStage={describeChapterStage(snapshot)}
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

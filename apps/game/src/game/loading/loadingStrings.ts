import type { ChapterLoadSnapshot, LoadingStage } from "./chapterLoader";

/** Player-facing text for the loading flow. Complete strings, ready for extraction. */
export const LOADING_TEXT = {
  stage: {
    starting: "Getting ready",
    "restoring-save": "Reading your saved game",
    "checking-device": "Checking your device",
    "loading-assets": "Loading chapter files",
    "initializing-state": "Setting up the chapter",
    "validating-save": "Checking your saved progress",
    ready: "Ready",
    error: "Loading failed",
  } satisfies Record<LoadingStage, string>,
  menuStartup: {
    eyebrow: "Main menu",
    title: "Your street",
    subtitle: "The neighborhood is waking up.",
    startingEngine: "Starting the 3D engine",
    loadingFiles: "Loading the street scene",
    preparingScene: "Preparing the street scene",
    ready: "Ready",
    slowNotice: "This is taking longer than usual. You can keep waiting or reload the page.",
  },
  continueEyebrow: "Saved game",
  continueTitle: "Continue",
  continueSubtitle: "Picking up where you left off.",
  tipLabel: "Awareness tip",
  nextTip: "Next tip",
  cancel: "Cancel",
  retry: "Try again",
  reload: "Reload page",
  backToMenu: "Return to menu",
  continueToMenu: "Continue to menu",
  progressLabel: "Loading progress",
} as const;

export function formatChapterLabel(chapterNumber: number): string {
  return `Chapter ${chapterNumber}`;
}

export function formatFileCount(completed: number, total: number): string {
  return total === 1 ? `${completed} of 1 file` : `${completed} of ${total} files`;
}

/** Main status line for a chapter loader snapshot. */
export function describeChapterStage(snapshot: ChapterLoadSnapshot): string {
  if (snapshot.stage === "loading-assets" && snapshot.currentAssetText) {
    return snapshot.currentAssetText;
  }
  return LOADING_TEXT.stage[snapshot.stage];
}

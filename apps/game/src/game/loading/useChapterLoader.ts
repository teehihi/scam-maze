import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  createChapterLoader,
  createDefaultLoaderDeps,
  INITIAL_SNAPSHOT,
  type ChapterLoader,
  type ChapterLoaderDeps,
  type ChapterLoadRequest,
  type ChapterLoadSnapshot,
} from "./chapterLoader";

let defaultDeps: ChapterLoaderDeps | null = null;
function getDefaultDeps(): ChapterLoaderDeps {
  defaultDeps ??= createDefaultLoaderDeps();
  return defaultDeps;
}

const noopSubscribe = () => () => {};
const getInitialSnapshot = () => INITIAL_SNAPSHOT;

/**
 * Runs a chapter loader for the given request. A new loader is created per attempt; the
 * previous one is cancelled (downloads aborted) on retry, request change or unmount.
 */
export function useChapterLoader(
  request: ChapterLoadRequest,
  deps?: ChapterLoaderDeps,
): { snapshot: ChapterLoadSnapshot; retry: () => void; cancel: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [loader, setLoader] = useState<ChapterLoader | null>(null);

  useEffect(() => {
    const next = createChapterLoader(request, deps ?? getDefaultDeps());
    setLoader(next);
    next.start();
    return () => next.cancel();
  }, [request, deps, attempt]);

  const snapshot = useSyncExternalStore(
    loader ? loader.subscribe : noopSubscribe,
    loader ? loader.getSnapshot : getInitialSnapshot,
  );

  const retry = useCallback(() => {
    setLoader(null);
    setAttempt((value) => value + 1);
  }, []);

  const cancel = useCallback(() => loader?.cancel(), [loader]);

  return { snapshot, retry, cancel };
}
